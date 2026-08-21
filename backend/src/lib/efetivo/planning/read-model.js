import { calculateDailyCapacity, calculateUtilization90Days } from './capacity.js';
import { buildContinuousStayAlerts } from './continuous-stay.js';
import { addCalendarDays, parseDateKey } from './date-only.js';
import { businessDatesInclusive, holidayDateSet } from './business-days.js';
import { getActiveOfficialPlan, resolvePlanningDatabase } from './plan-context.js';
import { buildVacationAlert } from './vacation-alerts.js';

const missionReadInclude = {
  project: { select: { id: true, code: true, name: true, clientName: true, location: true } },
  demands: { include: { jobRole: { select: { id: true, name: true, calendarColor: true } } } },
  allocations: {
    where: { deletedAt: null },
    include: { collaborator: { select: { id: true, name: true, role: true, jobRoleId: true } } }
  }
};

function utcDate(value) {
  return new Date(`${parseDateKey(value)}T00:00:00.000Z`);
}

export async function listPlanningProjects(filters = {}, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  return database.project.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(filters.search ? {
        OR: [
          { code: { contains: filters.search, mode: 'insensitive' } },
          { name: { contains: filters.search, mode: 'insensitive' } },
          { clientName: { contains: filters.search, mode: 'insensitive' } }
        ]
      } : {})
    },
    select: { id: true, code: true, name: true, clientName: true, location: true },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
    take: 100
  });
}

export async function listPlanningJobRoles(dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  return database.jobRole.findMany({
    where: { isActive: true },
    select: { id: true, name: true, isOperational: true, calendarColor: true, continuousWorkLimitDays: true, order: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }]
  });
}

export async function listPlanningCoordinators(dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  return database.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: 'COORDINATOR' },
        { moduleRoles: { some: { role: 'RDO_COORDINATOR' } } }
      ]
    },
    select: {
      id: true,
      name: true,
      collaborator: { select: { id: true, name: true, role: true, isActive: true } }
    },
    orderBy: { name: 'asc' }
  });
}

