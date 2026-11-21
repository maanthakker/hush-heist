import { Router } from 'express';
import { User } from '../models/User.js';
import { dbReady } from '../db.js';
import { hashPassword, passwordProblem, requireAuth, signToken, usernameProblem, verifyPassword } from '../auth.js';
import { rateLimit } from '../rateLimit.js';

const router = Router();
const needDb = (req, res, next) => (dbReady() ? next() : res.status(503).json({ error: 'Accounts are offline right now. Try again in a minute.' }));
const limiter = rateLimit({ windowMs: 10 * 60_000, max: 15 });

router.post('/auth/register', limiter, needDb, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const problem = usernameProblem(username) || passwordProblem(password);
    if (problem) return res.status(400).json({ error: problem });
    if (await User.exists({ usernameLower: username.toLowerCase() })) return res.status(409).json({ error: 'That username is taken.' });
    const user = await User.create({ username, usernameLower: username.toLowerCase(), passwordHash: hashPassword(password) });
    return res.status(201).json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'That username is taken.' });
    return next(err);
  }
});

router.post('/auth/login', limiter, needDb, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const user = typeof username === 'string' ? await User.findOne({ usernameLower: username.toLowerCase() }) : null;
    if (!user || typeof password !== 'string' || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Wrong username or password.' });
    }
    return res.json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireAuth, needDb, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub);
    if (!user) return res.status(401).json({ error: 'Please log in again.' });
    return res.json({ user: user.toPublic() });
  } catch (err) {
    return next(err);
  }
});

export default router;
