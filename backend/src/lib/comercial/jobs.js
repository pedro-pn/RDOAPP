import { canFinalize, denialReason } from './access.js';
import { ComercialError } from './cost-estimates.js';
import { documentosAtuais, emitirDocumentos } from './documentos.js';
import * as nectar from './nectar.js';
import { lerArquivo } from './storage.js';

/**
 * Finalização da proposta (tarefas T076, T077, T078, T079a e T080).
 *
 * **A ordem é o contrato**, e ela é a razão de este arquivo existir:
 *
 *   1. confere se pode finalizar — autoria (T078) e exclusividade (T079a),
 *      **antes de gerar qualquer coisa**;
 *   2. gera e GRAVA os dois PDFs;
 *   3. só então tenta as integrações.
 *
 * Invertendo 2 e 3, uma integração que passa e uma geração que falha deixariam
 * o card no CRM apontando para documento que não existe. Na ordem certa, o pior
 * caso é o oposto — e é justamente o caso que o FR-034 sabe responder: **a
 * integração falhou, mas os documentos continuam baixáveis**, com os links na
 * resposta de erro. O trabalho não se perde.
 */

/** Estados que impedem uma nova finalização. */
const EM_ANDAMENTO = 'FINALIZANDO';
const CONCLUIDA = 'FINALIZADA';

export async function finalizarProposta(prisma, user, proposalId, opcoes = {}) {
  const { pipelineId = '', gerarPdf } = opcoes;

  const proposta = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposta) throw new ComercialError('Proposta não encontrada.', 404);

  // O autor finaliza a sua; o gestor finaliza qualquer uma; consulta nunca.
  if (!canFinalize(user, proposta)) {
    throw new ComercialError(denialReason(user, proposta), 403);
  }
  if (proposta.archivedAt) {
    throw new ComercialError('Proposta arquivada. Desarquive antes de finalizar.', 409);
  }

  exigirNaoFinalizada(proposta);

  // Guardado ANTES da troca de estado, e não lido do registro depois: o objeto
  // carregado e o gravado podem ser o mesmo em memória, e aí "voltar ao estado
  // anterior" voltaria para FINALIZANDO — que é o estado do qual se quer sair.
  const estadoAnterior = proposta.status;

  // Marca ANTES de gerar. É o que faz o segundo clique, com segundos de
  // diferença, encontrar `FINALIZANDO` em vez de encontrar `RASCUNHO` e produzir
  // um segundo par de documentos, uma segunda oportunidade e uma segunda pasta —
  // com as duas requisições respondendo sucesso.
  await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: EM_ANDAMENTO, integrationError: null }
  });

  let documentos;
  try {
    ({ documentos } = await emitirDocumentos(prisma, user, proposalId, { gerarPdf }));
  } catch (error) {
    // Falhou antes de existir documento: devolve a proposta ao estado anterior,
    // senão ela fica presa em FINALIZANDO e ninguém consegue tentar de novo.
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: estadoAnterior, integrationError: null }
    });
    throw error;
  }

  const integracao = await enviarAoNectar(prisma, proposta, pipelineId, documentos);

  const sucesso = integracao.status === 'SUCESSO';
  const atualizada = await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      // FALHA_INTEGRACAO **não** é um beco sem saída: é o estado que permite
      // tentar de novo. Só `FINALIZADA` fecha a proposta.
      status: sucesso ? CONCLUIDA : 'FALHA_INTEGRACAO',
      finalizedAt: sucesso ? new Date() : null,
      finalizedByUserId: sucesso ? user.id : null,
      nectarStatus: integracao.status,
      nectarOpportunityId: integracao.opportunityId || proposta.nectarOpportunityId,
      nectarPipelineId: integracao.pipelineId || proposta.nectarPipelineId,
      nectarPipelineName: integracao.pipelineName || proposta.nectarPipelineName,
      integrationError: integracao.mensagem || null
    }
  });

  await registrarAuditoria(prisma, user, proposalId, sucesso, integracao);

  return {
    ok: sucesso,
    proposta: atualizada,
    // Os documentos vão na resposta **dos dois jeitos**. É o FR-034: quem
    // recebe o erro precisa dos links, não de um pedido para tentar de novo.
    documentos,
    integracao
  };
}

/**
 * A finalização é exclusiva (FR-069).
 *
 * A recusa diz **quando e por quem** — "já finalizada" sozinho manda a pessoa
 * procurar quem foi, e normalmente é o colega ao lado.
 */
