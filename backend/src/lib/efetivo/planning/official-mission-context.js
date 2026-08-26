import { corporateDateKey } from '../../calendar/corporate-calendar.js';
import { resolvePlanningDatabase } from './plan-context.js';

function utcDate(value) {
  return new Date(`${corporateDateKey(value)}T00:00:00.000Z`);
}

function missionContextDto(mission, calendarRevision = 1) {
  if (!mission) return null;
  return {
    missionId: mission.id,
    missionVersion: mission.version,
    planRevision: mission.plan.revision,
    calendarRevision,
    projectId: mission.projectId,
    needsReplanning: mission.needsReplanning,
    replanningReason: mission.replanningReason,
    responsible: {
      userId: mission.headquartersResponsibleUserId,
      name: mission.headquartersResponsibleName,
      role: mission.headquartersResponsibleRole
    },
    dates: {
      mobilizationDate: corporateDateKey(mission.mobilizationDate),
      executionStartDate: corporateDateKey(mission.executionStartDate),
      executionEndDate: corporateDateKey(mission.executionEndDate),
      returnDate: corporateDateKey(mission.returnDate)
    },
    collaborators: mission.allocations.map(allocation => ({
      id: allocation.collaborator.id,
      name: allocation.collaborator.name,
      jobRole: {
        id: allocation.jobRoleId,
        name: allocation.jobRoleNameSnapshot,
        isActive: allocation.jobRole.isActive
      }
    })),
    demands: mission.demands.map(demand => ({
      jobRoleId: demand.jobRoleId,
      jobRoleName: demand.jobRole.name,
      requiredCount: demand.requiredCount
    }))
  };
}

export async function getOfficialMissionContext({ projectId, date }, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  const position = utcDate(date);
  const [mission, calendarState] = await Promise.all([
    database.efetivoMissionPlan.findFirst({
      where: {
        projectId,
        deletedAt: null,
        scheduleStatus: 'CONFIRMED',
        mobilizationDate: { lte: position },
        returnDate: { gte: position },
        plan: { kind: 'OFFICIAL', status: 'ACTIVE' }
      },
      include: {
        plan: { select: { id: true, revision: true } },
        allocations: {
          where: { deletedAt: null },
          include: {
            collaborator: { select: { id: true, name: true } },
            jobRole: { select: { id: true, name: true, isActive: true } }
          }
        },
        demands: { include: { jobRole: { select: { id: true, name: true } } } }
      }
    }),
    database.workforceCalendarState.findUnique({ where: { id: 'global' } })
  ]);
  return missionContextDto(mission, calendarState?.revision || 1);
}

export { missionContextDto };
