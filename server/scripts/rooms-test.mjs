// Party room checks with fake sockets (no network, no database).
import { RoomManager } from '../src/game/rooms.js';

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures += 1;
};
const sent = [];
const io = { to: (code) => ({ emit: (evt, data) => sent.push({ code, evt, data }) }) };
const friends = { host: ['pal', 'pal2', 'pal3'], pal: ['host'], pal2: ['host'] };
const rm = new RoomManager(io, {
  getUser: async (id) => ({ friends: friends[id] || [] }),
  award: async () => 25,
});
function fakeSocket(id, name) {
  const handlers = {};
  return {
    id: `s-${id}`,
    data: { user: id ? { id, name, look: { outfit: 'classic', hair: 'black' } } : null },
    on: (evt, fn) => (handlers[evt] = fn),
    join() {},
    leave() {},
    fire: (evt, ...args) => new Promise((resolve) => {
      const r = handlers[evt](...args, resolve);
      if (r && r.then) r.then(() => setTimeout(resolve, 0));
      if (!['room:create', 'room:join', 'room:start'].includes(evt)) setTimeout(resolve, 5);
    }),
  };
}
const host = fakeSocket('host', 'Host');
const pal = fakeSocket('pal', 'Pal');
const pal2 = fakeSocket('pal2', 'Pal2');
const stranger = fakeSocket('stranger', 'Stranger');
const guest = fakeSocket(null, null);
[host, pal, pal2, stranger, guest].forEach((s) => rm.attach(s));

const g = await guest.fire('room:create', { mode: 'heist' });
check(!g.ok, 'guests cannot make parties');
const made = await host.fire('room:create', { mode: 'heist', level: 'kitchen' });
check(made.ok && /^[A-HJ-NP-Z]{6}$/.test(made.room.code), `party created with code ${made.room.code}`);
const code = made.room.code;
const s1 = await stranger.fire('room:join', code);
check(!s1.ok && /friends/.test(s1.error), 'non-friends cannot join');
const bad = await pal.fire('room:join', 'ZZZZZZ');
check(!bad.ok, 'wrong code is refused');
const p1 = await pal.fire('room:join', code.toLowerCase());
check(p1.ok && p1.room.members.length === 2, 'a friend joins with the code (any case)');
// Voice: only between friends
const p2 = await pal2.fire('room:join', code);
check(p2.ok, 'a second friend of the host joins');
const sockSent = [];
const realTo = io.to;
io.to = (target) => ({ emit: (evt, data) => { sockSent.push({ target, evt, data }); realTo(target).emit(evt, data); } });
host.emit = (evt, data) => sockSent.push({ target: host.id, evt, data });
pal.emit = (evt, data) => sockSent.push({ target: pal.id, evt, data });
pal2.emit = (evt, data) => sockSent.push({ target: pal2.id, evt, data });
host.to = () => ({ emit() {} });
await host.fire('voice:ready');
await pal.fire('voice:ready');
await pal2.fire('voice:ready');
const palPeers = sockSent.find((m) => m.target === pal.id && m.evt === 'voice:peers');
check(palPeers && palPeers.data.peers.join() === 'host', 'voice: Pal only connects to the host (Pal and Pal2 aren’t friends)');
sockSent.length = 0;
await pal.fire('voice:signal', { to: 'pal2', data: { sdp: 'x' } });
check(!sockSent.some((m) => m.evt === 'voice:signal'), 'voice: no voice link between players who aren’t friends');
await pal.fire('voice:signal', { to: 'host', data: { sdp: 'x' } });
check(sockSent.some((m) => m.evt === 'voice:signal' && m.target === host.id && m.data.from === 'pal'), 'voice: friends can connect');
await pal2.fire('voice:leave');
check(!rm.rooms.get(code).voice.has('pal2'), 'voice: leaving voice works');
await pal2.fire('room:leave');
io.to = realTo;

await pal.fire('room:config', { mode: 'race' });
check(rm.rooms.get(code).mode === 'heist', 'only the host can change settings');
await host.fire('room:config', { mode: 'hideseek', level: 'garage', guardId: 'pal' });
check(rm.rooms.get(code).mode === 'hideseek' && rm.rooms.get(code).guardId === 'pal', 'host picks Hide & Seek and the guard');
const st = await host.fire('room:start');
check(st.ok && rm.rooms.get(code).state === 'playing', 'host starts the round');
check(sent.some((m) => m.evt === 'game:start' && m.data.guardId === 'pal'), 'game:start goes out with the guard');
await pal.fire('input', { mx: 1, mz: 0, emote: 'wave', shh: true });
await pal.fire('quick', 2);
await pal.fire('quick', 99);
check(sent.filter((m) => m.evt === 'quick').length === 1, 'quick chat only sends preset lines');
await new Promise((r) => setTimeout(r, 220));
check(sent.some((m) => m.evt === 'game:snap'), 'snapshots stream while playing');
const room = rm.rooms.get(code);
room.sim.finish({ result: 'guard', guardId: 'pal' });
await new Promise((r) => setTimeout(r, 120));
const end = sent.find((m) => m.evt === 'game:end');
check(end && end.data.coins.host === 25 && room.state === 'lobby', 'round ends, coins are handed out, back to the lobby');
await host.fire('disconnect');
check(rm.rooms.get(code)?.hostId === 'pal', 'when the host leaves, the next player becomes host');
await pal.fire('disconnect');
check(!rm.rooms.has(code), 'empty parties are closed');
console.log(failures ? `\n${failures} check(s) failed` : '\nAll room checks passed');
process.exit(failures ? 1 : 0);
