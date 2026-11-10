import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../../../shared/components/ui/button';
import { etiquetaTipo, type AlbumGestion } from '../../../shared/api/domains/discografia';

/** Discografía del grupo como cuadrícula de portadas (estilo Spotify). */
export const DiscografiaGrid: React.FC<{ grupoId: string; albumes: AlbumGestion[]; modo?: 'admin' | 'manager' }> = ({
  grupoId,
  albumes,
  modo = 'admin',
}) => {
  const navigate = useNavigate();
  const esManager = modo === 'manager';
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() =>
            void navigate(esManager ? { to: '/mi-grupo/$grupoId/nuevo', params: { grupoId } } : { to: '/grupos/$grupoId/nuevo', params: { grupoId } })
          }
        >
          Nuevo lanzamiento
        </Button>
      </div>

      {albumes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este grupo todavía no tiene lanzamientos.</p>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
          {albumes.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() =>
                void navigate(
                  esManager
                    ? { to: '/mi-grupo/$grupoId/albumes/$albumId', params: { grupoId, albumId: a.id } }
                    : { to: '/grupos/$grupoId/albumes/$albumId', params: { grupoId, albumId: a.id } },
                )
              }
              className="group text-left"
            >
              <div className="aspect-square overflow-hidden rounded-2xl border border-border/50 bg-muted/40 transition-transform group-hover:-translate-y-0.5">
                {a.cover_url ? (
                  <img src={a.cover_url} alt={a.titulo} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Sin portada</div>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{a.titulo}</p>
              <p className="truncate text-xs text-muted-foreground">
                {a.anio ? `${a.anio} · ` : ''}{etiquetaTipo[a.tipo]} · {(a.canciones ?? []).length} can.
                {!a.publicado && ' · Borrador'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DiscografiaGrid;
