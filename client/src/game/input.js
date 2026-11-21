// Keyboard input, plus a simple touch stick. Phase 6 polishes the touch controls.
const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  Space: 'tiptoe',
  KeyC: 'tiptoe',
};

import { EMOTES } from '@shared/catalog.js';

const EMOTE_KEYS = Object.fromEntries(EMOTES.map((e) => [`Digit${e.key}`, e.id]));
const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

export class Keyboard {
  constructor() {
    this.held = new Set();
    this.codes = new Set();
    this.pressed = { shh: false, interact: false, emote: null };
    this.touch = { mx: 0, mz: 0, tiptoe: false, run: false };
    this.pov = false;
    this.onDown = (e) => {
      if (isTyping(e.target)) return;
      const action = KEYMAP[e.code];
      this.codes.add(e.code);
      if (action) {
        this.held.add(action);
        if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      }
      if (!e.repeat) {
        if (e.code === 'KeyE') this.pressed.shh = true;
        if (e.code === 'KeyF') this.pressed.interact = true;
        if (EMOTE_KEYS[e.code]) this.pressed.emote = EMOTE_KEYS[e.code];
      }
    };
    this.onUp = (e) => {
      this.codes.delete(e.code);
      const action = KEYMAP[e.code];
      if (action) this.held.delete(action);
    };
    this.onBlur = () => {
      this.held.clear();
      this.codes.clear();
    };
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  // Direction from the on-screen stick (-1..1 each) and whether it's a gentle push.
  setTouchMove(mx, mz, tiptoe) {
    this.touch.mx = mx;
    this.touch.mz = mz;
    this.touch.tiptoe = tiptoe;
  }

  setTouchRun(run) {
    this.touch.run = run;
  }

  pressShh() {
    this.pressed.shh = true;
  }

  keyHeld(code) {
    return this.codes.has(code);
  }

  pressEmote(id) {
    this.pressed.emote = id;
  }

  pressInteract() {
    this.pressed.interact = true;
  }

  read() {
    const h = this.held;
    const t = this.touch;
    // In first person, the arrow keys turn and A/D side-step.
    const arrowsTurn = this.pov;
    const left = arrowsTurn ? this.keyHeld('KeyA') : h.has('left');
    const right = arrowsTurn ? this.keyHeld('KeyD') : h.has('right');
    const out = {
      turn: arrowsTurn ? (this.keyHeld('ArrowRight') ? 1 : 0) - (this.keyHeld('ArrowLeft') ? 1 : 0) : 0,
      mx: (right ? 1 : 0) - (left ? 1 : 0),
      mz: (h.has('down') ? 1 : 0) - (h.has('up') ? 1 : 0),
      run: h.has('run') || t.run,
      tiptoe: h.has('tiptoe'),
      shh: this.pressed.shh,
      interact: this.pressed.interact,
      emote: this.pressed.emote,
    };
    if (t.mx || t.mz) {
      out.mx = t.mx;
      out.mz = t.mz;
      out.tiptoe = out.tiptoe || t.tiptoe;
    }
    this.pressed.shh = false;
    this.pressed.interact = false;
    this.pressed.emote = null;
    return out;
  }

  reset() {
    this.held.clear();
    this.codes.clear();
    this.touch = { mx: 0, mz: 0, tiptoe: false, run: false };
    this.pressed.shh = false;
    this.pressed.interact = false;
    this.pressed.emote = null;
  }

  dispose() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
