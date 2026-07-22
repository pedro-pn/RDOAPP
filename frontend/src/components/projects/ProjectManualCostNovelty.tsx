import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

import {
  markAcompanhamentoManualCostNoveltySeen,
  shouldShowAcompanhamentoManualCostNovelty
} from '../../auth/moduleNavigation';
import type { AuthUser } from '../../types/auth';

const MANUAL_COST_SELECTOR = '[data-acp-manual-costs]';
const MANUAL_COST_ADD_SELECTOR = '[data-acp-manual-cost-add]';

interface ProjectManualCostNoveltyProps {
  user?: Pick<AuthUser, 'id'> | null;
  enabled: boolean;
  onSeen: () => void;
}

// Aviso temporário do lançamento de custo manual no dashboard do projeto.
export function ProjectManualCostNovelty({ user, enabled, onSeen }: ProjectManualCostNoveltyProps) {
  const started = useRef(false);
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;
  const userId = user?.id ?? '';

  useEffect(() => {
    if (!enabled || !userId || started.current) return undefined;
    const noveltyUser = { id: userId };
    if (!shouldShowAcompanhamentoManualCostNovelty(noveltyUser)) {
      onSeenRef.current();
      return undefined;
    }

    let cancelled = false;
    let retryTimer: number | undefined;

    const startWhenReady = (attempt = 0) => {
      if (cancelled) return;
      if (document.body.classList.contains('driver-active')) {
        if (attempt < 20) retryTimer = window.setTimeout(() => startWhenReady(attempt + 1), 500);
        return;
      }

      if (!shouldShowAcompanhamentoManualCostNovelty(noveltyUser)) {
        onSeenRef.current();
        return;
      }

      const steps: DriveStep[] = [
        {
          popover: {
            title: '✨ Novo recurso: custo manual',
            description:
              'Gestores podem lançar custos que precisam entrar no acompanhamento mesmo quando a compra não aparece no Omie.'
          }
        }
      ];

      const addTarget = document.querySelector(MANUAL_COST_ADD_SELECTOR) ? MANUAL_COST_ADD_SELECTOR : MANUAL_COST_SELECTOR;
      if (document.querySelector(addTarget)) {
        steps.push({
          element: addTarget,
          popover: {
            title: 'Custos manuais',
            description:
              'Abra o formulário por este botão e informe valor, data e observação. O total passa a compor o consumo realizado do projeto.',
            side: 'bottom',
            align: 'start'
          }
        });
      }

      started.current = true;
      markAcompanhamentoManualCostNoveltySeen(noveltyUser);
      const driverObj = driver({
        showProgress: false,
        nextBtnText: 'Ver recurso',
        prevBtnText: 'Voltar',
        doneBtnText: 'Entendi',
        allowClose: true,
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.6,
        onDestroyed: () => onSeenRef.current(),
        steps
      });
      driverObj.drive();
    };

    const timer = window.setTimeout(startWhenReady, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [enabled, userId]);

  return null;
}
