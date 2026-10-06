// Dramatic room-state transformations when a puzzle is solved.

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
    this.b.ctx?.sfx?.play?.('unlock');
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

  particleExplosion(pos, count = 30, speed = 3) {
    const { scene, updaters, ctx } = this.b;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const vel = [
        Math.cos(angle) * speed,
        Math.random() * speed,
        Math.sin(angle) * speed,
      ];
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffaa00 })
      );
      particle.position.set(pos[0], pos[1], pos[2]);
      particle.userData.velocity = vel;
      particle.userData.life = 1;
      scene.add(particle);

      const animate = (dt) => {
        particle.userData.life -= dt * 0.5;
        particle.position.x += vel[0] * dt;
        particle.position.y += vel[1] * dt - 9.8 * dt * dt;
        particle.position.z += vel[2] * dt;
        particle.material.opacity = particle.userData.life;
        if (particle.userData.life <= 0) {
          scene.remove(particle);
          updaters.splice(updaters.indexOf(animate), 1);
        }
      };
      updaters.push(animate);
    }
    ctx?.sfx?.play?.('unlock');
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
