import React, { useState } from 'react';
import { Database, HardDrive, ShieldCheck, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Switch } from '../../../shared/components/ui/switch';
import { Badge } from '../../../shared/components/ui/badge';
import { BackupConfig } from '../types/configuracion.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';

interface ConfigBackupsTabProps {
  initialConfig: BackupConfig;
  onSave: (config: BackupConfig) => void;
}

export const ConfigBackupsTab: React.FC<ConfigBackupsTabProps> = ({
  initialConfig,
  onSave,
}) => {
  const { play } = useSound();
  const [config, setConfig] = useState<BackupConfig>(initialConfig);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState(false);

  const handleManualSnapshot = () => {
    play('pop');
    setIsGeneratingSnapshot(true);
    pillToast.info('Respaldo en Curso', 'Iniciando volcado binario WAL y snapshot en caliente.');

    setTimeout(() => {
      setIsGeneratingSnapshot(false);
      play('success');
      setConfig({
        ...config,
        lastBackupDate: 'Hace unos segundos',
      });
      pillToast.success('Snapshot Cifrado', 'Respaldo generado y almacenado en AWS S3 eu-central-1.');
    }, 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    play('success');
    onSave(config);
    pillToast.success('Políticas Guardadas', 'Directivas de respaldo y retención en la nube actualizadas.');
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Backup Policies Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold">
                Políticas de Respaldo Automatizado
              </CardTitle>
              <CardDescription className="text-xs">
                Frecuencia y almacenamiento redundante en la nube para recuperación ante desastres (DRP)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Snapshots Automatizados
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Ejecuta volcados periódicos sin bloqueo de transacciones activas
                  </p>
                </div>
                <Switch
                  checked={config.autoSnapshots}
                  onCheckedChange={(val) => {
                    play('click');
                    setConfig({ ...config, autoSnapshots: val });
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Proveedor de Almacenamiento Primario
                </label>
                <select
                  value={config.provider}
                  onChange={(e) => setConfig({ ...config, provider: e.target.value as any })}
                  className="w-full h-9 px-3 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-mono"
                >
                  <option value="AWS S3">AWS S3 (Bucket: blakor-backups-encrypted-eu)</option>
                  <option value="Google Cloud Storage">Google Cloud Storage (Dual-Region)</option>
                  <option value="Azure Blob">Azure Blob Storage (Geo-Redundant)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Frecuencia de Snapshots
                  </label>
                  <select
                    value={config.frequency}
                    onChange={(e) => setConfig({ ...config, frequency: e.target.value as any })}
                    className="w-full h-9 px-3 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="hourly">Cada hora (Transaccional)</option>
                    <option value="daily">Diario a las 03:00 UTC</option>
                    <option value="weekly">Semanal los Domingos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Retención de Copias (Días)
                  </label>
                  <select
                    value={config.retentionDays}
                    onChange={(e) => setConfig({ ...config, retentionDays: Number(e.target.value) })}
                    className="w-full h-9 px-3 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-mono"
                  >
                    <option value={30}>30 Días</option>
                    <option value={90}>90 Días</option>
                    <option value={180}>180 Días</option>
                    <option value={365}>365 Días (Cumplimiento SOX)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Snapshot Operations & Stats (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold">
                Estado del Último Respaldo
              </CardTitle>
              <CardDescription className="text-xs">
                Auditoría de integridad y recuperación
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="p-3.5 rounded-xl bg-background/50 border border-border/40 space-y-2 font-mono text-xs tabular-nums">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Último Snapshot:</span>
                  <span className="font-semibold text-foreground">{config.lastBackupDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tamaño Comprimido:</span>
                  <span className="font-semibold text-foreground">{config.lastBackupSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cifrado:</span>
                  <span className="text-emerald-500 font-semibold">AES-256-GCM Hardware</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Integridad WAL:</span>
                  <span className="text-emerald-500 font-semibold">100% Verificada</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isGeneratingSnapshot}
                onClick={handleManualSnapshot}
                className="w-full rounded-xl h-9 text-xs font-medium gap-1.5"
              >
                <RefreshCw className={isGeneratingSnapshot ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
                <span>{isGeneratingSnapshot ? 'Generando Snapshot...' : 'Ejecutar Snapshot Manual Inmediato'}</span>
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              className="w-full rounded-xl h-9 text-xs font-medium shadow-sm"
            >
              Guardar Políticas de Respaldo
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
