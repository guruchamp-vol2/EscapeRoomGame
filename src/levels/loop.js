// Chamber 03 — The Loop. An endless corridor: a portal at each end links back to
// the other, so it never ends in either direction. Each lap changes the "room
// number": forward +1, backward −1. Rooms 2–4 each show one digit of the code;
// the exit only exists in room 0, behind where you started.
import * as THREE from 'three';
import { signTexture, dynamicTexture } from '../textures.js';
import { randomCode } from '../random.js';

export function build(b, ctx) {
  const m = b.mat;
  const H = 3.6;
  const code = randomCode(ctx.rng);
  b.scene.fog = new THREE.Fog(b.theme.fog, 6, 34);

  // Corridor shell.
  b.box(-2, -0.4, -24.4, 2, 0, 0.4, m.floor, { tile: 4 });
  b.box(-2, H, -24.4, 2, H + 0.4, 0.4, m.ceiling);
  b.box(-2, 0, -24.4, -1.6, H, 0.4, m.wall);
  b.wallZ(1.6, 2.0, -24.4, 0.4, H, [{ z0: -12.7, z1: -11.3, y0: 0, y1: 2.5 }]);
  b.box(-2, 0, -24.4, 2, H, -24, m.wall);
  b.box(-2, 0, 0, 2, H, 0.4, m.wall);
  // Floor guide strips make the repetition obvious.
  b.strip(-1.6, 0, -24, -1.5, 0.02, 0);
  b.strip(1.5, 0, -24, 1.6, 0.02, 0);

  // The two ends are one portal pair.
  const fogColor = new THREE.Color(b.theme.fog);
  const opts = { width: 3.2, height: H, flatColor: fogColor.getHex() };
  const north = b.portal({ ...opts, name: 'loop-north' }, new THREE.Vector3(0, H / 2, -23.4), 0);
  const south = b.portal({ ...opts, name: 'loop-south' }, new THREE.Vector3(0, H / 2, -0.6), Math.PI);
  north.link = south;
  south.link = north;

  // Side door, keypad and the room plaque.
  const door = b.door(1.62, 0, -12.7, 1.78, 2.5, -11.3, [0, 0, -1.4]);
  const plaque = dynamicTexture(512, 128);
  b.sign(plaque.tex, 1.2, 0.3, 1.58, 2.85, -12, -Math.PI / 2, { glow: 1.3 });
  const clue = dynamicTexture(1024, 600);
  b.sign(clue.tex, 2.2, 1.29, -1.58, 1.75, -12, Math.PI / 2, { glow: 1.2 });
  b.sign(signTexture([{ text: 'Every room looks the same.', size: 36 }, { text: 'Look closer.', size: 36 }],
    { bg: '#0d1514', fg: '#9fffd8', border: '#3dffb0' }), 1.8, 0.9, -1.58, 1.8, -4.5, Math.PI / 2);

  let room = 1;
  let laps = 0;
  const seen = new Set();
  let reachedExitRoom = false;

  const keypad = b.keypad({
    x: 1.58, y: 1.45, z: -10.4, rotY: -Math.PI / 2, code,
    enabled: () => room === 0,
    onSolve: () => door.setOpen(true),
  });

  // Exit corridor (only reachable through the door in room 0).
  b.box(2, -0.4, -13.1, 9.4, 0, -10.9, m.floor);
  b.box(2, 0, -13.1, 9.4, 3, -12.7, m.wall);
  b.box(2, 0, -11.3, 9.4, 3, -10.9, m.wall);
  b.box(9, 0, -12.7, 9.4, 3, -11.3, m.wall);
  b.box(2, 3, -13.1, 9.4, 3.3, -10.9, m.ceiling);
  b.sign(signTexture([{ text: 'FREEDOM', size: 90 }], { bg: '#f4fff8', fg: '#1a6b3a' }), 1.2, 0.6, 8.98, 1.6, -12, -Math.PI / 2, { glow: 1.4 });
  const exitLight = new THREE.PointLight('#c8ffd8', 6, 0, 2);
  exitLight.position.set(7, 2.5, -12);
  b.scene.add(exitLight);

  // Lights tint per room so laps feel different.
  const lamps = [-4, -12, -20].map((z) => b.lamp(0, H, z, 7, '#bfffe9', 0.7));
  b.keyLight([0, H - 0.1, -12], [0, 0, -12], { intensity: 30, angle: 1.3, color: '#dffff3' });
  b.dust([-1.5, 0.2, -24], [1.5, 3.4, 0], 160);

  function drawRoom() {
    const exitRoom = room === 0;
    {
      const { g, w, h, tex } = plaque;
      g.fillStyle = '#0a1110';
      g.fillRect(0, 0, w, h);
      g.fillStyle = exitRoom ? '#4dff88' : '#9fffd8';
      g.font = 'bold 76px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(exitRoom ? 'EXIT' : `ROOM ${room}`, w / 2, h / 2 + 4);
      tex.needsUpdate = true;
    }
    {
      const { g, w, h, tex } = clue;
      g.fillStyle = '#0d1514';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#3dffb0';
      g.lineWidth = 10;
      g.strokeRect(5, 5, w - 10, h - 10);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#9fffd8';
      let title = `ROOM ${room}`;
      let big = '';
      let small = '';
      if (room >= 2 && room <= 4) {
        title = `DIGIT ${room - 1} OF 3`;
        big = code[room - 2];
      } else if (room === 1) small = 'Keep walking.';
      else if (room === 0) {
        title = 'EXIT ROOM';
        small = 'Enter the code by the door.';
      } else if (room > 4) small = 'Nothing more this way. Turn around.';
      else small = 'Too far back.';
      g.font = 'bold 72px system-ui, sans-serif';
      g.fillText(title, w / 2, 110);
      if (big) {
        g.font = 'bold 340px system-ui, sans-serif';
        g.shadowColor = '#3dffb0';
        g.shadowBlur = 30;
        g.fillText(big, w / 2, 360);
        g.shadowBlur = 0;
      } else {
        g.font = '48px system-ui, sans-serif';
        g.fillText(small, w / 2, 340);
      }
      tex.needsUpdate = true;
    }
    const hue = (((room * 0.17) % 1) + 1) % 1;
    for (const l of lamps) l.color.setHSL(0.45 + hue * 0.5, 0.5, 0.75);
    door.setOpen(keypad.solved && exitRoom);
    keypad.idle();
  }
  drawRoom();

  return {
    spawn: { pos: new THREE.Vector3(0, 0, -6), yaw: 0 },
    hasGun: false,
    steps: [
      {
        label: 'Find the three digits',
        detail: 'The corridor repeats forever. Watch the walls each time around.',
        hint: 'Keep walking forward. Each lap is a new room number, and rooms 2, 3 and 4 each show one digit on the wall opposite the door.',
      },
      {
        label: 'Find the way out',
        detail: 'None of the rooms ahead have an exit.',
        hint: 'Walking forward counts up. Walking the other way counts down. The exit is in room 0, behind where you started.',
      },
      {
        label: 'Enter the code',
        detail: 'The keypad only works in the exit room.',
        hint: 'Type the digits from rooms 2, 3 and 4, in that order, on the keypad beside the door.',
      },
      { label: 'Exit', detail: 'The door is open, for now.', hint: 'Walk through the side door.' },
    ],
    stage() {
      if (seen.size < 3) return 0;
      if (!reachedExitRoom) return 1;
      if (!keypad.solved) return 2;
      return 3;
    },
    exit: { min: new THREE.Vector3(5, 0, -12.7), max: new THREE.Vector3(9, 3, -11.3) },
    onTeleport(portal) {
      room += portal === north ? 1 : -1;
      laps++;
      if (laps >= 10) ctx.unlock('loop_master');
      drawRoom();
    },
    update(dt, player) {
      if (room >= 2 && room <= 4 && player.pos.z < -7 && player.pos.z > -17) seen.add(room);
      if (room === 0 && seen.size === 3) reachedExitRoom = true;
    },
  };
}
