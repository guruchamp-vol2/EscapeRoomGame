// Who's playing, their progress, achievements and the current leaderboard run.
// Logged-in progress lives on the server; guest progress lives in localStorage.
import { api } from './api.js';
import { ACHIEVEMENTS } from './achievements.js';
import { LEVELS } from './levels/meta.js';
import { todayUTC } from './random.js';

const LOCAL_ACH = 'perspective-lab:achievements';
const LOCAL_LEVELS = 'perspective-lab:levels'; // { [levelId]: { bestMs, splits } }
const LOCAL_DAILY = 'perspective-lab:daily'; // { date, bestMs }

function readLocal(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — progress just won't persist for guests.
  }
}

export class Account {
  constructor({ onChange, onAchievement }) {
    this.user = null;
    this.online = false;
    this.today = todayUTC();
    this.run = null; // { token, level, daily }
    this.onChange = onChange;
    this.onAchievement = onAchievement;
    this.localAchievements = new Set(readLocal(LOCAL_ACH, []));
  }

  async init() {
    try {
      const res = await api.me();
      this.online = true;
      this.user = res.user;
      if (res.today) this.today = res.today;
    } catch {
      this.online = false;
    }
    this.onChange();
  }

  get achievements() {
    return this.user ? new Set(this.user.achievements.map((a) => a.key)) : this.localAchievements;
  }

  // Per-level bests: { [id]: { bestMs, splits } }. Merges local progress so a
  // guest who signs up keeps their unlocked chambers.
  get levels() {
    const local = readLocal(LOCAL_LEVELS, {});
    if (!this.user) return local;
    const merged = { ...local };
    for (const [id, v] of Object.entries(this.user.levels)) {
      if (!merged[id] || v.bestMs < merged[id].bestMs) merged[id] = v;
    }
    return merged;
  }

  isUnlocked(index) {
    return index === 0 || !!this.levels[LEVELS[index - 1].id];
  }

  // First chamber not yet completed, or the finale.
  get nextLevel() {
    const levels = this.levels;
    return (LEVELS.find((l) => !levels[l.id]) ?? LEVELS[LEVELS.length - 1]).id;
  }

  get dailyBestMs() {
    if (this.user) return this.user.dailyBestMs;
    const d = readLocal(LOCAL_DAILY, null);
    return d?.date === this.today ? d.bestMs : null;
  }

  async login(username, password, create, email) {
    const { user } = create ? await api.register(username, password, email || undefined) : await api.login(username, password);
    await this._signedIn(user);
  }

  async resetPassword(token, password) {
    const { user } = await api.resetPassword(token, password);
    await this._signedIn(user);
  }

  async _signedIn(user) {
    this.user = user;
    this.online = true;
    // Carry over anything earned as a guest.
    if (this.localAchievements.size) {
      try {
        await api.unlock([...this.localAchievements]);
        this.user = (await api.me()).user;
      } catch {
        // Not critical.
      }
    }
    this.onChange();
  }

  async setEmail(email) {
    this.user = (await api.setEmail(email)).user;
    this.onChange();
  }

  forgotPassword(login) {
    return api.forgotPassword(login);
  }

  async logout() {
    try {
      await api.logout();
    } finally {
      this.user = null;
      this.run = null;
      this.onChange();
    }
  }

  // Stars, Fragments, cosmetics, quests and notes, stored with the account.
  async loadProgress() {
    if (!this.user) return null;
    try {
      return (await api.getProgress()).data;
    } catch {
      return null;
    }
  }

  saveProgress(data) {
    if (this.user) api.putProgress(data).catch(() => {});
  }

  leaderboard(level, board) {
    return api.leaderboard(level, board);
  }

  async ghost(level, daily) {
    if (!this.online) return null;
    try {
      return (await api.ghost(level, daily ? 'daily' : 'all')).ghost;
    } catch {
      return null;
    }
  }

  // Called when play begins. Only logged-in runs are timed for the leaderboard.
  async startRun(level, daily) {
    this.run = null;
    if (!this.user) return;
    try {
      const { runToken } = await api.startRun(level, daily);
      this.run = { token: runToken, level, daily };
    } catch {
      this.run = null;
    }
  }

  unlock(key) {
    if (this.achievements.has(key)) return;
    const def = ACHIEVEMENTS.find((a) => a.key === key);
    if (!def) return;
    if (this.user) {
      this.user.achievements.push({ key, unlockedAt: Date.now() });
      api.unlock([key]).catch(() => {});
    } else {
      this.localAchievements.add(key);
      writeLocal(LOCAL_ACH, [...this.localAchievements]);
    }
    this.onAchievement(def);
  }

  // Saves progress locally and, for a timed run, submits it.
  // Returns { rank, total, board } | { error } | null (not submitted).
  async finishRun({ level, daily, timeMs, hints, portals, teleports, splits, ghost }) {
    if (daily) {
      const d = readLocal(LOCAL_DAILY, null);
      if (d?.date !== this.today || timeMs < d.bestMs) writeLocal(LOCAL_DAILY, { date: this.today, bestMs: timeMs });
    } else {
      const local = readLocal(LOCAL_LEVELS, {});
      if (!local[level] || timeMs < local[level].bestMs) {
        local[level] = { bestMs: timeMs, splits };
        writeLocal(LOCAL_LEVELS, local);
      }
    }
    const run = this.run;
    this.run = null;
    if (!this.user || !run || run.level !== level || run.daily !== daily) {
      this.onChange();
      return null;
    }
    try {
      const res = await api.finishRun({
        runToken: run.token, timeMs, hints, portals, teleports, splits, ghost,
        achievements: [...this.achievements],
      });
      this.user = res.user;
      this.onChange();
      return { rank: res.rank, total: res.total, board: res.board };
    } catch (err) {
      this.onChange();
      return { error: err.message };
    }
  }
}
