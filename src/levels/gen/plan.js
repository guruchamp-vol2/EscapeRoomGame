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
//    `node scripts/check-curve.mjs` verifies it. Boss levels (every 50) are
//    spikes above that line; the level after a boss continues the line.
//
// Rhythm and variety (see storyline.js):
//  * Every module belongs to a FAMILY (scale, portal, cipher, pattern, space,
//    motion, hazard, search). Neighbouring rooms never share a family, so a
//    level never plays the same kind of room twice in a row.
//  * Every 7 levels a FEATURED mechanic is forced in and its family boosted.
//  * Every 50 levels a BOSS level: one more room, the chapter's mechanics, a
//    pressure twist and a story reveal. Within a chapter the story pulse
//    (arrival → exploration → pressure) raises twists and the target load.
//  * Each world favours its own families (worlds.js `rhythm`).
// Generation order: valid by gameplay (load, families) → interesting by
// rhythm (featured, pulse) → thematic by chapter (boss, world rhythm).
import { WORLDS, LEVELS_PER_WORLD } from './worlds.js';
import { makeRng, pick, irange, shuffle } from '../../random.js';
import { chapterFor, storyPulse, PULSE, isBossLevel, isFeatureLevel, FEATURE_FLAVOR, getNarrativeBeat } from './storyline.js';

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

// Puzzle families: rooms next to each other never share one.
export const FAMILY = {
  grow_plate: 'scale', step_ledge: 'scale', shrink_socket: 'scale', stack_ledge: 'scale', two_plates: 'scale',
  portal_glass: 'portal', portal_ledge: 'portal', portal_pit: 'portal', cube_rescue: 'portal',
  anamorph_code: 'cipher', color_count: 'cipher', window_code: 'cipher', math_code: 'cipher',
  button_sequence: 'pattern', memory_sequence: 'pattern',
  loop_rooms: 'space', bigger_inside: 'space', teleport_maze: 'space',
  bounce_pad: 'motion', fan_lift: 'motion', collapsing_floor: 'motion', sprint_door: 'motion',
  laser_fence: 'hazard', dark_room: 'hazard',
  keycard_doors: 'search', escape_room: 'search',
};
for (const [id, f] of Object.entries(FAMILY)) MODULES[id].family = f;

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

function weightedPick(rng, ids, avoid, weightOf) {
  const pool = ids.filter((id) => !avoid.has(id));
  const list = pool.length ? pool : ids;
  const total = list.reduce((t, id) => t + weightOf(id), 0);
  let r = rng() * total;
  for (const id of list) {
    r -= weightOf(id);
    if (r <= 0) return id;
  }
  return list[list.length - 1];
}

// Orders a level's rooms: easiest first, the forced module (a new or featured
// mechanic) as late as possible, staples last, and never two rooms of the same
// family next to each other. Depth-first, trying rooms in rating order, so the
// first valid order found is the one closest to "sorted". → array or null.
function arrange(mods, force, staples) {
  const sorted = [...mods].sort((a, b) => MODULES[a].rating - MODULES[b].rating);
  const tail = staples[0] ?? null;
  const search = (wantForceLast) => {
    const out = [];
    const used = new Set();
    const dfs = () => {
      if (out.length === sorted.length) {
        if (wantForceLast && force && out[out.length - 1] !== force) return false;
        return !tail || FAMILY[out[out.length - 1]] !== FAMILY[tail];
      }
      for (const m of sorted) {
        if (used.has(m)) continue;
        if (out.length && FAMILY[out[out.length - 1]] === FAMILY[m]) continue;
        if (wantForceLast && force && m === force && out.length !== sorted.length - 1) continue;
        used.add(m);
        out.push(m);
        if (dfs()) return true;
        out.pop();
        used.delete(m);
      }
      return false;
    };
    return dfs() ? [...out, ...staples] : null;
  };
  return search(true) ?? search(false);
}

// Fields derived from the module list (recomputed if the list changes).
function finalize(plan) {
  plan.gun = plan.modules.some((m) => MODULES[m].gun);
  plan.minMs = plan.modules.reduce((sum, m) => sum + MODULES[m].secs, 0) * 1000;
  return plan;
}

