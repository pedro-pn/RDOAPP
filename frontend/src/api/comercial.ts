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
