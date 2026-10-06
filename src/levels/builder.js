// Building blocks shared by every chamber: geometry helpers, materials, lights,
// and puzzle components (cubes, plates, sockets, doors, keypads, panels).
import * as THREE from 'three';
import { makeCollider, setCollider } from '../physics.js';
import { PerspectiveCube } from '../perspective.js';
import { Portal } from '../portals.js';
import { tileTexture, cubeTexture, signTexture, dynamicTexture, dustTexture } from '../textures.js';

const NORMAL_ROT = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI };

// Colour schemes so each chamber has its own mood.
export const THEMES = {
  lab: { wall: '#4b4f56', wallLine: '#3b3e44', floor: '#35383d', floorLine: '#24262a', ceiling: '#1e2024', accent: '#3aa0ff', fog: '#05070a' },
  scale: { wall: '#6b625a', wallLine: '#59514a', floor: '#3d3732', floorLine: '#2c2723', ceiling: '#221e1b', accent: '#ff9a3c', fog: '#0a0705' },
  gateway: { wall: '#3f4a57', wallLine: '#323b46', floor: '#2a3139', floorLine: '#1c2228', ceiling: '#161b21', accent: '#3aa0ff', fog: '#04070b' },
  loop: { wall: '#2f4441', wallLine: '#243633', floor: '#1f2a29', floorLine: '#151d1c', ceiling: '#111817', accent: '#3dffb0', fog: '#020605' },
};

