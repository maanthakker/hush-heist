import { Router } from 'express';
import { User } from '../models/User.js';
import { dbReady } from '../db.js';
import { requireAuth } from '../auth.js';
import { shopItem } from '../../shared/catalog.js';

const router = Router();
router.use('/shop', requireAuth, (req, res, next) => (dbReady() ? next() : res.status(503).json({ error: 'The shop is closed right now.' })));

router.post('/shop/buy', async (req, res, next) => {
  try {
    const { kind, id } = req.body || {};
    const item = shopItem(kind, id);
    if (!item) return res.status(400).json({ error: 'That item doesn’t exist.' });
    const key = `${kind}:${id}`;
    const user = await User.findById(req.auth.sub);
    if (!user) return res.status(401).json({ error: 'Please log in again.' });
    if (user.unlocked.includes(key)) return res.json({ user: user.toPublic() });
    if (user.coins < item.price) return res.status(400).json({ error: `You need ${item.price - user.coins} more coins.` });
    user.coins -= item.price;
    user.unlocked.push(key);
    user.equipped[kind] = id;
    await user.save();
    return res.json({ user: user.toPublic() });
  } catch (err) {
    return next(err);
  }
});

router.post('/shop/equip', async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub);
    if (!user) return res.status(401).json({ error: 'Please log in again.' });
    for (const kind of ['outfit', 'hair']) {
      const id = req.body?.[kind];
      if (!id) continue;
      if (!shopItem(kind, id) || !user.unlocked.includes(`${kind}:${id}`)) return res.status(400).json({ error: 'Unlock that first.' });
      user.equipped[kind] = id;
    }
    await user.save();
    return res.json({ user: user.toPublic() });
  } catch (err) {
    return next(err);
  }
});

export default router;
