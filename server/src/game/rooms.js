import { Simulation } from '../../shared/sim/Simulation.js';
import { LEVEL_BY_ID, levelsForMode } from '../../shared/levels/index.js';
import { EMOTE_IDS, MODE_BY_ID, QUICK_CHAT } from '../../shared/catalog.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, so codes are easy to read out
const TICK_MS = 50;
const MAX_PLAYERS = 4;
const reply = (ack, data) => typeof ack === 'function' && ack(data);
const num = (v, lim) => (Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);

/**
 * Party rooms: 6-letter codes, up to 4 friends, server-run game.
 * Friends-only: you can only join a party whose host has you on their friends list.
 * No public lobbies and no free text: quick chat sends an index into QUICK_CHAT.
 *
 * deps.getUser(id) -> { friends: [idString] } ; deps.award(id, outcome) -> Promise<coins>
 */
export class RoomManager {
  constructor(io, deps) {
    this.io = io;
    this.deps = deps;
    this.rooms = new Map();
  }

  newCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  publicRoom(room) {
    return {
      code: room.code,
      hostId: room.hostId,
      mode: room.mode,
      level: room.level,
      guardId: room.guardId,
      state: room.state,
      voice: [...room.voice],
      members: [...room.members.values()].map((m) => ({ id: m.id, name: m.name, look: m.look, friends: [...room.members.keys()].filter((o) => o !== m.id && this.areFriends(room, m.id, o)) })),
    };
  }

  update(room) {
    this.io.to(room.code).emit('room:update', this.publicRoom(room));
  }

