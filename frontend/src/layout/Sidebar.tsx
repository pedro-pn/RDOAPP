import type { ReactNode } from 'react';

import { BrandLogo } from '../components/brand/BrandLogo';
import { AppIcon } from '../components/icons/AppIcon';
import { Button } from '../components/ui/ds';
import { NavigationList } from './NavigationList';
import { NAVIGATION_CHROME_ICONS } from './navigationIcons';
import type { NavigationModel } from './navigationModel';

export interface NavigationProfile {
  name: string;
  description?: string;
  initials?: string;
  onOpen?: () => void;
}

export interface SidebarProps {
  navigation: NavigationModel;
  profile?: NavigationProfile;
  utilityActions?: ReactNode;
  onLogout?: () => void | Promise<void>;
  onNavigate?: () => void;
  className?: string;
  labelledBy?: string;
}

function profileInitials(profile: NavigationProfile) {
  if (profile.initials) return profile.initials;
  return profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Sidebar({
  navigation,
  profile,
  utilityActions,
  onLogout,
  onNavigate,
  className,
  labelledBy
}: SidebarProps) {
  return (
    <aside
      className={['fv-ds', 'fv-sidebar', className].filter(Boolean).join(' ')}
      aria-labelledby={labelledBy}
    >
      <div className="fv-sidebar__brand">
        <BrandLogo variant="adaptive" className="fv-sidebar__logo" />
      </div>

      <nav className="fv-sidebar__navigation" aria-label="Navegação principal">
        <NavigationList navigation={navigation} onNavigate={onNavigate} />
      </nav>

      <div className="fv-sidebar__footer">
        {utilityActions ? (
          <div className="fv-sidebar__utility-actions" onClick={onNavigate}>
            {utilityActions}
          </div>
        ) : null}

        {profile ? (
          <button
            className="fv-sidebar-profile"
            type="button"
            onClick={profile.onOpen}
            disabled={!profile.onOpen}
            aria-label={
              profile.onOpen ? `Abrir conta de ${profile.name}` : undefined
            }
          >
            <span className="fv-sidebar-profile__avatar" aria-hidden="true">
              {profileInitials(profile) || 'FV'}
            </span>
            <span className="fv-sidebar-profile__copy">
              <strong>{profile.name}</strong>
              {profile.description ? <span>{profile.description}</span> : null}
            </span>
            {profile.onOpen ? (
              <AppIcon icon={NAVIGATION_CHROME_ICONS.settings} size="sm" />
            ) : null}
          </button>
        ) : null}

        {onLogout ? (
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            iconLeft={
              <AppIcon icon={NAVIGATION_CHROME_ICONS.logout} size="sm" />
            }
            onClick={() => void onLogout()}
          >
            Sair
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
