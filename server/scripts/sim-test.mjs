// Headless checks for the rules engine and every level. Run: npm test (in /server)
import { Simulation } from '../shared/sim/Simulation.js';
import { LEVELS, LEVEL_BY_ID } from '../shared/levels/index.js';
import { TUNING } from '../shared/sim/tuning.js';
import { resolveCircle, inBox } from '../shared/sim/geometry2d.js';
import { coinsFor, didWin } from '../shared/catalog.js';

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures += 1;
};
const still = { mx: 0, mz: 0, run: false, tiptoe: false, shh: false, interact: false };
const step = (sim, input, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) sim.update(dt, input);
};
const r = TUNING.playerRadius;

function grid(level) {
  const colliders = [...level.walls, ...level.furniture];
  const free = (x, z) => {
    const res = resolveCircle(x, z, r, colliders);
    return Math.abs(res.x - x) < 1e-6 && Math.abs(res.z - z) < 1e-6;
  };
  const G = 0.25;
  const B = level.bounds;
  const W = Math.round((B.maxX - B.minX) / G);
  const H = Math.round((B.maxZ - B.minZ) / G);
  const idx = (i, j) => j * W + i;
  const cx = (i) => B.minX + (i + 0.5) * G;
  const cz = (j) => B.minZ + (j + 0.5) * G;
  const open = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) open[idx(i, j)] = free(cx(i), cz(j)) ? 1 : 0;
  function bfs(x, z) {
    const prev = new Int32Array(W * H).fill(-2);
    const s = idx(Math.floor((x - B.minX) / G), Math.floor((z - B.minZ) / G));
    const q = [s];
    prev[s] = -1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      const i = c % W;
      const j = (c / W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const n = idx(ni, nj);
        if (!open[n] || prev[n] !== -2) continue;
        if (di && dj && (!open[idx(i + di, j)] || !open[idx(i, j + dj)])) continue;
        prev[n] = c;
        q.push(n);
      }
    }
    return prev;
  }
  function pathTo(prev, x, z, within) {
    let best = -1;
    let bestD = within;
    for (let c = 0; c < W * H; c++) {
      if (prev[c] === -2) continue;
      const d = Math.hypot(cx(c % W) - x, cz((c / W) | 0) - z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best < 0) return null;
    const pts = [];
    for (let c = best; c !== -1; c = prev[c]) pts.push([cx(c % W), cz((c / W) | 0)]);
    return pts.reverse();
  }
  return { free, bfs, pathTo, colliders };
}

// 1. Every level: layout sanity and reachability ---------------------------------
for (const level of LEVELS) {
  const g = grid(level);
  const tag = level.name;
  const sim = new Simulation(level);
  check(sim.players.length === 1, `${tag}: builds`);
  const spawns = [0, 1, 2, 3].map((i) => sim.spawnPoint(i));
  check(spawns.every(([x, z]) => g.free(x, z)), `${tag}: all 4 spawn points are on open floor`);
  if (level.guardSpawn) check(g.free(...level.guardSpawn), `${tag}: guard spawn is on open floor`);
  check(spawns.every(([x, z]) => !inBox(x, z, level.exitZone) || level.id !== 'jungle-room'), `${tag}: spawns sensible`);
  for (const s of level.hideSpots) check(g.free(s.x, s.z), `${tag}: hide spot ${s.id} reachable spot is open`);
  for (const t of level.toys) check(g.free(t.x, t.z), `${tag}: toy ${t.id} on open floor`);
  for (const p of level.patrollers) {
    if (!p.path) continue;
    let ok = true;
    for (let i = 0; i < p.path.length; i++) {
      const [ax, az] = p.path[i];
      const [bx, bz] = p.path[(i + 1) % p.path.length];
      for (let k = 0; k <= 20; k++) {
        const x = ax + ((bx - ax) * k) / 20;
        const z = az + ((bz - az) * k) / 20;
        for (const b of g.colliders) if (x > b.minX - 0.3 && x < b.maxX + 0.3 && z > b.minZ - 0.3 && z < b.maxZ + 0.3) ok = false;
      }
    }
    check(ok, `${tag}: ${p.id} route avoids furniture and walls`);
  }
  const prev = g.bfs(...spawns[0]);
  for (const s of level.snacks) check(!!g.pathTo(prev, s.x, s.z, TUNING.pickupRadius - 0.1), `${tag}: snack ${s.id} reachable`);
  for (const s of level.hideSpots) check(!!g.pathTo(prev, s.x, s.z, 0.3), `${tag}: hide spot ${s.id} reachable from spawn`);
  const ez = level.exitZone;
  check(!!g.pathTo(prev, (ez.minX + ez.maxX) / 2, (ez.minZ + ez.maxZ) / 2, 2.5), `${tag}: exit reachable`);
  if (level.raceGoal) {
    const rg = level.raceGoal;
    check(!!g.pathTo(prev, (rg.minX + rg.maxX) / 2, (rg.minZ + rg.maxZ) / 2, 0.6), `${tag}: race goal reachable`);
  }

  // Tiptoe bot (informational except on level 1)
  const bot = new Simulation(level);
  const order = [...level.snacks];
  const route = [];
  let fx = spawns[0][0];
  let fz = spawns[0][1];
  while (order.length) {
    order.sort((a, b) => Math.hypot(a.x - fx, a.z - fz) - Math.hypot(b.x - fx, b.z - fz));
    const s = order.shift();
    route.push(...g.pathTo(g.bfs(fx, fz), s.x, s.z, 0.6));
    fx = s.x;
    fz = s.z;
  }
  route.push(...g.pathTo(g.bfs(fx, fz), (ez.minX + ez.maxX) / 2, (ez.minZ + ez.maxZ) / 2, 2.5));
  let k = 0;
  let t = 0;
  while (!bot.outcome && t < 600 && k < route.length) {
    const [tx, tz] = route[k];
    const dx = tx - bot.player.x;
    const dz = tz - bot.player.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.2) {
      k += 1;
      continue;
    }
    const loud = bot.sleepers.some((s) => s.wake > 55);
    bot.update(1 / 60, { mx: dx / d, mz: dz / d, tiptoe: true, shh: loud });
    t += 1 / 60;
  }
  const msg = `${tag}: tiptoe bot heist → ${bot.outcome?.result ?? 'timeout'} in ${t.toFixed(0)}s (${bot.alarms} alarms, peak wake ${Math.round(bot.peakWake)})`;
  if (level.id === 'jungle-room') check(bot.outcome?.result === 'escaped', msg);
  else console.log(`INFO  ${msg}`);
}

