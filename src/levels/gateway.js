// Chamber 02 — Gateway. Teaches the portal device: shoot through glass to get
// past it, then use a high panel to reach the exit ledge.
//
//   z = -16  ┌─────[L1]──────[EXIT]──┐  ledge top at 4.5 m
//   z = -11  ├───────────────────────┤
//            │E1                   E2│
//   z = -2   ╞═══════ glass ═════════╡
//            │        [device]       │
//   z = 8    └──────[S1]──spawn──────┘
import * as THREE from 'three';
import { signTexture } from '../textures.js';
import { makePortalGun } from './builder.js';

const LEDGE = 4.5;

export function build(b, ctx) {
  const m = b.mat;
  const H = 9;
  const walls = b.shell(-10, -16, 10, 8, H, { skip: ['n'] });
  const wallN = b.wallX(-10.4, 10.4, -16.4, -16, H, [{ x0: 3.3, x1: 4.7, y0: LEDGE, y1: 7 }]);

  // Ledge.
  b.box(-10, 0, -16, 10, LEDGE, -11, m.wall, { tile: 1.5 });
  b.strip(-10, LEDGE - 0.05, -11.02, 10, LEDGE, -10.97);

  // Glass wall with mullions.
  b.box(-10, 0, -2.1, 10, H, -2, m.glass, { gun: false, tile: 0 });
  for (const x of [-5, 0, 5]) b.box(x - 0.06, 0, -2.12, x + 0.06, H, -1.98, m.darkMetal, { gun: false, tile: 0 });
  b.box(-10, 0, -2.14, 10, 0.12, -1.96, m.darkMetal, { gun: false, tile: 0 });
  b.sign(signTexture([{ text: 'Portal energy passes through glass.', size: 34 }], { w: 768, h: 96, bg: '#0f1720', fg: '#9fd0ff', border: '#3aa0ff' }),
    3.2, 0.4, -2.5, 2.4, -1.96, 0);

  // Panels.
  b.panel('-z', 8, -4, walls.s); // S1, spawn side
  b.panel('+x', -10, -6.5, walls.w); // E1, beyond the glass
  b.panel('-x', 10, -6.5, walls.e); // E2, beyond the glass
  b.panel('+z', -16, -6, wallN, LEDGE); // L1, up on the ledge

  // Portal device on a pedestal.
  b.pedestal(0, 2.5, 0.7, 1.0);
  const gun = makePortalGun();
  gun.position.set(0, 1.25, 2.5);
  gun.userData.interact = 'gun';
  b.scene.add(gun);
  gun.traverse((o) => { if (o.isMesh) b.solids.push(o); });
  b.updaters.push((dt) => { gun.rotation.y += dt * 0.8; });

  // Exit corridor at ledge height.
  b.exitSign(4, 7.5, -15.98, 0);
  b.box(3.1, 0, -22.4, 4.9, LEDGE, -16.4, m.floor);
  b.box(2.7, LEDGE, -22.4, 3.1, 7.5, -16.4, m.wall);
  b.box(4.9, LEDGE, -22.4, 5.3, 7.5, -16.4, m.wall);
  b.box(2.7, LEDGE, -22.8, 5.3, 7.5, -22.4, m.wall);
  b.box(2.7, 7.5, -22.8, 5.3, 7.8, -16.4, m.ceiling);
  b.sign(signTexture([{ text: 'FREEDOM', size: 90 }], { bg: '#f4fff8', fg: '#1a6b3a' }), 1.6, 0.8, 4, 6.0, -22.38, 0, { glow: 1.4 });
  const exitLight = new THREE.PointLight('#c8ffd8', 8, 0, 2);
  exitLight.position.set(4, 7, -20);
  b.scene.add(exitLight);

  // Lighting.
  b.keyLight([0, 8.6, 0], [0, 0, -6], { intensity: 200, angle: 1.2, color: '#e6f0ff' });
  b.lamp(-5, H, 4, 26, '#dbe8ff');
  b.lamp(5, H, 4, 26, '#dbe8ff');
  b.lamp(-5, H, -8, 26, '#dbe8ff');
  b.lamp(5, H, -8, 26, '#dbe8ff');
  b.dust([-10, 0.2, -16], [10, 8, 8]);

  let passedGlass = false;
  let onLedge = false;
  return {
    spawn: { pos: new THREE.Vector3(0, 0, 6), yaw: 0 },
    hasGun: false,
    steps: [
      {
        label: 'Pick up the portal device',
        detail: 'Something useful is sitting on the pedestal.',
        hint: 'The portal device is on the pedestal in front of you. Press E.',
      },
      {
        label: 'Get past the glass wall',
        detail: 'No door, but you can see white panels on the other side.',
        hint: 'Portals only stick to white panels. Shoot one on your side (left click) and one on a panel behind the glass (right click). Portal shots pass through glass.',
      },
      {
        label: 'Reach the exit ledge',
        detail: 'The exit is 4.5 m up.',
        hint: 'There is a white panel up on the ledge. Put a portal there and the other on a panel you can walk to.',
      },
      { label: 'Exit', detail: 'Almost there.', hint: 'Walk through the door on the ledge.' },
    ],
    stage() {
      if (!ctx.flags.hasGun) return 0;
      if (!passedGlass) return 1;
      if (!onLedge) return 2;
      return 3;
    },
    exit: { min: new THREE.Vector3(3.1, LEDGE, -22.4), max: new THREE.Vector3(4.9, 7.5, -19.5) },
    update(dt, player) {
      if (player.pos.z < -2.2) passedGlass = true;
      if (player.pos.y > LEDGE - 0.1) {
        passedGlass = true;
        onLedge = true;
      }
    },
  };
}
