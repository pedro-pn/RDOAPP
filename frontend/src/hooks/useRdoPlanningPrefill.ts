import { useCallback, useEffect, useRef, useState } from 'react';

import { resolveRdoCollaboratorPrefill } from '../utils/rdoPlanningPrefill';

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every(id => right.includes(id));
}

export function useRdoPlanningPrefill({
  projectId,
  reportDate,
  currentCollaboratorIds,
  missionCollaboratorIds,
  lastReportCollaboratorIds,
  setCollaborators
}: {
  projectId: string | null;
  reportDate: string;
  currentCollaboratorIds: string[];
  missionCollaboratorIds: string[];
  lastReportCollaboratorIds: string[];
  setCollaborators: (ids: string[]) => void;
}) {
  const touched = useRef(false);
  const automaticIds = useRef<string[]>([]);
  const previousProjectId = useRef<string | null>(projectId);
  const [source, setSource] = useState<'MISSION' | 'LAST_REPORT' | null>(null);
  const missionKey = missionCollaboratorIds.join(',');
  const lastReportKey = lastReportCollaboratorIds.join(',');

  useEffect(() => {
    if (previousProjectId.current !== projectId) {
      previousProjectId.current = projectId;
      touched.current = false;
      automaticIds.current = [];
      setSource(null);
    }
    if (!projectId || !reportDate || touched.current) return;
    const result = resolveRdoCollaboratorPrefill({
      currentCollaboratorIds: sameIds(currentCollaboratorIds, automaticIds.current) ? [] : currentCollaboratorIds,
      touched: false,
      missionCollaboratorIds: missionKey ? missionKey.split(',') : [],
      lastReportCollaboratorIds: lastReportKey ? lastReportKey.split(',') : []
    });
    if (!['MISSION', 'LAST_REPORT', 'EMPTY'].includes(result.source)) return;
    if (!sameIds(result.collaboratorIds, currentCollaboratorIds)) setCollaborators(result.collaboratorIds);
    automaticIds.current = result.collaboratorIds;
    setSource(result.source === 'MISSION' ? 'MISSION' : result.source === 'LAST_REPORT' ? 'LAST_REPORT' : null);
  }, [projectId, reportDate, currentCollaboratorIds, missionKey, lastReportKey, setCollaborators]);

  const markTouched = useCallback(() => {
    touched.current = true;
    automaticIds.current = [];
    setSource(null);
  }, []);

  return { source, markTouched };
}
