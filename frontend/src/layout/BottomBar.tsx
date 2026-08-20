import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';

import { AppIcon } from '../components/icons/AppIcon';
import { NAVIGATION_CHROME_ICONS } from './navigationIcons';
import { navigationItems, type NavigationModel } from './navigationModel';

interface LegacyBottomBarProps {
  appearance?: 'legacy';
  children: ReactNode;
}

interface DesignSystemBottomBarProps {
  appearance: 'design-system';
  navigation: NavigationModel;
  onOpenMenu: () => void;
}

export type BottomBarProps = LegacyBottomBarProps | DesignSystemBottomBarProps;

function DesignSystemBottomBar({
  navigation,
  onOpenMenu
}: DesignSystemBottomBarProps) {
  const visibleItems = navigationItems(navigation)
    .filter((item) => item.href && !item.disabled)
    .slice(0, 4);
  const itemCountStyle = {
    '--fv-bottom-bar-item-count': visibleItems.length + 1
  } as CSSProperties;

  return (
    <nav
      className="fv-ds fv-bottom-bar"
      aria-label="Navegação principal"
      style={itemCountStyle}
    >
      <ul>
        {visibleItems.map((item) => (
          <li key={item.id}>
            <Link
              className={item.active ? 'is-active' : undefined}
              to={item.href!}
              aria-current={item.active ? 'page' : undefined}
            >
              <AppIcon icon={item.icon} size="lg" />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Abrir menu completo"
          >
            <AppIcon icon={NAVIGATION_CHROME_ICONS.menu} size="lg" />
            <span>Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function BottomBar(props: BottomBarProps) {
  if (props.appearance === 'design-system') {
    return <DesignSystemBottomBar {...props} />;
  }

  return <footer className="bottom-bar-react">{props.children}</footer>;
}
