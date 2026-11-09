import React from 'react';
import { PANEL_ROUTES, staffRolesFor, managersCanSee } from '../../../shared/auth/permissions';

const ROLES = ['admin', 'editor', 'vendedor'] as const;
const LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', vendedor: 'Vendedor' };

/** Matriz de permisos por sección. Se deriva de las mismas reglas que usa el guard del panel. */
export const PermisosMatriz: React.FC = () => (
  <div className="overflow-x-auto rounded-2xl border border-border/50">
    <table className="w-full text-sm">
      <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="py-3 px-4 text-left">Sección</th>
          {ROLES.map((role) => (
            <th key={role} className="py-3 px-4 text-center">{LABEL[role]}</th>
          ))}
          <th className="py-3 px-4 text-center">Manager de artista</th>
        </tr>
      </thead>
      <tbody>
        {PANEL_ROUTES.map((path) => {
          const roles = staffRolesFor(path);
          return (
            <tr key={path} className="border-t border-border/40">
              <td className="py-2.5 px-4 font-mono text-xs">{path}</td>
              {ROLES.map((role) => (
                <td key={role} className="py-2.5 px-4 text-center">
                  {roles.includes(role) ? '✓' : <span className="text-muted-foreground">—</span>}
                </td>
              ))}
              <td className="py-2.5 px-4 text-center">
                {managersCanSee(path) ? '✓' : <span className="text-muted-foreground">—</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default PermisosMatriz;
