import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  Boxes,
  CircleSlash2,
  ClipboardList,
  HardHat,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  UserRound,
  UsersRound,
  Wrench,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { HubModuleId } from '../modules/registry';

export const MODULE_NAVIGATION_ICONS = {
  rdo: ClipboardList,
  admin: UsersRound,
  equipamentos: Wrench,
  estoque: Boxes,
  qualidade: BadgeCheck,
  acompanhamento: BarChart3,
  romaneio: Truck,
  epi: HardHat,
  privacy: ShieldCheck,
  none: CircleSlash2
} satisfies Record<HubModuleId, LucideIcon>;

export const NAVIGATION_CHROME_ICONS = {
  account: UserRound,
  close: X,
  help: HelpCircle,
  home: LayoutDashboard,
  logout: LogOut,
  menu: Menu,
  notifications: Bell,
  operations: Activity,
  search: Search,
  settings: Settings
} as const;
