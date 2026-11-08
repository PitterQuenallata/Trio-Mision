import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/components/ui/card';

const endpoints: string[] = [
  "GET /api/v1/mis-artistas",
  "GET /api/v1/mis-artistas/{artistId}",
  "GET /api/v1/mis-artistas/{artistId}/canciones/{songId}",
  "POST /api/v1/mis-artistas/{artistId}/pistas/{trackId}/master (manager)",
];

export const CatalogoPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight">Artistas y catálogo</h1>
        <p className="text-[15px] text-muted-foreground">Álbumes, canciones y ChordPro de los artistas que administras.</p>
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

export default CatalogoPage;
