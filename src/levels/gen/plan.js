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
import { chapterFor, storyPulse, PULSE, isBossLevel, FEATURE_FLAVOR, getNarrativeBeat } from './storyline.js';

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
  // Introduced on the 7-level schedule (min is filled in from MECHANIC_ORDER).
  color_count: { name: 'Colour Count', weight: 2, rating: 2, secs: 4 },
  button_sequence: { name: 'Sequence', weight: 2, rating: 2, secs: 4 },
  bounce_pad: { name: 'Bounce Pad', weight: 3, rating: 2.5, secs: 3 },
  portal_pit: { name: 'Chasm', weight: 3, rating: 3, secs: 3, gun: true },
  keycard_doors: { name: 'Keycards', weight: 3, rating: 3, secs: 6 },
  dark_room: { name: 'Blackout Room', weight: 2, rating: 3, secs: 4 },
  laser_fence: { name: 'Laser Fence', weight: 3, rating: 3.5, secs: 5 },
  two_plates: { name: 'Twin Plates', weight: 2, rating: 3.5, secs: 8 },
  memory_sequence: { name: 'Memory', weight: 2, rating: 3, secs: 6 },
  window_code: { name: 'Window', weight: 2, rating: 3, secs: 3 },
  fan_lift: { name: 'Wind Lift', weight: 3, rating: 3.5, secs: 4 },
  cube_rescue: { name: 'Rescue', weight: 2, rating: 4, secs: 6, gun: true },
  stack_ledge: { name: 'Stack', weight: 3, rating: 4, secs: 8 },
  math_code: { name: 'Riddle', weight: 2, rating: 3.5, secs: 4 },
  collapsing_floor: { name: 'Crumbling Floor', weight: 3, rating: 4, secs: 3 },
  teleport_maze: { name: 'Teleporters', weight: 3, rating: 4, secs: 4 },
  sprint_door: { name: 'Sprint Door', weight: 3, rating: 4.5, secs: 3 },
  // Newer rooms (modules4.js).
  lever_pattern: { name: 'Levers', weight: 2, rating: 2, secs: 5 },
  color_mix: { name: 'Light Mixing', weight: 2, rating: 2, secs: 4 },
  balance_scale: { name: 'Balance Scale', weight: 2, rating: 2.5, secs: 5 },
  lights_out: { name: 'Lights Out', weight: 2, rating: 3, secs: 6 },
  moving_platform: { name: 'Moving Platform', weight: 3, rating: 3, secs: 6 },
  telescope: { name: 'Telescope', weight: 2, rating: 2.5, secs: 5 },
  mirror_beam: { name: 'Light Beam', weight: 2, rating: 3.5, secs: 6 },
  symbol_hunt: { name: 'Symbol Hunt', weight: 2, rating: 3, secs: 6 },
  conveyor: { name: 'Conveyors', weight: 2, rating: 3, secs: 4 },
  pipe_flow: { name: 'Pipes', weight: 2, rating: 3.5, secs: 8 },
  sweeper: { name: 'Laser Gates', weight: 2, rating: 4, secs: 5 },
  dual_switch: { name: 'Twin Switches', weight: 2, rating: 3.5, secs: 4 },
  // The finale of every level from 10 on: a furnished room you search, IRL-style.
  escape_room: { name: 'Escape Room', min: 10, weight: 0, rating: 4, secs: 25, staple: true },
};

// Puzzle families: rooms next to each other never share one.
export const FAMILY = {
  grow_plate: 'scale', step_ledge: 'scale', shrink_socket: 'scale', stack_ledge: 'scale', two_plates: 'scale',
  portal_glass: 'portal', portal_ledge: 'portal', portal_pit: 'portal', cube_rescue: 'portal',
  anamorph_code: 'cipher', color_count: 'cipher', window_code: 'cipher', math_code: 'cipher',
  button_sequence: 'pattern', memory_sequence: 'pattern',
  loop_rooms: 'space', bigger_inside: 'space', teleport_maze: 'space',
  bounce_pad: 'motion', fan_lift: 'motion', collapsing_floor: 'motion', sprint_door: 'motion',
  laser_fence: 'hazard', dark_room: 'hazard', sweeper: 'hazard',
  keycard_doors: 'search', escape_room: 'search', symbol_hunt: 'search',
  lever_pattern: 'pattern', lights_out: 'pattern', color_mix: 'cipher', telescope: 'cipher', balance_scale: 'scale',
  moving_platform: 'motion', conveyor: 'motion', dual_switch: 'motion', mirror_beam: 'circuit', pipe_flow: 'circuit',
};
for (const [id, f] of Object.entries(FAMILY)) MODULES[id].family = f;

