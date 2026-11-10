import React from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { artistasApi, type ArtistaMio } from '../../../shared/api/domains/artistas';
import { Card } from '../../../shared/components/ui/card';

const ROL_LABEL: Record<string, string> = { manager: 'Manager', member: 'Member' };

/** Ficha de un artista del usuario con sus álbumes (lectura). */
export const ArtistaCard: React.FC<{ artista: ArtistaMio }> = ({ artista }) => {
  const detalle = useQuery({
    queryKey: ['mis-artistas', artista.id],
    queryFn: () => artistasApi.obtenerMio(artista.id),
  });

  return (
    <Card className="space-y-4 rounded-2xl border-border/50 bg-card/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{artista.nombre}</h2>
          <p className="font-mono text-xs text-muted-foreground">{artista.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {ROL_LABEL[artista.mi_rol] ?? artista.mi_rol}
          </span>
          <span className="text-xs text-muted-foreground">{artista.publicado ? 'Publicado' : 'Borrador'}</span>
          {artista.mi_rol === 'manager' && (
            <Link
              to="/mi-grupo/$grupoId"
              params={{ grupoId: artista.id }}
              className="rounded-md border border-border/60 px-3 py-1 text-xs font-medium hover:bg-muted/50"
            >
              Administrar
            </Link>
          )}
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Álbumes</h3>
        {detalle.isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {detalle.isError && <p className="text-sm text-red-400">No se pudieron cargar los álbumes.</p>}
        {detalle.isSuccess && (detalle.data.albumes ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Sin álbumes todavía.</p>
        )}
        {detalle.isSuccess && (detalle.data.albumes ?? []).length > 0 && (
          <ul className="divide-y divide-border/40 rounded-xl border border-border/40">
            {(detalle.data.albumes ?? []).map((al) => (
              <li key={al.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{al.titulo}{al.anio ? ` (${al.anio})` : ''}</span>
                <span className="text-xs text-muted-foreground">
                  {(al.canciones ?? []).length} canciones · {al.publicado ? 'publicado' : 'borrador'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
};

export default ArtistaCard;
