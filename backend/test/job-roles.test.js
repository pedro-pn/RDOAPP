import assert from 'node:assert/strict';
import test from 'node:test';

import { sortJobRolesByName } from '../src/lib/job-roles/index.js';

test('sortJobRolesByName orders cargos alphabetically independent of stored order', () => {
  const roles = [
    { id: 'supervisor', name: 'Supervisor de Operações', order: 49, isActive: true },
    { id: 'tecnico', name: 'Técnico de Campo', order: 0, isActive: true },
    { id: 'auxiliar', name: 'Auxiliar de Produção', order: 10, isActive: true },
    { id: 'almoxarife', name: 'Almoxarife', order: 1, isActive: true }
  ];

  assert.deepEqual(
    sortJobRolesByName(roles).map(role => role.name),
    [
      'Almoxarife',
      'Auxiliar de Produção',
      'Supervisor de Operações',
      'Técnico de Campo'
    ]
  );
});
