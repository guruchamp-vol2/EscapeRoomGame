// JSON API: accounts, password reset, runs, leaderboards, ghosts, achievements.
import { hashPassword, verifyPassword, newToken, hashToken, validateCredentials, validatePassword, SESSION_DAYS } from './auth.js';
import { ACHIEVEMENT_KEYS } from '../src/achievements.js';
import { LEVEL_IDS, DAILY_ID, minRunMs } from '../src/levels/meta.js';

const DAY = 24 * 60 * 60 * 1000;
const RESET_TTL = 60 * 60 * 1000;
const CLOCK_SLACK_MS = 2_000; // client/server timing jitter allowance
const MAX_BODY = 16 * 1024;
const MAX_FINISH_BODY = 600 * 1024; // includes the ghost recording
const MAX_PROGRESS = 64 * 1024;
const MAX_GHOST_FRAMES = 6000; // 10 minutes at 10 Hz
const BOARDS = new Set(['all', 'weekly', 'nohints', 'daily']);
export const DAILY_LEVEL = DAILY_ID; // a fresh generated level each UTC day
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const todayUTC = () => new Date().toISOString().slice(0, 10);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Simple fixed-window rate limiter keyed by IP + bucket.
function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || now > entry.reset) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return;
    }
    if (++entry.count > limit) throw new HttpError(429, 'Too many attempts. Try again in a minute.');
  };
}

