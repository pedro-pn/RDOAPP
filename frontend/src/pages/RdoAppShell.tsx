import { useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { accountPageStateFromPath } from '../auth/moduleNavigation';
import { AppShell } from '../layout/AppShell';
import {
  createNavigationModel,
  type NavigationSubItem
} from '../layout/navigationModel';
import { hubModulesForUser } from './hubModules';
import './RdoRolePages.ds.css';

interface RdoAppShellProps {
  children: ReactNode;
  title: string;
  sectionLabel?: string;
  subNavigation?: readonly NavigationSubItem[];
}

export function RdoAppShell({
  children,
  title,
  sectionLabel,
  subNavigation
}: RdoAppShellProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const modules = useMemo(() => hubModulesForUser(user), [user]);
  const navigation = useMemo(
    () =>
      createNavigationModel({
        modules,
        pathname: location.pathname,
        subNavigation: subNavigation?.length
          ? { parentId: 'rdo', items: [...subNavigation] }
          : undefined
      }),
    [location.pathname, modules, subNavigation]
  );
  const initials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('')
    : 'U';

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <AppShell
      navigation={navigation}
      title={title}
      breadcrumb={[
        { label: 'Filtrovali', href: '/modulos' },
        { label: 'RDO', href: location.pathname },
        ...(sectionLabel && sectionLabel !== title
          ? [{ label: sectionLabel }]
          : [])
      ]}
      contentWidth="fluid"
      profile={
        user
          ? {
              name: user.name,
              description: user.email || user.username,
              initials,
              onOpen: () =>
                navigate('/conta', {
                  state: accountPageStateFromPath(location)
                })
            }
          : undefined
      }
      onLogout={handleLogout}
    >
      {children}
    </AppShell>
  );
}
