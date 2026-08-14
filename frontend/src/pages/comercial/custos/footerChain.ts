/**
 * O rodapé-guia do levantamento de custos.
 *
 * Esta é a peça mais interessante da tela, e a que quase ninguém nota: o botão
 * primário do rodapé **muda de texto E de destino** conforme o que falta,
 * seguindo uma cadeia de prioridade fixa. Clicar leva direto à seção pendente.
 *
 *   mão de obra → materiais e insumos → mob./desmob. → comissões → salvar
 *
 * Ou seja: **o app já sabe o caminho e já sabe o que falta — ele só não diz
 * qual campo**. É o outro lado exato da lacuna L1: a informação existe, a
 * localização é que se perde. É também o roteiro do tutorial (L4), e o
 * mantenedor confirmou que é assim que se usa na prática.
 *
 * Portado de `app/custos/page.tsx:595-604`. As mensagens são as da referência,
 * ao pé da letra — mudá-las é divergência, não melhoria.
 *
 * Fica isolado num módulo puro porque é regra de navegação, não desenho: assim
 * dá para testar a cadeia inteira sem montar 465 controles na tela.
 */

export type CostSection = 'premises' | 'labor' | 'inputs' | 'logistics' | 'summary';

/** As pendências que a cadeia consulta, na ordem em que ela as consulta. */
export type PendingSections = {
  labor: boolean;
  inputs: boolean;
  logistics: boolean;
  commercial: boolean;
};

/** O que impede o salvamento quando não há mais seção pendente. */
export type SaveGuards = {
  saving: boolean;
  /** `draft.title` já sem espaços nas pontas. */
  title: string;
  validPricing: boolean;
  salePrice: number;
};

export type FooterAction =
  | { kind: 'goto'; label: string; target: CostSection; disabled: false }
  | { kind: 'save'; label: string; target: null; disabled: boolean };

/**
 * A cadeia, na ordem da referência. **A ordem importa**: com mão de obra e
 * logística pendentes ao mesmo tempo, o rodapé manda para mão de obra — porque
 * a logística depende da equipe dimensionada, e resolver na ordem inversa faz
 * o usuário refazer o trabalho.
 */
const CHAIN: Array<{ key: keyof PendingSections; label: string; target: CostSection }> = [
  {
    key: 'labor',
    label: 'Preencher itens obrigatórios da mão de obra →',
    target: 'labor'
  },
  {
    key: 'inputs',
    label: 'Revisar materiais e insumos →',
    target: 'inputs'
  },
  {
    key: 'logistics',
    label: 'Preencher mobilização e desmobilização →',
    target: 'logistics'
  },
  {
    key: 'commercial',
    label: 'Completar comissões e indicações →',
    target: 'summary'
  }
];

export function footerAction(pending: PendingSections, guards: SaveGuards): FooterAction {
  for (const step of CHAIN) {
    if (pending[step.key]) {
      // Enquanto há seção pendente o botão NUNCA fica desabilitado: ele é um
      // atalho para resolver, não uma trava. Desabilitar aqui esconderia o
      // caminho justamente de quem está perdido.
      return { kind: 'goto', label: step.label, target: step.target, disabled: false };
    }
  }

  const blocked = guards.saving || saveBlockedByContent(guards);

  return {
    kind: 'save',
    label: guards.saving ? 'Salvando...' : 'Salvar levantamento e criar proposta →',
    target: null,
    disabled: blocked
  };
}

/**
 * Se o salvamento está travado pelo **conteúdo** do levantamento, e não por já
 * estar salvando.
 *
 * A distinção existe porque o botão desabilitado é mudo: ele não diz o que
 * falta. Quando a cadeia já chegou no fim e mesmo assim ele não deixa salvar,
 * o que sobrou são campos — e é o único momento em que a tela pode acender o
 * vermelho sem que o usuário tenha clicado, porque não há mais nada para
 * clicar. "Salvando..." não é falta de nada e não deve acender coisa alguma.
 */
export function saveBlockedByContent(guards: SaveGuards): boolean {
  return !guards.title.trim() || !guards.validPricing || !(guards.salePrice > 0);
}

/**
 * A trava final só pode acender campos automaticamente quando o usuário já
 * chegou ao resumo **depois de uma tentativa de avanço**. Na abertura, o
 * levantamento estar incompleto é o estado normal — vermelho ali significaria
 * uma tentativa que nunca aconteceu.
 */
export function deveRevelarErrosAutomaticamente(
  secao: CostSection,
  salvarTravadoPorConteudo: boolean,
  houveTentativaDeAvanco: boolean
): boolean {
  return houveTentativaDeAvanco && secao === 'summary' && salvarTravadoPorConteudo;
}

/** A cadeia em texto, para o roteiro do tutorial de primeiro acesso (L4). */
export function chainSummary(): string[] {
  return [...CHAIN.map(step => step.label), 'Salvar levantamento e criar proposta →'];
}
