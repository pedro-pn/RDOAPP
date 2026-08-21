import assert from 'node:assert/strict';
import test from 'node:test';

import { getPlanningCalendar } from '../src/lib/efetivo/planning/calendar.js';

test('calendário combina missão e três tipos de indisponibilidade com caminhos', async () => {
  const database = {
    efetivoPlan: { findFirst: async () => ({ id: 'p1' }) },
    efetivoMissionPlan: { findMany: async () => [{ id: 'm1', mobilizationDate: new Date('2026-08-20Z'), returnDate: new Date('2026-08-22Z'), project: { id: 'pr1', code: 'P-1', name: 'Obra', clientName: 'Cliente', location: 'RJ' }, demands: [{ jobRoleId: 'r1', requiredCount: 2 }], allocations: [{ collaborator: { id: 'c1', name: 'Ana' } }] }] },
    collaboratorAbsence: { findMany: async () => [{ id: 'a1', type: 'FOLGA', startDate: new Date('2026-08-21Z'), endDate: new Date('2026-08-21Z'), collaborator: { id: 'c2', name: 'Bia', role: 'Operador', jobRoleId: 'r1' } }] }
  };
  const result = await getPlanningCalendar({ startDate: '2026-08-01', endDate: '2026-08-31', jobRoleId: 'r1' }, { database });
  assert.deepEqual(result.events.map(item => item.type), ['MISSION', 'FOLGA']);
  assert.ok(result.events.every(item => item.entityPath.startsWith('/efetivo?')));
});
