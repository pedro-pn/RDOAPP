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
    /** Mensagem do campo, ou `undefined` se ele está válido. */
    erroDe: (caminho: string) => errosPorCampo.get(caminho)
  };
}
