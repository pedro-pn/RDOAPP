import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '../../../auth/AuthContext';
import { moduleRoutePath } from '../../../modules/registry';

/**
 * Chrome do módulo Comercial — desvio nº 10.
 *
 * Dentro da raiz do módulo o chrome é o da **referência**, não o `Shell`/
 * `TopBar` do filtroAPP. Decisão do mantenedor em 03/08, com motivo
 * estratégico: o filtroAPP inteiro vai se parecer com o comercialAPP, então
 * este chrome é prévia do padrão que vem — não um corpo estranho.
 *
 * Porte de `.cost-topbar` + `.cost-hero` de `app/custos/page.tsx:497-531`.
 *
 * A única coisa que este componente acrescenta à referência é o **caminho de
 * volta ao hub**, e ele vive onde já vivia um link na referência: na marca.
 * Lá a marca levava para `/` (a proposta); aqui leva para o menu do módulo, e
 * "Sair do módulo" leva ao hub do filtroAPP. Sem isso o usuário fica preso.
 */

const assetsBaseUrl = (import.meta.env.VITE_ASSETS_BASE_URL || '').replace(/\/$/, '');
const LOGO_URL = `${assetsBaseUrl}/assets/Logo/LOGO_HEADER.png`;

type ComercialChromeProps = {
  /** Texto pequeno acima do título, em caixa alta. */
  eyebrow: string;
  titulo: string;
  descricao?: string;
  /** Conteúdo extra da faixa — a faixa de indicadores, por exemplo. */
  heroExtra?: ReactNode;
  /** Ações da barra superior, à direita do identificador do usuário. */
  acoes?: ReactNode;
  children: ReactNode;
};

export function ComercialChrome({
  eyebrow,
  titulo,
  descricao,
  heroExtra,
  acoes,
  children
}: ComercialChromeProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="com-root com-app">
      <header className="com-topbar">
        <button
          type="button"
          className="com-marca"
          aria-label="Comercial — voltar ao menu do módulo"
          onClick={() => navigate(moduleRoutePath('comercial', 'index'))}
        >
          <img src={LOGO_URL} alt="Filtrovali" />
        </button>

        <div className="com-topbar-acoes">
          <span className="com-usuario">
            Orçamentista: <b className="com-quebrar">{user?.name || '—'}</b>
          </span>
          {acoes}
          <button
            type="button"
            className="com-btn com-btn-fantasma"
            onClick={() => navigate('/modulos')}
          >
            Sair do módulo
          </button>
        </div>
      </header>

      <section className="com-hero">
        <div className="com-hero-titulo">
          <span className="com-eyebrow">{eyebrow}</span>
          <h1>{titulo}</h1>
          {descricao && <p>{descricao}</p>}
        </div>
        {heroExtra}
      </section>

      <main className="com-conteudo">{children}</main>
    </div>
  );
}
