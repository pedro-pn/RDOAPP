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

test('soltar em outra coluna usa o alvo destacado e não depende da prévia ao vivo', async () => {
  const kanban = await load('/src/utils/missionKanban.ts');
  const columns = kanban.missionsToColumns([
    { id: 'm1', stage: 'STANDBY', kanbanOrder: 0 },
    { id: 'm2', stage: 'EXECUTION', kanbanOrder: 0 },
    { id: 'm3', stage: 'EXECUTION', kanbanOrder: 1 }
  ]);
  assert.equal(kanban.missionStage(columns, 'm1'), 'STANDBY');
  assert.deepEqual(kanban.resolveKanbanDrop(columns, 'm1', 'EXECUTION', { stage: 'EXECUTION', order: 1 }), { sameColumn: false, order: 1 });
  assert.deepEqual(kanban.resolveKanbanDrop(columns, 'm1', 'EXECUTION', null), { sameColumn: false, order: 2 });
  assert.deepEqual(kanban.resolveKanbanDrop(columns, 'm1', 'EXECUTION', { stage: 'FINISHED', order: 0 }), { sameColumn: false, order: 2 });
  assert.deepEqual(kanban.resolveKanbanDrop(columns, 'm3', 'EXECUTION', null), { sameColumn: true, order: 1 });
});

test('cartão arrastado não é remontado em outra coluna durante o arraste', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../src/pages/efetivo/components/MissionKanban.tsx', import.meta.url), 'utf8');
  // A prévia ao vivo só pode acontecer dentro da própria coluna: remontar o cartão em outra
  // coluna mata o arraste nativo e o `dragend` nunca chega para limpar o estado.
  assert.match(source, /if \(missionStage\(columns, missionId\) === stage\) \{\s*[\s\S]{0,200}?liveMove\(/);
  assert.doesNotMatch(source, /onDragOver=\{[\s\S]{0,200}?liveMove\(/);
  // Soltar encerra o arraste na hora, sem depender do evento dragend.
  assert.match(source, /function dropOnStage[\s\S]{0,400}?endDrag\(\);/);
  assert.match(source, /onDrop=\{event => \{\s*event\.preventDefault\(\);\s*dropOnStage\(stage\);/);
});
