/**
 * smartScroll.js — Motor de Avance Automático / SmartScroll
 * Implementación con filtro de voz humana vs rasgueo de guitarra
 * y soporte para formato ChordPro / ChordU.
 */

import { parseChordPro } from './chordProParser.js';
import { cosineSimilarity, CHORD_TEMPLATES } from './tuner.js';

// Notas constitutivas de cada acorde (incluyendo enarmónicos sostenidos/bemoles)
export const CHORD_CONSTITUENTS = {
  'C':    ['C', 'E', 'G'],
  'Cm':   ['C', 'D#', 'G', 'Eb'],
  'C#º':  ['C#', 'E', 'G', 'Db'],
  'C#dim':['C#', 'E', 'G', 'Db'],
  'D':    ['D', 'F#', 'A', 'Gb'],
  'Dm':   ['D', 'F', 'A'],
  'Eb':   ['D#', 'G', 'A#', 'Bb'],
  'Ebm':  ['D#', 'F#', 'A#', 'Bb', 'Gb'],
  'E':    ['E', 'G#', 'B', 'Ab'],
  'Em':   ['E', 'G', 'B'],
  'F':    ['F', 'A', 'C'],
  'Gb':   ['F#', 'A#', 'C#', 'Bb', 'Db'],
  'G':    ['G', 'B', 'D'],
  'Gm':   ['G', 'A#', 'D', 'Bb'],
  'A':    ['A', 'C#', 'E', 'Db'],
  'A7':   ['A', 'C#', 'E', 'G', 'Db'],
  'Am':   ['A', 'C', 'E'],
  'Bb':   ['A#', 'D', 'F', 'Bb']
};

// Clases de tono cromáticas (0 = C, 1 = C#, 2 = D, 3 = D#, 4 = E, 5 = F, 6 = F#, 7 = G, 8 = G#, 9 = A, 10 = A#, 11 = B)
export const CHORD_PITCH_CLASSES = {
  'C':    [0, 4, 7],
  'Cm':   [0, 3, 7],
  'C#':   [1, 5, 8],
  'C#m':  [1, 4, 8],
  'C#º':  [1, 4, 7],
  'C#dim':[1, 4, 7],
  'Db':   [1, 5, 8],
  'D':    [2, 6, 9],
  'Dm':   [2, 5, 9],
  'D#':   [3, 7, 10],
  'Eb':   [3, 7, 10],
  'Ebm':  [3, 6, 10],
  'E':    [4, 8, 11],
  'Em':   [4, 7, 11],
  'F':    [5, 9, 0],
  'Fm':   [5, 8, 0],
  'F#':   [6, 10, 1],
  'Gb':   [6, 10, 1],
  'G':    [7, 11, 2],
  'Gm':   [7, 10, 2],
  'G#':   [8, 0, 3],
  'Ab':   [8, 0, 3],
  'A':    [9, 1, 4],
  'A7':   [9, 1, 4, 7],
  'Am':   [9, 0, 4],
  'A#':   [10, 2, 5],
  'Bb':   [10, 2, 5],
  'B':    [11, 3, 6],
  'Bm':   [11, 2, 6]
};

export const CHORD_ROOT_PITCH_CLASS = {
  'C': 0, 'Cm': 0, 'C7': 0,
  'C#': 1, 'C#m': 1, 'C#º': 1, 'C#dim': 1, 'Db': 1, 'Dbm': 1,
  'D': 2, 'Dm': 2, 'D7': 2,
  'D#': 3, 'D#m': 3, 'Eb': 3, 'Ebm': 3,
  'E': 4, 'Em': 4, 'E7': 4,
  'F': 5, 'Fm': 5,
  'F#': 6, 'F#m': 6, 'Gb': 6, 'Gbm': 6,
  'G': 7, 'Gm': 7, 'G7': 7,
  'G#': 8, 'G#m': 8, 'Ab': 8, 'Abm': 8,
  'A': 9, 'Am': 9, 'A7': 9,
  'A#': 10, 'A#m': 10, 'Bb': 10, 'Bbm': 10,
  'B': 11, 'Bm': 11, 'B7': 11
};