// 2. Core rules -------------------------------------------------------------------
const J = LEVEL_BY_ID['jungle-room'];
{
  const sim = new Simulation(J);
  const dad = sim.sleepers.find((s) => s.id === 'dad');
  sim.player.x = -1.5;
  sim.player.z = -3.2;
  step(sim, { ...still, mx: 1, run: true }, 0.6);
  step(sim, { ...still, mx: -1, run: true }, 0.6);
  check(dad.wake > 10, `running past Dad raises his wake meter (${dad.wake.toFixed(1)})`);
  const before = dad.wake;
  sim.update(1 / 60, { ...still, shh: true });
  check(dad.wake <= Math.max(0, before - 40), 'the Shh calms Dad');
  sim.update(1 / 60, { ...still, shh: true });
  check(sim.player.shhUses === 1, 'the Shh has a cooldown');
}
{
  const sim = new Simulation(J);
  for (const s of sim.snacks.slice(0, 4)) {
    sim.player.x = s.x;
    sim.player.z = s.z;
    sim.update(1 / 60, still);
  }
  sim.player.x = -15;
  sim.player.z = -10;
  sim.update(1 / 60, still);
  check(sim.outcome?.result === 'escaped', 'solo heist: 4 snacks + bed wins');
  check(didWin(sim.outcome, sim.player.id) && coinsFor(sim.outcome, sim.player.id) >= 40, `coins awarded (${coinsFor(sim.outcome, sim.player.id)})`);
}
{
  const sim = new Simulation(J);
  sim.update(1 / 60, { ...still, emote: 'wave' });
  check(sim.player.emote === 'wave', 'emotes play');
  step(sim, { ...still, mx: 1 }, 0.2);
  check(sim.player.emote === null, 'moving cancels an emote');
}

