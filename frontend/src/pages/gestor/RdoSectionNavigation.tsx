import type { ChangeEvent } from 'react';

import { AppIcon } from '../../components/icons/AppIcon';
import { Badge, Select } from '../../components/ui/ds';
import { MODULE_NAVIGATION_ICONS } from '../../layout/navigationIcons';
import {
  RDO_MANAGER_SECTIONS,
  type RdoManagerSection
} from './rdoSectionNavigationModel';

interface RdoSectionNavigationProps {
  current: RdoManagerSection;
  pendingCount?: number;
  onNavigate: (section: RdoManagerSection) => void;
}

export function RdoSectionNavigation({
  current,
  pendingCount = 0,
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
      <AppIcon
        className="rdo-section-navigation__icon"
        icon={MODULE_NAVIGATION_ICONS.rdo}
        size="lg"
      />
      <Select
        aria-label="Navegar nas áreas de Relatórios e Projetos"
        containerClassName="rdo-section-navigation__select"
        value={current}
        onChange={handleChange}
        options={RDO_MANAGER_SECTIONS.map((section) => ({
          value: section.id,
          label: `Relatórios e Projetos · ${section.label}`
        }))}
      />
      <Badge tone="brand">RDO</Badge>
      {pendingCount > 0 ? <Badge tone="warning">{pendingCount}</Badge> : null}
    </nav>
  );
}
