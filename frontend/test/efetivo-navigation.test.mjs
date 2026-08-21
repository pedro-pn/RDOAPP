import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import fs from 'node:fs';

async function load(path) {
  const server = await createServer({ configFile: false, root: new URL('..', import.meta.url).pathname, server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
  try { return await server.ssrLoadModule(path); } finally { await server.close(); }
}

test('troca de seção preserva somente parâmetros compatíveis', async () => {
  const navigation = await load('/src/utils/planningNavigation.ts');
  const next = navigation.setPlanningSectionParams(new URLSearchParams('section=missoes&missao=m1&status=DRAFT&date=2026-08-21'), 'calendario');
  assert.equal(next.get('section'), 'calendario');
  assert.equal(next.has('missao'), false);
  assert.equal(next.has('status'), false);
  assert.equal(next.get('date'), '2026-08-21');
});

test('cliente de planejamento não expõe lançamento manual de HH', () => {
  const source = fs.readFileSync(new URL('../src/api/efetivoPlanning.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /lan[cç]ar.*hh|manual.*hours/i);
});
