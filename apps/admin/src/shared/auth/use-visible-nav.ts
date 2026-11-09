import { useMemo } from 'react';
import { navItems, type NavItem } from '../lib/navigation';
import { canAccessRoute } from './permissions';
import { useAuth } from './auth-context';

/** Elementos del menú que el usuario actual puede ver según su rol. */
export function useVisibleNavItems(): NavItem[] {
  const { identidad } = useAuth();
  return useMemo(
    () => (identidad ? navItems.filter((item) => canAccessRoute(item.path, identidad)) : []),
    [identidad]
  );
}
