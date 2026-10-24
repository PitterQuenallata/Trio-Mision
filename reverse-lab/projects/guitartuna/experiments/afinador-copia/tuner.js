/**
 * tuner.js — Motor de afinación usando Web Audio API + algoritmo YIN
 *
 * El algoritmo YIN (de Cheveigné & Kawahara, 2002) es el estándar
 * en aplicaciones de afinación profesional (GuitarTuna, AutoTune, etc.).
 * Detecta el pitch fundamental con alta precisión y baja latencia.
 */

import { freqToNote } from './notes.js';

// ─── Constantes YIN ──────────────────────────────────────────────────────────
const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 4096;      // Ventana de análisis ~93ms
const YIN_THRESHOLD = 0.10;    // Umbral de confianza (0.10 = muy estricto)
const MIN_FREQ = 60;           // Hz mínimo detectado (bajo de guitarra ~82 Hz)
const MAX_FREQ = 1400;         // Hz máximo detectado (notas agudas)

// ─── Estado global ────────────────────────────────────────────────────────────
let audioCtx = null;
let analyserNode = null;
let sourceNode = null;
let scriptNode = null;
let stream = null;
let isRunning = false;
let onPitchCallback = null;

// ─── YIN Algorithm ────────────────────────────────────────────────────────────

/**
 * Paso 1: Función de diferencia d(τ)
 */
function difference(buffer) {
  const len = buffer.length;
  const halfLen = Math.floor(len / 2);
  const result = new Float32Array(halfLen);

  for (let tau = 0; tau < halfLen; tau++) {
    let sum = 0;
    for (let j = 0; j < halfLen; j++) {
      const delta = buffer[j] - buffer[j + tau];
      sum += delta * delta;
    }
    result[tau] = sum;
  }
  return result;
}

/**
 * Paso 2: CMNDF (Cumulative Mean Normalized Difference Function)
 * Normaliza d(τ) para evitar bias hacia τ=0.
 */
function cmndf(diff) {
  const result = new Float32Array(diff.length);
  result[0] = 1;
  let runningSum = 0;

  for (let tau = 1; tau < diff.length; tau++) {
    runningSum += diff[tau];
    result[tau] = diff[tau] / (runningSum / tau);
  }
  return result;
}

/**
 * Paso 3: Encontrar el primer mínimo local por debajo del threshold.
 * Devuelve el período τ en samples, o -1 si no se detecta.
 */
function absoluteThreshold(cmndfResult, threshold) {
  let tau = 2;
  while (tau < cmndfResult.length) {
    if (cmndfResult[tau] < threshold) {
      // Buscar el mínimo local alrededor de este punto
      while (
        tau + 1 < cmndfResult.length &&
        cmndfResult[tau + 1] < cmndfResult[tau]
      ) {
        tau++;
      }
      return tau;
    }
    tau++;
  }
  return -1; // No se detectó pitch
}

/**
 * Paso 4: Interpolación parabólica para mayor precisión sub-sample.
 */
function parabolicInterpolation(cmndfResult, tau) {
  if (tau <= 0 || tau >= cmndfResult.length - 1) return tau;
  const s0 = cmndfResult[tau - 1];
  const s1 = cmndfResult[tau];
  const s2 = cmndfResult[tau + 1];
  const adjustment = (s2 - s0) / (2 * (2 * s1 - s2 - s0));
  return tau + adjustment;
}

/**
 * Función principal YIN: detecta el pitch de un buffer de audio.
 * @param {Float32Array} buffer — buffer PCM
 * @param {number} sampleRate
 * @returns {{ freq: number, aperiodicity: number } | number} frecuencia en Hz y aperiodicidad
 */
