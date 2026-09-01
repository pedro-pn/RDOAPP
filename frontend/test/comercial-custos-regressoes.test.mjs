import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

let server;
let datas;
let encontrarDespesaCalculada;
let motor;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  datas = await server.ssrLoadModule('/src/pages/comercial/custos/datasDaFase.ts');
  ({ encontrarDespesaCalculada } = await server.ssrLoadModule(
    '/src/pages/comercial/custos/sections/DespesasFase.tsx'
  ));
  motor = await server.ssrLoadModule('/../shared/comercial/dist/cost-model.js');
});

test.after(async () => {
  await server?.close();
});

test('Início usa data e converte para o offset do cronograma', () => {
  const draft = {
    scheduleStartDate: '2026-09-01',
    laborContexts: [
      { id: 'fase-1', startOffsetDays: 0 },
      { id: 'fase-2', startOffsetDays: 5 }
    ]
  };

  assert.equal(datas.dataDeInicioDaFase(draft, draft.laborContexts[1]), '2026-09-06');

  const atualizado = datas.atualizarDataDeInicioDaFase(draft, 'fase-2', '2026-09-10');
  assert.equal(atualizado.scheduleStartDate, '2026-09-01');
  assert.equal(atualizado.laborContexts[1].startOffsetDays, 9);

  const componente = readFileSync(
    new URL('../src/pages/comercial/custos/sections/FaseCard.tsx', import.meta.url),
    'utf8'
  );
  assert.match(componente, /label="Início"/);
  assert.match(componente, /type="date"/);
  assert.doesNotMatch(componente, /label="Início \(dia do projeto\)"/);
});

test('uma data anterior recua a base sem alterar as outras fases', () => {
  const draft = {
    scheduleStartDate: '2026-09-10',
    laborContexts: [
      { id: 'fase-1', startOffsetDays: 0 },
      { id: 'fase-2', startOffsetDays: 5 }
    ]
  };

  const atualizado = datas.atualizarDataDeInicioDaFase(draft, 'fase-2', '2026-09-05');
  assert.equal(atualizado.scheduleStartDate, '2026-09-05');
  assert.equal(atualizado.laborContexts[0].startOffsetDays, 5);
  assert.equal(atualizado.laborContexts[1].startOffsetDays, 0);
  assert.equal(
    datas.dataDeInicioDaFase(atualizado, atualizado.laborContexts[0]),
    '2026-09-10'
  );
});

test('a data-base persiste na normalização usada pelo servidor', () => {
  const normalizado = motor.normalizeCostEstimatePayload({
    ...motor.createDefaultCostEstimatePayload(),
    scheduleStartDate: '2026-09-01'
  });
  assert.equal(normalizado.scheduleStartDate, '2026-09-01');
});

test('despesa sem código encontra o próprio resultado pelo id', () => {
  const draft = motor.createDefaultCostEstimatePayload();
  draft.laborContexts[0].expenses = [
    {
      id: 'outra-despesa',
      name: 'Outra despesa',
      basis: 'per_context_day',
      quantity: 4,
      unitValue: 200,
      included: true
    },
    {
      id: 'despesa-testada',
      name: 'Despesa testada',
      basis: 'fixed',
      quantity: 4,
      unitValue: 200,
      included: true
    }
  ];

  const calculadas = motor.calculateEstimate(draft).contextResults[0].expenses;
  const encontrada = encontrarDespesaCalculada(
    calculadas,
    draft.laborContexts[0].expenses[1]
  );

  assert.equal(encontrada.id, 'despesa-testada');
  assert.equal(encontrada.total, 800);
});

