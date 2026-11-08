import { Table } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '../ui/button';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({ table }: DataTablePaginationProps<TData>) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4">
      <div className="text-xs text-muted-foreground tabular-nums">
        {table.getFilteredSelectedRowModel().rows.length} de{' '}
        {table.getFilteredRowModel().rows.length} fila(s) seleccionadas.
      </div>

      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-xs text-muted-foreground">Filas por pág:</p>
          <select
            value={`${table.getState().pagination.pageSize}`}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="h-8 rounded-lg border border-border/80 bg-background/50 px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {[10, 20, 30, 50].map((pageSize) => (
              <option key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </option>
            ))}
          </select>
        </div>

        <div className="flex w-[100px] items-center justify-center text-xs text-muted-foreground tabular-nums">
          Pág {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="iconSm"
            soundType="tab"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            title="Primera página"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="iconSm"
            soundType="tab"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            title="Página anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="iconSm"
            soundType="tab"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            title="Página siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="iconSm"
            soundType="tab"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            title="Última página"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
