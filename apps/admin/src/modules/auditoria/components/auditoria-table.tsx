import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { AuditLog } from '../types/auditoria.types';
import { DataTable } from '../../../shared/components/data-table/data-table';
import { getAuditoriaColumns } from './auditoria-columns';

interface AuditoriaTableProps {
  logs: AuditLog[];
  selectedLog: AuditLog | null;
  onSelectLog: (log: AuditLog) => void;
}

export const AuditoriaTable: React.FC<AuditoriaTableProps> = ({
  logs,
  onSelectLog,
}) => {
  const columns = getAuditoriaColumns(onSelectLog);

  return (
    <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-base font-semibold">
          Eventos Auditados Recientes (TanStack Table v8)
        </CardTitle>
        <CardDescription className="text-xs">
          Monitoreo continuo de eventos con trazabilidad de IP, ordenación por severidad y paginación
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <DataTable
          columns={columns}
          data={logs}
          searchKey="action"
          searchPlaceholder="Filtrar eventos por acción..."
        />
      </CardContent>
    </Card>
  );
};
