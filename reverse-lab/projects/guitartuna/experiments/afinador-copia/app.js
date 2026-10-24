/**
 * app.js — Controlador Principal
 * 1. Afinador interactivo con clavijero (Vista Afinar)
 * 2. Avance Automático / SmartScroll idéntico a GuitarTuna (Vista Canciones)
 *    con soporte ChordU / ChordPro, filtro de voz humana vs rasgueo de guitarra,
 *    línea activa en blanco y nota activa en azul.
 */

import { startTuner, stopTuner } from './tuner.js';
import { TUNINGS } from './notes.js';
import { SmartScrollSongEngine, SONGS_CATALOG } from './smartScroll.js';
import { Metronome, MetronomeUI } from './metronome.js';

// ── Estado ────────────────────────────────────────────────────────────────────
let running       = false;
let autoMode      = true;       // Afinador auto
let currentView   = 'tuner';    // 'tuner' | 'songs'
let currentTuning = 'standard';
let smoothedCents = 0;

// ── DOM Vistas ────────────────────────────────────────────────────────────────
const viewTuner       = document.getElementById('view-tuner');
const viewSongs       = document.getElementById('view-songs');
const viewMetronome   = document.getElementById('view-metronome');

const autoToggle      = document.getElementById('auto-toggle');
const instrumentBtn   = document.getElementById('instrument-btn');
const tuningLabel     = document.getElementById('tuning-label');
const tuningSelect    = document.getElementById('tuning-select');

const needleIndicator = document.getElementById('needle-indicator');
const needleCircle    = document.getElementById('needle-circle');

const hintBubble      = document.getElementById('hint-bubble');
const noteDisplay     = document.getElementById('note-display');
const detectedNote    = document.getElementById('detected-note');
const detectedCents   = document.getElementById('detected-cents');

const stringsLeft     = document.getElementById('strings-left');
const stringsRight    = document.getElementById('strings-right');

const errorToast      = document.getElementById('error-toast');

// ── DOM Canciones (GuitarTuna SmartScroll) ─────────────────────────────────────
const btnBackToTuner      = document.getElementById('btn-back-to-tuner');
const gtSongSelect        = document.getElementById('gt-song-select');
const gtCapoDisplay       = document.getElementById('gt-capo-display');
const gtChordsStrip       = document.getElementById('gt-chords-strip');
const autoScrollToggle    = document.getElementById('auto-scroll-toggle');
const btnToggleVoiceFilter = document.getElementById('btn-toggle-voice-filter');
const voiceFilterLabel    = document.getElementById('voice-filter-label');
const btnToggleStrictness = document.getElementById('btn-toggle-strictness');
const strictnessLabel     = document.getElementById('strictness-label');

const songSheetContainer  = document.getElementById('song-sheet-container');
const songSheet           = document.getElementById('song-sheet');

const gtMicDot            = document.getElementById('gt-mic-dot');
const gtCurrentChordName  = document.getElementById('gt-current-chord-name');
const gtMicHeard          = document.getElementById('gt-mic-heard');
const btnRestartSong      = document.getElementById('btn-restart-song');

// ── DOM Nav Bar ───────────────────────────────────────────────────────────────
const navCanciones    = document.getElementById('nav-canciones');
const navTuner        = document.getElementById('nav-tuner');
const navHerramientas = document.getElementById('nav-herramientas');
const btnMetroBack    = document.getElementById('btn-metro-back');
const navItems = ['aprendizaje', 'yousician', 'cuenta'].map(id => document.getElementById(`nav-${id}`));

// ── Instancia del motor SmartScroll ───────────────────────────────────────────
const songEngine = new SmartScrollSongEngine({
  onChordChange: (currentChord, chordIndex) => {
    updateSongSheetUI(currentChord, chordIndex);
  },
  onSongComplete: () => {
    gtCurrentChordName.textContent = '¡Completada! 🎉';
    gtMicHeard.textContent = 'Has tocado toda la canción.';
    gtMicDot.classList.remove('listening-chord-match');
    updateSongSheetUI(null, songEngine.flatChords.length);
  }
});

// ── Helpers afinador ──────────────────────────────────────────────────────────
function getTuneClass(cents) {
  const abs = Math.abs(cents);
  if (abs <= 5)  return 'in-tune';
  if (abs <= 15) return 'close-tune';
  return 'off-tune';
}

function updateNeedle(cents, tuneClass) {
  const clamped = Math.max(-50, Math.min(50, cents));
  smoothedCents = smoothedCents * 0.6 + clamped * 0.4;
  const pct = ((smoothedCents + 50) / 100) * 100;
  needleIndicator.style.left = `${pct}%`;
  needleCircle.className = `needle-circle ${tuneClass}`;
}

