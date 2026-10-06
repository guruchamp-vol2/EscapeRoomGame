import * as THREE from 'three';
import { boxesOverlap } from './physics.js';

const GRAVITY = 22;
const WALK_SPEED = 4.5;
const SPRINT_SPEED = 7;
const JUMP_SPEED = 7.2;
const STEP_HEIGHT = 0.35;
const EPS = 0.001;

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(); // feet
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.3;
    this.height = 1.75;
    this.eyeHeight = 1.6;
    this.onGround = false;
    this._min = new THREE.Vector3();
    this._max = new THREE.Vector3();
  }

  spawn(pos, yaw) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
  }

  eye(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }

  center(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + this.height / 2, this.pos.z);
  }

  look(dx, dy, sensitivity = 1, invertY = false) {
    const k = 0.0022 * sensitivity;
    this.yaw -= dx * k;
    this.pitch -= (invertY ? -dy : dy) * k;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
  }

  // Positions the camera at the eye, plus purely visual head bob, sway and a
  // dip on landing. `bob` scales the effect (0 turns it off).
  applyCamera(dt = 0, bob = 1) {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const target = this.onGround && speed > 0.5 ? Math.min(speed / 4.5, 1.4) * bob : 0;
    this.bobAmount = (this.bobAmount ?? 0) + (target - (this.bobAmount ?? 0)) * Math.min(1, dt * 8);
    this.bobPhase = (this.bobPhase ?? 0) + dt * speed * 1.9;
    if (this.landImpact > 3) this.landDip = Math.min(0.22, this.landImpact * 0.018) * bob;
    this.landDip = (this.landDip ?? 0) * Math.exp(-dt * 7);

    const a = this.bobAmount;
    const sway = Math.cos(this.bobPhase) * 0.025 * a;
    this.eye(this.camera.position);
    this.camera.position.x += Math.cos(this.yaw) * sway;
    this.camera.position.z -= Math.sin(this.yaw) * sway;
    this.camera.position.y += Math.sin(this.bobPhase * 2) * 0.035 * a - this.landDip;
    this.camera.rotation.set(this.pitch, this.yaw, Math.cos(this.bobPhase) * 0.004 * a, 'YXZ');
    this.camera.updateMatrixWorld();
  }

  forward(out = new THREE.Vector3()) {
    return this.camera.getWorldDirection(out);
  }

  _bounds() {
    const r = this.radius;
    this._min.set(this.pos.x - r, this.pos.y, this.pos.z - r);
    this._max.set(this.pos.x + r, this.pos.y + this.height, this.pos.z + r);
  }

  _overlapping(colliders, ignore) {
    this._bounds();
    for (const c of colliders) {
      if (!c.enabled || ignore.has(c)) continue;
      if (boxesOverlap(this._min, this._max, c.min, c.max, EPS)) return c;
    }
    return null;
  }

  update(dt, keys, colliders, ignore) {
    // Input → desired horizontal velocity.
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let mx = 0, mz = 0;
    if (keys.has('KeyW')) { mx += fx; mz += fz; }
    if (keys.has('KeyS')) { mx -= fx; mz -= fz; }
    if (keys.has('KeyD')) { mx += rx; mz += rz; }
    if (keys.has('KeyA')) { mx -= rx; mz -= rz; }
    const len = Math.hypot(mx, mz);
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPRINT_SPEED : WALK_SPEED;
    if (len > 0) { mx = (mx / len) * speed; mz = (mz / len) * speed; }

    const accel = this.onGround ? 14 : 2.5;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (mx - this.vel.x) * k;
    this.vel.z += (mz - this.vel.z) * k;

    // Events for sound/feedback, read by the game after update().
    this.jumped = false;
    this.landImpact = 0;
    if (this.onGround && keys.has('Space')) {
      this.vel.y = JUMP_SPEED;
      this.jumped = true;
    }
    this.vel.y -= GRAVITY * dt;

    this._depenetrate(colliders, ignore);
    this._moveAxis('x', this.vel.x * dt, colliders, ignore);
    this._moveAxis('z', this.vel.z * dt, colliders, ignore);
    const wasOnGround = this.onGround;
    const fallSpeed = -this.vel.y;
    this.onGround = false;
    this._moveAxis('y', this.vel.y * dt, colliders, ignore);
    if (!wasOnGround && this.onGround) this.landImpact = fallSpeed;
  }

  // Something (e.g. a dropped giant cube) may have appeared inside us. Push out
  // along the axis of least penetration, preferring up.
  _depenetrate(colliders, ignore) {
    for (let i = 0; i < 4; i++) {
      const c = this._overlapping(colliders, ignore);
      if (!c) return;
      const pushes = [
        { axis: 'y', d: c.max.y - this._min.y },
        { axis: 'x', d: c.max.x - this._min.x },
        { axis: 'x', d: c.min.x - this._max.x },
        { axis: 'z', d: c.max.z - this._min.z },
        { axis: 'z', d: c.min.z - this._max.z },
      ];
      pushes.sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
      const p = pushes[0];
      this.pos[p.axis] += p.d + Math.sign(p.d) * EPS;
    }
  }

  _moveAxis(axis, delta, colliders, ignore) {
    if (delta === 0) return;
    this.pos[axis] += delta;
    this._bounds();
    for (const c of colliders) {
      if (!c.enabled || ignore.has(c)) continue;
      if (!boxesOverlap(this._min, this._max, c.min, c.max, EPS)) continue;

      if (axis === 'y') {
        if (delta < 0) {
          this.pos.y = c.max.y;
          this.onGround = true;
        } else {
          this.pos.y = c.min.y - this.height - EPS;
        }
        this.vel.y = 0;
        this._bounds();
        continue;
      }

      // Try stepping up small ledges (pressure plate, low steps).
      const rise = c.max.y - this.pos.y;
      if (rise > 0 && rise <= STEP_HEIGHT) {
        const oldY = this.pos.y;
        this.pos.y = c.max.y + EPS;
        if (!this._overlapping(colliders, ignore)) continue;
        this.pos.y = oldY;
        this._bounds();
      }

      if (delta > 0) this.pos[axis] = c.min[axis] - this.radius - EPS;
      else this.pos[axis] = c.max[axis] + this.radius + EPS;
      this.vel[axis] = 0;
      this._bounds();
    }
  }
}
