import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '../../auth/AuthContext';
import { Shell } from '../../layout/Shell';
import { TopBar } from '../../layout/TopBar';
import { moduleRoutePath } from '../../modules/registry';

/**
 * Menu de entrada do módulo Comercial — desvio nº 9.
 *
 * A referência não tem esta tela: lá o login desemboca direto no assistente de
 * proposta, e quem vai levantar custos — que é o começo real do fluxo, já que é
 * o levantamento que carimba o código — tem de sair de lá e navegar.
 *
 * Metade disto já era inevitável, porque no filtroAPP todo módulo mora atrás de
 * um prefixo. O que a decisão do mantenedor acrescentou foi a **tela de
 * escolha**. E ela é menos estranha à referência do que parecia: o diálogo de
 * abertura de `/` já oferecia três caminhos, e um deles ("Levantar custos") era
 * um **link** para a tela de custos. Este menu é a promoção daquilo a tela.
 *
 * **Sem baseline visual** — não existe na referência para ser fotografado, então
 * a comparação de paridade não se aplica aqui.
 */

type Destino = {
  titulo: string;
  descricao: string;
  rota: string;
  icone: ReactNode;
};

const DESTINOS: Array<Omit<Destino, 'rota'> & { rotaKey: 'custos' | 'propostas' }> = [
  {
    titulo: 'Levantar custos',
    descricao:
      'Calcula custos, impostos, comissões e margem. É ele que carimba o código da proposta.',
    rotaKey: 'custos',
    icone: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8" />
        <path d="M8 11h3" />
        <path d="M13 11h3" />
        <path d="M8 15h3" />
        <path d="M13 15h3" />
      </>
    )
  },
  {
    titulo: 'Propostas',
    descricao: 'Monta a proposta técnica e a comercial, e consulta o histórico de emissões.',
    rotaKey: 'propostas',
    icone: (
      <>
        <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path d="M14 3v6h6" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </>
    )
  }
];

export function ComercialPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Shell>
      <TopBar title="Comercial" subtitle={user?.name || 'Filtrovali App'} showLogo />
      <main className="page-scroll com-root">
        <section className="com-painel com-menu">
          <div className="com-secao-titulo">
            <div>
              <h2>O que você quer fazer?</h2>
              <p>
                O levantamento vem antes da proposta — é ele que define o código que os dois
                documentos vão usar.
              </p>
            </div>
          </div>

          <div className="com-grid">
            {DESTINOS.map(destino => (
              <button
                key={destino.rotaKey}
                type="button"
                className="com-cartao"
                onClick={() => navigate(moduleRoutePath('comercial', destino.rotaKey))}
              >
                <span className="com-cartao-icone" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {destino.icone}
                  </svg>
                </span>
                <strong className="com-quebrar">{destino.titulo}</strong>
                <span className="com-cartao-descricao com-quebrar">{destino.descricao}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </Shell>
  );
}
