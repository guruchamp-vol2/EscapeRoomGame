// Everything solid in the game is an axis-aligned box. That keeps collision,
// forced-perspective placement and raycasts cheap and predictable.
import * as THREE from 'three';

export function makeCollider(min, max, tag = '') {
  return { min: min.clone(), max: max.clone(), enabled: true, tag };
}

export function setCollider(c, center, half) {
  c.min.set(center.x - half.x, center.y - half.y, center.z - half.z);
  c.max.set(center.x + half.x, center.y + half.y, center.z + half.z);
}

export function boxesOverlap(aMin, aMax, bMin, bMax, eps = 0) {
  return (
    aMin.x < bMax.x - eps && aMax.x > bMin.x + eps &&
    aMin.y < bMax.y - eps && aMax.y > bMin.y + eps &&
    aMin.z < bMax.z - eps && aMax.z > bMin.z + eps
  );
}

// Slab test. Returns distance along `dir` to the box, or Infinity.
export function rayBox(origin, dir, min, max) {
  let tmin = 0;
  let tmax = Infinity;
  for (const a of ['x', 'y', 'z']) {
    const o = origin[a];
    const d = dir[a];
    if (Math.abs(d) < 1e-9) {
      if (o < min[a] || o > max[a]) return Infinity;
      continue;
    }
    let t1 = (min[a] - o) / d;
    let t2 = (max[a] - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

const _min = new THREE.Vector3();
const _max = new THREE.Vector3();

export function boxIsFree(center, half, colliders, skip, eps = 0.002) {
  _min.copy(center).sub(half);
  _max.copy(center).add(half);
  for (const c of colliders) {
    if (!c.enabled || c === skip) continue;
    if (boxesOverlap(_min, _max, c.min, c.max, eps)) return false;
  }
  return true;
}
