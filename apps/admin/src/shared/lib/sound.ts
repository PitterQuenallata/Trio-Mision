// Blakor Web Audio Sound Synthesizer (Zero-latency Apple-like haptic audio feedback)

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.25;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('blakor_sound_enabled');
      this.enabled = stored !== null ? stored === 'true' : true;
      const storedVol = localStorage.getItem('blakor_sound_volume');
      if (storedVol) this.volume = parseFloat(storedVol);
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('blakor_sound_enabled', String(enabled));
    }
    if (enabled) {
      this.play('pop');
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('blakor_sound_volume', String(this.volume));
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public play(type: 'click' | 'pop' | 'tab' | 'toggle' | 'switch' | 'success' | 'alert' = 'click') {
    if (!this.enabled || this.volume <= 0) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      switch (type) {
        case 'click': {
          // Subtle micro-tap (Apple trackpad haptic feel)
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(120, now + 0.035);
          gain.gain.setValueAtTime(this.volume * 0.45, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
          osc.start(now);
          osc.stop(now + 0.036);
          break;
        }

        case 'switch': {
          // Subtle airy click for theme / view transitions
          osc.type = 'sine';
          osc.frequency.setValueAtTime(520, now);
          osc.frequency.exponentialRampToValueAtTime(180, now + 0.03);
          gain.gain.setValueAtTime(this.volume * 0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
          osc.start(now);
          osc.stop(now + 0.031);
          break;
        }

        case 'tab': {
          // Smooth navigation tap
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
          gain.gain.setValueAtTime(this.volume * 0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.041);
          break;
        }

        case 'pop': {
          // Pleasant pop for switches / toggles
          osc.type = 'sine';
          osc.frequency.setValueAtTime(450, now);
          osc.frequency.exponentialRampToValueAtTime(780, now + 0.05);
          gain.gain.setValueAtTime(this.volume * 0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.051);
          break;
        }

        case 'toggle': {
          // Crisp toggle click
          osc.type = 'sine';
          osc.frequency.setValueAtTime(620, now);
          osc.frequency.exponentialRampToValueAtTime(220, now + 0.04);
          gain.gain.setValueAtTime(this.volume * 0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.041);
          break;
        }

        case 'success': {
          // Dual soft harmonic chime
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, now); // D5
          osc.frequency.setValueAtTime(880, now + 0.06); // A5
          gain.gain.setValueAtTime(this.volume * 0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.start(now);
          osc.stop(now + 0.19);
          break;
        }

        case 'alert': {
          // Subtle soft caution
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.setValueAtTime(260, now + 0.05);
          gain.gain.setValueAtTime(this.volume * 0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.13);
          break;
        }
      }
    } catch {
      // Graceful silence if audio isn't supported
    }
  }
}

export const sound = new SoundManager();
