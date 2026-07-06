import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Tooltip genérico renderizado em portal (posição fixa + clamp na viewport), para nunca ser cortado
// por overflow de containers/modais nem pela borda da tela (importante no mobile). Aceita conteúdo
// arbitrário no balão. O gatilho é `children`.
export function PortalTip({ children, content, triggerClassName, ariaLabel }: {
  children: ReactNode;
  content: ReactNode;
  triggerClassName?: string;
  ariaLabel?: string;
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

  // Mantém o balão dentro da viewport (clamp horizontal) após medir a largura.
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

  return (
    <>
      <span
        ref={triggerRef}
        className={triggerClassName}
        tabIndex={0}
        aria-label={ariaLabel}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {open && pos
        ? createPortal(
          <div
            ref={balloonRef}
            className={`help-tip-portal ${pos.placement}`}
            style={{ top: pos.top, left: pos.left }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body
        )
        : null}
    </>
  );
}