export const CHORD_QUALITY = {
  'C': 'maj', 'Cm': 'min', 'C#º': 'dim', 'C#dim': 'dim',
  'D': 'maj', 'Dm': 'min', 'D7': '7',
  'Eb': 'maj', 'Ebm': 'min',
  'E': 'maj', 'Em': 'min', 'E7': '7',
  'F': 'maj', 'Fm': 'min',
  'Gb': 'maj', 'Gbm': 'min',
  'G': 'maj', 'Gm': 'min', 'G7': '7',
  'A': 'maj', 'Am': 'min', 'A7': '7',
  'Bb': 'maj', 'Bbm': 'min',
  'B': 'maj', 'Bm': 'min', 'B7': '7'
};

// Cuerdas abiertas de guitarra (bajos comúnmente tocados por error en rasgueos):
// 6ª cuerda = Mi (4), 5ª cuerda = La (9), 4ª cuerda = Re (2)
const OPEN_BASS_STRINGS = [4, 9, 2];

/**
 * Motor de Aceptación FrettedDnnAcceptanceRules (Replicado de GuitarTuna)
 * Implementa:
 * - OneStringNotSoundingAcceptance (tolera 1 cuerda apagada en tríada o séptima)
 * - OverStrumSolver (perdona bajos abiertos accidentales si la armonía domina)
 * - WrongFret (diagnostica desplazamiento de trastes +-1 o +-2 semitonos)
 * - StrictnessParameters (Modo Aprendiz vs Modo Pro)
 */
