import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';

import { useAuth } from '../../auth/AuthContext';
import { Shell } from '../../layout/Shell';
import { TopBar } from '../../layout/TopBar';
import { ProductivityBoard } from './components/ProductivityBoard';
import { AbsencesBoard } from './components/AbsencesBoard';
import { EfetivoTutorial } from './EfetivoTutorial';
import './efetivo.css';

type EfetivoSection = 'produtividade' | 'ausencias';

function parseSection(value: string | null): EfetivoSection {
  return value === 'ausencias' ? 'ausencias' : 'produtividade';
}

export function EfetivoPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tutorialTrigger = useRef<(() => void) | null>(null);
  const section = parseSection(searchParams.get('section'));
  const canManage = user?.accountType === 'ADMIN'
    || Boolean(user?.moduleRoles?.includes('efetivo:manager'));
  const setSection = useCallback((nextSection: EfetivoSection) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      if (nextSection === 'produtividade') next.delete('section');
      else next.set('section', nextSection);
      if (nextSection !== 'produtividade') {
        next.delete('ateMes');
        next.delete('colaborador');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return (
    <Shell>
      <TopBar
        title="Efetivo Operacional"
        subtitle="Produtividade, capacidade e férias"
        actions={<button className="topbar-chip" type="button" onClick={() => tutorialTrigger.current?.()}>Ver tutorial</button>}
      />
      <main className="page-scroll equip-page efetivo-page">
        <div className="equip-layout">
          <nav className="equip-nav" aria-label="Áreas de Efetivo Operacional" data-efetivo-nav>
            <button
              className={`equip-nav-item ${section === 'produtividade' ? 'active' : ''}`}
              type="button"
              aria-current={section === 'produtividade'}
              onClick={() => setSection('produtividade')}
            >
              <span className="equip-nav-ico" aria-hidden="true">▥</span>
              <span className="equip-nav-label">Produtividade</span>
            </button>
            <button
              className={`equip-nav-item ${section === 'ausencias' ? 'active' : ''}`}
              type="button"
              aria-current={section === 'ausencias'}
              onClick={() => setSection('ausencias')}
            >
              <span className="equip-nav-ico" aria-hidden="true">◫</span>
              <span className="equip-nav-label">Férias e ausências</span>
            </button>
          </nav>

          <div className="equip-mobile-nav">
            <label className="equip-mobile-nav-label" htmlFor="efetivo-section-select">Seção do módulo</label>
            <select
              id="efetivo-section-select"
              className="equip-nav-select"
              value={section}
              onChange={event => setSection(event.target.value as EfetivoSection)}
            >
              <option value="produtividade">Produtividade</option>
              <option value="ausencias">Férias e ausências</option>
            </select>
          </div>

          <section className="equip-content">
            {section === 'produtividade'
              ? <ProductivityBoard canManage={canManage} />
              : <AbsencesBoard canManage={canManage} />}
          </section>
        </div>
      </main>
      <EfetivoTutorial
        userKey={user?.id || ''}
        ready={Boolean(user)}
        goToSection={setSection}
        triggerRef={tutorialTrigger}
      />
    </Shell>
  );
}
