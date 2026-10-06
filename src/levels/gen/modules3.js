// The escape room: a furnished, themed room you have to *search*, like a real
// escape room. The exit keypad needs a code of 2–4 digits; each digit is found
// at the end of its own clue chain, and the chains run side by side:
//
//   reveals (where a digit is written)          gates (what stands in the way)
//   · a note in a drawer, cabinet or chest       · a lock that needs a key found elsewhere
//   · UV ink on a wall (needs the UV torch)      · a combination padlock whose code is
//   · a lit panel behind a fuse box (needs fuse)    on a note, or counted from the books
//   · a stopped clock (its hour)                 · a painting that hides a wall safe
//
// Chains get deeper with `diff` (a key inside a padlocked box whose code is on a
// note in a locked drawer…). Every interaction is real; the auto-solver gets the
// solving order in `debug.actions`.
import * as THREE from 'three';
import { makeCollider } from '../../physics.js';
import { signTexture } from '../../textures.js';
import { range, irange, pick, shuffle } from '../../random.js';
import { exitKeypad, COLORS } from './modules.js';

const CIRCLED = ['①', '②', '③', '④'];
const THEMES = {
  study: { title: "THE CURATOR'S STUDY", line: 'He left in a hurry. He always locked everything.', wood: '#5a3a22', trim: '#c9a043' },
  lab: { title: 'RESTRICTED LAB 4', line: 'Authorised personnel only. Nobody is authorised.', wood: '#6b7480', trim: '#3aa0ff' },
  cabin: { title: "THE CAPTAIN'S CABIN", line: 'Everything stowed, everything secured.', wood: '#6e4a2c', trim: '#d9b26a' },
  vault: { title: 'ARCHIVE VAULT', line: 'Records are kept. Records are kept locked.', wood: '#3c4148', trim: '#9fe0ff' },
  observatory: { title: 'THE OBSERVATORY', line: 'Charts, instruments, and one very stuck door.', wood: '#2f3550', trim: '#ffcf6b' },
  tomb: { title: 'THE SEALED TOMB', line: 'The curator collected curses. Mostly decorative.', wood: '#8a6a44', trim: '#ffcf6b' },
};
const KEY_KINDS = [
  { name: 'brass', hex: '#d4a93c' }, { name: 'silver', hex: '#c9d2dc' }, { name: 'iron', hex: '#6e7378' }, { name: 'copper', hex: '#c46a3a' },
];
const JUNK = [
  ['Shopping list', 'Milk. Batteries. A smaller cube. A bigger cube.'],
  ['Memo', 'Reminder: the portals are NOT for sending the cat upstairs.'],
  ['Receipt', '1 × doorknob (decorative). Non-refundable.'],
  ['Postcard', 'Wish you were here. Or anywhere, really. — W.'],
  ['Note', 'If you are reading this, check the other drawers.'],
  ['Diary page', 'Day 214. The walls moved again. I moved them back. They moved again.'],
];

export const ESCAPE_ROOM = {
  escape_room: {
    // Snug and roofed, like a real escape room; a little bigger as levels go on.
    dims: (rng, d = 0) => ({ w: range(rng, 10.5, 12.5) + d, d: range(rng, 11, 13) + d * 2.5, h: range(rng, 3.8, 4.4), ceiling: true }),
    build(cell, b, ctx, rng, info) {
      return buildEscapeRoom(cell, b, ctx, rng, info);
    },
  },
};

