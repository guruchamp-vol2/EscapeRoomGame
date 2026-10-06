// The spaces *between* puzzles, and how each room is dressed. This is what
// makes two levels with similar puzzles still look and feel different:
//   * start areas:  corridor, elevator, lobby, airlock, overlook
//   * connectors:   hall, stairs up/down, open-air bridge, chicane, gallery
//   * exits:        freedom corridor, daylight, portal ring, elevator up
//   * room dress:   lighting rig, light temperature, ceiling and floor style
//   * vista:        huge distant shapes, seen from bridges and open-sky rooms
// All of it is chosen from a level's own seed. Every connector reports the
// path through it, which the auto-solver walks.
import * as THREE from 'three';
import { signTexture } from '../../textures.js';
import { pick, range, irange } from '../../random.js';

const T = 0.4;
const glowMat = (hex, k = 1.7) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });

// ---------------------------------------------------------------- connectors
export const CONNECTORS = ['hall', 'stairs', 'bridge', 'chicane', 'gallery'];

// Builds the passage north of `cell`'s exit. → { z, y, path: [[x, z], ...] }
export function buildConnector(b, cell, rng, kind) {
  const y = cell.y0 + cell.exitY;
  const z1 = cell.zN - T;
  const m = cell.mat.wall === b.mat.wall ? b.mat : { ...b.mat, wall: cell.mat.wall, floor: cell.mat.floor };
  switch (kind) {
    case 'stairs': return stairs(b, m, y, z1, rng);
    case 'bridge': return bridge(b, m, y, z1, rng);
    case 'chicane': return chicane(b, m, y, z1, rng);
    case 'gallery': return gallery(b, m, y, z1, rng);
    default: return hall(b, m, y, z1, range(rng, 3, 6));
  }
}

function hall(b, m, y, z1, len) {
  const z0 = z1 - len;
  b.box(-1.6, y - 0.4, z0, 1.6, y, z1, m.floor, { tile: 2 });
  b.box(-1.6, y, z0, -1.2, y + 3, z1, m.wall);
  b.box(1.2, y, z0, 1.6, y + 3, z1, m.wall);
  b.box(-1.6, y + 3, z0, 1.6, y + 3.3, z1, m.ceiling);
  b.strip(-1.2, y, z0, -1.17, y + 0.06, z1);
  b.strip(1.17, y, z0, 1.2, y + 0.06, z1);
  return { z: z0 - T, y, path: [[0, z0 - 1.2]] };
}

// A flight of steps, up or down, between two landings.
function stairs(b, m, y, z1, rng) {
  const n = irange(rng, 3, 6);
  const up = rng() < 0.6;
  const rise = 0.3, run = 0.55;
  const landing = 1.2;
  const len = landing * 2 + n * run;
  const z0 = z1 - len;
  const yEnd = y + (up ? 1 : -1) * n * rise;
  const top = Math.max(y, yEnd) + 3.2;
  const low = Math.min(y, yEnd);
  // Landings.
  b.box(-1.6, y - 0.4, z1 - landing, 1.6, y, z1, m.floor, { tile: 2 });
  b.box(-1.6, yEnd - 0.4, z0, 1.6, yEnd, z0 + landing, m.floor, { tile: 2 });
  // Steps (solid blocks from the lower floor up, so there are no gaps under them).
  for (let i = 0; i < n; i++) {
    const zA = z1 - landing - i * run, zB = zA - run;
    const h = up ? y + (i + 1) * rise : y - (i + 1) * rise;
    b.box(-1.2, low - 0.4, zB, 1.2, h, zA, m.floor, { tile: 1 });
    b.strip(-1.2, h, zB - 0.005, 1.2, h + 0.012, zB + 0.05);
  }
  b.box(-1.6, low - 0.4, z0, -1.2, top, z1, m.wall);
  b.box(1.2, low - 0.4, z0, 1.6, top, z1, m.wall);
  b.box(-1.6, top, z0, 1.6, top + 0.3, z1, m.ceiling);
  // Handrail glow.
  b.strip(-1.2, Math.max(y, yEnd) - 0.2, z0, -1.16, Math.max(y, yEnd) - 0.16, z1);
  b.strip(1.16, Math.max(y, yEnd) - 0.2, z0, 1.2, Math.max(y, yEnd) - 0.16, z1);
  return { z: z0 - T, y: yEnd, path: [[0, z1 - landing + 0.2], [0, z0 + 0.4], [0, z0 - 1.2]] };
}

