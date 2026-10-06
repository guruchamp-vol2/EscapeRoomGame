// The 10 mechanics introduced in later worlds, one per world. Same interface as
// modules.js. Each reads info.diff (0..1) to scale its difficulty.
import * as THREE from 'three';
import { signTexture, dynamicTexture } from '../../textures.js';
import { range, irange, pick, shuffle, randomCode } from '../../random.js';
import { rayBox } from '../../physics.js';
import { T } from './cell.js';
import {
  exitKeypad, pedestalCube, ledge, infoSign, COLORS, r1, V, codeLength,
} from './modules.js';

const GRAVITY = 22;
const KEY_COLORS = COLORS.filter((c) => c.name !== 'white');
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function onLedge(player, cell, front, top) {
  return player.pos.y > top - 0.15 && player.pos.z < front && cell.contains(player.pos);
}

// Optional "power" for a device: a pressure plate needing a grown cube.
function powerPlate(b, cell, rng, D, zPlate, label) {
  const Y = cell.y0;
  const cube = pedestalCube(b, cell, range(rng, -2, 2), cell.zS - 2.8, range(rng, 0.3, 0.4));
  const px = range(rng, -cell.w / 2 + 2.5, cell.w / 2 - 2.5);
  const min = r1(1.0 + D * 0.6);
  const plate = b.plate({ cx: px, cz: zPlate, y: Y, minSize: min });
  b.floorDecal(signTexture([{ text: label, size: 46 }, { text: `MIN ${min} m`, size: 40, color: '#ffd27a' }], { bg: null }),
    2.4, 1.2, px, zPlate + 2.0, { y: Y + 0.012 });
  return { cube, plate, info: { x: px, z: zPlate, y: Y, half: 1.2, min } };
}

// Shaft walls under a floor gap so pits look bottomless.
function pitWalls(b, cell, pitS, pitN) {
  const Y = cell.y0, m = cell.mat.wall;
  b.box(cell.x0 - T, Y - 30, pitN, cell.x0, Y - 0.4, pitS, m, { castShadow: false });
  b.box(cell.x1, Y - 30, pitN, cell.x1 + T, Y - 0.4, pitS, m, { castShadow: false });
  b.box(cell.x0, Y - 30, pitS, cell.x1, Y - 0.4, pitS + T, m, { castShadow: false });
  b.box(cell.x0, Y - 30, pitN - T, cell.x1, Y - 0.4, pitN, m, { castShadow: false });
  const hazard = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcc22').multiplyScalar(1.5) });
  b.strip(cell.x0, Y - 0.02, pitS - 0.02, cell.x1, Y + 0.01, pitS + 0.15, hazard);
  b.strip(cell.x0, Y - 0.02, pitN - 0.15, cell.x1, Y + 0.01, pitN + 0.02, hazard);
}

function progressLights(b, cell, n) {
  const lights = [];
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: '#30343a' });
    lights.push(mat);
    b.box(-2.6 + i * 0.35, cell.y0 + 2.3, cell.zN + 0.01, -2.4 + i * 0.35, cell.y0 + 2.5, cell.zN + 0.05, mat,
      { collide: false, solid: false, tile: 0, castShadow: false });
  }
  return lights;
}