export function yinPitchDetection(buffer, sampleRate = SAMPLE_RATE) {
  const diff = difference(buffer);
  const cmndfResult = cmndf(diff);
  const tau = absoluteThreshold(cmndfResult, YIN_THRESHOLD);

  if (tau === -1) return { freq: -1, aperiodicity: 1.0 };

  const aperiodicity = cmndfResult[tau];
  const tauRefined = parabolicInterpolation(cmndfResult, tau);
  const freq = sampleRate / tauRefined;

  if (freq < MIN_FREQ || freq > MAX_FREQ) return { freq: -1, aperiodicity: 1.0 };
  return { freq, aperiodicity };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Inicia la captura de micrófono y el loop de detección.
 * @param {Function} onPitch — callback(pitchData) llamado cada frame
 *   pitchData = { freq, note, octave, cents, active }
 */
export async function startTuner(onPitch) {
  if (isRunning) return;
  onPitchCallback = onPitch;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0,
      },
    });

    audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    sourceNode = audioCtx.createMediaStreamSource(stream);
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = BUFFER_SIZE * 2;
    analyserNode.smoothingTimeConstant = 0;

    // ScriptProcessor para análisis frame a frame
    scriptNode = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
    scriptNode.onaudioprocess = processAudio;

    sourceNode.connect(analyserNode);
    analyserNode.connect(scriptNode);
    scriptNode.connect(audioCtx.destination);

    isRunning = true;
  } catch (err) {
    throw new Error(`No se pudo acceder al micrófono: ${err.message}`);
  }
}

/**
 * Detiene el tuner y libera recursos.
 */
export function stopTuner() {
  if (!isRunning) return;

  if (scriptNode) { scriptNode.disconnect(); scriptNode = null; }
  if (analyserNode) { analyserNode.disconnect(); analyserNode = null; }
  if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }

  isRunning = false;
}

// ─── Detección Polifónica de Acordes (Chromagram FFT) ───────────────────────
export const CHROMA_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Plantillas de acordes mayores, menores, séptimas y disminuidos
export const CHORD_TEMPLATES = {};
CHROMA_NOTE_NAMES.forEach((root, idx) => {
  // Mayor: fundamental, 3ª mayor (+4 semitonos), 5ª justa (+7 semitonos)
  const majVec = new Float32Array(12);
  majVec[idx] = 1.0;
  majVec[(idx + 4) % 12] = 0.85;
  majVec[(idx + 7) % 12] = 0.85;
  CHORD_TEMPLATES[root] = majVec;

  // Menor: fundamental, 3ª menor (+3 semitonos), 5ª justa (+7 semitonos)
  const minVec = new Float32Array(12);
  minVec[idx] = 1.0;
  minVec[(idx + 3) % 12] = 0.85;
  minVec[(idx + 7) % 12] = 0.85;
  CHORD_TEMPLATES[`${root}m`] = minVec;

  // Séptima dominante (7): fundamental, 3ª mayor (+4), 5ª justa (+7), 7ª menor (+10)
  const dom7Vec = new Float32Array(12);
  dom7Vec[idx] = 1.0;
  dom7Vec[(idx + 4) % 12] = 0.8;
  dom7Vec[(idx + 7) % 12] = 0.7;
  dom7Vec[(idx + 10) % 12] = 0.8;
  CHORD_TEMPLATES[`${root}7`] = dom7Vec;

  // Disminuido (º o dim): fundamental, 3ª menor (+3), 5ª disminuida (+6)
  const dimVec = new Float32Array(12);
  dimVec[idx] = 1.0;
  dimVec[(idx + 3) % 12] = 0.85;
  dimVec[(idx + 6) % 12] = 0.85;
  CHORD_TEMPLATES[`${root}º`] = dimVec;
  CHORD_TEMPLATES[`${root}dim`] = dimVec;
});

// Alias comunes de bemoles
export const CHORD_ALIASES = {
  'Bb': 'A#',
  'Bbm': 'A#m',
  'Eb': 'D#',
  'Ebm': 'D#m',
  'Ab': 'G#',
  'Abm': 'G#m',
  'Db': 'C#',
  'Dbm': 'C#m',
  'Gb': 'F#',
  'Gbm': 'F#m'
};

export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < 12; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

let freqBuffer = null;
let spectralNoiseFloorDb = -75;
let noiseFloorRms = 0.003;

