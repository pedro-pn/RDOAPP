import assert from 'node:assert/strict';
import test from 'node:test';

import { rdoWorkforceJustificationSchema, resolveRdoCollaboratorPrefill } from '../src/utils/rdoPlanningPrefill.ts';

test('seleção tocada prevalece sobre missão e último RDO', () => {
  assert.deepEqual(resolveRdoCollaboratorPrefill({
    currentCollaboratorIds: [], touched: true,
    missionCollaboratorIds: ['m1'], lastReportCollaboratorIds: ['r1']
  }), { collaboratorIds: [], source: 'TOUCHED' });
});

test('missão oficial prevalece sobre último RDO quando a equipe ainda não foi tocada', () => {
  assert.deepEqual(resolveRdoCollaboratorPrefill({
    currentCollaboratorIds: [], touched: false,
    missionCollaboratorIds: ['m1', 'm2'], lastReportCollaboratorIds: ['r1']
  }), { collaboratorIds: ['m1', 'm2'], source: 'MISSION' });
});

test('último RDO é fallback quando não existe missão oficial', () => {
  assert.deepEqual(resolveRdoCollaboratorPrefill({
    currentCollaboratorIds: [], touched: false, lastReportCollaboratorIds: ['r1']
  }), { collaboratorIds: ['r1'], source: 'LAST_REPORT' });
});

test('justificativa é obrigatória somente quando o preflight detecta afastamento', () => {
  assert.equal(rdoWorkforceJustificationSchema.safeParse({
    requiresJustification: true,
    workforceJustification: ''
  }).success, false);
  assert.equal(rdoWorkforceJustificationSchema.safeParse({
    requiresJustification: false,
    workforceJustification: ''
  }).success, true);
});
