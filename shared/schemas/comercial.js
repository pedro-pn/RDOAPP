/**
 * Contratos Zod do módulo Comercial.
 *
 * O campo `payload` de `CostEstimate` e de `Proposal` é `Json`, e o padrão de
 * módulo exige contrato validado para campo `Json` — senão vira depósito sem
 * forma, e ninguém descobre que a estrutura mudou até o cálculo sair errado.
 *
 * A validação aqui é de FORMA, não de regra de negócio. A regra vive em
 * `shared/comercial` (portada sem alteração da referência) e é verificada pelos
 * 16 goldens. Duplicar a regra aqui criaria duas verdades — e a segunda
 * divergiria em silêncio.
 */

export const COST_ESTIMATE_MODES = ['LEVANTAR', 'NOVA', 'REVISAR'];
export const COST_ESTIMATE_STATUSES = ['RASCUNHO', 'SALVO'];
export const PROPOSAL_STATUSES = [
  'RASCUNHO',
  'FINALIZANDO',
  'FINALIZADA',
  'FALHA_INTEGRACAO'
];
export const PROPOSAL_DOCUMENT_KINDS = ['COMERCIAL', 'TECNICA'];
export const SALES_ATTRIBUTION_KINDS = ['REPRESENTANTE', 'INDICACAO'];

/** Seções do levantamento, na ordem da referência (app/custos/page.tsx:54-59). */
export const COST_SECTIONS = [
  { value: 'premises', label: 'Premissas' },
  { value: 'labor', label: 'Mão de obra' },
  { value: 'inputs', label: 'Materiais e insumos' },
  { value: 'logistics', label: 'Mob. e desmob.' },
  { value: 'summary', label: 'Resumo e QQP' }
];

/** Etapas do assistente de proposta, na ordem da referência (app/page.tsx:92). */
export const PROPOSAL_STEPS = [
  'Cliente',
  'Escopo',
  'Responsabilidades',
  'Prazos',
  'Técnica',
  'Comercial',
  'Revisão'
];

/**
 * Limites dos blocos de conteúdo do escopo.
 * Vêm de `app/scope-content.ts:37-41` da referência congelada — não são
 * escolha nossa, são paridade.
 */
export const SCOPE_LIMITS = {
  photos: 8,
  tables: 8,
  tableColumns: 6,
  tableRows: 40,
  tableCellCharacters: 300,
  captionCharacters: 240
};

/** Limites do upload de foto de escopo (app/api/scope-assets/route.ts). */
export const SCOPE_PHOTO_LIMITS = {
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  /** Depois da otimização no cliente. */
  maxBytes: 1_500_000,
  /** Corpo inteiro da requisição. */
  maxRequestBytes: 2_000_000,
  /** Arquivo original, antes de otimizar. */
  maxOriginalBytes: 10_000_000,
  maxMegapixels: 24,
  /** Maior lado, depois do redimensionamento. */
  maxEdgePixels: 1600
};

/**
 * Assinaturas de bytes aceitas, por tipo declarado.
 *
 * Confiar no `Content-Type` é confiar em quem envia: um arquivo qualquer
 * renomeado para `.jpg` chega com `image/jpeg`. A referência já checava isto
 * (`matchesImageSignature`), e o porte mantém.
 */
export const IMAGE_SIGNATURES = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  // WebP: "RIFF" .... "WEBP" — os bytes 8..11 são checados à parte.
  'image/webp': [[0x52, 0x49, 0x46, 0x46]]
};

export function matchesImageSignature(bytes, contentType) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const signatures = IMAGE_SIGNATURES[contentType];
  if (!signatures) return false;

  const matchesPrefix = signatures.some(signature =>
    signature.every((byte, index) => view[index] === byte)
  );
  if (!matchesPrefix) return false;

  if (contentType === 'image/webp') {
    // "WEBP" nos bytes 8..11 — sem isso, qualquer RIFF (áudio, vídeo) passaria.
    return view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50;
  }

  return true;
}

