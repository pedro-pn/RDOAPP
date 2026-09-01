import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  canDownloadDocument,
  canRead,
  canWrite,
  denialReason,
  isEstimator,
} from "./access.js";
import { ComercialError } from "./cost-estimates.js";
import { gravarArquivo, lerArquivo, pastaDaEmissao } from "./storage.js";

/**
 * Emissão dos dois documentos da proposta (tarefa T075).
 *
 * **A ordem é o contrato inteiro desta tarefa** (FR-033): os PDFs são gerados e
 * **gravados em disco antes de qualquer tentativa de integração**. É o que
 * sustenta o FR-034 lá na frente — quando o Nectar ou o SharePoint falharem, os
 * documentos já existem, e a resposta de erro pode dizer que continuam
 * baixáveis. Gerar depois de integrar inverteria isso: a integração passaria e o
 * usuário ficaria sem o arquivo.
 *
 * O gerador entra por parâmetro, e não por `import` direto, por um motivo
 * prático: quem desenha o PDF é o **LibreOffice**, que só existe dentro da
 * imagem do backend. Recebê-lo de fora deixa esta regra — autoria, ordem,
 * gravação, registro — testável em qualquer máquina.
 */

const KINDS = {
  COMERCIAL: {
    tipo: "commercial",
    arquivo: "commercial.pdf",
    rotulo: "Comercial",
  },
  TECNICA: { tipo: "technical", arquivo: "technical.pdf", rotulo: "Técnica" },
};

/**
 * O rótulo que o usuário vê: "4418" ou "4418 Rev 2".
 *
 * Na referência o número da revisão vinha **dentro** do próprio código, que era
 * texto — `saveProposalHistory` o extraía de volta com regex. Aqui código e
 * revisão são colunas separadas, e o rótulo é recomposto para que o nome do
 * arquivo que chega ao cliente continue o mesmo.
 */
export function rotuloDaProposta(proposalCode, revisionNumber) {
  const revisao = Number(revisionNumber) || 0;
  return revisao > 0 ? `${proposalCode} Rev ${revisao}` : String(proposalCode);
}

export function nomeDoArquivo(kind, proposalCode, revisionNumber) {
  const { rotulo } = KINDS[kind] || KINDS.COMERCIAL;
  return `Proposta ${rotulo} - ${rotuloDaProposta(proposalCode, revisionNumber)}.pdf`;
}

/** Contrato público dos documentos, sem expor o caminho interno do arquivo. */
export function descreverDocumentos(proposal, documentos) {
  return documentos.map((documento) => ({
    id: documento.id,
    kind: documento.kind,
    fileName: nomeDoArquivo(
      documento.kind,
      proposal.proposalCode,
      proposal.revisionNumber,
    ),
    byteSize: documento.byteSize,
  }));
}

/**
 * Os dados que o gerador espera, montados do registro — não do corpo da
 * requisição.
 *
 * O payload guarda o formulário inteiro, mas quatro campos são **do registro**,
 * e sobrescrevem o que estiver no payload: código, revisão, vendedor e
 * orçamentista. É o que impede que um payload antigo, salvo antes de o gestor
 * trocar o consultor, imprima o nome errado no documento que vai ao cliente.
 */
export function dadosDoDocumento(proposal) {
  const payload =
    proposal.payload && typeof proposal.payload === "object"
      ? proposal.payload
      : {};

  return {
    ...payload,
    proposalCode: proposal.proposalCode,
    revision: proposal.revisionNumber ? String(proposal.revisionNumber) : "",
    seller: proposal.sellerName,
    estimator: proposal.estimatorName,
  };
}

/**
 * Gera, grava e registra os dois documentos.
 *
 * `gerarPdf(dados, tipo)` devolve os bytes; é `gerarPropostaEmPdf` na rota.
 */
