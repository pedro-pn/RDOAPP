import { collectAllocationConflicts, lockCollaborator } from './conflicts.js';
import { parseDateKey } from './date-only.js';
import { conflictError, notFound, planningError } from './errors.js';

function dateValue(value) {
  return new Date(`${parseDateKey(value)}T00:00:00.000Z`);
}

export function deriveSelectedMissionTeam(collaborators = [], scheduleStatus = 'DRAFT') {
  if (scheduleStatus === 'CONFIRMED' && collaborators.length === 0) {
    throw planningError('Selecione ao menos um colaborador para confirmar a missão.', {
      code: 'MISSION_WITHOUT_COLLABORATORS'
    });
  }

  const counts = new Map();
  const allocations = collaborators.map(collaborator => {
    if (!collaborator.jobRoleId || !collaborator.jobRole?.isActive || !collaborator.jobRole?.isOperational) {
      throw planningError(`${collaborator.name || 'Colaborador'} não possui uma função operacional canônica ativa.`, {
        code: 'INVALID_COLLABORATOR_JOB_ROLE'
      });
    }
    counts.set(collaborator.jobRoleId, (counts.get(collaborator.jobRoleId) || 0) + 1);
    return {
      collaboratorId: collaborator.id,
      jobRoleId: collaborator.jobRoleId,
      jobRoleNameSnapshot: collaborator.jobRole.name
    };
  });

  return {
    demands: [...counts].map(([jobRoleId, requiredCount]) => ({ jobRoleId, requiredCount })),
    allocations
  };
}

export async function resolveSelectedMissionTeam(tx, payload, planId, ignoredMissionId = null) {
  const collaboratorIds = payload.collaboratorIds || [];
  const uniqueIds = [...new Set(collaboratorIds)];
  if (uniqueIds.length !== collaboratorIds.length) {
    throw planningError('Cada colaborador deve aparecer uma única vez na equipe.', {
      code: 'DUPLICATE_MISSION_COLLABORATOR'
    });
  }
  if (!uniqueIds.length) return deriveSelectedMissionTeam([], payload.scheduleStatus);

  const lockedIds = [...uniqueIds].sort();
  for (const collaboratorId of lockedIds) await lockCollaborator(tx, collaboratorId);

  const period = { startDate: parseDateKey(payload.mobilizationDate), endDate: parseDateKey(payload.returnDate) };
  const [collaborators, absences, allocations] = await Promise.all([
    tx.collaborator.findMany({
      where: { id: { in: uniqueIds } },
      include: { jobRole: { select: { id: true, name: true, isActive: true, isOperational: true } } }
    }),
    tx.collaboratorAbsence.findMany({
      where: {
        collaboratorId: { in: uniqueIds },
        deletedAt: null,
        type: { in: ['FERIAS', 'FOLGA', 'AFASTAMENTO'] },
        startDate: { lte: dateValue(period.endDate) },
        endDate: { gte: dateValue(period.startDate) }
      }
    }),
    tx.efetivoMissionAllocation.findMany({
      where: {
        collaboratorId: { in: uniqueIds },
        deletedAt: null,
        mission: {
          planId,
          deletedAt: null,
          scheduleStatus: 'CONFIRMED',
          mobilizationDate: { lte: dateValue(period.endDate) },
          returnDate: { gte: dateValue(period.startDate) }
        }
      },
      include: { mission: true }
    })
  ]);
  const byId = new Map(collaborators.map(collaborator => [collaborator.id, collaborator]));
  const missing = uniqueIds.find(collaboratorId => !byId.has(collaboratorId));
  if (missing) throw notFound('Um colaborador selecionado não foi encontrado. Atualize a lista e tente novamente.');

  const ordered = uniqueIds.map(collaboratorId => byId.get(collaboratorId));
  const team = deriveSelectedMissionTeam(ordered, payload.scheduleStatus);
  const conflicts = ordered.flatMap(collaborator => collectAllocationConflicts({
    collaborator,
    jobRoleId: collaborator.jobRoleId,
    period,
    absences: absences.filter(absence => absence.collaboratorId === collaborator.id),
    allocations: allocations.filter(allocation => allocation.collaboratorId === collaborator.id),
    ignoredMissionId
  }));
  if (conflicts.length) {
    const names = [...new Set(conflicts.map(conflict => conflict.collaboratorName))];
    const label = names.length > 2 ? `${names.slice(0, 2).join(', ')} e mais ${names.length - 2}` : names.join(' e ');
    throw conflictError(`Não foi possível salvar a equipe: ${label} possui conflito no período informado.`, conflicts);
  }
  return team;
}

export async function syncSelectedMissionTeam(tx, missionId, team, context = {}) {
  const selectedIds = team.allocations.map(item => item.collaboratorId);
  await tx.efetivoMissionAllocation.updateMany({
    where: {
      missionId,
      deletedAt: null,
      ...(selectedIds.length ? { collaboratorId: { notIn: selectedIds } } : {})
    },
    data: { deletedAt: new Date() }
  });

  const stored = [];
  for (const allocation of team.allocations) {
    stored.push(await tx.efetivoMissionAllocation.upsert({
      where: { missionId_collaboratorId: { missionId, collaboratorId: allocation.collaboratorId } },
      create: {
        missionId,
        ...allocation,
        source: 'MANUAL',
        createdByUserId: context.actorUserId || null
      },
      update: {
        jobRoleId: allocation.jobRoleId,
        jobRoleNameSnapshot: allocation.jobRoleNameSnapshot,
        source: 'MANUAL',
        deletedAt: null
      }
    }));
  }
  return stored;
}
