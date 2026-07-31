import assert from 'node:assert/strict';
import test from 'node:test';

import { comercialStatus } from '../src/lib/comercial/service.js';

test('comercial exposes module status', () => {
  assert.deepEqual(comercialStatus(), {
    module: 'comercial',
    status: 'ok'
  });
});
