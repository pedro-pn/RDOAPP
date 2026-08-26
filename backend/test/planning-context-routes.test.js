import assert from 'node:assert/strict';
import test from 'node:test';

import { officialMissionContextQuerySchema } from '../src/lib/workforce/schemas.js';

test('contrato de contexto exige projeto e data civil estrita', () => {
  assert.equal(officialMissionContextQuerySchema.safeParse({ projectId: 'p1', date: '2026-08-01' }).success, true);
  assert.equal(officialMissionContextQuerySchema.safeParse({ projectId: 'p1', date: '01/08/2026' }).success, false);
});

test('contexto sanitizado não contém cenário, capacidade nem auditoria', () => {
  const publicKeys = ['missionId', 'missionVersion', 'planRevision', 'calendarRevision', 'projectId', 'dates', 'collaborators'];
  assert.equal(publicKeys.includes('auditEvents'), false);
  assert.equal(publicKeys.includes('plannedUtilization90d'), false);
  assert.equal(publicKeys.includes('scenarioId'), false);
});
