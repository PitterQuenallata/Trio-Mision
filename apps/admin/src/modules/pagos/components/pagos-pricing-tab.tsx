import React, { useState } from 'react';
import {
  Check,
  Minus,
  ChevronDown,
  HelpCircle,
  KeyRound,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { initialPricingPlans, initialFaqs } from '../data/pagos-data';
import { PricingPlan } from '../types/pagos.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

export interface PagosPricingTabProps {
  context?: 'pagos' | 'licencias';
  onSelectPlan?: (plan: PricingPlan) => void;
}

export const PagosPricingTab: React.FC<PagosPricingTabProps> = ({
  context = 'pagos',
  onSelectPlan,
}) => {
  const { play } = useSound();
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(true);
  const [openFaqId, setOpenFaqId] = useState<string | null>(initialFaqs[0].id);

  const handleSelectPlan = (plan: PricingPlan) => {
    play('success');
    if (onSelectPlan) {
      onSelectPlan(plan);
      return;
    }
    const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
    if (context === 'licencias') {
      pillToast.success(
        'Nivel de Plan Seleccionado',
        `Plantilla ${plan.name} ($${price} USD/m) configurada para emisión de nuevas licencias.`
      );
    } else {
      pillToast.success(
        'Plan Seleccionado',
        `Elegiste ${plan.name} a $${price} USD/mes. Pasarela inicializada.`
      );
    }
  };

  const toggleFaq = (id: string) => {
    play('click');
    setOpenFaqId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-10">
      {/* Unified Cross-Navigation Banner */}
      {context === 'pagos' ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-secondary/50 border border-border text-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-foreground">Catálogo Unificado con Licencias SaaS</span>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                ¿Deseas auditar claves criptográficas vigentes, asientos concurrentes o contratos activos?
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              play('click');
              navigate({ to: '/licencias' });
            }}
            className="gap-1.5 text-xs rounded-xl shrink-0 self-start sm:self-auto"
          >
            <KeyRound className="h-3.5 w-3.5 text-primary" />
            <span>Gestionar Licencias SaaS</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20 text-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-foreground">Sincronización de Planes Comerciales</span>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                Los niveles Starter, Pro y Enterprise definen las cuotas de miembros y capacidades de cada clave emitida.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              play('click');
              navigate({ to: '/pagos' });
            }}
            className="gap-1.5 text-xs rounded-xl shrink-0 self-start sm:self-auto"
          >
            <CreditCard className="h-3.5 w-3.5 text-primary" />
            <span>Ver Facturación & Cobros</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      )}
      {/* Pricing Header & Billing Period Switcher */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block">
          Tarifas & Suscripciones Transparentes
        </span>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Planes Flexibles Adaptados al Crecimiento de tu Empresa
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Escala desde prototipos individuales hasta infraestructuras multi-sede con soporte SLA 99.99% y cumplimiento normativo.
        </p>

        {/* Monthly / Annual Pill Switcher */}
        <div className="inline-flex items-center gap-3 p-1.5 rounded-2xl bg-secondary/50 border border-border mt-2">
          <button
            type="button"
            onClick={() => {
              play('tab');
              setIsAnnual(false);
            }}
            className={cn(
              'px-4 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer',
              !isAnnual
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Facturación Mensual
          </button>

          <button
            type="button"
            onClick={() => {
              play('tab');
              setIsAnnual(true);
            }}
            className={cn(
              'px-4 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5',
              isAnnual
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>Facturación Anual</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
              -20% OFF
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {initialPricingPlans.map((plan) => {
          const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
          return (
            <Card
              key={plan.id}
              className={cn(
                'flex flex-col justify-between border-border transition-all duration-200 relative overflow-hidden',
                plan.isPopular
                  ? 'border-primary shadow-lg ring-1 ring-primary/30 bg-card'
                  : 'bg-card/70 hover:border-foreground/30 hover:shadow-md'
              )}
            >
              {plan.isPopular && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground font-mono text-[10px] font-bold px-3 py-1 rounded-bl-xl tracking-wider uppercase">
                  {plan.badge}
                </div>
              )}

              <CardContent className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-0.5">
                        {plan.name}
                      </span>
                      <p className="text-[11px] text-muted-foreground max-w-[200px]">
                        {plan.description}
                      </p>
                    </div>

                    <div className="h-14 w-14 rounded-2xl overflow-hidden shrink-0">
                      <img
                        src={plan.image}
                        alt={plan.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Price Block */}
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-3xl sm:text-4xl font-bold text-foreground tabular-nums">
                        ${price}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        USD / mes
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-0.5 font-mono">
                      {isAnnual ? 'Facturado anualmente ($' + price * 12 + '/año)' : 'Facturación recurrente mensual'}
                    </span>
                  </div>

                  {/* Feature Checklist */}
                  <div className="pt-4 border-t border-border/50 space-y-2.5 text-xs">
                    <span className="text-[11px] font-semibold text-foreground block mb-2">
                      Capacidades Incluidas:
                    </span>
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2.5">
                        {feat.included ? (
                          <div className="h-4 w-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                            <Check className="h-2.5 w-2.5" />
                          </div>
                        ) : (
                          <div className="h-4 w-4 rounded-full bg-secondary text-muted-foreground/40 flex items-center justify-center shrink-0">
                            <Minus className="h-2.5 w-2.5" />
                          </div>
                        )}
                        <span
                          className={cn(
                            'text-[11px]',
                            feat.included ? 'text-foreground' : 'text-muted-foreground/50 line-through'
                          )}
                        >
                          {feat.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plan Action CTA */}
                <div className="pt-4 border-t border-border/50">
                  <Button
                    variant={plan.isPopular ? 'default' : 'outline'}
                    soundType="click"
                    onClick={() => handleSelectPlan(plan)}
                    className="w-full text-xs h-10 font-semibold justify-center"
                  >
                    {context === 'licencias' ? `Configurar ${plan.name}` : `Seleccionar ${plan.name}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ Accordion Section */}
      <div className="max-w-3xl mx-auto space-y-6 pt-6">
        <div className="text-center space-y-1">
          <h3 className="font-heading text-lg font-bold text-foreground">
            Preguntas Frecuentes sobre Facturación
          </h3>
          <p className="text-xs text-muted-foreground">
            Aclaraciones clave sobre contratos, deducciones impositivas y formas de pago
          </p>
        </div>

        <div className="space-y-3">
          {initialFaqs.map((faq) => {
            const isOpen = openFaqId === faq.id;
            return (
              <div
                key={faq.id}
                className="rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 text-xs font-semibold text-foreground hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
                      isOpen && 'rotate-180 text-foreground'
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed border-t border-border/40">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
