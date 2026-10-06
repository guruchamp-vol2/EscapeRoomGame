// Storage via libSQL (SQLite-compatible). Two modes, same SQL:
//   * local file  — DATABASE_URL unset → data/game.db (development)
//   * hosted      — DATABASE_URL=libsql://<db>.turso.io + DATABASE_AUTH_TOKEN
//                   (free Turso database: survives restarts and redeploys,
//                    which a free host's disk does not)
import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY,
    username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash  TEXT NOT NULL,
    salt       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  -- A run is created when play starts, so the server can time it.
  CREATE TABLE IF NOT EXISTS runs (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    started_at  INTEGER NOT NULL,
    finished_at INTEGER,
    time_ms     INTEGER,
    hints       INTEGER,
    portals     INTEGER,
    teleports   INTEGER,
    splits      TEXT
  );
  CREATE TABLE IF NOT EXISTS achievements (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0
  );
  -- Stars, Fragments, cosmetics, quests and notes (one JSON blob per player).
  CREATE TABLE IF NOT EXISTS user_progress (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

// Positional (?) or named (:name) arguments.
const toArgs = (args) => (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0]) ? args[0] : args);

export async function openDb({ url, authToken } = {}) {
  let target = url;
  if (!target) {
    const file = resolve(process.env.DB_FILE || 'data/game.db');
    mkdirSync(dirname(file), { recursive: true });
    target = `file:${file}`;
  }
  const client = createClient({ url: target, authToken });
  const local = target.startsWith('file:');
  if (local) await client.execute('PRAGMA journal_mode = WAL').catch(() => {});
  await client.execute('PRAGMA foreign_keys = ON').catch(() => {});
  await client.executeMultiple(SCHEMA);

  const db = {
    kind: local ? 'local file' : 'hosted libSQL',
    prepare(sql) {
      return {
        get: async (...args) => (await client.execute({ sql, args: toArgs(args) })).rows[0],
        all: async (...args) => (await client.execute({ sql, args: toArgs(args) })).rows,
        run: async (...args) => {
          const r = await client.execute({ sql, args: toArgs(args) });
          return { changes: r.rowsAffected, lastInsertRowid: Number(r.lastInsertRowid ?? 0) };
        },
      };
    },
    close: () => client.close(),
  };

  // Columns added after the first release.
  const addColumn = async (table, column, type) => {
    const cols = await db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some((c) => c.name === column)) await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  };
  await addColumn('users', 'email', 'TEXT');
  await addColumn('runs', 'level', "TEXT NOT NULL DEFAULT 'lab'");
  await addColumn('runs', 'challenge', 'TEXT');
  await addColumn('runs', 'ghost', 'TEXT');
  await client.executeMultiple(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email COLLATE NOCASE) WHERE email IS NOT NULL;
    CREATE INDEX IF NOT EXISTS runs_board ON runs(level, challenge, time_ms) WHERE time_ms IS NOT NULL;
  `);
  return db;
}
