// Assembles a generated level from its plan: a start corridor, one cell per
// puzzle module (each with its own exit door), connecting corridors, and the
// final exit. Returns the same level interface the hand-made chambers use.
import * as THREE from 'three';
import { Cell, T } from './cell.js';
import { MODULE_IMPL as BASE } from './modules.js';
import { MODULE_IMPL_2 } from './modules2.js';
import { ESCAPE_ROOM } from './modules3.js';
import { MODULE_IMPL_4 } from './modules4.js';
import { decorate, centerpiece } from './decor.js';
import { buildConnector, buildStart, buildExit, buildVista, dressRoom, roomStyle, roomBanner, CONNECTORS, STARTS, EXITS } from './spaces.js';
import { MODULES } from './plan.js';
import { signTexture } from '../../textures.js';
import { makeRng, range, pick } from '../../random.js';
import { computeDifficultyParams } from './difficulty.js';
import { TensionManager } from './tension.js';
import { PayoffManager } from './payoffs.js';
import { chapterArt, createAnomalies } from './anomalies.js';

const MODULE_IMPL = { ...BASE, ...MODULE_IMPL_2, ...ESCAPE_ROOM, ...MODULE_IMPL_4 };

// Room rules: how each one looks (applied once) and feels (while you're inside).
const RULE_LOOK = {
  low_gravity: { tint: '#9fd8ff', banner: 'LOW GRAVITY' },
  ice: { tint: '#d8f4ff', banner: 'ICE' },
  fog: { tint: '#c8ccd4', banner: 'FOG' },
  strobe: { tint: '#ffffff', banner: 'STROBE' },
  mirrored: { tint: '#ffb8f0', banner: 'MIRROR ROOM' },
};

// Weighted connector choice; never the same kind twice in a row. A world's
// preferred passages (worlds.js rhythm) are three times as likely.
const CONNECTOR_WEIGHTS = { hall: 3, stairs: 2, bridge: 2, chicane: 1.6, gallery: 1.6 };
function pickConnector(rng, prev, canClimb, prefer = []) {
  const kinds = CONNECTORS.filter((k) => k !== prev && (canClimb || k !== 'stairs'));
  const w = (k) => CONNECTOR_WEIGHTS[k] * (prefer.includes(k) ? 3 : 1);
  const total = kinds.reduce((t, k) => t + w(k), 0);
  let r = rng() * total;
  for (const k of kinds) if ((r -= w(k)) <= 0) return k;
  return kinds[0];
}