// An open-air bridge across the void between two rooms.
function bridge(b, m, y, z1, rng) {
  const len = range(rng, 7, 11);
  const z0 = z1 - len;
  const deck = b.theme.sky ? b.mat.metal : m.floor;
  b.box(-1.3, y - 0.3, z0, 1.3, y, z1, deck, { tile: 2 });
  // Glass railings (they collide, so nobody falls off by accident).
  b.box(-1.35, y, z0, -1.25, y + 1.25, z1, b.mat.glass, { tile: 0, gun: false, solid: false });
  b.box(1.25, y, z0, 1.35, y + 1.25, z1, b.mat.glass, { tile: 0, gun: false, solid: false });
  const rail = glowMat(b.theme.accent, 1.9);
  b.strip(-1.36, y + 1.22, z0, -1.24, y + 1.28, z1, rail);
  b.strip(1.24, y + 1.22, z0, 1.36, y + 1.28, z1, rail);
  b.strip(-1.3, y - 0.31, z0, 1.3, y - 0.29, z1, rail);
  // Posts.
  for (let z = z1 - 0.5; z > z0; z -= 2) {
    for (const x of [-1.3, 1.3]) b.box(x - 0.05, y - 1.2, z - 0.05, x + 0.05, y + 1.3, z + 0.05, b.mat.darkMetal, { collide: false, tile: 0 });
  }
  // Something to see below.
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(60, len + 40), new THREE.MeshBasicMaterial({
    color: new THREE.Color(b.theme.accent).multiplyScalar(0.25), transparent: true, opacity: 0.6, depthWrite: false,
  }));
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, y - 26, (z0 + z1) / 2);
  b.scene.add(floorGlow);
  const grid = new THREE.GridHelper(60, 30, b.theme.accent, b.theme.accent);
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  grid.position.set(0, y - 25.9, (z0 + z1) / 2);
  b.scene.add(grid);
  // The rooms' outer walls stand in the void: frame both doorways.
  for (const z of [z1, z0]) {
    b.box(-1.6, y - 0.4, z - 0.02, -1.25, y + 3.2, z + 0.02, b.mat.darkMetal, { collide: false, tile: 0 });
    b.box(1.25, y - 0.4, z - 0.02, 1.6, y + 3.2, z + 0.02, b.mat.darkMetal, { collide: false, tile: 0 });
  }
  return { z: z0 - T, y, path: [[0, z0 - 1.2]] };
}

// A wide passage with two baffle walls: you weave right, then left.
function chicane(b, m, y, z1, rng) {
  const W = 3.6, len = 9.5;
  const z0 = z1 - len;
  const s = rng() < 0.5 ? 1 : -1; // which side the first gap is on
  b.box(-W - T, y - 0.4, z0, W + T, y, z1, m.floor, { tile: 2 });
  b.box(-W - T, y, z0, -W, y + 3.4, z1, m.wall);
  b.box(W, y, z0, W + T, y + 3.4, z1, m.wall);
  b.box(-W - T, y + 3.4, z0, W + T, y + 3.7, z1, m.ceiling);
  // End caps around the doorways (rooms may be narrower than this passage).
  for (const z of [z1, z0]) {
    b.box(-W, y - 0.4, z - 0.2, -1.2, y + 3.4, z, m.wall);
    b.box(1.2, y - 0.4, z - 0.2, W, y + 3.4, z, m.wall);
    b.box(-1.2, y + 2.8, z - 0.2, 1.2, y + 3.4, z, m.wall);
  }
  const zA = z1 - 3.2, zB = z1 - 6.3;
  const glow = glowMat(b.theme.accent);
  const baffle = (zc, side) => {
    // Covers the passage except a 2.4 m gap on `side`.
    const x0 = side > 0 ? -W : -W + 2.4, x1 = side > 0 ? W - 2.4 : W;
    b.box(x0, y, zc - 0.15, x1, y + 3.4, zc + 0.15, m.wall);
    const edge = side > 0 ? x1 : x0;
    b.strip(edge - 0.03, y, zc - 0.17, edge + 0.03, y + 3.4, zc + 0.17, glow);
  };
  baffle(zA, s);
  baffle(zB, -s);
  b.floorDecal(arrowTexture(b.theme.accent), 1.2, 1.2, s * 2.3, zA + 1.2, { y: y + 0.013 });
  b.floorDecal(arrowTexture(b.theme.accent), 1.2, 1.2, -s * 2.3, zB + 1.2, { y: y + 0.013 });
  const lamp = new THREE.PointLight(b.theme.lampColor ?? '#fff4e6', 10, 0, 2);
  lamp.position.set(0, y + 3.0, (zA + zB) / 2);
  b.scene.add(lamp);
  const gx = s * (W - 1.2);
  return { z: z0 - T, y, path: [[0, z1 - 1.0], [gx, zA + 1.0], [gx, zA - 1.0], [-gx, zB + 1.0], [-gx, zB - 1.0], [0, z0 + 0.6], [0, z0 - 1.2]] };
}