// Twists change how a whole level plays rather than adding a room.
export const TWISTS = {
  decoys: { name: 'Fake Panels', chance: 0.6, rating: 1 },
  blackout: { name: 'Blackout', chance: 0.35, rating: 2 },
};

// Room rules: they change how one room plays (generate.js applies them).
// `ok(id)` lists the rooms a rule can be safely applied to.
const JUMPY = new Set(['collapsing_floor', 'sprint_door', 'moving_platform', 'sweeper', 'bounce_pad', 'fan_lift', 'conveyor', 'portal_pit', 'stack_ledge', 'step_ledge']);
const CALM = new Set(['grow_plate', 'shrink_socket', 'color_count', 'button_sequence', 'dark_room', 'memory_sequence', 'window_code', 'math_code',
  'anamorph_code', 'lever_pattern', 'color_mix', 'lights_out', 'telescope', 'mirror_beam', 'symbol_hunt', 'pipe_flow', 'balance_scale', 'keycard_doors', 'two_plates']);
export const RULES = {
  low_gravity: { name: 'Low Gravity', adj: 'Low-Gravity', ok: (id) => !JUMPY.has(id), line: 'Gravity is down to half in some rooms. Jumps go higher. Falls take longer. Try not to enjoy it too much.' },
  ice: { name: 'Ice Floors', adj: 'Frozen', ok: (id) => CALM.has(id), line: 'Ice floors. You will slide. Lean into it. Not literally.' },
  fog: { name: 'Fog', adj: 'Foggy', ok: () => true, line: "Fog in the rooms now. You can't see far. Neither can I, and I have a very big eye." },
  strobe: { name: 'Strobe Lights', adj: 'Strobing', ok: (id) => id !== 'dark_room', line: 'Strobe lights. The room is only there half the time. Remember what you saw.' },
  mirrored: { name: 'Mirror Rooms', adj: 'Mirrored', ok: () => true, line: 'Mirror rooms: left is right and right is left. Forward is still forward. Small mercies.' },
};

// One new mechanic every 7 levels: level 5 + 7i introduces MECHANIC_ORDER[i].
// Entries: a module id, 'rule:x', 'twist:x' or 'fusion:rule+module'.
const BASE_ORDER = [
  'color_count', 'button_sequence', 'lever_pattern', 'bounce_pad', 'rule:low_gravity', 'portal_pit', 'color_mix',
  'keycard_doors', 'balance_scale', 'dark_room', 'rule:ice', 'laser_fence', 'lights_out', 'two_plates',
  'moving_platform', 'memory_sequence', 'rule:fog', 'window_code', 'telescope', 'fan_lift', 'mirror_beam',
  'cube_rescue', 'rule:strobe', 'stack_ledge', 'symbol_hunt', 'math_code', 'conveyor', 'collapsing_floor',
  'rule:mirrored', 'teleport_maze', 'pipe_flow', 'twist:decoys', 'sweeper', 'sprint_door', 'dual_switch',
  'twist:blackout',
];
const SLOTS = Math.floor((LAST_GENERATED - FIRST_GENERATED) / 7) + 1;
// After the new rooms run out, every new mechanic is a fusion: a rule applied
// to a room it has never met, in an order that spreads rules and families.
function fusions(count) {
  const rng = makeRng('fusions');
  const out = [];
  const used = new Set();
  const ruleIds = Object.keys(RULES);
  const mods = Object.keys(MODULES).filter((m) => !MODULES[m].staple && BASE_ORDER.includes(m) && MODULES[m].rating >= 3);
  for (let i = 0; out.length < count && i < 2000; i++) {
    const r = ruleIds[out.length % ruleIds.length];
    const m = mods[Math.floor(rng() * mods.length)];
    const key = `fusion:${r}+${m}`;
    if (used.has(key) || !RULES[r].ok(m)) continue;
    used.add(key);
    out.push(key);
  }
  return out;
}
export const MECHANIC_ORDER = [...BASE_ORDER, ...fusions(SLOTS - BASE_ORDER.length)];
export const introLevel = (i) => FIRST_GENERATED + 7 * i;
export const introAt = (n) => (n >= FIRST_GENERATED && (n - FIRST_GENERATED) % 7 === 0 ? MECHANIC_ORDER[(n - FIRST_GENERATED) / 7] ?? null : null);
MECHANIC_ORDER.forEach((item, i) => {
  if (MODULES[item]) MODULES[item].min = introLevel(i);
  else if (item.startsWith('twist:')) TWISTS[item.slice(6)].min = introLevel(i);
  else if (item.startsWith('rule:')) RULES[item.slice(5)].min = introLevel(i);
});
// A mechanic's display name and introduction line.
export function mechanicInfo(item) {
  if (!item) return null;
  if (MODULES[item]) return { kind: 'room', id: item, name: MODULES[item].name };
  const [kind, rest] = item.split(':');
  if (kind === 'rule') return { kind, id: rest, name: RULES[rest].name, line: RULES[rest].line };
  if (kind === 'twist') return { kind, id: rest, name: TWISTS[rest].name };
  const [r, m] = rest.split('+');
  return { kind: 'fusion', id: rest, rule: r, module: m, name: `${RULES[r].adj} ${MODULES[m].name}`,
    line: `New: ${RULES[r].adj.toLowerCase()} ${MODULES[m].name.toLowerCase()}. You know both halves. You have never had them at once.` };
}

