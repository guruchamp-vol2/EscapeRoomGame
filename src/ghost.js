// Ghost replays: record the player's position at 10 Hz during a run, and play
// back the fastest recorded run as a translucent figure to race against.
import * as THREE from 'three';

export const GHOST_HZ = 10;
const STEP = 1 / GHOST_HZ;

export class GhostRecorder {
  constructor() {
    this.frames = [];
    this._next = 0;
  }

  // `elapsed` is run time (pauses excluded), so playback lines up with the timer.
  sample(elapsed, player) {
    while (elapsed >= this._next) {
      const p = player.pos;
      this.frames.push([p.x, p.y, p.z, player.yaw].map((v) => Math.round(v * 100) / 100));
      this._next += STEP;
    }
  }
}

function nameTag(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  g.font = 'bold 30px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(8, 20, 32, 0.6)';
  const w = Math.min(250, g.measureText(text).width + 28);
  g.beginPath();
  g.roundRect((256 - w) / 2, 8, w, 48, 24);
  g.fill();
  g.fillStyle = '#bfe4ff';
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.2, 0.3, 1);
  return sprite;
}

export class GhostPlayer {
  constructor(scene, { username, timeMs, frames }) {
    this.username = username;
    this.timeMs = timeMs;
    this.frames = frames;
    this.group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#7fc8ff').multiplyScalar(1.4), transparent: true, opacity: 0.32, depthWrite: false,
    });
    this.mat = mat;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 6, 12), mat);
    body.position.y = 0.78;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat);
    head.position.y = 1.6;
    this.visorMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#dff2ff').multiplyScalar(1.6), transparent: true, opacity: 0.7, depthWrite: false,
    });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.08), this.visorMat);
    visor.position.set(0, 1.63, -0.17);
    const tag = nameTag(`👻 ${username}`);
    tag.position.y = 2.15;
    this.group.add(body, head, visor, tag);
    this.group.renderOrder = 10;
    scene.add(this.group);
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  get finished() {
    return this.frames.length === 0;
  }

  // `viewer` is the camera position: the ghost fades out as you walk into it.
  update(elapsed, viewer) {
    const f = this.frames;
    const t = elapsed * GHOST_HZ;
    const i = Math.floor(t);
    if (i >= f.length - 1) {
      // Ghost has escaped: fade it out at the last spot.
      this.group.visible = elapsed < f.length * STEP + 1.5;
      return;
    }
    const a = f[i], b = f[i + 1];
    this._a.set(a[0], a[1], a[2]);
    this._b.set(b[0], b[1], b[2]);
    // Large jumps are teleports: snap instead of sliding across the map.
    const k = this._a.distanceToSquared(this._b) > 4 ? 0 : t - i;
    this.group.position.lerpVectors(this._a, this._b, k);
    let dy = b[3] - a[3];
    dy = ((dy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.group.rotation.y = a[3] + dy * k;
    const d = viewer ? viewer.distanceTo(this._a.set(this.group.position.x, this.group.position.y + 1.4, this.group.position.z)) : 9;
    const fade = THREE.MathUtils.clamp((d - 0.7) / 1.3, 0, 1);
    this.mat.opacity = 0.32 * fade;
    this.visorMat.opacity = 0.7 * fade;
    this.group.visible = fade > 0.01;
  }

  dispose() {
    this.group.removeFromParent();
  }
}
