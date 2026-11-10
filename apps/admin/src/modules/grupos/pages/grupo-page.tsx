import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../shared/components/ui/card';
import { Spinner } from '../../../components/ui/ios-spinner';
import { gruposApi } from '../../../shared/api/domains/grupos';
import { artistasApi } from '../../../shared/api/domains/artistas';
import { discografiaApi } from '../../../shared/api/domains/discografia';
import { GrupoDatos } from '../components/grupo-datos';
import { GrupoConfiguracion } from '../components/grupo-configuracion';
import { DiscografiaGrid } from '../components/discografia-grid';
import { GrupoMiembros } from '../components/grupo-miembros';

type Pestana = 'datos' | 'configuracion' | 'albumes' | 'miembros';

/** `admin` gestiona el grupo desde /grupos; `manager` solo su ficha y discografía desde /mi-grupo. */
export type ModoGrupo = 'admin' | 'manager';

const PESTANAS_ADMIN: { id: Pestana; etiqueta: string }[] = [
  { id: 'datos', etiqueta: 'Datos' },
  { id: 'configuracion', etiqueta: 'Configuración' },
  { id: 'albumes', etiqueta: 'Discografía' },
  { id: 'miembros', etiqueta: 'Miembros' },
];

const PESTANAS_MANAGER: { id: Pestana; etiqueta: string }[] = [
  { id: 'datos', etiqueta: 'Datos' },
  { id: 'albumes', etiqueta: 'Discografía' },
];

export const GrupoPage: React.FC<{ grupoId: string; modo?: ModoGrupo }> = ({ grupoId, modo = 'admin' }) => {
  const [pestana, setPestana] = useState<Pestana>('datos');
  const esManager = modo === 'manager';
  const pestanas = esManager ? PESTANAS_MANAGER : PESTANAS_ADMIN;
  const volverHref = esManager ? '/mi-grupo' : '/grupos';

  // Admin: detalle completo de staff. Manager: ficha de su artista (sin estado de publicación).
  const grupo = useQuery({
    queryKey: ['grupo', grupoId],
    queryFn: () => gruposApi.obtener(grupoId),
    enabled: !esManager,
  });
  const ficha = useQuery({
    queryKey: ['mis-artistas', grupoId],
    queryFn: () => artistasApi.obtenerMio(grupoId),
    enabled: esManager,
  });
  // La discografía se carga al abrir su pestaña; el manager la necesita también para la cabecera.
  const discografia = useQuery({
    queryKey: ['discografia', grupoId],
    queryFn: () => discografiaApi.obtener(grupoId),
    enabled: pestana === 'albumes' || esManager,
  });

  const principal = esManager ? ficha : grupo;
  if (principal.isPending) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size="sm" /> Cargando grupo…</div>;
  }
  if (principal.isError) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-400">No se pudo cargar el grupo.</p>
        <Link to={esManager ? '/mi-grupo' : '/grupos'} className="text-sm underline">
          {esManager ? 'Volver a mi grupo' : 'Volver a grupos'}
        </Link>
      </div>
    );
  }

  // Cabecera común: el manager no tiene estado de publicación en su ficha.
  const cabecera = esManager
    ? { nombre: ficha.data!.nombre, slug: ficha.data!.slug, publicado: undefined, vendePistas: discografia.data?.vende_pistas, comision: undefined }
    : { nombre: grupo.data!.nombre, slug: grupo.data!.slug, publicado: grupo.data!.publicado, vendePistas: grupo.data!.vende_pistas, comision: grupo.data!.comision_pct };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link to={volverHref} className="text-xs text-muted-foreground hover:underline">
        {esManager ? '← Mi grupo' : '← Grupos'}
      </Link>

      <header className="flex flex-col gap-3 border-b border-border/40 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{cabecera.nombre}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{cabecera.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {cabecera.publicado !== undefined && (
            <Badge variant={cabecera.publicado ? 'default' : 'secondary'}>{cabecera.publicado ? 'Publicado' : 'Borrador'}</Badge>
          )}
          {cabecera.vendePistas !== undefined && (
            <Badge variant={cabecera.vendePistas ? 'default' : 'secondary'}>
              {cabecera.vendePistas
                ? cabecera.comision !== undefined ? `Vende pistas · ${cabecera.comision} %` : 'Vende pistas'
                : 'No vende pistas'}
            </Badge>
          )}
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-border/40" role="tablist">
        {pestanas.map((p) => (
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
        {pestana === 'datos' && (esManager ? <GrupoDatos grupo={ficha.data!} modo="manager" /> : <GrupoDatos grupo={grupo.data!} />)}
        {pestana === 'configuracion' && !esManager && <GrupoConfiguracion grupo={grupo.data!} />}
        {pestana === 'albumes' &&
          (discografia.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size="sm" /> Cargando discografía…</div>
          ) : discografia.isError ? (
            <p role="alert" className="text-sm text-red-400">No se pudo cargar la discografía.</p>
          ) : (
            <DiscografiaGrid grupoId={grupoId} albumes={discografia.data.albumes} modo={modo} />
          ))}
        {pestana === 'miembros' && !esManager && <GrupoMiembros grupo={grupo.data!} />}
      </Card>
    </div>
  );
};

export default GrupoPage;
