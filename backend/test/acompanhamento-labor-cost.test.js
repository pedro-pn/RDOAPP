import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDailyProjectWeights,
  buildMissionGroupProjectIndex,
  buildRoleParamsResolver,
  classifyProjectHours,
  computeAnalyticalProjectCosts,
  computeCollaboratorCost,
  examsTrainingAnnualCostForMonth,
  effectiveParameterSetAt,
  filterIgnoredPontoPeriods,
  mergePontoPeriods,
  offshoreYearsByCollaboratorFromReports,
  rdoDataByCollaboratorFromReports,
  serviceIntervalsWorkedMinutes,
  isPontoTravelTag,
  splitOvertime,
  splitOvertimeDays
} from '../src/lib/acompanhamento/labor-cost.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

const PARAMS = {
  salarioBase: 4086.57, salarioMinimo: 1621, insalubridade: 324.2, cargaHoraria: 220, diasUteis: 22,
  periculosidadePct: 0.3, produtividadePct: 0.15, transferenciaPct: 0.3,
  confinamentoPct: 0.4, he70Pct: 0.7, he100Pct: 1, fgtsPct: 0.08, multaPct: 0.5,
  beneficios: { seguroVida: 50, valeAlimentacao: 600, planoSaude: 500, odonto: 18, cursos: 300, moradia: 1000 }
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

test('HE genérica usa o teto mensal sem reclassificar percentuais explícitos', () => {
  const days = splitOvertimeDays([
    { date: '2026-08-01', genericOvertimeHoras: 29, he70Horas: 2, he100Horas: 1, explicitOvertime: true },
    { date: '2026-08-02', genericOvertimeHoras: 4, he70Horas: 0, he100Horas: 3, explicitOvertime: true }
  ], 30);

  assert.deepEqual(days.map(day => ({ he70: day.he70Horas, he100: day.he100Horas })), [
    { he70: 31, he100: 1 },
    { he70: 1, he100: 6 }
  ]);
  assert.equal(days.reduce((sum, day) => sum + day.he70Horas + day.he100Horas, 0), 39);
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

test('exames e treinamentos entram como custo fixo mensal igual ao EPI', () => {
  const base = {
    params: PARAMS, epiMensal: 0, normalHours: 176, he70Horas: 0, he100Horas: 0, folgaHours: 0,
    projects: []
  };
  const withoutCost = computeCollaboratorCost(base);
  const withCost = computeCollaboratorCost({ ...base, examsTrainingMensal: 1200 / 12 });
  const partial = computeCollaboratorCost({ ...base, examsTrainingMensal: 1200 / 12, fixedCoverage: 0.5 });

  assert.ok(near(withCost.folha - withoutCost.folha, 100));
  assert.ok(near(partial.folha - computeCollaboratorCost({ ...base, fixedCoverage: 0.5 }).folha, 50));
});

test('exames e treinamentos usam valor offshore quando colaborador teve offshore no ano', () => {
  const offshoreYears = offshoreYearsByCollaboratorFromReports([
    {
      reportDate: '2026-03-10T00:00:00.000Z',
      project: { offshore: true },
      collaborators: [{ collaboratorId: 'col-1' }]
    },
    {
      reportDate: '2026-04-10T00:00:00.000Z',
      project: { offshore: false },
      collaborators: [{ collaboratorId: 'col-2' }]
    },
    {
      reportDate: '2025-12-10T00:00:00.000Z',
      project: { offshore: true },
      collaborators: [{ collaboratorId: 'col-3' }]
    }
  ]);

  const params = {
    offshoreYearsByCollaborator: offshoreYears,
    examsTrainingAnnualCost: 1200,
    offshoreExamsTrainingAnnualCost: 3600
  };
  assert.equal(examsTrainingAnnualCostForMonth({ ...params, collaboratorId: 'col-1', monthKey: '2026-07' }), 3600);
  assert.equal(examsTrainingAnnualCostForMonth({ ...params, collaboratorId: 'col-2', monthKey: '2026-07' }), 1200);
  assert.equal(examsTrainingAnnualCostForMonth({ ...params, collaboratorId: 'col-3', monthKey: '2026-07' }), 1200);
  assert.equal(examsTrainingAnnualCostForMonth({ ...params, collaboratorId: 'col-3', monthKey: '2025-12' }), 3600);
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

test('períodos históricos de colaboradores externos ignorados não entram no custo vigente', () => {
  const periods = [
    { externalEmployeeId: 'operacao-1', workedMinutes: 480 },
    { externalEmployeeId: 'administrativo-1', workedMinutes: 480 },
    { externalEmployeeId: null, workedMinutes: 480 }
  ];

  assert.deepEqual(
    filterIgnoredPontoPeriods(periods, ['administrativo-1']),
    [periods[0], periods[2]]
  );
});

test('snapshot v2 preserva HE explícita e etiquetas por dia', () => {
  const [period] = mergePontoPeriods([{
    collaboratorId: 'col-v2',
    rawName: 'Colaborador Teste',
    normalizedName: 'colaborador teste',
    import: { createdAt: '2026-08-14T10:00:00.000Z' },
    monthly: {
      schemaVersion: 2,
      months: {
        '2026-08': {
          days: [{
            date: '2026-08-03',
            workedMinutes: 480,
            he70Minutes: 70,
            he100Minutes: 100,
            nightMinutes: 30,
            tags: ['Missão 5745', 'Missão 5752', 'Missão 5745']
          }]
        }
      }
    }
  }]);

  assert.equal(period.workedMinutes, 480);
  assert.equal(period.he70Minutes, 70);
  assert.equal(period.he100Minutes, 100);
  assert.equal(period.nightMinutes, 30);
  assert.equal(period.monthly.schemaVersion, 2);
  assert.deepEqual(period.monthly.months['2026-08'].days[0].tags, ['Missão 5745', 'Missão 5752']);
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

  assert.equal(map.get('col-1').dayProjects.get('2026-07-13').get('projeto-rdo').hours, 8);
  assert.equal(map.get('col-1').dayProjects.get('2026-07-13').get('projeto-servico').hours, 6);
  assert.equal(map.get('col-2').dayProjects.get('2026-07-13').get('projeto-servico').hours, 6);
  assert.equal(map.get('col-2').dayProjects.get('2026-07-14').get('projeto-manual-rtp').hours, 4);
  assert.equal(map.get('col-2').dayProjects.has('2026-07-15'), false);
  assert.equal(map.get('col-3').dayProjects.get('2026-07-16').get('projeto-rdo-zero').hours, 0);
});

test('RDO posterior nominal confirma o projeto na data exata de mobilização', () => {
  const reports = [
    {
      projectId: 'projeto-a',
      reportType: 'RDO',
      reportDate: '2026-07-18T00:00:00.000Z',
      daytimeWorkedMinutes: 480,
      nighttimeWorkedMinutes: 0,
      project: {
        offshore: false,
        laborSleepModeByCollaborator: {},
        mobilizationDate: '2026-07-16T00:00:00.000Z'
      },
      collaborators: [{ collaboratorId: 'col-1' }],
      services: []
    },
    {
      projectId: 'projeto-mesmo-dia',
      reportType: 'RDO',
      reportDate: '2026-07-16T00:00:00.000Z',
      daytimeWorkedMinutes: 480,
      nighttimeWorkedMinutes: 0,
      project: {
        offshore: false,
        laborSleepModeByCollaborator: {},
        mobilizationDate: '2026-07-16T00:00:00.000Z'
      },
      collaborators: [{ collaboratorId: 'col-1' }],
      services: []
    },
    {
      projectId: 'projeto-rtp',
      reportType: 'RTP',
      reportDate: '2026-07-18T00:00:00.000Z',
      daytimeWorkedMinutes: 480,
      nighttimeWorkedMinutes: 0,
      project: {
        offshore: false,
        laborSleepModeByCollaborator: {},
        mobilizationDate: '2026-07-16T00:00:00.000Z'
      },
      collaborators: [{ collaboratorId: 'col-1' }],
      services: []
    }
  ];

  const evidence = rdoDataByCollaboratorFromReports(reports)
    .get('col-1').mobilizationProjectsByDate.get('2026-07-16');

  assert.deepEqual([...evidence].sort(), ['projeto-a']);
});

const resolveTestTag = tag => ({
  'Missão A': 'A',
  'Missão B': 'B',
  'Missão C': 'C'
})[tag] || null;

function dailyRdo(entries) {
  return new Map(entries.map(([projectId, hours]) => [projectId, {
    projectId,
    hours,
    offshore: false,
    sleepMode: 'AWAY'
  }]));
}

test('precedência de pesos diários cobre etiqueta única, interseção e fallback de RDO', () => {
  const oneTag = buildDailyProjectWeights({
    tags: ['Missão A'],
    rdoProjects: new Map(),
    resolveTag: resolveTestTag
  });
  assert.deepEqual(oneTag.allocations.map(item => [item.projectId, item.weight]), [['A', 1]]);

  const soleDivergentRdo = buildDailyProjectWeights({
    tags: ['Missão A'],
    rdoProjects: dailyRdo([['B', 8]]),
    resolveTag: resolveTestTag
  });
  assert.deepEqual(soleDivergentRdo.allocations.map(item => [item.projectId, item.weight]), [['B', 1]]);
  assert.equal(soleDivergentRdo.reason, 'SINGLE_RDO_OVERRIDES_TAG');

  const conflictingTag = buildDailyProjectWeights({
    tags: ['Missão A'],
    rdoProjects: dailyRdo([['B', 8], ['C', 4]]),
    resolveTag: resolveTestTag
  });
  assert.deepEqual(conflictingTag.allocations, []);
  assert.equal(conflictingTag.reason, 'TAG_RDO_CONFLICT');

  const manual = buildDailyProjectWeights({
    tags: ['Missão A'],
    rdoProjects: dailyRdo([['B', 8], ['C', 4]]),
    resolveTag: resolveTestTag,
    manualProjectId: 'B'
  });
  assert.deepEqual(manual.allocations.map(item => [item.projectId, item.weight]), [['B', 1]]);
  assert.equal(manual.reason, 'MANUAL_OVERRIDE');

  const oneConfirmed = buildDailyProjectWeights({
    tags: ['Missão A', 'Missão B'],
    rdoProjects: dailyRdo([['B', 8], ['C', 4]]),
    resolveTag: resolveTestTag
  });
  assert.deepEqual(oneConfirmed.allocations.map(item => [item.projectId, item.weight]), [['B', 1]]);

  const oneRdoFallback = buildDailyProjectWeights({
    tags: [],
    rdoProjects: dailyRdo([['C', 7]]),
    resolveTag: resolveTestTag
  });
  assert.deepEqual(oneRdoFallback.allocations.map(item => [item.projectId, item.weight]), [['C', 1]]);

  const ambiguousWithoutTags = buildDailyProjectWeights({
    tags: [],
    rdoProjects: dailyRdo([['A', 8], ['B', 4]]),
    resolveTag: resolveTestTag
  });
  assert.deepEqual(ambiguousWithoutTags.allocations, []);
  assert.equal(ambiguousWithoutTags.reason, 'AMBIGUOUS_WITHOUT_TAGS');
});

test('grupo de missões só resolve o dia quando resta um único RDO membro', () => {
  const missionGroups = buildMissionGroupProjectIndex([{
    id: 'group-detroit',
    members: [
      { projectId: 'A' },
      { projectId: 'B' },
      { projectId: 'D' }
    ]
  }]);

  const uniqueGroupedRdo = buildDailyProjectWeights({
    tags: ['Missão A'],
    rdoProjects: dailyRdo([['B', 8], ['C', 4]]),
    resolveTag: resolveTestTag,
    missionGroupProjectsByProjectId: missionGroups
  });
  assert.deepEqual(uniqueGroupedRdo.allocations.map(item => [item.projectId, item.weight]), [['B', 1]]);
  assert.equal(uniqueGroupedRdo.reason, 'MERGED_GROUP_SINGLE_RDO_FALLBACK');

  const twoGroupedRdos = buildDailyProjectWeights({
    tags: ['Missão A'],
    rdoProjects: dailyRdo([['B', 8], ['D', 4]]),
    resolveTag: resolveTestTag,
    missionGroupProjectsByProjectId: missionGroups
  });
  assert.deepEqual(twoGroupedRdos.allocations, []);
  assert.equal(twoGroupedRdos.reason, 'TAG_RDO_CONFLICT');

  const normalRuleKeepsPrecedence = buildDailyProjectWeights({
    tags: ['Missão A'],
    rdoProjects: dailyRdo([['A', 8], ['B', 4]]),
    resolveTag: resolveTestTag,
    missionGroupProjectsByProjectId: missionGroups
  });
  assert.deepEqual(normalRuleKeepsPrecedence.allocations.map(item => [item.projectId, item.weight]), [['A', 1]]);
  assert.equal(normalRuleKeepsPrecedence.reason, 'SINGLE_TAG');

  const withoutPointTag = buildDailyProjectWeights({
    tags: [],
    rdoProjects: dailyRdo([['B', 8], ['C', 4]]),
    resolveTag: resolveTestTag,
    missionGroupProjectsByProjectId: missionGroups
  });
  assert.deepEqual(withoutPointTag.allocations, []);
  assert.equal(withoutPointTag.reason, 'AMBIGUOUS_WITHOUT_TAGS');
});

test('fallback de missão mesclada conserva normal e horas extras do ponto', () => {
  const missionGroups = buildMissionGroupProjectIndex([{
    id: 'group-detroit',
    members: [{ projectId: 'A' }, { projectId: 'B' }]
  }]);
  const classified = classifyProjectHours([{
    date: '2026-08-05',
    normalHours: 8,
    he70Horas: 1.5,
    he100Horas: 0.5,
    tags: ['Missão A']
  }], {
    byProject: new Map(),
    dayProjects: new Map([['2026-08-05', dailyRdo([['B', 8], ['C', 4]])]])
  }, resolveTestTag, new Map(), new Map(), missionGroups);

  assert.deepEqual(classified.unresolvedDays, []);
  assert.equal(classified.byProject.size, 1);
  assert.ok(near(classified.byProject.get('B').normalHours, 8));
  assert.ok(near(classified.byProject.get('B').he70Hours, 1.5));
  assert.ok(near(classified.byProject.get('B').he100Hours, 0.5));
  assert.ok(near(
    [...classified.byProject.values()].reduce((sum, item) => (
      sum + item.normalHours + item.he70Hours + item.he100Hours
    ), 0),
    10
  ));
});

test('dois projetos confirmados usam todas as horas de RDO somente como pesos normalizados', () => {
  const unequal = buildDailyProjectWeights({
    tags: ['Missão A', 'Missão B'],
    rdoProjects: dailyRdo([['A', 8], ['B', 4]]),
    resolveTag: resolveTestTag
  });
  assert.ok(near(unequal.allocations[0].weight, 2 / 3));
  assert.ok(near(unequal.allocations[1].weight, 1 / 3));

  const equal = buildDailyProjectWeights({
    tags: ['Missão A', 'Missão B'],
    rdoProjects: dailyRdo([['A', 8], ['B', 8]]),
    resolveTag: resolveTestTag
  });
  assert.deepEqual(equal.allocations.map(item => item.weight), [0.5, 0.5]);
});

test('alocação diária aplica o mesmo peso ao normal, HE70 e HE100 sem criar horas', () => {
  const rdo = {
    byProject: new Map(),
    dayProjects: new Map([['2026-08-03', dailyRdo([['A', 8], ['B', 4]])]])
  };
  const result = classifyProjectHours([{
    date: '2026-08-03',
    normalHours: 8,
    he70Horas: 1.5,
    he100Horas: 0.5,
    tags: ['Missão A', 'Missão B']
  }], rdo, resolveTestTag, new Map());

  assert.ok(near(result.byProject.get('A').normalHours, 16 / 3));
  assert.ok(near(result.byProject.get('B').normalHours, 8 / 3));
  assert.ok(near(result.byProject.get('A').he70Hours, 1));
  assert.ok(near(result.byProject.get('B').he70Hours, 0.5));
  assert.ok(near(result.byProject.get('A').he100Hours, 1 / 3));
  assert.ok(near(result.byProject.get('B').he100Hours, 1 / 6));
  assert.ok(near([...result.byProject.values()].reduce((sum, item) => sum + item.normalHours, 0), 8));
  assert.ok(near([...result.byProject.values()].reduce((sum, item) => sum + item.he70Hours, 0), 1.5));
  assert.ok(near([...result.byProject.values()].reduce((sum, item) => sum + item.he100Hours, 0), 0.5));

  const soleRdoOverride = classifyProjectHours([{
    date: '2026-08-04',
    normalHours: 8,
    he70Horas: 1.5,
    he100Horas: 0.5,
    tags: ['Missão A']
  }], {
    byProject: new Map(),
    dayProjects: new Map([['2026-08-04', dailyRdo([['B', 8]])]])
  }, resolveTestTag, new Map());

  assert.equal(soleRdoOverride.byProject.has('A'), false);
  assert.deepEqual(soleRdoOverride.unresolvedDays, []);
  assert.ok(near(soleRdoOverride.byProject.get('B').normalHours, 8));
  assert.ok(near(soleRdoOverride.byProject.get('B').he70Hours, 1.5));
  assert.ok(near(soleRdoOverride.byProject.get('B').he100Hours, 0.5));
});

test('custos explícitos por projeto fecham exatamente em centavos sem duplicar o mensal', () => {
  const r = computeCollaboratorCost({
    params: PARAMS,
    epiMensal: 5000 / 12,
    normalHours: 8,
    he70Horas: 1.5,
    he100Horas: 0.5,
    folgaHours: 8.8,
    projects: [
      { pid: 'A', rdoDaysHours: 16 / 3, awayDaysHours: 16 / 3, rdoWorkedHours: 8, he70Hours: 1, he100Hours: 1 / 3 },
      { pid: 'B', rdoDaysHours: 8 / 3, awayDaysHours: 8 / 3, rdoWorkedHours: 4, he70Hours: 0.5, he100Hours: 1 / 6 }
    ]
  });
  const projectCents = Object.values(r.byProject).reduce((sum, item) => sum + Math.round(item.cost * 100), 0);
  const idleCents = Math.round(r.idle.sede.cost * 100) + Math.round(r.idle.folga.cost * 100);
  const projectBaseCents = Object.values(r.byProject).reduce((sum, item) => sum + Math.round(item.costBase * 100), 0);
  const idleBaseCents = Math.round(r.idle.sede.costBase * 100) + Math.round(r.idle.folga.costBase * 100);

  assert.equal(projectCents + idleCents, Math.round(r.folha * 100));
  assert.equal(projectBaseCents + idleBaseCents, Math.round(r.folhaBase * 100));
  assert.ok(Object.values(r.byProject).every(item => item.cost >= 0 && item.costBase >= 0));
  assert.ok(r.idle.sede.cost >= 0 && r.idle.folga.cost >= 0);
  assert.ok(Object.values(r.byProject).reduce((sum, item) => sum + item.hours, 0) <= r.totalHours);
});

test('execução compartilhada conserva a folha e replica integralmente a apropriação analítica', () => {
  const missionGroups = buildMissionGroupProjectIndex([{
    id: 'group-uhe',
    laborAllocationMode: 'SHARED_EXECUTION',
    primaryLaborProjectId: null,
    members: [{ projectId: 'A' }, { projectId: 'B' }, { projectId: 'D' }]
  }]);
  const input = {
    tags: ['EM VIAGEM - cliente'],
    rdoProjects: dailyRdo([['A', 9], ['B', 9]]),
    resolveTag: resolveTestTag,
    missionGroupProjectsByProjectId: missionGroups
  };

  const accounting = buildDailyProjectWeights(input);
  const analytical = buildDailyProjectWeights({ ...input, allocationAxis: 'ANALYTICAL' });
  assert.deepEqual(accounting.allocations.map(item => [item.projectId, item.weight]), [['A', 0.5], ['B', 0.5]]);
  assert.equal(accounting.reason, 'SHARED_EXECUTION_ACCOUNTING');
  assert.deepEqual(analytical.allocations.map(item => [item.projectId, item.weight]), [['A', 1], ['B', 1]]);
  assert.equal(analytical.reason, 'SHARED_EXECUTION_ANALYTICAL');

  const rows = [{ date: '2026-07-22', normalHours: 8.8, he70Horas: 19 / 60, he100Horas: 0, tags: input.tags }];
  const rdo = { byProject: new Map(), dayProjects: new Map([['2026-07-22', input.rdoProjects]]) };
  const accountingHours = classifyProjectHours(rows, rdo, resolveTestTag, new Map(), new Map(), missionGroups);
  const analyticalHours = classifyProjectHours(rows, rdo, resolveTestTag, new Map(), new Map(), missionGroups, 'ANALYTICAL');
  assert.ok(near([...accountingHours.byProject.values()].reduce((sum, item) => sum + item.normalHours, 0), 8.8));
  assert.ok(near([...analyticalHours.byProject.values()].reduce((sum, item) => sum + item.normalHours, 0), 17.6));
  assert.ok([...analyticalHours.byProject.values()].every(item => item.travelHours === 8.8));
});

test('consolidação excepcional direciona evidência dos membros uma única vez ao projeto principal', () => {
  const missionGroups = buildMissionGroupProjectIndex([{
    id: 'group-detroit',
    laborAllocationMode: 'CONSOLIDATE_PRIMARY',
    primaryLaborProjectId: 'A',
    members: [{ projectId: 'A' }, { projectId: 'B' }, { projectId: 'D' }]
  }]);
  for (const allocationAxis of ['ACCOUNTING', 'ANALYTICAL']) {
    const decision = buildDailyProjectWeights({
      tags: [],
      rdoProjects: dailyRdo([['B', 8], ['D', 8]]),
      resolveTag: resolveTestTag,
      missionGroupProjectsByProjectId: missionGroups,
      allocationAxis
    });
    assert.deepEqual(decision.allocations.map(item => [item.projectId, item.weight]), [['A', 1]]);
    assert.equal(decision.reason, 'CONSOLIDATE_PRIMARY');
  }
});

test('seleção manual múltipla conserva o eixo contábil e replica o eixo analítico', () => {
  const base = {
    tags: [],
    rdoProjects: dailyRdo([['A', 8], ['B', 4]]),
    resolveTag: resolveTestTag,
    manualProjectIds: ['A', 'B']
  };
  const accounting = buildDailyProjectWeights(base);
  const analytical = buildDailyProjectWeights({ ...base, allocationAxis: 'ANALYTICAL' });

  assert.equal(accounting.reason, 'MANUAL_SHARED_OVERRIDE');
  assert.ok(near(accounting.allocations[0].weight + accounting.allocations[1].weight, 1));
  assert.deepEqual(analytical.allocations.map(item => item.weight), [1, 1]);

  const incompleteRdo = buildDailyProjectWeights({
    ...base,
    rdoProjects: dailyRdo([['A', 8]])
  });
  assert.deepEqual(incompleteRdo.allocations.map(item => item.weight), [0.5, 0.5]);
});

test('política de grupo não resolve RDO externo nem grupo apenas visual', () => {
  const shared = buildMissionGroupProjectIndex([{
    id: 'group-uhe',
    laborAllocationMode: 'SHARED_EXECUTION',
    members: [{ projectId: 'A' }, { projectId: 'B' }]
  }]);
  const withExternal = buildDailyProjectWeights({
    tags: [],
    rdoProjects: dailyRdo([['A', 8], ['C', 8]]),
    resolveTag: resolveTestTag,
    missionGroupProjectsByProjectId: shared,
    allocationAxis: 'ANALYTICAL'
  });
  assert.equal(withExternal.reason, 'AMBIGUOUS_WITHOUT_TAGS');
  assert.deepEqual(withExternal.allocations, []);

  const visual = buildMissionGroupProjectIndex([{
    id: 'group-visual',
    laborAllocationMode: 'VISUAL_ONLY',
    members: [{ projectId: 'A' }, { projectId: 'B' }]
  }]);
  const visualDecision = buildDailyProjectWeights({
    tags: [],
    rdoProjects: dailyRdo([['A', 8], ['B', 8]]),
    resolveTag: resolveTestTag,
    missionGroupProjectsByProjectId: visual,
    allocationAxis: 'ANALYTICAL'
  });
  assert.equal(visualDecision.reason, 'AMBIGUOUS_WITHOUT_TAGS');
  assert.deepEqual(visualDecision.allocations, []);
});

test('viagem usa mobilização com RDO posterior somente como último fallback', () => {
  const unique = buildDailyProjectWeights({
    tags: ['EM VIAGEM - cliente'],
    mobilizationProjectIds: ['A']
  });
  assert.equal(unique.reason, 'MOBILIZATION_FUTURE_RDO');
  assert.deepEqual(unique.allocations.map(item => [item.projectId, item.weight, item.rdo]), [['A', 1, null]]);

  const withoutTravel = buildDailyProjectWeights({
    tags: [],
    mobilizationProjectIds: ['A']
  });
  assert.equal(withoutTravel.reason, 'NO_PROJECT_EVIDENCE');

  const sameDayWins = buildDailyProjectWeights({
    tags: ['EM VIAGEM'],
    rdoProjects: dailyRdo([['C', 8]]),
    mobilizationProjectIds: ['A']
  });
  assert.equal(sameDayWins.reason, 'SINGLE_RDO_FALLBACK');
  assert.deepEqual(sameDayWins.allocations.map(item => item.projectId), ['C']);

  const manualWins = buildDailyProjectWeights({
    tags: ['EM VIAGEM'],
    manualProjectId: 'B',
    mobilizationProjectIds: ['A']
  });
  assert.equal(manualWins.reason, 'MANUAL_OVERRIDE');
  assert.deepEqual(manualWins.allocations.map(item => item.projectId), ['B']);

  const ambiguous = buildDailyProjectWeights({
    tags: ['EM VIAGEM'],
    mobilizationProjectIds: ['A', 'B']
  });
  assert.equal(ambiguous.reason, 'MOBILIZATION_RDO_AMBIGUOUS');
  assert.deepEqual(ambiguous.candidateProjectIds, ['A', 'B']);
  assert.deepEqual(ambiguous.allocations, []);
});

test('mobilizações compartilhadas repetem somente o eixo analítico e não copiam horas do RDO posterior', () => {
  const sharedGroups = buildMissionGroupProjectIndex([{
    id: 'group-shared',
    laborAllocationMode: 'SHARED_EXECUTION',
    members: [{ projectId: 'A' }, { projectId: 'B' }]
  }]);
  const input = {
    tags: ['EM VIAGEM'],
    mobilizationProjectIds: ['A', 'B'],
    missionGroupProjectsByProjectId: sharedGroups
  };
  const accounting = buildDailyProjectWeights(input);
  const analytical = buildDailyProjectWeights({ ...input, allocationAxis: 'ANALYTICAL' });

  assert.equal(accounting.reason, 'MOBILIZATION_SHARED_ACCOUNTING');
  assert.deepEqual(accounting.allocations.map(item => [item.projectId, item.weight]), [['A', 0.5], ['B', 0.5]]);
  assert.equal(analytical.reason, 'MOBILIZATION_SHARED_ANALYTICAL');
  assert.deepEqual(analytical.allocations.map(item => [item.projectId, item.weight]), [['A', 1], ['B', 1]]);

  const classified = classifyProjectHours([{
    date: '2026-07-16',
    normalHours: 8,
    he70Horas: 1,
    he100Horas: 0,
    tags: ['EM VIAGEM']
  }], {
    byProject: new Map(),
    dayProjects: new Map(),
    mobilizationProjectsByDate: new Map([['2026-07-16', new Set(['A'])]])
  });
  assert.equal(classified.byProject.get('A').normalHours, 8);
  assert.equal(classified.byProject.get('A').he70Hours, 1);
  assert.equal(classified.byProject.get('A').travelHours, 8);
  assert.equal(classified.byProject.get('A').rdoWorkedHours, 0);

  const consolidatedGroups = buildMissionGroupProjectIndex([{
    id: 'group-primary',
    laborAllocationMode: 'CONSOLIDATE_PRIMARY',
    primaryLaborProjectId: 'A',
    members: [{ projectId: 'A' }, { projectId: 'B' }]
  }]);
  const consolidated = buildDailyProjectWeights({
    tags: ['EM VIAGEM'],
    mobilizationProjectIds: ['A', 'B'],
    missionGroupProjectsByProjectId: consolidatedGroups,
    allocationAxis: 'ANALYTICAL'
  });
  assert.equal(consolidated.reason, 'MOBILIZATION_CONSOLIDATE_PRIMARY');
  assert.deepEqual(consolidated.allocations.map(item => [item.projectId, item.weight]), [['A', 1]]);
});

test('custo analítico usa a mesma base real sem reconciliar cópias compartilhadas contra a folha', () => {
  const accounting = computeCollaboratorCost({
    params: PARAMS,
    normalHours: 8,
    he70Horas: 0,
    he100Horas: 0,
    folgaHours: 0,
    projects: [
      { pid: 'A', rdoDaysHours: 4, awayDaysHours: 4, he70Hours: 0, he100Hours: 0 },
      { pid: 'B', rdoDaysHours: 4, awayDaysHours: 4, he70Hours: 0, he100Hours: 0 }
    ]
  });
  const analytical = computeAnalyticalProjectCosts({
    params: PARAMS,
    fixedBase: accounting.fixoMensal,
    totalHours: accounting.totalHours,
    projects: [
      { pid: 'A', rdoDaysHours: 8, awayDaysHours: 8, he70Hours: 0, he100Hours: 0 },
      { pid: 'B', rdoDaysHours: 8, awayDaysHours: 8, he70Hours: 0, he100Hours: 0 }
    ]
  });
  assert.equal(analytical.A.hours, 8);
  assert.equal(analytical.B.hours, 8);
  assert.ok(analytical.A.cost > 0 && analytical.B.cost > 0);
  assert.ok(analytical.A.cost + analytical.B.cost > accounting.folha);
});

test('EM VIAGEM é contexto de deslocamento e nunca código de missão', () => {
  assert.equal(isPontoTravelTag('Em viagem'), true);
  assert.equal(isPontoTravelTag('EM VIAGEM - 07.264.184/0001-46'), true);
  assert.equal(isPontoTravelTag('Missão 5810'), false);
  assert.equal(resolveTestTag('EM VIAGEM - 07.264.184/0001-46'), null);
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
