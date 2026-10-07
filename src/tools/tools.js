// Tools: things you carry, like the portal device. Each tool has a primary
// action (left click / RT / blue button) and a secondary one (right click /
// LT / orange button). Switch with the mouse wheel, Tab, or D-pad ←/→.
//
//   grapple   Grapple Hook      fire at a gold ring to swing up to it; let go
//   blink     Blink Beacon      throw a beacon (it flies through glass); blink to it
//   gel       Gel Gun           blue gel bounces you, orange gel makes you fast
//   chrono    Chrono Watch      freeze moving hazards for a few seconds
//   echo      Hologram          record yourself; a hologram repeats it, forever
//   lantern   Revealer Lantern  shows (and makes solid) hidden platforms
//   tether    Tether Glove      grab a cube from far away; throw it
//
// Levels mark what tools can act on: b.hooks (rings), b.hidden (platforms that
// exist only in the lantern's light), meshes with userData.paintable (gel),
// b.cubes (tether), b.timeScale (chrono, read by opted-in rooms).
import * as THREE from 'three';

const V = () => new THREE.Vector3();
const glow = (hex, k = 1.8) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5, ...o });

export const TOOL_INFO = {
  portal: { name: 'Portal Device', icon: '◐', color: '#3aa0ff', help: 'LMB blue portal · RMB orange portal' },
  grapple: { name: 'Grapple Hook', icon: '⚓', color: '#ffcf6b', help: 'LMB fire at a gold ring · RMB / Space let go' },
  blink: { name: 'Blink Beacon', icon: '✦', color: '#c78bff', help: 'LMB throw the beacon · RMB blink to it' },
  gel: { name: 'Gel Gun', icon: '◉', color: '#3dd2ff', help: 'LMB blue gel (bounce) · RMB orange gel (speed) — white tiles only' },
  chrono: { name: 'Chrono Watch', icon: '⏱', color: '#9fffd8', help: 'LMB freeze moving hazards for 4 s' },
  echo: { name: 'Hologram', icon: '◎', color: '#5fe1ff', help: 'LMB record / play your hologram · RMB clear it' },
  lantern: { name: 'Revealer Lantern', icon: '✺', color: '#ffe9a0', help: 'LMB lantern on/off: hidden platforms appear' },
  tether: { name: 'Tether Glove', icon: '✋', color: '#ff9a5c', help: 'LMB grab a cube from afar · LMB again throw · RMB drop' },
};

// What WREN says when you pick a tool up.
export const TOOL_LINES = {
  grapple: 'A grapple hook! He used it to hang the chandeliers. Aim at a gold ring, click, and hold on.',
  blink: "The blink beacon. Throw it, then be where it is. It goes through glass. You don't, normally.",
  tether: 'The tether glove. Grab a cube from across the room, then throw it. Please not at me.',
  gel: 'The gel gun! Blue gel bounces, orange gel is fast. It only sticks to the white tiles.',
  echo: 'A hologram projector. Record yourself, and your hologram does it again, forever. It ignores cubes, but pads count it as a person.',
  chrono: 'His watch. It stops time. Well, it stops the dangerous parts of it, for four seconds.',
  lantern: 'The revealer lantern. Some floors here only exist when someone is looking properly.',
};

// A standalone copy of a tool's model (for pedestals).
export function toolModel(id) {
  const m = viewmodel(id);
  m.position.set(0, 0, 0);
  m.scale.setScalar(1);
  m.visible = true;
  return m;
}

