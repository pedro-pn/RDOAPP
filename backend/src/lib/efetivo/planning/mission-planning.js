import { recordEfetivoAudit } from './audit.js';
import { collectAllocationConflicts, ensureNoPlanningConflicts, loadCollaboratorConflictData, lockCollaborator } from './conflicts.js';
import { parseDateKey } from './date-only.js';
import { conflictError, notFound, planningError } from './errors.js';
import { resolveSelectedMissionTeam, syncSelectedMissionTeam } from './mission-team.js';
import {
  bumpPlanRevision,
  requireEditablePlan,
  resolvePlanningDatabase,
  runPlanningTransaction
} from './plan-context.js';

export const missionInclude = {
  project: { select: { id: true, code: true, name: true, clientName: true, location: true } },
  demands: { include: { jobRole: { select: { id: true, name: true, calendarColor: true } } }, orderBy: { jobRole: { order: 'asc' } } },
  allocations: {
    where: { deletedAt: null },
    include: {
      collaborator: { select: { id: true, name: true, role: true, jobRoleId: true } },
      jobRole: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'asc' }
  }
};

function dateValue(value) {
  return new Date(`${parseDateKey(value)}T00:00:00.000Z`);
}

export function validateMissionChronology(payload) {
  const values = [
    parseDateKey(payload.mobilizationDate),
    parseDateKey(payload.executionStartDate),
    parseDateKey(payload.executionEndDate),
    parseDateKey(payload.returnDate)
  ];
  if (values.some((value, index) => index > 0 && value < values[index - 1])) {
    throw planningError('Use a ordem mobilização ≤ início da execução ≤ fim da execução ≤ retorno.', {
      code: 'INVALID_MISSION_CHRONOLOGY'
    });
  }
  return values;
}

export function normalizeMissionDemands(demands = [], scheduleStatus = 'DRAFT') {
  const result = new Map();
  for (const demand of demands) {
    const count = Number(demand.requiredCount);
    if (!Number.isInteger(count) || count < 0) throw planningError('A demanda deve ser um inteiro não negativo.');
    if (result.has(demand.jobRoleId)) throw planningError('Cada função deve aparecer uma única vez na demanda.');
    if (count > 0) result.set(demand.jobRoleId, count);
  }
  if (scheduleStatus === 'CONFIRMED' && result.size === 0) {
    throw planningError('Uma missão confirmada precisa ter ao menos uma demanda positiva.', { code: 'MISSION_WITHOUT_DEMAND' });
  }
  return [...result].map(([jobRoleId, requiredCount]) => ({ jobRoleId, requiredCount }));
}

function missionData(payload, actorUserId, demands, responsible) {
  return {
    projectId: payload.projectId,
    scheduleStatus: payload.scheduleStatus,
    stage: payload.stage,
    headquartersResponsibleName: responsible.name,
    headquartersResponsibleRole: responsible.role,
    headquartersResponsibleCollaboratorId: responsible.collaboratorId,
    mobilizationDate: dateValue(payload.mobilizationDate),
    executionStartDate: dateValue(payload.executionStartDate),
    executionEndDate: dateValue(payload.executionEndDate),
    returnDate: dateValue(payload.returnDate),
    updatedByUserId: actorUserId || null,
    demands: { create: demands }
  };
}

