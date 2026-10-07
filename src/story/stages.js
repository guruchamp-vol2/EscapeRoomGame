// The little animated stages the story scenes play on. Each stage builds a
// self-contained three.js scene with its set, its actors and a camera move,
// all from primitives (no assets). `buildStage(set, rng)` →
//   { scene, camera: { from, to, look }, update(dt, t) }
import * as THREE from 'three';
import { drawEye } from '../wren/wren.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const glow = (color, k = 1.8) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });

function box(scene, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  return m;
}

// ---------- actors ----------
export function wrenModel(mood = 'happy') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 28, 20), std('#e8edf2', { metalness: 0.5, roughness: 0.3 }));
  g.add(body);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  drawEye(canvas.getContext('2d'), 128, mood);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const eye = new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  eye.position.z = 0.27;
  g.add(eye);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.12), std('#c9d0d8', { metalness: 0.6 }));
    fin.position.set(s * 0.36, 0, 0);
    g.add(fin);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6), std('#888'));
  antenna.position.y = 0.36;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), glow('#ffb347'));
  tip.position.y = 0.47;
  g.add(antenna, tip);
  g.userData.eye = { canvas, tex };
  return g;
}

export function figure({ color = '#556070', height = 1.75, coat = null, hair = null } = {}) {
  const g = new THREE.Group();
  const s = height / 1.75;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26 * s, 0.9 * s, 6, 12), std(coat ?? color));
  body.position.y = 0.72 * s;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19 * s, 16, 12), std('#e8c9a8'));
  head.position.y = 1.52 * s;
  g.add(body, head);
  if (hair) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.8), std(hair));
    h.position.y = 1.55 * s;
    g.add(h);
  }
  return g;
}

const elias = () => figure({ coat: '#6b4f3a', height: 1.85, hair: '#8a8a8a' });
const mira = (age = 9) => figure({ coat: '#ff7ab8', height: age < 12 ? 1.2 : 1.65, hair: '#3a2a1a' });
const visitor = () => figure({ coat: '#3d5a80', height: 1.75, hair: '#2a2a2a' });

function floor(scene, mat, size = 30) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  f.rotation.x = -Math.PI / 2;
  f.receiveShadow = true;
  scene.add(f);
  return f;
}

function lights(scene, { hemi = 0.6, key = '#fff2e0', keyI = 60, keyPos = [3, 6, 4], fog = null, bg = '#05070a' } = {}) {
  scene.background = new THREE.Color(bg);
  if (fog) scene.fog = new THREE.FogExp2(fog, 0.05);
  // Scenes are short and small: generous light, no shadow maps.
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#30343a', hemi * 2.4));
  scene.add(new THREE.AmbientLight('#ffffff', 0.25));
  const k = new THREE.SpotLight(key, keyI * 5, 0, 1.0, 0.6, 2);
  k.position.set(...keyPos);
  scene.add(k, k.target);
  const fill = new THREE.PointLight(key, keyI * 0.6, 0, 2);
  fill.position.set(-keyPos[0], keyPos[1] * 0.6, keyPos[2] + 3);
  scene.add(fill);
  return k;
}

function floatingRooms(scene, count, rng, { radius = 8, color = '#9fb4c8', spread = 6 } = {}) {
  const rooms = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const w = 0.6 + rng() * 1.2, h = 0.5 + rng() * 0.8;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), std(color, { roughness: 0.5 }));
    const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.25, h * 0.5), glow('#ffd27a', 1.4));
    door.position.set(0, -h * 0.2, w / 2 + 0.001);
    g.add(m, door);
    const a = rng() * Math.PI * 2;
    g.position.set(Math.cos(a) * (radius * (0.5 + rng() * 0.5)), 1 + rng() * spread, Math.sin(a) * radius * (0.5 + rng() * 0.5) - 4);
    g.rotation.set(rng() * 0.4, rng() * Math.PI, rng() * 0.4);
    g.userData.spin = (rng() - 0.5) * 0.3;
    g.userData.bob = rng() * 6;
    scene.add(g);
    rooms.push(g);
  }
  return (dt, t) => {
    for (const r of rooms) {
      r.rotation.y += r.userData.spin * dt;
      r.position.y += Math.sin(t * 0.8 + r.userData.bob) * 0.003;
    }
  };
}

