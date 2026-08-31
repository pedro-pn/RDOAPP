import type { LevantamentoSalvo } from '../../../api/comercial';

import type { ItemDePreco } from './etapas';

/** Formata o Decimal da API sem reaplicar a máscara de digitação por centavos. */
export function formatarValorDoLevantamento(
  valor: string | number | null | undefined
): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numero);
}

/**
 * O levantamento fecha um preço global. Na proposta ele entra como uma verba
 * única, editável, para que o vendedor possa detalhá-la depois se necessário.
 */
export function itemDePrecoDoLevantamento(
  levantamento: Pick<LevantamentoSalvo, 'title' | 'salePrice'>
): ItemDePreco {
  const valor = formatarValorDoLevantamento(levantamento.salePrice);
  return {
    description: levantamento.title || 'Serviços conforme levantamento de custos',
    unit: 'VB',
    quantity: '1',
    unitValue: valor,
    value: valor
  };
}