export function exigirNaoFinalizada(proposta) {
  if (proposta.status === CONCLUIDA) {
    const quando = proposta.finalizedAt
      ? new Date(proposta.finalizedAt).toLocaleString('pt-BR')
      : 'anteriormente';
    throw new ComercialError(
      `Esta proposta já foi finalizada em ${quando}. Crie uma revisão para emitir de novo.`,
      409,
      { finalizedAt: proposta.finalizedAt, finalizedByUserId: proposta.finalizedByUserId }
    );
  }

  if (proposta.status === EM_ANDAMENTO) {
    throw new ComercialError(
      'Esta proposta está sendo finalizada neste momento. Aguarde o término.',
      409
    );
  }
}

/**
 * Tenta o Nectar, e **nunca lança**.
 *
 * Devolver o erro em vez de propagá-lo é o que mantém o FR-034 possível: quem
 * chamou precisa seguir para gravar o estado e responder com os links dos
 * documentos, que já existem.
 */
async function enviarAoNectar(prisma, proposta, pipelineId, documentos) {
  const impedimento = nectar.indisponivel();
  if (impedimento) {
    return { status: 'ERRO', mensagem: impedimento, opportunityId: '', pipelineId: '', pipelineName: '' };
  }

  try {
    const funis = await nectar.listarFunis();
    const funil = nectar.exigirFunilPermitido(funis, pipelineId);
    const dados = dadosParaOCrm(proposta, funil);

    // Revisão reaproveita o card salvo em vez de abrir outro (FR-066).
    const oportunidade = proposta.nectarOpportunityId
      ? { id: proposta.nectarOpportunityId, criada: false }
      : await nectar.criarOportunidade(dados, funil);

    const arquivos = await bytesDosDocumentos(prisma, proposta.id, documentos);
    await nectar.anexarDocumentos(oportunidade.id, arquivos, dados, funil);

    return {
      status: 'SUCESSO',
      mensagem: '',
      opportunityId: oportunidade.id,
      pipelineId: funil.id,
      pipelineName: funil.nome
    };
  } catch (error) {
    return {
      status: 'ERRO',
      mensagem: error?.message || 'Falha ao enviar a proposta ao Nectar.',
      opportunityId: '',
      pipelineId: '',
      pipelineName: ''
    };
  }
}

function dadosParaOCrm(proposta, funil) {
  const payload = proposta.payload && typeof proposta.payload === 'object' ? proposta.payload : {};

  return {
    proposalCode: proposta.proposalCode,
    clientName: proposta.clientName,
    title: String(payload.title || ''),
    site: proposta.site,
    contactName: proposta.contact,
    contactEmail: proposta.email,
    // Empresa e contato são **selecionados** no CRM, não criados aqui: o
    // cadastro do Nectar não é povoado pelo app.
    companyId: payload.companyId || '',
    contactId: payload.contactId || '',
    totalValue: Number(proposta.totalValue) || 0,
    pipelineName: funil.nome
  };
}

/**
 * Os bytes vêm do DISCO, pelo caminho que o registro aponta.
 *
 * Não são os bytes que a geração acabou de produzir em memória: o que vai ao
 * CRM tem de ser o mesmo arquivo que o usuário vai baixar. Se os dois puderem
 * divergir, um dia divergem.
 */
async function bytesDosDocumentos(prisma, proposalId, documentos) {
  const registros = await documentosAtuais(prisma, proposalId);
  const porId = new Map(registros.map(item => [item.id, item]));

  const arquivos = [];
  for (const documento of documentos) {
    const registro = porId.get(documento.id);
    if (!registro) continue;
    arquivos.push({ fileName: documento.fileName, bytes: await lerArquivo(registro.storagePath) });
  }
  return arquivos;
}

/**
 * Auditoria das ações irreversíveis (T080).
 *
 * A falha é registrada junto com o sucesso, e de propósito: "por que esta
 * proposta não chegou ao CRM" é a pergunta que se faz semanas depois, quando o
 * recado da tela já sumiu.
 */
async function registrarAuditoria(prisma, user, proposalId, sucesso, integracao) {
  const registros = [
    {
      proposalId,
      action: 'FINALIZADA',
      actorUserId: user.id,
      detail: { nectar: integracao.status }
    },
    {
      proposalId,
      action: sucesso ? 'INTEGRACAO_ENVIADA' : 'INTEGRACAO_FALHOU',
      actorUserId: user.id,
      detail: {
        opportunityId: integracao.opportunityId || null,
        pipelineName: integracao.pipelineName || null,
        erro: integracao.mensagem || null
      }
    }
  ];

  for (const data of registros) {
    await prisma.proposalAuditLog.create({ data });
  }
}
