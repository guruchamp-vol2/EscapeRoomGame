// Generative, adaptive soundtrack. Every world gets its own key, scale, tempo
// and instruments; layers build up as the player solves a level:
//   0  menu / just arrived  — pads and a sparse bell melody
//   1  playing              — + bass and arpeggio
//   2  final objective      — + soft drums
// Pausing muffles it, solving a step plays a stinger. No audio files.
import { makeRng } from './random.js';

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};
const SCALE_CYCLE = ['dorian', 'minor', 'lydian', 'phrygian', 'major', 'mixolydian'];
// Chord progressions as scale degrees, one chord per bar.
const PROGRESSIONS = [[0, 5, 3, 4], [0, 3, 5, 4], [0, 4, 5, 3], [0, 6, 5, 4], [0, 2, 3, 4], [0, 5, 2, 6]];

// Hand-tuned moods for a few worlds; the rest are derived from the index.
const OVERRIDES = {
  2: { scale: 'minor', tempo: 116, pad: 'sawtooth', arp: 'square', bright: 2400 }, // Neon Arcade
  3: { scale: 'phrygian', tempo: 84, pad: 'triangle', arp: 'triangle', bright: 1400 }, // Desert Ruins
};

export function moodFor(world, { blackout = false, story = false, boss = false } = {}) {
  if (story) return { root: 50, scale: 'lydian', tempo: 76, pad: 'sine', arp: 'triangle', bright: 1600, prog: PROGRESSIONS[0], seed: 99 };
  const w = Math.max(0, world);
  const base = {
    root: 45 + ((w * 5) % 12),
    scale: SCALE_CYCLE[w % SCALE_CYCLE.length],
    tempo: 72 + ((w * 11) % 36),
    pad: ['sine', 'triangle', 'sawtooth'][w % 3],
    arp: ['triangle', 'sine', 'square'][(w + 1) % 3],
    bright: 1100 + ((w * 370) % 1600),
    prog: PROGRESSIONS[w % PROGRESSIONS.length],
    seed: 1000 + w,
    ...OVERRIDES[w],
  };
  if (blackout) Object.assign(base, { scale: 'phrygian', bright: 700, tempo: base.tempo - 10 });
  // Chapter bosses: minor, faster, a different progression.
  if (boss) Object.assign(base, { scale: 'minor', tempo: base.tempo + 14, prog: [0, 5, 3, 4], seed: base.seed + 500 });
  return base;
}

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.volume = 0.5;
    this.intensity = 0;
    this.mood = moodFor(0, { story: true });
    this.ready = false;
    this.muffled = false;
  }

  _init() {
    const ctx = this.sfx.ctx;
    if (!ctx || this.ready) return !!ctx;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = this.volume;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 18000;
    this.bus = ctx.createGain();
    // A short feedback delay gives the rooms some space.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.33;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    this.bus.connect(this.filter);
    this.bus.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(this.filter);
    this.filter.connect(this.out).connect(this.sfx.comp ?? ctx.destination);
    this.step = 0;
    this.next = ctx.currentTime + 0.1;
    this.rng = makeRng(`music-${this.mood.seed}`);
    this.timer = setInterval(() => this._schedule(), 60);
    this.ready = true;
    return true;
  }

  setVolume(v) {
    this.volume = v;
    if (this.out) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  setMood(mood) {
    this.mood = mood;
    this.rng = makeRng(`music-${mood.seed}`);
  }

  setIntensity(level) {
    this.intensity = level;
  }

  // Muffled while paused or in menus over a level.
  muffle(on) {
    if (!this._init() || this.muffled === on) return;
    this.muffled = on;
    this.filter.frequency.setTargetAtTime(on ? 650 : 18000, this.ctx.currentTime, 0.25);
  }

  // Short rising flourish in the current key when the player solves something.
  stinger(big = false) {
    if (!this._init()) return;
    const t = this.ctx.currentTime + 0.02;
    const notes = big ? [0, 2, 4, 7, 9] : [0, 2, 4];
    notes.forEach((d, i) => this._note(this._degree(d, 2), t + i * 0.07, 0.5, 'triangle', big ? 0.07 : 0.05, 3200));
  }

  // Scale degree (may exceed 7) → MIDI note, `oct` octaves above the root.
  _degree(d, oct = 0) {
    const sc = SCALES[this.mood.scale];
    const o = Math.floor(d / sc.length);
    return this.mood.root + 12 * (oct + o) + sc[((d % sc.length) + sc.length) % sc.length];
  }

  _schedule() {
    if (this.volume <= 0.001 || this.ctx.state !== 'running') {
      this.next = this.ctx.currentTime + 0.1;
      return;
    }
    const sixteenth = 60 / this.mood.tempo / 4;
    // Fell far behind (tab was in the background): resync instead of bursting.
    if (this.next < this.ctx.currentTime - 0.5) this.next = this.ctx.currentTime + 0.05;
    while (this.next < this.ctx.currentTime + 0.3) {
      this._play(this.step, this.next, sixteenth);
      this.next += sixteenth;
      this.step = (this.step + 1) % 64;
    }
  }

  _play(step, t, s16) {
    const m = this.mood, r = this.rng, lvl = this.intensity;
    const bar = Math.floor(step / 16), beat = step % 16;
    const chord = m.prog[bar % m.prog.length];
    const tones = [chord, chord + 2, chord + 4];

    if (beat === 0) {
      for (const d of tones) this._note(this._degree(d, 1), t, s16 * 16 * 1.05, m.pad, 0.028, m.bright * 0.6, 0.6);
    }
    if (lvl >= 1 && (beat === 0 || beat === 8 || (lvl >= 2 && (beat === 6 || beat === 14)))) {
      this._note(this._degree(chord, -1), t, s16 * 3, 'triangle', 0.09, 600);
    }
    if (lvl >= 1 && beat % 2 === 0) {
      const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
      const d = tones[pattern[(beat / 2) % pattern.length]] + (beat >= 8 ? 7 : 0);
      this._note(this._degree(d, 1), t, s16 * 1.6, m.arp, 0.022, m.bright);
    }
    // Sparse melody: more notes as intensity rises.
    if (beat % 4 === 2 && r() < 0.22 + lvl * 0.12) {
      const d = tones[Math.floor(r() * 3)] + (r() < 0.3 ? 1 : 0);
      this._note(this._degree(d, 2), t, s16 * 6, 'sine', 0.035, 4000, 0.01);
    }
    if (lvl >= 2) {
      if (beat === 0 || beat === 8) this._kick(t);
      if (beat % 4 === 2) this._hat(t, 0.018);
      if (beat === 12) this._hat(t, 0.03, 0.12);
    }
  }

  _note(midi, t, dur, type, gain, cutoff, attack = 0.008) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = mtof(midi);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f).connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _kick(t) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  _hat(t, gain, dur = 0.04) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.sfx._noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}
