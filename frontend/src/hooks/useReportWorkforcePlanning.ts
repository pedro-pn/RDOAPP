import { useQuery } from '@tanstack/react-query';

import { checkReportWorkforceAvailability, getReportPlanningContext } from '../api/reports';

export function useReportWorkforcePlanning({
  projectId,
  reportDate,
  collaboratorIds,
  enabled
}: {
  projectId: string | null;
  reportDate: string;
  collaboratorIds: string[];
  enabled: boolean;
}) {
  const planning = useQuery({
    queryKey: ['reports', 'planning-context', projectId, reportDate],
    queryFn: () => getReportPlanningContext(projectId!, reportDate),
    enabled: Boolean(enabled && projectId && reportDate),
    staleTime: 30_000
  });
  const availability = useQuery({
    queryKey: ['workforce', 'report-availability', reportDate, [...collaboratorIds].sort().join(',')],
    queryFn: () => checkReportWorkforceAvailability(collaboratorIds, reportDate),
    enabled: Boolean(enabled && reportDate && collaboratorIds.length),
    staleTime: 15_000
  });
  const workforceConflicts = availability.data?.conflicts || [];
  return {
    planningContext: planning.data || null,
    absenceConflicts: workforceConflicts.filter(conflict => conflict.policy === 'REQUIRE_JUSTIFICATION'),
    serverHoliday: Boolean(availability.data?.holidays?.some(holiday => holiday.date === reportDate))
  };
}
