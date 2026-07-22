import assert from 'node:assert/strict';
import test from 'node:test';

import {
  requireEstoqueAccess,
  requireEstoqueManager
} from '../src/middleware/auth.js';

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function runGuard(guard, user) {
  const req = { auth: { user } };
  const res = responseRecorder();
  let nextCalled = false;
  guard(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled, statusCode: res.statusCode, body: res.body };
}

test('estoque guards enforce viewer, manager and no-role matrix', () => {
  const viewer = { accountType: 'INTERNAL', moduleRoles: ['estoque:viewer'] };
  const manager = { accountType: 'ADMIN', moduleRoles: ['estoque:manager'] };
  const noRole = { accountType: 'ADMIN', moduleRoles: [] };

  assert.equal(runGuard(requireEstoqueAccess, viewer).nextCalled, true);
  assert.equal(runGuard(requireEstoqueManager, viewer).statusCode, 403);

  assert.equal(runGuard(requireEstoqueAccess, noRole).statusCode, 403);
  assert.equal(runGuard(requireEstoqueManager, noRole).statusCode, 403);

  assert.equal(runGuard(requireEstoqueAccess, manager).nextCalled, true);
  assert.equal(runGuard(requireEstoqueManager, manager).nextCalled, true);
});
