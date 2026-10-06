// Procedural sound effects with the Web Audio API — no audio files needed.
// The AudioContext is created on the first user gesture (browsers require it).

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.held = null;
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      const comp = this.ctx.createDynamicsCompressor();
      comp.connect(this.ctx.destination);
      this.comp = comp;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(comp);
      this._noiseBuffer = this._makeNoise();
      this._ambience();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  _makeNoise() {
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _env(gainNode, t, attack, dur, peak) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  tone({ type = 'sine', freq = 440, to = freq, dur = 0.2, gain = 0.2, attack = 0.005, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    this._env(g, t, attack, dur, gain);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, gain = 0.2, filter = 'lowpass', freq = 1200, to = freq, q = 1, attack = 0.005, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to !== freq) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    this._env(g, t, attack, dur, gain);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  play(name) {
    if (!this.ctx) return;
    const s = SOUNDS[name];
    if (s) s(this);
    this.onPlay?.(name);
  }

  // Continuous hum while holding a cube; pitch follows its size.
  startHeld() {
    if (!this.ctx || this.held) return;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc2.type = 'triangle';
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.08);
    osc.connect(g);
    osc2.connect(g);
    g.connect(this.master);
    osc.start();
    osc2.start();
    this.held = { osc, osc2, g };
  }

  updateHeld(size) {
    if (!this.held) return;
    const f = 70 + 260 / (0.6 + size);
    const t = this.ctx.currentTime;
    this.held.osc.frequency.setTargetAtTime(f, t, 0.05);
    this.held.osc2.frequency.setTargetAtTime(f * 1.503, t, 0.05);
  }

  stopHeld() {
    if (!this.held) return;
    const { osc, osc2, g } = this.held;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0.0001, t, 0.05);
    osc.stop(t + 0.3);
    osc2.stop(t + 0.3);
    this.held = null;
  }

  _ambience() {
    const g = this.ctx.createGain();
    g.gain.value = 0.035;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 180;
    for (const freq of [55, 55.4, 110.3]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.connect(f);
      o.start();
    }
    f.connect(g).connect(this.master);
  }
}

const SOUNDS = {
  step: (s) => s.noise({ dur: 0.07, gain: 0.08, freq: 500 + Math.random() * 300, filter: 'lowpass' }),
  jump: (s) => s.noise({ dur: 0.12, gain: 0.06, freq: 900, to: 400 }),
  land: (s) => {
    s.tone({ freq: 110, to: 45, dur: 0.16, gain: 0.25 });
    s.noise({ dur: 0.1, gain: 0.12, freq: 400 });
  },
  fireBlue: (s) => {
    s.tone({ type: 'triangle', freq: 1100, to: 280, dur: 0.2, gain: 0.14 });
    s.noise({ dur: 0.15, gain: 0.05, filter: 'bandpass', freq: 3000, to: 800, q: 4 });
  },
  fireOrange: (s) => {
    s.tone({ type: 'triangle', freq: 800, to: 200, dur: 0.22, gain: 0.14 });
    s.noise({ dur: 0.15, gain: 0.05, filter: 'bandpass', freq: 2200, to: 600, q: 4 });
  },
  portalOpen: (s) => {
    s.tone({ freq: 180, to: 520, dur: 0.35, gain: 0.12, delay: 0.05 });
    s.noise({ dur: 0.4, gain: 0.07, filter: 'bandpass', freq: 400, to: 2400, q: 3, delay: 0.05 });
  },
  fizzle: (s) => {
    s.tone({ type: 'sawtooth', freq: 260, to: 70, dur: 0.25, gain: 0.07 });
    s.noise({ dur: 0.2, gain: 0.06, filter: 'highpass', freq: 3000 });
  },
  teleport: (s) => {
    s.noise({ dur: 0.35, gain: 0.12, filter: 'bandpass', freq: 2400, to: 300, q: 2 });
    s.tone({ freq: 500, to: 160, dur: 0.3, gain: 0.08 });
  },
  pickup: (s) => s.tone({ freq: 420, to: 760, dur: 0.12, gain: 0.12 }),
  drop: (s) => s.tone({ freq: 600, to: 260, dur: 0.14, gain: 0.1 }),
  thud: (s) => {
    s.tone({ freq: 90, to: 35, dur: 0.3, gain: 0.35 });
    s.noise({ dur: 0.2, gain: 0.15, freq: 300 });
  },
  item: (s) => [660, 880, 1320].forEach((f, i) => s.tone({ freq: f, dur: 0.18, gain: 0.1, delay: i * 0.07 })),
  unlock: (s) => {
    s.tone({ type: 'square', freq: 523, dur: 0.12, gain: 0.05 });
    s.tone({ type: 'square', freq: 784, dur: 0.2, gain: 0.05, delay: 0.1 });
  },
  door: (s) => {
    s.noise({ dur: 1.4, gain: 0.1, freq: 300, to: 1400, attack: 0.15 });
    s.tone({ type: 'sawtooth', freq: 48, to: 60, dur: 1.2, gain: 0.05, attack: 0.1 });
  },
  beep: (s) => s.tone({ type: 'square', freq: 1250, dur: 0.06, gain: 0.04 }),
  error: (s) => {
    s.tone({ type: 'square', freq: 220, dur: 0.15, gain: 0.06 });
    s.tone({ type: 'square', freq: 180, dur: 0.25, gain: 0.06, delay: 0.17 });
  },
  denied: (s) => s.tone({ type: 'square', freq: 160, dur: 0.18, gain: 0.05 }),
  achievement: (s) => [784, 988, 1175, 1568].forEach((f, i) =>
    s.tone({ type: 'triangle', freq: f, dur: 0.3, gain: 0.08, delay: 0.25 + i * 0.08 })),
  hint: (s) => s.tone({ freq: 880, to: 1100, dur: 0.15, gain: 0.06 }),
  ui: (s) => s.tone({ freq: 700, dur: 0.05, gain: 0.04 }),
  win: (s) => [523, 659, 784, 1047, 1319].forEach((f, i) =>
    s.tone({ type: 'triangle', freq: f, dur: 0.5, gain: 0.1, delay: i * 0.12 })),
  warning_tone_0: (s) => s.tone({ type: 'sine', freq: 600, dur: 0.3, gain: 0.08 }),
  warning_tone_1: (s) => s.tone({ type: 'sine', freq: 800, dur: 0.25, gain: 0.12 }),
  warning_tone_2: (s) => {
    s.tone({ type: 'sine', freq: 1000, dur: 0.2, gain: 0.15 });
    s.noise({ dur: 0.15, gain: 0.08, filter: 'highpass', freq: 4000 });
  },
  threat_averted: (s) => [1200, 1500, 1800].forEach((f, i) =>
    s.tone({ type: 'triangle', freq: f, dur: 0.15, gain: 0.08, delay: i * 0.05 })),
  danger_timeout: (s) => {
    s.tone({ type: 'square', freq: 100, dur: 0.5, gain: 0.15 });
    s.noise({ dur: 0.4, gain: 0.12, filter: 'highpass', freq: 2000 });
  },
};
















































































































































































