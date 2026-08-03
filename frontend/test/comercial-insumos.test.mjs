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

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

test('o catálogo LEC traz nome, micragem e preço nos 8 filtros', () => {
  const catalogo = motor.LEC_FILTER_CATALOG;
  assert.equal(catalogo.length, 8);
  for (const filtro of catalogo) {
    assert.ok(filtro.filterName, 'filtro sem nome');
    assert.ok(filtro.unitCost > 0, `${filtro.filterName} sem preço`);
  }
});

test('filtro incluído entra no custo; desmarcado, não', () => {
  const base = motor.createDefaultCostEstimatePayload();
  const doCatalogo = motor.LEC_FILTER_CATALOG[0];

  const filtro = incluido => ({
    id: 'f1',
    filterName: doCatalogo.filterName,
    micronRating: doCatalogo.micronRating,
    unit: 'un.',
    quantity: 2,
    unitCost: doCatalogo.unitCost,
    included: incluido
  });

  const dentro = motor.calculateEstimate({ ...base, filters: [filtro(true)] });
  const fora = motor.calculateEstimate({ ...base, filters: [filtro(false)] });

  assert.ok(Number(dentro.filterCost ?? dentro.inputCost) > 0);
  assert.ok(
    Number(dentro.inputCost) > Number(fora.inputCost),
    'filtro desmarcado não pode custar'
  );
});

test('filtro nasce DESMARCADO — não conta como composição sozinho', () => {
  // Acrescentar um filtro em branco que já entra no custo somaria zero e daria
  // a impressão de estar considerado.
  const base = motor.createDefaultCostEstimatePayload();
  const emBranco = {
    ...base,
    filters: [
      {
        id: 'f1',
        filterName: 'Filtro personalizado',
        micronRating: '',
        unit: 'un.',
        quantity: 0,
        unitCost: 0,
        included: false
      }
    ]
  };
  assert.equal(faltaInsumos(emBranco), true);
});

// ---------------------------------------------------------------------------
// Circuitos — o volume que doseia os químicos
// ---------------------------------------------------------------------------

function circuito(extras = {}) {
  return {
    id: 'c1',
    name: 'Circuito de teste',
    material: 'carbon_steel',
    pipeSegments: [],
    hoseSegments: [],
    equipmentVolumes: [],
    manualVolumes: [],
    cycles: 1,
    enabled: true,
    ...extras
  };
}

function comCircuito(c) {
  const base = motor.createDefaultCostEstimatePayload();
  return { ...base, volumeSystems: [c] };
}

test('trecho de tubo gera volume pela geometria', () => {
  // Tubo de 100 mm de diâmetro interno e 10 m: π × 0,05² × 10 = ~78,5 L.
  const comTubo = motor.calculateEstimate(
    comCircuito(
      circuito({
        pipeSegments: [
          {
            id: 't1',
            description: 'Linha',
            quantity: 1,
            lengthM: 10,
            internalDiameterMm: 100,
            fillPercent: 100
          }
        ]
      })
    )
  );

  const volume = Number(comTubo.totalVolumeLiters);
  assert.ok(volume > 70 && volume < 90, `volume inesperado: ${volume}`);
});

test('preenchimento parcial reduz o volume proporcionalmente', () => {
  const tubo = fill => ({
    id: 't1',
    description: 'Linha',
    quantity: 1,
    lengthM: 10,
    internalDiameterMm: 100,
    fillPercent: fill
  });

  const cheio = motor.calculateEstimate(comCircuito(circuito({ pipeSegments: [tubo(100)] })));
  const meio = motor.calculateEstimate(comCircuito(circuito({ pipeSegments: [tubo(50)] })));

  assert.ok(
    Math.abs(Number(meio.totalVolumeLiters) * 2 - Number(cheio.totalVolumeLiters)) < 0.01,
    '50% de preenchimento tem de dar metade do volume'
  );
});

test('o diâmetro entra ao QUADRADO — dobrar o diâmetro quadruplica o volume', () => {
  // É o erro mais caro de digitação nesta tela: trocar 50 por 100 no diâmetro
  // não dobra o produto químico, quadruplica.
  const tubo = diametro => ({
    id: 't1',
    description: 'Linha',
    quantity: 1,
    lengthM: 10,
    internalDiameterMm: diametro,
    fillPercent: 100
  });

  const fino = motor.calculateEstimate(comCircuito(circuito({ pipeSegments: [tubo(50)] })));
  const grosso = motor.calculateEstimate(comCircuito(circuito({ pipeSegments: [tubo(100)] })));

  const razao = Number(grosso.totalVolumeLiters) / Number(fino.totalVolumeLiters);
  assert.ok(Math.abs(razao - 4) < 0.01, `esperava 4x, veio ${razao}`);
});

test('ciclos multiplicam o volume', () => {
  const base = circuito({
    pipeSegments: [
      {
        id: 't1',
        description: 'Linha',
        quantity: 1,
        lengthM: 10,
        internalDiameterMm: 100,
        fillPercent: 100
      }
    ]
  });

  const umCiclo = motor.calculateEstimate(comCircuito({ ...base, cycles: 1 }));
  const doisCiclos = motor.calculateEstimate(comCircuito({ ...base, cycles: 2 }));

  assert.ok(
    Number(doisCiclos.totalVolumeLiters) > Number(umCiclo.totalVolumeLiters),
    'duas passagens consomem mais que uma'
  );
});

test('equipamento desmarcado não soma volume', () => {
  const equipamento = incluido => ({
    id: 'e1',
    description: 'Reservatório',
    quantity: 1,
    volumeLiters: 500,
    included: incluido
  });

  const dentro = motor.calculateEstimate(
    comCircuito(circuito({ equipmentVolumes: [equipamento(true)] }))
  );
  const fora = motor.calculateEstimate(
    comCircuito(circuito({ equipmentVolumes: [equipamento(false)] }))
  );

  assert.ok(Number(dentro.totalVolumeLiters) > Number(fora.totalVolumeLiters));
});

test('as quatro coleções somam no mesmo volume', () => {
  const completo = circuito({
    pipeSegments: [
      { id: 't1', description: 'T', quantity: 1, lengthM: 5, internalDiameterMm: 50, fillPercent: 100 }
    ],
    hoseSegments: [
      { id: 'm1', description: 'M', quantity: 1, lengthM: 5, internalDiameterMm: 25, fillPercent: 100 }
    ],
    equipmentVolumes: [
      { id: 'e1', description: 'E', quantity: 1, volumeLiters: 100, included: true }
    ],
    manualVolumes: [{ id: 'v1', description: 'V', quantity: 1, volumeLiters: 50 }]
  });

  const soTubo = motor.calculateEstimate(
    comCircuito(circuito({ pipeSegments: completo.pipeSegments }))
  );
  const tudo = motor.calculateEstimate(comCircuito(completo));

  assert.ok(
    Number(tudo.totalVolumeLiters) > Number(soTubo.totalVolumeLiters),
    'mangueira, equipamento e volume manual têm de somar'
  );
});
