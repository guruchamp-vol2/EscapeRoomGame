// WREN: the museum's caretaker drone. A little floating robot with one big
// expressive eye that follows the player, reacts to what they do, and talks in
// subtitles with a chirpy synthesized babble.
import * as THREE from 'three';
import { LINES, MOODS } from './lines.js';

const IRIS = {
  happy: '#5fe1ff', excited: '#7dfcff', thoughtful: '#a98bff', worried: '#ffb15f', sad: '#6f9bff', smug: '#7dff9a',
};
const PITCH = { happy: 520, excited: 640, thoughtful: 430, worried: 560, sad: 360, smug: 470 };

// Draws the eye for a mood. `blink` 0..1 closes the lids.
export function drawEye(g, size, mood, blink = 0, look = [0, 0]) {
  const c = size / 2;
  g.clearRect(0, 0, size, size);
  // Visor.
  g.fillStyle = '#0a0f16';
  g.beginPath(); g.arc(c, c, c * 0.98, 0, Math.PI * 2); g.fill();
  const iris = IRIS[mood] ?? IRIS.happy;
  const r = c * (mood === 'excited' ? 0.6 : mood === 'worried' ? 0.42 : 0.52);
  const ix = c + look[0] * c * 0.18, iy = c + look[1] * c * 0.18;
  const grad = g.createRadialGradient(ix, iy, r * 0.2, ix, iy, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, iris);
  grad.addColorStop(1, '#0a0f16');
  g.fillStyle = grad;
  g.beginPath(); g.arc(ix, iy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#05080c';
  g.beginPath(); g.arc(ix, iy, r * (mood === 'worried' ? 0.22 : 0.34), 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.arc(ix - r * 0.32, iy - r * 0.34, r * 0.16, 0, Math.PI * 2); g.fill();
  if (mood === 'excited') {
    g.beginPath(); g.arc(ix + r * 0.3, iy + r * 0.3, r * 0.08, 0, Math.PI * 2); g.fill();
  }
  // Lids (drawn in the visor colour over the eye).
  g.fillStyle = '#0a0f16';
  const top = (h, tilt = 0) => {
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(size, 0);
    g.lineTo(size, h - tilt); g.lineTo(0, h + tilt);
    g.closePath(); g.fill();
  };
  const lidBase = { happy: 0.18, excited: 0.1, thoughtful: 0.34, worried: 0.2, sad: 0.4, smug: 0.46 }[mood] ?? 0.2;
  const lid = lidBase + (0.5 - lidBase) * blink;
  top(size * lid, mood === 'worried' ? -size * 0.08 : mood === 'sad' ? size * 0.06 : 0);
  // Happy/excited: a smiling lower lid.
  if (mood === 'happy' || mood === 'excited') {
    g.beginPath();
    g.moveTo(0, size); g.lineTo(0, size * 0.78);
    g.quadraticCurveTo(c, size * 0.5, size, size * 0.78);
    g.lineTo(size, size); g.closePath(); g.fill();
  }
  const bottom = size - size * (0.5 * blink);
  if (blink > 0) g.fillRect(0, bottom, size, size);
  // Rim.
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = size * 0.03;
  g.beginPath(); g.arc(c, c, c * 0.96, 0, Math.PI * 2); g.stroke();
}

export class Wren {
  constructor({ sfx, enabled = true, name = 'Visitor' }) {
    this.sfx = sfx;
    this.enabled = enabled;
    this.name = name;
    this.mood = 'happy';
    this.queue = [];
    this.current = null;
    this.recent = new Map();
    this.cooldowns = new Map();
    this.blinkT = 2;
    this.blink = 0;
    this.talkT = 0;
    this.look = [0, 0];
    this._buildModel();
    this._buildBox();
  }

  // ---------- 3D model ----------
  _buildModel() {
    const g = new THREE.Group();
    g.name = 'wren';
    const shell = new THREE.MeshStandardMaterial({ color: '#eef2f6', roughness: 0.25, metalness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1c232c', roughness: 0.4, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 20), shell);
    body.scale.set(1, 0.9, 1);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 10, 40), dark);
    band.rotation.y = Math.PI / 2;
    const finGeo = new THREE.BoxGeometry(0.12, 0.03, 0.09);
    const finL = new THREE.Mesh(finGeo, shell);
    finL.position.set(-0.24, 0, -0.02);
    finL.rotation.z = 0.25;
    const finR = finL.clone();
    finR.position.x = 0.24;
    finR.rotation.z = -0.25;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 6), dark);
    antenna.position.set(0.05, 0.22, -0.02);
    antenna.rotation.z = -0.25;
    this.tipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a1f').multiplyScalar(2) });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), this.tipMat);
    tip.position.set(0.07, 0.29, -0.02);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    this.eyeCtx = canvas.getContext('2d');
    this.eyeTex = new THREE.CanvasTexture(canvas);
    this.eyeTex.colorSpace = THREE.SRGBColorSpace;
    const eyeMat = new THREE.MeshBasicMaterial({ map: this.eyeTex, transparent: true, toneMapped: false });
    eyeMat.color.setScalar(1.5);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.13, 40), eyeMat);
    eye.position.z = 0.185;
    eye.scale.y = 0.95;
    // A thin glowing ring around the eye.
    this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(IRIS.happy).multiplyScalar(1.6) });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.135, 0.15, 40), this.ringMat);
    ring.position.z = 0.184;

    g.add(body, band, finL, finR, antenna, tip, eye, ring);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group = g;
    this.fins = [finL, finR];
    this.pos = new THREE.Vector3();
    this.placed = false;
    this._drawEye();
  }

  _drawEye() {
    drawEye(this.eyeCtx, 128, this.mood, this.blink, this.look);
    this.eyeTex.needsUpdate = true;
    this.ringMat.color.set(IRIS[this.mood] ?? IRIS.happy).multiplyScalar(1.6);
    if (this.portraitCtx) drawEye(this.portraitCtx, 96, this.mood, this.blink, this.look);
  }

  // Cosmetic hats from the Workshop.
  setHat(id) {
    this.hat?.removeFromParent();
    this.hat = null;
    this.propeller = null;
    if (!id || id === 'none') return;
    const h = new THREE.Group();
    const mat = (c, glow = 1) => (glow > 1
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(glow) })
      : new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.2 }));
    switch (id) {
      case 'bow': {
        for (const s of [-1, 1]) {
          const loop = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 12), mat('#ff4f9a'));
          loop.rotation.z = s * Math.PI / 2;
          loop.position.x = s * 0.07;
          h.add(loop);
        }
        h.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#ff4f9a')));
        h.position.set(-0.08, 0.19, 0.04);
        break;
      }
      case 'party': {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 20), mat('#ffd23d'));
        cone.position.y = 0.12;
        const pom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#3aa0ff', 1.4));
        pom.position.y = 0.25;
        h.add(cone, pom);
        h.position.set(-0.05, 0.16, 0);
        h.rotation.z = 0.2;
        break;
      }
      case 'propeller': {
        const capM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ff4040'));
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), mat('#333'));
        stem.position.y = 0.12;
        const blades = new THREE.Group();
        for (const s of [-1, 1]) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.008, 0.035), mat('#3dff6a'));
          b.position.x = s * 0.08;
          blades.add(b);
        }
        blades.position.y = 0.16;
        h.add(capM, stem, blades);
        h.position.y = 0.15;
        this.propeller = blades;
        break;
      }
      case 'tophat': {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.015, 24), mat('#15171b'));
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.1, 0.18, 24), mat('#15171b'));
        crown.position.y = 0.09;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.101, 0.101, 0.03, 24), mat('#c0392b'));
        band.position.y = 0.025;
        h.add(brim, crown, band);
        h.position.y = 0.17;
        h.rotation.z = -0.12;
        break;
      }
      case 'halo': {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.015, 8, 32), mat('#fff1a8', 2));
        ring.rotation.x = Math.PI / 2;
        h.add(ring);
        h.position.y = 0.3;
        break;
      }
      case 'crown': {
        const gold = new THREE.MeshStandardMaterial({ color: '#ffcf3d', metalness: 0.9, roughness: 0.25 });
        h.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 20, 1, true), gold));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 6), gold);
          spike.position.set(Math.cos(a) * 0.1, 0.065, Math.sin(a) * 0.1);
          h.add(spike);
        }
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.025), mat('#ff3b3b', 1.6));
        gem.position.set(0, 0.01, 0.1);
        h.add(gem);
        h.position.y = 0.19;
        break;
      }
    }
    this.group.add(h);
    this.hat = h;
  }

  attach(scene) {
    scene.add(this.group);
    this.placed = false;
  }

  detach() {
    this.group.removeFromParent();
  }

  // ---------- subtitle box ----------
  _buildBox() {
    const box = document.createElement('div');
    box.id = 'wren-box';
    box.innerHTML = '<canvas width="96" height="96"></canvas><div><b>WREN</b><p></p></div>';
    document.body.appendChild(box);
    this.box = box;
    this.text = box.querySelector('p');
    this.portraitCtx = box.querySelector('canvas').getContext('2d');
    drawEye(this.portraitCtx, 96, this.mood);
  }

  // ---------- speech ----------
  // event: key in LINES (pool or object). Options: priority (higher interrupts),
  // chance (0..1), cooldown (seconds before this event can repeat), vars.
  say(event, { vars = {}, priority = 1, chance = 1, cooldown = 6, index, key } = {}) {
    if (!this.enabled) return false;
    const now = performance.now() / 1000;
    const cdKey = key !== undefined ? `${event}:${key}` : event;
    if ((this.cooldowns.get(cdKey) ?? 0) > now) return false;
    if (Math.random() > chance) return false;
    let pool = LINES[event];
    let mood = MOODS[event] ?? 'happy';
    if (key !== undefined) pool = pool?.[key] != null ? [pool[key]] : null;
    if (index !== undefined) pool = pool?.[index] != null ? [pool[index]] : null;
    if (!pool?.length) return false;
    const recent = this.recent.get(event) ?? [];
    const options = pool.map((_, i) => i).filter((i) => !recent.includes(i));
    const pickI = (options.length ? options : pool.map((_, i) => i))[Math.floor(Math.random() * (options.length || pool.length))];
    this.recent.set(event, [...recent, pickI].slice(-Math.max(1, Math.floor(pool.length / 2))));
    this.cooldowns.set(cdKey, now + cooldown);
    return this.sayText(this._fill(pool[pickI], vars), mood, priority);
  }

  sayText(text, mood = 'happy', priority = 1) {
    if (!this.enabled) return false;
    const line = { text, mood, priority };
    if (!this.current || priority > this.current.priority) {
      this._start(line);
    } else if (this.queue.length < 2) {
      this.queue.push(line);
    }
    return true;
  }

  _fill(text, vars) {
    return text.replace(/\{(\w+)\}/g, (_, k) => (k === 'name' ? this.name : vars[k] ?? ''));
  }

  _start(line) {
    this.current = { ...line, shown: 0, hold: 0 };
    this.mood = line.mood;
    this._drawEye();
    this.text.textContent = '';
    this.box.classList.add('show');
    document.body.classList.add('wren-talking');
  }

  clear() {
    this.queue = [];
    this.current = null;
    this._hide();
  }

  _hide() {
    this.box.classList.remove('show');
    document.body.classList.remove('wren-talking');
  }

  // ---------- per frame ----------
  update(frameDt, camera) {
    // Use wall-clock time so WREN keeps pace (and talks at normal speed) even
    // when the game is running at a low frame rate.
    const nowMs = performance.now();
    const dt = Math.min(0.5, this._lastMs ? (nowMs - this._lastMs) / 1000 : frameDt);
    this._lastMs = nowMs;
    // Typewriter + babble voice.
    const cur = this.current;
    if (cur) {
      if (cur.shown < cur.text.length) {
        const before = Math.floor(cur.shown);
        cur.shown = Math.min(cur.text.length, cur.shown + dt * 48);
        const now = Math.floor(cur.shown);
        this.text.textContent = cur.text.slice(0, now);
        for (let i = before; i < now; i++) {
          const ch = cur.text[i];
          if (i % 2 === 0 && /[a-z0-9]/i.test(ch)) this._blip(ch);
        }
        this.talkT = 0.2;
      } else {
        cur.hold += dt;
        if (cur.hold > 2.2 + cur.text.length * 0.035) {
          this.current = null;
          const next = this.queue.shift();
          if (next) this._start(next);
          else this._hide();
        }
      }
    }
    this.talkT = Math.max(0, this.talkT - dt);

    // Blinking.
    this.blinkT -= dt;
    let redraw = false;
    if (this.blinkT < 0) {
      this.blink = Math.min(1, this.blink + dt * 14);
      redraw = true;
      if (this.blink >= 1) this.blinkT = 2.5 + Math.random() * 3;
    } else if (this.blink > 0) {
      this.blink = Math.max(0, this.blink - dt * 10);
      redraw = true;
    }
    if (redraw) this._drawEye();

    // Follow the camera: hover ahead and to the right, lagging a little.
    if (!camera || !this.group.parent) return;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const t = performance.now() / 1000;
    const target = camera.position.clone()
      .addScaledVector(fwd, 1.9)
      .addScaledVector(right, 1.05)
      .add(new THREE.Vector3(0, 0.3 + Math.sin(t * 1.7) * 0.06, 0));
    if (!this.placed || this.group.position.distanceTo(target) > 8) {
      this.group.position.copy(target);
      this.placed = true;
    } else {
      this.group.position.lerp(target, 1 - Math.exp(-dt * 2.6));
    }
    // Face the player, with a wobble while talking.
    this.group.lookAt(camera.position);
    this.group.rotateZ(Math.sin(t * 9) * 0.08 * (this.talkT > 0 ? 1 : 0.15));
    for (const [i, f] of this.fins.entries()) f.rotation.x = Math.sin(t * 12 + i) * 0.35;
    if (this.propeller) this.propeller.rotation.y += dt * 18;
    this.tipMat.color.set(this.talkT > 0 && Math.sin(t * 30) > 0 ? '#ffffff' : '#ff8a1f').multiplyScalar(2);
  }

  _blip(ch) {
    const base = PITCH[this.mood] ?? 500;
    const n = ch.toLowerCase().charCodeAt(0) % 7;
    this.sfx.tone({ type: 'triangle', freq: base * (1 + n * 0.06), to: base * (1 + n * 0.05), dur: 0.05, gain: 0.035 });
  }
}
