import { addCalendarDays, parseDateKey } from './date-only.js';
import { missionPeriod } from './mission-period.js';

export function allocationPeriod(allocation, mission = allocation?.mission) {
  const fallback = missionPeriod(mission);
  return {
    startDate: allocation?.mobilizationDate
      ? parseDateKey(allocation.mobilizationDate)
      : fallback.startDate,
    endDate: allocation?.demobilizationDate
      ? parseDateKey(allocation.demobilizationDate)
      : fallback.endDate
  };
}

export function allocationPeriodWithinMission(period, mission) {
  const bounds = missionPeriod(mission);
  return period.startDate >= bounds.startDate
    && period.endDate <= bounds.endDate
    && period.startDate <= period.endDate;
}

export function allocationCoversDate(allocation, mission, value) {
  const date = parseDateKey(value);
  const period = allocationPeriod(allocation, mission);
  return period.startDate <= date && period.endDate >= date;
}

export function maximumConcurrentAllocationCount(periods = []) {
  const events = new Map();
  for (const period of periods) {
    const startDate = parseDateKey(period.startDate);
    const endDate = parseDateKey(period.endDate);
    if (endDate < startDate) continue;
    events.set(startDate, (events.get(startDate) || 0) + 1);
    const afterEnd = addCalendarDays(endDate, 1);
    events.set(afterEnd, (events.get(afterEnd) || 0) - 1);
  }
  let current = 0;
  let maximum = 0;
  for (const date of [...events.keys()].sort()) {
    current += events.get(date) || 0;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}
