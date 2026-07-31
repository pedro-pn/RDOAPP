import { Router } from 'express';
import { z } from 'zod';

import { makeComercialSchemas } from '../../../../shared/schemas/comercial.js';
import asyncHandler from '../../lib/async-handler.js';
import { serializeForUser, serializeListForUser } from '../../lib/comercial/access.js';
import {
  ComercialError,
  CostEstimateValidationError,
  archiveCostEstimate,
  createCostEstimate,
  getCostEstimate,
  listCostEstimates,
  updateCostEstimate
} from '../../lib/comercial/cost-estimates.js';
import { comercialStatus } from '../../lib/comercial/service.js';
import prisma from '../../lib/prisma.js';
import {
  requireAuth,
  requireComercialAccess,
  requireComercialEstimator
} from '../../middleware/auth.js';

const router = Router();
const schemas = makeComercialSchemas(z);

router.use(requireAuth);
router.use(requireComercialAccess);

/**
 * Rotas do módulo Comercial.
 *
 * Duas regras que valem para o arquivo inteiro:
 *
 * 1. `requireComercialEstimator` barra o papel de consulta, mas **não sabe de
 *    quem é o registro**. A autoria é verificada na camada de negócio, e a
 *    listagem filtra por autoria lá também — é onde o vazamento entre
 *    vendedores aconteceria.
 *
 * 2. **Não existe `DELETE`.** O módulo arquiva (FR-060).
 */

function handleComercialError(error, res) {
  if (error instanceof CostEstimateValidationError) {
    // Pendências item a item, com o endereço do campo — é o que permite à tela
    // destacar cada campo em vez de despejar tudo num banner único (L1).
    res.status(error.statusCode).json({ error: error.message, issues: error.issues });
    return true;
  }
  if (error instanceof ComercialError) {
    res.status(error.statusCode || 400).json({ error: error.message });
    return true;
  }
  return false;
}

router.get('/status', (_req, res) => {
  res.json(comercialStatus());
});

// ---------------------------------------------------------------------------
// Levantamentos de custos
// ---------------------------------------------------------------------------

router.get(
  '/levantamentos',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    const query = schemas.listQuery.parse(req.query);
    const { items, total } = await listCostEstimates(prisma, req.auth.user, query);
    res.json({ items: serializeListForUser(req.auth.user, items), total });
  })
);

router.post(
  '/levantamentos',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const data = schemas.costEstimateCreate.parse(req.body);
      const estimate = await createCostEstimate(prisma, req.auth.user, data);
      res.status(201).json(serializeForUser(req.auth.user, estimate));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.get(
  '/levantamentos/:id',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const estimate = await getCostEstimate(prisma, req.auth.user, req.params.id);
      res.json(serializeForUser(req.auth.user, estimate));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.put(
  '/levantamentos/:id',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const data = schemas.costEstimateUpdate.parse(req.body);
      const estimate = await updateCostEstimate(prisma, req.auth.user, req.params.id, data);
      res.json(serializeForUser(req.auth.user, estimate));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.post(
  '/levantamentos/:id/arquivar',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const estimate = await archiveCostEstimate(prisma, req.auth.user, req.params.id, {
        archive: true
      });
      res.json(serializeForUser(req.auth.user, estimate));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.post(
  '/levantamentos/:id/desarquivar',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const estimate = await archiveCostEstimate(prisma, req.auth.user, req.params.id, {
        archive: false
      });
      res.json(serializeForUser(req.auth.user, estimate));
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

export default router;
