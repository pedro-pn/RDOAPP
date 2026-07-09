import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import asyncHandler from '../../lib/async-handler.js';
import {
  createStockFispqAttachment,
  publicStockAttachmentUrl,
  removeStockFispqAttachment
} from '../../lib/estoque/stock-attachments.js';
import { createMovement, reverseMovement } from '../../lib/estoque/stock-movements.js';
import { decimalBalanceString, getBatchBalances, getItemBalances } from '../../lib/estoque/stock-balance.js';
import prisma from '../../lib/prisma.js';
import { syncRomaneioCatalog } from '../../lib/romaneio-catalog.js';
import { makeEstoqueSchemas } from '../../../../shared/schemas/estoque.js';
import {
  requireAuth,
  requireEstoqueAccess,
  requireEstoqueManager
} from '../../middleware/auth.js';

const router = Router();
const estoqueSchemas = makeEstoqueSchemas(z);

router.use(requireAuth);
router.use(requireEstoqueAccess);

function notImplemented(_req, res) {
  return res.status(501).json({ error: 'Endpoint do módulo Estoque em implementação.' });
}

function parseBoolean(value) {
  return ['1', 'true', 'sim', 'yes'].includes(String(value || '').trim().toLowerCase());
}

function parsePage(value, fallback = 1) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : fallback;
}

function parsePageSize(value, fallback = 50) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? Math.min(200, Math.max(1, Math.trunc(parsed))) : fallback;
}

