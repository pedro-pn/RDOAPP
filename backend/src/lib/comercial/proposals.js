import { canRead, canWrite, denialReason, proposalScopeFilter } from './access.js';
import { resolverConsultor } from './consultores.js';
import { ComercialError } from './cost-estimates.js';
import { lerDinheiro } from './dinheiro.js';

/**
 * Propostas — histórico, revisões e vínculo com o levantamento (tarefa T051).
 *
 * Porte de `db/proposal-history.ts` da referência congelada, com uma diferença
 * de fundo: **lá a proposta só existia depois de finalizada**. O histórico era
 * gravado dentro do `finalize`, e até esse momento o trabalho vivia no
 * formulário e no rascunho do navegador. Aqui a proposta é registro desde o
 * rascunho, e é por isso que existem `criar` e `atualizar` que a referência não
 * tem.
 *
 * O que foi portado sem mudar:
 *
 * - o **número base** sai do código da proposta por expressão regular, e a
 *   revisão seguinte é `max(revisão) + 1` (`getProposalForRevision`);
 * - `snapshotAvailable` responde se dá para recarregar a proposta inteira ou só
 *   os dados do histórico — e a **ausência de snapshot é caminho normal**,
 *   não erro. Proposta antiga não pode falhar (FR-065).
 */

export { ComercialError };

/** Estados em que a proposta ainda aceita edição. */
const EDITAVEL = 'RASCUNHO';

/**
 * O número base do código da proposta.
 *
 * Portado de `saveProposalHistory`: `Number(code.match(/^\d+/))`. O código é
 * texto porque carrega revisão e sufixo ("4418 Rev 2"), mas a ordenação e o
 * agrupamento por proposta precisam do número.
 */
export function numeroBase(proposalCode) {
  return Number(String(proposalCode ?? '').match(/^\d+/)?.[0] || 0);
}

/**
 * O valor total da proposta, calculado **no servidor** a partir dos itens de
 * preço do payload.
 *
 * Não é aceito do cliente pelo mesmo motivo dos totais do levantamento: o número
 * vai para a oportunidade no CRM e para o histórico, e um valor forjado ali não
 * tem como ser conferido depois. `lerDinheiro` é o mesmo do gerador do
 * documento — de propósito, para o histórico não discordar do PDF.
 *
 * **Hidrojateamento soma diferente.** Esse modelo tem duas tabelas de preço,
 * ONSHORE e OFFSHORE, que são cenários **alternativos** de execução: o cliente
 * contrata um ou outro. Somar as duas produziria um total que ninguém vai pagar.
 *
 * Qual das duas vale **é o vendedor quem diz**, em `priceScenario` (T130). O
 * servidor decidia sozinho, pela maior — e o mantenedor apurou que o comum é
 * ONSHORE, que nem sempre é a maior. "A maior" não é uma regra de negócio; era
 * um chute com cara de regra, e o número ia ao CRM e ao histórico.
 *
 * Sem `priceScenario` continua valendo a maior, e isso é para as propostas
 * **já gravadas**: elas não têm o campo, e mudar o critério agora reescreveria o
 * total delas na primeira vez que alguém as reabrisse e salvasse.
 */
export function calcularTotal(payload) {
  const precos = Array.isArray(payload?.prices) ? payload.prices : [];
  if (!precos.length) return 0;

  const porLocal = new Map();
  for (const item of precos) {
    const chave = item?.local || '';
    porLocal.set(chave, (porLocal.get(chave) || 0) + lerDinheiro(item?.value));
  }

  // Uma tabela só (modelo padrão): o total é a soma dela.
  if (porLocal.size <= 1) return [...porLocal.values()][0] || 0;

  const escolhido = String(payload?.priceScenario || '').trim().toUpperCase();
  // Só vale se **existir entre as tabelas**: um cenário que não corresponde a
  // nenhuma delas viraria total zero, e zero passa despercebido.
  if (escolhido && porLocal.has(escolhido)) return porLocal.get(escolhido);

  return Math.max(...porLocal.values());
}

/**
 * Lista as propostas que o usuário pode ver.
 *
 * O alcance vem de `proposalScopeFilter`, **não** de `authorshipFilter`: o papel
 * de consulta enxerga todas as propostas e nenhum valor. A supressão dos valores
 * acontece na serialização da rota (`serializeListForUser`), na origem.
 *
 * A busca é a da referência (`listProposalHistory`), reduzida aos campos que
 * existem aqui: código, cliente, contato e vendedor.
 */
