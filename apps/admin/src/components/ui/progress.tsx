import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const clampedValue = Math.min(Math.max(value || 0, 0), 100);

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedValue}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40",
          className
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-primary transition-all duration-300 ease-out rounded-full"
          style={{ transform: `translateX(-${100 - clampedValue}%)` }}
        />
      </div>
    );
  }
);

Progress.displayName = "Progress";

export default Progress;
