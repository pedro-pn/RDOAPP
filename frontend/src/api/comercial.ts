import axios from 'axios';

import { apiClient } from './client';

export interface ComercialStatus {
  module: string;
  status: string;
}

export async function getComercialStatus() {
  const { data } = await apiClient.get<ComercialStatus>('/comercial/status');
  return data;
}

/** Uma pendência endereçada a um campo, como o servidor devolve no `422`. */
export interface ComercialIssue {
  path: string | null;
  message: string;
  severity?: string;
}

/**
 * Erro de validação do levantamento.
 *
 * Existe como classe própria porque o `422` deste módulo **não é uma mensagem** — é
 * uma lista de pendências com o endereço de cada campo. Achatar isso numa string
 * (que é o que a referência fazia) joga fora exatamente a informação que permite
 * pintar o campo certo.
 */
export class ComercialValidationError extends Error {
  issues: ComercialIssue[];

  constructor(issues: ComercialIssue[]) {
    super('O levantamento tem pendências.');
    this.name = 'ComercialValidationError';
    this.issues = issues;
  }
}

export interface LevantamentoSalvo {
  id: string;
  proposalCode: string;
  revisionNumber: number;
  title: string;
  salePrice?: string | number | null;
  marginPercent?: string | number | null;
  status?: string;
}

export interface LevantamentoEntrada {
  proposalCode: string;
  revisionNumber?: number;
  title: string;
  mode: 'NOVA' | 'REVISAO';
  payload: Record<string, unknown>;
}

/**
 * Os totais **não** são enviados: o servidor recalcula com `calculateEstimate` e grava
 * os seus. Mandar `salePrice` daqui seria oferecer ao cliente a chance de forjar
 * margem, e o contrato rejeita o campo.
 */
export async function criarLevantamento(entrada: LevantamentoEntrada) {
  try {
    const { data } = await apiClient.post<LevantamentoSalvo>(
      '/comercial/levantamentos',
      entrada
    );
    return data;
  } catch (error) {
    throw traduzirErro(error);
  }
}

export async function atualizarLevantamento(id: string, entrada: LevantamentoEntrada) {
  try {
    const { data } = await apiClient.put<LevantamentoSalvo>(
      `/comercial/levantamentos/${id}`,
      entrada
    );
    return data;
  } catch (error) {
    throw traduzirErro(error);
  }
}

export async function obterLevantamento(id: string) {
  const { data } = await apiClient.get<LevantamentoSalvo & { payload: Record<string, unknown> }>(
    `/comercial/levantamentos/${id}`
  );
  return data;
}

function traduzirErro(error: unknown): unknown {
  if (!axios.isAxiosError(error) || error.response?.status !== 422) return error;

  const corpo = error.response.data as { issues?: ComercialIssue[]; message?: string };
  const issues = Array.isArray(corpo?.issues) ? corpo.issues : [];

  // Sem `issues` não há o que endereçar — deixa o erro original subir em vez de
  // fabricar uma lista vazia, que a tela leria como "nenhuma pendência".
  return issues.length ? new ComercialValidationError(issues) : error;
}

/**
 * Reserva o próximo número de proposta. **Consome** — pedir duas vezes gasta dois
 * números, e um número consumido não volta.
 *
 * `503` significa que a numeração ainda não foi semeada no ambiente. É recusa
 * deliberada do servidor, não indisponibilidade: emitir sem saber o maior número já
 * usado produziria código repetido no documento que chega ao cliente.
 */
export async function reservarProximoNumero() {
  const { data } = await apiClient.get<{ numero: number }>(
    '/comercial/propostas/proximo-numero'
  );
  return data.numero;
}

export interface Consultor {
  id: string;
  nome: string;
  username: string;
}

/**
 * Consultores de vendas.
 *
 * `podeEscolher` vem do servidor, não é deduzido aqui: gestor recebe a lista
 * completa, vendedor recebe só a si mesmo. A restrição acontece na origem — o cliente
 * apenas reflete o que chegou.
 */
export async function listarConsultores() {
  const { data } = await apiClient.get<{ items: Consultor[]; podeEscolher: boolean }>(
    '/comercial/consultores'
  );
  return data;
}

export interface FotoDoEscopo {
  id: string;
  assetKey: string;
  fileName: string;
  contentType: string;
  byteSize: number;
}

/**
 * Envia uma foto de escopo, já otimizada pelo cliente.
 *
 * Binário cru com o tipo no `Content-Type` e o nome em `x-file-name`, no padrão que
 * este repositório já usa para upload. O servidor **revalida tudo** — inclusive a
 * assinatura de bytes, porque a otimização daqui pode ser contornada.
 */
export async function enviarFotoDoEscopo(blob: Blob, fileName: string) {
  const { data } = await apiClient.post<FotoDoEscopo>('/comercial/escopo/fotos', blob, {
    headers: {
      'Content-Type': blob.type,
      'x-file-name': encodeURIComponent(fileName)
    }
  });
  return data;
}

