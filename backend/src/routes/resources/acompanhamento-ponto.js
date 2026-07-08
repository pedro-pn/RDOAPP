/*
 * Módulo Acompanhamento — importação manual do ponto (Pontomais) e custo de mão de obra (HH).
 *
 *   POST /api/acompanhamento/ponto/import        envio do .xlsx (gestor) — cru (application/octet-stream)
 *   GET  /api/acompanhamento/ponto/imports       histórico de importações
 *   GET  /api/acompanhamento/ponto/colaboradores custo/hora do período vigente + não-vinculados
 *   POST /api/acompanhamento/ponto/vincular      { normalizedName, rawName?, collaboratorId } (gestor)
 *
 * Substitui a integração automática com o VR Ponto Mais enquanto ela não existe.
 */

import express, { Router } from 'express';
import { z } from 'zod';

import asyncHandler from '../../lib/async-handler.js';
import { importPonto, linkPontoName } from '../../lib/acompanhamento/ponto-import.js';
import { computeCollaboratorRates } from '../../lib/acompanhamento/labor-cost.js';
import prisma from '../../lib/prisma.js';
import { requireAcompanhamentoAccess, requireAcompanhamentoManager, requireAuth } from '../../middleware/auth.js';

const router = Router();

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB (o export real tem ~centenas de KB)

// Recebe o .xlsx como binário cru (curl --data-binary @arquivo ou fetch com body do File).
router.post(
  '/import',
  requireAuth,
  requireAcompanhamentoManager,
  express.raw({
    type: [
      'application/octet-stream',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ],
    limit: MAX_FILE_BYTES
  }),
  asyncHandler(async (req, res) => {
    const buffer = req.body;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return res.status(400).json({ error: 'Corpo vazio. Envie o .xlsx do ponto como application/octet-stream.' });
    }
    const fileName = String(req.headers['x-file-name'] || 'PontoMais_resumo.xlsx');
    try {
      const summary = await importPonto({ buffer, fileName, importedByUserId: req.auth?.user?.id ?? null });
      return res.status(summary.skippedDuplicate ? 200 : 201).json(summary);
    } catch (error) {
      return res.status(422).json({ error: `Falha ao importar o ponto: ${error.message}` });
    }
  })
);

router.get(
  '/imports',
  requireAuth,
  requireAcompanhamentoManager,
  asyncHandler(async (req, res) => {
    const take = Math.min(Number(req.query.limit) || 50, 200);
    const imports = await prisma.pontoImport.findMany({ orderBy: { createdAt: 'desc' }, take });
    res.json(imports);
  })
);

// Exclui um import do ponto (e seus resumos, via cascade). Gestor.
router.delete(
  '/imports/:id',
  requireAuth,
  requireAcompanhamentoManager,
  asyncHandler(async (req, res) => {
    try {
      await prisma.pontoImport.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: 'Importação não encontrada.' });
    }
  })
);

router.get(
  '/colaboradores',
  requireAuth,
  requireAcompanhamentoAccess,
  asyncHandler(async (req, res) => {
    const { pontoImport, rates } = await computeCollaboratorRates();
    const unmatched = pontoImport?.summary?.unmatched ?? [];
    res.json({
      importId: pontoImport?.id ?? null,
      periodStart: pontoImport?.periodStart ?? null,
      periodEnd: pontoImport?.periodEnd ?? null,
      fileName: pontoImport?.fileName ?? null,
      rates,
      unmatched
    });
  })
);

// Colaboradores ativos para o seletor de reconciliação (vincular nome do ponto → colaborador).
router.get(
  '/colaboradores-ativos',
  requireAuth,
  requireAcompanhamentoAccess,
  asyncHandler(async (_req, res) => {
    const collaborators = await prisma.collaborator.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: true }
    });
    res.json(collaborators);
  })
);

const linkSchema = z.object({
  normalizedName: z.string().trim().min(1).optional(),
  rawName: z.string().trim().min(1).optional(),
  collaboratorId: z.string().trim().min(1)
}).refine(data => data.normalizedName || data.rawName, { message: 'Informe normalizedName ou rawName.' });

router.post(
  '/vincular',
  requireAuth,
  requireAcompanhamentoManager,
  asyncHandler(async (req, res) => {
    const data = linkSchema.parse(req.body);
    try {
      const result = await linkPontoName({ ...data, createdByUserId: req.auth?.user?.id ?? null });
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  })
);

export default router;
