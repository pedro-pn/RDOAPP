import assert from 'node:assert/strict';
import test from 'node:test';

import { missionStageSchema, stageInputSchema } from '../src/lib/efetivo/planning/schemas.js';

test('kanban aceita exatamente cinco etapas e ordem não negativa', () => {
  for (const stage of ['STANDBY', 'MOBILIZATION', 'EXECUTION', 'FINAL_MEASUREMENT', 'FINISHED']) assert.equal(missionStageSchema.parse(stage), stage);
  assert.equal(stageInputSchema.safeParse({ stage: 'EXECUTION', order: -1 }).success, false);
});
