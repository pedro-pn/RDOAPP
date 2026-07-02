import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Balão de ajuda instantâneo no padrão do app. O balão é renderizado num portal (document.body) com
// posição fixa e "clamp" na viewport, para nunca ser cortado por containers com overflow (ex.: modal).
//  - icon: um "?" ao lado de um label (campos de formulário).
//  - texto sublinhado pontilhado (dados de dashboard) — hover explica o dado.
export function HelpTip({ help, children, icon, className }: {
  help: string;
  children?: ReactNode;
  icon?: boolean;
  className?: string;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const balloonRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null);

  const position = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const placement: 'above' | 'below' = r.top > 150 ? 'above' : 'below';
    setPos({
      top: placement === 'above' ? r.top - 8 : r.bottom + 8,
      left: r.left + r.width / 2,
      placement
    });
  }, []);

  const show = useCallback(() => { position(); setOpen(true); }, [position]);
  const hide = useCallback(() => setOpen(false), []);

  // Reposiciona ao rolar/redimensionar enquanto aberto.
  useEffect(() => {
    if (!open) return;
    const handler = () => position();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, position]);

  // Após medir o balão, mantém dentro da viewport (clamp horizontal).
  useLayoutEffect(() => {
    if (!open || !pos) return;
    const b = balloonRef.current;
    if (!b) return;
    const half = b.offsetWidth / 2;
    const min = 8 + half;
    const max = window.innerWidth - 8 - half;
    const clamped = Math.max(min, Math.min(pos.left, max));
    if (Math.abs(clamped - pos.left) > 0.5) setPos(p => (p ? { ...p, left: clamped } : p));
  }, [open, pos]);

  const triggerProps = {
    ref: triggerRef,
    tabIndex: 0,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide
  };

  const trigger = icon ? (
    <span className={`help-tip help-tip-icon ${className ?? ''}`} role="button" aria-label={`Ajuda: ${help}`} {...triggerProps}>
      <span className="help-tip-mark" aria-hidden="true">?</span>
    </span>
  ) : (
    <span className={`help-tip help-tip-underline ${className ?? ''}`} {...triggerProps}>
      <span className="help-tip-target">{children}</span>
    </span>
  );

  return (
    <>
      {trigger}
      {open && pos
        ? createPortal(
          <div
            ref={balloonRef}
            className={`help-tip-portal ${pos.placement}`}
            style={{ top: pos.top, left: pos.left }}
            role="tooltip"
          >
            {help}
          </div>,
          document.body
        )
        : null}
    </>
  );
}
