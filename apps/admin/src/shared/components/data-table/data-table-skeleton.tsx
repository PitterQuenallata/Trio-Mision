import React from 'react';
import { Skeleton } from '../ui/skeleton';

interface DataTableSkeletonProps {
  rowCount?: number;
  columnCount?: number;
}

export const DataTableSkeleton: React.FC<DataTableSkeletonProps> = ({
  rowCount = 5,
  columnCount = 5,
}) => {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between pb-2">
        <Skeleton className="h-9 w-64 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <div className="rounded-2xl border border-border/80 overflow-hidden">
        <div className="h-10 bg-muted/40 border-b border-border/60 flex items-center px-4 space-x-4">
          {Array.from({ length: columnCount }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1 rounded-md" />
          ))}
        </div>
        {Array.from({ length: rowCount }).map((_, i) => (
          <div
            key={i}
            className="h-14 border-b border-border/40 last:border-0 flex items-center px-4 space-x-4"
          >
            {Array.from({ length: columnCount }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1 rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
