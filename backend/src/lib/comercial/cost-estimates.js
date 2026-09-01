import { createHash } from "node:crypto";

import {
  calculateEstimate,
  normalizeCostEstimatePayload,
  validateCostEstimate,
} from "../../../../shared/comercial/dist/cost-model.js";

import {
  ConcurrentWriteError,
  actorLabel,
  assertNoConcurrentWrite,
  authorshipFilter,
  canRead,
  canWrite,
  denialReason,
} from "./access.js";

/**
 * Levantamentos de custos — regra de negócio.
 *
 * O motor do cálculo NÃO mora aqui: vem de `shared/comercial`, portado sem
 * alteração da referência congelada e verificado pelos 16 goldens. Este arquivo
 * é encanamento — persistência, versionamento e autoria.
 */

export class ComercialError extends Error {
  constructor(message, statusCode = 400, extra = {}) {
    super(message);
    this.name = "ComercialError";
    this.statusCode = statusCode;
    Object.assign(this, extra);
  }
}

/** Erro de validação do levantamento, com as pendências item a item. */
export class CostEstimateValidationError extends ComercialError {
  constructor(issues) {
    super("O levantamento tem pendências.", 422, { issues });
    this.name = "CostEstimateValidationError";
  }
}

/**
 * Converte a saída de `validateCostEstimate` no formato que a tela consome.
 *
 * A referência concatenava tudo numa string única e jogava fora o `path` — que
 * é justamente o endereço do campo. Nos goldens, o cenário 01 devolve 12 erros
 * de uma vez; grudados num banner, o usuário não sabe a qual campo cada um
 * pertence. É a lacuna L1, e é aqui que ela começa a ser consertada.
 */
export function toFieldIssues(validation) {
  const issues = [];

  for (const item of validation.errors || []) {
    issues.push(normalizeIssue(item, "error"));
  }
  for (const item of validation.warnings || []) {
    issues.push(normalizeIssue(item, "warning"));
  }

  return issues;
}

function normalizeIssue(item, severityFallback) {
  if (typeof item === "string") {
    // Sem `path`, a pendência vira banner e não vira endereço. Preservamos a
    // mensagem, mas registramos que ela não tem campo — quem consumir sabe
    // que precisa mostrá-la no resumo, não ao lado de um controle.
    return { path: null, message: item, severity: severityFallback };
  }
  return {
    path: item.path ?? null,
    message: item.message ?? String(item),
    severity: item.severity ?? severityFallback,
  };
}

export function payloadHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Calcula os totais **no servidor**, a partir do payload.
 *
 * Os valores enviados pelo cliente são ignorados de propósito: aceitar
 * `salePrice` ou `marginPercent` do corpo permitiria forjar margem, e margem
 * forjada vira proposta com preço errado que passa em toda validação. É uma
 * propriedade de segurança, não uma otimização.
 */
export function computeTotals(payload) {
  const normalized = normalizeCostEstimatePayload(payload);
  const result = calculateEstimate(normalized);

  return {
    normalized,
    result,
    totalCost: numberOrZero(result.totalCost),
    salePrice: numberOrZero(result.salePrice),
    // O motor devolve a margem como fração (0,15); o banco guarda percentual.
    marginPercent: numberOrZero(result.margin) * 100,
  };
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Lista os levantamentos que o usuário pode ver.
 *
 * **O filtro de autoria é aplicado aqui, na listagem** — não é ordenação nem
 * preferência, é a restrição. Proteger só a rota de item deixaria o índice
 * devolvendo tudo, que é o vazamento mais provável e o menos visível.
 */
export async function listCostEstimates(
  prisma,
  user,
  { arquivados = false, busca = "", status, page = 1, pageSize = 25 } = {},
) {
  const termo = String(busca || "").trim();
  const pagina = Math.max(1, Number(page) || 1);
  const porPagina = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const where = {
    ...authorshipFilter(user),
    archivedAt: arquivados ? { not: null } : null,
    ...(status ? { status } : {}),
    ...(termo
      ? {
          OR: [
            { proposalCode: { contains: termo, mode: "insensitive" } },
            { title: { contains: termo, mode: "insensitive" } },
            ...(["NOVA", "REVISAO"].includes(termo.toUpperCase())
              ? [{ mode: termo.toUpperCase() }]
              : []),
            ...(["RASCUNHO", "SALVO"].includes(termo.toUpperCase())
              ? [{ status: termo.toUpperCase() }]
              : []),
          ],
        }
      : {}),
  };

  const total = await prisma.costEstimate.count({ where });
  const items = await prisma.costEstimate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (pagina - 1) * porPagina,
    take: porPagina,
    select: {
      id: true,
      proposalCode: true,
      revisionNumber: true,
      title: true,
      mode: true,
      status: true,
      totalCost: true,
      salePrice: true,
      marginPercent: true,
      createdByUserId: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      proposals: {
        where: { archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          proposalCode: true,
          revisionNumber: true,
          updatedAt: true,
        },
      },
    },
  });

  return {
    items: items.map(({ proposals = [], ...item }) => ({
      ...item,
      propostaVinculada: proposals[0] || null,
    })),
    total,
    page: pagina,
    pageSize: porPagina,
  };
}

