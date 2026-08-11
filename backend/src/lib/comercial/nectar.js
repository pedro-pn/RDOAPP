import env from '../../config/env.js';
import { ComercialError } from './cost-estimates.js';

/**
 * Adaptador do CRM Nectar (tarefa T076).
 *
 * **O Nectar não tem sandbox.** A API publica uma URL só, de produção; não há
 * homologação para onde apontar. Toda chamada com `NECTAR_MODE=real` cria card
 * de verdade no CRM da empresa — e é por isso que este arquivo tem três modos e
 * o padrão é não sair para a rede:
 *
 *   off    não tenta. A finalização responde que o envio está desligado.
 *   fake   responde como se tivesse dado certo, sem rede. É o modo do dev e da
 *          suíte — sem ele, não haveria como testar a finalização sem poluir o
 *          CRM.
 *   real   usa o token.
 *
 * A segunda contenção é a **lista branca de funis** (`NECTAR_PIPELINE_IDS`).
 * Vazia recusa tudo, de propósito: "sem lista" não pode significar "qualquer
 * funil", senão o ambiente mal configurado é justamente o que escreve em todos.
 */

const BASE = 'https://app.nectarcrm.com.br/crm/api/1';
const TEMPO_LIMITE_MS = 8000;

export class NectarError extends ComercialError {
  constructor(message, statusCode = 502, extra = {}) {
    super(message, statusCode, extra);
    this.name = 'NectarError';
  }
}

export function modoDoNectar() {
  return env.nectarMode;
}

export function funisPermitidos() {
  return env.nectarPipelineIds;
}

/**
 * Recusa antes de qualquer trabalho quando o envio não pode acontecer.
 *
 * Devolve o motivo em vez de lançar, porque quem chama precisa **continuar** —
 * documento gerado não se perde por causa de integração desligada (FR-034).
 */
export function indisponivel() {
  const modo = modoDoNectar();

  if (modo === 'off') {
    return 'O envio ao Nectar está desligado neste ambiente (NECTAR_MODE=off).';
  }
  if (!funisPermitidos().length) {
    return 'Nenhum funil autorizado: configure NECTAR_PIPELINE_IDS antes de finalizar.';
  }
  if (modo === 'real' && !env.nectarApiToken) {
    return 'O token do Nectar não está configurado (NECTAR_API_TOKEN).';
  }
  return '';
}

/**
 * Os funis que este ambiente pode usar.
 *
 * No modo real, a lista vem do CRM e é **filtrada** pela lista branca: um funil
 * que existe no Nectar mas não está autorizada aqui não chega à tela, então
 * ninguém o escolhe por engano.
 */
export async function listarFunis() {
  const permitidos = new Set(funisPermitidos());
  if (!permitidos.size) return [];

  if (modoDoNectar() === 'fake') {
    return [...permitidos].map(id => ({ id, nome: `Funil de teste ${id}`, primeiraEtapa: 1 }));
  }

  const registros = await buscarFunis();
  const funis = registros
    .filter(registro => permitidos.has(String(registro.id)))
    .map(registro => ({
      id: String(registro.id),
      nome: String(registro.nome || registro.name || ''),
      primeiraEtapa: primeiraEtapa(registro)
    }));

  if (!funis.length) {
    throw new NectarError(
      `Nenhum dos funis autorizados existe no Nectar (${[...permitidos].join(', ')}).`
    );
  }

  return funis;
}

/**
 * O funil escolhido tem de estar entre os autorizados.
 *
 * Conferir de novo aqui não é redundância: a listagem alimenta a tela, e o id
 * que volta no corpo da finalização é o que o cliente mandou.
 */
export function exigirFunilPermitido(funis, pipelineId) {
  const funil = funis.find(item => item.id === String(pipelineId));
  if (!funil) {
    throw new NectarError('O funil selecionado não está na lista autorizada.', 422);
  }
  return funil;
}

/**
 * Cria o card da proposta. Porte de `createOpportunity`.
 *
 * O **409 não é falha**: o Nectar responde assim quando já existe card com o
 * mesmo nome, e nesse caso o certo é reaproveitá-lo. Tratar como erro faria a
 * segunda tentativa de uma finalização que falhou no meio parecer impossível.
 */
export async function criarOportunidade(dados, funil) {
  if (modoDoNectar() === 'fake') {
    return { id: `fake-op-${dados.proposalCode}`, criada: true };
  }

  const nome = nomeDaOportunidade(dados);

  try {
    const resposta = await chamar('/oportunidades/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        observacao:
          `Proposta ${dados.proposalCode}: ${dados.title || 'Proposta comercial'}. ` +
          `Local da obra: ${dados.site}. Contato: ${dados.contactName} (${dados.contactEmail}).`,
        cliente: { id: Number(dados.companyId) },
        contato: { id: Number(dados.contactId) },
        camposPersonalizados: { 'Local da Obra': dados.site },
        pipeline: funil.nome,
        etapa: funil.primeiraEtapa,
        status: 1,
        valorAvulso: dados.totalValue,
        probabilidade: 10,
        bloquearProposta: false,
        bloquearConclusao: false
      })
    });

    const id = String(desembrulhar(resposta).id || '');
    if (!id) {
      throw new NectarError('O Nectar criou a oportunidade sem devolver o identificador.');
    }
    return { id, criada: true };
  } catch (error) {
    if (error instanceof NectarError && error.respostaHttp === 409) {
      const existente = await acharOportunidade(nome, funil);
      if (existente) return { id: existente, criada: false };
    }
    throw error;
  }
}

