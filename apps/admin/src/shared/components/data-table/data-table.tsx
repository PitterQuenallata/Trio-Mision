import React, { useState, useRef, useEffect } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { DataTablePagination } from './data-table-pagination';
import {
  Search,
  SlidersHorizontal,
  Download,
  Check,
  X,
  AlignJustify,
  Rows,
  Layers,
  Trash2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { pillToast } from '../ui/pill-toast';

export type TableDensity = 'compact' | 'standard' | 'relaxed';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  enableExport?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Buscar...',
  enableExport = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [density, setDensity] = useState<TableDensity>('standard');
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  // Close column popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        columnPickerRef.current &&
        !columnPickerRef.current.contains(e.target as Node)
      ) {
        setIsColumnPickerOpen(false);
      }
    }
    if (isColumnPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isColumnPickerOpen]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  // Export to CSV function
  const handleExportCSV = (onlySelected: boolean = false) => {
    const rowsToExport = onlySelected
      ? selectedRows.map((r) => r.original)
      : table.getFilteredRowModel().rows.map((r) => r.original);

    if (rowsToExport.length === 0) {
      pillToast.warning('Sin Registros', 'No hay filas disponibles para exportar.');
      return;
    }

    const headers = table
      .getAllLeafColumns()
      .filter((col) => col.getIsVisible() && col.id !== 'select' && col.id !== 'actions')
      .map((col) => col.id);

    const csvContent = [
      headers.join(','),
      ...rowsToExport.map((row: any) =>
        headers
          .map((h) => {
            const val = row[h];
            const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    pillToast.success('Exportación Completa', `${rowsToExport.length} filas exportadas en formato CSV.`);
  };

  const densityPadding = {
    compact: 'py-2 px-3 text-xs',
    standard: 'py-3.5 px-4 text-xs',
    relaxed: 'py-5 px-5 text-sm',
  }[density];

  return (
    <div className="space-y-4 relative">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {searchKey && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                table.getColumn(searchKey)?.setFilterValue(event.target.value)
              }
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-border/80 bg-background/50 text-xs shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        )}

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {/* Row Density Segmented Control */}
          <div className="inline-flex rounded-xl bg-muted/50 p-1 border border-border/60">
            <button
              type="button"
              title="Densidad Compacta (32px)"
              onClick={() => setDensity('compact')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                density === 'compact'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Compacta
            </button>
            <button
              type="button"
              title="Densidad Estándar (44px)"
              onClick={() => setDensity('standard')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                density === 'standard'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Normal
            </button>
            <button
              type="button"
              title="Densidad Relajada (56px)"
              onClick={() => setDensity('relaxed')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                density === 'relaxed'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Amplia
            </button>
          </div>

          {/* Column Visibility Popover */}
          <div className="relative" ref={columnPickerRef}>
            <Button
              variant="outline"
              size="sm"
              soundType="pop"
              onClick={() => setIsColumnPickerOpen((prev) => !prev)}
              className={cn(
                'text-xs gap-1.5 rounded-xl h-8.5',
                isColumnPickerOpen && 'border-primary ring-1 ring-primary/20 bg-muted/40'
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Columnas</span>
            </Button>

            {isColumnPickerOpen && (
              <div className="absolute right-0 top-10 z-30 w-52 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40">
                  Alternar Columnas
                </div>
                <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
                  {table
                    .getAllLeafColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                      const isVisible = column.getIsVisible();
                      return (
                        <button
                          key={column.id}
                          type="button"
                          onClick={() => column.toggleVisibility(!isVisible)}
                          className={cn(
                            'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs capitalize transition-colors text-left cursor-pointer',
                            isVisible
                              ? 'text-foreground hover:bg-muted/60'
                              : 'text-muted-foreground hover:bg-muted/30'
                          )}
                        >
                          <span className="truncate">{column.id}</span>
                          {isVisible && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Quick CSV Export */}
          {enableExport && (
            <Button
              variant="outline"
              size="sm"
              soundType="pop"
              onClick={() => handleExportCSV(false)}
              className="text-xs gap-1.5 rounded-xl h-8.5"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Table Structure */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none transition-all">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/40 border-b border-border backdrop-blur-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <th
                        key={header.id}
                        className="h-10 px-4 text-xs font-semibold text-muted-foreground align-middle"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border/40">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="hover:bg-muted/30 transition-colors data-[state=selected]:bg-primary/5"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn('align-middle tabular-nums', densityPadding)}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-28 text-center text-muted-foreground text-xs"
                  >
                    No se encontraron registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table Pagination */}
      <DataTablePagination table={table} />

      {/* Floating Bulk Actions Bar (Apple iPadOS Style) */}
      {selectedCount > 0 && (
        <div className="fixed bottom-20 sm:bottom-8 z-40 inset-x-0 mx-auto w-fit max-w-[90vw] animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="rounded-2xl border border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl p-2 px-4 flex items-center gap-3 sm:gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="tabular-nums px-2 py-0.5">
                {selectedCount}
              </Badge>
              <span className="font-semibold text-foreground">
                {selectedCount === 1 ? 'fila seleccionada' : 'filas seleccionadas'}
              </span>
            </div>

            <div className="h-4 w-px bg-border/60" />

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCSV(true)}
                className="h-7 text-xs rounded-lg gap-1.5"
              >
                <Download className="h-3 w-3" />
                <span>Exportar selección</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => table.toggleAllRowsSelected(false)}
                className="h-7 text-xs rounded-lg gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                <span>Deseleccionar</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
