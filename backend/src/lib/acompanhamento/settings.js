/*
 * Configurações globais do módulo Acompanhamento (chave/valor).
 * Custos anuais por colaborador usados no custo de mão de obra.
 */

import prisma from '../prisma.js';

export const EPI_ANNUAL_COST_KEY = 'epiAnnualCost';
export const EPI_ANNUAL_COST_DEFAULT = 5000; // R$/ano por colaborador (média fixa atual)
export const EXAMS_TRAINING_ANNUAL_COST_KEY = 'examsTrainingAnnualCost';
export const OFFSHORE_EXAMS_TRAINING_ANNUAL_COST_KEY = 'offshoreExamsTrainingAnnualCost';
export const EXAMS_TRAINING_ANNUAL_COST_DEFAULT = 0;
export const OFFSHORE_EXAMS_TRAINING_ANNUAL_COST_DEFAULT = 0;

async function getNumberSetting(key, fallback) {
  const row = await prisma.acompanhamentoSetting.findUnique({ where: { key } });
  const value = row?.numberValue;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeMoneySetting(value, label) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) throw new Error(`${label} inválido.`);
  return numberValue;
}

async function setNumberSetting(key, value, updatedByUserId = null) {
  await prisma.acompanhamentoSetting.upsert({
    where: { key },
    create: { key, numberValue: value, updatedByUserId },
    update: { numberValue: value, updatedByUserId }
  });
  return value;
}

export async function getEpiAnnualCost() {
  return getNumberSetting(EPI_ANNUAL_COST_KEY, EPI_ANNUAL_COST_DEFAULT);
}

export async function setEpiAnnualCost(value, updatedByUserId = null) {
  return setNumberSetting(
    EPI_ANNUAL_COST_KEY,
    normalizeMoneySetting(value, 'Valor de EPI'),
    updatedByUserId
  );
}

export async function getAnnualCollaboratorCosts() {
  const [epiAnnualCost, examsTrainingAnnualCost, offshoreExamsTrainingAnnualCost] = await Promise.all([
    getNumberSetting(EPI_ANNUAL_COST_KEY, EPI_ANNUAL_COST_DEFAULT),
    getNumberSetting(EXAMS_TRAINING_ANNUAL_COST_KEY, EXAMS_TRAINING_ANNUAL_COST_DEFAULT),
    getNumberSetting(OFFSHORE_EXAMS_TRAINING_ANNUAL_COST_KEY, OFFSHORE_EXAMS_TRAINING_ANNUAL_COST_DEFAULT)
  ]);
  return { epiAnnualCost, examsTrainingAnnualCost, offshoreExamsTrainingAnnualCost };
}

export async function setAnnualCollaboratorCosts({
  epiAnnualCost,
  examsTrainingAnnualCost,
  offshoreExamsTrainingAnnualCost
}, updatedByUserId = null) {
  const values = {
    epiAnnualCost: normalizeMoneySetting(epiAnnualCost, 'Valor de EPI'),
    examsTrainingAnnualCost: normalizeMoneySetting(examsTrainingAnnualCost, 'Valor de exames e treinamentos'),
    offshoreExamsTrainingAnnualCost: normalizeMoneySetting(offshoreExamsTrainingAnnualCost, 'Valor offshore de exames e treinamentos')
  };
  await prisma.$transaction([
    prisma.acompanhamentoSetting.upsert({
      where: { key: EPI_ANNUAL_COST_KEY },
      create: { key: EPI_ANNUAL_COST_KEY, numberValue: values.epiAnnualCost, updatedByUserId },
      update: { numberValue: values.epiAnnualCost, updatedByUserId }
    }),
    prisma.acompanhamentoSetting.upsert({
      where: { key: EXAMS_TRAINING_ANNUAL_COST_KEY },
      create: { key: EXAMS_TRAINING_ANNUAL_COST_KEY, numberValue: values.examsTrainingAnnualCost, updatedByUserId },
      update: { numberValue: values.examsTrainingAnnualCost, updatedByUserId }
    }),
    prisma.acompanhamentoSetting.upsert({
      where: { key: OFFSHORE_EXAMS_TRAINING_ANNUAL_COST_KEY },
      create: { key: OFFSHORE_EXAMS_TRAINING_ANNUAL_COST_KEY, numberValue: values.offshoreExamsTrainingAnnualCost, updatedByUserId },
      update: { numberValue: values.offshoreExamsTrainingAnnualCost, updatedByUserId }
    })
  ]);
  return values;
}
