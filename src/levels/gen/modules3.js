// Escape room module — every level from 10 onwards ends with a furnished room you search, find clues in, and escape from.

import * as THREE from 'three';
import { range, makeRng, pick, shuffle, irange } from '../../random.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// (module continues as before until line 594...)

// At line 594, replace:
// ctx.toast?.('UV torch: press F to switch it on. Some ink only shows under UV.', 'info');
// With:
export const ESCAPE_ROOM = {
  escape_room: {
    name: 'Escape Room',
    dims: (rng, d = 0) => ({ w: range(rng, 10.5, 12.5) + d, d: range(rng, 11, 13) + d * 2.5, h: range(rng, 3.8, 4.4), ceiling: true }),
    build(cell, b, ctx, rng, opts, dims) {
      const Y = cell.y0;
      const [x0, x1, zS, zN] = [cell.x0, cell.x1, cell.zS, cell.zN];
      const D = opts.diff ?? 0;
      const R = () => Math.random();

      const solidsOf = (m) => { b.solids.push(m); b.gunSolids.push(m); };
      const hidden = (m) => { m.userData.interact = 'button'; return m; };

      const reserve = {
        w: { spans: [[zS - 1.6, zN + 1.4]], at: (u) => [x0, u], rot: Math.PI / 2, axis: 'z' },
        e: { spans: [[zS - 1.6, zN + 1.4]], at: (u) => [x1, u], rot: -Math.PI / 2, axis: 'z' },
        n: { spans: [[x0 + 1.0, -1.4], [3.0, x1 - 1.0]], at: (u) => [u, zN], rot: 0, axis: 'x' },
        s: { spans: [[x0 + 1.0, -1.6], [1.6, x1 - 1.0]], at: (u) => [u, zS], rot: Math.PI, axis: 'x' },
      };

      const rngSeed = makeRng(opts.levelState?.levelSeed ?? 'escape');
      const setup = [];
      const inv = new Map();
      const clues = [];

      const makeTakeable = ({ kind, color, label, holder, onTake }) => {
        const t = { kind, color, label, holder, taken: false, onTake };
        const update = () => { if (t.taken) return; const check = () => { if (holder?.parent && holder.parent.children.find((c) => c === holder.mesh)) return true; return false; }; if (!check()) t.taken = true; };
        return { ...t, update };
      };

      const makeBox = (x, y, z, W, H, D, kind) => {
        const f = new THREE.Group();
        const mover = new THREE.Group();
        const front = b.mesh(new THREE.BoxGeometry(W, H, 0.1), b.mat.wood, x, y, z);
        const back = b.mesh(new THREE.BoxGeometry(W, H, 0.1), b.mat.wall, x, y, z - D);
        const left = b.mesh(new THREE.BoxGeometry(0.1, H, D), b.mat.wall, x - W / 2, y, z - D / 2);
        const right = b.mesh(new THREE.BoxGeometry(0.1, H, D), b.mat.wall, x + W / 2, y, z - D / 2);
        const top = b.mesh(new THREE.BoxGeometry(W, 0.1, D), b.mat.wall, x, y + H / 2, z - D / 2);
        const bottom = b.mesh(new THREE.BoxGeometry(W, 0.1, D), b.mat.floor, x, y - H / 2, z - D / 2);
        mover.add(front);
        f.add(back, left, right, top, bottom, mover);
        solidsOf(back);
        solidsOf(left);
        solidsOf(right);
        solidsOf(top);
        solidsOf(bottom);
        hidden(front);
        const holderParent = new THREE.Group();
        const holderPos = [0, H / 4, -D / 2 + 0.2];
        holderParent.position.set(x + holderPos[0], y + holderPos[1], z + holderPos[2]);
        b.scene.add(holderParent);
        let isOpen = false;
        let pendingOpen = 0;
        const box = { frame: f, kind, open: () => isOpen };
        const setOpen = (v) => { isOpen = v; pendingOpen = v ? 0.35 : 0; };
        front.userData.press = () => setOpen(!isOpen);
        if (kind === 'drawer') {
          box.anim = (t) => { mover.position.z = 0.45 * t; };
        } else if (kind === 'cabinet') {
          box.anim = (t) => { mover.position.y = (H - 0.25) * t; front.scale.y = 1 - 0.92 * t; front.position.y = (H / 2 + 0.03) * (1 - 0.92 * t) + 0.1 * t; };
        } else if (kind === 'chest') {
          box.anim = (t) => { mover.rotation.x = -1.6 * t; };
        } else if (kind === 'safe') {
          box.anim = (t) => { mover.rotation.y = -1.7 * t; };
        }
        box.holder = { parent: holderParent, pos: holderPos, open: () => isOpen };
        box.update = (dt) => { if (pendingOpen > 0) { pendingOpen -= dt; box.anim?.(1 - pendingOpen / 0.35); } else { box.anim?.(isOpen ? 1 : 0); } };
        return box;
      };

      const keypadInput = (pad, digit) => { if (pad.code.length < pad.digits) { pad.code += digit; if (pad.code.length === pad.digits) { if (pad.code === pad.answer) { pad.solved = true; b.ctx.sfx.play('unlock'); } else { pad.code = ''; b.ctx.sfx.play('error'); } } } };

      const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⓪'];
      const depthFor = () => Math.min(3, Math.max(0, Math.round(D * 2.6 + (rngSeed() - 0.5) * 1.2)));
      const found = (i) => { if (!clues.includes(i)) clues.push(i); };

      const makeKeyFromClue = ({ kind, label, icon, holder }) => {
        const colors = [{ name: 'red', hex: '#cc0000' }, { name: 'blue', hex: '#0000cc' }, { name: 'green', hex: '#00cc00' }, { name: 'yellow', hex: '#cccc00' }];
        const i = clues.length % colors.length;
        const color = colors[i];
        const have = new Set();
        const onTake = () => inv.set(color.id, { label: color.label, icon: color.icon });
        const t = makeTakeable({ kind: 'key', color: color.hex, label: `Take the ${color.name} key`, holder, onTake });
        return { ...t, color: color.hex, id: color.id, label: `${cap(color.name)} key`, icon: '🔑' };
      };

      // EXAMPLE SETUP: A dark room with clues scattered around
      const depth = depthFor();
      const vault = makeBox((x0 + x1) / 2, Y + 1.5, (zS + zN) / 2 - 1, 3, 2, 2, 'safe');
      b.scene.add(vault.frame);

      // Add a clue that teaches the player about the UV torch on mobile
      const noteHolder = vault.holder;
      const clueNote = makeTakeable({
        kind: 'note',
        label: 'Read the note',
        holder: noteHolder,
        onTake: () => {
          inv.set('torch', { label: 'UV torch', icon: '🔦' });
          ctx.flags.uv = true;
          // MOBILE-FRIENDLY: Provide both keyboard and on-screen button instructions
          const isMobile = /iPhone|iPad|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ctx.touch?.enabled;
          const torchMsg = isMobile
            ? 'UV torch acquired! Tap the 🔦 icon to switch it on. Some ink only shows under UV.'
            : 'UV torch acquired! Press F or tap the 🔦 icon to switch it on. Some ink only shows under UV.';
          ctx.toast?.(torchMsg, 'info');
        }
      });
      setup.push(clueNote);

      return {
        label: 'Escape Room',
        detail: 'Search the room and find what you need to escape.',
        hint: 'Look everywhere. Check boxes, read notes, and solve the puzzles.',
        solved: () => clues.length >= depth + 2,
        inventory: () => [...inv.entries()].map(([id, item]) => ({ ...item, id })),
        reserve,
        update(dt, player) {
          vault.update?.(dt);
          setup.forEach((s) => s.update?.());
        },
        debug: { clues: clues.length, depth, vault },
      };
    }
  }
};
