// Long-term progression: stars, Fragments (currency), the Workshop (cosmetics),
// daily quests, the daily streak, rank titles and the Curator's Notes.
// Stored in localStorage, and synced to the server for logged-in players.
import { LEVELS } from './levels/meta.js';
import { WORLDS } from './levels/gen/worlds.js';
import { makeRng, shuffle, irange, todayUTC } from './random.js';

const KEY = 'perspective-lab:progress';
export const STARS_PER_WORLD_GATE = 45; // to open world w you need w × 45 stars

export const RANKS = [
  [0, 'Visitor'], [10, 'Guest'], [40, 'Regular'], [100, 'Member'], [200, 'Patron'], [350, 'Docent'],
  [550, 'Archivist'], [800, 'Curator'], [1100, 'Architect'], [1400, 'Legend'],
];

// ---------- Workshop catalogue ----------
export const SHOP = {
  portal: [
    { id: 'classic', name: 'Classic', price: 0, colors: ['#3aa0ff', '#ff8a1f'] },
    { id: 'aurora', name: 'Aurora', price: 150, colors: ['#3dff9a', '#b06bff'] },
    { id: 'ember', name: 'Ember', price: 200, colors: ['#ff3b3b', '#ffd23d'] },
    { id: 'glacier', name: 'Glacier', price: 250, colors: ['#7ff0ff', '#f4fbff'] },
    { id: 'sakura', name: 'Sakura', price: 300, colors: ['#ff8fc8', '#ffffff'] },
    { id: 'void', name: 'Void', price: 450, colors: ['#8a3dff', '#ff3df0'] },
    { id: 'gilded', name: 'Gilded', price: 700, colors: ['#ffcf3d', '#d8dde3'] },
  ],
  cube: [
    { id: 'companion', name: 'Companion', price: 0, colors: ['#c9ced3', '#ff8a1f'] },
    { id: 'crate', name: 'Crate', price: 120, colors: ['#9a6b3d', '#5c3d1f'] },
    { id: 'neon', name: 'Neon', price: 220, colors: ['#10101a', '#00f0ff'] },
    { id: 'marble', name: 'Marble', price: 280, colors: ['#eeeeee', '#8a8f99'] },
    { id: 'glitch', name: 'Glitch', price: 350, colors: ['#1a0f1f', '#ff2bd6'] },
    { id: 'gold', name: 'Golden', price: 600, colors: ['#ffcf3d', '#a8741a'] },
  ],
  hat: [
    { id: 'none', name: 'Bare', price: 0, colors: ['#3a3f46', '#3a3f46'] },
    { id: 'bow', name: 'Bow', price: 100, colors: ['#ff4f9a', '#ff4f9a'] },
    { id: 'party', name: 'Party Hat', price: 150, colors: ['#ffd23d', '#3aa0ff'] },
    { id: 'propeller', name: 'Propeller', price: 250, colors: ['#ff4040', '#3dff6a'] },
    { id: 'tophat', name: 'Top Hat', price: 300, colors: ['#15171b', '#c0392b'] },
    { id: 'halo', name: 'Halo', price: 400, colors: ['#fff1a8', '#fff1a8'] },
    { id: 'crown', name: 'Crown', price: 800, colors: ['#ffcf3d', '#ff3b3b'] },
  ],
};

// ---------- the Curator's Notes: one hidden per world ----------
export const NOTE_LEVEL_IN_WORLD = 12; // the 13th level of each world hides a note
export const NOTES = [
  'Day 1. They gave me the keys to a building that does not end. I asked how many rooms. The foreman laughed until he cried.',
  'Built WREN today, to help with the floors. It asked me what a floor is for. I said "for standing on". It asked "why".',
  'The Neon wing hums at night. I think the lights are talking to each other. WREN says I am anthropomorphising. WREN would know.',
  'Found a room in the Desert wing with a real sky. I did not build a sky. Nobody built a sky. It was just there, waiting.',
  'Cold today. The Arctic wing has started making its own snow. I have stopped asking the building for permission.',
  'The plants in the Greenhouse grow towards the exits. Even they want out. I water them anyway.',
  'Every book in the Library is the same book. It is a book about this museum. Page 4,212 describes me reading page 4,212.',
  'The Void wing forgot itself again. WREN put the floor back. I told it to stop. If a room wants to be forgotten, let it.',
  'My daughter designed Candyland. She was nine. She said rooms should be "sticky so people stay". She was right. That frightens me.',
  'The Foundry pours rooms now. Molten corridors, cooled into shape. I did not teach it to do that.',
  'Went down to Abyssal. The pressure is not water. It is attention. Something down there is paying very close attention.',
  'Hosted a party in the Art Deco wing. Nobody came. The music played anyway. Somebody danced. It was not me.',
  'The Cyber Grid compiled a new wing overnight. It is perfect. It is empty. It has my name on the door.',
  'Golden hour in the Atrium has lasted eleven years. WREN did that for me. I never told it I hate sunsets.',
  'The statues in the Moonlit Gallery have moved. Only a little. Only when I am writing. Like now.',
  'The crystals sing one chord short of a song. I think the missing note is a door. I think I know where it is.',
  'Volcanic wing. The floor is not lava. The floor is a promise of lava. That is worse.',
  'Folded myself a paper room in Origami. It fits perfectly. I could stay in here. I could stay in here forever.',
  'Chrome Hall shows you yourself, a little late. Today my reflection did not follow me out.',
  'WREN, if you find this: the last room has no exit. Build one. Then let them leave. Do not keep them. Do not keep me. Love, the Curator.',
];