export async function emitirDocumentos(
  prisma,
  user,
  proposalId,
  { gerarPdf } = {},
) {
  if (typeof gerarPdf !== "function") {
    throw new TypeError("emitirDocumentos precisa do gerador de PDF.");
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal) throw new ComercialError("Proposta não encontrada.", 404);
  if (!canWrite(user, proposal)) {
    throw new ComercialError(denialReason(user, proposal), 403);
  }
  if (proposal.archivedAt) {
    throw new ComercialError(
      "Proposta arquivada. Desarquive antes de emitir.",
      409,
    );
  }
  // Já finalizada não reemite: os dois PDFs foram para o cliente e para o CRM,
  // e um par novo com conteúdo diferente circularia com o mesmo número. O
  // caminho é revisar. O estado FINALIZANDO passa, porque é a própria
  // finalização chamando aqui.
  if (proposal.status === "FINALIZADA") {
    throw new ComercialError(
      "Proposta já finalizada. Crie uma revisão para emitir de novo.",
      409,
    );
  }

  const dados = dadosDoDocumento(proposal);
  const pasta = pastaDaEmissao(proposal.proposalCode, randomUUID());

  const gravados = [];
  for (const kind of ["COMERCIAL", "TECNICA"]) {
    const { tipo, arquivo } = KINDS[kind];
    const bytes = await gerarPdf(dados, tipo);

    if (!bytes?.length) {
      throw new ComercialError(
        `A proposta ${KINDS[kind].rotulo} saiu vazia.`,
        500,
      );
    }

    // Disco primeiro, banco depois. Na ordem inversa, uma falha na gravação
    // deixaria no banco um documento que o download não encontra — e o registro
    // pareceria bom até alguém clicar. Arquivo sem registro é só espaço ocupado.
    const { storagePath, byteSize } = await gravarArquivo(
      path.posix.join(pasta, arquivo),
      bytes,
    );
    gravados.push({ kind, storagePath, byteSize });
  }

  const documentos = await prisma.$transaction(
    gravados.map((item) =>
      prisma.proposalDocument.create({
        data: {
          proposalId: proposal.id,
          kind: item.kind,
          storagePath: item.storagePath,
          byteSize: item.byteSize,
        },
      }),
    ),
  );

  return {
    proposalId: proposal.id,
    proposalCode: proposal.proposalCode,
    documentos: descreverDocumentos(proposal, documentos),
  };
}

/**
 * Os documentos vigentes da proposta — o mais recente de cada tipo.
 *
 * Reemitir antes de finalizar cria um par novo em vez de sobrescrever o
 * anterior: **nada é apagado neste módulo**, nem em disco. Então "o documento da
 * proposta" é sempre o último de cada `kind`, e é isto que a finalização envia.
 */
export async function documentosAtuais(prisma, proposalId) {
  const todos = await prisma.proposalDocument.findMany({
    where: { proposalId },
    orderBy: { createdAt: "desc" },
  });

  const porTipo = new Map();
  for (const documento of todos) {
    if (!porTipo.has(documento.kind)) porTipo.set(documento.kind, documento);
  }

  return [...porTipo.values()];
}

/**
 * Baixa um documento já emitido (tarefa T079).
 *
 * **As duas regras são diferentes, e por isso não dá para reusar `canRead` para
 * as três.**
 *
 * - Orçamentista (gestor ou vendedor): vale a **autoria**. Vendedor pedindo
 *   documento de proposta alheia recebe 403, como em toda rota de item.
 * - Consulta: vale o **tipo**. Ele alcança a proposta de qualquer autor — a
 *   listagem é a superfície inteira dele —, mas só a técnica. A comercial traz
 *   tabela de preços, condições de pagamento e valor total: liberá-la
 *   contornaria a restrição de valores por outra porta, e a restrição deixaria
 *   de valer para qualquer um com o link.
 *
 * **A negativa é da rota, não da tela.** Esconder o botão deixaria o arquivo
 * servível para quem montasse a URL na mão.
 */
export async function baixarDocumento(prisma, user, documentId) {
  const documento = await prisma.proposalDocument.findUnique({
    where: { id: documentId },
    include: { proposal: true },
  });
  if (!documento) throw new ComercialError("Documento não encontrado.", 404);

  const proposal = documento.proposal;

  if (isEstimator(user)) {
    if (!canRead(user, proposal)) {
      throw new ComercialError(denialReason(user, proposal), 403);
    }
  } else if (!canDownloadDocument(user, documento)) {
    throw new ComercialError(
      "A proposta comercial traz valores. Você tem acesso apenas à proposta técnica.",
      403,
    );
  }

  return {
    documento,
    proposal,
    bytes: await lerArquivo(documento.storagePath),
    fileName: nomeDoArquivo(
      documento.kind,
      proposal.proposalCode,
      proposal.revisionNumber,
    ),
  };
}
