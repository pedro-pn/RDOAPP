import assert from 'node:assert/strict';
import test from 'node:test';

import { computeCollaboratorCost, splitOvertime } from '../src/lib/acompanhamento/labor-cost.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

const PARAMS = {
  salarioBase: 3080.33, insalubridade: 324.2, cargaHoraria: 220, diasUteis: 22,
  periculosidadePct: 0.3, produtividadePct: 0.15, transferenciaPct: 0.3,
  he70Pct: 0.7, he100Pct: 1, fgtsPct: 0.08, inssPatronalPct: 0.1, multaPct: 0.4,
  beneficios: { planoSaude: 800, valeAlimentacao: 600, odonto: 16, seguroVida: 50, cursos: 300 }
};

function sedeMaisFolga(idle) {
  return idle.sede.cost + idle.folga.cost;
}

test('teto de HE70 (30h): excesso vira 100%', () => {
  const a = splitOvertime(38.01, 30);
  assert.ok(near(a.he70Horas, 30) && near(a.he100Horas, 8.01));
  const b = splitOvertime(25, 30);
  assert.ok(near(b.he70Horas, 25) && near(b.he100Horas, 0));
  const c = splitOvertime(0, 30);
  assert.ok(near(c.he70Horas, 0) && near(c.he100Horas, 0));
});

test('prova real: Σ projetos + sede + folga = folha', () => {
  const r = computeCollaboratorCost({
    params: PARAMS, epiMensal: 5000 / 12,
    normalHours: 176, he70Horas: 20, he100Horas: 4, folgaHours: 8.8 * 3,
    projects: [
      { pid: 'A', rdoDaysHours: 88, awayDaysHours: 88, rdoWorkedHours: 90, offshore: false },
      { pid: 'B', rdoDaysHours: 44, awayDaysHours: 44, rdoWorkedHours: 45, offshore: false }
    ]
  });
  const somaProjetos = Object.values(r.byProject).reduce((s, p) => s + p.cost, 0);
  assert.ok(near(somaProjetos + sedeMaisFolga(r.idle), r.folha), 'Σ projetos + sede + folga = folha');
  assert.ok(near(r.idle.folga.hours, 8.8 * 3), 'folga = horas de folga informadas');
  assert.ok(r.idle.sede.hours > 0, 'sede = normais não alocadas (44h sem projeto)');
});

test('mês parcial: fixo proporcional à cobertura', () => {
  const base = {
    params: PARAMS, epiMensal: 0, normalHours: 44, he70Horas: 0, he100Horas: 0, folgaHours: 0,
    projects: [{ pid: 'A', rdoDaysHours: 44, awayDaysHours: 44, rdoWorkedHours: 44, offshore: false }]
  };
  const cheio = computeCollaboratorCost({ ...base, fixedCoverage: 1 });
  const parcial = computeCollaboratorCost({ ...base, fixedCoverage: 7 / 31 });
  // O fixo (base do motor) cai proporcional; o variável (dias reais) não muda.
  assert.ok(near(parcial.fixoMensal, cheio.fixoMensal * (7 / 31)));
  assert.ok(near(parcial.variavelMensal, cheio.variavelMensal));
  assert.ok(parcial.folha < cheio.folha);
});

test('sem projeto: tudo vira sobra (sede/folga) e fecha a folha', () => {
  const r = computeCollaboratorCost({
    params: PARAMS, epiMensal: 0, normalHours: 88, he70Horas: 0, he100Horas: 0, folgaHours: 8.8 * 2,
    projects: []
  });
  assert.equal(Object.keys(r.byProject).length, 0);
  assert.ok(near(sedeMaisFolga(r.idle), r.folha));
  assert.ok(near(r.idle.folga.hours, 8.8 * 2));
});

test('ponto sem RDO não gera gratificação nem outras verbas variáveis', () => {
  const noRdo = computeCollaboratorCost({
    params: PARAMS, epiMensal: 0, normalHours: 88, he70Horas: 0, he100Horas: 0, folgaHours: 0,
    projects: []
  });
  const noHours = computeCollaboratorCost({
    params: PARAMS, epiMensal: 0, normalHours: 0, he70Horas: 0, he100Horas: 0, folgaHours: 0,
    projects: []
  });
  assert.ok(near(noRdo.folha, noHours.folha));
  assert.ok(near(noRdo.variavelMensal, 0));
});

test('RDO não-offshore usa hospedagem manual: fora = transferência, casa = gratificação', () => {
  const away = computeCollaboratorCost({
    params: PARAMS, epiMensal: 0, normalHours: 44, he70Horas: 0, he100Horas: 0, folgaHours: 0,
    projects: [{ pid: 'A', rdoDaysHours: 44, awayDaysHours: 44, rdoWorkedHours: 44, offshore: false }]
  });
  const home = computeCollaboratorCost({
    params: PARAMS, epiMensal: 0, normalHours: 44, he70Horas: 0, he100Horas: 0, folgaHours: 0,
    projects: [{ pid: 'A', rdoDaysHours: 44, homeDaysHours: 44, rdoWorkedHours: 44, offshore: false }]
  });
  assert.notEqual(home.folha, away.folha);
  assert.notEqual(home.variavelMensal, away.variavelMensal);
});
