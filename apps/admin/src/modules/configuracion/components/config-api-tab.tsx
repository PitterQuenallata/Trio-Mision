import React, { useState } from 'react';
import { Copy, Plus, CheckCircle2, Trash2, KeyRound, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { ApiKeyItem, WebhookEndpoint } from '../types/configuracion.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface ConfigApiTabProps {
  apiKeys: ApiKeyItem[];
  webhooks: WebhookEndpoint[];
  onAddApiKey: (key: ApiKeyItem) => void;
  onRevokeApiKey: (id: string) => void;
  onAddWebhook: (webhook: WebhookEndpoint) => void;
}

export const ConfigApiTab: React.FC<ConfigApiTabProps> = ({
  apiKeys,
  webhooks,
  onAddApiKey,
  onRevokeApiKey,
  onAddWebhook,
}) => {
  const { play } = useSound();
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const handleCopyKey = (key: ApiKeyItem) => {
    play('pop');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(key.fullKey);
    }
    setCopiedKeyId(key.id);
    pillToast.success('Clave Copiada', `Clave API ${key.name} copiada al portapapeles.`);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleGenerateNewKey = () => {
    play('pop');
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const newKey: ApiKeyItem = {
      id: `key-${Date.now()}`,
      name: 'Nueva Clave API de Integración',
      prefix: 'blk_live_custom',
      keyMasked: `blk_live_custom_${randomSuffix.substring(0, 4)}••••••••••••${randomSuffix.substring(4)}`,
      fullKey: `blk_live_custom_${randomSuffix}8841992014`,
      role: 'Admin Total',
      createdAt: 'Hoy',
      lastUsed: 'Nunca',
    };
    onAddApiKey(newKey);
    pillToast.success('Clave Generada', 'Nueva clave secreta de API creada exitosamente.');
  };

  const handleAddWebhookPrompt = () => {
    play('click');
    pillToast.info('Nuevo Webhook', 'Abriendo formulario de suscripción a eventos webhook.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* API Keys Management */}
      <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
        <CardHeader className="pb-4 border-b border-border/40 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Claves de Acceso a la API (REST & GraphQL)
            </CardTitle>
            <CardDescription className="text-xs">
              Credenciales criptográficas para llamadas autenticadas de servicios internos y SDKs
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleGenerateNewKey}
            className="rounded-xl h-8 px-3 text-xs gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generar Clave API</span>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-5">Identificador / Nombre</th>
                  <th className="py-3 px-5">Clave Encriptada</th>
                  <th className="py-3 px-5">Nivel de Permisos</th>
                  <th className="py-3 px-5">Fecha Creación</th>
                  <th className="py-3 px-5">Último Uso</th>
                  <th className="py-3 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-foreground">
                      {key.name}
                    </td>
                    <td className="py-3.5 px-5">
                      <code className="bg-background/80 px-2.5 py-1 rounded-md text-[11px] font-mono border border-border/50 text-foreground">
                        {key.keyMasked}
                      </code>
                    </td>
                    <td className="py-3.5 px-5">
                      <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5">
                        {key.role}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 font-mono tabular-nums text-muted-foreground">
                      {key.createdAt}
                    </td>
                    <td className="py-3.5 px-5 font-mono tabular-nums text-foreground">
                      {key.lastUsed}
                    </td>
                    <td className="py-3.5 px-5 text-right flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyKey(key)}
                        className="h-7 px-2 text-xs rounded-xl"
                      >
                        {copiedKeyId === key.id ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-1" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                        )}
                        <span>{copiedKeyId === key.id ? 'Copiada' : 'Copiar'}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          play('pop');
                          onRevokeApiKey(key.id);
                          pillToast.warning('Clave Revocada', `Clave ${key.name} revocada permanentemente.`);
                        }}
                        className="h-7 px-2 text-xs rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks Subscriptions */}
      <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
        <CardHeader className="pb-4 border-b border-border/40 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Endpoints de Webhooks Salientes
            </CardTitle>
            <CardDescription className="text-xs">
              Notificación automática a servidores externos ante eventos de plataforma
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleAddWebhookPrompt}
            className="rounded-xl h-8 px-3 text-xs gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Webhook</span>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-5">URL del Endpoint</th>
                  <th className="py-3 px-5">Eventos Suscritos</th>
                  <th className="py-3 px-5">Estado de Respuesta</th>
                  <th className="py-3 px-5 text-right">Último Envío</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {webhooks.map((wh) => (
                  <tr key={wh.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-foreground font-medium truncate max-w-[280px]">
                      {wh.url}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex flex-wrap gap-1">
                        {wh.events.map((ev, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted/60 text-muted-foreground border border-border/40"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-mono tabular-nums">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-mono px-2 py-0',
                          wh.status === '200 OK'
                            ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'
                            : 'border-rose-500/30 text-rose-500 bg-rose-500/5'
                        )}
                      >
                        {wh.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono tabular-nums text-muted-foreground">
                      {wh.lastDispatched}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