// A short wide hall lined with columns and framed pictures.
function gallery(b, m, y, z1, rng) {
  const W = 2.8, len = range(rng, 6, 8);
  const z0 = z1 - len, h = 4.2;
  b.box(-W - T, y - 0.4, z0, W + T, y, z1, m.floor, { tile: 2 });
  b.box(-W - T, y, z0, -W, y + h, z1, m.wall);
  b.box(W, y, z0, W + T, y + h, z1, m.wall);
  b.box(-W - T, y + h, z0, W + T, y + h + 0.3, z1, m.ceiling);
  for (const z of [z1, z0]) {
    b.box(-W, y - 0.4, z - 0.2, -1.2, y + h, z, m.wall);
    b.box(1.2, y - 0.4, z - 0.2, W, y + h, z, m.wall);
    b.box(-1.2, y + 2.8, z - 0.2, 1.2, y + h, z, m.wall);
  }
  const col = b.mat.metal;
  for (let z = z1 - 1.2; z > z0 + 0.8; z -= 2.2) {
    for (const x of [-W + 0.35, W - 0.35]) b.box(x - 0.2, y, z - 0.2, x + 0.2, y + h, z + 0.2, col, { tile: 0 });
    for (const side of [-1, 1]) {
      const zc = z - 1.1;
      if (zc < z0 + 0.8) continue;
      b.sign(artTexture(rng, b.theme.accent), 1.2, 0.9, side * (W - 0.02), y + 1.8, zc, side < 0 ? Math.PI / 2 : -Math.PI / 2, { glow: 0.95 });
      const spot = glowMat('#fff2d8', 2);
      b.strip(side * (W - 0.12) - 0.3, y + 2.45, zc - 0.3, side * (W - 0.12) + 0.3, y + 2.5, zc + 0.3, spot);
    }
  }
  const lamp = new THREE.PointLight('#ffe6c4', 9, 0, 2);
  lamp.position.set(0, y + h - 0.4, (z0 + z1) / 2);
  b.scene.add(lamp);
  return { z: z0 - T, y, path: [[0, z0 - 1.2]] };
}

function arrowTexture(accent) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = accent;
  g.globalAlpha = 0.8;
  g.beginPath();
  g.moveTo(64, 10); g.lineTo(110, 70); g.lineTo(78, 70); g.lineTo(78, 118); g.lineTo(50, 118); g.lineTo(50, 70); g.lineTo(18, 70);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Abstract paintings: a different composition every frame.
