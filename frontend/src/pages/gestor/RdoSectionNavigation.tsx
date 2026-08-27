import type { KeyboardEvent } from 'react';

import {
  RDO_MANAGER_SECTIONS,
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
  const handleGroupKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      ![
        'ArrowDown',
        'ArrowUp',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End'
      ].includes(event.key)
    ) {
      return;
    }

    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '.rdo-section-navigation__item'
      )
    );
    const activeIndex = items.indexOf(
      document.activeElement as HTMLButtonElement
    );
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : activeIndex < 0
            ? 0
            : (activeIndex +
                (event.key === 'ArrowUp' || event.key === 'ArrowLeft'
                  ? -1
                  : 1) +
                items.length) %
              items.length;

    event.preventDefault();
    items[nextIndex]?.focus();
  };

  return (
    <nav
      className="fv-ds rdo-section-navigation"
      aria-label="Navegar nas áreas de Relatórios e Projetos"
    >
      <div
        className="rdo-section-navigation__items"
        role="group"
        aria-label="Áreas de Relatórios e Projetos"
        onKeyDown={handleGroupKeyDown}
      >
        {RDO_MANAGER_SECTIONS.map((section) => {
          const active = section.id === current;
          return (
            <button
              className={`rdo-section-navigation__item${active ? ' is-active' : ''}`}
              key={section.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              aria-pressed={active}
              onClick={() => {
                if (!active) onNavigate(section.id);
              }}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