/**
 * Calcula el vector de croma y detecta el acorde polifónico del buffer FFT.
 * Incorpora SalienceNoiseFloorEstimate para aislar el ruido ambiente de sala.
 */
function detectChromaChord(analyser, sampleRate) {
  if (!analyser) return null;
  if (!freqBuffer || freqBuffer.length !== analyser.frequencyBinCount) {
    freqBuffer = new Float32Array(analyser.frequencyBinCount);
  }

  analyser.getFloatFrequencyData(freqBuffer);

  const chroma = new Float32Array(12);
  const binResolution = sampleRate / analyser.fftSize;

  // Rango de frecuencias típicas de guitarra (70 Hz a 1100 Hz)
  const minBin = Math.max(1, Math.floor(70 / binResolution));
  const maxBin = Math.min(freqBuffer.length - 1, Math.floor(1100 / binResolution));

  // Estimador dinámico de suelo de ruido espectral (SalienceNoiseFloorEstimate)
  let minDb = 0;
  let countBins = 0;
  for (let i = minBin; i <= maxBin; i++) {
    if (freqBuffer[i] < minDb && freqBuffer[i] > -120) {
      minDb = freqBuffer[i];
    }
    countBins++;
  }
  if (minDb < 0) {
    spectralNoiseFloorDb = (spectralNoiseFloorDb * 0.92) + (minDb * 0.08);
  }
  const dynamicCutoffDb = Math.max(-68, spectralNoiseFloorDb + 9);

  // Calcular energía espectral total y en agudos (2500 Hz a 7500 Hz) para transitorios de púa/uña
  const hfMinBin = Math.max(1, Math.floor(2500 / binResolution));
  const hfMaxBin = Math.min(freqBuffer.length - 1, Math.floor(7500 / binResolution));
  let hfEnergy = 0;
  let totalSpectralEnergy = 0;

  for (let i = minBin; i <= maxBin; i++) {
    const db = freqBuffer[i];
    if (db > dynamicCutoffDb) {
      // Convertir dB a magnitud lineal
      const mag = Math.pow(10, db / 20);
      const freq = i * binResolution;
      // Convertir frecuencia a clase de tono (0 a 11)
      const midi = 12 * Math.log2(freq / 440) + 69;
      const semitone = ((Math.round(midi) % 12) + 12) % 12;
      chroma[semitone] += mag;
    }
  }

  for (let i = minBin; i < freqBuffer.length; i++) {
    const mag = Math.pow(10, freqBuffer[i] / 20);
    totalSpectralEnergy += mag;
    if (i >= hfMinBin && i <= hfMaxBin) {
      hfEnergy += mag;
    }
  }
  const hfRatio = hfEnergy / (totalSpectralEnergy + 1e-6);

  // Normalizar vector de croma
  let maxChroma = 0;
  for (let c = 0; c < 12; c++) {
    if (chroma[c] > maxChroma) maxChroma = chroma[c];
  }

  if (maxChroma < 0.005) {
    return { detectedChord: null, confidence: 0, isPolyphonic: false, chroma, candidates: [], hfRatio: 0 };
  }

  let activeNotesCount = 0;
  for (let c = 0; c < 12; c++) {
    chroma[c] /= maxChroma;
    if (chroma[c] > 0.30) activeNotesCount++;
  }

  // Evaluar similitud con todas las plantillas y clasificar candidatos
  const candidates = [];
  for (const [chordName, template] of Object.entries(CHORD_TEMPLATES)) {
    const score = cosineSimilarity(chroma, template);
    candidates.push({ chord: chordName, score });
  }
  candidates.sort((a, b) => b.score - a.score);

  const bestCandidate = candidates[0] || { chord: null, score: 0 };
  const bestChord = bestCandidate.chord;
  const bestScore = bestCandidate.score;

  // Comprobar si coincide con acordes bemoles
  let canonicalName = bestChord;
  for (const [flat, sharp] of Object.entries(CHORD_ALIASES)) {
    if (sharp === bestChord) {
      canonicalName = flat;
      break;
    }
  }

  const isPolyphonic = (activeNotesCount >= 3);

  return {
    detectedChord: bestChord,
    canonicalName,
    confidence: bestScore,
    isPolyphonic,
    activeNotesCount,
    chroma,
    hfRatio,
    candidates: candidates.slice(0, 6)
  };
}

