import React, { useState } from 'react';
import { Trash2, Plus, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { Switch } from '../../../shared/components/ui/switch';
import { Badge } from '../../../shared/components/ui/badge';
import { SecurityConfig } from '../types/configuracion.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';

interface ConfigSecurityTabProps {
  initialConfig: SecurityConfig;
  onSave: (config: SecurityConfig) => void;
}

export const ConfigSecurityTab: React.FC<ConfigSecurityTabProps> = ({
  initialConfig,
  onSave,
}) => {
  const { play } = useSound();
  const [config, setConfig] = useState<SecurityConfig>(initialConfig);
  const [newIp, setNewIp] = useState('');

  const handleAddIp = () => {
    if (!newIp.trim()) return;
    play('click');
    setConfig({
      ...config,
      ipWhitelist: [...config.ipWhitelist, newIp.trim()],
    });
    setNewIp('');
    pillToast.success('Lista Blanca IP', 'Rango CIDR añadido a las reglas de acceso permitidas.');
  };

  const handleRemoveIp = (ipToRemove: string) => {
    play('pop');
    setConfig({
      ...config,
      ipWhitelist: config.ipWhitelist.filter((ip) => ip !== ipToRemove),
    });
    pillToast.info('Regla Eliminada', 'Rango IP retirado de la lista blanca.');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    play('success');
    onSave(config);
    pillToast.success('Seguridad IAM', 'Directivas de seguridad y control de acceso actualizadas.');
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Core IAM & Auth Policies (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold">
                Directivas de Autenticación & Sesión
              </CardTitle>
              <CardDescription className="text-xs">
                Controles de acceso para mitigar ataques de fuerza bruta y robo de credenciales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              {/* 2FA Obligatorio */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Autenticación en Dos Pasos (2FA) Obligatoria
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Exige TOTP o llaves físicas para todos los roles administrativos
                  </p>
                </div>
                <Switch
                  checked={config.requireTwoFactor}
                  onCheckedChange={(val) => {
                    play('click');
                    setConfig({ ...config, requireTwoFactor: val });
                  }}
                />
              </div>

              {/* FIDO2 Hardware Keys */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Forzar Llaves Criptográficas de Hardware (FIDO2 / YubiKey)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Inhabilita códigos SMS y solo permite autenticadores WebAuthn
                  </p>
                </div>
                <Switch
                  checked={config.enforceHardwareKeys}
                  onCheckedChange={(val) => {
                    play('click');
                    setConfig({ ...config, enforceHardwareKeys: val });
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/40">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Caducidad de Contraseña
                  </label>
                  <select
                    value={config.passwordExpirationDays}
                    onChange={(e) => setConfig({ ...config, passwordExpirationDays: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-mono"
                  >
                    <option value={30}>30 Días</option>
                    <option value={60}>60 Días</option>
                    <option value={90}>90 Días (SOX)</option>
                    <option value={180}>180 Días</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Intentos Antes de Bloqueo
                  </label>
                  <select
                    value={config.maxFailedAttempts}
                    onChange={(e) => setConfig({ ...config, maxFailedAttempts: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-mono"
                  >
                    <option value={3}>3 Intentos Fallidos</option>
                    <option value={5}>5 Intentos Fallidos</option>
                    <option value={10}>10 Intentos Fallidos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Timeout Sesión Inactiva
                  </label>
                  <select
                    value={config.sessionTimeoutMinutes}
                    onChange={(e) => setConfig({ ...config, sessionTimeoutMinutes: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-mono"
                  >
                    <option value={15}>15 Minutos</option>
                    <option value={30}>30 Minutos</option>
                    <option value={60}>1 Hora</option>
                    <option value={120}>2 Horas</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SSO SAML 2.0 Enterprise */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Inicio de Sesión Único Corporativo (SSO SAML 2.0)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Federación de identidades con Okta, Azure AD o Ping Identity
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-500 bg-emerald-500/5">
                  Conectado & Activo
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="p-3 rounded-xl bg-background/50 border border-border/40 text-xs font-mono space-y-1.5 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proveedor de Identidad:</span>
                  <span className="text-foreground">{config.ssoProvider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entity ID:</span>
                  <span className="text-foreground">https://blakor.dev/saml/metadata</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Certificado X.509:</span>
                  <span className="text-emerald-500">SHA-256 Válido hasta Oct 2028</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: IP Whitelist CIDR (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold">
                Lista Blanca de Subredes IP (CIDR)
              </CardTitle>
              <CardDescription className="text-xs">
                Restringe el acceso administrativo exclusivamente a redes confiables
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="Ej: 192.168.1.0/24"
                  className="rounded-xl text-xs h-8 font-mono bg-background/60"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddIp}
                  className="rounded-xl h-8 px-3 text-xs gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir</span>
                </Button>
              </div>

              <div className="divide-y divide-border/30 border border-border/40 rounded-xl overflow-hidden bg-background/40">
                {config.ipWhitelist.map((ip) => (
                  <div key={ip} className="p-2.5 px-3 flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-foreground">{ip}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveIp(ip)}
                      className="text-muted-foreground hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Las conexiones desde direcciones IP fuera de esta lista recibirán respuesta HTTP 403 Forbidden inmediata.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              className="w-full rounded-xl h-9 text-xs font-medium shadow-sm"
            >
              Guardar Directivas de Seguridad
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
