/**
 * notes.js — Base de datos de notas y utilidades de conversión
 * Referencia: A4 = 440 Hz, escala temperada igual (12-TET)
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const A4_FREQ = 440;
const A4_MIDI = 69;

/**
 * Convierte una frecuencia en Hz a número MIDI (puede ser decimal).
 */
export function freqToMidi(freq) {
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
}

/**
 * Convierte número MIDI a frecuencia en Hz.
 */
export function midiToFreq(midi) {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Dada una frecuencia, devuelve la nota más cercana y la desviación en cents.
 * @returns {{ note: string, octave: number, cents: number, freq: number }}
 */
export function freqToNote(freq) {
  if (!freq || freq <= 0) return null;
  const midi = freqToMidi(freq);
  const midiRounded = Math.round(midi);
  const cents = Math.round((midi - midiRounded) * 100);
  const noteIndex = ((midiRounded % 12) + 12) % 12;
  const octave = Math.floor(midiRounded / 12) - 1;
  return {
    note: NOTE_NAMES[noteIndex],
    octave,
    cents,
    midi: midiRounded,
    freq: midiToFreq(midiRounded),
  };
}

/**
 * Afinaciones disponibles.
 * Cada cuerda es { label, freq, midi }
 */
export const TUNINGS = {
  standard: {
    name: 'Standard (EADGBe)',
    strings: [
      { label: 'E2', freq: 82.41 },
      { label: 'A2', freq: 110.00 },
      { label: 'D3', freq: 146.83 },
      { label: 'G3', freq: 196.00 },
      { label: 'B3', freq: 246.94 },
      { label: 'e4', freq: 329.63 },
    ],
  },
  dropD: {
    name: 'Drop D (DADGBe)',
    strings: [
      { label: 'D2', freq: 73.42 },
      { label: 'A2', freq: 110.00 },
      { label: 'D3', freq: 146.83 },
      { label: 'G3', freq: 196.00 },
      { label: 'B3', freq: 246.94 },
      { label: 'e4', freq: 329.63 },
    ],
  },
  openG: {
    name: 'Open G (DGDGBd)',
    strings: [
      { label: 'D2', freq: 73.42 },
      { label: 'G2', freq: 98.00 },
      { label: 'D3', freq: 146.83 },
      { label: 'G3', freq: 196.00 },
      { label: 'B3', freq: 246.94 },
      { label: 'd4', freq: 293.66 },
    ],
  },
  openE: {
    name: 'Open E (EBE G#Be)',
    strings: [
      { label: 'E2', freq: 82.41 },
      { label: 'B2', freq: 123.47 },
      { label: 'E3', freq: 164.81 },
      { label: 'G#3', freq: 207.65 },
      { label: 'B3', freq: 246.94 },
      { label: 'e4', freq: 329.63 },
    ],
  },
  dadgad: {
    name: 'DADGAD',
    strings: [
      { label: 'D2', freq: 73.42 },
      { label: 'A2', freq: 110.00 },
      { label: 'D3', freq: 146.83 },
      { label: 'G3', freq: 196.00 },
      { label: 'A3', freq: 220.00 },
      { label: 'd4', freq: 293.66 },
    ],
  },
  halfDown: {
    name: 'Half Step Down (Eb)',
    strings: [
      { label: 'Eb2', freq: 77.78 },
      { label: 'Ab2', freq: 103.83 },
      { label: 'Db3', freq: 138.59 },
      { label: 'Gb3', freq: 185.00 },
      { label: 'Bb3', freq: 233.08 },
      { label: 'eb4', freq: 311.13 },
    ],
  },
};
