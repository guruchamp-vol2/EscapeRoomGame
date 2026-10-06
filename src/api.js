// Thin client for the game server's JSON API. Every call rejects with an Error
// whose message is safe to show the player.
async function call(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Server unreachable. Start the game with `npm run dev`.');
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON (e.g. a static host with no API).
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) {
      throw new Error('Online features are unavailable on this server.');
    }
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

const qs = (params) => new URLSearchParams(params).toString();

export const api = {
  me: () => call('GET', '/api/me'),
  register: (username, password, email) => call('POST', '/api/register', { username, password, email }),
  login: (username, password) => call('POST', '/api/login', { username, password }),
  logout: () => call('POST', '/api/logout', {}),
  setEmail: (email) => call('POST', '/api/account/email', { email }),
  forgotPassword: (login) => call('POST', '/api/password/forgot', { login }),
  resetPassword: (token, password) => call('POST', '/api/password/reset', { token, password }),
  startRun: (level, daily) => call('POST', '/api/runs', { level, daily }),
  finishRun: (payload) => call('POST', '/api/runs/finish', payload),
  unlock: (keys) => call('POST', '/api/achievements', { keys }),
  leaderboard: (level, board) => call('GET', `/api/leaderboard?${qs({ level, board, limit: 20 })}`),
  ghost: (level, board) => call('GET', `/api/ghost?${qs({ level, board })}`),
  getProgress: () => call('GET', '/api/progress'),
  putProgress: (data) => call('POST', '/api/progress', { data }),
};