function resetNeedle() {
  smoothedCents = 0;
  needleIndicator.style.left = '50%';
  needleCircle.className = 'needle-circle';
}

// ── Callback del micrófono (YIN Pitch Detection + Onset) ──────────────────────
function onPitch(data) {
  if (currentView === 'tuner') {
    handleTunerPitch(data);
  } else if (currentView === 'songs') {
    handleSongsPitch(data);
  }
}

function handleTunerPitch(data) {
  if (!data.active || !data.note) {
    showHint();
    resetNeedle();
    return;
  }

  const { note, cents, freq } = data;
  const tuneClass = getTuneClass(cents);

  hintBubble.classList.add('hidden');
  noteDisplay.classList.add('visible');

  detectedNote.textContent = note;
  detectedNote.className   = `detected-note ${tuneClass}`;

  const sign = cents >= 0 ? '+' : '';
  detectedCents.textContent = `${sign}${cents} cents · ${freq.toFixed(1)} Hz`;

  updateNeedle(cents, tuneClass);
  highlightClosestString(freq);
}

function handleSongsPitch(data) {
  const current = songEngine.getCurrentChord();
  if (!current) return;

  const evalResult = songEngine.evaluatePitch(data);
  const chord = data.chordData;

  // 1. Acorde repetido consecutivo que requiere nuevo rasgueo (StayWithinSameChord)
  if (evalResult.requiresFreshOnset) {
    gtMicHeard.textContent = evalResult.diagnostic || `🎸 Vuelve a rasguear para avanzar al acorde repetido [${current.chord}]`;
    gtMicDot.classList.remove('listening-chord-match');
    return;
  }

  // 2. Filtro de voz humana (identificada y rechazada)
  if (evalResult.voiceIgnored) {
    gtMicHeard.textContent = evalResult.diagnostic || `🎤 Voz detectada (${evalResult.detectedNote || data.note}) — rasguea o puntea en la guitarra`;
    gtMicDot.classList.remove('listening-chord-match');
    return;
  }

  // 3. Punteo / Arpegio en progreso (1/2 notas detectadas)
  if (evalResult.inArpeggio) {
    gtMicHeard.textContent = evalResult.diagnostic;
    gtMicDot.classList.add('listening-chord-match');
    return;
  }

  // 4. Diagnóstico de traste desplazado (WrongFret)
  if (evalResult.wrongFret) {
    gtMicHeard.textContent = evalResult.diagnostic;
    gtMicDot.classList.remove('listening-chord-match');
    return;
  }

  // 5. Acierto / Avance del acorde (sea por Rasgueo o por Arpegio)
  if (evalResult.isMatch) {
    const jumpTag = evalResult.isJump ? ' ⚡ (Salto inteligente)' : '';
    let detail = '';

    if (evalResult.matchType === 'arpeggio') {
      detail = `🎼 ¡Arpegio de ${current.chord} completado! (Notas: ${evalResult.arpeggioNotes?.join(', ') || ''})${jumpTag}`;
    } else if (evalResult.oneStringMuted) {
      detail = `🎸 ¡Acorde ${current.chord} aceptado! (Cuerda apagada tolerada)${jumpTag}`;
    } else if (evalResult.overStrum) {
      detail = `🎸 ¡Acorde ${current.chord} aceptado! (Bajo accidental ignorado)${jumpTag}`;
    } else {
      detail = `🎸 ¡Rasgueo de ${current.chord} detectado!${jumpTag}`;
    }

    gtMicHeard.textContent = detail;
    gtMicDot.classList.add('listening-chord-match');
    return;
  }

  // 5. Retroalimentación en tiempo real de lo que escucha el micrófono
  if (chord && chord.canonicalName && chord.confidence > 0.45) {
    gtMicHeard.textContent = `Escuchando acorde: ${chord.canonicalName} (${Math.round(chord.confidence * 100)}%) — objetivo: ${current.chord}`;
    gtMicDot.classList.remove('listening-chord-match');
  } else if (data.active && data.note) {
    gtMicHeard.textContent = `Cuerda suelta: nota ${data.note} (${data.freq.toFixed(1)} Hz) — objetivo: ${current.chord}`;
    gtMicDot.classList.remove('listening-chord-match');
  } else {
    gtMicHeard.textContent = `Toca o rasguea el acorde ${current.chord} en la guitarra`;
    gtMicDot.classList.remove('listening-chord-match');
  }
}

function showHint() {
  hintBubble.classList.remove('hidden');
  noteDisplay.classList.remove('visible');
  clearStringHighlights();
}

