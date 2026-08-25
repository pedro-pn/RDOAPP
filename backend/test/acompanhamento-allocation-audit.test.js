import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAllocationAudit,
  groupUnallocatedDays
} from '../src/lib/acompanhamento/allocation-audit.js';

const PROJECTS = new Map([
  ['p-5804', { id: 'p-5804', code: '5804', name: 'MRN' }],
  ['p-5820', { id: 'p-5820', code: '5820', name: 'Outra' }]
]);
const KNOWN_CODES = new Set(['5804', '5820']);

function day(date, overrides = {}) {
  return {
    date,
    normalHours: 8.8,
    he70Hours: 0,
    he100Hours: 0,
    tags: [],
    tagProjectIds: [],
    rdoProjects: [],
    manualProjectIds: [],
    allocations: [],
    reason: 'NO_PROJECT_EVIDENCE',
    ...overrides
  };
}

function rate(days, overrides = {}) {
  return {
    collaboratorId: 'c-1',
    name: 'Valdecir Rodrigues Rumpel',
    role: 'Encarregado(a) de Operações III',
    allocationTrail: days,
    unresolvedDays: days
      .filter(item => item.allocations.length === 0 && item.normalHours + item.he70Hours + item.he100Hours > 0)
      .map(item => ({ date: item.date, reason: item.reason })),
    ...overrides
  };
}

test('dias contíguos do mesmo motivo viram um bloco só', () => {
  const days = ['2026-08-17', '2026-08-18', '2026-08-19'].map(date => day(date));
  const result = groupUnallocatedDays({
    rates: [rate(days)],
    projectsById: PROJECTS,
    knownMissionCodes: KNOWN_CODES,
    cutoffDateKey: '2025-01-01'
  });

  assert.equal(result.actionable.length, 1);
  assert.equal(result.actionable[0].days.length, 3);
  assert.equal(result.counts.actionableDays, 3);
  assert.ok(Math.abs(result.counts.actionableHours - 26.4) < 1e-6);
});

test('lacuna no calendário quebra o bloco', () => {
  const days = [day('2026-08-17'), day('2026-08-18'), day('2026-08-21')];
  const result = groupUnallocatedDays({
    rates: [rate(days)],
    projectsById: PROJECTS,
    knownMissionCodes: KNOWN_CODES,
    cutoffDateKey: '2025-01-01'
  });

  assert.deepEqual(result.actionable.map(block => block.days.length), [2, 1]);
});

test('etiqueta citando missão não cadastrada vai para o balde de projeto não encontrado', () => {
  const days = [day('2026-08-17', { tags: ['Missão 9999 - cliente'] })];
  const result = groupUnallocatedDays({
    rates: [rate(days)],
    projectsById: PROJECTS,
    knownMissionCodes: KNOWN_CODES,
    cutoffDateKey: '2025-01-01'
  });

  assert.equal(result.actionable.length, 0);
  assert.equal(result.missingProjects.length, 1);
  // O contador da navegação ignora esse balde.
  assert.equal(result.counts.actionableDays, 0);
  assert.equal(result.counts.missingProjectDays, 1);
});

test('etiqueta de viagem sem código de missão continua acionável', () => {
  const days = [day('2026-08-17', { tags: ['EM VIAGEM - 07.264.184/0001-46'] })];
  const result = groupUnallocatedDays({
    rates: [rate(days)],
    projectsById: PROJECTS,
    knownMissionCodes: KNOWN_CODES,
    cutoffDateKey: '2025-01-01'
  });

  assert.equal(result.actionable.length, 1);
  assert.equal(result.missingProjects.length, 0);
});