/**
 * Verifica si los picos del croma son simplemente los armónicos naturales
 * de una sola frecuencia fundamental (típico de la voz humana cantando).
 */
export function isHarmonicOfSinglePitch(f0, chroma) {
  if (!f0 || f0 <= 0 || !chroma) return false;
  const midi0 = 12 * Math.log2(f0 / 440) + 69;
  const rootPc = ((Math.round(midi0) % 12) + 12) % 12;

  // Armónicos naturales de una sola nota física f0:
  // H1 = f0 (+0 semitonos -> fundamental)
  // H2 = 2*f0 (+12 semitonos -> octava)
  // H3 = 3*f0 (+19 semitonos -> +7 quinta justa)
  // H4 = 4*f0 (+24 semitonos -> fundamental)
  // H5 = 5*f0 (+28 semitonos -> +4 tercera mayor)
  // H6 = 6*f0 (+31 semitonos -> +7 quinta)
  const harmonicPCs = [rootPc, (rootPc + 7) % 12, (rootPc + 4) % 12];

  let nonHarmonicEnergy = 0;
  let harmonicEnergy = 0;
  for (let c = 0; c < 12; c++) {
    if (chroma[c] > 0.20) {
      if (harmonicPCs.includes(c)) {
        harmonicEnergy += chroma[c];
      } else {
        nonHarmonicEnergy += chroma[c];
      }
    }
  }

  // Si casi toda la energía (>78%) proviene de los armónicos de f0, es una sola fuente armónica
  return (harmonicEnergy > 0.45 && nonHarmonicEnergy < 0.28);
}

/**
 * Clasificador acústico en tiempo real:
 * - 'VOICE': Voz humana (canto / habla con armónicos suaves sin ataque de púa)
 * - 'GUITAR_STRUM': Rasgueo de guitarra (polifonía simultánea con ataque transitorio masivo)
 * - 'GUITAR_ARPEGGIO': Punteo / arpegio de guitarra (cuerda individual con ataque de púa/uña)
 * - 'SILENCE': Silencio o ruido ambiente
 */
export function classifyAcousticSource({
  rms,
  crestFactor,
  onsetRatio,
  isPluckOnset,
  isStrumOnset,
  hfRatio,
  freq,
  yinAperiodicity,
  chordData
}) {
  if (rms < 0.004) return 'SILENCE';

  const isPolyphonic = chordData?.isPolyphonic && (chordData?.activeNotesCount >= 3);
  const hasPickTransient = isPluckOnset || isStrumOnset || (crestFactor >= 3.2 && hfRatio > 0.12);

  // 1. Detección de Voz Humana
  // Voz: envolvente suave (crestFactor < 3.0), sin clic de púa (hfRatio < 0.11), armónicos de un solo f0
  const isHarmonicVoice = (freq > 0 && isHarmonicOfSinglePitch(freq, chordData?.chroma));
  const isVoiceLikeEnvelope = (crestFactor < 3.0 && !hasPickTransient && hfRatio < 0.11);

  if (isVoiceLikeEnvelope && (isHarmonicVoice || !isPolyphonic)) {
    return 'VOICE';
  }

  // 2. Detección de Rasgueo de Guitarra (Strum)
  // Rasgueo: polifonía simultánea real (varias cuerdas independientes) + ataque transitorio
  if (isPolyphonic && (isStrumOnset || crestFactor >= 3.0 || chordData?.confidence > 0.65)) {
    if (!isHarmonicVoice || isStrumOnset || crestFactor >= 3.3) {
      return 'GUITAR_STRUM';
    }
  }

  // 3. Detección de Punteo / Arpegio de Guitarra (Arpeggio)
  // Arpegio: cuerda individual con ataque impulsivo de púa/uña
  if (freq > 0 && (hasPickTransient || crestFactor >= 3.1 || hfRatio > 0.12)) {
    return 'GUITAR_ARPEGGIO';
  }

  // Si tiene alta polifonía sostenida (cuerdas resonando tras rasgueo)
  if (isPolyphonic && chordData?.confidence > 0.58) {
    return 'GUITAR_STRUM';
  }

  // Si es monofónico sin clic evidente pero con sustain de cuerda
  if (freq > 0) {
    return 'GUITAR_ARPEGGIO';
  }

  return 'UNKNOWN';
}

