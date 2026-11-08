'use client';

import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
  type SpringOptions,
  AnimatePresence,
} from 'framer-motion';
import React, {
  Children,
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  Component,
  HomeIcon,
  Mail,
  Package,
  ScrollText,
  SunMoon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DOCK_HEIGHT = 128;
const DEFAULT_MAGNIFICATION = 80;
const DEFAULT_DISTANCE = 150;
const DEFAULT_PANEL_HEIGHT = 64;

export type DockProps = {
  children: React.ReactNode;
  className?: string;
  distance?: number;
  panelHeight?: number;
  magnification?: number;
  spring?: SpringOptions;
};

export type DockItemProps = {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
};

export type DockLabelProps = {
  className?: string;
  children: React.ReactNode;
};

export type DockIconProps = {
  className?: string;
  children: React.ReactNode;
};

export type DocContextType = {
  mouseX: MotionValue<number>;
  spring: SpringOptions;
  magnification: number;
  distance: number;
};

export type DockProviderProps = {
  children: React.ReactNode;
  value: DocContextType;
};

const DockContext = createContext<DocContextType | undefined>(undefined);

function DockProvider({ children, value }: DockProviderProps) {
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function useDock() {
  const context = useContext(DockContext);
  if (!context) {
    throw new Error('useDock must be used within an DockProvider');
  }
  return context;
}

export function Dock({
  children,
  className,
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  panelHeight = DEFAULT_PANEL_HEIGHT,
}: DockProps) {
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  const maxHeight = useMemo(() => {
    return Math.max(DOCK_HEIGHT, magnification + magnification / 2 + 4);
  }, [magnification]);

  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div
      style={{
        height: height,
        scrollbarWidth: 'none',
      }}
      className="mx-2 flex max-w-full items-end overflow-visible select-none"
    >
      <motion.div
        onMouseMove={(e) => {
          isHovered.set(1);
          mouseX.set(e.clientX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mouseX.set(Infinity);
        }}
        className={cn(
          'mx-auto flex w-fit gap-3.5 sm:gap-4 rounded-2xl bg-[#F3F4F6]/85 dark:bg-neutral-900/90 border border-black/[0.06] dark:border-white/10 px-4 shadow-xl backdrop-blur-2xl',
          className
        )}
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label="Application dock"
      >
        <DockProvider value={{ mouseX, spring, distance, magnification }}>
          {children}
        </DockProvider>
      </motion.div>
    </motion.div>
  );
}

export function DockItem({ children, className, onClick, active }: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { distance, magnification, mouseX, spring } = useDock();

  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, (val) => {
    const domRect = ref.current?.getBoundingClientRect() ?? { left: 0, width: 0 };
    return val - (domRect.left ?? 0) - (domRect.width ?? 0) / 2;
  });

  const widthTransform = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [40, magnification, 40]
  );

  const width = useSpring(widthTransform, spring);

  return (
    <motion.div
      ref={ref}
      style={{ width, height: width }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      className={cn(
        'relative inline-flex items-center justify-center aspect-square rounded-full shrink-0 cursor-pointer transition-colors',
        'bg-[#E5E7EB] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200',
        className
      )}
      tabIndex={0}
      role="button"
      aria-haspopup="true"
      onClick={onClick}
    >
      {Children.map(children, (child) =>
        cloneElement(child as React.ReactElement<any>, { width, isHovered })
      )}

      {/* macOS Active App Indicator Dot */}
      {active && (
        <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary shadow-[0_0_6px_rgba(255,255,255,0.7)] pointer-events-none" />
      )}
    </motion.div>
  );
}

export function DockLabel({ children, className, ...rest }: DockLabelProps) {
  const restProps = rest as Record<string, unknown>;
  const isHovered = restProps['isHovered'] as MotionValue<number> | undefined;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isHovered) return;
    const unsubscribe = isHovered.on('change', (latest) => {
      setIsVisible(latest === 1);
    });

    return () => unsubscribe();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -10 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'absolute -top-7 left-1/2 w-fit whitespace-pre rounded-md border border-neutral-200 bg-white/95 px-2 py-0.5 text-xs text-neutral-800 shadow-lg dark:border-neutral-800 dark:bg-neutral-800/95 dark:text-white backdrop-blur-md pointer-events-none z-50',
            className
          )}
          role="tooltip"
          style={{ x: '-50%' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DockIcon({ children, className, ...rest }: DockIconProps) {
  const restProps = rest as Record<string, unknown>;
  const width = restProps['width'] as MotionValue<number> | undefined;

  const defaultWidth = useMotionValue(40);
  const widthTransform = useTransform(width || defaultWidth, (val) => (val ? val / 2 : 20));

  return (
    <motion.div
      style={{ width: widthTransform, height: widthTransform }}
      className={cn(
        'flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full [&>div]:w-full [&>div]:h-full [&>div>svg]:w-full [&>div>svg]:h-full',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

export function DockSeparator({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-6 w-px bg-neutral-300 dark:bg-neutral-700 mx-1 shrink-0 self-center pointer-events-none',
        className
      )}
    />
  );
}

// --- Demo Component ---
const demoData = [
  {
    title: 'Home',
    icon: (
      <HomeIcon className="h-full w-full text-neutral-700 dark:text-neutral-200 stroke-[2]" />
    ),
    href: '#',
  },
  {
    title: 'Products',
    icon: (
      <Package className="h-full w-full text-neutral-700 dark:text-neutral-200 stroke-[2]" />
    ),
    href: '#',
  },
  {
    title: 'Components',
    icon: (
      <Component className="h-full w-full text-neutral-700 dark:text-neutral-200 stroke-[2]" />
    ),
    href: '#',
  },
  {
    title: 'Activity',
    icon: (
      <Activity className="h-full w-full text-neutral-700 dark:text-neutral-200 stroke-[2]" />
    ),
    href: '#',
  },
  {
    title: 'Change Log',
    icon: (
      <ScrollText className="h-full w-full text-neutral-700 dark:text-neutral-200 stroke-[2]" />
    ),
    href: '#',
  },
  {
    title: 'Email',
    icon: (
      <Mail className="h-full w-full text-neutral-700 dark:text-neutral-200 stroke-[2]" />
    ),
    href: '#',
  },
  {
    title: 'Theme',
    icon: (
      <SunMoon className="h-full w-full text-neutral-700 dark:text-neutral-200 stroke-[2]" />
    ),
    href: '#',
  },
];

export function AppleStyleDock({ className }: { className?: string }) {
  return (
    <div className={cn('relative max-w-full flex justify-center py-2', className)}>
      <Dock className="items-end pb-3">
        {demoData.map((item, idx) => (
          <DockItem
            key={idx}
            className="aspect-square rounded-full bg-[#E5E7EB] text-neutral-700 hover:text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:text-white"
          >
            <DockLabel>{item.title}</DockLabel>
            <DockIcon>{item.icon}</DockIcon>
          </DockItem>
        ))}
      </Dock>
    </div>
  );
}

export default Dock;
