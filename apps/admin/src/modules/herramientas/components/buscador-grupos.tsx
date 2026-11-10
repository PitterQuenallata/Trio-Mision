import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronRight, Library, Search, SearchX } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import { Spinner } from '../../../components/ui/ios-spinner';
import { gruposApi, type GrupoItem } from '../../../shared/api/domains/grupos';

/** Iniciales para el avatar del grupo (sin portada en el listado). */
const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';

/**
 * Buscador de grupos con resultados en vivo: solo se busca al escribir y la
 * lista aparece mientras se tipea. Si ningún grupo coincide, ofrece ir a la
 * página de Grupos para crearlo. La búsqueda va al servidor (texto parcial,
 * con límite), así que sirve con miles de grupos.
 */
export const BuscadorGrupos: React.FC<{ seleccionadoId: string; onElegir: (grupo: GrupoItem) => void }> = ({
  seleccionadoId,
  onElegir,
}) => {
  const navigate = useNavigate();
  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState('');

  // Espera breve tras la última tecla antes de consultar.
  useEffect(() => {
    const t = setTimeout(() => setConsulta(texto.trim()), 250);
    return () => clearTimeout(t);
  }, [texto]);

  const resultados = useQuery({
    queryKey: ['grupos', 'buscar', consulta],
    queryFn: () => gruposApi.listar(consulta, 12),
    enabled: consulta.length > 0,
    placeholderData: (previo) => previo,
  });

  const lista = resultados.data ?? [];
  const buscando = consulta.length > 0 && resultados.isFetching;
  const sinResultados = consulta.length > 0 && !buscando && !resultados.isError && lista.length === 0;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          autoFocus
          aria-label="Buscar grupo"
          placeholder="Escribe el nombre del grupo…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter elige el primer resultado: flujo rápido con teclado.
            if (e.key === 'Enter' && lista[0]) onElegir(lista[0]);
          }}
          className="h-13 w-full rounded-full border border-border/60 bg-background/60 py-3.5 pl-11 pr-11 text-base shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
        {buscando && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2"><Spinner size="sm" /></span>
        )}
      </div>

      {consulta.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Los grupos aparecen aquí mientras escribes.
          </p>
        </div>
      )}

      {resultados.isError && consulta.length > 0 && (
        <p role="alert" className="py-6 text-center text-sm text-red-400">No se pudieron buscar los grupos.</p>
      )}

      {sinResultados && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
            <SearchX className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Ningún grupo coincide con «{consulta}»</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Si es un grupo nuevo, primero debes darlo de alta.</p>
          </div>
          <Button variant="gradientBlue" size="pill" onClick={() => navigate({ to: '/grupos' })}>
            <Library className="mr-1.5 h-4 w-4" /> Ir a Grupos
          </Button>
        </div>
      )}

      {lista.length > 0 && consulta.length > 0 && (
        <ul className="max-h-[22rem] divide-y divide-border/40 overflow-y-auto overscroll-contain rounded-3xl border border-border/50 bg-background/40">
          {lista.map((g) => {
            const activo = g.id === seleccionadoId;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => onElegir(g)}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-primary/30 text-sm font-bold text-primary-foreground">
                    {iniciales(g.nombre)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{g.nombre}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[g.pais, `${g.albumes} ${g.albumes === 1 ? 'álbum' : 'álbumes'}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {activo ? (
                    <span className="shrink-0 text-xs font-medium text-primary">Seleccionado</span>
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default BuscadorGrupos;
