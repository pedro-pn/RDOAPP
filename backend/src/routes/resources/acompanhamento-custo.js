/*
 * Motor de custo — perfis de custo (operador/auxiliar), parâmetros versionados e simulador.
 *   GET  /api/acompanhamento/custo/perfis                 lista perfis + parâmetros vigentes
 *   PUT  /api/acompanhamento/custo/perfis/:key/parametros nova versão de parâmetros (gestor)
 *   POST /api/acompanhamento/custo/simular                { profileKey|params, inputs } -> custo
 */

import { Router } from 'express';
import { z } from 'zod';

import asyncHandler from '../../lib/async-handler.js';
import { computeMonthlyCost } from '../../lib/acompanhamento/cost-engine.js';
import prisma from '../../lib/prisma.js';
import { requireAcompanhamentoAccess, requireAcompanhamentoManager, requireAuth } from '../../middleware/auth.js';

const router = Router();

async function latestParams(key) {
  const profile = await prisma.costProfile.findUnique({
    where: { key },
    include: { parameterSets: { orderBy: { version: 'desc' }, take: 1 } }
  });
  if (!profile) return null;
  return { profile, set: profile.parameterSets[0] ?? null };
}

router.get('/perfis', requireAuth, requireAcompanhamentoAccess, asyncHandler(async (_req, res) => {
  // Apenas os perfis-modelo (planilhas base). Perfis por cargo (jobRoleId != null) ficam em /cargos.
  const profiles = await prisma.costProfile.findMany({
    where: { isActive: true, jobRoleId: null },
    orderBy: { label: 'asc' },
    include: { parameterSets: { orderBy: { version: 'desc' }, take: 1 } }
  });
  res.json(profiles.map(p => ({
    id: p.id,
    key: p.key,
    label: p.label,
    version: p.parameterSets[0]?.version ?? null,
    params: p.parameterSets[0]?.params ?? null,
    updatedAt: p.parameterSets[0]?.createdAt ?? p.updatedAt
  })));
}));

const paramsSchema = z.object({ params: z.record(z.any()), note: z.string().optional() });

router.put('/perfis/:key/parametros', requireAuth, requireAcompanhamentoManager, asyncHandler(async (req, res) => {
  const { params, note } = paramsSchema.parse(req.body);
  const current = await latestParams(req.params.key);
  if (!current) return res.status(404).json({ error: 'Perfil de custo não encontrado.' });
  const nextVersion = (current.set?.version ?? 0) + 1;
  const created = await prisma.costParameterSet.create({
    data: {
      costProfileId: current.profile.id,
      version: nextVersion,
      params,
      note: note ?? null,
      createdByUserId: req.auth?.user?.id ?? null
    }
  });
  res.status(201).json({ key: current.profile.key, version: created.version, params: created.params });
}));

const simulateSchema = z.object({
  profileKey: z.string().optional(),
  params: z.record(z.any()).optional(),
  inputs: z.record(z.any()).default({})
});

router.post('/simular', requireAuth, requireAcompanhamentoAccess, asyncHandler(async (req, res) => {
  const { profileKey, params, inputs } = simulateSchema.parse(req.body);
  let effectiveParams = params;
  if (!effectiveParams && profileKey) {
    const current = await latestParams(profileKey);
    if (!current?.set) return res.status(404).json({ error: 'Perfil de custo sem parâmetros.' });
    effectiveParams = current.set.params;
  }
  if (!effectiveParams) return res.status(400).json({ error: 'Informe profileKey ou params.' });
  res.json(computeMonthlyCost(effectiveParams, inputs));
}));

// === Perfil de custo por cargo (um CostProfile por JobRole, criado sob demanda) ===

router.get('/cargos', requireAuth, requireAcompanhamentoAccess, asyncHandler(async (_req, res) => {
  const roles = await prisma.jobRole.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: { costProfile: { include: { parameterSets: { orderBy: { version: 'desc' }, take: 1 } } } }
  });
  res.json(roles.map(role => ({
    jobRoleId: role.id,
    name: role.name,
    profileId: role.costProfile?.id ?? null,
    version: role.costProfile?.parameterSets?.[0]?.version ?? null,
    params: role.costProfile?.parameterSets?.[0]?.params ?? null,
    updatedAt: role.costProfile?.parameterSets?.[0]?.createdAt ?? role.costProfile?.updatedAt ?? null
  })));
}));

router.put('/cargos/:jobRoleId/parametros', requireAuth, requireAcompanhamentoManager, asyncHandler(async (req, res) => {
  const { params, note } = paramsSchema.parse(req.body);
  const role = await prisma.jobRole.findUnique({
    where: { id: req.params.jobRoleId },
    include: { costProfile: { include: { parameterSets: { orderBy: { version: 'desc' }, take: 1 } } } }
  });
  if (!role) return res.status(404).json({ error: 'Cargo não encontrado.' });

  let profile = role.costProfile;
  if (!profile) {
    profile = await prisma.costProfile.create({ data: { key: `role:${role.id}`, label: role.name, jobRoleId: role.id } });
  }
  const currentVersion = role.costProfile?.parameterSets?.[0]?.version ?? 0;
  const created = await prisma.costParameterSet.create({
    data: {
      costProfileId: profile.id,
      version: currentVersion + 1,
      params,
      note: note ?? null,
      createdByUserId: req.auth?.user?.id ?? null
    }
  });
  res.status(201).json({ jobRoleId: role.id, profileId: profile.id, version: created.version, params: created.params });
}));

export default router;