function artTexture(rng, accent) {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 144;
  const g = c.getContext('2d');
  const hue = Math.floor(rng() * 360);
  g.fillStyle = `hsl(${hue}, 30%, ${rng() < 0.5 ? 85 : 18}%)`;
  g.fillRect(0, 0, 192, 144);
  const kind = Math.floor(rng() * 4);
  for (let i = 0; i < 7; i++) {
    g.fillStyle = `hsl(${(hue + 40 * i + rng() * 60) % 360}, ${50 + rng() * 40}%, ${35 + rng() * 40}%)`;
    if (kind === 0) g.fillRect(rng() * 160, rng() * 110, 20 + rng() * 70, 20 + rng() * 50);
    else if (kind === 1) { g.beginPath(); g.arc(rng() * 192, rng() * 144, 10 + rng() * 40, 0, Math.PI * 2); g.fill(); }
    else if (kind === 2) { g.fillRect(0, i * 21, 192, 10 + rng() * 10); }
    else { g.beginPath(); g.moveTo(rng() * 192, rng() * 144); g.lineTo(rng() * 192, rng() * 144); g.lineTo(rng() * 192, rng() * 144); g.fill(); }
  }
  g.strokeStyle = '#2a2016';
  g.lineWidth = 10;
  g.strokeRect(0, 0, 192, 144);
  g.strokeStyle = accent;
  g.lineWidth = 2;
  g.strokeRect(6, 6, 180, 132);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- start
export const STARTS = ['corridor', 'elevator', 'lobby', 'airlock', 'overlook'];

// The arrival area (z 0 → ~7, spawn at z 4.6 facing north). Returns its sign
// position so the level title can go on a wall that exists.
export function buildStart(b, plan, rng, kind) {
  const m = b.mat, th = b.theme;
  const titleSign = (x, y, z, rotY) => {
    const title = plan.number ? `LEVEL ${plan.number}` : 'DAILY';
    b.sign(signTexture([{ text: title, size: 44, color: th.accent }, { text: plan.name.replace(/^Daily · /, ''), size: 60 }, { text: plan.worldName, size: 34, color: '#9aa4ae' }],
      { w: 640, h: 320, bg: '#0b0d10' }), 1.9, 0.95, x, y, z, rotY, { glow: 1.2 });
  };
  const light = (x, y, z, i, c = th.lampColor) => {
    const l = new THREE.PointLight(c, i, 0, 2);
    l.position.set(x, y, z);
    b.scene.add(l);
  };
  const corridorShell = (w, len, h, floorMat = m.floor) => {
    b.box(-w - T, -0.4, 0, w + T, 0, len, floorMat, { tile: 2 });
    b.box(-w - T, 0, 0, -w, h, len, m.wall);
    b.box(w, 0, 0, w + T, h, len, m.wall);
    b.box(-w - T, 0, len - T, w + T, h, len, m.wall);
    b.box(-w - T, h, 0, w + T, h + 0.3, len, m.ceiling);
    // Front wall around the opening into the first room.
    if (w > 1.2) {
      b.box(-w, -0.4, -0.01, -1.2, h, 0.2, m.wall);
      b.box(1.2, -0.4, -0.01, w, h, 0.2, m.wall);
      b.box(-1.2, 2.8, -0.01, 1.2, h, 0.2, m.wall);
    }
  };

  switch (kind) {
    case 'elevator': {
      corridorShell(1.6, 6.4, 3.0, m.metal);
      // Cab walls in brushed metal, a floor indicator, doors that open on arrival.
      b.box(-1.2, 0, 2.8, -1.18, 3.0, 6.0, m.metal, { collide: false, tile: 0 });
      b.box(1.18, 0, 2.8, 1.2, 3.0, 6.0, m.metal, { collide: false, tile: 0 });
      b.box(-1.6, 0, 2.6, -0.8, 3.0, 2.8, m.darkMetal);
      b.box(0.8, 0, 2.6, 1.6, 3.0, 2.8, m.darkMetal);
      b.box(-0.8, 2.4, 2.6, 0.8, 3.0, 2.8, m.darkMetal);
      const left = b.door(-0.8, 0, 2.62, 0, 2.4, 2.78, [-0.78, 0, 0], m.metal);
      const right = b.door(0, 0, 2.62, 0.8, 2.4, 2.78, [0.78, 0, 0], m.metal);
      let t = 0;
      b.updaters.push((dt) => {
        if (t > 1.6) return;
        t += dt;
        if (t > 1.6) { left.setOpen(true); right.setOpen(true); b.ctx.sfx.play('unlock'); }
      });
      b.sign(signTexture([{ text: `▲ ${plan.number || '★'}`, size: 70, color: '#ffb347' }], { w: 256, h: 96, bg: '#120c04' }), 0.6, 0.22, 0, 2.62, 2.84, Math.PI, { glow: 1.5 });
      titleSign(-1.17, 1.7, 4.4, Math.PI / 2);
      b.strip(-0.6, 2.98, 3.2, 0.6, 3.0, 5.6, glowMat('#fff3e0', 2.2));
      light(0, 2.7, 4.4, 6);
      break;
    }
    case 'lobby': {
      corridorShell(4.2, 8.4, 4.4);
      // Reception desk, benches, plants and a big title on the back wall.
      const dx = rng() < 0.5 ? -2.6 : 2.6;
      b.box(dx - 0.9, 0, 4.2, dx + 0.9, 1.05, 5.0, m.darkMetal, { tile: 0 });
      b.strip(dx - 0.9, 1.05, 4.18, dx + 0.9, 1.08, 5.02, glowMat(th.accent));
      for (const bx of [-dx * 0.95]) {
        b.box(bx - 0.9, 0, 6.6, bx + 0.9, 0.45, 7.1, m.metal, { tile: 0 });
      }
      for (const [px, pz] of [[-3.6, 1.2], [3.6, 1.2], [-3.6, 7.6], [3.6, 7.6]]) plant(b, px, 0, pz, rng);
      titleSign(0, 2.2, 8.0 - 0.01, Math.PI);
      b.strip(-3.8, 4.38, 0.5, 3.8, 4.4, 7.8, glowMat('#fff6ea', 0.5));
      light(0, 3.8, 4.2, 14);
      break;
    }
    case 'airlock': {
      corridorShell(1.6, 6.4, 3.2);
      const hazard = hazardTexture();
      for (const z of [1.4, 5.0]) {
        b.box(-1.6, 0, z - 0.15, -1.0, 3.2, z + 0.15, m.darkMetal);
        b.box(1.0, 0, z - 0.15, 1.6, 3.2, z + 0.15, m.darkMetal);
        b.box(-1.0, 2.7, z - 0.15, 1.0, 3.2, z + 0.15, m.darkMetal);
        b.sign(hazard, 2.0, 0.25, 0, 2.95, z + 0.16, 0, { glow: 1.1 });
      }
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), glowMat('#ff3b30', 3));
      beacon.position.set(0, 3.05, 3.2);
      b.scene.add(beacon);
      const red = new THREE.PointLight('#ff3b30', 5, 0, 2);
      red.position.set(0, 2.9, 3.2);
      b.scene.add(red);
      let t = 0;
      b.updaters.push((dt) => {
        t += dt;
        red.intensity = 5 * (0.4 + 0.6 * Math.abs(Math.sin(t * 2.4))) * Math.max(0, 1 - t / 4);
        if (t > 4) beacon.material.color.set('#3dff7a').multiplyScalar(2.5);
      });
      titleSign(-1.58, 1.6, 3.2, Math.PI / 2);
      light(0, 2.8, 4.2, 5, '#d6e6ff');
      break;
    }
    case 'overlook': {
      // A balcony over the void with a walkway to the first door.
      b.box(-3, -0.4, 2.4, 3, 0, 7.4, m.floor, { tile: 2 });
      b.box(-1.3, -0.3, 0, 1.3, 0, 2.4, b.mat.metal, { tile: 2 });
      const rail = glowMat(th.accent, 1.9);
      b.box(-3.05, 0, 2.4, -2.95, 1.25, 7.4, b.mat.glass, { tile: 0, gun: false, solid: false });
      b.box(2.95, 0, 2.4, 3.05, 1.25, 7.4, b.mat.glass, { tile: 0, gun: false, solid: false });
      b.box(-3, 0, 7.35, 3, 1.25, 7.45, b.mat.glass, { tile: 0, gun: false, solid: false });
      b.box(-1.35, 0, 0, -1.25, 1.25, 2.4, b.mat.glass, { tile: 0, gun: false, solid: false });
      b.box(1.25, 0, 0, 1.35, 1.25, 2.4, b.mat.glass, { tile: 0, gun: false, solid: false });
      b.box(-3, 0, 2.35, -1.35, 1.25, 2.45, b.mat.glass, { tile: 0, gun: false, solid: false });
      b.box(1.35, 0, 2.35, 3, 1.25, 2.45, b.mat.glass, { tile: 0, gun: false, solid: false });
      b.strip(-3.05, 1.22, 2.4, -2.95, 1.28, 7.4, rail);
      b.strip(2.95, 1.22, 2.4, 3.05, 1.28, 7.4, rail);
      b.strip(-3, 1.22, 7.35, 3, 1.28, 7.45, rail);
      // Title on a free-standing post.
      b.box(-0.08, 0, 6.6, 0.08, 1.5, 6.76, b.mat.darkMetal, { tile: 0 });
      titleSign(0, 2.0, 6.5, 0);
      b.sign(signTexture([{ text: plan.worldName.toUpperCase(), size: 40, color: th.accent }], { w: 512, h: 96, bg: '#0b0d10' }), 1.4, 0.26, 0, 2.9, 6.5, 0, { glow: 1.2 });
      light(0, 4, 5, 10);
      break;
    }
    default: {
      corridorShell(1.6, 6.4, 3.2);
      b.strip(-1.2, 0, 0, -1.17, 0.06, 6);
      b.strip(1.17, 0, 0, 1.2, 0.06, 6);
      titleSign(-1.18, 1.8, 3.4, Math.PI / 2);
      light(0, 2.8, 3, 8);
    }
  }
}

