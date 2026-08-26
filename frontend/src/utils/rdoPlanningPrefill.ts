import { z } from 'zod';

export const rdoWorkforceJustificationSchema = z.object({
  requiresJustification: z.boolean(),
  workforceJustification: z.string().trim().max(2000, 'Use até 2.000 caracteres.')
}).superRefine((value, context) => {
  if (value.requiresJustification && !value.workforceJustification) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['workforceJustification'],
      message: 'Justifique o trabalho registrado durante o afastamento.'
    });
  }
});

export interface RdoPlanningPrefillInput {
  currentCollaboratorIds: string[];
  touched: boolean;
  missionCollaboratorIds?: string[];
  lastReportCollaboratorIds?: string[];
}

export function resolveRdoCollaboratorPrefill(input: RdoPlanningPrefillInput) {
  if (input.touched) return { collaboratorIds: input.currentCollaboratorIds, source: 'TOUCHED' as const };
  if (input.currentCollaboratorIds.length) return { collaboratorIds: input.currentCollaboratorIds, source: 'CURRENT' as const };
  if (input.missionCollaboratorIds?.length) {
    return { collaboratorIds: [...new Set(input.missionCollaboratorIds)], source: 'MISSION' as const };
  }
  return {
    collaboratorIds: [...new Set(input.lastReportCollaboratorIds || [])],
    source: input.lastReportCollaboratorIds?.length ? 'LAST_REPORT' as const : 'EMPTY' as const
  };
}
