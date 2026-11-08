"use client";

import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Spinner } from './ios-spinner';
import { pillToast } from '../../shared/components/ui/pill-toast';
import { useSound } from '../../shared/context/sound-context';
import { Button } from '../../shared/components/ui/button';
import { cn } from '../../shared/lib/utils';

export type AuthCardView =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-password'
  | 'two-factor';

export interface LoginCardSectionProps {
  initialView?: AuthCardView;
  brandName?: string;
  onSuccess?: (view: AuthCardView, data: any) => void;
  onNavigateHome?: () => void;
  fullscreen?: boolean;
}

// Brand SVG Icons
const GoogleIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.479,14.265v-3.279h11.049c0.108,0.571,0.164,1.247,0.164,1.979c0,2.46-0.672,5.502-2.84,7.669 C18.744,22.829,16.051,24,12.483,24C5.869,24,0.308,18.613,0.308,12S5.869,0,12.483,0c3.659,0,6.265,1.436,8.223,3.307L18.392,5.62 c-1.404-1.317-3.307-2.341-5.913-2.341C7.65,3.279,3.873,7.171,3.873,12s3.777,8.721,8.606,8.721c3.132,0,4.916-1.258,6.059-2.401 c0.927-0.927,1.537-2.251,1.777-4.059L12.479,14.265z" />
  </svg>
);

const GithubIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const AppleIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.06 1.72-.93 2.74 1.01.08 2.02-.49 2.64-1.24z" />
  </svg>
);

