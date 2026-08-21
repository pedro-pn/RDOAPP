import assert from 'node:assert/strict';
import test from 'node:test';

import { lockCollaborator } from '../src/lib/efetivo/planning/conflicts.js';

test('lock de colaborador usa parâmetro e FOR UPDATE antes da revalidação', async () => {
  const calls = [];
  await lockCollaborator({ $queryRawUnsafe: async (...args) => calls.push(args) }, 'c1');
  assert.match(calls[0][0], /FOR UPDATE/);
  assert.equal(calls[0][1], 'c1');
});