// ---------- daily quests ----------
const QUESTS = [
  { kind: 'complete', make: (r) => { const n = irange(r, 3, 5); return { text: `Complete ${n} levels`, goal: n, reward: 40 }; } },
  { kind: 'stars3', make: (r) => { const n = irange(r, 1, 2); return { text: `Earn 3 stars on ${n} level${n > 1 ? 's' : ''}`, goal: n, reward: 50 }; } },
  { kind: 'nohint', make: () => ({ text: 'Finish a level without hints', goal: 1, reward: 30 }) },
  { kind: 'portal', make: (r) => { const n = irange(r, 3, 6) * 5; return { text: `Fire ${n} portals`, goal: n, reward: 30 }; } },
  { kind: 'teleport', make: (r) => { const n = irange(r, 4, 8) * 5; return { text: `Teleport ${n} times`, goal: n, reward: 30 }; } },
  { kind: 'giant', make: () => ({ text: 'Grow a cube to 4 m', goal: 1, reward: 25 }) },
  { kind: 'daily', make: () => ({ text: "Beat today's daily challenge", goal: 1, reward: 60 }) },
  { kind: 'world', make: (r, p) => {
    const open = WORLDS.map((w, i) => i).filter((i) => p.isWorldOpen(i));
    const w = open[Math.floor(r() * open.length)] ?? 0;
    return { text: `Complete a level in ${WORLDS[w].name}`, goal: 1, reward: 35, world: w };
  } },
];

function blank() {
  return {
    v: 1, stars: {}, fragments: 0, earned: 0,
    owned: ['portal:classic', 'cube:companion', 'hat:none'],
    equipped: { portal: 'classic', cube: 'companion', hat: 'none' },
    streak: { count: 0, last: null }, quests: null, notes: [], stats: {}, chapters: [], chaptersRead: [], updatedAt: 0,
  };
}

const yesterday = (date) => new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

