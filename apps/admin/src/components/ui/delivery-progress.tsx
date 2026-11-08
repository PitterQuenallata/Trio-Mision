'use client';

import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Package,
  Plus,
  Minus,
  Truck,
  RotateCcw,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface DeliveryStep {
  label: string;
  time: string;
  detail: string;
}

export interface DeliveryProgressProps {
  orderId?: string;
  title?: string;
  subtitle?: string;
  steps?: DeliveryStep[];
  state?: { active?: number; expanded?: number };
  onStateChange?: (state: { active?: number; expanded?: number }) => void;
  onAction?: (label: string) => void;
  seeking?: boolean;
  className?: string;
  carrier?: string;
  trackingNumber?: string;
  estimatedArrival?: {
    date?: string;
    window?: string;
  };
  showControls?: boolean;
}

export const DEFAULT_DELIVERY_STEPS: DeliveryStep[] = [
  {
    label: 'Pedido confirmado',
    time: '05 OCT · 09:42',
    detail: 'Tu orden fue confirmada. El equipo de fulfillment está preparando tus artículos.',
  },
  {
    label: 'Empacado & despachado',
    time: '06 OCT · 14:18',
    detail: 'Empacado con altos estándares en nuestro centro de distribución y recogido por el transportista.',
  },
  {
    label: 'En reparto local',
    time: '08 OCT · 08:06',
    detail: 'Tu paquete ha salido del centro logístico local y está en el vehículo de entrega.',
  },
  {
    label: 'Entregado con éxito',
    time: '08 OCT · 11:24',
    detail: 'Entregado en la dirección indicada. ¡Gracias por confiar en nuestra plataforma!',
  },
];

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(val) ? val : min));

