import type { LevantamentoSalvo } from '../../../api/comercial';

import type { ItemDePreco } from './etapas';

type LevantamentoComPayload = Pick<LevantamentoSalvo, 'title' | 'salePrice'> & {
  payload?: Record<string, unknown>;
};

/**
 * O endereço de execução da proposta é o destino orçado no levantamento.
 *
 * `obra-principal` é a chave criada pela tela de logística. Levantamentos
 * antigos podem não tê-la; nesses casos usamos o primeiro destino que de fato
 * tenha endereço, sem confundir o local da obra com o endereço do CRM.
 */
export function localDaObraDoLevantamento(
  levantamento: Pick<LevantamentoComPayload, 'payload'>
): string {
  const destinos = levantamento.payload?.logisticsDestinations;
  if (!Array.isArray(destinos)) return '';

  const normalizados = destinos.flatMap(destino => {
    if (!destino || typeof destino !== 'object') return [];
    const registro = destino as Record<string, unknown>;
    const endereco = String(registro.address ?? '').trim();
    if (!endereco) return [];
    return [{ id: String(registro.id ?? ''), endereco }];
  });

  return (
    normalizados.find(destino => destino.id === 'obra-principal')?.endereco ??
    normalizados[0]?.endereco ??
    ''
  );
}

/** Formata o Decimal da API sem reaplicar a máscara de digitação por centavos. */
export function formatarValorDoLevantamento(valor: string | number | null | undefined): string {
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
