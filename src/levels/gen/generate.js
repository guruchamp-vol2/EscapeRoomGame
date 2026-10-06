// Assembles a generated level from its plan: a start corridor, one cell per
// puzzle module (each with its own exit door), connecting corridors, and the
// final exit. Returns the same level interface the hand-made chambers use.
import * as THREE from 'three';
import { Cell, T } from './cell.js';
import { MODULE_IMPL as BASE } from './modules.js';
import { MODULE_IMPL_2 } from './modules2.js';
import { ESCAPE_ROOM } from './modules3.js';
import { decorate, centerpiece } from './decor.js';
import { buildConnector, buildStart, buildExit, buildVista, dressRoom, roomStyle, CONNECTORS, STARTS, EXITS } from './spaces.js';
import { signTexture } from '../../textures.js';
import { makeRng, range, pick } from '../../random.js';
import { computeDifficultyParams } from './difficulty.js';
import { TensionManager } from './tension.js';
import { PayoffManager } from './payoffs.js';

const MODULE_IMPL = { ...BASE, ...MODULE_IMPL_2, ...ESCAPE_ROOM };

// Weighted connector choice; never the same kind twice in a row.
const CONNECTOR_WEIGHTS = { hall: 3, stairs: 2, bridge: 2, chicane: 1.6, gallery: 1.6 };
function pickConnector(rng, prev, canClimb) {
  const kinds = CONNECTORS.filter((k) => k !== prev && (canClimb || k !== 'stairs'));
  const total = kinds.reduce((t, k) => t + CONNECTOR_WEIGHTS[k], 0);
  let r = rng() * total;
  for (const k of kinds) if ((r -= CONNECTOR_WEIGHTS[k]) <= 0) return k;
  return kinds[0];
}

export function buildGenerated(plan, b, ctx) {
  const rng = makeRng(plan.seed);
  const theme = b.theme;
  const difficultyMode = ctx.difficultyMode || 'NORMAL';
  const diffParams = computeDifficultyParams(plan.diff ?? 0, difficultyMode);
  const levelState = {
    difficulty: plan.diff ?? 0,
    difficultyMode,
    diffParams,
    multiRoomItems: new Map(),
    tensionLevel: 0,
    tensionManager: null,
    payoffManager: null,
    solvedIndexes: new Set(),
  };
  levelState.tensionManager = new TensionManager(b, ctx, levelState);
  levelState.payoffManager = new PayoffManager(b, ctx, levelState);

  if (theme.sky) b.skyDome(theme.sky);
  if (theme.fogDensity) b.scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);

  // Layout choices come from their own stream so they don't disturb the
  // puzzle modules' random numbers.
  const layout = makeRng(`layout:${plan.seed}`);
  const startKind = pick(layout, STARTS);
  buildStart(b, plan, layout, startKind);

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
    dressRoom(b, cell, roomStyle(makeRng(`style:${plan.seed}:${slot}`), cell.hasCeiling, id === 'escape_room'));
    const inst = impl.build(cell, b, ctx, rng, {
      slot,
      remoteX: 2000 + slot * 400,
      diff: plan.diff ?? 0,
      difficultyMode,
      diffParams,
      levelState,
      twists: plan.twists ?? [],
    }, dims);
    decorate(b, cell, rng, inst.reserve);
    centerpiece(b, cell, rng);
    const kind = pickConnector(layout, cells.at(-1)?.connector, dims.exitY == null || dims.exitY === 0);
    const next = buildConnector(b, cell, layout, kind);
    cells.push({ id, cell, inst, done: false, connector: kind, path: next.path });
    z0 = next.z;
    y0 = next.y;
  });

  // The Curator's Note hidden in the 13th level of each world: tucked against a
  // side wall of a random room, glowing faintly.
  if (plan.number && (plan.number - 5) % 25 === 12) {
    const world = plan.world;
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

  // Final exit.
  const zEnd = z0 + T;
  const exitKind = pick(layout, EXITS);
  buildExit(b, y0, zEnd, layout, exitKind);
  buildVista(b, layout, { zMin: zEnd - 10, zMax: 8 });

  const blackout = plan.twists?.includes('blackout');
  if (blackout) {
    b.hemi.intensity *= 0.08;
    b.scene.environmentIntensity = 0.02;
    b.scene.traverse((o) => { if (o.isLight && o !== b.hemi) o.intensity *= 0.1; });
    b.mat.light.color.multiplyScalar(0.04);
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
      levelState.tensionLevel = Math.min(1, (cells.filter((c) => c.done).length / Math.max(1, cells.length)) * 1.2);
      levelState.tensionManager?.update(dt, player);

      for (const c of cells) {
        c.inst.update?.(dt, player);
        if (!c.done && c.inst.solved()) {
          c.done = true;
          levelState.solvedIndexes.add(c.cell.index);
          levelState.payoffManager?.triggerRoomSolved({
            roomIndex: c.cell.index,
            roomLabel: c.inst.label,
            cell: c.cell,
          });
        }
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
      cells: cells.map((entry) => Object.defineProperties({
        id: entry.id, x0: entry.cell.x0, x1: entry.cell.x1, zS: entry.cell.zS, zN: entry.cell.zN,
        y0: entry.cell.y0, exitY: entry.cell.exitY, path: entry.path, connector: entry.connector,
        get done() { return entry.done; },
      }, Object.getOwnPropertyDescriptors(entry.inst.debug))),
      exitZ: zEnd - 5.5,
      layout: { start: startKind, exit: exitKind, connectors: cells.map((c) => c.connector) },
      difficulty: { mode: difficultyMode, diff: plan.diff ?? 0, params: diffParams },
    },
  };
}






















































































































































































































































































































































































































































































































































