import type { ScopeBlock, ScopeServiceItem } from '../../../../../shared/comercial/dist/scope-content.js';
import type { TechnicalServiceSelection } from '../../../../../shared/comercial/dist/technical-services.js';
import type { PropostaEntrada } from '../../../api/comercial';

import type { ItemDePreco, LinhaResponsabilidade } from './etapas';

/**
 * O que a tela manda ao servidor (tarefa da ligação da proposta).
 *
 * Mora fora do componente porque é a parte que **erra em silêncio**: o
 * formulário chama o cliente de `client` e a API chama de `clientName`; o
 * consultor é `seller` de um lado e `sellerUserId` do outro. Um par trocado não
 * quebra nada — grava o campo errado, e a proposta sai com o nome no lugar do
 * departamento. Aqui isso é testável sem montar a tela.
 */

type AnyRecord = Record<string, unknown>;

export type ConteudoDaProposta = {
  form: AnyRecord;
  codigo: string;
  orcamentista: string;
  modelo: string;
  itensEscopo: ScopeServiceItem[];
  blocos: ScopeBlock[];
  categorias: string[];
  responsabilidades: LinhaResponsabilidade[];
  precos: ItemDePreco[];
  incluirUnitario: boolean;
  servicosTecnicos: TechnicalServiceSelection[];
  complementoRelatorios: string;
};

/**
 * O conteúdo da proposta, num lugar só.
 *
 * A prévia, o salvamento e a emissão usam **este mesmo objeto**. Montá-lo em
 * três lugares faria o documento conferido na tela divergir do documento
 * gravado — e a divergência apareceria no PDF que já foi ao cliente.
 */
export function dadosDaProposta(conteudo: ConteudoDaProposta): AnyRecord {
  return {
    ...conteudo.form,
    proposalCode: conteudo.codigo,
    estimator: conteudo.orcamentista,
    modelo: conteudo.modelo,
    scopeItems: conteudo.itensEscopo,
    scopeBlocks: conteudo.blocos,
    // `categorias` não vai ao gerador, mas vai ao banco: sem ela, reabrir a
    // proposta salva traria a matriz sem os subtítulos que o vendedor criou.
    categorias: conteudo.categorias,
    rows: conteudo.responsabilidades,
    prices: conteudo.precos,
    includeUnitValue: conteudo.incluirUnitario,
    technicalServices: conteudo.servicosTecnicos,
    technicalReports: conteudo.complementoRelatorios
  };
}

/**
 * O corpo de `POST`/`PUT /propostas`.
 *
 * `totalValue` **não** entra: o servidor soma os itens de preço com a mesma
 * leitura de moeda do gerador do documento. Mandá-lo daqui permitiria que o
 * histórico e o CRM dissessem um número que o PDF não confirma.
 */
export function entradaDaProposta(
  conteudo: ConteudoDaProposta,
  levantamentoId: string
): PropostaEntrada {
  const texto = (campo: string) => String(conteudo.form[campo] ?? '').trim();

  return {
    proposalCode: conteudo.codigo,
    // Proposta avulsa não tem levantamento, e `''` não é um id — seria uma
    // busca por registro inexistente, que o servidor recusa com 422.
    costEstimateId: levantamentoId || null,
    clientName: texto('client'),
    cnpj: texto('cnpj'),
    contact: texto('contact'),
    email: texto('email'),
    site: texto('site'),
    department: texto('department') || null,
    sellerUserId: texto('seller'),
    payload: dadosDaProposta(conteudo)
  };
}

/** O código ainda não foi reservado? A tela mostra "—" enquanto não há número. */
export function precisaDeNumero(codigo: string): boolean {
  return !codigo || codigo === '—';
}
