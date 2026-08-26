import type { ChangeEvent } from 'react';

import { Select } from '../../components/ui/ds';
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
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onNavigate(event.target.value as RdoManagerSection);
  };

  return (
    <nav
      className="fv-ds rdo-section-navigation"
      aria-label="Navegar nas áreas de Relatórios e Projetos"
    >
      <Select
        aria-label="Navegar nas áreas de Relatórios e Projetos"
        containerClassName="rdo-section-navigation__select"
        value={current}
        onChange={handleChange}
        options={RDO_MANAGER_SECTIONS.map((section) => ({
          value: section.id,
          label: section.label
        }))}
      />
    </nav>
  );
}
