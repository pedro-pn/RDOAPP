import type { ReactNode } from 'react';

// Balão de ajuda instantâneo no padrão do app. Dois usos:
//  - icon: um "?" ao lado de um label (campos de formulário).
//  - texto sublinhado pontilhado (dados de dashboard) — hover explica o dado.
export function HelpTip({ help, children, icon, below, className }: {
  help: string;
  children?: ReactNode;
  icon?: boolean;
  below?: boolean; // abre o balão para baixo (útil quando o de cima seria cortado, ex.: cabeçalho de tabela)
  className?: string;
}) {
  const place = below ? 'help-tip-below' : '';
  if (icon) {
    return (
      <span className={`help-tip help-tip-icon ${place} ${className ?? ''}`} tabIndex={0} role="button" aria-label={`Ajuda: ${help}`}>
        <span className="help-tip-mark" aria-hidden="true">?</span>
        <span className="help-tip-balloon" role="tooltip">{help}</span>
      </span>
    );
  }
  return (
    <span className={`help-tip help-tip-underline ${place} ${className ?? ''}`} tabIndex={0}>
      <span className="help-tip-target">{children}</span>
      <span className="help-tip-balloon" role="tooltip">{help}</span>
    </span>
  );
}
