import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMissionDemands, resolveMissionResponsible, validateMissionChronology } from '../src/lib/efetivo/planning/mission-planning.js';

test('cronologia aceita limites iguais e rejeita inversão', () => {
  assert.doesNotThrow(() => validateMissionChronology({ mobilizationDate: '2026-01-01', executionStartDate: '2026-01-01', executionEndDate: '2026-01-01', returnDate: '2026-01-01' }));
  assert.throws(() => validateMissionChronology({ mobilizationDate: '2026-01-02', executionStartDate: '2026-01-01', executionEndDate: '2026-01-03', returnDate: '2026-01-04' }), /mobilização/i);
});

test('demanda remove zeros, recusa duplicidade e confirmação vazia', () => {
  assert.deepEqual(normalizeMissionDemands([{ jobRoleId: 'r1', requiredCount: 0 }, { jobRoleId: 'r2', requiredCount: 2 }]), [{ jobRoleId: 'r2', requiredCount: 2 }]);
  assert.throws(() => normalizeMissionDemands([{ jobRoleId: 'r1', requiredCount: 1 }, { jobRoleId: 'r1', requiredCount: 2 }]), /única vez/i);
  assert.throws(() => normalizeMissionDemands([], 'CONFIRMED'), /demanda positiva/i);
});

test('responsável usa nome da conta coordenadora e cargo do colaborador vinculado', async () => {
  const responsible = await resolveMissionResponsible({
    user: { findFirst: async () => ({ id: 'u1', name: 'Coordenação', collaborator: { id: 'c1', role: 'Líder de Operações' } }) }
  }, {
    headquartersResponsibleUserId: 'u1',
    headquartersResponsibleName: 'Texto adulterado',
    headquartersResponsibleRole: 'Texto adulterado',
    headquartersResponsibleCollaboratorId: null
  });
  assert.deepEqual(responsible, { name: 'Coordenação', role: 'Líder de Operações', collaboratorId: 'c1' });
});

test('responsável sem colaborador na conta preserva cargo livre quando não há líder', async () => {
  const responsible = await resolveMissionResponsible({
    user: { findFirst: async () => ({ id: 'u1', name: 'Coordenação', collaborator: null }) }
  }, {
    headquartersResponsibleUserId: 'u1',
    headquartersResponsibleName: 'Coordenação',
    headquartersResponsibleRole: 'Planejamento',
    headquartersResponsibleCollaboratorId: null
  });
  assert.deepEqual(responsible, { name: 'Coordenação', role: 'Planejamento', collaboratorId: null });
});

test('líder escolhido para conta sem vínculo também fornece o cargo canônico', async () => {
  const responsible = await resolveMissionResponsible({
    user: { findFirst: async () => ({ id: 'u1', name: 'Coordenação', collaborator: null }) },
    collaborator: { findUnique: async () => ({ id: 'c2', role: 'Supervisora de Operações' }) }
  }, {
    headquartersResponsibleUserId: 'u1',
    headquartersResponsibleName: 'Coordenação',
    headquartersResponsibleRole: 'Texto livre ignorado',
    headquartersResponsibleCollaboratorId: 'c2'
  });
  assert.deepEqual(responsible, { name: 'Coordenação', role: 'Supervisora de Operações', collaboratorId: 'c2' });
});
