import assert from 'node:assert/strict';
import test from 'node:test';

import { planJobRoleBackfill } from '../scripts/backfill-efetivo-job-roles.js';
import { collectCollaboratorUpdateConflicts } from '../src/lib/efetivo/planning/collaborators.js';

test('backfill vincula somente nome de função inequívoco e preserva pendências', () => {
  const result = planJobRoleBackfill([{ id: 'c1', role: 'Operador', jobRoleId: null }, { id: 'c2', role: 'Ambíguo', jobRoleId: null }], [{ id: 'r1', name: 'operador' }, { id: 'r2', name: 'Ambíguo' }, { id: 'r3', name: 'ambíguo' }]);
  assert.deepEqual(result.matches, [{ collaboratorId: 'c1', jobRoleId: 'r1' }]);
  assert.deepEqual(result.unresolved, [{ collaboratorId: 'c2', role: 'Ambíguo', candidates: 2 }]);
});

test('edição cadastral não pode invalidar função ou vínculo de alocação confirmada', () => {
  const allocation = { jobRoleId: 'r1', mission: { id: 'm1', mobilizationDate: '2026-09-01', returnDate: '2026-09-10' } };
  const roleConflicts = collectCollaboratorUpdateConflicts({ id: 'c1', name: 'Ana', jobRoleId: 'r2', admissionDate: '2025-01-01' }, [allocation]);
  const employmentConflicts = collectCollaboratorUpdateConflicts({ id: 'c1', name: 'Ana', jobRoleId: 'r1', admissionDate: '2025-01-01', terminationDate: '2026-09-05' }, [allocation]);
  assert.equal(roleConflicts.some(item => item.code === 'WRONG_JOB_ROLE'), true);
  assert.equal(employmentConflicts.some(item => item.code === 'OUTSIDE_EMPLOYMENT'), true);
});
