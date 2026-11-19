// Sound: WebAudio synth — engine hum, gunshot, pickup blips, siren, UI clicks.
// Everything is generated; no audio files.

const AudioSys = {
  ctx: null,
  engineOsc: null,
  engineGain: null,
  sirenOsc: null,
  sirenGain: null,

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // Engine: a low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      // Siren: a triangle that wails between two tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 660;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
    } catch (e) { this.ctx = null; }
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  setEngine(speed01, on) {
    if (!this.ctx || SOL.muted) { if (this.engineGain) this.engineGain.gain.value = 0; return; }
    this.engineOsc.frequency.value = 55 + speed01 * 130;
    this.engineGain.gain.value = on ? 0.05 + speed01 * 0.05 : 0;
  },

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !SOL.muted) {
      this.sirenGain.gain.value = 0.035;
      const t = this.ctx.currentTime;
      this.sirenOsc.frequency.cancelScheduledValues(t);
      this.sirenOsc.frequency.setValueAtTime(660, t);
      this.sirenOsc.frequency.linearRampToValueAtTime(880, t + 0.45);
      this.sirenOsc.frequency.linearRampToValueAtTime(660, t + 0.9);
    } else {
      this.sirenGain.gain.value = 0;
    }
  },

  blip(freq, dur, type, vol) {
    if (!this.ctx || SOL.muted) return;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  },

  noise(dur, vol) {
    if (!this.ctx || SOL.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(g); g.connect(this.ctx.destination);
    src.start();
  },

  gunshot() { this.noise(0.16, 0.3); },
  punch() { this.noise(0.08, 0.15); this.blip(120, 0.08, 'square', 0.08); },
  pickup() { this.blip(660, 0.09, 'sine', 0.12); setTimeout(() => this.blip(990, 0.12, 'sine', 0.12), 70); },
  cash() { this.blip(880, 0.1, 'sine', 0.12); setTimeout(() => this.blip(1320, 0.16, 'sine', 0.12), 90); },
  click() { this.blip(440, 0.05, 'square', 0.06); },
  busted() { this.blip(220, 0.4, 'sawtooth', 0.12); },
};