export function evaluateFrettedDnnAcceptance(targetChord, pitchData, strictnessMode = 'learner') {
  if (!targetChord) return { isMatch: false, score: 0 };

  const chordAliasMap = {
    'Bb': 'A#', 'Bbm': 'A#m',
    'Eb': 'D#', 'Ebm': 'D#m',
    'Ab': 'G#', 'Abm': 'G#m',
    'Db': 'C#', 'Dbm': 'C#m',
    'Gb': 'F#', 'Gbm': 'F#m'
  };

  const normalizedTarget = chordAliasMap[targetChord] || targetChord;
  const chordData = pitchData.chordData;
  const chroma = chordData?.chroma;

  // 1. Verificación monofónica (cuerda individual si no hay chroma)
  if (!chroma || !chordData) {
    if (pitchData.note) {
      const detectedNote = pitchData.note.toUpperCase();
      const allowed = CHORD_CONSTITUENTS[targetChord] || [targetChord];
      if (allowed.includes(detectedNote)) {
        return {
          isMatch: true,
          score: 0.55,
          matchType: 'single-string',
          diagnostic: `Cuerda individual: nota ${detectedNote} del acorde ${targetChord}`
        };
      }
    }
    return { isMatch: false, score: 0 };
  }

  // 2. Similitud con plantilla directa (Cosine Similarity)
  const template = CHORD_TEMPLATES[normalizedTarget] || CHORD_TEMPLATES[targetChord];
  const rawScore = template ? cosineSimilarity(chroma, template) : 0;

  const targetPCs = CHORD_PITCH_CLASSES[targetChord] || CHORD_PITCH_CLASSES[normalizedTarget] || [];
  if (targetPCs.length === 0) {
    return { isMatch: rawScore > 0.55, score: rawScore, matchType: 'strum' };
  }

  // Analizar notas presentes y faltantes del acorde objetivo
  const soundingPCs = [];
  const missingPCs = [];
  let targetEnergy = 0;

  targetPCs.forEach(pc => {
    const energy = chroma[pc];
    if (energy >= 0.28) {
      soundingPCs.push({ pc, energy });
      targetEnergy += energy;
    } else {
      missingPCs.push(pc);
    }
  });

  // Analizar notas invasoras (foreign notes) fuera del acorde objetivo
  const foreignPCs = [];
  let foreignEnergy = 0;
  for (let c = 0; c < 12; c++) {
    if (!targetPCs.includes(c) && chroma[c] >= 0.30) {
      foreignPCs.push({ pc: c, energy: chroma[c] });
      foreignEnergy += chroma[c];
    }
  }

  const targetDominance = targetEnergy / (targetEnergy + foreignEnergy + 1e-6);
  const minRequiredPCs = (targetPCs.length >= 4) ? 3 : 2;

  let oneStringMutedAccepted = false;
  let overStrumAccepted = false;
  let diagnosticMessage = '';
  let adjustedScore = rawScore;

  const isLearner = (strictnessMode === 'learner');

  // ── OverStrumSolver: Verificar si las notas invasoras son bajos abiertos accidentales ──
  if (foreignPCs.length > 0) {
    const onlyBassOverstrums = foreignPCs.every(fn => OPEN_BASS_STRINGS.includes(fn.pc));
    if (onlyBassOverstrums && targetDominance > 0.55) {
      overStrumAccepted = true;
      if (isLearner) {
        // Reducir la penalización del bajo accidental
        adjustedScore = Math.max(adjustedScore, 0.78 * targetDominance);
        diagnosticMessage = `🎸 Acorde ${targetChord} detectado (bajo abierto accidental perdonado)`;
      }
    }
  }

  // ── OneStringNotSoundingAcceptance: Tolerar 1 cuerda apagada en el rasgueo ──
  if (soundingPCs.length >= minRequiredPCs) {
    if (missingPCs.length === 1) {
      const allowedForeign = (overStrumAccepted && foreignPCs.length <= 1) || foreignPCs.length === 0;
      if (allowedForeign) {
        oneStringMutedAccepted = true;
        if (isLearner) {
          adjustedScore = Math.max(adjustedScore, 0.75);
          diagnosticMessage = `🎸 Acorde ${targetChord} aceptado (1 cuerda apagada tolerada)`;
        }
      }
    } else if (missingPCs.length === 0 && foreignPCs.length === 0) {
      // Acorde limpio perfecto
      adjustedScore = Math.max(adjustedScore, 0.92);
      diagnosticMessage = `🎸 Acorde ${targetChord} limpio perfecto`;
    }
  }

  // ── WrongFret Detection: Diagnóstico de desplazamiento de traste +-1 o +-2 semitonos ──
  let wrongFret = false;
  let semitoneDiff = 0;
  let candidateDetectedChord = chordData.canonicalName || chordData.detectedChord;

  if (adjustedScore < 0.48 && chordData.confidence > 0.50 && candidateDetectedChord) {
    const targetRoot = CHORD_ROOT_PITCH_CLASS[targetChord] ?? CHORD_ROOT_PITCH_CLASS[normalizedTarget];
    const detectedRoot = CHORD_ROOT_PITCH_CLASS[candidateDetectedChord];

    if (targetRoot !== undefined && detectedRoot !== undefined) {
      const diff = ((detectedRoot - targetRoot + 18) % 12) - 6;
      const targetQuality = CHORD_QUALITY[targetChord] || 'maj';
      const detectedQuality = CHORD_QUALITY[candidateDetectedChord] || 'maj';

      if (Math.abs(diff) >= 1 && Math.abs(diff) <= 2 && targetQuality === detectedQuality) {
        wrongFret = true;
        semitoneDiff = diff;
        const dir = diff > 0 ? `${diff} traste(s) más arriba` : `${Math.abs(diff)} traste(s) más abajo`;
        diagnosticMessage = `⚠️ Traste desplazado: estás tocando ${dir} (${candidateDetectedChord} en vez de ${targetChord})`;
      }
    }
  }

  // Evaluación monofónica complementaria
  if (adjustedScore < 0.40 && pitchData.note) {
    const detectedNote = pitchData.note.toUpperCase();
    const allowed = CHORD_CONSTITUENTS[targetChord] || [targetChord];
    if (allowed.includes(detectedNote)) {
      adjustedScore = 0.55;
    }
  }

  // En modo estricto (Pro), exigir que todas las cuerdas suenen sin notas invasoras
  if (!isLearner) {
    if (missingPCs.length > 0) {
      adjustedScore *= 0.60; // Penalización por cuerda apagada
    }
    if (foreignPCs.length > 0) {
      adjustedScore *= 0.65; // Penalización por notas invasoras
    }
  }

  const threshold = isLearner ? 0.52 : 0.72;
  const isMatch = adjustedScore >= threshold;

  return {
    isMatch,
    score: adjustedScore,
    rawScore,
    matchType: 'strum',
    oneStringMuted: oneStringMutedAccepted,
    overStrum: overStrumAccepted,
    wrongFret,
    differenceInSemitones: semitoneDiff,
    detectedChord: candidateDetectedChord,
    diagnostic: diagnosticMessage
  };
}