export async function getCostEstimate(prisma, user, id) {
  const estimate = await prisma.costEstimate.findUnique({ where: { id } });
  if (!estimate) throw new ComercialError("Levantamento não encontrado.", 404);

  // Vendedor pedindo levantamento de outro autor recebe 403, não 404 genérico
  // nem tela vazia: um 404 mentiria sobre a existência do registro.
  if (!canRead(user, estimate)) {
    throw new ComercialError(denialReason(user, estimate), 403);
  }

  return estimate;
}

export async function createCostEstimate(prisma, user, data) {
  const status = data.status === "RASCUNHO" ? "RASCUNHO" : "SALVO";
  if (status === "SALVO") {
    const validation = validateCostEstimate(data.payload);
    if (!validation.valid) {
      throw new CostEstimateValidationError(toFieldIssues(validation));
    }
  }

  const { normalized, totalCost, salePrice, marginPercent } = computeTotals(
    data.payload,
  );

  return prisma.$transaction(async (tx) => {
    const estimate = await tx.costEstimate.create({
      data: {
        proposalCode: data.proposalCode,
        revisionNumber: data.revisionNumber ?? 0,
        title: data.title,
        mode: data.mode,
        status,
        payload: normalized,
        totalCost,
        salePrice,
        marginPercent,
        createdByUserId: user.id,
      },
    });

    // Rascunho é mutável e pode ser salvo a cada avanço. A trilha imutável
    // começa quando ele vira SALVO; caso contrário cada etapa produziria uma
    // falsa "versão final" de um formulário ainda incompleto.
    if (status === "SALVO") {
      await tx.costEstimateVersion.create({
        data: {
          costEstimateId: estimate.id,
          payloadHash: payloadHash(normalized),
          snapshot: normalized,
        },
      });
    }

    return estimate;
  });
}

export async function updateCostEstimate(prisma, user, id, data) {
  const existing = await prisma.costEstimate.findUnique({ where: { id } });
  if (!existing) throw new ComercialError("Levantamento não encontrado.", 404);
  if (!canWrite(user, existing)) {
    throw new ComercialError(denialReason(user, existing), 403);
  }
  if (existing.archivedAt) {
    throw new ComercialError(
      "Levantamento arquivado. Desarquive antes de editar.",
      409,
    );
  }
  const protegerVersao = assertNoConcurrentWrite(existing, data);

  const payload = data.payload ?? existing.payload;
  const status = data.status ?? existing.status ?? "SALVO";
  if (status === "SALVO") {
    const validation = validateCostEstimate(payload);
    if (!validation.valid) {
      throw new CostEstimateValidationError(toFieldIssues(validation));
    }
  }

  const { normalized, totalCost, salePrice, marginPercent } =
    computeTotals(payload);
  const hash = payloadHash(normalized);

  try {
    return await prisma.$transaction(async (tx) => {
      const estimate = await tx.costEstimate.update({
        // O `updatedAt` fecha atomicamente a janela entre a leitura e a escrita.
        where: protegerVersao ? { id, updatedAt: existing.updatedAt } : { id },
        data: {
          title: data.title ?? existing.title,
          status,
          payload: normalized,
          totalCost,
          salePrice,
          marginPercent,
          updatedByUserId: user.id,
          updatedByLabel: actorLabel(user),
        },
      });

      // Versão nova só quando o conteúdo mudou de verdade. Gravar uma versão por
      // salvamento encheria a tabela de cópias idênticas e tiraria o sentido do hash.
      if (status === "SALVO") {
        const last = await tx.costEstimateVersion.findFirst({
          where: { costEstimateId: id },
          orderBy: { createdAt: "desc" },
          select: { payloadHash: true },
        });

        if (!last || last.payloadHash !== hash) {
          await tx.costEstimateVersion.create({
            data: {
              costEstimateId: id,
              payloadHash: hash,
              snapshot: normalized,
            },
          });
        }
      }

      return estimate;
    });
  } catch (error) {
    if (protegerVersao && error?.code === "P2025") {
      const atual = await prisma.costEstimate.findUnique({ where: { id } });
      if (atual) throw new ConcurrentWriteError(atual);
      throw new ComercialError("Levantamento não encontrado.", 404);
    }
    throw error;
  }
}

export async function archiveCostEstimate(
  prisma,
  user,
  id,
  { archive = true } = {},
) {
  const existing = await prisma.costEstimate.findUnique({ where: { id } });
  if (!existing) throw new ComercialError("Levantamento não encontrado.", 404);
  if (!canWrite(user, existing)) {
    throw new ComercialError(denialReason(user, existing), 403);
  }

  // Arquivar, nunca excluir (FR-060). Não existe DELETE em rota nenhuma do módulo.
  return prisma.costEstimate.update({
    where: { id },
    data: {
      archivedAt: archive ? new Date() : null,
      archivedByUserId: archive ? user.id : null,
    },
  });
}

export async function findByProposalCode(prisma, user, proposalCode) {
  const items = await prisma.costEstimate.findMany({
    where: { proposalCode, ...authorshipFilter(user) },
    orderBy: { revisionNumber: "desc" },
  });
  return items;
}
