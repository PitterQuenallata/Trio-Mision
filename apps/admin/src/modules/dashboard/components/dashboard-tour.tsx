import React, { useEffect } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import { useSound } from '../../../shared/context/sound-context';
import { cn } from '../../../shared/lib/utils';

export interface TourStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  targetId: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'views',
    stepNumber: 1,
    title: 'Vistas de Negocio',
    description: 'Alterna entre los 4 tableros corporativos de la plataforma: Ejecutivo (Finanzas & SaaS), Analítica Global, CRM Ventas B2B y eCommerce Retail.',
    targetId: 'dashboard-tabs-container',
  },
  {
    id: 'kpis',
    stepNumber: 2,
    title: 'Métricas & Indicadores Clave',
    description: 'Supervisa balances y variaciones porcentuales con tipografía de ancho numérico constante para evitar oscilaciones en tiempo real.',
    targetId: 'dashboard-content-container',
  },
  {
    id: 'actions',
    stepNumber: 3,
    title: 'Periodos & Exportación',
    description: 'Ajusta la ventana contable de tus métricas o genera un informe ejecutivo en PDF listo para auditorías.',
    targetId: 'dashboard-actions-container',
  },
  {
    id: 'shortcuts',
    stepNumber: 4,
    title: 'Navegación & Atajos',
    description: 'Presiona ⌘K para buscar datos o cambiar de módulo al instante, y ⌘/ para abrir la referencia completa de atajos de teclado.',
    targetId: 'dashboard-header-container',
  },
];

interface DashboardTourProps {
  isOpen: boolean;
  currentStep: number;
  onStepChange: (step: number) => void;
  onClose: () => void;
}

export const DashboardTour: React.FC<DashboardTourProps> = ({
  isOpen,
  currentStep,
  onStepChange,
  onClose,
}) => {
  const { play } = useSound();

  const totalSteps = TOUR_STEPS.length;
  const step = TOUR_STEPS[currentStep] || TOUR_STEPS[0];

  // Highlight active target element on the screen
  useEffect(() => {
    if (!isOpen) return;

    const el = document.getElementById(step.targetId);
    if (el) {
      el.classList.add(
        'ring-2',
        'ring-foreground/20',
        'ring-offset-4',
        'ring-offset-background',
        'transition-all',
        'duration-300',
        'rounded-2xl'
      );
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    return () => {
      if (el) {
        el.classList.remove(
          'ring-2',
          'ring-foreground/20',
          'ring-offset-4',
          'ring-offset-background',
          'transition-all',
          'duration-300',
          'rounded-2xl'
        );
      }
    };
  }, [isOpen, step.targetId]);

  if (!isOpen) return null;

  const handleNext = () => {
    play('click');
    if (currentStep < totalSteps - 1) {
      onStepChange(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    play('click');
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const handleDismiss = () => {
    play('click');
    onClose();
  };

  return (
    <div className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 z-50 pointer-events-auto">
      <div className="w-[340px] sm:w-[380px] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-card/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl shadow-2xl p-4.5 text-foreground space-y-3.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
        {/* Header: Step counter & Close */}
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] font-medium tracking-wider uppercase font-mono">
            Paso {step.stepNumber} de {totalSteps}
          </span>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Cerrar recorrido"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold tracking-tight text-foreground font-heading">
            {step.title}
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Footer: Dots & Navigation Buttons */}
        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-3">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  idx === currentStep ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/30'
                )}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                <span>Atrás</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleNext}
              className="h-7 px-3 text-xs rounded-lg bg-foreground text-background hover:bg-foreground/90 font-medium"
            >
              <span>{currentStep === totalSteps - 1 ? 'Finalizar' : 'Siguiente'}</span>
              {currentStep < totalSteps - 1 && (
                <ArrowRight className="h-3 w-3 ml-1" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
