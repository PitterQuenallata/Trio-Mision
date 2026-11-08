"use client";

import React, { useState } from 'react';
import { Home, Compass, RotateCcw, ArrowLeft, ShieldAlert, ServerCrash, FileQuestion } from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import { useSound } from '../../shared/context/sound-context';

export type ErrorCode = '404' | '500' | '505' | '403';

export interface ErrorPageProps {
  code?: ErrorCode | string;
  title?: string;
  description?: string;
  onGoHome?: () => void;
  onExplore?: () => void;
  onRetry?: () => void;
  onBack?: () => void;
  fullscreen?: boolean;
  className?: string;
  showSwitcher?: boolean;
  onCodeChange?: (newCode: ErrorCode) => void;
}

const ERROR_CONFIG: Record<string, { title: string; description: string; hint: string }> = {
  '404': {
    title: 'Page Not Found',
    description: "The page you're looking for might have been moved or doesn't exist.",
    hint: 'Ruta no encontrada o enlace desactualizado.',
  },
  '500': {
    title: 'Internal Server Error',
    description: "Something went wrong on our servers. We're actively looking into it.",
    hint: 'Error interno en el procesamiento del servidor.',
  },
  '505': {
    title: 'HTTP Version Not Supported',
    description: 'The server does not support the HTTP protocol version used in the request.',
    hint: 'Protocolo de red no soportado por el gateway.',
  },
  '403': {
    title: 'Access Forbidden',
    description: "You don't have authorization or permission to access this secure zone.",
    hint: 'Permisos insuficientes en las políticas RBAC.',
  },
};

export const ErrorPage: React.FC<ErrorPageProps> = ({
  code = '404',
  title,
  description,
  onGoHome,
  onExplore,
  onRetry,
  onBack,
  fullscreen = false,
  className,
  showSwitcher = false,
  onCodeChange,
}) => {
  const { play } = useSound();
  const [currentCode, setCurrentCode] = useState<ErrorCode>(
    (code as ErrorCode) || '404'
  );

  const activeConfig = ERROR_CONFIG[currentCode] || ERROR_CONFIG['404'];
  const finalDescription = description || activeConfig.description;

  const handleSelectCode = (newCode: ErrorCode) => {
    play('tab');
    setCurrentCode(newCode);
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  };

  const handleGoHome = () => {
    play('click');
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.hash = '#/';
    }
  };

  const handleExplore = () => {
    play('click');
    if (onExplore) {
      onExplore();
    } else {
      window.location.hash = '#/dashboard';
    }
  };

  const handleRetry = () => {
    play('pop');
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleBack = () => {
    play('click');
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center w-full select-none overflow-hidden font-sans',
        'bg-[#0A0A0A] text-white',
        fullscreen ? 'min-h-screen px-4 py-12' : 'min-h-[520px] p-8 rounded-3xl border border-white/10',
        className
      )}
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.035) 0%, transparent 65%),
          radial-gradient(circle at 50% 90%, rgba(0, 0, 0, 0.8) 0%, #0A0A0A 100%)
        `,
      }}
    >
      {/* Optional Top Floating Navigation / Switcher Bar */}
      {showSwitcher && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
          {(['404', '505', '500', '403'] as ErrorCode[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleSelectCode(c)}
              className={cn(
                'px-3 py-1 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer',
                currentCode === c
                  ? 'bg-white text-black shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              )}
            >
              HTTP {c}
            </button>
          ))}
        </div>
      )}

      {/* Main Content Card */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
        {/* Giant Apple Number with Vertical Specular Gradient */}
        <h1
          className="text-8xl sm:text-9xl md:text-[144px] font-black tracking-tighter leading-none"
          style={{
            background:
              'linear-gradient(180deg, #FFFFFF 12%, rgba(255, 255, 255, 0.72) 48%, rgba(255, 255, 255, 0.08) 96%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {currentCode}
        </h1>

        {/* Subtitle Message */}
        <p className="mt-4 text-sm sm:text-base text-zinc-400 font-normal max-w-md leading-relaxed tracking-normal">
          {finalDescription}
        </p>

        {/* Action Buttons Matching Screenshot */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          {/* Primary Action: Go Home */}
          <button
            type="button"
            onClick={handleGoHome}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#E4E4E7] text-[#0A0A0A] hover:bg-white active:scale-[0.98] transition-all duration-150 shadow-xs cursor-pointer"
          >
            <Home className="w-4 h-4 stroke-[2.2]" />
            <span>Go Home</span>
          </button>

          {/* Secondary Action: Explore */}
          <button
            type="button"
            onClick={handleExplore}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 active:scale-[0.98] backdrop-blur-md transition-all duration-150 cursor-pointer"
          >
            <Compass className="w-4 h-4 stroke-[2.2]" />
            <span>Explore</span>
          </button>

          {/* Retry Button for 500 / 505 Server Errors */}
          {(currentCode === '500' || currentCode === '505') && (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] hover:bg-white/[0.09] text-zinc-300 border border-white/10 active:scale-[0.98] backdrop-blur-md transition-all duration-150 cursor-pointer"
              title="Volver a intentar"
            >
              <RotateCcw className="w-4 h-4 stroke-[2]" />
              <span className="hidden sm:inline">Retry</span>
            </button>
          )}

          {/* Back Action if requested */}
          {fullscreen && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
        </div>

        {/* Subtle Tech Badge Footer */}
        <div className="mt-12 flex items-center gap-2 text-[11px] font-mono text-zinc-600">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
          <span>Blakor OS / HTTP Status Engine</span>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
