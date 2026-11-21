import { TUNING as T } from './tuning.js';
import { angleDiff, castRay, inBox, mulberry32, resolveCircle, segmentBlocked, turnToward } from './geometry2d.js';
import { EMOTE_IDS } from '../catalog.js';

const NO_INPUT = Object.freeze({ mx: 0, mz: 0, run: false, tiptoe: false, shh: false, interact: false, emote: null });
const SPAWN_OFFSETS = [
  [0, 0],
  [-1.1, 1.2],
  [1.2, 1.3],
  [-1.3, -1.1],
];
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * The whole rules engine, shared by the browser (solo play, prediction) and the
 * server (authoritative multiplayer). No three.js here: only positions on the floor.
 *
 * Modes: 'heist' (co-op), 'race' (Fridge Race), 'hideseek' (Hide & Seek).
 * update(dt, inputs) takes either one input (solo) or { [playerId]: input }.
 * An input can carry pos: {x, z, facing} (networked players move on their own
 * device and report where they are); otherwise mx/mz move the player here.
 */
export class Simulation {
  constructor(level, opts = {}) {
    this.level = level;
    this.mode = opts.mode || 'heist';
    this.seed = opts.seed ?? 7;
    this.roster = opts.players && opts.players.length ? opts.players : [{ id: 'p1', name: 'Hero' }];
    this.guardId = this.mode === 'hideseek' ? opts.guardId ?? this.roster[0].id : null;
    this.colliders = [...level.walls, ...level.furniture];
    this.sightBlockers = [...level.walls, ...level.furniture.filter((f) => f.blocksSight)];
    this.reset();
  }

  reset() {
    const L = this.level;
    this.rng = mulberry32(this.seed);
    this.time = 0;
    this.events = [];
    this.outcome = null;
    this.collected = 0;
    this.peakWake = 0;
    this.alarms = 0;
    if (this.mode === 'hideseek') {
      this.phase = 'hiding';
      this.phaseTimer = T.hideseek.hideTime;
    } else if (this.mode === 'race') {
      this.phase = 'countdown';
      this.phaseTimer = T.countdown;
    } else {
      this.phase = 'play';
      this.phaseTimer = 0;
    }
    this.players = this.roster.map((r, i) => this.makePlayer(r, i));
    this.byId = new Map(this.players.map((p) => [p.id, p]));
    this.player = this.players[0];
    this.snacks = L.snacks.map((s) => ({ ...s, taken: false, takenBy: null }));
    this.toys = L.toys.map((t) => ({ ...t, armed: true, squash: 0 }));
    this.creaks = L.creaks.map((c) => ({ ...c }));
    this.doors = L.doors.map((d) => ({ ...d, open: 0 }));
    this.sleepers = L.sleepers.map((s) => ({
      ...s,
      hx: s.x,
      hz: s.z,
      heading: 0,
      wake: 0,
      quietTime: 99,
      calmFlash: 0,
      stage: 'asleep',
      state: 'asleep', // asleep | chasing | searching | returning | crying
      crier: s.crier ?? s.look === 'baby',
      stun: 0,
      timer: 0,
      lx: s.x,
      lz: s.z,
      lastHeard: null,
      lastHeardBy: null,
    }));
    this.nav = null;
    this.flow = new Map();
    this.patrollers = L.patrollers.map((p) => {
      const base = { ...p, timer: 0, detect: 0, sees: false, target: null, watching: false };
      if (p.type === 'eye') return { ...base, heading: p.baseHeading, state: 'nap', open: false, cycle: p.closedTime };
      const [x, z] = p.path[0];
      const [nx, nz] = p.path[1 % p.path.length];
      return { ...base, x, z, heading: Math.atan2(nx - x, nz - z), target: null, next: 1 % p.path.length, state: 'patrol' };
    });
  }

  spawnPoint(i) {
    const L = this.level;
    if (L.spawns && L.spawns[i]) return L.spawns[i];
    const o = SPAWN_OFFSETS[i % SPAWN_OFFSETS.length];
    return [L.start.x + o[0], L.start.z + o[1]];
  }

  makePlayer(r, i) {
    const guard = this.mode === 'hideseek' && r.id === this.guardId;
    const [x, z] = guard && this.level.guardSpawn ? this.level.guardSpawn : this.spawnPoint(i);
    return {
      id: r.id,
      name: r.name || `Player ${i + 1}`,
      look: r.look || null,
      index: i,
      x,
      z,
      sx: x,
      sz: z,
      tx: x,
      tz: z,
      facing: this.level.start.facing,
      mode: 'walk',
      moving: false,
      hidden: null,
      stepTimer: 0,
      poseTimer: 0,
      freezeTimer: guard ? T.hideseek.hideTime : 0,
      emote: null,
      emoteTimer: 0,
      danceTimer: 0,
      shhCooldown: 0,
      bubbleTimer: 0,
      shhUses: 0,
      out: false,
      role: this.mode === 'hideseek' ? (guard ? 'guard' : 'hider') : 'sneaker',
      catchMeter: 0,
      tp: 0,
      noise: 0,
      noiseSpike: 0,
      snacks: 0,
      busted: 0,
      creakState: {},
      doorNear: {},
    };
  }