test('corte do histórico descarta dias anteriores e não pode ser afrouxado pelo filtro', () => {
  const days = [day('2024-12-31'), day('2026-08-17')];
  const comCorte = groupUnallocatedDays({
    rates: [rate(days)],
    projectsById: PROJECTS,
    knownMissionCodes: KNOWN_CODES,
    cutoffDateKey: '2025-01-01'
  });
  assert.deepEqual(comCorte.actionable.flatMap(block => block.days.map(item => item.date)), ['2026-08-17']);

  const tentandoAfrouxar = groupUnallocatedDays({
    rates: [rate(days)],
    projectsById: PROJECTS,
    knownMissionCodes: KNOWN_CODES,
    cutoffDateKey: '2025-01-01',
    from: '2020-01-01'
  });
  assert.deepEqual(tentandoAfrouxar.actionable.flatMap(block => block.days.map(item => item.date)), ['2026-08-17']);
});

test('auditoria por projeto traz o dia alocado e também o candidato que não levou as horas', () => {
  const days = [
    day('2026-07-20', {
      rdoProjects: [{ projectId: 'p-5804', hours: 9.5 }],
      allocations: [{ projectId: 'p-5804', weight: 1 }],
      reason: 'SINGLE_RDO_FALLBACK'
    }),
    // Etiqueta cita o 5804, mas o RDO único do dia é de outro projeto e prevalece: o 5804 é
    // candidato e não levou as horas. É exatamente o dia que o gestor precisa ver ao auditar.
    day('2026-08-06', {
      tags: ['Missão 5804'],
      tagProjectIds: ['p-5804'],
      rdoProjects: [{ projectId: 'p-5820', hours: 9 }],
      allocations: [{ projectId: 'p-5820', weight: 1 }],
      reason: 'SINGLE_RDO_OVERRIDES_TAG'
    }),
    // Sem qualquer menção ao 5804: fica de fora da visão do projeto.
    day('2026-08-17', { tags: ['EM VIAGEM - 07.264.184/0001-46'] })
  ];
  const result = buildAllocationAudit({
    rates: [rate(days)],
    projectsById: PROJECTS,
    knownMissionCodes: KNOWN_CODES,
    projectId: 'p-5804'
  });

  const [collaborator] = result.collaborators;
  assert.deepEqual(collaborator.days.map(item => item.date), ['2026-07-20', '2026-08-06']);
  assert.equal(collaborator.days[0].allocations[0].code, '5804');
  assert.equal(collaborator.days[1].allocations[0].code, '5820');
  assert.equal(collaborator.days[1].reason, 'SINGLE_RDO_OVERRIDES_TAG');
});

test('auditoria por colaborador soma por projeto respeitando o peso do rateio', () => {
  const days = [
    day('2026-07-20', {
      normalHours: 10,
      allocations: [{ projectId: 'p-5804', weight: 0.6 }, { projectId: 'p-5820', weight: 0.4 }],
      reason: 'MULTIPLE_CONFIRMED_TAGS'
    }),
    day('2026-07-21', { normalHours: 8, tags: [] })
  ];
  const result = buildAllocationAudit({
    rates: [rate(days)],
    projectsById: PROJECTS,
    knownMissionCodes: KNOWN_CODES,
    collaboratorId: 'c-1'
  });

  const [collaborator] = result.collaborators;
  const porProjeto = new Map(collaborator.totals.byProject.map(item => [item.code, item.normalHours]));
  assert.ok(Math.abs(porProjeto.get('5804') - 6) < 1e-6);
  assert.ok(Math.abs(porProjeto.get('5820') - 4) < 1e-6);
  assert.ok(Math.abs(collaborator.totals.unallocatedHours - 8) < 1e-6);
});

test('filtro de não alocados esconde os dias já resolvidos', () => {
  const days = [
    day('2026-07-20', { allocations: [{ projectId: 'p-5804', weight: 1 }], reason: 'SINGLE_RDO_FALLBACK' }),
    day('2026-07-21')
  ];
  const result = buildAllocationAudit({
    rates: [rate(days)],
    projectsById: PROJECTS,
    knownMissionCodes: KNOWN_CODES,
    collaboratorId: 'c-1',
    onlyUnallocated: true
  });

  assert.deepEqual(result.collaborators[0].days.map(item => item.date), ['2026-07-21']);
});
