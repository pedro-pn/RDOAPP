import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveSelectedMissionTeam,
  resolveSelectedMissionTeam,
  syncSelectedMissionTeam
} from '../src/lib/efetivo/planning/mission-team.js';

const role = (id, name) => ({ id, name, isActive: true, isOperational: true });
const collaborator = (id, jobRole) => ({
  id,
  name: `Pessoa ${id}`,
  role: jobRole.name,
  jobRoleId: jobRole.id,
  jobRole,
  isActive: true,
  admissionDate: new Date('2020-01-01T00:00:00.000Z'),
  terminationDate: null
});

test('equipe selecionada deriva demanda pelos cargos canônicos', () => {
  const r1 = role('r1', 'Operador I');
  const r2 = role('r2', 'Operador II');
  const team = deriveSelectedMissionTeam([
    collaborator('c1', r1),
    collaborator('c2', r1),
    collaborator('c3', r2)
  ], 'CONFIRMED');

  assert.deepEqual(team.demands, [
    { jobRoleId: 'r1', requiredCount: 2 },
    { jobRoleId: 'r2', requiredCount: 1 }
  ]);
  assert.deepEqual(team.allocations.map(item => item.collaboratorId), ['c1', 'c2', 'c3']);
});

test('missão confirmada exige pessoa e função operacional canônica', () => {
  assert.throws(() => deriveSelectedMissionTeam([], 'CONFIRMED'), /colaborador/i);
  assert.throws(() => deriveSelectedMissionTeam([{
    id: 'c1', name: 'Sem função', role: 'Legado', jobRoleId: null, jobRole: null, isActive: true
  }], 'DRAFT'), /função operacional/i);
});

test('resolução recusa colaborador inativo e IDs duplicados', async () => {
  const r1 = role('r1', 'Operador');
  const inactive = { ...collaborator('c1', r1), isActive: false };
  const tx = {
    $queryRawUnsafe: async () => undefined,
    collaborator: { findMany: async () => [inactive] },
    collaboratorAbsence: { findMany: async () => [] },
    efetivoMissionAllocation: { findMany: async () => [] }
  };
  const basePayload = {
    scheduleStatus: 'DRAFT',
    mobilizationDate: '2026-09-01',
    returnDate: '2026-09-10'
  };

  await assert.rejects(
    () => resolveSelectedMissionTeam(tx, { ...basePayload, collaboratorIds: ['c1'] }, 'plan-1'),
    error => error.conflicts?.[0]?.code === 'OUTSIDE_EMPLOYMENT'
  );
  await assert.rejects(
    () => resolveSelectedMissionTeam(tx, { ...basePayload, collaboratorIds: ['c1', 'c1'] }, 'plan-1'),
    error => error.code === 'DUPLICATE_MISSION_COLLABORATOR'
  );
});

test('resolução bloqueia IDs em ordem estável e identifica conflito da pessoa', async () => {
  const r1 = role('r1', 'Operador');
  const people = [collaborator('c2', r1), collaborator('c1', r1)];
  const locks = [];
  const tx = {
    $queryRawUnsafe: async (_query, id) => locks.push(id),
    collaborator: { findMany: async () => people },
    collaboratorAbsence: { findMany: async () => [{ id: 'a1', collaboratorId: 'c2', type: 'FERIAS', startDate: new Date('2026-09-03T00:00:00.000Z'), endDate: new Date('2026-09-04T00:00:00.000Z'), deletedAt: null }] },
    efetivoMissionAllocation: { findMany: async () => [] }
  };

  await assert.rejects(() => resolveSelectedMissionTeam(tx, {
    collaboratorIds: ['c2', 'c1'],
    scheduleStatus: 'CONFIRMED',
    mobilizationDate: '2026-09-01',
    returnDate: '2026-09-10'
  }, 'plan-1'), error => {
    assert.match(error.message, /Pessoa c2/);
    assert.equal(error.conflicts[0].code, 'ABSENCE_FERIAS');
    return true;
  });
  assert.deepEqual(locks, ['c1', 'c2']);
});

test('sincronização remove ausentes e restaura ou cria selecionados', async () => {
  const calls = { removed: null, upserts: [] };
  const tx = {
    efetivoMissionAllocation: {
      updateMany: async args => { calls.removed = args; },
      upsert: async args => { calls.upserts.push(args); return args.create; }
    }
  };
  await syncSelectedMissionTeam(tx, 'm1', {
    allocations: [
      { collaboratorId: 'c1', jobRoleId: 'r1', jobRoleNameSnapshot: 'Operador I' },
      { collaboratorId: 'c2', jobRoleId: 'r2', jobRoleNameSnapshot: 'Operador II' }
    ]
  }, { actorUserId: 'u1' });

  assert.deepEqual(calls.removed.where.collaboratorId.notIn, ['c1', 'c2']);
  assert.equal(calls.upserts.length, 2);
  assert.equal(calls.upserts[0].update.deletedAt, null);
  assert.equal('createdByUserId' in calls.upserts[0].update, false);
  assert.equal(calls.upserts[1].create.createdByUserId, 'u1');
});
