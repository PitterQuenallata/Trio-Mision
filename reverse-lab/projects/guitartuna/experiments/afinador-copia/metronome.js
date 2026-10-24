/**
 * metronome.js — Motor de Metrónomo Profesional y UI Dial (GuitarTuna Clone)
 *
 * Características:
 * - Scheduler de alta precisión con Web Audio API (cero drift / latencia).
 * - Sonido de madera / woodblock percusivo idéntico a GuitarTuna (acento en pulso 1).
 * - Dial circular interactivo con ticks radiales en verde esmeralda (#22d4a3).
 * - Arrastre fluido de 30 a 240 BPM en arco de 270°.
 * - Tap Tempo con cálculo de promedio de intervalos.
 * - Puntos de compás visuales interactivos y selección de compás (1/4, 2/4, 3/4, 4/4, 5/4, 6/8).
 */

export class Metronome {
  constructor(options = {}) {
    this.bpm = options.initialBpm || 136;
    this.timeSignature = options.initialTimeSignature || '4/4';
    this.beatsPerMeasure = 4;
    this.updateBeatsFromSignature();

    this.isPlaying = false;
    this.currentBeat = 0;

    // Web Audio API
    this.audioCtx = null;
    this.nextNoteTime = 0.0;
    this.timerId = null;
    this.scheduleAheadTime = 0.12; // 120ms lookahead
    this.lookaheadInterval = 25;   // 25ms interval check

    // Cola de dibujo para sincronización exacta audio-visual
    this.drawQueue = [];
    this.animFrameId = null;

    // Tap tempo
    this.tapTimes = [];

    // Callbacks
    this.onBeat = options.onBeat || null;
    this.onBpmChange = options.onBpmChange || null;
    this.onPlayStateChange = options.onPlayStateChange || null;
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  updateBeatsFromSignature() {
    const parts = this.timeSignature.split('/');
    this.beatsPerMeasure = parseInt(parts[0], 10) || 4;
  }

  setTimeSignature(sig) {
    this.timeSignature = sig;
    this.updateBeatsFromSignature();
    this.currentBeat = 0;
  }

  setBpm(newBpm) {
    const clamped = Math.max(30, Math.min(240, Math.round(newBpm)));
    if (clamped !== this.bpm) {
      this.bpm = clamped;
      if (this.onBpmChange) this.onBpmChange(this.bpm);
    }
  }

  incrementBpm(delta = 1) {
    this.setBpm(this.bpm + delta);
  }

  decrementBpm(delta = 1) {
    this.setBpm(this.bpm - delta);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
    return this.isPlaying;
  }

  async start() {
    if (this.isPlaying) return;
    this.initAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (e) {}
    }

    this.isPlaying = true;
    this.currentBeat = 0;
    this.nextNoteTime = (this.audioCtx ? this.audioCtx.currentTime : 0) + 0.05;
    this.drawQueue = [];

    this.scheduler();
    this.startVisualSync();

    if (this.onPlayStateChange) this.onPlayStateChange(true);
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    clearTimeout(this.timerId);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.drawQueue = [];
    this.currentBeat = 0;

    if (this.onPlayStateChange) this.onPlayStateChange(false);
    if (this.onBeat) this.onBeat(-1); // Reset beat indicator
  }

  scheduler() {
    if (!this.isPlaying) return;

    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.nextNote();
    }

