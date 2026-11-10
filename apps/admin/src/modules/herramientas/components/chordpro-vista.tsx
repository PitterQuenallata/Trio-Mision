import React from 'react';

/** Directivas de sección ({soc}, {sov}…) y su etiqueta. Las de cierre no muestran nada. */
const SECCIONES: Record<string, string> = {
  sov: 'Verso', soc: 'Coro', sob: 'Puente', sog: 'Outro', sos: 'Solo',
  verse: 'Verso', chorus: 'Coro', bridge: 'Puente', tag: 'Tag', intro: 'Intro', outro: 'Outro',
};

const DIRECTIVA = /^\{([^:}]+)(?::\s*([^}]*))?\}$/;

/** Renderiza un ChordPro: acordes sobre la letra, encabezado con título y datos, secciones con etiqueta. */
export const ChordProVista: React.FC<{ texto: string }> = ({ texto }) => {
  const lineas = texto.split('\n');
  const cabecera: { clave: string; valor: string }[] = [];
  const cuerpo: React.ReactNode[] = [];

  lineas.forEach((raw, i) => {
    const linea = raw.trimEnd();
    if (!linea.trim() || linea.startsWith('#')) {
      cuerpo.push(<div key={i} className="h-3" />);
      return;
    }
    const d = linea.match(DIRECTIVA);
    if (d) {
      const clave = d[1].trim().toLowerCase();
      const valor = (d[2] ?? '').trim();
      if (clave in SECCIONES) {
        cuerpo.push(
          <p key={i} className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-primary">{valor || SECCIONES[clave]}</p>,
        );
      } else if (['eoc', 'eov', 'eob', 'eog', 'eos'].includes(clave)) {
        // cierre de sección: sin salida
      } else if (['title', 'subtitle', 'key', 'capo', 'author', 'number'].includes(clave)) {
        cabecera.push({ clave, valor });
      }
      return;
    }
    if (linea.includes('[')) {
      cuerpo.push(<LineaConAcordes key={i} linea={linea} />);
      return;
    }
    cuerpo.push(<p key={i} className="font-sans text-sm leading-6 text-foreground">{linea}</p>);
  });

  const titulo = cabecera.find((c) => c.clave === 'title')?.valor;
  const subtitulo = cabecera.find((c) => c.clave === 'subtitle')?.valor;
  const tono = cabecera.find((c) => c.clave === 'key')?.valor;
  const capo = cabecera.find((c) => c.clave === 'capo')?.valor;
  const autor = cabecera.find((c) => c.clave === 'author')?.valor;

  return (
    <div className="space-y-1 font-mono">
      {titulo && <h3 className="font-sans text-xl font-bold text-foreground">{titulo}</h3>}
      {subtitulo && <p className="font-sans text-xs text-muted-foreground">{subtitulo}</p>}
      <p className="font-sans text-xs text-muted-foreground">
        {[tono && `Tono ${tono}`, capo && `Capo ${capo}`, autor && `Autor: ${autor}`].filter(Boolean).join(' · ')}
      </p>
      <div className="pt-3">{cuerpo}</div>
    </div>
  );
};

/** Una línea con marcas [Acorde]: cada acorde va encima de la sílaba que le sigue. */
const LineaConAcordes: React.FC<{ linea: string }> = ({ linea }) => {
  const partes = linea.split(/(\[[^\]]*\])/).filter((p) => p !== '');
  const segmentos: { acorde: string; texto: string }[] = [];
  let acordeActual = '';
  for (const p of partes) {
    if (p.startsWith('[') && p.endsWith(']')) {
      acordeActual = p.slice(1, -1);
      segmentos.push({ acorde: acordeActual, texto: '' });
    } else if (segmentos.length === 0) {
      segmentos.push({ acorde: '', texto: p });
    } else {
      segmentos[segmentos.length - 1].texto += p;
    }
  }
  return (
    <div className="flex flex-wrap items-end leading-none">
      {segmentos.map((s, i) => (
        <span key={i} className="inline-flex flex-col">
          <span className="h-5 whitespace-pre text-xs font-bold text-primary">{s.acorde || ' '}</span>
          <span className="whitespace-pre text-sm text-foreground">{s.texto || ' '}</span>
        </span>
      ))}
    </div>
  );
};

export default ChordProVista;
