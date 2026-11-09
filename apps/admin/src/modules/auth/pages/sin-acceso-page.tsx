import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { useAuth } from '../../../shared/auth/auth-context';

interface SinAccesoPageProps {
  /** 'panel': la cuenta no tiene ningún rol. 'ruta': el rol no alcanza esta sección. */
  variant: 'panel' | 'ruta';
}

export const SinAccesoPage: React.FC<SinAccesoPageProps> = ({ variant }) => {
  const { signOut } = useAuth();
  const panel = variant === 'panel';

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{panel ? 'Sin acceso al panel' : 'Sección no disponible'}</CardTitle>
          <CardDescription>
            {panel
              ? 'Tu cuenta no tiene un rol de staff ni membresía de artista. Pide a un administrador que te asigne acceso.'
              : 'Tu rol no permite ver esta sección.'}
          </CardDescription>
        </CardHeader>
        {panel && (
          <CardContent>
            <Button variant="outline" onClick={() => void signOut()}>
              Cerrar sesión
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default SinAccesoPage;