// ---------------------------------------------------------------- viewmodels
function viewmodel(id) {
  const g = new THREE.Group();
  const body = std('#e8ecf0', { metalness: 0.3 });
  const dark = std('#2b2f35');
  const c = TOOL_INFO[id].color;
  const tube = (r, l, mat, z = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, l, 14), mat); m.rotation.x = Math.PI / 2; m.position.z = z; g.add(m); return m; };
  if (id === 'grapple') {
    tube(0.06, 0.38, dark);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), std('#c9a043', { metalness: 0.9 }));
    claw.rotation.x = -Math.PI / 2;
    claw.position.z = -0.26;
    g.add(claw);
  } else if (id === 'blink') {
    tube(0.06, 0.3, body);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), glow(c, 2));
    orb.position.z = -0.2;
    g.add(orb);
    g.userData.spin = orb;
  } else if (id === 'gel') {
    tube(0.07, 0.36, body);
    for (const [x, col] of [[-0.07, '#2fa8ff'], [0.07, '#ff8a1f']]) {
      const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10), glow(col, 1.6));
      vial.position.set(x, 0.07, 0.04);
      g.add(vial);
    }
  } else if (id === 'chrono') {
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 24), std('#c9a043', { metalness: 0.9 }));
    face.rotation.x = Math.PI / 2.4;
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), glow(c, 1.3));
    dial.position.set(0, 0.016, 0);
    dial.rotation.x = -Math.PI / 2;
    face.add(dial);
    g.add(face);
    g.userData.spin = face;
  } else if (id === 'echo') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), body);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), glow(c, 2));
    lens.position.z = -0.121;
    lens.rotation.y = Math.PI;
    g.add(box, lens);
  } else if (id === 'lantern') {
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 8, 1, true), std('#3a2a1a', { side: THREE.DoubleSide }));
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), glow(c, 2.4));
    g.add(cage, flame);
    g.userData.flame = flame;
  } else if (id === 'tether') {
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.16), std('#5a3a2a', { metalness: 0.1 }));
    g.add(palm);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.09), std('#5a3a2a', { metalness: 0.1 }));
      f.position.set(-0.05 + i * 0.033, 0, -0.12);
      g.add(f);
    }
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), glow(c, 2));
    node.position.set(0, 0.035, 0);
    g.add(node);
  }
  g.position.set(0.3, -0.27, -0.55);
  g.scale.setScalar(0.7);
  g.visible = false;
  return g;
}

