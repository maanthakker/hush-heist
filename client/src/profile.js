import { DEFAULT_LOOK, FREE_ITEMS, cleanLook, shopItem } from '@shared/catalog.js';
import { HERO_NAME } from './config.js';

// Guests keep their coins, unlocks and best runs on this device.
const KEY = 'hush-heist:guest';

export function loadGuest() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    saved = {};
  }
  return {
    kind: 'guest',
    id: 'me',
    username: typeof saved.username === 'string' && saved.username ? saved.username.slice(0, 16) : HERO_NAME,
    coins: Number.isFinite(saved.coins) ? saved.coins : 0,
    unlocked: Array.isArray(saved.unlocked) ? [...new Set([...FREE_ITEMS, ...saved.unlocked])] : [...FREE_ITEMS],
    equipped: cleanLook(saved.equipped || DEFAULT_LOOK),
    progress: saved.progress && typeof saved.progress === 'object' ? saved.progress : {},
  };
}

export function saveGuest(p) {
  try {
    const { username, coins, unlocked, equipped, progress } = p;
    localStorage.setItem(KEY, JSON.stringify({ username, coins, unlocked, equipped, progress }));
  } catch {
    /* ignore */
  }
  return p;
}

export function guestAfterRun(p, outcome, coins, won) {
  const next = { ...p, coins: p.coins + coins, progress: { ...p.progress } };
  if (outcome.mode === 'heist' && won) {
    const cur = next.progress[outcome.level] || { stars: 0, bestMs: null };
    next.progress[outcome.level] = {
      stars: Math.max(cur.stars || 0, outcome.stars || 0),
      bestMs: cur.bestMs == null ? outcome.timeMs : Math.min(cur.bestMs, outcome.timeMs),
    };
  }
  return saveGuest(next);
}

export function guestBuy(p, kind, id) {
  const item = shopItem(kind, id);
  const key = `${kind}:${id}`;
  if (!item) return { error: 'That item doesn’t exist.' };
  if (p.unlocked.includes(key)) return { profile: p };
  if (p.coins < item.price) return { error: `You need ${item.price - p.coins} more coins.` };
  return { profile: saveGuest({ ...p, coins: p.coins - item.price, unlocked: [...p.unlocked, key], equipped: { ...p.equipped, [kind]: id } }) };
}
