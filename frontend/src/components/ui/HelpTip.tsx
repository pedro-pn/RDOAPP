import type { ReactNode } from 'react';

import { PortalTip } from './PortalTip';

// Balão de ajuda instantâneo no padrão do app, sobre o PortalTip (portal + clamp na viewport).
//  - icon: um "?" ao lado de um label (campos de formulário).
//  - texto sublinhado pontilhado (dados de dashboard) — hover explica o dado.
export function HelpTip({ help, children, icon, className }: {
  help: string;
  children?: ReactNode;
  icon?: boolean;
  className?: string;
}) {
  if (icon) {
    return (
      <PortalTip triggerClassName={`help-tip help-tip-icon ${className ?? ''}`} content={help} ariaLabel={`Ajuda: ${help}`}>
        <span className="help-tip-mark" aria-hidden="true">?</span>
      </PortalTip>
    );
  }
  return (
    <PortalTip triggerClassName={`help-tip help-tip-underline ${className ?? ''}`} content={help}>
      <span className="help-tip-target">{children}</span>
    </PortalTip>
  );
}
