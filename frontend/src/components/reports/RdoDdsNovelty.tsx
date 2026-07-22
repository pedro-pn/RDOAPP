import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

import { markRdoDdsNoveltySeen, shouldShowRdoDdsNovelty } from '../../auth/moduleNavigation';
import type { AuthUser } from '../../types/auth';

const DDS_TOGGLE_SELECTOR = '[data-dds-novelty]';

interface RdoDdsNoveltyProps {
  user: AuthUser;
  enabled: boolean;
  onSeen: () => void;
}

// Destaque único ("estilo tutorial") do novo registro de DDS na primeira abertura do formulário de RDO.
// Banner de novidade (passo centralizado) + mini tutorial apontando o toggle; não reaparece após visto.
export function RdoDdsNovelty({ user, enabled, onSeen }: RdoDdsNoveltyProps) {
  const started = useRef(false);
  // O formulário re-renderiza com frequência (autosave, queries); manter onSeen em ref evita que o
  // cleanup do efeito cancele o timer de abertura a cada render.
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  useEffect(() => {
    if (!enabled || started.current) return;
    if (!shouldShowRdoDdsNovelty(user)) {
      onSeenRef.current();
      return;
    }

    // `started` só é marcado quando o timer dispara: em dev o StrictMode desmonta/remonta o efeito
    // (o cleanup cancela o timer) e marcar aqui impediria o reagendamento na remontagem.
    const timer = window.setTimeout(() => {
      started.current = true;
      if (document.body.classList.contains('driver-active')) {
        markRdoDdsNoveltySeen(user);
        onSeenRef.current();
        return;
      }

      markRdoDdsNoveltySeen(user);
      const steps: DriveStep[] = [
        {
          popover: {
            title: '✨ Novidade: DDS no RDO',
            description:
              'Agora dá para registrar o DDS (Diálogo Diário de Segurança) direto no relatório: horário de início e término e os temas abordados, em cada turno.'
          }
        }
      ];
      // Sem o toggle na tela (ex.: modo "Somente serviço"), mostra apenas o banner de novidade.
      if (document.querySelector(DDS_TOGGLE_SELECTOR)) {
        steps.push({
          element: DDS_TOGGLE_SELECTOR,
          popover: {
            title: 'Houve DDS?',
            description:
              'Ligue este botão em "Condições especiais" para informar o horário e adicionar os temas abordados (a lista é mantida pela coordenação). Com turno noturno ativo, há um registro de DDS próprio dentro da seção noturna.',
            side: 'bottom',
            align: 'start'
          }
        });
      }

      const driverObj = driver({
        showProgress: false,
        nextBtnText: 'Ver onde fica',
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
    }, 700);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSeen via ref; user keyed por id
  }, [enabled, user.id]);

  return null;
}
