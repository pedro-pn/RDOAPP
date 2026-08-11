/**
 * De serviço técnico da proposta para produto do Nectar (tarefa T129).
 *
 * **A lógica é do comercial, não minha.** Lida dos cards reais do CRM em
 * 11/08/2026: cada oportunidade leva **um produto**, que é o **serviço vendido**,
 * com `quantidade: 1` e `valorUnitario = valorTotal = valor da proposta`.
 *
 *     card 26709855  "3694 - FILTRAGEM ABSOLUTA"   FV-01  R$ 473.800
 *     card 27045405  "3767 - LQ - ENGETAL"         FV-05  R$ 132.900
 *
 * O produto **não é enfeite**: os funis "Gestão Comercial" e "Funil de testes"
 * exigem produto para criar na etapa 1, e recusam com 409 sem ele. A alternativa
 * era desligar a regra no CRM; o mantenedor decidiu **respeitar a lógica que o
 * comercial já adotou**, e mandar o produto.
 *
 * **Serviço sem mapa recusa, não chuta.** Mandar o produto errado põe a proposta
 * na categoria errada do CRM, e o relatório de vendas por serviço passa a mentir
 * sem ninguém ver. Recusar dizendo o que falta é barato; consertar seis meses de
 * relatório não é.
 */

import { ComercialError } from './cost-estimates.js';

/**
 * O mapa. `null` significa **decidido que falta decidir** — o catálogo tem mais
 * de um candidato e a escolha é do comercial, não de quem lê a lista.
 */
export const PRODUTO_POR_SERVICO = {
  flushing_primario: { id: 2315552, codigo: 'FV-04', nome: 'Serviço especializado em flushing primário' },
  flushing_secundario: { id: 2315551, codigo: 'FV-03', nome: 'Serviço especializado em flushing secundário' },
  filtragem_oleo_termico: { id: 2318567, codigo: 'FV-16', nome: 'Serviço especializado em filtragem de fluído térmico' },
  limpeza_quimica: { id: 2315553, codigo: 'FV-05', nome: 'Serviço especializado em limpeza química' },
  hidrojateamento: { id: 6668620, codigo: 'FV-38', nome: 'Hidrojato' },
  teste_hidrostatico: { id: 2315555, codigo: 'FV-07', nome: 'Serviço especializado em teste hidrostático' },
  pre_engenharia: { id: 2323945, codigo: 'FV-23', nome: 'Serviço especializado em pré-engenharia' },
  limpeza_reservatorio: { id: 2315554, codigo: 'FV-06', nome: 'Serviço especializado em limpeza interna de reservatório' },

  // --- Pendentes de confirmação do comercial ---
  //
  // Não são lacunas de pesquisa: o catálogo tem MAIS DE UM candidato plausível
  // para cada um, e escolher por conta própria é decidir no lugar de quem sabe.

  /** FV-01 "filtragem absoluta" ou FV-02 "desidratação de óleo lubrificante/hidráulico"? */
  filtragem_hidraulico_lubrificante: null,
  /** FV-02 "…lubrificante/hidráulico" ou FV-14 "…óleo diesel"? */
  desidratacao_oleo: null,
  /** FV-27 "Serviço especializado em passagem de PIG" ou FV-08 "Passagem de PIG"? */
  passagem_pig: null
};

/**
 * O produto da proposta.
 *
 * `servicos` são os serviços técnicos escolhidos. A regra do comercial é **um
 * produto por card**, então quando há mais de um serviço vale o primeiro — que é
 * o principal da proposta, o que dá nome ao documento.
 */
export function produtoDaProposta(servicos, valorTotal) {
  const escolhidos = (Array.isArray(servicos) ? servicos : [])
    .map(item => String(item?.id ?? item ?? ''))
    .filter(Boolean);

  if (!escolhidos.length) {
    throw new ComercialError(
      'A proposta não tem serviço técnico selecionado, e o funil do Nectar exige produto na oportunidade.',
      422
    );
  }

  const principal = escolhidos[0];
  if (!(principal in PRODUTO_POR_SERVICO)) {
    throw new ComercialError(
      `O serviço "${principal}" não tem produto correspondente no Nectar. Registre o mapa em nectar-produtos.js.`,
      422
    );
  }

  const produto = PRODUTO_POR_SERVICO[principal];
  if (!produto) {
    throw new ComercialError(
      `O produto do Nectar para "${principal}" ainda não foi confirmado pelo comercial — há mais de um candidato no catálogo. Confirme antes de finalizar.`,
      422
    );
  }

  const valor = Number(valorTotal) || 0;

  // A forma que os cards reais usam: `refId` aponta o produto, e o valor vai nos
  // dois campos. Mandar `produto: { id }` com `valor` também é aceito, mas o
  // Nectar zera o `valorAvulso` da oportunidade — e a proposta aparece como R$ 0.
  return {
    refId: produto.id,
    quantidade: 1,
    valorUnitario: valor,
    valorTotal: valor
  };
}

/** Os serviços que ainda esperam decisão do comercial. */
export function servicosSemProduto() {
  return Object.entries(PRODUTO_POR_SERVICO)
    .filter(([, produto]) => produto === null)
    .map(([servico]) => servico);
}