export function LoginCardSection({
  initialView = 'login',
  brandName = 'DALI',
  onSuccess,
  onNavigateHome,
  fullscreen = false,
}: LoginCardSectionProps) {
  const { play } = useSound();
  const [view, setView] = useState<AuthCardView>(initialView);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    // Auto focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    play('click');
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      play('success');

      if (view === 'login') {
        pillToast.success('Sesión iniciada', `Bienvenido de nuevo, ${email || 'usuario'}`);
        onSuccess?.('login', { email, rememberMe });
      } else if (view === 'register') {
        pillToast.success('Cuenta creada', 'Tu cuenta ha sido configurada con éxito.');
        onSuccess?.('register', { name, email });
      } else if (view === 'forgot-password') {
        pillToast.info('Correo enviado', 'Revisa tu bandeja con el enlace de recuperación.');
        setView('reset-password');
      } else if (view === 'reset-password') {
        pillToast.success('Contraseña actualizada', 'Ya puedes ingresar con tus nuevas credenciales.');
        setView('login');
      } else if (view === 'two-factor') {
        pillToast.success('Identidad verificada', 'Código 2FA confirmado correctamente.');
        onSuccess?.('two-factor', { otp: otp.join('') });
      }
    }, 900);
  };

  const handleSocialLogin = (provider: 'Google' | 'GitHub' | 'Apple') => {
    play('click');
    pillToast.info(`Conectando con ${provider}`, 'Iniciando autenticación federada segura...');
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
        <div
          onClick={() => {
            play('tab');
            onNavigateHome?.();
          }}
          className="cursor-pointer font-bold tracking-widest text-sm text-white/90 hover:text-white transition-colors font-mono flex items-center gap-2"
        >
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span>{brandName}</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            play('click');
            pillToast.info('Mesa de Ayuda Blakor', 'Soporte y documentación oficial disponibles 24/7.');
          }}
          className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-xs text-white/80 hover:text-white transition-all cursor-pointer"
        >
          <span>Contact</span>
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </header>

      {/* Center Floating iOS Card */}
      <main className="relative z-10 my-auto flex justify-center items-center py-6">
        <div className="w-full max-w-[420px] rounded-3xl bg-[#121215]/90 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 shadow-[0_24px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all">
          
          {/* VIEW: 1. LOGIN */}
          {view === 'login' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1.5 text-left">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Welcome back
                </h1>
                <p className="text-sm text-neutral-400">
                  Sign in to your account
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-medium text-neutral-300">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-medium text-neutral-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded-md border-white/20 bg-neutral-900 text-primary accent-primary cursor-pointer"
                    />
                    <span className="text-xs text-neutral-400">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      play('tab');
                      setView('forgot-password');
                    }}
                    className="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 active:scale-[0.98] transition-all cursor-pointer shadow-md mt-2 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Spinner size="sm" /> : <span>Continue</span>}
                </Button>
              </form>

              {/* Social Login Options */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                  <span className="bg-[#121215] px-2 text-neutral-500">OR</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('GitHub')}
                  className="h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-neutral-300 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <GithubIcon className="h-4 w-4" />
                  <span>GitHub</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('Google')}
                  className="h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-neutral-300 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <GoogleIcon className="h-4 w-4" />
                  <span>Google</span>
                </button>
              </div>

              <div className="pt-2 text-center text-xs text-neutral-400">
                <span>Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    play('tab');
                    setView('register');
                  }}
                  className="text-white font-medium hover:underline cursor-pointer"
                >
                  Create one
                </button>
              </div>
            </div>
          )}

          {/* VIEW: 2. REGISTER */}
          {view === 'register' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1.5 text-left">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Create an account
                </h1>
                <p className="text-sm text-neutral-400">
                  Join Blakor Pro platform today
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-medium text-neutral-300">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Daniels"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-medium text-neutral-300">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-medium text-neutral-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                    className="h-4 w-4 mt-0.5 rounded-md border-white/20 bg-neutral-900 text-primary accent-primary cursor-pointer"
                  />
                  <span className="text-[11px] text-neutral-400 leading-tight">
                    I agree to the Terms of Service and Privacy Policy
                  </span>
                </label>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 active:scale-[0.98] transition-all cursor-pointer shadow-md mt-2 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Spinner size="sm" /> : <span>Create Account</span>}
                </Button>
              </form>

              <div className="pt-1 text-center text-xs text-neutral-400">
                <span>Already have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    play('tab');
                    setView('login');
                  }}
                  className="text-white font-medium hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {/* VIEW: 3. FORGOT PASSWORD */}
          {view === 'forgot-password' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1.5 text-left">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Reset password
                </h1>
                <p className="text-sm text-neutral-400">
                  Enter your email to receive recovery instructions.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-medium text-neutral-300">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 active:scale-[0.98] transition-all cursor-pointer shadow-md mt-2 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Spinner size="sm" /> : <span>Send Recovery Link</span>}
                </Button>
              </form>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    play('tab');
                    setView('login');
                  }}
                  className="text-xs text-neutral-400 hover:text-white flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Back to login</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW: 4. RESET PASSWORD */}
          {view === 'reset-password' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1.5 text-left">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Set new password
                </h1>
                <p className="text-sm text-neutral-400">
                  Choose a secure password for your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-medium text-neutral-300">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-medium text-neutral-300">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 active:scale-[0.98] transition-all cursor-pointer shadow-md mt-2 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Spinner size="sm" /> : <span>Update Password</span>}
                </Button>
              </form>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    play('tab');
                    setView('login');
                  }}
                  className="text-xs text-neutral-400 hover:text-white flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Back to login</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW: 5. TWO-FACTOR AUTH (2FA) */}
          {view === 'two-factor' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1.5 text-left">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-2">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Two-factor auth
                </h1>
                <p className="text-sm text-neutral-400">
                  Enter the 6-digit code sent to your authenticator app.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex justify-between gap-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-input-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-12 h-13 rounded-xl bg-[#0D0D10] border border-white/10 text-center font-mono font-bold text-lg text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all tabular-nums"
                    />
                  ))}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || otp.some((d) => !d)}
                  className="w-full h-11 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  {isLoading ? <Spinner size="sm" /> : <span>Verify Code</span>}
                </Button>
              </form>

              <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    play('pop');
                    pillToast.info('Código reenviado', 'Se ha enviado un nuevo código SMS o push.');
                  }}
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Resend code</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    play('tab');
                    setView('login');
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Back to login
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer System Status */}
      <footer className="relative z-10 w-full flex items-center justify-between pt-6 text-[11px] text-neutral-500 font-mono border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Systems Normal</span>
        </div>
        <span>Encrypted with TLS 1.3</span>
      </footer>
    </div>
  );
}

export default LoginCardSection;
