import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateDailyCapacity } from '../src/lib/efetivo/planning/capacity.js';
import { businessDatesInclusive, holidayDateSet, isBusinessDay } from '../src/lib/efetivo/planning/business-days.js';

test('dia útil exclui fim de semana e feriado administrável', () => {
  const holidays = holidayDateSet([{ holidayDate: '2026-08-21', deletedAt: null }]);
  assert.equal(isBusinessDay('2026-08-21', holidays), false);
  assert.equal(isBusinessDay('2026-08-22', holidays), false);
  assert.deepEqual(businessDatesInclusive('2026-08-20', '2026-08-24', holidays), ['2026-08-20', '2026-08-24']);
});

test('capacidade aplica precedência indisponível sobre alocado e não duplica pessoa', () => {
  const result = calculateDailyCapacity({
    date: '2026-08-21',
    jobRoles: [{ id: 'r1', name: 'Operador', isActive: true, isOperational: true }],
    collaborators: [{ id: 'c1', name: 'Ana', role: 'Operador', jobRoleId: 'r1', admissionDate: '2026-01-01', isActive: true }, { id: 'c2', name: 'Bia', role: 'Operador', jobRoleId: 'r1', admissionDate: '2026-01-01', isActive: true }],
    absences: [{ id: 'a1', collaboratorId: 'c1', type: 'FOLGA', startDate: '2026-08-21', endDate: '2026-08-21', deletedAt: null }],
    missions: [{ id: 'm1', scheduleStatus: 'CONFIRMED', mobilizationDate: '2026-08-21', returnDate: '2026-08-22', demands: [{ jobRoleId: 'r1', requiredCount: 2 }], allocations: [{ collaboratorId: 'c1' }, { collaboratorId: 'c2' }] }]
  });
  assert.deepEqual(result.totals, { jobRoleId: 'all', jobRoleName: 'Total', active: 2, allocated: 1, unavailable: 1, free: 0, demand: 2, deficit: 1 });
  assert.equal(result.statuses.filter(item => item.collaborator.id === 'c1')[0].status, 'UNAVAILABLE');
});
