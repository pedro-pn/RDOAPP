import type { MissionAllocation, PlanningMission } from '../api/efetivoPlanning';

export function dateKey(value: string) {
  return value.slice(0, 10);
}

export function missionAllocationPeriod(allocation: MissionAllocation, mission: PlanningMission) {
  return {
    startDate: dateKey(allocation.mobilizationDate || mission.mobilizationDate),
    endDate: dateKey(allocation.demobilizationDate || mission.returnDate || mission.executionEndDate)
  };
}

export function allocationIncludesDate(allocation: MissionAllocation, mission: PlanningMission, date: string) {
  const period = missionAllocationPeriod(allocation, mission);
  return period.startDate <= date && period.endDate >= date;
}

export function allocationOverlapsPeriod(
  allocation: MissionAllocation,
  mission: PlanningMission,
  startDate: string,
  endDate: string
) {
  const period = missionAllocationPeriod(allocation, mission);
  return period.startDate <= endDate && period.endDate >= startDate;
}

export function missionAllocationsOn(mission: PlanningMission, date: string) {
  return mission.allocations.filter(allocation => allocationIncludesDate(allocation, mission, date));
}

export function missionFinalAllocations(mission: PlanningMission) {
  const finalDate = mission.returnDate || mission.executionEndDate;
  return finalDate ? missionAllocationsOn(mission, dateKey(finalDate)) : mission.allocations;
}
