// DOM side of the game: HUD, notifications and the menu screens.
import { ACHIEVEMENTS } from './achievements.js';
import { LEVELS, GROUPS } from './levels/meta.js';
import { SHOP, NOTES, levelUnlocked, continueId } from './progress.js';

const $ = (sel) => document.querySelector(sel);

const ICONS = {
  device: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="9" width="15" height="6" rx="3" stroke="#e8eef2"/><circle cx="9" cy="12" r="4.5" stroke="#3aa0ff"/><circle cx="14" cy="12" r="4.5" stroke="#ff8a1f"/><path d="M18 12h3" stroke="#e8eef2"/></svg>`,
  keycard: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2" stroke="#d63a3a"/><path d="M3 10h18" stroke="#d63a3a"/><path d="M6 14h5" stroke="#e8eef2"/></svg>`,
};
const ITEM_NAMES = { device: 'Portal device', keycard: 'Keycard' };

// Screens reached from another screen; "Back" returns to where they were opened.
const SUBSCREENS = new Set(['settings', 'controls', 'leaderboard', 'profile', 'auth', 'chambers', 'forgot', 'workshop', 'journal']);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pad = (n) => String(n).padStart(2, '0');

export function formatTime(t) {
  const s = Math.max(0, Math.floor(t));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

// 83456 → "01:23.4"
export function formatMs(ms) {
  if (ms == null) return '—';
  return `${formatTime(ms / 1000)}.${Math.floor((Math.abs(ms) % 1000) / 100)}`;
}

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.hud = $('#hud');
    this.menu = $('#menu');
    this.toasts = $('#toasts');
    this.achPop = $('#achievement-pop');
    this.screen = 'main';
    this.returnTo = 'main';
    this._lastPrompt = null;
    this._lastInventory = '';
    this._achQueue = [];
    this._achShowing = false;
    this.authMode = 'login';
    this.boardLevel = LEVELS[0].id;
    this.boardKind = 'all';

    this.menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      const action = btn.dataset.action;
      if (SUBSCREENS.has(action)) {
        if (!SUBSCREENS.has(this.screen)) this.returnTo = this.screen;
        this.show(action);
      } else if (action === 'back') {
        this.show(this.returnTo);
      }
      handlers.onAction(action, btn.dataset);
    });

    this.settingsInputs = [...document.querySelectorAll('.settings input')];
    for (const input of this.settingsInputs) {
      input.addEventListener('input', () => {
        const value = input.type === 'checkbox' ? input.checked : parseFloat(input.value);
        this._showSettingValue(input.name, value);
        handlers.onSetting(input.name, value);
      });
    }
    $('#race-ghost').addEventListener('change', (e) => handlers.onSetting('raceGhost', e.target.checked));

    $('#auth-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (b) this.setAuthMode(b.dataset.mode);
    });
    this._form('#auth-form', '#auth-submit', '#auth-error', async (f) => {
      await handlers.onAuth(f.username.value.trim(), f.password.value, this.authMode, f.email.value.trim());
      f.password.value = '';
      this.show(this.returnTo === 'auth' ? 'main' : this.returnTo);
    });
    this._form('#forgot-form', null, '#forgot-error', async (f) => {
      $('#forgot-ok').textContent = '';
      const res = await handlers.onForgot(f.login.value.trim());
      $('#forgot-ok').textContent = res.message;
    });
    this._form('#reset-form', null, '#reset-error', async (f) => {
      if (f.password.value !== f.confirm.value) throw new Error("Passwords don't match.");
      await handlers.onReset(f.password.value);
      f.reset();
      this.toast('Password changed. You are logged in.', { type: 'success' });
      this.show('main');
    });
    this._form('#email-form', null, '#email-error', async (f) => {
      await handlers.onEmail(f.email.value.trim());
      this.toast('Email saved.', { type: 'success' });
    });

    const levelSelect = $('#board-level');
    levelSelect.innerHTML = GROUPS.map((g) => `<optgroup label="${esc(g.name)}">${
      g.levels.map((l) => `<option value="${l.id}">${levelLabel(l)} · ${esc(l.name)}</option>`).join('')}</optgroup>`).join('');
    levelSelect.addEventListener('change', () => {
      this.boardLevel = levelSelect.value;
      if (this.boardKind === 'daily') this.setBoardTab('all');
      handlers.onBoard(this.boardLevel, this.boardKind);
    });
    $('#board-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-board]');
      if (!b) return;
      this.setBoardTab(b.dataset.board);
      handlers.onBoard(this.boardLevel, this.boardKind);
    });

    this.group = null;
    $('#group-tabs').addEventListener('click', (e) => {
      const t = e.target.closest('[data-group]');
      if (!t) return;
      this.group = Number(t.dataset.group);
      this._renderChambers();
    });
    this.shopSlot = 'portal';
    $('#shop-tabs').addEventListener('click', (e) => {
      const t = e.target.closest('[data-slot]');
      if (!t) return;
      this.shopSlot = t.dataset.slot;
      this.renderWorkshop(this._progress);
    });
    $('#shop').addEventListener('click', (e) => {
      const item = e.target.closest('[data-item]');
      if (item) handlers.onShop(item.dataset.op, this.shopSlot, item.dataset.item);
    });
    $('#chambers').addEventListener('click', (e) => {
      const card = e.target.closest('[data-level]');
      if (card && !card.disabled) handlers.onChamber(card.dataset.level);
    });
  }

  // Wires a form: disables while submitting, shows thrown errors inline.
  _form(formSel, submitSel, errorSel, fn) {
    const form = $(formSel);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = submitSel ? $(submitSel) : form.querySelector('[type="submit"]');
      $(errorSel).textContent = '';
      submit.disabled = true;
      try {
        await fn(form);
      } catch (err) {
        $(errorSel).textContent = err.message;
      } finally {
        submit.disabled = false;
      }
    });
  }

  // ---------- menus ----------
  show(screen) {
    this.screen = screen;
    this.menu.classList.remove('hidden');
    document.body.classList.add('menu-open');
    for (const s of this.menu.querySelectorAll('section')) {
      s.classList.toggle('hidden', s.dataset.screen !== screen);
    }
    const focus = { auth: '#auth-form [name="username"]', forgot: '#forgot-form [name="login"]', reset: '#reset-form [name="password"]' }[screen];
    if (focus) setTimeout(() => $(focus)?.focus(), 50);
    if (screen === 'forgot') $('#forgot-ok').textContent = '';
  }

  hideMenu() {
    this.menu.classList.add('hidden');
    document.body.classList.remove('menu-open');
    this.hud.classList.remove('hidden');
  }

  get menuOpen() {
    return !this.menu.classList.contains('hidden');
  }

  setPauseInfo(levelName, objective, elapsed) {
    $('#pause-chamber').textContent = `Paused · ${levelName}`;
    $('#pause-objective').textContent = objective;
    $('#pause-time').textContent = `Time so far: ${formatTime(elapsed)}`;
  }

  // ---------- main menu ----------
  renderMenu(account, settings, progress) {
    this._progress = progress;
    if (progress) {
      const r = progress.rank();
      const streak = progress.data.streak;
      $('#stat-bar').innerHTML = `<span class="rank" title="Rank">${esc(r.title)}</span>
        <span class="stars" title="Stars">★ ${r.stars}</span>
        <span class="frags" title="Fragments">◆ ${progress.data.fragments}</span>
        ${streak.count ? `<span class="streak" title="Daily streak">🔥 ${streak.count}</span>` : ''}`;
      const qs = progress.quests();
      $('#quests').innerHTML = '<div class="q-head"><span>Daily quests</span><span>new every day</span></div>' +
        qs.map((q) => `<div class="quest ${q.done ? 'done' : ''}"><span class="rw">+${q.reward} ◆</span>${esc(q.text)}${
          q.goal > 1 && !q.done ? ` · ${q.progress}/${q.goal}` : ''}<div class="bar" style="width:${(q.progress / q.goal) * 100}%"></div></div>`).join('');
    }
    const bar = $('#account-bar');
    if (!account.online) {
      bar.innerHTML = '<span class="dot off"></span> Offline: progress is saved on this device only.';
    } else if (account.user) {
      bar.innerHTML = `<span class="dot"></span> Signed in as <b>${esc(account.user.username)}</b>
        <button class="linkish" data-action="logout">Log out</button>`;
    } else {
      bar.innerHTML = `Playing as a guest
        <button class="linkish" data-action="auth">Log in / Sign up</button>`;
    }

    const next = LEVELS.find((l) => l.id === (progress ? continueId(progress) : account.nextLevel));
    const anyDone = Object.keys(account.levels).length > 0;
    $('#continue-btn').textContent = anyDone ? `Continue · ${next.name}` : 'Play';

    const daily = account.dailyBestMs;
    $('#daily-btn').innerHTML = `Daily challenge<small>${esc(account.today)} · ${
      daily == null ? 'a new level, the same for everyone' : `your best ${formatMs(daily)}`}</small>`;

    this._account = account;
    if (this.group == null) {
      const nextLevel = LEVELS.find((l) => l.id === account.nextLevel);
      this.group = GROUPS.findIndex((g) => g.levels.includes(nextLevel));
    }
    this._renderChambers();
    $('#race-ghost').checked = settings.raceGhost;
    $('#race-ghost').disabled = !account.online;
  }

  _unlocked(index) {
    return this._progress ? levelUnlocked(this._progress, index) : this._account.isUnlocked(index);
  }

  renderWorkshop(progress) {
    this._progress = progress;
    $('#wallet').textContent = `◆ ${progress.data.fragments} Fragments`;
    for (const b of document.querySelectorAll('#shop-tabs button')) b.classList.toggle('active', b.dataset.slot === this.shopSlot);
    const slot = this.shopSlot;
    $('#shop').innerHTML = SHOP[slot].map((item) => {
      const owned = progress.owns(slot, item.id);
      const equipped = progress.data.equipped[slot] === item.id;
      const affordable = progress.data.fragments >= item.price;
      const label = equipped ? 'Equipped' : owned ? 'Equip' : `◆ ${item.price}`;
      return `<button class="shop-item ${equipped ? 'equipped' : ''} ${!owned && !affordable ? 'locked' : ''}" data-item="${item.id}" data-op="${owned ? 'equip' : 'buy'}">
        <span class="swatch" style="background: linear-gradient(135deg, ${item.colors[0]} 50%, ${item.colors[1]} 50%)"></span>
        <b>${esc(item.name)}</b><span class="price">${label}</span></button>`;
    }).join('');
  }

  renderJournal(progress) {
    const found = progress.data.notes;
    $('#journal-count').textContent = `${found.length} of ${NOTES.length} notes found. One is hidden in level 13 of each world.`;
    $('#journal').innerHTML = NOTES.map((text, w) => (found.includes(w)
      ? `<div class="entry"><b>NOTE ${w + 1} · ${esc(GROUPS[w + 1].name)}</b>${esc(text)}</div>`
      : `<div class="entry missing">Note ${w + 1}: somewhere in ${esc(GROUPS[w + 1].name)}…</div>`)).join('');
  }

  showNote(w, text, fresh) {
    const el = $('#note-pop');
    el.querySelector('.note-head').textContent = `CURATOR'S NOTE ${w + 1} / ${NOTES.length}`;
    el.querySelector('.note-body').textContent = text;
    el.querySelector('.note-foot').textContent = fresh ? '+50 ◆ · added to your Journal' : 'Already in your Journal';
    el.classList.add('show');
    clearTimeout(this._noteTimer);
    this._noteTimer = setTimeout(() => el.classList.remove('show'), 9000);
  }

  _renderChambers() {
    const account = this._account;
    const levels = account.levels;
    $('#group-tabs').innerHTML = GROUPS.map((g, i) => {
      const done = g.levels.filter((l) => levels[l.id]).length;
      const p = this._progress;
      const gate = i > 1 && p && !p.isWorldOpen(i - 1) ? `<span class="gate">★ ${p.worldGate(i - 1)} needed</span>` : '';
      const open = !gate && this._unlocked(LEVELS.indexOf(g.levels[0]));
      return `<button data-group="${i}" class="${i === this.group ? 'active' : ''} ${open ? '' : 'locked'}">
        <b>${esc(g.name)}</b><small>${done}/${g.levels.length}</small>${gate}</button>`;
    }).join('');
    $('#group-tabs').querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    const group = GROUPS[this.group];
    $('#group-tagline').textContent = group.tagline;
    const story = this.group === 0;
    $('#chambers').className = story ? 'chambers' : 'tiles';
    $('#chambers').innerHTML = group.levels.map((l) => {
      const i = LEVELS.indexOf(l);
      const best = levels[l.id]?.bestMs;
      const locked = !this._unlocked(i);
      if (story) {
        return `<button class="chamber ${best != null ? 'done' : ''}" data-level="${l.id}" ${locked ? 'disabled' : ''}>
          <span class="num">${pad(l.number)}</span><b>${esc(l.name)}</b>
          <span class="tag">${locked ? `Complete ${esc(LEVELS[i - 1].name)} to unlock` : esc(l.tagline)}</span>
          <span class="best">${best != null ? `Best ${formatMs(best)}` : ''}</span></button>`;
      }
      const gimmicks = l.plan.modules.length;
      return `<button class="tile ${best != null ? 'done' : ''}" data-level="${l.id}" ${locked ? 'disabled' : ''}
          title="${esc(l.name)} · ${gimmicks} puzzle${gimmicks > 1 ? 's' : ''}">
        <span class="num">${l.number}</span><span class="name">${esc(l.name)}</span>
        <span class="stars">${starsHtml(this._progress?.data.stars[l.id] ?? 0, 10)}</span>
        <span class="best">${best != null ? formatMs(best) : locked ? '🔒' : ''}</span></button>`;
    }).join('');
  }

  // ---------- auth ----------
  setAuthMode(mode) {
    this.authMode = mode;
    for (const b of document.querySelectorAll('#auth-tabs button')) b.classList.toggle('active', b.dataset.mode === mode);
    const create = mode === 'register';
    const form = $('#auth-form');
    form.classList.toggle('mode-register', create);
    form.classList.toggle('mode-login', !create);
    $('#auth-submit').textContent = create ? 'Create account' : 'Log in';
    form.password.autocomplete = create ? 'new-password' : 'current-password';
    $('#auth-note').textContent = create
      ? 'Username: 3–16 letters, numbers or underscores. Password: at least 8 characters.'
      : 'Log in to save progress and post times to the leaderboards.';
    $('#auth-error').textContent = '';
  }

  // ---------- leaderboard ----------
  setBoardTab(kind) {
    this.boardKind = kind;
    for (const b of document.querySelectorAll('#board-tabs button')) b.classList.toggle('active', b.dataset.board === kind);
    $('#board-level').disabled = kind === 'daily';
  }

  openBoard(level, kind = 'all') {
    this.boardLevel = level;
    $('#board-level').value = level;
    this.setBoardTab(kind);
  }

  renderBoard(result, me) {
    const el = $('#board');
    const you = $('#board-you');
    you.textContent = '';
    if (result.loading) {
      el.innerHTML = '<p class="board-msg">Loading…</p>';
      return;
    }
    if (result.error) {
      el.innerHTML = `<p class="board-msg">${esc(result.error)}</p>`;
      return;
    }
    if (result.board === 'daily') $('#board-level').value = result.level;
    if (!result.rows.length) {
      el.innerHTML = `<p class="board-msg">${result.board === 'daily' ? `No escapes yet today (${esc(result.today)}).` : 'No escapes yet. Be the first!'}</p>`;
      return;
    }
    const mine = (u) => me && u.toLowerCase() === me.toLowerCase();
    el.innerHTML = `<table><thead><tr><th>#</th><th>Player</th><th class="num">Hints</th><th class="num">Time</th></tr></thead><tbody>${
      result.rows.map((r) => `<tr class="${mine(r.username) ? 'me' : ''}">
        <td class="medal">${r.rank}</td><td>${esc(r.username)}${r.hasGhost && r.rank === 1 ? ' <span title="Ghost available">👻</span>' : ''}</td>
        <td class="num">${r.hints}</td><td class="num">${formatMs(r.timeMs)}</td></tr>`).join('')
    }</tbody></table>`;
    if (result.you) you.textContent = `You're #${result.you.rank} of ${result.total} with ${formatMs(result.you.timeMs)}.`;
    else if (!me) you.textContent = 'Log in to get on the board.';
  }

  // ---------- profile ----------
  renderProfile(account) {
    const user = account.user;
    const unlocked = account.achievements;
    const levels = account.levels;
    $('#profile-eyebrow').textContent = user ? 'Profile' : 'Guest profile';
    $('#profile-name').textContent = user ? user.username : 'Playing as a guest';
    const stat = (k, v) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`;
    const cleared = LEVELS.filter((l) => levels[l.id]).length;
    const label = 'Levels cleared';
    if (user) {
      const s = user.stats;
      $('#profile-stats').innerHTML = [
        stat(label, `${cleared}/${LEVELS.length}`), stat('Escapes', s.escapes),
        stat('Runs started', s.runs), stat('Teleports', s.teleports),
        stat('Daily best', formatMs(user.dailyBestMs)), stat('Member since', new Date(user.createdAt).toLocaleDateString()),
      ].join('');
    } else {
      $('#profile-stats').innerHTML = stat(label, `${cleared}/${LEVELS.length}`) +
        stat('Account', account.online ? 'Log in to track stats' : 'Offline');
    }
    const emailForm = $('#email-form');
    emailForm.classList.toggle('hidden', !user);
    $('#email-error').textContent = '';
    if (user) emailForm.email.value = user.email ?? '';
    $('#profile-levels').innerHTML = GROUPS.map((g) => {
      const done = g.levels.filter((l) => levels[l.id]).length;
      return `<tr><td>${esc(g.name)}</td><td>${done} / ${g.levels.length}</td></tr>`;
    }).join('');
    $('#ach-count').textContent = `Achievements ${unlocked.size} / ${ACHIEVEMENTS.length}`;
    $('#profile-achievements').innerHTML = ACHIEVEMENTS.map((a) => achievementHtml(a, unlocked.has(a.key))).join('');
  }

  achievementPop(def) {
    this._achQueue.push(def);
    if (!this._achShowing) this._nextAchievement();
  }

  _nextAchievement() {
    const def = this._achQueue.shift();
    if (!def) {
      this._achShowing = false;
      return;
    }
    this._achShowing = true;
    this.achPop.innerHTML = `<span class="icon">${def.icon}</span><div><small>Achievement unlocked</small><b>${esc(def.name)}</b></div>`;
    this.achPop.classList.add('show');
    setTimeout(() => {
      this.achPop.classList.remove('show');
      setTimeout(() => this._nextAchievement(), 400);
    }, 3200);
  }

  // ---------- chapter card ----------
  chapter(level, daily) {
    const el = $('#chapter');
    $('#chapter-num').textContent = daily ? 'DAILY CHALLENGE' : level.story ? `CHAMBER ${pad(level.number)}` : `LEVEL ${level.number} · ${worldName(level)}`;
    $('#chapter-name').textContent = level.name;
    $('#chapter-tag').textContent = level.tagline;
    el.classList.add('show');
    clearTimeout(this._chapterTimer);
    this._chapterTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  setChamberLabel(level, daily) {
    $('#obj-chamber').innerHTML = daily ? `${esc(level.name.replace(/^Daily · /, ''))}<span class="daily-tag">DAILY</span>` : `${levelLabel(level)} · ${esc(level.name)}`;
  }

  setGhostDelta(text) {
    $('#ghost-delta').textContent = text;
  }

  // ---------- win ----------
  showWin({ level, final, daily, time, best, record, hints, portals, teleports, splits, newAchievements, hasNext, ghostText, reward, nextLocked, nextGate, par }) {
    $('#win-eyebrow').textContent = daily ? `Daily challenge · ${level.name.replace(/^Daily · /, '')}` : `${level.story ? 'Chamber' : 'Level'} ${levelLabel(level)} · ${level.name}`;
    $('#win-title').innerHTML = final ? 'YOU<span>ESCAPED</span>' : 'CHAMBER<span>CLEAR</span>';
    $('#win-record').classList.toggle('hidden', !record);
    $('#win-rank').textContent = '';
    $('#win-ghost').textContent = ghostText ?? '';
    $('#win-stats').innerHTML = [
      ['Time', formatMs(time * 1000)],
      ['Best', formatMs(best)],
      ['Portals fired', portals],
      ['Hints used', hints],
      ['Teleports', teleports],
      ['Rating', rating(time, hints, level.number)],
    ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    $('#win-new-ach').innerHTML = newAchievements.map((a) => achievementHtml(a, true)).join('');
    $('#win-splits').innerHTML = splits.map(({ label, ms, bestMs }) => {
      let delta = '<td></td>';
      if (bestMs != null) {
        const d = ms - bestMs;
        delta = `<td class="${d <= 0 ? 'faster' : 'slower'}">${d <= 0 ? '−' : '+'}${formatMs(Math.abs(d))}</td>`;
      }
      return `<tr><td>${esc(label)}</td><td>${formatMs(ms)}</td>${delta}</tr>`;
    }).join('');
    if (reward) {
      let parText = '';
      if (reward.stars < 3 && par) {
        parText = reward.stars === 1
          ? `<small>2★: under ${formatTime(par.two / 1000)} with at most 1 hint</small>`
          : `<small>3★: under ${formatTime(par.three / 1000)} with no hints</small>`;
      }
      $('#win-stars').innerHTML = starsHtml(reward.stars) + parText;
      $('#win-rewards').innerHTML = [
        `+${reward.fragments} ◆`,
        reward.first ? 'First clear' : '',
        reward.gained && !reward.first ? `+${reward.gained} new ★` : '',
        reward.streakBonus ? `🔥 ${reward.streak}-day streak +${reward.streakBonus} ◆` : '',
        ...reward.quests.map((q) => `Quest done: ${esc(q.text)} +${q.reward} ◆`),
      ].filter(Boolean).map((t) => `<span>${t}</span>`).join('');
    } else {
      $('#win-stars').innerHTML = '';
      $('#win-rewards').innerHTML = '';
    }
    const next = $('#next-btn');
    next.classList.toggle('hidden', !hasNext);
    next.disabled = !!nextLocked;
    next.textContent = nextLocked ? `Next world needs ★ ${nextGate}` : 'Next level';
    this.hud.classList.add('hidden');
    this.show('win');
  }

  setWinRank(html) {
    $('#win-rank').innerHTML = html;
  }

  loadSettings(settings) {
    for (const input of this.settingsInputs) {
      const v = settings[input.name];
      if (input.type === 'checkbox') input.checked = v;
      else input.value = v;
      this._showSettingValue(input.name, v);
    }
  }

  _showSettingValue(name, v) {
    const out = this.menu.querySelector(`output[data-for="${name}"]`);
    if (!out) return;
    if (name === 'fov') out.textContent = `${v}°`;
    else if (name === 'volume') out.textContent = `${Math.round(v * 100)}%`;
    else out.textContent = `${Number(v).toFixed(2)}×`;
  }

  // ---------- HUD ----------
  setObjectives(steps, current, hintsUsed) {
    $('#obj-list').innerHTML = steps.map((s, i) => {
      const cls = i < current ? 'done' : i === current ? 'current' : i > current + 1 ? 'locked' : '';
      return `<li class="${cls}">${s.label}</li>`;
    }).join('');
    $('#obj-detail').innerHTML = steps[current]?.detail ?? '';
    $('#hint-count').textContent = hintsUsed ? `${hintsUsed} hint${hintsUsed > 1 ? 's' : ''}` : '';
  }

  setInventory(items) {
    const key = items.join(',');
    if (key === this._lastInventory) return;
    this._lastInventory = key;
    $('#inventory').innerHTML = items.map((id) => {
      // Coloured keycards arrive as "keycard:#hex:Label".
      if (id.startsWith('keycard:')) {
        const [, hex, label] = id.split(':');
        return `<div class="item">${ICONS.keycard.replaceAll('#d63a3a', hex)}${esc(label)}</div>`;
      }
      return `<div class="item">${ICONS[id]}${ITEM_NAMES[id]}</div>`;
    }).join('');
  }

  setCrosshair({ hasGun, blue, orange, usable }) {
    const c = $('#crosshair').classList;
    c.toggle('has-gun', hasGun);
    c.toggle('blue', blue);
    c.toggle('orange', orange);
    c.toggle('usable', usable);
  }

  // `key` may be null for a plain message; `locked` styles it as a refusal.
  setPrompt(key, text, locked = false) {
    const html = text ? `${key ? `<kbd>${key}</kbd> ` : ''}<span class="${locked ? 'locked' : ''}">${text}</span>` : '';
    if (html === this._lastPrompt) return;
    this._lastPrompt = html;
    $('#prompt').innerHTML = html;
  }

  setTimer(seconds, visible) {
    const t = $('#timer');
    t.classList.toggle('hidden', !visible);
    t.textContent = formatTime(seconds);
  }

  toast(message, { type = 'info', ms = 3500 } = {}) {
    for (const el of this.toasts.children) if (el.textContent === message) el.remove();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    this.toasts.prepend(el);
    while (this.toasts.children.length > 3) this.toasts.lastChild.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }, ms);
  }

  clearToasts() {
    this.toasts.innerHTML = '';
  }

  // Fade to black, run `mid`, fade back.
  fade(mid) {
    const el = $('#fade');
    el.classList.add('on');
    setTimeout(() => {
      mid();
      el.classList.remove('on');
    }, 380);
  }
}

const starsHtml = (n, size) => [0, 1, 2]
  .map((i) => `<span class="${i < n ? '' : 'off'}"${size ? ` style="font-size:${size}px"` : ''}>★</span>`).join('');
const levelLabel = (l) => (l.story ? pad(l.number) : String(l.number));
const worldName = (l) => GROUPS[l.world + 1]?.name ?? '';

function achievementHtml(a, unlocked) {
  return `<div class="ach ${unlocked ? '' : 'locked'}"><span class="icon">${a.icon}</span>
    <div><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div></div>`;
}

// Stars scale with chamber size: later chambers get more time.
function rating(time, hints, number) {
  const score = time / (30 * number) + hints * 0.75;
  if (score < 2) return '★★★';
  if (score < 4) return '★★☆';
  return '★☆☆';
}