// ── Clavijero Afinador ────────────────────────────────────────────────────────
function renderStrings(tuningKey) {
  const { strings } = TUNINGS[tuningKey];
  stringsLeft.innerHTML  = '';
  stringsRight.innerHTML = '';

  [0, 1, 2].forEach(i => stringsLeft.appendChild(makeStringBtn(strings[i], i)));
  [3, 4, 5].forEach(i => stringsRight.appendChild(makeStringBtn(strings[i], i)));
}

function makeStringBtn(str, idx) {
  const btn = document.createElement('button');
  btn.className = 'string-btn';
  btn.dataset.idx  = idx;
  btn.dataset.freq = str.freq;
  btn.textContent  = str.label.replace(/\d/g, '');
  btn.setAttribute('aria-label', `Cuerda ${idx + 1}: ${str.label}`);
  return btn;
}

function highlightClosestString(detectedFreq) {
  const { strings } = TUNINGS[currentTuning];
  let closestIdx  = 0;
  let closestDist = Infinity;

  strings.forEach((s, i) => {
    const dist = Math.abs(s.freq - detectedFreq);
    if (dist < closestDist) { closestDist = dist; closestIdx = i; }
  });

  const threshold = strings[closestIdx].freq * 0.07;
  document.querySelectorAll('.string-btn').forEach((btn) => {
    btn.classList.toggle('active',
      Number(btn.dataset.idx) === closestIdx && closestDist < threshold
    );
  });
}

function clearStringHighlights() {
  document.querySelectorAll('.string-btn').forEach(b => b.classList.remove('active'));
}

// ── Canciones: Renderizado de la letra y acordes ChordPro ─────────────────────
function renderCurrentSong() {
  songSheet.innerHTML = '';
  const song = songEngine.song;

  // Actualizar resumen de acordes y cejillo
  gtCapoDisplay.textContent = `Cejillo: ${song.capo || 'Sin cejillo'}`;
  gtChordsStrip.innerHTML = song.chordsSummary
    .map(c => `<span class="gt-chord-badge">${c}</span>`)
    .join('<span class="gt-divider">|</span>');

  song.lines.forEach((line, lIdx) => {
    // Si la línea es un encabezado de sección ({sov} -> ESTROFA 1, 2, 3...)
    if (line.sectionHeader) {
      const pill = document.createElement('div');
      pill.className = 'gt-section-pill';
      pill.textContent = line.sectionHeader;
      songSheet.appendChild(pill);
      return;
    }

    const lineBlock = document.createElement('div');
    lineBlock.className = 'gt-line-block';
    lineBlock.id = `gt-line-${lIdx}`;

    const chordLyricRow = document.createElement('div');
    chordLyricRow.className = 'gt-chord-lyric-row';

    line.items.forEach((item, iIdx) => {
      const pair = document.createElement('span');
      pair.className = 'gt-chord-lyric-pair';

      const chordSpan = document.createElement('span');
      chordSpan.className = 'gt-chord-cell';
      chordSpan.id = `chord-${lIdx}-${iIdx}`;
      chordSpan.textContent = item.chord || '-';

      if (!item.chord) {
        chordSpan.classList.add('empty-chord');
      } else {
        chordSpan.addEventListener('click', () => {
          const flatIdx = songEngine.flatChords.findIndex(c => c.id === chordSpan.id);
          if (flatIdx !== -1) songEngine.setChordIndex(flatIdx);
        });
      }

      const lyricSpan = document.createElement('span');
      lyricSpan.className = 'gt-lyric-cell';
      lyricSpan.textContent = item.lyric || '';

      pair.appendChild(chordSpan);
      pair.appendChild(lyricSpan);
      chordLyricRow.appendChild(pair);
    });

    lineBlock.appendChild(chordLyricRow);
    songSheet.appendChild(lineBlock);
  });

  updateSongSheetUI(songEngine.getCurrentChord(), songEngine.activeChordIndex);
}