function plant(b, x, y, z, rng) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 14), b.mat.darkMetal);
  pot.position.set(x, y + 0.25, z);
  const leaf = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.28 + rng() * 0.08, 0.5, 0.28), roughness: 0.8 });
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + rng() * 0.2, 0), leaf);
  bush.position.set(x, y + 0.95, z);
  bush.scale.y = 1.3;
  b.scene.add(pot, bush);
}

function hazardTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffcc00';
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#111';
  for (let x = -64; x < 576; x += 64) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 32, 64); g.lineTo(x + 64, 0); g.lineTo(x + 32, 0); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- exit
export const EXITS = ['freedom', 'daylight', 'portal', 'elevator'];

// The final corridor. The exit trigger is always x ±1.2, z zEnd-7 → zEnd-4.5.
export function buildExit(b, y0, zEnd, rng, kind) {
  const m = b.mat;
  const z0 = zEnd - 7;
  b.box(-1.6, y0 - 0.4, z0, 1.6, y0, zEnd, m.floor, { tile: 2 });
  b.box(-1.6, y0, z0, -1.2, y0 + 3.2, zEnd, m.wall);
  b.box(1.2, y0, z0, 1.6, y0 + 3.2, zEnd, m.wall);
  b.box(-1.6, y0, z0 - 0.4, 1.6, y0 + 3.2, z0, m.wall);
  b.box(-1.6, y0 + 3.2, z0, 1.6, y0 + 3.5, zEnd, m.ceiling);
  const light = (c, i) => {
    const l = new THREE.PointLight(c, i, 0, 2);
    l.position.set(0, y0 + 2.6, zEnd - 5);
    b.scene.add(l);
  };
  switch (kind) {
    case 'daylight': {
      // The end wall is pure light: a doorway out into the sun.
      b.box(-1.19, y0, z0 - 0.02, 1.19, y0 + 3.19, z0 + 0.02, glowMat('#fffdf4', 3.2), { collide: false, tile: 0 });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 6, 16, 1, true), new THREE.MeshBasicMaterial({
        color: '#fff6d8', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide,
      }));
      beam.rotation.x = Math.PI / 2;
      beam.position.set(0, y0 + 1.6, z0 + 3);
      b.scene.add(beam);
      light('#fff4dc', 16);
      break;
    }
    case 'portal': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 12, 48), glowMat(b.theme.accent, 2.4));
      ring.position.set(0, y0 + 1.4, z0 + 0.3);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(b.theme.accent).multiplyScalar(0.9), transparent: true, opacity: 0.8 }));
      disc.position.copy(ring.position).z += 0.01;
      b.scene.add(ring, disc);
      let t = 0;
      b.updaters.push((dt) => { t += dt; ring.rotation.z += dt * 0.8; disc.material.opacity = 0.65 + Math.sin(t * 3) * 0.15; });
      light(b.theme.accent, 10);
      break;
    }
    case 'elevator': {
      b.box(-1.2, y0, z0, -1.18, y0 + 3.2, z0 + 3, m.metal, { collide: false, tile: 0 });
      b.box(1.18, y0, z0, 1.2, y0 + 3.2, z0 + 3, m.metal, { collide: false, tile: 0 });
      b.sign(signTexture([{ text: '▲ SURFACE', size: 64, color: '#3dff7a' }], { w: 512, h: 128, bg: '#04120a' }), 1.4, 0.35, 0, y0 + 2.5, z0 + 0.02, 0, { glow: 1.6 });
      b.strip(-0.8, y0 + 3.18, z0 + 0.4, 0.8, y0 + 3.2, z0 + 2.6, glowMat('#eafff0', 2));
      light('#d8ffe6', 9);
      break;
    }
    default:
      b.sign(signTexture([{ text: 'FREEDOM', size: 90 }], { bg: '#f4fff8', fg: '#1a6b3a' }), 1.6, 0.8, 0, y0 + 1.6, z0 + 0.02, 0, { glow: 1.4 });
      light('#c8ffd8', 8);
  }
}