function buildEscapeRoom(cell, b, ctx, rng, info) {
  const D = info.diff ?? 0;
  const Y = cell.y0;
  const themeKey = pick(rng, Object.keys(THEMES));
  const TH = THEMES[themeKey];
  const wood = new THREE.MeshStandardMaterial({ color: TH.wood, roughness: 0.75, metalness: themeKey === 'lab' || themeKey === 'vault' ? 0.5 : 0.05 });
  const woodDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(TH.wood).multiplyScalar(0.6), roughness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: TH.trim, metalness: 0.8, roughness: 0.35 });
  const paper = new THREE.MeshStandardMaterial({ color: '#efe4c8', roughness: 0.9 });
  const actions = []; // solving order for the auto-solver
  const inv = new Map(); // item id → { label, icon }
  const clues = []; // found digits, shown in the inventory
  const updaters = [];
  const solidsOf = (m) => { b.solids.push(m); b.gunSolids.push(m); };
  const hidden = (m) => { m.userData.interact = 'button'; return m; };

  // ------------------------------------------------------------ wall slots
  // Furniture stands against the walls. Each wall is a list of free spans.
  const { x0, x1, zS, zN } = cell;
  const walls = {
    w: { spans: [[zS - 1.6, zN + 1.4]], at: (u) => [x0, u], rot: Math.PI / 2, axis: 'z' },
    e: { spans: [[zS - 1.6, zN + 1.4]], at: (u) => [x1, u], rot: -Math.PI / 2, axis: 'z' },
    n: { spans: [[x0 + 1.0, -1.4], [3.0, x1 - 1.0]], at: (u) => [u, zN], rot: 0, axis: 'x' },
    s: { spans: [[x0 + 1.0, -1.6], [1.6, x1 - 1.0]], at: (u) => [u, zS], rot: Math.PI, axis: 'x' },
  };
  // Reserve `width` metres on some wall. → frame with world transforms, or null.
  const claim = (width, prefer) => {
    const order = prefer ?? shuffle(rng, ['w', 'e', 'n', 's', 'w', 'e']);
    for (const k of order) {
      const wl = walls[k];
      for (let i = 0; i < wl.spans.length; i++) {
        const [a, c] = wl.spans[i];
        const lo = Math.min(a, c), hi = Math.max(a, c);
        if (hi - lo < width + 0.3) continue;
        const u = lo + 0.15 + width / 2 + rng() * (hi - lo - width - 0.3);
        wl.spans.splice(i, 1, [lo, u - width / 2 - 0.15], [u + width / 2 + 0.15, hi]);
        return frame(k, u);
      }
    }
    return null;
  };
  function frame(k, u) {
    const wl = walls[k];
    const [wx, wz] = wl.at(u);
    const rot = wl.rot;
    const g = new THREE.Group();
    g.position.set(wx, Y, wz);
    g.rotation.y = rot;
    b.scene.add(g);
    // Local (x along the wall, y up, z out of the wall) → world.
    const world = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(new THREE.Vector3(wx, Y, wz));
    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    return { g, world, normal, rot, wall: k };
  }
  // A solid block in a frame's local space: mesh + world collider.
  const block = (f, lx0, ly0, lz0, lx1, ly1, lz1, mat, collide = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(lx1 - lx0, ly1 - ly0, lz1 - lz0), mat);
    m.position.set((lx0 + lx1) / 2, (ly0 + ly1) / 2, (lz0 + lz1) / 2);
    m.castShadow = m.receiveShadow = true;
    f.g.add(m);
    if (collide) {
      const a = f.world(lx0, ly0, lz0), c = f.world(lx1, ly1, lz1);
      b.colliders.push(makeCollider(new THREE.Vector3(Math.min(a.x, c.x), Y + ly0, Math.min(a.z, c.z)), new THREE.Vector3(Math.max(a.x, c.x), Y + ly1, Math.max(a.z, c.z))));
    }
    solidsOf(m);
    return m;
  };
  // Where the solver stands to use something at local (lx, ly, lz) of frame f.
  const standFor = (f, lx, ly, lz, out = 1.15) => {
    const p = f.world(lx, ly, lz);
    const s = p.clone().addScaledVector(f.normal, out);
    return { stand: { x: s.x, y: Y, z: s.z }, at: { x: p.x, y: p.y, z: p.z } };
  };

  // ------------------------------------------------------------ items
  // An item that can be taken. `place(mesh)` decides where it sits.
  function itemMesh(kind, color) {
    let m;
    if (kind === 'key') {
      m = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.3 });
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 16), mat);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.014), mat);
      shaft.position.x = 0.09;
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.012), mat);
      bit.position.set(0.14, -0.02, 0);
      m.add(bow, shaft, bit);
      m.rotation.x = -Math.PI / 2;
    } else if (kind === 'torch') {
      m = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 12), b.mat.darkMetal);
      body.rotation.z = Math.PI / 2;
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#b26bff').multiplyScalar(2) }));
      lens.position.x = 0.111;
      lens.rotation.y = Math.PI / 2;
      m.add(body, lens);
    } else if (kind === 'fuse') {
      m = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 10), new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.6 }));
      glass.rotation.z = Math.PI / 2;
      const caps = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.13, 10, 1, true), trim);
      caps.rotation.z = Math.PI / 2;
      caps.scale.set(1, 0.25, 1);
      m.add(glass, caps);
    } else {
      // A folded note.
      m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.006, 0.14), paper);
    }
    return m;
  }

  // Puts an interactable on a container surface: `holder` gives a parent object
  // and local position; the item is hidden until the holder is open.
  function makeTakeable({ kind, color, label, onTake, holder }) {
    const mesh = itemMesh(kind, color);
    mesh.position.copy(holder.pos);
    if (kind === 'note') mesh.rotation.y = range(rng, -0.4, 0.4);
    holder.parent.add(mesh);
    const hit = hidden(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.26), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    hit.position.copy(holder.pos);
    hit.position.y += 0.05;
    holder.parent.add(hit);
    hit.userData.label = label;
    let taken = false;
    hit.userData.press = () => {
      if (taken) return;
      if (onTake() === false) return;
      if (kind !== 'note') {
        taken = true;
        mesh.visible = hit.visible = false;
        b.ctx.sfx.play('item');
      } else {
        b.ctx.sfx.play('pickup');
      }
    };
    b.solids.push(hit);
    const setVisible = (v) => { mesh.visible = v && !taken; hit.visible = v && !taken; };
    setVisible(holder.open ? holder.open() : true);
    if (holder.open) updaters.push(() => setVisible(holder.open()));
    return { mesh, hit };
  }

  // ------------------------------------------------------------ containers
  // Each container is { open(), holder: {parent, pos}, frame, use: {stand, at} }.
  // lock: null | { key } | { code } (padlock).
  function container(kind, lock, f) {
    f = f ?? claim(kind === 'cabinet' ? 1.1 : kind === 'chest' ? 1.2 : 1.4);
    if (!f) return null;
    let isOpen = false, locked = !!lock;
    let anim = 0;
    const box = { frame: f, kind, open: () => isOpen };
    let pendingOpen = -1;
    let mover, front, holderParent, holderPos, label;
    if (kind === 'drawer') {
      // A desk with one drawer.
      block(f, -0.7, 0, 0.05, 0.7, 0.05, 0.75, woodDark); // feet plate
      block(f, -0.7, 0.72, 0.0, 0.7, 0.78, 0.8, wood); // top
      block(f, -0.7, 0.05, 0.0, -0.62, 0.72, 0.8, wood);
      block(f, 0.62, 0.05, 0.0, 0.7, 0.72, 0.8, wood);
      box.bodies = [block(f, -0.62, 0.05, 0.0, 0.62, 0.45, 0.78, woodDark)];
      mover = new THREE.Group();
      f.g.add(mover);
      const tray = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 0.62), woodDark);
      tray.position.set(0, 0.48, 0.42);
      front = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.03), wood);
      front.position.set(0, 0.59, 0.8);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), trim);
      knob.position.set(0, 0.6, 0.83);
      mover.add(tray, front, knob);
      holderParent = mover;
      holderPos = new THREE.Vector3(range(rng, -0.3, 0.3), 0.5, 0.45);
      label = 'Open the drawer';
      box.anim = (t) => { mover.position.z = 0.45 * t; };
      box.lockAt = new THREE.Vector3(0.35, 0.6, 0.82);
      box.use = standFor(f, 0, 0.59, 0.83, 1.05);
    } else if (kind === 'cabinet') {
      const H = 1.9;
      block(f, -0.5, 0, 0, 0.5, H, 0.05, wood);
      block(f, -0.5, 0, 0, -0.46, H, 0.55, wood);
      block(f, 0.46, 0, 0, 0.5, H, 0.55, wood);
      block(f, -0.5, H - 0.04, 0, 0.5, H, 0.55, wood);
      block(f, -0.5, 0, 0, 0.5, 0.1, 0.55, woodDark);
      for (const sy of [0.7, 1.3]) block(f, -0.46, sy, 0.05, 0.46, sy + 0.025, 0.5, woodDark, false);
      // A roll-up shutter (a swinging door would block the furniture next to it).
      mover = new THREE.Group();
      mover.position.set(-0.5, 0, 0.56);
      f.g.add(mover);
      front = new THREE.Mesh(new THREE.BoxGeometry(1.0, H - 0.1, 0.03), wood);
      front.position.set(0.5, H / 2 + 0.03, 0);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), trim);
      handle.position.set(0.88, H / 2, 0.03);
      mover.add(front, handle);
      holderParent = f.g;
      holderPos = new THREE.Vector3(range(rng, -0.2, 0.2), 1.33, 0.28);
      label = 'Open the cabinet';
      box.anim = (t) => { mover.position.y = (H - 0.25) * t; front.scale.y = 1 - 0.92 * t; front.position.y = (H / 2 + 0.03) * (1 - 0.92 * t) + 0.1 * t; };
      box.lockAt = new THREE.Vector3(0.12, 0.95, 0.6); // on the shutter, beside the handle
      box.use = standFor(f, 0.3, 1.0, 0.6, 1.15);
      solidsOf(front);
    } else if (kind === 'chest') {
      const chestBody = block(f, -0.55, 0, 0.1, 0.55, 0.5, 0.75, wood);
      box.bodies = [chestBody];
      mover = new THREE.Group();
      mover.position.set(0, 0.5, 0.1);
      f.g.add(mover);
      front = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.1, 0.67), woodDark);
      front.position.set(0, 0.05, 0.335);
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.04, 0.05), trim);
      band.position.set(0, 0.05, 0.66);
      mover.add(front, band);
      holderParent = f.g;
      holderPos = new THREE.Vector3(range(rng, -0.25, 0.25), 0.52, 0.42);
      label = 'Open the chest';
      box.anim = (t) => { mover.rotation.x = -1.6 * t; };
      box.lockAt = new THREE.Vector3(0, 0.36, 0.79);
      box.use = standFor(f, 0, 0.6, 0.45, 1.25);
      solidsOf(front);
    } else if (kind === 'safe') {
      // Wall safe behind a hinged painting (the painting is its own step).
      const sy = 1.35;
      block(f, -0.32, sy - 0.32, 0, 0.32, sy + 0.32, 0.12, b.mat.darkMetal, false);
      mover = new THREE.Group();
      mover.position.set(-0.27, 0, 0.125);
      f.g.add(mover);
      front = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.03), b.mat.metal);
      front.position.set(0.27, sy, 0);
      mover.add(front);
      holderParent = f.g;
      holderPos = new THREE.Vector3(0, sy - 0.2, 0.06);
      label = 'Open the safe';
      box.anim = (t) => { mover.rotation.y = -1.7 * t; };
      box.lockAt = new THREE.Vector3(0.12, sy + 0.05, 0.16);
      box.use = standFor(f, 0, sy, 0.16, 1.0);
      solidsOf(front);
    }
    box.holder = { parent: holderParent, pos: holderPos, open: () => isOpen };
    hidden(front);
    front.userData.label = label;
    solidsOf(front);
    if (mover) mover.userData = front.userData;
    for (const m of box.bodies ?? []) m.userData = front.userData;
    const doOpen = () => {
      if (isOpen) return;
      isOpen = true;
      b.ctx.sfx.play(kind === 'safe' ? 'unlock' : 'drop');
    };
    // Key lock: a coloured keyhole plate.
    // Locks ride on the moving part (drawer front, cabinet or safe door).
    const lockParent = kind === 'chest' ? f.g : mover;
    const lockLocal = box.lockAt.clone().sub(lockParent === mover ? mover.position : new THREE.Vector3());
    if (lock?.key) {
      const plate = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(lock.key.hex).multiplyScalar(1.3) }));
      plate.position.copy(lockLocal);
      lockParent.add(plate);
      front.userData.label = `Use the ${lock.key.name} key`;
    }
    front.userData.press = () => {
      if (isOpen) return;
      if (lock?.key && locked) {
        if (!inv.has(lock.key.id)) {
          b.ctx.sfx.play('denied');
          ctx.toast(`Locked. It has a ${lock.key.name} keyhole.`, 'warn');
          return;
        }
        inv.delete(lock.key.id);
        locked = false;
        b.ctx.sfx.play('unlock');
      } else if (lock?.code && locked) {
        b.ctx.sfx.play('denied');
        ctx.toast('A combination padlock holds it shut. Look at it and type the code.', 'warn');
        return;
      }
      doOpen();
    };
    if (lock?.code) {
      const pad = b.keypad({
        x: 0, y: 0, z: 0, rotY: 0, code: lock.code, style: 'padlock', parent: lockParent,
        onSolve: () => { locked = false; pendingOpen = 0.35; },
      });
      pad.group.position.copy(lockLocal).add(new THREE.Vector3(0, -0.02, 0.04));
      const p = f.world(box.lockAt.x, box.lockAt.y, box.lockAt.z + 0.04);
      box.padUse = { stand: { x: p.x + f.normal.x * 0.95, y: Y, z: p.z + f.normal.z * 0.95 }, at: { x: p.x, y: p.y, z: p.z } };
    }
    updaters.push((dt) => {
      if (pendingOpen >= 0 && (pendingOpen -= dt) < 0) doOpen();
      if (!isOpen || anim >= 1) return;
      anim = Math.min(1, anim + dt * 2.5);
      box.anim(1 - (1 - anim) ** 3);
      if (mover) mover.updateMatrixWorld(true);
    });
    return box;
  }

  // ------------------------------------------------------------ gates
  // Hides `stash` (a function placing a takeable into a holder) at `depth`.
  // Returns nothing; records solving actions in order.
  let keyIndex = 0;
  const kinds = ['drawer', 'cabinet', 'chest'];
  function hide(stash, depth) {
    if (depth <= 0) {
      const box = container(pick(rng, kinds), null);
      if (!box) { const h = openSurface(); return stash(h, h.hb); }
      actions.push({ t: 'press', ...box.use, why: 'open' });
      stash(box.holder, box);
      return;
    }
    const gate = rng() < 0.55 && keyIndex < KEY_KINDS.length ? 'key' : 'code';
    if (gate === 'key') {
      const key = { ...KEY_KINDS[keyIndex++], id: `key${keyIndex}` };
      key.label = `${key.name[0].toUpperCase()}${key.name.slice(1)} key`;
      const box = container(pick(rng, kinds), { key });
      if (!box) return hide(stash, 0);
      hide((holder, hb) => {
        const t = makeTakeable({ kind: 'key', color: key.hex, label: `Take the ${key.name} key`, holder, onTake: () => inv.set(key.id, { label: key.label, icon: '🔑' }) });
        actions.push({ t: 'press', ...useOf(t.hit, hb), why: 'take key' });
      }, depth - 1);
      actions.push({ t: 'press', ...box.use, why: 'unlock' });
      stash(box.holder, box);
    } else {
      const code = String(irange(rng, 100, 999));
      const usesShelf = !shelfUsed && rng() < 0.45;
      const box = container(pick(rng, kinds), { code: usesShelf ? shelfCode() : code });
      if (!box) return hide(stash, 0);
      if (!usesShelf) {
        hide((holder, hb) => {
          const t = makeTakeable({
            kind: 'note', label: 'Read the note', holder,
            onTake: () => ctx.read?.('A scrap of paper', `"Padlock: ${code.split('').join(' ')}"\n\nSomeone wrote it down so they wouldn't forget. Classic.`),
          });
          actions.push({ t: 'press', ...useOf(t.hit, hb), why: 'read code' });
        }, depth - 1);
      }
      actions.push({ t: 'code', ...box.padUse, code: box.padCode ?? (usesShelf ? shelf.code : code) });
      stash(box.holder, box);
    }
  }
  // Stand/aim data for an item inside a holder, computed once it's visible.
  function useOf(hit, hb) {
    const f = hb?.frame;
    // Drawer contents slide out 0.45 m with the drawer.
    return { stand: null, at: null, hitRef: hit, frameRef: f, standOut: f ? 1.05 : 0.9, slide: hb?.kind === 'drawer' ? 0.45 : 0 };
  }
  // A small side table in the open for depth-0 items when walls are full.
  let tableSlot = 0;
  function openSurface() {
    const slots = [[0.55, -0.2], [-0.55, 0.2], [0.55, 0.25], [-0.55, -0.25], [0.2, 0.3], [-0.2, -0.3]];
    const [dx, dz] = slots[tableSlot++ % slots.length];
    const side = Math.sign(dx);
    return {
      parent: b.scene, pos: new THREE.Vector3(tableAt.x + dx, Y + 0.79, tableAt.z + dz),
      hb: { kind: 'table', frame: { normal: new THREE.Vector3(side, 0, 0) } },
    };
  }

  // ------------------------------------------------------------ bookshelf clue
  // A shelf of coloured books: padlock code = how many of each of three colours.
  let shelfUsed = false;
  let tableAt = null;
  const shelf = { code: null };
  function shelfCode() {
    shelfUsed = true;
    const f = claim(1.6) ?? frame('w', (zS + zN) / 2);
    const cols = shuffle(rng, COLORS.filter((c) => c.name !== 'white')).slice(0, 3);
    const counts = cols.map(() => irange(rng, 1, 6));
    shelf.code = counts.join('');
    block(f, -0.8, 0, 0, 0.8, 2.0, 0.05, wood);
    block(f, -0.8, 0, 0, -0.76, 2.0, 0.35, wood);
    block(f, 0.76, 0, 0, 0.8, 2.0, 0.35, wood);
    const books = [];
    cols.forEach((c, i) => { for (let n = 0; n < counts[i]; n++) books.push(c.hex); });
    const neutral = ['#5a4a3a', '#3a4a5a', '#4a3a4a', '#6a5a3a'];
    while (books.length < 22) books.push(pick(rng, neutral));
    const order = shuffle(rng, books);
    for (let s = 0; s < 3; s++) {
      const sy = 0.35 + s * 0.6;
      block(f, -0.76, sy - 0.03, 0.05, 0.76, sy, 0.35, woodDark, false);
      let x = -0.72;
      for (let i = s * 8; i < Math.min(order.length, s * 8 + 8) && x < 0.66; i++) {
        const w = range(rng, 0.11, 0.16), h = range(rng, 0.32, 0.46);
        const isColour = cols.some((c) => c.hex === order[i]);
        const mat = new THREE.MeshStandardMaterial({ color: order[i], roughness: 0.7, emissive: isColour ? order[i] : '#000', emissiveIntensity: isColour ? 0.25 : 0 });
        const bk = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.24), mat);
        bk.position.set(x + w / 2, sy + h / 2, 0.2);
        f.g.add(bk);
        b.colorTag?.(order[i], ...f.world(x + w / 2, sy + h + 0.12, 0.3).toArray().map((v, k) => (k === 1 ? v : v)), 0.12);
        x += w + 0.01;
      }
    }
    // Label: which colours, in which order.
    const tex = document.createElement('canvas');
    tex.width = 384; tex.height = 128;
    const g = tex.getContext('2d');
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, 384, 128);
    g.fillStyle = '#3a2a1a'; g.font = 'bold 28px Georgia, serif'; g.textAlign = 'center';
    g.fillText('COUNT THE SPINES', 192, 36);
    cols.forEach((c, i) => { g.fillStyle = c.hex; g.beginPath(); g.arc(112 + i * 80, 84, 26, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#3a2a1a'; g.lineWidth = 3; g.stroke(); });
    const t = new THREE.CanvasTexture(tex);
    t.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.2), new THREE.MeshBasicMaterial({ map: t }));
    card.position.set(0, 2.12, 0.06);
    f.g.add(card);
    return shelf.code;
  }

  // ------------------------------------------------------------ filler
  function furnish() {
    const fx = { collide: false, tile: 0, castShadow: false };
    // Panelling on the lower walls and a picture rail.
    const panel = new THREE.MeshStandardMaterial({ color: new THREE.Color(TH.wood).multiplyScalar(0.85), roughness: 0.7 });
    b.box(x0 + 0.001, Y, zN, x0 + 0.03, Y + 1.1, zS, panel, fx);
    b.box(x1 - 0.03, Y, zN, x1 - 0.001, Y + 1.1, zS, panel, fx);
    b.box(x0, Y, zN + 0.001, -0.8, Y + 1.1, zN + 0.03, panel, fx);
    b.box(0.8, Y, zN + 0.001, x1, Y + 1.1, zN + 0.03, panel, fx);
    b.box(x0, Y, zS - 0.03, -0.8, Y + 1.1, zS - 0.001, panel, fx);
    b.box(0.8, Y, zS - 0.03, x1, Y + 1.1, zS - 0.001, panel, fx);
    for (const [ax0, az0, ax1, az1] of [[x0, zN, x0 + 0.05, zS], [x1 - 0.05, zN, x1, zS], [x0, zN, x1, zN + 0.05], [x0, zS - 0.05, x1, zS]]) {
      b.box(ax0, Y + 1.1, az0, ax1, Y + 1.16, az1, trim, fx);
    }
    // Fill every remaining wall span.
    const pieces = ['bookcase', 'armchair', 'lamp', 'crates', 'plant', 'sidetable', 'globe', 'bookcase', 'armchair'];
    for (let guard = 0; guard < 24; guard++) {
      const kind = pick(rng, pieces);
      const width = { bookcase: 1.3, armchair: 1.0, lamp: 0.6, crates: 1.1, plant: 0.6, sidetable: 0.7, globe: 0.7 }[kind];
      const f = claim(width);
      if (!f) break;
      prop(kind, f);
      if (rng() < 0.5) picture(f);
    }
  }

  function picture(f) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 96;
    const g = c.getContext('2d');
    const hue = Math.floor(rng() * 360);
    g.fillStyle = `hsl(${hue},25%,${rng() < 0.5 ? 70 : 25}%)`; g.fillRect(0, 0, 128, 96);
    for (let i = 0; i < 4; i++) { g.fillStyle = `hsl(${(hue + i * 50) % 360},45%,50%)`; g.fillRect(rng() * 100, rng() * 70, 10 + rng() * 40, 10 + rng() * 30); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const pic = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.52, 0.03), [trim, trim, trim, trim, new THREE.MeshBasicMaterial({ map: t }), trim]);
    pic.position.set(range(rng, -0.2, 0.2), 2.25, 0.02);
    f.g.add(pic);
  }

  function prop(kind, f) {
    if (kind === 'bookcase') {
      block(f, -0.62, 0, 0, 0.62, 2.0, 0.04, wood);
      block(f, -0.62, 0, 0, -0.58, 2.0, 0.32, wood);
      block(f, 0.58, 0, 0, 0.62, 2.0, 0.32, wood);
      for (let sh = 0; sh < 4; sh++) {
        const sy = 0.1 + sh * 0.48;
        block(f, -0.58, sy - 0.03, 0.04, 0.58, sy, 0.32, woodDark, false);
        let x = -0.55;
        while (x < 0.45) {
          const w = range(rng, 0.06, 0.12), h = range(rng, 0.26, 0.4);
          const bk = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rng(), 0.25, range(rng, 0.15, 0.35)), roughness: 0.8 }));
          bk.position.set(x + w / 2, sy + h / 2, 0.18);
          if (rng() < 0.1) bk.rotation.z = 0.25;
          f.g.add(bk);
          x += w + (rng() < 0.15 ? 0.12 : 0.008);
        }
      }
    } else if (kind === 'armchair') {
      const fabric = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rng(), 0.35, 0.28), roughness: 0.95 });
      block(f, -0.45, 0, 0.2, 0.45, 0.42, 0.95, fabric);
      block(f, -0.45, 0.42, 0.2, 0.45, 1.05, 0.36, fabric, false);
      block(f, -0.45, 0.42, 0.36, -0.33, 0.65, 0.95, fabric, false);
      block(f, 0.33, 0.42, 0.36, 0.45, 0.65, 0.95, fabric, false);
    } else if (kind === 'lamp') {
      block(f, -0.15, 0, 0.15, 0.15, 0.04, 0.45, b.mat.darkMetal, false);
      block(f, -0.02, 0.04, 0.28, 0.02, 1.5, 0.32, b.mat.darkMetal, false);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.3, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#f2e2c0', emissive: '#ffcf8a', emissiveIntensity: 0.9, side: THREE.DoubleSide }));
      shade.position.set(0, 1.55, 0.3);
      f.g.add(shade);
    } else if (kind === 'crates') {
      const crate = new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.9 });
      block(f, -0.5, 0, 0.1, 0.1, 0.6, 0.7, crate);
      block(f, 0.12, 0, 0.15, 0.55, 0.45, 0.6, crate);
      block(f, -0.4, 0.6, 0.15, 0.05, 0.98, 0.6, crate);
    } else if (kind === 'plant') {
      block(f, -0.2, 0, 0.15, 0.2, 0.45, 0.55, b.mat.darkMetal);
      const leaf = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.28 + rng() * 0.08, 0.5, 0.28), roughness: 0.8 });
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), leaf);
      bush.position.set(0, 0.95, 0.35);
      bush.scale.y = 1.4;
      f.g.add(bush);
    } else if (kind === 'sidetable') {
      block(f, -0.3, 0.6, 0.1, 0.3, 0.65, 0.6, wood);
      block(f, -0.04, 0, 0.31, 0.04, 0.6, 0.39, woodDark, false);
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.28, 12), trim);
      vase.position.set(0.1, 0.79, 0.35);
      f.g.add(vase);
    } else if (kind === 'globe') {
      block(f, -0.2, 0, 0.2, 0.2, 0.7, 0.6, woodDark, false);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), new THREE.MeshStandardMaterial({ color: '#4a7a9a', roughness: 0.5 }));
      globe.position.set(0, 0.98, 0.4);
      globe.rotation.z = 0.4;
      f.g.add(globe);
      updaters.push((dt) => { globe.rotation.y += dt * 0.2; });
    }
  }

  // ------------------------------------------------------------ centre table
  // Built before the clues: anything that doesn't fit against a wall goes on it.
  function centreTable() {
    // A table with chairs, off-centre, on the rug.
    const tx = range(rng, -1.5, 1.5), tz = (zS + zN) / 2 + range(rng, -1.2, 1.2);
    b.box(tx - 0.8, Y + 0.72, tz - 0.5, tx + 0.8, Y + 0.78, tz + 0.5, wood, { tile: 0 });
    for (const [lx, lz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) b.box(tx + lx - 0.04, Y, tz + lz - 0.04, tx + lx + 0.04, Y + 0.72, tz + lz + 0.04, woodDark, { tile: 0 });
    for (const side of [-1, 1]) {
      const cz = tz + side * 0.85;
      b.box(tx - 0.25, Y + 0.42, cz - 0.22, tx + 0.25, Y + 0.47, cz + 0.22, woodDark, { tile: 0 });
      b.box(tx - 0.25, Y + 0.47, cz + side * 0.2 - 0.03, tx + 0.25, Y + 1.0, cz + side * 0.2 + 0.03, woodDark, { tile: 0, collide: false });
      for (const [lx, lz] of [[-0.2, -0.17], [0.2, -0.17], [-0.2, 0.17], [0.2, 0.17]]) b.box(tx + lx - 0.025, Y, cz + lz - 0.025, tx + lx + 0.025, Y + 0.42, cz + lz + 0.025, woodDark, { tile: 0, collide: false });
    }
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 10), paper);
    candle.position.set(tx + 0.3, Y + 0.87, tz);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(3) }));
    flame.position.set(tx + 0.3, Y + 0.99, tz);
    b.scene.add(candle, flame);
    let ft = rng() * 6;
    updaters.push((dt) => { ft += dt; flame.scale.setScalar(1 + Math.sin(ft * 13) * 0.15 + Math.sin(ft * 7.1) * 0.1); });
    tableAt = { x: tx, z: tz };
  }
  centreTable();

  // ------------------------------------------------------------ reveals
  const k = Math.min(4, 2 + Math.round(D * 2.2));
  const digits = Array.from({ length: k }, () => irange(rng, 0, 9));
  const depthFor = () => Math.min(3, Math.max(0, Math.round(D * 2.6 + (rng() - 0.5) * 1.2)));
  const revealKinds = shuffle(rng, ['note', 'note', 'uv', 'fuse', 'clock', 'painting', 'note']);
  let torchPlaced = false, uvOn = false;
  const uvMarks = [];
  const found = (i) => { if (!clues.includes(i)) clues.push(i); };
  const nearClues = [];

  for (let i = 0; i < k; i++) {
    let kind = revealKinds[i];
    if (kind === 'clock') digits[i] = irange(rng, 1, 9);
    const tag = `${CIRCLED[i]} = ${digits[i]}`;
    if (kind === 'uv' && torchPlaced) kind = 'note';
    if (kind === 'note') {
      hide((holder, hb) => {
        const t = makeTakeable({
          kind: 'note', label: 'Read the note', holder,
          onTake: () => { found(i); ctx.read?.('A note', `The ink is smudged, but you can read it:\n\n${CIRCLED[i]}  ${digits[i]}\n\nThe circled number tells you where it goes in the door code.`); },
        });
        actions.push({ t: 'press', ...useOf(t.hit, hb), why: `read digit ${i + 1}` });
      }, depthFor());
    } else if (kind === 'uv') {
      torchPlaced = true;
      hide((holder, hb) => {
        const t = makeTakeable({
          kind: 'torch', label: 'Take the UV torch', holder,
          onTake: () => { inv.set('torch', { label: 'UV torch (F)', icon: '🔦' }); ctx.flags.uv = true; ctx.toast?.(ctx.isTouch ? 'UV torch: tap the 🔦 button to switch it on. Some ink only shows under UV.' : 'UV torch: press F to switch it on. Some ink only shows under UV.', 'info'); },
        });
        actions.push({ t: 'press', ...useOf(t.hit, hb), why: 'take torch' });
      }, Math.max(0, depthFor() - 1));
      // Hidden writing on a free stretch of wall.
      const f = claim(1.2) ?? frame('e', (zS + zN) / 2);
      const mat = new THREE.MeshBasicMaterial({ map: signTexture([{ text: tag, size: 120, color: '#d9a8ff' }], { w: 512, h: 256, bg: 'rgba(0,0,0,0)' }), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), mat);
      mark.position.set(0, 1.6, 0.02);
      f.g.add(mark);
      const faint = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.04, depthWrite: false }));
      faint.position.set(0, 1.6, 0.015);
      f.g.add(faint);
      const w = f.world(0, 1.6, 0.02);
      uvMarks.push({ mat, pos: w, i });
      actions.push({ t: 'uv', stand: { x: w.x + f.normal.x * 2.2, y: Y, z: w.z + f.normal.z * 2.2 }, at: { x: w.x, y: w.y, z: w.z } });
      uvOn = true;
    } else if (kind === 'fuse') {
      const f = claim(1.0);
      if (!f) { i--; revealKinds[i + 1] = 'note'; continue; }
      // Fuse box with an empty slot; next to it a dark panel that lights up.
      block(f, -0.45, 1.1, 0, -0.05, 1.6, 0.12, b.mat.darkMetal);
      const slot = hidden(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: '#30353c' })));
      slot.position.set(-0.25, 1.35, 0.15);
      f.g.add(slot);
      b.solids.push(slot);
      const panelMat = new THREE.MeshBasicMaterial({ map: signTexture([{ text: tag, size: 110, color: '#fff3c4' }], { w: 512, h: 256, bg: '#1a1406' }), toneMapped: false });
      panelMat.color.setScalar(0.04);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), panelMat);
      panel.position.set(0.25, 1.75, 0.02);
      f.g.add(panel);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#332a10' }));
      bulb.position.set(0.25, 2.05, 0.08);
      f.g.add(bulb);
      let powered = false;
      slot.userData.label = 'Fuse box (empty slot)';
      slot.userData.press = () => {
        if (powered) return;
        if (!inv.has('fuse')) { b.ctx.sfx.play('denied'); ctx.toast('The fuse box has an empty slot. A fuse must be somewhere.', 'warn'); return; }
        inv.delete('fuse');
        powered = true;
        found(i);
        b.ctx.sfx.play('unlock');
        panelMat.color.setScalar(1.6);
        bulb.material.color.set('#ffe9a0').multiplyScalar(2);
        slot.userData.label = 'Fuse box (powered)';
      };
      hide((holder, hb) => {
        const t = makeTakeable({ kind: 'fuse', label: 'Take the fuse', holder, onTake: () => inv.set('fuse', { label: 'Fuse', icon: '🔌' }) });
        actions.push({ t: 'press', ...useOf(t.hit, hb), why: 'take fuse' });
      }, Math.max(0, depthFor() - 1));
      actions.push({ t: 'press', ...standFor(f, -0.25, 1.35, 0.15, 1.0), why: 'insert fuse' });
    } else if (kind === 'clock') {
      const f = claim(0.9);
      if (!f) { i--; revealKinds[i + 1] = 'note'; continue; }
      const hour = digits[i];
      const face = document.createElement('canvas');
      face.width = face.height = 256;
      const g = face.getContext('2d');
      g.fillStyle = '#f4ecd8'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 8; g.stroke();
      g.fillStyle = '#3a2a1a'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let n = 1; n <= 12; n++) { const a = (n / 12) * Math.PI * 2; g.fillText(String(n), 128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92); }
      const minute = irange(rng, 0, 11) * 5;
      const hand = (ang, len, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(ang) * len, 128 - Math.cos(ang) * len); g.stroke(); };
      hand(((hour % 12) + minute / 60) / 12 * Math.PI * 2, 55, 9);
      hand((minute / 60) * Math.PI * 2, 85, 5);
      const t = new THREE.CanvasTexture(face);
      t.colorSpace = THREE.SRGBColorSpace;
      const clock = new THREE.Mesh(new THREE.CircleGeometry(0.32, 32), new THREE.MeshBasicMaterial({ map: t }));
      clock.position.set(0, 2.0, 0.04);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.03, 8, 32), trim);
      rim.position.set(0, 2.0, 0.04);
      f.g.add(clock, rim);
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), new THREE.MeshBasicMaterial({
        map: signTexture([{ text: `${CIRCLED[i]} the hour`, size: 52, color: '#3a2a1a' }], { w: 384, h: 128, bg: '#d9c48a' }),
      }));
      plaque.position.set(0, 1.55, 0.03);
      f.g.add(plaque);
      const cw = f.world(0, 2.0, 0.04);
      nearClues.push({ pos: cw, i });
      actions.push({ t: 'look', stand: { x: cw.x + f.normal.x * 2, y: Y, z: cw.z + f.normal.z * 2 }, at: { x: cw.x, y: cw.y, z: cw.z } });
    } else if (kind === 'painting') {
      const f = claim(1.0);
      if (!f) { i--; revealKinds[i + 1] = 'note'; continue; }
      const code = String(irange(rng, 100, 999));
      const safe = container('safe', { code }, f);
      // The painting covers the safe and swings aside.
      const hinge = new THREE.Group();
      hinge.position.set(-0.45, 0, 0.3);
      f.g.add(hinge);
      const art = document.createElement('canvas');
      art.width = 256; art.height = 256;
      const g = art.getContext('2d');
      const hue = Math.floor(rng() * 360);
      g.fillStyle = `hsl(${hue},35%,30%)`; g.fillRect(0, 0, 256, 256);
      g.fillStyle = `hsl(${(hue + 40) % 360},40%,55%)`; g.beginPath(); g.ellipse(128, 120, 50, 64, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = `hsl(${(hue + 200) % 360},30%,25%)`; g.fillRect(70, 170, 116, 86);
      g.strokeStyle = TH.trim; g.lineWidth = 16; g.strokeRect(0, 0, 256, 256);
      const at = new THREE.CanvasTexture(art);
      at.colorSpace = THREE.SRGBColorSpace;
      const pic = hidden(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.04), [trim, trim, trim, trim, new THREE.MeshBasicMaterial({ map: at }), trim]));
      pic.position.set(0.45, 1.35, 0);
      hinge.add(pic);
      solidsOf(pic);
      let swung = false, sw = 0;
      pic.userData.label = 'Take down the painting';
      pic.userData.press = () => { if (!swung) { swung = true; b.ctx.sfx.play('drop'); pic.userData.label = ''; } };
      updaters.push((dt) => {
        if (!swung || sw >= 1) return;
        sw = Math.min(1, sw + dt * 2);
        const e = 1 - (1 - sw) ** 3;
        hinge.position.set(-0.45, -0.88 * e, 0.3 + 0.12 * e);
        hinge.rotation.x = -0.12 * e;
        hinge.updateMatrixWorld(true);
      });
      actions.push({ t: 'press', ...standFor(f, 0.2, 1.35, 0.2, 1.1), why: 'swing painting' });
      // The safe's combination is on a note hidden elsewhere.
      hide((holder, hb) => {
        const t = makeTakeable({ kind: 'note', label: 'Read the note', holder, onTake: () => ctx.read?.('Torn page', `"Safe behind the portrait: ${code.split('').join(' ')}"`) });
        actions.push({ t: 'press', ...useOf(t.hit, hb), why: 'read safe code' });
      }, Math.max(0, depthFor() - 1));
      actions.push({ t: 'code', ...safe.padUse, code });
      const t = makeTakeable({
        kind: 'note', label: 'Read the note', holder: safe.holder,
        onTake: () => { found(i); ctx.read?.('Inside the safe', `A single card:\n\n${CIRCLED[i]}  ${digits[i]}`); },
      });
      actions.push({ t: 'press', ...useOf(t.hit, safe), why: `read digit ${i + 1}` });
    }
  }

  // Red herrings: unlocked drawers with nothing useful, more of them later on.
  const junk = Math.round(D * 3) + (rng() < 0.5 ? 1 : 0);
  for (let j = 0; j < junk; j++) {
    const box = container(pick(rng, kinds), null);
    if (!box) break;
    const [title, text] = pick(rng, JUNK);
    makeTakeable({ kind: 'note', label: 'Read the note', holder: box.holder, onTake: () => ctx.read?.(title, text) });
  }

  // Everything else is furnished so the room feels lived-in (and so the
  // important pieces don't stand out by being the only things there).
  furnish();

  // Boss levels: the chapter's story waits on the table in the curator's journal.
  if (info.story) {
    const journal = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.26), new THREE.MeshStandardMaterial({ color: '#5a1f1f', roughness: 0.6, emissive: '#3a0f0f', emissiveIntensity: 0.4 }));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.04, 0.24), paper);
    pages.position.y = 0.006;
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.06), trim);
    clasp.position.set(0.17, 0, 0);
    journal.add(cover, pages, clasp);
    journal.position.set(tableAt.x - 0.05, Y + 0.81, tableAt.z + 0.02);
    journal.rotation.y = 0.3;
    b.scene.add(journal);
    const glow = new THREE.PointLight('#ffcf6b', 2.5, 3, 2);
    glow.position.set(tableAt.x - 0.25, Y + 1.3, tableAt.z);
    b.scene.add(glow);
    let read = false;
    hidden(cover).userData.label = "Read the curator's journal";
    cover.userData.press = () => {
      ctx.read?.(info.story.title, info.story.text);
      b.ctx.sfx.play('item');
      if (!read) { read = true; glow.intensity = 0.6; ctx.onStory?.(); }
    };
    solidsOf(cover);
  }

  // A rug under the table.
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshStandardMaterial({ color: new THREE.Color(TH.trim).multiplyScalar(0.35), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(tableAt.x, Y + 0.012, tableAt.z);
  b.scene.add(rug);

  // Title over the entrance, facing in.
  b.sign(signTexture([{ text: TH.title, size: 50, color: TH.trim }, { text: TH.line, size: 28, color: '#9aa4ae' }], { w: 768, h: 192, bg: '#0b0d10' }),
    2.6, 0.65, 0, Y + 3.2, zS - 0.03, Math.PI, { glow: 1.1 });

  // The door code.
  const code = digits.join('');
  const { kp, pos } = exitKeypad(b, cell, code);
  b.sign(signTexture([{ text: 'DOOR CODE', size: 46 }, { text: CIRCLED.slice(0, k).join('  '), size: 60, color: TH.trim }], { w: 512, h: 220, bg: '#0b0d10' }),
    0.9, 0.38, pos.x, pos.y + 0.62, pos.z + 0.02, 0, { glow: 1.2 });
  actions.push({ t: 'exit', at: pos, code });

  // Resolve aiming data for items (their world positions exist only now).
  b.scene.updateMatrixWorld(true);
  for (const a of actions) {
    if (!a.hitRef) continue;
    const w = new THREE.Vector3();
    a.hitRef.getWorldPosition(w);
    const n = a.frameRef ? a.frameRef.normal : new THREE.Vector3(0, 0, 1);
    w.addScaledVector(n, a.slide ?? 0);
    a.at = { x: w.x, y: w.y, z: w.z };
    a.stand = { x: w.x + n.x * a.standOut, y: Y, z: w.z + n.z * a.standOut };
    delete a.hitRef;
    delete a.frameRef;
    delete a.slide;
  }

  // UV ink shows only in the torch's beam.
  const look = new THREE.Vector3(), to = new THREE.Vector3();
  return {
    label: 'Escape the room',
    detail: `Search everything. The door code has ${k} digits, and each one is hidden somewhere in this room.`,
    hint: k > 2
      ? 'Open every drawer, cabinet and chest. Keys open coloured keyholes, padlock codes are written down or counted. Each circled number is one digit of the door code.'
      : 'Open the drawers and cabinets and read what you find. Each circled number is one digit of the door code.',
    solved: () => kp.solved,
    update(dt, player) {
      for (const u of updaters) u(dt);
      for (const n of nearClues) if (Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z) < 3.2) found(n.i);
      if (!uvOn) return;
      const on = ctx.torchOn?.() && inv.has('torch');
      look.set(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
      for (const m of uvMarks) {
        to.set(m.pos.x - player.pos.x, m.pos.y - (player.pos.y + 1.6), m.pos.z - player.pos.z);
        const dist = to.length();
        const lit = on && dist < 7 && look.dot(to.normalize()) > 0.93;
        m.mat.opacity += ((lit ? 1 : 0) - m.mat.opacity) * Math.min(1, dt * 8);
        if (m.mat.opacity > 0.6) found(m.i);
      }
    },
    inventory: () => [
      ...[...inv.values()].map((it) => `item:${it.icon}:${it.label}`),
      ...clues.sort().map((i) => `item:📝:${CIRCLED[i]} = ${digits[i]}`),
    ],
    reset() {},
    reserve: { w: [[zS, zN]], e: [[zS, zN]] },
    debug: { actions, code, keypad: pos },
  };
}
