import { useCallback, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

const STORAGE_KEY_PREFIX = 'filtrovali:efetivo-tutorial-done:v1:';
type Section = 'produtividade' | 'ausencias';

function storageKey(userKey: string) {
  return `${STORAGE_KEY_PREFIX}${userKey}`;
}

function hasDone(userKey: string) {
  try { return localStorage.getItem(storageKey(userKey)) === '1'; } catch { return false; }
}

function markDone(userKey: string) {
  try { localStorage.setItem(storageKey(userKey), '1'); } catch { /* sessão sem armazenamento local */ }
}

interface Props {
  userKey: string;
  ready: boolean;
  goToSection: (section: Section) => void;
  triggerRef: MutableRefObject<(() => void) | null>;
}

export function EfetivoTutorial({ userKey, ready, goToSection, triggerRef }: Props) {
  const startTutorial = useCallback(() => {
    if (!userKey || document.body.classList.contains('driver-active')) return;
    markDone(userKey);
    goToSection('produtividade');

    window.setTimeout(() => {
      const steps: DriveStep[] = [
        {
          element: '[data-efetivo-nav]',
          popover: {
            title: 'Áreas do Efetivo',
            description: 'Alterne entre o indicador de produtividade e o cadastro de férias e ausências.',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '[data-efetivo-filters]',
          popover: {
            title: 'Período analisado',
            description: 'Escolha o ano e o mês de corte. O mês corrente nunca entra no resultado oficial.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '[data-efetivo-kpis]',
          popover: {
            title: 'Indicadores oficiais',
            description: 'Consulte HH produtivas, média mensal, improdutividade geral e pendências que ficaram fora da taxa.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '[data-efetivo-results]',
          popover: {
            title: 'Resultado por pessoa',
            description: 'Clique em um colaborador para conferir as HH normais e as horas extras excluídas em cada mês.',
            side: 'top',
            align: 'start',
            onNextClick: (_element, _step, { driver: driverObj }) => {
              goToSection('ausencias');
              window.setTimeout(() => driverObj.moveNext(), 250);
            }
          }
        },
        {
          element: '[data-efetivo-absences]',
          popover: {
            title: 'Férias e ausências',
            description: 'Cadastre férias para sinalizar os meses afetados. A referência já é anualizada, por isso a taxa não desconta férias novamente.',
            side: 'bottom',
            align: 'start'
          }
        }
      ];
      driver({
        showProgress: true,
        progressText: '{{current}} de {{total}}',
        nextBtnText: 'Próximo →',
        prevBtnText: '← Anterior',
        doneBtnText: 'Concluir',
        allowClose: true,
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.6,
        steps
      }).drive();
    }, 350);
  }, [goToSection, userKey]);

  useEffect(() => {
    triggerRef.current = startTutorial;
    return () => { if (triggerRef.current === startTutorial) triggerRef.current = null; };
  }, [startTutorial, triggerRef]);

  useEffect(() => {
    if (!ready || !userKey || hasDone(userKey)) return;
    const timer = window.setTimeout(startTutorial, 800);
    return () => window.clearTimeout(timer);
  }, [ready, startTutorial, userKey]);

  return null;
}