// `minLoad`: the load this level must reach.
// `aim`: 0..1, how far up the range of possible loads this level should sit.
// `recent`: modules used by the last few levels, avoided for variety.
// `weightOf`: pick weight per module (world rhythm, featured family, boss).
// `twists`: fixed twists (boss pressure), or null to roll the normal ones.
function makePlan({ id, number, seedText, count, available, world, used, force, diff, minLoad = 0, aim = 0.5,
  recent = new Set(), staples = [], weightOf = (m) => MODULES[m].weight, twistChance = 1, twists = null }) {
  const rng = makeRng(seedText);
  twists ??= Object.keys(TWISTS).filter((t) => number >= TWISTS[t].min &&
    (number === TWISTS[t].min || rng() < Math.min(0.9, TWISTS[t].chance * twistChance)));
  const candidates = [];
  const generate = (attempts, { avoidRecent, weights, forced }) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const picked = forced ? [forced] : [];
      // Early attempts also avoid what the last levels used; later ones relax it.
      const avoid = new Set([...picked, ...(avoidRecent && attempt < attempts / 2 ? recent : [])]);
      while (picked.length < count) {
        const m = weightedPick(rng, available, avoid, weights);
        if (picked.includes(m)) break;
        picked.push(m);
        avoid.add(m); // no repeats within a level
      }
      if (picked.length < count) continue;
      const modules = arrange(picked, forced, staples);
      if (!modules) continue;
      const sig = modules.join('+');
      if (used?.has(sig) || candidates.some((c) => c.sig === sig)) continue;
      const fresh = modules.filter((m) => !recent.has(m)).length;
      // Distinct families in the level: more is better.
      const families = new Set(modules.map((m) => FAMILY[m])).size;
      candidates.push({ modules, sig, load: levelLoad(modules, twists), fresh, families, forced });
    }
  };
  // Gameplay validity comes first: if nothing reaches the required load, search
  // wider, then drop the variety preferences, and only then the forced module.
  const uniform = (m) => MODULES[m].weight * (1 + MODULES[m].rating / 2);
  const passes = [
    [300, { avoidRecent: true, weights: weightOf, forced: force }],
    [500, { avoidRecent: false, weights: weightOf, forced: force }],
    [500, { avoidRecent: false, weights: uniform, forced: force }],
    [500, { avoidRecent: false, weights: uniform, forced: null }],
  ];
  for (const [attempts, opts] of passes) {
    generate(attempts, opts);
    if (candidates.some((c) => c.load >= minLoad - 1e-9)) break;
  }
  if (!candidates.length) {
    const modules = arrange(available.slice(0, count), null, staples) ?? [...available.slice(0, count), ...staples];
    candidates.push({ modules, sig: '', load: levelLoad(modules, twists), fresh: 0, families: 0 });
  }
  // The load to aim for: a percentile of what's possible, never below minLoad.
  const loads = candidates.map((c) => c.load).sort((a, b) => a - b);
  const want = Math.max(minLoad, loads[Math.min(loads.length - 1, Math.floor(aim * loads.length))]);
  const ok = candidates.filter((c) => c.load >= want - 1e-9);
  // Lowest load that clears the bar; among those, the most varied and the most
  // different from recent levels.
  const pool0 = ok.length ? ok : [candidates.reduce((a, c) => (c.load > a.load ? c : a))];
  const lowest = Math.min(...pool0.map((c) => c.load));
  const tier = pool0.filter((c) => c.load === lowest);
  const score = (c) => c.fresh * 2 + c.families;
  const best = Math.max(...tier.map(score));
  const pool = tier.filter((c) => score(c) === best);
  const chosen = pool[Math.floor(rng() * pool.length)];
  const modules = chosen.modules;
  used?.add(chosen.sig);
  const droppedForce = force && !modules.includes(force);
  const name = `${pick(rng, ADJ)} ${pick(rng, NOUN)}`;
  return finalize({
    id, number, name, seed: seedText, modules, twists, diff, load: levelLoad(modules, twists), score: levelScore(modules, diff, twists),
    world: world.index, worldName: world.name, tagline: world.tagline, droppedForce,
  });
}

let cached = null;

