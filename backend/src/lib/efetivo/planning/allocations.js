import { recordEfetivoAudit } from './audit.js';
import {
  collectAllocationConflicts,
  ensureNoPlanningConflicts,
  loadCollaboratorConflictData,
  lockCollaborator
} from './conflicts.js';
import { parseDateKey } from './date-only.js';
import { conflictError, notFound, planningError } from './errors.js';
import {
  allocationPeriod,
  allocationPeriodWithinMission,
  maximumConcurrentAllocationCount
} from './allocation-period.js';
import { missionEndsOnOrAfter, missionPeriod } from './mission-period.js';
import { missionInclude } from './mission-planning.js';
import { bumpPlanRevision, requireEditablePlan, resolvePlanningDatabase, runPlanningTransaction } from './plan-context.js';

async function requireMissionForAllocation(tx, missionId) {
  const mission = await tx.efetivoMissionPlan.findUnique({
    where: { id: missionId },
    include: { plan: true, demands: { include: { jobRole: true } }, allocations: { where: { deletedAt: null } } }
  });
  if (!mission || mission.deletedAt) throw notFound('Missão operacional não encontrada.');
  return mission;
}

function utcDate(value) {
  return new Date(`${parseDateKey(value)}T00:00:00.000Z`);
}

function requestedAllocationPeriod(mission, payload = {}) {
  const fallback = missionPeriod(mission);
  const period = {
    startDate: parseDateKey(payload.mobilizationDate || fallback.startDate),
    endDate: parseDateKey(payload.demobilizationDate || fallback.endDate)
  };
  if (!allocationPeriodWithinMission(period, mission)) {
    throw planningError('O período individual deve estar dentro das datas da missão.', {
      code: 'INVALID_ALLOCATION_PERIOD'
    });
  }
  return period;
}

function rolePeriods(mission, jobRoleId, ignoredAllocationId = null) {
  return (mission.allocations || [])
    .filter(item => !item.deletedAt && item.id !== ignoredAllocationId && item.jobRoleId === jobRoleId)
    .map(item => allocationPeriod(item, mission));
}

function ensureDemandCapacity(mission, jobRoleId, period, ignoredAllocationId = null) {
  const demand = mission.demands.find(item => item.jobRoleId === jobRoleId);
  if (!demand) throw conflictError('A função não faz parte da demanda da missão.', [], 'JOB_ROLE_NOT_DEMANDED');
  const concurrent = maximumConcurrentAllocationCount([
    ...rolePeriods(mission, jobRoleId, ignoredAllocationId),
    period
  ]);
  if (concurrent > demand.requiredCount) {
    throw conflictError('A demanda desta função já está completa neste período.', [], 'DEMAND_FULL');
  }
  return demand;
}

function storedAllocationPeriod(mission, period) {
  const bounds = missionPeriod(mission);
  return {
    mobilizationDate: period.startDate === bounds.startDate ? null : utcDate(period.startDate),
    demobilizationDate: period.endDate === bounds.endDate ? null : utcDate(period.endDate)
  };
}

export async function allocateCollaboratorInTransaction(tx, mission, payload, context = {}, source = 'MANUAL') {
  const existingSame = mission.allocations.find(item => item.collaboratorId === payload.collaboratorId);
  if (existingSame && !existingSame.deletedAt) return existingSame;
  const period = requestedAllocationPeriod(mission, payload);
  const demand = ensureDemandCapacity(mission, payload.jobRoleId, period);

  await lockCollaborator(tx, payload.collaboratorId);
  const data = await loadCollaboratorConflictData(tx, payload.collaboratorId, period, mission.planId);
  if (!data.collaborator) throw notFound('Colaborador não encontrado.');
  ensureNoPlanningConflicts(collectAllocationConflicts({
    ...data,
    collaborator: data.collaborator,
    jobRoleId: payload.jobRoleId,
    period,
    ignoredMissionId: mission.id,
    allowMissionOverlap: Boolean(payload.allowMissionOverlap),
    requireCandidateMissionOverlapConfirmation: true
  }));
  const periodData = {
    ...storedAllocationPeriod(mission, period),
    allowMissionOverlap: Boolean(payload.allowMissionOverlap)
  };
  const allocation = await tx.efetivoMissionAllocation.upsert({
    where: { missionId_collaboratorId: { missionId: mission.id, collaboratorId: payload.collaboratorId } },
    create: {
      missionId: mission.id,
      collaboratorId: payload.collaboratorId,
      jobRoleId: payload.jobRoleId,
      jobRoleNameSnapshot: demand.jobRole.name,
      ...periodData,
      source,
      createdByUserId: context.actorUserId || null
    },
    update: {
      jobRoleId: payload.jobRoleId,
      jobRoleNameSnapshot: demand.jobRole.name,
      ...periodData,
      source,
      deletedAt: null,
      createdByUserId: context.actorUserId || null
    }
  });
  mission.allocations.push(allocation);
  return allocation;
}