export async function resolveMissionResponsible(tx, payload) {
  if (!payload.headquartersResponsibleUserId) {
    return {
      name: payload.headquartersResponsibleName.trim(),
      role: payload.headquartersResponsibleRole.trim(),
      collaboratorId: payload.headquartersResponsibleCollaboratorId || null
    };
  }
  const coordinator = await tx.user.findFirst({
    where: {
      id: payload.headquartersResponsibleUserId,
      isActive: true,
      OR: [
        { role: 'COORDINATOR' },
        { moduleRoles: { some: { role: 'RDO_COORDINATOR' } } }
      ]
    },
    select: {
      id: true,
      name: true,
      collaborator: { select: { id: true, role: true } }
    }
  });
  if (!coordinator) {
    throw planningError('Selecione uma conta ativa de coordenador para o responsável da sede.', {
      code: 'INVALID_MISSION_COORDINATOR'
    });
  }
  const linkedCollaborator = coordinator.collaborator
    || (payload.headquartersResponsibleCollaboratorId
      ? await tx.collaborator.findUnique({
        where: { id: payload.headquartersResponsibleCollaboratorId },
        select: { id: true, role: true }
      })
      : null);
  if (payload.headquartersResponsibleCollaboratorId && !linkedCollaborator) {
    throw notFound('Líder vinculado ao responsável não encontrado.');
  }
  return {
    name: coordinator.name,
    role: linkedCollaborator?.role || payload.headquartersResponsibleRole.trim(),
    collaboratorId: linkedCollaborator?.id || null
  };
}

async function validateDemandRoles(tx, demands) {
  const ids = demands.map(item => item.jobRoleId);
  if (!ids.length) return;
  const roles = await tx.jobRole.findMany({ where: { id: { in: ids }, isActive: true, isOperational: true }, select: { id: true } });
  if (roles.length !== new Set(ids).size) throw planningError('A demanda contém função inexistente, inativa ou não operacional.', { code: 'INVALID_JOB_ROLE' });
}

async function validateExistingAllocations(tx, mission, payload, demands) {
  const counts = new Map();
  for (const allocation of mission.allocations || []) {
    counts.set(allocation.jobRoleId, (counts.get(allocation.jobRoleId) || 0) + 1);
  }
  for (const demand of demands) {
    if ((counts.get(demand.jobRoleId) || 0) > demand.requiredCount) {
      throw conflictError('A nova demanda é menor que a equipe já alocada.', [], 'DEMAND_BELOW_ALLOCATION');
    }
  }
  if ([...counts].some(([jobRoleId]) => !demands.some(item => item.jobRoleId === jobRoleId))) {
    throw conflictError('Remova ou realoque pessoas antes de retirar a função da demanda.', [], 'ALLOCATED_ROLE_REMOVED');
  }
  if (payload.scheduleStatus !== 'CONFIRMED') return;
  const period = { startDate: payload.mobilizationDate, endDate: payload.returnDate };
  for (const allocation of mission.allocations || []) {
    await lockCollaborator(tx, allocation.collaboratorId);
    const data = await loadCollaboratorConflictData(tx, allocation.collaboratorId, period, mission.planId);
    if (!data.collaborator) throw notFound('Colaborador alocado não encontrado.');
    ensureNoPlanningConflicts(collectAllocationConflicts({
      ...data,
      collaborator: data.collaborator,
      jobRoleId: allocation.jobRoleId,
      period,
      ignoredMissionId: mission.id
    }));
  }
}

export async function listMissions(filters = {}, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  const plan = filters.planId
    ? await database.efetivoPlan.findUnique({ where: { id: filters.planId } })
    : await database.efetivoPlan.findFirst({ where: { kind: 'OFFICIAL', status: 'ACTIVE' } });
  if (!plan) return [];
  return database.efetivoMissionPlan.findMany({
    where: {
      planId: plan.id,
      deletedAt: null,
      ...(filters.status ? { scheduleStatus: filters.status } : {}),
      ...(filters.stage ? { stage: filters.stage } : {})
    },
    include: missionInclude,
    orderBy: [{ stage: 'asc' }, { kanbanOrder: 'asc' }, { mobilizationDate: 'asc' }]
  });
}

export async function getMission(missionId, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  const mission = await database.efetivoMissionPlan.findUnique({ where: { id: missionId }, include: missionInclude });
  if (!mission || mission.deletedAt) throw notFound('Missão operacional não encontrada.');
  return mission;
}

