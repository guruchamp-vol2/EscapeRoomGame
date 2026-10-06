// Decides what every generated level contains — which puzzle modules, in what
// order, how hard, which world — without building any geometry. Pure logic,
// shared with the server (which needs level ids and minimum plausible times).
//
// Progression rules:
//  * Level 5 picks up where the story ended: the story taught forced
//    perspective, portals, the loop, the closet and anamorphic codes, so those
//    are available from the start and level 5 is already a 3-room level.
//  * Every world (25 levels) introduces one new mechanic or twist at its first
//    level, and features it more often for the rest of that world.
//  * Difficulty only goes up: room count grows from 3 to 5, and every module
//    reads `diff` (0..1) to tighten its parameters.
import { WORLDS, LEVELS_PER_WORLD } from './worlds.js';
import { makeRng, pick, irange, shuffle } from '../../random.js';

export const FIRST_GENERATED = 5; // levels 1–4 are hand-made
export const GENERATED_COUNT = 500;
export const LAST_GENERATED = FIRST_GENERATED + GENERATED_COUNT - 1;

const worldStart = (w) => FIRST_GENERATED + w * LEVELS_PER_WORLD;

// Puzzle modules. `min`: first level it can appear in. `secs`: rough minimum time
// a very fast player needs (anti-cheat). `gun`: needs the portal device.
export const MODULES = {
  // Taught by the story chambers — available from level 5.
  grow_plate: { name: 'Pressure Plate', min: 5, weight: 3, secs: 4 },
  step_ledge: { name: 'Ledge', min: 5, weight: 3, secs: 4 },
  shrink_socket: { name: 'Socket', min: 5, weight: 3, secs: 4 },
  portal_glass: { name: 'Glass Wall', min: 5, weight: 3, secs: 3, gun: true },
  portal_ledge: { name: 'High Exit', min: 5, weight: 3, secs: 3, gun: true },
  anamorph_code: { name: 'Anamorph', min: 5, weight: 2, secs: 4 },
  loop_rooms: { name: 'Loop', min: 5, weight: 2, secs: 6 },
  bigger_inside: { name: 'Bigger Inside', min: 5, weight: 2, secs: 5 },
  // One new mechanic per world.
  color_count: { name: 'Colour Count', min: worldStart(0), weight: 2, secs: 4 },
  button_sequence: { name: 'Sequence', min: worldStart(1), weight: 2, secs: 4 },
  bounce_pad: { name: 'Bounce Pad', min: worldStart(2), weight: 3, secs: 3, isNew: true },
  portal_pit: { name: 'Chasm', min: worldStart(3), weight: 3, secs: 3, gun: true },
  keycard_doors: { name: 'Keycards', min: worldStart(4), weight: 3, secs: 6, isNew: true },
  dark_room: { name: 'Blackout Room', min: worldStart(5), weight: 2, secs: 4 },
  laser_fence: { name: 'Laser Fence', min: worldStart(6), weight: 3, secs: 5, isNew: true },
  two_plates: { name: 'Twin Plates', min: worldStart(7), weight: 2, secs: 8 },
  memory_sequence: { name: 'Memory', min: worldStart(8), weight: 2, secs: 6, isNew: true },
  window_code: { name: 'Window', min: worldStart(9), weight: 2, secs: 3 },
  fan_lift: { name: 'Wind Lift', min: worldStart(10), weight: 3, secs: 4, isNew: true },
  cube_rescue: { name: 'Rescue', min: worldStart(11), weight: 2, secs: 6, gun: true },
  stack_ledge: { name: 'Stack', min: worldStart(12), weight: 3, secs: 8, isNew: true },
  math_code: { name: 'Riddle', min: worldStart(13), weight: 2, secs: 4, isNew: true },
  collapsing_floor: { name: 'Crumbling Floor', min: worldStart(14), weight: 3, secs: 3, isNew: true },
  teleport_maze: { name: 'Teleporters', min: worldStart(15), weight: 3, secs: 4, isNew: true },
  sprint_door: { name: 'Sprint Door', min: worldStart(17), weight: 3, secs: 3, isNew: true },
};

// Twists change how a whole level plays rather than adding a room.
export const TWISTS = {
  decoys: { name: 'Fake Panels', min: worldStart(16), chance: 0.6 },
  blackout: { name: 'Blackout', min: worldStart(18), chance: 0.35 },
};

// What each world's first level introduces (shown on the level select).
export const INTRODUCTIONS = WORLDS.map((_, w) => {
  const n = worldStart(w);
  const mod = Object.keys(MODULES).find((m) => MODULES[m].min === n && n > FIRST_GENERATED);
  const twist = Object.keys(TWISTS).find((t) => TWISTS[t].min === n);
  return mod ?? twist ?? (w === 0 ? 'color_count' : null);
});

const ADJ = ['Hollow', 'Quiet', 'Folded', 'Broken', 'Silent', 'Hidden', 'Shifting', 'Endless', 'Narrow', 'Tilted', 'Mirrored',
  'Forgotten', 'Sunken', 'Floating', 'Inverted', 'Twisted', 'Lonely', 'Bright', 'Restless', 'Patient', 'Distant', 'Curious',
  'Velvet', 'Hushed', 'Crooked', 'Gilded', 'Fractured', 'Wandering', 'Spiral', 'Paper', 'Iron', 'Glass', 'Amber', 'Cobalt'];
