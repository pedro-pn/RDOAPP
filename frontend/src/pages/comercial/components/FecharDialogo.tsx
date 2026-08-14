import { useEffect } from 'react';

/**
 * A saída dos diálogos de escolha do módulo.
 *
 * Os quatro — "Como deseja começar?", "Confirme a proposta", o modo da proposta
 * e o modelo do documento — abriam **sem porta de saída**: quem clicava em
 * "Levantar custos" ou "Propostas" por engano tinha de escolher uma das opções
 * ou recarregar a página no endereço da entrada. Relatado em 14/08, antes do
 * uso em staging.
 *
 * **Fechar leva à entrada do módulo, não à tela de trás.** Estes diálogos não
 * são um passo de um fluxo: eles são a pergunta que abre a tela. Fechar sem
 * responder significa "não era aqui que eu queria estar", e o lugar de quem não
 * quer estar aqui é o menu.
 *
 * `Escape` fecha junto, porque é o gesto que todo mundo tenta primeiro — e o
 * `aria-modal` promete um diálogo, do qual se espera poder sair.
 */
/** Não exportado: só o botão usa, e exportar hook ao lado de componente
 *  quebra o fast refresh do Vite. */
function useFecharComEsc(fechar: () => void) {
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      evento.preventDefault();
      fechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [fechar]);
}

export function BotaoFecharDialogo({
  fechar,
  rotulo = 'Fechar e voltar ao menu do módulo'
}: {
  fechar: () => void;
  rotulo?: string;
}) {
  useFecharComEsc(fechar);

  return (
    <button type="button" className="com-fechar-dialogo" aria-label={rotulo} onClick={fechar}>
      ×
    </button>
  );
}
