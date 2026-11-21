import * as THREE from 'three';
import { Simulation } from '@shared/sim/Simulation.js';
import { JUNGLE_ROOM, LEVEL_BY_ID } from '@shared/levels/index.js';
import { QUICK_CHAT, didWin } from '@shared/catalog.js';
import { World } from './render/World.js';
import { Keyboard } from './input.js';
import { clearMaterialCache } from './render/kit.js';
import { disposeTextCache } from './render/textures.js';
import { audio } from '../audio/AudioEngine.js';
import { buzz } from '../settings.js';

const STAGE_TEXT = { asleep: 'asleep', stirring: 'stirring', waking: 'waking up!', awake: 'awake!', chasing: 'chasing you!', crying: 'crying!' };

/**
 * Glue between React and the game: renderer, camera, loop, input, labels.
 * Solo: runs the Simulation here. Party: the server runs it; this predicts the
 * local player, sends inputs (net.send), and draws the server's snapshots.
 */
export class Game {
  constructor(host, { onHud, onEnd } = {}) {
    this.host = host;
    this.onHud = onHud;
    this.onEnd = onEnd;
    this.level = JUNGLE_ROOM;
    this.localId = 'p1';
    this.sim = new Simulation(this.level);
    this.world = new World(this.level);
    this.net = null;
    this.netEvents = [];
    this.pending = {};

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.className = 'game-canvas';
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.camera.position.set(0, 24, 26);
    this.camLook = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.tmp = new THREE.Vector3();

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'world-labels';
    this.labelLayer.style.display = 'none';
    host.appendChild(this.labelLayer);
    this.buildLabels();

    this.input = new Keyboard();
    this.settings = { quality: 'high', reduceMotion: false, vibration: true };
    this.quality = 'high';
    this.lastCount = null;
    this.view = 'top';
    this.yaw = 0;
    this.bob = 0;
    this.onMouseMove = (e) => {
      if (document.pointerLockElement === this.renderer.domElement) this.turnBy(-e.movementX * 0.0026);
      else if (this.dragging && e.pointerType === 'mouse') this.turnBy(-(e.movementX || 0) * 0.005);
    };
    this.onCanvasDown = (e) => {
      if (!this.isPov() || e.pointerType !== 'mouse') return;
      this.dragging = true;
      if (this.renderer.domElement.requestPointerLock && !document.pointerLockElement) {
        try {
          const r = this.renderer.domElement.requestPointerLock();
          if (r && r.catch) r.catch(() => {});
        } catch {
          /* drag to look instead */
        }
      }
    };
    this.onCanvasUp = () => {
      this.dragging = false;
    };
    this.renderer.domElement.addEventListener('pointerdown', this.onCanvasDown);
    window.addEventListener('pointerup', this.onCanvasUp);
    window.addEventListener('pointermove', this.onMouseMove);
    audio.setMusic('menu');
    this.phase = 'title'; // title | play | paused | outro | ended
    this.orbit = 0.6;
    this.hudTimer = 0;
    this.sendTimer = 0;
    this.outroTimer = 0;
    this.width = 1;
    this.height = 1;

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(host);
    this.resize();
    this.clock = new THREE.Clock();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------ public API
  setLevel(level) {
    if (!level || level === this.level) return;
    this.world.dispose();
    this.level = level;
    this.world = new World(level);
    this.setQuality(this.quality);
  }

  // Phase 6 settings: sound levels, graphics quality, reduced motion, vibration.
  applySettings(s) {
    this.settings = { ...this.settings, ...s };
    this.setView(s.camera);
    audio.setSettings({ music: s.music, sfx: s.sfx, muted: s.muted });
    this.setQuality(s.quality);
  }

  // First-person (POV) or angled top-down camera.
  setView(view) {
    const pov = view === 'pov';
    if (pov && this.view !== 'pov') {
      const me = this.sim.byId.get(this.localId) || this.sim.player;
      this.yaw = me.facing;
    }
    this.view = pov ? 'pov' : 'top';
    if (!pov && document.pointerLockElement === this.renderer.domElement) document.exitPointerLock?.();
  }

  isPov() {
    return this.view === 'pov' && (this.phase === 'play' || this.phase === 'paused');
  }

  turnBy(rad) {
    if (this.isPov() && this.phase === 'play') this.yaw += rad;
  }

  // Turn screen-relative input into world directions when looking through your own eyes.
  viewInput(input, dt) {
    if (!this.isPov()) return input;
    if (input.turn) this.yaw -= input.turn * 2.4 * dt;
    const fwd = -(input.mz || 0);
    const side = input.mx || 0;
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    return { ...input, mx: sy * fwd - cy * side, mz: cy * fwd + sy * side };
  }

  setQuality(q) {
    this.quality = q === 'low' ? 'low' : 'high';
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(this.quality === 'low' ? Math.min(dpr, 1.25) : Math.min(dpr, 2));
    if (this.world.moon) this.world.moon.castShadow = this.quality === 'high';
    this.resize();
  }

  // Show a level behind the menus.
  showLevel(levelId) {
    if (this.phase !== 'title' || !LEVEL_BY_ID[levelId] || LEVEL_BY_ID[levelId] === this.level) return;
    this.setLevel(LEVEL_BY_ID[levelId] || this.level);
    this.sim = new Simulation(this.level);
    this.world.setPlayers(this.sim.players);
  }

  startRun({ levelId, level = null, mode = 'heist', players, localId, guardId, seed, net = null }) {
    this.setLevel(level || LEVEL_BY_ID[levelId] || JUNGLE_ROOM);
    this.sim = new Simulation(this.level, { mode, players, guardId, seed: seed ?? Date.now() % 100000 });
    this.localId = localId || this.sim.players[0].id;
    this.world.setPlayers(this.sim.players);
    this.world.resetForRun();
    this.net = net;
    this.netEvents = [];
    this.pending = {};
    this.input.reset();
    this.phase = 'play';
    this.hudTimer = 0;
    this.lastCount = null;
    this.yaw = this.sim.byId.get(this.localId)?.facing ?? this.level.start.facing;
    audio.setMusic('play');
    this.buildLabels();
    this.labelLayer.style.display = '';
    this.clock.getDelta();
  }

  // Party play: server messages.
  applySnapshot(snap) {
    if (this.net && this.phase !== 'title') this.sim.applySnapshot(snap, this.localId);
  }

  applyEvents(list) {
    if (this.net && this.phase !== 'title') this.netEvents.push(...list);
  }

  endFromServer(outcome, coins) {
    if (!this.net || this.phase === 'title') return;
    this.sim.outcome = outcome;
    this.serverCoins = coins;
    this.beginOutro();
  }

  setTalking(playerId, on) {
    const L = this.labels.players.find((x) => x.id === playerId);
    if (L) L.el.classList.toggle('is-talking', on);
  }

  showQuick(playerId, index) {
    const L = this.labels.players.find((x) => x.id === playerId);
    if (!L || !QUICK_CHAT[index]) return;
    L.bubble.textContent = QUICK_CHAT[index];
    L.bubble.hidden = false;
    clearTimeout(L.timer);
    L.timer = setTimeout(() => {
      L.bubble.hidden = true;
    }, 3000);
  }

  setPaused(paused) {
    if (this.net) return; // party rounds keep going
    if (paused && this.phase === 'play') {
      this.phase = 'paused';
      this.input.reset();
    } else if (!paused && this.phase === 'paused') {
      this.phase = 'play';
      this.clock.getDelta();
    }
  }

  toTitle() {
    this.net = null;
    this.sim = new Simulation(this.level);
    this.world.setPlayers(this.sim.players);
    this.world.resetForRun();
    this.input.reset();
    this.phase = 'title';
    audio.setMusic('menu');
    audio.setIntensity(0);
    this.labelLayer.style.display = 'none';
  }

  triggerShh() {
    if (this.phase === 'play') this.input.pressShh();
  }

  triggerInteract() {
    if (this.phase === 'play') this.input.pressInteract();
  }

  triggerEmote(id) {
    if (this.phase === 'play') this.input.pressEmote(id);
  }

  setTouchMove(mx, mz, tiptoe) {
    this.input.setTouchMove(mx, mz, tiptoe);
  }

  setTouchRun(run) {
    this.input.setTouchRun(run);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onCanvasDown);
    window.removeEventListener('pointerup', this.onCanvasUp);
    window.removeEventListener('pointermove', this.onMouseMove);
    this.input.dispose();
    this.world.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelLayer.remove();
    clearMaterialCache();
    disposeTextCache();
  }

