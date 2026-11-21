import { io } from 'socket.io-client';
import { API_URL } from './config.js';

// One socket per logged-in session, used for party rooms.
export function connectParty(token, handlers) {
  const socket = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'], reconnectionAttempts: 5 });
  for (const [evt, fn] of Object.entries(handlers)) socket.on(evt, fn);
  const ask = (evt, ...args) =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'Hush HQ didn’t answer. Try again.' }), 10000);
      socket.emit(evt, ...args, (res) => {
        clearTimeout(timer);
        resolve(res || { ok: false });
      });
    });
  return {
    socket,
    create: (opts) => ask('room:create', opts),
    join: (code) => ask('room:join', code),
    start: () => ask('room:start'),
    config: (cfg) => socket.emit('room:config', cfg),
    leave: () => socket.emit('room:leave'),
    quick: (index) => socket.emit('quick', index),
    send: (input) => socket.volatile.emit('input', input),
    close: () => socket.close(),
  };
}
