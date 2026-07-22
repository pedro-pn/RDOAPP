export const QUALITY_RECORD_TYPES = ['DESVIO', 'LICAO_APRENDIDA', 'INCIDENTE', 'RECLAMACAO_CLIENTE', 'MELHORIA'];
export const QUALITY_IMPACTS = ['ALTO', 'MEDIO', 'BAIXO'];
export const QUALITY_DISPOSITIONS = ['TRATAR', 'MONITORAR', 'ARQUIVAR_DIVULGAR'];
export const QUALITY_STATUSES = ['ABERTO', 'EM_TRIAGEM', 'EM_OBSERVACAO', 'EM_ACAO', 'FECHADO', 'DIVULGADO'];

export const QUALITY_TYPE_LETTERS = {
  DESVIO: 'D',
  LICAO_APRENDIDA: 'L',
  INCIDENTE: 'I',
  RECLAMACAO_CLIENTE: 'R',
  MELHORIA: 'M'
};

export const QUALITY_TYPE_OPTIONS = [
  { value: 'DESVIO', label: 'Desvio', letter: 'D' },
  { value: 'LICAO_APRENDIDA', label: 'Lição aprendida', letter: 'L' },
  { value: 'INCIDENTE', label: 'Incidente', letter: 'I' },
  { value: 'RECLAMACAO_CLIENTE', label: 'Reclamação de cliente', letter: 'R' },
  { value: 'MELHORIA', label: 'Melhoria', letter: 'M' }
];

export const QUALITY_IMPACT_OPTIONS = [
  { value: 'ALTO', label: 'Alto' },
  { value: 'MEDIO', label: 'Médio' },
  { value: 'BAIXO', label: 'Baixo' }
];

export const QUALITY_DISPOSITION_OPTIONS = [
  { value: 'TRATAR', label: 'Tratar' },
  { value: 'MONITORAR', label: 'Monitorar' },
  { value: 'ARQUIVAR_DIVULGAR', label: 'Arquivar/Divulgar' }
];

export const QUALITY_STATUS_OPTIONS = [
  { value: 'ABERTO', label: 'Aberto' },
  { value: 'EM_TRIAGEM', label: 'Em triagem' },
  { value: 'EM_OBSERVACAO', label: 'Em observação' },
  { value: 'EM_ACAO', label: 'Em ação' },
  { value: 'FECHADO', label: 'Fechado' },
  { value: 'DIVULGADO', label: 'Divulgado' }
];

function optionalText(z, max) {
  let schema = z.string().trim();
  if (Number.isInteger(max)) schema = schema.max(max);
  return z.any().optional().nullable().transform(value => {
    const text = String(value || '').trim();
    return text || null;
  }).pipe(schema.optional().nullable());
}

function requiredText(z, max, message = 'Campo obrigatório.') {
  let schema = z.string().trim().min(1, message);
  if (Number.isInteger(max)) schema = schema.max(max);
  return schema;
}

function dateText(z, message = 'Informe uma data válida.') {
  return z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, message);
}

function optionalDateText(z) {
  return z.any().optional().nullable().transform(value => {
    const text = String(value || '').trim();
    return text || null;
  }).refine(value => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: 'Informe uma data válida.'
  });
}

function recordBaseSchema(z, { includeType = true } = {}) {
  return {
    ...(includeType ? { type: z.enum(QUALITY_RECORD_TYPES) } : {}),
    registeredAt: dateText(z),
    origin: requiredText(z, 180),
    projectId: optionalText(z, 80),
    eventDate: dateText(z),
    natureId: requiredText(z, 80),
    description: requiredText(z, 4000),
    impact: z.enum(QUALITY_IMPACTS),
    linkedRnc: optionalText(z, 120),
    disposition: z.enum(QUALITY_DISPOSITIONS),
    definedAction: optionalText(z, 4000),
    actionOwner: optionalText(z, 180),
    actionDeadline: optionalDateText(z),
    evidence: optionalText(z, 1000),
    resultVerification: optionalText(z, 4000),
    status: z.enum(QUALITY_STATUSES)
  };
}

function recordSchema(z, options = {}) {
  return z.object(recordBaseSchema(z, options)).superRefine((data, ctx) => {
    if (data.disposition === 'TRATAR' && !data.definedAction) {
      ctx.addIssue({
        code: 'custom',
        path: ['definedAction'],
        message: 'Informe a ação definida para disposição Tratar.'
      });
    }
  });
}

function natureSchema(z) {
  return z.object({
    name: requiredText(z, 180)
  });
}

export function makeQualidadeSchemas(z) {
  if (!z?.object || !z?.enum) {
    throw new TypeError('A valid Zod instance is required to build qualidade schemas.');
  }

  return {
    RECORD_TYPES: QUALITY_RECORD_TYPES,
    IMPACTS: QUALITY_IMPACTS,
    DISPOSITIONS: QUALITY_DISPOSITIONS,
    STATUSES: QUALITY_STATUSES,
    TYPE_LETTERS: QUALITY_TYPE_LETTERS,
    typeOptions: QUALITY_TYPE_OPTIONS,
    impactOptions: QUALITY_IMPACT_OPTIONS,
    dispositionOptions: QUALITY_DISPOSITION_OPTIONS,
    statusOptions: QUALITY_STATUS_OPTIONS,
    recordCreate: recordSchema(z),
    recordUpdate: recordSchema(z, { includeType: false }),
    natureCreate: natureSchema(z),
    natureUpdate: natureSchema(z),
    activePatch: z.object({ isActive: z.boolean() })
  };
}
