// Twelve newer puzzle rooms (one of the mechanics introduced every 7 levels).
// Same interface as modules.js: dims(rng, diff) and build(cell, b, ctx, rng,
// info, dims) → { label, detail, hint, solved, update?, reserve, debug }.
// Each reads info.diff (0..1) and records what the auto-solver needs in debug.
import * as THREE from 'three';
import { signTexture } from '../../textures.js';
import { range, irange, pick, shuffle } from '../../random.js';
import { setCollider } from '../../physics.js';
import { exitKeypad, pedestalCube, infoSign, codeLength, r1, V } from './modules.js';
import { pitWalls } from './modules2.js';

const fx = { collide: false, solid: false, tile: 0, castShadow: false };
const glowMat = (hex, k = 1.7) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });

// A canvas-textured flat panel (for symbols, tiles, diagrams).
function panelTexture(draw, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const MODULE_IMPL_4 = {
  // ---------------------------------------------------------------- levers
  lever_pattern: {
    dims: (rng) => ({ w: range(rng, 10, 13), d: range(rng, 11, 14), h: range(rng, 4.5, 5.5) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const n = 4 + Math.round(D * 2);
      const target = Array.from({ length: n }, () => rng() < 0.5);
      const state = target.map((t) => (rng() < 0.5 ? t : !t));
      if (state.every((s, i) => s === target[i])) state[0] = !target[0];
      let done = false;
      const levers = [];
      for (let i = 0; i < n; i++) {
        const west = i % 2 === 0;
        const z = cell.zS - 2.5 - Math.floor(i / 2) * ((cell.d - 5) / Math.ceil(n / 2));
        const x = west ? cell.x0 + 0.06 : cell.x1 - 0.06;
        const sw = b.wallSwitch({ x, y: Y + 1.25, z, rotY: west ? Math.PI / 2 : -Math.PI / 2, color: '#c9a043', label: `Pull lever ${i + 1}` });
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), b.mat.metal);
        handle.position.set(0, 0, 0.12);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glowMat('#ff4b4b', 1.5));
        knob.position.y = 0.18;
        handle.add(knob);
        sw.group.add(handle);
        const draw = () => { handle.rotation.x = state[i] ? -0.6 : 0.6; knob.material.color.set(state[i] ? '#3dff7a' : '#ff4b4b').multiplyScalar(1.5); };
        draw();
        sw.group.children.forEach((m) => { if (m.userData.interact) m.userData.press = () => press(); });
        const press = () => {
          if (done) return;
          state[i] = !state[i];
          draw();
          b.ctx.sfx.play('beep');
          if (state.every((s, k) => s === target[k])) { done = true; b.ctx.sfx.play('unlock'); }
        };
        b.sign(signTexture([{ text: String(i + 1), size: 120 }], { w: 128, h: 128, bg: '#0b0d10', fg: '#ffcf6b' }), 0.3, 0.3,
          x + (west ? 0.02 : -0.02), Y + 1.85, z, west ? Math.PI / 2 : -Math.PI / 2, { glow: 1.2 });
        levers.push({ x, y: Y + 1.25, z, west, need: state[i] !== target[i] });
      }
      // The diagram, on the entrance wall facing in.
      b.sign(panelTexture((g, w, h) => {
        g.fillStyle = '#0b0d10'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#e8eef2'; g.font = 'bold 40px system-ui'; g.textAlign = 'center';
        g.fillText('SET THE LEVERS', w / 2, 52);
        target.forEach((up, i) => {
          const x = (w / (n + 1)) * (i + 1);
          g.fillStyle = '#ffcf6b'; g.font = 'bold 34px system-ui'; g.fillText(String(i + 1), x, 210);
          g.fillStyle = up ? '#3dff7a' : '#ff8b8b'; g.font = 'bold 64px system-ui'; g.fillText(up ? '▲' : '▼', x, 150);
        });
      }, 640, 240), 2.6, 0.98, 2.2, Y + 2.2, cell.zS - 0.03, Math.PI, { glow: 1.1 });
      return {
        label: 'Set the levers',
        detail: 'The diagram by the entrance shows which way each lever should point.',
        hint: 'Match every numbered lever to the diagram by the entrance: ▲ means up (green), ▼ means down (red).',
        solved: () => done,
        reserve: { w: levers.filter((l) => l.west).map((l) => [l.z - 0.6, l.z + 0.6]), e: levers.filter((l) => !l.west).map((l) => [l.z - 0.6, l.z + 0.6]) },
        debug: { levers },
      };
    },
  },

  // ---------------------------------------------------------------- colour mixing
  color_mix: {
    dims: (rng) => ({ w: range(rng, 10, 13), d: range(rng, 11, 14), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const zc = (cell.zS + cell.zN) / 2;
      const NAMES = ['', 'RED', 'GREEN', 'YELLOW', 'BLUE', 'MAGENTA', 'CYAN', 'WHITE'];
      const target = irange(rng, 1, 7);
      let bits = 0, done = false;
      // Higher difficulty: the buttons are shuffled, labelled only by colour.
      const channels = shuffle(rng, [{ bit: 1, hex: '#ff4040', name: 'red' }, { bit: 2, hex: '#3dff6a', name: 'green' }, { bit: 4, hex: '#4a7dff', name: 'blue' }]);
      const lampMat = new THREE.MeshBasicMaterial({ color: '#111' });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 28, 20), lampMat);
      lamp.position.set(0, Y + 3.0, zc);
      b.scene.add(lamp);
      const mixLight = new THREE.PointLight('#000', 0, 8, 2);
      mixLight.position.copy(lamp.position);
      b.scene.add(mixLight);
      const show = () => {
        const c = new THREE.Color((bits & 1) ? 1 : 0, (bits & 2) ? 1 : 0, (bits & 4) ? 1 : 0);
        lampMat.color.copy(c).multiplyScalar(bits ? 1.8 : 0.1);
        mixLight.color.copy(c);
        mixLight.intensity = bits ? 6 : 0;
      };
      show();
      const buttons = channels.map((ch, i) => {
        const x = (i - 1) * 2.2;
        b.button({ x, y: Y, z: zc + 1.6, color: ch.hex, label: `Toggle ${ch.name}`, onPress: () => {
          if (done) return;
          bits ^= ch.bit;
          show();
          b.ctx.sfx.play('beep');
          if (bits === target) { done = true; b.ctx.sfx.play('unlock'); }
        } });
        return { x, y: Y + 1.0, z: zc + 1.6, need: (target & ch.bit) !== 0 };
      });
      const tc = new THREE.Color((target & 1) ? 1 : 0, (target & 2) ? 1 : 0, (target & 4) ? 1 : 0);
      b.sign(panelTexture((g, w, h) => {
        g.fillStyle = '#0b0d10'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#e8eef2'; g.font = 'bold 40px system-ui'; g.textAlign = 'center';
        g.fillText('MIX THIS LIGHT', w / 2, 50);
        g.fillStyle = `#${tc.getHexString()}`; g.beginPath(); g.arc(w / 2, 140, 60, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#9aa4ae'; g.font = 'bold 30px system-ui'; g.fillText(D < 0.5 ? NAMES[target] : '', w / 2, 235);
      }, 400, 250), 1.6, 1.0, -2.6, Y + 2.2, cell.zS - 0.03, Math.PI, { glow: 1.1 });
      return {
        label: 'Mix the light',
        detail: 'Red, green and blue light add together. Match the colour on the sign.',
        hint: 'Light mixes: red + green = yellow, red + blue = magenta, green + blue = cyan, all three = white. Toggle the buttons until the lamp matches the sign.',
        solved: () => done,
        reserve: {},
        debug: { buttons },
      };
    },
  },

  // ---------------------------------------------------------------- lights out
  lights_out: {
    dims: (rng) => ({ w: range(rng, 11, 14), d: range(rng, 11, 14), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const n = D > 0.5 ? 4 : 3;
      const lit = Array(n * n).fill(true);
      const presses = shuffle(rng, [...Array(n * n).keys()]).slice(0, 2 + Math.round(D * 3));
      const toggle = (k) => {
        const r = Math.floor(k / n), c = k % n;
        for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n) lit[rr * n + cc] = !lit[rr * n + cc];
        }
      };
      for (const k of presses) toggle(k);
      let done = false;
      // A wall of square buttons on the west wall, facing into the room.
      const size = 0.5, gap = 0.62;
      const zc = (cell.zS + cell.zN) / 2, yTop = Y + 1.0 + (n - 1) * gap;
      const mats = [];
      const tiles = [];
      for (let k = 0; k < n * n; k++) {
        const r = Math.floor(k / n), c = k % n;
        const z = zc + (c - (n - 1) / 2) * gap, y = yTop - r * gap;
        const mat = new THREE.MeshBasicMaterial({ color: '#222' });
        mats.push(mat);
        const tile = b.box(cell.x0 + 0.02, y - size / 2, z - size / 2, cell.x0 + 0.1, y + size / 2, z + size / 2, mat, { tile: 0, castShadow: false });
        tile.userData.interact = 'button';
        tile.userData.label = 'Press the tile';
        tile.userData.press = () => {
          if (done) return;
          toggle(k);
          draw();
          b.ctx.sfx.play('beep');
          if (lit.every(Boolean)) { done = true; b.ctx.sfx.play('unlock'); }
        };
        tiles.push({ x: cell.x0 + 0.1, y, z });
      }
      const draw = () => mats.forEach((m, k) => m.color.set(lit[k] ? '#ffe9a0' : '#1a1d22').multiplyScalar(lit[k] ? 1.7 : 1));
      draw();
      b.sign(signTexture([{ text: 'LIGHT EVERY TILE', size: 44 }, { text: 'a tile flips itself and its neighbours', size: 26, color: '#9aa4ae' }], { w: 640, h: 160, bg: '#0b0d10' }),
        2.2, 0.55, cell.x0 + 0.03, yTop + 0.75, zc, Math.PI / 2, { glow: 1.1 });
      return {
        label: 'Light every tile',
        detail: 'Pressing a tile flips it and the tiles above, below and beside it.',
        hint: 'Each dark area was made by a few presses. Pressing the same tiles again undoes them. Try pressing the tile in the middle of a dark cross.',
        solved: () => done,
        reserve: { w: [[zc - n * gap / 2 - 0.4, zc + n * gap / 2 + 0.4]] },
        debug: { presses: presses.map((k) => tiles[k]) },
      };
    },
  },

  // ---------------------------------------------------------------- balance scale
  balance_scale: {
    dims: (rng) => ({ w: range(rng, 11, 14), d: range(rng, 15, 18), h: range(rng, 5.5, 6.5) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const zc = cell.zN + 4;
      const target = r1(1.0 + D * 0.8), tol = r1(0.3 - D * 0.12);
      // The counterweight on the left pan, a cube on the right.
      const left = { x: -2.2, z: zc }, right = { x: 2.2, z: zc };
      b.box(left.x - 0.9, Y, left.z - 0.9, left.x + 0.9, Y + 0.1, left.z + 0.9, b.mat.metal, { tile: 0 });
      b.box(left.x - target / 2, Y + 0.1, left.z - target / 2, left.x + target / 2, Y + 0.1 + target, left.z + target / 2, b.mat.darkMetal, { tile: 0 });
      b.box(right.x - 1.0, Y, right.z - 1.0, right.x + 1.0, Y + 0.06, right.z + 1.0, b.mat.metal, { tile: 0 });
      const ring = glowMat('#ff4b4b', 1.5);
      b.strip(right.x - 0.95, Y + 0.06, right.z - 0.95, right.x + 0.95, Y + 0.065, right.z + 0.95, ring);
      // The balance beam above, tilting with the difference.
      b.box(-0.1, Y, zc - 0.1, 0.1, Y + 3.2, zc + 0.1, b.mat.metal, { tile: 0 });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(5, 0.12, 0.12), b.mat.metal);
      beam.position.set(0, Y + 3.2, zc);
      b.scene.add(beam);
      const cube = pedestalCube(b, cell, range(rng, -2, 2), cell.zS - 2.8, range(rng, 0.3, 0.4));
      let done = false;
      b.infoTag = infoSign(b, [{ text: 'BALANCE THE SCALE', size: 44 }, { text: `the weight is ${target} m`, size: 34, color: '#ffd27a' }, { text: `match it within ${tol} m`, size: 28, color: '#9aa4ae' }],
        2.0, 1.0, 2.8, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Balance the scale',
        detail: `The weight on the left is a ${target} m cube. Put a cube of the same size on the right pan.`,
        hint: `Not too small, not too big: the cube on the right pan must be between ${r1(target - tol)} and ${r1(target + tol)} m across. Hold it, look at the pan from the right distance, drop it.`,
        solved: () => done,
        update() {
          let size = 0;
          for (const c of b.cubes) {
            const p = c.mesh.position;
            if (c.held || c.vy !== 0) continue;
            if (Math.abs(p.x - right.x) < 1.0 && Math.abs(p.z - right.z) < 1.0 && Math.abs(p.y - c.size / 2 - (Y + 0.06)) < 0.05) size = c.size;
          }
          const diff = size ? THREE.MathUtils.clamp((size - target) * 0.4, -0.25, 0.25) : 0.25;
          beam.rotation.z += (-diff - beam.rotation.z) * 0.1;
          if (!done && size && Math.abs(size - target) <= tol) {
            done = true;
            ring.color.set('#3dff7a').multiplyScalar(1.6);
            b.ctx.sfx.play('unlock');
          }
        },
        reserve: {},
        debug: { cube, pan: { x: right.x, z: right.z, y: Y + 0.06, half: 1.0 }, min: target - tol + 0.02, max: target + tol - 0.02 },
      };
    },
  },

  // ---------------------------------------------------------------- moving platform
  moving_platform: {
    dims: (rng, d = 0) => {
      const a = range(rng, 4, 5), g = range(rng, 6, 7) + d * 4, far = range(rng, 5, 7);
      return { w: range(rng, 9, 12), d: a + g + far, h: range(rng, 6, 7), pit: { a, g } };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0, D = info.diff;
      const pitS = cell.zS - dims.pit.a, pitN = pitS - dims.pit.g;
      pitWalls(b, cell, pitS, pitN);
      const half = new THREE.Vector3(1.1, 0.15, 1.1);
      const near = pitS - 1.1, far = pitN + 1.1;
      const plat = b.box(-1.1, Y - 0.3, near - 1.1, 1.1, Y, near + 1.1, b.mat.metal, { tile: 0 });
      b.strip(-1.1, Y, near - 1.1, 1.1, Y + 0.012, near + 1.1, glowMat(b.theme.accent, 1.2)).visible = false;
      const edge = glowMat('#ffcc22', 1.5);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.06, 2.24), edge);
      b.scene.add(trim);
      const speed = 1.6 + D * 1.4, pause = 1.8 - D * 0.6;
      const travel = (near - far) / speed;
      const period = 2 * (travel + pause);
      let t = rng() * period, z = near, passed = false;
      const pos = new THREE.Vector3();
      const zAt = (tt) => {
        const u = tt % period;
        if (u < pause) return near;
        if (u < pause + travel) return near - (u - pause) * speed;
        if (u < 2 * pause + travel) return far;
        return far + (u - 2 * pause - travel) * speed;
      };
      infoSign(b, [{ text: 'RIDE THE PLATFORM', size: 46 }, { text: 'it waits at each side', size: 32, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      const api = {
        label: 'Cross on the platform',
        detail: 'A platform shuttles across the chasm. Step on while it waits on your side.',
        hint: 'Wait for the platform to stop at the edge, step onto the middle, and ride it across. Step off when it stops on the far side.',
        solved: () => passed,
        update(dt, player) {
          t += dt;
          const nz = zAt(t), dz = nz - z;
          z = nz;
          pos.set(0, Y - 0.15, z);
          plat.position.copy(pos);
          plat.updateMatrixWorld();
          setCollider(plat.userData.collider, pos, half);
          trim.position.set(0, Y - 0.02, z);
          // Carry whoever is standing on it.
          const p = player.pos;
          if (Math.abs(p.x) < 1.15 && Math.abs(p.z - (z - dz)) < 1.15 && Math.abs(p.y - Y) < 0.08) p.z += dz;
          if (!passed && cell.contains(p) && p.z < pitN - 0.4 && p.y > Y - 0.3) passed = true;
        },
        reserve: { w: [[pitN, pitS]], e: [[pitN, pitS]] },
        debug: { near, far, pitS, pitN, get z() { return z; }, get atNear() { return Math.abs(z - near) < 0.01 && (t % period) < pause * 0.5; } },
      };
      return api;
    },
  },

  // ---------------------------------------------------------------- telescope
  telescope: {
    dims: (rng, d = 0) => ({ w: range(rng, 10, 13), d: range(rng, 18, 22) + d * 4, h: range(rng, 6, 7) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const code = Array.from({ length: codeLength(D) }, () => irange(rng, 0, 9)).join('');
      // The digits: tiny, high on the far wall. Unreadable without help.
      const tx = range(rng, -cell.w / 2 + 1.5, -1.6), ty = Y + cell.h - range(rng, 1.0, 1.8);
      const tiny = 0.34 - D * 0.12;
      b.sign(signTexture([{ text: code.split('').join(' '), size: 90 }], { w: 512, h: 160, bg: '#0b0d10', fg: '#ffe9a0' }), tiny * 3, tiny, tx, ty, cell.zN + 0.03, 0, { glow: 1.3 });
      // The telescope.
      const tz = cell.zS - 2.4;
      b.pedestal(0, tz, 0.5, Y + 1.0, Y);
      const brass = new THREE.MeshStandardMaterial({ color: '#c9a043', metalness: 0.85, roughness: 0.3 });
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.9, 16), brass);
      const target = new THREE.Vector3(tx, ty, cell.zN);
      tube.position.set(0, Y + 1.35, tz);
      tube.lookAt(target);
      tube.rotateX(Math.PI / 2);
      tube.userData.interact = 'button';
      tube.userData.label = 'Look through the telescope';
      tube.userData.press = () => { ctx.zoom?.(target, 6); b.ctx.sfx.play('pickup'); };
      b.scene.add(tube);
      b.solids.push(tube);
      b.sign(signTexture([{ text: 'LOOK CLOSER', size: 50 }], { w: 400, h: 110, bg: '#0b0d10', fg: '#ffcf6b' }), 0.9, 0.25, 0, Y + 0.7, tz + 0.27, 0, { glow: 1.1 });
      const { kp, pos } = exitKeypad(b, cell, code);
      return {
        label: 'Read the far wall',
        detail: 'Something is written up on the far wall, far too small to read from here.',
        hint: 'Use the telescope by the entrance: it zooms in on the tiny numbers high on the far wall. Type them into the keypad.',
        solved: () => kp.solved,
        reserve: {},
        debug: { keypad: pos, code },
      };
    },
  },

  // ---------------------------------------------------------------- light beam + mirrors
  mirror_beam: {
    dims: (rng) => ({ w: range(rng, 12, 14), d: range(rng, 13, 16), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const by = Y + 1.1;
      const zA = (cell.zS + cell.zN) / 2 + range(rng, -1, 1);
      const down = rng() < 0.5; // first turn: north (−z) or south (+z)
      const zB = THREE.MathUtils.clamp(zA + (down ? 3.2 : -3.2), cell.zN + 2.5, cell.zS - 2.5);
      const xA = cell.x0 + 3, xB = cell.x1 - 3;
      // Mirrors: '/' turns east↔north, '\' turns east↔south.
      const path = [
        { x: xA, z: zA, need: zB < zA ? '/' : '\\' },
        { x: xA, z: zB, need: zB < zA ? '/' : '\\' },
        { x: xB, z: zB, need: '/' },
      ];
      // Higher difficulty: an extra decoy mirror off the path.
      if (D > 0.45) path.push({ x: (xA + xB) / 2, z: zA, need: null });
      const mirrors = path.map((m) => ({ ...m, state: pick(rng, ['/', '\\']) }));
      if (mirrors.slice(0, 3).every((m) => m.state === m.need)) mirrors[1].state = mirrors[1].need === '/' ? '\\' : '/';
      let done = false;
      const beamMat = glowMat('#ff3b30', 2.4);
      const beamGroup = new THREE.Group();
      b.scene.add(beamGroup);
      // Emitter on the west wall, receiver on the north wall.
      b.box(cell.x0, by - 0.25, zA - 0.25, cell.x0 + 0.4, by + 0.25, zA + 0.25, b.mat.darkMetal, { tile: 0 });
      const recvMat = glowMat('#5a1010', 1);
      b.box(xB - 0.3, by - 0.3, cell.zN, xB + 0.3, by + 0.3, cell.zN + 0.25, recvMat, { tile: 0 });
      const meshes = mirrors.map((m, i) => {
        b.pedestal(m.x, m.z, 0.5, by - 0.3, Y);
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: '#dfe8f0', metalness: 1, roughness: 0.05 }));
        plate.position.set(m.x, by, m.z);
        plate.userData.interact = 'button';
        plate.userData.label = 'Turn the mirror';
        plate.userData.press = () => {
          if (done) return;
          m.state = m.state === '/' ? '\\' : '/';
          plate.rotation.y = m.state === '/' ? Math.PI / 4 : -Math.PI / 4;
          b.ctx.sfx.play('beep');
          trace();
        };
        plate.rotation.y = m.state === '/' ? Math.PI / 4 : -Math.PI / 4;
        b.scene.add(plate);
        b.solids.push(plate);
        return plate;
      });
      const segment = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, len), beamMat);
        s.position.set((x0 + x1) / 2, by, (z0 + z1) / 2);
        s.rotation.y = Math.atan2(x1 - x0, z1 - z0);
        beamGroup.add(s);
      };
      function trace() {
        beamGroup.clear();
        let x = cell.x0 + 0.4, z = zA, dx = 1, dz = 0;
        for (let bounce = 0; bounce < 8; bounce++) {
          // Next mirror along the ray, or the wall.
          let hit = null, best = Infinity;
          for (const m of mirrors) {
            const t = dx ? (m.x - x) * dx : (m.z - z) * dz;
            const off = dx ? Math.abs(m.z - z) : Math.abs(m.x - x);
            if (t > 0.1 && off < 0.3 && t < best) { best = t; hit = m; }
          }
          if (!hit) {
            const wx = dx > 0 ? cell.x1 : dx < 0 ? cell.x0 : x, wz = dz > 0 ? cell.zS : dz < 0 ? cell.zN : z;
            segment(x, z, wx, wz);
            if (dz < 0 && Math.abs(x - xB) < 0.3 && !done) {
              done = true;
              recvMat.color.set('#3dff7a').multiplyScalar(2);
              b.ctx.sfx.play('unlock');
            }
            return;
          }
          segment(x, z, hit.x, hit.z);
          x = hit.x; z = hit.z;
          // Reflect: '/' maps (1,0)↔(0,−1) and (−1,0)↔(0,1); '\' maps (1,0)↔(0,1).
          [dx, dz] = hit.state === '/' ? [-dz, -dx] : [dz, dx];
        }
      }
      trace();
      infoSign(b, [{ text: 'GUIDE THE BEAM', size: 46 }, { text: 'turn the mirrors so the light', size: 30, color: '#9aa4ae' }, { text: 'reaches the dark receiver', size: 30, color: '#9aa4ae' }],
        2.0, 1.0, 2.6, Y + 2.4, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Guide the beam',
        detail: 'A beam of light leaves the west wall. Turn the mirrors so it reaches the receiver on the far wall.',
        hint: 'Each mirror has two positions. Follow the beam from the emitter: wherever it goes wrong, turn that mirror.',
        solved: () => done,
        reserve: { w: [[zA - 0.6, zA + 0.6]] },
        debug: { mirrors: mirrors.map((m, i) => ({ x: m.x, y: by, z: m.z, need: m.need != null && m.state !== m.need, mesh: meshes[i] })) },
      };
    },
  },

  // ---------------------------------------------------------------- symbol hunt
  symbol_hunt: {
    dims: (rng) => ({ w: range(rng, 11, 14), d: range(rng, 13, 16), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const SYMBOLS = ['▲', '●', '■', '★', '◆', '✚', '♥', '☾'];
      const k = codeLength(D);
      const picked = shuffle(rng, SYMBOLS).slice(0, k + (D > 0.5 ? 2 : 0)); // extras are decoys
      const digits = picked.map(() => irange(rng, 0, 9));
      const spots = [];
      for (let i = 0; i < picked.length; i++) {
        const side = pick(rng, ['w', 'e']);
        const z = range(rng, cell.zN + 1.5, cell.zS - 1.5);
        const y = Y + range(rng, 0.5, 3.2);
        const x = side === 'w' ? cell.x0 + 0.03 : cell.x1 - 0.03;
        const sym = picked[i];
        b.sign(panelTexture((g, w, h) => {
          g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, h);
          g.fillStyle = '#e8eef2'; g.font = 'bold 120px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(sym, w / 2, 90);
          g.fillStyle = '#ffcf6b'; g.font = 'bold 70px ui-monospace, monospace'; g.fillText(String(digits[i]), w / 2, 205);
        }, 256, 256), 0.45, 0.45, x, y, z, side === 'w' ? Math.PI / 2 : -Math.PI / 2, { transparent: true, glow: 1.2 });
        spots.push({ side, z });
      }
      const order = picked.slice(0, k);
      const code = digits.slice(0, k).join('');
      const { kp, pos } = exitKeypad(b, cell, code);
      b.sign(signTexture([{ text: 'CODE', size: 40 }, { text: order.join('  '), size: 70, color: '#ffcf6b' }], { w: 512, h: 200, bg: '#0b0d10' }),
        0.9, 0.35, pos.x, pos.y + 0.62, pos.z + 0.02, 0, { glow: 1.2 });
      return {
        label: 'Find the symbols',
        detail: 'The door wants the numbers under certain symbols, in the order shown beside the keypad.',
        hint: 'Symbols with numbers under them are painted around the side walls, some high, some low. Find each symbol shown by the keypad and type its number, in order.',
        solved: () => kp.solved,
        reserve: { w: spots.filter((s) => s.side === 'w').map((s) => [s.z - 0.4, s.z + 0.4]), e: spots.filter((s) => s.side === 'e').map((s) => [s.z - 0.4, s.z + 0.4]) },
        debug: { keypad: pos, code },
      };
    },
  },

  // ---------------------------------------------------------------- conveyor
  conveyor: {
    dims: (rng, d = 0) => ({ w: range(rng, 9, 12), d: range(rng, 18, 22) + d * 4, h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const z0 = cell.zS - 3, z1 = cell.zN + 3;
      // Belts run back towards the entrance, faster the further you get.
      const n = 2 + Math.round(D);
      const belts = [];
      const len = (z0 - z1) / n;
      for (let i = 0; i < n; i++) {
        const bz0 = z0 - i * len, bz1 = bz0 - len + 0.3;
        const speed = 2.4 + (i / Math.max(1, n - 1)) * (1.4 + D * 2.4); // last belt up to 6.2 m/s
        const tex = panelTexture((g, w, h) => {
          g.fillStyle = '#23262c'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#ffcc22';
          for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(w * 0.2, y + 44); g.lineTo(w / 2, y + 14); g.lineTo(w * 0.8, y + 44); g.lineTo(w * 0.7, y + 54); g.lineTo(w / 2, y + 34); g.lineTo(w * 0.3, y + 54); g.fill(); }
        }, 128, 256);
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, len / 2);
        tex.rotation = Math.PI;
        tex.center.set(0.5, 0.5);
        const belt = new THREE.Mesh(new THREE.PlaneGeometry(cell.w - 0.6, len - 0.3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
        belt.rotation.x = -Math.PI / 2;
        belt.position.set(0, Y + 0.015, (bz0 + bz1) / 2);
        b.scene.add(belt);
        belts.push({ z0: bz0, z1: bz1, speed, tex });
      }
      let passed = false;
      infoSign(b, [{ text: 'CONVEYORS', size: 48 }, { text: 'they carry you back. run.', size: 32, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Beat the conveyors',
        detail: 'The floor carries you back towards the entrance, faster the further you get.',
        hint: 'Sprint (Shift) the whole way. The last belt is faster than walking.',
        solved: () => passed,
        update(dt, player) {
          for (const bt of belts) bt.tex.offset.y -= dt * bt.speed / 2;
          const p = player.pos;
          if (cell.contains(p) && player.onGround) {
            for (const bt of belts) if (p.z < bt.z0 && p.z > bt.z1 && Math.abs(p.x) < cell.w / 2 - 0.3) p.z += bt.speed * dt;
          }
          if (!passed && cell.contains(p) && p.z < z1 - 0.5) passed = true;
        },
        reserve: {},
        debug: { start: z0 + 1, end: z1 - 1.5 },
      };
    },
  },

  // ---------------------------------------------------------------- pipes
  pipe_flow: {
    dims: (rng) => ({ w: range(rng, 12, 14), d: range(rng, 11, 14), h: range(rng, 5.5, 6.5) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const cols = D > 0.5 ? 5 : 4, rows = D > 0.5 ? 4 : 3;
      const N = 1, E = 2, S = 4, W = 8;
      const rot = (m, r) => { let o = m; for (let i = 0; i < r; i++) o = ((o << 1) | (o >> 3)) & 15; return o; };
      // A path from the left edge to the right edge, moving right / up / down.
      const r0 = irange(rng, 0, rows - 1);
      const path = [[0, r0]];
      const seen = new Set([`0,${r0}`]);
      let [c, r] = [0, r0];
      while (c < cols - 1) {
        const opts = [[c + 1, r]];
        if (r > 0 && !seen.has(`${c},${r - 1}`)) opts.push([c, r - 1]);
        if (r < rows - 1 && !seen.has(`${c},${r + 1}`)) opts.push([c, r + 1]);
        const prev = path.length > 1 ? path[path.length - 2] : null;
        const vertical = prev && prev[0] === c;
        [c, r] = vertical || rng() < 0.55 ? opts[0] : pick(rng, opts);
        path.push([c, r]);
        seen.add(`${c},${r}`);
      }
      const r1 = r;
      const dirTo = (a, bb) => (bb[0] > a[0] ? E : bb[0] < a[0] ? W : bb[1] > a[1] ? S : N);
      const opposite = { [N]: S, [S]: N, [E]: W, [W]: E };
      const tiles = [];
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) tiles.push({ c: cc, r: rr, kind: rng() < 0.5 ? 'straight' : 'corner', rot: 0, need: null });
      const at = (cc, rr) => tiles[rr * cols + cc];
      path.forEach((p, i) => {
        const inDir = i === 0 ? W : opposite[dirTo(path[i - 1], p)];
        const outDir = i === path.length - 1 ? E : dirTo(p, path[i + 1]);
        const mask = inDir | outDir;
        const t = at(p[0], p[1]);
        t.kind = mask === (E | W) || mask === (N | S) ? 'straight' : 'corner';
        const base = t.kind === 'straight' ? (E | W) : (N | E);
        t.need = [0, 1, 2, 3].find((k) => rot(base, k) === mask);
      });
      for (const t of tiles) t.rot = irange(rng, 0, 3);
      if (path.every((p) => at(p[0], p[1]).rot === at(p[0], p[1]).need)) at(path[0][0], path[0][1]).rot = (at(path[0][0], path[0][1]).need + 1) % 4;
      const openings = (t) => rot(t.kind === 'straight' ? (E | W) : (N | E), t.rot);
      // Panel on the north wall, left of the door.
      const size = 0.62;
      const xLeft = cell.x0 + 1.2, yTop = Y + 0.9 + (rows - 1) * size;
      const texFor = (kind, lit) => panelTexture((g, w) => {
        g.fillStyle = '#1a1d22'; g.fillRect(0, 0, w, w);
        g.strokeStyle = '#3a4048'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, w - 6);
        g.strokeStyle = lit ? '#3df0ff' : '#8a96a4'; g.lineWidth = 34; g.lineCap = 'butt';
        g.beginPath();
        if (kind === 'straight') { g.moveTo(0, w / 2); g.lineTo(w, w / 2); }
        else { g.moveTo(w / 2, 0); g.lineTo(w / 2, w / 2); g.lineTo(w, w / 2); }
        g.stroke();
      }, 128, 128);
      const texs = { straight: [texFor('straight', false), texFor('straight', true)], corner: [texFor('corner', false), texFor('corner', true)] };
      let done = false;
      const meshes = tiles.map((t) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(size - 0.04, size - 0.04), new THREE.MeshBasicMaterial({ map: texs[t.kind][0] }));
        m.position.set(xLeft + t.c * size, yTop - t.r * size, cell.zN + 0.03);
        m.rotation.z = -t.rot * Math.PI / 2;
        m.userData.interact = 'button';
        m.userData.label = 'Turn the pipe';
        m.userData.press = () => {
          if (done) return;
          t.rot = (t.rot + 1) % 4;
          m.rotation.z = -t.rot * Math.PI / 2;
          b.ctx.sfx.play('beep');
          flow();
        };
        b.scene.add(m);
        b.solids.push(m);
        return m;
      });
      const srcMat = glowMat('#3df0ff', 1.6), drainMat = glowMat('#30343a', 1);
      b.box(xLeft - size, yTop - r0 * size - 0.12, cell.zN, xLeft - size / 2, yTop - r0 * size + 0.12, cell.zN + 0.1, srcMat, { tile: 0 });
      b.box(xLeft + (cols - 0.5) * size, yTop - r1 * size - 0.12, cell.zN, xLeft + cols * size, yTop - r1 * size + 0.12, cell.zN + 0.1, drainMat, { tile: 0 });
      function flow() {
        // Follow openings from the source.
        const lit = new Set();
        let cc = 0, rr = r0, from = W;
        for (let guard = 0; guard < rows * cols + 1; guard++) {
          if (cc < 0 || cc >= cols || rr < 0 || rr >= rows) break;
          const t = at(cc, rr);
          const o = openings(t);
          if (!(o & from)) break;
          lit.add(t);
          const out = o & ~from;
          if (cc === cols - 1 && rr === r1 && (out & E)) {
            if (!done) { done = true; drainMat.color.set('#3df0ff').multiplyScalar(1.6); b.ctx.sfx.play('unlock'); }
            break;
          }
          if (out & E) { cc++; from = W; } else if (out & W) { cc--; from = E; } else if (out & S) { rr++; from = N; } else if (out & N) { rr--; from = S; } else break;
        }
        tiles.forEach((t, i) => { meshes[i].material.map = texs[t.kind][lit.has(t) ? 1 : 0]; });
      }
      flow();
      return {
        label: 'Connect the pipes',
        detail: 'Turn the tiles on the far wall so the flow runs from the left inlet to the right outlet.',
        hint: 'Start at the glowing inlet on the left. Turn each tile until the glow passes through it, then move to the next.',
        solved: () => done,
        reserve: {},
        debug: {
          presses: tiles.filter((t) => t.need != null).map((t) => ({ x: xLeft + t.c * size, y: yTop - t.r * size, z: cell.zN + 0.03, n: (t.need - t.rot + 4) % 4 })),
        },
      };
    },
  },

  // ---------------------------------------------------------------- laser gates
  sweeper: {
    dims: (rng, d = 0) => ({ w: range(rng, 9, 12), d: range(rng, 16, 19) + d * 3, h: range(rng, 4.5, 5.5) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const n = 3 + Math.round(D * 2);
      const on = 1.4, off = 1.3 - D * 0.45;
      const period = on + off;
      const gates = [];
      for (let i = 0; i < n; i++) {
        const z = cell.zS - 3 - i * ((cell.d - 6) / (n - 1 || 1));
        const phase = rng() * period;
        const mat = glowMat('#ff2b2b', 2.2);
        const g = new THREE.Group();
        for (let y = Y + 0.15; y < Y + cell.h - 0.2; y += 0.32) {
          const beam = new THREE.Mesh(new THREE.BoxGeometry(cell.w, 0.03, 0.03), mat);
          beam.position.set(0, y, z);
          g.add(beam);
        }
        b.scene.add(g);
        for (const x of [cell.x0 + 0.1, cell.x1 - 0.1]) b.box(x - 0.1, Y, z - 0.1, x + 0.1, Y + cell.h, z + 0.1, b.mat.darkMetal, { tile: 0 });
        gates.push({ z, phase, g });
      }
      let t = 0, passed = false;
      const active = (gt, tt = t) => ((tt + gt.phase) % period) < on;
      infoSign(b, [{ text: 'LASER GATES', size: 48 }, { text: 'they blink. time it.', size: 32, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Time the laser gates',
        detail: 'Laser curtains switch on and off. Touch one while it is on and you are sent back.',
        hint: 'Stand just before each gate, wait for it to switch off, then sprint through.',
        solved: () => passed,
        update(dt, player) {
          t += dt;
          const p = player.pos;
          for (const gt of gates) {
            gt.g.visible = active(gt);
            if (gt.g.visible && cell.contains(p) && Math.abs(p.z - gt.z) < 0.3) {
              b.ctx.sfx.play('fizzle');
              ctx.respawn?.();
              return;
            }
          }
          if (!passed && cell.contains(p) && p.z < gates[gates.length - 1].z - 0.8) passed = true;
        },
        reserve: {},
        debug: { gates: gates.map((g) => ({ z: g.z })), get t() { return t; }, period, on, phase: gates.map((g) => g.phase) },
      };
    },
  },

  // ---------------------------------------------------------------- twin switches
  dual_switch: {
    dims: (rng) => ({ w: range(rng, 11, 14), d: range(rng, 11, 14), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const window = r1(4.4 - D * 1.6);
      const z = (cell.zS + cell.zN) / 2 + range(rng, -1.5, 1.5);
      let armedAt = -1, armedSide = null, t = 0, done = false;
      const lampMats = [];
      const sides = ['w', 'e'].map((side) => {
        const x = side === 'w' ? cell.x0 + 0.06 : cell.x1 - 0.06;
        const lamp = glowMat('#30343a', 1);
        lampMats.push(lamp);
        b.box(x - 0.08, Y + 2.1, z - 0.18, x + 0.08, Y + 2.4, z + 0.18, lamp, { tile: 0 });
        b.wallSwitch({
          x, y: Y + 1.25, z, rotY: side === 'w' ? Math.PI / 2 : -Math.PI / 2, color: '#ffcc33', label: 'Press the switch',
          onPress: () => {
            if (done) return;
            if (armedSide && armedSide !== side && t - armedAt <= window) {
              done = true;
              lampMats.forEach((m) => m.color.set('#3dff7a').multiplyScalar(1.8));
              b.ctx.sfx.play('unlock');
              return;
            }
            armedSide = side;
            armedAt = t;
            b.ctx.sfx.play('beep');
          },
        });
        return { x, y: Y + 1.25, z };
      });
      infoSign(b, [{ text: 'TWO SWITCHES', size: 46 }, { text: `press both within ${window} s`, size: 32, color: '#ffd27a' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Press both switches',
        detail: `Two switches on opposite walls must be pressed within ${window} seconds of each other.`,
        hint: 'Press one switch, then sprint (Shift) straight across the room to the other.',
        solved: () => done,
        update(dt) {
          t += dt;
          const live = armedSide && !done && t - armedAt <= window;
          lampMats.forEach((m, i) => {
            if (done) return;
            const mine = (i === 0 ? 'w' : 'e') === armedSide;
            m.color.set(live && mine ? (Math.sin(t * 12) > 0 ? '#ffcc33' : '#553a00') : '#30343a').multiplyScalar(live && mine ? 1.8 : 1);
          });
        },
        reserve: { w: [[z - 0.6, z + 0.6]], e: [[z - 0.6, z + 0.6]] },
        debug: { switches: sides },
      };
    },
  },
};
