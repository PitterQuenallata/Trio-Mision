"use client";

import React, { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Spinner } from './ios-spinner';
import { useSound } from '../../shared/context/sound-context';
import { Button } from '../../shared/components/ui/button';
import { cn } from '../../shared/lib/utils';

export interface LoginCardSectionProps {
  brandName?: string;
  /** Inicia sesión. Debe lanzar un Error con un mensaje legible si falla. */
  onLogin: (email: string, password: string) => Promise<void>;
  fullscreen?: boolean;
}

// Validación del formulario de login (solo UX: la API y GoTrue validan de verdad).
const validateEmail = (value: string): string | undefined => {
  const v = value.trim();
  if (!v) return 'Escribe tu correo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Correo no válido.';
  return undefined;
};

const validatePassword = (value: string): string | undefined =>
  value ? undefined : 'Escribe tu contraseña.';

export function LoginCardSection({
  brandName = 'Trio Misión',
  onLogin,
  fullscreen = false,
}: LoginCardSectionProps) {
  const { play } = useSound();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      play('click');
      setError(null);
      setSubmitting(true);
      try {
        await onLogin(value.email.trim(), value.password);
        play('success');
      } catch (err) {
        play('alert');
        setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (submitting) return;
    void form.handleSubmit();
  };

  return (
    <div
      className={cn(
        'w-full flex flex-col justify-between relative select-none overflow-hidden transition-colors',
        fullscreen
          ? 'min-h-screen bg-[#0A0A0C] text-[#EDEDED] p-4 sm:p-6 md:p-10'
          : 'min-h-[720px] rounded-3xl bg-[#0B0B0E] text-[#EDEDED] p-4 sm:p-6 md:p-8 border border-white/10'
      )}
    >
      {/* Background Geometric Maze / Labyrinth Lines */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Soft centered ambient bloom */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full bg-gradient-to-tr from-cyan-500/[0.04] via-white/[0.03] to-transparent blur-[140px]" />
        <div className="absolute top-1/4 left-1/4 w-[450px] h-[350px] rounded-full bg-blue-500/[0.025] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[350px] rounded-full bg-indigo-500/[0.025] blur-[120px]" />

        {/* Labyrinth Orthogonal Grid SVG */}
        <svg
          className="absolute inset-0 w-full h-full text-white"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Repeating Maze / Laberinto Pattern */}
            <pattern
              id="auth-maze-pattern"
              width="120"
              height="120"
              patternUnits="userSpaceOnUse"
            >
              {/* Orthogonal square maze corridors */}
              <path
                d="M 0 0 H 120 V 120 H 0 Z
                   M 15 15 H 45 V 45 H 15 Z
                   M 45 15 H 105 V 30 H 60 V 45 H 75 V 75 H 45 V 60 H 15 V 105 H 30 V 75 H 45
                   M 60 75 H 105 V 105 H 75 V 90 H 60 V 105 H 45
                   M 75 45 H 105 V 60 H 90 V 75
                   M 0 60 H 15 M 105 15 V 0 M 120 75 H 105 M 60 120 V 105"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeOpacity="0.08"
                strokeLinecap="square"
              />
              {/* Maze junction nodes / square dots */}
              <rect x="43" y="13" width="4" height="4" fill="currentColor" fillOpacity="0.18" />
              <rect x="73" y="43" width="4" height="4" fill="currentColor" fillOpacity="0.18" />
              <rect x="13" y="73" width="4" height="4" fill="currentColor" fillOpacity="0.18" />
              <rect x="88" y="58" width="4" height="4" fill="currentColor" fillOpacity="0.18" />
            </pattern>

            {/* Radial mask for soft fade */}
            <radialGradient id="auth-maze-radial" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.15" />
            </radialGradient>
            <mask id="auth-maze-mask">
              <rect width="100%" height="100%" fill="url(#auth-maze-radial)" />
            </mask>
          </defs>

          <rect
            width="100%"
            height="100%"
            fill="url(#auth-maze-pattern)"
            mask="url(#auth-maze-mask)"
          />
        </svg>

        {/* 4 Corner Labyrinth Architectural Circuits */}
        {/* Top-Left Corner Maze */}
        <svg
          className="absolute top-0 left-0 w-80 h-80 pointer-events-none text-white/30 overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 24 24 H 140 V 68 H 200 V 132 H 112 V 88 H 68 V 176 H 24 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeOpacity="0.3"
          />
          <path
            d="M 44 44 H 120 V 76 H 168 V 108"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
            strokeOpacity="0.25"
          />
          <rect x="22" y="22" width="4" height="4" fill="#06B6D4" fillOpacity="0.7" />
          <rect x="138" y="66" width="4" height="4" fill="currentColor" fillOpacity="0.5" />
          <rect x="198" y="130" width="4" height="4" fill="currentColor" fillOpacity="0.5" />
          <rect x="66" y="86" width="4" height="4" fill="#3B82F6" fillOpacity="0.7" />
        </svg>

        {/* Top-Right Corner Maze */}
        <svg
          className="absolute top-0 right-0 w-80 h-80 pointer-events-none text-white/30 overflow-visible -scale-x-100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 24 24 H 140 V 68 H 200 V 132 H 112 V 88 H 68 V 176 H 24 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeOpacity="0.3"
          />
          <path
            d="M 44 44 H 120 V 76 H 168 V 108"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
            strokeOpacity="0.25"
          />
          <rect x="22" y="22" width="4" height="4" fill="#06B6D4" fillOpacity="0.7" />
          <rect x="138" y="66" width="4" height="4" fill="currentColor" fillOpacity="0.5" />
          <rect x="198" y="130" width="4" height="4" fill="currentColor" fillOpacity="0.5" />
          <rect x="66" y="86" width="4" height="4" fill="#3B82F6" fillOpacity="0.7" />
        </svg>

        {/* Bottom-Left Corner Maze */}
        <svg
          className="absolute bottom-0 left-0 w-80 h-80 pointer-events-none text-white/30 overflow-visible -scale-y-100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 24 24 H 140 V 68 H 200 V 132 H 112 V 88 H 68 V 176 H 24 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeOpacity="0.3"
          />
          <path
            d="M 44 44 H 120 V 76 H 168 V 108"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
            strokeOpacity="0.25"
          />
          <rect x="22" y="22" width="4" height="4" fill="#06B6D4" fillOpacity="0.7" />
          <rect x="138" y="66" width="4" height="4" fill="currentColor" fillOpacity="0.5" />
          <rect x="198" y="130" width="4" height="4" fill="currentColor" fillOpacity="0.5" />
          <rect x="66" y="86" width="4" height="4" fill="#3B82F6" fillOpacity="0.7" />
        </svg>

        {/* Bottom-Right Corner Maze */}
        <svg
          className="absolute bottom-0 right-0 w-80 h-80 pointer-events-none text-white/30 overflow-visible -scale-x-100 -scale-y-100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 24 24 H 140 V 68 H 200 V 132 H 112 V 88 H 68 V 176 H 24 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeOpacity="0.3"
          />
          <path
            d="M 44 44 H 120 V 76 H 168 V 108"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
            strokeOpacity="0.25"
          />
          <rect x="22" y="22" width="4" height="4" fill="#06B6D4" fillOpacity="0.7" />
          <rect x="138" y="66" width="4" height="4" fill="currentColor" fillOpacity="0.5" />
          <rect x="198" y="130" width="4" height="4" fill="currentColor" fillOpacity="0.5" />
          <rect x="66" y="86" width="4" height="4" fill="#3B82F6" fillOpacity="0.7" />
        </svg>

        {/* Vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0A0C]/20 to-[#0A0A0C]/70 pointer-events-none" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 w-full flex items-center justify-between pb-6">
        <div className="font-bold tracking-widest text-sm text-white/90 font-mono flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span>{brandName}</span>
        </div>
      </header>

      {/* Center Floating iOS Card */}
      <main className="relative z-10 my-auto flex justify-center items-center py-6">
        <div className="w-full max-w-[420px] rounded-3xl bg-[#121215]/90 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 shadow-[0_24px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all">
          {/* Único formulario: inicio de sesión (sin registro). */}
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1.5 text-left">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Bienvenido de nuevo
                </h1>
                <p className="text-sm text-neutral-400">
                  Inicia sesión para entrar al panel
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <form.Field name="email" validators={{ onChange: ({ value }) => validateEmail(value) }}>
                  {(field) => (
                    <div className="space-y-1.5 text-left">
                      <label htmlFor="login-email" className="text-xs font-medium text-neutral-300">
                        Correo
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input
                          id="login-email"
                          type="email"
                          autoComplete="username"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          disabled={submitting}
                          placeholder="tu@correo.com"
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all disabled:opacity-50"
                        />
                      </div>
                      {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                        <p className="text-xs text-red-400">{String(field.state.meta.errors[0])}</p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name="password" validators={{ onChange: ({ value }) => validatePassword(value) }}>
                  {(field) => (
                    <div className="space-y-1.5 text-left">
                      <label htmlFor="login-password" className="text-xs font-medium text-neutral-300">
                        Contraseña
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          disabled={submitting}
                          placeholder="••••••••"
                          className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                        <p className="text-xs text-red-400">{String(field.state.meta.errors[0])}</p>
                      )}
                    </div>
                  )}
                </form.Field>

                {error && (
                  <p role="alert" className="text-xs text-red-400">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 active:scale-[0.98] transition-all cursor-pointer shadow-md mt-2 flex items-center justify-center gap-2"
                >
                  {submitting ? <Spinner size="sm" /> : <span>Entrar</span>}
                </Button>
              </form>
            </div>

        </div>
      </main>

      {/* Footer System Status */}
      <footer className="relative z-10 w-full flex items-center justify-center pt-6 text-[11px] text-neutral-500 font-mono border-t border-white/5">
        <span>Acceso restringido al personal autorizado</span>
      </footer>
    </div>
  );
}

export default LoginCardSection;
