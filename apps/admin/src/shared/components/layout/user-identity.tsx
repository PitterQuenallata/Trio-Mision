import React from 'react';
import { useAuth } from '../../auth/auth-context';
import type { Identidad } from '../../auth/types';
import { Button } from '../ui/button';

/** Nombre visible: nombre del perfil, o la parte local del correo. */
export function nombreDe(identidad: Identidad | null): string {
  return identidad?.display_name || identidad?.email?.split('@')[0] || 'Usuario';
}

/** Iniciales de dos letras a partir del nombre. */
export function inicialesDe(nombre: string): string {
  return (
    nombre
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase())
      .join('') || 'U'
  );
}

/** Rol que se muestra bajo el nombre: los roles staff, o "Manager" si solo administra artistas. */
export function rolDe(identidad: Identidad | null): string {
  if (!identidad) return '';
  if (identidad.staff_roles.length > 0) return identidad.staff_roles.join(' · ');
  return 'Manager';
}

/** Identidad real del usuario con la única acción de cuenta: cerrar sesión. */
export const UserIdentityCard: React.FC = () => {
  const { identidad, signOut } = useAuth();
  const nombre = nombreDe(identidad);

  return (
    <div className="p-2.5 rounded-2xl border border-border/60 bg-muted/30">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-semibold">
          {inicialesDe(nombre)}
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-foreground truncate">{nombre}</span>
          <p className="text-[10px] text-muted-foreground truncate font-mono">{identidad?.email ?? ''}</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{rolDe(identidad)}</span>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
};

export default UserIdentityCard;
