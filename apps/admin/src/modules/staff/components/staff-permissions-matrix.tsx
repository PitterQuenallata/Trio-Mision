import React from 'react';
import { Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { PermissionRow } from '../types/staff.types';

interface StaffPermissionsMatrixProps {
  permissions: PermissionRow[];
}

export const StaffPermissionsMatrix: React.FC<StaffPermissionsMatrixProps> = ({ permissions }) => {
  return (
    <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-base font-semibold">
          Matriz de Privilegios por Rol (RBAC)
        </CardTitle>
        <CardDescription className="text-xs">
          Esquema de permisos de lectura, escritura y ejecución auditado según estándares de seguridad
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground font-semibold">
                <th className="py-3 px-5">Módulo Funcional</th>
                <th className="py-3 px-4 text-center">Super Admin</th>
                <th className="py-3 px-4 text-center">Security</th>
                <th className="py-3 px-4 text-center">DevOps</th>
                <th className="py-3 px-4 text-center">Billing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {permissions.map((row, idx) => (
                <tr key={idx} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-5 font-medium text-foreground">
                    {row.module}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.superAdmin ? (
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-500">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 font-mono">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.security ? (
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-500">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 font-mono">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.devOps ? (
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-500">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 font-mono">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.billing ? (
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-500">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 font-mono">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