const NOUN = ['Atrium', 'Vault', 'Corridor', 'Gallery', 'Chamber', 'Annex', 'Hall', 'Cellar', 'Loft', 'Study', 'Observatory',
  'Cloister', 'Foyer', 'Archive', 'Rotunda', 'Workshop', 'Antechamber', 'Passage', 'Courtyard', 'Conservatory', 'Stairwell',
  'Reliquary', 'Terrace', 'Crypt', 'Parlour', 'Nave', 'Pavilion', 'Lantern', 'Threshold', 'Hangar', 'Labyrinth', 'Orrery'];

// 0 at level 5, 1 at level 504 — never goes down.
export function difficulty(n) {
  return Math.min(1, Math.max(0, (n - FIRST_GENERATED) / (LAST_GENERATED - FIRST_GENERATED)));
}

function moduleCount(n, rng) {
  if (n >= worldStart(19)) return 5; // final world: the gauntlet
  if (n < 80) return 3;
  if (n < 205) return irange(rng, 3, 4);
  if (n < 380) return 4;
  return irange(rng, 4, 5);
}

function weightedPick(rng, ids, avoid, boost) {
  const pool = ids.filter((id) => !avoid.has(id));
  const list = pool.length ? pool : ids;
  const w = (id) => MODULES[id].weight * (id === boost ? 3 : 1);
  const total = list.reduce((s, id) => s + w(id), 0);
  let r = rng() * total;
  for (const id of list) {
    r -= w(id);
    if (r <= 0) return id;
  }
  return list[list.length - 1];
}

// Fields derived from the module list (recomputed if the list changes).
function finalize(plan) {
  plan.gun = plan.modules.some((m) => MODULES[m].gun);
  plan.minMs = plan.modules.reduce((s, m) => s + MODULES[m].secs, 0) * 1000;
  return plan;
}

function makePlan({ id, number, seedText, count, available, world, used, boost, force, diff }) {
  const rng = makeRng(seedText);
  let modules = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    modules = [];
    const avoid = new Set(force ? [force] : []);
    for (let i = 0; i < count - (force ? 1 : 0); i++) {
      const m = weightedPick(rng, available, avoid, boost);
      modules.push(m);
      avoid.add(m); // no repeats within a level
    }
    // A newly introduced module goes last, as the level's finale.
    if (force) modules.push(force);
    const sig = modules.join('+');
    if (!used?.has(sig)) {
      used?.add(sig);
      break;
    }
  }
  const twists = Object.keys(TWISTS).filter((t) => number >= TWISTS[t].min &&
    (number === TWISTS[t].min || rng() < TWISTS[t].chance));
  const name = `${pick(rng, ADJ)} ${pick(rng, NOUN)}`;
  return finalize({
    id, number, name, seed: seedText, modules, twists, diff,
    world: world.index, worldName: world.name, tagline: world.tagline,
  });
}

let cached = null;

export function generatedPlans() {
  if (cached) return cached;
  cached = [];
  const usedByWorld = new Map();
  const usedNames = new Set();
  const nameRng = makeRng('names');
  for (let n = FIRST_GENERATED; n <= LAST_GENERATED; n++) {
    const worldIndex = Math.floor((n - FIRST_GENERATED) / LEVELS_PER_WORLD);
    const world = { ...WORLDS[worldIndex], index: worldIndex };
    if (!usedByWorld.has(worldIndex)) usedByWorld.set(worldIndex, new Set());
    const rng = makeRng(`count:${n}`);
    const available = Object.keys(MODULES).filter((m) => MODULES[m].min <= n);
    const intro = INTRODUCTIONS[worldIndex];
    const isIntroLevel = n === worldStart(worldIndex);
    const plan = makePlan({
      id: `p${n}`, number: n, seedText: `level:${n}`, count: moduleCount(n, rng), available, world,
      used: usedByWorld.get(worldIndex),
      boost: MODULES[intro] ? intro : null,
      force: isIntroLevel && MODULES[intro] ? intro : null,
      diff: Math.min(1, difficulty(n) + (rng() - 0.5) * 0.04),
    });
    plan.introduces = isIntroLevel ? intro : null;
    while (usedNames.has(plan.name)) plan.name = `${pick(nameRng, ADJ)} ${pick(nameRng, NOUN)}`;
    usedNames.add(plan.name);
    cached.push(plan);
  }
  return cached;
}

// The daily challenge: a fresh generated level per UTC date, mid-to-hard.
export function dailyPlan(date) {
  const rng = makeRng(`daily-world:${date}`);
  const worldIndex = Math.floor(rng() * WORLDS.length);
  const world = { ...WORLDS[worldIndex], index: worldIndex };
  const plan = makePlan({
    id: 'daily', number: 0, seedText: `daily:${date}`, count: 3, available: shuffle(rng, Object.keys(MODULES)),
    world, used: null, diff: 0.5 + rng() * 0.3,
  });
  plan.name = `Daily · ${plan.name}`;
  return plan;
}