export function generatedPlans() {
  if (cached) return cached;
  cached = [];
  const usedByWorld = new Map();
  const usedNames = new Set();
  const nameRng = makeRng('names');
  let chainLoad = 0; // load of the last non-boss level: the line bosses spike above
  const history = [];
  const lastFeatured = new Map();
  for (let n = FIRST_GENERATED; n <= LAST_GENERATED; n++) {
    const worldIndex = Math.floor((n - FIRST_GENERATED) / LEVELS_PER_WORLD);
    const world = { ...WORLDS[worldIndex], index: worldIndex };
    if (!usedByWorld.has(worldIndex)) usedByWorld.set(worldIndex, new Set());
    const available = Object.keys(MODULES).filter((m) => MODULES[m].min <= n && !MODULES[m].staple);
    const staples = Object.keys(MODULES).filter((m) => MODULES[m].min <= n && MODULES[m].staple);
    const recent = new Set(history.slice(-2).flat());
    const intro = INTRODUCTIONS[worldIndex];
    const isIntroLevel = n === worldStart(worldIndex);
    const chapter = chapterFor(n);
    const pulse = storyPulse(n);
    const P = PULSE[pulse];
    const boss = isBossLevel(n) ? chapter : null;

    // Featured mechanic: the world's new one on its first level; otherwise every
    // 7 levels, the unlocked mechanic that has gone longest without the spotlight.
    // If a choice can't reach the level's required difficulty, the next-longest
    // waiting one gets the spotlight instead.
    let options = [null];
    if (!boss && isIntroLevel && MODULES[intro]) options = [intro];
    else if (!boss && isFeatureLevel(n)) {
      options = [...available].sort((a, b) =>
        ((lastFeatured.get(a) ?? -1e9) - (lastFeatured.get(b) ?? -1e9)) || (MODULES[b].min - MODULES[a].min)).slice(0, 6);
    }

    // Boss: the chapter's signature mechanic is forced, the rest of its list boosted.
    const bossMods = boss ? boss.mechanics.filter((m) => available.includes(m)) : [];
    const signature = bossMods.sort((a, b) => MODULES[b].rating - MODULES[a].rating)[0] ?? null;
    const families = new Set(world.rhythm?.families ?? []);
    const worldPos = (n - worldStart(worldIndex)) / (LEVELS_PER_WORLD - 1);
    const used = usedByWorld.get(worldIndex);
    let plan = null, featured = null;
    for (const option of options) {
      featured = option;
      const weightOf = (m) => MODULES[m].weight
      * (families.has(FAMILY[m]) ? 2 : 1)
      * (featured && FAMILY[m] === FAMILY[featured] ? 3 : 1)
      * (bossMods.includes(m) ? 4 : 1)
      * (MODULES[intro] && m === intro ? 2 : 1);
      plan = makePlan({
      id: `p${n}`, number: n, seedText: `level:${n}`, count: moduleCount(n) + (boss ? 1 : 0), available, world,
      used: new Set(used), // a trial: only the accepted plan's rooms are recorded
      force: boss ? signature : featured,
      diff: difficulty(n),
      // Bosses must stand clearly above the line; everything else continues it.
      minLoad: boss ? chainLoad + 1 : chainLoad,
      aim: Math.min(0.95, Math.max(0.05, 0.3 + 0.55 * worldPos + P.aimShift)),
      recent,
      staples,
      weightOf,
      twistChance: P.twistChance,
      twists: boss ? boss.pressure.filter((t) => t !== 'decoys' || n >= 100) : null,
      });
      if (!plan.droppedForce) break;
    }
    used.add(plan.modules.join('+'));
    if (featured && plan.modules.includes(featured)) lastFeatured.set(featured, n);
    if (!boss) chainLoad = plan.load;
    history.push(plan.modules);
    plan.introduces = isIntroLevel ? intro : n === MODULES.escape_room.min ? 'escape_room' : null;
    plan.featured = featured && plan.modules.includes(featured) ? featured : null;
    plan.featuredFlavor = featured ? FEATURE_FLAVOR[featured] ?? null : null;
    plan.chapter = { index: chapter.index, name: chapter.name, tone: chapter.tone };
    plan.pulse = pulse;
    plan.beat = getNarrativeBeat(n);
    plan.boss = boss ? {
      chapter: chapter.index, name: boss.name, intro: boss.intro, narrative: boss.narrative,
      reward: boss.reward, pressureText: boss.pressureText ?? null,
    } : null;
    if (boss) plan.name = boss.name;
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
    id: 'daily', number: 0, seedText: `daily:${date}`, count: 3,
    available: shuffle(rng, Object.keys(MODULES).filter((m) => !MODULES[m].staple)), staples: ['escape_room'],
    world, used: null, diff: 0.5 + rng() * 0.3,
  });
  plan.name = `Daily · ${plan.name}`;
  plan.chapter = null;
  plan.pulse = 'exploration';
  plan.featured = null;
  plan.boss = null;
  return plan;
}