function initSongSheet() {
  // Selector de canción
  gtSongSelect.addEventListener('change', (e) => {
    songEngine.setSong(e.target.value);
    renderCurrentSong();
  });

  // Botones de versión: Simplificada vs Original
  const btnTabSimplified = document.getElementById('btn-tab-simplified');
  const btnTabOriginal   = document.getElementById('btn-tab-original');

  btnTabSimplified?.addEventListener('click', () => {
    btnTabSimplified.classList.add('active');
    btnTabOriginal.classList.remove('active');
    songEngine.setVersion(true);
    renderCurrentSong();
  });

  btnTabOriginal?.addEventListener('click', () => {
    btnTabOriginal.classList.add('active');
    btnTabSimplified.classList.remove('active');
    songEngine.setVersion(false);
    renderCurrentSong();
  });

  // Toggle Avance Automático
  autoScrollToggle.addEventListener('click', () => {
    const isEnabled = songEngine.toggleAutoScroll();
    autoScrollToggle.classList.toggle('off', !isEnabled);
    autoScrollToggle.setAttribute('aria-checked', String(isEnabled));
  });

  // Toggle Filtro de Voz Humana
  btnToggleVoiceFilter.addEventListener('click', () => {
    const isEnabled = songEngine.toggleVoiceRejection();
    btnToggleVoiceFilter.classList.toggle('active', isEnabled);
    voiceFilterLabel.textContent = isEnabled ? 'Filtro Voz: ACTIVO' : 'Filtro Voz: APAGADO';
  });

  // Toggle Tolerancia de Acordes (GuitarTuna StrictnessParameters)
  btnToggleStrictness?.addEventListener('click', () => {
    const mode = songEngine.toggleStrictness();
    btnToggleStrictness.classList.toggle('strict', mode === 'strict');
    strictnessLabel.textContent = (mode === 'learner') ? 'Aprendiz' : 'Pro (Estricto)';
  });

  // Botón Reiniciar
  btnRestartSong.addEventListener('click', () => {
    songEngine.reset();
  });

  // Volver a la vista Afinador
  btnBackToTuner.addEventListener('click', () => {
    switchView('tuner');
  });

  renderCurrentSong();
}

// ── Animador de Scroll Suave (Inspirado en SmartScrollPlayPositionEstimator) ──
let scrollAnimationId = null;
let lastActiveLineIndex = -1;

function smoothScrollToLine(container, lineEl, duration = 480) {
  if (!container || !lineEl) return;
  if (scrollAnimationId) cancelAnimationFrame(scrollAnimationId);

  const containerRect = container.getBoundingClientRect();
  const lineRect = lineEl.getBoundingClientRect();

  // Calcular la posición absoluta de destino
  const currentScroll = container.scrollTop;
  const relativeOffset = lineRect.top - containerRect.top;
  const targetScroll = currentScroll + relativeOffset - (containerRect.height * 0.32);

  const startY = currentScroll;
  const distance = targetScroll - startY;
  const startTime = performance.now();

  // Curva de desaceleración suave (Cubic Ease Out)
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(1, elapsed / duration);
    const ease = easeOutCubic(progress);

    container.scrollTop = startY + (distance * ease);

    if (progress < 1) {
      scrollAnimationId = requestAnimationFrame(step);
    } else {
      scrollAnimationId = null;
    }
  }

  scrollAnimationId = requestAnimationFrame(step);
}

/**
 * Actualiza el estado visual:
 * - La línea que se toca en BLANCO (active-line)
 * - La nota/acorde activo en AZUL (active-chord)
 * - Scroll cinemático amortiguado (solo cuando cambia de línea)
 */
function updateSongSheetUI(currentChord, activeFlatIndex) {
  document.querySelectorAll('.gt-line-block').forEach(el => el.classList.remove('active-line'));
  document.querySelectorAll('.gt-chord-cell').forEach(el => {
    el.classList.remove('active-chord');
    el.classList.remove('past-chord');
  });

  // Acordes pasados
  songEngine.flatChords.forEach((c, idx) => {
    const el = document.getElementById(c.id);
    if (!el) return;
    if (idx < activeFlatIndex) {
      el.classList.add('past-chord');
    }
  });

  if (currentChord) {
    // 1. Línea activa en blanco
    const activeLineEl = document.getElementById(`gt-line-${currentChord.lineIndex}`);
    if (activeLineEl) {
      activeLineEl.classList.add('active-line');

      // 2. Scroll suave solo si cambiamos de línea (evita tirones en acordes de la misma línea)
      if (songEngine.enabled && songSheetContainer && currentChord.lineIndex !== lastActiveLineIndex) {
        lastActiveLineIndex = currentChord.lineIndex;
        smoothScrollToLine(songSheetContainer, activeLineEl);
      }
    }

    // 3. Nota activa en color azul brillante
    const activeChordEl = document.getElementById(currentChord.id);
    if (activeChordEl) {
      activeChordEl.classList.add('active-chord');
    }

    gtCurrentChordName.textContent = currentChord.chord;
    gtMicHeard.textContent = `Toca el acorde ${currentChord.chord} en la guitarra`;
  } else {
    lastActiveLineIndex = -1;
  }
}

