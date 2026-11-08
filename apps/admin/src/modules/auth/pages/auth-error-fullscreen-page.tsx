import React from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { ErrorPage, ErrorCode } from '../../../components/ui/error-page';

interface AuthErrorFullscreenPageProps {
  forcedCode?: ErrorCode;
}

export const AuthErrorFullscreenPage: React.FC<AuthErrorFullscreenPageProps> = ({ forcedCode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine code from prop, path or query
  const determineCode = (): ErrorCode => {
    if (forcedCode) return forcedCode;
    const path = location.pathname.toLowerCase();
    if (path.includes('505')) return '505';
    if (path.includes('500')) return '500';
    if (path.includes('403')) return '403';
    return '404';
  };

  const code = determineCode();

  return (
    <div className="w-full min-h-screen bg-[#0A0A0A]">
      <ErrorPage
        code={code}
        fullscreen
        showSwitcher
        onGoHome={() => navigate({ to: '/' })}
        onExplore={() => navigate({ to: '/dashboard' })}
        onBack={() => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            navigate({ to: '/dashboard' });
          }
        }}
      />
    </div>
  );
};

export default AuthErrorFullscreenPage;
