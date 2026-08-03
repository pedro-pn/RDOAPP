import { useCallback, useMemo, useState } from 'react';

import {
  calculateEstimate,
  createDefaultCostEstimatePayload,
  normalizeCostEstimatePayload,
  validateCostEstimate
} from '../../../../../shared/comercial/dist/cost-model.js';

/**
 * Estado do levantamento de custos.
 *
 * O CÁLCULO NÃO MORA AQUI. `calculateEstimate` vem de `shared/comercial`,
 * portado sem alteração da referência e verificado pelos 16 goldens. Este hook
 * só guarda o rascunho e chama o motor.
 *
 * O recálculo acontece **a cada tecla**, sobre ~40 coleções aninhadas. É
 * deliberado e está no Complexity Tracking: a tela é uma calculadora, não um
 * CRUD. Calcular só no submit esconderia margem negativa e erro de
 * dimensionamento até o fim do preenchimento — numa tela onde o preço é
 * formado.
 */

type AnyRecord = Record<string, unknown>;

export type Levantamento = ReturnType<typeof useLevantamento>;

export function useLevantamento(estimatorName: string) {
  const [draft, setDraft] = useState<AnyRecord>(() =>
    normalizeCostEstimatePayload({
      ...(createDefaultCostEstimatePayload() as AnyRecord),
      estimatorName
    })
  );

  const patchDraft = useCallback((patch: AnyRecord) => {
    setDraft(current => ({ ...current, ...patch }));
  }, []);

  const patchAssumptions = useCallback((patch: AnyRecord) => {
    setDraft(current => ({
      ...current,
      assumptions: { ...((current.assumptions as AnyRecord) || {}), ...patch }
    }));
  }, []);

  const result = useMemo(() => calculateEstimate(draft) as AnyRecord, [draft]);
  const validation = useMemo(() => validateCostEstimate(draft) as AnyRecord, [draft]);

  /**
   * Se os erros já podem ser **mostrados**.
   *
   * A validação roda desde o primeiro render — precisa rodar, porque é dela
   * que saem as pendências do rodapé-guia e o estado do botão de salvar. Mas
   * um levantamento recém-aberto está legitimamente incompleto: pintar de
   * vermelho quarenta campos que o usuário ainda nem viu transforma o
   * vermelho em papel de parede, e aí ele deixa de significar alguma coisa
   * quando o erro for real.
   *
   * Então: **o erro existe desde sempre, mas só aparece depois que o usuário
   * tenta avançar.** Uma vez revelado, continua revelado — a partir daí o
   * campo acende e apaga ao vivo enquanto ele corrige, que é o retorno que
   * ele quer justamente nesse momento.
   *
   * O rodapé-guia continua dizendo o que falta desde o início. Ele orienta
   * sem acusar; é o vermelho no campo que acusa.
   */
  const [errosVisiveis, setErrosVisiveis] = useState(false);
  const revelarErros = useCallback(() => setErrosVisiveis(true), []);

  /**
   * Índice `caminho do campo` → mensagem, para a lacuna L1.
   *
   * `validateCostEstimate` já devolve `{ path, message, severity }` por item —
   * o `path` é o endereço exato do campo, incluindo item de coleção
   * (`laborContexts[0].workCondition`). A referência joga isso fora ao
   * concatenar tudo numa string única e mostrar num banner.
   *
   * Aqui a informação é preservada, e é o que permite pintar cada campo.
   */
  const errosPorCampo = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const item of (validation.errors as Array<AnyRecord>) || []) {
      const caminho = typeof item === 'string' ? null : (item.path as string | null);
      const mensagem = typeof item === 'string' ? item : (item.message as string);
      if (caminho && !mapa.has(caminho)) mapa.set(caminho, mensagem);
    }
    return mapa;
  }, [validation]);

  /** Pendências sem endereço de campo — vão para o banner-resumo, não para um campo. */
  const errosSemCampo = useMemo(() => {
    const soltos: string[] = [];
    for (const item of (validation.errors as Array<AnyRecord>) || []) {
      if (typeof item === 'string') soltos.push(item);
      else if (!item.path) soltos.push(item.message as string);
    }
    return soltos;
  }, [validation]);

  /**
   * Utilitários de coleção — usados por todas as cinco seções.
   *
   * As coleções do levantamento são listas de objetos com `id` (fases,
   * alocações, despesas, materiais, destinos). Editar por índice quebraria
   * assim que alguém removesse um item do meio, então tudo aqui é por `id`.
   */
  const updateCollection = useCallback(
    (colecao: string, id: string, patch: AnyRecord) => {
      setDraft(atual => ({
        ...atual,
        [colecao]: (atual[colecao] as AnyRecord[]).map(item =>
          item.id === id ? { ...item, ...patch } : item
        )
      }));
    },
    []
  );

  const removeCollection = useCallback((colecao: string, id: string) => {
    setDraft(atual => ({
      ...atual,
      [colecao]: (atual[colecao] as AnyRecord[]).filter(item => item.id !== id)
    }));
  }, []);

  const addToCollection = useCallback((colecao: string, item: AnyRecord) => {
    setDraft(atual => ({
      ...atual,
      [colecao]: [...((atual[colecao] as AnyRecord[]) || []), item]
    }));
  }, []);

  /** Edita uma coleção ANINHADA — `laborContexts[x].assignments[y]`. */
  const updateNested = useCallback(
    (colecao: string, paiId: string, aninhada: string, id: string, patch: AnyRecord) => {
      setDraft(atual => ({
        ...atual,
        [colecao]: (atual[colecao] as AnyRecord[]).map(pai =>
          pai.id === paiId
            ? {
                ...pai,
                [aninhada]: ((pai[aninhada] as AnyRecord[]) || []).map(item =>
                  item.id === id ? { ...item, ...patch } : item
                )
              }
            : pai
        )
      }));
    },
    []
  );

  const removeNested = useCallback(
    (colecao: string, paiId: string, aninhada: string, id: string) => {
      setDraft(atual => ({
        ...atual,
        [colecao]: (atual[colecao] as AnyRecord[]).map(pai =>
          pai.id === paiId
            ? {
                ...pai,
                [aninhada]: ((pai[aninhada] as AnyRecord[]) || []).filter(
                  item => item.id !== id
                )
              }
            : pai
        )
      }));
    },
    []
  );

  const addNested = useCallback(
    (colecao: string, paiId: string, aninhada: string, item: AnyRecord) => {
      setDraft(atual => ({
        ...atual,
        [colecao]: (atual[colecao] as AnyRecord[]).map(pai =>
          pai.id === paiId
            ? { ...pai, [aninhada]: [...((pai[aninhada] as AnyRecord[]) || []), item] }
            : pai
        )
      }));
    },
    []
  );

  /** Resultado calculado de uma fase, por id. */
  const resultadoDaFase = useCallback(
    (id: string): AnyRecord => {
      const lista = (result.contextResults as AnyRecord[]) || [];
      return lista.find(item => item.contextId === id || item.id === id) || {};
    },
    [result]
  );

  const assumptions = (draft.assumptions as AnyRecord) || {};

  return {
    draft,
    setDraft,
    patchDraft,
    assumptions,
    patchAssumptions,
    result,
    validation,
    errosPorCampo,
    errosSemCampo,
    updateCollection,
    removeCollection,
    addToCollection,
    updateNested,
    removeNested,
    addNested,
    resultadoDaFase,
    errosVisiveis,
    revelarErros,
    /** Mensagem do campo, ou `undefined` se ele está válido — ou ainda oculto. */
    erroDe: (caminho: string) =>
      errosVisiveis ? errosPorCampo.get(caminho) : undefined,
    /**
     * Erro apurado pela própria seção, sujeito à mesma regra de visibilidade.
     *
     * Existe porque nem toda obrigatoriedade da tela vem de
     * `validateCostEstimate` — várias são locais ao item sendo editado. Se
     * cada seção decidisse sozinha quando mostrar, a tela acenderia em
     * pedaços.
     */
    erroSe: (condicao: boolean, mensagem: string) =>
      errosVisiveis && condicao ? mensagem : undefined
  };
}
