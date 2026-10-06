// Game server: the JSON API plus the front end.
//   npm run dev   → Vite runs inside this server (hot reload), one port for everything
//   npm start     → serves the built files from dist/ (run `npm run build` first)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createApi } from './api.js';
import { createMailer } from './mailer.js';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.PORT) || 5173;

// DATABASE_URL (libsql://…turso.io) + DATABASE_AUTH_TOKEN for persistent hosted
// storage; otherwise a local file in data/ (fine for development).
const db = await openDb({
  url: process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
});
const api = createApi(db, {
  secureCookies: process.env.SECURE_COOKIES === '1',
  mailer: createMailer(),
  authLimit: Number(process.env.AUTH_LIMIT_PER_MIN) || 10,
  trustProxy: process.env.TRUST_PROXY === '1',
  publicUrl: (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, ''),
});

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

async function serveStatic(req, res) {
  const dist = join(ROOT, 'dist');
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let file = normalize(join(dist, urlPath));
  if (file !== dist && !file.startsWith(dist + sep)) {
    res.statusCode = 403;
    return res.end();
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(dist, 'index.html'); // SPA fallback
  }
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    if (file.includes(`${join('dist', 'assets')}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('Not found. Did you run `npm run build`?');
  }
}

const server = createServer();
let vite = null;
if (DEV) {
  const { createServer: createVite } = await import('vite');
  vite = await createVite({
    root: ROOT,
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
}

server.on('request', async (req, res) => {
  if (await api(req, res)) return;
  if (vite) vite.middlewares(req, res);
  else serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Perspective Lab ${DEV ? '(dev) ' : ''}running at http://localhost:${PORT} - storage: ${db.kind}`);
  if (!DEV && db.kind === 'local file') console.warn('WARNING: no DATABASE_URL set. Accounts are stored on local disk, which many hosts wipe on restart.');
});
