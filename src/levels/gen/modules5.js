// Rooms built around the tools (tools/tools.js). Two per tool. Same module
// interface as modules.js; `tool` in plan.js says which tool a room needs.
// The first room of each tool, on its introduction level, has the tool on a
// pedestal at the entrance (generate.js); everywhere else you carry it in.
import * as THREE from 'three';
import { signTexture } from '../../textures.js';
import { range, irange, pick, shuffle } from '../../random.js';
import { makeCollider, setCollider } from '../../physics.js';
import { exitKeypad, pedestalCube, ledge, infoSign, r1 } from './modules.js';
import { pitWalls } from './modules2.js';

const glowMat = (hex, k = 1.7) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });

function onLedge(player, cell, front, top) {
  return player.pos.y > top - 0.15 && player.pos.z < front && cell.contains(player.pos);
}

// A gold ring the grapple can hook (with a generous invisible target).
function addHook(b, x, y, z) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 10, 28), new THREE.MeshStandardMaterial({ color: '#c9a043', metalness: 0.9, roughness: 0.25, emissive: '#6b4a10', emissiveIntensity: 0.6 }));
  ring.position.set(x, y, z);
  b.scene.add(ring);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hit.position.copy(ring.position);
  hit.userData.ring = ring.position.clone();
  b.scene.add(hit);
  (b.hooks ??= []).push(hit);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 5), b.mat.darkMetal);
  chain.position.set(x, y + 0.9, z);
  b.scene.add(chain);
  let t = Math.random() * 6;
  b.updaters.push((dt) => { t += dt; ring.rotation.y = Math.sin(t) * 0.4; });
  return { x, y, z };
}

// White floor tiles the gel gun can paint.
function paintTiles(b, x0, z0, x1, z1, y) {
  const mat = new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.6 });
  const m = b.box(x0, y - 0.05, z0, x1, y + 0.005, z1, mat, { tile: 1 });
  m.userData.paintable = true;
  return m;
}

// A platform that exists only in the Revealer Lantern's light.
function hiddenBox(b, x0, y0, z0, x1, y1, z1) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffe9a0', emissive: '#806a30', emissiveIntensity: 0.5, transparent: true, opacity: 0.05, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  b.scene.add(mesh);
  const collider = makeCollider(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  collider.enabled = false;
  b.colliders.push(collider);
  (b.hidden ??= []).push({ mesh, collider, vis: 0 });
  return { x: (x0 + x1) / 2, y: y1, z: (z0 + z1) / 2 };
}

// A floor pad that notices people (you, or your hologram), not cubes.
function personPad(b, x, z, y, color = '#5fe1ff') {
  b.box(x - 0.9, y, z - 0.9, x + 0.9, y + 0.05, z + 0.9, b.mat.metal, { tile: 0 });
  const ring = glowMat('#ff4b4b', 1.5);
  b.strip(x - 0.8, y + 0.05, z - 0.8, x + 0.8, y + 0.055, z + 0.8, ring);
  const icon = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), glowMat(color, 1.2));
  icon.rotation.x = -Math.PI / 2;
  icon.position.set(x, y + 0.06, z);
  b.scene.add(icon);
  return { x, z, y: y + 0.05, half: 0.9, ring, set(on) { ring.color.set(on ? '#3dff7a' : '#ff4b4b').multiplyScalar(1.5); } };
}

