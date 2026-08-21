import { parseDateKey } from './date-only.js';
import { resolvePlanningDatabase, getActiveOfficialPlan } from './plan-context.js';

function utcDate(value) {
  return new Date(`${parseDateKey(value)}T00:00:00.000Z`);
}

export async function getPlanningCalendar(filters, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  const startDate = parseDateKey(filters.startDate);
  const endDate = parseDateKey(filters.endDate);
  const plan = await getActiveOfficialPlan(database, { create: true });
  const [missions, absences] = await Promise.all([
    database.efetivoMissionPlan.findMany({
      where: {
        planId: plan.id,
        deletedAt: null,
        scheduleStatus: 'CONFIRMED',
        mobilizationDate: { lte: utcDate(endDate) },
        returnDate: { gte: utcDate(startDate) },
        ...(filters.jobRoleId ? { demands: { some: { jobRoleId: filters.jobRoleId } } } : {})
      },
      include: {
        project: { select: { id: true, code: true, name: true, clientName: true, location: true } },
        demands: true,
        allocations: { where: { deletedAt: null }, include: { collaborator: { select: { id: true, name: true } } } }
      }
    }),
    database.collaboratorAbsence.findMany({
      where: {
        deletedAt: null,
        type: { in: ['FERIAS', 'FOLGA', 'AFASTAMENTO'] },
        startDate: { lte: utcDate(endDate) },
        endDate: { gte: utcDate(startDate) },
        ...(filters.jobRoleId ? { collaborator: { jobRoleId: filters.jobRoleId } } : {})
      },
      include: { collaborator: { select: { id: true, name: true, role: true, jobRoleId: true } } }
    })
  ]);
  const missionEvents = missions.map(mission => ({
    id: mission.id,
    type: 'MISSION',
    title: `${mission.project.code} · ${mission.project.name}`,
    startDate: parseDateKey(mission.mobilizationDate),
    endDate: parseDateKey(mission.returnDate),
    jobRoleIds: mission.demands.map(item => item.jobRoleId),
    entityPath: `/efetivo?section=missoes&missao=${mission.id}`,
    project: mission.project,
    demand: mission.demands.reduce((sum, item) => sum + item.requiredCount, 0),
    allocated: mission.allocations.length,
    people: mission.allocations.map(item => item.collaborator)
  }));
  const absenceEvents = absences.map(absence => ({
    id: absence.id,
    type: absence.type,
    title: `${absence.type === 'FERIAS' ? 'Férias' : absence.type === 'FOLGA' ? 'Folga' : 'Afastamento'} · ${absence.collaborator.name}`,
    startDate: parseDateKey(absence.startDate),
    endDate: parseDateKey(absence.endDate),
    jobRoleIds: [absence.collaborator.jobRoleId].filter(Boolean),
    entityPath: `/efetivo?section=colaboradores&colaborador=${absence.collaborator.id}&ausencia=${absence.id}`,
    collaborator: absence.collaborator
  }));
  return { events: [...missionEvents, ...absenceEvents].sort((left, right) => left.startDate.localeCompare(right.startDate)), conflicts: [] };
}
