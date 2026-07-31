import { useAuth } from '../../auth/AuthContext';
import { Shell } from '../../layout/Shell';
import { TopBar } from '../../layout/TopBar';
import { useComercialStatus } from '../../hooks/useComercial';

export function ComercialPage() {
  const { user } = useAuth();
  const statusQuery = useComercialStatus();

  return (
    <Shell>
      <TopBar
        title="Comercial"
        subtitle={user?.name || 'Filtrovali App'}
        showLogo
      />
      <main className="page-scroll">
        <section className="page-card">
          <div className="section-title">Comercial</div>
          <p className="placeholder-copy">
            {statusQuery.isLoading ? 'Carregando...' : 'Modulo pronto para implementacao.'}
          </p>
        </section>
      </main>
    </Shell>
  );
}
