import type { MissionStage, PlanningMission } from '../api/efetivoPlanning';

export type MissionColumns = Record<MissionStage, PlanningMission[]>;

export const MISSION_STAGES: MissionStage[] = ['STANDBY', 'MOBILIZATION', 'EXECUTION', 'FINAL_MEASUREMENT', 'FINISHED'];
export const MISSION_STAGE_LABELS: Record<MissionStage, string> = {
  STANDBY: 'Stand by',
  MOBILIZATION: 'Mobilização',
  EXECUTION: 'Execução',
  FINAL_MEASUREMENT: 'Medição final',
  FINISHED: 'Finalizadas'
};

export function missionsToColumns(missions: PlanningMission[]): MissionColumns {
  return Object.fromEntries(MISSION_STAGES.map(stage => [stage, missions.filter(item => item.stage === stage).sort((a, b) => a.kanbanOrder - b.kanbanOrder)])) as MissionColumns;
}

export function moveMissionInColumns(columns: MissionColumns, missionId: string, stage: MissionStage, index: number): MissionColumns {
  const next = Object.fromEntries(MISSION_STAGES.map(key => [key, columns[key].filter(item => item.id !== missionId)])) as MissionColumns;
  const mission = MISSION_STAGES.flatMap(key => columns[key]).find(item => item.id === missionId);
  if (!mission) return columns;
  const target = [...next[stage]];
  target.splice(Math.min(Math.max(0, index), target.length), 0, { ...mission, stage });
  next[stage] = target.map((item, kanbanOrder) => ({ ...item, stage, kanbanOrder }));
  return next;
}

export function cloneMissionColumns(columns: MissionColumns): MissionColumns {
  return Object.fromEntries(MISSION_STAGES.map(stage => [stage, columns[stage].map(item => ({ ...item }))])) as MissionColumns;
}
