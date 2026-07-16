import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRoleParamsResolver,
  computeCollaboratorCost,
  effectiveParameterSetAt,
  mergePontoPeriods,
  rdoDataByCollaboratorFromReports,
  serviceIntervalsWorkedMinutes,
  splitOvertime
} from '../src/lib/acompanhamento/labor-cost.js';

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

test('parâmetros de custo respeitam data de vigência do salário', () => {
  const sets = [
    { version: 1, effectiveDate: new Date('1970-01-01T00:00:00.000Z'), params: { salarioBase: 1000 } },
    { version: 2, effectiveDate: new Date('2026-07-10T00:00:00.000Z'), params: { salarioBase: 2000 } }
  ];
  assert.equal(effectiveParameterSetAt(sets, '2026-03-31').version, 1);
  assert.equal(effectiveParameterSetAt(sets, '2026-07-10').version, 2);

  const resolver = buildRoleParamsResolver({
    models: [
      {
        key: 'operador',
        parameterSets: [
          { version: 1, effectiveDate: new Date('1970-01-01T00:00:00.000Z'), params: { salarioBase: 1000, transferenciaPct: 0.3 } },
          { version: 2, effectiveDate: new Date('2026-07-15T00:00:00.000Z'), params: { salarioBase: 1200, transferenciaPct: 0.4 } }
        ]
      }
    ],
    roles: [
      {
        name: 'Operador',
        costProfile: {
          parameterSets: [
            { version: 1, effectiveDate: new Date('1970-01-01T00:00:00.000Z'), params: { baseModel: 'operador', salarioBase: 3000, insalubridade: 300 } },
            { version: 2, effectiveDate: new Date('2026-07-10T00:00:00.000Z'), params: { baseModel: 'operador', salarioBase: 4000, insalubridade: 300 } }
          ]
        }
      }
    ]
  });

  assert.equal(resolver.paramsFor('Operador', '2026-03-31').salarioBase, 3000);
  assert.equal(resolver.paramsFor('Operador', '2026-07-09').salarioBase, 3000);
  assert.equal(resolver.paramsFor('Operador', '2026-07-10').salarioBase, 4000);
  assert.equal(resolver.paramsFor('Operador', '2026-07-14').transferenciaPct, 0.3);
  assert.equal(resolver.paramsFor('Operador', '2026-07-15').transferenciaPct, 0.4);
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

test('planilhas de ponto são consolidadas sem somar dias repetidos', () => {
  const periods = mergePontoPeriods([
    {
      collaboratorId: 'col-1',
      rawName: 'João',
      normalizedName: 'joao',
      collaborator: { id: 'col-1', name: 'João', role: 'Operador' },
      import: { createdAt: '2026-07-13T10:00:00.000Z' },
      monthly: {
        '2026-01': {
          normalMinutes: 480,
          extrasMinutes: 30,
          nightMinutes: 0,
          workedDates: ['2026-01-01'],
          days: [{ date: '2026-01-01', workedMinutes: 480, extrasMinutes: 30, nightMinutes: 0 }]
        }
      },
      workedDates: ['2026-01-01'],
      workedMinutes: 480,
      he70Minutes: 30,
      he100Minutes: 0,
      nightMinutes: 0
    },
    {
      collaboratorId: 'col-1',
      rawName: 'João',
      normalizedName: 'joao',
      collaborator: { id: 'col-1', name: 'João', role: 'Operador' },
      import: { createdAt: '2026-07-13T11:00:00.000Z' },
      monthly: {
        '2026-01': {
          normalMinutes: 1140,
          extrasMinutes: 90,
          nightMinutes: 15,
          workedDates: ['2026-01-01', '2026-01-02'],
          days: [
            { date: '2026-01-01', workedMinutes: 600, extrasMinutes: 60, nightMinutes: 15 },
            { date: '2026-01-02', workedMinutes: 540, extrasMinutes: 30, nightMinutes: 0 }
          ]
        }
      },
      workedDates: ['2026-01-01', '2026-01-02'],
      workedMinutes: 1140,
      he70Minutes: 90,
      he100Minutes: 0,
      nightMinutes: 15
    },
    {
      collaboratorId: 'col-1',
      rawName: 'João',
      normalizedName: 'joao',
      collaborator: { id: 'col-1', name: 'João', role: 'Operador' },
      import: { createdAt: '2026-07-13T09:00:00.000Z' },
      monthly: {
        '2026-02': {
          normalMinutes: 480,
          extrasMinutes: 0,
          nightMinutes: 0,
          workedDates: ['2026-02-01'],
          days: [{ date: '2026-02-01', workedMinutes: 480, extrasMinutes: 0, nightMinutes: 0 }]
        }
      },
      workedDates: ['2026-02-01'],
      workedMinutes: 480,
      he70Minutes: 0,
      he100Minutes: 0,
      nightMinutes: 0
    }
  ]);

  assert.equal(periods.length, 1);
  const period = periods[0];
  assert.deepEqual(period.workedDates, ['2026-01-01', '2026-01-02', '2026-02-01']);
  assert.equal(period.workedMinutes, 600 + 540 + 480);
  assert.equal(period.monthly['2026-01'].normalMinutes, 1140);
  assert.equal(period.monthly['2026-01'].extrasMinutes, 90);
  assert.equal(period.monthly['2026-02'].normalMinutes, 480);
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

test('relatórios somente serviço derivam horas pela união dos intervalos', () => {
  assert.equal(serviceIntervalsWorkedMinutes([
    { startTime: '08:00', endTime: '12:00' },
    { startTime: '14:00', endTime: '16:00' }
  ]), 360);
  assert.equal(serviceIntervalsWorkedMinutes([
    { startTime: '08:00', endTime: '12:00' },
    { startTime: '10:00', endTime: '14:00' }
  ]), 360);
  assert.equal(serviceIntervalsWorkedMinutes([
    { startTime: '22:00', endTime: '02:00' }
  ]), 240);
  assert.equal(serviceIntervalsWorkedMinutes([
    { startTime: '08:00', endTime: null },
    { startTime: null, endTime: '12:00' }
  ]), 0);
});

test('dados de RDO incluem manuais e relatórios de serviço com horas sem dupla contagem', () => {
  const reports = [
    {
      projectId: 'projeto-rdo',
      reportType: 'RDO',
      reportDate: '2026-07-13T00:00:00.000Z',
      daytimeWorkedMinutes: 480,
      nighttimeWorkedMinutes: 0,
      project: { offshore: false, laborSleepModeByCollaborator: {} },
      collaborators: [{ collaboratorId: 'col-1' }],
      services: []
    },
    {
      projectId: 'projeto-servico',
      reportType: 'RTP',
      reportDate: '2026-07-13T00:00:00.000Z',
      daytimeWorkedMinutes: 0,
      nighttimeWorkedMinutes: 0,
      project: { offshore: false, laborSleepModeByCollaborator: {} },
      collaborators: [{ collaboratorId: 'col-1' }, { collaboratorId: 'col-2' }],
      services: [
        { startTime: '08:00', endTime: '12:00' },
        { startTime: '10:00', endTime: '14:00' }
      ]
    },
    {
      projectId: 'projeto-manual-rtp',
      reportType: 'RTP',
      reportDate: '2026-07-14T00:00:00.000Z',
      daytimeWorkedMinutes: 240,
      nighttimeWorkedMinutes: 0,
      project: { offshore: false, laborSleepModeByCollaborator: {} },
      collaborators: [{ collaboratorId: 'col-2' }],
      services: [
        { startTime: '08:00', endTime: '17:00' }
      ]
    },
    {
      projectId: 'projeto-sem-horas',
      reportType: 'RTP',
      reportDate: '2026-07-15T00:00:00.000Z',
      daytimeWorkedMinutes: 0,
      nighttimeWorkedMinutes: 0,
      project: { offshore: false, laborSleepModeByCollaborator: {} },
      collaborators: [{ collaboratorId: 'col-2' }],
      services: []
    },
    {
      projectId: 'projeto-rdo-zero',
      reportType: 'RDO',
      reportDate: '2026-07-16T00:00:00.000Z',
      daytimeWorkedMinutes: 0,
      nighttimeWorkedMinutes: 0,
      project: { offshore: false, laborSleepModeByCollaborator: {} },
      collaborators: [{ collaboratorId: 'col-3' }],
      services: [
        { startTime: '08:00', endTime: '17:00' }
      ]
    }
  ];

  const map = rdoDataByCollaboratorFromReports(reports);

  assert.equal(map.get('col-1').dayProject.get('2026-07-13').projectId, 'projeto-rdo');
  assert.equal(map.get('col-1').dayProject.get('2026-07-13').hours, 8);
  assert.equal(map.get('col-2').dayProject.get('2026-07-13').projectId, 'projeto-servico');
  assert.equal(map.get('col-2').dayProject.get('2026-07-13').hours, 6);
  assert.equal(map.get('col-2').dayProject.get('2026-07-14').projectId, 'projeto-manual-rtp');
  assert.equal(map.get('col-2').dayProject.get('2026-07-14').hours, 4);
  assert.equal(map.get('col-2').dayProject.has('2026-07-15'), false);
  assert.equal(map.get('col-3').dayProject.get('2026-07-16').projectId, 'projeto-rdo-zero');
  assert.equal(map.get('col-3').dayProject.get('2026-07-16').hours, 0);
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