  // ---------------------------------------------------------------- loop
  update(dt, inputs = {}) {
    if (this.outcome) return;
    if (inputs && typeof inputs.mx === 'number') inputs = { [this.players[0].id]: inputs };
    this.time += dt;
    this.updatePhase(dt);
    for (const p of this.players) {
      const input = inputs[p.id] || NO_INPUT;
      this.updateShh(p, input, dt);
      this.updateEmote(p, input, dt);
      this.updatePlayer(p, input, dt);
      if (!p.hidden && !p.out) this.updateTriggers(p, dt);
      this.updateNoiseMeter(p, dt);
    }
    for (const t of this.toys) {
      t.squash = Math.max(0, t.squash - dt * 3);
      if (!t.armed && this.players.every((p) => p.hidden || Math.hypot(t.x - p.x, t.z - p.z) > T.toyRearm)) t.armed = true;
    }
    this.updateDoors(dt);
    this.updatePatrollers(dt, true);
    if (this.mode === 'hideseek') this.updateGuard(dt);
    this.updateSleepers(dt);
    this.checkOutcome();
  }

  // Title screen: the house keeps breathing, but nothing is heard or seen.
  updateAttract(dt) {
    this.time += dt;
    this.updateDoors(dt);
    this.updatePatrollers(dt, false);
    for (const s of this.sleepers) s.calmFlash = Math.max(0, s.calmFlash - dt);
  }

