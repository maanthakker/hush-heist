// Every sound and every note of music in Hush Heist is made right here with the
// Web Audio API: no audio files, nothing copied. Sounds near you are louder,
// and panned left/right by where they happen on screen.

const A_MINOR_PENTA = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
const CHORDS = [
  [110, 220, 261.63, 329.63], // Am
  [87.31, 174.61, 220, 261.63], // F
  [130.81, 196, 261.63, 329.63], // C
  [98, 196, 246.94, 293.66], // G
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.settings = { music: 0.5, sfx: 0.8, muted: false };
    this.mode = 'off';
    this.intensity = 0;
    this.listener = { x: 0, z: 0 };
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.lastPlayed = new Map();
  }

  // Browsers only allow sound after a tap or key press.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(c.destination);
      this.musicBus = c.createGain();
      this.musicFilter = c.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 1800;
      this.musicBus.connect(this.musicFilter).connect(this.master);
      this.sfxBus = c.createGain();
      this.sfxBus.connect(this.master);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applySettings();
      this.setMusic(this.mode, true);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSettings(s) {
    this.settings = { ...this.settings, ...s };
    this.applySettings();
  }

  applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.settings;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music * 0.55, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
  }

  // ------------------------------------------------------------------ voices
  out(x, z, vol) {
    const c = this.ctx;
    const g = c.createGain();
    let gain = vol;
    let pan = 0;
    if (x !== undefined && z !== undefined) {
      const dx = x - this.listener.x;
      const d = Math.hypot(dx, z - this.listener.z);
      gain *= clamp(1.15 - d / 22, 0.08, 1);
      pan = clamp(dx / 12, -0.85, 0.85);
    }
    g.gain.value = gain;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    return g;
  }

  tone(dest, freq, when, dur, { type = 'sine', vol = 0.3, slide = null, attack = 0.005, vibrato = 0, filter = null } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (slide) {
      for (const [f, at] of slide) o.frequency.linearRampToValueAtTime(f, when + at * dur);
    }
    if (vibrato) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = vibrato;
      lg.gain.value = freq * 0.04;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(when);
      lfo.stop(when + dur + 0.05);
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    let node = o;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.value = filter.freq;
      f.Q.value = filter.q || 1;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(dest);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  noise(dest, when, dur, { vol = 0.3, freq = 1000, q = 1, type = 'bandpass', attack = 0.01, sweep = null } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, when);
    if (sweep) f.frequency.linearRampToValueAtTime(sweep, when + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(when, Math.random() * 0.5);
    src.stop(when + dur + 0.05);
  }

  /** Play a named sound. pos = {x, z} for sounds that happen in the house. */
  play(name, pos = {}, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name) || 0;
    if (now - last < 0.035) return; // don't stack identical sounds
    this.lastPlayed.set(name, now);
    const d = this.out(pos.x, pos.z, vol);
    const t = now + 0.01;
    switch (name) {
      case 'step-walk':
        this.noise(d, t, 0.09, { vol: 0.12, freq: 700, q: 0.8, type: 'lowpass' });
        break;
      case 'step-run':
        this.noise(d, t, 0.12, { vol: 0.22, freq: 900, q: 0.8, type: 'lowpass' });
        this.tone(d, 90, t, 0.12, { vol: 0.2 });
        break;
      case 'creak':
        this.tone(d, 210, t, 0.42, { type: 'sawtooth', vol: 0.14, slide: [[150, 1]], vibrato: 23, filter: { freq: 900, q: 6, type: 'bandpass' } });
        break;
      case 'squeak':
        this.tone(d, 900, t, 0.2, { type: 'square', vol: 0.12, slide: [[1500, 0.4], [1100, 1]], filter: { freq: 2200 } });
        break;
      case 'door':
        this.tone(d, 140, t, 0.7, { type: 'sawtooth', vol: 0.13, slide: [[95, 0.6], [120, 1]], vibrato: 17, filter: { freq: 700, q: 5, type: 'bandpass' } });
        break;
      case 'meow':
        this.tone(d, 560, t, 0.5, { type: 'triangle', vol: 0.3, slide: [[880, 0.3], [480, 1]], filter: { freq: 1400, q: 3, type: 'bandpass' } });
        break;
      case 'beep':
        this.tone(d, 1250, t, 0.09, { type: 'square', vol: 0.12 });
        this.tone(d, 1250, t + 0.16, 0.09, { type: 'square', vol: 0.12 });
        this.tone(d, 1650, t + 0.32, 0.14, { type: 'square', vol: 0.12 });
        break;
      case 'huh':
        this.tone(d, 170, t, 0.45, { type: 'sawtooth', vol: 0.22, slide: [[300, 0.5], [260, 1]], filter: { freq: 900, q: 4, type: 'bandpass' } });
        break;
      case 'hey':
        this.tone(d, 220, t, 0.35, { type: 'sawtooth', vol: 0.25, slide: [[330, 0.4], [280, 1]], filter: { freq: 1100, q: 4, type: 'bandpass' } });
        this.tone(d, 70, t, 0.4, { vol: 0.3 });
        break;
      case 'cry':
        this.tone(d, 620, t, 0.7, { type: 'triangle', vol: 0.18, slide: [[880, 0.3], [700, 1]], vibrato: 9, filter: { freq: 1800, q: 2, type: 'bandpass' } });
        break;
      case 'yawn':
        this.tone(d, 260, t, 0.9, { type: 'sawtooth', vol: 0.1, slide: [[340, 0.3], [150, 1]], filter: { freq: 700, q: 3 } });
        break;
      case 'grumble':
        this.tone(d, 110, t, 0.8, { type: 'sawtooth', vol: 0.15, slide: [[85, 1]], vibrato: 7, filter: { freq: 500, q: 3 } });
        break;
      case 'hushed':
        this.noise(d, t, 0.25, { vol: 0.06, freq: 4200, q: 2 });
        break;
      case 'shh':
        this.noise(d, t, 1.0, { vol: 0.32, freq: 3200, q: 1.5, attack: 0.18, sweep: 4800 });
        this.tone(d, 523.25, t + 0.15, 0.9, { vol: 0.05, attack: 0.3 });
        this.tone(d, 783.99, t + 0.25, 0.9, { vol: 0.04, attack: 0.3 });
        break;
      case 'snack':
        [880, 1174.66, 1567.98].forEach((f, i) => this.tone(d, f, t + i * 0.06, 0.25, { type: 'triangle', vol: 0.12 }));
        break;
      case 'stash':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(d, f, t + i * 0.07, 0.4, { type: 'triangle', vol: 0.14 }));
        this.noise(d, t + 0.3, 0.6, { vol: 0.05, freq: 7000, q: 1, type: 'highpass' });
        break;
      case 'hide':
        this.noise(d, t, 0.3, { vol: 0.12, freq: 600, q: 1, sweep: 250 });
        break;
      case 'unhide':
        this.noise(d, t, 0.25, { vol: 0.1, freq: 250, q: 1, sweep: 700 });
        break;
      case 'eye':
        this.tone(d, 73.4, t, 1.4, { type: 'sawtooth', vol: 0.12, attack: 0.5, filter: { freq: 300 } });
        this.tone(d, 77.8, t, 1.4, { type: 'sawtooth', vol: 0.1, attack: 0.5, filter: { freq: 300 } });
        break;
      case 'caught':
        this.tone(d, 660, t, 0.5, { type: 'square', vol: 0.12, slide: [[220, 1]], filter: { freq: 1600 } });
        break;
      case 'busted':
        this.tone(d, 300, t, 0.4, { type: 'triangle', vol: 0.22, slide: [[620, 0.3], [180, 1]] });
        break;
      case 'search':
        this.noise(d, t, 0.35, { vol: 0.12, freq: 1200, q: 2, sweep: 600 });
        break;
      case 'emote':
        this.tone(d, 660, t, 0.12, { type: 'triangle', vol: 0.1 });
        this.tone(d, 990, t + 0.07, 0.12, { type: 'triangle', vol: 0.08 });
        break;
      case 'tick':
        this.tone(d, 880, t, 0.1, { type: 'square', vol: 0.08, filter: { freq: 2000 } });
        break;
      case 'go':
        this.tone(d, 1320, t, 0.35, { type: 'square', vol: 0.1, filter: { freq: 2600 } });
        break;
      case 'ui':
        this.tone(d, 1046.5, t, 0.06, { type: 'triangle', vol: 0.06 });
        break;
      case 'coin':
        this.tone(d, 1567.98, t, 0.1, { type: 'square', vol: 0.06, filter: { freq: 3000 } });
        this.tone(d, 2093, t + 0.08, 0.25, { type: 'square', vol: 0.06, filter: { freq: 3000 } });
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(d, f, t + i * 0.14, 0.5, { type: 'triangle', vol: 0.16 }));
        this.tone(d, 261.63, t + 0.56, 0.9, { type: 'sine', vol: 0.15 });
        break;
      case 'lose':
        [392, 349.23, 311.13, 261.63].forEach((f, i) => this.tone(d, f, t + i * 0.2, 0.5, { type: 'triangle', vol: 0.15 }));
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------- music
  // 'menu' = soft night lullaby, 'play' = the same with a heartbeat that grows
  // as people stir, 'off' = silence.
  setMusic(mode, force = false) {
    if (mode === this.mode && !force) return;
    this.mode = mode;
    if (!this.ctx) return;
    clearInterval(this.timer);
    this.timer = null;
    if (mode === 'off') return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  setIntensity(v) {
    this.intensity = clamp(v, 0, 1);
    if (this.ctx) this.musicFilter.frequency.setTargetAtTime(1400 + this.intensity * 2200, this.ctx.currentTime, 0.4);
  }

  setListener(x, z) {
    this.listener.x = x;
    this.listener.z = z;
  }

  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const bpm = this.mode === 'menu' ? 66 : 72 + this.intensity * 18;
    const eighth = 30 / bpm;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, eighth);
      this.nextTime += eighth;
      this.step += 1;
    }
  }

  playStep(step, t, eighth) {
    const bus = this.musicBus;
    const bar = Math.floor(step / 8) % CHORDS.length;
    const inBar = step % 8;
    const chord = CHORDS[bar];
    if (inBar === 0) {
      const len = eighth * 8;
      chord.forEach((f, i) => {
        this.tone(bus, f, t, len * 1.05, { type: 'triangle', vol: i === 0 ? 0.09 : 0.045, attack: len * 0.35, filter: { freq: 900 } });
        this.tone(bus, f * 1.004, t, len * 1.05, { type: 'sine', vol: 0.03, attack: len * 0.4 });
      });
    }
    // Sparse music-box plucks, different each bar but always in key.
    const seed = Math.sin(step * 12.9898) * 43758.5453;
    const r = seed - Math.floor(seed);
    const density = this.mode === 'menu' ? 0.32 : 0.26 - this.intensity * 0.1;
    if (r < density) {
      const note = A_MINOR_PENTA[Math.floor(r * 1000) % A_MINOR_PENTA.length] * 2;
      this.tone(bus, note, t, eighth * 3, { type: 'sine', vol: 0.06 });
      this.tone(bus, note * 2, t, eighth * 1.5, { type: 'sine', vol: 0.015 });
    }
    // Heartbeat when someone's stirring.
    if (this.mode === 'play' && this.intensity > 0.3 && (inBar === 0 || inBar === 4)) {
      const v = 0.12 + this.intensity * 0.25;
      this.tone(bus, 58, t, 0.16, { vol: v, slide: [[40, 1]] });
      this.tone(bus, 52, t + 0.19, 0.18, { vol: v * 0.8, slide: [[36, 1]] });
    }
  }
}

export const audio = new AudioEngine();