export class LevelBuilder {
  constructor(scene, portalSystem, ctx, theme) {
    this.scene = scene;
    this.portals = portalSystem;
    this.ctx = ctx; // { sfx, toast }
    this.theme = theme;
    this.colliders = [];
    this.solids = []; // meshes that block interaction rays
    this.gunSolids = []; // meshes that block portal shots (glass is excluded)
    this.panels = [];
    this.cubes = [];
    this.updaters = [];

    scene.background = new THREE.Color(theme.fog);
    this.hemi = new THREE.HemisphereLight('#dfe8ff', '#30343a', theme.hemi ?? 0.45);
    scene.add(this.hemi);

    this.mat = {
      wall: new THREE.MeshStandardMaterial({ map: tileTexture(theme.wall, theme.wallLine, 1, 18), roughness: 0.9 }),
      floor: new THREE.MeshStandardMaterial({ map: tileTexture(theme.floor, theme.floorLine, 4, 12), roughness: 0.55, metalness: 0.1 }),
      ceiling: new THREE.MeshStandardMaterial({ color: theme.ceiling, roughness: 1 }),
      panel: new THREE.MeshStandardMaterial({ map: tileTexture('#eef1f3', '#c3c9cf', 2, 8), roughness: 0.4 }),
      metal: new THREE.MeshStandardMaterial({ color: '#8b929b', metalness: 0.75, roughness: 0.3 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: '#2b2f35', metalness: 0.6, roughness: 0.45 }),
      glass: new THREE.MeshStandardMaterial({
        color: '#a8dcff', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false,
      }),
      light: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff6ea').multiplyScalar(2.2) }),
      accent: new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.accent).multiplyScalar(1.8) }),
      ...(theme.mat ?? {}), // generated worlds supply their own surfaces
    };
  }

  // ---------- primitives ----------
  _scaleUVs(geo, sx, sy, sz, tile) {
    const uv = geo.attributes.uv;
    const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i;
        uv.setXY(idx, (uv.getX(idx) * dims[f][0]) / tile, (uv.getY(idx) * dims[f][1]) / tile);
      }
    }
  }

  box(x0, y0, z0, x1, y1, z1, material, opts = {}) {
    const { collide = true, solid = collide, gun = solid, tile = 2, castShadow = collide, parent = this.scene } = opts;
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    if (tile) this._scaleUVs(geo, sx, sy, sz, tile);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.castShadow = castShadow && !material.transparent;
    mesh.receiveShadow = !material.transparent;
    parent.add(mesh);
    if (collide) {
      const c = makeCollider(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
      this.colliders.push(c);
      mesh.userData.collider = c;
    }
    if (solid) this.solids.push(mesh);
    if (gun) this.gunSolids.push(mesh);
    return mesh;
  }

  // Decorative, non-solid glowing strip (blooms).
  strip(x0, y0, z0, x1, y1, z1, material = this.mat.accent) {
    return this.box(x0, y0, z0, x1, y1, z1, material, { collide: false, tile: 0, castShadow: false });
  }

  // Floor, ceiling and four walls for an axis-aligned room. Returns the wall colliders.
  shell(x0, z0, x1, z1, h, { t = 0.4, skip = [] } = {}) {
    const m = this.mat;
    this.box(x0 - t, -0.4, z0 - t, x1 + t, 0, z1 + t, m.floor, { tile: 4 });
    this.box(x0 - t, h, z0 - t, x1 + t, h + 0.4, z1 + t, m.ceiling);
    const walls = {};
    if (!skip.includes('s')) walls.s = this.box(x0 - t, 0, z1, x1 + t, h, z1 + t, m.wall).userData.collider;
    if (!skip.includes('n')) walls.n = this.box(x0 - t, 0, z0 - t, x1 + t, h, z0, m.wall).userData.collider;
    if (!skip.includes('w')) walls.w = this.box(x0 - t, 0, z0, x0, h, z1, m.wall).userData.collider;
    if (!skip.includes('e')) walls.e = this.box(x1, 0, z0, x1 + t, h, z1, m.wall).userData.collider;
    // Glowing trim where walls meet the ceiling.
    const s = 0.06;
    this.strip(x0, h - s, z1 - s, x1, h, z1);
    this.strip(x0, h - s, z0, x1, h, z0 + s);
    this.strip(x0, h - s, z0, x0 + s, h, z1);
    this.strip(x1 - s, h - s, z0, x1, h, z1);
    return walls;
  }

  // A wall along X (north/south) from x0..x1 with rectangular openings.
  // openings: [{ x0, x1, y0, y1 }]
  wallX(x0, x1, z0, z1, h, openings = [], material = this.mat.wall) {
    const sorted = [...openings].sort((a, b) => a.x0 - b.x0);
    let cursor = x0;
    let main = null;
    for (const o of sorted) {
      if (o.x0 > cursor) {
        const mesh = this.box(cursor, 0, z0, o.x0, h, z1, material);
        main ??= mesh.userData.collider;
      }
      if (o.y0 > 0) this.box(o.x0, 0, z0, o.x1, o.y0, z1, material);
      if (o.y1 < h) this.box(o.x0, o.y1, z0, o.x1, h, z1, material);
      cursor = o.x1;
    }
    if (cursor < x1) {
      const mesh = this.box(cursor, 0, z0, x1, h, z1, material);
      main ??= mesh.userData.collider;
    }
    return main;
  }

  // A wall along Z (east/west) from z0..z1 with openings [{ z0, z1, y0, y1 }].
  wallZ(x0, x1, z0, z1, h, openings = [], material = this.mat.wall) {
    const sorted = [...openings].sort((a, b) => a.z0 - b.z0);
    let cursor = z0;
    for (const o of sorted) {
      if (o.z0 > cursor) this.box(x0, 0, cursor, x1, h, o.z0, material);
      if (o.y0 > 0) this.box(x0, 0, o.z0, x1, o.y0, o.z1, material);
      if (o.y1 < h) this.box(x0, o.y1, o.z0, x1, h, o.z1, material);
      cursor = o.z1;
    }
    if (cursor < z1) this.box(x0, 0, cursor, x1, h, z1, material);
  }

  // A flat plane facing `rotY` (0 = facing +Z).
  sign(texture, w, h, x, y, z, rotY, { transparent = false, glow = 1 } = {}) {
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent, toneMapped: false });
    mat.color.setScalar(glow);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    this.scene.add(m);
    return m;
  }

  floorDecal(texture, w, h, x, z, { y = 0.012, rotZ = 0 } = {}) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false }),
    );
    m.rotation.set(-Math.PI / 2, 0, rotZ);
    m.position.set(x, y, z);
    this.scene.add(m);
    return m;
  }

  // Ceiling light fixture with a point light.
  lamp(x, y, z, intensity, color = '#fff4e6', size = 0.9) {
    const l = new THREE.PointLight(color, intensity, 0, 2);
    l.position.set(x, y - 0.3, z);
    this.scene.add(l);
    this.box(x - size / 2, y - 0.05, z - size / 2, x + size / 2, y, z + size / 2, this.mat.light, {
      collide: false, tile: 0, castShadow: false,
    });
    return l;
  }

  // The chamber's main shadow-casting light.
  keyLight([x, y, z], [tx, ty, tz], { intensity = 120, angle = 1.0, color = '#fff2e0', distance = 0, mapSize = 2048 } = {}) {
    const s = new THREE.SpotLight(color, intensity, distance, angle, 0.6, 2);
    s.position.set(x, y, z);
    s.target.position.set(tx, ty, tz);
    s.castShadow = true;
    s.shadow.mapSize.set(mapSize, mapSize);
    s.shadow.bias = -0.0004;
    s.shadow.normalBias = 0.03;
    s.shadow.camera.near = 0.5;
    s.shadow.camera.far = 60;
    this.scene.add(s, s.target);
    return s;
  }

  // Slowly drifting dust motes inside a box.
  dust(min, max, count = 250) {
    const pos = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = THREE.MathUtils.lerp(min[0], max[0], Math.random());
      pos[i * 3 + 1] = THREE.MathUtils.lerp(min[1], max[1], Math.random());
      pos[i * 3 + 2] = THREE.MathUtils.lerp(min[2], max[2], Math.random());
      speed[i] = 0.03 + Math.random() * 0.08;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      map: dustTexture(), size: 0.05, transparent: true, opacity: 0.55, depthWrite: false,
      blending: THREE.AdditiveBlending, color: '#fff2dd',
    }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    let t = 0;
    this.updaters.push((dt) => {
      t += dt;
      for (let i = 0; i < count; i++) {
        let y = pos[i * 3 + 1] + speed[i] * dt;
        if (y > max[1]) y = min[1];
        pos[i * 3 + 1] = y;
        pos[i * 3] += Math.sin(t * 0.3 + i) * 0.002;
      }
      geo.attributes.position.needsUpdate = true;
    });
  }

  // ---------- puzzle components ----------
  // White portal-able panel on a wall. `surface` is the wall face coordinate,
  // `along` the centre along the wall, `y0` the panel's bottom edge.
  panel(dir, surface, along, wall, y0 = 0) {
    const w = 1.5, h = 2.6, t = 0.04;
    const s = dir[0] === '+' ? 1 : -1;
    let mesh, point;
    const opts = { collide: false, solid: true, gun: true, tile: 1.3 };
    if (dir[1] === 'x') {
      const a = surface, b = surface + s * t;
      mesh = this.box(Math.min(a, b), y0, along - w / 2, Math.max(a, b), y0 + h, along + w / 2, this.mat.panel, opts);
      point = new THREE.Vector3(surface + s * 0.07, y0 + 1.2, along);
    } else {
      const a = surface, b = surface + s * t;
      mesh = this.box(along - w / 2, y0, Math.min(a, b), along + w / 2, y0 + h, Math.max(a, b), this.mat.panel, opts);
      point = new THREE.Vector3(along, y0 + 1.2, surface + s * 0.07);
    }
    const rec = { mesh, point, rotY: NORMAL_ROT[dir], wall };
    mesh.userData.panel = rec;
    this.panels.push(rec);
    return rec;
  }

  cube(x, y, z, size) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
      map: cubeTexture(this.ctx.cubeSkin), roughness: 0.45, metalness: this.ctx.cubeSkin === 'gold' ? 0.6 : 0.15,
    }));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.interact = 'cube';
    this.scene.add(mesh);
    this.solids.push(mesh);
    this.gunSolids.push(mesh);
    const collider = makeCollider(new THREE.Vector3(), new THREE.Vector3(), 'cube');
    this.colliders.push(collider);
    const cube = new PerspectiveCube(mesh, size, collider);
    mesh.userData.cube = cube;
    this.cubes.push(cube);
    return cube;
  }

  // `h` is the top's absolute height; `y0` the floor it stands on.
  pedestal(x, z, w = 0.7, h = 1.0, y0 = 0) {
    this.box(x - w / 2, y0, z - w / 2, x + w / 2, h, z + w / 2, this.mat.metal, { tile: 0 });
    this.strip(x - w / 2 - 0.01, h - 0.04, z - w / 2 - 0.01, x + w / 2 + 0.01, h - 0.02, z + w / 2 + 0.01);
  }

  // Atmospheric particles. kind: dust | snow | embers | fireflies | bubbles | sand | none
  particles(kind, min, max, count = 220) {
    if (kind === 'none') return;
    const cfg = {
      dust: { color: '#fff2dd', size: 0.05, vy: 0.06, sway: 0.002, opacity: 0.55 },
      snow: { color: '#ffffff', size: 0.07, vy: -0.6, sway: 0.01, opacity: 0.85 },
      embers: { color: '#ff8a3d', size: 0.06, vy: 0.5, sway: 0.006, opacity: 0.95 },
      fireflies: { color: '#d8ff7a', size: 0.09, vy: 0.02, sway: 0.02, opacity: 0.9, wander: true },
      bubbles: { color: '#9ff4ff', size: 0.08, vy: 0.35, sway: 0.008, opacity: 0.6 },
      sand: { color: '#ffd9a0', size: 0.04, vy: -0.05, sway: 0.03, opacity: 0.6, drift: 1.2 },
    }[kind] ?? null;
    if (!cfg) return this.dust(min, max, count);
    const pos = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      for (let a = 0; a < 3; a++) pos[i * 3 + a] = THREE.MathUtils.lerp(min[a], max[a], Math.random());
      speed[i] = 0.6 + Math.random() * 0.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = new THREE.Color(cfg.color).multiplyScalar(kind === 'embers' || kind === 'fireflies' ? 2 : 1);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      map: dustTexture(), size: cfg.size, transparent: true, opacity: cfg.opacity, depthWrite: false,
      blending: THREE.AdditiveBlending, color,
    }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    let t = 0;
    this.updaters.push((dt) => {
      t += dt;
      for (let i = 0; i < count; i++) {
        const k = i * 3;
        let y = pos[k + 1] + cfg.vy * speed[i] * dt;
        if (y > max[1]) y = min[1];
        if (y < min[1]) y = max[1];
        pos[k + 1] = y;
        pos[k] += Math.sin(t * 0.7 + i) * cfg.sway + (cfg.drift ?? 0) * dt;
        if (cfg.wander) pos[k + 2] += Math.cos(t * 0.5 + i * 1.7) * cfg.sway;
        if (pos[k] > max[0]) pos[k] = min[0];
      }
      geo.attributes.position.needsUpdate = true;
    });
  }

  // Pressure plate that latches once a big enough cube rests on it.
  // latch: false makes it a hold-down plate (active only while weighted).
  plate({ cx, cz, y = 0, size = 2.4, minSize = 1.2, onActivate, latch = true }) {
    const h = size / 2;
    const ring = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b3b').multiplyScalar(1.6) });
    this.box(cx - h, y, cz - h, cx + h, y + 0.06, cz + h, this.mat.metal, { tile: 0 });
    this.box(cx - h + 0.15, y + 0.06, cz - h + 0.15, cx + h - 0.15, y + 0.065, cz + h - 0.15, ring,
      { collide: false, tile: 0, castShadow: false });
    this.box(cx - h + 0.3, y + 0.065, cz - h + 0.3, cx + h - 0.3, y + 0.07, cz + h - 0.3, this.mat.darkMetal,
      { collide: false, tile: 0, castShadow: false });
    const plate = { active: false, ring, cx, cz, half: h };
    let warned = false;
    const offColor = ring.color.clone();
    this.updaters.push(() => {
      if (plate.active && latch) return;
      let small = false;
      let pressed = false;
      for (const c of this.cubes) {
        const p = c.mesh.position;
        const on = !c.held && c.vy === 0 && Math.abs(p.x - cx) < h + 0.3 && Math.abs(p.z - cz) < h + 0.3 &&
          Math.abs(p.y - c.size / 2 - (y + 0.06)) < 0.03;
        if (!on) continue;
        if (c.size >= minSize) {
          pressed = true;
          break;
        }
        small = true;
      }
      if (pressed !== plate.active) {
        plate.active = pressed;
        if (pressed) {
          ring.color.set('#3dff7a').multiplyScalar(1.6);
          this.ctx.sfx.play('unlock');
          onActivate?.();
        } else {
          ring.color.copy(offColor);
          this.ctx.sfx.play('denied');
        }
      }
      if (pressed) return;
      if (small && !warned) {
        this.ctx.sfx.play('denied');
        this.ctx.toast("The plate doesn't budge. It needs something much bigger.", 'warn');
      }
      warned = small;
    });
    return plate;
  }

  // A receptacle that accepts a cube no bigger than `maxSize` resting inside the box.
  socket({ min, max, maxSize, glow, onFill }) {
    const socket = { filled: false };
    const lo = new THREE.Vector3(...min), hi = new THREE.Vector3(...max);
    this.updaters.push(() => {
      if (socket.filled) return;
      for (const c of this.cubes) {
        const p = c.mesh.position;
        if (c.held || c.vy !== 0 || c.size > maxSize) continue;
        if (p.x > lo.x && p.x < hi.x && p.y > lo.y && p.y < hi.y && p.z > lo.z && p.z < hi.z) {
          socket.filled = true;
          glow?.color.set('#3dff7a').multiplyScalar(1.8);
          this.ctx.sfx.play('unlock');
          onFill?.();
          return;
        }
      }
    });
    return socket;
  }

  // A sliding door. `offset` is where it moves when open.
  door(x0, y0, z0, x1, y1, z1, offset, material = this.mat.darkMetal) {
    const mesh = this.box(x0, y0, z0, x1, y1, z1, material, { tile: 0 });
    const closed = mesh.position.clone();
    const openPos = closed.clone().add(new THREE.Vector3(...offset));
    const half = new THREE.Vector3((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2);
    const door = {
      mesh,
      isOpen: false,
      setOpen: (open) => {
        if (door.isOpen === open) return;
        door.isOpen = open;
        this.ctx.sfx.play('door');
      },
    };
    this.updaters.push((dt) => {
      const target = door.isOpen ? openPos : closed;
      if (mesh.position.distanceToSquared(target) < 1e-6) return;
      mesh.position.lerp(target, 1 - Math.exp(-4 * dt));
      mesh.updateMatrixWorld(); // raycasts this frame must see the new spot
      setCollider(mesh.userData.collider, mesh.position, half);
    });
    return door;
  }

  // Wall-mounted code keypad. `rotY` is the direction it faces.
  keypad({ x, y, z, rotY, code, onSolve, enabled = () => true }) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;
    this.scene.add(group);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.68, 0.06), this.mat.darkMetal);
    base.position.z = 0.03;
    const screen = dynamicTexture(256, 96);
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.135),
      new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false }));
    screenMesh.position.set(0, 0.19, 0.062);
    const keysMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({
      map: signTexture(['1 2 3', '4 5 6', '7 8 9', '0'], { w: 256, h: 256, bg: '#22262c', fg: '#aab3bd' }),
    }));
    keysMesh.position.set(0, -0.12, 0.062);
    group.add(base, screenMesh, keysMesh);

    const kp = {
      code, entered: '', solved: false, flash: 0, enabled, onSolve,
      draw(text, color = '#5dff9a') {
        const { g, w, h, tex } = screen;
        g.fillStyle = '#06140c';
        g.fillRect(0, 0, w, h);
        g.fillStyle = color;
        g.font = `bold ${text.length > 5 ? 50 : 64}px ui-monospace, Consolas, monospace`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, w / 2, h / 2 + 4);
        tex.needsUpdate = true;
      },
      idle() {
        if (kp.solved) kp.draw('OPEN');
        else if (!kp.enabled()) kp.draw('- '.repeat(kp.code.length).trim(), '#2d5a3d');
        else kp.draw((kp.entered + '____').slice(0, kp.code.length).split('').join(' '));
      },
    };
    for (const m of [base, screenMesh, keysMesh]) {
      m.userData.interact = 'keypad';
      m.userData.keypad = kp;
      this.solids.push(m);
    }
    kp.idle();
    this.updaters.push((dt) => {
      if (kp.flash > 0) {
        kp.flash -= dt;
        if (kp.flash <= 0) kp.idle();
      }
    });
    return kp;
  }

  // A big push button on a pedestal. `onPress` runs when the player presses E on it.
  button({ x, y = 0, z, color = '#ff4b4b', label = 'Press', onPress, pedestal = true }) {
    if (pedestal) this.pedestal(x, z, 0.6, y + 0.95, y);
    const top = pedestal ? y + 0.95 : y;
    const capMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4) });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 24), capMat);
    cap.position.set(x, top + 0.06, z);
    cap.userData.interact = 'button';
    cap.userData.label = label;
    this.scene.add(cap);
    this.solids.push(cap);
    const button = {
      cap,
      color,
      press: () => {
        cap.position.y = top + 0.02;
        setTimeout(() => (cap.position.y = top + 0.06), 180);
        onPress?.(button);
      },
    };
    cap.userData.press = button.press;
    return button;
  }

  // A flat wall-mounted switch (card reader, lever panel). `rotY` = facing.
  wallSwitch({ x, y, z, rotY, color = '#ffcc33', label = 'Use', onPress }) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;
    this.scene.add(group);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.06), this.mat.darkMetal);
    base.position.z = 0.03;
    const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6) });
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.02), lightMat);
    light.position.set(0, 0.1, 0.07);
    group.add(base, light);
    const sw = { group, lightMat, press: () => onPress?.(sw) };
    for (const m of [base, light]) {
      m.userData.interact = 'button';
      m.userData.label = label;
      m.userData.press = sw.press;
      this.solids.push(m);
    }
    sw.setLabel = (text) => { base.userData.label = text; light.userData.label = text; };
    return sw;
  }

  // Launch pad: stepping on it throws the player up (and optionally forward).
  bouncePad({ x, y, z, radius = 0.8, power = 14, forward = [0, 0], color = '#3dffb0', enabled = () => true }) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6) });
    const offMat = new THREE.MeshBasicMaterial({ color: '#2a3036' });
    this.box(x - radius, y, z - radius, x + radius, y + 0.12, z + radius, this.mat.darkMetal, { tile: 0 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, 0.03, 32), mat);
    disc.position.set(x, y + 0.135, z);
    this.scene.add(disc);
    const chevron = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 3), mat);
    chevron.rotation.x = -Math.PI / 2;
    chevron.rotation.z = Math.atan2(forward[0], -forward[1]);
    chevron.position.set(x, y + 0.17, z);
    if (forward[0] || forward[1]) this.scene.add(chevron);
    let cooldown = 0;
    this.updaters.push((dt) => {
      const on = enabled();
      disc.material = on ? mat : offMat;
      chevron.material = disc.material;
      cooldown = Math.max(0, cooldown - dt);
      const p = this.ctx.player;
      if (!on || !p || cooldown > 0) return;
      if (Math.hypot(p.pos.x - x, p.pos.z - z) < radius && Math.abs(p.pos.y - (y + 0.12)) < 0.15) {
        p.vel.set(forward[0], power, forward[1]);
        p.onGround = false;
        cooldown = 0.4;
        this.ctx.sfx.play('jump');
        this.ctx.sfx.play('portalOpen');
      }
    });
  }

  // Updraft: inside the column the player is lifted to `top`.
  windColumn({ x, y, z, radius = 1.0, top, enabled = () => true, color = '#bfefff' }) {
    this.box(x - radius, y, z - radius, x + radius, y + 0.08, z + radius, this.mat.darkMetal, { tile: 0 });
    const grill = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius * 0.85, 0.02, 24),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.2) }));
    grill.position.set(x, y + 0.09, z);
    this.scene.add(grill);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, top - y, 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
    tube.position.set(x, (y + top) / 2, z);
    this.scene.add(tube);
    // Streaks rising through the column.
    const n = 60;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      pos[i * 3] = x + Math.cos(a) * r;
      pos[i * 3 + 1] = y + Math.random() * (top - y);
      pos[i * 3 + 2] = z + Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      map: dustTexture(), size: 0.12, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color,
    }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.updaters.push((dt) => {
      const on = enabled();
      tube.visible = pts.visible = on;
      if (on) {
        for (let i = 0; i < n; i++) {
          pos[i * 3 + 1] += dt * 5;
          if (pos[i * 3 + 1] > top) pos[i * 3 + 1] = y;
        }
        geo.attributes.position.needsUpdate = true;
      }
      const p = this.ctx.player;
      if (!on || !p) return;
      if (Math.hypot(p.pos.x - x, p.pos.z - z) < radius && p.pos.y < top && p.pos.y > y - 0.5) {
        const target = p.pos.y < top - 0.6 ? 7 : 1.5;
        if (p.vel.y < target) p.vel.y = Math.min(target, p.vel.y + dt * 60);
        p.onGround = false;
      }
    });
  }

  // Teleport pad: step on it to be sent to `dest` (Vector3), facing `yaw`.
  teleportPad({ x, y, z, color, dest, yaw = 0, radius = 0.6, onUse }) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.7) });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.8, 0.06, 8, 32), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y + 0.06, z);
    const core = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.6, 24), mat);
    core.rotation.x = -Math.PI / 2;
    core.position.set(x, y + 0.03, z);
    this.scene.add(ring, core);
    let armed = true;
    let t = Math.random() * 6;
    this.updaters.push((dt) => {
      t += dt;
      ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      const p = this.ctx.player;
      if (!p) return;
      const on = Math.hypot(p.pos.x - x, p.pos.z - z) < radius && Math.abs(p.pos.y - y) < 0.4;
      if (on && armed) {
        p.pos.copy(dest);
        p.vel.set(0, 0, 0);
        p.yaw = yaw;
        armed = false;
        this.ctx.sfx.play('teleport');
        onUse?.();
      } else if (!on) {
        armed = true;
      }
    });
    return { x, y, z, color };
  }

  // Gradient sky dome (used instead of a ceiling in open-air worlds).
  skyDome({ top, horizon, stars }) {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(top) },
        horizon: { value: new THREE.Color(horizon) },
        stars: { value: stars ? 1 : 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 horizon; uniform float stars;
        varying vec3 vDir;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(horizon, top, pow(h, 0.6));
          if (stars > 0.5 && vDir.y > 0.05) {
            vec3 cell = floor(vDir * 260.0);
            float s = step(0.9975, hash(cell));
            col += vec3(s) * 1.6 * smoothstep(0.05, 0.4, vDir.y);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
    dome.scale.setScalar(1500);
    dome.frustumCulled = false;
    dome.renderOrder = -1;
    // Follow the camera so the sky is always "infinitely" far away.
    dome.onBeforeRender = (renderer, scene, camera) => {
      dome.position.setFromMatrixPosition(camera.matrixWorld);
      dome.updateMatrixWorld();
    };
    this.scene.add(dome);
    return dome;
  }

  // A fixed portal (doorways, loops).
  portal(opts, position, rotY, ignore = []) {
    const p = this.portals.add(new Portal(opts));
    p.place(position, rotY, ignore);
    p.opening = 1;
    p.visual.scale.set(1, 1, 1);
    return p;
  }

  exitSign(x, y, z, rotY, text = 'EXIT') {
    return this.sign(signTexture([{ text, size: 110, color: '#4dff88' }], { bg: '#0d1410' }), 1.4, 0.45, x, y, z, rotY, { glow: 1.6 });
  }

  update(dt) {
    for (const u of this.updaters) u(dt);
  }
}

export function makePortalGun() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f2f4f6', roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f35', roughness: 0.5, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 16), white);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16), dark);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = -0.26;
  g.add(tip);
  const blue = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#3aa0ff').multiplyScalar(1.5) }));
  blue.position.z = -0.12;
  g.add(blue);
  const orange = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a1f').multiplyScalar(1.5) }));
  orange.position.z = 0.02;
  g.add(orange);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.rings = { blue, orange };
  return g;
}

// Release everything a level allocated on the GPU.
export function disposeScene(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.uniforms && Object.values(m.uniforms).forEach((u) => u.value?.isTexture && !u.value.isRenderTargetTexture && u.value.dispose());
      m.dispose();
    }
    if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
  });
}
