import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { connectDb, dbReady } from './db.js';
import { readToken } from './auth.js';
import { User } from './models/User.js';
import { Run } from './models/Run.js';
import { applyResult } from './progress.js';
import { presence } from './presence.js';
import { RoomManager } from './game/rooms.js';
import { cleanLook, didWin } from '../shared/catalog.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import runsRouter from './routes/runs.js';
import shopRouter from './routes/shop.js';
import friendsRouter from './routes/friends.js';
import levelsRouter from './routes/levels.js';

const PORT = Number(process.env.PORT) || 4000;
const ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const allowAll = ORIGINS.includes('*');
const SELF = (process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
const originCheck = (origin, callback) => callback(null, !origin || allowAll || ORIGINS.includes(origin) || origin === SELF);

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: originCheck }));
app.use(express.json({ limit: '64kb' }));

// If the game has been built (client/dist), serve it from this same server:
// one Render service runs the whole thing.
const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
const serveClient = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));
if (serveClient) app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
else app.get('/', (req, res) => res.json({ game: 'Hush Heist API', phase: 6, health: '/api/health' }));
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', runsRouter);
app.use('/api', shopRouter);
app.use('/api', friendsRouter);
app.use('/api', levelsRouter);
app.use((req, res) => {
  if (serveClient && req.method === 'GET' && !req.path.startsWith('/api')) return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  return res.status(404).json({ error: 'Not found' });
});
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: allowAll ? '*' : [...ORIGINS, ...(SELF ? [SELF] : [])] } });

// Sockets carry the login token; guests can connect but can't make or join parties.
io.use(async (socket, next) => {
  socket.data.user = null;
  const claims = readToken(socket.handshake.auth?.token);
  if (claims && dbReady()) {
    try {
      const u = await User.findById(claims.sub).select('username equipped');
      if (u) socket.data.user = { id: String(u._id), name: u.username, look: cleanLook(u.equipped) };
    } catch {
      /* treat as guest */
    }
  }
  next();
});

const rooms = new RoomManager(io, {
  async getUser(id) {
    const u = await User.findById(id).select('friends').lean();
    return { friends: (u?.friends || []).map(String) };
  },
  async award(id, outcome) {
    const u = await User.findById(id);
    if (!u) return 0;
    const coins = applyResult(u, outcome, id);
    await u.save();
    const me = outcome.players.find((p) => p.id === id);
    await Run.create({
      user: u._id,
      mode: outcome.mode,
      level: outcome.level,
      result: outcome.result,
      won: didWin(outcome, id),
      snacks: me ? me.snacks : 0,
      totalSnacks: outcome.totalSnacks,
      timeMs: outcome.timeMs,
      stars: outcome.mode === 'heist' ? outcome.stars || 0 : 0,
      peakWake: outcome.peakWake,
      party: true,
    }).catch(() => {});
    return coins;
  },
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  if (user) presence.add(user.id);
  socket.emit('hush:hello', { phase: 6, loggedIn: !!user });
  rooms.attach(socket);
  socket.on('disconnect', () => {
    if (user) presence.remove(user.id);
  });
});

server.listen(PORT, () => {
  console.log(`[server] Hush Heist API listening on port ${PORT}`);
  console.log(`[server] Allowed origins: ${ORIGINS.join(', ')}`);
});

connectDb(process.env.MONGODB_URI);