  // ------------------------------------------------------------------- loop
  frame() {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.clock.getDelta());
    const sim = this.sim;

    if (this.phase === 'title') {
      sim.updateAttract(dt);
      if (!this.settings.reduceMotion) this.orbit += dt * 0.05;
    } else if (this.phase === 'play' && !this.net) {
      sim.update(dt, this.viewInput(this.input.read(), dt));
      if (this.isPov()) sim.player.facing = this.yaw;
      if (sim.outcome) this.beginOutro();
    } else if (this.phase === 'play' && this.net) {
      this.netStep(dt);
    } else if (this.phase === 'outro') {
      if (this.net) this.netStep(dt, true);
      this.outroTimer -= dt;
      if (this.outroTimer <= 0) {
        this.phase = 'ended';
        this.onEnd?.({ ...sim.outcome, localId: this.localId, serverCoins: this.serverCoins ?? null });
      }
    }

    this.input.pov = this.isPov();
    this.world.pov = this.isPov();
    if (this.phase !== 'paused') {
      const events = this.net ? this.netEvents.splice(0) : sim.events.splice(0);
      for (const e of events) {
        this.world.handleEvent(e, sim);
        if (this.phase !== 'title') this.soundFor(e, sim);
      }
      this.world.sync(sim, dt, this.localId);
      if (this.phase === 'play') this.updateMood(sim);
    }

