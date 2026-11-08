import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/components/ui/card';

const endpoints: string[] = [
  "GET /api/v1/staff/servicios/solicitudes",
  "POST /api/v1/staff/servicios/solicitudes/{id}/cotizar",
  "POST /api/v1/staff/servicios/solicitudes/{id}/estado",
  "POST /api/v1/staff/servicios/proyectos/{id}/entregas",
];

export const ServiciosPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight">Servicios</h1>
        <p className="text-[15px] text-muted-foreground">Solicitudes por encargo: cotización, comprobantes, proyecto y entregas.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Pendiente de conexión</CardTitle>
          <CardDescription>Este módulo aún no consume la API.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground tabular-nums">
            {endpoints.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ServiciosPage;
