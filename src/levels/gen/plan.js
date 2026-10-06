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
//  * Difficulty only goes up, level after level, and it is *measured*: every
//    module has a rating, and a level's puzzle load is the sum of its rooms'
//    ratings. The load never drops from one level to the next; it steps up
//    through each world (aiming at a rising percentile of what's possible
//    with the mechanics unlocked so far), and variety comes from swapping in
//    different modules of equal rating. On top of that `diff` (0..1), which
//    every module reads to tighten its parameters, rises every single level.
//    score = load × (1 + 0.8 × diff) is therefore strictly increasing;
//    `node scripts/check-curve.mjs` verifies it.
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
  grow_plate: { name: 'Pressure Plate', min: 5, weight: 3, rating: 1, secs: 4 },
  step_ledge: { name: 'Ledge', min: 5, weight: 3, rating: 1, secs: 4 },
  shrink_socket: { name: 'Socket', min: 5, weight: 3, rating: 1.5, secs: 4 },
  portal_glass: { name: 'Glass Wall', min: 5, weight: 3, rating: 1.5, secs: 3, gun: true },
  portal_ledge: { name: 'High Exit', min: 5, weight: 3, rating: 2, secs: 3, gun: true },
  anamorph_code: { name: 'Anamorph', min: 5, weight: 2, rating: 2, secs: 4 },
  loop_rooms: { name: 'Loop', min: 5, weight: 2, rating: 2.5, secs: 6 },
  bigger_inside: { name: 'Bigger Inside', min: 5, weight: 2, rating: 2.5, secs: 5 },
  // One new mechanic per world.
  color_count: { name: 'Colour Count', min: worldStart(0), weight: 2, rating: 2, secs: 4 },
  button_sequence: { name: 'Sequence', min: worldStart(1), weight: 2, rating: 2, secs: 4 },
  bounce_pad: { name: 'Bounce Pad', min: worldStart(2), weight: 3, rating: 2.5, secs: 3, isNew: true },
  portal_pit: { name: 'Chasm', min: worldStart(3), weight: 3, rating: 3, secs: 3, gun: true },
  keycard_doors: { name: 'Keycards', min: worldStart(4), weight: 3, rating: 3, secs: 6, isNew: true },
  dark_room: { name: 'Blackout Room', min: worldStart(5), weight: 2, rating: 3, secs: 4 },
  laser_fence: { name: 'Laser Fence', min: worldStart(6), weight: 3, rating: 3.5, secs: 5, isNew: true },
  two_plates: { name: 'Twin Plates', min: worldStart(7), weight: 2, rating: 3.5, secs: 8 },
  memory_sequence: { name: 'Memory', min: worldStart(8), weight: 2, rating: 3, secs: 6, isNew: true },
  window_code: { name: 'Window', min: worldStart(9), weight: 2, rating: 3, secs: 3 },
  fan_lift: { name: 'Wind Lift', min: worldStart(10), weight: 3, rating: 3.5, secs: 4, isNew: true },
  cube_rescue: { name: 'Rescue', min: worldStart(11), weight: 2, rating: 4, secs: 6, gun: true },
  stack_ledge: { name: 'Stack', min: worldStart(12), weight: 3, rating: 4, secs: 8, isNew: true },
  math_code: { name: 'Riddle', min: worldStart(13), weight: 2, rating: 3.5, secs: 4, isNew: true },
  collapsing_floor: { name: 'Crumbling Floor', min: worldStart(14), weight: 3, rating: 4, secs: 3, isNew: true },
  teleport_maze: { name: 'Teleporters', min: worldStart(15), weight: 3, rating: 4, secs: 4, isNew: true },
  // The finale of every level from 10 on: a furnished room you search, IRL-style.
  escape_room: { name: 'Escape Room', min: 10, weight: 0, rating: 4, secs: 25, staple: true },
  sprint_door: { name: 'Sprint Door', min: worldStart(17), weight: 3, rating: 4.5, secs: 3, isNew: true },
};