// ---------------------------------------------------------------- tools
// `api`: { player, camera, b(), eye(out), dir(out), ray(list, far), keys(), sfx, toast, say, shake, fovKick, onRespawn }
function makeTools(api) {
  const ray = new THREE.Raycaster();
  const cast = (list, far = 30) => {
    const e = api.eye(V()), d = api.dir(V());
    ray.set(e, d);
    ray.far = far;
    return ray.intersectObjects(list.filter((o) => o.visible !== false || o.userData.hookHit), false)[0] ?? null;
  };
  const worldNormal = (hit) => hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);

  // -------- Grapple Hook
  const grapple = {
    mode: 'idle', anchor: V(), t: 0, rope: null,
    reset(scene) {
      this.release(false);
      const geo = new THREE.BufferGeometry().setFromPoints([V(), V()]);
      this.rope = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffcf6b' }));
      this.rope.visible = false;
      this.rope.frustumCulled = false;
      scene.add(this.rope);
    },
    primary() {
      const hooks = api.b()?.hooks ?? [];
      const hit = cast(hooks, 28);
      if (!hit) { api.sfx.play('fizzle'); api.toast('Aim at a gold ring.'); return; }
      this.anchor.copy(hit.object.userData.ring);
      this.mode = 'pull';
      this.t = 0;
      api.sfx.play('fireOrange');
      api.player.hanging = true;
    },
    secondary() { this.release(true); },
    release(hop = true) {
      if (this.mode === 'idle') return;
      this.mode = 'idle';
      api.player.hanging = false;
      if (hop) {
        const d = api.dir(V());
        api.player.vel.set(d.x * 3, 4.5, d.z * 3);
      }
      if (this.rope) this.rope.visible = false;
    },
    update(dt) {
      if (this.mode === 'idle') return;
      const p = api.player;
      const target = V().copy(this.anchor);
      target.y -= 2.0; // hang with your head just under the ring
      const delta = target.sub(p.pos);
      const dist = delta.length();
      this.t += dt;
      if (this.mode === 'pull') {
        if (dist < 0.35) { this.mode = 'hang'; p.vel.set(0, 0, 0); api.sfx.play('land'); }
        else if (this.t > 3) this.release(false);
        else p.vel.copy(delta.normalize().multiplyScalar(Math.min(15, dist / dt)));
      } else {
        p.vel.set(0, 0, 0);
        if (api.keys().has('Space')) this.release(true);
      }
      p.hanging = this.mode !== 'idle';
      if (this.rope) {
        const hand = api.eye(V()).add(V().set(0, -0.3, 0));
        this.rope.geometry.setFromPoints([hand, this.anchor]);
        this.rope.visible = true;
      }
    },
  };

  // -------- Blink Beacon
  const blink = {
    beacon: null, light: null, flying: 0, from: V(), to: V(),
    reset(scene) {
      this.beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glow('#c78bff', 2.2));
      this.light = new THREE.PointLight('#c78bff', 0, 4, 2);
      this.beacon.add(this.light);
      this.beacon.visible = false;
      scene.add(this.beacon);
      this.placed = false;
    },
    primary() {
      const b = api.b();
      // Through glass (it isn't in gunSolids), stopped by walls.
      const hit = cast(b.gunSolids, 16);
      if (!hit) { api.sfx.play('fizzle'); return; }
      const n = worldNormal(hit);
      let to = hit.point.clone();
      if (n.y < 0.6) {
        // Hit a wall: slide down it to the floor.
        to.addScaledVector(n, 0.45);
        ray.set(to, V().set(0, -1, 0));
        ray.far = 8;
        const floor = ray.intersectObjects(b.gunSolids, false)[0];
        if (!floor) { api.sfx.play('fizzle'); return; }
        to = floor.point.clone();
      }
      to.y += 0.2;
      this.from.copy(api.eye(V()));
      this.to.copy(to);
      this.flying = 0.001;
      this.placed = false;
      this.beacon.visible = true;
      this.light.intensity = 4;
      api.sfx.play('fireBlue');
    },
    secondary() {
      if (!this.placed) { api.sfx.play('denied'); api.toast('Throw the beacon first.'); return; }
      const p = api.player;
      p.pos.set(this.to.x, this.to.y - 0.2 + 0.02, this.to.z);
      p.vel.set(0, 0, 0);
      this.placed = false;
      this.beacon.visible = false;
      api.sfx.play('teleport');
      api.fovKick?.(10);
    },
    update(dt) {
      if (this.flying > 0) {
        this.flying = Math.min(1, this.flying + dt / 0.28);
        this.beacon.position.lerpVectors(this.from, this.to, this.flying);
        this.beacon.position.y += Math.sin(this.flying * Math.PI) * 0.8;
        if (this.flying >= 1) { this.flying = 0; this.placed = true; api.sfx.play('drop'); }
      }
      if (this.beacon?.visible) this.beacon.rotation.y += dt * 3;
    },
    onRespawn() { this.placed = false; if (this.beacon) this.beacon.visible = false; this.flying = 0; },
  };

  // -------- Gel Gun
  const gel = {
    zones: [], scene: null, bounceCd: 0, onOrange: 0,
    reset(scene) { this.zones = []; this.scene = scene; this.bounceCd = 0; },
    shoot(type) {
      const b = api.b();
      const hit = cast(b.gunSolids, 26);
      const n = hit && worldNormal(hit);
      if (!hit || !hit.object.userData.paintable || n.y < 0.6) {
        api.sfx.play('fizzle');
        api.toast('Gel only sticks to the white tiles on the floor.');
        return;
      }
      const p = hit.point;
      // Replace any gel already there.
      this.zones = this.zones.filter((z) => {
        if (Math.hypot(z.x - p.x, z.z - p.z) < 1.6) { this.scene.remove(z.mesh); return false; }
        return true;
      });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(1.15, 28), glow(type === 'blue' ? '#2f8bff' : '#ff8a1f', 1.3));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.x, p.y + 0.013, p.z);
      this.scene.add(mesh);
      this.zones.push({ x: p.x, y: p.y, z: p.z, r: 1.15, type, mesh });
      api.sfx.play(type === 'blue' ? 'fireBlue' : 'fireOrange');
    },
    primary() { this.shoot('blue'); },
    secondary() { this.shoot('orange'); },
    update(dt) {
      const p = api.player;
      this.bounceCd -= dt;
      let orange = false;
      for (const z of this.zones) {
        if (Math.hypot(p.pos.x - z.x, p.pos.z - z.z) > z.r || Math.abs(p.pos.y - z.y) > 0.25) continue;
        if (z.type === 'blue' && p.onGround && this.bounceCd <= 0) {
          p.vel.y = 13.5;
          p.onGround = false;
          this.bounceCd = 0.4;
          api.sfx.play('jump');
          api.shake?.(0.1);
        }
        if (z.type === 'orange') orange = true;
      }
      // Speed lasts through the jump (only decays once you are back on the ground).
      this.onOrange = orange ? 0.35 : p.onGround ? Math.max(0, this.onOrange - dt) : this.onOrange;
      p.speedScale = this.onOrange > 0 ? 2.3 : 1;
    },
  };

  // -------- Chrono Watch
  const chrono = {
    until: 0, cooldown: 0, t: 0,
    reset() { this.until = 0; this.cooldown = 0; this.t = 0; },
    primary() {
      if (this.t < this.cooldown) { api.sfx.play('denied'); api.toast(`The watch is recharging (${Math.ceil(this.cooldown - this.t)} s).`); return; }
      this.until = this.t + 4;
      this.cooldown = this.t + 7;
      api.sfx.play('teleport');
      api.chrono?.(true);
    },
    secondary() {},
    update(dt) {
      this.t += dt;
      const frozen = this.t < this.until;
      const b = api.b();
      if (b) b.timeScale = frozen ? 0 : 1;
      if (!frozen && this.until && this.t - dt < this.until) { api.chrono?.(false); api.sfx.play('unlock'); }
    },
  };

  // -------- Hologram
  const echo = {
    mode: 'idle', frames: [], t: 0, acc: 0, mesh: null, pos: null,
    reset(scene) {
      this.mode = 'idle'; this.frames = []; this.pos = null;
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5fe1ff').multiplyScalar(1.3), transparent: true, opacity: 0.38, depthWrite: false });
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 6, 12), mat);
      body.position.y = 0.78;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), mat);
      head.position.y = 1.6;
      g.add(body, head);
      g.visible = false;
      scene.add(g);
      this.mesh = g;
    },
    primary() {
      if (this.mode === 'rec') return this.stop();
      this.mode = 'rec';
      this.frames = [];
      this.t = 0;
      this.acc = 0;
      this.mesh.visible = false;
      this.pos = null;
      api.sfx.play('beep');
      api.toast('Recording… do what the hologram should do, then press LMB again.');
    },
    stop() {
      if (this.frames.length < 3) { this.mode = 'idle'; return; }
      this.mode = 'play';
      this.t = 0;
      this.mesh.visible = true;
      api.sfx.play('unlock');
    },
    secondary() { this.mode = 'idle'; this.frames = []; this.mesh.visible = false; this.pos = null; api.sfx.play('drop'); },
    update(dt) {
      const p = api.player;
      if (this.mode === 'rec') {
        this.acc += dt;
        while (this.acc >= 0.05) { this.acc -= 0.05; this.frames.push([p.pos.x, p.pos.y, p.pos.z, p.yaw]); }
        if (this.frames.length >= 120) this.stop(); // 6 s maximum
      } else if (this.mode === 'play') {
        this.t += dt;
        const f = this.frames[Math.floor(this.t / 0.05) % this.frames.length];
        this.mesh.position.set(f[0], f[1], f[2]);
        this.mesh.rotation.y = f[3];
        this.pos = this.mesh.position;
      }
    },
  };

  // -------- Revealer Lantern
  const lantern = {
    on: false, light: null, level: 0,
    reset(scene) {
      this.on = false;
      this.level = 0;
      if (!this.light) {
        this.light = new THREE.SpotLight('#fff1c8', 0, 22, 0.75, 0.5, 1.2);
        this.light.position.set(-0.2, -0.1, 0);
        this.light.target.position.set(0, 0, -1);
        api.camera.add(this.light, this.light.target);
      }
      this.light.intensity = 0;
    },
    primary() { this.on = !this.on; api.sfx.play(this.on ? 'unlock' : 'drop'); },
    secondary() { this.primary(); },
    update(dt) {
      this.level += ((this.on ? 1 : 0) - this.level) * Math.min(1, dt * 6);
      this.light.intensity = this.level * 40;
      const p = api.player.pos;
      for (const h of api.b()?.hidden ?? []) {
        const near = h.mesh.position.distanceTo(p) < 24;
        const want = this.on && near ? 1 : 0;
        h.vis += (want - h.vis) * Math.min(1, dt * 6);
        h.mesh.material.opacity = 0.05 + h.vis * 0.8;
        // Solid only in the light (the moment it's mostly there).
        h.collider.enabled = h.vis > 0.5;
      }
    },
  };

  // -------- Tether Glove
  const tether = {
    cube: null, beam: null,
    reset(scene) {
      this.cube = null;
      const geo = new THREE.BufferGeometry().setFromPoints([V(), V()]);
      this.beam = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ff9a5c' }));
      this.beam.visible = false;
      this.beam.frustumCulled = false;
      scene.add(this.beam);
    },
    primary() {
      if (this.cube) return this.throw();
      const b = api.b();
      const hit = cast(b.cubes.filter((c) => !c.held).map((c) => c.mesh), 22);
      if (!hit) { api.sfx.play('fizzle'); api.toast('Aim at a cube.'); return; }
      this.cube = b.cubes.find((c) => c.mesh === hit.object);
      this.cube.tethered = true;
      this.cube.collider.enabled = false;
      this.cube.vx = this.cube.vy = this.cube.vz = 0;
      api.sfx.play('pickup');
    },
    throw() {
      const c = this.cube;
      const d = api.dir(V());
      this.release();
      c.vx = d.x * 14; c.vz = d.z * 14; c.vy = d.y * 14 + 3;
      api.sfx.play('fireOrange');
    },
    secondary() { if (this.cube) { this.release(); api.sfx.play('drop'); } },
    release() {
      const c = this.cube;
      if (!c) return;
      c.tethered = false;
      c.collider.enabled = true;
      c.vx = c.vy = c.vz = 0;
      c.sync();
      this.cube = null;
      this.beam.visible = false;
    },
    update(dt) {
      const c = this.cube;
      if (!c) return;
      const e = api.eye(V()), d = api.dir(V());
      // Hover in front of you, never inside a wall.
      ray.set(e, d);
      ray.far = 2.6;
      const block = ray.intersectObjects(api.b().solids.filter((m) => m !== c.mesh), false)[0];
      const dist = Math.max(0.9, (block ? block.distance - c.size * 0.7 : 2.4));
      const target = e.clone().addScaledVector(d, dist);
      c.mesh.position.lerp(target, Math.min(1, dt * 10));
      c.sync();
      this.beam.geometry.setFromPoints([e.clone().add(V().set(0, -0.3, 0)), c.mesh.position]);
      this.beam.visible = true;
    },
    onRespawn() { this.release(); },
  };

  return { grapple, blink, gel, chrono, echo, lantern, tether };
}

