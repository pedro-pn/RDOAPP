import assert from 'node:assert/strict';
import test from 'node:test';

import {
  absenceMonths,
  markAbsenceDeleted,
  periodsOverlap,
  validateAbsencePeriod
} from '../src/lib/efetivo/absences.js';
import { listEfetivoCollaborators } from '../src/lib/efetivo/service.js';

test('período de ausência recusa fim anterior ao início', () => {
  assert.throws(
    () => validateAbsencePeriod({ startDate: '2026-08-20', endDate: '2026-08-10' }),
    /fim.*anterior/i
  );
});

test('período de ausência recusa data inexistente no calendário', () => {
  assert.throws(
    () => validateAbsencePeriod({ startDate: '2026-02-30', endDate: '2026-03-05' }),
    /válidos/i
  );
});

test('sobreposição inclusiva é detectada para o mesmo colaborador', () => {
  assert.equal(periodsOverlap(
    { startDate: '2026-08-01', endDate: '2026-08-15' },
    { startDate: '2026-08-15', endDate: '2026-08-25' }
  ), true);
  assert.equal(periodsOverlap(
    { startDate: '2026-08-01', endDate: '2026-08-14' },
    { startDate: '2026-08-15', endDate: '2026-08-25' }
  ), false);
});

test('soft delete preserva autoria e trilha original', () => {
  const absence = {
    id: 'absence-1',
    collaboratorId: 'collaborator-1',
    createdByUserId: 'user-1',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    deletedAt: null
  };
  const deletedAt = new Date('2026-08-21T10:00:00.000Z');
  const deleted = markAbsenceDeleted(absence, deletedAt);
  assert.equal(deleted.id, absence.id);
  assert.equal(deleted.createdByUserId, absence.createdByUserId);
  assert.equal(deleted.createdAt, absence.createdAt);
  assert.equal(deleted.deletedAt, deletedAt);
});

test('período é mapeado para todos os meses afetados', () => {
  assert.deepEqual(absenceMonths({ startDate: '2026-01-20', endDate: '2026-03-02' }), [
    '2026-01',
    '2026-02',
    '2026-03'
  ]);
});

test('formulário de férias usa listagem mínima própria do módulo', async () => {
  let query;
  const expected = [{ id: 'collaborator-1', name: 'Ana', role: 'Operadora', isActive: true }];
  const database = {
    collaborator: {
      findMany: async options => {
        query = options;
        return expected;
      }
    }
  };
  const result = await listEfetivoCollaborators({ database, laborCost: {} });
  assert.equal(result, expected);
  assert.deepEqual(query.select, { id: true, name: true, role: true, isActive: true });
  assert.deepEqual(query.orderBy, { name: 'asc' });
});