function queryDate(value, endOfDay = false) {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializedDecimal(value) {
  return value === null || value === undefined ? null : String(value);
}

function serializeDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isExpired(expiryDate, now) {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;
  const today = new Date(now.toISOString().slice(0, 10));
  return expiry < today;
}

function isExpiringSoon(expiryDate, now) {
  if (!expiryDate || isExpired(expiryDate, now)) return false;
  const expiry = new Date(expiryDate);
  const today = new Date(now.toISOString().slice(0, 10));
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 30;
}

export function serializeStockItem(item) {
  const movementCount = item?._count?.movements ?? item?.movementsCount ?? 0;
  return {
    id: item.id,
    type: item.type,
    code: item.code,
    name: item.name,
    manufacturer: item.manufacturer,
    description: item.description,
    unitLabel: item.unitLabel,
    minQuantity: serializedDecimal(item.minQuantity),
    location: item.location,
    filterModel: item.filterModel,
    filterKind: item.filterKind,
    filterMicron: item.filterMicron,
    unNumber: item.unNumber,
    casNumber: item.casNumber,
    fispqUrl: item.fispqToken ? publicStockAttachmentUrl(item.fispqToken) : null,
    isActive: item.isActive,
    hasMovements: movementCount > 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

export function serializeStockMovement(movement) {
  return {
    id: movement.id,
    type: movement.type,
    reason: movement.reason,
    item: movement.item ? {
      id: movement.item.id,
      code: movement.item.code,
      name: movement.item.name,
      unitLabel: movement.item.unitLabel
    } : null,
    batch: movement.batch ? {
      id: movement.batch.id,
      lotNumber: movement.batch.lotNumber,
      expiryDate: serializeDateOnly(movement.batch.expiryDate)
    } : null,
    quantity: serializedDecimal(movement.quantity),
    date: serializeDateOnly(movement.date),
    project: movement.project ? {
      id: movement.project.id,
      code: movement.project.code,
      name: movement.project.name
    } : null,
    nfNumber: movement.nfNumber,
    supplier: movement.supplier,
    unitCost: serializedDecimal(movement.unitCost),
    requestedBy: movement.requestedBy,
    notes: movement.notes,
    reversalOfId: movement.reversalOfId,
    reversedById: movement.reversedBy?.id || null,
    createdBy: movement.createdBy ? {
      id: movement.createdBy.id,
      name: movement.createdBy.name
    } : null,
    createdAt: movement.createdAt
  };
}

export async function buildStockSummary(client, now = new Date()) {
  const items = await client.stockItem.findMany({
    include: { batches: true },
    orderBy: [{ code: 'asc' }, { name: 'asc' }]
  });
  const itemIds = items.map(item => item.id);
  const itemBalances = await getItemBalances(client, itemIds);
  const summary = [];

  for (const item of items) {
    const balance = itemBalances.get(item.id) || new Prisma.Decimal(0);
    if (!item.isActive && balance.lte(0)) continue;

    const batchBalances = await getBatchBalances(client, item.id);
    const batches = [...(item.batches || [])]
      .map(batch => ({ batch, balance: batchBalances.get(batch.id) || new Prisma.Decimal(0) }))
      .filter(row => row.balance.gt(0))
      .sort((a, b) => {
        const aTime = a.batch.expiryDate ? new Date(a.batch.expiryDate).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.batch.expiryDate ? new Date(b.batch.expiryDate).getTime() : Number.POSITIVE_INFINITY;
        if (aTime !== bTime) return aTime - bTime;
        return new Date(a.batch.createdAt).getTime() - new Date(b.batch.createdAt).getTime();
      })
      .map(({ batch, balance: batchBalance }) => ({
        id: batch.id,
        lotNumber: batch.lotNumber,
        expiryDate: serializeDateOnly(batch.expiryDate),
        nfNumber: batch.nfNumber,
        supplier: batch.supplier,
        balance: decimalBalanceString(batchBalance),
        expired: isExpired(batch.expiryDate, now),
        expiringSoon: isExpiringSoon(batch.expiryDate, now)
      }));

    summary.push({
      item: {
        id: item.id,
        code: item.code,
        name: item.name,
        type: item.type,
        unitLabel: item.unitLabel,
        minQuantity: serializedDecimal(item.minQuantity),
        isActive: item.isActive
      },
      balance: decimalBalanceString(balance),
      belowMin: item.minQuantity !== null && item.minQuantity !== undefined
        ? balance.lt(new Prisma.Decimal(item.minQuantity))
        : false,
      batches
    });
  }

  return summary;
}

export function stockMovementListArgs(query) {
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.pageSize);
  const from = queryDate(query.from);
  const to = queryDate(query.to, true);
  const where = {
    ...(query.itemId ? { itemId: String(query.itemId) } : {}),
    ...(query.type ? { type: String(query.type) } : {}),
    ...(query.reason ? { reason: String(query.reason) } : {}),
    ...(query.projectId ? { projectId: String(query.projectId) } : {}),
    ...((from || to) ? {
      date: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {})
      }
    } : {})
  };

  return {
    where,
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
  };
}

export async function listStockMovements(client, query) {
  const args = stockMovementListArgs(query);
  const [movements, total] = await Promise.all([
    client.stockMovement.findMany({
      where: args.where,
      include: {
        item: true,
        batch: true,
        project: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        reversedBy: { select: { id: true } }
      },
      orderBy: args.orderBy,
      skip: args.skip,
      take: args.take
    }),
    client.stockMovement.count({ where: args.where })
  ]);

  return {
    movements: movements.map(serializeStockMovement),
    total,
    page: args.page,
    pageSize: args.pageSize
  };
}

const itemWithMovementCount = {
  _count: { select: { movements: true } }
};

function itemDataFromPayload(data, fispqToken) {
  return {
    type: data.type,
    code: data.code,
    name: data.name,
    manufacturer: data.manufacturer,
    description: data.description,
    unitLabel: data.unitLabel,
    minQuantity: data.minQuantity,
    location: data.location,
    filterModel: data.filterModel,
    filterKind: data.filterKind,
    filterMicron: data.filterMicron,
    unNumber: data.unNumber,
    casNumber: data.casNumber,
    fispqToken
  };
}

