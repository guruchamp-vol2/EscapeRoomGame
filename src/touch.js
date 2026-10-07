// On-screen controls for phones and tablets: a floating joystick on the left,
// drag anywhere else to look, and buttons for everything a keyboard does.
// Active when the main input is a touchscreen (laptops keep keyboard + mouse).

export const isTouchDevice = () =>
  matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches);

const BUTTONS = [
  { id: 'jump', label: 'Jump', cls: 'big' },
  { id: 'interact', label: 'Use' },
  { id: 'blue', label: '', cls: 'portal blue' },
  { id: 'orange', label: '', cls: 'portal orange' },
  { id: 'hint', label: '?', cls: 'small' },
  { id: 'recall', label: '⟲', cls: 'small' },
  { id: 'flashlight', label: '🔦', cls: 'small' },
  { id: 'photo', label: '📷', cls: 'small' },
  { id: 'pause', label: 'II', cls: 'small' },
  { id: 'tool', label: '⇄', cls: 'small' },
];

export class TouchControls {
  constructor({ onAction, onLook, onDigit }) {
    this.enabled = isTouchDevice();
    this.move = null; // {x, y} like a gamepad stick
    this.keys = new Set(); // canonical keys held (Space, ShiftLeft)
    this.onAction = onAction;
    this.onLook = onLook;
    if (!this.enabled) return;
    document.body.classList.add('touch');
    this._build(onDigit);
  }

  _build(onDigit) {
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `
      <div class="t-look"></div>
      <div class="t-stick"><div class="t-knob"></div></div>
      <div class="t-buttons">${BUTTONS.map((b) => `<button data-t="${b.id}" class="${b.cls ?? ''}">${b.label}</button>`).join('')}</div>
      <div class="t-keypad hidden">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0].map((d) => `<button data-d="${d}">${d}</button>`).join('')}</div>`;
    document.body.appendChild(root);
    this.root = root;
    const stick = root.querySelector('.t-stick');
    const knob = root.querySelector('.t-knob');
    const look = root.querySelector('.t-look');
    let stickId = null, origin = null;
    const lookers = new Map();

    look.addEventListener('pointerdown', (e) => {
      // Left 40% of the screen, lower 70%: a joystick appears under the thumb.
      if (stickId === null && e.clientX < innerWidth * 0.4 && e.clientY > innerHeight * 0.3) {
        stickId = e.pointerId;
        origin = { x: e.clientX, y: e.clientY };
        stick.style.left = `${e.clientX}px`;
        stick.style.top = `${e.clientY}px`;
        stick.classList.add('on');
        knob.style.transform = 'translate(-50%, -50%)';
      } else {
        lookers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      look.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId === stickId) {
        const R = 56;
        let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
        const m = Math.hypot(dx, dy);
        if (m > R) { dx *= R / m; dy *= R / m; }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        const k = Math.min(1, m / R);
        this.move = k < 0.12 ? null : { x: dx / R, y: dy / R };
        // Pushing the stick all the way sprints.
        if (k > 0.95) this.keys.add('ShiftLeft');
        else this.keys.delete('ShiftLeft');
        return;
      }
      const last = lookers.get(e.pointerId);
      if (!last) return;
      this.onLook(e.clientX - last.x, e.clientY - last.y);
      lookers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    const end = (e) => {
      if (e.pointerId === stickId) {
        stickId = null;
        this.move = null;
        this.keys.delete('ShiftLeft');
        stick.classList.remove('on');
      }
      lookers.delete(e.pointerId);
    };
    look.addEventListener('pointerup', end);
    look.addEventListener('pointercancel', end);

    root.querySelector('.t-buttons').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      e.preventDefault();
      b.classList.add('down');
      const id = b.dataset.t;
      if (id === 'jump') this.keys.add('Space');
      this.onAction(id);
    });
    const release = (e) => {
      const b = e.target.closest?.('[data-t]');
      if (!b) return;
      b.classList.remove('down');
      if (b.dataset.t === 'jump') this.keys.delete('Space');
    };
    root.querySelector('.t-buttons').addEventListener('pointerup', release);
    root.querySelector('.t-buttons').addEventListener('pointercancel', release);
    root.querySelector('.t-keypad').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-d]');
      if (!b) return;
      e.preventDefault();
      onDigit(b.dataset.d === '⌫' ? 'Backspace' : b.dataset.d);
    });
  }

  // Shown only while playing (not in menus).
  setActive(on) {
    if (!this.enabled) return;
    this.root.classList.toggle('on', on);
    if (!on) {
      this.move = null;
      this.keys.clear();
    }
  }

  setState({ gun, flashlight, keypad, tools }) {
    if (!this.enabled) return;
    const r = this.root;
    r.classList.toggle('gun', !!gun);
    r.classList.toggle('tools', !!tools);
    r.classList.toggle('flash', !!flashlight);
    r.querySelector('.t-keypad').classList.toggle('hidden', !keypad);
  }
}
