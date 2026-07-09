import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPlannedRoleCounts } from '../src/lib/acompanhamento/project-detail.js';
import { isSalaryCategory } from '../src/lib/acompanhamento/salary.js';

test('isSalaryCategory: reconhece categorias de folha/mão de obra (acentos e caixa)', () => {
  assert.equal(isSalaryCategory('Salários e ordenados'), true);
  assert.equal(isSalaryCategory('FOLHA DE PAGAMENTO'), true);
  assert.equal(isSalaryCategory('Pró-labore'), true);
  assert.equal(isSalaryCategory('INSS a recolher'), true);
  assert.equal(isSalaryCategory('FGTS'), true);
  assert.equal(isSalaryCategory('Férias'), true);
  assert.equal(isSalaryCategory('Rescisão contratual'), true);
  assert.equal(isSalaryCategory('Vale transporte'), true);
});

test('isSalaryCategory: não marca custos de obra/material', () => {
  assert.equal(isSalaryCategory('Material de consumo'), false);
  assert.equal(isSalaryCategory('Hospedagem'), false);
  assert.equal(isSalaryCategory('Locação de equipamento'), false);
  assert.equal(isSalaryCategory('Combustível'), false);
  assert.equal(isSalaryCategory(null), false);
  assert.equal(isSalaryCategory(''), false);
});

test('buildPlannedRoleCounts conta colaboradores distintos e horas usadas por cargo previsto', () => {
  const plannedRows = [
    { roleName: 'Técnico de Campo' },
    { jobRole: { name: 'Encarregado' } },
    { roleName: null }
  ];
  const collaborators = [
    { collaboratorId: 'c1', collaborator: { role: 'tecnico de campo' }, report: { daytimeWorkedMinutes: 1800, nighttimeWorkedMinutes: 0 } },
    { collaboratorId: 'c1', collaborator: { role: 'Técnico de Campo' }, report: { daytimeWorkedMinutes: 1200, nighttimeWorkedMinutes: 0 } },
    { collaboratorId: 'c2', collaborator: { role: 'TÉCNICO DE CAMPO' }, report: { daytimeWorkedMinutes: 3000, nighttimeWorkedMinutes: 0 } },
    { collaboratorId: 'c3', collaborator: { role: 'Auxiliar' }, report: { daytimeWorkedMinutes: 600, nighttimeWorkedMinutes: 0 } },
    { collaboratorId: 'c4', collaborator: { role: 'Encarregado' }, report: { daytimeWorkedMinutes: 480, nighttimeWorkedMinutes: 120 } }
  ];

  assert.deepEqual(buildPlannedRoleCounts(plannedRows, collaborators, 300), [
    { roleName: 'Encarregado', collaboratorCount: 1, usedHours: 10, pctOfPlannedTotal: 3 },
    { roleName: 'Técnico de Campo', collaboratorCount: 2, usedHours: 100, pctOfPlannedTotal: 33 }
  ]);
});

test('buildPlannedRoleCounts omite cargos previstos sem colaborador correspondente', () => {
  const out = buildPlannedRoleCounts(
    [{ roleName: 'Supervisor' }],
    [{ collaboratorId: 'c1', collaborator: { role: 'Técnico' } }]
  );

  assert.deepEqual(out, []);
});