// 3. Co-op: everyone must reach the exit -------------------------------------------
{
  const sim = new Simulation(J, { players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
  for (const s of sim.snacks.slice(0, 4)) {
    const a = sim.byId.get('a');
    a.x = s.x;
    a.z = s.z;
    sim.update(1 / 60, {});
  }
  const a = sim.byId.get('a');
  a.x = -15;
  a.z = -10;
  sim.update(1 / 60, {});
  check(!sim.outcome, 'co-op: not won until every player is back');
  const b = sim.byId.get('b');
  b.x = -15.5;
  b.z = -11;
  sim.update(1 / 60, {});
  check(sim.outcome?.result === 'escaped', 'co-op: wins when the whole squad is back');
}
{
  const K = LEVEL_BY_ID.kitchen;
  const sim = new Simulation(K);
  for (const s of sim.snacks.filter((x) => x.kind !== 'stash').slice(0, 4)) {
    sim.player.x = s.x;
    sim.player.z = s.z;
    sim.update(1 / 60, still);
  }
  sim.player.x = -14.5;
  sim.player.z = 8;
  sim.update(1 / 60, still);
  check(!sim.outcome, 'kitchen: the fridge stash is required');
  const st = sim.snacks.find((x) => x.id === 'stash');
  sim.player.x = st.x;
  sim.player.z = st.z;
  sim.update(1 / 60, still);
  sim.player.x = -14.5;
  sim.player.z = 8;
  sim.update(1 / 60, still);
  check(sim.outcome?.result === 'escaped', 'kitchen: stash + 4 snacks + hallway wins');
}

// 4. Fridge Race -------------------------------------------------------------------------
{
  const K = LEVEL_BY_ID.kitchen;
  const sim = new Simulation(K, { mode: 'race', players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
  const a = sim.byId.get('a');
  step(sim, { a: { ...still, mx: 1 } }, 1);
  check(Math.abs(a.x - a.sx) < 0.01, 'race: nobody moves during the countdown');
  step(sim, {}, 2.2);
  check(sim.phase === 'play', 'race: countdown ends');
  const mom = sim.sleepers[0];
  const b = sim.byId.get('b');
  b.x = mom.x - 1.5;
  b.z = mom.z - 1.5;
  sim.emitNoise(mom.x, mom.z, 5, 500, 'squeak', 'b');
  a.x = 0;
  step(sim, {}, 3);
  check(b.busted === 1 && !sim.outcome, 'race: the family member you woke chases you down and sends you back');
  a.x = 8;
  a.z = -9;
  sim.update(1 / 60, {});
  check(sim.outcome?.winnerId === 'a' && didWin(sim.outcome, 'a') && !didWin(sim.outcome, 'b'), 'race: first to the fridge wins');
}

// 5. Hide & Seek ------------------------------------------------------------------------
{
  const sim = new Simulation(J, { mode: 'hideseek', guardId: 'g', players: [{ id: 'g', name: 'Guard' }, { id: 'h1', name: 'H1' }, { id: 'h2', name: 'H2' }] });
  const g = sim.byId.get('g');
  const h1 = sim.byId.get('h1');
  const h2 = sim.byId.get('h2');
  const gx = g.x;
  step(sim, { g: { ...still, mx: 1 } }, 2);
  check(g.x === gx, 'hide & seek: the guard is frozen while counting');
  h1.x = -1.5;
  h1.z = 3.2;
  sim.update(1 / 60, { h1: { ...still, interact: true } });
  check(!!h1.hidden, 'hide & seek: hider hides');
  step(sim, {}, 11);
  check(sim.phase === 'seeking', 'hide & seek: seeking starts');
  g.x = -1.5;
  g.z = 3.6;
  sim.update(1 / 60, { g: { ...still, interact: true } });
  check(h1.out, 'hide & seek: guard searches the coffee table and finds the hider');
  h2.x = 6;
  h2.z = 6;
  g.x = 6;
  g.z = 3;
  g.facing = 0;
  step(sim, {}, 1);
  check(h2.out && sim.outcome?.result === 'guard', 'hide & seek: spotted in the flashlight, guard wins');
}
{
  const sim = new Simulation(J, { mode: 'hideseek', guardId: 'g', players: [{ id: 'g', name: 'Guard' }, { id: 'h1', name: 'H1' }] });
  const h1 = sim.byId.get('h1');
  h1.x = 8;
  h1.z = -12.5;
  sim.update(1 / 60, { h1: { ...still, interact: true } });
  step(sim, {}, 12 + 91, 1 / 20);
  check(sim.outcome?.result === 'hiders', 'hide & seek: hiders win when time runs out');
}

// 5b. Chases ------------------------------------------------------------------------
{
  const sim = new Simulation(J);
  const dad = sim.sleepers.find((s) => s.id === 'dad');
  sim.player.x = -1.5;
  sim.player.z = -3.2;
  sim.emitNoise(dad.x, dad.z, 4, 500, 'squeak', sim.player.id);
  sim.update(1 / 60, still);
  check(dad.state === 'chasing' && !sim.outcome, 'waking Dad makes him get up and chase (not an instant loss)');
  step(sim, still, 4);
  check(sim.outcome?.result === 'caught' && sim.outcome.by === 'Dad', 'standing still, Dad catches you');
}
{
  const sim = new Simulation(J);
  const dad = sim.sleepers.find((s) => s.id === 'dad');
  sim.player.x = 1.0;
  sim.player.z = 4.2;
  sim.emitNoise(dad.x, dad.z, 4, 500, 'squeak', sim.player.id);
  step(sim, still, 0.2);
  sim.player.x = -1.5;
  sim.player.z = 3.2;
  sim.update(1 / 60, { ...still, interact: true });
  step(sim, still, 20, 1 / 30);
  check(!sim.outcome && dad.state === 'asleep', `hiding makes Dad lose you, search, and go back to sleep (${dad.state})`);
}
{
  const sim = new Simulation(J);
  sim.player.x = -15;
  sim.player.z = -8;
  const baby = sim.sleepers.find((s) => s.id === 'baby');
  sim.emitNoise(baby.x, baby.z, 3, 500, 'squeak', sim.player.id);
  sim.update(1 / 60, still);
  const others = sim.sleepers.filter((s) => s !== baby);
  check(baby.state === 'crying' && others.every((s) => s.state === 'chasing'), 'the Baby waking up wakes everyone else, and they all chase you');
  const bx = baby.x;
  step(sim, still, 1);
  check(baby.x === bx, 'the Baby stays in the crib crying');
  sim.player.x = 14;
  sim.player.z = -8;
  sim.player.shhCooldown = 0;
  sim.update(1 / 60, { ...still, shh: true });
  check(baby.state === 'asleep', 'the Shh calms the crying Baby');
}
{
  const sim = new Simulation(J);
  const dad = sim.sleepers.find((s) => s.id === 'dad');
  sim.player.x = 5;
  sim.player.z = -5;
  sim.emitNoise(dad.x, dad.z, 4, 500, 'squeak', sim.player.id);
  step(sim, still, 0.9);
  sim.player.shhCooldown = 0;
  sim.update(1 / 60, { ...still, shh: true });
  check(dad.stun > 2, 'the Shh stops a chaser in their tracks for a moment');
}
{
  const sim = new Simulation(J, { players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
  const dad = sim.sleepers.find((s) => s.id === 'dad');
  const a = sim.byId.get('a');
  a.x = -1.5;
  a.z = -3.0;
  sim.byId.get('b').x = -18;
  sim.byId.get('b').z = 12;
  sim.emitNoise(dad.x, dad.z, 4, 500, 'squeak', 'a');
  step(sim, {}, 3);
  check(a.out && !sim.outcome, 'co-op: a caught player is out, the heist goes on for the others');
}

// 6. Grandpa's eye -------------------------------------------------------------------
{
  const A = LEVEL_BY_ID.attic;
  const sim = new Simulation(A);
  const eye = sim.patrollers.find((c) => c.type === 'eye');
  const gp = sim.sleepers[0];
  sim.player.x = 0.6;
  sim.player.z = -2.5;
  let opened = false;
  for (let t = 0; t < 20 && !sim.outcome; t += 1 / 30) {
    sim.update(1 / 30, still);
    if (eye.open) opened = true;
  }
  check(opened, 'attic: Grandpa’s eye opens');
  check(sim.alarms >= 2 || sim.outcome?.result === 'caught', `attic: standing in his gaze wakes Grandpa (${Math.round(gp.wake)})`);
}

// 7. Network snapshot round trip --------------------------------------------------
{
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const server = new Simulation(J, { players, seed: 3 });
  const client = new Simulation(J, { players, seed: 3 });
  step(server, { a: { ...still, mx: 1 }, b: { ...still, mz: 1 } }, 1);
  server.update(1 / 60, { b: { ...still, interact: true } });
  const snap = JSON.parse(JSON.stringify(server.snapshot()));
  client.applySnapshot(snap, 'a');
  const sb = client.byId.get('b');
  check(sb.tx === Math.round(server.byId.get('b').x * 100) / 100, 'snapshot: remote player target position arrives');
  check(client.sleepers[0].wake === Math.round(server.sleepers[0].wake * 100) / 100, 'snapshot: wake meters sync');
  const before = server.byId.get('a').x;
  server.update(0.05, { a: { mx: 0, mz: 0, moving: true, pos: { x: before + 0.15, z: server.byId.get('a').z, facing: 1 }, tp: server.byId.get('a').tp } });
  check(Math.abs(server.byId.get('a').x - (before + 0.15)) < 0.01, 'server accepts a reported position');
  server.update(0.05, { a: { pos: { x: before + 30, z: server.byId.get('a').z }, moving: true, tp: server.byId.get('a').tp } });
  check(server.byId.get('a').x < before + 5, 'server refuses a teleporting position report');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
