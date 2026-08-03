import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

/**
 * Materiais e insumos.
 *
 * O que precisa ser provado aqui é o efeito no CUSTO, e uma regra de fluxo que
 * é fácil deixar passar: acrescentar insumo tem de desfazer a confirmação de
 * "sem insumos", senão o levantamento afirma duas coisas contraditórias ao
 * mesmo tempo.
 */

let server;
let motor;
let faltaInsumos;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  motor = await server.ssrLoadModule('/../shared/comercial/dist/cost-model.js');
  ({ faltaInsumos } = await server.ssrLoadModule(
    '/src/pages/comercial/custos/pendencias.ts'
  ));
});

test.after(async () => {
  await server?.close();
});

function material(extras = {}) {
  return {
    id: `m-${Math.random().toString(36).slice(2, 8)}`,
    category: 'material',
    description: 'Tubo',
    unit: 'un.',
    quantity: 10,
    unitCost: 25,
    wastePercent: 0,
    freightValue: 0,
    included: true,
    ...extras
  };
}

function comMateriais(itens) {
  const base = motor.createDefaultCostEstimatePayload();
  return { ...base, materials: itens };
}

test('material incluído entra no custo', () => {
  const vazio = motor.calculateEstimate(comMateriais([]));
  const comUm = motor.calculateEstimate(comMateriais([material()]));

  assert.equal(Number(vazio.materialCost), 0);
  assert.ok(Number(comUm.materialCost) > 0, 'material tem de somar ao custo');
});

test('desmarcar "incluir" tira o item do custo sem apagá-lo', () => {
  // É diferente de remover: o item continua na lista, visível, para o
  // orçamentista lembrar que considerou e descartou.
  const incluido = motor.calculateEstimate(comMateriais([material({ included: true })]));
  const excluido = motor.calculateEstimate(comMateriais([material({ included: false })]));

  assert.ok(Number(incluido.materialCost) > 0);
  assert.equal(Number(excluido.materialCost), 0, 'item excluído não pode custar');
});

test('perda percentual aumenta o custo', () => {
  const semPerda = motor.calculateEstimate(comMateriais([material({ wastePercent: 0 })]));
  const comPerda = motor.calculateEstimate(comMateriais([material({ wastePercent: 10 })]));

  assert.ok(
    Number(comPerda.materialCost) > Number(semPerda.materialCost),
    'perda de 10% tem de encarecer'
  );
});

test('frete entra no custo do item', () => {
  const semFrete = motor.calculateEstimate(comMateriais([material({ freightValue: 0 })]));
  const comFrete = motor.calculateEstimate(comMateriais([material({ freightValue: 300 })]));

  assert.ok(Number(comFrete.materialCost) > Number(semFrete.materialCost));
});

test('quantidade e custo unitário multiplicam', () => {
  const um = motor.calculateEstimate(
    comMateriais([material({ quantity: 1, unitCost: 100 })])
  );
  const dez = motor.calculateEstimate(
    comMateriais([material({ quantity: 10, unitCost: 100 })])
  );

  assert.equal(
    Number(dez.materialCost),
    Number(um.materialCost) * 10,
    'dez unidades custam dez vezes uma'
  );
});

test('material incluído desliga a pendência de insumos', () => {
  const semNada = motor.createDefaultCostEstimatePayload();
  assert.equal(faltaInsumos(semNada), true);

  const comMaterial = comMateriais([material()]);
  assert.equal(
    faltaInsumos(comMaterial),
    false,
    'com composição real a pendência tem de sumir sozinha'
  );
});

test('material APENAS excluído não conta como composição', () => {
  // Um item marcado para não entrar não é uma decisão sobre insumos — é um
  // rascunho. A pendência continua, e é isso que evita salvar por engano.
  const soExcluido = comMateriais([material({ included: false })]);
  assert.equal(faltaInsumos(soExcluido), true);
});

test('a confirmação "sem insumos" desliga a pendência mesmo sem itens', () => {
  const base = motor.createDefaultCostEstimatePayload();
  const confirmado = {
    ...base,
    scopeConfirmations: { ...base.scopeConfirmations, noInputs: true }
  };
  assert.equal(faltaInsumos(confirmado), false);
});