// ---------------------------------------------------------------- room dress
export const RIGS = ['panels', 'sconces', 'skylight', 'neon', 'spots', 'lanterns'];
const TEMPS = { warm: '#ffd7a8', neutral: '#fff4e6', cool: '#d8e8ff' };

export function roomStyle(rng, hasCeiling, cozy = false) {
  // Escape rooms: warm, dim, lived-in light.
  if (cozy) {
    return { cozy: true, rig: pick(rng, ['sconces', 'lanterns', 'sconces']), temp: 'warm', ceiling: pick(rng, ['beams', 'coffers', 'flat']), floor: 'plain' };
  }
  return {
    rig: hasCeiling ? pick(rng, RIGS) : pick(rng, ['panels', 'lanterns', 'spots']),
    temp: pick(rng, ['warm', 'neutral', 'cool', 'accent']),
    ceiling: pick(rng, ['flat', 'beams', 'coffers', 'pipes', 'flat']),
    floor: pick(rng, ['plain', 'border', 'runner', 'plain', 'grid']),
  };
}

// Dresses a built cell: recolours/moves its lights per the rig and adds fixtures.
// Fixtures are visual only (no collision, never block rays or portal shots).
export function dressRoom(b, cell, style) {
  const { x0, x1, y0, h, zS, zN, w, d } = cell;
  const cz = (zS + zN) / 2;
  const accent = b.theme.accent;
  const tint = style.temp === 'accent' ? new THREE.Color(accent).lerp(new THREE.Color('#ffffff'), 0.55) : new THREE.Color(TEMPS[style.temp]);
  for (const l of cell.lamps) l.color.copy(tint);
  if (cell.key) cell.key.color.lerp(tint, 0.5);
  if (style.cozy) {
    for (const l of cell.lamps) l.intensity *= 0.55;
    if (cell.key) cell.key.intensity *= 0.45;
  }
  const fx = { collide: false, tile: 0, castShadow: false };
  const top = y0 + h;

  switch (style.rig) {
    case 'sconces': {
      // Lamps move to the side walls; glowing sconces every few metres.
      cell.lamps.forEach((l, i) => l.position.set(i % 2 ? x1 - 0.8 : x0 + 0.8, y0 + h * 0.62, cz + (i ? -d / 5 : d / 5)));
      const mat = glowMat(`#${tint.getHexString()}`, 2.2);
      for (let z = zS - 2; z > zN + 1.5; z -= 3.2) {
        for (const x of [x0 + 0.06, x1 - 0.06]) b.box(x - 0.05, top - 1.3, z - 0.18, x + 0.05, top - 0.9, z + 0.18, mat, fx);
      }
      break;
    }
    case 'skylight': {
      const mat = glowMat('#eef6ff', 1.6);
      if (cell.hasCeiling) b.box(-w * 0.28, top - 0.04, cz - d * 0.3, w * 0.28, top - 0.01, cz + d * 0.3, mat, fx);
      for (const l of cell.lamps) l.color.set('#eef6ff');
      if (cell.key) { cell.key.position.set(0, top - 0.1, cz); cell.key.target.position.set(0, y0, cz); cell.key.angle = 1.0; }
      break;
    }
    case 'neon': {
      const a = glowMat(accent, 2.4);
      const bcol = new THREE.Color(accent).offsetHSL(0.45, 0, 0);
      const bm = glowMat(`#${bcol.getHexString()}`, 2.2);
      for (const [x, mat] of [[-w / 4, a], [w / 4, bm]]) b.box(x - 0.05, top - 0.12, zN + 0.8, x + 0.05, top - 0.04, zS - 0.8, mat, fx);
      cell.lamps.forEach((l, i) => { l.color.copy(i % 2 ? bcol : new THREE.Color(accent)).lerp(new THREE.Color('#ffffff'), 0.35); l.intensity *= 0.8; });
      break;
    }
    case 'spots': {
      // Pools of light: narrow key light and visible spot cans.
      if (cell.key) { cell.key.angle = 0.6; cell.key.penumbra = 0.3; cell.key.intensity *= 1.4; }
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 ? 1 : -1) * w * 0.25, z = cz + (i < 2 ? 1 : -1) * d * 0.22;
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.35, 12), b.mat.darkMetal);
        can.position.set(x, top - 0.2, z);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), glowMat(`#${tint.getHexString()}`, 2.5));
        lens.rotation.x = Math.PI / 2;
        lens.position.set(x, top - 0.38, z);
        b.scene.add(can, lens);
      }
      for (const l of cell.lamps) l.intensity *= 0.7;
      break;
    }
    case 'lanterns': {
      const mat = glowMat(`#${tint.getHexString()}`, 2.0);
      const rope = b.mat.darkMetal;
      const n = Math.max(2, Math.round(d / 4));
      for (let i = 0; i < n; i++) {
        for (const x of [-w * 0.3, w * 0.3]) {
          const z = zS - ((i + 0.5) / n) * d;
          const drop = 0.6 + ((i * 7 + (x > 0 ? 3 : 0)) % 5) * 0.12;
          const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mat);
          lantern.position.set(x, top - drop - 0.2, z);
          const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, drop, 4), rope);
          cord.position.set(x, top - drop / 2, z);
          b.scene.add(lantern, cord);
        }
      }
      break;
    }
    default: break; // 'panels': the cell's own ceiling panels
  }

  if (cell.hasCeiling) {
    const mat = b.mat.darkMetal;
    if (style.ceiling === 'beams') {
      for (let z = zS - 1.5; z > zN + 0.5; z -= 2.4) b.box(x0, top - 0.3, z - 0.15, x1, top, z + 0.15, mat, fx);
    } else if (style.ceiling === 'coffers') {
      for (let z = zS - 2; z > zN + 1; z -= 2) b.box(x0, top - 0.18, z - 0.06, x1, top, z + 0.06, mat, fx);
      for (let x = x0 + 2; x < x1 - 1; x += 2) b.box(x - 0.06, top - 0.18, zN, x + 0.06, top, zS, mat, fx);
    } else if (style.ceiling === 'pipes') {
      for (const x of [x0 + 0.5, x0 + 0.85, x1 - 0.6]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, d, 10), b.mat.metal);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(x, top - 0.25, cz);
        b.scene.add(pipe);
      }
    }
  }

  const fy = y0 + 0.011;
  const gaps = cell.floorGaps ?? [];
  const onFloor = (zA, zB) => !gaps.some(([lo, hi]) => zA > lo - 0.1 && zB < hi + 0.1);
  if (style.floor === 'border' && !gaps.length) {
    const mat = glowMat(accent, 0.9);
    for (const x of [x0 + 0.6, x1 - 0.65]) b.box(x, y0, zN + 0.6, x + 0.05, fy, zS - 0.6, mat, fx);
  } else if (style.floor === 'runner' && onFloor(zN, zS)) {
    const rug = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent).multiplyScalar(0.35), roughness: 1 });
    b.box(-0.9, y0, zN + 0.8, 0.9, fy, zS - 0.8, rug, { ...fx, castShadow: false });
  } else if (style.floor === 'grid') {
    const mat = glowMat(accent, 0.6);
    for (let z = zS - 2; z > zN + 1; z -= 2) if (onFloor(z - 0.03, z + 0.03)) b.box(x0 + 0.5, y0, z - 0.02, x1 - 0.5, fy, z + 0.02, mat, fx);
  }
}

