import express, { Router } from 'express';
import { z } from 'zod';

import { SCOPE_PHOTO_LIMITS, makeComercialSchemas } from '../../../../shared/schemas/comercial.js';
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
import { listarConsultores } from '../../lib/comercial/consultores.js';
import { gravarFoto, lerFoto } from '../../lib/comercial/scope-assets.js';
import { nextProposalNumber, numberingStatus } from '../../lib/comercial/numbering.js';
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
// Fotos dos blocos de conteúdo do escopo
// ---------------------------------------------------------------------------

/**
 * Recebe a foto como **binário cru**, no padrão que este repositório já usa para
 * upload (`acompanhamento-comercial.js`): o `Content-Type` é o tipo da imagem e o
 * nome original vem em `x-file-name`. Evita uma dependência de multipart para
 * receber um arquivo por requisição — o cliente já envia um de cada vez.
 *
 * A cadeia de recusa mora em `scope-assets.js`, com mensagem própria por caso.
 * `express.raw` corta acima do limite de requisição antes de o corpo chegar aqui.
 */
router.post(
  '/escopo/fotos',
  requireComercialEstimator,
  express.raw({
    type: SCOPE_PHOTO_LIMITS.allowedTypes,
    limit: SCOPE_PHOTO_LIMITS.maxRequestBytes
  }),
  asyncHandler(async (req, res) => {
    try {
      // Tipo fora da lista não casa com `express.raw`, e o corpo chega vazio.
      // A distinção importa: "selecione uma foto" e "use JPEG, PNG ou WebP" são
      // problemas diferentes e mandam o usuário para lados diferentes.
      const tipoDeclarado = String(req.headers['content-type'] || '')
        .split(';')[0]
        .trim()
        .toLowerCase();

      if (tipoDeclarado && !SCOPE_PHOTO_LIMITS.allowedTypes.includes(tipoDeclarado)) {
        return res.status(415).json({ error: 'Use uma imagem JPEG, PNG ou WebP.' });
      }

      const foto = await gravarFoto(prisma, {
        bytes: Buffer.isBuffer(req.body) ? req.body : null,
        contentType: tipoDeclarado,
        fileName: req.headers['x-file-name'],
        userId: req.auth.user.id
      });

      return res.status(201).json(foto);
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.get(
  '/escopo/fotos/:id',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const { bytes, contentType, fileName } = await lerFoto(prisma, req.params.id);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      // Imutável: o arquivo tem nome de UUID e nunca é reescrito.
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      return res.send(bytes);
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

// ---------------------------------------------------------------------------
// Consultores de vendas
// ---------------------------------------------------------------------------

/**
 * A lista **varia por papel**: gestor recebe todos, vendedor recebe só a si mesmo.
 * A restrição acontece aqui, na origem — não é o cliente que filtra.
 */
router.get(
  '/consultores',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    res.json(await listarConsultores(prisma, req.auth.user));
  })
);

// ---------------------------------------------------------------------------
// Numeração
// ---------------------------------------------------------------------------

/**
 * O próximo número de proposta. **Consome** — dois pedidos devolvem números
 * diferentes, e um número consumido não volta.
 *
 * `503` enquanto a numeração não tiver sido semeada no ambiente. É recusa
 * deliberada: emitir sem saber o maior número já usado produziria código repetido
 * no documento que chega ao cliente.
 */
router.get(
  '/propostas/proximo-numero',
  requireComercialEstimator,
  asyncHandler(async (req, res) => {
    try {
      const numero = await nextProposalNumber(prisma);
      res.json({ numero });
    } catch (error) {
      if (handleComercialError(error, res)) return;
      throw error;
    }
  })
);

router.get(
  '/numeracao/status',
  requireComercialEstimator,
  asyncHandler(async (_req, res) => {
    res.json(await numberingStatus(prisma));
  })
);

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
