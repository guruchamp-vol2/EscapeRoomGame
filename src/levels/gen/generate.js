// Assembles a generated level from its plan: a start corridor, one cell per
// puzzle module (each with its own exit door), connecting corridors, and the
// final exit. Returns the same level interface the hand-made chambers use.
import * as THREE from 'three';
import { Cell, T } from './cell.js';
import { MODULE_IMPL as BASE } from './modules.js';
import { MODULE_IMPL_2 } from './modules2.js';
import { decorate, centerpiece } from './decor.js';

const MODULE_IMPL = { ...BASE, ...MODULE_IMPL_2 };
import { signTexture } from '../../textures.js';
import { makeRng, range } from '../../random.js';

export function buildGenerated(plan, b, ctx) {
  const rng = makeRng(plan.seed);
  const theme = b.theme;
  const m = b.mat;

  if (theme.sky) b.skyDome(theme.sky);
  if (theme.fogDensity) b.scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);

  // Start corridor.
  b.box(-1.6, -0.4, 0, 1.6, 0, 6.4, m.floor, { tile: 2 });
  b.box(-1.6, 0, 0, -1.2, 3.2, 6.4, m.wall);
  b.box(1.2, 0, 0, 1.6, 3.2, 6.4, m.wall);
  b.box(-1.6, 0, 6.0, 1.6, 3.2, 6.4, m.wall);
  b.box(-1.6, 3.2, 0, 1.6, 3.5, 6.4, m.ceiling);
  b.strip(-1.2, 0, 0, -1.17, 0.06, 6);
  b.strip(1.17, 0, 0, 1.2, 0.06, 6);
  const title = plan.number ? `LEVEL ${plan.number}` : 'DAILY';
  b.sign(signTexture([{ text: title, size: 44, color: theme.accent }, { text: plan.name.replace(/^Daily · /, ''), size: 60 }, { text: plan.worldName, size: 34, color: '#9aa4ae' }],
    { w: 640, h: 320, bg: '#0b0d10' }), 1.9, 0.95, -1.18, 1.8, 3.4, Math.PI / 2, { glow: 1.2 });
  const startLight = new THREE.PointLight(theme.lampColor, 8, 0, 2);
  startLight.position.set(0, 2.8, 3);
  b.scene.add(startLight);

  const cells = [];
  let z0 = -T, y0 = 0;
  plan.modules.forEach((id, slot) => {
    const impl = MODULE_IMPL[id];
    const dims = impl.dims(rng, plan.diff ?? 0);
    const floorGaps = dims.pit ? [[z0 - dims.pit.a - dims.pit.g, z0 - dims.pit.a]] : [];
    const cell = new Cell(b, {
      index: slot, count: plan.modules.length, z0, y0, w: dims.w, d: dims.d, h: dims.h,
      exitY: dims.exitY ?? 0, floorGaps, dark: !!dims.dark, ceiling: dims.ceiling,
      variant: theme.variant?.(slot), connector: range(rng, 3, 6),
    });
    const inst = impl.build(cell, b, ctx, rng, { slot, remoteX: 2000 + slot * 400, diff: plan.diff ?? 0, twists: plan.twists ?? [] }, dims);
    decorate(b, cell, rng, inst.reserve);
    centerpiece(b, cell, rng);
    cells.push({ id, cell, inst, done: false });
    const next = cell.connector();
    z0 = next.z;
    y0 = next.y;
  });

  // The Curator's Note hidden in the 13th level of each world: tucked against a
  // side wall of a random room, glowing faintly.
  if (plan.number && (plan.number - 5) % 25 === 12) {
    const world = plan.world;
    // Candidate spots: near a side wall in the south part of a room (ledges are
    // north), never over a pit, never on a wall a puzzle reserved, never in the
    // loop corridor (its side walls are the loop's ends).
    const spots = [];
    for (const { id, cell: c, inst } of cells) {
      if (id === 'loop_rooms') continue;
      for (const side of [-1, 1]) {
        const spans = inst.reserve?.[side < 0 ? 'w' : 'e'] ?? [];
        for (let z = c.zS - 1.2; z > c.zS - c.d * 0.4; z -= 0.8) {
          if (c.floorGaps?.some(([lo, hi]) => z > lo - 0.8 && z < hi + 0.8)) continue;
          if (spans.some(([lo, hi]) => z > Math.min(lo, hi) - 0.8 && z < Math.max(lo, hi) + 0.8)) continue;
          spots.push({ c, side, z });
        }
      }
    }
    const spot = spots[Math.floor(rng() * spots.length)];
    if (spot) {
      const { c, side, z } = spot;
      const x = side * (c.w / 2 - 0.45);
      const floorY = c.y0;
      b.pedestal(x, z, 0.4, floorY + 0.9, floorY);
      const collected = ctx.hasNote?.(world);
      const page = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.42), new THREE.MeshBasicMaterial({
        map: signTexture([{ text: 'NOTE', size: 60, color: '#4a3a20' }, { text: `#${world + 1}`, size: 50, color: '#4a3a20' }],
          { w: 256, h: 320, bg: '#f2e6c8' }),
        transparent: collected, opacity: collected ? 0.35 : 1,
      }));
      page.material.color.setScalar(collected ? 0.8 : 1.35);
      page.position.set(x, floorY + 1.15, z);
      page.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      page.rotation.x = -0.25;
      page.userData.interact = 'button';
      page.userData.label = collected ? "Re-read the curator's note" : "Read the curator's note";
      page.userData.press = () => ctx.onNote?.(world);
      b.scene.add(page);
      b.solids.push(page);
      const glow = new THREE.PointLight('#ffe9b0', collected ? 0 : 3, 4, 2);
      glow.position.set(x - side * 0.4, floorY + 1.4, z);
      b.scene.add(glow);
    }
  }

  // Final exit corridor.
  const zEnd = z0 + T; // start of the last connector's far end
  b.box(-1.6, y0 - 0.4, zEnd - 7, 1.6, y0, zEnd, m.floor, { tile: 2 });
  b.box(-1.6, y0, zEnd - 7, -1.2, y0 + 3.2, zEnd, m.wall);
  b.box(1.2, y0, zEnd - 7, 1.6, y0 + 3.2, zEnd, m.wall);
  b.box(-1.6, y0, zEnd - 7.4, 1.6, y0 + 3.2, zEnd - 7, m.wall);
  b.box(-1.6, y0 + 3.2, zEnd - 7, 1.6, y0 + 3.5, zEnd, m.ceiling);
  b.sign(signTexture([{ text: 'FREEDOM', size: 90 }], { bg: '#f4fff8', fg: '#1a6b3a' }), 1.6, 0.8, 0, y0 + 1.6, zEnd - 6.98, 0, { glow: 1.4 });
  const exitLight = new THREE.PointLight('#c8ffd8', 8, 0, 2);
  exitLight.position.set(0, y0 + 2.6, zEnd - 5);
  b.scene.add(exitLight);

  // Blackout twist: almost no light. The player gets a flashlight (F).
  const blackout = plan.twists?.includes('blackout');
  if (blackout) {
    b.hemi.intensity *= 0.08;
    b.scene.environmentIntensity = 0.02;
    b.scene.traverse((o) => { if (o.isLight && o !== b.hemi) o.intensity *= 0.1; });
    b.mat.light.color.multiplyScalar(0.04); // ceiling panels go dark too
  }

  let checkpoint = null;
  const spawn = { pos: new THREE.Vector3(0, 0, 4.6), yaw: 0 };

  return {
    spawn,
    hasGun: plan.gun,
    flashlight: blackout,
    inventory: () => cells.flatMap((c) => c.inst.inventory?.() ?? []),
    steps: [
      ...cells.map(({ inst }) => ({ label: inst.label, detail: inst.detail, hint: inst.hint })),
      { label: 'Exit', detail: 'The way out is open.', hint: 'Walk through the last door and down the corridor.' },
    ],
    stage() {
      let i = 0;
      while (i < cells.length && cells[i].done) i++;
      return i;
    },
    exit: {
      min: new THREE.Vector3(-1.2, y0 - 0.5, zEnd - 7),
      max: new THREE.Vector3(1.2, y0 + 3.2, zEnd - 4.5),
    },
    update(dt, player) {
      for (const c of cells) {
        c.inst.update?.(dt, player);
        if (!c.done && c.inst.solved()) c.done = true;
        c.cell.door.setOpen(c.inst.doorOpen ? c.inst.doorOpen() : c.done);
        if (c.cell.contains(player.pos) && player.onGround) checkpoint = c.cell;
      }
    },
    respawn() {
      if (!checkpoint) return spawn;
      cells.find((c) => c.cell === checkpoint)?.inst.reset?.();
      return { pos: new THREE.Vector3(0, checkpoint.y0, checkpoint.zS - 1.2), yaw: 0 };
    },
    fellOut(player) {
      return player.pos.y < (checkpoint ? checkpoint.y0 : 0) - 8 && player.pos.x < 1000;
    },
    onTeleport(portal) {
      for (const c of cells) c.inst.onTeleport?.(portal);
    },
    debug: {
      // Copy descriptors, not values, so live getters (e.g. the loop's room) stay live.
      cells: cells.map((entry) => Object.defineProperties({
        id: entry.id, x0: entry.cell.x0, x1: entry.cell.x1, zS: entry.cell.zS, zN: entry.cell.zN,
        y0: entry.cell.y0, exitY: entry.cell.exitY,
        get done() { return entry.done; },
      }, Object.getOwnPropertyDescriptors(entry.inst.debug))),
      exitZ: zEnd - 5.5,
    },
  };
}
