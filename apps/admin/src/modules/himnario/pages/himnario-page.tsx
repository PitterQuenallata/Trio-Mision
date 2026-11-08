import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/components/ui/card';

const endpoints: string[] = [
  "GET /api/v1/himnario/himnos",
  "GET /api/v1/himnario/himnos/{numero}",
];

export const HimnarioPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight">Himnario</h1>
        <p className="text-[15px] text-muted-foreground">Himnos de la colección, con sus versiones y acordes.</p>
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

export default HimnarioPage;
