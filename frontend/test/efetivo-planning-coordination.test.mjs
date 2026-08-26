import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createServer } from 'vite';

async function load(path) {
  const server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    appType: 'custom'
  });
  try { return await server.ssrLoadModule(path); } finally { await server.close(); }
}

function fakeDocument() {
  const classes = new Set();
  return {
    body: {
      classList: {
        add: value => classes.add(value),
        remove: value => classes.delete(value),
        contains: value => classes.has(value)
      }
    }
  };
}

test('refresh de missão notifica o cenário depois de invalidar as leituras compartilhadas', async () => {
  const { refreshMissionPlanningQueries } = await load('/src/utils/efetivoPlanningQueries.ts');
  const invalidated = [];
  let scenarioRefreshed = false;
  await refreshMissionPlanningQueries({
    invalidateQueries: async ({ queryKey }) => { invalidated.push(queryKey); }
  }, async () => { scenarioRefreshed = true; });

  assert.deepEqual(invalidated, [
    ['efetivo-planning-missions'],
    ['efetivo-planning-missions-pending'],
    ['efetivo-planning-overview'],
    ['efetivo-planning-calendar']
  ]);
  assert.equal(scenarioRefreshed, true);
});

test('coordenador de guias reserva uma única experiência por vez', async () => {
  const { releaseEfetivoGuide, reserveEfetivoGuide } = await load('/src/utils/efetivoGuideCoordinator.ts');
  const documentRef = fakeDocument();

  assert.equal(reserveEfetivoGuide(documentRef), true);
  assert.equal(reserveEfetivoGuide(documentRef), false);
  releaseEfetivoGuide(documentRef);
  assert.equal(reserveEfetivoGuide(documentRef), true);
  releaseEfetivoGuide(documentRef);
  documentRef.body.classList.add('driver-active');
  assert.equal(reserveEfetivoGuide(documentRef), false);
});

test('responsável da sede é obrigatório no tipo, OpenAPI e schema Zod', () => {
  const api = fs.readFileSync(new URL('../src/api/efetivoPlanning.ts', import.meta.url), 'utf8');
  const openapi = fs.readFileSync(new URL('../../specs/012-planejamento-efetivo/contracts/efetivo-planning.openapi.yaml', import.meta.url), 'utf8');
  const schemas = fs.readFileSync(new URL('../../backend/src/lib/efetivo/planning/schemas.js', import.meta.url), 'utf8');

  assert.match(api, /headquartersResponsibleUserId:\s*string;/);
  assert.match(openapi, /required:\s*\[[^\]]*headquartersResponsibleUserId[^\]]*\]/);
  assert.match(schemas, /headquartersResponsibleUserId:\s*idSchema/);
});

test('equipe da missão usa collaboratorIds no tipo, OpenAPI e schema Zod', () => {
  const api = fs.readFileSync(new URL('../src/api/efetivoPlanning.ts', import.meta.url), 'utf8');
  const openapi = fs.readFileSync(new URL('../../specs/012-planejamento-efetivo/contracts/efetivo-planning.openapi.yaml', import.meta.url), 'utf8');
  const schemas = fs.readFileSync(new URL('../../backend/src/lib/efetivo/planning/schemas.js', import.meta.url), 'utf8');

  assert.match(api, /collaboratorIds:\s*string\[\];/);
  assert.doesNotMatch(api.match(/export interface MissionInput \{[\s\S]*?\n\}/)?.[0] || '', /demands:/);
  assert.match(openapi, /required:\s*\[[^\]]*collaboratorIds[^\]]*\]/);
  assert.match(schemas, /collaboratorIds:\s*z\.array\(idSchema\)/);
});