  attach(socket) {
    const user = socket.data.user;
    const needUser = (ack) => {
      if (user) return true;
      reply(ack, { ok: false, error: 'Log in to play with friends.' });
      return false;
    };

    socket.on('room:create', async (opts, ack) => {
      if (!needUser(ack)) return;
      this.leave(socket);
      const friends = await this.friendsOf(user.id);
      const mode = MODE_BY_ID[opts?.mode] ? opts.mode : 'heist';
      const levels = levelsForMode(mode);
      const level = levels.find((l) => l.id === opts?.level) ? opts.level : levels[0].id;
      const room = { code: this.newCode(), hostId: user.id, mode, level, guardId: null, state: 'lobby', members: new Map(), sim: null, inputs: new Map(), timer: null, ticks: 0, lastQuick: new Map(), voice: new Set() };
      room.members.set(user.id, { ...user, socketId: socket.id, friends });
      this.rooms.set(room.code, room);
      socket.join(room.code);
      socket.data.room = room.code;
      reply(ack, { ok: true, room: this.publicRoom(room) });
      this.update(room);
    });

    socket.on('room:join', async (rawCode, ack) => {
      if (!needUser(ack)) return;
      const code = String(rawCode || '').trim().toUpperCase();
      const room = this.rooms.get(code);
      if (!/^[A-Z]{6}$/.test(code) || !room) return reply(ack, { ok: false, error: 'No party with that code. Check the letters and try again.' });
      if (room.members.has(user.id)) {
        room.members.get(user.id).socketId = socket.id;
        socket.join(code);
        socket.data.room = code;
        return reply(ack, { ok: true, room: this.publicRoom(room) });
      }
      if (room.state !== 'lobby') return reply(ack, { ok: false, error: 'That party is mid-heist. Try again when the round ends.' });
      if (room.members.size >= MAX_PLAYERS) return reply(ack, { ok: false, error: 'That party is full (4 players max).' });
      let host;
      try {
        host = await this.deps.getUser(room.hostId);
      } catch {
        host = null;
      }
      if (!host || !host.friends.includes(user.id)) {
        return reply(ack, { ok: false, error: 'Only the host’s friends can join. Ask them to add you as a friend first.' });
      }
      if (!this.rooms.has(code) || room.members.size >= MAX_PLAYERS) return reply(ack, { ok: false, error: 'That party just filled up.' });
      this.leave(socket);
      const friends = await this.friendsOf(user.id);
      room.members.set(user.id, { ...user, socketId: socket.id, friends });
      socket.join(code);
      socket.data.room = code;
      reply(ack, { ok: true, room: this.publicRoom(room) });
      this.update(room);
    });

    socket.on('room:leave', () => this.leave(socket));

    socket.on('room:config', (cfg) => {
      const room = this.rooms.get(socket.data.room);
      if (!room || !user || room.hostId !== user.id || room.state !== 'lobby') return;
      if (cfg?.mode && MODE_BY_ID[cfg.mode]) room.mode = cfg.mode;
      const levels = levelsForMode(room.mode);
      if (cfg?.level && levels.some((l) => l.id === cfg.level)) room.level = cfg.level;
      if (!levels.some((l) => l.id === room.level)) room.level = levels[0].id;
      if (cfg && 'guardId' in cfg) room.guardId = cfg.guardId && room.members.has(cfg.guardId) ? cfg.guardId : null;
      this.update(room);
    });

    socket.on('room:start', (ack) => {
      const room = this.rooms.get(socket.data.room);
      if (!room || !user) return reply(ack, { ok: false, error: 'You’re not in a party.' });
      if (room.hostId !== user.id) return reply(ack, { ok: false, error: 'Only the host can start.' });
      if (room.state !== 'lobby') return reply(ack, { ok: false, error: 'Already playing.' });
      const mode = MODE_BY_ID[room.mode];
      if (room.members.size < mode.min) return reply(ack, { ok: false, error: `${mode.name} needs at least ${mode.min} players.` });
      this.start(room);
      reply(ack, { ok: true });
    });

    socket.on('input', (inp) => {
      const room = this.rooms.get(socket.data.room);
      if (!room || !user || room.state !== 'playing' || !inp || typeof inp !== 'object') return;
      const cur = room.inputs.get(user.id) || {};
      const pos =
        inp.pos && Number.isFinite(inp.pos.x) && Number.isFinite(inp.pos.z)
          ? { x: inp.pos.x, z: inp.pos.z, facing: Number.isFinite(inp.pos.facing) ? inp.pos.facing : undefined }
          : undefined;
      room.inputs.set(user.id, {
        mx: num(inp.mx, 1),
        mz: num(inp.mz, 1),
        run: !!inp.run,
        tiptoe: !!inp.tiptoe,
        moving: !!inp.moving,
        tp: Number.isInteger(inp.tp) ? inp.tp : undefined,
        pos,
        shh: !!cur.shh || !!inp.shh,
        interact: !!cur.interact || !!inp.interact,
        emote: EMOTE_IDS.has(inp.emote) ? inp.emote : cur.emote || null,
      });
    });

    socket.on('quick', (index) => {
      const room = this.rooms.get(socket.data.room);
      if (!room || !user || !Number.isInteger(index) || index < 0 || index >= QUICK_CHAT.length) return;
      const now = Date.now();
      if (now - (room.lastQuick.get(user.id) || 0) < 800) return;
      room.lastQuick.set(user.id, now);
      this.io.to(room.code).emit('quick', { id: user.id, index });
    });

    // ---- Voice chat (WebRTC). The server only passes connection messages
    // between players who are friends with each other; audio goes directly
    // between their devices and is never recorded.
    socket.on('voice:ready', () => {
      const room = this.rooms.get(socket.data.room);
      if (!room || !user || !room.members.has(user.id)) return;
      room.voice.add(user.id);
      const peers = [...room.voice].filter((id) => id !== user.id && this.areFriends(room, user.id, id));
      socket.emit('voice:peers', { peers });
      for (const id of peers) this.io.to(room.members.get(id).socketId).emit('voice:peer-joined', { id: user.id });
      this.update(room);
    });

    socket.on('voice:signal', (msg) => {
      const room = this.rooms.get(socket.data.room);
      if (!room || !user || !msg || typeof msg.to !== 'string') return;
      if (!room.voice.has(user.id) || !room.voice.has(msg.to) || !this.areFriends(room, user.id, msg.to)) return;
      let size = 0;
      try {
        size = JSON.stringify(msg.data).length;
      } catch {
        return;
      }
      if (size > 20000) return;
      this.io.to(room.members.get(msg.to).socketId).emit('voice:signal', { from: user.id, data: msg.data });
    });

    socket.on('voice:talking', (on) => {
      const room = this.rooms.get(socket.data.room);
      if (!room || !user || !room.voice.has(user.id)) return;
      socket.to(room.code).emit('voice:talking', { id: user.id, on: !!on });
    });

    socket.on('voice:leave', () => {
      const room = this.rooms.get(socket.data.room);
      if (room && user) this.leaveVoice(room, user.id);
    });

    socket.on('disconnect', () => this.leave(socket));
  }

