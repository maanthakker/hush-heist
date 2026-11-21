import { API_URL } from './config.js';

const TOKEN_KEY = 'hush-heist:token';
export const isOnline = () => !!API_URL;

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing */
  }
}

async function call(path, { method = 'GET', body, timeoutMs = 15000 } = {}) {
  if (!API_URL) throw new Error('You’re playing offline.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const token = getToken();
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Hush HQ answered with an error (${res.status}).`);
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Hush HQ took too long to answer. It may be waking up; try again.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  async status(level = 'jungle-room') {
    if (!API_URL) return { online: false, configured: false };
    try {
      const health = await call('/api/health');
      const stats = health.db === 'connected' ? await call(`/api/stats?level=${encodeURIComponent(level)}`).catch(() => null) : null;
      return { online: true, configured: true, db: health.db, stats };
    } catch {
      return { online: false, configured: true };
    }
  },
  register: (username, password) => call('/api/auth/register', { method: 'POST', body: { username, password } }),
  login: (username, password) => call('/api/auth/login', { method: 'POST', body: { username, password } }),
  me: () => call('/api/me'),
  submitRun: (o) =>
    call('/api/runs', {
      method: 'POST',
      body: { mode: o.mode, level: o.level, result: o.result, won: o.won, snacks: o.snacks, totalSnacks: o.totalSnacks, timeMs: o.timeMs, stars: o.stars || 0, peakWake: o.peakWake },
    }),
  buy: (kind, id) => call('/api/shop/buy', { method: 'POST', body: { kind, id } }),
  equip: (look) => call('/api/shop/equip', { method: 'POST', body: look }),
  friends: () => call('/api/friends'),
  requestFriend: (username) => call('/api/friends/request', { method: 'POST', body: { username } }),
  respondFriend: (id, accept) => call('/api/friends/respond', { method: 'POST', body: { id, accept } }),
  removeFriend: (id) => call(`/api/friends/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  leaderboard: (level) => call(`/api/leaderboard?level=${encodeURIComponent(level)}`),
  levels: (sort = 'new', page = 0) => call(`/api/levels?sort=${sort}&page=${page}`),
  level: (id) => call(`/api/levels/${encodeURIComponent(id)}`),
  publishLevel: (id, data) => call('/api/levels', { method: 'POST', body: { id, data, verified: true } }),
  deleteLevel: (id) => call(`/api/levels/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  playedLevel: (id) => call(`/api/levels/${encodeURIComponent(id)}/play`, { method: 'POST' }).catch(() => null),
  likeLevel: (id) => call(`/api/levels/${encodeURIComponent(id)}/like`, { method: 'POST' }),
  reportLevel: (id) => call(`/api/levels/${encodeURIComponent(id)}/report`, { method: 'POST' }),
  submitCustomRun: (o, customId) =>
    call('/api/runs', { method: 'POST', body: { level: 'custom', customId, result: o.result, snacks: o.snacks, totalSnacks: o.totalSnacks, timeMs: o.timeMs } }),
};
