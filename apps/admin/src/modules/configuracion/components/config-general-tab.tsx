import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { Switch } from '../../../shared/components/ui/switch';
import { Badge } from '../../../shared/components/ui/badge';
import { GeneralConfig } from '../types/configuracion.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface ConfigGeneralTabProps {
  initialConfig: GeneralConfig;
  onSave: (config: GeneralConfig) => void;
}

export const ConfigGeneralTab: React.FC<ConfigGeneralTabProps> = ({
  initialConfig,
  onSave,
}) => {
  const { play } = useSound();
  const [config, setConfig] = useState<GeneralConfig>(initialConfig);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    play('success');
    onSave(config);
    pillToast.success('Ajustes Guardados', 'Configuración general del sistema guardada con éxito.');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Settings Form (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold">
                Perfil de la Organización & Servidor
              </CardTitle>
              <CardDescription className="text-xs">
                Parámetros básicos de localización y formato regional
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Nombre de la Organización / Plataforma
                </label>
                <Input
                  value={config.organizationName}
                  onChange={(e) => setConfig({ ...config, organizationName: e.target.value })}
                  className="rounded-xl text-xs h-9 bg-background/60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Correo Electrónico de Soporte Oficial
                </label>
                <Input
                  type="email"
                  value={config.supportEmail}
                  onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
                  className="rounded-xl text-xs h-9 font-mono bg-background/60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Zona Horaria del Sistema
                  </label>
                  <select
                    value={config.timezone}
                    onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                    className="w-full h-9 px-3 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-mono"
                  >
                    <option value="UTC / Europe/Berlin">UTC (Europe/Berlin)</option>
                    <option value="UTC / America/New_York">UTC (America/New_York)</option>
                    <option value="UTC / America/Santiago">UTC (America/Santiago)</option>
                    <option value="UTC / Asia/Tokyo">UTC (Asia/Tokyo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Idioma Predeterminado
                  </label>
                  <select
                    value={config.systemLanguage}
                    onChange={(e) => setConfig({ ...config, systemLanguage: e.target.value as any })}
                    className="w-full h-9 px-3 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="es">Español (Castellano)</option>
                    <option value="en">English (US)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Moneda de Facturación Base
                  </label>
                  <select
                    value={config.currency}
                    onChange={(e) => setConfig({ ...config, currency: e.target.value as any })}
                    className="w-full h-9 px-3 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-mono"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Mode Card */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Ventana de Mantenimiento Global
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Restringe temporalmente el acceso público a la API y el portal
                  </CardDescription>
                </div>
                <Switch
                  checked={config.maintenanceMode}
                  onCheckedChange={(val) => {
                    play(val ? 'alert' : 'click');
                    setConfig({ ...config, maintenanceMode: val });
                    if (val) {
                      pillToast.warning('Modo Mantenimiento', 'Tráfico restringido para usuarios externos.');
                    }
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Mensaje Visible para Usuarios en Mantenimiento
                </label>
                <textarea
                  value={config.maintenanceMessage}
                  onChange={(e) => setConfig({ ...config, maintenanceMessage: e.target.value })}
                  rows={3}
                  className="w-full p-3 rounded-xl bg-background/60 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status & Environment Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold">
                Entorno del Clúster
              </CardTitle>
              <CardDescription className="text-xs">
                Modo de operación del runtime
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Entorno Seleccionado
                </label>
                <select
                  value={config.environment}
                  onChange={(e) => setConfig({ ...config, environment: e.target.value as any })}
                  className="w-full h-9 px-3 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-mono"
                >
                  <option value="Producción">Producción (Live)</option>
                  <option value="Staging">Staging (Pre-Release)</option>
                  <option value="Sandbox">Sandbox (Pruebas)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-background/50 border border-border/40 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Versión del Kernel:</span>
                  <span className="font-semibold text-foreground tabular-nums">v4.18.2-prod</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Compilación Hash:</span>
                  <span className="text-foreground">sha256:7f4a21</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tiempo en Línea (Uptime):</span>
                  <span className="font-semibold text-emerald-500 tabular-nums">48d 14h 22m</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              className="w-full rounded-xl h-9 text-xs font-medium shadow-sm"
            >
              Guardar Configuración General
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
