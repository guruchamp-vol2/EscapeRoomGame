// Superliminal-style forced perspective.
//
// A held object keeps the same *apparent* size on screen. Each frame we push it
// as far along the view ray as it can go without intersecting anything, scaling
// it linearly with distance. Look at a far wall and a pebble becomes a boulder.
import * as THREE from 'three';
import { boxIsFree, rayBox, setCollider } from './physics.js';

const MAX_SIZE = 4.5;
const MIN_SIZE = 0.08;
const MIN_DIST = 0.45;
const GRAVITY = 20;

export class PerspectiveCube {
  constructor(mesh, size, collider) {
    this.mesh = mesh;
    this.size = size;
    this.collider = collider;
    this.vy = 0;
    this.held = false;
    this.home = mesh.position.clone();
    this.homeSize = size;
    this.sync();
  }

  get half() {
    return new THREE.Vector3(this.size / 2, this.size / 2, this.size / 2);
  }

  sync() {
    this.mesh.scale.setScalar(this.size);
    setCollider(this.collider, this.mesh.position, this.half);
  }

  resetHome() {
    this.mesh.position.copy(this.home);
    this.size = this.homeSize;
    this.vy = 0;
    this.sync();
  }
}

export class Grabber {
  constructor() {
    this.held = null;
    this.d0 = 1;
    this.s0 = 1;
    this._center = new THREE.Vector3();
    this._half = new THREE.Vector3();
  }

  grab(cube, eye) {
    this.held = cube;
    cube.held = true;
    cube.collider.enabled = false;
    this.d0 = cube.mesh.position.distanceTo(eye);
    this.s0 = cube.size;
  }

  drop() {
    const cube = this.held;
    if (!cube) return null;
    cube.held = false;
    cube.vy = 0;
    cube.collider.enabled = true;
    cube.sync();
    this.held = null;
    return cube;
  }

  update(eye, dir, colliders) {
    const cube = this.held;
    if (!cube) return;
    const ratio = this.s0 / this.d0; // size per metre of distance — constant while held

    // Distance to the first solid thing along the view ray.
    let hit = 80;
    for (const c of colliders) {
      if (!c.enabled || c === cube.collider) continue;
      const t = rayBox(eye, dir, c.min, c.max);
      if (t < hit) hit = t;
    }

    let lo = Math.max(MIN_DIST, MIN_SIZE / ratio);
    let hi = Math.min(hit, MAX_SIZE / ratio);
    if (hi < lo) hi = lo;

    const fits = (d) => {
      this._center.copy(dir).multiplyScalar(d).add(eye);
      this._half.setScalar((ratio * d) / 2);
      return boxIsFree(this._center, this._half, colliders, cube.collider);
    };

    let d = lo;
    if (fits(hi)) {
      d = hi;
    } else if (fits(lo)) {
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid; else hi = mid;
      }
      d = lo;
    }

    cube.mesh.position.copy(dir).multiplyScalar(d).add(eye);
    cube.size = ratio * d;
    cube.sync();
  }

  // Released cubes fall straight down until they land on something.
  static simulate(cube, dt, colliders) {
    if (cube.held) return;
    cube.vy -= GRAVITY * dt;
    const pos = cube.mesh.position;
    const h = cube.size / 2;
    const prevBottom = pos.y - h;
    let bottom = prevBottom + cube.vy * dt;
    // Only land on things we're genuinely above (placement allows tiny side overlaps).
    for (const c of colliders) {
      if (!c.enabled || c === cube.collider) continue;
      const ox = Math.min(pos.x + h, c.max.x) - Math.max(pos.x - h, c.min.x);
      const oz = Math.min(pos.z + h, c.max.z) - Math.max(pos.z - h, c.min.z);
      if (ox <= 0.01 || oz <= 0.01) continue;
      if (prevBottom >= c.max.y - 0.05 && bottom < c.max.y) {
        bottom = c.max.y;
        cube.vy = 0;
      }
    }
    pos.y = bottom + h;
    cube.sync();
  }
}
