import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let motor;
let FaseCard;
let CircuitosBloco;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    appType: 'custom'
  });
  motor = await server.ssrLoadModule('/../shared/comercial/dist/cost-model.js');
  ({ FaseCard } = await server.ssrLoadModule(
    '/src/pages/comercial/custos/sections/FaseCard.tsx'
  ));
  ({ CircuitosBloco } = await server.ssrLoadModule(
    '/src/pages/comercial/custos/sections/CircuitosBloco.tsx'
  ));
});

test.after(async () => {
  await server?.close();
});

function levantamento() {
  const draft = motor.createDefaultCostEstimatePayload();
  const result = motor.calculateEstimate(draft);
  return {
    draft,
    result,
    assumptions: draft.assumptions,
    setDraft: () => {},
    updateCollection: () => {},
    removeCollection: () => {},
    updateNested: () => {},
    removeNested: () => {},
    addNested: () => {},
    erroSe: () => undefined,
    resultadoDaFase: (id) =>
      result.contextResults.find((item) => item.id === id) || {}
  };
}

test('veículo continua obrigatório, mas oferece a decisão explícita "Sem veículo"', () => {
  const estado = levantamento();
  const html = renderToStaticMarkup(
    createElement(FaseCard, {
      fase: estado.draft.laborContexts[0],
      indice: 0,
      total: 1,
      levantamento: estado
    })
  );

  assert.match(html, /Veículo da equipe/);
  assert.match(html, /value="none">Sem veículo/);
  assert.match(html, /Cenários de jornada/);
  assert.match(html, /Aplicar este horário para toda a equipe/);
  assert.match(html, /Percentual da HE/);
});

test('os circuitos existentes nascem minimizados e mantêm nome e volume no resumo', () => {
  const estado = levantamento();
  const html = renderToStaticMarkup(
    createElement(CircuitosBloco, { levantamento: estado })
  );

  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aço carbono/i);
  assert.match(html, /Abrir para preencher/);
  assert.doesNotMatch(html, /Trechos de tubo/);
});

test('o chrome de custos mantém topbar e resumo sticky em altura compacta', () => {
  const css = readFileSync(
    new URL('../src/styles/comercial.css', import.meta.url),
    'utf8'
  );
  const chrome = readFileSync(
    new URL(
      '../src/pages/comercial/components/ComercialChrome.tsx',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(chrome, /com-app-\$\{variante\}/);
  assert.match(
    css,
    /\.com-root\.com-app-custos\s*\{\s*--com-topbar-height:\s*58px/
  );
  assert.match(css, /\.com-root \.com-topbar\s*\{[\s\S]*?position:\s*sticky/);
  assert.match(css, /\.com-root \.com-hero\s*\{[\s\S]*?position:\s*sticky/);
  assert.match(
    css,
    /\.com-root \.com-hero-custos\s*\{\s*padding:\s*10px 4vw 12px/
  );
});
