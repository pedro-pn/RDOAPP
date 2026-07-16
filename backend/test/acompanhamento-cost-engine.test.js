import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeMonthlyCost } from '../src/lib/acompanhamento/cost-engine.js';

const OPERADOR_PARAMS = {
  salarioBase: 3080.33,
  salarioMinimo: 1621,
  cargaHoraria: 220,
  diasUteis: 22,
  insalubridade: 324.2,
  periculosidadePct: 0.3,
  produtividadePct: 0.15,
  transferenciaPct: 0.3,
  he70Pct: 0.7,
  he100Pct: 1,
  fgtsPct: 0.08,
  beneficios: { planoSaude: 800, valeAlimentacao: 600, odonto: 16, seguroVida: 50, cursos: 300 }
};

const OPERADOR_INPUTS = { diasCliente: 22, diasFora: 1, diasCasa: 22, he70Horas: 1, he100Horas: 1 };

test('motor reproduz as verbas do Simulador (operador) da planilha', () => {
  const r = computeMonthlyCost(OPERADOR_PARAMS, OPERADOR_INPUTS);
  const close = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `esperado ~${b}, obtido ${a}`);
  close(r.periculosidade, 677.6726);
  close(r.produtividade, 476.14919);
  close(r.transferencia, 34.0453);
  close(r.valorHora, 20.874532);
  close(r.he70, 35.486705);
  close(r.he100, 41.749064);
  close(r.dsr, 14.042867);
  close(r.remuneracaoBruta, 4683.675726);
  close(r.encargos, 374.694058);
  close(r.provisoes, 983.571903);
  close(r.beneficios, 1766);
  close(r.passivoRescisorio, 537.472977);
  close(r.totalMensal, 8345.414664);
  close(r.custoHora220, 37.933703);
});

test('zerar inputs deixa só fixos + FGTS + provisões + benefícios + passivo', () => {
  const r = computeMonthlyCost(OPERADOR_PARAMS, { diasCliente: 0, diasFora: 0, diasCasa: 0, he70Horas: 0, he100Horas: 0 });
  // bruta = base + insalub = 3404.53
  assert.ok(Math.abs(r.remuneracaoBruta - 3404.53) < 0.01);
  assert.ok(r.totalMensal > r.remuneracaoBruta);
});

test('motor ignora campos legados de INSS patronal e multa rescisória', () => {
  const current = computeMonthlyCost(OPERADOR_PARAMS, OPERADOR_INPUTS);
  const legacy = computeMonthlyCost({ ...OPERADOR_PARAMS, inssPatronalPct: 0.99, multaPct: 0.99 }, OPERADOR_INPUTS);

  assert.equal(legacy.inssPatronal, 0);
  assert.equal(legacy.totalMensal, current.totalMensal);
});

test('auxiliar usa gratificação 5% e viagem 10% no mesmo motor', () => {
  const aux = { ...OPERADOR_PARAMS, salarioBase: 2290.47, produtividadePct: 0.05, transferenciaPct: 0.1 };
  const r = computeMonthlyCost(aux, OPERADOR_INPUTS);
  assert.ok(r.totalMensal > 0);
  // produtividade do auxiliar é menor que a do operador (5% vs 15%)
  const op = computeMonthlyCost(OPERADOR_PARAMS, OPERADOR_INPUTS);
  assert.ok(r.produtividade < op.produtividade);
});

test('dias offshore geram transferência com bônus em pontos percentuais', () => {
  const inputs = { diasCliente: 30, diasFora: 0, diasCasa: 0, he70Horas: 0, he100Horas: 0 };
  const base = computeMonthlyCost(OPERADOR_PARAMS, inputs);
  assert.equal(base.transferencia, 0); // sem dias fora nem offshore
  const off = computeMonthlyCost(OPERADOR_PARAMS, { ...inputs, offshoreDays: 5, offshoreBonusPct: 0.1 });
  // (salarioBase + insalubridade)/30 * 5 * (0.3 + 0.1)
  const esperado = ((3080.33 + 324.2) / 30) * 5 * 0.4;
  assert.ok(Math.abs(off.transferencia - esperado) < 0.01);
  assert.ok(off.totalMensal > base.totalMensal); // cascata em bruta/HE/encargos
});

test('offshoreDays sem bônus equivale a dias fora normais', () => {
  const inputs = { diasCliente: 30, he70Horas: 0, he100Horas: 0 };
  const fora = computeMonthlyCost(OPERADOR_PARAMS, { ...inputs, diasFora: 5, offshoreDays: 0, offshoreBonusPct: 0 });
  const off = computeMonthlyCost(OPERADOR_PARAMS, { ...inputs, diasFora: 0, offshoreDays: 5, offshoreBonusPct: 0 });
  assert.ok(Math.abs(fora.transferencia - off.transferencia) < 0.0001);
});
