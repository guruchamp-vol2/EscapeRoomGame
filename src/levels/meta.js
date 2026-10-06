// Every level in order: 4 hand-made chambers, then 500 generated ones.
// Shared by the client and the server (which validates level ids), so it must
// stay free of three.js / DOM imports.
//
// `minMs` is the fastest plausible human time; the server rejects anything
// quicker. Keep it below what a skilled speedrunner could manage.
import { generatedPlans, dailyPlan } from './gen/plan.js';
import { WORLDS } from './gen/worlds.js';

const STORY = [
  { id: 'scale', number: 1, name: 'Scale', tagline: 'Things are only as big as they look.', minMs: 5_000 },
  { id: 'gateway', number: 2, name: 'Gateway', tagline: 'Two holes, one room.', minMs: 4_000 },
  { id: 'loop', number: 3, name: 'The Loop', tagline: 'Every room looks the same. Look closer.', minMs: 20_000 },
  { id: 'lab', number: 4, name: 'Perspective Lab', tagline: 'Nothing here is quite what it looks like.', minMs: 12_000 },
].map((l) => ({ ...l, world: -1, story: true }));

export const LEVELS = [
  ...STORY,
  ...generatedPlans().map((p) => ({
    id: p.id, number: p.number, name: p.name, tagline: p.tagline, minMs: p.minMs, world: p.world, plan: p,
  })),
];

// Level-select groups: the story chambers, then one group per world.
export const GROUPS = [
  { name: 'Story', tagline: 'Where it all begins.', levels: STORY },
  ...WORLDS.map((w, i) => ({ name: w.name, tagline: w.tagline, levels: LEVELS.filter((l) => l.world === i) })),
];

export const DAILY_ID = 'daily';
export const LEVEL_IDS = new Set([...LEVELS.map((l) => l.id), DAILY_ID]);
const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

export function levelMeta(id, date) {
  if (id === DAILY_ID) {
    const p = dailyPlan(date);
    return { id, number: 0, name: p.name, tagline: p.tagline, minMs: p.minMs, world: p.world, plan: p, daily: true };
  }
  return BY_ID.get(id);
}

export function minRunMs(id, date) {
  return levelMeta(id, date)?.minMs ?? 60_000;
}