export function DeliveryProgress({
  orderId = 'PEDIDO / FR—2084',
  title = 'Tus productos están en camino.',
  subtitle = 'Tu pedido se acerca a la dirección de entrega.',
  steps = DEFAULT_DELIVERY_STEPS,
  state,
  onStateChange,
  onAction,
  seeking = false,
  className = '',
  carrier = 'Envío estándar · Paquetería certificada',
  trackingNumber = '1Z 984 02F 824',
  estimatedArrival = {
    date: 'Jueves, 08 de Octubre',
    window: 'Entre 10:00 AM y 2:00 PM',
  },
  showControls = false,
}: DeliveryProgressProps) {
  const [internalState, setInternalState] = useState<{
    active?: number;
    expanded?: number;
  }>({ active: 2, expanded: 2 });

  const currentState = state ?? internalState;
  const updateState = (updates: { active?: number; expanded?: number }) => {
    const next = { ...currentState, ...updates };
    setInternalState(next);
    onStateChange?.(next);
  };

  const activeIndex = clamp(
    currentState.active ?? 2,
    0,
    Math.max(0, steps.length - 1)
  );
  const expandedIndex = currentState.expanded ?? activeIndex;

  const isDelivered = activeIndex === steps.length - 1;
  const currentStep = steps[activeIndex];
  const progressPercent = (activeIndex / Math.max(1, steps.length - 1)) * 100;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Optional Interactive State Controller for demo/testing */}
      {showControls && (
        <div className="w-full max-w-[760px] mb-4 p-3 rounded-xl border border-border/60 bg-muted/30 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Simular Estado:</span>
            <div className="flex flex-wrap gap-1">
              {steps.map((st, idx) => (
                <button
                  key={st.label}
                  type="button"
                  onClick={() => updateState({ active: idx, expanded: idx })}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    activeIndex === idx
                      ? 'bg-foreground text-background font-semibold'
                      : 'bg-background hover:bg-muted text-muted-foreground'
                  )}
                >
                  {idx + 1}. {st.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateState({ active: 2, expanded: 2 })}
            className="h-7 text-xs gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reiniciar</span>
          </Button>
        </div>
      )}

      <section
        className={cn(
          'w-full max-w-[760px] mx-auto relative rounded-2xl border border-border bg-card/80 backdrop-blur-md p-6 sm:p-8 text-foreground text-left shadow-xs transition-colors',
          seeking && '[&_*]:!transition-none [&_*]:!animate-none',
          className
        )}
        data-seeking={seeking}
      >
        {/* Header */}
        <header className="flex justify-between items-start gap-4 mb-7">
          <div>
            <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-semibold font-mono">
              {orderId}
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mt-2 mb-1">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground m-0 leading-relaxed">
              {subtitle}
            </p>
          </div>

          <span
            className="w-12 h-12 rounded-xl border border-border bg-muted/40 flex items-center justify-center text-muted-foreground flex-none shadow-2xs"
            aria-hidden="true"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              className="text-foreground/80"
            >
              <path d="m4 9 12-6 12 6v14l-12 6-12-6Zm0 0 12 6 12-6M16 15v14M10 6l12 6v6" />
            </svg>
          </span>
        </header>

        {/* Estimated Arrival / Status Box */}
        <div className="border border-border/60 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 my-6">
          <div>
            <span className="text-[10px] tracking-[0.14em] uppercase text-muted-foreground font-semibold">
              {isDelivered ? 'Entregado' : 'Llegada estimada'}
            </span>
            <div className="text-base sm:text-lg font-semibold text-foreground mt-0.5 tracking-tight">
              {isDelivered ? 'Entregado a tiempo.' : estimatedArrival.date}
            </div>
            <p className="text-xs text-muted-foreground m-0 mt-0.5">
              {isDelivered
                ? 'Entregado de manera segura en tu dirección.'
                : estimatedArrival.window}
            </p>
          </div>

          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-background text-foreground shadow-2xs self-start sm:self-auto select-none">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                isDelivered ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'
              )}
            />
            <span>{currentStep?.label ?? 'Sin actualizaciones'}</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div
          className="h-1.5 w-full bg-muted rounded-full overflow-hidden my-6"
          role="progressbar"
          aria-label="Delivery progress"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, steps.length - 1)}
          aria-valuenow={activeIndex}
          aria-valuetext={currentStep?.label}
        >
          <span
            className="block h-full bg-foreground transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Stepper Timeline List */}
        <ol className="list-none p-0 m-0 space-y-1.5">
          {steps.map((st, idx) => {
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const isPending = idx > activeIndex;
            const isExpanded = expandedIndex === idx;

            return (
              <li
                key={st.label}
                className={cn(
                  'rounded-xl transition-colors',
                  isExpanded ? 'bg-muted/30' : 'hover:bg-muted/20'
                )}
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-3.5 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl cursor-pointer"
                  aria-expanded={isExpanded}
                  onClick={() => {
                    updateState({ expanded: isExpanded ? -1 : idx });
                    onAction?.(st.label);
                  }}
                >
                  {/* Status Circle Indicator */}
                  <span
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center flex-none text-xs font-medium transition-colors select-none',
                      isCompleted && 'bg-foreground text-background',
                      isCurrent && 'border-2 border-foreground text-foreground',
                      isPending && 'border border-border bg-muted/50 text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-foreground" />
                    ) : null}
                  </span>

                  {/* Step Title & Timestamp */}
                  <span className="flex-1 min-w-0">
                    <strong
                      className={cn(
                        'block text-xs sm:text-sm font-medium',
                        idx <= activeIndex ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {st.label}
                    </strong>
                    <small className="block text-[11px] text-muted-foreground font-mono tabular-nums">
                      {idx <= activeIndex ? st.time : 'Pendiente de actualización'}
                    </small>
                  </span>

                  {/* Expand / Collapse Indicator */}
                  <span
                    className="text-muted-foreground font-mono text-xs px-2 select-none"
                    aria-hidden="true"
                  >
                    {isExpanded ? '−' : '+'}
                  </span>
                </button>

                {/* Expanded Details Text */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="step-detail"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="pl-13 pr-4 pb-3.5 pt-0 text-xs text-muted-foreground leading-relaxed m-0">
                        {idx <= activeIndex
                          ? st.detail
                          : 'Los detalles de rastreo se mostrarán cuando el paquete arribe a esta etapa.'}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>

        {/* Footer */}
        <footer className="flex items-center justify-between pt-6 border-t border-border text-xs text-muted-foreground mt-6 font-medium">
          <span>{carrier}</span>
          <span className="font-mono text-[11px] tabular-nums tracking-wider text-foreground/80">
            {trackingNumber}
          </span>
        </footer>
      </section>
    </div>
  );
}

export default DeliveryProgress;
