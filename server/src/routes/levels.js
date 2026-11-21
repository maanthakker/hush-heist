import { Router } from 'express';
import mongoose from 'mongoose';
import { Level } from '../models/Level.js';
import { User } from '../models/User.js';
import { dbReady } from '../db.js';
import { optionalAuth, requireAuth } from '../auth.js';
import { rateLimit } from '../rateLimit.js';
import { validateCustomLevel } from '../../shared/custom.js';

const router = Router();
const MAX_LEVELS_PER_PLAYER = 20;
const REPORTS_TO_HIDE = 3;
const PAGE = 20;

router.use('/levels', (req, res, next) => (dbReady() ? next() : res.status(503).json({ error: 'Online levels are offline right now.' })));
const findLevel = (id) => (mongoose.isValidObjectId(id) ? Level.findById(id) : null);

// Browse: newest, top (likes then plays), or made by your friends.
router.get('/levels', optionalAuth, async (req, res, next) => {
  try {
    const sort = ['new', 'top', 'friends'].includes(req.query.sort) ? req.query.sort : 'new';
    const page = Math.max(0, Math.min(50, Number(req.query.page) || 0));
    const filter = { hidden: false };
    if (sort === 'friends') {
      if (!req.auth) return res.status(401).json({ error: 'Log in to see your friends’ levels.' });
      const me = await User.findById(req.auth.sub).select('friends');
      filter.author = { $in: [...(me?.friends || [])] };
    }
    const order = sort === 'top' ? { likeCount: -1, plays: -1, createdAt: -1 } : { createdAt: -1 };
    const docs = await Level.find(filter).sort(order).skip(page * PAGE).limit(PAGE + 1).select('-data -reports');
    return res.json({ levels: docs.slice(0, PAGE).map((l) => l.toCard(req.auth?.sub)), more: docs.length > PAGE });
  } catch (err) {
    return next(err);
  }
});

router.get('/levels/mine', requireAuth, async (req, res, next) => {
  try {
    const docs = await Level.find({ author: req.auth.sub }).sort({ updatedAt: -1 }).select('-reports');
    return res.json({ levels: docs.map((l) => ({ ...l.toCard(req.auth.sub), hidden: l.hidden, data: l.data })) });
  } catch (err) {
    return next(err);
  }
});

router.get('/levels/:id', optionalAuth, async (req, res, next) => {
  try {
    const lvl = await findLevel(req.params.id);
    if (!lvl || (lvl.hidden && String(lvl.author) !== req.auth?.sub)) return res.status(404).json({ error: 'That level isn’t available.' });
    return res.json({ level: { ...lvl.toCard(req.auth?.sub), data: lvl.data } });
  } catch (err) {
    return next(err);
  }
});

// Publish or update. The game checks the level is playable, and you must have beaten it.
router.post('/levels', requireAuth, rateLimit({ windowMs: 10 * 60_000, max: 15 }), async (req, res, next) => {
  try {
    const { id, data, verified } = req.body || {};
    if (!verified) return res.status(400).json({ error: 'Beat your level once in Test play before publishing it.' });
    const check = validateCustomLevel(data);
    if (!check.ok) return res.status(400).json({ error: check.errors[0], errors: check.errors });
    const clean = check.data;
    const me = await User.findById(req.auth.sub).select('username');
    if (!me) return res.status(401).json({ error: 'Please log in again.' });
    let lvl;
    if (id) {
      lvl = await findLevel(id);
      if (!lvl || String(lvl.author) !== req.auth.sub) return res.status(404).json({ error: 'That level isn’t yours.' });
      Object.assign(lvl, { data: clean, name: clean.name, theme: clean.theme, size: clean.size });
      lvl.markModified('data');
    } else {
      if ((await Level.countDocuments({ author: me._id })) >= MAX_LEVELS_PER_PLAYER) {
        return res.status(400).json({ error: `You can publish up to ${MAX_LEVELS_PER_PLAYER} levels. Delete one to make room.` });
      }
      lvl = new Level({ author: me._id, authorName: me.username, data: clean, name: clean.name, theme: clean.theme, size: clean.size });
    }
    await lvl.save();
    return res.status(id ? 200 : 201).json({ level: lvl.toCard(req.auth.sub) });
  } catch (err) {
    return next(err);
  }
});

router.delete('/levels/:id', requireAuth, async (req, res, next) => {
  try {
    const lvl = await findLevel(req.params.id);
    if (!lvl || String(lvl.author) !== req.auth.sub) return res.status(404).json({ error: 'That level isn’t yours.' });
    await lvl.deleteOne();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.post('/levels/:id/play', rateLimit({ windowMs: 60_000, max: 30 }), async (req, res, next) => {
  try {
    if (mongoose.isValidObjectId(req.params.id)) await Level.updateOne({ _id: req.params.id }, { $inc: { plays: 1 } });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.post('/levels/:id/like', requireAuth, rateLimit({ windowMs: 60_000, max: 30 }), async (req, res, next) => {
  try {
    const lvl = await findLevel(req.params.id);
    if (!lvl || lvl.hidden) return res.status(404).json({ error: 'That level isn’t available.' });
    const i = lvl.likes.findIndex((u) => String(u) === req.auth.sub);
    if (i >= 0) lvl.likes.splice(i, 1);
    else lvl.likes.push(req.auth.sub);
    lvl.likeCount = lvl.likes.length;
    await lvl.save();
    return res.json({ level: lvl.toCard(req.auth.sub) });
  } catch (err) {
    return next(err);
  }
});

// Reports: after a few, the level is hidden until a grown-up running the server looks at it.
router.post('/levels/:id/report', requireAuth, rateLimit({ windowMs: 60_000, max: 10 }), async (req, res, next) => {
  try {
    const lvl = await findLevel(req.params.id);
    if (!lvl) return res.status(404).json({ error: 'That level isn’t available.' });
    if (!lvl.reports.some((u) => String(u) === req.auth.sub)) lvl.reports.push(req.auth.sub);
    if (lvl.reports.length >= REPORTS_TO_HIDE) lvl.hidden = true;
    await lvl.save();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
