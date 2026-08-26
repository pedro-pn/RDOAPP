import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

async function load(path) {
  const server = await createServer({ configFile: false, root: new URL('..', import.meta.url).pathname, server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
  try { return await server.ssrLoadModule(path); } finally { await server.close(); }
}

const collaborators = [
  { id: 'c1', name: 'Álvaro Silva', role: 'Assistente de Operações III', jobRoleId: 'r1', isActive: true },
  { id: 'c2', name: 'Bianca Souza', role: 'Mantenedor I', jobRoleId: 'r2', isActive: true }
];

test('busca da equipe ignora acentos e encontra por nome ou cargo', async () => {
  const team = await load('/src/utils/missionTeam.ts');
  assert.deepEqual(team.filterMissionTeamCollaborators(collaborators, 'alvaro').map(item => item.id), ['c1']);
  assert.deepEqual(team.filterMissionTeamCollaborators(collaborators, 'operacoes iii').map(item => item.id), ['c1']);
  assert.deepEqual(team.filterMissionTeamCollaborators(collaborators, 'mantenedor').map(item => item.id), ['c2']);
});

test('edição pré-seleciona colaboradores alocados sem duplicar IDs', async () => {
  const team = await load('/src/utils/missionTeam.ts');
  const mission = { allocations: [{ collaboratorId: 'c2' }, { collaboratorId: 'c1' }, { collaboratorId: 'c2' }] };
  assert.deepEqual(team.selectedMissionCollaboratorIds(mission), ['c2', 'c1']);
  assert.deepEqual(team.toggleMissionCollaborator(['c2'], 'c1', true), ['c2', 'c1']);
  assert.deepEqual(team.toggleMissionCollaborator(['c2', 'c1'], 'c2', false), ['c1']);
});
