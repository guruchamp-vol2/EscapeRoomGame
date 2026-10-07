// Plays a story scene: an animated stage (stages.js), a slow camera move, and
// the scene's lines typed out one by one with the speaker's name.
//   click / Space / Enter / tap / (A)  next line (or finish typing)
//   Esc / Skip                          skip the whole scene
// When the last line is read, "Continue" waits for one more click: that click
// is a user gesture, so the level after it can grab the mouse straight away.
import * as THREE from 'three';
import { buildStage } from './stages.js';
import { SPEAKERS } from './script.js';
import { makeRng } from '../random.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class Cutscene {
  constructor({ sfx, envMap = null } = {}) {
    this.sfx = sfx;
    this.envMap = envMap;
    this.active = false;
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
    this.el = $('#cutscene');
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('.cs-skip')) return this.finish();
      this.advance();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Escape') { e.preventDefault(); this.finish(); }
      else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.advance(); }
    }, true);
  }

  // scene: { title, set, lines, alt }, meta: { chapter, choice }
  play(scene, { chapterName = '', chapterIndex = 0, choice = null, onDone } = {}) {
    this.onDone = onDone;
    this.stage = buildStage(scene.set, makeRng(`stage:${scene.index}`));
    this.scene = this.stage.scene;
    if (this.envMap) { this.scene.environment = this.envMap; this.scene.environmentIntensity = 0.6; }
    // After the choice, scenes may swap some lines for the "stay" path.
    this.lines = choice === 'stay' && scene.alt ? [...scene.lines.slice(0, scene.lines.length - scene.alt.length), ...scene.alt] : scene.lines;
    this.lineIndex = -1;
    this.typed = 0;
    this.t = 0;
    this.waiting = false;
    this.lineT = 0;
    this.duration = this.lines.reduce((s, [, text]) => s + this._lineTime(text), 0) + 1.5;
    this.active = true;
    this.el.innerHTML = `
      <div class="cs-bars"></div>
      <div class="cs-title"><small>${esc(chapterIndex ? `CHAPTER ${chapterIndex} · ${chapterName}` : chapterName)}</small><b>${esc(scene.title)}</b></div>
      <div class="cs-box"><span class="cs-who"></span><p class="cs-text"></p></div>
      <div class="cs-foot"><span class="cs-hint">Click to continue</span><button class="linkish cs-skip">Skip ▸▸</button></div>`;
    this.el.classList.add('show');
    document.body.classList.add('cutscene');
    this.resize();
    this._next();
  }

  _lineTime(text) {
    return Math.max(2.6, 1.2 + text.length * 0.045);
  }

  _next() {
    this.lineIndex++;
    if (this.lineIndex >= this.lines.length) {
      this.waiting = true;
      this.el.querySelector('.cs-box').classList.add('done');
      this.el.querySelector('.cs-hint').textContent = 'Click to begin the level ▸';
      this.el.querySelector('.cs-hint').classList.add('ready');
      return;
    }
    const [who, text] = this.lines[this.lineIndex];
    const sp = SPEAKERS[who] ?? SPEAKERS.N;
    const whoEl = this.el.querySelector('.cs-who');
    whoEl.textContent = sp.name;
    whoEl.style.color = sp.color;
    const p = this.el.querySelector('.cs-text');
    p.className = `cs-text ${who === 'N' ? 'narration' : ''}`;
    p.textContent = '';
    this.typed = 0;
    this.lineT = 0;
    this.sfx?.play?.('ui');
  }

  advance() {
    if (!this.active) return;
    if (this.waiting) return this.finish();
    const text = this.lines[this.lineIndex]?.[1] ?? '';
    if (this.typed < text.length) {
      this.typed = text.length; // finish typing first
      this.el.querySelector('.cs-text').textContent = text;
      return;
    }
    this._next();
  }

  finish() {
    if (!this.active) return;
    this.active = false;
    this.el.classList.remove('show');
    document.body.classList.remove('cutscene');
    this.scene?.traverse((o) => {
      o.geometry?.dispose?.();
      for (const m of [].concat(o.material ?? [])) { m.map?.dispose?.(); m.dispose?.(); }
      if (o.isLight) o.dispose?.();
    });
    this.scene = null;
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const k = Math.min(1, this.t / this.duration);
    const e = k * k * (3 - 2 * k);
    const cam = this.stage.camera;
    this.camera.position.lerpVectors(cam.from, cam.to, e);
    this.camera.lookAt(cam.look);
    this.stage.update?.(dt, this.t);
    if (!this.waiting && this.lineIndex >= 0) {
      const text = this.lines[this.lineIndex][1];
      if (this.typed < text.length) {
        this.typed = Math.min(text.length, this.typed + dt * 45);
        this.el.querySelector('.cs-text').textContent = text.slice(0, Math.floor(this.typed));
      } else {
        this.lineT += dt;
        if (this.lineT > this._lineTime(text) - text.length / 45 + 1.2) this._next(); // auto-advance
      }
    }
  }
}
