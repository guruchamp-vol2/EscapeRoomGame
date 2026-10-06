// Rebindable keyboard controls and gamepad input.
//
// The simulation reads a set of *canonical* key codes (KeyW, Space, ShiftLeft…),
// which is also what the auto-solver feeds it. Physical keys are translated to
// those through the player's bindings, and the gamepad adds its own.

export const ACTIONS = [
  { id: 'forward', label: 'Move forward', key: 'KeyW', canon: 'KeyW' },
  { id: 'back', label: 'Move back', key: 'KeyS', canon: 'KeyS' },
  { id: 'left', label: 'Move left', key: 'KeyA', canon: 'KeyA' },
  { id: 'right', label: 'Move right', key: 'KeyD', canon: 'KeyD' },
  { id: 'jump', label: 'Jump', key: 'Space', canon: 'Space' },
  { id: 'sprint', label: 'Sprint', key: 'ShiftLeft', canon: 'ShiftLeft' },
  { id: 'interact', label: 'Pick up / use', key: 'KeyE' },
  { id: 'hint', label: 'Hint', key: 'KeyH' },
  { id: 'recall', label: 'Recall cubes', key: 'KeyR' },
  { id: 'flashlight', label: 'Flashlight', key: 'KeyF' },
  { id: 'restart', label: 'Quick restart (hold)', key: 'KeyQ' },
  { id: 'photo', label: 'Photo mode', key: 'KeyP' },
];
const BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

export const defaultBindings = () => Object.fromEntries(ACTIONS.map((a) => [a.id, a.key]));

// Keys that can't be bound: they have fixed jobs (pause, keypad digits).
export const RESERVED = new Set(['Escape', 'Backspace', ...Array.from({ length: 10 }, (_, i) => `Digit${i}`), ...Array.from({ length: 10 }, (_, i) => `Numpad${i}`)]);

export function actionFor(code, bindings) {
  for (const a of ACTIONS) {
    const bound = bindings[a.id] ?? a.key;
    if (bound === code) return a.id;
    // Either Shift sprints while sprint is on a Shift key.
    if (a.id === 'sprint' && bound.startsWith('Shift') && code.startsWith('Shift')) return a.id;
  }
  return null;
}

export const canonFor = (action) => BY_ID[action]?.canon ?? null;

export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names = {
    Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl',
    AltLeft: 'Alt', AltRight: 'R-Alt', Tab: 'Tab', CapsLock: 'Caps', Enter: 'Enter',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=',
    BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  };
  return names[code] ?? code.replace(/^Numpad/, 'Num ');
}

// ---------- gamepad (standard mapping) ----------
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DEAD = 0.16;

function stick(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEAD) return { x: 0, y: 0, m: 0 };
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return { x: x * k, y: y * k, m: Math.min(1, (m - DEAD) / (1 - DEAD)) };
}

export class GamepadInput {
  constructor() {
    this.prev = [];
    this.lastUsed = -Infinity;
    this.pad = null;
    window.addEventListener('gamepadconnected', (e) => this.onConnect?.(e.gamepad));
  }

  // True when the gamepad was the last thing the player touched.
  get active() {
    return performance.now() - this.lastUsed < 4000;
  }

  // → null, or { move, look, held(b), pressed(b) } for this frame.
  poll() {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = [...pads].find((p) => p && p.connected);
    this.pad = pad ?? null;
    if (!pad) return null;
    const now = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    const prev = this.prev;
    this.prev = now;
    const move = stick(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const look = stick(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
    if (now.some(Boolean) || move.m || look.m) this.lastUsed = performance.now();
    return {
      move, look,
      held: (b) => !!now[b],
      pressed: (b) => !!now[b] && !prev[b],
    };
  }

  rumble(strong, weak = strong, ms = 120) {
    const act = this.pad?.vibrationActuator;
    if (!act || !this.active) return;
    act.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch?.(() => {});
  }
}
