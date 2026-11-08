import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { License } from '../types/licencias.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { DataTable } from '../../../shared/components/data-table/data-table';
import { getLicenciasColumns } from './licencias-columns';

interface LicenciasTableProps {
  licenses: License[];
}

export const LicenciasTable: React.FC<LicenciasTableProps> = ({ licenses }) => {
  const { play } = useSound();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, key: string) => {
    play('pop');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(key);
    }
    setCopiedId(id);
    pillToast.success('Clave Copiada', `Licencia ${key} copiada al portapapeles.`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const columns = getLicenciasColumns(copiedId, handleCopy);

  return (
    <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-base font-semibold">
          Claves de Activación Vigentes (TanStack Table v8)
        </CardTitle>
        <CardDescription className="text-xs">
          Listado de licencias con verificación en tiempo real de nodos autenticados, ordenación y paginación
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <DataTable
          columns={columns}
          data={licenses}
          searchKey="client"
          searchPlaceholder="Filtrar por cliente..."
        />
      </CardContent>
    </Card>
  );
};