export const RAW_CANTAD_ALEGRES = `
{title: 01 Cantad alegres al Señor}
{key: D}
{time: 4/4}
{lyricist: Tomás J. González Carvajal (1753-1834)}
{composer: John Hatton 1783 (1710-1793)}

{sov}
[D]Cantad alegres[C#º] al[D] Se[E]ñor[A],
[D]mortales[G] to[D]dos[Em] por[D] doquier[A];
[D]servidle siempre[G] con[D] fer[A7]vor[D][A],
o[D]be[A]de[D]ced[Em]le[D] con[A] placer[D].
{eov}

{sov}
[D]Con gratitud can[C#º]ción[D] al[E]zad[A]
[D]al Hace[G]dor[D] que el[Em] ser[D] os dio[A];
[D]al Dios excelso[G] ve[D]ne[A7]rad[D][A],
[D]que[A] como[D] Pa[Em]dre[D] nos[A] amó[D].
{eov}

{sov}
[D]Su pueblo somos[C#º]: sal[D]va[E]rá[A]
[D]a los que[G] busquen[D] al[Em] Se[D]ñor[A];
[D]ninguno de ellos[G] de[D]ja[A7]rá[D][A];
[D]él[A] los am[D]pa[Em]ra[D] con[A] su amor[D].
{eov}
`;

export const RAW_BAILANDO = `
[Em] Yo te miro y se corta la [C] respiración
[G] Cuando tú me miras se me [D] sube el corazón
[Em] Y en tu silencio tu mirada [C] dice mil palabras
[G] La noche en la que te suplico [D] que no salga el sol

[Am] Bailando oh, oh, [C] bailando oh, oh, bailando
Tu cuerpo y el [Em] mío llegando al vacío [D] subiendo y bajando
[Am] Bailando oh, oh, [C] bailando oh, oh, bailando
Ese fuego por [Em] dentro me va enloqueciendo, [D] me va saturando

[Em] Con tu física y tu química, [C] también tu anatomía
La cerveza y el tequila [G] y tu boca con la mía
Ya no puedo más, [D] ya no puedo más, ya no puedo más
[Em] Con esa melodía, [C] yo veo tu fantasía
Con tu filosofía [G] mi cabeza está vacía
Ya no puedo más, [D] ya no puedo más, ya no puedo más

[Em] Yo quiero estar contigo, [C] vivir contigo, bailar contigo
Tener contigo [G] una noche loca [D] y besar tu boca
[Em] Yo quiero estar contigo, [C] vivir contigo, bailar contigo
Tener contigo [G] una noche loca [D] y besar tu boca

[Em] Tú me miras y yo estoy en [C] otra dimensión
[G] Tus latidos aceleran [D] a mi corazón
[Em] Qué movida del destino [C] no poder tocarte, abrazarte
[G] Y sentir la magia de tu [D] olor
`;

export const RAW_BASTA_YA = `
[Bb] Basta ya de [Dm] guerras, basta ya de [G] cadenas, basta ya de [Gm] drogas
[F] y de gente que [Eb] llora
Basta ya de [Bb] rosas y de [Cm] hipocresía, basta ya de [Eb] divorcios, por favor te lo [F] imploro
[D] Basta ya de [Gm] mentiras y de tantas [Gb] envidias,
este [Bb] materialismo que nos deja sin [E] vida
Yo [Cm] quiero un nuevo amanecer en mi [F] vivir
Porque ya es [Bb] tiempo de [F] amar sin [Gm] medida
Y al [Bb] perdonar encontrar la [F] salida
Porque ya es [D] tiempo de sanar este herido [Gm] corazón
No [Cm] pierdas un minuto más, porque tu [F] tiempo con mi Jesús es de [Bb] vida
`;

