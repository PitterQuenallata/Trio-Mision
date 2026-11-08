import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/utils';

const CORNER = 6;
const DASH =
  'repeating-linear-gradient(to top, transparent 0 2px, currentColor 2px 4px)';

export type HookSidebarItem =
  | string
  | { label: string; href?: string; badge?: string };

export type HookSidebarProps = Omit<ComponentProps<'nav'>, 'onChange'> & {
  items: HookSidebarItem[];
  label?: string;
  value?: number;
  defaultValue?: number;
  currentPath?: string;
  onChange?: (index: number) => void;
  color?: string;
  dashed?: boolean;
};

const hrefOf = (item: HookSidebarItem) =>
  typeof item === 'string' ? undefined : item.href;

const labelOf = (item: HookSidebarItem) =>
  typeof item === 'string' ? item : item.label;

const badgeOf = (item: HookSidebarItem) =>
  typeof item === 'string' ? undefined : item.badge;

const Rail = ({
  from = 0,
  y,
  visible,
  color,
  dashed,
  className,
}: {
  from?: number;
  y: number | null;
  visible: boolean;
  color?: string;
  dashed: boolean;
  className?: string;
}) => {
  const reduced = useReducedMotion();
  const travel = reduced
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 };

  return (
    <motion.span
      aria-hidden
      initial={false}
      style={{ color }}
      animate={{ opacity: visible && y !== null ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.2 }}
      className={cn('pointer-events-none absolute inset-0', className)}
    >
      <motion.span
        initial={false}
        animate={{ top: from, height: Math.max(0, (y ?? 0) - CORNER - from) }}
        transition={travel}
        style={
          dashed
            ? { backgroundImage: DASH }
            : { backgroundColor: 'currentColor' }
        }
        className="absolute left-0.5 w-px"
      />
      <motion.svg
        initial={false}
        animate={{ top: (y ?? 0) - CORNER }}
        transition={travel}
        width="12"
        height="7"
        viewBox="0 0 12 7"
        fill="none"
        className="absolute left-0.5"
      >
        <path
          d="M0.5 0a6 6 0 0 0 6 6H12"
          stroke="currentColor"
          strokeDasharray={dashed ? '2 2' : undefined}
        />
      </motion.svg>
    </motion.span>
  );
};

export function HookSidebar({
  items,
  label,
  value,
  defaultValue = 0,
  currentPath,
  onChange,
  color = '#F97316',
  dashed = true,
  className,
  ...props
}: HookSidebarProps) {
  const getPath = () => {
    if (currentPath !== undefined) return currentPath;
    if (typeof window !== 'undefined') {
      return window.location.hash.replace(/^#/, '') || window.location.pathname;
    }
    return '';
  };

  const pathname = getPath().split('?')[0];
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [centers, setCenters] = useState<number[]>([]);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);

  const routed = items.some((item) => hrefOf(item));
  const routeIndex = items.findIndex((item) => {
    const href = hrefOf(item);
    return href === pathname || (href === '/dashboard' && pathname === '/');
  });
  const activeIndex = value ?? (routed ? routeIndex : internalValue);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () =>
      setCenters(
        itemRefs.current.map((el) =>
          el ? el.offsetTop + el.offsetHeight / 2 : 0
        )
      );

    const observer = new ResizeObserver(measure);
    observer.observe(list);
    measure();
    return () => observer.disconnect();
  }, [items.length]);

  const activeY = activeIndex < 0 ? null : (centers[activeIndex] ?? null);
  const hoverY = hoverIndex === null ? null : (centers[hoverIndex] ?? null);

  // above the active row the accent line already covers the span, so draw only the corner
  const hoverFrom =
    activeY !== null && hoverY !== null && hoverY <= activeY
      ? Math.max(0, hoverY - CORNER)
      : (activeY ?? 0);

  const select = (index: number) => {
    if (value === undefined) setInternalValue(index);
    onChange?.(index);
  };

  return (
    <nav
      data-slot="hook-sidebar"
      aria-label={label}
      className={cn('flex flex-col', className)}
      {...props}
    >
      {label && (
        <span
          data-slot="hook-sidebar-label"
          className="pb-2.5 pl-0.5 pr-2 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </span>
      )}

      <div
        ref={listRef}
        onMouseLeave={() => setPointerInside(false)}
        className="relative flex flex-col gap-0.5 ml-1"
      >
        <Rail
          from={hoverFrom}
          y={hoverY}
          visible={(pointerInside || focusInside) && hoverIndex !== activeIndex}
          dashed={dashed}
          className="text-foreground/30"
        />
        <Rail
          y={activeY}
          visible={activeY !== null}
          color={color}
          dashed={dashed}
        />

        {items.map((item, index) => {
          const text = labelOf(item);
          const href = hrefOf(item);
          const badge = badgeOf(item);
          const isActive = index === activeIndex;
          const setRef = (el: HTMLElement | null) => {
            itemRefs.current[index] = el;
          };
          const rowProps = {
            'data-slot': 'hook-sidebar-item',
            'data-active': isActive,
            onMouseEnter: () => {
              setHoverIndex(index);
              setPointerInside(true);
            },
            onFocus: () => {
              setHoverIndex(index);
              setFocusInside(true);
            },
            onBlur: () => setFocusInside(false),
            onClick: () => select(index),
            className: cn(
              'rounded-lg py-1.5 pl-4 pr-2 text-left text-xs font-medium transition-colors duration-200 motion-reduce:transition-none flex items-center justify-between cursor-pointer select-none',
              isActive
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            ),
          };

          return href ? (
            <a
              key={`${index}-${text}`}
              {...rowProps}
              ref={setRef}
              href={`#${href}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span>{text}</span>
              {badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground">
                  {badge}
                </span>
              )}
            </a>
          ) : (
            <button
              key={`${index}-${text}`}
              {...rowProps}
              ref={setRef}
              type="button"
              aria-current={isActive ? 'true' : undefined}
            >
              <span>{text}</span>
              {badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
