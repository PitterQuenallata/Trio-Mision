import {
  LayoutDashboard,
  Music,
  Library,
  Users,
  LucideIcon,
} from 'lucide-react';

export type NavigationCategoryKey = 'principal' | 'artistas' | 'operacion';

export interface NavigationCategory {
  key: NavigationCategoryKey;
  title: string;
}

export const navigationCategories: NavigationCategory[] = [
  { key: 'principal', title: 'Principal' },
  { key: 'artistas', title: 'Artistas' },
  { key: 'operacion', title: 'Administración' },
];

export interface NavItem {
  id: string;
  title: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  category: NavigationCategoryKey;
}

// Solo secciones implementadas. La visibilidad por rol se aplica en use-visible-nav.ts.
export const navItems: NavItem[] = [
  { id: 'dashboard', title: 'Panel de control', path: '/dashboard', icon: LayoutDashboard, category: 'principal' },
  { id: 'grupos', title: 'Grupos', path: '/grupos', icon: Library, category: 'artistas' },
  { id: 'mi-grupo', title: 'Mi grupo', path: '/mi-grupo', icon: Music, category: 'artistas' },
  { id: 'usuarios', title: 'Usuarios', path: '/usuarios', icon: Users, category: 'operacion' },
];