test('base fixa escolhida em um preset calcula somente quantidade × valor', () => {
  const draft = motor.createDefaultCostEstimatePayload();
  const alimentacao = draft.laborContexts[0].expenses.find(
    despesa => despesa.code === 'meal_calendar_day'
  );
  alimentacao.basis = 'fixed';
  alimentacao.quantity = 4;
  alimentacao.unitValue = 200;
  alimentacao.included = true;

  const normalizado = motor.normalizeCostEstimatePayload(draft);
  const normalizada = normalizado.laborContexts[0].expenses.find(
    despesa => despesa.code === 'meal_calendar_day'
  );
  const calculada = motor.calculateEstimate(draft).contextResults[0].expenses.find(
    despesa => despesa.code === 'meal_calendar_day'
  );

  assert.equal(normalizada.basis, 'fixed');
  assert.equal(calculada.basis, 'fixed');
  assert.equal(calculada.total, 800);
});

test('produtos por volume mantêm largura útil e rolagem no próprio painel', () => {
  const componente = readFileSync(
    new URL('../src/pages/comercial/custos/sections/ProdutosBloco.tsx', import.meta.url),
    'utf8'
  );
  const css = readFileSync(
    new URL('../src/styles/comercial.css', import.meta.url),
    'utf8'
  );

  assert.match(componente, /com-table-wrap-produtos-volume/);
  assert.match(componente, /com-tabela-produtos-volume/);
  assert.match(css, /\.com-tabela-produtos-volume\s*\{[\s\S]*?min-width:\s*1520px/);
  assert.match(css, /\.com-table-wrap-produtos-volume\s*\{[\s\S]*?overscroll-behavior-x/);
});

test('header superior é branco com marca colorida e o hero permanece verde', () => {
  const chrome = readFileSync(
    new URL('../src/pages/comercial/components/ComercialChrome.tsx', import.meta.url),
    'utf8'
  );
  const historico = readFileSync(
    new URL('../src/pages/comercial/historico/HistoricoPage.tsx', import.meta.url),
    'utf8'
  );
  const marca = readFileSync(
    new URL('../src/pages/comercial/components/marca.ts', import.meta.url),
    'utf8'
  );
  const ponte = readFileSync(
    new URL('../src/styles/comercial-bridge.css', import.meta.url),
    'utf8'
  );

  assert.match(chrome, /LOGO_URL/);
  assert.match(historico, /LOGO_URL/);
  assert.match(marca, /LOGO_COLORIDO\.png/);
  assert.doesNotMatch(marca, /LOGO_HEADER\.png/);
  assert.match(ponte, /--com-topbar-fundo:\s*#fff/);
  assert.match(ponte, /background-color:\s*var\(--com-topbar-fundo\)/);
  assert.doesNotMatch(ponte, /\.com-root \.com-hero[\s\S]*?background:\s*var\(--surface/);
  assert.doesNotMatch(ponte, /\.com-root \.com-hero-custos::after[\s\S]*?content:\s*none/);
  assert.doesNotMatch(ponte, /var\(--topbar-bg/);
});

test('hidratação de levantamento e proposta não é bloqueada pelo StrictMode', () => {
  const custos = readFileSync(
    new URL('../src/pages/comercial/custos/CustosPage.tsx', import.meta.url),
    'utf8'
  );
  const proposta = readFileSync(
    new URL('../src/pages/comercial/proposta/PropostaPage.tsx', import.meta.url),
    'utf8'
  );
  const revisao = readFileSync(
    new URL('../src/pages/comercial/proposta/usePropostaRevision.ts', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(
    custos,
    /atualCarregado\.current = levantamentoAtualId;\s*\n\s*let vivo = true/
  );
  assert.match(
    custos,
    /if \(!vivo \|\| !atual\.payload\) return;[\s\S]*?atualCarregado\.current = levantamentoAtualId;/
  );
  assert.doesNotMatch(
    proposta,
    /idCarregado\.current = propostaId;\s*\n\s*let vivo = true/
  );
  assert.match(
    proposta,
    /if \(!vivo\) return;[\s\S]*?idCarregado\.current = propostaId;/
  );
  assert.doesNotMatch(
    revisao,
    /revisaoCarregada\.current = chave;\s*\n\s*let vivo = true/
  );
});
