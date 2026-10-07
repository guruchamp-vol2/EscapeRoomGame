// The boss arena: the final room of every boss level (every 50 levels).
// A giant construct guards its core behind a shield. Each phase is a station
// somewhere in the arena that breaks the shield with a mechanic the chapter
// taught; three or four phases and the boss falls. Meanwhile it attacks:
// a low laser sweeping the arena or shockwave rings, both jumpable. A hit
// knocks you back to the entrance. Nothing kills you. (BOSSES in storyline.js.)
import * as THREE from 'three';
import { signTexture } from '../../textures.js';
import { makeCollider } from '../../physics.js';
import { pedestalCube } from './modules.js';
import { BOSSES } from './storyline.js';

const glowMat = (hex, k = 1.8) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });

export const BOSS_ARENA = {
  boss_arena: {
    dims: () => ({ w: 20, d: 26, h: 10 }),
    build(cell, b, ctx, rng, info) {
      const chapter = info.boss?.chapter ?? 1;
      const def = BOSSES[chapter];
      const Y = cell.y0;
      const bz = cell.zN + 8;
      const col = def.color;

      // ---------------------------------------------------------------- the boss
      const body = new THREE.Group();
      body.position.set(0, Y, bz);
      b.scene.add(body);
      const hull = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.35), metalness: 0.7, roughness: 0.35 });
      const trim = glowMat(col, 1.6);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 1.6, 24), hull);
      base.position.y = 0.8;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.8, 3.4, 12), hull);
      tower.position.y = 3.3;
      const rings = [];
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(2.0 + i * 0.5, 0.07, 8, 48), trim);
        r.position.y = 4.4 + i * 0.5;
        r.rotation.x = Math.PI / 2;
        body.add(r);
        rings.push(r);
      }
      const coreMat = glowMat(col, 2.6);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), coreMat);
      core.position.y = 5.8;
      const shieldMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(0.8), transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
      const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), shieldMat);
      shield.position.y = 5.8;
      body.add(base, tower, core, shield);
      b.colliders.push(makeCollider(new THREE.Vector3(-2.2, Y, bz - 2.2), new THREE.Vector3(2.2, Y + 5, bz + 2.2)));
      const bossLight = new THREE.PointLight(col, 12, 18, 2);
      bossLight.position.set(0, Y + 6, bz);
      b.scene.add(bossLight);
      b.sign(signTexture([{ text: def.name, size: 64, color: col }], { w: 640, h: 120, bg: '#0b0d10', border: col }), 4, 0.75, 0, Y + 8.6, bz + 0.5, 0, { glow: 1.3 });

      // ---------------------------------------------------------------- stations
      const stations = [];
      const station = (type) => {
        const s = { type, active: false, done: false, debug: {} };
        stations.push(s);
        return s;
      };
      const marker = (x, z) => {
        // A pillar of light over the active station.
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 9, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.2), transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
        m.position.set(x, Y + 4.5, z);
        m.visible = false;
        b.scene.add(m);
        return m;
      };
      const wallButton = (s, x, z, rotY, label, onPress) => {
        const sw = b.wallSwitch({ x, y: Y + 1.3, z, rotY, color: col, label, onPress: () => { if (s.active && !s.done) onPress(sw); } });
        return { x, y: Y + 1.3, z, sw };
      };
      const floorButton = (s, x, y, z, label, onPress) => {
        b.button({ x, y, z, color: col, label, pedestal: true, onPress: () => { if (s.active && !s.done) onPress(); } });
        return { x, y: y + 1.0, z };
      };
      // Every station type has its own spot, so no two ever overlap.
      const build = {
        switches(s, ordered = false) {
          const spots = [[cell.x0 + 0.06, bz + 3, Math.PI / 2], [cell.x1 - 0.06, bz + 1, -Math.PI / 2], [cell.x0 + 0.06, cell.zS - 6, Math.PI / 2]];
          let next = 0;
          const pressed = new Set();
          s.debug.buttons = spots.map(([x, z, rot], i) => {
            const btn = wallButton(s, x, z, rot, ordered ? `Switch ${i + 1}` : 'Hit the switch', (sw) => {
              if (ordered && i !== next) { next = 0; pressed.clear(); b.ctx.sfx.play('error'); s.lit.forEach((m) => m.color.set('#30343a')); return; }
              s.lit[i].color.set('#3dff7a').multiplyScalar(1.6);
              b.ctx.sfx.play('beep');
              next++;
              pressed.add(i);
              if (pressed.size >= spots.length) s.finish();
            });
            if (ordered) b.sign(signTexture([{ text: String(i + 1), size: 110 }], { w: 128, h: 128, bg: '#0b0d10', fg: col }), 0.35, 0.35, x + Math.sign(-x) * 0.02, Y + 1.95, z, rot, { glow: 1.2 });
            return { x: btn.x, y: btn.y, z: btn.z, side: x < 0 ? 1 : -1 };
          });
          s.lit = spots.map(([x, z]) => {
            const m = new THREE.MeshBasicMaterial({ color: '#30343a' });
            b.box(x - 0.08, Y + 2.3, z - 0.15, x + 0.08, Y + 2.5, z + 0.15, m, { collide: false, solid: false, tile: 0 });
            return m;
          });
          s.markers = spots.map(([x, z]) => marker(x + Math.sign(-x) * 1.2, z));
        },
        order(s) { this.switches(s, true); },
        plate(s) {
          const x = 5, z = cell.zS - 8;
          const plate = b.plate({ cx: x, cz: z, y: Y, minSize: 1.6, onActivate: () => s.active && s.finish() });
          const cube = pedestalCube(b, cell, x * 0.4, cell.zS - 3.2, 0.35);
          s.check = () => { if (plate.active && !s.done) s.finish(); };
          s.debug = { cube, plate: { x, z, y: Y + 0.06, half: 1.2, min: 1.6 } };
          s.markers = [marker(x, z)];
        },
        beam(s) {
          const zA = bz + 6, xm = -5.5;
          b.box(cell.x0, Y + 0.8, zA - 0.25, cell.x0 + 0.4, Y + 1.4, zA + 0.25, b.mat.darkMetal, { tile: 0 });
          const mirrors = [{ x: xm, z: zA, state: '\\' }, { x: xm, z: bz, state: rng() < 0.5 ? '\\' : '/' }];
          const beamMat = glowMat('#ff3b30', 2.4);
          const group = new THREE.Group();
          b.scene.add(group);
          const seg = (x0, z0, x1, z1) => {
            const len = Math.hypot(x1 - x0, z1 - z0);
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), beamMat);
            m.position.set((x0 + x1) / 2, Y + 1.1, (z0 + z1) / 2);
            m.rotation.y = Math.atan2(x1 - x0, z1 - z0);
            group.add(m);
          };
          const trace = () => {
            group.clear();
            seg(cell.x0 + 0.4, zA, xm, zA);
            if (mirrors[0].state !== '/') return seg(xm, zA, xm, cell.zS); // goes south, into the wall
            seg(xm, zA, xm, bz);
            if (mirrors[1].state !== '/') return seg(xm, bz, cell.x0, bz); // goes west
            seg(xm, bz, -2.3, bz);
            if (s.active && !s.done) s.finish();
          };
          s.debug.mirrors = mirrors.map((m) => {
            b.pedestal(m.x, m.z, 0.5, Y + 0.8, Y);
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: '#dfe8f0', metalness: 1, roughness: 0.05 }));
            plate.position.set(m.x, Y + 1.1, m.z);
            plate.rotation.y = m.state === '/' ? Math.PI / 4 : -Math.PI / 4;
            plate.userData.interact = 'button';
            plate.userData.label = 'Turn the mirror';
            plate.userData.press = () => {
              if (!s.active || s.done) return;
              m.state = m.state === '/' ? '\\' : '/';
              plate.rotation.y = m.state === '/' ? Math.PI / 4 : -Math.PI / 4;
              b.ctx.sfx.play('beep');
              trace();
            };
            b.scene.add(plate);
            b.solids.push(plate);
            return { x: m.x, y: Y + 1.1, z: m.z, get need() { return m.state !== '/'; } };
          });
          s.onActive = trace;
          trace();
          s.markers = [marker(xm, (zA + bz) / 2)];
        },
        grapple(s) {
          const px = 7, pz = bz + 3, top = Y + 6;
          b.box(px - 1.4, top - 0.4, pz - 1.4, px + 1.4, top, pz + 1.4, b.mat.metal, { tile: 0 });
          const btn = floorButton(s, px, top, pz, 'Overload the core', () => s.finish());
          const add = (x, y, z) => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 10, 28), new THREE.MeshStandardMaterial({ color: '#c9a043', metalness: 0.9, emissive: '#6b4a10', emissiveIntensity: 0.6 }));
            ring.position.set(x, y, z);
            const hit = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
            hit.position.copy(ring.position);
            hit.userData.ring = ring.position.clone();
            b.scene.add(ring, hit);
            (b.hooks ??= []).push(hit);
            return { x, y, z };
          };
          // The first ring is high enough that the swing to the second clears the platform.
          s.debug = { rings: [add(4, Y + 6.8, pz + 4.5), add(px, top + 2.8, pz)], button: btn };
          s.markers = [marker(px, pz)];
        },
        blink(s) {
          const x = -5.5, z = cell.zS - 8;
          for (const [x0, z0, x1, z1] of [[x - 2, z - 2, x + 2, z - 1.9], [x - 2, z + 1.9, x + 2, z + 2], [x - 2, z - 2, x - 1.9, z + 2], [x + 1.9, z - 2, x + 2, z + 2]]) {
            b.box(x0, Y, z0, x1, Y + cell.h, z1, b.mat.glass, { tile: 0, gun: false, solid: false });
          }
          const btn = floorButton(s, x, Y, z, 'Overload the core', () => s.finish());
          s.debug = { target: { x: x + 1.0, y: Y, z: z + 1.0 }, button: btn, outside: { x: x + Math.sign(-x) * 4, y: Y, z: z } };
          s.markers = [marker(x, z)];
        },
        tether(s) {
          const tx = -6.5, ty = Y + 4.5;
          const tex = signTexture([{ text: '◎', size: 200, color: col }], { w: 256, h: 256, bg: '#0b0d10' });
          b.sign(tex, 1.4, 1.4, tx, ty, cell.zN + 0.03, 0, { glow: 1.3 });
          const cube = pedestalCube(b, cell, -3, cell.zS - 4, 0.5);
          s.check = () => {
            for (const c of b.cubes) {
              const p = c.mesh.position;
              if (Math.abs(p.z - cell.zN) < c.size / 2 + 0.3 && Math.hypot(p.x - tx, p.y - ty) < 0.7 + c.size / 2) s.finish();
            }
          };
          s.debug = { cube, target: { x: tx, y: ty, z: cell.zN } };
          s.markers = [marker(tx, cell.zN + 1)];
        },
        gel(s) {
          const px = -7, pz = bz + 3, top = Y + 3.3;
          b.box(px - 1.6, Y, pz - 1.6, px + 1.6, top, pz + 1.6, b.mat.metal, { tile: 0 });
          const btn = floorButton(s, px, top, pz, 'Overload the core', () => s.finish());
          const tiles = b.box(px - 1.6, Y - 0.05, pz + 2.6, px + 1.6, Y + 0.005, pz + 6, new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.6 }), { tile: 1 });
          tiles.userData.paintable = true;
          s.debug = { spot: { x: px, y: Y, z: pz + 3.4 }, button: btn, top };
          s.markers = [marker(px, pz)];
        },
        echo(s) {
          const pads = [[-3.5, cell.zS - 6], [3.5, cell.zS - 6]].map(([x, z]) => {
            b.box(x - 0.9, Y, z - 0.9, x + 0.9, Y + 0.05, z + 0.9, b.mat.metal, { tile: 0 });
            const ring = glowMat('#ff4b4b', 1.5);
            b.strip(x - 0.8, Y + 0.05, z - 0.8, x + 0.8, Y + 0.055, z + 0.8, ring);
            return { x, z, ring };
          });
          s.check = () => {
            const on = pads.map((p) => !!ctx.standing?.(p.x, p.z, 0.9, Y + 0.05));
            pads.forEach((p, i) => p.ring.color.set(on[i] ? '#3dff7a' : '#ff4b4b').multiplyScalar(1.5));
            if (on.every(Boolean)) s.finish();
          };
          s.debug = { pads: pads.map((p) => ({ x: p.x, y: Y, z: p.z })) };
          s.markers = pads.map((p) => marker(p.x, p.z));
        },
        chrono(s) {
          // Blades spin around the boss's base, guarding a switch on it.
          const arms = [];
          for (let i = 0; i < 2; i++) {
            const arm = new THREE.Group();
            arm.position.set(0, Y + 0.7, bz);
            const blade = new THREE.Mesh(new THREE.BoxGeometry(9, 0.14, 0.1), glowMat('#ff3b30', 2));
            arm.add(blade);
            arm.rotation.y = i * Math.PI / 2;
            b.scene.add(arm);
            arms.push(arm);
          }
          s.blades = arms;
          const btn = { x: 0, y: Y + 1.3, z: bz + 2.25 };
          const sw = b.wallSwitch({ x: btn.x, y: btn.y, z: btn.z, rotY: 0, color: col, label: 'Overload the core', onPress: () => { if (s.active && !s.done) s.finish(); } });
          s.debug = { button: btn, sw };
          s.markers = [marker(0, bz + 3)];
        },
        lantern(s) {
          const px = -7, pz = cell.zS - 10, top = Y + 3.6;
          b.box(px - 1.4, top - 0.4, pz - 1.4, px + 1.4, top, pz + 1.4, b.mat.metal, { tile: 0 });
          const btn = floorButton(s, px, top, pz, 'Overload the core', () => s.finish());
          const blocks = [];
          for (let i = 0; i < 4; i++) {
            const t = Y + (top - Y) * ((i + 1) / 4.6);
            const z = pz + 1.4 + (4 - i) * 1.25, x = px + 0.4;
            const mat = new THREE.MeshStandardMaterial({ color: '#ffe9a0', emissive: '#806a30', emissiveIntensity: 0.5, transparent: true, opacity: 0.05, depthWrite: false });
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.2), mat);
            mesh.position.set(x, t - 0.15, z);
            b.scene.add(mesh);
            const collider = makeCollider(new THREE.Vector3(x - 0.7, t - 0.3, z - 0.6), new THREE.Vector3(x + 0.7, t, z + 0.6));
            collider.enabled = false;
            b.colliders.push(collider);
            (b.hidden ??= []).push({ mesh, collider, vis: 0 });
            blocks.push({ x, y: t, z });
          }
          s.debug = { blocks, button: btn, top, pz };
          s.markers = [marker(px, pz)];
        },
      };
      for (const type of def.phases) {
        const s = station(type);
        build[type](s);
      }

      // ---------------------------------------------------------------- the fight
      const max = stations.length;
      let hp = max, phase = -1, defeated = false, calm = false, stagger = 0, sink = 0;
      const say = (text) => ctx.bossHud?.({ name: def.name, hp, max, line: text, color: col });
      stations.forEach((s, i) => {
        s.finish = () => {
          if (s.done) return;
          s.done = true;
          hp--;
          stagger = 1.6;
          b.ctx.sfx.play('achievement');
          ctx.shake?.(0.35);
          say(def.lines.hit[i] ?? def.lines.hit.at(-1));
          if (hp <= 0) {
            defeated = true;
            say(def.lines.end);
            b.ctx.sfx.play('win');
          } else {
            pendingNext = { at: 1.8, i: i + 1 };
          }
        };
      });
      let pendingNext = null;
      const activate = (i) => {
        if (phase >= i || i >= stations.length) return;
        phase = i;
        pendingNext = null;
        stations.forEach((s, k) => { s.active = k === i; for (const m of s.markers ?? []) m.visible = k === i; });
        stations[i].onActive?.();
        ctx.wrenText?.(PHASE_HINTS[stations[i].type], 'worried', 2);
      };
      let started = false;

      // Attacks: a low laser sweeping the arena, and shockwave rings.
      const sweep = new THREE.Group();
      sweep.position.set(0, Y + 0.35, bz);
      const sweepBar = new THREE.Mesh(new THREE.BoxGeometry(24, 0.1, 0.1), glowMat('#ff2b2b', 2.4));
      sweepBar.position.x = 12;
      sweep.add(sweepBar);
      sweep.visible = false;
      b.scene.add(sweep);
      const wave = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 64), glowMat(col, 2));
      wave.rotation.x = Math.PI / 2;
      wave.position.set(0, Y + 0.25, bz);
      wave.visible = false;
      b.scene.add(wave);
      let sweepA = 0, waveR = 0, waveT = 3, grace = 0;
      const useSweep = def.attack === 'sweep' || def.attack === 'both';
      const useWave = def.attack === 'wave' || def.attack === 'both';
      const knockBack = (player) => {
        player.pos.set(0, Y, cell.zS - 1.5);
        player.vel.set(0, 0, 0);
        grace = 2;
        b.ctx.sfx.play('thud');
        ctx.shake?.(0.4);
        ctx.onKnockback?.();
      };

      return {
        chrono: true, // the Chrono Watch freezes the whole fight
        label: `Defeat ${def.name}`,
        detail: 'Break its shield, station by station. Jump its attacks.',
        hint: 'Look for the pillar of light: that station breaks the shield. Jump over the red laser and the rings.',
        solved: () => defeated && sink > 0.5,
        update(dt, player, realDt = dt) {
          const p = player.pos;
          const inside = cell.contains(p);
          if (!started && inside && p.z < cell.zS - 1.5) {
            started = true;
            say(def.lines.start);
            activate(0);
          }
          if (!started) return;
          // The fight's pacing runs on real time (the Chrono Watch only freezes the boss).
          if (pendingNext) { pendingNext.at -= realDt; if (pendingNext.at <= 0) activate(pendingNext.i); }
          // Boss animation (frozen by the Chrono Watch like everything else here).
          for (const [i, r] of rings.entries()) r.rotation.z += dt * (0.6 + i * 0.3) * (i % 2 ? -1 : 1);
          core.scale.setScalar(1 + Math.sin(performance.now() / 200) * 0.06 * (dt > 0 ? 1 : 0));
          stagger = Math.max(0, stagger - realDt);
          shield.visible = !defeated && stagger === 0;
          coreMat.color.set(stagger > 0 ? '#ff3b30' : col).multiplyScalar(2.6);
          if (defeated) {
            sink = Math.min(1, sink + realDt * 0.4);
            body.position.y = Y - sink * 4;
            bossLight.intensity = 12 * (1 - sink);
            sweep.visible = wave.visible = false;
            return;
          }
          for (const s of stations) if (s.active && !s.done) s.check?.();
          // Chrono station: blades guard the switch until time stops.
          for (const s of stations) {
            if (!s.blades) continue;
            for (const arm of s.blades) { arm.rotation.y += dt * 3.2; arm.visible = s.active && !s.done; }
            if (s.active && !s.done && dt > 0 && inside && p.y < Y + 0.85 && Math.hypot(p.x, p.z - bz) < 4.6 && Math.hypot(p.x, p.z - bz) > 2.0) {
              const ang = Math.atan2(-(p.z - bz), p.x);
              for (const arm of s.blades) {
                const d = Math.abs(Math.sin(ang - arm.rotation.y));
                if (d * Math.hypot(p.x, p.z - bz) < 0.4) { knockBack(player); break; }
              }
            }
          }
          if (calm || chapter === 9) return;
          grace = Math.max(0, grace - dt);
          if (useSweep) {
            sweep.visible = true;
            sweepA += dt * (0.8 + chapter * 0.04);
            sweep.rotation.y = sweepA;
            if (grace === 0 && inside && p.y < Y + 0.55) {
              const dx = p.x, dz = p.z - bz;
              const along = dx * Math.cos(sweepA) - dz * Math.sin(sweepA);
              const across = dx * Math.sin(sweepA) + dz * Math.cos(sweepA);
              if (along > 0 && along < 24 && Math.abs(across) < 0.35) knockBack(player);
            }
          }
          if (useWave) {
            waveT -= dt;
            if (waveT <= 0 && !wave.visible) { wave.visible = true; waveR = 2.4; b.ctx.sfx.play('door'); }
            if (wave.visible) {
              waveR += dt * 6.5;
              wave.scale.setScalar(waveR);
              const r = Math.hypot(p.x, p.z - bz);
              if (grace === 0 && inside && p.y < Y + 0.5 && Math.abs(r - waveR) < 0.4) knockBack(player);
              if (waveR > 16) { wave.visible = false; waveT = 6.5 - chapter * 0.25; }
            }
          }
        },
        reserve: { w: [[cell.zN, cell.zS]], e: [[cell.zN, cell.zS]] },
        debug: {
          name: def.name,
          phases: stations.map((s) => ({ type: s.type, ...s.debug, get done() { return s.done; }, get active() { return s.active; } })),
          set calm(v) { calm = v; },
          get hp() { return hp; },
          get defeated() { return defeated; },
          entry: { x: 0, z: cell.zS - 3 },
          bz,
        },
      };
    },
  },
};

const PHASE_HINTS = {
  switches: 'Three switches on the walls. Hit them all!',
  order: 'Numbered switches. In order! One, two, three!',
  plate: 'That plate by the pillar of light. Grow a cube onto it!',
  beam: 'The mirrors! Turn them so the beam hits its base!',
  grapple: 'The high platform: grapple up the rings and hit the switch!',
  blink: 'The switch is in a glass cage. Beacon in, blink, press!',
  tether: 'The target on the far wall. Tether the cube and throw it!',
  gel: 'Bounce gel on the white tiles, up onto the platform!',
  echo: 'Two pads. You and your hologram, one each!',
  chrono: 'Freeze the blades round its base, then hit the switch!',
  lantern: 'Hidden steps up to that platform. Lantern on!',
};

