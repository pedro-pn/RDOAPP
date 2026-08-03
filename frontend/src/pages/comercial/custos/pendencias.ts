import {
  HOTEL_SITE_COMMUTE_EXPENSE_CODE,
  hasMeaningfulInputs,
  hasMeaningfulLabor
} from '../../../../../shared/comercial/dist/cost-model.js';
import { numberValue } from './formato';

/**
 * Predicados de pendência por seção — o que alimenta o rodapé-guia.
 *
 * Porte de `app/custos/page.tsx:89-140`. Ficam num módulo puro porque são
 * regra, não desenho: dá para testar cada condição isoladamente, sem montar
 * 465 controles na tela.
 *
 * O que estes predicados têm de especial: **a confirmação de escopo desliga
 * a pendência**. "Sem mão de obra" não é um estado vazio — é uma afirmação do
 * usuário de que aquele bloco não se aplica. Sem isso, um levantamento
 * legitimamente sem mão de obra ficaria travado para sempre, e a saída óbvia
 * (preencher qualquer coisa) produziria preço errado.
 */

type AnyRecord = Record<string, unknown>;

function registros(valor: unknown): AnyRecord[] {
  return Array.isArray(valor) ? (valor as AnyRecord[]) : [];
}

/**
 * Falta informação obrigatória de mão de obra?
 *
 * Quatro condições, em `app/custos/page.tsx:89-107`. As três últimas valem
 * **por fase**: basta uma fase habilitada incompleta para a seção pender.
 */
export function faltaMaoDeObra(draft: AnyRecord): boolean {
  const confirmacoes = (draft.scopeConfirmations as AnyRecord) || {};
  if (confirmacoes.noLabor === true) return false;

  if (!hasMeaningfulLabor(draft)) return true;

  return registros(draft.laborContexts).some(contexto => {
    if (contexto.enabled === false) return false;

    // Condição de trabalho precisa ser escolhida E confirmada — são duas
    // coisas. Escolher sem confirmar deixa a fase com base de cálculo por
    // definir, e o custo sai plausível e errado.
    if (!contexto.workCondition || !contexto.workConditionConfirmed) return true;
    if (!contexto.vehicleType) return true;

    if (contexto.workCondition !== 'travel') return false;

    // Fase em viagem: distância hotel ↔ obra e o combustível do trajeto.
    if (numberValue(contexto.hotelSiteDistanceKmPerDay) <= 0) return true;

    const combustivel = registros(contexto.expenses).find(
      despesa => despesa.code === HOTEL_SITE_COMMUTE_EXPENSE_CODE
    );

    return (
      !combustivel ||
      combustivel.included === false ||
      numberValue(combustivel.quantity) <= 0 ||
      numberValue(combustivel.unitValue) <= 0
    );
  });
}

/**
 * Falta composição de materiais e insumos?
 * A mais simples das quatro (`page.tsx:108`).
 */
export function faltaInsumos(draft: AnyRecord): boolean {
  const confirmacoes = (draft.scopeConfirmations as AnyRecord) || {};
  if (confirmacoes.noInputs === true) return false;
  return !hasMeaningfulInputs(draft);
}

/**
 * Falta informação de comissão ou indicação?
 *
 * Diferente das outras: não tem confirmação de escopo. A comissão de
 * representante só é cobrada quando **habilitada** — quem não usa, não vê
 * pendência (`page.tsx:135-140`).
 */
export function faltaComercial(draft: AnyRecord): boolean {
  const comercial = (draft.commercial as AnyRecord) || {};
  const representante = (comercial.representativeCommission as AnyRecord) || {};

  if (representante.enabled !== true) return false;

  return (
    !String(representante.representativeName || '').trim() ||
    numberValue(representante.percent) <= 0
  );
}

/**
 * As pendências no formato que o rodapé-guia consome.
 *
 * `logistics` ainda não está portada — o predicado dela depende de helpers
 * locais da tela de referência (`crewTransportWaived`,
 * `logisticsItemNeedsAttention`, `logisticsGroupsNeedAttention`) que vêm com a
 * seção. Até lá o rodapé pula a logística, o que é **visível e honesto**: o
 * botão nunca aponta para uma seção que não sabe validar.
 */
export function pendenciasDe(draft: AnyRecord) {
  return {
    labor: faltaMaoDeObra(draft),
    inputs: faltaInsumos(draft),
    logistics: false,
    commercial: faltaComercial(draft)
  };
}
