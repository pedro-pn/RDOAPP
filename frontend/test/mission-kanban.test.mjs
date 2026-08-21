import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

async function load(path) {
  const server = await createServer({ configFile: false, root: new URL('..', import.meta.url).pathname, server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
  try { return await server.ssrLoadModule(path); } finally { await server.close(); }
}

test('reducer move cartão entre colunas e snapshot permite rollback', async () => {
  const kanban = await load('/src/utils/missionKanban.ts');
  const mission = { id: 'm1', stage: 'STANDBY', kanbanOrder: 0 };
  const columns = kanban.missionsToColumns([mission]);
  const snapshot = kanban.cloneMissionColumns(columns);
  const moved = kanban.moveMissionInColumns(columns, 'm1', 'EXECUTION', 0);
  assert.equal(moved.STANDBY.length, 0);
  assert.equal(moved.EXECUTION[0].id, 'm1');
  assert.equal(snapshot.STANDBY[0].id, 'm1');
});
