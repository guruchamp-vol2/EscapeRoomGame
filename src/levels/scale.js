// Chamber 01 — Scale. Teaches forced perspective both ways:
// grow the cube into a step to climb a ledge, then shrink it into a socket.
//
//   z = -12  ┌──[socket]────[EXIT]──┐  ← north wall (thick), ledge top at 2.2 m
//            │        LEDGE         │
//   z = -6.5 ├──────────────────────┤
//            │                      │
//            │       [cube]         │
//   z = 10   └───────spawn──────────┘
import * as THREE from 'three';
import { signTexture } from '../textures.js';

const LEDGE = 2.2;

export function build(b, ctx) {
  const m = b.mat;
  const H = 8;

  // Shell (north wall built separately with openings).
  const walls = b.shell(-6, -12, 6, 10, H, { skip: ['n'] });

  // Thick north wall with a door and a socket alcove.
  const nz0 = -13.2, nz1 = -12;
  b.box(-6.4, 0, nz0, -3.0, H, nz1, m.wall);
  b.box(-3.0, 0, nz0, -2.0, 3.0, nz1, m.wall); // below socket
  b.box(-3.0, 3.8, nz0, -2.0, H, nz1, m.wall); // above socket
  b.box(-3.0, 3.0, nz0, -2.0, 3.8, -12.9, m.darkMetal); // socket back
  b.box(-2.0, 0, nz0, 2.8, H, nz1, m.wall);
  b.box(2.8, 4.6, nz0, 4.2, H, nz1, m.wall); // above door
  b.box(2.8, 0, nz0, 4.2, LEDGE, nz1, m.wall); // threshold under door
  b.box(4.2, 0, nz0, 6.4, H, nz1, m.wall);

  // Ledge.
  b.box(-6, 0, -12, 6, LEDGE, -6.5, m.wall, { tile: 1.5 });
  b.strip(-6, LEDGE - 0.05, -6.52, 6, LEDGE, -6.47);
  b.sign(signTexture([{ text: 'LEDGE HEIGHT 2.2 m', size: 44 }], { w: 512, h: 96, bg: '#1b1714', fg: '#ffcf9a' }),
    2.2, 0.42, 0, 1.4, -6.48, 0);

  // Socket glow frame.
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a3c').multiplyScalar(1.8) });
  b.strip(-3.05, 2.95, -12.02, -1.95, 3.0, -11.98, glow);
  b.strip(-3.05, 3.8, -12.02, -1.95, 3.85, -11.98, glow);
  b.strip(-3.05, 2.95, -12.02, -3.0, 3.85, -11.98, glow);
  b.strip(-2.0, 2.95, -12.02, -1.95, 3.85, -11.98, glow);
  b.sign(signTexture([{ text: 'POWER SOCKET', size: 52 }, { text: 'max 0.75 m', size: 34, color: '#ffcf9a' }],
    { w: 512, h: 160, bg: '#1b1714' }), 1.2, 0.38, -2.5, 4.3, -11.98, 0);

  // Exit door + corridor at ledge height.
  const door = b.door(2.8, LEDGE, -12.7, 4.2, 4.6, -12.5, [0, 2.4, 0]);
  b.exitSign(3.5, 5.0, -11.98, 0);
  b.box(2.6, 0, -18.4, 4.4, LEDGE, nz0, m.floor, { tile: 2 });
  b.box(2.2, LEDGE, -18.4, 2.6, 5, nz0, m.wall);
  b.box(4.4, LEDGE, -18.4, 4.8, 5, nz0, m.wall);
  b.box(2.2, LEDGE, -18.8, 4.8, 5, -18.4, m.wall);
  b.box(2.2, 5, -18.8, 4.8, 5.3, nz0, m.ceiling);
  b.sign(signTexture([{ text: 'FREEDOM', size: 90 }], { bg: '#f4fff8', fg: '#1a6b3a' }), 1.6, 0.8, 3.5, 3.6, -18.38, 0, { glow: 1.4 });
  const exitLight = new THREE.PointLight('#c8ffd8', 8, 0, 2);
  exitLight.position.set(3.5, 4.5, -16);
  b.scene.add(exitLight);

  b.socket({
    min: [-3.0, 3.0, -12.9], max: [-2.0, 3.8, -12.0], maxSize: 0.75, glow,
    onFill: () => {
      door.setOpen(true);
      ctx.toast('The socket hums. A door grinds open.', 'success');
    },
  });

  // The cube.
  b.pedestal(0, 5.5, 0.7, 1.0);
  b.cube(0, 1.2, 5.5, 0.4);
  b.sign(signTexture([{ text: 'Things are only as big', size: 40 }, { text: 'as they look.', size: 40 }],
    { border: '#ff9a3c', bg: '#1b1714' }), 2.0, 1.0, -5.98, 2.6, 4, Math.PI / 2);

  // Lighting.
  b.keyLight([0, 7.6, 2], [0, 0, -4], { intensity: 160, angle: 1.1, color: '#ffe6cc' });
  b.lamp(-3, H, 6, 22, '#ffd9b0');
  b.lamp(3, H, 6, 22, '#ffd9b0');
  b.lamp(0, H, -9, 26, '#ffd9b0');
  b.dust([-6, 0.2, -12], [6, 7, 10]);
  void walls;

  let reachedLedge = false;
  return {
    spawn: { pos: new THREE.Vector3(0, 0, 8.5), yaw: 0 },
    hasGun: false,
    steps: [
      {
        label: 'Reach the upper ledge',
        detail: 'The ledge is 2.2 m up. You need something to stand on.',
        hint: 'Pick up the cube (E), then look at the bottom of the ledge from across the room and drop it there. The farther you look, the bigger it gets. About 1 m tall is a good step.',
      },
      {
        label: 'Power the socket',
        detail: 'The glowing socket only takes something small.',
        hint: 'From the ledge, pick the cube up again and look into the socket up close. It shrinks to fit.',
      },
      { label: 'Exit', detail: 'The door is open.', hint: 'Walk through the door on the ledge.' },
    ],
    stage() {
      if (!reachedLedge) return 0;
      if (!door.isOpen) return 1;
      return 2;
    },
    exit: { min: new THREE.Vector3(2.6, LEDGE, -18.4), max: new THREE.Vector3(4.4, 5, -16) },
    update(dt, player) {
      if (!reachedLedge && player.pos.y > LEDGE - 0.1 && player.pos.z < -6.5) reachedLedge = true;
      // Nudge players who grew the cube too tall to climb.
      const c = b.cubes[0];
      if (!reachedLedge && !c.held && c.vy === 0 && c.size > 1.55 && !this._warnedTall) {
        this._warnedTall = true;
        ctx.toast('Too tall to climb. Pick it up and look somewhere closer to shrink it.', 'hint');
      }
      if (c.size <= 1.55) this._warnedTall = false;
    },
  };
}