export const MODULE_IMPL_2 = {
  // ---------------------------------------------------------------- World 3
  bounce_pad: {
    dims: (rng, d = 0) => {
      const L = r1(3.4 + d * 2.6 + range(rng, 0, 0.4));
      return { w: range(rng, 10, 14), d: range(rng, 14, 17) + (d > 0.35 ? 9 : 0), h: L + 4.2, exitY: L, L };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0, L = dims.L, D = info.diff;
      const front = ledge(b, cell, 5, L);
      const px = range(rng, -cell.w / 2 + 2, cell.w / 2 - 2), pz = front + 1.8;
      const power = Math.sqrt(2 * GRAVITY * (L + 1.6));
      const powered = D > 0.35 ? powerPlate(b, cell, rng, D, front + 7, 'LAUNCH POWER') : null;
      b.bouncePad({ x: px, y: Y, z: pz, power, forward: [0, -7], enabled: () => !powered || powered.plate.active });
      b.sign(signTexture([{ text: 'LAUNCH PAD', size: 52 }], { w: 512, h: 96, bg: '#14171c', fg: '#9dffcf' }), 1.6, 0.3, px, Y + L - 0.5, front + 0.02, 0);
      let up = false;
      return {
        label: 'Launch to the ledge',
        detail: powered ? 'The launch pad is unpowered. The plate nearby might help.' : `The exit is ${L} m up. That pad looks springy.`,
        hint: powered
          ? 'Power the launch pad by growing the cube onto the plate, then walk onto the pad.'
          : 'Walk onto the glowing launch pad. It throws you towards the ledge.',
        solved: () => up,
        update(dt, player) { if (onLedge(player, cell, front, Y + L)) up = true; },
        reserve: {},
        debug: { pad: { x: px, z: pz }, cube: powered?.cube, plates: powered ? [powered.info] : [], ledge: { front, top: Y + L } },
      };
    },
  },

  // ---------------------------------------------------------------- World 5
  keycard_doors: {
    dims: (rng) => ({ w: range(rng, 13, 16), d: range(rng, 16, 20), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const k = D > 0.5 ? 3 : 2;
      const colors = shuffle(rng, KEY_COLORS).slice(0, k);
      const have = new Set();
      const steps = [];
      const reserve = { w: [], e: [] };
      let unlocked = false;

      const card = (x, y, z, color) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.22),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(color.hex).multiplyScalar(1.4) }));
        mesh.position.set(x, y, z);
        // A generous invisible hitbox: the card itself is thin and bobbing.
        const hit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        hit.position.set(x, y, z);
        hit.userData.interact = 'button';
        hit.userData.label = `Take the ${color.name} keycard`;
        hit.userData.press = () => {
          if (!mesh.visible) return;
          mesh.visible = hit.visible = false;
          have.add(color.name);
          b.ctx.sfx.play('item');
          ctx.toast(`Got the ${color.name} keycard.`, 'success');
        };
        b.scene.add(mesh, hit);
        b.solids.push(hit);
        let t = rng() * 6;
        b.updaters.push((dt) => { t += dt; mesh.rotation.y += dt; mesh.position.y = y + Math.sin(t * 2) * 0.04; });
        steps.push({ type: 'take', x, y, z });
      };
      const reader = (x, y, z, rotY, color, onOpen) => {
        const sw = b.wallSwitch({
          x, y, z, rotY, color: color.hex, label: `Swipe the ${color.name} keycard`,
          onPress: () => {
            if (!have.has(color.name)) {
              b.ctx.sfx.play('denied');
              ctx.toast(`Needs the ${color.name} keycard.`, 'warn');
              return;
            }
            b.ctx.sfx.play('unlock');
            onOpen();
          },
        });
        steps.push({ type: 'swipe', x, y, z, rotY });
        return sw;
      };

      // First card lies in the open.
      card(range(rng, -2.5, 2.5), Y + 1.15, cell.zS - range(rng, 3, 4), colors[0]);
      b.pedestal(steps[0].x, steps[0].z, 0.5, Y + 1.0, Y);

      // Each further card sits in a locked booth opened by the previous colour.
      const sides = shuffle(rng, ['w', 'e']);
      for (let i = 1; i < k; i++) {
        const side = sides[(i - 1) % 2];
        const sgn = side === 'e' ? 1 : -1;
        const wallX = side === 'e' ? cell.x1 : cell.x0;
        const inner = wallX - sgn * 2.2;
        const zc = i === 1 ? cell.zS - range(rng, 6, 7.5) : cell.zN + range(rng, 4.5, 6);
        const xa = Math.min(wallX, inner), xb = Math.max(wallX, inner);
        const m = cell.mat.wall;
        const fx0 = Math.min(inner, inner + sgn * 0.12), fx1 = Math.max(inner, inner + sgn * 0.12);
        b.box(xa, Y, zc - 1.25, xb, Y + 2.8, zc - 1.15, m);
        b.box(xa, Y, zc + 1.15, xb, Y + 2.8, zc + 1.25, m);
        b.box(xa, Y + 2.8, zc - 1.25, xb, Y + 2.95, zc + 1.25, m);
        b.box(fx0, Y, zc - 1.15, fx1, Y + 2.8, zc - 0.6, m);
        b.box(fx0, Y, zc + 0.6, fx1, Y + 2.8, zc + 1.15, m);
        b.box(fx0, Y + 2.4, zc - 0.6, fx1, Y + 2.8, zc + 0.6, m);
        const lockColor = colors[i - 1];
        const doorMat = new THREE.MeshStandardMaterial({ color: lockColor.hex, roughness: 0.4, metalness: 0.5 });
        const door = b.door(fx0, Y, zc - 0.6, fx1, Y + 2.4, zc + 0.6, [0, 2.45, 0], doorMat);
        reader(inner - sgn * 0.13, Y + 1.3, zc + 0.88, side === 'e' ? -Math.PI / 2 : Math.PI / 2, lockColor, () => door.setOpen(true));
        const cx = wallX - sgn * 1.1;
        b.pedestal(cx, zc, 0.5, Y + 1.0, Y);
        card(cx, Y + 1.15, zc, colors[i]);
        reserve[side].push([zc - 1.6, zc + 1.6]);
      }
      // The exit reader takes the last card.
      const last = colors[k - 1];
      reader(1.6, Y + 1.35, cell.zN + 0.0, 0, last, () => { unlocked = true; });
      return {
        label: `Find the ${last.name} keycard`,
        detail: `The exit only opens for the ${last.name} keycard.`,
        hint: `Each locked booth opens with the keycard of its colour. Start with the ${colors[0].name} one lying out in the open.`,
        solved: () => unlocked,
        inventory: () => colors.filter((c) => have.has(c.name)).map((c) => `keycard:${c.hex}:${cap(c.name)} keycard`),
        reserve,
        debug: { steps },
      };
    },
  },

  // ---------------------------------------------------------------- World 7
  laser_fence: {
    dims: (rng, d = 0) => ({ w: range(rng, 10, 14), d: range(rng, 16, 20) + d * 3, h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const zF = cell.zS - cell.d * range(rng, 0.52, 0.6);
      const beamH = 0.8 + D * 0.7;
      const side = rng() < 0.5 ? -1 : 1;
      const bx = side * (cell.w / 2 - 1.5);
      const red = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2b2b').multiplyScalar(2.2) });
      // The fence: horizontal beams across the room, posts at the walls.
      const fence = new THREE.Group();
      b.scene.add(fence);
      for (let y = Y + 0.25; y < Y + cell.h - 0.1; y += 0.42) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(cell.w, 0.035, 0.035), red);
        beam.position.set(0, y, zF);
        fence.add(beam);
      }
      for (const x of [cell.x0 + 0.1, cell.x1 - 0.1]) b.box(x - 0.1, Y, zF - 0.1, x + 0.1, Y + cell.h, zF + 0.1, b.mat.darkMetal, { tile: 0 });
      // Projector on the south wall feeds the fence through a low beam.
      b.box(bx - 0.25, Y, cell.zS - 0.5, bx + 0.25, Y + beamH + 0.3, cell.zS, b.mat.darkMetal, { tile: 0 });
      b.box(bx - 0.2, Y, zF + 0.1, bx + 0.2, Y + beamH + 0.25, zF + 0.5, b.mat.darkMetal, { tile: 0 });
      const z0 = cell.zS - 0.5, z1 = zF + 0.5, len = z0 - z1;
      const feed = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1), red);
      b.scene.add(feed);
      b.sign(signTexture([{ text: 'DANGER · LASER FENCE', size: 40, color: '#ff8b8b' }, { text: 'cut the power beam', size: 34, color: '#9aa4ae' }],
        { w: 640, h: 180, bg: '#140808' }), 2.2, 0.62, -side * 2.2, Y + 2.6, zF + 0.12, 0);
      const cube = pedestalCube(b, cell, -side * range(rng, 1.5, 3), cell.zS - 3, range(rng, 0.3, 0.4));
      const origin = V(bx, Y + beamH, z0), dir = V(0, 0, -1);
      let blocked = false, passed = false;
      return {
        label: 'Get past the laser fence',
        detail: 'Touch the fence and you are back at the door. A beam along the floor powers it.',
        hint: `Block the low red beam that feeds the fence. It is ${r1(beamH)} m off the floor, so grow the cube taller than that right in its path.`,
        solved: () => passed,
        update(dt, player) {
          let hit = len;
          for (const c of b.cubes) {
            if (c.held || c.vy !== 0) continue;
            const t = rayBox(origin, dir, c.collider.min, c.collider.max);
            if (t < hit) hit = t;
          }
          blocked = hit < len - 0.01;
          fence.visible = !blocked;
          feed.scale.z = Math.max(0.01, hit);
          feed.position.set(bx, Y + beamH, z0 - hit / 2);
          if (!blocked && cell.contains(player.pos) && Math.abs(player.pos.z - zF) < 0.4) {
            b.ctx.sfx.play('fizzle');
            ctx.say?.('fell', { cooldown: 4 });
            ctx.respawn?.();
          }
          if (player.pos.z < zF - 0.6 && cell.contains(player.pos)) passed = true;
        },
        reserve: {},
        debug: { cube, beam: { x: bx, y: Y + beamH, z0, z1 }, fenceZ: zF, need: beamH + 0.25 },
      };
    },
  },

  // ---------------------------------------------------------------- World 9
  memory_sequence: {
    dims: (rng) => ({ w: range(rng, 11, 14), d: range(rng, 12, 16), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const n = Math.min(6, 3 + Math.round(D * 3));
      const colors = shuffle(rng, COLORS).slice(0, n);
      const order = Array.from({ length: n + (D > 0.6 ? 1 : 0) }, () => irange(rng, 0, n - 1));
      const zMid = (cell.zS + cell.zN) / 2 - 0.5;
      const span = cell.w - 4;
      const lights = progressLights(b, cell, order.length);
      let step = 0, done = false, playing = 0, playT = 0;
      const caps = [];
      const buttons = colors.map((c, i) => {
        const x = -span / 2 + (span * (i + 0.5)) / n;
        const z = zMid + Math.sin((i / Math.max(1, n - 1)) * Math.PI) * -1.5;
        const btn = b.button({
          x, y: Y, z, color: c.hex, label: 'Press',
          onPress: () => {
            if (done || playing) return;
            if (order[step] === i) {
              lights[step].color.set('#3dff7a').multiplyScalar(1.8);
              step++;
              b.ctx.sfx.play('beep');
              if (step === order.length) { done = true; b.ctx.sfx.play('unlock'); }
            } else {
              step = 0;
              for (const l of lights) l.color.set('#30343a');
              b.ctx.sfx.play('error');
              ctx.say?.('wrong_order', { cooldown: 5 }) || ctx.toast('Wrong. Watch it again.', 'warn');
            }
          },
        });
        caps.push({ mat: btn.cap.material, base: btn.cap.material.color.clone() });
        return { x, y: Y + 1.0, z };
      });
      const start = { x: -1.6, z: cell.zS - 2.2 };
      b.button({
        x: start.x, y: Y, z: start.z, color: '#ffffff', label: 'Show the sequence',
        onPress: () => {
          if (done || playing) return;
          step = 0;
          for (const l of lights) l.color.set('#30343a');
          playing = order.length;
          playT = 0;
        },
      });
      infoSign(b, [{ text: 'MEMORY', size: 60 }, { text: 'watch · then repeat', size: 40, color: '#9aa4ae' }],
        1.8, 0.9, 2.6, Y + 2.0, cell.zS - 0.02, Math.PI, b.theme.accent);
      return {
        label: 'Repeat the sequence',
        detail: 'Press the white button to watch the lights. Then press them back in the same order.',
        hint: 'Press the white button near the entrance and watch which buttons flash, in order. Then press those buttons in the same order.',
        solved: () => done,
        update(dt) {
          if (!playing) return;
          playT += dt;
          const idx = order.length - playing;
          const phase = playT % 0.75;
          caps.forEach((c, i) => c.mat.color.copy(c.base).multiplyScalar(i === order[idx] && phase < 0.5 ? 3 : 1));
          if (playT >= 0.75) {
            playT = 0;
            playing--;
            if (playing === 0) caps.forEach((c) => c.mat.color.copy(c.base));
            else b.ctx.sfx.play('beep');
          }
        },
        reserve: {},
        debug: { start: { x: start.x, y: Y + 1.0, z: start.z }, buttons: order.map((i) => buttons[i]), playTime: order.length * 0.75 },
      };
    },
  },

  // ---------------------------------------------------------------- World 11
  fan_lift: {
    dims: (rng, d = 0) => {
      const L = r1(4 + d * 3 + range(rng, 0, 0.5));
      return { w: range(rng, 10, 14), d: range(rng, 14, 17) + (d > 0.3 ? 9 : 0), h: L + 4.6, exitY: L, L };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0, L = dims.L, D = info.diff;
      const front = ledge(b, cell, 5, L);
      const fx = range(rng, -cell.w / 2 + 2.2, cell.w / 2 - 2.2), fz = front + 1.15;
      const powered = D > 0.3 ? powerPlate(b, cell, rng, D, front + 7, 'FAN POWER') : null;
      b.windColumn({ x: fx, y: Y, z: fz, radius: 1.0, top: Y + L + 1.9, enabled: () => !powered || powered.plate.active });
      let up = false;
      return {
        label: 'Ride the updraft',
        detail: powered ? 'The fan is off. Something has to power it.' : `The exit is ${L} m up. Feel that breeze?`,
        hint: powered
          ? 'Grow the cube onto the FAN POWER plate. Then stand in the wind column, let it lift you, and walk onto the ledge.'
          : 'Stand in the column of wind and let it carry you up, then walk forward onto the ledge.',
        solved: () => up,
        update(dt, player) { if (onLedge(player, cell, front, Y + L)) up = true; },
        reserve: {},
        debug: { fan: { x: fx, z: fz }, cube: powered?.cube, plates: powered ? [powered.info] : [], ledge: { front, top: Y + L } },
      };
    },
  },

  // ---------------------------------------------------------------- World 13
  stack_ledge: {
    dims: (rng, d = 0) => {
      const L = r1(Math.min(3.4, 2.75 + d * 0.6 + range(rng, 0, 0.05)));
      return { w: range(rng, 12, 15), d: range(rng, 16, 20), h: L + 4.2, exitY: L, L };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0, L = dims.L;
      const front = ledge(b, cell, 5, L);
      b.sign(signTexture([{ text: `LEDGE ${L} m`, size: 44 }, { text: 'one cube will not do', size: 30, color: '#9aa4ae' }],
        { w: 512, h: 160, bg: '#14171c', fg: '#ffcf9a' }), 2.0, 0.62, 0, Y + L - 0.7, front + 0.02, 0);
      const cubes = [-1, 1].map((s) => pedestalCube(b, cell, s * range(rng, 2, 3.5), cell.zS - 3, range(rng, 0.3, 0.4)));
      let up = false;
      return {
        label: 'Build a staircase',
        detail: `The ledge is ${L} m up: too high for one cube. You have two.`,
        hint: 'Make a staircase: grow one cube tall (about 2 m) right against the ledge, then a shorter one (about 1 m) in front of it. Climb the short one, then the tall one, then the ledge.',
        solved: () => up,
        update(dt, player) { if (onLedge(player, cell, front, Y + L)) up = true; },
        reserve: {},
        debug: { cubes, ledge: { front, top: Y + L } },
      };
    },
  },

  // ---------------------------------------------------------------- World 14
  math_code: {
    dims: (rng) => ({ w: range(rng, 12, 15), d: range(rng, 13, 17), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const vals = { A: irange(rng, 1, 9), B: irange(rng, 1, 9), C: irange(rng, 1, 9) };
      const pool = shuffle(rng, [
        { t: 'A + B', v: (o) => o.A + o.B }, { t: 'B × C', v: (o) => o.B * o.C }, { t: 'A × C', v: (o) => o.A * o.C },
        { t: 'A + B + C', v: (o) => o.A + o.B + o.C }, { t: '|A − C|', v: (o) => Math.abs(o.A - o.C) },
        { t: 'B + C', v: (o) => o.B + o.C }, { t: 'A × B', v: (o) => o.A * o.B }, { t: '|B − A|', v: (o) => Math.abs(o.B - o.A) },
      ]);
      const parts = pool.slice(0, codeLength(info.diff));
      const code = parts.map((p) => String(p.v(vals) % 10)).join('');
      // Three exhibits with their numbers, spread around the room.
      const spots = shuffle(rng, [
        [cell.x0 + 1.5, cell.zS - 3], [cell.x1 - 1.5, cell.zS - 3], [cell.x0 + 1.5, cell.zN + 3],
        [cell.x1 - 1.5, cell.zN + 3], [cell.x0 + 1.5, (cell.zS + cell.zN) / 2], [cell.x1 - 1.5, (cell.zS + cell.zN) / 2],
      ]);
      Object.entries(vals).forEach(([k, v], i) => {
        const [x, z] = spots[i];
        b.pedestal(x, z, 0.8, Y + 1.1, Y);
        b.sign(signTexture([{ text: `${k} = ${v}`, size: 110 }], { w: 384, h: 192, bg: '#0b0d10', fg: b.theme.accent, border: b.theme.accent }),
          1.0, 0.5, x, Y + 1.6, z, x < 0 ? Math.PI / 2 : -Math.PI / 2, { glow: 1.3 });
      });
      b.sign(signTexture([
        { text: 'EXIT CODE', size: 54 },
        ...parts.map((p, i) => ({ text: `${i + 1}: last digit of ${p.t}`, size: 36, color: '#cfd8df' })),
      ], { w: 640, h: 360, bg: '#0b0d10', border: b.theme.accent }), 2.2, 1.24, -2.9, Y + 2.0, cell.zS - 0.02, Math.PI, { glow: 1.15 });
      const { kp, pos } = exitKeypad(b, cell, code);
      return {
        label: 'Solve the riddle',
        detail: 'The sign by the entrance turns the exhibits into a code.',
        hint: 'Find the three exhibits labelled A, B and C. Work out each line on the sign by the entrance and keep only the last digit.',
        solved: () => kp.solved,
        reserve: { w: [[cell.zS - 4, cell.zS - 2], [cell.zN + 2, cell.zN + 4]], e: [[cell.zS - 4, cell.zS - 2], [cell.zN + 2, cell.zN + 4]] },
        debug: { keypad: pos, code },
      };
    },
  },

  // ---------------------------------------------------------------- World 15
  collapsing_floor: {
    dims: (rng, d = 0) => {
      const a = 3.5, g = Math.round(range(rng, 8, 10) + d * 6);
      return { w: range(rng, 10, 13), d: a + g * 1.25 + 4.5, h: range(rng, 6, 7), pit: { a, g: g * 1.25 } };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0, D = info.diff;
      const pitS = cell.zS - dims.pit.a, pitN = pitS - dims.pit.g;
      pitWalls(b, cell, pitS, pitN);
      const rows = Math.round(dims.pit.g / 1.25);
      const wide = D < 0.5;
      const delay = 0.75 - D * 0.45;
      const gaps = new Set();
      if (D > 0.35) {
        const count = D > 0.75 ? 2 : 1;
        while (gaps.size < count) {
          const r = irange(rng, 2, rows - 3);
          if (!gaps.has(r - 1) && !gaps.has(r + 1)) gaps.add(r);
        }
      }
      const tileMat = new THREE.MeshStandardMaterial({ color: b.theme.wallLine, roughness: 0.6, metalness: 0.3 });
      const crackMat = new THREE.MeshStandardMaterial({ color: '#ff7a3d', emissive: '#ff4d1a', emissiveIntensity: 0.6 });
      const tiles = [];
      for (let r = 0; r < rows; r++) {
        if (gaps.has(r)) continue;
        const z1 = pitS - r * 1.25, z0 = z1 - 1.2;
        for (const x of wide ? [-0.62, 0.62] : [0]) {
          const mesh = b.box(x - 0.6, Y - 0.3, z0, x + 0.6, Y, z1, tileMat, { tile: 0 });
          tiles.push({ mesh, c: mesh.userData.collider, home: mesh.position.clone(), t: -1, fallen: false, x, z0, z1 });
        }
      }
      let crossed = false;
      return {
        label: 'Cross the crumbling floor',
        detail: 'Every tile drops shortly after you step on it. Keep moving.',
        hint: D > 0.35 ? 'Sprint (Shift) across without stopping, and jump over the missing tiles.' : 'Sprint (Shift) across the tiles without stopping.',
        solved: () => crossed,
        update(dt, player) {
          const p = player.pos;
          for (const tile of tiles) {
            if (tile.fallen) {
              tile.mesh.position.y -= dt * 9;
              continue;
            }
            const on = Math.abs(p.y - Y) < 0.12 && p.z < tile.z1 + 0.3 && p.z > tile.z0 - 0.3 && Math.abs(p.x - tile.x) < 0.9;
            if (on && tile.t < 0) {
              tile.t = 0;
              tile.mesh.material = crackMat;
            }
            if (tile.t >= 0) {
              tile.t += dt;
              tile.mesh.position.x = tile.home.x + Math.sin(tile.t * 60) * 0.02;
              if (tile.t > delay) {
                tile.fallen = true;
                tile.c.enabled = false;
              }
            }
          }
          if (p.z < pitN - 0.3 && p.y > Y - 0.5 && cell.contains(p)) crossed = true;
        },
        reset() {
          for (const tile of tiles) {
            tile.fallen = false;
            tile.t = -1;
            tile.c.enabled = true;
            tile.mesh.material = tileMat;
            tile.mesh.position.copy(tile.home);
          }
        },
        reserve: {},
        debug: { pitS, pitN, gaps: [...gaps].map((r) => pitS - r * 1.25) },
      };
    },
  },

  // ---------------------------------------------------------------- World 16
  teleport_maze: {
    dims: (rng) => {
      // Gaps of 5 m+ everywhere: a sprint-jump only covers ~4.6 m, so no skipping pads.
      const d = 27;
      return { w: range(rng, 19, 21), d, h: range(rng, 6, 7), pit: { a: 3.2, g: d - 6.4 } };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0, D = info.diff;
      const pitS = cell.zS - dims.pit.a, pitN = pitS - dims.pit.g;
      pitWalls(b, cell, pitS, pitN);
      // Floating platforms in a 3 x 2 grid over the pit.
      const xs = [-7.5, 0, 7.5];
      const zs = [pitS - 6.2, pitS - 14.4];
      const palette = shuffle(rng, KEY_COLORS);
      const platforms = [];
      xs.forEach((x) => zs.forEach((z) => platforms.push({ x, z })));
      shuffle(rng, platforms).forEach((p, i) => { p.color = palette[i % palette.length].hex; });
      for (const p of platforms) {
        b.box(p.x - 1.2, Y - 0.6, p.z - 1.2, p.x + 1.2, Y, p.z + 1.2, cell.mat.floor, { tile: 2 });
        const edge = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(1.6) });
        b.strip(p.x - 1.22, Y - 0.62, p.z - 1.22, p.x + 1.22, Y - 0.56, p.z + 1.22, edge);
        p.arrive = V(p.x, Y, p.z + 0.75);
      }
      const start = { x: 0, z: cell.zS - 1.2, arrive: V(0, Y, cell.zS - 1.2), color: '#ffffff' };
      const exit = { x: 0, z: pitN - 1.2, arrive: V(0, Y, pitN - 1.0), color: '#3dff7a' };
      const hops = D > 0.5 ? 3 : 2;
      const pathPlats = shuffle(rng, platforms).slice(0, hops);
      const path = [start, ...pathPlats, exit];
      const dead = platforms.filter((p) => !pathPlats.includes(p));
      const route = [];
      const padsOn = (from, z, dests) => {
        const xsPads = from === start ? [-2.2, 0, 2.2] : [-0.8, 0, 0.8];
        shuffle(rng, xsPads).slice(0, dests.length).forEach((dx, i) => {
          const dest = dests[i];
          const pad = b.teleportPad({ x: from.x + dx, y: Y, z, color: dest.color, dest: dest.arrive, yaw: 0, radius: from === start ? 0.6 : 0.36 });
          if (dest === path[path.indexOf(from) + 1]) route.push({ x: pad.x, z: pad.z, from: { x: from.arrive.x, z: from.arrive.z }, to: dest.arrive });
        });
      };
      path.slice(0, -1).forEach((from, i) => {
        const next = path[i + 1];
        const decoys = shuffle(rng, [start, ...dead].filter((p) => p !== from && p !== next)).slice(0, D > 0.6 ? 2 : 1);
        padsOn(from, from === start ? cell.zS - 2.6 : from.z - 0.55, shuffle(rng, [next, ...decoys]));
      });
      for (const p of dead) padsOn(p, p.z - 0.55, [start]);
      // Legend: exit colour.
      infoSign(b, [{ text: 'TELEPORTERS', size: 52 }, { text: 'a pad sends you to the', size: 32, color: '#9aa4ae' }, { text: 'platform of its colour', size: 32, color: '#9aa4ae' }],
        2.0, 1.0, 2.8, Y + 2.1, cell.zS - 0.02, Math.PI, b.theme.accent);
      b.strip(-1.5, Y - 0.01, pitN - 2.6, 1.5, Y + 0.012, pitN - 2.5, new THREE.MeshBasicMaterial({ color: new THREE.Color('#3dff7a').multiplyScalar(1.6) }));
      let crossed = false;
      return {
        label: 'Find the way across',
        detail: 'Each pad sends you to the platform with the matching colour. The exit side is green.',
        hint: 'Work backwards from the green exit: which platform has a green pad? Then find the pad that gets you to that platform.',
        solved: () => crossed,
        update(dt, player) {
          if (player.pos.z < pitN - 0.2 && player.pos.y > Y - 0.5 && cell.contains(player.pos)) crossed = true;
        },
        reserve: {},
        debug: { route },
      };
    },
  },

  // ---------------------------------------------------------------- World 18
  sprint_door: {
    dims: (rng, d = 0) => ({ w: range(rng, 10, 13), d: range(rng, 22, 26) + d * 6, h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const bx = range(rng, -2, 2), bz = cell.zS - 2.5;
      const dist = bz - cell.zN;
      // Always fair: a clean sprint plus at least 1.5 s (the door also needs time to slide).
      const window = r1(dist / 6.6 + 2.4 - D * 0.9);
      let timer = 0, passed = false;
      const clock = dynamicTexture(256, 96);
      b.sign(clock.tex, 0.9, 0.34, -1.8, Y + 2.2, cell.zN + 0.02, 0, { glow: 1.4 });
      const draw = () => {
        const { g, w, h, tex } = clock;
        g.fillStyle = '#0b0d10';
        g.fillRect(0, 0, w, h);
        g.fillStyle = timer > 0 ? '#3dff7a' : '#ff4b4b';
        g.font = 'bold 64px ui-monospace, monospace';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(timer > 0 ? timer.toFixed(1) : 'LOCKED', w / 2, h / 2 + 4);
        tex.needsUpdate = true;
      };
      draw();
      b.button({
        x: bx, y: Y, z: bz, color: '#3dff7a', label: `Open the door (${window} s)`,
        onPress: () => { timer = window; b.ctx.sfx.play('door'); },
      });
      // Hurdles to hop on harder levels.
      if (D > 0.4) {
        for (const f of [0.4, 0.7]) {
          const z = bz - dist * f;
          b.box(cell.x0, Y, z - 0.2, cell.x1, Y + 0.32, z + 0.2, b.mat.darkMetal, { tile: 0 });
        }
      }
      infoSign(b, [{ text: 'SPRINT DOOR', size: 56 }, { text: `open for ${window} s`, size: 40, color: '#ffd27a' }],
        1.8, 0.9, 2.8, Y + 2.0, cell.zS - 0.02, Math.PI, b.theme.accent);
      let last = -1;
      return {
        label: 'Beat the door',
        detail: `The button opens the far door for ${window} seconds.`,
        hint: 'Press the button, then sprint (hold Shift) straight for the door without stopping.',
        solved: () => passed,
        doorOpen: () => timer > 0 || passed,
        update(dt, player) {
          if (timer > 0) {
            timer = Math.max(0, timer - dt);
            if (Math.floor(timer * 10) !== last) {
              last = Math.floor(timer * 10);
              draw();
            }
          }
          if (player.pos.z < cell.zN - 0.2 && player.pos.y > Y - 0.5 && Math.abs(player.pos.x) < 1.5) passed = true;
        },
        reserve: {},
        debug: { button: { x: bx, y: Y + 1.0, z: bz }, window },
      };
    },
  },
};
