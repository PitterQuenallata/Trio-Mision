import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/components/ui/card';

export const LoginPage: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Acceso para staff, managers y members de Trio Misión.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground">
            Pendiente: el inicio de sesión con GoTrue se conecta en el siguiente paso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