let previousRms = 0;

/**
 * Handler del ScriptProcessor — se llama cada ~93ms.
 * Combina YIN (afinación monofónica) con Chroma FFT (acordes polifónicos).
 * Incorpora SalienceNoiseFloorEstimate dinámico adaptativo y clasificador acústico.
 */
function processAudio(event) {
  const inputData = event.inputBuffer.getChannelData(0);
  const buffer = new Float32Array(inputData);

  // Calcular RMS y Peak (amplitud máxima)
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    const absVal = Math.abs(buffer[i]);
    if (absVal > peak) peak = absVal;
    sumSq += absVal * absVal;
  }
  const rms = Math.sqrt(sumSq / buffer.length);

  // Estimador de suelo de ruido adaptativo (SalienceNoiseFloorEstimate)
  if (rms < noiseFloorRms * 1.6) {
    noiseFloorRms = (noiseFloorRms * 0.94) + (rms * 0.06);
  } else {
    noiseFloorRms = Math.min(0.035, noiseFloorRms + 0.00006);
  }
  const dynamicSilenceThreshold = Math.max(0.0038, noiseFloorRms * 1.55);
  const levelOverNoiseFloor = rms / (noiseFloorRms + 1e-6);

  if (rms < dynamicSilenceThreshold) {
    previousRms = rms;
    onPitchCallback?.({
      active: false,
      freq: -1,
      note: null,
      octave: null,
      cents: 0,
      rms: 0,
      crestFactor: 0,
      onsetRatio: 1.0,
      hfRatio: 0,
      isStrumOnset: false,
      isPluckOnset: false,
      yinAperiodicity: 1.0,
      acousticType: 'SILENCE',
      noiseFloorRms,
      levelOverNoiseFloor: 1.0,
      chordData: null
    });
    return;
  }

  const crestFactor = peak / (rms + 1e-6);
  const onsetRatio = rms / (previousRms + 0.002);
  const isStrumOnset = (onsetRatio > 1.28);
  previousRms = rms;

  // 1. Detección monofónica YIN (para cuerdas individuales y afinador)
  const yinRes = yinPitchDetection(buffer, audioCtx.sampleRate);
  const freq = (typeof yinRes === 'object') ? yinRes.freq : yinRes;
  const aperiodicity = (typeof yinRes === 'object') ? yinRes.aperiodicity : 0.5;
  const noteData = freq > 0 ? freqToNote(freq) : null;

  // 2. Detección polifónica Chroma FFT (para acordes completos y rasgueos)
  const chordData = detectChromaChord(analyserNode, audioCtx.sampleRate);
  const hfRatio = chordData?.hfRatio || 0;
  const isPluckOnset = (crestFactor > 3.0 && (onsetRatio > 1.25 || hfRatio > 0.13));

  // 3. Clasificación Acústica: Voz vs Rasgueo vs Arpegio
  const acousticType = classifyAcousticSource({
    rms,
    crestFactor,
    onsetRatio,
    isPluckOnset,
    isStrumOnset,
    hfRatio,
    freq,
    yinAperiodicity: aperiodicity,
    chordData
  });

  onPitchCallback?.({
    active: true,
    freq: freq > 0 ? freq : -1,
    note: noteData?.note || null,
    octave: noteData?.octave || null,
    cents: noteData?.cents || 0,
    rms,
    peak,
    crestFactor,
    onsetRatio,
    hfRatio,
    isStrumOnset,
    isPluckOnset,
    yinAperiodicity: aperiodicity,
    acousticType,
    noiseFloorRms,
    levelOverNoiseFloor,
    chordData
  });
}

export { isRunning };
