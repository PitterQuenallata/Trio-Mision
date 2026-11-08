import React, { useState } from 'react';
import {
  Upload,
  RotateCcw,
  Check,
  ShieldCheck,
  CreditCard,
  Download,
  KeyRound,
  Smartphone,
  Laptop,
  Globe,
  Trash2,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { Input } from '../../../shared/components/ui/input';
import { initialInvoices, initialSessions } from '../data/usuarios-data';
import { InvoiceRecord, ActiveSession } from '../types/usuarios.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

export type AccountSubTab = 'account' | 'notifications' | 'billing' | 'security';

export const UsuariosAccountTab: React.FC = () => {
  const { play } = useSound();
  const navigate = useNavigate();

  const getInitialSubTab = (): AccountSubTab => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('sub=security') || hash.includes('tab=security')) return 'security';
      if (hash.includes('sub=billing')) return 'billing';
      if (hash.includes('sub=notifications')) return 'notifications';
    }
    return 'account';
  };

  const [activeTab, setActiveTab] = useState<AccountSubTab>(getInitialSubTab);

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('sub=security') || hash.includes('tab=security')) {
        setActiveTab('security');
      } else if (hash.includes('sub=billing')) {
        setActiveTab('billing');
      } else if (hash.includes('sub=notifications')) {
        setActiveTab('notifications');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Account Form State
  const [fullName, setFullName] = useState('Mathew Anderson');
  const [username, setUsername] = useState('mathew_design');
  const [email, setEmail] = useState('mathew.anderson@blakor.io');
  const [phone, setPhone] = useState('+1 (555) 382-9012');
  const [department, setDepartment] = useState('Diseño de Producto & UX');
  const [timezone, setTimezone] = useState('GMT-07:00 (Pacific Time)');
  const [language, setLanguage] = useState('es-ES (Español Internacional)');
  const [avatarPreview, setAvatarPreview] = useState('/images/profile/user-1.jpg');

  // Notifications State
  const [emailOrders, setEmailOrders] = useState(true);
  const [teamMentions, setTeamMentions] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [soundFeedback, setSoundFeedback] = useState(true);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [sessions, setSessions] = useState<ActiveSession[]>(initialSessions);

  // Invoices State
  const [invoices] = useState<InvoiceRecord[]>(initialInvoices);

  // Handlers
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    play('success');
    pillToast.success('Ajustes de Cuenta Guardados', 'Tus datos de perfil se sincronizaron en la nube.');
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    play('success');
    pillToast.success('Preferencias Actualizadas', 'Se guardaron las reglas de notificación.');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      play('alert');
      pillToast.error('Error de Contraseña', 'La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    if (newPassword.length < 8) {
      play('alert');
      pillToast.error('Contraseña Débil', 'La contraseña debe contener al menos 8 caracteres.');
      return;
    }

    play('success');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    pillToast.success('Contraseña Actualizada', 'Tu clave de seguridad fue cambiada con éxito.');
  };

  const handleRevokeSession = (sessionId: string) => {
    play('alert');
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    pillToast.info('Sesión Revocada', 'El dispositivo desconectado requerirá inicio de sesión.');
  };

  return (
    <div className="space-y-6">
      {/* Segmented Top Navigation for Settings */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-secondary/50 border border-border overflow-x-auto">
        {[
          { id: 'account', label: 'Datos de Cuenta' },
          { id: 'notifications', label: 'Notificaciones' },
          { id: 'billing', label: 'Facturación & Planes' },
          { id: 'security', label: 'Seguridad & Sesiones' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              play('tab');
              setActiveTab(tab.id as AccountSubTab);
            }}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer',
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: ACCOUNT DETAILS */}
      {activeTab === 'account' && (
        <form onSubmit={handleSaveAccount} className="space-y-6">
          {/* Avatar Upload Card */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold">Fotografía de Perfil & Avatar</CardTitle>
              <CardDescription className="text-xs">
                Visible en la navegación superior, directorios corporativos y registro de autoría
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="h-24 w-24 rounded-3xl overflow-hidden border-2 border-border bg-secondary shrink-0">
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-3 text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      soundType="click"
                      onClick={() => {
                        const randomIdx = Math.floor(1 + Math.random() * 12);
                        setAvatarPreview(`/images/profile/user-${randomIdx}.jpg`);
                        play('click');
                        pillToast.info('Nueva Foto Asignada', 'Previsualización actualizada.');
                      }}
                      className="text-xs gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Subir Nueva Foto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      soundType="click"
                      onClick={() => {
                        setAvatarPreview('/images/profile/user-1.jpg');
                        play('click');
                      }}
                      className="text-xs gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restablecer
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md">
                    Formatos admitidos: JPG, PNG o WEBP. Tamaño recomendado de 1000x1000 píxeles. Máximo 4 MB por archivo.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information Card */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold">Detalles Personales & Profesionales</CardTitle>
              <CardDescription className="text-xs">Actualiza tus credenciales y preferencias regionales</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-medium text-foreground block mb-1.5">Nombre Completo</label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="text-xs" />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1.5">Nombre de Usuario (@)</label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} className="text-xs font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-medium text-foreground block mb-1.5">Correo Corporativo</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} className="text-xs font-mono" />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1.5">Teléfono Directo</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="text-xs font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-medium text-foreground block mb-1.5">Departamento</label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} className="text-xs" />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1.5">Zona Horaria</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground cursor-pointer focus:outline-hidden"
                  >
                    <option value="GMT-07:00 (Pacific Time)">GMT-07:00 (Pacific Time)</option>
                    <option value="GMT-04:00 (La Paz / Santiago)">GMT-04:00 (La Paz / Santiago)</option>
                    <option value="GMT-05:00 (Bogotá / Lima)">GMT-05:00 (Bogotá / Lima)</option>
                    <option value="GMT+01:00 (Madrid / París)">GMT+01:00 (Madrid / París)</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1.5">Idioma del Sistema</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground cursor-pointer focus:outline-hidden"
                  >
                    <option value="es-ES (Español Internacional)">es-ES (Español Internacional)</option>
                    <option value="en-US (English US)">en-US (English US)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button type="submit" variant="default" size="sm" soundType="success" className="text-xs gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Guardar Cambios de Cuenta
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <form onSubmit={handleSaveNotifications} className="space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold">Canales & Reglas de Notificación</CardTitle>
              <CardDescription className="text-xs">
                Controla qué eventos disparan alertas por correo y retroalimentación acústica
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 divide-y divide-border/50 text-xs">
              <div className="py-4 first:pt-0 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-foreground">Alertas de Órdenes & Facturación</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Recibe un correo inmediato ante pagos completados, cobros fallidos o reembolsos de pasarela.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailOrders}
                  onChange={(e) => setEmailOrders(e.target.checked)}
                  className="h-4 w-4 accent-primary rounded-sm cursor-pointer"
                />
              </div>

              <div className="py-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-foreground">Menciones & Respuestas en el Feed</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Notificar cuando un colega te etiquete en una publicación o responda a un hilo de discusión.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={teamMentions}
                  onChange={(e) => setTeamMentions(e.target.checked)}
                  className="h-4 w-4 accent-primary rounded-sm cursor-pointer"
                />
              </div>

              <div className="py-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-foreground">Avisos de Seguridad de Cuenta</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Alertas prioritarias ante inicios de sesión desde nuevas IPs o cambios de contraseña.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={securityAlerts}
                  onChange={(e) => setSecurityAlerts(e.target.checked)}
                  className="h-4 w-4 accent-primary rounded-sm cursor-pointer"
                />
              </div>

              <div className="py-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-foreground">Resumen Semanal de Desempeño</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Reporte consolidado de analítica comercial y actividad de equipo cada lunes por la mañana.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={weeklyDigest}
                  onChange={(e) => setWeeklyDigest(e.target.checked)}
                  className="h-4 w-4 accent-primary rounded-sm cursor-pointer"
                />
              </div>

              <div className="py-4 last:pb-0 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-foreground">Retroalimentación Acústica (Web Audio API)</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Reproduce tonos de confirmación cuelume al presionar botones, cambiar pestañas o recibir toasts.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={soundFeedback}
                  onChange={(e) => setSoundFeedback(e.target.checked)}
                  className="h-4 w-4 accent-primary rounded-sm cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end">
            <Button type="submit" variant="default" size="sm" soundType="success" className="text-xs gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Guardar Preferencias de Alertas
            </Button>
          </div>
        </form>
      )}

      {/* TAB 3: BILLING & PLANS */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Centralized Billing Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20 text-xs">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-foreground">Suite Centralizada de Facturación & Cobros</span>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Gestiona pasarelas Stripe, cálculo impositivo, facturas oficiales en PDF y catálogo comercial B2B.
                </p>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                play('click');
                navigate({ to: '/pagos' });
              }}
              className="gap-1.5 text-xs rounded-xl shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Abrir Facturación & Pagos</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          {/* Active Plan Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <Card className="lg:col-span-8 border-border">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">Plan de Suscripción Activo</CardTitle>
                    <CardDescription className="text-xs">Licencia corporativa con soporte dedicado 24/7</CardDescription>
                  </div>
                  <Badge variant="blue" className="font-mono text-[10px]">Renovación Automática</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="font-mono text-2xl font-bold text-foreground tabular-nums block">
                      Blakor Enterprise Pro
                    </span>
                    <span className="text-xs text-muted-foreground">
                      $199.00 USD / mes • Próxima facturación el 01 Nov 2026
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    soundType="click"
                    onClick={() => {
                      play('click');
                      navigate({ to: '/licencias' });
                    }}
                    className="text-xs gap-1 cursor-pointer"
                  >
                    <span>Ver Planes & Licencias</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border/50 text-xs">
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                    <span className="text-muted-foreground block text-[11px]">Asientos Asignados</span>
                    <span className="font-mono font-bold text-foreground text-sm tabular-nums">12 / 50</span>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                    <span className="text-muted-foreground block text-[11px]">Consumo API Mensual</span>
                    <span className="font-mono font-bold text-foreground text-sm tabular-nums">184,200 req</span>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                    <span className="text-muted-foreground block text-[11px]">Almacenamiento Cloud</span>
                    <span className="font-mono font-bold text-foreground text-sm tabular-nums">18.4 GB / 1 TB</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method Card */}
            <Card className="lg:col-span-4 border-border">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold">Método de Pago Registrado</CardTitle>
                <CardDescription className="text-xs">Tarjeta de crédito para deducciones</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4 text-xs">
                <div className="p-4 rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase font-bold text-primary tracking-widest">
                      CORPORATE VISA
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono">Principal</Badge>
                  </div>
                  <div className="font-mono text-sm tracking-wider text-foreground font-semibold">
                    •••• •••• •••• 4242
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                    <span>Vence: 08/29</span>
                    <span>Mathew Anderson</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  soundType="click"
                  onClick={() => {
                    play('click');
                    pillToast.info('Actualizar Tarjeta', 'Formulario seguro Stripe Elements inicializado.');
                  }}
                  className="w-full text-xs"
                >
                  Cambiar Método de Pago
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Invoices History Table */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Historial de Recibos & Facturación</CardTitle>
                  <CardDescription className="text-xs">Descarga comprobantes fiscales en formato PDF</CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">4 Comprobantes</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-mono text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Factura</th>
                      <th className="py-2.5 px-3 font-medium">Fecha</th>
                      <th className="py-2.5 px-3 font-medium">Concepto</th>
                      <th className="py-2.5 px-3 font-medium text-right">Importe</th>
                      <th className="py-2.5 px-3 font-medium text-center">Estado</th>
                      <th className="py-2.5 px-4 font-medium text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-foreground">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground font-mono">
                          {inv.date}
                        </td>
                        <td className="py-3 px-3 text-foreground">
                          {inv.plan}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-foreground tabular-nums">
                          ${inv.amount.toFixed(2)} USD
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant="success" className="text-[10px] font-mono">
                            Pagado
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="iconSm"
                            soundType="click"
                            onClick={() => {
                              play('click');
                              pillToast.success('Descarga Iniciada', `Comprobante ${inv.invoiceNumber}.pdf descargado.`);
                            }}
                            title="Descargar PDF"
                          >
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: SECURITY & SESSIONS */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Password Change Form */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold">Actualizar Contraseña de Acceso</CardTitle>
              <CardDescription className="text-xs">
                Usa una frase de paso segura con al menos 8 caracteres y símbolos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1.5">Contraseña Actual</label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="text-xs font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-medium text-foreground block mb-1.5">Nueva Contraseña</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="text-xs font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-medium text-foreground block mb-1.5">Confirmar Nueva Contraseña</label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="text-xs font-mono"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" variant="default" size="sm" soundType="success" className="text-xs">
                  Modificar Clave
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication (2FA) */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Autenticación de Dos Factores (2FA)</CardTitle>
                  <CardDescription className="text-xs">
                    Capa adicional de verificación criptográfica mediante TOTP
                  </CardDescription>
                </div>
                <Badge
                  variant={twoFactorEnabled ? 'success' : 'secondary'}
                  className="font-mono text-[10px]"
                >
                  {twoFactorEnabled ? '2FA Habilitado' : 'Desactivado'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1 max-w-lg">
                <span className="font-semibold text-foreground block">
                  Aplicación Autenticadora (Apple Keychain / Google Authenticator / 1Password)
                </span>
                <p className="text-muted-foreground leading-relaxed text-[11px]">
                  Cada inicio de sesión desde un navegador desconocido requerirá un código de seguridad de 6 dígitos generado por tu app de autenticación vinculada.
                </p>
              </div>

              <Button
                variant={twoFactorEnabled ? 'outline' : 'default'}
                size="sm"
                soundType="pop"
                onClick={() => {
                  const nextState = !twoFactorEnabled;
                  setTwoFactorEnabled(nextState);
                  play(nextState ? 'success' : 'alert');
                  pillToast.info(
                    nextState ? '2FA Activado' : '2FA Desactivado',
                    nextState ? 'Tu cuenta ahora está protegida por TOTP.' : 'Se recomienda mantener 2FA activo.'
                  );
                }}
                className="text-xs shrink-0"
              >
                {twoFactorEnabled ? 'Desactivar 2FA' : 'Activar 2FA'}
              </Button>
            </CardContent>
          </Card>

          {/* Active Sessions List */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Dispositivos & Sesiones Activas</CardTitle>
                  <CardDescription className="text-xs">
                    Historial de terminales autorizadas actualmente en tu cuenta
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  soundType="alert"
                  onClick={() => {
                    play('alert');
                    setSessions(sessions.filter((s) => s.isCurrent));
                    pillToast.info('Sesiones Remotas Cerradas', 'Se desconectaron todos los demás equipos.');
                  }}
                  className="text-xs text-muted-foreground hover:text-red-500"
                >
                  Cerrar Otras Sesiones
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50 text-xs">
                {sessions.map((sess) => (
                  <div key={sess.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                        {sess.device.includes('iPhone') ? (
                          <Smartphone className="h-4 w-4" />
                        ) : (
                          <Laptop className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{sess.device}</span>
                          {sess.isCurrent && (
                            <Badge variant="outline" className="text-[9px] font-mono text-emerald-500 border-emerald-500/30">
                              Esta Terminal
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground block font-mono">
                          {sess.browser} • {sess.location}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 font-mono">
                          IP: {sess.ip} • {sess.lastActive}
                        </span>
                      </div>
                    </div>

                    {!sess.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        soundType="alert"
                        onClick={() => handleRevokeSession(sess.id)}
                        className="text-xs text-muted-foreground hover:text-red-500"
                      >
                        Revocar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