// ---------------------------------------------------------------- the belt
export class ToolBelt {
  constructor(api) {
    this.api = api;
    this.tools = makeTools(api);
    this.owned = [];
    this.index = 0;
    this.models = {};
    for (const id of Object.keys(this.tools)) {
      this.models[id] = viewmodel(id);
      api.camera.add(this.models[id]);
    }
  }

  // New level: which tools you carry, and fresh state for each.
  reset(scene, owned) {
    for (const t of Object.values(this.tools)) t.reset?.(scene);
    this.owned = owned;
    this.index = Math.max(0, Math.min(this.index, owned.length - 1));
    if (this.api.player) { this.api.player.hanging = false; this.api.player.speedScale = 1; }
    this.refresh();
  }

  give(id) {
    if (!this.owned.includes(id)) this.owned.push(id);
    this.index = this.owned.indexOf(id);
    this.refresh();
  }

  get current() { return this.owned[this.index] ?? null; }

  cycle(dir) {
    if (this.owned.length < 2) return;
    this.index = (this.index + dir + this.owned.length) % this.owned.length;
    this.api.sfx.play('ui');
    this.refresh();
  }

  select(id) {
    const i = this.owned.indexOf(id);
    if (i >= 0) { this.index = i; this.refresh(); }
  }

  refresh() {
    for (const [id, m] of Object.entries(this.models)) m.visible = id === this.current && !this.hidden;
    this.api.onChange?.(this.owned, this.current);
  }

  hide(h) { this.hidden = h; this.refresh(); }

  primary() { const t = this.tools[this.current]; t?.primary(); }
  secondary() { const t = this.tools[this.current]; t?.secondary(); }

  update(dt) {
    for (const t of Object.values(this.tools)) t.update?.(dt);
    for (const m of Object.values(this.models)) if (m.visible && m.userData.spin) m.userData.spin.rotation.y += dt * 2;
    const flame = this.models.lantern.userData.flame;
    if (flame) flame.material.color.set(this.tools.lantern.on ? '#ffe9a0' : '#5a4a2a').multiplyScalar(this.tools.lantern.on ? 2.4 : 1);
  }

  onRespawn() {
    for (const t of Object.values(this.tools)) t.onRespawn?.();
    this.tools.grapple.release(false);
  }

  // Someone (you or your hologram) standing within a square area.
  standing(x, z, half, y) {
    const p = this.api.player.pos;
    const inside = (q) => q && Math.abs(q.x - x) < half && Math.abs(q.z - z) < half && Math.abs(q.y - y) < 0.4;
    return inside(p) || inside(this.tools.echo.pos);
  }
}
