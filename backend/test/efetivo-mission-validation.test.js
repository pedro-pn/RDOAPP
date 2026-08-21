import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMissionDemands, validateMissionChronology } from '../src/lib/efetivo/planning/mission-planning.js';

test('cronologia aceita limites iguais e rejeita inversão', () => {
  assert.doesNotThrow(() => validateMissionChronology({ mobilizationDate: '2026-01-01', executionStartDate: '2026-01-01', executionEndDate: '2026-01-01', returnDate: '2026-01-01' }));
  assert.throws(() => validateMissionChronology({ mobilizationDate: '2026-01-02', executionStartDate: '2026-01-01', executionEndDate: '2026-01-03', returnDate: '2026-01-04' }), /mobilização/i);
});

test('demanda remove zeros, recusa duplicidade e confirmação vazia', () => {
  assert.deepEqual(normalizeMissionDemands([{ jobRoleId: 'r1', requiredCount: 0 }, { jobRoleId: 'r2', requiredCount: 2 }]), [{ jobRoleId: 'r2', requiredCount: 2 }]);
  assert.throws(() => normalizeMissionDemands([{ jobRoleId: 'r1', requiredCount: 1 }, { jobRoleId: 'r1', requiredCount: 2 }]), /única vez/i);
  assert.throws(() => normalizeMissionDemands([], 'CONFIRMED'), /demanda positiva/i);
});