function bob(obj, t, base, amp = 0.06, speed = 1.6) {
  obj.position.y = base + Math.sin(t * speed) * amp;
}

// ---------- stages ----------
const STAGES = {
  gate(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.25, key: '#c8d4ff', keyI: 40, bg: '#0b1020', fog: '#0b1020' });
    floor(scene, std('#2a3a2a'));
    // A hillside with a door that shouldn't be there.
    const hill = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), std('#1e2e22'));
    hill.position.set(0, -2, -9);
    scene.add(hill);
    box(scene, 2.4, 3.4, 0.4, std('#3a2a1a'), 0, 1.7, -1.6);
    const door = box(scene, 1.6, 2.8, 0.1, glow('#ffd27a', 1.3), 0, 1.4, -1.38);
    const v = visitor();
    v.position.set(0, 0, 4);
    scene.add(v);
    const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 900 }, (_, i) => (i % 3 === 1 ? 8 + rng() * 20 : (rng() - 0.5) * 80)), 3)),
      new THREE.PointsMaterial({ color: '#ffffff', size: 0.08 }));
    scene.add(stars);
    return { scene, camera: { from: V(4, 2.2, 9), to: V(1.2, 1.8, 5.5), look: V(0, 1.4, -1.4) },
      update(dt, t) { v.position.z = Math.max(0.6, 4 - t * 0.45); door.material.color.setScalar(1.3 + Math.sin(t * 2) * 0.2); } };
  },

  hall(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.5, keyPos: [0, 9, 2], keyI: 90 });
    floor(scene, std('#3a3d44', { roughness: 0.4 }));
    for (let z = 2; z > -20; z -= 4) {
      for (const x of [-3.5, 3.5]) box(scene, 0.6, 7, 0.6, std('#8a8f98'), x, 3.5, z);
      box(scene, 7.6, 0.4, 0.6, std('#8a8f98'), 0, 7.2, z);
    }
    for (let z = -2; z > -20; z -= 6) {
      const frame = box(scene, 1.4, 1.0, 0.06, std('#c9a043', { metalness: 0.7 }), -3.15, 2.4, z);
      frame.rotation.y = Math.PI / 2;
    }
    const w = wrenModel('happy');
    w.position.set(0.6, 1.7, -1);
    scene.add(w);
    return { scene, camera: { from: V(-1.5, 1.7, 6), to: V(-0.4, 1.7, 2.5), look: V(0.6, 1.6, -1) },
      update(dt, t) { bob(w, t, 1.7); w.rotation.y = Math.sin(t * 0.7) * 0.4; } };
  },

  desk(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.18, key: '#ffcf8a', keyI: 50, keyPos: [1.2, 3, 1], bg: '#120c08' });
    floor(scene, std('#3a2a1e'));
    box(scene, 8, 4, 0.2, std('#4a3424'), 0, 2, -2.5);
    box(scene, 1.8, 0.08, 0.9, std('#5a3a22'), 0, 0.78, -1);
    for (const [x, z] of [[-0.8, -1.35], [0.8, -1.35], [-0.8, -0.65], [0.8, -0.65]]) box(scene, 0.06, 0.78, 0.06, std('#3a2416'), x, 0.39, z);
    const lamp = new THREE.PointLight('#ffcf8a', 6, 6, 2);
    lamp.position.set(0.6, 1.4, -1.1);
    scene.add(lamp);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.25, 16, 1, true), std('#2e5a3a', { side: THREE.DoubleSide, emissive: '#ffcf8a', emissiveIntensity: 0.3 }));
    shade.position.set(0.6, 1.25, -1.1);
    scene.add(shade);
    for (let i = 0; i < 6; i++) {
      const p = box(scene, 0.21, 0.004, 0.3, std('#efe4c8'), -0.4 + rng() * 0.5, 0.825 + i * 0.004, -1 + rng() * 0.2);
      p.rotation.y = rng() - 0.5;
    }
    const photo = box(scene, 0.25, 0.32, 0.02, std('#c9a043'), -0.6, 0.98, -1.3);
    photo.rotation.x = -0.2;
    const chair = box(scene, 0.5, 0.06, 0.5, std('#5a3a22'), 0, 0.45, -0.2);
    return { scene, camera: { from: V(1.6, 1.6, 1.8), to: V(0.4, 1.3, 0.6), look: V(-0.2, 0.9, -1.1) },
      update(dt, t) { lamp.intensity = 6 + Math.sin(t * 9) * 0.3; chair.rotation.y = Math.sin(t * 0.3) * 0.05; } };
  },

  workshop(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.35, key: '#d8e8ff', keyI: 70, bg: '#0a0c10' });
    floor(scene, std('#2a2d33', { metalness: 0.3 }));
    box(scene, 3, 0.1, 1, std('#4a4f58', { metalness: 0.6 }), 0, 0.9, -1);
    const shells = [];
    for (let i = 0; i < 5; i++) {
      const w = wrenModel(i % 2 ? 'thoughtful' : 'sad');
      w.position.set(-2.4 + i * 1.2, 2.2, -2.2);
      w.scale.setScalar(0.8);
      scene.add(w);
      shells.push(w);
    }
    box(scene, 6, 0.06, 0.5, std('#5a4a3a'), 0, 1.75, -2.2);
    const hero = wrenModel('happy');
    hero.position.set(0, 1.25, -1);
    scene.add(hero);
    const sparks = new THREE.PointLight('#9fd4ff', 0, 3, 2);
    sparks.position.set(0, 1.1, -0.8);
    scene.add(sparks);
    return { scene, camera: { from: V(-2, 1.8, 3), to: V(0.8, 1.6, 2), look: V(0, 1.4, -1.4) },
      update(dt, t) { bob(hero, t, 1.25, 0.04); sparks.intensity = Math.random() < 0.2 ? 8 : 0; shells.forEach((s, i) => (s.rotation.y = Math.sin(t * 0.5 + i) * 0.2)); } };
  },

  nursery(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.55, key: '#ffe2c8', keyI: 50, bg: '#1a1020' });
    floor(scene, std('#d9a8c8'));
    box(scene, 8, 4, 0.2, std('#f2d8e8'), 0, 2, -2.6);
    const colors = ['#ff6b9a', '#6bd1ff', '#ffd36b', '#9aff6b', '#c78bff'];
    const blocks = [];
    for (let i = 0; i < 14; i++) {
      const s = 0.25 + rng() * 0.3;
      const b = box(scene, s, s, s, std(colors[i % colors.length]), (rng() - 0.5) * 4, s / 2 + Math.floor(i / 7) * 0.3, -1.5 + rng() * 2);
      b.rotation.y = rng() * 3;
      blocks.push(b);
    }
    for (let i = 0; i < 4; i++) {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 96;
      const g = c.getContext('2d');
      g.fillStyle = '#fffaf2'; g.fillRect(0, 0, 128, 96);
      g.strokeStyle = colors[i]; g.lineWidth = 5;
      g.strokeRect(20, 30, 50, 40); g.beginPath(); g.moveTo(15, 32); g.lineTo(45, 10); g.lineTo(75, 32); g.stroke();
      g.fillStyle = '#ff6b9a'; g.beginPath(); g.arc(98, 60, 10, 0, 7); g.fill();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ map: t }));
      pic.position.set(-2 + i * 1.3, 2.2 + (i % 2) * 0.3, -2.48);
      pic.rotation.z = (rng() - 0.5) * 0.2;
      scene.add(pic);
    }
    const m = mira(9);
    m.position.set(-0.6, 0, -0.6);
    const e = elias();
    e.position.set(0.8, 0, -0.9);
    e.rotation.y = -0.6;
    scene.add(m, e);
    return { scene, camera: { from: V(2.5, 1.6, 3.5), to: V(0.5, 1.3, 2.6), look: V(0, 1, -0.8) },
      update(dt, t) { m.position.y = Math.abs(Math.sin(t * 3)) * 0.12; m.rotation.y = Math.sin(t) * 0.5; } };
  },

  archive(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.3, key: '#ffe2b0', keyI: 70, bg: '#0e0a06', fog: '#0e0a06' });
    floor(scene, std('#3a2a1e'));
    const shelves = [];
    for (let row = 0; row < 4; row++) {
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(side * 2.2, 0, -row * 3);
        for (let s = 0; s < 5; s++) {
          const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 2.4), std('#5a3a22'));
          shelf.position.y = 0.4 + s * 0.7;
          g.add(shelf);
          for (let i = 0; i < 10; i++) {
            const bk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4 + rng() * 0.15, 0.12), std(new THREE.Color().setHSL(rng(), 0.3, 0.3)));
            bk.position.set(0, 0.62 + s * 0.7, -1.1 + i * 0.24);
            g.add(bk);
          }
        }
        scene.add(g);
        shelves.push(g);
      }
    }
    const ledger = box(scene, 0.6, 0.12, 0.45, std('#6b1f1f'), 0, 1.0, 0);
    box(scene, 0.9, 0.9, 0.6, std('#3a2416'), 0, 0.45, 0);
    return { scene, camera: { from: V(0.3, 1.8, 4.5), to: V(0, 1.5, 1.3), look: V(0, 1, -2) },
      update(dt, t) { shelves.forEach((s, i) => (s.position.x = (i % 2 ? 1 : -1) * (2.2 + Math.sin(t * 0.6 + i) * 0.05))); ledger.rotation.y = Math.sin(t * 0.4) * 0.05; } };
  },

  lab(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.3, key: '#c8ffe8', keyI: 60, bg: '#06100c' });
    floor(scene, std('#1e2a26', { metalness: 0.4 }));
    box(scene, 5, 0.1, 1, std('#3a4a44', { metalness: 0.6 }), 0, 1, -1);
    const jars = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 20), new THREE.MeshStandardMaterial({ color: '#bfffe8', transparent: true, opacity: 0.25, roughness: 0.05 }));
      const room = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.2), std('#c8d4dc'));
      room.position.y = -0.1;
      const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.3, 20), new THREE.MeshBasicMaterial({ color: '#3dff9a', transparent: true, opacity: 0.25 }));
      liquid.position.y = -0.14;
      g.add(glass, room, liquid);
      g.position.set(-2 + i * 0.8, 1.35, -1);
      scene.add(g);
      jars.push(room);
    }
    const tubeLight = new THREE.PointLight('#3dff9a', 5, 6, 2);
    tubeLight.position.set(0, 2, -0.5);
    scene.add(tubeLight);
    return { scene, camera: { from: V(-2.5, 1.7, 2.5), to: V(1.5, 1.6, 2), look: V(0, 1.3, -1) },
      update(dt, t) { jars.forEach((r, i) => { const s = 0.7 + ((t * 0.15 + i * 0.2) % 1) * 0.6; r.scale.setScalar(s); r.rotation.y += dt * 0.4; }); } };
  },

  vault(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.2, key: '#d8e4f0', keyI: 80, bg: '#06080b' });
    floor(scene, std('#2a2f36', { metalness: 0.5 }));
    box(scene, 8, 5, 0.3, std('#3a414b', { metalness: 0.7 }), 0, 2.5, -2.5);
    const door = new THREE.Group();
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 40), std('#8a96a4', { metalness: 0.9, roughness: 0.25 }));
    disk.rotation.x = Math.PI / 2;
    door.add(disk);
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 24), std('#c9a043', { metalness: 0.9 })));
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.06), std('#c9a043', { metalness: 0.9 }));
      s.rotation.z = (i / 3) * Math.PI;
      wheel.add(s);
    }
    wheel.position.z = 0.2;
    door.add(wheel);
    door.position.set(0, 2, -2.3);
    scene.add(door);
    for (let i = 0; i < 16; i++) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10), std('#c9a043', { metalness: 0.9 }));
      const a = (i / 16) * Math.PI * 2;
      bolt.position.set(Math.cos(a) * 1.55, 2 + Math.sin(a) * 1.55, -2.3);
      bolt.rotation.x = Math.PI / 2;
      scene.add(bolt);
    }
    return { scene, camera: { from: V(-1.5, 1.8, 4), to: V(0.4, 2, 2.2), look: V(0, 2, -2.3) },
      update(dt, t) { wheel.rotation.z = t * 0.6; } };
  },

  echoes(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.2, key: '#b8a8ff', keyI: 60, bg: '#0a0814', fog: '#0a0814' });
    floor(scene, std('#1a1828', { metalness: 0.3, roughness: 0.3 }));
    const drones = [];
    for (let i = 0; i < 40; i++) {
      const w = wrenModel(['thoughtful', 'sad', 'happy'][i % 3]);
      const row = Math.floor(i / 8), col = i % 8;
      w.position.set(-3.5 + col + (row % 2) * 0.5, 1.2 + row * 0.6, -1 - row * 1.6);
      w.scale.setScalar(0.7);
      w.userData.ph = rng() * 6;
      scene.add(w);
      drones.push(w);
    }
    return { scene, camera: { from: V(0, 1.6, 5), to: V(0, 1.9, 2), look: V(0, 2, -3) },
      update(dt, t) { for (const d of drones) { d.position.y += Math.sin(t * 1.4 + d.userData.ph) * 0.004; d.rotation.y = Math.sin(t * 0.5 + d.userData.ph) * 0.3; } } };
  },

  blueprint(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.4, key: '#9fd0ff', keyI: 40, bg: '#061428' });
    const grid = new THREE.GridHelper(40, 40, '#4aa8ff', '#1d4f86');
    scene.add(grid);
    const lines = new THREE.LineBasicMaterial({ color: '#8fd0ff' });
    const bricks = [];
    // A door outline made of small rooms, assembling.
    for (let i = 0; i < 46; i++) {
      const a = i < 20 ? null : ((i - 20) / 26) * Math.PI;
      const x = i < 10 ? -1.4 : i < 20 ? 1.4 : -Math.cos(a) * 1.4;
      const y = i < 20 ? (i % 10) * 0.35 + 0.2 : 3.5 + Math.sin(a) * 1.4;
      const brick = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.3, 0.3, 0.3)), lines);
      brick.position.set(x, y, -2);
      brick.userData.target = brick.position.clone();
      brick.position.add(V((rng() - 0.5) * 12, rng() * 8, (rng() - 0.5) * 8));
      brick.userData.delay = i * 0.08;
      scene.add(brick);
      bricks.push(brick);
    }
    return { scene, camera: { from: V(-3, 2.5, 5), to: V(1.5, 2.2, 4), look: V(0, 2.2, -2) },
      update(dt, t) { for (const b of bricks) { if (t > b.userData.delay) b.position.lerp(b.userData.target, Math.min(1, dt * 2)); } } };
  },

  void(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.3, key: '#c8d0ff', keyI: 30, bg: '#020308' });
    const upd = floatingRooms(scene, 26, rng, { radius: 9, color: '#a4b0c8', spread: 5 });
    const v = visitor();
    v.position.set(0, 0, 0);
    const plat = box(scene, 2, 0.2, 2, std('#3a3f48'), 0, -0.1, 0);
    const w = wrenModel('thoughtful');
    w.position.set(0.8, 1.7, 0.2);
    scene.add(v, w);
    return { scene, camera: { from: V(3, 3, 5), to: V(-3, 2.2, 4), look: V(0, 1.4, -2) },
      update(dt, t) { upd(dt, t); bob(w, t, 1.7); plat.position.y = -0.1 + Math.sin(t * 0.5) * 0.05; } };
  },

  mirror(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.5, key: '#ffffff', keyI: 70, bg: '#0c0e12' });
    floor(scene, std('#d8e0ea', { metalness: 0.9, roughness: 0.08 }));
    for (let i = -2; i <= 2; i++) {
      const m = box(scene, 1.2, 3.2, 0.05, std('#ffffff', { metalness: 1, roughness: 0.03 }), i * 1.6, 1.6, -2.5);
      m.rotation.y = i * 0.12;
    }
    const v = visitor();
    v.position.set(-0.6, 0, 0);
    const ghost = visitor();
    ghost.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.25; } });
    ghost.position.set(0.6, 0, -0.6);
    scene.add(v, ghost);
    return { scene, camera: { from: V(2.5, 1.7, 3.5), to: V(-1.5, 1.6, 3), look: V(0, 1.2, -1) },
      update(dt, t) { v.position.x = -0.6 + Math.sin(t * 0.6) * 0.4; ghost.position.x = 0.6 + Math.sin((t - 0.8) * 0.6) * 0.4; } };
  },

  engine(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.2, key: '#ffb070', keyI: 90, bg: '#140804' });
    floor(scene, std('#2e241c', { metalness: 0.5 }));
    const gears = [];
    for (let i = 0; i < 6; i++) {
      const r = 0.8 + rng() * 1.4;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 28), std('#7a5a3a', { metalness: 0.8, roughness: 0.4 })));
      for (let t = 0; t < 16; t++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.3), std('#7a5a3a', { metalness: 0.8 }));
        const a = (t / 16) * Math.PI * 2;
        tooth.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        g.add(tooth);
      }
      g.rotation.x = Math.PI / 2;
      g.position.set(-4 + i * 1.7, 1 + (i % 2) * 2, -3 - (i % 3));
      g.userData.dir = (i % 2 ? 1 : -1) / r;
      scene.add(g);
      gears.push(g);
    }
    const chair = box(scene, 0.6, 0.08, 0.6, std('#5a3a22'), 0, 0.5, -0.6);
    box(scene, 0.6, 0.7, 0.08, std('#5a3a22'), 0, 0.85, -0.88);
    const coat = box(scene, 0.5, 0.55, 0.12, std('#6b4f3a'), 0, 0.85, -0.8);
    const heart = new THREE.PointLight('#ff8a3c', 10, 10, 2);
    heart.position.set(0, 2, -2);
    scene.add(heart);
    return { scene, camera: { from: V(-2, 1.4, 3.5), to: V(1.8, 1.8, 3), look: V(0, 1.2, -1.5) },
      update(dt, t) { gears.forEach((g) => (g.rotation.y += dt * g.userData.dir)); heart.intensity = 8 + Math.pow(Math.sin(t * 2.2), 8) * 14; coat.rotation.y = Math.sin(t) * 0.02; } };
  },

  rain(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.25, key: '#ffd8a8', keyI: 35, keyPos: [-2, 3, 2], bg: '#0b0e14' });
    floor(scene, std('#3a2a1e'));
    box(scene, 8, 4, 0.2, std('#4a3424'), 0, 2, -2);
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#24344c'); gr.addColorStop(1, '#0d1420');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
    g.strokeStyle = 'rgba(200, 220, 255, 0.6)';
    for (let i = 0; i < 120; i++) { const x = rng() * 128, y = rng() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 12); g.stroke(); }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), new THREE.MeshBasicMaterial({ map: tex }));
    win.position.set(0, 1.9, -1.88);
    scene.add(win);
    box(scene, 1.7, 0.08, 0.1, std('#6e4a2c'), 0, 0.8, -1.85);
    box(scene, 0.06, 2.2, 0.08, std('#6e4a2c'), 0, 1.9, -1.86);
    const w = wrenModel('sad');
    w.position.set(-0.5, 1.4, -1.2);
    w.rotation.y = Math.PI;
    scene.add(w);
    return { scene, camera: { from: V(1.6, 1.5, 2.6), to: V(0.6, 1.5, 1.4), look: V(-0.2, 1.6, -1.8) },
      update(dt, t) { tex.offset.y += dt * 1.6; bob(w, t, 1.4, 0.03, 1); } };
  },

  door(rng) {
    const scene = new THREE.Scene();
    lights(scene, { hemi: 0.3, key: '#fff0b0', keyI: 60, bg: '#080604' });
    floor(scene, std('#2a2620', { roughness: 0.3, metalness: 0.4 }));
    const frame = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const a = i < 14 ? null : ((i - 14) / 26) * Math.PI;
      const x = i < 7 ? -1.2 : i < 14 ? 1.2 : -Math.cos(a) * 1.2;
      const y = i < 14 ? (i % 7) * 0.4 + 0.2 : 2.8 + Math.sin(a) * 1.2;
      const brick = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), std(new THREE.Color().setHSL(0.1 + rng() * 0.08, 0.4, 0.4 + rng() * 0.2)));
      brick.position.set(x, y, 0);
      frame.add(brick);
    }
    frame.position.z = -2;
    scene.add(frame);
    const light = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.7), glow('#fff6d8', 2.2));
    light.position.set(0, 1.35, -2.05);
    scene.add(light);
    const beam = new THREE.PointLight('#fff0c0', 14, 12, 2);
    beam.position.set(0, 1.5, -1.4);
    scene.add(beam);
    const v = visitor();
    v.position.set(0, 0, 2.5);
    v.rotation.y = Math.PI;
    const w = wrenModel('excited');
    w.position.set(0.8, 1.7, 2.2);
    scene.add(v, w);
    return { scene, camera: { from: V(0, 1.6, 6), to: V(0.8, 1.7, 4), look: V(0, 1.5, -2) },
      update(dt, t) { light.material.color.setScalar(2 + Math.sin(t * 1.5) * 0.3); bob(w, t, 1.7); } };
  },
};

export function buildStage(set, rng) {
  const make = STAGES[set] ?? STAGES.hall;
  return make(rng);
}

export const STAGE_NAMES = Object.keys(STAGES);