export const MODULE_IMPL_5 = {
  // ================================================================ Grapple Hook
  grapple_gap: {
    dims: (rng, d = 0) => {
      const a = range(rng, 4, 5), g = range(rng, 7, 8.5) + d * 5, far = range(rng, 5, 7);
      return { w: range(rng, 10, 13), d: a + g + far, h: range(rng, 7, 8), pit: { a, g } };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0;
      const pitS = cell.zS - dims.pit.a, pitN = pitS - dims.pit.g;
      pitWalls(b, cell, pitS, pitN);
      const n = Math.max(2, Math.ceil((pitS - pitN) / 4.6) + 1);
      const rings = [];
      for (let i = 0; i < n; i++) {
        const z = pitS - 1 - ((pitS - 1) - (pitN - 1.2)) * (i / (n - 1));
        rings.push(addHook(b, (i % 2 ? 1 : -1) * range(rng, 0, 1.2), Y + range(rng, 4.6, 5.2), z));
      }
      let passed = false;
      infoSign(b, [{ text: 'GRAPPLE ACROSS', size: 46 }, { text: 'hook a ring, then the next', size: 30, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Grapple across the chasm',
        detail: 'Gold rings hang over the chasm. Hook one, then hook the next from where you hang.',
        hint: 'Select the Grapple Hook (mouse wheel), aim at the first gold ring and click. While hanging, aim at the next ring and click again. Let go (right click) over the far floor.',
        solved: () => passed,
        update(dt, player) { if (!passed && cell.contains(player.pos) && player.pos.z < pitN - 0.4 && player.onGround) passed = true; },
        reserve: { w: [[pitN, pitS]], e: [[pitN, pitS]] },
        debug: { rings, pitN },
      };
    },
  },

  grapple_climb: {
    dims: (rng, d = 0) => {
      const L = r1(5 + d * 2);
      return { w: range(rng, 10, 13), d: range(rng, 14, 17), h: L + 4.2, exitY: L, L };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0, L = dims.L;
      const front = ledge(b, cell, 5, L);
      const rings = [
        addHook(b, range(rng, -1.5, 1.5), Y + L + 1.0, front + 1.6),
        addHook(b, 0, Y + L + 2.8, front - 0.8),
      ];
      b.sign(signTexture([{ text: `LEDGE ${L} m`, size: 44 }, { text: 'hook your way up', size: 30, color: '#9aa4ae' }], { w: 512, h: 160, bg: '#14171c', fg: '#ffcf9a' }),
        2.0, 0.62, 0, Y + L - 0.7, front + 0.02, 0);
      let up = false;
      return {
        label: 'Grapple up the wall',
        detail: `The exit is ${L} m up. Two rings lead the way.`,
        hint: 'Hook the low ring first. From there, hook the high ring above the ledge, then let go to drop onto it.',
        solved: () => up,
        update(dt, player) { if (onLedge(player, cell, front, Y + L)) up = true; },
        reserve: {},
        debug: { rings, front, top: Y + L },
      };
    },
  },

  // ================================================================ Blink Beacon
  blink_cage: {
    dims: (rng) => ({ w: range(rng, 10, 13), d: range(rng, 13, 16), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const gz = (cell.zS + cell.zN) / 2 - 1;
      // Floor-to-ceiling glass across the whole room. No door, no panels.
      b.box(cell.x0, Y, gz - 0.06, cell.x1, Y + cell.h, gz + 0.06, b.mat.glass, { tile: 0, gun: false, solid: false });
      b.strip(cell.x0, Y, gz - 0.07, cell.x1, Y + 0.05, gz + 0.07, glowMat('#c78bff', 1.4));
      if (D > 0.45) {
        // A second pane further in: two blinks.
        b.box(cell.x0, Y, gz - 3.06, cell.x1, Y + cell.h, gz - 2.94, b.mat.glass, { tile: 0, gun: false, solid: false });
        b.strip(cell.x0, Y, gz - 3.07, cell.x1, Y + 0.05, gz - 2.93, glowMat('#c78bff', 1.4));
      }
      const lastZ = D > 0.45 ? gz - 3 : gz;
      let passed = false;
      infoSign(b, [{ text: 'NO DOOR', size: 52 }, { text: 'beacons fly through glass', size: 30, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Get past the glass',
        detail: 'A glass wall seals the room. Your beacon flies straight through it.',
        hint: 'Select the Blink Beacon, throw it (left click) at the floor beyond the glass, then blink to it (right click).',
        solved: () => passed,
        update(dt, player) { if (!passed && cell.contains(player.pos) && player.pos.z < lastZ - 0.5) passed = true; },
        reserve: {},
        debug: { targets: D > 0.45 ? [{ x: 0, y: Y, z: gz - 1.5 }, { x: 0, y: Y, z: gz - 4.6 }] : [{ x: 0, y: Y, z: gz - 2 }] },
      };
    },
  },

  blink_islands: {
    dims: (rng, d = 0) => {
      const a = range(rng, 3.5, 4.5), g = range(rng, 12, 14) + d * 6, far = range(rng, 4, 6);
      return { w: range(rng, 10, 12), d: a + g + far, h: range(rng, 6, 7), pit: { a, g } };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0;
      const pitS = cell.zS - dims.pit.a, pitN = pitS - dims.pit.g;
      pitWalls(b, cell, pitS, pitN);
      const n = Math.max(1, Math.round((pitS - pitN) / 6.2) - 1);
      const islands = [];
      for (let i = 0; i < n; i++) {
        const z = pitS - ((pitS - pitN) * (i + 1)) / (n + 1);
        const x = range(rng, -2.5, 2.5);
        b.box(x - 1.0, Y - 0.6, z - 1.0, x + 1.0, Y, z + 1.0, cell.mat.floor, { tile: 2 });
        b.strip(x - 1.02, Y - 0.62, z - 1.02, x + 1.02, Y - 0.56, z + 1.02, glowMat('#c78bff', 1.3));
        islands.push({ x, y: Y, z });
      }
      let passed = false;
      infoSign(b, [{ text: 'ISLANDS', size: 50 }, { text: 'too far to jump. not to blink.', size: 30, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Blink across the islands',
        detail: 'Small islands float in the chasm, too far apart to jump.',
        hint: 'Throw the beacon onto the nearest island, blink to it, and repeat until you reach the far side.',
        solved: () => passed,
        update(dt, player) { if (!passed && cell.contains(player.pos) && player.pos.z < pitN - 0.4 && player.onGround) passed = true; },
        reserve: { w: [[pitN, pitS]], e: [[pitN, pitS]] },
        debug: { targets: [...islands, { x: 0, y: Y, z: pitN - 2 }] },
      };
    },
  },

  // ================================================================ Gel Gun
  gel_bounce: {
    dims: (rng, d = 0) => {
      const L = r1(3.0 + d * 0.5);
      return { w: range(rng, 10, 13), d: range(rng, 15, 18), h: L + 4.6, exitY: L, L };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0, L = dims.L;
      const front = ledge(b, cell, 5, L);
      const pz = front + 2.4;
      paintTiles(b, -2.4, pz - 1.6, 2.4, pz + 1.6, Y);
      b.sign(signTexture([{ text: `LEDGE ${L} m`, size: 44 }, { text: 'too high to climb', size: 30, color: '#9aa4ae' }], { w: 512, h: 160, bg: '#14171c', fg: '#ffcf9a' }),
        2.0, 0.62, 0, Y + L - 0.7, front + 0.02, 0);
      let up = false;
      return {
        label: 'Bounce up to the ledge',
        detail: 'White tiles in front of the ledge take gel. Blue gel bounces.',
        hint: 'Select the Gel Gun, shoot blue gel (left click) onto the white tiles, then walk onto it heading towards the ledge.',
        solved: () => up,
        update(dt, player) { if (onLedge(player, cell, front, Y + L)) up = true; },
        reserve: {},
        debug: { spot: { x: 0, y: Y, z: pz }, front, top: Y + L },
      };
    },
  },

  gel_speed: {
    dims: (rng, d = 0) => {
      const a = range(rng, 11, 13), g = range(rng, 7, 7.5) + d * 1.6, far = range(rng, 5, 7);
      return { w: range(rng, 9, 11), d: a + g + far, h: range(rng, 5, 6), pit: { a, g } };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0;
      const pitS = cell.zS - dims.pit.a, pitN = pitS - dims.pit.g;
      pitWalls(b, cell, pitS, pitN);
      paintTiles(b, -1.6, pitS + 0.2, 1.6, pitS + 7.5, Y);
      let passed = false;
      infoSign(b, [{ text: `GAP ${r1(pitS - pitN)} m`, size: 50 }, { text: 'nobody jumps that far. nobody normal.', size: 28, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Speed-jump the gap',
        detail: 'The gap is too wide to jump. Orange gel makes you very fast.',
        hint: 'Paint the white runway with orange gel (right click), back up, sprint across it and jump at the edge.',
        solved: () => passed,
        update(dt, player) { if (!passed && cell.contains(player.pos) && player.pos.z < pitN - 0.3 && player.onGround) passed = true; },
        reserve: { w: [[pitN, pitS]], e: [[pitN, pitS]] },
        debug: { runway: { x: 0, y: Y, z: pitS + 3.5 }, pitS, pitN },
      };
    },
  },

  // ================================================================ Chrono Watch
  chrono_blades: {
    dims: (rng, d = 0) => ({ w: range(rng, 8.5, 10), d: range(rng, 17, 20) + d * 4, h: range(rng, 4.5, 5.5) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const n = 2 + Math.round(D * 2);
      const blades = [];
      const R = cell.w / 2 - 0.3;
      for (let i = 0; i < n; i++) {
        // Every sweep stays inside the room, clear of both doors.
        const zA = cell.zS - R - 1.2, zB = cell.zN + R + 1.2;
        const z = n > 1 ? zA - (zA - zB) * (i / (n - 1)) : (zA + zB) / 2;
        b.box(-0.15, Y, z - 0.15, 0.15, Y + 1.2, z + 0.15, b.mat.darkMetal, { tile: 0 });
        const arm = new THREE.Group();
        arm.position.set(0, Y + 0.7, z);
        for (const s of [-1, 1]) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(R, 0.12, 0.08), glowMat('#ff3b30', 2));
          blade.position.x = s * R / 2;
          arm.add(blade);
        }
        b.scene.add(arm);
        blades.push({ arm, z, speed: (rng() < 0.5 ? 1 : -1) * (2.6 + D * 1.6), a: rng() * Math.PI });
      }
      let passed = false;
      infoSign(b, [{ text: 'BLADES', size: 54 }, { text: 'too fast. unless time stops.', size: 30, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      const seg = (p, bl) => {
        // Distance from the player to the spinning blade line.
        const dx = p.x, dz = p.z - bl.z;
        const along = dx * Math.cos(bl.a) - dz * Math.sin(bl.a);
        const across = dx * Math.sin(bl.a) + dz * Math.cos(bl.a);
        return Math.abs(along) < R + 0.2 ? Math.abs(across) : Infinity;
      };
      return {
        chrono: true, // the Chrono Watch freezes this room
        label: 'Pass the blades',
        detail: 'Spinning blades sweep the room. Touch one and you start again.',
        hint: 'Use the Chrono Watch (left click) to freeze the blades, then walk straight through before time starts again (or jump them, if you are brave).',
        solved: () => passed,
        update(dt, player) {
          for (const bl of blades) { bl.a += bl.speed * dt; bl.arm.rotation.y = bl.a; }
          const p = player.pos;
          // Frozen blades (dt = 0 while the Chrono Watch runs) can't hurt you.
          if (dt > 0 && cell.contains(p) && p.y < Y + 0.78) {
            for (const bl of blades) {
              if (Math.abs(p.z - bl.z) < R + 0.4 && seg(p, bl) < 0.38) { b.ctx.sfx.play('fizzle'); ctx.respawn?.(); return; }
            }
          }
          if (!passed && cell.contains(p) && p.z < blades[blades.length - 1].z - R + 0.5) passed = true;
        },
        reserve: {},
        debug: { blades: blades.map((bl) => ({ z: bl.z })), radius: R, get angles() { return blades.map((bl) => bl.a); } },
      };
    },
  },

  chrono_crusher: {
    dims: (rng, d = 0) => ({ w: range(rng, 8, 10), d: range(rng, 15, 18) + d * 3, h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const n = 3 + Math.round(D * 2);
      const top = Y + cell.h - 0.4;
      const crushers = [];
      const phase = rng() * 2;
      // Side walls narrow the room to a lane under the pistons.
      for (const s of [-1, 1]) b.box(s > 0 ? 1.5 : cell.x0, Y, cell.zN + 2, s > 0 ? cell.x1 : -1.5, Y + cell.h, cell.zS - 2, cell.mat.wall);
      for (let i = 0; i < n; i++) {
        const z = cell.zS - 3.5 - i * ((cell.d - 7) / Math.max(1, n - 1));
        const head = b.box(-1.5, top - 1.2, z - 0.9, 1.5, top, z + 0.9, b.mat.darkMetal, { tile: 0 });
        b.strip(-1.5, top - 1.22, z - 0.92, 1.5, top - 1.18, z + 0.92, glowMat('#ffcc22', 1.5));
        crushers.push({ head, z, t: phase - i * 0.05, period: 2.2 - D * 0.6, y: top - 0.6 }); // a ripple: all are up together for a moment
      }
      const half = new THREE.Vector3(1.5, 0.6, 0.9);
      let passed = false;
      infoSign(b, [{ text: 'CRUSHERS', size: 54 }, { text: 'freeze them while they are up', size: 30, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      const heightAt = (c) => {
        const u = (c.t % c.period) / c.period;
        // Fast slam (10% of the cycle), slow rise.
        const down = u < 0.1 ? u / 0.1 : u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7;
        return top - 0.6 - down * (top - 0.6 - (Y + 0.6));
      };
      return {
        chrono: true,
        label: 'Get past the crushers',
        detail: 'Pistons slam down the corridor faster than you can run.',
        hint: 'Wait until the pistons are up, freeze them with the Chrono Watch, and walk under.',
        solved: () => passed,
        update(dt, player) {
          for (const c of crushers) {
            c.t += dt;
            c.y = heightAt(c);
            const pos = new THREE.Vector3(0, c.y, c.z);
            c.head.position.copy(pos);
            c.head.updateMatrixWorld();
            setCollider(c.head.userData.collider, pos, half);
          }
          const p = player.pos;
          if (cell.contains(p)) {
            for (const c of crushers) if (Math.abs(p.z - c.z) < 1.1 && Math.abs(p.x) < 1.6 && c.y - 0.6 < p.y + 1.7) { b.ctx.sfx.play('thud'); ctx.respawn?.(); return; }
          }
          if (!passed && cell.contains(p) && p.z < crushers[crushers.length - 1].z - 1.3) passed = true;
        },
        reserve: { w: [[cell.zN, cell.zS]], e: [[cell.zN, cell.zS]] },
        debug: { crushers: crushers.map((c) => ({ z: c.z })), get heights() { return crushers.map((c) => c.y); }, top, minY: Y + 0.6 },
      };
    },
  },

  // ================================================================ Hologram
  echo_plates: {
    dims: (rng) => ({ w: range(rng, 13, 16), d: range(rng, 12, 15), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const z = (cell.zS + cell.zN) / 2;
      const pads = [personPad(b, cell.x0 + 2.2, z + range(rng, -2, 2), Y), personPad(b, cell.x1 - 2.2, z + range(rng, -2, 2), Y)];
      let done = false;
      infoSign(b, [{ text: 'TWO PADS', size: 50 }, { text: 'both must be stood on, at once', size: 30, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Stand in two places at once',
        detail: 'Both pads must be stood on at the same time. The pads ignore cubes.',
        hint: 'Stand on one pad and record your hologram (left click twice). It keeps standing there. Then walk to the other pad.',
        solved: () => done,
        update() {
          const on = pads.map((p) => !!ctx.standing?.(p.x, p.z, p.half, p.y));
          pads.forEach((p, i) => p.set(on[i] || done));
          if (!done && on.every(Boolean)) { done = true; b.ctx.sfx.play('unlock'); }
        },
        reserve: {},
        debug: { pads: pads.map((p) => ({ x: p.x, y: Y, z: p.z })) },
      };
    },
  },

  echo_door: {
    dims: (rng) => ({ w: range(rng, 10, 13), d: range(rng, 16, 19), h: range(rng, 5, 6) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0;
      const pad = personPad(b, range(rng, -3, 3), cell.zS - 3, Y);
      // An inner wall with a gate that's open only while the pad is held.
      const gz = cell.zN + 4;
      b.box(cell.x0, Y, gz - 0.2, -0.9, Y + cell.h, gz + 0.2, cell.mat.wall);
      b.box(0.9, Y, gz - 0.2, cell.x1, Y + cell.h, gz + 0.2, cell.mat.wall);
      b.box(-0.9, Y + 2.6, gz - 0.2, 0.9, Y + cell.h, gz + 0.2, cell.mat.wall);
      const gate = b.door(-0.85, Y, gz - 0.12, 0.85, Y + 2.6, gz + 0.12, [0, 2.7, 0], b.mat.darkMetal);
      let passed = false, held = false;
      infoSign(b, [{ text: 'THE GATE', size: 50 }, { text: 'open only while someone holds the pad', size: 28, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Hold the gate open',
        detail: 'The gate opens only while someone stands on the pad, and the pad is a long way from the gate.',
        hint: 'Record your hologram standing on the pad, then walk through the gate while it holds the pad for you.',
        solved: () => passed,
        update(dt, player) {
          held = !!ctx.standing?.(pad.x, pad.z, pad.half, pad.y);
          pad.set(held);
          gate.setOpen(held || passed);
          if (!passed && cell.contains(player.pos) && player.pos.z < gz - 0.5) passed = true;
        },
        reserve: {},
        debug: { pad: { x: pad.x, y: Y, z: pad.z }, gateZ: gz },
      };
    },
  },

  // ================================================================ Revealer Lantern
  hidden_bridge: {
    dims: (rng, d = 0) => {
      const a = range(rng, 3.5, 4.5), g = range(rng, 8, 10) + d * 5, far = range(rng, 5, 7);
      return { w: range(rng, 10, 13), d: a + g + far, h: range(rng, 5, 6), pit: { a, g } };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0;
      const pitS = cell.zS - dims.pit.a, pitN = pitS - dims.pit.g;
      pitWalls(b, cell, pitS, pitN);
      // A zigzag bridge of planks, invisible without the lantern.
      const path = [];
      let x = 0;
      const steps = Math.ceil((pitS - pitN) / 2.4);
      for (let i = 0; i < steps; i++) {
        const z1 = pitS - i * ((pitS - pitN) / steps), z0 = z1 - (pitS - pitN) / steps;
        const nx = THREE.MathUtils.clamp(x + pick(rng, [-1.6, 0, 1.6]), -cell.w / 2 + 1.5, cell.w / 2 - 1.5);
        hiddenBox(b, Math.min(x, nx) - 0.7, Y - 0.25, z0 - 0.05, Math.max(x, nx) + 0.7, Y, z1 + 0.05);
        path.push({ x: nx, z: (z0 + z1) / 2 });
        x = nx;
      }
      let passed = false;
      infoSign(b, [{ text: 'THERE IS A BRIDGE', size: 44 }, { text: 'you just cannot see it', size: 30, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Cross the hidden bridge',
        detail: 'There is a bridge over the chasm. It only exists in the lantern\'s light.',
        hint: 'Turn on the Revealer Lantern (left click) and keep it on. Follow the glowing planks. If it goes out, so does the bridge.',
        solved: () => passed,
        update(dt, player) { if (!passed && cell.contains(player.pos) && player.pos.z < pitN - 0.4 && player.onGround) passed = true; },
        reserve: { w: [[pitN, pitS]], e: [[pitN, pitS]] },
        debug: { bridge: [...path, { x: 0, z: pitN - 1.5 }], pitS },
      };
    },
  },

  hidden_stairs: {
    dims: (rng, d = 0) => {
      const L = r1(3.4 + d * 1.0);
      return { w: range(rng, 10, 13), d: range(rng, 15, 18), h: L + 4.2, exitY: L, L };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0, L = dims.L;
      const front = ledge(b, cell, 5, L);
      // Floating blocks, each a jump up from the last, only there in the light.
      const n = Math.ceil(L / 0.85);
      const blocks = [];
      let x = range(rng, -2, 2);
      for (let i = 0; i < n; i++) {
        const top = Y + (L * (i + 1)) / (n + 0.2);
        const z = front + 1.2 + (n - 1 - i) * 1.25;
        x = THREE.MathUtils.clamp(x + range(rng, -0.8, 0.8), -cell.w / 2 + 1.5, cell.w / 2 - 1.5);
        blocks.push(hiddenBox(b, x - 0.7, top - 0.3, z - 0.6, x + 0.7, top, z + 0.6));
      }
      let up = false;
      b.sign(signTexture([{ text: `LEDGE ${L} m`, size: 44 }, { text: 'the stairs are there. trust the light.', size: 26, color: '#9aa4ae' }], { w: 512, h: 160, bg: '#14171c', fg: '#ffcf9a' }),
        2.0, 0.62, 0, Y + L - 0.7, front + 0.02, 0);
      return {
        label: 'Climb the hidden stairs',
        detail: `The exit is ${L} m up. Floating steps lead there, visible only in the lantern's light.`,
        hint: 'Turn the Revealer Lantern on and jump from step to step. Keep the light on until you reach the ledge.',
        solved: () => up,
        update(dt, player) { if (onLedge(player, cell, front, Y + L)) up = true; },
        reserve: {},
        debug: { blocks, front, top: Y + L },
      };
    },
  },

  // ================================================================ Tether Glove
  throw_target: {
    dims: (rng) => ({ w: range(rng, 10, 13), d: range(rng, 14, 17), h: range(rng, 6, 7) }),
    build(cell, b, ctx, rng, info) {
      const Y = cell.y0, D = info.diff;
      const tx = range(rng, -cell.w / 2 + 2, -1.6), ty = Y + range(rng, 3.4, 4.4) + D * 0.6;
      const r = 0.75 - D * 0.2;
      const tex = signTexture([{ text: '◎', size: 200, color: '#ff5a4a' }], { w: 256, h: 256, bg: '#f4ead2' });
      const target = b.sign(tex, r * 2, r * 2, tx, ty, cell.zN + 0.03, 0, { glow: 1.1 });
      const cube = pedestalCube(b, cell, range(rng, 1, 3), cell.zS - 3, 0.5);
      let hit = false;
      infoSign(b, [{ text: 'HIT THE TARGET', size: 46 }, { text: 'throw something at it', size: 30, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Hit the target',
        detail: 'A target hangs high on the far wall. Throw a cube at it.',
        hint: 'With the Tether Glove, grab the cube (left click), aim a little above the target, and throw (left click again).',
        solved: () => hit,
        update() {
          if (hit) return;
          for (const c of b.cubes) {
            const p = c.mesh.position;
            if (Math.abs(p.z - cell.zN) < c.size / 2 + 0.25 && Math.hypot(p.x - tx, p.y - ty) < r + c.size / 2) {
              hit = true;
              target.material.color.set('#3dff7a').multiplyScalar(1.4);
              b.ctx.sfx.play('unlock');
            }
          }
        },
        reserve: {},
        debug: { cube, target: { x: tx, y: ty, z: cell.zN } },
      };
    },
  },

  tether_fetch: {
    dims: (rng, d = 0) => {
      const a = range(rng, 6, 7), g = range(rng, 6, 8) + d * 3, far = range(rng, 5, 6);
      return { w: range(rng, 10, 13), d: a + g + far, h: range(rng, 5, 6), pit: { a, g } };
    },
    build(cell, b, ctx, rng, info, dims) {
      const Y = cell.y0;
      const pitS = cell.zS - dims.pit.a, pitN = pitS - dims.pit.g;
      pitWalls(b, cell, pitS, pitN);
      // The exit is beyond the far side, behind a door the plate opens…
      // …and the only cube is over there too. Bring it here.
      const cube = pedestalCube(b, cell, range(rng, -2, 2), pitN - 2.2, 0.7, 1.0);
      const px = range(rng, -2.5, 2.5), pz = cell.zS - 3;
      const plate = b.plate({ cx: px, cz: pz, y: Y, size: 2.0, minSize: 0.6 });
      // A floating bridge extends once the plate is down.
      const bridge = b.box(-1.2, Y - 0.3, pitN, 1.2, Y, pitS, b.mat.metal, { tile: 2 });
      bridge.visible = false;
      bridge.userData.collider.enabled = false;
      let extended = false;
      infoSign(b, [{ text: 'FETCH', size: 54 }, { text: 'the cube is on the wrong side', size: 30, color: '#9aa4ae' }], 2.0, 1.0, 2.6, Y + 2.2, cell.zS - 0.03, Math.PI, b.theme.accent);
      return {
        label: 'Fetch the cube',
        detail: 'The plate that extends the bridge is on this side. The only cube is across the chasm.',
        hint: 'Aim the Tether Glove at the cube across the chasm and grab it (left click). Carry it here and drop it on the plate (right click).',
        solved: () => extended,
        update(dt, player) {
          if (!extended && plate.active) {
            extended = true;
            bridge.visible = true;
            bridge.userData.collider.enabled = true;
            b.ctx.sfx.play('door');
          }
        },
        reserve: { w: [[pitN, pitS]], e: [[pitN, pitS]] },
        debug: { cube, plate: { x: px, y: Y, z: pz }, pitN },
      };
    },
  },
};
