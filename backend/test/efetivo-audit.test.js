import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeSnapshot } from '../src/lib/efetivo/planning/audit.js';

test('auditoria remove segredos de snapshots aninhados', () => {
  assert.deepEqual(sanitizeSnapshot({ name: 'Ana', token: 'secret', nested: { passwordHash: 'x', role: 'Operador' } }), { name: 'Ana', nested: { role: 'Operador' } });
});