// Twists change how a whole level plays rather than adding a room.
export const TWISTS = {
  decoys: { name: 'Fake Panels', min: worldStart(16), chance: 0.6, rating: 1 },
  blackout: { name: 'Blackout', min: worldStart(18), chance: 0.35, rating: 2 },
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

// 0 at level 5 → 1 at level 504, strictly increasing, rising faster early on.
export function difficulty(n) {
  const t = Math.min(1, Math.max(0, (n - FIRST_GENERATED) / (LAST_GENERATED - FIRST_GENERATED)));
  return t ** 0.75;
}

// Rooms per level never goes down either.
function moduleCount(n) {
  if (n < 105) return 3;
  if (n < 330) return 4;
  return 5;
}

export const levelLoad = (modules, twists = []) =>
  modules.reduce((sum, m) => sum + MODULES[m].rating, 0) + twists.reduce((sum, t) => sum + TWISTS[t].rating, 0);

export const levelScore = (modules, diff, twists = []) => levelLoad(modules, twists) * (1 + 0.8 * diff);

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

// `minLoad`: the previous level's load (this one may not be lower).
// `aim`: 0..1, how far up the range of possible loads this level should sit.
// `recent`: modules used by the last few levels, avoided for variety.
function makePlan({ id, number, seedText, count, available, world, used, boost, force, diff, minLoad = 0, aim = 0.5, recent = new Set(), staples = [] }) {
  const rng = makeRng(seedText);
  const twists = Object.keys(TWISTS).filter((t) => number >= TWISTS[t].min &&
    (number === TWISTS[t].min || rng() < TWISTS[t].chance));
  const candidates = [];
  for (let attempt = 0; attempt < 400; attempt++) {
    const modules = [];
    // Early attempts also avoid what the last levels used; later ones relax it.
    const avoid = new Set([...(force ? [force] : []), ...(attempt < 200 ? recent : [])]);
    for (let i = 0; i < count - (force ? 1 : 0); i++) {
      const m = weightedPick(rng, available, avoid, boost);
      modules.push(m);
      avoid.add(m); // no repeats within a level
    }
    // A newly introduced module goes last, as the level's finale.
    if (force) modules.push(force);
    // Otherwise rooms get harder towards the end of the level too.
    else modules.sort((a, b) => MODULES[a].rating - MODULES[b].rating);
    modules.push(...staples); // always last
    const sig = modules.join('+');
    if (used?.has(sig) || candidates.some((c) => c.sig === sig)) continue;
    const fresh = modules.filter((m) => !recent.has(m)).length;
    candidates.push({ modules, sig, load: levelLoad(modules, twists), fresh });
  }
  if (!candidates.length) candidates.push({ modules: [...available.slice(0, count)], sig: '', load: 0, fresh: 0 });
  // The load to aim for: a percentile of what's possible, never below the last level.
  const loads = candidates.map((c) => c.load).sort((a, b) => a - b);
  const want = Math.max(minLoad, loads[Math.min(loads.length - 1, Math.floor(aim * loads.length))]);
  const ok = candidates.filter((c) => c.load >= want - 1e-9);
  // Lowest load that clears the bar; among those, the most different from recent levels.
  const pool0 = ok.length ? ok : [candidates.reduce((a, c) => (c.load > a.load ? c : a))];
  const lowest = Math.min(...pool0.map((c) => c.load));
  const tier = pool0.filter((c) => c.load === lowest);
  const bestFresh = Math.max(...tier.map((c) => c.fresh));
  const pool = tier.filter((c) => c.fresh === bestFresh);
  const chosen = pool[Math.floor(rng() * pool.length)];
  const modules = chosen.modules;
  used?.add(chosen.sig);
  const name = `${pick(rng, ADJ)} ${pick(rng, NOUN)}`;
  return finalize({
    id, number, name, seed: seedText, modules, twists, diff, load: levelLoad(modules, twists), score: levelScore(modules, diff, twists),
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
  let prevLoad = 0;
  const history = [];
  for (let n = FIRST_GENERATED; n <= LAST_GENERATED; n++) {
    const worldIndex = Math.floor((n - FIRST_GENERATED) / LEVELS_PER_WORLD);
    const world = { ...WORLDS[worldIndex], index: worldIndex };
    if (!usedByWorld.has(worldIndex)) usedByWorld.set(worldIndex, new Set());
    const rng = makeRng(`count:${n}`);
    const available = Object.keys(MODULES).filter((m) => MODULES[m].min <= n && !MODULES[m].staple);
    const staples = Object.keys(MODULES).filter((m) => MODULES[m].min <= n && MODULES[m].staple);
    const recent = new Set(history.slice(-2).flat());
    const intro = INTRODUCTIONS[worldIndex];
    const isIntroLevel = n === worldStart(worldIndex);
    const plan = makePlan({
      id: `p${n}`, number: n, seedText: `level:${n}`, count: moduleCount(n), available, world,
      used: usedByWorld.get(worldIndex),
      boost: MODULES[intro] ? intro : null,
      force: isIntroLevel && MODULES[intro] ? intro : null,
      diff: difficulty(n),
      minLoad: prevLoad,
      // Climbs through each world: from the easier third of what's possible to the harder end.
      aim: 0.3 + 0.55 * ((n - worldStart(worldIndex)) / (LEVELS_PER_WORLD - 1)),
      recent,
      staples,
    });
    prevLoad = plan.load;
    history.push(plan.modules);
    plan.introduces = isIntroLevel ? intro : n === MODULES.escape_room.min ? 'escape_room' : null;
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
    id: 'daily', number: 0, seedText: `daily:${date}`, count: 3, available: shuffle(rng, Object.keys(MODULES).filter((m) => !MODULES[m].staple)), staples: ['escape_room'],
    world, used: null, diff: 0.5 + rng() * 0.3,
  });
  plan.name = `Daily · ${plan.name}`;
  return plan;
}
