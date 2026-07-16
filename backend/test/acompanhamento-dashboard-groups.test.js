import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupDashboardRows } from '../src/lib/acompanhamento/dashboard-groups.js';

function row(overrides = {}) {
  return {
    projectId: overrides.projectId ?? 'p1',
    code: overrides.code ?? '1001',
    name: overrides.name ?? 'Missão',
    clientName: overrides.clientName ?? 'Cliente A',
    clientCnpj: overrides.clientCnpj ?? '11222333000144',
    proposalCode: overrides.proposalCode ?? '1001',
    resolved: overrides.resolved ?? true,
    archived: overrides.archived ?? false,
    salePrice: overrides.salePrice ?? 100,
    invoicedRevenue: overrides.invoicedRevenue ?? 80,
    invoiceCount: overrides.invoiceCount ?? 1,
    plannedTotalCost: overrides.plannedTotalCost ?? 60,
    expectedProfit: overrides.expectedProfit ?? 40,
    expectedMargin: overrides.expectedMargin ?? 40,
    plannedDays: overrides.plannedDays ?? 10,
    workedDays: overrides.workedDays ?? 5,
    serviceModality: overrides.serviceModality ?? 'INLOCO',
    components: overrides.components ?? { he: 10, diaria: 5 },
    rdoCount: overrides.rdoCount ?? 3,
    realizedOmieCost: overrides.realizedOmieCost ?? 20,
    realizedCost: overrides.realizedCost ?? 30,
    realizedPaid: overrides.realizedPaid ?? 25,
    stockCost: overrides.stockCost ?? 5,
    presumedProfitTaxes: overrides.presumedProfitTaxes ?? { outOfInvoiceTaxTotal: 4, invoiceTaxTotal: 2, basisSource: 'EXPECTED_SALE' },
    progressPct: overrides.progressPct ?? 50,
    progressMethod: overrides.progressMethod ?? 'RDO',
    progressWeight: overrides.progressWeight ?? null
  };
}

function group(overrides = {}) {
  return {
    id: overrides.id ?? 'g1',
    name: overrides.name ?? 'Cliente A — 1001 + 1002',
    status: overrides.status ?? 'ACTIVE',
    members: overrides.members ?? [
      { projectId: 'p1', order: 0, project: { id: 'p1', code: '1001', name: 'A', clientName: 'Cliente A', clientCnpj: '11222333000144' } },
      { projectId: 'p2', order: 1, project: { id: 'p2', code: '1002', name: 'B', clientName: 'Cliente A', clientCnpj: '11222333000144' } }
    ]
  };
}

test('groupDashboardRows hides child rows and emits one consolidated group row', () => {
  const result = groupDashboardRows([
    row({ projectId: 'p1', code: '1001' }),
    row({ projectId: 'p2', code: '1002' }),
    row({ projectId: 'p3', code: '1003' })
  ], [group()]);

  assert.equal(result.length, 2);
  assert.equal(result[0].kind, 'GROUP');
  assert.equal(result[0].groupId, 'g1');
  assert.deepEqual(result[0].members.map(member => member.code), ['1001', '1002']);
  assert.equal(result[1].projectId, 'p3');
});

test('groupDashboardRows sums components and recalculates expected margin', () => {
  const result = groupDashboardRows([
    row({
      projectId: 'p1',
      salePrice: 100,
      expectedProfit: 25,
      plannedTotalCost: 75,
      realizedCost: 20,
      components: { he: 10, diaria: 5 }
    }),
    row({
      projectId: 'p2',
      salePrice: 300,
      expectedProfit: 75,
      plannedTotalCost: 225,
      realizedCost: 100,
      components: { he: 20, standby: 15 }
    })
  ], [group()]);

  const grouped = result[0];
  assert.equal(grouped.salePrice, 400);
  assert.equal(grouped.expectedProfit, 100);
  assert.equal(grouped.expectedMargin, 25);
  assert.equal(grouped.plannedTotalCost, 300);
  assert.equal(grouped.realizedCost, 120);
  assert.deepEqual(grouped.components, { he: 30, diaria: 5, standby: 15 });
});

test('groupDashboardRows keeps category-filtered inputs as the source of truth', () => {
  const result = groupDashboardRows([
    row({ projectId: 'p1', realizedCost: 10, plannedTotalCost: 100 }),
    row({ projectId: 'p2', realizedCost: 20, plannedTotalCost: 100 })
  ], [group()]);

  assert.equal(result[0].realizedCost, 30);
  assert.equal(result[0].costConsumedPct, 15);
});

test('groupDashboardRows compares clients by CNPJ before client name', () => {
  const result = groupDashboardRows([
    row({ projectId: 'p1', clientName: 'Cliente Matriz', clientCnpj: '11.222.333/0001-44' }),
    row({ projectId: 'p2', clientName: 'Cliente Obra', clientCnpj: '11222333000144' })
  ], [group({
    members: [
      { projectId: 'p1', order: 0, project: { id: 'p1', code: '1001', name: 'A', clientName: 'Cliente Matriz', clientCnpj: '11222333000144' } },
      { projectId: 'p2', order: 1, project: { id: 'p2', code: '1002', name: 'B', clientName: 'Cliente Obra', clientCnpj: '11222333000144' } }
    ]
  })]);

  assert.equal(result[0].clientName, 'Cliente Matriz');
});

test('groupDashboardRows ignores dissolved groups', () => {
  const rows = [row({ projectId: 'p1' }), row({ projectId: 'p2' })];
  const result = groupDashboardRows(rows, [group({ status: 'DISSOLVED' })]);
  assert.equal(result, rows);
});

test('groupDashboardRows does not mutate individual rows and preserves member project ids', () => {
  const rows = [row({ projectId: 'p1' }), row({ projectId: 'p2' })];
  const before = structuredClone(rows);
  const result = groupDashboardRows(rows, [group()]);

  assert.deepEqual(rows, before);
  assert.equal(result[0].projectId, undefined);
  assert.deepEqual(result[0].members.map(member => member.projectId), ['p1', 'p2']);
});
