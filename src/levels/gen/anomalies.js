// The museum waking up. Two things live here:
//
//  chapterArt(b, cell, motif, rng)  — each story chapter's architecture: the
//      Archive's paper, the Lab's pipes, the Vault's steel, the Echoes' drones,
//      the unfinished edges of the Recorded End, blueprint floors, mirrors,
//      engine gears, the curator's home comforts and the golden Door.
//
//  createAnomalies(b, ctx, cells, plan, rng)  — rooms that act self-aware,
//      growing chapter by chapter (storyline.js ANOMALIES): eyes that follow
//      you, lights that flicker as you pass, the echoes whispering, doors that
//      seal behind you, your own ghost a few seconds behind, rooms that dim
//      when you stop paying attention, and a window with real rain.
//
// Everything here is visual or atmospheric: nothing collides, nothing blocks
// interaction rays or portal shots, so no puzzle can be broken by it.
import * as THREE from 'three';
import { range, pick, irange } from '../../random.js';
import { ANOMALIES, WHISPERS } from './storyline.js';

const fx = { collide: false, tile: 0, castShadow: false };
const glow = (hex, k = 1.8) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });

// ---------------------------------------------------------------- chapter art
export function chapterArt(b, cell, motif, rng) {
  if (!motif) return;
  const { x0, x1, y0, h, zS, zN, w, d } = cell;
  const top = cell.hasCeiling ? y0 + h : y0 + Math.min(h, 6);
  const cz = (zS + zN) / 2;
  const accent = b.theme.accent;
  const add = (...m) => b.scene.add(...m);
  // Upper part of the entrance (south) wall: free in every module.
  const southHigh = (x, y) => [x, Math.min(top - 0.5, y0 + y), zS - 0.06];

  switch (motif) {
    case 'archive': {
      const paperMat = new THREE.MeshStandardMaterial({ color: '#efe4c8', roughness: 0.95 });
      for (const [x, z] of [[x0 + 0.5, zS - 0.5], [x1 - 0.5, zS - 0.5], [x0 + 0.5, zN + 0.5], [x1 - 0.5, zN + 0.5]]) {
        let y = y0;
        for (let i = 0; i < irange(rng, 2, 5); i++) {
          const hh = range(rng, 0.08, 0.2);
          const stack = new THREE.Mesh(new THREE.BoxGeometry(0.42, hh, 0.32), paperMat);
          stack.position.set(x + range(rng, -0.04, 0.04), y + hh / 2, z);
          stack.rotation.y = range(rng, -0.2, 0.2);
          add(stack);
          y += hh;
        }
      }
      // Index cards hanging from the ceiling on threads.
      for (let i = 0; i < 10; i++) {
        const x = range(rng, x0 + 1, x1 - 1), z = range(rng, zN + 1, zS - 1), drop = range(rng, 0.4, 1.0);
        const card = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.22), new THREE.MeshStandardMaterial({ color: '#f4ead2', side: THREE.DoubleSide }));
        card.position.set(x, top - drop - 0.11, z);
        card.rotation.y = rng() * Math.PI;
        const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, drop, 3), b.mat.darkMetal);
        thread.position.set(x, top - drop / 2, z);
        add(card, thread);
      }
      break;
    }
    case 'lab': {
      const pipe = new THREE.MeshStandardMaterial({ color: '#7fa89a', metalness: 0.7, roughness: 0.35 });
      for (const x of [x0 + 0.6, x1 - 0.9]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, d, 10), pipe);
        p.rotation.x = Math.PI / 2;
        p.position.set(x, top - 0.3, cz);
        add(p);
      }
      // A shelf of glowing flasks above the entrance.
      b.box(x0 + 1, top - 0.95, zS - 0.3, -1.4, top - 0.92, zS, b.mat.metal, fx);
      for (let x = x0 + 1.2; x < -1.6; x += range(rng, 0.25, 0.45)) {
        const liquid = glow(pick(rng, ['#3dff9a', '#3df0ff', '#c8ff3d']), 1.6);
        const flask = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 0.06, 0.1), 10, 8), liquid);
        flask.position.set(x, top - 0.84, zS - 0.15);
        add(flask);
      }
      break;
    }
    case 'vault': {
      const steel = new THREE.MeshStandardMaterial({ color: '#59626e', metalness: 0.85, roughness: 0.3 });
      const yb = top - 0.5;
      b.box(x0 + 0.01, yb, zN, x0 + 0.06, yb + 0.2, zS, steel, fx);
      b.box(x1 - 0.06, yb, zN, x1 - 0.01, yb + 0.2, zS, steel, fx);
      b.box(x0, yb, zS - 0.06, x1, yb + 0.2, zS - 0.01, steel, fx);
      b.box(x0, yb, zN + 0.01, x1, yb + 0.2, zN + 0.06, steel, fx);
      const rivet = new THREE.SphereGeometry(0.025, 6, 4);
      for (let x = x0 + 0.3; x < x1; x += 0.6) {
        const r = new THREE.Mesh(rivet, steel);
        r.position.set(x, yb + 0.1, zS - 0.07);
        add(r);
      }
      // A vault-door wheel above the entrance.
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 24), steel);
      wheel.position.set(...southHigh(-2.6, 2.9));
      add(wheel);
      for (let i = 0; i < 3; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.05), steel);
        spoke.position.copy(wheel.position);
        spoke.rotation.z = (i / 3) * Math.PI;
        add(spoke);
      }
      break;
    }
    case 'echoes': {
      // Old WREN shells hanging from the ceiling, eyes faintly lit.
      const shell = new THREE.MeshStandardMaterial({ color: '#d8dde4', metalness: 0.4, roughness: 0.4 });
      for (let i = 0; i < irange(rng, 4, 7); i++) {
        const x = range(rng, x0 + 1.2, x1 - 1.2), z = range(rng, zN + 1.5, zS - 1.5), drop = range(rng, 0.8, 1.6);
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), shell);
        body.position.set(x, top - drop, z);
        const eye = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), glow('#9a8cff', 1.4));
        eye.position.set(x, top - drop, z + 0.161);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, drop, 3), b.mat.darkMetal);
        cord.position.set(x, top - drop / 2, z);
        add(body, eye, cord);
      }
      for (const x of [-3, 3]) {
        const grille = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshStandardMaterial({ color: '#1a1c22', roughness: 0.9 }));
        grille.position.set(...southHigh(x, 3.2));
        grille.rotation.y = Math.PI;
        add(grille);
      }
      break;
    }
    case 'unfinished': {
      // The museum improvising: glowing construction edges and scaffolding.
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w - 0.1, top - y0 - 0.1, d - 0.1)),
        new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.8 }));
      edges.position.set((x0 + x1) / 2, (y0 + top) / 2, cz);
      add(edges);
      const pole = new THREE.MeshStandardMaterial({ color: '#c9a043', metalness: 0.6, roughness: 0.4 });
      for (const x of [x0 + 0.35, x1 - 0.35]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, top - y0, 6), pole);
        p.position.set(x, (y0 + top) / 2, zS - 0.35);
        add(p);
        for (let y = y0 + 1.2; y < top - 0.3; y += 1.2) {
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), pole);
          bar.rotation.z = Math.PI / 2;
          bar.position.set(x + Math.sign(-x) * 0.7, y, zS - 0.35);
          add(bar);
        }
      }
      break;
    }
    case 'blueprint': {
      const grid = new THREE.GridHelper(Math.max(w, d), Math.round(Math.max(w, d)), '#4aa8ff', '#2a6ab0');
      grid.material.transparent = true;
      grid.material.opacity = 0.35;
      grid.material.depthWrite = false;
      grid.position.set((x0 + x1) / 2, y0 + 0.014, cz);
      grid.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
      if (!(cell.floorGaps ?? []).length) add(grid);
      // A dimension line across the entrance wall.
      const line = glow('#e8f4ff', 1.3);
      b.box(x0 + 0.4, top - 0.7, zS - 0.04, x1 - 0.4, top - 0.68, zS - 0.02, line, fx);
      for (const x of [x0 + 0.4, x1 - 0.42]) b.box(x, top - 0.8, zS - 0.04, x + 0.02, top - 0.58, zS - 0.02, line, fx);
      break;
    }
    case 'mirror': {
      const chrome = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.04 });
      for (const [x, z] of [[x0 + 0.05, zS - 0.05], [x1 - 0.05, zS - 0.05], [x0 + 0.05, zN + 0.05], [x1 - 0.05, zN + 0.05]]) {
        b.box(x - 0.05, y0, z - 0.05, x + 0.05, top, z + 0.05, chrome, fx);
      }
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(4, w - 3), 1.0), chrome);
      panel.position.set(...southHigh(0, 3.4));
      panel.rotation.y = Math.PI;
      add(panel);
      break;
    }
    case 'engine': {
      const iron = new THREE.MeshStandardMaterial({ color: '#6a5a4a', metalness: 0.8, roughness: 0.45 });
      const gears = [];
      for (const [x, r, dir] of [[-3.2, 0.7, 1], [-2.05, 0.45, -1.55], [2.8, 0.6, 1.2]]) {
        const gear = new THREE.Group();
        gear.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 20), iron));
        for (let t = 0; t < 12; t++) {
          const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.18), iron);
          const a = (t / 12) * Math.PI * 2;
          tooth.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
          tooth.rotation.y = -a;
          gear.add(tooth);
        }
        gear.rotation.x = Math.PI / 2;
        gear.position.set(...southHigh(x, 3.0));
        add(gear);
        gears.push({ gear, dir });
      }
      b.updaters.push((dt) => { for (const g of gears) g.gear.rotation.y += dt * 0.6 * g.dir; });
      break;
    }
    case 'home': {
      const frame = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.7 });
      for (const x of [-3.4, -2.2, 2.4]) {
        const c = document.createElement('canvas');
        c.width = 96; c.height = 120;
        const g = c.getContext('2d');
        g.fillStyle = `hsl(${Math.floor(rng() * 360)},30%,70%)`; g.fillRect(0, 0, 96, 120);
        g.fillStyle = '#3a2a1a'; g.beginPath(); g.ellipse(48, 50, 18, 22, 0, 0, Math.PI * 2); g.fill();
        g.fillRect(28, 72, 40, 48);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        const pic = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.56, 0.03), [frame, frame, frame, frame, frame, new THREE.MeshBasicMaterial({ map: t })]);
        pic.position.set(...southHigh(x, 2.9));
        add(pic);
      }
      break;
    }
    case 'door': {
      if (!(cell.floorGaps ?? []).length) {
        const gold = glow('#ffd76b', 1.5);
        for (const x of [-0.35, 0.35]) b.box(x - 0.025, y0, zN + 0.5, x + 0.025, y0 + 0.012, zS - 0.5, gold, fx);
      }
      b.particles('fireflies', [x0, y0 + 0.3, zN], [x1, top - 0.3, zS], 60);
      break;
    }
    default: break;
  }
}

