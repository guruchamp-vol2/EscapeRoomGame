// Chamber 04 — Perspective Lab. The finale: every mechanic in one room.
//
//  HALL (16 x 16)                     GALLERY (30 x 30, far away at x = 200)
//  ┌──────────[EXIT]────────┐          Reached only through the storage
//  │ panel E        [closet]│          closet's doorway — it's much bigger
//  │ panel C                │          on the inside than the outside.
//  │┌vault┐  [plate]→[case] │
//  ││  D  │                 │
//  │└─────┘          panel B│
//  │ panel A      [table]   │
//  └────────────────────────┘
import * as THREE from 'three';
import { setCollider } from '../physics.js';
import { signTexture, codeCanvasTexture, floorMarkerTexture, tileTexture } from '../textures.js';
import { randomCode } from '../random.js';
import { makePortalGun } from './builder.js';

export const GALLERY_X = 200;

export function build(b, ctx) {
  const m = b.mat;
  const code = randomCode(ctx.rng);
  const closetMat = new THREE.MeshStandardMaterial({ map: tileTexture('#5d6b7a', '#4b5765', 1, 10), roughness: 0.6, metalness: 0.2 });

  // ---------- hall ----------
  const walls = b.shell(-8, -8, 8, 8, 5, { skip: ['n'] });
  const wallN = b.wallX(-8.4, 8.4, -8.4, -8, 5, [{ x0: -0.8, x1: 0.8, y0: 0, y1: 2.6 }]);
  b.lamp(-4, 5, -4, 26);
  b.lamp(4, 5, -4, 26);
  b.lamp(-4, 5, 4, 26);
  b.lamp(4, 5, 4, 26);
  b.keyLight([0, 4.9, 2], [0, 0, -1], { intensity: 90, angle: 1.25 });
  b.dust([-8, 0.2, -8], [8, 4.8, 8]);

  // Exit corridor and door.
  b.box(-1.6, -0.4, -14.8, 1.6, 0, -8.4, m.floor, { tile: 4 });
  b.box(-1.6, 0, -14.4, -1.2, 3, -8.4, m.wall);
  b.box(1.2, 0, -14.4, 1.6, 3, -8.4, m.wall);
  b.box(-1.6, 0, -14.8, 1.6, 3, -14.4, m.wall);
  b.box(-1.6, 3, -14.4, 1.6, 3.3, -8.4, m.ceiling);
  b.sign(signTexture([{ text: 'FREEDOM', size: 90 }], { bg: '#f4fff8', fg: '#1a6b3a' }), 2.2, 1.1, 0, 1.6, -14.38, 0, { glow: 1.4 });
  const exitLight = new THREE.PointLight('#c8ffd8', 10, 0, 2);
  exitLight.position.set(0, 2.5, -12);
  b.scene.add(exitLight);
  const exitDoor = b.door(-0.8, 0, -8.3, 0.8, 2.6, -8.1, [0, 2.6, 0]);
  b.exitSign(0, 3.0, -7.98, 0);
  const keypad = b.keypad({
    x: 1.5, y: 1.45, z: -7.97, rotY: 0, code,
    onSolve: () => exitDoor.setOpen(true),
  });

  // Portal-able panels.
  b.panel('-z', 8, -3.5, walls.s); // A
  b.panel('-x', 8, 4.5, walls.e); // B
  b.panel('+x', -8, -6, walls.w); // C
  b.panel('+x', -8, 0.5, walls.w); // D (inside the vault)
  b.panel('+z', -8, -5, wallN); // E

  // ---------- forced perspective → pressure plate ----------
  b.box(1.9, 0, 5.1, 3.1, 0.85, 5.9, m.darkMetal, { tile: 0 });
  b.cube(2.5, 0.85 + 0.175, 5.5, 0.35);
  b.sign(signTexture([{ text: 'Objects are only as big', size: 40 }, { text: 'as they appear.', size: 40 }],
    { border: '#ff8a1f' }), 2.0, 1.0, 2.5, 2.6, 7.98, Math.PI);

  // Portal device in a glass case that opens with the plate.
  b.box(6.6, 0, 0.1, 7.4, 1.0, 0.9, m.metal, { tile: 0 });
  const cover = b.box(6.65, 1.0, 0.15, 7.35, 1.7, 0.85, m.glass, { gun: false, tile: 0 });
  cover.userData.interact = 'case';
  const gun = makePortalGun();
  gun.position.set(7.0, 1.2, 0.5);
  gun.userData.interact = 'gun';
  b.scene.add(gun);
  gun.traverse((o) => { if (o.isMesh) b.solids.push(o); });
  b.sign(signTexture([{ text: 'PORTAL DEVICE', size: 56 }, { text: 'case opens with plate', size: 34, color: '#9aa4ae' }]),
    1.6, 0.8, 7.98, 2.3, 0.5, -Math.PI / 2);

  const cable = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b3b').multiplyScalar(1.6) });
  b.strip(4.2, 0, 0.45, 6.6, 0.015, 0.55, cable);
  const plate = b.plate({
    cx: 3, cz: 0.5, size: 2.4, minSize: 1.2,
    onActivate: () => {
      cable.color.set('#3dff7a').multiplyScalar(1.6);
      ctx.toast('CLUNK. Something unlocks with a hiss.', 'success');
      b.ctx.sfx.play('door');
    },
  });
  b.floorDecal(signTexture([
    { text: 'PRESSURE PLATE', size: 52 },
    { text: 'MINIMUM SIZE: 1.2 m', size: 40, color: '#ffd27a' },
  ], { bg: null }), 2.4, 1.2, 3.0, 2.8);

  const coverHalf = new THREE.Vector3(0.35, 0.35, 0.35);
  b.updaters.push((dt) => {
    gun.rotation.y += dt * 0.8;
    if (plate.active && cover.position.y < 4.2) {
      cover.position.y += (4.3 - cover.position.y) * (1 - Math.exp(-4 * dt));
      cover.updateMatrixWorld();
      setCollider(cover.userData.collider, cover.position, coverHalf);
    }
  });

  // ---------- glass vault ----------
  b.box(-4.6, 0, -3, -4.5, 5, 3, m.glass, { gun: false, tile: 0 });
  b.box(-8, 0, -3.1, -4.5, 5, -3, m.glass, { gun: false, tile: 0 });
  b.box(-8, 0, 3, -4.5, 5, 3.1, m.glass, { gun: false, tile: 0 });
  for (const [x, z] of [[-4.55, -3.05], [-4.55, 3.05]]) {
    b.box(x - 0.07, 0, z - 0.07, x + 0.07, 5, z + 0.07, m.darkMetal, { gun: false, tile: 0 });
  }
  const vaultLight = new THREE.PointLight('#ffe3e3', 10, 0, 2);
  vaultLight.position.set(-6.2, 4, 0);
  b.scene.add(vaultLight);
  b.sign(signTexture([
    { text: 'VAULT', size: 64 },
    { text: 'no door — authorised portals only', size: 28, color: '#9aa4ae' },
  ], { border: '#3aa0ff' }), 1.8, 0.9, -4.48, 3.4, 0, Math.PI / 2);
  b.pedestal(-5.6, -2.0, 0.6, 1.0);
  const keycard = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.02, 0.2),
    new THREE.MeshStandardMaterial({ color: '#d63a3a', emissive: '#7a1010', roughness: 0.4 }),
  );
  keycard.position.set(-5.6, 1.15, -2.0);
  keycard.userData.interact = 'keycard';
  b.scene.add(keycard);
  b.solids.push(keycard);
  b.updaters.push((dt) => {
    keycard.rotation.y += dt * 1.2;
    keycard.position.y = 1.15 + Math.sin(performance.now() / 500) * 0.04;
  });

  // ---------- storage closet (bigger on the inside) ----------
  b.box(4.5, 0, -4.6, 4.9, 2.8, -4.5, closetMat, { tile: 1 });
  b.box(6.1, 0, -4.6, 6.5, 2.8, -4.5, closetMat, { tile: 1 });
  b.box(4.9, 2.4, -4.6, 6.1, 2.8, -4.5, closetMat, { tile: 1 });
  b.box(4.5, 0, -6.5, 6.5, 2.8, -6.4, closetMat, { tile: 1 });
  b.box(4.5, 0, -6.4, 4.6, 2.8, -4.6, closetMat, { tile: 1 });
  b.box(6.4, 0, -6.4, 6.5, 2.8, -4.6, closetMat, { tile: 1 });
  b.box(4.45, 2.8, -6.55, 6.55, 2.95, -4.45, closetMat, { tile: 1 });
  b.sign(signTexture([{ text: 'STORAGE', size: 80 }], { w: 512, h: 128, bg: '#1b2128' }), 1.0, 0.25, 5.5, 2.6, -4.44, 0);
  const closetDoor = b.door(4.9, 0, -4.44, 6.1, 2.4, -4.38, [1.2, 0, 0]);
  closetDoor.mesh.userData.interact = 'closet';
  const readerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b3b').multiplyScalar(1.6) });
  const reader = b.box(4.62, 1.2, -4.45, 4.8, 1.48, -4.41, readerMat, { collide: false, solid: true, tile: 0, castShadow: false });
  reader.userData.interact = 'closet';

  const GX = GALLERY_X;
  const closetPortal = b.portal({ width: 1.2, height: 2.4, name: 'closet' }, new THREE.Vector3(5.5, 1.2, -4.55), 0);
  closetPortal.open = false;

  // ---------- gallery ----------
  const gMat = {
    wall: new THREE.MeshStandardMaterial({ map: tileTexture('#d9d2c6', '#c7bfb2', 1, 10), roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ map: tileTexture('#6b5a48', '#56483a', 2, 16), roughness: 0.5 }),
  };
  b.box(GX - 15.4, -0.4, -15.4, GX + 15.4, 0, 15.4, gMat.floor, { tile: 3 });
  b.box(GX - 15.4, 14, -15.4, GX + 15.4, 14.4, 15.4, m.ceiling);
  const gWallS = b.box(GX - 15.4, 0, 15, GX + 15.4, 14, 15.4, gMat.wall, { tile: 3 }).userData.collider;
  b.box(GX - 15.4, 0, -15.4, GX + 15.4, 14, -15, gMat.wall, { tile: 3 });
  b.box(GX - 15.4, 0, -15, GX - 15, 14, 15, gMat.wall, { tile: 3 });
  const gWallE = b.box(GX + 15, 0, -15, GX + 15.4, 14, 15, gMat.wall, { tile: 3 }).userData.collider;
  for (const [x, z] of [[-11, -11], [11, -11], [-11, 5], [11, 5]]) {
    b.box(GX + x - 0.7, 0, z - 0.7, GX + x + 0.7, 14, z + 0.7, gMat.wall, { tile: 3 });
  }
  for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7], [0, 0]]) b.lamp(GX + x, 14, z, 140, '#fff1dc', 1.4);
  b.keyLight([GX + 4, 13.8, 4], [GX, 0, 0], { intensity: 500, angle: 1.0, color: '#fff1dc' });
  b.dust([GX - 15, 0.2, -15], [GX + 15, 12, 15], 300);

  b.box(GX - 0.75, 0, 14.9, GX - 0.6, 2.55, 15, closetMat, { tile: 0 });
  b.box(GX + 0.6, 0, 14.9, GX + 0.75, 2.55, 15, closetMat, { tile: 0 });
  b.box(GX - 0.75, 2.4, 14.9, GX + 0.75, 2.55, 15, closetMat, { tile: 0 });
  b.sign(signTexture([{ text: 'STORAGE', size: 80 }], { w: 512, h: 128, bg: '#1b2128' }), 1.0, 0.25, GX, 2.75, 14.88, Math.PI);
  const galleryPortal = b.portal({ width: 1.2, height: 2.4, name: 'gallery' }, new THREE.Vector3(GX, 1.2, 14.93), Math.PI, [gWallS]);
  closetPortal.link = galleryPortal;
  galleryPortal.link = closetPortal;
  b.sign(signTexture([
    { text: 'Some things only make sense', size: 34 },
    { text: 'from the right point of view.', size: 34 },
  ], { border: '#3ae0ff' }), 2.2, 1.0, GX - 3.2, 2.0, 14.98, Math.PI);
  b.panel('-x', GX + 15, 6, gWallE); // F

  // Anamorphic exit code, readable only from the eye marker facing east.
  const viewpoint = new THREE.Vector3(GX - 9, 1.6, 2);
  b.floorDecal(floorMarkerTexture(), 1.3, 1.3, viewpoint.x, viewpoint.z, { rotZ: -Math.PI / 2 });
  buildAnamorph(b.scene, codeCanvasTexture(code), viewpoint, -Math.PI / 2, ctx.rng);

  let hasKeycard = false;
  let closetOpen = false;

  return {
    spawn: { pos: new THREE.Vector3(0, 0, 6.5), yaw: 0 },
    hasGun: false,
    inventory: () => (hasKeycard ? ['keycard'] : []),
    steps: [
      {
        label: 'Weigh down the pressure plate',
        detail: 'The portal device is locked in its case. The pressure plate needs something <b>big</b>.',
        hint: 'Pick up the small cube (E). It keeps the same size on screen while you hold it, so stand far back, aim a little above the plate, and drop it.',
      },
      {
        label: 'Take the portal device',
        detail: 'The case is open.',
        hint: 'Walk to the glass case by the east wall and press E on the device.',
      },
      {
        label: 'Get the keycard from the vault',
        detail: 'Something is locked in the glass vault, and the vault has no door.',
        hint: 'Portal shots pass through glass. Fire one portal onto the white panel inside the vault and the other onto a white panel in the hall.',
      },
      {
        label: 'Open the storage closet',
        detail: 'Use the keycard on the storage closet.',
        hint: 'Swipe the keycard at the reader beside the STORAGE closet door, near the exit.',
      },
      {
        label: 'Find the exit code',
        detail: 'The keypad by the exit wants three digits.',
        hint: 'In the big room, stand on the glowing eye marker on the west side and look east, across the room.',
      },
      { label: 'Escape', detail: 'The door is open. Get out!', hint: 'The door by the keypad is open. Walk through it.' },
    ],
    stage() {
      if (!plate.active) return 0;
      if (!ctx.flags.hasGun) return 1;
      if (!hasKeycard) return 2;
      if (!closetOpen) return 3;
      if (!keypad.solved) return 4;
      return 5;
    },
    exit: { min: new THREE.Vector3(-1.2, 0, -14.4), max: new THREE.Vector3(1.2, 3, -10) },
    prompt(kind, distance) {
      if (kind === 'case') return [null, 'Locked. The plate needs something big.', true];
      if (kind === 'keycard' && distance < 3) return ['E', 'Take keycard'];
      if (kind === 'closet' && !closetOpen) {
        return hasKeycard ? ['E', 'Swipe keycard'] : [null, 'Locked. Keycard required.', true];
      }
      return null;
    },
    interact(kind, distance) {
      if (kind === 'keycard' && distance < 3) {
        hasKeycard = true;
        keycard.visible = false;
        b.ctx.sfx.play('item');
        ctx.toast('Got the keycard.', 'success');
        return true;
      }
      if (kind === 'closet' && !closetOpen) {
        if (!hasKeycard) {
          b.ctx.sfx.play('denied');
          return true;
        }
        closetOpen = true;
        closetPortal.open = true;
        closetDoor.setOpen(true);
        readerMat.color.set('#3dff7a').multiplyScalar(1.6);
        b.ctx.sfx.play('unlock');
        ctx.toast('The closet slides open...', 'success');
        return true;
      }
      if (kind === 'case') {
        b.ctx.sfx.play('denied');
        return true;
      }
      return false;
    },
    onTeleport(portal) {
      if (portal === closetPortal) ctx.unlock('explorer');
    },
  };
}

// `yaw` is the direction the viewer must face (0 = looking -Z, -PI/2 = looking +X).
function buildAnamorph(scene, texture, viewpoint, yaw, rng) {
  const cols = 12, rows = 3;
  const refDist = 10, refW = 8, refH = 4;
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  material.color.setScalar(1.6);
  const pw = refW / cols, ph = refH / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const geo = new THREE.PlaneGeometry(pw, ph);
      const uv = geo.attributes.uv;
      const u0 = i / cols, u1 = (i + 1) / cols;
      const v0 = 1 - (j + 1) / rows, v1 = 1 - j / rows;
      for (let k = 0; k < uv.count; k++) {
        uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
      }
      const ref = viewpoint.clone()
        .addScaledVector(forward, refDist)
        .addScaledVector(right, -refW / 2 + (i + 0.5) * pw);
      ref.y = 3.4 + refH / 2 - (j + 0.5) * ph;
      const k = 0.45 + rng() * 1.25;
      const shard = new THREE.Mesh(geo, material);
      shard.position.copy(ref).sub(viewpoint).multiplyScalar(k).add(viewpoint);
      shard.rotation.y = yaw;
      shard.scale.setScalar(k);
      scene.add(shard);
    }
  }
}