export const RAW_CANTAD_ALEGRES_SIMPLIFICADA = `
{sov}
[D] Cantad alegres al [A] Señor,
[G] mortales todos [D] por doquier;
[D] servidle siempre [G] con fervor,
[D] obedecedle [A] con placer [D].
{eov}

{sov}
[D] Con gratitud canción [A] alzad
[G] al Hacedor que el [D] ser os dio;
[D] al Dios excelso [G] venerad,
[D] que como Padre [A] nos amó [D].
{eov}

{sov}
[D] Su pueblo somos: [A] salvará
[G] a los que busquen [D] al Señor;
[D] ninguno de ellos [G] dejará;
[D] él los ampara [A] con su amor [D].
{eov}
`;

export const SONGS_CATALOG = {
  'cantad-alegres': {
    id: 'cantad-alegres',
    title: '01 Cantad alegres al Señor',
    artist: 'Himno Tradicional (D)',
    capo: 'Tonalidad: D (4/4)',
    chordsSummary: ['D', 'C#º', 'E', 'A', 'G', 'Em', 'A7'],
    lines: parseChordPro(RAW_CANTAD_ALEGRES),
    linesOriginal: parseChordPro(RAW_CANTAD_ALEGRES),
    linesSimplified: parseChordPro(RAW_CANTAD_ALEGRES_SIMPLIFICADA)
  },
  'bailando': {
    id: 'bailando',
    title: 'Bailando',
    artist: 'Enrique Iglesias ft. Gente de Zona',
    capo: 'Sin cejillo',
    chordsSummary: ['Em', 'C', 'G', 'D', 'Am'],
    lines: parseChordPro(RAW_BAILANDO)
  },
  'basta-ya': {
    id: 'basta-ya',
    title: 'Basta Ya',
    artist: 'ChordU',
    capo: 'Sin cejillo',
    chordsSummary: ['Bb', 'Dm', 'Gm', 'F', 'Eb', 'C', 'Cm', 'D', 'Am'],
    lines: parseChordPro(RAW_BASTA_YA)
  },
  'cumpleanos-feliz': {
    id: 'cumpleanos-feliz',
    title: 'Cumpleaños Feliz',
    artist: 'Tradicional',
    capo: 'Sin cejillo',
    chordsSummary: ['C', 'G', 'F'],
    lines: parseChordPro(`
[C] Cumpleaños [G] feliz
Cumpleaños [C] feliz
Te deseamos [F] todos
[C] Cumpleaños [G] Fe [C] liz

[C] Que los cumpla [G] feliz
Que los vuelva a [C] cumplir
Que los siga [F] cumpliendo
[C] Hasta el año [G] diez [C] mil
`)
  }
};

export class SmartScrollSongEngine {
  constructor(options = {}) {
    this.currentSongId = 'cantad-alegres';
    this.song = SONGS_CATALOG[this.currentSongId];
    this.flatChords = [];
    this.buildFlatChordList();

    this.activeChordIndex = 0;
    this.enabled = true; // AVANCE AUTOMÁTICO ON/OFF

    // Filtro de voz vs guitarra
    this.voiceRejectionEnabled = true;

    // ── Reglas FrettedDnnAcceptanceRules (GuitarTuna) ──
    // Modo de tolerancia: 'learner' (Aprendiz) vs 'strict' (Pro)
    this.strictnessMode = 'learner';

    // Suavizado continuo de confianza (Leaky Integrator)
    this.accumulatedConfidence = 0;
    this.requiredConfidence = 0.50;      // 0.50 en modo aprendiz, 0.72 en pro
    this.cooldownUntil = 0;              // Período refractario para evitar saltos dobles
    this.cooldownDurationMs = 380;       // Enfriamiento base

    // StayWithinSameChord: control de acordes repetidos consecutivos (ej: [D] -> [D])
    this.lastAcceptedChord = null;
    this.requiresFreshOnset = false;

    // Acumulador de notas para arpegios / punteo cuerda por cuerda
    this.arpeggioBuffer = [];

    this.audioContext = null;
    this.onChordChange = options.onChordChange || null;
    this.onSongComplete = options.onSongComplete || null;
  }

  setSong(songId) {
    if (SONGS_CATALOG[songId]) {
      this.currentSongId = songId;
      this.song = SONGS_CATALOG[songId];
      this.buildFlatChordList();
      this.reset();
    }
  }

