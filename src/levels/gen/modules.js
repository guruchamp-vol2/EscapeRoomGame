// The 15 puzzle modules generated levels are assembled from. Each module:
//   dims(rng)   → the room size it needs (+ any params build() wants)
//   build(cell, b, ctx, rng, info, dims) → {
//     label, detail, hint,            objective text
//     solved(),                        latches the module complete
//     doorOpen?(),                     door state if it isn't simply "solved"
//     update?(dt, player), onTeleport?(portal),
//     reserve,                         side-wall spans decor must leave clear
//     debug,                           data the auto-solver uses to test it
//   }
// Layout ranges are chosen so every module is solvable by construction (jump
// height, forced-perspective ratios, lines of sight); the auto-solver checks it.
import * as THREE from 'three';
import { signTexture, codeCanvasTexture, floorMarkerTexture, dynamicTexture, tileTexture, patternTexture } from '../../textures.js';
import { range, irange, pick, shuffle, randomCode } from '../../random.js';
import { T, DOOR_H } from './cell.js';

const COLORS = [
  { name: 'red', hex: '#ff4040' }, { name: 'green', hex: '#3dff6a' }, { name: 'blue', hex: '#4a7dff' },
  { name: 'yellow', hex: '#ffe23d' }, { name: 'magenta', hex: '#ff3df0' }, { name: 'cyan', hex: '#3dfcff' },
  { name: 'orange', hex: '#ff9a2e' }, { name: 'white', hex: '#ffffff' },
];
const r1 = (v) => Math.round(v * 10) / 10;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- shared helpers ----------
function sidePanel(b, cell, side, z, y0 = cell.y0) {
  return b.panel(side === 'e' ? '-x' : '+x', side === 'e' ? cell.x1 : cell.x0, z, cell.walls[side], y0);
}

function northPanel(b, cell, x, y0) {
  return b.panel('+z', cell.zN, x, x < 0 ? cell.walls.nW : cell.walls.nE, y0);
}

// Up to `count` panels on random side walls within [zLo, zHi], not overlapping.
function sidePanels(b, cell, rng, zLo, zHi, count, reserve, exclude = {}) {
  const recs = [];
  const used = { w: [...(exclude.w ?? [])], e: [...(exclude.e ?? [])] };
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const side = rng() < 0.5 ? 'w' : 'e';
      const z = range(rng, zLo + 0.8, zHi - 0.8);
      if (used[side].some((u) => Math.abs(u - z) < 2.0)) continue;
      used[side].push(z);
      recs.push(sidePanel(b, cell, side, z));
      (reserve[side] ??= []).push([z - 0.9, z + 0.9]);
      break;
    }
  }
  return recs;
}

export const codeLength = (d) => (d >= 0.5 ? 4 : 3);

// Fake panels (the "decoys" twist): look almost like portal panels but won't
// take a portal. Faint red stripes are the tell.

function decoys(b, cell, rng, zLo, zHi, count, reserve, info) {
  if (!info?.twists?.includes('decoys') || zHi - zLo < 2) return;
  b._decoyMat ??= new THREE.MeshStandardMaterial({ map: patternTexture('stripes', '#e6e9ec', '#ead2d2', 7), roughness: 0.45 });
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const side = rng() < 0.5 ? 'w' : 'e';
      const z = range(rng, zLo + 0.8, zHi - 0.8);
      const spans = reserve[side] ?? [];
      if (spans.some(([a, c]) => z > a - 1.0 && z < c + 1.0)) continue;
      const x = side === 'e' ? cell.x1 : cell.x0, sg = side === 'e' ? -1 : 1;
      b.box(Math.min(x, x + sg * 0.04), cell.y0, z - 0.75, Math.max(x, x + sg * 0.04), cell.y0 + 2.6, z + 0.75, b._decoyMat, { collide: false, solid: true, gun: true, tile: 1.3 });
      (reserve[side] ??= []).push([z - 0.9, z + 0.9]);
      break;
    }
  }
}

function exitKeypad(b, cell, code, onSolve) {
  const pos = { x: 1.6, y: cell.y0 + cell.exitY + 1.45, z: cell.zN };
  const kp = b.keypad({ ...pos, rotY: 0, code, onSolve });
  return { kp, pos };
}

function pedestalCube(b, cell, x, z, size, height = 1.0) {
  b.pedestal(x, z, 0.7, cell.y0 + height, cell.y0);
  return b.cube(x, cell.y0 + height + size / 2, z, size);
}

function ledge(b, cell, depth, height) {
  const front = cell.zN + depth;
  b.box(cell.x0, cell.y0, cell.zN, cell.x1, cell.y0 + height, front, cell.mat.wall, { tile: 1.5 });
  b.strip(cell.x0, cell.y0 + height - 0.05, front - 0.02, cell.x1, cell.y0 + height, front + 0.03);
  return front;
}

function infoSign(b, lines, w, h, x, y, z, rotY, accent) {
  return b.sign(signTexture(lines, { bg: '#0d1014', border: accent, w: 640, h: 320 }), w, h, x, y, z, rotY, { glow: 1.15 });
}