export async function createMission(payload, context = {}, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  validateMissionChronology(payload);
  return runPlanningTransaction(database, async tx => {
    const plan = await requireEditablePlan(tx, payload.planId, { actorUserId: context.actorUserId });
    const project = await tx.project.findFirst({ where: { id: payload.projectId, isActive: true, deletedAt: null } });
    if (!project) throw notFound('Projeto não encontrado ou inativo.');
    const responsible = await resolveMissionResponsible(tx, payload);
    const team = Array.isArray(payload.collaboratorIds)
      ? await resolveSelectedMissionTeam(tx, payload, plan.id)
      : null;
    const demands = team?.demands || normalizeMissionDemands(payload.demands, payload.scheduleStatus);
    await validateDemandRoles(tx, demands);
    const maxOrder = await tx.efetivoMissionPlan.aggregate({ where: { planId: plan.id, stage: payload.stage, deletedAt: null }, _max: { kanbanOrder: true } });
    const existing = await tx.efetivoMissionPlan.findUnique({
      where: { planId_projectId: { planId: plan.id, projectId: payload.projectId } }
    });
    if (existing && !existing.deletedAt) {
      throw conflictError('Este projeto já possui programação neste plano.', [], 'MISSION_PROJECT_ALREADY_PLANNED');
    }
    const kanbanOrder = (maxOrder._max.kanbanOrder ?? -1) + 1;
    let mission;
    if (existing) {
      const removedAt = new Date();
      await Promise.all([
        tx.efetivoMissionDemand.deleteMany({ where: { missionId: existing.id } }),
        tx.efetivoMissionAllocation.updateMany({
          where: { missionId: existing.id, deletedAt: null },
          data: { deletedAt: removedAt }
        })
      ]);
      mission = await tx.efetivoMissionPlan.update({
        where: { id: existing.id },
        data: {
          ...missionData(payload, context.actorUserId, demands, responsible),
          deletedAt: null,
          version: { increment: 1 },
          kanbanOrder
        },
        include: missionInclude
      });
    } else {
      mission = await tx.efetivoMissionPlan.create({
        data: {
          ...missionData(payload, context.actorUserId, demands, responsible),
          planId: plan.id,
          createdByUserId: context.actorUserId || null,
          kanbanOrder
        },
        include: missionInclude
      });
    }
    if (team) {
      await syncSelectedMissionTeam(tx, mission.id, team, context);
      mission = await tx.efetivoMissionPlan.findUnique({ where: { id: mission.id }, include: missionInclude });
    }
    await bumpPlanRevision(tx, plan);
    await recordEfetivoAudit(tx, {
      planId: plan.id,
      actorUserId: context.actorUserId,
      action: existing ? 'MISSION_RESTORE' : 'MISSION_CREATE',
      entityType: 'MISSION',
      entityId: mission.id,
      summary: existing
        ? `Programação restaurada para ${project.name}.`
        : `Programação criada para ${project.name}.`,
      beforeData: existing,
      afterData: mission,
      evidence: context.evidence
    });
    return mission;
  });
}

export async function updateMission(missionId, payload, context = {}, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  validateMissionChronology(payload);
  return runPlanningTransaction(database, async tx => {
    const existing = await tx.efetivoMissionPlan.findUnique({ where: { id: missionId }, include: { ...missionInclude, plan: true } });
    if (!existing || existing.deletedAt) throw notFound('Missão operacional não encontrada.');
    const plan = await requireEditablePlan(tx, existing.planId, { actorUserId: context.actorUserId });
    if (context.version && existing.version !== context.version) throw conflictError('A missão foi alterada por outra pessoa.', [], 'MISSION_VERSION_CONFLICT');
    if (payload.projectId !== existing.projectId) throw conflictError('O projeto da programação não pode ser substituído.', [], 'MISSION_PROJECT_IMMUTABLE');
    const responsible = await resolveMissionResponsible(tx, payload);
    const team = Array.isArray(payload.collaboratorIds)
      ? await resolveSelectedMissionTeam(tx, payload, existing.planId, existing.id)
      : null;
    const demands = team?.demands || normalizeMissionDemands(payload.demands, payload.scheduleStatus);
    await validateDemandRoles(tx, demands);
    if (!team) await validateExistingAllocations(tx, existing, payload, demands);
    await tx.efetivoMissionDemand.deleteMany({ where: { missionId } });
    let updated = await tx.efetivoMissionPlan.update({
      where: { id: missionId },
      data: {
        ...missionData(payload, context.actorUserId, demands, responsible),
        version: { increment: 1 }
      },
      include: missionInclude
    });
    if (team) {
      await syncSelectedMissionTeam(tx, missionId, team, context);
      updated = await tx.efetivoMissionPlan.findUnique({ where: { id: missionId }, include: missionInclude });
    }
    await bumpPlanRevision(tx, plan);
    await recordEfetivoAudit(tx, {
      planId: plan.id,
      actorUserId: context.actorUserId,
      action: 'MISSION_UPDATE', entityType: 'MISSION', entityId: missionId,
      summary: `Programação de ${updated.project.name} atualizada.`,
      beforeData: existing, afterData: updated, evidence: context.evidence
    });
    return updated;
  });
}