export function makeComercialSchemas(z) {
  if (!z?.object || !z?.enum) {
    throw new TypeError('A valid Zod instance is required to build comercial schemas.');
  }

  const money = z.union([z.number(), z.string()]);
  const id = z.string().trim().min(1);

  /**
   * O payload do levantamento é validado como objeto com `schemaVersion`.
   * Não replicamos a estrutura interna: ela tem ~40 coleções aninhadas e é
   * `normalizeCostEstimatePayload` do cost-model que a normaliza — replicá-la
   * aqui seria a segunda verdade que este arquivo existe para evitar.
   */
  const costEstimatePayload = z
    .object({ schemaVersion: z.union([z.number(), z.string()]).optional() })
    .passthrough();

  const proposalPayload = z.object({}).passthrough();

  const costEstimateCreate = z.object({
    proposalCode: z.string().trim().min(1).max(40),
    revisionNumber: z.number().int().min(0).default(0),
    title: z.string().trim().min(1).max(200),
    mode: z.enum(COST_ESTIMATE_MODES),
    payload: costEstimatePayload
    // totalCost, salePrice e marginPercent NÃO entram: são recalculados no
    // servidor com calculateEstimate. Aceitar do cliente permitiria forjar margem.
  });

  const scopeTableBlock = z.object({
    id,
    type: z.literal('table'),
    title: z.string().max(120).default(''),
    columns: z.array(z.string().max(80)).min(2).max(SCOPE_LIMITS.tableColumns),
    rows: z
      .array(z.array(z.string().max(SCOPE_LIMITS.tableCellCharacters)))
      .max(SCOPE_LIMITS.tableRows)
  });

  const scopePhotoBlock = z.object({
    id,
    type: z.literal('photo'),
    assetId: id,
    caption: z.string().max(SCOPE_LIMITS.captionCharacters).default(''),
    fileName: z.string().max(255).default('')
  });

  const scopeContentBlocks = z
    .array(z.discriminatedUnion('type', [scopeTableBlock, scopePhotoBlock]))
    .superRefine((blocks, ctx) => {
      const photos = blocks.filter(block => block.type === 'photo').length;
      const tables = blocks.filter(block => block.type === 'table').length;
      if (photos > SCOPE_LIMITS.photos) {
        ctx.addIssue({
          code: 'custom',
          message: `A proposta aceita até ${SCOPE_LIMITS.photos} fotos no escopo.`
        });
      }
      if (tables > SCOPE_LIMITS.tables) {
        ctx.addIssue({
          code: 'custom',
          message: `A proposta aceita até ${SCOPE_LIMITS.tables} tabelas no escopo.`
        });
      }
    });

  const proposalCreate = z.object({
    proposalCode: z.string().trim().min(1).max(40),
    revisionNumber: z.number().int().min(0).default(0),
    costEstimateId: id.nullable().optional(),
    clientName: z.string().trim().min(1).max(200),
    cnpj: z.string().trim().min(1).max(20),
    contact: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(200),
    site: z.string().trim().min(1).max(300),
    department: z.string().trim().max(200).optional().nullable(),
    sellerUserId: id,
    payload: proposalPayload,
    totalValue: money
  });

  return {
    MODES: COST_ESTIMATE_MODES,
    COST_STATUSES: COST_ESTIMATE_STATUSES,
    PROPOSAL_STATUSES,
    DOCUMENT_KINDS: PROPOSAL_DOCUMENT_KINDS,
    ATTRIBUTION_KINDS: SALES_ATTRIBUTION_KINDS,
    SECTIONS: COST_SECTIONS,
    STEPS: PROPOSAL_STEPS,
    SCOPE_LIMITS,
    SCOPE_PHOTO_LIMITS,

    costEstimatePayload,
    costEstimateCreate,
    costEstimateUpdate: costEstimateCreate.partial({ mode: true }),
    scopeContentBlocks,
    proposalCreate,
    proposalUpdate: proposalCreate.partial(),

    /** Listagem: o filtro de arquivados é explícito, nunca implícito. */
    listQuery: z.object({
      arquivados: z.coerce.boolean().default(false)
    })
  };
}