  updatePhase(dt) {
    if (this.phase === 'countdown') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'play';
        this.phaseTimer = 0;
        this.events.push({ type: 'go' });
      }
    } else if (this.phase === 'hiding') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'seeking';
        this.phaseTimer = T.hideseek.seekTime;
        this.events.push({ type: 'seek' });
      }
    } else if (this.phase === 'seeking') {
      this.phaseTimer = Math.max(0, this.phaseTimer - dt);
    }
  }

  // --------------------------------------------------------------- player
  updatePlayer(p, input, dt) {
    p.poseTimer = Math.max(0, p.poseTimer - dt);
    p.freezeTimer = Math.max(0, p.freezeTimer - dt);
    if (input.interact) this.interact(p);
    if (p.hidden || this.phase === 'countdown') {
      p.moving = false;
      return;
    }
    if (input.pos) this.applyReportedPosition(p, input, dt);
    else this.movePlayer(p, input, dt);

    if (!p.moving) {
      p.stepTimer = Math.min(p.stepTimer, 0.1);
      return;
    }
    if (p.emote) {
      p.emote = null;
      p.emoteTimer = 0;
    }
    p.stepTimer -= dt;
    if (p.stepTimer <= 0) {
      p.stepTimer = T.stepInterval[p.mode];
      const n = T.noise.step[p.mode];
      if (n && !p.out) this.emitNoise(p.x, p.z, n[0], n[1], 'step', p.id);
      this.events.push({ type: 'step', id: p.id, mode: p.mode });
    }
  }

  // Pure movement: used here and by the client to predict its own player.
  movePlayer(p, input, dt) {
    let mx = input.mx || 0;
    let mz = input.mz || 0;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    p.mode = input.tiptoe ? 'tiptoe' : input.run ? 'run' : 'walk';
    p.moving = len > 0.15 && p.freezeTimer <= 0 && !p.hidden;
    if (!p.moving) return;
    const speed = T.speed[p.mode] * Math.min(1, len);
    const next = resolveCircle(p.x + mx * speed * dt, p.z + mz * speed * dt, T.playerRadius, this.colliders);
    p.x = next.x;
    p.z = next.z;
    p.facing = Math.atan2(mx, mz);
  }

  applyReportedPosition(p, input, dt) {
    p.mode = input.tiptoe ? 'tiptoe' : input.run ? 'run' : 'walk';
    if (p.freezeTimer > 0 || (input.tp !== undefined && input.tp !== p.tp)) {
      p.moving = false;
      return;
    }
    const { x, z, facing } = input.pos;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const maxStep = T.speed.run * Math.max(dt, 0.05) * 3 + 0.6;
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d <= maxStep) {
      p.x = x;
      p.z = z;
    } else {
      p.x += (dx / d) * maxStep;
      p.z += (dz / d) * maxStep;
    }
    const fixed = resolveCircle(p.x, p.z, T.playerRadius * 0.8, this.colliders);
    p.x = fixed.x;
    p.z = fixed.z;
    p.moving = !!input.moving && d > 0.0005;
    if (Number.isFinite(facing)) p.facing = facing;
  }

  nearestHideSpot(p) {
    let best = null;
    let bestD = T.hideRadius;
    for (const s of this.level.hideSpots) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }

  interact(p) {
    if (p.out) return;
    if (p.role === 'guard') {
      if (this.phase !== 'seeking') return;
      const spot = this.nearestHideSpot(p);
      if (!spot) return;
      this.events.push({ type: 'search', id: p.id, spot: spot.id });
      for (const h of this.players) if (h.hidden && h.hidden.id === spot.id && h.role === 'hider') this.catchPlayer(h, p);
      return;
    }
    if (p.hidden) {
      const s = p.hidden;
      p.x = s.x;
      p.z = s.z;
      p.hidden = null;
      p.tp += 1;
      this.events.push({ type: 'unhide', id: p.id, spot: s.id });
      return;
    }
    const spot = this.nearestHideSpot(p);
    if (!spot) return;
    p.hidden = spot;
    p.x = spot.hideX;
    p.z = spot.hideZ;
    p.moving = false;
    p.emote = null;
    p.tp += 1;
    this.events.push({ type: 'hide', id: p.id, spot: spot.id, kind: spot.type });
  }

  updateEmote(p, input, dt) {
    p.emoteTimer = Math.max(0, p.emoteTimer - dt);
    if (p.emoteTimer <= 0) p.emote = null;
    if (input.emote && EMOTE_IDS.has(input.emote) && !p.hidden && !p.out) {
      p.emote = input.emote;
      p.emoteTimer = T.emoteTime;
      p.danceTimer = 0.25;
      this.events.push({ type: 'emote', id: p.id, emote: p.emote });
    }
    if (p.emote === 'dance') {
      p.danceTimer -= dt;
      if (p.danceTimer <= 0) {
        p.danceTimer = 0.5;
        this.emitNoise(p.x, p.z, T.noise.dance[0], T.noise.dance[1], 'step', p.id);
      }
    }
  }

  // ------------------------------------------------- snacks, toys, creaks
  updateTriggers(p, dt) {
    const mode = p.mode;
    for (const s of this.snacks) {
      if (s.taken) continue;
      if (Math.hypot(s.x - p.x, s.z - p.z) < T.pickupRadius) {
        s.taken = true;
        s.takenBy = p.id;
        p.snacks += 1;
        this.collected += 1;
        this.events.push({ type: 'snack', id: s.id, by: p.id, name: s.name, x: s.x, z: s.z, stash: s.kind === 'stash' });
      }
    }
    for (const t of this.toys) {
      if (t.armed && Math.hypot(t.x - p.x, t.z - p.z) < T.toyRadius) {
        t.armed = false;
        t.squash = 1;
        const n = T.noise.squeak[mode];
        this.emitNoise(t.x, t.z, n[0], n[1], 'squeak', p.id);
      }
    }
    for (const c of this.creaks) {
      const st = p.creakState[c.id] || (p.creakState[c.id] = { inside: false, timer: 0 });
      const inside = inBox(p.x, p.z, c);
      if (inside && p.moving) {
        const n = T.noise.creak[mode];
        if (!st.inside) {
          this.emitNoise(p.x, p.z, n[0], n[1], 'creak', p.id);
          st.timer = T.creakRepeat;
        } else if (mode !== 'tiptoe') {
          st.timer -= dt;
          if (st.timer <= 0) {
            this.emitNoise(p.x, p.z, n[0], n[1], 'creak', p.id);
            st.timer = T.creakRepeat;
          }
        }
      }
      st.inside = inside;
    }
    for (const d of this.doors) {
      const near = Math.hypot(d.x - p.x, d.z - p.z) < T.doorRadius;
      if (near && !p.doorNear[d.id] && p.moving) {
        const n = T.noise.door[mode];
        this.emitNoise(d.x, d.z, n[0], n[1], 'door', p.id);
      }
      p.doorNear[d.id] = near;
    }
  }

  updateDoors(dt) {
    for (const d of this.doors) {
      const near = this.players.some((p) => !p.hidden && Math.hypot(d.x - p.x, d.z - p.z) < T.doorRadius + 0.3);
      const target = near ? 1 : 0;
      d.open += (target - d.open) * Math.min(1, dt * (target ? 6 : 1.5));
    }
  }

  // ---------------------------------------------------------------- noise
  emitNoise(x, z, radius, intensity, kind, byId = null) {
    const muted = this.players.some((p) => p.bubbleTimer > 0 && Math.hypot(x - p.x, z - p.z) <= T.shh.bubbleRadius);
    this.events.push({ type: 'noise', x, z, radius, intensity, kind, muted, by: byId });
    if (muted) return false;
    for (const s of this.sleepers) {
      if (s.state !== 'asleep') continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d >= radius) continue;
      const falloff = T.noiseFloor + (1 - T.noiseFloor) * (1 - d / radius);
      s.wake = Math.min(100, s.wake + intensity * s.sens * falloff);
      s.quietTime = 0;
      s.lastHeard = kind;
      s.lastHeardBy = byId;
    }
    const p = byId && this.byId.get(byId);
    if (p) p.noiseSpike = Math.max(p.noiseSpike, Math.min(100, intensity * 3.2));
    return true;
  }

  updateNoiseMeter(p, dt) {
    let base = 0;
    if (p.moving && !p.hidden && !p.out) base = p.mode === 'tiptoe' ? 6 : p.mode === 'walk' ? 38 : 86;
    if (p.bubbleTimer > 0) base = 0;
    const target = Math.max(base, p.noiseSpike);
    p.noise += (target - p.noise) * Math.min(1, dt * 8);
    p.noiseSpike = Math.max(0, p.noiseSpike - 60 * dt);
  }

  // ------------------------------------------------------------------ shh
  updateShh(p, input, dt) {
    p.shhCooldown = Math.max(0, p.shhCooldown - dt);
    p.bubbleTimer = Math.max(0, p.bubbleTimer - dt);
    if (input.shh && p.shhCooldown <= 0 && !p.out) this.doShh(p);
  }

  doShh(p) {
    const S = T.shh;
    p.shhCooldown = S.cooldown;
    p.bubbleTimer = S.bubbleTime;
    p.shhUses += 1;
    p.poseTimer = S.poseTime;
    p.freezeTimer = Math.max(p.freezeTimer, S.freezeTime);
    const calmed = [];
    for (const s of this.sleepers) {
      if (s.state === 'crying' && Math.hypot(s.x - p.x, s.z - p.z) <= S.calmRadius) {
        s.state = 'asleep';
        s.wake = T.chase.backToSleepWake;
        s.quietTime = 0;
        calmed.push(s.id);
        this.events.push({ type: 'hush-baby', id: s.id });
        continue;
      }
      if (s.state !== 'asleep') {
        if (Math.hypot(s.x - p.x, s.z - p.z) <= S.calmRadius) {
          s.stun = T.chase.stunTime;
          this.events.push({ type: 'stunned', id: s.id });
        }
        continue;
      }
      if (Math.hypot(s.x - p.x, s.z - p.z) <= S.calmRadius) {
        s.wake = Math.max(0, s.wake - S.calmAmount);
        s.calmFlash = 1.2;
        s.quietTime = T.wake.decayDelay;
        calmed.push(s.id);
      }
    }
    for (const c of this.patrollers) {
      if (c.type === 'eye') continue;
      if (Math.hypot(c.x - p.x, c.z - p.z) > S.catRadius) continue;
      c.detect = 0;
      if (c.type === 'cat') {
        c.state = 'calmed';
        c.timer = S.catNap;
      }
    }
    p.noiseSpike = 0;
    p.noise = 0;
    this.events.push({ type: 'shh', id: p.id, x: p.x, z: p.z, calmed });
  }

  // ----------------------------------------------------------- patrollers
  updatePatrollers(dt, live) {
    for (const c of this.patrollers) {
      c.timer = Math.max(0, c.timer - dt);
      if (c.type === 'eye') this.updateEye(c, dt);
      else this.movePatroller(c, dt, live);

      c.watching = c.state === 'patrol' || c.state === 'alert';
      if (!live || this.phase === 'countdown' || this.phase === 'hiding') {
        c.sees = false;
        c.detect = live ? Math.max(0, c.detect - T.detect.decay * dt) : 0;
        continue;
      }
      let best = null;
      let bestD = Infinity;
      if (c.state === 'patrol') {
        for (const p of this.players) {
          if (p.hidden || p.out) continue;
          const dx = p.x - c.x;
          const dz = p.z - c.z;
          const d = Math.hypot(dx, dz);
          if (d >= c.range || d >= bestD) continue;
          if (Math.abs(angleDiff(Math.atan2(dx, dz), c.heading)) >= c.fov / 2) continue;
          if (segmentBlocked(c.x, c.z, p.x, p.z, this.sightBlockers)) continue;
          best = p;
          bestD = d;
        }
      }
      c.sees = !!best;
      c.target = best ? best.id : null;
      if (best) {
        const closeness = 1.25 - bestD / c.range;
        const m = best.moving ? best.mode : 'still';
        const mul = c.type === 'eye' ? T.eye.rateMul : 1;
        c.detect += T.detect.rate * closeness * T.detect.modeFactor[m] * mul * dt;
        if (c.detect >= 100) this.raiseAlarm(c, best);
      } else {
        c.detect = Math.max(0, c.detect - T.detect.decay * dt);
      }
    }
  }

  movePatroller(c, dt, live) {
    if (c.state === 'patrol') {
      const [tx, tz] = c.path[c.next];
      const dx = tx - c.x;
      const dz = tz - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001) c.heading = turnToward(c.heading, Math.atan2(dx, dz), c.turnRate * dt);
      const aligned = d < 0.001 || Math.abs(angleDiff(c.heading, Math.atan2(dx, dz))) < 0.5;
      const step = c.speed * dt * (aligned ? 1 : 0.2);
      if (d <= step) {
        c.x = tx;
        c.z = tz;
        c.next = (c.next + 1) % c.path.length;
        if (c.napChance && this.rng() < c.napChance) {
          c.state = 'nap';
          c.timer = 2.5 + this.rng() * 2.5;
        }
      } else {
        c.x += (dx / d) * step;
        c.z += (dz / d) * step;
      }
    } else if (c.state === 'nap' || c.state === 'calmed') {
      if (c.timer <= 0) c.state = 'patrol';
    } else if (c.state === 'alert') {
      if (c.type === 'cat') {
        const t = c.alertOn && this.byId.get(c.alertOn);
        if (live && t && !t.hidden) c.heading = turnToward(c.heading, Math.atan2(t.x - c.x, t.z - c.z), 6 * dt);
      } else {
        c.heading += dt * 3.5;
      }
      if (c.timer <= 0) c.state = 'patrol';
    }
  }

  // Grandpa's one open eye: opens and closes, sweeping back and forth.
  updateEye(c, dt) {
    const owner = this.sleepers.find((x) => x.id === c.sleeperId);
    if (owner && owner.state !== 'asleep') {
      c.state = 'nap';
      c.open = false;
      c.cycle = c.closedTime;
      return;
    }
    c.cycle -= dt;
    if (c.state === 'alert') {
      if (c.timer <= 0) {
        c.state = 'nap';
        c.open = false;
        c.cycle = c.closedTime;
      }
    } else if (c.cycle <= 0) {
      c.open = !c.open;
      c.cycle = c.open ? c.openTime : c.closedTime + this.rng() * 1.5;
      c.state = c.open ? 'patrol' : 'nap';
      this.events.push({ type: c.open ? 'eye-open' : 'eye-close', id: c.id });
    }
    c.heading = c.baseHeading + Math.sin(this.time * c.sweepSpeed) * c.sweep;
  }

  raiseAlarm(c, p) {
    c.state = 'alert';
    c.timer = T.detect.alertTime;
    c.detect = 0;
    c.sees = false;
    c.alertOn = p.id;
    this.alarms += 1;
    const kind = c.type === 'cat' ? 'meow' : c.type === 'eye' ? 'huh' : 'beep';
    this.events.push({ type: 'alarm', id: c.id, kind, x: c.x, z: c.z, target: p.id });
    if (c.type === 'eye') {
      const s = this.sleepers.find((x) => x.id === c.sleeperId);
      if (s && s.state === 'asleep') {
        s.wake = Math.min(100, s.wake + T.eye.wakeHit);
        s.quietTime = 0;
        s.lastHeard = 'huh';
        s.lastHeardBy = p.id;
      }
    } else {
      this.emitNoise(c.x, c.z, T.noise.alarm[0], T.noise.alarm[1], kind, p.id);
    }
    if (this.mode === 'race') this.bust(p, kind);
  }

  // Fridge Race penalty: back to your start line.
  bust(p, reason) {
    if (!p || p.out) return;
    p.hidden = null;
    p.x = p.sx;
    p.z = p.sz;
    p.freezeTimer = T.bustFreeze;
    p.busted += 1;
    p.tp += 1;
    this.events.push({ type: 'busted', id: p.id, name: p.name, reason });
  }

  // -------------------------------------------------------- hide & seek
  updateGuard(dt) {
    const g = this.byId.get(this.guardId);
    if (!g || this.phase !== 'seeking') return;
    const H = T.hideseek;
    for (const h of this.players) {
      if (h.role !== 'hider' || h.out) continue;
      let seen = false;
      if (!h.hidden) {
        const dx = h.x - g.x;
        const dz = h.z - g.z;
        const d = Math.hypot(dx, dz);
        if (d < H.tagRadius) {
          this.catchPlayer(h, g);
          continue;
        }
        seen =
          d < H.range &&
          Math.abs(angleDiff(Math.atan2(dx, dz), g.facing)) < H.fov / 2 &&
          !segmentBlocked(g.x, g.z, h.x, h.z, this.sightBlockers);
      }
      h.catchMeter = seen ? h.catchMeter + dt / H.catchTime : Math.max(0, h.catchMeter - dt);
      if (h.catchMeter >= 1) this.catchPlayer(h, g);
    }
  }

  catchPlayer(h, by) {
    if (h.out) return;
    if (h.hidden) {
      h.x = h.hidden.x;
      h.z = h.hidden.z;
      h.hidden = null;
      h.tp += 1;
    }
    h.out = true;
    h.catchMeter = 0;
    this.events.push({ type: 'caught', id: h.id, name: h.name, by: by ? by.id : null });
  }

  // Edge points of a vision fan, clipped by walls.
  fan(x, z, heading, fov, range, rays = 22) {
    const pts = [];
    for (let i = 0; i <= rays; i++) {
      const a = heading - fov / 2 + (fov * i) / rays;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      const t = castRay(x, z, dx, dz, range, this.sightBlockers);
      pts.push(x + dx * t, z + dz * t);
    }
    return pts;
  }

  visionFan(c, rays = 22) {
    return this.fan(c.x, c.z, c.heading, c.fov, c.range, rays);
  }

  // ------------------------------------------------------------- sleepers
  updateSleepers(dt) {
    const W = T.wake;
    for (const s of this.sleepers) {
      s.calmFlash = Math.max(0, s.calmFlash - dt);
      if (s.state === 'asleep') {
        s.quietTime += dt;
        if (s.quietTime > W.decayDelay) s.wake = Math.max(0, s.wake - W.decayRate * dt);
        s.stage = s.wake >= 100 ? 'awake' : s.wake >= W.waking ? 'waking' : s.wake >= W.stirring ? 'stirring' : 'asleep';
        if (s.wake > this.peakWake) this.peakWake = s.wake;
        if (s.wake >= 100) this.wakeUp(s);
      } else {
        this.updateAwake(s, dt);
      }
    }
  }

  // Someone woke up! The baby cries and wakes everyone else; grown-ups chase.
  wakeUp(s) {
    s.wake = 100;
    s.stage = 'awake';
    this.peakWake = 100;
    if (s.crier) {
      s.state = 'crying';
      s.timer = 0;
      this.events.push({ type: 'cry', id: s.id, name: s.name });
      for (const o of this.sleepers) if (o !== s && o.state === 'asleep') this.startChase(o, true);
      return;
    }
    this.startChase(s, false);
  }

  startChase(s, byBaby) {
    s.state = 'chasing';
    s.stage = 'awake';
    s.wake = 100;
    s.stun = 0.8; // a moment to get up
    this.events.push({ type: 'wake', id: s.id, name: s.name, byBaby });
  }

  updateAwake(s, dt) {
    const C = T.chase;
    if (s.state === 'crying') {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.timer = C.cryEvery;
        this.events.push({ type: 'noise', x: s.x, z: s.z, radius: C.cryNoise[0], intensity: C.cryNoise[1], kind: 'cry', muted: false, by: null });
      }
      return;
    }
    s.stun = Math.max(0, s.stun - dt);
    const target = this.nearestTarget(s);
    if (target && s.state !== 'returning') {
      s.state = 'chasing';
      s.lx = target.x;
      s.lz = target.z;
      if (s.stun <= 0) this.walkToward(s, target.x, target.z, dt, C.speed * (s.scale < 0.8 ? 1.15 : 1));
      if (Math.hypot(target.x - s.x, target.z - s.z) < C.catchRadius && s.stun <= 0) this.caughtBy(target, s);
      return;
    }
    if (s.state === 'chasing') {
      // Lost you: go where you were last seen and look around.
      if (s.stun <= 0) this.walkToward(s, s.lx, s.lz, dt, C.speed * 0.8);
      if (Math.hypot(s.lx - s.x, s.lz - s.z) < 0.6) {
        s.state = 'searching';
        s.timer = C.searchTime;
        this.events.push({ type: 'searching', id: s.id });
      }
    } else if (s.state === 'searching') {
      s.timer -= dt;
      s.heading += dt * 2.2;
      if (s.timer <= 0) s.state = 'returning';
    } else if (s.state === 'returning') {
      if (this.nearestTarget(s, 3)) {
        s.state = 'chasing';
        return;
      }
      this.walkToward(s, s.hx, s.hz, dt, C.speed * 0.7);
      if (Math.hypot(s.hx - s.x, s.hz - s.z) < 1.6) {
        s.x = s.hx;
        s.z = s.hz;
        s.state = 'asleep';
        s.wake = C.backToSleepWake;
        s.quietTime = 0;
        s.stage = 'stirring';
        this.events.push({ type: 'back-to-bed', id: s.id, name: s.name });
      }
    }
  }

  nearestTarget(s, maxD = Infinity) {
    let best = null;
    let bestD = maxD;
    for (const p of this.players) {
      if (p.hidden || p.out) continue;
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  // Walking around furniture: follow a distance map (flow field) toward the goal.
  navGrid() {
    if (this.nav) return this.nav;
    const B = this.level.bounds;
    const G = 0.5;
    const W = Math.round((B.maxX - B.minX) / G);
    const H = Math.round((B.maxZ - B.minZ) / G);
    const open = new Uint8Array(W * H);
    const solid = [...this.level.walls, ...this.level.furniture];
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = B.minX + (i + 0.5) * G;
        const z = B.minZ + (j + 0.5) * G;
        const r = resolveCircle(x, z, 0.3, solid);
        open[j * W + i] = Math.abs(r.x - x) < 1e-6 && Math.abs(r.z - z) < 1e-6 ? 1 : 0;
      }
    }
    this.nav = { B, G, W, H, open, solid };
    return this.nav;
  }

  flowTo(x, z) {
    const n = this.navGrid();
    const key = `${Math.floor((x - n.B.minX) / n.G)},${Math.floor((z - n.B.minZ) / n.G)}`;
    const cached = this.flow.get(key);
    if (cached && this.time - cached.at < 0.4) return cached.dist;
    const dist = new Int32Array(n.W * n.H).fill(-1);
    const gi = Math.max(0, Math.min(n.W - 1, Math.floor((x - n.B.minX) / n.G)));
    const gj = Math.max(0, Math.min(n.H - 1, Math.floor((z - n.B.minZ) / n.G)));
    const q = [gj * n.W + gi];
    dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      const i = c % n.W;
      const j = (c / n.W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= n.W || nj >= n.H) continue;
        const k = nj * n.W + ni;
        if (dist[k] >= 0 || !n.open[k]) continue;
        dist[k] = dist[c] + 1;
        q.push(k);
      }
    }
    if (this.flow.size > 24) this.flow.clear();
    this.flow.set(key, { at: this.time, dist });
    return dist;
  }

  walkToward(s, tx, tz, dt, speed) {
    const n = this.navGrid();
    let gx = tx;
    let gz = tz;
    const dist = this.flowTo(tx, tz);
    const i = Math.floor((s.x - n.B.minX) / n.G);
    const j = Math.floor((s.z - n.B.minZ) / n.G);
    const here = i >= 0 && j >= 0 && i < n.W && j < n.H ? dist[j * n.W + i] : -1;
    if (here > 1) {
      let best = here;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= n.W || nj >= n.H) continue;
        const d = dist[nj * n.W + ni];
        if (d >= 0 && d < best) {
          best = d;
          gx = n.B.minX + (ni + 0.5) * n.G;
          gz = n.B.minZ + (nj + 0.5) * n.G;
        }
      }
    }
    const dx = gx - s.x;
    const dz = gz - s.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) return;
    s.heading = turnToward(s.heading, Math.atan2(dx, dz), 8 * dt);
    const step = Math.min(d, speed * dt);
    const res = resolveCircle(s.x + (dx / d) * step, s.z + (dz / d) * step, 0.3, n.solid);
    s.x = res.x;
    s.z = res.z;
  }

  caughtBy(p, s) {
    this.events.push({ type: 'grabbed', id: p.id, by: s.id, name: s.name });
    if (this.mode === 'race') {
      this.bust(p, 'caught');
      s.state = 'returning';
      return;
    }
    if (this.mode === 'hideseek') {
      if (p.role === 'guard') {
        this.finish({ result: 'hiders', reason: 'guard-caught', guardId: this.guardId });
        return;
      }
      this.catchPlayer(p, null);
      s.state = 'returning';
      return;
    }
    // Co-op heist: you're out. If nobody's left, the heist is over.
    p.out = true;
    p.hidden = null;
    s.state = 'returning';
    if (this.players.every((x) => x.out)) {
      this.finish({ result: 'caught', by: s.name, byId: s.id, heard: 'chase', culprit: null });
      this.events.push({ type: 'lose', id: s.id });
    }
  }

  // -------------------------------------------------------------- outcome
  checkOutcome() {
    const L = this.level;
    const active = this.players.filter((p) => !p.out);
    if (this.outcome) return;
    if (this.mode === 'heist') {
      const stash = L.stashId ? this.snacks.find((s) => s.id === L.stashId) : null;
      const ready = this.collected >= L.snacksRequired && (!stash || stash.taken);
      // Everyone still in the game has to make it back.
      if (ready && active.length && active.every((p) => !p.hidden && inBox(p.x, p.z, L.exitZone))) {
        const stats = this.stats();
        const fast = stats.timeMs <= (L.parTime ?? 60) * 1000;
        const stars = 1 + (stats.snacks === stats.totalSnacks ? 1 : 0) + (fast ? 1 : 0);
        this.finish({ result: 'escaped', stars });
        this.events.push({ type: 'win' });
      }
    } else if (this.mode === 'race') {
      if (this.phase !== 'play' || !L.raceGoal) return;
      const winner = active.find((p) => !p.hidden && inBox(p.x, p.z, L.raceGoal));
      if (winner) {
        this.finish({ result: 'finished', winnerId: winner.id, winnerName: winner.name });
        this.events.push({ type: 'win', id: winner.id });
      }
    } else if (this.mode === 'hideseek' && this.phase === 'seeking') {
      const hiders = this.players.filter((p) => p.role === 'hider');
      if (hiders.length && hiders.every((h) => h.out)) this.finish({ result: 'guard', guardId: this.guardId });
      else if (this.phaseTimer <= 0) this.finish({ result: 'hiders', guardId: this.guardId });
    }
  }

  finish(extra) {
    this.outcome = { mode: this.mode, ...this.stats(), ...extra };
  }

  stats() {
    return {
      mode: this.mode,
      level: this.level.id,
      levelName: this.level.name,
      parTime: this.level.parTime ?? 60,
      timeMs: Math.round(this.time * 1000),
      snacks: this.collected,
      totalSnacks: this.snacks.length,
      peakWake: Math.round(this.peakWake),
      alarms: this.alarms,
      shhUses: this.players.reduce((n, p) => n + p.shhUses, 0),
      guardId: this.guardId,
      players: this.players.map((p) => ({ id: p.id, name: p.name, snacks: p.snacks, out: p.out, busted: p.busted, role: p.role })),
    };
  }

  // ------------------------------------------------------------- network
  snapshot() {
    return {
      t: r2(this.time),
      ph: this.phase,
      pt: r2(this.phaseTimer),
      col: this.collected,
      pw: Math.round(this.peakWake),
      al: this.alarms,
      pl: this.players.map((p) => ({
        id: p.id,
        x: r2(p.x),
        z: r2(p.z),
        f: r2(p.facing),
        m: p.mode,
        mv: p.moving ? 1 : 0,
        h: p.hidden ? p.hidden.id : null,
        po: r2(p.poseTimer),
        fr: r2(p.freezeTimer),
        e: p.emote,
        et: r2(p.emoteTimer),
        sc: r2(p.shhCooldown),
        b: r2(p.bubbleTimer),
        su: p.shhUses,
        o: p.out ? 1 : 0,
        cm: r2(p.catchMeter),
        tp: p.tp,
        n: Math.round(p.noise),
        s: p.snacks,
        bu: p.busted,
      })),
      sl: this.sleepers.map((s) => ({ w: r2(s.wake), st: s.stage, cf: r2(s.calmFlash), s: s.state, x: r2(s.x), z: r2(s.z), h: r2(s.heading), sn: r2(s.stun) })),
      pa: this.patrollers.map((c) => ({ x: r2(c.x), z: r2(c.z), hd: r2(c.heading), st: c.state, d: Math.round(c.detect), se: c.sees ? 1 : 0, tg: c.target })),
      sn: this.snacks.map((s) => (s.taken ? 1 : 0)).join(''),
      dr: this.doors.map((d) => r2(d.open)),
      ty: this.toys.map((t) => r2(t.squash)),
    };
  }

  // Client side: copy the server's state in. The local player keeps its own
  // predicted position unless the server teleported it (hide, bust, caught).
  applySnapshot(s, localId) {
    this.time = s.t;
    this.phase = s.ph;
    this.phaseTimer = s.pt;
    this.collected = s.col;
    this.peakWake = s.pw;
    this.alarms = s.al;
    for (const ps of s.pl) {
      const p = this.byId.get(ps.id);
      if (!p) continue;
      const local = ps.id === localId;
      const teleported = ps.tp !== p.tp;
      p.tp = ps.tp;
      p.tx = ps.x;
      p.tz = ps.z;
      if (teleported) {
        p.x = ps.x;
        p.z = ps.z;
      }
      if (!local) {
        p.facing = ps.f;
        p.mode = ps.m;
        p.moving = !!ps.mv;
      }
      p.hidden = ps.h ? this.level.hideSpots.find((h) => h.id === ps.h) || null : null;
      p.poseTimer = ps.po;
      p.freezeTimer = ps.fr;
      p.emote = ps.e;
      p.emoteTimer = ps.et;
      p.shhCooldown = ps.sc;
      p.bubbleTimer = ps.b;
      p.shhUses = ps.su;
      p.out = !!ps.o;
      p.catchMeter = ps.cm;
      p.noise = ps.n;
      p.snacks = ps.s;
      p.busted = ps.bu;
    }
    s.sl.forEach((x, i) => {
      const sl = this.sleepers[i];
      if (!sl) return;
      sl.wake = x.w;
      sl.stage = x.st;
      sl.calmFlash = x.cf;
      sl.state = x.s;
      sl.x = x.x;
      sl.z = x.z;
      sl.heading = x.h;
      sl.stun = x.sn;
    });
    s.pa.forEach((x, i) => {
      const c = this.patrollers[i];
      if (!c) return;
      c.x = x.x;
      c.z = x.z;
      c.heading = x.hd;
      c.state = x.st;
      c.detect = x.d;
      c.sees = !!x.se;
      c.target = x.tg;
      c.watching = x.st === 'patrol' || x.st === 'alert';
    });
    this.snacks.forEach((sn, i) => {
      sn.taken = s.sn[i] === '1';
    });
    s.dr.forEach((v, i) => {
      if (this.doors[i]) this.doors[i].open = v;
    });
    s.ty.forEach((v, i) => {
      if (this.toys[i]) this.toys[i].squash = v;
    });
  }

  // ----------------------------------------------------------------- HUD
  hud(localId) {
    const L = this.level;
    const p = this.byId.get(localId) || this.players[0];
    let loudest = this.sleepers[0] || null;
    for (const s of this.sleepers) if (s.wake > loudest.wake) loudest = s;
    const stash = L.stashId ? this.snacks.find((s) => s.id === L.stashId) : null;
    const need = Math.max(0, L.snacksRequired - this.collected);
    const ready = need === 0 && (!stash || stash.taken);
    const spot = p.hidden || p.out ? null : this.nearestHideSpot(p);
    const spotter = this.patrollers.find((c) => c.sees && c.target === p.id && c.detect > 25);
    const hiders = this.players.filter((x) => x.role === 'hider');
    const chasers = this.sleepers.filter((x) => x.state === 'chasing' && x.stun <= 0);
    const crying = this.sleepers.find((x) => x.state === 'crying');

    let objective;
    if (this.mode === 'heist') {
      if (need > 0) objective = `Grab ${need} more snack${need === 1 ? '' : 's'}${stash && !stash.taken ? ` and ${stash.name.toLowerCase()}` : ''}`;
      else if (stash && !stash.taken) objective = `Now grab ${stash.name.toLowerCase()}!`;
      else objective = this.players.length > 1 ? `Everyone back to ${L.exitName}!` : `Sneak back to ${L.exitName}`;
    } else if (this.mode === 'race') {
      objective = this.phase === 'countdown' ? 'Get ready…' : `Race to ${L.raceGoalName || 'the fridge'}. Wake someone and you go back to the start!`;
    } else if (p.out) {
      objective = 'You were found. Watch the others!';
    } else if (this.phase === 'hiding') {
      objective = p.role === 'guard' ? 'Counting to ten… no peeking!' : 'Hide! The Night Guard is counting.';
    } else {
      const left = hiders.filter((h) => !h.out).length;
      objective = p.role === 'guard' ? `Find them! ${left} still hiding. Press F to search a hiding spot.` : 'Stay hidden until the timer runs out';
    }

    let prompt = null;
    if (p.role === 'guard') {
      if (this.phase === 'seeking' && this.nearestHideSpot(p)) prompt = 'Press F: search here';
    } else if (p.hidden) prompt = 'Press F to slip out';
    else if (spot) prompt = `Press F: ${spot.label}`;

    return {
      mode: this.mode,
      phase: this.phase,
      phaseTimer: this.phaseTimer,
      role: p.role,
      out: p.out,
      time: this.time,
      snacks: this.collected,
      totalSnacks: this.snacks.length,
      required: L.snacksRequired,
      ready,
      objective,
      noise: Math.round(p.noise),
      moveMode: p.hidden ? 'hidden' : p.moving ? p.mode : 'still',
      shhCooldown: p.shhCooldown,
      shhMax: T.shh.cooldown,
      bubble: p.bubbleTimer > 0,
      catchMeter: p.catchMeter,
      wake: loudest ? { name: loudest.name, value: Math.round(loudest.wake), stage: loudest.stage } : null,
      prompt,
      spotted: spotter ? spotter.name : null,
      chase: chasers.length ? chasers.map((x) => x.name) : null,
      crying: crying ? crying.name : null,
      players: this.players.map((x) => ({ id: x.id, name: x.name, out: x.out, role: x.role, snacks: x.snacks, busted: x.busted, local: x.id === p.id })),
    };
  }
}