// ---------------------------------------------------------------- vista
// Enormous shapes far outside the level. Only visible where the level opens
// up (bridges, overlooks, sky rooms), which is exactly where they matter.
export function buildVista(b, rng, { zMin, zMax }) {
  const th = b.theme;
  const kind = pick(rng, ['monoliths', 'rings', 'spheres', 'stairs', 'towers']);
  const fogC = new THREE.Color(th.fog);
  const base = new THREE.Color(th.accent).lerp(fogC, 0.55);
  const mat = new THREE.MeshBasicMaterial({ color: base, fog: true });
  const edge = new THREE.MeshBasicMaterial({ color: new THREE.Color(th.accent).multiplyScalar(1.3), fog: true });
  const zc = (zMin + zMax) / 2, span = zMax - zMin;
  const group = new THREE.Group();
  b.scene.add(group);
  const spin = [];
  const count = irange(rng, 7, 12);
  for (let i = 0; i < count; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const x = side * range(rng, 45, 110);
    const z = zc + range(rng, -span / 2 - 40, span / 2 + 40);
    const y = range(rng, -30, 40);
    let mesh;
    if (kind === 'monoliths') mesh = new THREE.Mesh(new THREE.BoxGeometry(range(rng, 4, 10), range(rng, 30, 80), range(rng, 4, 10)), mat);
    else if (kind === 'rings') { mesh = new THREE.Mesh(new THREE.TorusGeometry(range(rng, 10, 28), range(rng, 0.6, 1.6), 8, 48), edge); spin.push(mesh); }
    else if (kind === 'spheres') mesh = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 6, 20), 24, 16), mat);
    else if (kind === 'stairs') {
      mesh = new THREE.Group();
      for (let s = 0; s < 14; s++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 3), s % 3 ? mat : edge);
        step.position.set(0, s * 1.5, -s * 3);
        mesh.add(step);
      }
      mesh.rotation.set(range(rng, -0.6, 0.6), rng() * Math.PI * 2, range(rng, -0.8, 0.8));
    } else {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(range(rng, 2, 5), range(rng, 3, 7), range(rng, 50, 120), 6), mat);
      mesh.position.y = -20;
    }
    mesh.position.x = x;
    mesh.position.z = z;
    mesh.position.y += y;
    if (kind !== 'stairs') mesh.rotation.set(rng() * 0.6, rng() * Math.PI, rng() * 0.6);
    group.add(mesh);
  }
  if (spin.length) b.updaters.push((dt) => { for (const s of spin) s.rotation.y += dt * 0.05; });
}
