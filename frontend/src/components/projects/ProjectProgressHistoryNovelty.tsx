import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

import {
  markAcompanhamentoProgressHistoryNoveltySeen,
  shouldShowAcompanhamentoProgressHistoryNovelty
} from '../../auth/moduleNavigation';
import type { AuthUser } from '../../types/auth';

const PROGRESS_HISTORY_SELECTOR = '[data-acp-progress-history-chart]';

interface ProjectProgressHistoryNoveltyProps {
  user?: Pick<AuthUser, 'id'> | null;
  enabled: boolean;
  onSeen: () => void;
}

// Aviso temporário do novo gráfico semanal de avanço no dashboard do projeto.
export function ProjectProgressHistoryNovelty({ user, enabled, onSeen }: ProjectProgressHistoryNoveltyProps) {
  const started = useRef(false);
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;
  const userId = user?.id ?? '';

  useEffect(() => {
    if (!enabled || !userId || started.current) return undefined;
    const noveltyUser = { id: userId };
    if (!shouldShowAcompanhamentoProgressHistoryNovelty(noveltyUser)) {
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

      if (!shouldShowAcompanhamentoProgressHistoryNovelty(noveltyUser)) {
        onSeenRef.current();
        return;
      }

      const steps: DriveStep[] = [
        {
          popover: {
            title: '✨ Novo recurso: histórico de avanço',
            description:
              'O dashboard do projeto agora mostra um gráfico semanal para comparar o avanço da obra ao longo do tempo.'
          }
        }
      ];

      if (document.querySelector(PROGRESS_HISTORY_SELECTOR)) {
        steps.push({
          element: PROGRESS_HISTORY_SELECTOR,
          popover: {
            title: 'Histórico semanal',
            description:
              'A linha mostra o avanço acumulado por semana. Passe o mouse nos pontos para ver a data e o percentual.',
            side: 'bottom',
            align: 'start'
          }
        });
      }

      started.current = true;
      markAcompanhamentoProgressHistoryNoveltySeen(noveltyUser);
      const driverObj = driver({
        showProgress: false,
        nextBtnText: 'Ver gráfico',
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