  async friendsOf(id) {
    try {
      return (await this.deps.getUser(id))?.friends || [];
    } catch {
      return [];
    }
  }

  areFriends(room, a, b) {
    const ma = room.members.get(a);
    const mb = room.members.get(b);
    return !!ma && !!mb && (ma.friends.includes(b) || mb.friends.includes(a));
  }

  leaveVoice(room, id) {
    if (!room.voice.delete(id)) return;
    this.io.to(room.code).emit('voice:peer-left', { id });
    this.update(room);
  }

  leave(socket) {
    const code = socket.data.room;
    const user = socket.data.user;
    socket.data.room = null;
    if (!code || !user) return;
    socket.leave(code);
    const room = this.rooms.get(code);
    if (!room) return;
    const m = room.members.get(user.id);
    if (!m || m.socketId !== socket.id) return;
    this.leaveVoice(room, user.id);
    room.members.delete(user.id);
    room.inputs.delete(user.id);
    if (room.sim) {
      const p = room.sim.byId.get(user.id);
      if (p) {
        p.out = true;
        p.hidden = null;
      }
      if (room.sim.mode === 'hideseek' && user.id === room.sim.guardId && !room.sim.outcome) {
        room.sim.finish({ result: 'hiders', reason: 'guard-left', guardId: room.sim.guardId });
      }
    }
    if (room.members.size === 0) {
      this.stop(room);
      this.rooms.delete(code);
      return;
    }
    if (room.hostId === user.id) room.hostId = room.members.keys().next().value;
    if (room.guardId === user.id) room.guardId = null;
    this.update(room);
  }

  start(room) {
    const members = [...room.members.values()];
    const level = LEVEL_BY_ID[room.level];
    let guardId = null;
    if (room.mode === 'hideseek') guardId = room.guardId && room.members.has(room.guardId) ? room.guardId : members[Math.floor(Math.random() * members.length)].id;
    const seed = Math.floor(Math.random() * 1e9);
    const players = members.map((m) => ({ id: m.id, name: m.name, look: m.look }));
    room.sim = new Simulation(level, { mode: room.mode, seed, players, guardId });
    room.state = 'playing';
    room.inputs.clear();
    room.ticks = 0;
    this.io.to(room.code).emit('game:start', { level: level.id, mode: room.mode, seed, players, guardId });
    this.update(room);
    room.timer = setInterval(() => this.tick(room), TICK_MS);
  }

  tick(room) {
    const sim = room.sim;
    if (!sim) return;
    sim.update(TICK_MS / 1000, Object.fromEntries(room.inputs));
    for (const inp of room.inputs.values()) {
      inp.shh = false;
      inp.interact = false;
      inp.emote = null;
    }
    const events = sim.events.filter((e) => e.type !== 'step');
    sim.events.length = 0;
    if (events.length) this.io.to(room.code).emit('game:events', events);
    room.ticks += 1;
    if (room.ticks % 2 === 0 || sim.outcome) this.io.to(room.code).emit('game:snap', sim.snapshot());
    if (sim.outcome) this.end(room);
  }

  stop(room) {
    if (room.timer) clearInterval(room.timer);
    room.timer = null;
  }

  async end(room) {
    this.stop(room);
    const outcome = room.sim.outcome;
    room.sim = null;
    room.state = 'lobby';
    const coins = {};
    await Promise.allSettled(
      [...room.members.keys()].map(async (id) => {
        coins[id] = await this.deps.award(id, outcome);
      }),
    );
    this.io.to(room.code).emit('game:end', { outcome, coins });
    if (this.rooms.has(room.code)) this.update(room);
  }
}