    this.timerId = setTimeout(() => this.scheduler(), this.lookaheadInterval);
  }

  nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeat = (this.currentBeat + 1) % this.beatsPerMeasure;
  }

  scheduleNote(beatNumber, time) {
    this.drawQueue.push({ beat: beatNumber, time });
    this.playClick(beatNumber === 0, time);
  }

  playClick(isAccent, time) {
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const playTime = Math.max(time, this.audioCtx.currentTime);

      // Sonido percusivo de metrónomo (Woodblock / Click sintetizado)
      if (isAccent) {
        // Pulso 1: Acento agudo y penetrante
        osc.frequency.setValueAtTime(1400, playTime);
        osc.frequency.exponentialRampToValueAtTime(700, playTime + 0.04);
        gain.gain.setValueAtTime(0.75, playTime);
        gain.gain.exponentialRampToValueAtTime(0.001, playTime + 0.045);
        osc.stop(playTime + 0.05);
      } else {
        // Pulsos secundarios: Tono medio más cálido
        osc.frequency.setValueAtTime(950, playTime);
        osc.frequency.exponentialRampToValueAtTime(450, playTime + 0.035);
        gain.gain.setValueAtTime(0.45, playTime);
        gain.gain.exponentialRampToValueAtTime(0.001, playTime + 0.038);
        osc.stop(playTime + 0.04);
      }

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(playTime);
    } catch (e) {
      // Audio clock error catch
    }
  }

  startVisualSync() {
    const loop = () => {
      if (!this.isPlaying) return;

      const currentTime = this.audioCtx.currentTime;
      while (this.drawQueue.length > 0 && this.drawQueue[0].time <= currentTime) {
        const item = this.drawQueue.shift();
        if (this.onBeat) this.onBeat(item.beat);
      }

      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  tapTempo() {
    const now = performance.now();
    // Limpiar taps más antiguos de 2500 ms
    this.tapTimes = this.tapTimes.filter(t => (now - t) < 2500);
    this.tapTimes.push(now);

    if (this.tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this.tapTimes.length; i++) {
        intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval > 0) {
        const calculatedBpm = Math.round(60000 / avgInterval);
        this.setBpm(calculatedBpm);
      }
    }
  }
}

/**
 * Controlador de la interfaz del Metrónomo (Dial Circular SVG + Controles)
 */
export class MetronomeUI {
  constructor(metronome, elements = {}) {
    this.m = metronome;
    this.els = elements;

    this.isDragging = false;

    // Vincular callbacks del metrónomo
    this.m.onBeat = (beat) => this.renderBeat(beat);
    this.m.onBpmChange = (bpm) => this.renderBpm(bpm);
    this.m.onPlayStateChange = (isPlaying) => this.renderPlayState(isPlaying);

    this.initEvents();
    this.renderDialTicks();
    this.renderBpm(this.m.bpm);
    this.renderDots();
    this.renderPlayState(this.m.isPlaying);
  }

  initEvents() {
    // Botones + y -
    this.els.btnPlus?.addEventListener('click', () => this.m.incrementBpm(1));
    this.els.btnMinus?.addEventListener('click', () => this.m.decrementBpm(1));

    // Botón Play / Pause central
    this.els.btnPlayPause?.addEventListener('click', () => this.m.togglePlay());

    // Botón Tap Tempo
    this.els.btnTapTempo?.addEventListener('click', () => {
      this.m.tapTempo();
      this.triggerTapAnimation();
    });

    // Medida de compás (Pill)
    this.els.btnTimeSignature?.addEventListener('click', () => {
      this.openTimeSignatureModal();
    });

    // Interacción táctil / ratón con el Dial Circular
    this.initDialInteraction();
  }

  triggerTapAnimation() {
    if (this.els.btnTapTempo) {
      this.els.btnTapTempo.classList.add('tapping');
      setTimeout(() => this.els.btnTapTempo.classList.remove('tapping'), 150);
    }
  }

