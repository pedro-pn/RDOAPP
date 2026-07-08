import { useCallback, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

const STORAGE_KEY_PREFIX = 'filtrovali-acompanhamento-tutorial-done';

type Section = 'dashboard' | 'projetos' | 'custo';

function storageKey(identity: string) {
  return `${STORAGE_KEY_PREFIX}:${identity}`;
}

function hasDoneTutorial(identity: string) {
  try {
    return localStorage.getItem(storageKey(identity)) === '1';
  } catch {
    return false;
  }
}

function markTutorialDone(identity: string) {
  try {
    localStorage.setItem(storageKey(identity), '1');
  } catch {
    // localStorage pode estar indisponível; o guard em memória evita reabrir na mesma sessão.
  }
}

interface AcompanhamentoTutorialProps {
  userKey: string;
  ready: boolean;
  goToSection: (section: Section) => void;
  triggerRef: MutableRefObject<(() => void) | null>;
}

export function AcompanhamentoTutorial({ userKey, ready, goToSection, triggerRef }: AcompanhamentoTutorialProps) {
  const startTutorial = useCallback(() => {
    if (!userKey) return;
    if (document.body.classList.contains('driver-active')) return;

    markTutorialDone(userKey);
    goToSection('dashboard');

    // Constrói os passos após a troca para o Dashboard renderizar (detecção correta dos alvos).
    window.setTimeout(() => {
    const hasDashboard = Boolean(document.querySelector('[data-acp-dashboard-filters]'));
    const navSelector = window.matchMedia('(max-width: 900px)').matches ? '[data-acp-mobile-nav]' : '[data-acp-nav]';

    const steps: DriveStep[] = [];
    steps.push({
      element: navSelector,
      popover: {
        title: 'Abas do módulo',
        description: 'Alterne entre Dashboard (visão geral) e Projetos (cards de cada obra). Gestores também têm a aba Custo (motor de custo operacional).',
        side: 'right',
        align: 'start',
        // Sem dashboard (ainda carregando/sem dados): já pula direto para a aba Projetos.
        ...(hasDashboard ? {} : {
          onNextClick: (_element, _step, { driver: driverObj }) => {
            goToSection('projetos');
            window.setTimeout(() => driverObj.moveNext(), 200);
          }
        })
      }
    });

    if (hasDashboard) {
      steps.push({
        element: '[data-acp-dashboard-filters]',
        popover: {
          title: 'Filtros',
          description: 'Busca, modalidade, situação (em andamento / arquivados / todos), categoria de gasto e o indicador exibido no gráfico.',
          side: 'bottom',
          align: 'start'
        }
      });
      steps.push({
        element: '[data-acp-kpis]',
        popover: {
          title: 'Indicadores',
          description: 'Totais dos projetos filtrados: quantidade, venda e custo previstos, e a soma do indicador escolhido.',
          side: 'bottom',
          align: 'start'
        }
      });
      steps.push({
        element: '[data-acp-dashboard-table]',
        popover: {
          title: 'Tabela de projetos',
          description: 'Previsto × realizado por projeto (venda, custo, margem, dias, RDOs e avanço). Clique numa linha para abrir o cronograma.',
          side: 'top',
          align: 'start',
          onNextClick: (_element, _step, { driver: driverObj }) => {
            goToSection('projetos');
            window.setTimeout(() => driverObj.moveNext(), 200);
          }
        }
      });
    }

    steps.push({
      element: '[data-acp-cards-seg]',
      popover: {
        title: 'Em andamento × Arquivados',
        description: 'Separe os projetos pela situação nos relatórios. A busca opera dentro da situação selecionada.',
        side: 'bottom',
        align: 'start'
      }
    });
    steps.push({
      element: '[data-acp-cards]',
      popover: {
        title: 'Cards de projeto',
        description: 'Cada card mostra dias trabalhados/consumidos, avanço do escopo, status do último dia, colaboradores e prazos. Clique para abrir o dashboard do projeto.',
        side: 'top',
        align: 'start'
      }
    });

    const driverObj = driver({
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
    });

    driverObj.drive();
    }, 250);
  }, [goToSection, userKey]);

  // Gatilho manual (botão "Ver tutorial").
  useEffect(() => {
    triggerRef.current = startTutorial;
    return () => {
      if (triggerRef.current === startTutorial) triggerRef.current = null;
    };
  }, [startTutorial, triggerRef]);

  // Auto-inicia no primeiro acesso ao módulo.
  useEffect(() => {
    if (!ready || !userKey || hasDoneTutorial(userKey)) return;
    const timer = window.setTimeout(startTutorial, 800);
    return () => window.clearTimeout(timer);
  }, [ready, startTutorial, userKey]);

  return null;
}
