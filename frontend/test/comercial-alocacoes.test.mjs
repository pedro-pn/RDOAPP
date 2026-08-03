import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

/**
 * Alocações de mão de obra — a primeira vez que o app produz custo de verdade.
 *
 * Até este passo o levantamento calculava sempre zero, porque não havia como
 * alocar ninguém. O teste prova que alocar gera custo, e que o custo sai do
 * motor portado — não de conta feita na tela.
 */

let server;
let motor;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  motor = await server.ssrLoadModule('/../shared/comercial/dist/cost-model.js');
});

test.after(async () => {
  await server?.close();
});

function faseCompleta(alocacoes) {
  const base = motor.createDefaultCostEstimatePayload();
  const primeira = base.laborContexts[0];
  return {
    ...base,
    laborContexts: [
      {
        ...primeira,
        workCondition: 'headquarters',
        workConditionConfirmed: true,
        vehicleType: 'sedan',
        durationDays: 10,
        hoursPerDay: 8.8,
        assignments: alocacoes
      }
    ]
  };
}

function alocacao(cargo, extras = {}) {
  return {
    id: `a-${cargo}`,
    role: cargo,
    quantity: 1,
    monthlySalary: motor.roleSalary(cargo),
    adjustment: 0,
    allocationPercent: 100,
    shift: 'day',
    nightPremiumPercent: 35,
    ...extras
  };
}

test('os 8 cargos do LEC estão disponíveis, com salário oficial', () => {
  assert.equal(motor.LEC_LABOR_ROLES.length, 8);
  for (const cargo of motor.LEC_LABOR_ROLES) {
    assert.ok(cargo.role, 'todo cargo precisa de nome');
    assert.ok(cargo.salary > 0, `${cargo.role} sem salário`);
    assert.equal(
      motor.roleSalary(cargo.role),
      cargo.salary,
      `roleSalary discorda do catálogo em ${cargo.role}`
    );
  }
});

test('alocar gente produz custo — antes disso o levantamento era sempre zero', () => {
  const cargo = motor.LEC_LABOR_ROLES[2].role;

  const semNinguem = motor.calculateEstimate(faseCompleta([]));
  const comUm = motor.calculateEstimate(faseCompleta([alocacao(cargo)]));

  assert.equal(Number(semNinguem.totalLaborHours), 0, 'sem alocação não há HH');
  assert.ok(Number(comUm.totalLaborHours) > 0, 'alocar tem de gerar HH');
  assert.ok(Number(comUm.laborCost) > 0, 'alocar tem de gerar custo');
});

test('dobrar as pessoas dobra as horas', () => {
  const cargo = motor.LEC_LABOR_ROLES[2].role;

  const um = motor.calculateEstimate(faseCompleta([alocacao(cargo, { quantity: 1 })]));
  const dois = motor.calculateEstimate(faseCompleta([alocacao(cargo, { quantity: 2 })]));

  assert.equal(
    Number(dois.totalLaborHours),
    Number(um.totalLaborHours) * 2,
    'duas pessoas na mesma fase trabalham o dobro de HH'
  );
});

test('turno noturno custa mais que diurno, com as mesmas horas', () => {
  // Adicional noturno de 35% do LEC. As horas não mudam — o custo, sim.
  const cargo = motor.LEC_LABOR_ROLES[2].role;

  const diurno = motor.calculateEstimate(faseCompleta([alocacao(cargo, { shift: 'day' })]));
  const noturno = motor.calculateEstimate(
    faseCompleta([alocacao(cargo, { shift: 'night' })])
  );

  assert.equal(
    Number(noturno.totalLaborHours),
    Number(diurno.totalLaborHours),
    'o turno não muda a quantidade de horas'
  );
  assert.ok(
    Number(noturno.laborCost) > Number(diurno.laborCost),
    'o adicional noturno tem de aparecer no custo'
  );
});

test('cargo mais caro produz custo maior com as mesmas horas', () => {
  const barato = motor.LEC_LABOR_ROLES.reduce((a, b) => (a.salary <= b.salary ? a : b));
  const caro = motor.LEC_LABOR_ROLES.reduce((a, b) => (a.salary >= b.salary ? a : b));

  const comBarato = motor.calculateEstimate(faseCompleta([alocacao(barato.role)]));
  const comCaro = motor.calculateEstimate(faseCompleta([alocacao(caro.role)]));

  assert.ok(Number(comCaro.laborCost) > Number(comBarato.laborCost));
});

test('trocar de cargo sem repor o salário produziria custo errado', () => {
  // É por isso que a tela repõe `roleSalary` ao trocar o cargo. Este teste
  // mostra o tamanho do estrago: o cargo muda, o salário do anterior fica, e
  // o resultado é plausível — ninguém percebe.
  const barato = motor.LEC_LABOR_ROLES.reduce((a, b) => (a.salary <= b.salary ? a : b));
  const caro = motor.LEC_LABOR_ROLES.reduce((a, b) => (a.salary >= b.salary ? a : b));

  const correto = motor.calculateEstimate(faseCompleta([alocacao(caro.role)]));
  const comSalarioAntigo = motor.calculateEstimate(
    faseCompleta([alocacao(caro.role, { monthlySalary: barato.salary })])
  );

  assert.notEqual(
    Number(correto.laborCost),
    Number(comSalarioAntigo.laborCost),
    'o salário influencia o custo — repor ao trocar de cargo não é cosmético'
  );
});

test('a alocação parcial reduz o custo proporcionalmente', () => {
  const cargo = motor.LEC_LABOR_ROLES[2].role;

  const inteiro = motor.calculateEstimate(
    faseCompleta([alocacao(cargo, { allocationPercent: 100 })])
  );
  const metade = motor.calculateEstimate(
    faseCompleta([alocacao(cargo, { allocationPercent: 50 })])
  );

  assert.ok(
    Number(metade.laborCost) < Number(inteiro.laborCost),
    'meia alocação tem de custar menos que uma inteira'
  );
});

test('alocar destrava o preço de venda', () => {
  // O rodapé só habilita salvar com precificação válida e preço > 0. Sem
  // ninguém alocado, não há o que precificar.
  const cargo = motor.LEC_LABOR_ROLES[2].role;
  const comEquipe = motor.calculateEstimate(faseCompleta([alocacao(cargo)]));

  assert.ok(Number(comEquipe.salePrice) > 0, 'com equipe alocada tem de haver preço');
  assert.equal(comEquipe.validPricing, true);
});