function readJson(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'Request too large.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(body && typeof body === 'object' ? body : {});
      } catch {
        reject(new HttpError(400, 'Invalid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);

// Ghost = array of [x, y, z, yaw] samples at 10 Hz. Returns JSON or null.
function cleanGhost(ghost) {
  if (!Array.isArray(ghost) || ghost.length === 0 || ghost.length > MAX_GHOST_FRAMES) return null;
  const out = [];
  for (const f of ghost) {
    if (!Array.isArray(f) || f.length !== 4) return null;
    const row = f.map(Number);
    if (!row.every((v) => Number.isFinite(v) && Math.abs(v) < 10_000)) return null;
    out.push(row.map((v) => Math.round(v * 100) / 100));
  }
  return JSON.stringify(out);
}

export function createApi(db, { secureCookies = false, mailer, publicUrl = 'http://localhost:5173', authLimit = 10, trustProxy = false } = {}) {
  const limitAuth = rateLimiter(authLimit, 60_000);
  const limitRuns = rateLimiter(30, 60_000);
  const limitReset = rateLimiter(10, 60_000);

  const q = {
    userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare('INSERT INTO users (username, pass_hash, salt, created_at, email) VALUES (?, ?, ?, ?, ?)'),
    setEmail: db.prepare('UPDATE users SET email = ? WHERE id = ?'),
    setPassword: db.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    sessionUser: db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                             WHERE s.token_hash = ? AND s.expires_at > ?`),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    insertReset: db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    resetByToken: db.prepare('SELECT * FROM password_resets WHERE token_hash = ?'),
    useReset: db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ?'),
    insertRun: db.prepare('INSERT INTO runs (user_id, token, started_at, level, challenge) VALUES (?, ?, ?, ?, ?)'),
    runByToken: db.prepare('SELECT * FROM runs WHERE token = ? AND user_id = ?'),
    finishRun: db.prepare(`UPDATE runs SET finished_at = ?, time_ms = ?, hints = ?, portals = ?, teleports = ?, splits = ?, ghost = ?
                           WHERE id = ?`),
    stats: db.prepare(`SELECT COUNT(*) AS runs, COUNT(time_ms) AS escapes, COALESCE(SUM(teleports), 0) AS teleports
                       FROM runs WHERE user_id = ?`),
    levelBests: db.prepare(`SELECT level, time_ms, splits FROM (
                              SELECT level, time_ms, splits, ROW_NUMBER() OVER (PARTITION BY level ORDER BY time_ms) AS rn
                              FROM runs WHERE user_id = ? AND time_ms IS NOT NULL AND challenge IS NULL)
                            WHERE rn = 1`),
    dailyBest: db.prepare('SELECT MIN(time_ms) AS best FROM runs WHERE user_id = ? AND challenge = ?'),
    achievements: db.prepare('SELECT key, unlocked_at FROM achievements WHERE user_id = ? ORDER BY unlocked_at'),
    unlock: db.prepare('INSERT OR IGNORE INTO achievements (user_id, key, unlocked_at) VALUES (?, ?, ?)'),
    getProgress: db.prepare('SELECT data FROM user_progress WHERE user_id = ?'),
    putProgress: db.prepare(`INSERT INTO user_progress (user_id, data, updated_at) VALUES (?, ?, ?)
                             ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
  };

  // Filter for one board. Daily runs only count on the daily board, since
  // everyone shares the same codes that day.
  function boardFilter(level, kind) {
    const params = { level };
    let where = 'level = :level AND time_ms IS NOT NULL';
    if (kind === 'daily') {
      where += ' AND challenge = :today';
      params.today = todayUTC();
    } else {
      where += ' AND challenge IS NULL';
      if (kind === 'weekly') {
        where += ' AND finished_at > :since';
        params.since = Date.now() - 7 * DAY;
      } else if (kind === 'nohints') {
        where += ' AND hints = 0';
      }
    }
    return { where, params };
  }

  // Best run per user on a board, fastest first.
  async function board(level, kind) {
    const { where, params } = boardFilter(level, kind);
    return await db.prepare(`
      WITH best AS (
        SELECT user_id, time_ms, hints, portals, finished_at, ghost IS NOT NULL AS has_ghost,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY time_ms, finished_at) AS rn
        FROM runs WHERE ${where}
      )
      SELECT u.username, b.time_ms, b.hints, b.portals, b.finished_at, b.has_ghost
      FROM best b JOIN users u ON u.id = b.user_id
      WHERE b.rn = 1 ORDER BY b.time_ms, b.finished_at
    `).all(params);
  }

  function sessionCookie(token, maxAgeSec) {
    return `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secureCookies ? '; Secure' : ''}`;
  }

  async function currentUser(req) {
    const token = parseCookies(req.headers.cookie).session;
    if (!token) return null;
    return await q.sessionUser.get(hashToken(token), Date.now()) ?? null;
  }

  async function requireUser(req) {
    const user = await currentUser(req);
    if (!user) throw new HttpError(401, 'Please log in.');
    return user;
  }

  async function startSession(res, userId) {
    const token = newToken();
    await q.purgeSessions.run(Date.now());
    await q.insertSession.run(hashToken(token), userId, Date.now() + SESSION_DAYS * DAY);
    res.setHeader('Set-Cookie', sessionCookie(token, SESSION_DAYS * 24 * 3600));
  }

  async function profile(user) {
    const s = await q.stats.get(user.id);
    const levels = {};
    for (const row of await q.levelBests.all(user.id)) {
      levels[row.level] = { bestMs: row.time_ms, splits: row.splits ? JSON.parse(row.splits) : null };
    }
    return {
      username: user.username,
      email: user.email ?? null,
      createdAt: user.created_at,
      stats: { runs: s.runs, escapes: s.escapes, teleports: s.teleports },
      levels,
      dailyBestMs: (await q.dailyBest.get(user.id, todayUTC())).best ?? null,
      achievements: (await q.achievements.all(user.id)).map((a) => ({ key: a.key, unlockedAt: a.unlocked_at })),
    };
  }

  async function unlockAll(userId, keys) {
    const added = [];
    if (!Array.isArray(keys)) return added;
    for (const key of keys.slice(0, 32)) {
      if (!ACHIEVEMENT_KEYS.has(key)) continue;
      if ((await q.unlock.run(userId, key, Date.now())).changes) added.push(key);
    }
    return added;
  }

  function cleanEmail(email) {
    if (email == null || email === '') return null;
    if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) {
      throw new HttpError(400, 'That email address does not look right.');
    }
    return email.trim();
  }

  function levelParam(value) {
    if (!LEVEL_IDS.has(value)) throw new HttpError(400, 'Unknown chamber.');
    return value;
  }

  const routes = {
    'POST /api/register': async (req, res, ip) => {
      limitAuth(`auth:${ip}`);
      const { username, password, email } = await readJson(req);
      const problem = validateCredentials(username, password);
      if (problem) throw new HttpError(400, problem);
      const mail = cleanEmail(email);
      if (await q.userByName.get(username)) throw new HttpError(409, 'That username is taken.');
      if (mail && await q.userByEmail.get(mail)) throw new HttpError(409, 'That email is already in use.');
      const { hash, salt } = await hashPassword(password);
      const id = Number((await q.insertUser.run(username, hash, salt, Date.now(), mail)).lastInsertRowid);
      await startSession(res, id);
      return { user: await profile(await q.userById.get(id)) };
    },

    'POST /api/login': async (req, res, ip) => {
      limitAuth(`auth:${ip}`);
      const { username, password } = await readJson(req);
      const user = typeof username === 'string' ? await q.userByName.get(username) : null;
      const ok = user && typeof password === 'string' && (await verifyPassword(password, user.salt, user.pass_hash));
      if (!ok) throw new HttpError(401, 'Wrong username or password.');
      await startSession(res, user.id);
      return { user: await profile(user) };
    },

    'POST /api/logout': async (req, res) => {
      const token = parseCookies(req.headers.cookie).session;
      if (token) await q.deleteSession.run(hashToken(token));
      res.setHeader('Set-Cookie', sessionCookie('', 0));
      return { ok: true };
    },

    'GET /api/me': async (req) => {
      const user = await currentUser(req);
      return { user: user ? await profile(user) : null, today: todayUTC(), dailyLevel: DAILY_LEVEL };
    },

    'POST /api/account/email': async (req) => {
      const user = await requireUser(req);
      const mail = cleanEmail((await readJson(req)).email);
      const other = mail && await q.userByEmail.get(mail);
      if (other && other.id !== user.id) throw new HttpError(409, 'That email is already in use.');
      await q.setEmail.run(mail, user.id);
      return { user: await profile(await q.userById.get(user.id)) };
    },

    // Always answers the same way, so it can't be used to discover accounts.
    'POST /api/password/forgot': async (req, res, ip) => {
      limitReset(`reset:${ip}`);
      const { login } = await readJson(req);
      if (typeof login === 'string' && login.length <= 254) {
        const user = login.includes('@') ? await q.userByEmail.get(login.trim()) : await q.userByName.get(login.trim());
        if (user?.email) {
          const token = newToken();
          await q.insertReset.run(hashToken(token), user.id, Date.now() + RESET_TTL);
          const link = `${publicUrl}/?reset=${encodeURIComponent(token)}`;
          await mailer.send({
            to: user.email,
            subject: 'Reset your Perspective Lab password',
            text: `Hi ${user.username},\n\nUse this link to choose a new password. It expires in 1 hour.\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
          }).catch((err) => console.error('Failed to send reset email:', err));
        }
      }
      return { ok: true, message: 'If that account has an email address, a reset link is on its way.' };
    },

    'POST /api/password/reset': async (req, res, ip) => {
      limitReset(`reset:${ip}`);
      const { token, password } = await readJson(req);
      const row = typeof token === 'string' ? await q.resetByToken.get(hashToken(token)) : null;
      if (!row || row.used || row.expires_at < Date.now()) {
        throw new HttpError(400, 'This reset link is invalid or has expired.');
      }
      const problem = validatePassword(password);
      if (problem) throw new HttpError(400, problem);
      const { hash, salt } = await hashPassword(password);
      await q.setPassword.run(hash, salt, row.user_id);
      await q.useReset.run(row.user_id); // invalidate every outstanding link
      await q.deleteUserSessions.run(row.user_id); // log out everywhere else
      await startSession(res, row.user_id);
      return { user: await profile(await q.userById.get(row.user_id)) };
    },

    'POST /api/runs': async (req, res, ip) => {
      limitRuns(`runs:${ip}`);
      const user = await requireUser(req);
      const { level, daily } = await readJson(req);
      levelParam(level);
      if (!!daily !== (level === DAILY_LEVEL)) throw new HttpError(400, 'Not today\'s challenge.');
      const token = newToken();
      const challenge = daily ? todayUTC() : null;
      await q.insertRun.run(user.id, token, Date.now(), level, challenge);
      return { runToken: token, challenge };
    },

    'POST /api/runs/finish': async (req, res, ip) => {
      limitRuns(`runs:${ip}`);
      const user = await requireUser(req);
      const body = await readJson(req, MAX_FINISH_BODY);
      const run = typeof body.runToken === 'string' ? await q.runByToken.get(body.runToken, user.id) : null;
      if (!run) throw new HttpError(404, 'Unknown run.');
      if (run.finished_at) throw new HttpError(409, 'Run already submitted.');

      const now = Date.now();
      const serverMs = now - run.started_at;
      const timeMs = Math.round(Number(body.timeMs));
      // The client clock excludes pauses, so it can be shorter than the server's
      // wall-clock time, but never meaningfully longer — and never superhuman.
      if (!Number.isFinite(timeMs) || timeMs < minRunMs(run.level, run.challenge ?? todayUTC()) || timeMs > serverMs + CLOCK_SLACK_MS || serverMs > DAY) {
        console.warn(`Rejected run ${run.id} (${run.level}): client ${timeMs} ms, server ${serverMs} ms`);
        throw new HttpError(422, 'That run could not be verified.');
      }
      const splits = Array.isArray(body.splits)
        ? body.splits.slice(0, 10).map((v) => Math.max(0, Math.min(timeMs, Math.round(Number(v) || 0))))
        : [];
      await q.finishRun.run(now, timeMs, int(body.hints, 99), int(body.portals, 9999), int(body.teleports, 9999),
        JSON.stringify(splits), cleanGhost(body.ghost), run.id);

      const newAchievements = await unlockAll(user.id, body.achievements);
      const kind = run.challenge ? 'daily' : 'all';
      // A daily run submitted after midnight UTC still ranks on its own day's board.
      const rows = run.challenge && run.challenge !== todayUTC() ? [] : await board(run.level, kind);
      const rank = rows.findIndex((r) => r.username.toLowerCase() === user.username.toLowerCase()) + 1;
      return { rank, total: rows.length, board: kind, newAchievements, user: await profile(user) };
    },

    'POST /api/achievements': async (req) => {
      const user = await requireUser(req);
      const { keys } = await readJson(req);
      return { added: await unlockAll(user.id, keys) };
    },

    'GET /api/progress': async (req) => {
      const user = await requireUser(req);
      const row = await q.getProgress.get(user.id);
      return { data: row ? JSON.parse(row.data) : null };
    },

    'POST /api/progress': async (req) => {
      const user = await requireUser(req);
      const { data } = await readJson(req, MAX_PROGRESS);
      if (!data || typeof data !== 'object' || Array.isArray(data) || data.v !== 1) throw new HttpError(400, 'Bad progress data.');
      const json = JSON.stringify(data);
      if (json.length > MAX_PROGRESS) throw new HttpError(413, 'Progress too large.');
      await q.putProgress.run(user.id, json, Date.now());
      return { ok: true };
    },

    'GET /api/leaderboard': async (req) => {
      const url = new URL(req.url, 'http://x');
      const kind = BOARDS.has(url.searchParams.get('board')) ? url.searchParams.get('board') : 'all';
      const level = kind === 'daily' ? DAILY_LEVEL : levelParam(url.searchParams.get('level') ?? DAILY_LEVEL);
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 20));
      const all = await board(level, kind);
      const user = await currentUser(req);
      let you = null;
      if (user) {
        const i = all.findIndex((r) => r.username.toLowerCase() === user.username.toLowerCase());
        if (i >= 0) you = { rank: i + 1, timeMs: all[i].time_ms };
      }
      return {
        board: kind,
        level,
        today: todayUTC(),
        total: all.length,
        rows: all.slice(0, limit).map((r, i) => ({
          rank: i + 1, username: r.username, timeMs: r.time_ms, hints: r.hints, portals: r.portals,
          finishedAt: r.finished_at, hasGhost: !!r.has_ghost,
        })),
        you,
      };
    },

    // The fastest run with a recording on a board, for ghost racing.
    'GET /api/ghost': async (req) => {
      const url = new URL(req.url, 'http://x');
      const kind = url.searchParams.get('board') === 'daily' ? 'daily' : 'all';
      const level = kind === 'daily' ? DAILY_LEVEL : levelParam(url.searchParams.get('level'));
      const { where, params } = boardFilter(level, kind);
      const row = await db.prepare(`SELECT u.username, r.time_ms, r.ghost FROM runs r JOIN users u ON u.id = r.user_id
                              WHERE ${where} AND r.ghost IS NOT NULL ORDER BY r.time_ms LIMIT 1`).get(params);
      if (!row) return { ghost: null };
      return { ghost: { username: row.username, timeMs: row.time_ms, frames: JSON.parse(row.ghost) } };
    },
  };

  // Returns true if the request was an API call (handled), false otherwise.
  return async function handle(req, res) {
    const path = req.url.split('?')[0];
    if (!path.startsWith('/api/')) return false;
    const route = routes[`${req.method} ${path}`];
    // Behind a host's proxy (Render etc.) the socket address is the proxy's;
    // the real client is the first X-Forwarded-For entry.
    const forwarded = trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
    const ip = forwarded || req.socket.remoteAddress || 'unknown';
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!route) throw new HttpError(404, 'Not found.');
      // CSRF guard: state-changing requests must be same-origin JSON.
      if (req.method === 'POST' && !String(req.headers['content-type'] ?? '').startsWith('application/json')) {
        throw new HttpError(415, 'Expected JSON.');
      }
      const body = await route(req, res, ip);
      res.end(JSON.stringify(body));
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      res.statusCode = status;
      res.end(JSON.stringify({ error: status === 500 ? 'Server error.' : err.message }));
    }
    return true;
  };
}