export async function loadPlanningProjection({ date, planId = null }, dependencies = {}) {
  const database = await resolvePlanningDatabase(dependencies.database);
  const startDate = parseDateKey(date);
  const endDate = addCalendarDays(startDate, 89);
  const plan = planId
    ? await database.efetivoPlan.findUnique({ where: { id: planId } })
    : await getActiveOfficialPlan(database, { create: true });
  const [collaborators, jobRoles, missions, absences, holidays, targetSetting, plannedHires] = await Promise.all([
    database.collaborator.findMany({
      where: {
        OR: [{ isActive: true }, { terminationDate: { gte: utcDate(startDate) } }],
        AND: [{ OR: [{ admissionDate: null }, { admissionDate: { lte: utcDate(endDate) } }] }]
      },
      select: { id: true, name: true, role: true, jobRoleId: true, admissionDate: true, terminationDate: true, isActive: true }
    }),
    database.jobRole.findMany({ where: { isActive: true, isOperational: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    database.efetivoMissionPlan.findMany({
      where: {
        planId: plan.id,
        deletedAt: null,
        mobilizationDate: { lte: utcDate(endDate) },
        returnDate: { gte: utcDate(startDate) }
      },
      include: missionReadInclude
    }),
    database.collaboratorAbsence.findMany({
      where: { deletedAt: null, startDate: { lte: utcDate(endDate) }, endDate: { gte: utcDate(startDate) } }
    }),
    database.efetivoHoliday.findMany({
      where: { deletedAt: null, holidayDate: { gte: utcDate(startDate), lte: utcDate(endDate) } }
    }),
    database.efetivoSetting.findUnique({ where: { key: 'plannedUtilizationTarget' } }),
    database.efetivoPlannedHire.findMany({ where: { planId: plan.id }, include: { jobRole: { select: { id: true, name: true } } } })
  ]);
  return { plan, collaborators, jobRoles, missions, absences, holidays, targetSetting, plannedHires };
}

export async function getPlanningOverview(filters, dependencies = {}) {
  const date = parseDateKey(filters.date);
  const projection = await loadPlanningProjection({ date, planId: filters.planId }, dependencies);
  const daily = calculateDailyCapacity({ date, ...projection });
  const utilization = calculateUtilization90Days({ date, ...projection });
  const utilizationByRole = new Map(utilization.byRole.map(item => [item.jobRoleId, item]));
  const utilizationEnd = addCalendarDays(date, 89);
  const holidaySet = holidayDateSet(projection.holidays);
  const plannedPersonDaysByRole = new Map();
  const plannedPeopleByRole = new Map();
  for (const hire of projection.plannedHires) {
    const availableFrom = parseDateKey(hire.availableFrom);
    if (availableFrom <= date) plannedPeopleByRole.set(hire.jobRoleId, (plannedPeopleByRole.get(hire.jobRoleId) || 0) + hire.quantity);
    const capacityStart = availableFrom > date ? availableFrom : date;
    if (capacityStart <= utilizationEnd) {
      plannedPersonDaysByRole.set(hire.jobRoleId, (plannedPersonDaysByRole.get(hire.jobRoleId) || 0)
        + businessDatesInclusive(capacityStart, utilizationEnd, holidaySet).length * hire.quantity);
    }
  }
  const byRole = daily.byRole.map(item => {
    const roleUtilization = utilizationByRole.get(item.jobRoleId);
    const plannedHires = plannedPeopleByRole.get(item.jobRoleId) || 0;
    const plannedHirePersonDays = plannedPersonDaysByRole.get(item.jobRoleId) || 0;
    const projectedDenominator = (roleUtilization?.availablePersonDays || 0) + plannedHirePersonDays;
    return {
      ...item,
      plannedUtilization90d: roleUtilization?.rate ?? null,
      plannedHires,
      projectedFree: item.free + plannedHires,
      projectedDeficit: Math.max(0, item.demand - item.allocated - plannedHires),
      projectedUtilization90d: projectedDenominator
        ? (roleUtilization?.committedPersonDays || 0) / projectedDenominator * 100 : null
    };
  })
    .filter(item => !filters.jobRoleId || item.jobRoleId === filters.jobRoleId);
  const statusById = new Map(daily.statuses.map(item => [item.collaborator.id, item]));
  const upcomingMobilizations = projection.missions.filter(mission => mission.scheduleStatus === 'CONFIRMED'
    && parseDateKey(mission.mobilizationDate) >= date)
    .sort((left, right) => parseDateKey(left.mobilizationDate).localeCompare(parseDateKey(right.mobilizationDate)))
    .slice(0, 8);
  return {
    date,
    plan: { id: projection.plan.id, revision: projection.plan.revision },
    totals: filters.jobRoleId
      ? byRole.reduce((sum, item) => ({
        ...sum,
        active: sum.active + item.active,
        allocated: sum.allocated + item.allocated,
        unavailable: sum.unavailable + item.unavailable,
        free: sum.free + item.free,
        demand: sum.demand + item.demand,
        deficit: sum.deficit + item.deficit,
        plannedHires: sum.plannedHires + item.plannedHires,
        projectedFree: sum.projectedFree + item.projectedFree,
        projectedDeficit: sum.projectedDeficit + item.projectedDeficit
      }), {
        jobRoleId: 'filtered', jobRoleName: 'Total', active: 0, allocated: 0, unavailable: 0, free: 0,
        demand: 0, deficit: 0, plannedHires: 0, projectedFree: 0, projectedDeficit: 0
      })
      : {
        ...daily.totals,
        plannedHires: byRole.reduce((sum, item) => sum + item.plannedHires, 0),
        projectedFree: byRole.reduce((sum, item) => sum + item.projectedFree, 0),
        projectedDeficit: byRole.reduce((sum, item) => sum + item.projectedDeficit, 0)
      },
    byRole,
    people: projection.collaborators.map(collaborator => ({
      id: collaborator.id,
      name: collaborator.name,
      jobRoleId: collaborator.jobRoleId,
      status: statusById.get(collaborator.id)?.status || 'OUTSIDE_EMPLOYMENT'
    })),
    upcomingMobilizations,
    plannedUtilization90d: utilization.rate,
    projectedUtilization90d: (() => {
      const extra = [...plannedPersonDaysByRole.values()].reduce((sum, value) => sum + value, 0);
      return utilization.availablePersonDays + extra
        ? utilization.committedPersonDays / (utilization.availablePersonDays + extra) * 100 : null;
    })(),
    utilization,
    target: projection.targetSetting?.numberValue ?? 80,
    continuousStayAlerts: buildContinuousStayAlerts({ ...projection, date }),
    plannedHires: projection.plannedHires
  };
}

export async function listPlanningCollaborators(filters, dependencies = {}) {
  const date = parseDateKey(filters.date);
  const projection = await loadPlanningProjection({ date }, dependencies);
  const daily = calculateDailyCapacity({ date, ...projection });
  const utilization = calculateUtilization90Days({ date, ...projection });
  const statusById = new Map(daily.statuses.map(item => [item.collaborator.id, item.status]));
  const absencesByPerson = new Map();
  for (const absence of projection.absences) {
    const values = absencesByPerson.get(absence.collaboratorId) || [];
    values.push(absence);
    absencesByPerson.set(absence.collaboratorId, values);
  }
  const committedByPerson = new Map();
  const availableByPerson = new Map();
  for (const key of projection.collaborators.map(item => item.id)) {
    committedByPerson.set(key, 0);
    availableByPerson.set(key, 0);
  }
  // Use the exact team rate per person through the same public projection to avoid a second query.
  for (const collaborator of projection.collaborators) {
    const personUtilization = calculateUtilization90Days({ ...projection, date, collaborators: [collaborator] });
    committedByPerson.set(collaborator.id, personUtilization.committedPersonDays);
    availableByPerson.set(collaborator.id, personUtilization.availablePersonDays);
  }
  return projection.collaborators.filter(item => {
    if (filters.jobRoleId && item.jobRoleId !== filters.jobRoleId) return false;
    return !filters.search || item.name.toLocaleLowerCase('pt-BR').includes(filters.search.toLocaleLowerCase('pt-BR'));
  }).map(collaborator => ({
    id: collaborator.id,
    name: collaborator.name,
    role: collaborator.role,
    jobRoleId: collaborator.jobRoleId,
    admissionDate: collaborator.admissionDate ? parseDateKey(collaborator.admissionDate) : null,
    terminationDate: collaborator.terminationDate ? parseDateKey(collaborator.terminationDate) : null,
    isActive: collaborator.isActive,
    status: statusById.get(collaborator.id) || 'OUTSIDE_EMPLOYMENT',
    plannedUtilization90d: availableByPerson.get(collaborator.id)
      ? committedByPerson.get(collaborator.id) / availableByPerson.get(collaborator.id) * 100 : null,
    vacationAlert: buildVacationAlert(collaborator, absencesByPerson.get(collaborator.id) || [], date)
  })).sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}