// ── Control de navegación ─────────────────────────────────────────────────────
function switchView(viewName) {
  currentView = viewName;
  viewTuner.style.display = (viewName === 'tuner') ? 'flex' : 'none';
  viewSongs.style.display = (viewName === 'songs') ? 'flex' : 'none';
  viewMetronome.style.display = (viewName === 'metronome') ? 'flex' : 'none';

  navCanciones.classList.toggle('active', viewName === 'songs');
  navTuner.classList.toggle('active', viewName === 'tuner');
  navHerramientas.classList.toggle('active', viewName === 'metronome');

  if (viewName === 'songs') {
    updateSongSheetUI(songEngine.getCurrentChord(), songEngine.activeChordIndex);
  }
}

navCanciones.addEventListener('click', () => switchView('songs'));
navTuner.addEventListener('click', () => switchView('tuner'));
navHerramientas.addEventListener('click', () => switchView('metronome'));
btnMetroBack?.addEventListener('click', () => switchView('tuner'));

navItems.forEach(item => {
  item?.addEventListener('click', () => {
    showError('Esta sección está en desarrollo.');
  });
});

// ── Metrónomo (GuitarTuna Clone) ──────────────────────────────────────────────
const metronome = new Metronome({
  initialBpm: 136,
  initialTimeSignature: '4/4'
});

const metroUI = new MetronomeUI(metronome, {
  bpmNumber: document.getElementById('metro-bpm-num'),
  btnMinus: document.getElementById('btn-metro-minus'),
  btnPlus: document.getElementById('btn-metro-plus'),
  dialArea: document.getElementById('metro-dial-area'),
  dialTicksSvg: document.getElementById('metro-dial-ticks'),
  dialKnob: document.getElementById('metro-dial-knob'),
  btnPlayPause: document.getElementById('btn-metro-play-pause'),
  btnTapTempo: document.getElementById('btn-metro-tap'),
  dotsContainer: document.getElementById('metro-dots-container'),
  btnTimeSignature: document.getElementById('btn-metro-sig')
});

// Modal de selección de compás (Time Signature)
const metroSigModal = document.getElementById('metro-sig-modal');
const btnCloseSigModal = document.getElementById('btn-close-sig-modal');
const btnMetroSig = document.getElementById('btn-metro-sig');
const modalOptions = document.querySelectorAll('.metro-modal-opt');

modalOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    const sig = opt.dataset.sig;
    metronome.setTimeSignature(sig);
    btnMetroSig.textContent = sig;
    modalOptions.forEach(o => o.classList.toggle('active', o.dataset.sig === sig));
    metroUI.renderDots();
    metroSigModal.classList.remove('open');
  });
});

btnCloseSigModal?.addEventListener('click', () => {
  metroSigModal.classList.remove('open');
});

metroSigModal?.addEventListener('click', (e) => {
  if (e.target === metroSigModal) {
    metroSigModal.classList.remove('open');
  }
});

// ── Micrófono / Web Audio Engine ──────────────────────────────────────────────
async function startAudioEngine() {
  if (running) return;
  try {
    await startTuner(onPitch);
    running = true;
  } catch (err) {
    showError(`Micrófono: ${err.message}`);
  }
}

function stopAudioEngine() {
  if (!running) return;
  stopTuner();
  running = false;
  showHint();
  resetNeedle();
}

autoToggle.addEventListener('click', () => {
  autoMode = !autoMode;
  autoToggle.classList.toggle('off', !autoMode);
  autoToggle.setAttribute('aria-checked', String(autoMode));
  if (autoMode) startAudioEngine();
  else stopAudioEngine();
});

instrumentBtn.addEventListener('click', () => {
  tuningSelect.style.display = 'block';
  tuningSelect.focus();
  tuningSelect.click();
});

tuningSelect.addEventListener('change', (e) => {
  currentTuning = e.target.value;
  tuningLabel.textContent = TUNINGS[currentTuning].name.split('(')[0].trim();
  tuningSelect.style.display = 'none';
  renderStrings(currentTuning);
  clearStringHighlights();
});

tuningSelect.addEventListener('blur', () => {
  tuningSelect.style.display = 'none';
});

let errorTimer;
function showError(msg) {
  clearTimeout(errorTimer);
  errorToast.textContent = msg;
  errorToast.classList.add('show');
  errorTimer = setTimeout(() => errorToast.classList.remove('show'), 4000);
}

// ── Inicialización ────────────────────────────────────────────────────────────
renderStrings(currentTuning);
initSongSheet();

if (autoMode) {
  setTimeout(startAudioEngine, 350);
}

window.addEventListener('beforeunload', () => {
  if (running) stopTuner();
});
