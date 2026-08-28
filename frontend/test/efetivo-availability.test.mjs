import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createServer } from 'vite';

async function load(path) {
  const server = await createServer({ configFile: false, root: new URL('..', import.meta.url).pathname, server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
  try { return await server.ssrLoadModule(path); } finally { await server.close(); }
}

function collaborator(id, status = 'FREE') {
  return { id, name: `Pessoa ${id}`, role: 'Operação', status, isActive: true };
}

function mission(id, stage, collaboratorId, mobilizationDate = '2026-09-01') {
  return {
    id, stage, scheduleStatus: 'CONFIRMED', mobilizationDate, returnDate: '2026-09-30',
    project: { code: id, name: `Missão ${id}` }, allocations: [{ collaboratorId }]
  };
}

test('disponibilidade separa livres, aguardando, mobilizados e férias', async () => {
  const { buildAvailabilityColumns } = await load('/src/utils/collaboratorAvailability.ts');
  const result = buildAvailabilityColumns(
    [collaborator('livre'), collaborator('aguarda'), collaborator('mobilizado', 'ALLOCATED'), collaborator('ferias', 'UNAVAILABLE')],
    [mission('m1', 'STANDBY', 'aguarda'), mission('m2', 'EXECUTION', 'mobilizado', '2026-08-01')],
    [{ collaboratorId: 'ferias', type: 'FERIAS', startDate: '2026-08-01', endDate: '2026-08-31' }],
    '2026-08-27'
  );
  assert.deepEqual(result.columns.AVAILABLE.map(item => item.collaborator.id), ['livre']);
  assert.deepEqual(result.columns.AWAITING_MOBILIZATION.map(item => item.collaborator.id), ['aguarda']);
  assert.deepEqual(result.columns.MOBILIZED.map(item => item.collaborator.id), ['mobilizado']);
  assert.deepEqual(result.columns.ON_VACATION.map(item => item.collaborator.id), ['ferias']);
});

test('quadro de disponibilidade é somente leitura e não expõe drag ou movimentação', () => {
  const source = fs.readFileSync(new URL('../src/pages/efetivo/components/AvailabilityBoard.tsx', import.meta.url), 'utf8');
  assert.match(source, /Somente leitura/);
  assert.doesNotMatch(source, /draggable=|onDrag|Mover para/);
  assert.doesNotMatch(source, /Livre para mobilização|Sem compromisso na data/);
});

test('formulário calcula disponibilidade em todo o período e ignora a própria missão', async () => {
  const { buildMissionAvailabilityColumns } = await load('/src/utils/collaboratorAvailability.ts');
  const people = ['livre', 'aguarda', 'mobilizado', 'ferias', 'propria'].map(id => ({
    ...collaborator(id), jobRoleId: 'r1', admissionDate: '2025-01-01', terminationDate: null
  }));
  const result = buildMissionAvailabilityColumns(
    people,
    [
      mission('standby', 'STANDBY', 'aguarda', '2026-09-05'),
      mission('execucao', 'EXECUTION', 'mobilizado', '2026-08-01'),
      mission('current', 'EXECUTION', 'propria', '2026-08-01')
    ],
    [{ collaboratorId: 'ferias', type: 'FERIAS', startDate: '2026-09-04', endDate: '2026-09-08' }],
    '2026-09-01',
    '2026-09-10',
    'current'
  );
  assert.deepEqual(result.columns.AVAILABLE.map(item => item.collaborator.id), ['livre', 'propria']);
  assert.deepEqual(result.columns.AWAITING_MOBILIZATION.map(item => item.collaborator.id), ['aguarda']);
  assert.deepEqual(result.columns.MOBILIZED.map(item => item.collaborator.id), ['mobilizado']);
  assert.deepEqual(result.columns.ON_VACATION.map(item => item.collaborator.id), ['ferias']);
});

test('seleção da equipe abre diálogo kanban em vez de lista embutida', () => {
  const source = fs.readFileSync(new URL('../src/pages/efetivo/components/MissionTeamSelector.tsx', import.meta.url), 'utf8');
  assert.match(source, /Ver colaboradores/);
  assert.match(source, /buildMissionAvailabilityColumns/);
  assert.match(source, /efetivo-team-availability-kanban/);
  assert.doesNotMatch(source, /className="efetivo-team-list"/);
});

test('status dos dois kanbans têm bolinhas com cores próprias e o módulo usa toda a largura', () => {
  const css = fs.readFileSync(new URL('../src/pages/efetivo/efetivo.css', import.meta.url), 'utf8');
  for (const status of ['STANDBY', 'MOBILIZATION', 'EXECUTION', 'FINAL_MEASUREMENT', 'FINISHED']) {
    assert.match(css, new RegExp(`\\[data-kanban-stage='${status}'\\] \\{ --stage: #[0-9a-f]{6}; \\}`));
  }
  for (const status of ['AVAILABLE', 'AWAITING_MOBILIZATION', 'MOBILIZED', 'ON_VACATION']) {
    assert.match(css, new RegExp(`\\[data-availability-status='${status}'\\] \\{ --stage: #[0-9a-f]{6}; \\}`));
  }
  assert.match(css, /\.app-shell:has\(\.equip-page\.efetivo-page\)\s*\{[\s\S]*?max-width:\s*none/);
});