export async function listEligibleCollaborators(missionId, jobRoleId, filters = {}, dependencies = {}) {
  if (filters?.database && !dependencies.database) {
    dependencies = filters;
    filters = {};
  }
  const database = await resolvePlanningDatabase(dependencies.database);
  const mission = await requireMissionForAllocation(database, missionId);
  const period = requestedAllocationPeriod(mission, filters);
  const [collaborators, absences, overlapping] = await Promise.all([
    database.collaborator.findMany({ where: { jobRoleId, isActive: true }, orderBy: [{ admissionDate: 'asc' }, { name: 'asc' }] }),
    database.collaboratorAbsence.findMany({
      where: { deletedAt: null, startDate: { lte: new Date(`${period.endDate}T00:00:00.000Z`) }, endDate: { gte: new Date(`${period.startDate}T00:00:00.000Z`) } }
    }),
    database.efetivoMissionAllocation.findMany({
      where: {
        deletedAt: null,
        mission: { planId: mission.planId, deletedAt: null, scheduleStatus: 'CONFIRMED', id: { not: mission.id }, mobilizationDate: { lte: new Date(`${period.endDate}T00:00:00.000Z`) }, ...missionEndsOnOrAfter(new Date(`${period.startDate}T00:00:00.000Z`)) }
      }, include: { mission: true }
    })
  ]);
  const alreadyAllocatedIds = new Set(mission.allocations.filter(item => !item.deletedAt).map(item => item.collaboratorId));
  return collaborators.flatMap(collaborator => {
    if (alreadyAllocatedIds.has(collaborator.id)) return [];
    const conflicts = collectAllocationConflicts({
      collaborator,
      jobRoleId,
      period,
      absences: absences.filter(item => item.collaboratorId === collaborator.id),
      allocations: overlapping.filter(item => item.collaboratorId === collaborator.id),
      ignoredMissionId: mission.id,
      requireCandidateMissionOverlapConfirmation: true
    });
    const hardConflicts = conflicts.filter(conflict => conflict.sourceType !== 'MISSION');
    if (hardConflicts.length) return [];
    const missionConflicts = conflicts.filter(conflict => conflict.sourceType === 'MISSION');
    return [{
      id: collaborator.id,
      name: collaborator.name,
      jobRoleId: collaborator.jobRoleId,
      admissionDate: collaborator.admissionDate,
      missionConflicts,
      requiresMissionOverlapConfirmation: missionConflicts.length > 0
    }];
  });
}

export async function addMissionAllocation(missionId, payload, context = {}, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  return runPlanningTransaction(database, async tx => {
    const mission = await requireMissionForAllocation(tx, missionId);
    const plan = await requireEditablePlan(tx, mission.planId, { actorUserId: context.actorUserId });
    const allocation = await allocateCollaboratorInTransaction(tx, mission, payload, context, 'MANUAL');
    await bumpPlanRevision(tx, plan);
    await recordEfetivoAudit(tx, {
      planId: plan.id, actorUserId: context.actorUserId, action: 'ALLOCATION_ADD', entityType: 'ALLOCATION', entityId: allocation.id,
      summary: 'Colaborador alocado na missão.', afterData: allocation, evidence: context.evidence
    });
    return allocation;
  });
}

export async function removeMissionAllocation(missionId, allocationId, context = {}, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  return runPlanningTransaction(database, async tx => {
    const mission = await requireMissionForAllocation(tx, missionId);
    const plan = await requireEditablePlan(tx, mission.planId, { actorUserId: context.actorUserId });
    const existing = await tx.efetivoMissionAllocation.findFirst({ where: { id: allocationId, missionId, deletedAt: null } });
    if (!existing) throw notFound('Alocação não encontrada.');
    const removed = await tx.efetivoMissionAllocation.update({ where: { id: allocationId }, data: { deletedAt: new Date() } });
    await bumpPlanRevision(tx, plan);
    await recordEfetivoAudit(tx, {
      planId: plan.id, actorUserId: context.actorUserId, action: 'ALLOCATION_REMOVE', entityType: 'ALLOCATION', entityId: allocationId,
      summary: 'Alocação removida da missão.', beforeData: existing, afterData: removed, evidence: context.evidence
    });
    return removed;
  });
}

export async function updateMissionAllocationPeriod(missionId, allocationId, payload, context = {}, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  return runPlanningTransaction(database, async tx => {
    const mission = await requireMissionForAllocation(tx, missionId);
    const plan = await requireEditablePlan(tx, mission.planId, { actorUserId: context.actorUserId });
    const existing = mission.allocations.find(item => item.id === allocationId && !item.deletedAt);
    if (!existing) throw notFound('Alocação não encontrada.');
    const period = requestedAllocationPeriod(mission, payload);
    ensureDemandCapacity(mission, existing.jobRoleId, period, existing.id);
    await lockCollaborator(tx, existing.collaboratorId);
    const data = await loadCollaboratorConflictData(tx, existing.collaboratorId, period, mission.planId);
    if (!data.collaborator) throw notFound('Colaborador não encontrado.');
    const allowMissionOverlap = existing.allowMissionOverlap || Boolean(payload.allowMissionOverlap);
    ensureNoPlanningConflicts(collectAllocationConflicts({
      ...data,
      collaborator: data.collaborator,
      jobRoleId: existing.jobRoleId,
      period,
      ignoredMissionId: mission.id,
      allowMissionOverlap
    }));
    const updated = await tx.efetivoMissionAllocation.update({
      where: { id: allocationId },
      data: {
        ...storedAllocationPeriod(mission, period),
        allowMissionOverlap
      }
    });
    await bumpPlanRevision(tx, plan);
    await recordEfetivoAudit(tx, {
      planId: plan.id,
      actorUserId: context.actorUserId,
      action: 'ALLOCATION_PERIOD_UPDATE',
      entityType: 'ALLOCATION',
      entityId: allocationId,
      summary: 'Período individual do colaborador atualizado.',
      beforeData: existing,
      afterData: updated,
      evidence: context.evidence
    });
    return updated;
  });
}

export { missionInclude };
