import type { SemanticTone } from './types';
import { normalizeStatus } from './utils';

export type StatusToneMap = Readonly<Record<string, SemanticTone>>;

export const statusToTone: StatusToneMap = {
  aprovado: 'success',
  concluido: 'success',
  assinado: 'success',
  ativo: 'success',
  valido: 'success',
  pendente: 'warning',
  aguardando: 'warning',
  'em analise': 'warning',
  'a vencer': 'warning',
  rejeitado: 'danger',
  vencido: 'danger',
  expirado: 'danger',
  cancelado: 'danger',
  erro: 'danger',
  inativo: 'danger',
  'em revisao': 'info',
  revisao: 'info',
  rascunho: 'info',
  informativo: 'info',
  'em andamento': 'info',
  neutro: 'neutral',
  'nao iniciado': 'neutral',
  'n/a': 'neutral'
};

export function resolveStatusTone(
  status: string,
  extensions?: StatusToneMap
): SemanticTone {
  const key = normalizeStatus(status);
  return extensions?.[key] ?? statusToTone[key] ?? 'neutral';
}
