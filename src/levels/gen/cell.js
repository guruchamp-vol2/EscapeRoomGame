// A "cell" is one room of a generated level, holding one puzzle module. Cells
// run north (-Z) one after another. Each has an open entrance in its south wall
// and an exit door in its north wall that opens when its puzzle is solved.
// Floors can rise: a module may put its exit up on a ledge (`exitY`), and the
// next cell starts at that height.
import * as THREE from 'three';
import { signTexture } from '../../textures.js';

export const T = 0.4; // wall thickness
export const DOOR_W = 1.6;
export const DOOR_H = 2.6;
export const CONNECTOR = 3; // corridor length between cells

export class Cell {
  constructor(b, { index, count, z0, y0, w, d, h, exitY = 0, floorGaps = [], dark = false, ceiling, variant, connector = CONNECTOR }) {
    Object.assign(this, { b, index, y0, w, d, h, exitY, connectorLength: connector, floorGaps });
    this.x0 = -w / 2;
    this.x1 = w / 2;
    this.zS = z0;
    this.zN = z0 - d;
    this.hasCeiling = ceiling ?? !b.theme.sky;
    this.lamps = [];
    this.dark = dark;
    const base = variant ? { ...b.mat, ...variant } : b.mat;
    const m = dark ? this._darkMaterials(base) : base;
    this.mat = m;
    const { x0, x1, zS, zN } = this;
    const ex = DOOR_W / 2;

    // Floor, in segments around any pits.
    const gaps = [...floorGaps].sort((a, b2) => b2[1] - a[1]); // [zLow, zHigh], north to south order
    let top = zS + T;
    for (const [lo, hi] of gaps) {
      if (hi < top) b.box(x0 - T, y0 - 0.4, hi, x1 + T, y0, top, m.floor, { tile: 4 });
      top = lo;
    }
    if (top > zN - T) b.box(x0 - T, y0 - 0.4, zN - T, x1 + T, y0, top, m.floor, { tile: 4 });

    if (this.hasCeiling) b.box(x0 - T, y0 + h, zN - T, x1 + T, y0 + h + 0.4, zS + T, m.ceiling);

    // Walls.
    const wallLo = y0 - 0.4;
    this.walls = {
      w: b.box(x0 - T, wallLo, zN - T, x0, y0 + h, zS + T, m.wall).userData.collider,
      e: b.box(x1, wallLo, zN - T, x1 + T, y0 + h, zS + T, m.wall).userData.collider,
      sW: b.box(x0, wallLo, zS, -ex, y0 + h, zS + T, m.wall).userData.collider,
      sE: b.box(ex, wallLo, zS, x1, y0 + h, zS + T, m.wall).userData.collider,
      nW: b.box(x0, wallLo, zN - T, -ex, y0 + h, zN, m.wall).userData.collider,
      nE: b.box(ex, wallLo, zN - T, x1, y0 + h, zN, m.wall).userData.collider,
    };
    if (h > DOOR_H) b.box(-ex, y0 + DOOR_H, zS, ex, y0 + h, zS + T, m.wall);
    if (exitY > 0) b.box(-ex, wallLo, zN - T, ex, y0 + exitY, zN, m.wall);
    if (h > exitY + DOOR_H) b.box(-ex, y0 + exitY + DOOR_H, zN - T, ex, y0 + h, zN, m.wall);

    // Exit door slides sideways into the wall.
    const dy = y0 + exitY;
    this.door = b.door(-ex, dy, zN - 0.3, ex, dy + DOOR_H, zN - 0.1, [DOOR_W + 0.1, 0, 0]);
    const glow = b.mat.accent;
    b.strip(-ex - 0.08, dy, zN + 0.005, -ex, dy + DOOR_H + 0.08, zN + 0.02, glow);
    b.strip(ex, dy, zN + 0.005, ex + 0.08, dy + DOOR_H + 0.08, zN + 0.02, glow);
    b.strip(-ex - 0.08, dy + DOOR_H, zN + 0.005, ex + 0.08, dy + DOOR_H + 0.08, zN + 0.02, glow);
    b.sign(signTexture([{ text: `${index + 1} / ${count}`, size: 64 }], { w: 256, h: 96, bg: '#0b0d10', fg: b.theme.accent }),
      0.8, 0.3, 0, dy + DOOR_H + 0.35, zN + 0.02, 0, { glow: 1.3 });

    // Trim: ceiling edge and baseboards.
    const s = 0.05;
    if (this.hasCeiling) {
      b.strip(x0, y0 + h - s, zN, x0 + s, y0 + h, zS, glow);
      b.strip(x1 - s, y0 + h - s, zN, x1, y0 + h, zS, glow);
    }
    b.strip(x0, y0, zN, x0 + 0.03, y0 + 0.06, zS, glow);
    b.strip(x1 - 0.03, y0, zN, x1, y0 + 0.06, zS, glow);

    this._lights();
    const vol = w * d;
    b.particles(b.theme.particles, [x0, y0 + 0.2, zN], [x1, y0 + h - 0.2, zS], Math.min(260, Math.round(vol * 0.9)));
  }

