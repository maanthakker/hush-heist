import { Router } from 'express';
import { User, progressObject } from '../models/User.js';
import { dbReady } from '../db.js';
import { requireAuth } from '../auth.js';
import { presence } from '../presence.js';
import { rateLimit } from '../rateLimit.js';

const router = Router();
router.use(['/friends', '/leaderboard'], requireAuth, (req, res, next) => (dbReady() ? next() : res.status(503).json({ error: 'Friends are offline right now.' })));

const card = (u) => ({ id: String(u._id), username: u.username, coins: u.coins, equipped: u.equipped, online: presence.has(String(u._id)) });

router.get('/friends', async (req, res, next) => {
  try {
    const me = await User.findById(req.auth.sub).populate('friends', 'username coins equipped').populate('friendRequests', 'username');
    if (!me) return res.status(401).json({ error: 'Please log in again.' });
    return res.json({ friends: me.friends.map(card), incoming: me.friendRequests.map((u) => ({ id: String(u._id), username: u.username })) });
  } catch (err) {
    return next(err);
  }
});

// Friend requests go by exact username; both sides must agree.
router.post('/friends/request', rateLimit({ windowMs: 60_000, max: 10 }), async (req, res, next) => {
  try {
    const name = String(req.body?.username || '').toLowerCase();
    const me = await User.findById(req.auth.sub);
    const them = await User.findOne({ usernameLower: name });
    if (!me) return res.status(401).json({ error: 'Please log in again.' });
    if (!them) return res.status(404).json({ error: 'No player with that username.' });
    if (them._id.equals(me._id)) return res.status(400).json({ error: 'That’s you!' });
    if (me.friends.some((f) => f.equals(them._id))) return res.json({ status: 'friends' });
    if (me.friendRequests.some((f) => f.equals(them._id))) {
      me.friendRequests.pull(them._id);
      me.friends.addToSet(them._id);
      them.friends.addToSet(me._id);
      await Promise.all([me.save(), them.save()]);
      return res.json({ status: 'friends' });
    }
    them.friendRequests.addToSet(me._id);
    await them.save();
    return res.json({ status: 'sent' });
  } catch (err) {
    return next(err);
  }
});

router.post('/friends/respond', async (req, res, next) => {
  try {
    const me = await User.findById(req.auth.sub);
    const them = await User.findById(req.body?.id);
    if (!me || !them || !me.friendRequests.some((f) => f.equals(them._id))) return res.status(400).json({ error: 'That request is gone.' });
    me.friendRequests.pull(them._id);
    if (req.body?.accept) {
      me.friends.addToSet(them._id);
      them.friends.addToSet(me._id);
      await them.save();
    }
    await me.save();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.delete('/friends/:id', async (req, res, next) => {
  try {
    const me = await User.findById(req.auth.sub);
    const them = await User.findById(req.params.id);
    if (me && them) {
      me.friends.pull(them._id);
      them.friends.pull(me._id);
      await Promise.all([me.save(), them.save()]);
    }
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// You + your friends: best stars/time per level, plus a coin ranking.
router.get('/leaderboard', async (req, res, next) => {
  try {
    const level = String(req.query.level || 'jungle-room');
    const me = await User.findById(req.auth.sub).select('friends');
    if (!me) return res.status(401).json({ error: 'Please log in again.' });
    const people = await User.find({ _id: { $in: [me._id, ...me.friends] } }).select('username coins progress stats');
    const rows = people.map((u) => {
      const p = progressObject(u.progress)[level] || { stars: 0, bestMs: null };
      return { id: String(u._id), username: u.username, me: u._id.equals(me._id), stars: p.stars, bestMs: p.bestMs, coins: u.coins, wins: u.stats?.wins || 0 };
    });
    const byLevel = [...rows].sort((a, b) => b.stars - a.stars || (a.bestMs ?? 9e9) - (b.bestMs ?? 9e9));
    const byCoins = [...rows].sort((a, b) => b.coins - a.coins);
    return res.json({ level, byLevel, byCoins });
  } catch (err) {
    return next(err);
  }
});

export default router;