export async function listProposals(prisma, user, { arquivados = false, busca = '' } = {}) {
  const termo = String(busca || '').trim();
  const contains = { contains: termo, mode: 'insensitive' };

  const items = await prisma.proposal.findMany({
    where: {
      ...proposalScopeFilter(user),
      archivedAt: arquivados ? { not: null } : null,
      ...(termo
        ? {
            OR: [
              { proposalCode: contains },
              { clientName: contains },
              { contact: contains },
              { sellerName: contains }
            ]
          }
        : {})
    },
    // A referência ordenava por `base_number DESC, revision DESC`, com o número
    // base numa coluna inteira. Aqui o código é texto, e ordenar texto no banco
    // poria "999" à frente de "4418" no dia em que a numeração passar de quatro
    // dígitos. Então o banco recorta a janela por data — que é a mesma ordem, já
    // que número maior é sempre emitido depois — e a ordenação por número e
    // revisão é aplicada sobre a janela, onde dá para converter.
    orderBy: [{ createdAt: 'desc' }],
    take: 250,
    select: {
      id: true,
      proposalCode: true,
      revisionNumber: true,
      costEstimateId: true,
      clientName: true,
      contact: true,
      email: true,
      sellerUserId: true,
      sellerName: true,
      estimatorName: true,
      status: true,
      totalValue: true,
      finalizedAt: true,
      createdByUserId: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true
      // `payload` fica de fora: a listagem carregaria o formulário inteiro de
      // 250 propostas para mostrar oito colunas.
    }
  });

  items.sort(
    (a, b) =>
      numeroBase(b.proposalCode) - numeroBase(a.proposalCode) ||
      (b.revisionNumber ?? 0) - (a.revisionNumber ?? 0)
  );

  return { items, total: items.length };
}

export async function getProposal(prisma, user, id) {
  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) throw new ComercialError('Proposta não encontrada.', 404);

  // Vendedor pedindo proposta de outro autor recebe 403, não 404: esconder que
  // o registro existe não é a política deste módulo.
  if (!canRead(user, proposal)) {
    throw new ComercialError(denialReason(user, proposal), 403);
  }

  return proposal;
}

/**
 * Vincula a proposta ao levantamento que a originou.
 *
 * Duas recusas, e as duas são para pegar erro cedo:
 *
 * 1. levantamento de outro autor — seria o mesmo vazamento da listagem, por uma
 *    porta lateral;
 * 2. código diferente do da proposta — o levantamento é quem **carimba o
 *    código** que os dois documentos usam. Divergirem significa que um dos dois
 *    está apontando para a proposta errada, e o erro só apareceria na planilha
 *    de custos anexada na finalização, semanas depois.
 */
async function vincularLevantamento(prisma, user, costEstimateId, proposalCode) {
  if (!costEstimateId) return null;

  const estimate = await prisma.costEstimate.findUnique({
    where: { id: costEstimateId },
    select: { id: true, proposalCode: true, createdByUserId: true }
  });

  if (!estimate) {
    throw new ComercialError('O levantamento vinculado não foi encontrado.', 422);
  }
  if (!canRead(user, estimate)) {
    throw new ComercialError('Este levantamento pertence a outro orçamentista.', 403);
  }
  if (
    proposalCode &&
    estimate.proposalCode &&
    numeroBase(estimate.proposalCode) !== numeroBase(proposalCode)
  ) {
    throw new ComercialError(
      `O levantamento vinculado é da proposta ${estimate.proposalCode}, não da ${proposalCode}.`,
      422
    );
  }

  return estimate.id;
}

export async function createProposal(prisma, user, data) {
  const costEstimateId = await vincularLevantamento(
    prisma,
    user,
    data.costEstimateId,
    data.proposalCode
  );

  // O nome do vendedor é gravado junto com o id, e é o do momento da emissão
  // (FR-041a): renomear ou desativar a conta depois não pode reescrever a
  // proposta que já foi ao cliente.
  const { sellerUserId, sellerName } = await resolverConsultor(
    prisma,
    user,
    data.sellerUserId
  );

  const payload = data.payload ?? {};

  try {
    return await prisma.proposal.create({
      data: {
        proposalCode: data.proposalCode,
        revisionNumber: data.revisionNumber ?? 0,
        costEstimateId,
        clientName: data.clientName,
        cnpj: data.cnpj,
        contact: data.contact,
        email: data.email,
        site: data.site,
        department: data.department ?? null,
        sellerUserId,
        sellerName,
        estimatorName: user.name || user.username || '',
        payload,
        totalValue: calcularTotal(payload),
        createdByUserId: user.id
      }
    });
  } catch (error) {
    throw traduzirColisao(error, data);
  }
}

/**
 * Código + revisão são únicos no banco. A colisão vira 409 com o texto do caso,
 * e não o erro cru do Prisma: duas pessoas revisando a mesma proposta ao mesmo
 * tempo é situação real, e "já existe" é o que a pessoa precisa ler.
 */
