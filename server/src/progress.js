import { coinsFor, didWin } from '../shared/catalog.js';
import { LEVEL_BY_ID } from '../shared/levels/index.js';

// Apply a finished round to a user document: coins, wins, best stars and times.
export function applyResult(user, outcome, playerId) {
  const coins = coinsFor(outcome, playerId);
  user.coins = Math.max(0, (user.coins || 0) + coins);
  user.stats.runs += 1;
  if (didWin(outcome, playerId)) user.stats.wins += 1;
  if (outcome.mode === 'heist' && outcome.result === 'escaped' && LEVEL_BY_ID[outcome.level]) {
    const cur = user.progress.get(outcome.level) || { stars: 0, bestMs: null };
    user.progress.set(outcome.level, {
      stars: Math.max(cur.stars || 0, Math.min(3, outcome.stars || 0)),
      bestMs: cur.bestMs == null ? outcome.timeMs : Math.min(cur.bestMs, outcome.timeMs),
    });
  }
  return coins;
}
