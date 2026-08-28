import { recordEfetivoAudit } from './audit.js';
import {
  collectAllocationConflicts,
  ensureNoPlanningConflicts,
  loadCollaboratorConflictData,
  lockCollaborator
} from './conflicts.js';
import { parseDateKey } from './date-only.js';
import { conflictError, notFound } from './errors.js';
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

export async function allocateCollaboratorInTransaction(tx, mission, payload, context = {}, source = 'MANUAL') {
  const demand = mission.demands.find(item => item.jobRoleId === payload.jobRoleId);
  if (!demand) throw conflictError('A função não faz parte da demanda da missão.', [], 'JOB_ROLE_NOT_DEMANDED');
  const existingSame = mission.allocations.find(item => item.collaboratorId === payload.collaboratorId);
  if (existingSame && !existingSame.deletedAt) return existingSame;
  const currentCount = mission.allocations.filter(item => !item.deletedAt && item.jobRoleId === payload.jobRoleId).length;
  if (currentCount >= demand.requiredCount) throw conflictError('A demanda desta função já está completa.', [], 'DEMAND_FULL');

  await lockCollaborator(tx, payload.collaboratorId);
  const period = missionPeriod(mission);
  const data = await loadCollaboratorConflictData(tx, payload.collaboratorId, period, mission.planId);
  if (!data.collaborator) throw notFound('Colaborador não encontrado.');
  ensureNoPlanningConflicts(collectAllocationConflicts({
    ...data,
    collaborator: data.collaborator,
    jobRoleId: payload.jobRoleId,
    period,
    ignoredMissionId: mission.id
  }));
  const allocation = await tx.efetivoMissionAllocation.upsert({
    where: { missionId_collaboratorId: { missionId: mission.id, collaboratorId: payload.collaboratorId } },
    create: {
      missionId: mission.id,
      collaboratorId: payload.collaboratorId,
      jobRoleId: payload.jobRoleId,
      jobRoleNameSnapshot: demand.jobRole.name,
      source,
      createdByUserId: context.actorUserId || null
    },
    update: {
      jobRoleId: payload.jobRoleId,
      jobRoleNameSnapshot: demand.jobRole.name,
      source,
      deletedAt: null,
      createdByUserId: context.actorUserId || null
    }
  });
  mission.allocations.push(allocation);
  return allocation;
}

export async function listEligibleCollaborators(missionId, jobRoleId, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  const mission = await requireMissionForAllocation(database, missionId);
  const period = missionPeriod(mission);
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
  return collaborators.filter(collaborator => collectAllocationConflicts({
    collaborator,
    jobRoleId,
    period,
    absences: absences.filter(item => item.collaboratorId === collaborator.id),
    allocations: overlapping.filter(item => item.collaboratorId === collaborator.id),
    ignoredMissionId: mission.id
  }).length === 0).map(item => ({
    id: item.id,
    name: item.name,
    jobRoleId: item.jobRoleId,
    admissionDate: item.admissionDate
  }));
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

export { missionInclude };
