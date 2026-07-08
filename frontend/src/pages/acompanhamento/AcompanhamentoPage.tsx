import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext';
import { accountPageStateFromPath, markAcompanhamentoNoveltySeen } from '../../auth/moduleNavigation';
import { Shell } from '../../layout/Shell';
import { TopBar } from '../../layout/TopBar';
import { AcompanhamentoDashboard } from '../../components/projects/AcompanhamentoDashboard';
import { ProjectCardsBoard } from '../../components/projects/ProjectCardsBoard';
import { CostEngineManager } from '../../components/projects/CostEngineManager';
import { AcompanhamentoTutorial } from '../../components/AcompanhamentoTutorial';

type Section = 'dashboard' | 'projetos' | 'custo';

function tutorialUserKey(user: ReturnType<typeof useAuth>['user'], isManager: boolean) {
  const identity = String(user?.email || user?.username || user?.id || '').trim().toLowerCase();
  return identity ? `${isManager ? 'manager' : 'viewer'}:${identity}` : '';
}

export function AcompanhamentoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [section, setSection] = useState<Section>('dashboard');
  const tutorialTrigger = useRef<(() => void) | null>(null);

  const isManager = user?.accountType === 'ADMIN' || Boolean(user?.moduleRoles?.includes('acompanhamento:manager'));
  const userKey = tutorialUserKey(user, isManager);

  // Ao entrar no módulo, a novidade do hub já foi "consumida".
  useEffect(() => { if (user) markAcompanhamentoNoveltySeen(user); }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Shell>
      <TopBar
        title="Acompanhamento de Projetos"
        subtitle="Previsto x realizado, custos e cronograma"
        actions={
          <>
            <button className="topbar-chip" type="button" onClick={() => tutorialTrigger.current?.()}>Ver tutorial</button>
            <button className="topbar-chip" type="button" onClick={() => navigate('/conta', { state: accountPageStateFromPath(location.pathname) })}>Conta</button>
            <button className="topbar-chip" type="button" onClick={handleLogout}>Sair</button>
          </>
        }
      />
      <main className="page-scroll equip-page">
        {/*
          AVISO TEMPORÁRIO — TODO(vr-ponto-mais): remover este banner (e a regra `.acp-cost-notice`
          em frontend/src/styles/base.css) quando a integração com o ponto (VR Ponto Mais) para o
          custo de mão de obra for implementada. Enquanto isso, o realizado do módulo considera só as
          compras (Omie), sem o custo dos colaboradores. Ref.: PLANO_MODULO_ACOMPANHAMENTO_PROJETOS.md
          §16 ("Falta — depende de VR Ponto Mais").
        */}
        <div className="acp-cost-notice" role="note">
          <span className="acp-cost-notice-ico" aria-hidden="true">⚠️</span>
          <span>
            <strong>Custo de mão de obra em validação.</strong> Já é possível importar o ponto e ver o
            custo de mão de obra (HH) por colaborador e por projeto na aba <strong>Custo</strong>. Esse
            valor ainda <strong>não</strong> é somado ao realizado oficial (compras/Omie) até a validação
            dos números. A integração automática com o ponto (VR Ponto Mais) segue pendente.
          </span>
        </div>
        <div className="equip-layout">
          <nav className="equip-nav" aria-label="Áreas de Acompanhamento" data-acp-nav>
            <button className={`equip-nav-item ${section === 'dashboard' ? 'active' : ''}`} type="button" aria-current={section === 'dashboard'} onClick={() => setSection('dashboard')}>
              <span className="equip-nav-ico" aria-hidden="true">◧</span>
              <span className="equip-nav-label">Dashboard</span>
            </button>
            <button className={`equip-nav-item ${section === 'projetos' ? 'active' : ''}`} type="button" aria-current={section === 'projetos'} onClick={() => setSection('projetos')}>
              <span className="equip-nav-ico" aria-hidden="true">▦</span>
              <span className="equip-nav-label">Projetos</span>
            </button>
            {isManager ? (
              <button className={`equip-nav-item ${section === 'custo' ? 'active' : ''}`} type="button" aria-current={section === 'custo'} onClick={() => setSection('custo')}>
                <span className="equip-nav-ico" aria-hidden="true">$</span>
                <span className="equip-nav-label">Custo</span>
              </button>
            ) : null}
          </nav>

          <div className="equip-mobile-nav" data-acp-mobile-nav>
            <label className="equip-mobile-nav-label" htmlFor="acp-section-select">Seção do módulo</label>
            <select
              id="acp-section-select"
              className="equip-nav-select"
              value={section}
              onChange={event => setSection(event.target.value as Section)}
            >
              <option value="dashboard">Dashboard</option>
              <option value="projetos">Projetos</option>
              {isManager ? <option value="custo">Custo</option> : null}
            </select>
          </div>

          <section className="equip-content">
            {section === 'projetos' ? <ProjectCardsBoard />
              : section === 'custo' && isManager ? <CostEngineManager />
              : <AcompanhamentoDashboard />}
          </section>
        </div>
      </main>
      <AcompanhamentoTutorial
        userKey={userKey}
        ready={section === 'dashboard'}
        goToSection={setSection}
        triggerRef={tutorialTrigger}
      />
    </Shell>
  );
}