    this.updateCamera(dt);
    if (this.phase !== 'title') this.updateLabels();
    this.renderer.render(this.world.scene, this.camera);

    if (this.phase === 'play') {
      this.hudTimer -= dt;
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.1;
        this.onHud?.(sim.hud(this.localId));
      }
    }
  }

  // Party play: move our own hero right away, tell the server, smooth the others.
  netStep(dt, frozen = false) {
    const sim = this.sim;
    const input = frozen ? { mx: 0, mz: 0 } : this.viewInput(this.input.read(), dt);
    const me = sim.byId.get(this.localId);
    if (me) {
      if (!me.hidden && sim.phase !== 'countdown' && !frozen) sim.movePlayer(me, input, dt);
      else me.moving = false;
      if (this.isPov()) me.facing = this.yaw;
    }
    if (input.shh) this.pending.shh = true;
    if (input.interact) this.pending.interact = true;
    if (input.emote) this.pending.emote = input.emote;
    this.sendTimer -= dt;
    const edge = this.pending.shh || this.pending.interact || this.pending.emote;
    if (me && !frozen && (this.sendTimer <= 0 || edge)) {
      this.sendTimer = 0.05;
      this.net.send({
        mx: input.mx || 0,
        mz: input.mz || 0,
        run: !!input.run,
        tiptoe: !!input.tiptoe,
        moving: me.moving,
        pos: { x: me.x, z: me.z, facing: me.facing },
        tp: me.tp,
        ...this.pending,
      });
      this.pending = {};
    }
    const k = Math.min(1, dt * 12);
    for (const p of sim.players) {
      if (p.id === this.localId) continue;
      p.x += (p.tx - p.x) * k;
      p.z += (p.tz - p.z) * k;
    }
    for (const c of sim.patrollers) c.watching = c.state === 'patrol' || c.state === 'alert';
  }

  // Sounds for things that happen in the house, placed where they happen.
  soundFor(e, sim) {
    const me = this.localId;
    const at = (id) => sim.byId.get(id) || {};
    switch (e.type) {
      case 'noise':
        if (e.muted) {
          if (e.kind !== 'step') audio.play('hushed', e);
        } else if (e.kind === 'step') audio.play(e.radius > 6 ? 'step-run' : 'step-walk', e, 0.8);
        else if (['creak', 'squeak', 'door', 'meow', 'beep', 'cry'].includes(e.kind)) audio.play(e.kind, e);
        break;
      case 'shh':
        audio.play('shh', e);
        if (e.id === me) buzz(this.settings, 20);
        break;
      case 'snack':
        audio.play(e.stash ? 'stash' : 'snack', e);
        break;
      case 'alarm':
        if (e.kind === 'huh') audio.play('huh', e);
        if (e.target === me) buzz(this.settings, [80, 40, 80]);
        break;
      case 'hide':
      case 'unhide':
        audio.play(e.type, at(e.id));
        break;
      case 'caught':
        audio.play('caught', at(e.id));
        if (e.id === me) buzz(this.settings, 250);
        break;
      case 'busted':
        audio.play('busted', at(e.id));
        if (e.id === me) buzz(this.settings, 150);
        break;
      case 'grumble': {
        const s = sim.sleepers.find((x) => x.id === e.id);
        audio.play('grumble', s || {});
        break;
      }
      case 'search':
        audio.play('search', at(e.id));
        break;
      case 'eye-open': {
        const c = sim.patrollers.find((x) => x.id === e.id);
        audio.play('eye', c || {});
        break;
      }
      case 'emote':
        audio.play('emote', at(e.id), 0.7);
        break;
      case 'wake': {
        const s = sim.sleepers.find((x) => x.id === e.id);
        audio.play('hey', s || {});
        buzz(this.settings, [60, 40, 60]);
        break;
      }
      case 'grabbed':
        audio.play('caught', at(e.id));
        if (e.id === me) buzz(this.settings, 300);
        break;
      case 'back-to-bed': {
        const s = sim.sleepers.find((x) => x.id === e.id);
        audio.play('yawn', s || {});
        break;
      }
      case 'stunned':
      case 'hush-baby': {
        const s = sim.sleepers.find((x) => x.id === e.id);
        audio.play('hushed', s || {}, 2);
        break;
      }
      case 'go':
      case 'seek':
        audio.play('go');
        break;
      default:
        break;
    }
  }

  // Music follows the danger: the louder the house gets, the faster the heartbeat.
  updateMood(sim) {
    const me = sim.byId.get(this.localId) || sim.player;
    audio.setListener(me.x, me.z);
    let danger = 0;
    for (const s of sim.sleepers) danger = Math.max(danger, s.wake / 100);
    for (const c of sim.patrollers) if (c.target === this.localId) danger = Math.max(danger, (c.detect / 100) * 0.8);
    // Thumping footsteps of whoever is chasing you.
    this.chaseSteps = (this.chaseSteps || 0) - (1 / 60);
    for (const s of sim.sleepers) {
      if (s.state === 'chasing' || s.state === 'crying') danger = 1;
    }
    if (this.chaseSteps <= 0) {
      this.chaseSteps = 0.38;
      for (const s of sim.sleepers) if (s.state === 'chasing' && s.stun <= 0) audio.play('step-run', s, 1.2);
    }
    audio.setIntensity(danger);
    if (sim.phase === 'countdown' || sim.phase === 'hiding') {
      const n = Math.ceil(sim.phaseTimer);
      if (n !== this.lastCount && n <= 3 && n > 0) audio.play('tick');
      this.lastCount = n;
    }
  }

  beginOutro() {
    const o = this.sim.outcome;
    this.phase = 'outro';
    this.outroTimer = o.mode === 'heist' && o.result === 'escaped' ? 2.4 : 2.0;
    this.world.victory = didWin(o, this.localId);
    audio.play(this.world.victory ? 'win' : 'lose');
    if (!this.world.victory) buzz(this.settings, [120, 60, 220]);
    audio.setIntensity(0);
    audio.setMusic('menu');
    this.onHud?.(this.sim.hud(this.localId));
  }

  // ----------------------------------------------------------------- camera
  updateCamera(dt) {
    const sim = this.sim;
    const p = sim.byId.get(this.localId) || sim.player;
    this.camera.fov = this.isPov() ? 70 : 42;
    this.camera.updateProjectionMatrix();
    const portrait = this.width / this.height < 1;
    const zoom = portrait ? 1.45 : 1;
    let rate = 5;
    if (this.phase === 'title') {
      const B = this.level.bounds;
      const r = Math.max(B.maxX - B.minX, B.maxZ - B.minZ) * 0.66;
      this.camPos.set(Math.sin(this.orbit) * r, r * 0.88, Math.cos(this.orbit) * r * 0.8 + 3);
      this.camTarget.set(0, 0, 0);
      rate = 1.5;
    } else if (this.phase === 'outro' || this.phase === 'ended') {
      const o = sim.outcome;
      let focus = p;
      if (o?.mode === 'heist' && o.result === 'caught') focus = sim.sleepers.find((x) => x.id === o.byId) || p;
      if (o?.mode === 'race' && o.winnerId) focus = sim.byId.get(o.winnerId) || p;
      if (focus.wake !== undefined) {
        this.camPos.set(focus.x, 7.5, focus.z + 7.5);
        this.camTarget.set(focus.x, 0.6, focus.z);
      } else {
        this.camPos.set(focus.x, 4.2, focus.z + 5.4);
        this.camTarget.set(focus.x, 1.1, focus.z);
      }
      rate = 2.2;
    } else if (this.isPov()) {
      // Through the hero's eyes: low and crouched when tiptoeing, gentle head bob.
      if (p.moving && !this.settings.reduceMotion) this.bob += dt * (p.mode === 'run' ? 13 : p.mode === 'tiptoe' ? 6 : 9);
      const eye = (p.mode === 'tiptoe' ? 1.22 : 1.42) + (this.settings.reduceMotion ? 0 : Math.sin(this.bob) * 0.04 * (p.moving ? 1 : 0));
      const peek = p.hidden && p.hidden.peek;
      const ex = peek ? peek[0] : p.x;
      const ez = peek ? peek[2] : p.z;
      const ey = peek ? peek[1] + 0.05 : eye;
      this.camPos.set(ex, ey, ez);
      this.camTarget.set(ex + Math.sin(this.yaw) * 4, ey - 0.75, ez + Math.cos(this.yaw) * 4);
      this.camera.position.copy(this.camPos);
      this.camLook.lerp(this.camTarget, 1 - Math.exp(-dt * 25));
      this.camera.lookAt(this.camLook);
      return;
    } else {
      this.camPos.set(p.x, 15.5 * zoom, p.z + 10.5 * zoom);
      this.camTarget.set(p.x, 0, p.z - 0.6);
    }
    const k = this.settings.reduceMotion && this.phase !== 'title' ? 1 - Math.exp(-dt * rate * 3) : 1 - Math.exp(-dt * rate);
    this.camera.position.lerp(this.camPos, k);
    this.camLook.lerp(this.camTarget, k);
    this.camera.lookAt(this.camLook);
  }

  resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------- floating labels over the 3D world
  buildLabels() {
    this.labelLayer.replaceChildren();
    const make = (cls) => {
      const el = document.createElement('div');
      el.className = `wl ${cls}`;
      this.labelLayer.appendChild(el);
      return el;
    };
    const sleepers = this.sim.sleepers.map((s) => {
      const el = make('wl-sleeper');
      const name = document.createElement('span');
      name.className = 'wl-name';
      name.textContent = s.name;
      const bar = document.createElement('span');
      bar.className = 'wl-bar';
      const fill = document.createElement('i');
      bar.appendChild(fill);
      el.append(name, bar);
      return { el, fill, last: -1, stage: '' };
    });
    const patrollers = this.sim.patrollers.map(() => ({ el: make('wl-patroller'), last: '' }));
    const players = this.sim.players.map((pl) => {
      const el = make('wl-hero');
      const bubble = document.createElement('span');
      bubble.className = 'wl-bubble';
      bubble.hidden = true;
      const name = document.createElement('span');
      name.className = 'wl-player-name';
      el.append(bubble, name);
      return { id: pl.id, el, bubble, name, last: '' };
    });
    this.labels = { sleepers, patrollers, players };
  }

  place(el, x, y, z) {
    const v = this.tmp.set(x, y, z).project(this.camera);
    const visible = v.z < 1 && v.x > -1.2 && v.x < 1.2 && v.y > -1.2 && v.y < 1.2;
    el.style.visibility = visible ? 'visible' : 'hidden';
    if (!visible) return;
    const sx = (v.x * 0.5 + 0.5) * this.width;
    const sy = (-v.y * 0.5 + 0.5) * this.height;
    el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }

  updateLabels() {
    const sim = this.sim;
    this.labels.sleepers.forEach((L, i) => {
      const s = sim.sleepers[i];
      if (!s) return;
      const upright = s.state && s.state !== 'asleep' && s.state !== 'crying';
      this.place(L.el, s.x, upright ? 2.5 * s.scale + 0.4 : s.y + 1.3 * s.scale + 0.5, s.z);
      const pct = Math.round(s.wake);
      if (pct !== L.last) {
        L.fill.style.width = `${pct}%`;
        L.last = pct;
      }
      const stage = s.state === 'asleep' ? s.stage : s.state === 'crying' ? 'crying' : 'chasing';
      if (stage !== L.stage) {
        L.el.dataset.stage = stage;
        L.el.title = `${s.name} is ${STAGE_TEXT[stage] || stage}`;
        L.stage = stage;
      }
    });
    this.labels.patrollers.forEach((L, i) => {
      const c = sim.patrollers[i];
      if (!c) return;
      this.place(L.el, c.x, c.type === 'cat' ? 1.2 : c.type === 'eye' ? 1.7 : 0.9, c.z);
      let mark = '';
      if (c.state === 'alert') mark = '!';
      else if (c.detect > 3) mark = '?';
      else if (c.type !== 'eye' && (c.state === 'nap' || c.state === 'calmed')) mark = 'zz';
      if (mark !== L.last) {
        L.el.textContent = mark;
        L.el.dataset.mark = mark === '!' ? 'alert' : mark === '?' ? 'suspicious' : mark ? 'nap' : 'none';
        L.last = mark;
      }
      if (mark === '?') L.el.style.setProperty('--fill', `${Math.round(c.detect)}%`);
    });
    this.labels.players.forEach((L) => {
      const p = sim.byId.get(L.id);
      if (!p) return;
      const tag = `${p.name}${p.role === 'guard' ? ' · Night Guard' : ''}${p.out ? ' (found)' : ''}`;
      if (tag !== L.last) {
        L.name.textContent = tag;
        L.el.classList.toggle('is-local', p.id === this.localId);
        L.el.classList.toggle('is-out', p.out);
        L.last = tag;
      }
      L.el.style.display = p.hidden && p.id !== this.localId ? 'none' : '';
      const y = p.hidden ? (p.hidden.peek ? p.hidden.peek[1] + 0.6 : 1.4) : 2.25;
      const x = p.hidden && p.hidden.peek ? p.hidden.peek[0] : p.x;
      const z = p.hidden && p.hidden.peek ? p.hidden.peek[2] : p.z;
      this.place(L.el, x, y, z);
    });
  }
}