  /**
   * Renderiza los ticks radiales del dial en SVG
   * Arco de 270°: de 135° (30 BPM) a 405° (240 BPM)
   */
  renderDialTicks() {
    if (!this.els.dialTicksSvg) return;

    const svg = this.els.dialTicksSvg;
    svg.innerHTML = '';

    const cx = 150;
    const cy = 150;
    const rIn = 100;
    const rOut = 126;
    const totalTicks = 84;

    const startAngle = 135;
    const sweep = 270;

    for (let i = 0; i <= totalTicks; i++) {
      const angleDeg = startAngle + (i / totalTicks) * sweep;
      const angleRad = (angleDeg * Math.PI) / 180;

      const isMajor = (i % 7 === 0);
      const inner = isMajor ? (rIn - 2) : rIn;
      const outer = isMajor ? (rOut + 2) : rOut;

      const x1 = cx + inner * Math.cos(angleRad);
      const y1 = cy + inner * Math.sin(angleRad);
      const x2 = cx + outer * Math.cos(angleRad);
      const y2 = cy + outer * Math.sin(angleRad);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(1));
      line.setAttribute('y1', y1.toFixed(1));
      line.setAttribute('x2', x2.toFixed(1));
      line.setAttribute('y2', y2.toFixed(1));
      line.setAttribute('stroke', '#22d4a3');
      line.setAttribute('stroke-width', isMajor ? '2.2' : '1.3');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', isMajor ? '0.95' : '0.65');
      svg.appendChild(line);
    }
  }

  bpmToAngle(bpm) {
    const clamped = Math.max(30, Math.min(240, bpm));
    const pct = (clamped - 30) / (240 - 30);
    return 135 + pct * 270; // grados
  }

  angleToBpm(angleDeg) {
    let norm = (angleDeg % 360 + 360) % 360; // 0..360
    if (norm < 90) norm += 360; // 90..450

    // El arco va de 135 a 405 (90..135 es el hueco)
    if (norm < 135 && norm >= 90) {
      norm = (norm > 112.5) ? 135 : 405;
    } else if (norm > 405) {
      norm = 405;
    }

    const pct = (norm - 135) / 270;
    return Math.round(30 + pct * 210);
  }

  updateKnobPosition(bpm) {
    if (!this.els.dialKnob) return;

    const angleDeg = this.bpmToAngle(bpm);
    const angleRad = (angleDeg * Math.PI) / 180;
    const cx = 150;
    const cy = 150;
    const rKnob = 113;

    const x = cx + rKnob * Math.cos(angleRad);
    const y = cy + rKnob * Math.sin(angleRad);

    this.els.dialKnob.setAttribute('cx', x.toFixed(1));
    this.els.dialKnob.setAttribute('cy', y.toFixed(1));
  }

  initDialInteraction() {
    const dialArea = this.els.dialArea;
    if (!dialArea) return;

    const handlePointer = (clientX, clientY) => {
      const rect = dialArea.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = clientX - cx;
      const dy = clientY - cy;
      const rad = Math.atan2(dy, dx);
      let deg = (rad * 180) / Math.PI;

      const calculatedBpm = this.angleToBpm(deg);
      this.m.setBpm(calculatedBpm);
    };

    dialArea.addEventListener('pointerdown', (e) => {
      // Ignorar si se pulsó en el botón play/pause o en el tap tempo interior
      if (e.target.closest('.metro-center-controls')) return;

      this.isDragging = true;
      dialArea.setPointerCapture(e.pointerId);
      handlePointer(e.clientX, e.clientY);
    });

    dialArea.addEventListener('pointermove', (e) => {
      if (this.isDragging) {
        handlePointer(e.clientX, e.clientY);
      }
    });

    const stopDrag = (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        try { dialArea.releasePointerCapture(e.pointerId); } catch (err) {}
      }
    };

    dialArea.addEventListener('pointerup', stopDrag);
    dialArea.addEventListener('pointercancel', stopDrag);
  }

  renderBpm(bpm) {
    if (this.els.bpmNumber) {
      this.els.bpmNumber.textContent = bpm;
    }
    this.updateKnobPosition(bpm);
  }

  renderPlayState(isPlaying) {
    if (this.els.btnPlayPause) {
      this.els.btnPlayPause.classList.toggle('playing', isPlaying);
      this.els.btnPlayPause.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Iniciar');

      // Icono: Dos barras verticales (II) cuando está reproduciendo, triángulo cuando está detenido
      if (isPlaying) {
        this.els.btnPlayPause.innerHTML = `
          <svg width="26" height="28" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="3" width="4.5" height="18" rx="2.2" />
            <rect x="14.5" y="3" width="4.5" height="18" rx="2.2" />
          </svg>`;
      } else {
        this.els.btnPlayPause.innerHTML = `
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,3 20,12 6,21" />
          </svg>`;
      }
    }
  }

  renderDots() {
    if (!this.els.dotsContainer) return;
    this.els.dotsContainer.innerHTML = '';

    for (let i = 0; i < this.m.beatsPerMeasure; i++) {
      const dot = document.createElement('div');
      dot.className = 'metro-dot';
      dot.id = `metro-dot-${i}`;
      this.els.dotsContainer.appendChild(dot);
    }
  }

  renderBeat(beat) {
    const dots = this.els.dotsContainer?.querySelectorAll('.metro-dot');
    if (!dots) return;

    dots.forEach((dot, idx) => {
      dot.classList.remove('active', 'accent');
      if (idx === beat) {
        dot.classList.add('active');
        if (beat === 0) dot.classList.add('accent');
      }
    });
  }

  openTimeSignatureModal() {
    const modal = document.getElementById('metro-sig-modal');
    if (modal) {
      modal.classList.add('open');
    }
  }
}
