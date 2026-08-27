import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { AppIcon } from '../../components/icons/AppIcon';
import { DS_ICONS } from '../../components/ui/ds/icons';
import {
  RDO_MANAGER_SECTIONS,
  rdoManagerSectionLabel,
  type RdoManagerSection
} from './rdoSectionNavigationModel';

interface RdoSectionNavigationProps {
  current: RdoManagerSection;
  onNavigate: (section: RdoManagerSection) => void;
}

export function RdoSectionNavigation({
  current,
  onNavigate
}: RdoSectionNavigationProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentLabel = rdoManagerSectionLabel(current);

  const closeAndRestoreFocus = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;

    const currentItem = menuRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"][aria-current="page"]'
    );
    window.requestAnimationFrame(() => currentItem?.focus());

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => setOpen(false), [current]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }

    if (
      !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)
    ) {
      return;
    }

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]'
      ) || []
    );
    const activeIndex = items.indexOf(
      document.activeElement as HTMLButtonElement
    );
    const backwards = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    const nextIndex =
      activeIndex < 0
        ? 0
        : (activeIndex + (backwards ? -1 : 1) + items.length) % items.length;

    event.preventDefault();
    items[nextIndex]?.focus();
  };

  return (
    <nav
      ref={rootRef}
      className="fv-ds rdo-section-navigation"
      aria-label="Navegar nas áreas de Relatórios e Projetos"
    >
      <button
        ref={triggerRef}
        className="rdo-section-navigation__trigger"
        type="button"
        aria-label={`Área atual: ${currentLabel}. Trocar área do RDO`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{currentLabel}</span>
        <AppIcon
          className="rdo-section-navigation__chevron"
          icon={DS_ICONS.chevronDown}
          size="sm"
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          className="rdo-section-navigation__panel"
          id={panelId}
          role="menu"
          aria-label="Áreas de Relatórios e Projetos"
          onKeyDown={handleMenuKeyDown}
        >
          <span className="rdo-section-navigation__panel-label">Ir para</span>
          <div className="rdo-section-navigation__items">
            {RDO_MANAGER_SECTIONS.map((section) => {
              const active = section.id === current;
              return (
                <button
                  className={`rdo-section-navigation__item${active ? ' is-active' : ''}`}
                  key={section.id}
                  type="button"
                  role="menuitem"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    if (active) {
                      closeAndRestoreFocus();
                      return;
                    }
                    setOpen(false);
                    onNavigate(section.id);
                  }}
                >
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
