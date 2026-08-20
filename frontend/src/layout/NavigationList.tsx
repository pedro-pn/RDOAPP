import { useId } from 'react';
import { Link } from 'react-router';

import { AppIcon } from '../components/icons/AppIcon';
import { Badge } from '../components/ui/ds';
import type { NavigationModel } from './navigationModel';

export interface NavigationListProps {
  navigation: NavigationModel;
  onNavigate?: () => void;
  compact?: boolean;
}

export function NavigationList({
  navigation,
  onNavigate,
  compact = false
}: NavigationListProps) {
  const groupIdPrefix = useId();

  return (
    <div className="fv-navigation-list" data-compact={compact || undefined}>
      {navigation.groups.map((group) => (
        <section
          className="fv-navigation-group"
          key={group.id}
          aria-labelledby={`${groupIdPrefix}-${group.id}`}
        >
          <h2
            className="fv-navigation-group__label"
            id={`${groupIdPrefix}-${group.id}`}
          >
            {group.label}
          </h2>
          <ul className="fv-navigation-group__items">
            {group.items.map((item) => (
              <li key={item.id}>
                {item.disabled || !item.href ? (
                  <span
                    className="fv-navigation-item is-disabled"
                    aria-disabled="true"
                  >
                    <AppIcon icon={item.icon} />
                    <span className="fv-navigation-item__label">
                      {item.label}
                    </span>
                    {item.badge !== undefined ? (
                      <Badge tone="neutral">{item.badge}</Badge>
                    ) : null}
                  </span>
                ) : (
                  <Link
                    className={`fv-navigation-item${item.active ? ' is-active' : ''}`}
                    to={item.href}
                    aria-current={item.active ? 'page' : undefined}
                    title={compact ? item.label : undefined}
                    onClick={onNavigate}
                  >
                    <AppIcon icon={item.icon} />
                    <span className="fv-navigation-item__label">
                      {item.label}
                    </span>
                    {item.badge !== undefined ? (
                      <Badge tone={item.active ? 'brand' : 'neutral'}>
                        {item.badge}
                      </Badge>
                    ) : null}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
