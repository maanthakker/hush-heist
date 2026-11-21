import { Router } from 'express';
import { Run } from '../models/Run.js';
import { User } from '../models/User.js';
import { dbReady } from '../db.js';
import { optionalAuth } from '../auth.js';
import { rateLimit } from '../rateLimit.js';
import { applyResult } from '../progress.js';
import { Level } from '../models/Level.js';
import mongoose from 'mongoose';

const router = Router();
const toInt = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : undefined);

async function levelStats(level) {
  const [escaped, caught, fastest] = await Promise.all([
    Run.countDocuments({ level, result: 'escaped' }),
    Run.countDocuments({ level, result: 'caught' }),
    Run.findOne({ level, result: 'escaped' }).sort({ timeMs: 1 }).select('timeMs').lean(),
  ]);
  return { level, escaped, caught, fastestMs: fastest ? fastest.timeMs : null };
}

// A finished solo round. Party rounds are recorded by the server itself.
router.post('/runs', rateLimit({ windowMs: 60_000, max: 20 }), optionalAuth, async (req, res, next) => {
  if (!dbReady()) return res.status(503).json({ error: 'Database offline' });
  try {
    const b = req.body || {};
    if (b.level === 'custom') {
      // Player-made levels: a small flat reward, and none for beating your own level.
      const id = mongoose.isValidObjectId(b.customId) ? b.customId : null;
      const lvl = id ? await Level.findById(id).select('author') : null;
      const won = b.result === 'escaped';
      await Run.create({ user: req.auth ? req.auth.sub : null, mode: 'heist', level: 'custom', customLevel: lvl ? lvl._id : null, result: won ? 'escaped' : 'caught', won, snacks: toInt(b.snacks) ?? 0, totalSnacks: toInt(b.totalSnacks) ?? 0, timeMs: toInt(b.timeMs) ?? 0 });
      let user = null;
      let coinsEarned = 0;
      if (req.auth && lvl && won && String(lvl.author) !== req.auth.sub) {
        const doc = await User.findById(req.auth.sub);
        if (doc) {
          coinsEarned = 10;
          doc.coins += coinsEarned;
          doc.stats.runs += 1;
          doc.stats.wins += 1;
          await doc.save();
          user = doc.toPublic();
        }
      }
      return res.status(201).json({ ok: true, coinsEarned, user });
    }
    const mode = ['heist', 'race'].includes(b.mode) ? b.mode : 'heist';
    const result = String(b.result || '');
    const won = mode === 'race' ? result === 'finished' && !!b.won : result === 'escaped';
    const run = await Run.create({
      user: req.auth ? req.auth.sub : null,
      mode,
      level: String(b.level || ''),
      result,
      won,
      snacks: toInt(b.snacks),
      totalSnacks: toInt(b.totalSnacks),
      timeMs: toInt(b.timeMs),
      stars: mode === 'heist' && won ? toInt(b.stars) ?? 0 : 0,
      peakWake: toInt(b.peakWake) ?? 0,
    });
    let user = null;
    let coinsEarned = 0;
    if (req.auth) {
      const doc = await User.findById(req.auth.sub);
      if (doc) {
        const outcome = { mode, level: run.level, result, snacks: run.snacks, totalSnacks: run.totalSnacks, timeMs: run.timeMs, stars: run.stars, winnerId: won ? 'me' : null };
        coinsEarned = applyResult(doc, outcome, 'me');
        await doc.save();
        user = doc.toPublic();
      }
    }
    return res.status(201).json({ ok: true, coinsEarned, user, stats: await levelStats(run.level) });
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ error: 'That run does not look valid' });
    return next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  if (!dbReady()) return res.json({ db: 'offline' });
  try {
    res.json(await levelStats(String(req.query.level || 'jungle-room').slice(0, 40)));
  } catch (err) {
    next(err);
  }
});

export default router;
