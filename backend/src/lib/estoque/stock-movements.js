import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { makeEstoqueSchemas } from '../../../../shared/schemas/estoque.js';
import { getBatchBalances, getItemBalances } from './stock-balance.js';

const estoqueSchemas = makeEstoqueSchemas(z);

function appError(message, statusCode = 400, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

function parseDate(value, fieldName) {
  const text = String(value || '').trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00.000Z`)
    : new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw appError(`Data inválida em ${fieldName}.`);
  }
  return date;
}

function optionalDate(value, fieldName) {
  const text = String(value || '').trim();
  return text ? parseDate(text, fieldName) : null;
}

function sameDateOnly(a, b) {
  if (!a || !b) return true;
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

function decimal(value) {
  return new Prisma.Decimal(value);
}

function isExpired(expiryDate, now = new Date()) {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;
  const today = new Date(now.toISOString().slice(0, 10));
  return expiry < today;
}

function movementInclude() {
  return {
    item: true,
    batch: true,
    project: { select: { id: true, code: true, name: true } },
    createdBy: { select: { id: true, name: true } },
    reversedBy: { select: { id: true } }
  };
}

async function itemOrThrow(tx, itemId) {
  const item = await tx.stockItem.findUnique({ where: { id: itemId } });
  if (!item) throw appError('Item de estoque não encontrado.');
  if (!item.isActive) throw appError('Item inativo não aceita movimentações.');
  return item;
}

async function resolvePurchaseBatch(tx, item, data) {
  const lotNumber = item.type === 'FILTRO' ? String(data.lotNumber || '').trim() : String(data.lotNumber || '').trim();
  const expiryDate = optionalDate(data.expiryDate, 'validade');
  if (item.type === 'PRODUTO_QUIMICO') {
    if (!lotNumber) throw appError('Informe o lote do produto químico.');
    if (!expiryDate) throw appError('Informe a validade do produto químico.');
  }

  const existing = await tx.stockBatch.findUnique({
    where: { itemId_lotNumber: { itemId: item.id, lotNumber } }
  });
  if (existing) {
    if (expiryDate && existing.expiryDate && !sameDateOnly(expiryDate, existing.expiryDate)) {
      throw appError('Validade divergente para lote já cadastrado.');
    }
    return existing;
  }

  return tx.stockBatch.create({
    data: {
      itemId: item.id,
      lotNumber,
      expiryDate,
      nfNumber: data.nfNumber,
      supplier: data.supplier
    }
  });
}

async function resolveExistingBatch(tx, item, batchId) {
  const batch = await tx.stockBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.itemId !== item.id) throw appError('Lote de estoque não encontrado.');
  return batch;
}

async function lockBatch(tx, batchId) {
  if (typeof tx.$queryRaw !== 'function') return;
  await tx.$queryRaw`SELECT id FROM "StockBatch" WHERE id = ${batchId} FOR UPDATE`;
}

async function projectOrThrow(tx, projectId) {
  const project = await tx.project.findFirst({
    where: { id: projectId, deletedAt: null, isActive: true },
    select: { id: true }
  });
  if (!project) throw appError('Projeto de destino inválido ou inativo.');
  return project;
}

async function assertBatchBalance(tx, item, batch, quantity) {
  await lockBatch(tx, batch.id);
  const batchBalances = await getBatchBalances(tx, item.id);
  const available = batchBalances.get(batch.id) || decimal(0);
  if (available.minus(quantity).lt(0)) {
    throw appError(`Saldo insuficiente no lote (disponível: ${available.toFixed(3)} ${item.unitLabel}).`, 409);
  }
  return available;
}

export async function createMovement(client, { data, createdById }) {
  if (!createdById) throw appError('Usuário autenticado não identificado.', 401);

  return client.$transaction(async tx => {
    const rawItemId = String(data?.itemId || '').trim();
    const item = await itemOrThrow(tx, rawItemId);
    const parsed = estoqueSchemas.movement({ itemType: item.type }).parse(data);

    const batch = parsed.reason === 'COMPRA'
      ? await resolvePurchaseBatch(tx, item, parsed)
      : await resolveExistingBatch(tx, item, parsed.batchId);
    if (['USO_EM_PROJETO', 'DEVOLUCAO_OBRA'].includes(parsed.reason)) {
      await projectOrThrow(tx, parsed.projectId);
    }
    if (parsed.reason === 'USO_EM_PROJETO') {
      await projectOrThrow(tx, parsed.projectId);
      if (isExpired(batch.expiryDate) && !parsed.confirmExpired) {
        throw appError('Lote vencido. Confirme para registrar a saída.', 422, { requiresConfirmation: true });
      }
    }

    const type = parsed.reason === 'COMPRA' || parsed.reason === 'DEVOLUCAO_OBRA'
      ? 'ENTRADA'
      : parsed.type;
    if (type === 'SAIDA') {
      await assertBatchBalance(tx, item, batch, decimal(parsed.quantity));
    }

    const movement = await tx.stockMovement.create({
      data: {
        itemId: item.id,
        batchId: batch.id,
        type,
        reason: parsed.reason,
        quantity: decimal(parsed.quantity),
        date: parseDate(parsed.date, 'data'),
        projectId: parsed.projectId,
        nfNumber: parsed.nfNumber,
        supplier: parsed.supplier,
        unitCost: parsed.unitCost === null || parsed.unitCost === undefined ? null : decimal(parsed.unitCost),
        requestedBy: parsed.requestedBy,
        notes: parsed.notes,
        createdById
      },
      include: movementInclude()
    });

    const [itemBalances, batchBalances] = await Promise.all([
      getItemBalances(tx, [item.id]),
      getBatchBalances(tx, item.id)
    ]);

    return {
      movement,
      balances: {
        item: itemBalances.get(item.id) || decimal(0),
        batch: batchBalances.get(batch.id) || decimal(0)
      }
    };
  });
}

export async function reverseMovement(client, { movementId, notes = null, createdById }) {
  if (!createdById) throw appError('Usuário autenticado não identificado.', 401);

  return client.$transaction(async tx => {
    const original = await tx.stockMovement.findUnique({
      where: { id: movementId },
      include: {
        item: true,
        batch: true,
        reversedBy: { select: { id: true } }
      }
    });
    if (!original) throw appError('Movimentação não encontrada.', 404);
    if (original.reason === 'ESTORNO' || original.reversalOfId) {
      throw appError('Não é possível estornar um estorno.', 409);
    }
    if (original.reversedBy) {
      throw appError('Movimentação já estornada.', 409);
    }

    const type = original.type === 'ENTRADA' ? 'SAIDA' : 'ENTRADA';
    if (type === 'SAIDA') {
      await assertBatchBalance(tx, original.item, original.batch, decimal(original.quantity));
    }

    const movement = await tx.stockMovement.create({
      data: {
        itemId: original.itemId,
        batchId: original.batchId,
        type,
        reason: 'ESTORNO',
        quantity: decimal(original.quantity),
        date: new Date(),
        projectId: original.projectId,
        notes,
        reversalOfId: original.id,
        createdById
      },
      include: movementInclude()
    });

    const [itemBalances, batchBalances] = await Promise.all([
      getItemBalances(tx, [original.itemId]),
      getBatchBalances(tx, original.itemId)
    ]);

    return {
      movement,
      balances: {
        item: itemBalances.get(original.itemId) || decimal(0),
        batch: batchBalances.get(original.batchId) || decimal(0)
      }
    };
  });
}
