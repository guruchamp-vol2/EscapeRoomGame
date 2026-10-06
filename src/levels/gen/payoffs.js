// Dramatic room-state transformations when a puzzle is solved.
import * as THREE from 'three';

export class PayoffManager {
  constructor(b, ctx, levelState) {
    this.b = b;
    this.ctx = ctx;
    this.levelState = levelState;
    this.solveCallbacks = new Map();
  }

  onRoomSolved(roomIndex, callback) {
    this.solveCallbacks.set(roomIndex, callback);
  }

  triggerRoomSolved(data) {
    const { roomIndex } = data;
    const callback = this.solveCallbacks.get(roomIndex);
    if (callback) callback(data);
    else if (data.cell) {
      // Default payoff: sparks fly from the room's exit door as it opens.
      const c = data.cell;
      this.particleExplosion([0, c.y0 + c.exitY + 2.4, c.zN + 0.3], 46, 3.2, this.b.theme.accent);
    }
  }

  async wallOpening(wall, direction = 'up', duration = 1.5) {
    const startY = wall.position.y;
    const endY = startY + (direction === 'up' ? 2.5 : -2.5);
    let elapsed = 0;

    this.b.ctx?.sfx?.play?.('door');

    return new Promise((resolve) => {
      const animate = (dt) => {
        elapsed += dt;
        const t = Math.min(1, elapsed / duration);
        wall.position.y = startY + (endY - startY) * t;
        if (t >= 1) {
          this.b.updaters = this.b.updaters.filter((u) => u !== animate);
          resolve();
        }
      };
      this.b.updaters.push(animate);
    });
  }

  // A burst of sparks: one Points object, one updater, removed when done.
  particleExplosion(pos, count = 40, speed = 3, color = '#ffcf6b') {
    const { scene, updaters } = this.b;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3), v = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p.set(pos, i * 3);
      const a = Math.random() * Math.PI * 2, up = Math.random();
      v.set([Math.cos(a) * speed * (0.4 + Math.random() * 0.6), up * speed * 1.2, Math.sin(a) * speed * (0.4 + Math.random() * 0.6)], i * 3);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({ color: new THREE.Color(color).multiplyScalar(2), size: 0.09, transparent: true, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    let life = 1.3;
    const animate = (dt) => {
      life -= dt;
      for (let i = 0; i < count; i++) {
        v[i * 3 + 1] -= 9.8 * dt;
        p[i * 3] += v[i * 3] * dt;
        p[i * 3 + 1] += v[i * 3 + 1] * dt;
        p[i * 3 + 2] += v[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, life / 1.3);
      if (life <= 0) {
        scene.remove(points);
        geo.dispose();
        mat.dispose();
        const k = updaters.indexOf(animate);
        if (k >= 0) updaters.splice(k, 1);
      }
    };
    updaters.push(animate);
  }

  startSafezoneDecay(startSize = 1.0, duration = 5) {
    let elapsed = 0;
    const animate = (dt) => {
      elapsed += dt;
      const t = Math.min(1, elapsed / duration);
      const scale = 1 - t * (1 - startSize);
      if (t >= 1) {
        this.b.ctx?.sfx?.play?.('danger_timeout');
        this.b.updaters.splice(this.b.updaters.indexOf(animate), 1);
      }
      if (typeof scale === 'number') {
        // Hook point for future floor shrink logic.
      }
    };
    this.b.updaters.push(animate);
  }
}