// The z-spans of a cell's floor, around any pits.
function floorSpans(cell) {
  const spans = [];
  let top = cell.zS;
  for (const [lo, hi] of [...(cell.floorGaps ?? [])].sort((a, c) => c[1] - a[1])) {
    if (hi < top) spans.push([hi, top]);
    top = lo;
  }
  if (top > cell.zN) spans.push([cell.zN, top]);
  return spans;
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
  const rhythm = theme.world?.rhythm ?? {};
  // Bosses arrive through a grand lobby and leave through a portal ring; other
  // levels usually arrive the way their world likes to.
  const startKind = plan.boss ? 'lobby' : rhythm.starts && layout() < 0.7 ? pick(layout, rhythm.starts) : pick(layout, STARTS);
  buildStart(b, plan, layout, startKind);

  // Story pulse: the museum's mood within the chapter.
  if (plan.pulse === 'pressure' || plan.boss) {
    if (b.scene.fog?.density) b.scene.fog.density *= 1.3;
    b.hemi.intensity *= plan.boss ? 0.75 : 0.88;
  }

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
    const style = roomStyle(makeRng(`style:${plan.seed}:${slot}`), cell.hasCeiling, id === 'escape_room',
      { prefer: rhythm.rigs ?? [], avoid: cells.at(-1)?.rig ?? null });
    dressRoom(b, cell, style);
    chapterArt(b, cell, theme.chapterArt?.motif, makeRng(`art:${plan.seed}:${slot}`));
    if (id === plan.featured) {
      roomBanner(b, cell, [{ text: 'FEATURED', size: 40, color: theme.accent }, { text: (MODULES[id]?.name ?? id).toUpperCase(), size: 58 }], theme.accent);
    } else if (plan.boss && slot === 0) {
      roomBanner(b, cell, [{ text: `CHAPTER ${plan.boss.chapter}`, size: 40, color: '#ffcf6b' }, { text: plan.boss.name.toUpperCase(), size: 58 }], '#ffcf6b');
    }
    const inst = impl.build(cell, b, ctx, rng, {
      slot,
      remoteX: 2000 + slot * 400,
      diff: plan.diff ?? 0,
      difficultyMode,
      diffParams,
      levelState,
      twists: plan.twists ?? [],
      // Boss levels hide the chapter's story in their escape room.
      // (the text honours the player's choice at level 200, via ctx.storyFor)
      story: plan.boss && id === 'escape_room' ? { title: `Chapter ${plan.boss.chapter}: ${plan.boss.name}`, text: ctx.storyFor?.(plan.boss.chapter)?.narrative ?? plan.boss.narrative } : null,
    }, dims);
    decorate(b, cell, rng, inst.reserve);
    centerpiece(b, cell, rng);
    const kind = pickConnector(layout, cells.at(-1)?.connector, dims.exitY == null || dims.exitY === 0, rhythm.connectors ?? []);
    const next = buildConnector(b, cell, layout, kind);
    const rule = plan.rules?.find((r) => r.room === slot)?.rule ?? null;
    cells.push({ id, cell, inst, done: false, connector: kind, path: next.path, rig: style.rig, rule });
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
  const exitKind = plan.boss ? 'portal' : pick(layout, EXITS);
  buildExit(b, y0, zEnd, layout, exitKind);
  buildVista(b, layout, { zMin: zEnd - 10, zMax: 8 });

  const blackout = plan.twists?.includes('blackout');
  if (blackout) {
    b.hemi.intensity *= 0.08;
    b.scene.environmentIntensity = 0.02;
    b.scene.traverse((o) => { if (o.isLight && o !== b.hemi) o.intensity *= 0.1; });
    b.mat.light.color.multiplyScalar(0.04);
  }

  // The museum, waking up (eyes, flickers, sealing doors, your ghost…).
  const anomalies = createAnomalies(b, ctx, cells, plan, makeRng(`anomaly:${plan.seed}`));

  // Room rules: a sign at the door and their look; their feel is applied per frame.
  for (const c of cells) {
    if (!c.rule) continue;
    const look = RULE_LOOK[c.rule];
    const { cell } = c;
    b.sign(signTexture([{ text: look.banner, size: 54, color: look.tint }], { w: 512, h: 120, bg: '#0b0d10', border: look.tint }),
      1.8, 0.42, 0, Math.min(cell.y0 + cell.h - 0.5, cell.y0 + 3.6), cell.zS - 1.2, 0, { glow: 1.3 }); // hangs just inside, facing you as you enter
    if (c.rule === 'ice') {
      const iceMat = new THREE.MeshStandardMaterial({ color: '#cfefff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55 });
      for (const [lo, hi] of floorSpans(cell)) b.box(cell.x0, cell.y0, lo, cell.x1, cell.y0 + 0.01, hi, iceMat, { collide: false, solid: false, tile: 0, castShadow: false });
    }
    if (c.rule === 'low_gravity') b.particles('fireflies', [cell.x0, cell.y0 + 0.3, cell.zN], [cell.x1, cell.y0 + cell.h - 0.3, cell.zS], 80);
    if (c.rule === 'strobe') c.strobe = { lamps: cell.lamps.map((l) => ({ l, base: l.intensity })), key: cell.key, keyBase: cell.key?.intensity ?? 0, t: 0 };
  }
  const baseFog = b.scene.fog?.density ?? 0;
  if (cells.some((c) => c.rule === 'fog') && !b.scene.fog) b.scene.fog = new THREE.FogExp2(theme.fog, 0);
  let fogLevel = baseFog;
  const applyRules = (dt, player) => {
    const here = cells.find((c) => c.cell.contains(player.pos));
    const rule = here?.rule;
    player.gravityScale = rule === 'low_gravity' ? 0.42 : 1;
    player.frictionScale = rule === 'ice' && player.onGround ? 0.16 : 1;
    player.mirrorX = rule === 'mirrored';
    const fogWant = rule === 'fog' ? Math.max(0.16, baseFog) : baseFog;
    fogLevel += (fogWant - fogLevel) * Math.min(1, dt * 2);
    if (b.scene.fog) b.scene.fog.density = fogLevel;
    for (const c of cells) {
      if (!c.strobe) continue;
      c.strobe.t += dt;
      const on = (c.strobe.t % 1.6) < 0.8;
      for (const f of c.strobe.lamps) f.l.intensity = on ? f.base : f.base * 0.03;
      if (c.strobe.key) c.strobe.key.intensity = on ? c.strobe.keyBase : 0;
    }
  };

  // Threat timing: a lockdown that starts when you enter the marked room.
  const threat = plan.threat ? { ...plan.threat, state: 'idle' } : null;
  const startThreat = () => {
    const c = cells[threat.room];
    threat.state = 'running';
    ctx.wrenText?.(`Lockdown. This room seals itself in ${Math.round(threat.seconds)} seconds. Solve it before then.`, 'worried', 2);
    levelState.tensionManager.startThreat({
      duration: threat.seconds,
      onComplete: () => {
        threat.state = 'expired';
        // Missed it: the room goes dark (harder, never fatal).
        for (const l of c.cell.lamps) l.intensity *= 0.3;
        if (c.cell.key) c.cell.key.intensity *= 0.3;
        b.hemi.intensity *= 0.6;
        b.ctx.sfx.play('danger_timeout');
        ctx.onThreat?.('expired');
      },
    });
  };

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
      anomalies.update(dt, player);
      applyRules(dt, player);
      if (threat) {
        const c = cells[threat.room];
        if (threat.state === 'idle' && c.cell.contains(player.pos) && player.onGround && !c.done) startThreat();
        if (threat.state === 'running' && c.done) {
          threat.state = 'averted';
          levelState.tensionManager.cancel();
          ctx.onThreat?.('averted');
        }
        const tm = levelState.tensionManager;
        ctx.threatHud?.(threat.state === 'running' ? tm.remaining : null, tm.getUrgencyAlpha());
      }

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
        const i = cells.indexOf(c);
        c.cell.door.setOpen(anomalies.sealed.has(i) ? false : c.inst.doorOpen ? c.inst.doorOpen() : c.done);
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
      layout: { start: startKind, exit: exitKind, connectors: cells.map((c) => c.connector), rigs: cells.map((c) => c.rig), rules: cells.map((c) => c.rule) },
      difficulty: { mode: difficultyMode, diff: plan.diff ?? 0, params: diffParams },
      threat: () => threat && { ...threat },
      sealed: () => [...anomalies.sealed],
    },
  };
}