export class Progress {
  constructor({ onChange }) {
    this.onChange = onChange;
    this.data = blank();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && saved.v === 1) this.data = { ...blank(), ...saved };
    } catch {
      // Fresh start.
    }
    this.today = todayUTC();
  }

  save() {
    this.data.updatedAt = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable.
    }
    this.onChange?.(this);
  }

  // Merge server progress into local: keep the best of both.
  merge(remote) {
    if (!remote || remote.v !== 1) return;
    const d = this.data;
    for (const [id, s] of Object.entries(remote.stars ?? {})) d.stars[id] = Math.max(d.stars[id] ?? 0, s);
    d.owned = [...new Set([...d.owned, ...(remote.owned ?? [])])];
    d.notes = [...new Set([...d.notes, ...(remote.notes ?? [])])];
    d.chapters = [...new Set([...(d.chapters ?? []), ...(remote.chapters ?? [])])];
    d.chaptersRead = [...new Set([...(d.chaptersRead ?? []), ...(remote.chaptersRead ?? [])])];
    for (const [k, v] of Object.entries(remote.stats ?? {})) if (typeof v === 'number') d.stats[k] = Math.max(d.stats[k] ?? 0, v);
    if ((remote.updatedAt ?? 0) > d.updatedAt) {
      d.fragments = remote.fragments;
      d.earned = remote.earned;
      d.equipped = { ...d.equipped, ...remote.equipped };
      d.streak = remote.streak ?? d.streak;
      d.quests = remote.quests ?? d.quests;
    } else {
      d.earned = Math.max(d.earned, remote.earned ?? 0);
    }
    this.save();
  }

  // Story chapters: beaten (boss cleared) and read (journal opened).
  reachChapter(n) {
    if (!n) return;
    this.data.chapters ??= [];
    if (!this.data.chapters.includes(n)) { this.data.chapters.push(n); this.save(); }
  }

  readChapter(n) {
    if (!n) return;
    this.data.chaptersRead ??= [];
    if (!this.data.chaptersRead.includes(n)) { this.data.chaptersRead.push(n); this.save(); }
  }

  // Lifetime counters (play time, distance, jumps…). Saved with the next save().
  stat(name, n = 1) {
    this.data.stats[name] = (this.data.stats[name] ?? 0) + n;
  }

  // ---------- stars, ranks, unlocks ----------
  get totalStars() {
    return Object.values(this.data.stars).reduce((a, b) => a + b, 0);
  }

  rank() {
    const s = this.totalStars;
    let title = RANKS[0][1], next = null;
    for (const [need, name] of RANKS) {
      if (s >= need) title = name;
      else { next = { need, name }; break; }
    }
    return { title, stars: s, next };
  }

  worldGate(w) {
    return w * STARS_PER_WORLD_GATE;
  }

  isWorldOpen(w) {
    return this.totalStars >= this.worldGate(w);
  }

  // Par times: 3 stars for a quick, hint-free run; 2 for a decent one.
  static parFor(meta) {
    const base = Math.max(25_000, (meta.minMs ?? 10_000) * 4);
    return { three: base, two: base * 2 };
  }

  static starsFor(meta, timeMs, hints) {
    const par = Progress.parFor(meta);
    if (timeMs <= par.three && hints === 0) return 3;
    if (timeMs <= par.two && hints <= 1) return 2;
    return 1;
  }

  // Records a finished level. Returns what was earned.
  complete(meta, { timeMs, hints, daily }) {
    const d = this.data;
    const stars = Progress.starsFor(meta, timeMs, hints);
    const id = daily ? null : meta.id;
    const before = id ? d.stars[id] ?? 0 : 0;
    const first = id ? before === 0 : false;
    const gained = Math.max(0, stars - before);
    if (id) d.stars[id] = Math.max(before, stars);
    let fragments = (first ? 20 : 5) + gained * 10 + (daily ? 40 : 0);
    // Streak: play on consecutive days.
    let streakBonus = 0;
    if (d.streak.last !== this.today) {
      d.streak.count = d.streak.last === yesterday(this.today) ? d.streak.count + 1 : 1;
      d.streak.last = this.today;
      streakBonus = Math.min(7, d.streak.count) * 10;
      fragments += streakBonus;
    }
    d.fragments += fragments;
    d.earned += fragments;
    const quests = this.event('complete', { meta, stars, hints, daily });
    this.save();
    return { stars, gained, first, fragments, streakBonus, streak: d.streak.count, quests };
  }

  // ---------- quests ----------
  quests() {
    const d = this.data;
    if (!d.quests || d.quests.date !== this.today) {
      const r = makeRng(`quests:${this.today}`);
      d.quests = {
        date: this.today,
        list: shuffle(r, QUESTS).slice(0, 3).map((q) => ({ kind: q.kind, ...q.make(r, this), progress: 0, done: false })),
      };
      this.save();
    }
    return d.quests.list;
  }

  // Advances quests; returns the ones completed by this event.
  event(kind, info = {}) {
    const finished = [];
    for (const q of this.quests()) {
      if (q.done) continue;
      let inc = 0;
      if (kind === 'complete') {
        if (q.kind === 'complete') inc = 1;
        if (q.kind === 'stars3' && info.stars === 3) inc = 1;
        if (q.kind === 'nohint' && info.hints === 0) inc = 1;
        if (q.kind === 'daily' && info.daily) inc = 1;
        if (q.kind === 'world' && info.meta?.world === q.world) inc = 1;
      } else if (kind === q.kind) {
        inc = info.amount ?? 1;
      }
      if (!inc) continue;
      q.progress = Math.min(q.goal, q.progress + inc);
      if (q.progress >= q.goal) {
        q.done = true;
        this.data.fragments += q.reward;
        this.data.earned += q.reward;
        finished.push(q);
      }
    }
    if (finished.length || kind !== 'complete') this.save();
    return finished;
  }

  // ---------- shop ----------
  owns(slot, id) {
    return this.data.owned.includes(`${slot}:${id}`);
  }

  buy(slot, id) {
    const item = SHOP[slot].find((i) => i.id === id);
    if (!item || this.owns(slot, id)) return false;
    if (this.data.fragments < item.price) return false;
    this.data.fragments -= item.price;
    this.data.owned.push(`${slot}:${id}`);
    this.data.equipped[slot] = id;
    this.save();
    return true;
  }

  equip(slot, id) {
    if (!this.owns(slot, id)) return false;
    this.data.equipped[slot] = id;
    this.save();
    return true;
  }

  equipped(slot) {
    return SHOP[slot].find((i) => i.id === this.data.equipped[slot]) ?? SHOP[slot][0];
  }

  // ---------- notes ----------
  hasNote(w) {
    return this.data.notes.includes(w);
  }

  collectNote(w) {
    if (this.hasNote(w)) return false;
    this.data.notes.push(w);
    this.data.fragments += 50;
    this.data.earned += 50;
    this.save();
    return true;
  }
}

// The level "Continue" should start: the first unlocked level without stars,
// or the furthest unlocked one if everything open is already cleared.
export function continueId(progress) {
  let pick = LEVELS[0];
  for (let i = 0; i < LEVELS.length; i++) {
    if (!levelUnlocked(progress, i)) break;
    pick = LEVELS[i];
    if (!progress.data.stars[LEVELS[i].id]) break;
  }
  return pick.id;
}

// Level unlock rule: the previous level must be complete, and the first level
// of each world needs enough stars.
export function levelUnlocked(progress, index) {
  if (index === 0) return true;
  const prev = LEVELS[index - 1];
  if (!progress.data.stars[prev.id]) return false;
  const l = LEVELS[index];
  if (!l.story && l.world > 0 && LEVELS[index - 1].world !== l.world) return progress.isWorldOpen(l.world);
  return true;
}
