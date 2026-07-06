import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

import {
  hasSeenHubFirstLoginTutorial,
  markAcompanhamentoNoveltySeen
} from '../auth/moduleNavigation';
import type { AuthUser } from '../types/auth';

const MODULE_SELECTOR = '[data-hub-module-id="acompanhamento"]';

interface AcompanhamentoHubNoveltyProps {
  user: AuthUser;
  enabled: boolean;
  onSeen: () => void;
}

// Destaque único ("estilo tutorial") do novo módulo Acompanhamento no hub, para contas com acesso.
// Não colide com o tour geral de primeiro login: só roda quando este já foi visto.
export function AcompanhamentoHubNovelty({ user, enabled, onSeen }: AcompanhamentoHubNoveltyProps) {
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    // Usuário novo ainda verá o tour geral do hub (que já cobre o Acompanhamento) — não sobrepor.
    if (!hasSeenHubFirstLoginTutorial(user)) return;

    started.current = true;
    const timer = window.setTimeout(() => {
      if (!document.querySelector(MODULE_SELECTOR) || document.body.classList.contains('driver-active')) {
        markAcompanhamentoNoveltySeen(user);
        onSeen();
        return;
      }

      markAcompanhamentoNoveltySeen(user);
      const driverObj = driver({
        showProgress: false,
        doneBtnText: 'Entendi',
        allowClose: true,
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.6,
        onDestroyed: () => onSeen(),
        steps: [
          {
            element: MODULE_SELECTOR,
            popover: {
              title: '✨ Novo módulo: Acompanhamento de Projetos',
              description:
                'Acompanhe previsto × realizado das obras: avanço físico, custos, cronograma e situação dos projetos. Clique no card para entrar — um tutorial guiado abre no primeiro acesso.',
              side: 'bottom',
              align: 'start'
            }
          }
        ]
      });
      driverObj.drive();
    }, 700);

    return () => window.clearTimeout(timer);
  }, [enabled, onSeen, user]);

  return null;
}