// ---------------------------------------------------------------- anomalies
export function createAnomalies(b, ctx, cells, plan, rng) {
  const kinds = new Set(ANOMALIES[plan.chapter?.index ?? 0] ?? []);
  const sealed = new Set();
  const updaters = [];
  const eyePos = new THREE.Vector3();

  if (kinds.has('watchers')) {
    // One or two eyes above each entrance, always looking at you.
    for (const { cell } of cells) {
      const top = cell.hasCeiling ? cell.y0 + cell.h : cell.y0 + Math.min(cell.h, 6);
      const n = rng() < 0.5 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const x = (i ? -1 : 1) * (cell.w / 2 - 0.55);
        const eye = new THREE.Group();
        eye.position.set(x, top - 0.45, cell.zS - 0.3);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.3 }));
        const iris = new THREE.Mesh(new THREE.CircleGeometry(0.085, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color(b.theme.accent).multiplyScalar(0.9) }));
        iris.position.z = 0.165;
        const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), new THREE.MeshBasicMaterial({ color: '#05070a' }));
        pupil.position.z = 0.167;
        const lid = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), b.mat.darkMetal);
        eye.add(ball, iris, pupil, lid);
        b.scene.add(eye);
        updaters.push((dt, player) => {
          eyePos.set(player.pos.x, player.pos.y + 1.6, player.pos.z);
          if (eyePos.distanceTo(eye.position) > 25) return;
          const q = eye.quaternion.clone();
          eye.lookAt(eyePos);
          eye.quaternion.slerp(q, Math.exp(-dt * 6));
          lid.quaternion.copy(eye.quaternion).invert(); // the lid stays put, the eye turns
        });
      }
    }
  }

  if (kinds.has('flicker')) {
    // Lamps notice you walking under them.
    const lamps = cells.flatMap(({ cell }) => cell.lamps.map((l) => ({ l, base: l.intensity, t: 0 })));
    updaters.push((dt, player) => {
      for (const f of lamps) {
        if (f.t > 0) {
          f.t -= dt;
          f.l.intensity = f.t > 0 ? f.base * (Math.random() < 0.5 ? 0.15 : 1) : f.base;
          continue;
        }
        const near = Math.hypot(f.l.position.x - player.pos.x, f.l.position.z - player.pos.z) < 2.4;
        if (near && Math.random() < dt * 0.6) f.t = range(rng, 0.3, 0.7);
      }
    });
  }

  if (kinds.has('whispers')) {
    let next = range(rng, 25, 45);
    updaters.push((dt) => {
      if ((next -= dt) > 0) return;
      next = range(rng, 40, 75);
      ctx.wrenText?.(pick(rng, WHISPERS), 'worried');
    });
  }

  // Never on a level hiding a curator's note: you may need to go back for it.
  if (kinds.has('seal') && !(plan.number && (plan.number - 5) % 25 === 12)) {
    // Once you're well inside a room, the door behind you closes for good.
    let told = false;
    updaters.push((dt, player) => {
      for (let i = 1; i < cells.length; i++) {
        if (sealed.has(i - 1)) continue;
        const c = cells[i].cell;
        if (c.contains(player.pos) && player.pos.z < c.zS - 3) {
          sealed.add(i - 1);
          if (!told) {
            told = true;
            ctx.wrenText?.(pick(rng, ['It closed behind us. It does that now.', 'The museum would like us to keep moving.', "Don't look back. The door already has."]), 'worried');
          }
        }
      }
    });
  }

  if (kinds.has('ghost')) {
    // Your own ghost, walking your path a few seconds behind you.
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e0f0ff').multiplyScalar(1.2), transparent: true, opacity: 0.18, depthWrite: false });
    const ghost = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 6, 12), mat);
    body.position.y = 0.78;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), mat);
    head.position.y = 1.6;
    ghost.add(body, head);
    ghost.visible = false;
    b.scene.add(ghost);
    const trail = [];
    let acc = 0;
    const DELAY = 3.2;
    updaters.push((dt, player) => {
      acc += dt;
      while (acc >= 0.1) {
        acc -= 0.1;
        trail.push([player.pos.x, player.pos.y, player.pos.z, player.yaw]);
        if (trail.length > DELAY * 10 + 1) trail.shift();
      }
      const old = trail[0];
      if (!old || trail.length < DELAY * 10) return;
      const moved = Math.hypot(old[0] - player.pos.x, old[2] - player.pos.z) > 1.2;
      ghost.visible = moved;
      ghost.position.set(old[0], old[1], old[2]);
      ghost.rotation.y = old[3];
      mat.opacity = 0.14 + Math.sin(performance.now() / 300) * 0.04;
    });
  }

  if (kinds.has('engine')) {
    // The museum runs on attention: stand still and the rooms dim.
    const lights = cells.flatMap(({ cell }) => [...cell.lamps, cell.key].filter(Boolean).map((l) => ({ l, base: l.intensity })));
    let idle = 0, level = 1;
    updaters.push((dt, player) => {
      const moving = Math.hypot(player.vel.x, player.vel.z) > 0.3;
      idle = moving ? 0 : idle + dt;
      const target = idle > 3 ? 0.3 : 1;
      level += (target - level) * Math.min(1, dt * (target < level ? 0.6 : 3));
      for (const f of lights) f.l.intensity = f.base * level;
    });
  }

  if (kinds.has('rain')) {
    // A window to outside: the only one in the museum, with real rain.
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#1d2a3d'); grad.addColorStop(1, '#0b1018');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 256);
    g.strokeStyle = 'rgba(190, 215, 255, 0.55)';
    for (let i = 0; i < 90; i++) { const x = Math.random() * 128, y = Math.random() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 10); g.stroke(); }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const { cell } = cells[0];
    const wy = Math.min((cell.hasCeiling ? cell.y0 + cell.h : cell.y0 + 6) - 1.0, cell.y0 + 3.6);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshBasicMaterial({ map: tex }));
    win.position.set(-2.6, wy, cell.zS - 0.05);
    win.rotation.y = Math.PI;
    const frame = new THREE.MeshStandardMaterial({ color: '#6e4a2c' });
    b.box(-3.25, wy - 0.85, cell.zS - 0.08, -1.95, wy - 0.78, cell.zS - 0.02, frame, fx);
    b.box(-2.63, wy - 0.8, cell.zS - 0.07, -2.57, wy + 0.8, cell.zS - 0.03, frame, fx);
    b.scene.add(win);
    updaters.push((dt) => { tex.offset.y += dt * 1.4; });
  }

  return {
    sealed,
    update(dt, player) {
      for (const u of updaters) u(dt, player);
    },
  };
}