// Canvas sign with a title and a row of coloured circles (optionally numbered).
function circlesTexture(title, colors, numbered, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 384;
  const g = canvas.getContext('2d');
  g.fillStyle = '#0d1014';
  g.fillRect(0, 0, 768, 384);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#e8eef2';
  g.font = 'bold 56px system-ui, sans-serif';
  g.fillText(title, 384, 70);
  const n = colors.length;
  const gap = Math.min(150, 640 / n);
  colors.forEach((c, i) => {
    const x = 384 + (i - (n - 1) / 2) * gap;
    g.fillStyle = c;
    g.beginPath(); g.arc(x, 200, 48, 0, Math.PI * 2); g.fill();
    if (numbered) {
      g.fillStyle = '#0d1014';
      g.font = 'bold 44px system-ui, sans-serif';
      g.fillText(String(i + 1), x, 202);
    }
  });
  if (subtitle) {
    g.fillStyle = '#9aa4ae';
    g.font = '36px system-ui, sans-serif';
    g.fillText(subtitle, 384, 320);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function anamorph(scene, texture, viewpoint, yaw, rng, extra) {
  const { refDist, refW, refH, centerY } = extra;
  const cols = Math.round(8 + (extra.diff ?? 0) * 10), rows = 3 + Math.round((extra.diff ?? 0) * 2);
  const forward = V(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = V(Math.cos(yaw), 0, -Math.sin(yaw));
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  material.color.setScalar(1.6);
  const pw = refW / cols, ph = refH / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const geo = new THREE.PlaneGeometry(pw, ph);
      const uv = geo.attributes.uv;
      const u0 = i / cols, u1 = (i + 1) / cols, v0 = 1 - (j + 1) / rows, v1 = 1 - j / rows;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
      const ref = viewpoint.clone().addScaledVector(forward, refDist).addScaledVector(right, -refW / 2 + (i + 0.5) * pw);
      ref.y = centerY + refH / 2 - (j + 0.5) * ph;
      const k = 0.5 + rng() * 1.1;
      const shard = new THREE.Mesh(geo, material);
      shard.position.copy(ref).sub(viewpoint).multiplyScalar(k).add(viewpoint);
      shard.rotation.y = yaw;
      shard.scale.setScalar(k);
      scene.add(shard);
    }
  }
}

// A remote room far from the main level (reached or seen through a portal).
function remoteRoom(b, { x, size, height, sky }) {
  const m = b.mat;
  const h2 = size / 2;
  b.box(x - h2 - T, -0.4, -h2 - T, x + h2 + T, 0, h2 + T, m.floor, { tile: 4 });
  if (!sky) b.box(x - h2 - T, height, -h2 - T, x + h2 + T, height + 0.4, h2 + T, m.ceiling);
  const south = b.box(x - h2 - T, 0, h2, x + h2 + T, height, h2 + T, m.wall).userData.collider;
  b.box(x - h2 - T, 0, -h2 - T, x + h2 + T, height, -h2, m.wall);
  b.box(x - h2 - T, 0, -h2, x - h2, height, h2, m.wall);
  b.box(x + h2, 0, -h2, x + h2 + T, height, h2, m.wall);
  b.strip(x - h2, 0, -h2, x + h2, 0.06, -h2 + 0.03);
  b.strip(x - h2, 0, h2 - 0.03, x + h2, 0.06, h2);
  const lamp = new THREE.PointLight(b.theme.lampColor, Math.min(400, size * size * 0.35), 0, 2);
  lamp.position.set(x, height - 1, 0);
  b.scene.add(lamp);
  if (!sky) b.box(x - 0.8, height - 0.05, -0.8, x + 0.8, height, 0.8, b.mat.light, { collide: false, tile: 0, castShadow: false });
  b.particles(b.theme.particles, [x - h2, 0.2, -h2], [x + h2, height - 0.2, h2], Math.min(260, size * size * 0.3));
  return { south };
}

// ---------- modules ----------
export const MODULE_IMPL = {
  grow_plate: {
    dims: (rng, d = 0) => ({ w: range(rng, 10, 14), d: range(rng, 15, 20) + d * 5, h: range(rng, 5, 7) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const cx = range(rng, -2, 2), s0 = range(rng, 0.3, 0.42) - D * 0.06;
      const cube = pedestalCube(b, cell, cx, cell.zS - 3, s0);
      const px = range(rng, -2.5, 2.5), pz = cell.zN + 5.5, min = r1(range(rng, 1.0, 1.2) + D * 0.9);
      const plateSize = 2.4 - D * 0.6;
      const plate = b.plate({ cx: px, cz: pz, y: Y, minSize: min, size: plateSize });
      b.floorDecal(signTexture([{ text: 'PRESSURE PLATE', size: 52 }, { text: `MINIMUM ${min} m`, size: 40, color: '#ffd27a' }], { bg: null }),
        2.4, 1.2, px, pz + 2.0, { y: Y + 0.012 });
      return {
        label: 'Weigh down the plate',
        detail: `The pressure plate needs something at least ${min} m across.`,
        hint: 'Pick up the cube, step back towards the entrance, aim a little above the plate and drop it. The farther away you look, the bigger it gets.',
        solved: () => plate.active,
        reserve: {},
        debug: { cube, plates: [{ x: px, z: pz, y: Y, half: plateSize / 2, min }] },
      };
    },
  },

  step_ledge: {
    dims: (rng, d = 0) => {
      const L = r1(Math.min(2.45, 1.8 + d * 0.55 + range(rng, 0, 0.1)));
      return { w: range(rng, 10, 14), d: range(rng, 14, 18), h: range(rng, 6.5, 8), exitY: L, L };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0, L = dims.L;
      const front = ledge(b, cell, 5, L);
      b.sign(signTexture([{ text: `LEDGE ${L} m`, size: 44 }], { w: 512, h: 96, bg: '#14171c', fg: '#ffcf9a' }), 2.0, 0.38, 0, Y + L - 0.6, front + 0.02, 0);
      const cube = pedestalCube(b, cell, range(rng, -2, 2), cell.zS - 3, range(rng, 0.35, 0.5));
      let up = false, warned = false;
      return {
        label: 'Climb the ledge',
        detail: `The exit is on a ledge ${L} m up. Make yourself a step.`,
        hint: 'Grow the cube into a step about 1 m tall at the foot of the ledge: hold it, look at the bottom of the ledge from far back and drop it. Then jump onto it and up.',
        solved: () => up,
        update(dt, player) {
          if (player.pos.y > Y + L - 0.15 && player.pos.z < front && cell.contains(player.pos)) up = true;
          if (!up && !cube.held && cube.vy === 0 && cube.size > 1.55 && !warned) {
            warned = true;
            ctx.toast('Too tall to climb. Pick it up and look somewhere closer to shrink it.', 'hint');
          }
          if (cube.size <= 1.55) warned = false;
        },
        reserve: {},
        debug: { cube, ledge: { front, top: Y + L } },
      };
    },
  },

  shrink_socket: {
    dims: (rng, d = 0) => ({ w: range(rng, 10, 14), d: range(rng, 12, 16), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const S = range(rng, 1.4, 1.6) + info.diff * 0.3;
      const maxSize = r1(0.8 - info.diff * 0.2);
      const cube = b.cube(range(rng, -2, 2), Y + S / 2, cell.zN + 4, S);
      const side = rng() < 0.5 ? 'w' : 'e';
      const sgn = side === 'e' ? 1 : -1;
      const wallX = side === 'e' ? cell.x1 : cell.x0;
      const inner = wallX - sgn * 1.0;
      const xa = Math.min(wallX, inner), xb = Math.max(wallX, inner);
      const zc = cell.zS - range(rng, 3, 4.5);
      const m = cell.mat.wall;
      b.box(xa, Y, zc - 0.7, xb, Y + 1.0, zc + 0.7, m);
      b.box(xa, Y + 1.9, zc - 0.7, xb, Y + 2.25, zc + 0.7, m);
      b.box(xa, Y + 1.0, zc - 0.7, xb, Y + 1.9, zc - 0.5, m);
      b.box(xa, Y + 1.0, zc + 0.5, xb, Y + 1.9, zc + 0.7, m);
      const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a3c').multiplyScalar(1.8) });
      const mx0 = Math.min(inner, inner - sgn * 0.02), mx1 = Math.max(inner, inner - sgn * 0.02);
      b.strip(mx0, Y + 0.96, zc - 0.54, mx1, Y + 1.0, zc + 0.54, glow);
      b.strip(mx0, Y + 1.9, zc - 0.54, mx1, Y + 1.94, zc + 0.54, glow);
      b.strip(mx0, Y + 0.96, zc - 0.54, mx1, Y + 1.94, zc - 0.5, glow);
      b.strip(mx0, Y + 0.96, zc + 0.5, mx1, Y + 1.94, zc + 0.54, glow);
      b.sign(signTexture([{ text: 'SOCKET', size: 60 }, { text: `max ${maxSize} m`, size: 40, color: '#ffcf9a' }], { w: 512, h: 192, bg: '#14171c' }),
        1.2, 0.45, inner - sgn * 0.02, Y + 2.55, zc, side === 'e' ? -Math.PI / 2 : Math.PI / 2);
      const socket = b.socket({ min: [xa, Y + 1.0, zc - 0.5], max: [xb, Y + 1.9, zc + 0.5], maxSize, glow });
      return {
        label: 'Fill the socket',
        detail: `The socket only takes something ${maxSize} m or smaller.`,
        hint: 'Pick up the big cube from a few metres away, then walk up to the socket and look into it from close. It shrinks to fit.',
        solved: () => socket.filled,
        reserve: { [side]: [[zc - 1, zc + 1]] },
        debug: { cube, socket: { x: (xa + xb) / 2, y: Y + 1.45, z: zc, mouthX: inner, side, maxSize } },
      };
    },
  },

  portal_glass: {
    gun: true,
    dims: (rng, d = 0) => ({ w: range(rng, 12, 16), d: range(rng, 16, 22), h: range(rng, 6, 8) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const gz = cell.zS - cell.d * range(rng, 0.45, 0.55);
      b.box(cell.x0, Y, gz - 0.05, cell.x1, Y + cell.h, gz + 0.05, b.mat.glass, { gun: false, tile: 0 });
      for (const x of [-cell.w / 4, cell.w / 4]) b.box(x - 0.05, Y, gz - 0.08, x + 0.05, Y + cell.h, gz + 0.08, b.mat.darkMetal, { gun: false, tile: 0 });
      b.sign(signTexture([{ text: 'Portal energy passes through glass.', size: 34 }], { w: 768, h: 96, bg: '#0f1720', fg: '#9fd0ff', border: '#3aa0ff' }),
        3.0, 0.38, -cell.w / 4 - 1.8, Y + 2.3, gz + 0.06, 0);
      const reserve = {};
      const near = sidePanels(b, cell, rng, gz + 2.0, cell.zS - 1.6, rng() < 0.4 ? 2 : 1, reserve);
      const far = sidePanels(b, cell, rng, cell.zN + 1.6, gz - 2.0, rng() < 0.4 ? 2 : 1, reserve);
      decoys(b, cell, rng, gz + 2.0, cell.zS - 1.6, 1, reserve, info);
      decoys(b, cell, rng, cell.zN + 1.6, gz - 2.0, 2, reserve, info);
      let passed = false;
      return {
        label: 'Get past the glass',
        detail: 'No door through the glass, but there are white panels on both sides.',
        hint: 'Shoot one portal on a white panel on your side and the other on a panel behind the glass. Portal shots pass through glass.',
        solved: () => passed,
        update(dt, player) {
          if (player.pos.z < gz - 0.3 && cell.contains(player.pos)) passed = true;
        },
        reserve,
        debug: { near, far, glassZ: gz },
      };
    },
  },

  portal_ledge: {
    gun: true,
    dims: (rng, d = 0) => {
      const L = r1(3.6 + d * 2.4 + range(rng, 0, 0.4));
      return { w: range(rng, 12, 16), d: range(rng, 17, 21), h: Math.max(range(rng, 9, 10.5), L + DOOR_H + 1.2), exitY: L, L };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0, L = dims.L;
      const front = ledge(b, cell, 4, L);
      const lx = (rng() < 0.5 ? -1 : 1) * range(rng, 2.6, cell.w / 2 - 1.4);
      const ledgePanel = northPanel(b, cell, lx, Y + L);
      const reserve = {};
      const floorPanels = sidePanels(b, cell, rng, front + 2.0, cell.zS - 1.6, rng() < 0.4 ? 2 : 1, reserve);
      decoys(b, cell, rng, front + 2.0, cell.zS - 1.6, 2, reserve, info);
      let up = false;
      return {
        label: 'Reach the high exit',
        detail: `The exit is ${L} m up, far too high to climb.`,
        hint: 'There is a white panel up on the ledge. Put one portal there and the other on a panel you can walk into.',
        solved: () => up,
        update(dt, player) {
          if (player.pos.y > Y + L - 0.15 && player.pos.z < front && cell.contains(player.pos)) up = true;
        },
        reserve,
        debug: { ledgePanel, floorPanels, ledge: { front, top: Y + L } },
      };
    },
  },

  portal_pit: {
    gun: true,
    dims: (rng, d = 0) => {
      const a = range(rng, 4.5, 6.5), g = range(rng, 6, 7.5) + d * 4, far = range(rng, 6, 8);
      return { w: range(rng, 12, 16), d: a + g + far, h: range(rng, 6, 8), pit: { a, g } };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0;
      const { a, g } = dims.pit;
      const pitS = cell.zS - a, pitN = pitS - g;
      // Shaft walls so the pit looks bottomless.
      b.box(cell.x0 - T, Y - 30, pitN, cell.x0, Y - 0.4, pitS, cell.mat.wall, { castShadow: false });
      b.box(cell.x1, Y - 30, pitN, cell.x1 + T, Y - 0.4, pitS, cell.mat.wall, { castShadow: false });
      b.box(cell.x0, Y - 30, pitS, cell.x1, Y - 0.4, pitS + T, cell.mat.wall, { castShadow: false });
      b.box(cell.x0, Y - 30, pitN - T, cell.x1, Y - 0.4, pitN, cell.mat.wall, { castShadow: false });
      const hazard = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcc22').multiplyScalar(1.5) });
      b.strip(cell.x0, Y - 0.02, pitS - 0.02, cell.x1, Y + 0.01, pitS + 0.15, hazard);
      b.strip(cell.x0, Y - 0.02, pitN - 0.15, cell.x1, Y + 0.01, pitN + 0.02, hazard);
      const reserve = {};
      const near = sidePanels(b, cell, rng, pitS + 1.0, cell.zS - 1.3, 1, reserve);
      const far = sidePanels(b, cell, rng, cell.zN + 1.2, pitN - 1.0, rng() < 0.4 ? 2 : 1, reserve);
      decoys(b, cell, rng, cell.zN + 1.2, pitN - 1.0, 2, reserve, info);
      let crossed = false;
      return {
        label: 'Cross the chasm',
        detail: 'Far too wide to jump.',
        hint: 'Put one portal on the panel on your side of the chasm and the other on a panel across it.',
        solved: () => crossed,
        update(dt, player) {
          if (player.pos.z < pitN - 0.3 && player.pos.y > Y - 0.5 && cell.contains(player.pos)) crossed = true;
        },
        reserve,
        debug: { near, far, pitN, pitS },
      };
    },
  },

  anamorph_code: {
    dims: (rng, d = 0) => ({ w: range(rng, 12, 16), d: range(rng, 16, 20), h: range(rng, 7, 8) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const code = randomCode(rng, codeLength(info.diff));
      const facing = info.diff < 0.25 ? 'north' : pick(rng, ['north', 'east', 'west']);
      let vp, yaw, L, lateral;
      const zMid = (cell.zS + cell.zN) / 2 + range(rng, -1, 1);
      if (facing === 'north') {
        vp = V(range(rng, -1.5, 1.5), Y + 1.6, cell.zS - 1.5);
        yaw = 0; L = cell.d - 2.5; lateral = cell.w / 2 - Math.abs(vp.x) - 0.6;
      } else {
        const east = facing === 'east';
        vp = V(east ? cell.x0 + 1.2 : cell.x1 - 1.2, Y + 1.6, zMid);
        yaw = east ? -Math.PI / 2 : Math.PI / 2; L = cell.w - 2.2;
        lateral = Math.min(vp.z - cell.zN, cell.zS - vp.z) - 0.6;
      }
      const refW = Math.min(7, (2 * lateral) / 1.65);
      anamorph(b.scene, codeCanvasTexture(code, '#ffffff', b.theme.accent), vp, yaw, rng, {
        refDist: 0.55 * L, refW, refH: refW / 2, centerY: Y + 3.0, diff: info.diff,
      });
      const markerRot = { north: 0, east: -Math.PI / 2, west: Math.PI / 2 }[facing];
      b.floorDecal(floorMarkerTexture(b.theme.accent), 1.2, 1.2, vp.x, vp.z, { y: Y + 0.012, rotZ: markerRot });
      const { kp, pos } = exitKeypad(b, cell, code);
      return {
        label: 'Find the hidden code',
        detail: 'The keypad wants three digits. Something in here only makes sense from the right spot.',
        hint: 'Stand on the glowing eye marker on the floor and look straight ahead.',
        solved: () => kp.solved,
        reserve: {},
        debug: { keypad: pos, code, viewpoint: vp, yaw },
      };
    },
  },

  loop_rooms: {
    dims: (rng, d = 0) => ({ w: range(rng, 18, 26), d: 3.4, h: 3.6, ceiling: true }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, zc = (cell.zS + cell.zN) / 2;
      const flat = new THREE.Color(b.theme.fog).getHex();
      const opts = { width: cell.d, height: cell.h, flatColor: flat };
      const east = b.portal({ ...opts, name: `loop-e-${info.slot}` }, V(cell.x1 - 0.6, Y + cell.h / 2, zc), -Math.PI / 2);
      const west = b.portal({ ...opts, name: `loop-w-${info.slot}` }, V(cell.x0 + 0.6, Y + cell.h / 2, zc), Math.PI / 2);
      east.link = west;
      west.link = east;
      const D = info.diff;
      const target = pick(rng, D < 0.3 ? [-1, 0, 2, 3] : D < 0.65 ? [-3, -2, 4, 5] : [-5, -4, 6, 7]);
      let room = 1, reached = false;
      const plaque = dynamicTexture(512, 160);
      b.sign(plaque.tex, 1.4, 0.44, -2.6, Y + 2.0, cell.zN + 0.02, 0, { glow: 1.3 });
      infoSign(b, [{ text: 'THE EXIT', size: 52 }, { text: `opens in room ${target}`, size: 52, color: b.theme.accent }],
        1.6, 0.8, 2.8, Y + 1.9, cell.zS - 0.02, Math.PI, b.theme.accent);
      const draw = () => {
        const { g, w, h, tex } = plaque;
        g.fillStyle = '#0a0d10';
        g.fillRect(0, 0, w, h);
        g.fillStyle = room === target ? '#4dff88' : b.theme.accent;
        g.font = 'bold 84px system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(`ROOM ${room}`, w / 2, h / 2 + 4);
        tex.needsUpdate = true;
        const hue = (((room * 0.17) % 1) + 1) % 1;
        for (const l of cell.lamps) l.color.setHSL(hue, 0.55, 0.72);
      };
      draw();
      return {
        label: `Find room ${target}`,
        detail: 'The corridor loops forever. Walking each way changes the room number.',
        hint: `Walking east through the end counts up, walking west counts down. The exit door only opens in room ${target}.`,
        solved: () => reached,
        doorOpen: () => room === target,
        onTeleport(portal) {
          if (portal === east) room++;
          else if (portal === west) room--;
          else return;
          if (room === target) reached = true;
          draw();
        },
        reserve: { w: [[cell.zN, cell.zS]], e: [[cell.zN, cell.zS]] },
        debug: { target, get room() { return room; }, zc, x0: cell.x0, x1: cell.x1 },
      };
    },
  },

  bigger_inside: {
    dims: (rng, d = 0) => ({ w: range(rng, 10, 14), d: range(rng, 12, 16), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const side = rng() < 0.5 ? -1 : 1;
      const bx = side * (cell.w / 2 - 1.4), bz = (cell.zS + cell.zN) / 2;
      const closet = new THREE.MeshStandardMaterial({ map: tileTexture(b.theme.wallLine, b.theme.wall, 1, 10), roughness: 0.6, metalness: 0.2 });
      const box = (xa, ya, za, xb, yb, zb) => b.box(bx + xa, Y + ya, bz + za, bx + xb, Y + yb, bz + zb, closet, { tile: 1 });
      box(-1, 0, 0.9, -0.6, 2.8, 1.0);
      box(0.6, 0, 0.9, 1, 2.8, 1.0);
      box(-0.6, 2.4, 0.9, 0.6, 2.8, 1.0);
      box(-1, 0, -1.0, 1, 2.8, -0.9);
      box(-1, 0, -0.9, -0.9, 2.8, 0.9);
      box(0.9, 0, -0.9, 1, 2.8, 0.9);
      box(-1.05, 2.8, -1.05, 1.05, 2.95, 1.05);
      b.sign(signTexture([{ text: 'STORAGE', size: 80 }], { w: 512, h: 128, bg: '#1b2128' }), 0.9, 0.22, bx, Y + 2.6, bz + 1.01, 0);
      const closetPortal = b.portal({ width: 1.2, height: 2.4, name: `closet-${info.slot}` }, V(bx, Y + 1.2, bz + 0.95), 0);

      const RX = info.remoteX, size = range(rng, 20, 28) + info.diff * 14, height = range(rng, 9, 13);
      const room = remoteRoom(b, { x: RX, size, height, sky: !!b.theme.sky });
      const remotePortal = b.portal({ width: 1.2, height: 2.4, name: `remote-${info.slot}` }, V(RX, 1.2, size / 2 - 0.07), Math.PI, [room.south]);
      closetPortal.link = remotePortal;
      remotePortal.link = closetPortal;
      b.sign(signTexture([{ text: 'STORAGE', size: 80 }], { w: 512, h: 128, bg: '#1b2128' }), 0.9, 0.22, RX, 2.6, size / 2 - 0.02, Math.PI);
      const bxPos = RX + range(rng, -size / 2 + 3, size / 2 - 3), bzPos = range(rng, -size / 2 + 3, -2);
      let pressed = false;
      const button = b.button({
        x: bxPos, y: 0, z: bzPos, color: b.theme.accent, label: 'Press the power switch',
        onPress: () => {
          if (pressed) return;
          pressed = true;
          b.ctx.sfx.play('unlock');
          ctx.toast('Somewhere, a door unlocks.', 'success');
        },
      });
      return {
        label: 'Find the power switch',
        detail: 'There is a storage closet in here. It is bigger than it looks.',
        hint: 'Walk into the storage closet. The switch is in the huge room inside it.',
        solved: () => pressed,
        reserve: { [side < 0 ? 'w' : 'e']: [[bz - 1.6, bz + 1.6]] },
        debug: { closet: { x: bx, front: bz + 1.0 }, remotePortalZ: size / 2 - 0.07, remoteX: RX, button: { x: bxPos, y: 0.95, z: bzPos } },
      };
    },
  },

  window_code: {
    dims: (rng, d = 0) => ({ w: range(rng, 10, 14), d: range(rng, 12, 16), h: range(rng, 6, 7) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const code = randomCode(rng, codeLength(info.diff));
      const side = rng() < 0.5 ? 'w' : 'e';
      const sgn = side === 'e' ? 1 : -1;
      const wallX = side === 'e' ? cell.x1 : cell.x0;
      const zc = (cell.zS + cell.zN) / 2 + range(rng, -1.5, 1.5);
      const W = 2.6, H = 1.7, cy = Y + 2.5 + H / 2;
      const win = b.portal({ width: W, height: H, name: `window-${info.slot}` }, V(wallX - sgn * 0.06, cy, zc), side === 'e' ? -Math.PI / 2 : Math.PI / 2, [cell.walls[side]]);
      const fx = wallX - sgn * 0.03;
      const glow = b.mat.accent;
      const fx0 = Math.min(fx, fx - sgn * 0.05), fx1 = Math.max(fx, fx - sgn * 0.05);
      b.strip(fx0, cy - H / 2 - 0.1, zc - W / 2 - 0.1, fx1, cy - H / 2, zc + W / 2 + 0.1, glow);
      b.strip(fx0, cy + H / 2, zc - W / 2 - 0.1, fx1, cy + H / 2 + 0.1, zc + W / 2 + 0.1, glow);
      b.strip(fx0, cy - H / 2, zc - W / 2 - 0.1, fx1, cy + H / 2, zc - W / 2, glow);
      b.strip(fx0, cy - H / 2, zc + W / 2, fx1, cy + H / 2, zc + W / 2 + 0.1, glow);
      infoSign(b, [{ text: 'OBSERVATION WINDOW', size: 44 }], 1.8, 0.45, fx - sgn * 0.01, Y + 2.15, zc, side === 'e' ? -Math.PI / 2 : Math.PI / 2, b.theme.accent);

      // The hidden room the window looks into.
      const HX = info.remoteX;
      const hm = new THREE.MeshStandardMaterial({ color: new THREE.Color(b.theme.accent).multiplyScalar(0.25), roughness: 0.9 });
      b.box(HX - 3.4, -0.4, -3.4, HX + 3.4, 0, 3.4, hm);
      b.box(HX - 3.4, 4, -3.4, HX + 3.4, 4.4, 3.4, hm);
      const hs = b.box(HX - 3.4, 0, 3, HX + 3.4, 4, 3.4, hm).userData.collider;
      b.box(HX - 3.4, 0, -3.4, HX + 3.4, 4, -3, hm);
      b.box(HX - 3.4, 0, -3, HX - 3, 4, 3, hm);
      b.box(HX + 3, 0, -3, HX + 3.4, 4, 3, hm);
      const lamp = new THREE.PointLight('#ffffff', 30, 0, 2);
      lamp.position.set(HX, 3.5, 0);
      b.scene.add(lamp);
      const hidden = b.portal({ width: W, height: H, name: `hidden-${info.slot}` }, V(HX, 2.0, 2.93), Math.PI, [hs]);
      win.link = hidden;
      hidden.link = win;
      b.sign(signTexture([{ text: 'CODE', size: 70, color: '#9aa4ae' }, { text: code.split('').join(' '), size: 150, color: b.theme.accent }],
        { w: 768, h: 384, bg: '#0b0d10' }), 4.4, 2.2, HX, 2.0, -2.98, 0, { glow: 1.4 });
      const { kp, pos } = exitKeypad(b, cell, code);
      return {
        label: 'Read the code',
        detail: 'The keypad wants three digits. That window does not show what is behind the wall.',
        hint: 'Look through the observation window high on the wall. The room it shows is not the one behind it.',
        solved: () => kp.solved,
        reserve: { [side]: [[zc - 2, zc + 2]] },
        debug: { keypad: pos, code },
      };
    },
  },

  two_plates: {
    dims: (rng, d = 0) => ({ w: range(rng, 14, 18), d: range(rng, 16, 22), h: range(rng, 5, 7) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const min = r1(range(rng, 1.0, 1.1) + info.diff * 0.7);
      const cubes = [-1, 1].map((s) => pedestalCube(b, cell, s * range(rng, 2, 3.5), cell.zS - 3, range(rng, 0.3, 0.4)));
      const plates = [-1, 1].map((s) => {
        const x = s * range(rng, 2.6, 4.4), z = cell.zN + 5.5;
        const p = b.plate({ cx: x, cz: z, y: Y, minSize: min, latch: false });
        return { p, info: { x, z, y: Y, half: 1.2, min } };
      });
      infoSign(b, [{ text: 'TWIN PLATES', size: 56 }, { text: `both at once · min ${min} m`, size: 40, color: '#ffd27a' }],
        2.0, 1.0, cell.x0 + 0.02, Y + 2.4, cell.zN + 6, Math.PI / 2, b.theme.accent);
      let done = false;
      return {
        label: 'Hold down both plates',
        detail: `Both plates need something at least ${min} m across, at the same time.`,
        hint: 'Grow one cube onto each plate. A cube taken off a plate lifts it again.',
        solved: () => {
          if (plates.every(({ p }) => p.active)) done = true;
          return done;
        },
        reserve: { w: [[cell.zN + 5, cell.zN + 7]] },
        debug: { cubes, plates: plates.map((p) => p.info) },
      };
    },
  },

  cube_rescue: {
    gun: true,
    dims: (rng, d = 0) => ({ w: range(rng, 12, 16), d: range(rng, 17, 21), h: range(rng, 6, 7) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const side = rng() < 0.5 ? 'w' : 'e';
      const sgn = side === 'e' ? 1 : -1;
      const wallX = side === 'e' ? cell.x1 : cell.x0;
      const zc = cell.zS - range(rng, 4, 5.5);
      const inner = wallX - sgn * 3.4;
      const xa = Math.min(wallX, inner), xb = Math.max(wallX, inner);
      const glass = { gun: false, tile: 0 };
      b.box(Math.min(inner, inner + sgn * 0.1), Y, zc - 1.8, Math.max(inner, inner + sgn * 0.1), Y + 3, zc + 1.8, b.mat.glass, glass);
      b.box(xa, Y, zc - 1.9, xb, Y + 3, zc - 1.8, b.mat.glass, glass);
      b.box(xa, Y, zc + 1.8, xb, Y + 3, zc + 1.9, b.mat.glass, glass);
      b.box(xa, Y + 3, zc - 1.9, xb, Y + 3.1, zc + 1.9, b.mat.glass, glass);
      const inside = sidePanel(b, cell, side, zc + 0.55);
      const cube = pedestalCube(b, cell, wallX - sgn * 1.7, zc - 1.05, range(rng, 0.35, 0.45), 0.8);
      const reserve = { [side]: [[zc - 2.3, zc + 2.3]] };
      const outside = sidePanels(b, cell, rng, cell.zN + 6.5, cell.zS - 1.6, rng() < 0.4 ? 2 : 1, reserve, { [side]: [zc] });
      decoys(b, cell, rng, cell.zN + 6.5, cell.zS - 1.6, 1, reserve, info);
      const min = r1(range(rng, 1.0, 1.1) + info.diff * 0.7);
      const px = range(rng, -2, 2), pz = cell.zN + 5.5;
      const plate = b.plate({ cx: px, cz: pz, y: Y, minSize: min });
      infoSign(b, [{ text: 'SPECIMEN', size: 56 }, { text: 'sealed in glass', size: 40, color: '#9aa4ae' }],
        1.6, 0.8, (inner + wallX) / 2, Y + 3.6, zc + 1.95, 0, b.theme.accent);
      return {
        label: 'Rescue the cube',
        detail: `The cube is sealed in glass, and the plate needs something ${min} m across.`,
        hint: 'Portal into the glass case, pick up the cube and walk back out through the portal holding it. Then grow it onto the plate.',
        solved: () => plate.active,
        reserve,
        debug: { cube, inside, outside, plates: [{ x: px, z: pz, y: Y, half: 1.2, min }], encl: { side, zc, inner, wallX } },
      };
    },
  },

  dark_room: {
    dims: (rng, d = 0) => ({ w: range(rng, 10, 14), d: range(rng, 12, 16), h: range(rng, 5, 6), dark: true }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const code = randomCode(rng, codeLength(info.diff));
      const side = rng() < 0.5 ? 'w' : 'e';
      const sgn = side === 'e' ? 1 : -1;
      const sx = (side === 'e' ? cell.x1 : cell.x0) - sgn * 0.9;
      const sz = range(rng, cell.zN + 3, cell.zS - 3);
      const guide = b.mat.accent;
      // Glowing floor guide from the entrance to the switch (gone on hard levels).
      if (info.diff < 0.6) b.strip(-0.04, Y + 0.004, Math.min(sz, cell.zS - 0.6), 0.04, Y + 0.012, cell.zS - 0.6, guide);
      if (info.diff < 0.6) b.strip(Math.min(0, sx), Y + 0.004, sz - 0.04, Math.max(0, sx), Y + 0.012, sz + 0.04, guide);
      const signMat = new THREE.MeshBasicMaterial({
        map: signTexture([{ text: 'EXIT CODE', size: 64, color: '#9aa4ae' }, { text: code.split('').join(' '), size: 150 }], { w: 768, h: 384, bg: '#0b0d10' }),
        toneMapped: false,
      });
      signMat.color.setScalar(0); // fully dark until the lights come on
      const other = side === 'e' ? 'w' : 'e';
      const ox = other === 'e' ? cell.x1 - 0.02 : cell.x0 + 0.02;
      const signZ = range(rng, cell.zN + 3, cell.zS - 3);
      const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), signMat);
      signMesh.position.set(ox, Y + 2.3, signZ);
      signMesh.rotation.y = other === 'e' ? -Math.PI / 2 : Math.PI / 2;
      b.scene.add(signMesh);
      let lit = false;
      b.button({
        x: sx, y: Y, z: sz, color: b.theme.accent, label: 'Flip the light switch',
        onPress: () => {
          if (lit) return;
          lit = true;
          cell.lightsOn();
          b.ctx.sfx.play('unlock');
          let t = 0;
          b.updaters.push((dt) => {
            if (t >= 1) return;
            t = Math.min(1, t + dt * 1.5);
            signMat.color.setScalar(1.3 * t);
          });
        },
      });
      const { kp, pos } = exitKeypad(b, cell, code);
      return {
        label: 'Get the lights on',
        detail: 'It is pitch black. Follow the glowing line.',
        hint: 'Follow the glowing line on the floor to the switch and press E. The code is on the wall once you can see it.',
        solved: () => kp.solved,
        reserve: { [side]: [[sz - 1.2, sz + 1.2]], [other]: [[signZ - 1.8, signZ + 1.8]] },
        debug: { button: { x: sx, y: Y + 1.0, z: sz }, keypad: pos, code },
      };
    },
  },

  color_count: {
    dims: (rng, d = 0) => ({ w: range(rng, 10, 14), d: range(rng, 12, 16), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const colors = shuffle(rng, COLORS).slice(0, codeLength(info.diff));
      const counts = colors.map(() => irange(rng, 1, 5 + Math.round(info.diff * 4)));
      const code = counts.join('');
      const placed = [];
      const bobbing = [];
      colors.forEach((c, i) => {
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(c.hex).multiplyScalar(1.6) });
        for (let n = 0; n < counts[i]; n++) {
          let p = null;
          for (let attempt = 0; attempt < 60 && !p; attempt++) {
            const x = range(rng, cell.x0 + 1, cell.x1 - 1);
            const z = range(rng, cell.zN + 2.5, cell.zS - 1.5);
            const floating = rng() < 0.5;
            const y = floating ? Y + range(rng, 1.8, cell.h - 0.8) : Y + 0.95;
            if (Math.abs(x) < 1.4 && !floating) continue;
            if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < 0.9 && Math.abs(q.y - y) < 0.9)) continue;
            p = { x, y, z, floating };
          }
          if (!p) continue;
          placed.push(p);
          if (!p.floating) b.box(p.x - 0.12, Y, p.z - 0.12, p.x + 0.12, Y + 0.72, p.z + 0.12, b.mat.darkMetal, { collide: false, solid: false, tile: 0 });
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), mat);
          orb.position.set(p.x, p.y, p.z);
          b.scene.add(orb);
          if (p.floating) bobbing.push({ orb, y: p.y, ph: rng() * 6 });
        }
      });
      if (bobbing.length) {
        let t = 0;
        b.updaters.push((dt) => {
          t += dt;
          for (const o of bobbing) o.orb.position.y = o.y + Math.sin(t * 1.3 + o.ph) * 0.08;
        });
      }
      b.sign(circlesTexture('CODE =', colors.map((c) => c.hex), false, 'count each colour'), 2.2, 1.1, -2.9, Y + 2.0, cell.zS - 0.02, Math.PI, { glow: 1.1 });
      const { kp, pos } = exitKeypad(b, cell, code);
      return {
        label: 'Count the lights',
        detail: 'The sign by the entrance spells the code in colours.',
        hint: 'Count the glowing orbs of each colour, in the order shown on the sign by the entrance. Each count is one digit.',
        solved: () => kp.solved,
        reserve: {},
        debug: { keypad: pos, code },
      };
    },
  },

  button_sequence: {
    dims: (rng, d = 0) => ({ w: range(rng, 10, 14), d: range(rng, 12, 16), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const n = Math.min(6, 3 + Math.round(info.diff * 3) + irange(rng, 0, 1));
      const colors = shuffle(rng, COLORS).slice(0, n);
      const order = shuffle(rng, colors.map((_, i) => i));
      const zMid = (cell.zS + cell.zN) / 2;
      const span = cell.w - 4;
      let step = 0, done = false;
      const lights = [];
      const buttons = colors.map((c, i) => {
        const x = -span / 2 + (span * (i + 0.5)) / n;
        const z = zMid + Math.sin((i / Math.max(1, n - 1)) * Math.PI) * -1.5 + range(rng, -0.4, 0.4);
        const btn = b.button({
          x, y: Y, z, color: c.hex, label: 'Press',
          onPress: () => {
            if (done) return;
            if (order[step] === i) {
              lights[step].color.set('#3dff7a').multiplyScalar(1.8);
              step++;
              b.ctx.sfx.play('beep');
              if (step === n) {
                done = true;
                b.ctx.sfx.play('unlock');
              }
            } else {
              step = 0;
              for (const l of lights) l.color.set('#30343a');
              b.ctx.sfx.play('error');
              if (!ctx.say?.('wrong_order', { cooldown: 5 })) ctx.toast('Wrong order. The sequence resets.', 'warn');
            }
          },
        });
        return { x, y: Y + 1.0, z, btn };
      });
      for (let i = 0; i < n; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: '#30343a' });
        lights.push(mat);
        b.box(-2.6 + i * 0.35, Y + 2.3, cell.zN + 0.01, -2.4 + i * 0.35, Y + 2.5, cell.zN + 0.05, mat, { collide: false, solid: false, tile: 0, castShadow: false });
      }
      b.sign(circlesTexture('PRESS IN THIS ORDER', order.map((i) => colors[i].hex), true), 2.4, 1.2, -2.9, Y + 2.0, cell.zS - 0.02, Math.PI, { glow: 1.1 });
      return {
        label: 'Press the sequence',
        detail: 'The sign by the entrance shows the order.',
        hint: 'Press the coloured buttons in the order shown on the sign by the entrance. A mistake resets it.',
        solved: () => done,
        reserve: {},
        debug: { buttons: order.map((i) => ({ x: buttons[i].x, y: buttons[i].y, z: buttons[i].z })) },
      };
    },
  },
};

export { sidePanel, sidePanels, northPanel, exitKeypad, pedestalCube, ledge, infoSign, circlesTexture, COLORS, r1, V };