  setVersion(isSimplified) {
    if (this.song && this.song.linesSimplified) {
      this.song.lines = isSimplified ? this.song.linesSimplified : this.song.linesOriginal;
      this.buildFlatChordList();
      this.reset();
    }
  }

  buildFlatChordList() {
    this.flatChords = [];
    this.song.lines.forEach((line, lIdx) => {
      line.items.forEach((item, iIdx) => {
        if (item.chord) {
          this.flatChords.push({
            chord: item.chord,
            lyric: item.lyric,
            lineIndex: lIdx,
            itemIndex: iIdx,
            id: `chord-${lIdx}-${iIdx}`
          });
        }
      });
    });
  }

  getCurrentChord() {
    if (this.activeChordIndex >= this.flatChords.length) return null;
    return this.flatChords[this.activeChordIndex];
  }

  reset() {
    this.activeChordIndex = 0;
    this.accumulatedConfidence = 0;
    this.cooldownUntil = 0;
    this.lastAcceptedChord = null;
    this.requiresFreshOnset = false;
    this.arpeggioBuffer = [];
    if (this.onChordChange) {
      this.onChordChange(this.getCurrentChord(), this.activeChordIndex);
    }
  }

  toggleAutoScroll() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  toggleVoiceRejection() {
    this.voiceRejectionEnabled = !this.voiceRejectionEnabled;
    return this.voiceRejectionEnabled;
  }

  toggleStrictness() {
    this.strictnessMode = (this.strictnessMode === 'learner') ? 'strict' : 'learner';
    this.requiredConfidence = (this.strictnessMode === 'learner') ? 0.50 : 0.72;
    this.cooldownDurationMs = (this.strictnessMode === 'learner') ? 380 : 480;
    return this.strictnessMode;
  }

  setChordIndex(idx) {
    if (idx >= 0 && idx < this.flatChords.length) {
      this.activeChordIndex = idx;
      this.accumulatedConfidence = 0;
      this.cooldownUntil = Date.now() + 250;
      this.requiresFreshOnset = false;
      this.arpeggioBuffer = [];
      if (this.onChordChange) {
        this.onChordChange(this.getCurrentChord(), this.activeChordIndex);
      }
    }
  }

