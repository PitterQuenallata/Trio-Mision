"use client";

import React, { useState } from 'react';
import {
  ChevronLeft,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Spinner } from './ios-spinner';
import { Button } from '../../shared/components/ui/button';
import { pillToast } from '../../shared/components/ui/pill-toast';
import { useSound } from '../../shared/context/sound-context';
import { cn } from '../../shared/lib/utils';

export type SplitAuthView =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-password'
  | 'two-factor';

export interface AuthPageProps {
  initialView?: SplitAuthView;
  brandName?: string;
  quoteText?: string;
  quoteAuthor?: string;
  onSuccess?: (view: SplitAuthView, data: any) => void;
  onNavigateHome?: () => void;
  fullscreen?: boolean;
}

// Social Brand SVG Icons
const GoogleIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.479,14.265v-3.279h11.049c0.108,0.571,0.164,1.247,0.164,1.979c0,2.46-0.672,5.502-2.84,7.669 C18.744,22.829,16.051,24,12.483,24C5.869,24,0.308,18.613,0.308,12S5.869,0,12.483,0c3.659,0,6.265,1.436,8.223,3.307L18.392,5.62 c-1.404-1.317-3.307-2.341-5.913-2.341C7.65,3.279,3.873,7.171,3.873,12s3.777,8.721,8.606,8.721c3.132,0,4.916-1.258,6.059-2.401 c0.927-0.927,1.537-2.251,1.777-4.059L12.479,14.265z" />
  </svg>
);

const AppleIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.06 1.72-.93 2.74 1.01.08 2.02-.49 2.64-1.24z" />
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

// Curved Flow Waves matching Image 2
const CurvedWaveBackground = () => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none opacity-40 select-none overflow-hidden"
    viewBox="0 0 600 800"
    preserveAspectRatio="none"
    fill="none"
  >
    <path
      d="M-50 420 C 150 480, 220 560, 520 620"
      stroke="rgba(255,255,255,0.18)"
      strokeWidth="1.2"
    />
    <path
      d="M-50 440 C 140 500, 240 590, 500 645"
      stroke="rgba(255,255,255,0.15)"
      strokeWidth="1.2"
    />
    <path
      d="M-50 460 C 130 520, 260 620, 480 670"
      stroke="rgba(255,255,255,0.12)"
      strokeWidth="1.2"
    />
    <path
      d="M-50 480 C 120 540, 280 650, 460 695"
      stroke="rgba(255,255,255,0.09)"
      strokeWidth="1.2"
    />
    <path
      d="M-50 500 C 110 560, 300 680, 440 720"
      stroke="rgba(255,255,255,0.06)"
      strokeWidth="1.2"
    />
    <path
      d="M-50 520 C 100 580, 320 710, 420 745"
      stroke="rgba(255,255,255,0.04)"
      strokeWidth="1.2"
    />
    {/* Secondary cross curves */}
    <path
      d="M-20 380 C 180 430, 280 490, 560 580"
      stroke="rgba(255,255,255,0.2)"
      strokeWidth="1.5"
    />
    <path
      d="M-30 360 C 190 410, 300 460, 580 550"
      stroke="rgba(255,255,255,0.15)"
      strokeWidth="1.2"
    />
    <path
      d="M-40 340 C 200 390, 320 430, 600 520"
      stroke="rgba(255,255,255,0.1)"
      strokeWidth="1"
    />
  </svg>
);

