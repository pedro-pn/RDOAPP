import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

/**
 * Predicados de logística — a última peça da cadeia do rodapé-guia.
 *
 * São 171 linhas de lógica densa no original, transcritas. **É o teste que
 * torna a transcrição confiável**: cada condição vira um caso, e o que o teste
 * não cobrir é o que vai divergir em silêncio.
 *
 * O erro que este predicado existe para evitar é caro: transporte cobrado a
 * mais, ou equipe sem transporte na obra.
 */

let server;
let transporteDispensado;
let itemPrecisaAtencao;
let gruposPrecisamAtencao;
let faltaLogistica;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  ({ transporteDispensado, itemPrecisaAtencao, gruposPrecisamAtencao, faltaLogistica } =
    await server.ssrLoadModule('/src/pages/comercial/custos/logistica.ts'));
});

test.after(async () => {
  await server?.close();
});

/** Item completo de frete externo — o modo mais simples. */
function freteExterno(extras = {}) {
  return {
    id: 'l1',
    direction: 'mobilization',
    included: true,
    calculationMode: 'external_freight',
    calculationModeConfirmed: true,
    quantity: 1,
    trips: 1,
    unitCost: 1500,
    additionalCosts: [],
    ...extras
  };
}

/** Fase com duas pessoas alocadas. */
function faseComEquipe() {
  return {
    id: 'f1',
    enabled: true,
    assignments: [{ id: 'a1', quantity: 2, allocationPercent: 100 }],
    expenses: []
  };
}

/** Veículo próprio completo, ligado à fase. */
function veiculoProprio(extras = {}) {
  return {
    id: 'l2',
    direction: 'mobilization',
    included: true,
    calculationMode: 'company_crew_vehicle',
    calculationModeConfirmed: true,
    contextId: 'f1',
    travelerAssignmentsConfirmed: true,
    travelerCountMode: 'manual',
    travelerAssignments: [{ assignmentId: 'a1', quantity: 2 }],
    passengersPerVehicle: 3,
    vehicleCountMode: 'automatic',
    distanceKmPerVehicle: 200,
    dailyDistanceLimitKm: 400,
    trips: 1,
    travelSaturdayDays: 0,
    travelSundayDays: 0,
    additionalCosts: [],
    ...extras
  };
}

// ---------------------------------------------------------------------------
// Dispensa
// ---------------------------------------------------------------------------

test('item não obrigatório nunca é dispensado', () => {
  assert.equal(transporteDispensado({ requiredSlot: false, slotType: 'crew' }, {}), false);
});

test('"sem mão de obra" dispensa o transporte de equipe', () => {
  // Não há quem transportar.
  const item = { requiredSlot: true, slotType: 'crew', direction: 'mobilization' };
  assert.equal(transporteDispensado(item, { noLabor: true }), true);
});

test('"equipe já na obra" dispensa a mobilização, e só ela', () => {
  const ida = { requiredSlot: true, slotType: 'crew', direction: 'mobilization' };
  const volta = { requiredSlot: true, slotType: 'crew', direction: 'demobilization' };
  const confirmacoes = { mobilizationCrewAlreadyOnSite: true };

  assert.equal(transporteDispensado(ida, confirmacoes), true);
  assert.equal(
    transporteDispensado(volta, confirmacoes),
    false,
    'estar na obra na ida não dispensa a volta'
  );
});

test('modo de cálculo confirmado VENCE a dispensa', () => {
  // Quem escolheu como calcular está dizendo que o deslocamento existe.
  const item = {
    requiredSlot: true,
    slotType: 'crew',
    direction: 'mobilization',
    calculationMode: 'company_crew_vehicle',
    calculationModeConfirmed: true
  };
  assert.equal(transporteDispensado(item, { mobilizationCrewAlreadyOnSite: true }), false);
});

// ---------------------------------------------------------------------------
// Item incompleto
// ---------------------------------------------------------------------------

test('item excluído nunca precisa de atenção', () => {
  assert.equal(itemPrecisaAtencao({ included: false, calculationMode: '' }), false);
});

test('sem modo de cálculo confirmado, o item pende', () => {
  assert.equal(itemPrecisaAtencao(freteExterno({ calculationModeConfirmed: false })), true);
  assert.equal(itemPrecisaAtencao(freteExterno({ calculationMode: '' })), true);
});

test('desmobilização com espelhamento pendente pende', () => {
  const item = freteExterno({
    direction: 'demobilization',
    requiredSlot: true,
    returnSetup: 'pending'
  });
  assert.equal(itemPrecisaAtencao(item), true);
});

