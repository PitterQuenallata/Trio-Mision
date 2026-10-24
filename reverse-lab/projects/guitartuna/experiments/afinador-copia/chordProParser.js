/**
 * chordProParser.js — Parser para letras con acordes formato ChordPro / ChordU
 * Convierte texto con corchetes [Bb], [F], etc. en estructura de datos para la UI
 */

export function parseChordPro(rawText) {
  const lines = rawText.split('\n');
  const parsedLines = [];
  let verseCounter = 0;

  for (let rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Directivas estándar ChordPro como {title: ...}, {key: ...}, {time: ...}
    if (trimmed.startsWith('{title:') || trimmed.startsWith('{key:') ||
        trimmed.startsWith('{time:')  || trimmed.startsWith('{lyricist:') ||
        trimmed.startsWith('{composer:')) {
      continue;
    }

    // Directiva de inicio de verso {sov}
    if (trimmed === '{sov}' || trimmed.startsWith('{sov:')) {
      verseCounter++;
      parsedLines.push({
        sectionHeader: `ESTROFA ${verseCounter}`,
        items: []
      });
      continue;
    }

    // Directiva de fin de verso {eov}
    if (trimmed === '{eov}' || trimmed.startsWith('{eov')) {
      continue;
    }

    // Detectar si la línea es solo guiones o intros vacías
    const hasLyrics = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(trimmed.replace(/\[[^\]]+\]/g, ''));

    // Regex para extraer [Acorde] y el texto siguiente
    const regex = /\[([^\]]+)\]([^\[]*)/g;
    let match;
    const items = [];

    // Si la línea comienza con texto antes del primer acorde (ej: "o[D]be[A]de...")
    const firstBracket = rawLine.indexOf('[');
    if (firstBracket > 0) {
      const leadingText = rawLine.substring(0, firstBracket);
      items.push({
        chord: null,
        lyric: leadingText
      });
    } else if (firstBracket === -1) {
      // Línea sin acordes
      items.push({
        chord: null,
        lyric: rawLine
      });
      parsedLines.push({ items, isChordOnly: false });
      continue;
    }

    while ((match = regex.exec(rawLine)) !== null) {
      const chordName = match[1].trim();
      let lyricPart = match[2];

      // Si no hay letra tras el acorde (ej: [D][A]), darle un espaciador
      if (lyricPart === '') {
        lyricPart = '\u00A0\u00A0'; // Espacio no separable para evitar colisión de acordes
      }

      items.push({
        chord: chordName,
        lyric: lyricPart
      });
    }

    parsedLines.push({
      items,
      isChordOnly: !hasLyrics
    });
  }

  return parsedLines;
}
