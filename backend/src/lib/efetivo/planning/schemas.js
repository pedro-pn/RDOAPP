import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const dateOnlySchema = z.string().regex(datePattern, 'Use o formato AAAA-MM-DD.').refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Informe uma data válida.');

export const idSchema = z.string().trim().min(1).max(100);
export const optionalIdSchema = idSchema.nullable().optional();
export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, 'Informe uma cor hexadecimal válida.');
export const absenceTypeSchema = z.enum(['FERIAS', 'FOLGA', 'AFASTAMENTO']);
export const missionScheduleStatusSchema = z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']);
export const missionStageSchema = z.enum(['STANDBY', 'MOBILIZATION', 'EXECUTION', 'FINAL_MEASUREMENT', 'FINISHED']);

export const datePositionQuerySchema = z.object({
  date: dateOnlySchema,
  jobRoleId: idSchema.optional()
});

export const intervalQuerySchema = z.object({
  startDate: dateOnlySchema,
  endDate: dateOnlySchema,
  jobRoleId: idSchema.optional()
}).refine(value => value.endDate >= value.startDate, {
  path: ['endDate'],
  message: 'A data final não pode ser anterior à inicial.'
}).refine(value => {
  const start = new Date(`${value.startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${value.endDate}T00:00:00.000Z`).getTime();
  return (end - start) / 86_400_000 <= 370;
}, {
  path: ['endDate'],
  message: 'Consulte no máximo 371 dias por vez.'
});

export const collaboratorInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  jobRoleId: idSchema,
  admissionDate: dateOnlySchema,
  terminationDate: dateOnlySchema.nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional()
}).refine(value => !value.terminationDate || value.terminationDate >= value.admissionDate, {
  path: ['terminationDate'],
  message: 'O desligamento não pode ser anterior à admissão.'
});

const absenceInputFields = {
  collaboratorId: idSchema,
  type: absenceTypeSchema,
  startDate: dateOnlySchema,
  endDate: dateOnlySchema,
  note: z.string().trim().max(1000).nullable().optional()
};

function validAbsencePeriod(value) {
  return !value.startDate || !value.endDate || value.endDate >= value.startDate;
}

export const absenceInputSchema = z.object(absenceInputFields).refine(validAbsencePeriod, {
  path: ['endDate'],
  message: 'A data final não pode ser anterior à inicial.'
});

export const absenceUpdateSchema = z.object(absenceInputFields).partial()
  .refine(value => Object.keys(value).length > 0, 'Informe ao menos uma alteração.')
  .refine(validAbsencePeriod, {
    path: ['endDate'],
    message: 'A data final não pode ser anterior à inicial.'
  });

export const demandInputSchema = z.object({
  jobRoleId: idSchema,
  requiredCount: z.coerce.number().int().min(0).max(1000)
});

export const missionInputSchema = z.object({
  planId: idSchema.optional(),
  projectId: idSchema,
  scheduleStatus: missionScheduleStatusSchema,
  stage: missionStageSchema,
  headquartersResponsibleUserId: idSchema,
  headquartersResponsibleName: z.string().trim().min(1).max(160),
  headquartersResponsibleRole: z.string().trim().min(1).max(120),
  headquartersResponsibleCollaboratorId: optionalIdSchema,
  mobilizationDate: dateOnlySchema,
  executionStartDate: dateOnlySchema,
  executionEndDate: dateOnlySchema,
  returnDate: dateOnlySchema,
  collaboratorIds: z.array(idSchema).max(500).refine(
    values => new Set(values).size === values.length,
    'Cada colaborador deve aparecer uma única vez na equipe.'
  )
});

export const allocationInputSchema = z.object({
  collaboratorId: idSchema,
  jobRoleId: idSchema
});

export const stageInputSchema = z.object({
  stage: missionStageSchema,
  order: z.coerce.number().int().min(0)
});

// Contratação hipotética informada já na criação do cenário; quantidade 0 significa "sem contratação".
export const initialHireSchema = z.object({
  jobRoleId: idSchema,
  quantity: z.coerce.number().int().min(0).max(1000),
  availableFrom: dateOnlySchema
});

export const scenarioInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  objective: z.string().trim().max(1000).nullable().optional(),
  initialHire: initialHireSchema.nullable().optional()
});

export const plannedHireInputSchema = z.object({
  jobRoleId: idSchema,
  quantity: z.coerce.number().int().min(1).max(1000),
  availableFrom: dateOnlySchema
});


export const holidayInputSchema = z.object({
  holidayDate: dateOnlySchema,
  name: z.string().trim().min(1).max(160)
});

export const jobRolePlanningInputSchema = z.object({
  isOperational: z.boolean().optional(),
  calendarColor: hexColorSchema.optional(),
  continuousWorkLimitDays: z.coerce.number().int().min(1).max(365).nullable().optional()
}).refine(value => Object.keys(value).length > 0, 'Informe ao menos uma alteração.');

export const planningSettingsInputSchema = z.object({
  plannedUtilizationTarget: z.coerce.number().min(0).max(100)
});
