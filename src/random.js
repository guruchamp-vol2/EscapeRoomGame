// Deterministic randomness, so generated levels and the daily challenge are
// identical for everyone. DOM-free (the server imports this too).

// Mulberry32: tiny, fast, good enough for gameplay.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Today's challenge date in UTC, e.g. "2026-10-05".
export function todayUTC(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function makeRng(seedText) {
  return seedText ? mulberry32(hashString(seedText)) : Math.random;
}

export function randomCode(rng, digits = 3) {
  return Array.from({ length: digits }, () => Math.floor(rng() * 10)).join('');
}

// Helpers that take an rng.
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const range = (rng, lo, hi) => lo + rng() * (hi - lo);
export const irange = (rng, lo, hi) => Math.floor(lo + rng() * (hi - lo + 1));
export function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
