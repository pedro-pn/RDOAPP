/*
 * Configurações globais do módulo Acompanhamento (chave/valor).
 * Hoje: custo de EPI por colaborador (média fixa anual), usado no custo de mão de obra.
 */

import prisma from '../prisma.js';

export const EPI_ANNUAL_COST_KEY = 'epiAnnualCost';
export const EPI_ANNUAL_COST_DEFAULT = 5000; // R$/ano por colaborador (média fixa atual)

export async function getEpiAnnualCost() {
  const row = await prisma.acompanhamentoSetting.findUnique({ where: { key: EPI_ANNUAL_COST_KEY } });
  const value = row?.numberValue;
  return typeof value === 'number' && Number.isFinite(value) ? value : EPI_ANNUAL_COST_DEFAULT;
}

export async function setEpiAnnualCost(value, updatedByUserId = null) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) throw new Error('Valor de EPI inválido.');
  await prisma.acompanhamentoSetting.upsert({
    where: { key: EPI_ANNUAL_COST_KEY },
    create: { key: EPI_ANNUAL_COST_KEY, numberValue, updatedByUserId },
    update: { numberValue, updatedByUserId }
  });
  return numberValue;
}