export async function deleteMission(missionId, context = {}, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  return runPlanningTransaction(database, async tx => {
    const existing = await tx.efetivoMissionPlan.findUnique({ where: { id: missionId }, include: { plan: true, project: true } });
    if (!existing || existing.deletedAt) throw notFound('Missão operacional não encontrada.');
    const plan = await requireEditablePlan(tx, existing.planId, { actorUserId: context.actorUserId });
    const deleted = await tx.efetivoMissionPlan.update({ where: { id: missionId }, data: { deletedAt: new Date(), version: { increment: 1 }, updatedByUserId: context.actorUserId || null } });
    await bumpPlanRevision(tx, plan);
    await recordEfetivoAudit(tx, {
      planId: plan.id, actorUserId: context.actorUserId, action: 'MISSION_DELETE', entityType: 'MISSION', entityId: missionId,
      summary: `Programação de ${existing.project.name} removida.`, beforeData: existing, afterData: deleted, evidence: context.evidence
    });
    return deleted;
  });
}

export async function moveMissionStage(missionId, payload, context = {}, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  return runPlanningTransaction(database, async tx => {
    const existing = await tx.efetivoMissionPlan.findUnique({ where: { id: missionId }, include: { plan: true, project: true } });
    if (!existing || existing.deletedAt) throw notFound('Missão operacional não encontrada.');
    const plan = await requireEditablePlan(tx, existing.planId, { actorUserId: context.actorUserId });
    if (context.version && existing.version !== context.version) throw conflictError('A posição da missão ficou desatualizada.', [], 'MISSION_VERSION_CONFLICT');
    const target = await tx.efetivoMissionPlan.findMany({
      where: { planId: plan.id, stage: payload.stage, deletedAt: null, id: { not: missionId } },
      orderBy: { kanbanOrder: 'asc' }, select: { id: true }
    });
    const index = Math.min(payload.order, target.length);
    target.splice(index, 0, { id: missionId });
    const source = existing.stage === payload.stage ? [] : await tx.efetivoMissionPlan.findMany({
      where: { planId: plan.id, stage: existing.stage, deletedAt: null, id: { not: missionId } },
      orderBy: { kanbanOrder: 'asc' }, select: { id: true }
    });
    await Promise.all([
      ...source.map((item, order) => tx.efetivoMissionPlan.update({ where: { id: item.id }, data: { kanbanOrder: order } })),
      ...target.map((item, order) => tx.efetivoMissionPlan.update({ where: { id: item.id }, data: { stage: payload.stage, kanbanOrder: order } }))
    ]);
    const moved = await tx.efetivoMissionPlan.update({ where: { id: missionId }, data: { version: { increment: 1 }, updatedByUserId: context.actorUserId || null }, include: missionInclude });
    await bumpPlanRevision(tx, plan);
    await recordEfetivoAudit(tx, {
      planId: plan.id, actorUserId: context.actorUserId, action: 'MISSION_STAGE_CHANGE', entityType: 'MISSION', entityId: missionId,
      summary: `${existing.project.name} movida para ${payload.stage}.`, beforeData: { stage: existing.stage, order: existing.kanbanOrder }, afterData: { stage: payload.stage, order: index }, evidence: context.evidence
    });
    return moved;
  });
}