  /**
   * Evalúa la señal de audio distinguiendo con precisión:
   * 1. VOZ HUMANA (rechazada cuando el filtro está activo)
   * 2. ARPEGIO DE GUITARRA (punteo cuerda por cuerda con ataque de púa/uña)
   * 3. RASGUEO DE GUITARRA (acorde completo polifónico FrettedDnn)
   * @param {Object} pitchData
   */
  evaluatePitch(pitchData) {
    if (!this.enabled) return { isMatch: false };
    const current = this.getCurrentChord();
    if (!current) return { isMatch: false };

    const now = Date.now();
    if (now < this.cooldownUntil) {
      return { isMatch: false, inCooldown: true };
    }

    // SalienceNoiseFloorEstimate: Si la señal está inactiva o por debajo del umbral dinámico
    if (!pitchData.active || pitchData.rms < 0.004) {
      this.accumulatedConfidence = Math.max(0, this.accumulatedConfidence * 0.70);
      return { isMatch: false };
    }

    // ── 1. FILTRO DE VOZ HUMANA ──
    // Si el clasificador acústico identificó voz humana y el filtro está activo: rechazar avance
    if (pitchData.acousticType === 'VOICE' && this.voiceRejectionEnabled) {
      this.accumulatedConfidence = Math.max(0, this.accumulatedConfidence * 0.40);
      return {
        isMatch: false,
        voiceIgnored: true,
        acousticType: 'VOICE',
        detectedNote: pitchData.note,
        diagnostic: `🎤 Voz detectada (${pitchData.note || 'canto'}) — rasguea o puntea el acorde [${current.chord}] en la guitarra`
      };
    }

    // ── 2. DETECCIÓN DE ARPEGIO / PUNTEO CUERDA POR CUERDA ──
    // Si el usuario puntea notas individuales de guitarra con ataque de púa/uña
    if (pitchData.acousticType === 'GUITAR_ARPEGGIO' && pitchData.note) {
      const detectedNote = pitchData.note.toUpperCase();
      const chordAliasMap = {
        'Bb': 'A#', 'Bbm': 'A#m',
        'Eb': 'D#', 'Ebm': 'D#m',
        'Ab': 'G#', 'Abm': 'G#m',
        'Db': 'C#', 'Dbm': 'C#m',
        'Gb': 'F#', 'Gbm': 'F#m'
      };
      const normalizedTarget = chordAliasMap[current.chord.trim()] || current.chord.trim();
      const allowed = CHORD_CONSTITUENTS[current.chord.trim()] || CHORD_CONSTITUENTS[normalizedTarget] || [];

      if (allowed.includes(detectedNote)) {
        // Mantener ventana de arpegio de 1800ms
        this.arpeggioBuffer = this.arpeggioBuffer.filter(item => (now - item.time) < 1800);
        this.arpeggioBuffer.push({ note: detectedNote, time: now });

        const uniqueNotes = Array.from(new Set(this.arpeggioBuffer.map(item => item.note)));

        // Si se han punteado al menos 2 notas distintas de las cuerdas del acorde
        if (uniqueNotes.length >= 2) {
          this.arpeggioBuffer = [];
          this.cooldownUntil = now + this.cooldownDurationMs;
          this.advanceChordBy(1, false);
          return {
            isMatch: true,
            matchType: 'arpeggio',
            acousticType: 'GUITAR_ARPEGGIO',
            advanced: true,
            arpeggioNotes: uniqueNotes,
            diagnostic: `🎼 ¡Arpegio de [${current.chord}] completado! (Notas: ${uniqueNotes.join(', ')})`
          };
        } else {
          return {
            isMatch: false,
            acousticType: 'GUITAR_ARPEGGIO',
            inArpeggio: true,
            arpeggioProgress: `${uniqueNotes.length}/2`,
            diagnostic: `🎼 Punteo detectado: nota ${detectedNote} (${uniqueNotes.length}/2 del arpegio de [${current.chord}])`
          };
        }
      }
    }

    // ── 3. DETECCIÓN DE RASGUEO (STRUM) CON REGLAS GUITARTUNA ──
    // StayWithinSameChord: Si el acorde actual es repetido del anterior (ej: [D] -> [D])
    if (this.requiresFreshOnset) {
      if (pitchData.isStrumOnset) {
        // Se detectó un nuevo ataque de púa/rasgueo limpio
        this.requiresFreshOnset = false;
      } else if (pitchData.rms < 0.008) {
        // Hubo una caída de volumen suficiente entre rasgueos
        this.requiresFreshOnset = false;
      } else {
        // La guitarra sigue vibrando del acorde anterior: NO avanzar aún
        return {
          isMatch: false,
          requiresFreshOnset: true,
          targetChord: current.chord,
          diagnostic: `🎸 Vuelve a rasguear para activar el acorde repetido [${current.chord}]`
        };
      }
    }

    const chordData = pitchData.chordData;

    // Lookahead Window Inteligente: Escucha el acorde actual (step 0) y los próximos (step 1, step 2)
    const lookaheadCandidates = [];
    const maxLookahead = 3;

    for (let step = 0; step < maxLookahead; step++) {
      const idx = this.activeChordIndex + step;
      if (idx < this.flatChords.length) {
        const chordItem = this.flatChords[idx];
        const chordName = chordItem.chord.trim();

        // Evitar saltos en cascada hacia un acorde idéntico futuro en el mismo rasgueo
        if (step > 0 && chordName === current.chord.trim()) {
          continue;
        }

        lookaheadCandidates.push({
          stepOffset: step,
          chordItem
        });
      }
    }

    let bestCandidate = null;
    let highestScore = 0;
    let bestEvalResult = null;

    // Evaluar candidatos usando FrettedDnnAcceptanceRules
    for (const cand of lookaheadCandidates) {
      const targetChord = cand.chordItem.chord.trim();
      const evalResult = evaluateFrettedDnnAcceptance(targetChord, pitchData, this.strictnessMode);

      // Ponderar prioridad del acorde actual frente a candidatos futuros
      const weightedScore = (cand.stepOffset === 0) ? evalResult.score : (evalResult.score * 0.86);

      if (weightedScore > highestScore) {
        highestScore = weightedScore;
        bestCandidate = cand;
        bestEvalResult = evalResult;
      }
    }

    // Diagnóstico de traste desplazado (WrongFret)
    if (bestEvalResult && bestEvalResult.wrongFret && highestScore < 0.45) {
      return {
        isMatch: false,
        wrongFret: true,
        differenceInSemitones: bestEvalResult.differenceInSemitones,
        detectedChord: bestEvalResult.detectedChord,
        targetChord: current.chord,
        diagnostic: bestEvalResult.diagnostic
      };
    }

    // Integración temporal continua (EMA Leaky Integrator)
    const smoothingAlpha = (this.strictnessMode === 'learner') ? 0.40 : 0.30;
    this.accumulatedConfidence = (this.accumulatedConfidence * (1 - smoothingAlpha)) + (highestScore * smoothingAlpha);

    if (this.accumulatedConfidence >= this.requiredConfidence && bestCandidate) {
      this.accumulatedConfidence = 0;

      const candidateChordName = bestCandidate.chordItem.chord.trim();
      this.lastAcceptedChord = candidateChordName;

      // StayWithinSameChord: Si el siguiente acorde en la lista es idéntico a este,
      // configurar requerimiento de nuevo rasgueo y enfriamiento de 650ms
      const nextIdx = this.activeChordIndex + bestCandidate.stepOffset + 1;
      const nextChordItem = (nextIdx < this.flatChords.length) ? this.flatChords[nextIdx] : null;
      const isNextSameChord = nextChordItem && (nextChordItem.chord.trim() === candidateChordName);

      if (isNextSameChord) {
        this.requiresFreshOnset = true;
        this.cooldownUntil = now + 650;
      } else {
        this.requiresFreshOnset = false;
        this.cooldownUntil = now + this.cooldownDurationMs;
      }

      const isJump = (bestCandidate.stepOffset > 0);
      this.advanceChordBy(bestCandidate.stepOffset + 1, isJump);

      return {
        isMatch: true,
        matchType: 'strum',
        acousticType: 'GUITAR_STRUM',
        advanced: true,
        isJump,
        jumpOffset: bestCandidate.stepOffset,
        oneStringMuted: bestEvalResult?.oneStringMuted,
        overStrum: bestEvalResult?.overStrum,
        diagnostic: bestEvalResult?.diagnostic || `🎸 ¡Rasgueo de [${candidateChordName}] detectado!`
      };
    }

    return {
      isMatch: highestScore > 0.45,
      confidence: highestScore,
      accumulated: this.accumulatedConfidence,
      acousticType: pitchData.acousticType || 'UNKNOWN',
      oneStringMuted: bestEvalResult?.oneStringMuted,
      overStrum: bestEvalResult?.overStrum,
      wrongFret: bestEvalResult?.wrongFret,
      diagnostic: bestEvalResult?.diagnostic
    };
  }

  /**
   * Avanza 1 o más acordes (SmartScrollJump)
   */
  advanceChordBy(stepCount = 1, isJump = false) {
    this.playChime();
    this.activeChordIndex += stepCount;

    const isComplete = this.activeChordIndex >= this.flatChords.length;
    if (isComplete) {
      if (this.onSongComplete) this.onSongComplete();
    } else {
      if (this.onChordChange) {
        this.onChordChange(this.getCurrentChord(), this.activeChordIndex, isJump);
      }
    }
  }

  advanceChord() {
    this.playChime();
    this.activeChordIndex++;

    const isComplete = this.activeChordIndex >= this.flatChords.length;
    if (isComplete) {
      if (this.onSongComplete) this.onSongComplete();
    } else {
      if (this.onChordChange) {
        this.onChordChange(this.getCurrentChord(), this.activeChordIndex);
      }
    }
  }

  playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioContext && AudioCtx) {
        this.audioContext = new AudioCtx();
      }
      if (!this.audioContext) return;
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, this.audioContext.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.1);

      gain.gain.setValueAtTime(0.14, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.13);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start();
      osc.stop(this.audioContext.currentTime + 0.14);
    } catch (e) {
      // Audio autoplay policy
    }
  }
}
