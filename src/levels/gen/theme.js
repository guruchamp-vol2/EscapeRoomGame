// Turns a world definition into concrete materials and lighting for one level.
// Each level jitters the world's colours and sometimes swaps a pattern, so the
// 25 levels of a world share a mood without looking identical.
import * as THREE from 'three';
import { WORLDS } from './worlds.js';
import { patternTexture } from '../../textures.js';
import { makeRng, hashString, pick } from '../../random.js';

const STYLES = ['tile', 'brick', 'hex', 'planks', 'marble', 'circuit', 'stripes', 'checker', 'concrete', 'plates', 'dots', 'herringbone', 'grid', 'waves'];

function jitter(hex, rng, amount = 0.035) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL((hsl.h + (rng() - 0.5) * amount * 2 + 1) % 1, THREE.MathUtils.clamp(hsl.s + (rng() - 0.5) * amount * 3, 0, 1),
    THREE.MathUtils.clamp(hsl.l + (rng() - 0.5) * amount * 2, 0.02, 0.95));
  return `#${c.getHexString()}`;
}

export function worldTheme(plan) {
  const w = WORLDS[plan.world];
  const rng = makeRng(`theme:${plan.seed}`);
  const seed = hashString(plan.seed);

  const wallStyle = rng() < 0.2 ? pick(rng, STYLES) : w.wall.style;
  const floorStyle = rng() < 0.25 ? pick(rng, STYLES) : w.floor.style;
  const wallBase = jitter(w.wall.base, rng), wallLine = jitter(w.wall.line, rng);
  const floorBase = jitter(w.floor.base, rng), floorLine = jitter(w.floor.line, rng);
  // Each story chapter tints the world towards its own colour.
  const tint = plan.chapter?.art?.tint;
  const toward = (hex, k) => (tint ? `#${new THREE.Color(hex).lerp(new THREE.Color(tint), k).getHexString()}` : hex);
  const accent = toward(jitter(w.accent, rng, 0.02), 0.35);
  const fog = w.light.fog ? jitter(w.light.fog, rng, 0.02) : (w.sky ? w.sky.horizon : '#05070a');

  const surface = (style, base, line, metal = 0.05, s) => new THREE.MeshStandardMaterial({
    map: patternTexture(style, base, line, s), roughness: metal > 0.5 ? 0.3 : 0.85, metalness: metal,
  });

  // Each room in a level gets a variation: a different pattern and a hue shift,
  // so a 5-room level isn't five copies of the same box.
  const variants = new Map();
  const variant = (i) => {
    if (i === 0) return null;
    if (!variants.has(i)) {
      const vr = makeRng(`variant:${plan.seed}:${i}`);
      const shift = (hex) => jitter(hex, vr, 0.09);
      variants.set(i, {
        wall: surface(pick(vr, STYLES), shift(wallBase), shift(wallLine), w.wall.metal ?? 0.05, seed + i * 7),
        floor: surface(vr() < 0.5 ? floorStyle : pick(vr, STYLES), shift(floorBase), shift(floorLine), w.floor.metal ?? 0.1, seed + i * 11),
      });
    }
    return variants.get(i);
  };

  return {
    variant,
    world: w,
    worldIndex: plan.world,
    name: w.name,
    wall: wallBase,
    wallLine,
    floor: floorBase,
    floorLine,
    ceiling: w.ceiling ?? '#000000',
    accent,
    fog,
    fogDensity: w.light.fog ? 0.012 + rng() * 0.012 : 0,
    hemi: w.light.hemi,
    keyColor: toward(jitter(w.light.key, rng, 0.02), 0.2),
    lampColor: toward(jitter(w.light.lamp, rng, 0.03), 0.25),
    chapterArt: plan.chapter?.art ?? null,
    exposure: w.light.exposure,
    bloom: w.bloom,
    sky: w.sky ?? null,
    particles: w.particles,
    decor: w.decor,
    mat: {
      wall: surface(wallStyle, wallBase, wallLine, w.wall.metal ?? 0.05, seed),
      floor: surface(floorStyle, floorBase, floorLine, w.floor.metal ?? 0.1, seed + 1),
      ceiling: new THREE.MeshStandardMaterial({ color: w.ceiling ?? '#000000', roughness: 1 }),
    },
  };
}