function itemUpdateDataFromPayload(data, fispqToken) {
  return {
    code: data.code,
    name: data.name,
    manufacturer: data.manufacturer,
    description: data.description,
    unitLabel: data.unitLabel,
    minQuantity: data.minQuantity,
    location: data.location,
    filterModel: data.filterModel,
    filterKind: data.filterKind,
    filterMicron: data.filterMicron,
    unNumber: data.unNumber,
    casNumber: data.casNumber,
    fispqToken
  };
}

function isUniqueConstraintError(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function stockCodeExists(code, ignoreId) {
  const existing = await prisma.stockItem.findUnique({ where: { code }, select: { id: true } });
  return Boolean(existing && existing.id !== ignoreId);
}

function syncRomaneioCatalogAfterStockChange() {
  if (process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test') return;
  syncRomaneioCatalog().catch(error => {
    console.warn('Falha ao sincronizar catálogo de romaneio após alteração no estoque.', error);
  });
}

router.get('/itens', asyncHandler(async (req, res) => {
  const includeInactive = parseBoolean(req.query.includeInactive);
  const type = String(req.query.type || '').trim();
  const search = String(req.query.search || '').trim();
  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(type ? { type } : {}),
    ...(search ? {
      OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { unNumber: { contains: search, mode: 'insensitive' } },
        { casNumber: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };

  const items = await prisma.stockItem.findMany({
    where,
    include: itemWithMovementCount,
    orderBy: [{ code: 'asc' }, { name: 'asc' }]
  });
  res.json({ items: items.map(serializeStockItem) });
}));

router.post('/itens', requireEstoqueManager, asyncHandler(async (req, res) => {
  const data = estoqueSchemas.itemCreate.parse(req.body);
  if (await stockCodeExists(data.code)) {
    return res.status(409).json({ error: 'Código de estoque já cadastrado.' });
  }
  const fispqToken = data.type === 'PRODUTO_QUIMICO' && data.fispq
    ? await createStockFispqAttachment({ upload: data.fispq })
    : null;

  try {
    const item = await prisma.stockItem.create({
      data: itemDataFromPayload(data, fispqToken),
      include: itemWithMovementCount
    });
    syncRomaneioCatalogAfterStockChange();
    res.status(201).json(serializeStockItem(item));
  } catch (error) {
    if (fispqToken) await removeStockFispqAttachment(fispqToken);
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Código de estoque já cadastrado.' });
    }
    throw error;
  }
}));

router.put('/itens/:id', requireEstoqueManager, asyncHandler(async (req, res) => {
  const current = await prisma.stockItem.findUnique({
    where: { id: req.params.id },
    include: itemWithMovementCount
  });
  if (!current) return res.status(404).json({ error: 'Item de estoque não encontrado.' });

  const data = estoqueSchemas.itemUpdateForType(current.type).parse(req.body);
  const hasMovements = (current._count?.movements || 0) > 0;
  if (hasMovements && data.unitLabel !== current.unitLabel) {
    return res.status(400).json({ error: 'A unidade não pode ser alterada após movimentações.' });
  }
  if (await stockCodeExists(data.code, current.id)) {
    return res.status(409).json({ error: 'Código de estoque já cadastrado.' });
  }

  let fispqToken = current.fispqToken;
  let tokenToRemove = null;
  if (current.type === 'FILTRO') {
    tokenToRemove = current.fispqToken;
    fispqToken = null;
  } else if (data.fispq === null) {
    tokenToRemove = current.fispqToken;
    fispqToken = null;
  } else if (data.fispq) {
    fispqToken = await createStockFispqAttachment({ upload: data.fispq });
    tokenToRemove = current.fispqToken;
  }

  try {
    const item = await prisma.stockItem.update({
      where: { id: current.id },
      data: itemUpdateDataFromPayload(data, fispqToken),
      include: itemWithMovementCount
    });
    if (tokenToRemove) await removeStockFispqAttachment(tokenToRemove);
    syncRomaneioCatalogAfterStockChange();
    res.json(serializeStockItem(item));
  } catch (error) {
    if (fispqToken && fispqToken !== current.fispqToken) await removeStockFispqAttachment(fispqToken);
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Código de estoque já cadastrado.' });
    }
    throw error;
  }
}));

router.patch('/itens/:id/ativo', requireEstoqueManager, asyncHandler(async (req, res) => {
  const data = estoqueSchemas.activePatch.parse(req.body);
  const item = await prisma.stockItem.update({
    where: { id: req.params.id },
    data: { isActive: data.isActive },
    include: itemWithMovementCount
  });
  syncRomaneioCatalogAfterStockChange();
  res.json(serializeStockItem(item));
}));

router.delete('/itens/:id', requireEstoqueManager, asyncHandler(async (req, res) => {
  const current = await prisma.stockItem.findUnique({
    where: { id: req.params.id },
    include: itemWithMovementCount
  });
  if (!current) return res.status(404).json({ error: 'Item de estoque não encontrado.' });
  if ((current._count?.movements || 0) > 0) {
    return res.status(409).json({ error: 'Item possui movimentações — inative-o.' });
  }

  await prisma.stockItem.delete({ where: { id: current.id } });
  if (current.fispqToken) await removeStockFispqAttachment(current.fispqToken);
  syncRomaneioCatalogAfterStockChange();
  res.status(204).end();
}));

router.get('/resumo', asyncHandler(async (_req, res) => {
  res.json({ summary: await buildStockSummary(prisma) });
}));

router.get('/movimentacoes', asyncHandler(async (req, res) => {
  res.json(await listStockMovements(prisma, req.query));
}));

router.post('/movimentacoes', requireEstoqueManager, asyncHandler(async (req, res) => {
  let result;
  try {
    result = await createMovement(prisma, {
      data: req.body,
      createdById: req.auth.user.id
    });
  } catch (error) {
    if (error?.requiresConfirmation) {
      return res.status(error.statusCode || 422).json({
        error: error.message,
        requiresConfirmation: true
      });
    }
    throw error;
  }
  res.status(201).json({
    ...serializeStockMovement(result.movement),
    balances: {
      item: decimalBalanceString(result.balances.item),
      batch: decimalBalanceString(result.balances.batch)
    }
  });
}));
router.post('/movimentacoes/:id/estorno', requireEstoqueManager, asyncHandler(async (req, res) => {
  const data = estoqueSchemas.reverseMovement.parse(req.body || {});
  const result = await reverseMovement(prisma, {
    movementId: req.params.id,
    notes: data.notes,
    createdById: req.auth.user.id
  });
  res.status(201).json(serializeStockMovement(result.movement));
}));

router.get('/lotes', asyncHandler(async (req, res) => {
  const itemId = String(req.query.itemId || '').trim();
  if (!itemId) return res.status(400).json({ error: 'Informe o item.' });

  const [batches, balances] = await Promise.all([
    prisma.stockBatch.findMany({ where: { itemId } }),
    getBatchBalances(prisma, itemId)
  ]);
  const now = new Date();
  const rows = batches
    .map(batch => {
      const balance = balances.get(batch.id) || new Prisma.Decimal(0);
      return { batch, balance };
    })
    .filter(row => row.balance.gt(0))
    .sort((a, b) => {
      const aTime = a.batch.expiryDate ? new Date(a.batch.expiryDate).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.batch.expiryDate ? new Date(b.batch.expiryDate).getTime() : Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;
      return new Date(a.batch.createdAt).getTime() - new Date(b.batch.createdAt).getTime();
    });

  res.json({
    batches: rows.map(({ batch, balance }) => ({
      id: batch.id,
      lotNumber: batch.lotNumber,
      expiryDate: serializeDateOnly(batch.expiryDate),
      balance: decimalBalanceString(balance),
      expired: batch.expiryDate ? new Date(batch.expiryDate) < now : false
    }))
  });
}));

export default router;
