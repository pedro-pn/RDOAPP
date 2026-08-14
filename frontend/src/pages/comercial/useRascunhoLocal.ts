import { useCallback, useEffect, useRef, useState } from 'react';

import {
  chaveDoRascunho,
  descartarRascunho,
  descartarRascunhosDaTela,
  descreverIdade,
  guardarRascunho,
  lerRascunho,
  type RascunhoGuardado
} from './rascunhoLocal';

/**
 * Liga o rascunho local a uma tela (tarefas T089 a T092 — lacuna **L3**).
 *
 * A regra mora em `rascunhoLocal.ts`, que é puro e testado. Aqui fica só o que
 * depende do React: o *debounce*, o `beforeunload` e o estado da oferta.
 *
 * **Ordem importa na montagem.** O rascunho é lido **uma vez**, antes de o
 * autossalvamento começar. Se as duas coisas rodassem juntas, o primeiro `setDraft`
 * do componente sobrescreveria o rascunho guardado com o payload em branco — e o
 * trabalho que se queria proteger sumiria justamente ao abrir a tela.
 */

const DEBOUNCE_MS = 800;

export function useRascunhoLocal({
  conta,
  tela,
  modo,
  codigo,
  dados,
  ativo,
  rotulo
}: {
  /** Id da conta autenticada; separa pessoas que usam o mesmo navegador. */
  conta: string;
  tela: string;
  modo: string | null;
  codigo: string;
  dados: unknown;
  /** Falso enquanto a tela não está em trabalho — não guarda rascunho de diálogo. */
  ativo: boolean;
  rotulo?: string;
}) {
  const storage = typeof window === 'undefined' ? null : window.localStorage;
  const chave = conta && modo ? chaveDoRascunho(conta, tela, modo, codigo) : null;

  const [oferta, setOferta] = useState<RascunhoGuardado | null>(null);
  const [alterado, setAlterado] = useState(false);

  /**
   * Enquanto for `false`, nada é gravado.
   *
   * É o que impede o autossalvamento de correr contra a leitura inicial. Vira
   * `true` só depois que a tela decidiu o que fazer com o rascunho encontrado.
   */
  const liberado = useRef(false);
  const chaveLida = useRef<string | null>(null);

  // Leitura inicial — uma vez por chave.
  useEffect(() => {
    if (!storage || !chave || !ativo) return;
    if (chaveLida.current === chave) return;

    chaveLida.current = chave;
    liberado.current = false;

    const encontrado = lerRascunho(storage, chave);
    if (encontrado) {
      setOferta(encontrado);
    } else {
      liberado.current = true;
    }
  }, [storage, chave, ativo]);

  // Autossalvamento com debounce.
  useEffect(() => {
    if (!storage || !chave || !ativo || !liberado.current) return;

    const timer = window.setTimeout(() => {
      guardarRascunho(storage, chave, dados, rotulo);
      setAlterado(true);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [storage, chave, ativo, dados, rotulo]);

  /**
   * Aviso de saída.
   *
   * Só aparece quando há alteração pendente. Um aviso que aparece sempre é um
   * aviso que se aprende a ignorar — e aí ele não protege mais nada no dia em que
   * a alteração é de verdade.
   */
  useEffect(() => {
    if (!alterado || !ativo) return;

    const aviso = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [alterado, ativo]);

  /** Aceita o rascunho oferecido e devolve os dados para a tela aplicar. */
  const recuperar = useCallback(() => {
    const dadosRecuperados = oferta?.dados;
    setOferta(null);
    liberado.current = true;
    return dadosRecuperados;
  }, [oferta]);

  /** Recusa a oferta e apaga: quem disse "não" não quer ser perguntado de novo. */
  const descartarOferta = useCallback(() => {
    if (storage && chave) descartarRascunho(storage, chave);
    setOferta(null);
    liberado.current = true;
  }, [storage, chave]);

  /** Depois de gravar no servidor o rascunho não pode sobrar (T091). */
  const limparTudo = useCallback(() => {
    if (!storage) return;
    descartarRascunhosDaTela(storage, conta, tela);
    setAlterado(false);
  }, [storage, conta, tela]);

  /** Remove só o rascunho corrente depois de persistir este trabalho no servidor. */
  const limparAtual = useCallback(() => {
    if (storage && chave) descartarRascunho(storage, chave);
    setAlterado(false);
  }, [storage, chave]);

  return {
    oferta,
    idadeDaOferta: oferta ? descreverIdade(oferta.salvoEm) : '',
    alterado,
    recuperar,
    descartarOferta,
    limparAtual,
    limparTudo
  };
}