/** Anexa os documentos e o comentário ao card. Porte de `attachNectarFeedback`. */
export async function anexarDocumentos(oportunidadeId, arquivos, dados, funil, pasta = '') {
  if (modoDoNectar() === 'fake') return { anexados: arquivos.length };

  const corpo = new FormData();
  corpo.append(
    'publicacao',
    JSON.stringify({
      oportunidade: { id: oportunidadeId },
      contato: { id: Number(dados.contactId) },
      assunto: `Proposta ${dados.proposalCode}`,
      descricao: pasta
        ? `Propostas técnica e comercial salvas em <b>${escaparHtml(pasta)}</b>. ` +
          `Funil: <b>${escaparHtml(funil.nome)}</b>. Valor total: <b>${emReais(dados.totalValue)}</b>.`
        : `Propostas técnica e comercial anexadas. Funil: <b>${escaparHtml(funil.nome)}</b>. ` +
          `Valor total: <b>${emReais(dados.totalValue)}</b>.`,
      importante: true
    })
  );

  for (const arquivo of arquivos) {
    corpo.append('anexos', new Blob([arquivo.bytes]), nomeDeTransporte(arquivo.fileName));
  }

  await chamar('/publicacao/incluirComAnexos', { method: 'POST', body: corpo });
  return { anexados: arquivos.length };
}

export function nomeDaOportunidade(dados) {
  return [dados.proposalCode, dados.clientName, dados.title].filter(Boolean).join(' - ').slice(0, 200);
}

/**
 * Nome de arquivo que atravessa `multipart` sem se perder.
 *
 * Acento em nome de anexo chega corrompido em alguns servidores, e o nome é o
 * que o vendedor vê no card. Porte de `transportFileName`.
 */
export function nomeDeTransporte(nome, padrao = 'proposta.pdf') {
  const limpo = String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ._-]/g, '_')
    .trim();
  return limpo || padrao;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function chamar(caminho, opcoes = {}) {
  const resposta = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    headers: { 'Access-Token': env.nectarApiToken, ...(opcoes.headers || {}) },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS)
  }).catch(erro => {
    // Rede fora do ar tem de sair com a mesma cara de erro do resto, senão o
    // contrato de falha não reconhece e o erro sobe como 500 genérico.
    throw new NectarError(`Não foi possível falar com o Nectar: ${erro.message}`);
  });

  const corpo = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const erro = new NectarError(
      `O Nectar respondeu com erro ${resposta.status}${detalhe(corpo) ? `: ${detalhe(corpo)}` : '.'}`
    );
    erro.respostaHttp = resposta.status;
    throw erro;
  }

  return corpo;
}

async function buscarFunis() {
  // Duas rotas porque a instalação responde numa ou noutra — é o que a
  // referência fazia, e descobrir isso custou tempo lá.
  for (const caminho of ['/pipelines?type=0&page=-1', '/pipeline?type=0&page=-1']) {
    const registros = coletarRegistros(await chamar(caminho));
    if (registros.length) return registros;
  }
  return [];
}

async function acharOportunidade(nome, funil) {
  const resposta = await chamar(
    `/oportunidades?nome=${encodeURIComponent(nome)}&page=-1`
  ).catch(() => null);

  const candidatos = coletarRegistros(resposta).filter(
    registro => String(registro.nome || registro.titulo || '') === nome
  );

  const doFunil = candidatos.filter(registro => pertenceAoFunil(registro, funil));
  const escolhido = doFunil[0] || candidatos[0];
  return escolhido ? String(escolhido.id) : '';
}

/**
 * Varre a resposta atrás de registros.
 *
 * O Nectar aninha o resultado de formas diferentes por rota, e procurar numa
 * chave fixa devolveria lista vazia sem erro nenhum. Porte de
 * `collectNectarRecords`.
 */
export function coletarRegistros(carga, profundidade = 0) {
  if (profundidade > 6 || carga == null) return [];
  if (Array.isArray(carga)) {
    return carga.flatMap(item => coletarRegistros(item, profundidade + 1));
  }
  if (typeof carga !== 'object') return [];

  const atual =
    carga.id != null && (carga.nome != null || carga.titulo != null || carga.name != null)
      ? [carga]
      : [];

  return atual.concat(
    Object.values(carga).flatMap(valor => coletarRegistros(valor, profundidade + 1))
  );
}

export function pertenceAoFunil(registro, funil) {
  const objeto = objetoOuVazio(registro.pipeline);
  const venda = objetoOuVazio(registro.funilVenda);
  const funilBruto = objetoOuVazio(registro.funil);

  const id = String(
    objeto.id ?? venda.id ?? funilBruto.id ?? registro.pipelineId ?? registro.funilVendaId ?? ''
  );
  if (id) return id === funil.id;

  const nome = String(
    objeto.nome ?? objeto.name ?? venda.nome ?? funilBruto.nome ??
      (typeof registro.pipeline === 'string' ? registro.pipeline : '')
  );
  return normalizarNome(nome) === normalizarNome(funil.nome);
}

export function normalizarNome(valor) {
  return String(valor || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim();
}

function objetoOuVazio(valor) {
  return valor && typeof valor === 'object' ? valor : {};
}

function desembrulhar(carga) {
  if (Array.isArray(carga)) return carga[0] || {};
  if (carga && typeof carga === 'object') {
    return carga.item || carga.data || carga.oportunidade || carga;
  }
  return {};
}

function detalhe(corpo) {
  if (!corpo || typeof corpo !== 'object') return '';
  return String(corpo.message || corpo.mensagem || corpo.erro || corpo.error || '');
}

function primeiraEtapa(registro) {
  const sequencias = Array.isArray(registro.sequencias) ? registro.sequencias : [];
  const numeros = sequencias.map(
    item => Number(item.sequencia ?? item.etapa ?? item.ordem ?? 1) || 1
  );
  return numeros.length ? Math.max(1, Math.min(...numeros)) : 1;
}

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function emReais(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(valor) || 0
  );
}