export function AuthPage({
  initialView = 'login',
  brandName = 'Asme',
  quoteText = '“This Platform has helped me to save time and serve my clients faster than ever before.”',
  quoteAuthor = '~ Ali Hassan',
  onSuccess,
  onNavigateHome,
  fullscreen = false,
}: AuthPageProps) {
  const { play } = useSound();
  const [view, setView] = useState<SplitAuthView>(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    if (val && index < 5) {
      document.getElementById(`split-otp-${index + 1}`)?.focus();
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
        pillToast.success('Bienvenido', `Accediendo a la cuenta de ${email || 'usuario'}`);
        onSuccess?.('login', { email });
      } else if (view === 'register') {
        pillToast.success('Registro exitoso', 'Tu cuenta ha sido creada correctamente.');
        onSuccess?.('register', { name, email });
      } else if (view === 'forgot-password') {
        pillToast.info('Instrucciones enviadas', 'Revisa tu correo electrónico para restablecer la contraseña.');
        setView('reset-password');
      } else if (view === 'reset-password') {
        pillToast.success('Contraseña actualizada', 'Puedes ingresar con tu nueva clave de acceso.');
        setView('login');
      } else if (view === 'two-factor') {
        pillToast.success('Código 2FA validado', 'Acceso seguro verificado.');
        onSuccess?.('two-factor', { otp: otp.join('') });
      }
    }, 900);
  };

  const handleSocialClick = (provider: 'Google' | 'Apple' | 'GitHub') => {
    play('click');
    pillToast.info(`Autenticando con ${provider}`, 'Redirigiendo a la pasarela de autenticación OAuth segura...');
  };

  return (
    <div
      className={cn(
        'w-full grid lg:grid-cols-2 relative select-none overflow-hidden transition-colors',
        fullscreen
          ? 'min-h-screen bg-[#070709] text-white'
          : 'min-h-[740px] rounded-3xl bg-[#070709] text-white border border-white/10'
      )}
    >
      {/* ========================================================= */}
      {/* LEFT COLUMN: HERO SHOWCASE (Brand, Wavy Lines, Quote)     */}
      {/* ========================================================= */}
      <div className="hidden lg:flex flex-col justify-between p-10 xl:p-14 bg-[#0A0A0D] border-r border-white/10 relative overflow-hidden">
        {/* Dynamic Curved Flow Lines */}
        <CurvedWaveBackground />

        {/* Ambient glow in corner */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/[0.02] blur-3xl pointer-events-none" />

        {/* Top: Logo & Brand */}
        <div
          onClick={() => {
            play('tab');
            onNavigateHome?.();
          }}
          className="relative z-10 flex items-center gap-3 cursor-pointer group w-fit"
        >
          <div className="h-8 w-8 rounded-xl bg-white/10 border border-white/15 text-white flex items-center justify-center transition-transform group-hover:scale-105">
            <Layers className="h-4 w-4" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white/90 group-hover:text-white transition-colors">
            {brandName}
          </span>
        </div>

        {/* Bottom: Testimonial Quote */}
        <div className="relative z-10 max-w-md space-y-3 pt-24">
          <p className="text-xl xl:text-2xl font-normal leading-relaxed text-neutral-200 tracking-tight">
            {quoteText}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-neutral-400">
              {quoteAuthor}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT COLUMN: AUTH ACTIONS (Efferd 21st.dev Style)        */}
      {/* ========================================================= */}
      <div className="flex flex-col justify-between p-6 sm:p-10 xl:p-14 bg-[#000000] relative">
        {/* Top: < Home Link */}
        <div className="w-full flex items-center justify-between pb-6">
          <button
            type="button"
            onClick={() => {
              play('tab');
              onNavigateHome?.();
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer group"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Home</span>
          </button>

          {/* Quick Subpage switcher pill in demo */}
          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            {view !== 'two-factor' && (
              <button
                type="button"
                onClick={() => {
                  play('tab');
                  setView('two-factor');
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                2FA Demo
              </button>
            )}
          </div>
        </div>

        {/* Center Container */}
        <div className="my-auto mx-auto w-full max-w-[380px] space-y-6">
          
          {/* VIEW: 1. LOGIN / JOIN */}
          {view === 'login' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1 text-left">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Sign In or Join Now!
                </h1>
                <p className="text-sm text-neutral-400">
                  login or create your {brandName.toLowerCase()} account.
                </p>
              </div>

              {/* 3 Stacked Large Social Buttons matching Image 2 */}
              <div className="space-y-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSocialClick('Google')}
                  className="w-full h-11 rounded-xl bg-[#E8E8E8] text-black hover:bg-white active:scale-[0.99] font-medium text-sm flex items-center justify-center gap-2.5 transition-all border-0 shadow-xs cursor-pointer"
                >
                  <GoogleIcon className="h-4 w-4" />
                  <span>Continue with Google</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSocialClick('Apple')}
                  className="w-full h-11 rounded-xl bg-[#E8E8E8] text-black hover:bg-white active:scale-[0.99] font-medium text-sm flex items-center justify-center gap-2.5 transition-all border-0 shadow-xs cursor-pointer"
                >
                  <AppleIcon className="h-4 w-4" />
                  <span>Continue with Apple</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSocialClick('GitHub')}
                  className="w-full h-11 rounded-xl bg-[#E8E8E8] text-black hover:bg-white active:scale-[0.99] font-medium text-sm flex items-center justify-center gap-2.5 transition-all border-0 shadow-xs cursor-pointer"
                >
                  <GithubIcon className="h-4 w-4" />
                  <span>Continue with GitHub</span>
                </Button>
              </div>

              {/* Divider OR */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                  <span className="bg-[#000000] px-2 text-neutral-500">OR</span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-normal text-neutral-400">
                    Enter your email address to sign in or create an account
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-mono">
                      @
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full h-11 pl-9 pr-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      play('tab');
                      setView('forgot-password');
                    }}
                    className="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-[#E8E8E8] text-black font-semibold text-sm hover:bg-white active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 border-0"
                >
                  {isLoading ? <Spinner size="sm" /> : <span>Continue With Email</span>}
                </Button>
              </form>

              {/* Footer Terms */}
              <p className="text-[11px] leading-relaxed text-neutral-500 text-left pt-2">
                By clicking continue, you agree to our{' '}
                <a href="#/terms" className="underline underline-offset-4 hover:text-neutral-300">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#/privacy" className="underline underline-offset-4 hover:text-neutral-300">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          )}

          {/* VIEW: 2. REGISTER / CREATE ACCOUNT */}
          {view === 'register' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1 text-left">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Create your account
                </h1>
                <p className="text-sm text-neutral-400">
                  Start your enterprise journey with {brandName}.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-normal text-neutral-400">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-normal text-neutral-400">Work Email</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-mono">@</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full h-11 pl-9 pr-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-normal text-neutral-400">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all font-sans"
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

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-[#E8E8E8] text-black font-semibold text-sm hover:bg-white active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 border-0 mt-2"
                >
                  {isLoading ? <Spinner size="sm" /> : <span>Create Account</span>}
                </Button>
              </form>

              <div className="text-center text-xs text-neutral-400 pt-1">
                <span>¿Ya tienes cuenta? </span>
                <button
                  type="button"
                  onClick={() => {
                    play('tab');
                    setView('login');
                  }}
                  className="text-white font-medium hover:underline cursor-pointer"
                >
                  Iniciar sesión
                </button>
              </div>
            </div>
          )}

          {/* VIEW: 3. FORGOT PASSWORD */}
          {view === 'forgot-password' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1 text-left">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Recover password
                </h1>
                <p className="text-sm text-neutral-400">
                  Enter your verified email to receive instructions.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-normal text-neutral-400">Account Email</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-mono">@</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full h-11 pl-9 pr-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-[#E8E8E8] text-black font-semibold text-sm hover:bg-white active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 border-0"
                >
                  {isLoading ? <Spinner size="sm" /> : <span>Send Reset Instructions</span>}
                </Button>
              </form>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    play('tab');
                    setView('login');
                  }}
                  className="text-xs text-neutral-400 hover:text-white flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Volver a iniciar sesión</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW: 4. RESET PASSWORD */}
          {view === 'reset-password' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1 text-left">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Set new password
                </h1>
                <p className="text-sm text-neutral-400">
                  Update your security credentials below.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-normal text-neutral-400">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-normal text-neutral-400">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#0D0D10] border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-[#E8E8E8] text-black font-semibold text-sm hover:bg-white active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 border-0"
                >
                  {isLoading ? <Spinner size="sm" /> : <span>Save New Password</span>}
                </Button>
              </form>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    play('tab');
                    setView('login');
                  }}
                  className="text-xs text-neutral-400 hover:text-white flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Volver</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW: 5. TWO-FACTOR AUTH */}
          {view === 'two-factor' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1 text-left">
                <div className="h-9 w-9 rounded-xl bg-white/10 text-white border border-white/15 flex items-center justify-center mb-2">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Two-step verification
                </h1>
                <p className="text-sm text-neutral-400">
                  Enter the 6-digit code from your authenticator device.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex justify-between gap-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`split-otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      className="w-11 h-12 rounded-xl bg-[#0D0D10] border border-white/10 text-center font-mono font-bold text-lg text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all tabular-nums"
                    />
                  ))}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || otp.some((d) => !d)}
                  className="w-full h-11 rounded-xl bg-[#E8E8E8] text-black font-semibold text-sm hover:bg-white active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 border-0"
                >
                  {isLoading ? <Spinner size="sm" /> : <span>Verify Security Code</span>}
                </Button>
              </form>

              <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    play('pop');
                    pillToast.info('Código reenviado', 'Nuevo código de verificación enviado.');
                  }}
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Reenviar código</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    play('tab');
                    setView('login');
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Volver al login
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Bottom System Status */}
        <div className="w-full flex items-center justify-between text-[11px] text-neutral-500 font-mono border-t border-white/5 pt-4">
          <span>Enterprise SSO Ready</span>
          <span>SOC-2 Type II Certified</span>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
