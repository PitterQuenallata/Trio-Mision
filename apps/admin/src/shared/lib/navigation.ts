import {
  LayoutDashboard,
  Music,
  BookOpen,
  FileUp,
  CreditCard,
  KeyRound,
  Briefcase,
  Users,
  ShieldCheck,
  LifeBuoy,
  BarChart3,
  History,
  Settings,
  LucideIcon,
} from 'lucide-react';

export type NavigationCategoryKey = 'principal' | 'catalogo' | 'comercial' | 'operacion';

export interface NavigationCategory {
  key: NavigationCategoryKey;
  title: string;
}

export const navigationCategories: NavigationCategory[] = [
  { key: 'principal', title: 'Principal' },
  { key: 'catalogo', title: 'Catálogo y contenido' },
  { key: 'comercial', title: 'Ventas y servicios' },
  { key: 'operacion', title: 'Operación y seguridad' },
];

export interface NavItem {
  id: string;
  title: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  category: NavigationCategoryKey;
}

export const navItems: NavItem[] = [
  { id: 'dashboard', title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, category: 'principal' },
  { id: 'reportes', title: 'Reportes', path: '/reportes', icon: BarChart3, category: 'principal' },

  { id: 'catalogo', title: 'Artistas y catálogo', path: '/catalogo', icon: Music, category: 'catalogo' },
  { id: 'himnario', title: 'Himnario', path: '/himnario', icon: BookOpen, category: 'catalogo' },
  { id: 'importaciones', title: 'Importar PDF', path: '/importaciones', icon: FileUp, category: 'catalogo' },

  { id: 'pagos', title: 'Pagos', path: '/pagos', icon: CreditCard, category: 'comercial' },
  { id: 'licencias', title: 'Licencias', path: '/licencias', icon: KeyRound, category: 'comercial' },
  { id: 'servicios', title: 'Servicios', path: '/servicios', icon: Briefcase, category: 'comercial' },

  { id: 'usuarios', title: 'Usuarios', path: '/usuarios', icon: Users, category: 'operacion' },
  { id: 'staff', title: 'Staff y roles', path: '/staff', icon: ShieldCheck, category: 'operacion' },
  { id: 'soporte', title: 'Soporte', path: '/soporte', icon: LifeBuoy, category: 'operacion' },
  { id: 'auditoria', title: 'Auditoría', path: '/auditoria', icon: History, category: 'operacion' },
  { id: 'configuracion', title: 'Configuración', path: '/configuracion', icon: Settings, category: 'operacion' },
];
