import { Router } from 'express';
import { dbState } from '../db.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, game: 'hush-heist', phase: 6, db: dbState(), uptime: Math.round(process.uptime()) });
});

export default router;
