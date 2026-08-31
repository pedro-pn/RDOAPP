import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

let server;
let mod;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  mod = await server.ssrLoadModule(
    '/src/pages/comercial/proposta/equipamentosDaProposta.ts'
  );
});

test.after(async () => {
  await server?.close();
});

test('flushing sugere as unidades primária e secundária', () => {
  const sugeridos = mod.equipamentosSugeridosPeloEscopo([
    { title: 'Serviço de flushing', description: 'Flushing do sistema hidráulico.' }
  ]);

  assert.deepEqual(sugeridos, [
    '1 unidade de flushing primário',
    '1 unidade de flushing secundário'
  ]);
});

test('serviços diferentes combinam sugestões sem duplicar equipamentos', () => {
  const sugeridos = mod.equipamentosSugeridosPeloEscopo([
    { title: 'Limpeza química e flushing', description: 'Com filtragem absoluta.' },
    { title: 'Novo flushing', description: '' }
  ]);

  assert.deepEqual(sugeridos, [
    '1 unidade de limpeza química',
    '1 bomba pneumática',
    '1 unidade de flushing primário',
    '1 unidade de filtragem absoluta/transferência',
    '1 unidade de flushing secundário'
  ]);
});

test('escopo sem regra conhecida não seleciona equipamento por conta própria', () => {
  assert.deepEqual(
    mod.equipamentosSugeridosPeloEscopo([
      { title: 'Inspeção visual', description: 'Verificação em campo.' }
    ]),
    []
  );
});