test('frete externo exige quantidade, viagens E custo unitário', () => {
  assert.equal(itemPrecisaAtencao(freteExterno()), false, 'completo não pende');

  for (const campo of ['quantity', 'trips', 'unitCost']) {
    assert.equal(
      itemPrecisaAtencao(freteExterno({ [campo]: 0 })),
      true,
      `${campo} zerado tem de pender`
    );
  }
});

test('custo adicional incluído exige descrição, quantidade e valor', () => {
  const incompleto = freteExterno({
    additionalCosts: [{ included: true, description: '', quantity: 1, unitCost: 10 }]
  });
  assert.equal(itemPrecisaAtencao(incompleto), true);

  const excluido = freteExterno({
    additionalCosts: [{ included: false, description: '', quantity: 0, unitCost: 0 }]
  });
  assert.equal(
    itemPrecisaAtencao(excluido),
    false,
    'adicional excluído não é cobrado — como o material desmarcado'
  );
});

test('veículo próprio completo não pende', () => {
  assert.equal(itemPrecisaAtencao(veiculoProprio(), [faseComEquipe()]), false);
});

test('transporte de equipe sem vínculo com fase pende', () => {
  assert.equal(itemPrecisaAtencao(veiculoProprio({ contextId: '' }), [faseComEquipe()]), true);
});

test('fase desabilitada invalida o transporte ligado a ela', () => {
  const faseDesligada = { ...faseComEquipe(), enabled: false };
  assert.equal(itemPrecisaAtencao(veiculoProprio(), [faseDesligada]), true);
});

test('viajante além do que a alocação tem é seleção inválida', () => {
  // A fase tem 2 pessoas; mandar 5 viajarem não é possível.
  const demais = veiculoProprio({
    travelerAssignments: [{ assignmentId: 'a1', quantity: 5 }]
  });
  assert.equal(itemPrecisaAtencao(demais, [faseComEquipe()]), true);
});

test('viajante apontando para alocação inexistente é seleção inválida', () => {
  const fantasma = veiculoProprio({
    travelerAssignments: [{ assignmentId: 'nao-existe', quantity: 1 }]
  });
  assert.equal(itemPrecisaAtencao(fantasma, [faseComEquipe()]), true);
});

test('viajante fracionado é seleção inválida', () => {
  // Meia pessoa não viaja.
  const fracionado = veiculoProprio({
    travelerAssignments: [{ assignmentId: 'a1', quantity: 1.5 }]
  });
  assert.equal(itemPrecisaAtencao(fracionado, [faseComEquipe()]), true);
});

test('zero viajantes pende', () => {
  const ninguem = veiculoProprio({ travelerAssignments: [] });
  assert.equal(itemPrecisaAtencao(ninguem, [faseComEquipe()]), true);
});

test('veículo rodoviário exige distância por veículo', () => {
  const semDistancia = veiculoProprio({ distanceKmPerVehicle: 0 });
  assert.equal(itemPrecisaAtencao(semDistancia, [faseComEquipe()]), true);
});

test('capacidade menor que a equipe pende', () => {
  // 2 pessoas, 1 lugar por veículo, contagem automática de veículos: cabe.
  // Mas com veículo manual em 1, não cabe.
  const naoCabe = veiculoProprio({
    passengersPerVehicle: 1,
    vehicleCountMode: 'manual',
    vehicleCount: 1
  });
  assert.equal(itemPrecisaAtencao(naoCabe, [faseComEquipe()]), true);
});

test('passageiros por veículo fora do limite pende', () => {
  assert.equal(
    itemPrecisaAtencao(veiculoProprio({ passengersPerVehicle: 0 }), [faseComEquipe()]),
    true,
    'zero passageiros por veículo não faz sentido'
  );
  assert.equal(
    itemPrecisaAtencao(veiculoProprio({ passengersPerVehicle: 99 }), [faseComEquipe()]),
    true,
    'acima da capacidade do carro da empresa'
  );
});

test('fim de semana além dos dias de viagem pende', () => {
  // 200 km com limite de 400 km/dia e 1 viagem = 1 dia. Não cabem 3 dias de
  // fim de semana num deslocamento de um dia.
  const impossivel = veiculoProprio({ travelSaturdayDays: 2, travelSundayDays: 2 });
  assert.equal(itemPrecisaAtencao(impossivel, [faseComEquipe()]), true);
});

