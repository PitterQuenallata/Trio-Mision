import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../shared/components/ui/card';
import { Spinner } from '../../../components/ui/ios-spinner';
import { gruposApi } from '../../../shared/api/domains/grupos';
import { discografiaApi } from '../../../shared/api/domains/discografia';
import { GrupoDatos } from '../components/grupo-datos';
import { GrupoConfiguracion } from '../components/grupo-configuracion';
import { DiscografiaGrid } from '../components/discografia-grid';
import { GrupoMiembros } from '../components/grupo-miembros';

type Pestana = 'datos' | 'configuracion' | 'albumes' | 'miembros';

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'datos', etiqueta: 'Datos' },
  { id: 'configuracion', etiqueta: 'Configuración' },
  { id: 'albumes', etiqueta: 'Discografía' },
  { id: 'miembros', etiqueta: 'Miembros' },
];

export const GrupoPage: React.FC<{ grupoId: string }> = ({ grupoId }) => {
  const [pestana, setPestana] = useState<Pestana>('datos');

  const grupo = useQuery({
    queryKey: ['grupo', grupoId],
    queryFn: () => gruposApi.obtener(grupoId),
  });
  const discografia = useQuery({
    queryKey: ['discografia', grupoId],
    queryFn: () => discografiaApi.obtener(grupoId),
    enabled: pestana === 'albumes',
  });

  if (grupo.isPending) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size="sm" /> Cargando grupo…</div>;
  }
  if (grupo.isError) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-400">No se pudo cargar el grupo.</p>
        <Link to="/grupos" className="text-sm underline">Volver a grupos</Link>
      </div>
    );
  }

  const g = grupo.data;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link to="/grupos" className="text-xs text-muted-foreground hover:underline">← Grupos</Link>

      <header className="flex flex-col gap-3 border-b border-border/40 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{g.nombre}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{g.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={g.publicado ? 'default' : 'secondary'}>{g.publicado ? 'Publicado' : 'Borrador'}</Badge>
          <Badge variant={g.vende_pistas ? 'default' : 'secondary'}>
            {g.vende_pistas ? `Vende pistas · ${g.comision_pct} %` : 'No vende pistas'}
          </Badge>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-border/40" role="tablist">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={
              'whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ' +
              (pestana === p.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {p.etiqueta}
          </button>
        ))}
      </nav>

      <Card className="rounded-2xl border-border/50 bg-card/70 p-5">
        {pestana === 'datos' && <GrupoDatos grupo={g} />}
        {pestana === 'configuracion' && <GrupoConfiguracion grupo={g} />}
        {pestana === 'albumes' &&
          (discografia.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size="sm" /> Cargando discografía…</div>
          ) : discografia.isError ? (
            <p role="alert" className="text-sm text-red-400">No se pudo cargar la discografía.</p>
          ) : (
            <DiscografiaGrid grupoId={g.id} albumes={discografia.data.albumes} />
          ))}
        {pestana === 'miembros' && <GrupoMiembros grupo={g} />}
      </Card>
    </div>
  );
};

export default GrupoPage;