/**
 * A mensagem que o servidor mandou, quando mandou uma.
 *
 * O módulo escreve mensagem por caso — "Este registro pertence a outro
 * orçamentista", "Já existe a revisão 1 da proposta 4418" —, e trocá-las por um
 * texto genérico da tela joga fora justamente o que diz o que fazer a seguir.
 */
export function mensagemDeErro(error: unknown, padrao: string): string {
  const resposta = (error as { response?: { status?: number; data?: { error?: string } } })
    ?.response;
  if (resposta?.data?.error) return resposta.data.error;
  if (error instanceof Error && error.message) return error.message;
  return padrao;
}

export interface PropostaEntrada {
  proposalCode: string;
  revisionNumber?: number;
  costEstimateId?: string | null;
  clientName: string;
  cnpj: string;
  contact: string;
  email: string;
  site: string;
  department?: string | null;
  sellerUserId: string;
  payload: Record<string, unknown>;
}

export interface PropostaSalva {
  id: string;
  proposalCode: string;
  revisionNumber: number;
  status: string;
  /** Ausente para o papel de consulta — omitido na origem, não escondido aqui. */
  totalValue?: string | number | null;
  costEstimateId?: string | null;
  sellerUserId?: string;
  payload?: Record<string, unknown>;
  updatedAt?: string;
}

/**
 * Salva a proposta.
 *
 * O `totalValue` **não** é enviado: o servidor soma os itens de preço com a
 * mesma leitura de moeda que o gerador do documento usa. Mandá-lo daqui
 * permitiria que o histórico e o CRM dissessem um número que o PDF não confirma.
 */
export async function criarProposta(entrada: PropostaEntrada) {
  const { data } = await apiClient.post<PropostaSalva>('/comercial/propostas', entrada);
  return data;
}

export async function atualizarProposta(id: string, entrada: Partial<PropostaEntrada>) {
  const { data } = await apiClient.put<PropostaSalva>(`/comercial/propostas/${id}`, entrada);
  return data;
}

export async function obterProposta(id: string) {
  const { data } = await apiClient.get<PropostaSalva>(`/comercial/propostas/${id}`);
  return data;
}

export async function listarPropostas(filtros: { busca?: string; arquivados?: boolean } = {}) {
  const { data } = await apiClient.get<{ items: PropostaSalva[]; total: number }>(
    '/comercial/propostas',
    { params: { busca: filtros.busca || '', arquivados: filtros.arquivados ? 1 : 0 } }
  );
  return data;
}

export interface DocumentoEmitido {
  id: string;
  kind: 'COMERCIAL' | 'TECNICA';
  fileName: string;
  byteSize: number;
}

/**
 * Emite os dois documentos: gera os PDFs e **grava no servidor**.
 *
 * Diferente da prévia, que não guarda nada. O corpo leva só o id — o que se
 * emite é o que está salvo, e é por isso que a tela salva antes de chamar aqui.
 */
export async function emitirDocumentos(proposalId: string) {
  const { data } = await apiClient.post<{
    proposalId: string;
    proposalCode: string;
    documentos: DocumentoEmitido[];
  }>('/comercial/propostas/documentos', { proposalId });
  return data;
}

/**
 * Baixa um documento já emitido.
 *
 * `responseType: 'blob'` não é detalhe: sem ele o axios interpreta os bytes do
 * PDF como texto e o arquivo chega corrompido, com erro só na hora de abrir.
 */
export async function baixarDocumento(id: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/comercial/documentos/${id}`, {
    responseType: 'blob'
  });
  return data;
}

/** Endereço de leitura da foto. O `<img>` aponta para cá; o arquivo é imutável. */
export function urlDaFotoDoEscopo(id: string) {
  const base = apiClient.defaults.baseURL || '/api';
  return `${base}/comercial/escopo/fotos/${id}`;
}

/**
 * Gera a prévia do documento em PDF no servidor (T072).
 *
 * **Não é a emissão.** Nada é gravado, a proposta não é numerada e nenhuma
 * integração é acionada — isto existe para conferir o documento antes de ele
 * existir. Por isso o corpo vai inteiro do formulário: nesta etapa não há
 * proposta salva de onde ler.
 *
 * `responseType: 'blob'` não é detalhe: sem ele o axios interpreta os bytes do
 * PDF como texto e o arquivo chega corrompido, com erro só na hora de abrir.
 */
export async function baixarPreviaEmPdf(
  tipo: 'commercial' | 'technical',
  dados: Record<string, unknown>
): Promise<Blob> {
  const { data } = await apiClient.post<Blob>(
    '/comercial/propostas/previa.pdf',
    { ...dados, tipo },
    { responseType: 'blob' }
  );
  return data;
}