// ---------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------

test('um item sozinho no grupo nunca é contradição', () => {
  assert.equal(gruposPrecisamAtencao([veiculoProprio()], [faseComEquipe()]), false);
});

test('dois transportes automáticos na mesma direção e fase se contradizem', () => {
  // Cada um contaria a equipe inteira, e o custo sairia dobrado.
  const a = veiculoProprio({ id: 'l2', travelerCountMode: 'automatic' });
  const b = veiculoProprio({ id: 'l3', travelerCountMode: 'automatic' });
  assert.equal(gruposPrecisamAtencao([a, b], [faseComEquipe()]), true);
});

test('dois transportes manuais somando além da equipe se contradizem', () => {
  const a = veiculoProprio({
    id: 'l2',
    travelerAssignments: [{ assignmentId: 'a1', quantity: 2 }]
  });
  const b = veiculoProprio({
    id: 'l3',
    travelerAssignments: [{ assignmentId: 'a1', quantity: 1 }]
  });
  // A fase tem 2 pessoas; 2 + 1 = 3.
  assert.equal(gruposPrecisamAtencao([a, b], [faseComEquipe()]), true);
});

test('dois transportes manuais dentro do total NÃO se contradizem', () => {
  const a = veiculoProprio({
    id: 'l2',
    travelerAssignments: [{ assignmentId: 'a1', quantity: 1 }]
  });
  const b = veiculoProprio({
    id: 'l3',
    travelerAssignments: [{ assignmentId: 'a1', quantity: 1 }]
  });
  assert.equal(gruposPrecisamAtencao([a, b], [faseComEquipe()]), false);
});

test('direções diferentes não formam grupo', () => {
  const ida = veiculoProprio({ id: 'l2', travelerCountMode: 'automatic' });
  const volta = veiculoProprio({
    id: 'l3',
    direction: 'demobilization',
    travelerCountMode: 'automatic'
  });
  assert.equal(
    gruposPrecisamAtencao([ida, volta], [faseComEquipe()]),
    false,
    'ida e volta são deslocamentos distintos'
  );
});

// ---------------------------------------------------------------------------
// A pendência da seção
// ---------------------------------------------------------------------------

test('sem nenhum item incluído, a seção pende', () => {
  const draft = { logistics: [], logisticsDestinations: [], laborContexts: [] };
  assert.equal(faltaLogistica(draft), true);
});

test('a confirmação "sem logística" desliga a pendência', () => {
  const draft = {
    logistics: [],
    logisticsDestinations: [],
    laborContexts: [],
    scopeConfirmations: { noLogistics: true }
  };
  assert.equal(faltaLogistica(draft), false);
});

test('destino sem nome faz a seção pender', () => {
  const draft = {
    logistics: [freteExterno()],
    logisticsDestinations: [{ id: 'd1', name: '   ', oneWayDistanceKm: 100 }],
    laborContexts: []
  };
  assert.equal(faltaLogistica(draft), true);
});

test('destino sem distância com item obrigatório apontando faz pender', () => {
  const draft = {
    logistics: [freteExterno({ destinationId: 'd1', requiredSlot: true })],
    logisticsDestinations: [{ id: 'd1', name: 'Obra', oneWayDistanceKm: 0 }],
    laborContexts: []
  };
  assert.equal(faltaLogistica(draft), true);
});

test('slot obrigatório excluído sem dispensa faz pender', () => {
  const draft = {
    logistics: [
      freteExterno(),
      { id: 'l9', requiredSlot: true, included: false, slotType: 'equipment' }
    ],
    logisticsDestinations: [],
    laborContexts: []
  };
  assert.equal(faltaLogistica(draft), true);
});

test('slot obrigatório excluído COM dispensa não faz pender', () => {
  const draft = {
    logistics: [
      freteExterno(),
      {
        id: 'l9',
        requiredSlot: true,
        included: false,
        slotType: 'crew',
        direction: 'mobilization'
      }
    ],
    logisticsDestinations: [],
    laborContexts: [],
    scopeConfirmations: { mobilizationCrewAlreadyOnSite: true }
  };
  assert.equal(faltaLogistica(draft), false);
});

test('logística completa e simples não pende', () => {
  const draft = {
    logistics: [freteExterno()],
    logisticsDestinations: [{ id: 'd1', name: 'Obra', oneWayDistanceKm: 120 }],
    laborContexts: []
  };
  assert.equal(faltaLogistica(draft), false);
});
