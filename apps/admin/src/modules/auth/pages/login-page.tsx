import React from 'react';
import { Navigate } from '@tanstack/react-router';
import { LoginCardSection } from '../../../components/ui/login-signup';
import { useAuth } from '../../../shared/auth/auth-context';

// Solo inicio de sesión: el panel no tiene registro. Las cuentas las crea un admin.
export const LoginPage: React.FC = () => {
  const { status, signIn } = useAuth();

  if (status === 'loading') {
    return null;
  }
  if (status === 'authenticated') {
    return <Navigate to="/" />;
  }

  return <LoginCardSection fullscreen onLogin={signIn} />;
};

export default LoginPage;