function traduzirColisao(error, data) {
  if (error?.code === 'P2002') {
    return new ComercialError(
      `Já existe a revisão ${data.revisionNumber ?? 0} da proposta ${data.proposalCode}.`,
      409
    );
  }
  return error;
}

export async function updateProposal(prisma, user, id, data) {
  const existing = await prisma.proposal.findUnique({ where: { id } });
  if (!existing) throw new ComercialError('Proposta não encontrada.', 404);
  if (!canWrite(user, existing)) {
    throw new ComercialError(denialReason(user, existing), 403);
  }
  if (existing.archivedAt) {
    throw new ComercialError('Proposta arquivada. Desarquive antes de editar.', 409);
  }
  // Proposta finalizada não volta a ser editável. Os dois PDFs já foram gerados
  // e podem já estar com o cliente; deixar o registro mudar por baixo faria o
  // sistema afirmar uma coisa e o documento impresso, outra. O caminho para
  // mudar proposta emitida é **revisar** — que gera código novo.
  if (existing.status !== EDITAVEL) {
    throw new ComercialError(
      'Proposta já finalizada. Crie uma revisão para alterá-la.',
      409
    );
  }

  const costEstimateId =
    data.costEstimateId === undefined
      ? existing.costEstimateId
      : await vincularLevantamento(prisma, user, data.costEstimateId, existing.proposalCode);

  // O consultor só é reavaliado quando o corpo o menciona — e aí passa pela
  // mesma regra da criação: vendedor não emite em nome de outro.
  const consultor =
    data.sellerUserId === undefined
      ? { sellerUserId: existing.sellerUserId, sellerName: existing.sellerName }
      : await resolverConsultor(prisma, user, data.sellerUserId);

  const payload = data.payload ?? existing.payload;

  return prisma.proposal.update({
    where: { id },
    data: {
      // `proposalCode` e `revisionNumber` NÃO entram: o código vem da numeração
      // que já foi consumida, e trocá-lo depois desfaria o vínculo com o
      // levantamento, com os documentos e com o número reservado.
      costEstimateId,
      clientName: data.clientName ?? existing.clientName,
      cnpj: data.cnpj ?? existing.cnpj,
      contact: data.contact ?? existing.contact,
      email: data.email ?? existing.email,
      site: data.site ?? existing.site,
      department: data.department === undefined ? existing.department : data.department,
      sellerUserId: consultor.sellerUserId,
      sellerName: consultor.sellerName,
      payload,
      totalValue: calcularTotal(payload)
    }
  });
}

export async function archiveProposal(prisma, user, id, { archive = true } = {}) {
  const existing = await prisma.proposal.findUnique({ where: { id } });
  if (!existing) throw new ComercialError('Proposta não encontrada.', 404);
  if (!canWrite(user, existing)) {
    throw new ComercialError(denialReason(user, existing), 403);
  }

  // Arquivar, nunca excluir (FR-060). Não existe DELETE em rota nenhuma.
  return prisma.proposal.update({
    where: { id },
    data: {
      archivedAt: archive ? new Date() : null,
      archivedByUserId: archive ? user.id : null
    }
  });
}

/**
 * O que a tela precisa para abrir uma **revisão** da proposta `proposalCode`.
 *
 * Porte de `getProposalForRevision`. A regra que precisa sobreviver ao porte é
 * a do snapshot: procura-se o payload da revisão mais nova para trás, e a
 * primeira não-vazia vence. Proposta antiga, gravada antes de existir snapshot,
 * responde `snapshotAvailable: false` — e isso é **caminho normal**, com a
 * mensagem "Dados disponíveis no histórico carregados". Tratar como erro faria
 * a revisão de proposta antiga ser impossível (FR-065).
 */
export async function proximaRevisao(prisma, user, proposalCode) {
  const base = numeroBase(proposalCode);

  const revisoes = await prisma.proposal.findMany({
    where: { proposalCode, ...proposalScopeFilter(user) },
    orderBy: [{ revisionNumber: 'desc' }, { updatedAt: 'desc' }]
  });

  if (!revisoes.length) {
    throw new ComercialError(
      `A proposta ${proposalCode} não foi encontrada no histórico.`,
      404
    );
  }

  const ultima = revisoes[0];
  const comSnapshot = revisoes.find(item => temConteudo(item.payload));

  return {
    baseNumber: base,
    proposalCode: ultima.proposalCode,
    nextRevision: Math.max(...revisoes.map(item => Number(item.revisionNumber) || 0)) + 1,
    snapshot: comSnapshot ? comSnapshot.payload : {},
    snapshotAvailable: Boolean(comSnapshot),
    costEstimateId: ultima.costEstimateId,
    sellerUserId: ultima.sellerUserId,
    sellerName: ultima.sellerName
  };
}

function temConteudo(payload) {
  return Boolean(payload) && typeof payload === 'object' && Object.keys(payload).length > 0;
}
