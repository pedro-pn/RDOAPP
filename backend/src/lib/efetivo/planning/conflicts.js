import { parseDateKey, periodsOverlap } from './date-only.js';
import { conflictDescriptor, conflictError } from './errors.js';
import { missionEndDate, missionEndsOnOrAfter } from './mission-period.js';

export async function lockCollaborator(tx, collaboratorId) {
  if (typeof tx?.$queryRawUnsafe === 'function') {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Collaborator" WHERE "id" = $1 FOR UPDATE', collaboratorId);
  }
}

export function collaboratorIsEmployedForPeriod(collaborator, period) {
  const admission = collaborator.admissionDate ? parseDateKey(collaborator.admissionDate) : null;
  const termination = collaborator.terminationDate ? parseDateKey(collaborator.terminationDate) : null;
  return collaborator.isActive !== false
    && (!admission || admission <= parseDateKey(period.startDate))
    && (!termination || termination >= parseDateKey(period.endDate));
}

export function collectAllocationConflicts({
  collaborator,
  jobRoleId,
  period,
  absences = [],
  allocations = [],
  ignoredMissionId = null
}) {
  const conflicts = [];
  if (!collaboratorIsEmployedForPeriod(collaborator, period)) {
    conflicts.push(conflictDescriptor({
      collaborator,
      ...period,
      sourceType: 'EMPLOYMENT',
      sourceId: collaborator.id,
      entityPath: `/efetivo?section=colaboradores&colaborador=${collaborator.id}`,
      code: 'OUTSIDE_EMPLOYMENT'
    }));
  }
  if (collaborator.jobRoleId !== jobRoleId) {
    conflicts.push(conflictDescriptor({
      collaborator,
      ...period,
      sourceType: 'JOB_ROLE',
      sourceId: collaborator.jobRoleId,
      entityPath: `/efetivo?section=colaboradores&colaborador=${collaborator.id}`,
      code: 'WRONG_JOB_ROLE'
    }));
  }
  for (const absence of absences) {
    if (absence.deletedAt || !periodsOverlap(period, absence)) continue;
    conflicts.push(conflictDescriptor({
      collaborator,
      startDate: parseDateKey(absence.startDate),
      endDate: parseDateKey(absence.endDate),
      sourceType: 'ABSENCE',
      sourceId: absence.id,
      entityPath: `/efetivo?section=colaboradores&colaborador=${collaborator.id}&ausencia=${absence.id}`,
      code: `ABSENCE_${absence.type}`
    }));
  }
  for (const allocation of allocations) {
    const mission = allocation.mission;
    if (allocation.deletedAt || !mission || mission.deletedAt || mission.id === ignoredMissionId
      || mission.scheduleStatus !== 'CONFIRMED' || !periodsOverlap(period, {
        startDate: mission.mobilizationDate,
        endDate: missionEndDate(mission)
      })) continue;
    conflicts.push(conflictDescriptor({
      collaborator,
      startDate: parseDateKey(mission.mobilizationDate),
      endDate: missionEndDate(mission),
      sourceType: 'MISSION',
      sourceId: mission.id,
      entityPath: `/efetivo?section=missoes&missao=${mission.id}`,
      code: 'MISSION_OVERLAP'
    }));
  }
  return conflicts;
}

export function ensureNoPlanningConflicts(conflicts) {
  if (conflicts.length) throw conflictError('A pessoa possui conflito no período informado.', conflicts);
}

export async function loadCollaboratorConflictData(tx, collaboratorId, period, planId) {
  const collaborator = await tx.collaborator.findUnique({ where: { id: collaboratorId } });
  if (!collaborator) return { collaborator: null, absences: [], allocations: [] };
  const [absences, allocations] = await Promise.all([
    tx.collaboratorAbsence.findMany({
      where: {
        collaboratorId,
        deletedAt: null,
        type: { in: ['FERIAS', 'FOLGA', 'AFASTAMENTO'] },
        startDate: { lte: new Date(`${parseDateKey(period.endDate)}T00:00:00.000Z`) },
        endDate: { gte: new Date(`${parseDateKey(period.startDate)}T00:00:00.000Z`) }
      }
    }),
    tx.efetivoMissionAllocation.findMany({
      where: {
        collaboratorId,
        deletedAt: null,
        mission: {
          planId,
          deletedAt: null,
          scheduleStatus: 'CONFIRMED',
          mobilizationDate: { lte: new Date(`${parseDateKey(period.endDate)}T00:00:00.000Z`) },
          ...missionEndsOnOrAfter(new Date(`${parseDateKey(period.startDate)}T00:00:00.000Z`))
        }
      },
      include: { mission: true }
    })
  ]);
  return { collaborator, absences, allocations };
}
