import assert from 'node:assert/strict';
import test from 'node:test';

import { Prisma } from '@prisma/client';

import { createMovement } from '../src/lib/estoque/stock-movements.js';

function stockItem(overrides = {}) {
  return {
    id: 'item-1',
    type: 'PRODUTO_QUIMICO',
    code: 'PQ-001',
    name: 'Produto',
    unitLabel: 'kg',
    isActive: true,
    ...overrides
  };
}

function fakeClient({ item = stockItem(), batches = [], movements = [] } = {}) {
  const state = { item, batches: [...batches], movements: [...movements] };
  let batchSeq = state.batches.length;
  let movementSeq = state.movements.length;

  function groupBy({ by }) {
    const keyField = by.includes('batchId') ? 'batchId' : 'itemId';
    const grouped = new Map();
    for (const movement of state.movements) {
      const key = `${movement[keyField]}:${movement.type}`;
      const current = grouped.get(key) || {
        [keyField]: movement[keyField],
        type: movement.type,
        _sum: { quantity: new Prisma.Decimal(0) }
      };
      current._sum.quantity = current._sum.quantity.plus(movement.quantity);
      grouped.set(key, current);
    }
    return Array.from(grouped.values());
  }

  const tx = {
    stockItem: {
      findUnique: async args => (args.where.id === state.item.id ? state.item : null)
    },
    stockBatch: {
      findUnique: async args => {
        const key = args.where.itemId_lotNumber;
        return state.batches.find(batch => batch.itemId === key.itemId && batch.lotNumber === key.lotNumber) || null;
      },
      create: async args => {
        batchSeq += 1;
        const batch = {
          id: `batch-${batchSeq}`,
          createdAt: new Date(`2026-07-0${Math.min(batchSeq, 9)}T12:00:00.000Z`),
          ...args.data
        };
        state.batches.push(batch);
        return batch;
      }
    },
    stockMovement: {
      create: async args => {
        movementSeq += 1;
        const batch = state.batches.find(item => item.id === args.data.batchId);
        const movement = {
          id: `movement-${movementSeq}`,
          createdAt: new Date('2026-07-09T12:00:00.000Z'),
          project: null,
          reversedBy: null,
          ...args.data,
          item: state.item,
          batch,
          createdBy: { id: args.data.createdById, name: 'Gestor Estoque' }
        };
        state.movements.push(movement);
        return movement;
      },
      groupBy: async args => groupBy(args)
    }
  };

  return {
    state,
    $transaction: fn => fn(tx)
  };
}

test('COMPRA requires NF and chemical lot/expiry, and rejects inactive items', async () => {
  const client = fakeClient();

  await assert.rejects(
    () => createMovement(client, {
      createdById: 'user-1',
      data: { reason: 'COMPRA', itemId: 'item-1', quantity: 10, date: '2026-07-09', lotNumber: 'L-A' }
    }),
    /nfNumber|NF|obrigatório/i
  );

  await assert.rejects(
    () => createMovement(client, {
      createdById: 'user-1',
      data: { reason: 'COMPRA', itemId: 'item-1', quantity: 10, date: '2026-07-09', nfNumber: '123' }
    }),
    /lote/i
  );

  const inactive = fakeClient({ item: stockItem({ isActive: false }) });
  await assert.rejects(
    () => createMovement(inactive, {
      createdById: 'user-1',
      data: { reason: 'COMPRA', itemId: 'item-1', quantity: 10, date: '2026-07-09', nfNumber: '123', lotNumber: 'L-A', expiryDate: '2026-09-30' }
    }),
    /Item inativo/
  );
});

test('COMPRA of filter without lot uses the loose lot and persists purchase metadata', async () => {
  const client = fakeClient({ item: stockItem({ type: 'FILTRO', unitLabel: 'un' }) });

  const result = await createMovement(client, {
    createdById: 'user-1',
    data: {
      reason: 'COMPRA',
      itemId: 'item-1',
      quantity: 20,
      date: '2026-07-09',
      nfNumber: '12346',
      supplier: 'Fornecedor A',
      unitCost: 12.5
    }
  });

  assert.equal(result.movement.batch.lotNumber, '');
  assert.equal(client.state.batches.length, 1);
  assert.equal(result.movement.supplier, 'Fornecedor A');
  assert.equal(result.movement.unitCost.toString(), '12.5');
  assert.equal(result.balances.item.toString(), '20');
  assert.equal(result.balances.batch.toString(), '20');
});

test('COMPRA reuses existing lot and rejects divergent expiry', async () => {
  const existingBatch = {
    id: 'batch-existing',
    itemId: 'item-1',
    lotNumber: 'L-A',
    expiryDate: new Date('2026-09-30T00:00:00.000Z'),
    nfNumber: '12345',
    supplier: null,
    createdAt: new Date('2026-07-01T12:00:00.000Z')
  };
  const client = fakeClient({ batches: [existingBatch] });

  const result = await createMovement(client, {
    createdById: 'user-1',
    data: {
      reason: 'COMPRA',
      itemId: 'item-1',
      quantity: 50,
      date: '2026-07-09',
      nfNumber: '12346',
      lotNumber: 'L-A',
      expiryDate: '2026-09-30'
    }
  });

  assert.equal(result.movement.batchId, 'batch-existing');
  assert.equal(client.state.batches.length, 1);

  await assert.rejects(
    () => createMovement(client, {
      createdById: 'user-1',
      data: {
        reason: 'COMPRA',
        itemId: 'item-1',
        quantity: 10,
        date: '2026-07-10',
        nfNumber: '12347',
        lotNumber: 'L-A',
        expiryDate: '2026-10-01'
      }
    }),
    /Validade divergente/
  );
});