// Kept for anything that still reads per-world introductions.
export const INTRODUCTIONS = WORLDS.map((_, w) => introAt(worldStart(w)));

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

// The rooms' load. (Twists and room rules are extra challenge on top of it;
// they come and go, so they don't count towards the never-easier climb.)
export const levelLoad = (modules) => modules.reduce((sum, m) => sum + MODULES[m].rating, 0);

// The load each level aims for: a smooth climb that stays below the hardest
// possible combination, so late levels still have many rooms to choose from.
function loadTarget(n, count, available, staples) {
  const t = (n - FIRST_GENERATED) / (LAST_GENERATED - FIRST_GENERATED);
  const top = available.map((m) => MODULES[m].rating).sort((a, b) => b - a).slice(0, count).reduce((a, b) => a + b, 0)
    + staples.reduce((a, m) => a + MODULES[m].rating, 0);
  return Math.min(0.86 * top, 4.5 + 15.5 * t ** 0.85);
}

export const levelScore = (modules, diff) => levelLoad(modules) * (1 + 0.8 * diff);

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
  // Picks lean towards ratings near what the level needs per room.
  const perRoom = minLoad / Math.max(1, count + staples.length);
  const lean = (w) => (m) => w(m) * (MODULES[m].rating >= perRoom - 0.5 ? 1.6 : 0.6);
  let good = 0;
  const generate = (attempts, { avoidRecent, weights, forced }) => {
    weights = lean(weights);
    for (let attempt = 0; attempt < attempts && good < 30; attempt++) {
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
      candidates.push({ modules, sig, load: levelLoad(modules), fresh, families, forced });
      if (levelLoad(modules) >= minLoad - 1e-9) good++;
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
  if (!candidates.some((c) => c.load >= minLoad - 1e-9)) {
    // Last resort: every arrangeable combination of the hardest rooms, so the
    // selection below can still pick the gentlest one that clears the bar.
    const top = [...available].filter((m) => m !== force).sort((a, b) => MODULES[b].rating - MODULES[a].rating).slice(0, 9);
    const need = count - (force ? 1 : 0);
    const combo = (start, acc) => {
      if (acc.length === need) {
        const picked = force ? [force, ...acc] : [...acc];
        const modules = arrange(picked, force, staples);
        if (!modules || used?.has(modules.join('+'))) return;
        candidates.push({ modules, sig: modules.join('+'), load: levelLoad(modules), fresh: modules.filter((m) => !recent.has(m)).length,
          families: new Set(modules.map((m) => FAMILY[m])).size, forced: force });
        return;
      }
      for (let i = start; i < top.length; i++) combo(i + 1, [...acc, top[i]]);
    };
    combo(0, []);
  }
  if (!candidates.length) {
    const modules = arrange(available.slice(0, count), null, staples) ?? [...available.slice(0, count), ...staples];
    candidates.push({ modules, sig: '', load: levelLoad(modules), fresh: 0, families: 0 });
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
    id, number, name, seed: seedText, modules, twists, diff, load: levelLoad(modules), score: levelScore(modules, diff),
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
  let spotlight = null; // the newest room mechanic, favoured for 14 levels
  for (let n = FIRST_GENERATED; n <= LAST_GENERATED; n++) {
    const worldIndex = Math.floor((n - FIRST_GENERATED) / LEVELS_PER_WORLD);
    const world = { ...WORLDS[worldIndex], index: worldIndex };
    if (!usedByWorld.has(worldIndex)) usedByWorld.set(worldIndex, new Set());
    const available = Object.keys(MODULES).filter((m) => MODULES[m].min <= n && !MODULES[m].staple);
    const staples = Object.keys(MODULES).filter((m) => MODULES[m].min <= n && MODULES[m].staple);
    const recent = new Set(history.slice(-2).flat());
    // This level's new mechanic (one every 7 levels).
    const item = introAt(n);
    const intro = mechanicInfo(item);
    const introModule = intro?.kind === 'room' ? item : intro?.kind === 'fusion' ? intro.module : null;
    if (intro?.kind === 'room') spotlight = { id: item, until: n + 14 };
    const chapter = chapterFor(n);
    const pulse = storyPulse(n);
    const P = PULSE[pulse];
    const boss = isBossLevel(n) ? chapter : null;

    const options = [introModule];
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
      * (featured && FAMILY[m] === FAMILY[featured] ? 2 : 1)
      * (bossMods.includes(m) ? 4 : 1)
      * (spotlight && n <= spotlight.until && m === spotlight.id ? 3 : 1);
      plan = makePlan({
      id: `p${n}`, number: n, seedText: `level:${n}`, count: moduleCount(n) + (boss ? 1 : 0), available, world,
      used: new Set(used), // a trial: only the accepted plan's rooms are recorded
      force: featured ?? (boss ? signature : null),
      diff: difficulty(n),
      // Bosses must stand clearly above the line; everything else continues it.
      minLoad: boss ? chainLoad + 1 : Math.max(chainLoad, loadTarget(n, moduleCount(n), available, staples) + P.aimShift * 2),
      aim: 0,
      recent,
      staples,
      weightOf,
      twistChance: P.twistChance,
      twists: boss ? [...new Set([...boss.pressure.filter((t) => t !== 'decoys' || n >= 100), ...(intro?.kind === 'twist' ? [intro.id] : [])])] : null,
      });
      if (plan.droppedForce && introModule) {
        plan = makePlan({
          id: `p${n}`, number: n, seedText: `level:${n}`, count: moduleCount(n) + (boss ? 1 : 0) + 1, available, world,
          used: new Set(used), force: introModule, diff: difficulty(n), minLoad: boss ? chainLoad + 1 : chainLoad,
          aim: 0, recent, staples, weightOf, twistChance: P.twistChance,
          twists: boss ? [...new Set([...boss.pressure, ...(intro?.kind === 'twist' ? [intro.id] : [])])] : null,
        });
      }
      if (!plan.droppedForce) break;
    }
    used.add(plan.modules.join('+'));
    if (!boss) chainLoad = plan.load;
    history.push(plan.modules);
    plan.introduces = item ?? (n === MODULES.escape_room.min ? 'escape_room' : null);
    plan.introName = intro?.name ?? (n === MODULES.escape_room.min ? 'Escape Room' : null);
    plan.introLine = intro?.line ?? null;
    plan.featured = featured && plan.modules.includes(featured) ? featured : null;
    plan.featuredFlavor = featured ? FEATURE_FLAVOR[featured] ?? null : null;
    // Room rules: the new one on its introduction (and fusions), then now and
    // again on any room they suit.
    const ruleRng = makeRng(`rules:${n}`);
    const known = Object.keys(RULES).filter((r) => RULES[r].min <= n);
    plan.rules = [];
    const applyRule = (rule, room) => { if (room >= 0 && !plan.rules.some((x) => x.room === room)) plan.rules.push({ room, rule }); };
    const roomsFor = (rule) => plan.modules.map((m, i) => (RULES[rule].ok(m) && (rule !== 'ice' || !MODULES[m].staple) ? i : -1)).filter((i) => i >= 0);
    if (intro?.kind === 'rule') shuffle(ruleRng, roomsFor(intro.id)).slice(0, 2).forEach((i) => applyRule(intro.id, i));
    else if (intro?.kind === 'fusion') applyRule(intro.rule, plan.modules.indexOf(intro.module));
    else if (known.length && ruleRng() < 0.15 + 0.4 * plan.diff) {
      const rule = pick(ruleRng, known);
      const rooms = roomsFor(rule);
      if (rooms.length) applyRule(rule, pick(ruleRng, rooms));
    }
    plan.chapter = { index: chapter.index, name: chapter.name, tone: chapter.tone, art: chapter.art };
    plan.pulse = pulse;
    plan.beat = getNarrativeBeat(n);
    plan.boss = boss ? {
      chapter: chapter.index, name: boss.name, intro: boss.intro, narrative: boss.narrative,
      reward: boss.reward, pressureText: boss.pressureText ?? null,
    } : null;
    if (boss) plan.name = boss.name;
    // Threat timing: a lockdown on one room. Every boss locks down its finale;
    // in the pressure phase of a chapter about half the levels lock down one
    // of their later rooms. Beat it for a bonus; miss it and the room goes dark.
    const threatRng = makeRng(`threat:${n}`);
    if (n >= 30 && (boss || (pulse === 'pressure' && threatRng() < 0.5))) {
      const room = boss ? plan.modules.length - 1 : 1 + Math.floor(threatRng() * (plan.modules.length - 1));
      const id = plan.modules[room];
      const secs = Math.round((50 + MODULES[id].rating * 14 + (id === 'escape_room' ? 70 : 0)) * (1.15 - 0.35 * plan.diff));
      plan.threat = { room, seconds: secs };
    } else {
      plan.threat = null;
    }
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
  plan.threat = null;
  plan.rules = [];
  return plan;
}
