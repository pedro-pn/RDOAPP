import { z } from 'zod';

import prisma from './prisma.js';
import { statisticsProjectsCache } from './resource-list-cache.js';

const requiredText = (label, max) => z.string()
  .trim()
  .min(1, `${label} é obrigatório.`)
  .max(max, `${label} deve ter no máximo ${max} caracteres.`);

const cnpjSchema = z.string()
  .trim()
  .min(1, 'CNPJ é obrigatório.')
  .max(64, 'CNPJ deve ter no máximo 64 caracteres.')
  .transform(value => value.replace(/\D/g, ''))
  .refine(value => value.length === 14, 'CNPJ deve conter exatamente 14 dígitos.');

export const projectIntakeSchema = z.object({
  code: requiredText('Número do projeto', 80),
  name: requiredText('Nome do projeto', 240),
  clientName: requiredText('Cliente', 240),
  clientCnpj: cnpjSchema,
  contractCode: requiredText('Contrato', 160),
  location: requiredText('Local', 240)
}).strict('O payload contém campos não reconhecidos.');

export const projectIntakePublicSelect = {
  id: true,
  code: true,
  name: true,
  clientName: true,
  clientCnpj: true,
  contractCode: true,
  location: true,
  registrationPending: true
};

const PROJECT_INTAKE_COMPARISON_FIELDS = [
  'code',
  'name',
  'clientName',
  'clientCnpj',
  'contractCode',
  'location'
];

export class ProjectIntakeConflictError extends Error {
  constructor() {
    super('O número do projeto já está em uso com dados diferentes.');
    this.name = 'ProjectIntakeConflictError';
    this.code = 'PROJECT_CODE_CONFLICT';
    this.statusCode = 409;
  }
}

export function projectIntakeCreateData(data) {
  return {
    ...data,
    isActive: true,
    visibleToCollaborators: false,
    managerOnly: false,
    registrationPending: true,
    inhibitionServiceEnabled: false,
    requireServiceReportSignatures: false,
    clientEmailPrimary: '',
    clientSignerFirstName: '',
    clientSignerLastName: '',
    clientEmailCc: [],
    clientSigners: []
  };
}

function normalizedComparableProject(project) {
  return {
    code: String(project?.code || '').trim(),
    name: String(project?.name || '').trim(),
    clientName: String(project?.clientName || '').trim(),
    clientCnpj: String(project?.clientCnpj || '').replace(/\D/g, ''),
    contractCode: String(project?.contractCode || '').trim(),
    location: String(project?.location || '').trim()
  };
}

export function projectMatchesIntake(project, intake) {
  const comparableProject = normalizedComparableProject(project);
  return PROJECT_INTAKE_COMPARISON_FIELDS.every(field => comparableProject[field] === intake[field]);
}

function resolveExistingProject(project, intake) {
  if (!projectMatchesIntake(project, intake)) {
    throw new ProjectIntakeConflictError();
  }
  statisticsProjectsCache.clear();
  return { status: 'already_exists', project };
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

export async function receiveProjectIntake(rawInput, client = prisma) {
  const intake = projectIntakeSchema.parse(rawInput || {});
  const existing = await client.project.findUnique({
    where: { code: intake.code },
    select: projectIntakePublicSelect
  });

  if (existing) return resolveExistingProject(existing, intake);

  try {
    const project = await client.project.create({
      data: projectIntakeCreateData(intake),
      select: projectIntakePublicSelect
    });
    statisticsProjectsCache.clear();
    return { status: 'created', project };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const concurrentProject = await client.project.findUnique({
      where: { code: intake.code },
      select: projectIntakePublicSelect
    });
    if (!concurrentProject) throw error;
    return resolveExistingProject(concurrentProject, intake);
  }
}