  _darkMaterials(mat) {
    this.darkened = [];
    const dim = (m) => {
      const c = m.clone();
      c.userData.fullColor = c.color.clone();
      c.color.multiplyScalar(0.06);
      this.darkened.push(c);
      return c;
    };
    return { ...mat, wall: dim(mat.wall), floor: dim(mat.floor), ceiling: dim(mat.ceiling) };
  }

  _lights() {
    const { b, y0, h, zS, zN } = this;
    const cz = (zS + zN) / 2;
    const theme = b.theme;
    const lampI = THREE.MathUtils.clamp(this.w * this.d * 0.14, 16, 48);
    if (this.hasCeiling) {
      const zs = this.d > 15 ? [cz + this.d / 4, cz - this.d / 4] : [cz];
      for (const z of zs) this.lamps.push(b.lamp(0, y0 + h, z, lampI, theme.lampColor));
      this.key = b.keyLight([1.5, y0 + h - 0.15, cz + 2], [0, y0, cz - 1], {
        intensity: 22 * h, angle: 1.25, color: theme.keyColor, mapSize: 1024,
      });
    } else {
      // Open sky: a "sun" high above plus a soft fill lamp.
      this.key = b.keyLight([7, y0 + h + 14, cz + 6], [0, y0, cz], {
        intensity: 900, angle: 0.75, color: theme.keyColor, mapSize: 1024,
      });
      const fill = new THREE.PointLight(theme.lampColor, lampI * 0.6, 0, 2);
      fill.position.set(0, y0 + h - 0.5, cz);
      b.scene.add(fill);
      this.lamps.push(fill);
    }
    if (this.dark) {
      this.lampIntensity = this.lamps.map((l) => l.intensity);
      this.keyIntensity = this.key.intensity;
      for (const l of this.lamps) l.intensity = 0;
      this.key.intensity = 0;
    }
  }

  // Dark rooms: ramp lights and surfaces up to normal.
  lightsOn() {
    let t = 0;
    this.b.updaters.push((dt) => {
      if (t >= 1) return;
      t = Math.min(1, t + dt * 1.5);
      this.lamps.forEach((l, i) => (l.intensity = this.lampIntensity[i] * t));
      this.key.intensity = this.keyIntensity * t;
      for (const m of this.darkened) m.color.copy(m.userData.fullColor).multiplyScalar(0.06 + 0.94 * t);
    });
  }

  contains(p) {
    return p.z < this.zS && p.z > this.zN && p.x > this.x0 && p.x < this.x1 && p.y > this.y0 - 1 && p.y < this.y0 + this.h;
  }

  // Corridor from this cell's exit to the next cell's entrance.
  connector() {
    const { b, zN } = this;
    const y = this.y0 + this.exitY;
    const z1 = zN - T, z0 = z1 - this.connectorLength;
    const m = this.mat.wall === b.mat.wall ? b.mat : { ...b.mat, wall: this.mat.wall, floor: this.mat.floor };
    b.box(-1.6, y - 0.4, z0, 1.6, y, z1, m.floor, { tile: 2 });
    b.box(-1.6, y, z0, -1.2, y + 3, z1, m.wall);
    b.box(1.2, y, z0, 1.6, y + 3, z1, m.wall);
    b.box(-1.6, y + 3, z0, 1.6, y + 3.3, z1, m.ceiling);
    b.strip(-1.2, y, z0, -1.17, y + 0.06, z1);
    b.strip(1.17, y, z0, 1.2, y + 0.06, z1);
    return { z: z0 - T, y };
  }
}
