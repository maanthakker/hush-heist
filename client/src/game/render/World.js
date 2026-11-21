import * as THREE from 'three';
import { TUNING } from '@shared/sim/tuning.js';
import { buildFurniture, snackModel, toyModel } from './props.js';
import { box, center, cyl, disposeTree, group, ico, mat, mesh } from './kit.js';
import { floorTexture, moonPool, radialGlow, wallTexture, woodFloor } from './textures.js';
import { HeroModel } from './hero.js';
import { CatView, SleeperView, VacuumView } from './characters.js';
import { Effects } from './effects.js';

const NOISE_COLORS = {
  step: '#9fb2ff',
  creak: '#ffcf5a',
  squeak: '#ff8fc2',
  door: '#ffb35a',
  meow: '#ff6f6f',
  beep: '#ff6f6f',
};
const NOISE_WORDS = { squeak: 'SQUEAK!', door: 'creeeak', meow: 'MEOW!', beep: 'BEEP BEEP!' };
NOISE_COLORS.cry = '#ff8fc2';
NOISE_COLORS.huh = '#ffcf5a';
const ALERT = new THREE.Color('#ff5a5a');
const CONE_COLORS = { cat: '#d9f56b', vacuum: '#cfe8ff', mower: '#fff0a0', eye: '#ffcf8a', guard: '#fff4c2' };

function approachAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

/** Builds the three.js scene for a level and mirrors the simulation into it. */
export class World {
  constructor(level) {
    this.level = level;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(level.theme?.sky || '#151938');
    this.textures = [];
    this.time = 0;
    this.victory = false;

    this.buildLights();
    this.buildRoom();
    this.buildWindows();
    this.buildChandelier();
    for (const f of level.furniture) this.scene.add(buildFurniture(f));
    this.mobile = this.scene.getObjectByName('mobile');
    this.buildDoors();
    this.buildCreaks();
    this.buildCurtains();
    this.buildPickups();
    this.buildExit();
    this.buildCharacters();
    this.buildCones();
    this.heroes = new Map();
    this.peeks = [];
    this.bubbles = [];
    this.setPlayers([{ id: 'p1', look: null }]);
    this.effects = new Effects(this.scene);
    this.zzz = level.sleepers.map((_, i) => 0.4 + i * 0.5);
    this.facing = new Map();
  }

  // One hero model per player, each wearing their own outfit and hair color.
  setPlayers(players) {
    for (const h of this.heroes.values()) {
      this.scene.remove(h.root);
      h.dispose();
    }
    this.heroes.clear();
    for (const p of players) {
      const hero = new HeroModel(p.look || undefined);
      this.scene.add(hero.root);
      this.heroes.set(p.id, hero);
    }
    while (this.peeks.length < players.length) this.peeks.push(this.buildPeekEyes());
    while (this.bubbles.length < players.length) this.bubbles.push(this.buildBubble());
    this.facing = new Map();
  }

  track(tex) {
    this.textures.push(tex);
    return tex;
  }

  // ------------------------------------------------------------- building
  buildLights() {
    this.scene.add(new THREE.HemisphereLight('#8193d8', '#2b2142', 1.15));
    const moon = new THREE.DirectionalLight('#b4c4ff', 1.5);
    moon.position.set(-8, 24, 10);
    moon.target.position.set(0, 0, 0);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const cam = moon.shadow.camera;
    cam.left = -27;
    cam.right = 27;
    cam.top = 24;
    cam.bottom = -24;
    cam.near = 1;
    cam.far = 70;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.03;
    this.scene.add(moon, moon.target);
    this.moon = moon;

    this.playerLight = new THREE.PointLight('#e3e9ff', 10, 8, 2);
    this.playerLight.position.set(0, 2.6, 0);
    this.scene.add(this.playerLight);

    const nl = this.level.nightlight;
    if (nl) {
      const light = new THREE.PointLight('#ffb46a', 8, 7.5, 2);
      light.position.set(nl.x, 0.8, nl.z + 0.3);
      this.scene.add(light);
      this.scene.add(mesh(ico(0.12, 1), mat('#ffd59a', { emissive: '#ffb050', emissiveIntensity: 2 }), nl.x, 0.6, nl.z + 0.1, { cast: false }));
    }
  }

  buildRoom() {
    const L = this.level;
    const B = L.bounds;
    const w = B.maxX - B.minX;
    const d = B.maxZ - B.minZ;

    const floorTex = this.track(floorTexture(L.theme?.floor));
    floorTex.repeat.set(w / 4, d / 4);
    const floor = mesh(new THREE.PlaneGeometry(w + 0.8, d + 0.8), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }), (B.minX + B.maxX) / 2, 0, (B.minZ + B.maxZ) / 2, { rx: -Math.PI / 2, cast: false });
    this.scene.add(floor);

    for (const r of L.rugs || []) {
      const geo = r.round ? new THREE.CylinderGeometry(r.r, r.r, 0.02, 28) : box(r.w, 0.02, r.d);
      this.scene.add(mesh(geo, mat(r.color, { roughness: 1 }), r.x, 0.01, r.z, { cast: false }));
    }

    const paper = this.track(wallTexture(L.theme?.wall));
    const top = mat('#3a2a22');
    this.fadeWalls = [];
    for (const wall of L.walls) {
      const c = center(wall);
      const h = wall.h;
      const fade = !!wall.fadeable;
      const tx = this.track(paper.clone());
      tx.repeat.set(c.d / 2.6, h / 2.6);
      tx.needsUpdate = true;
      const tz = this.track(paper.clone());
      tz.repeat.set(c.w / 2.6, h / 2.6);
      tz.needsUpdate = true;
      const mx = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.95, transparent: fade });
      const mz = new THREE.MeshStandardMaterial({ map: tz, roughness: 0.95, transparent: fade });
      const mt = fade ? new THREE.MeshStandardMaterial({ color: '#3a2a22', transparent: true }) : top;
      const m = new THREE.Mesh(box(c.w, h, c.d), [mx, mx, mt, mt, mz, mz]);
      m.position.set(c.x, h / 2, c.z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      if (fade) this.fadeWalls.push({ wall, mats: [mx, mz, mt], opacity: 1 });
    }
  }

  buildWindows() {
    const L = this.level;
    const wallZ = L.bounds.minZ;
    const frame = mat('#d8d2c4');
    const glass = new THREE.MeshBasicMaterial({ color: '#7f9be0' });
    const fabric = mat('#8c806d');
    const fold = mat('#9a8e7a');
    const pool = this.track(moonPool());
    const poolMat = new THREE.MeshBasicMaterial({ map: pool, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const win of L.windows || []) {
      const g = group(win.x, 0, wallZ);
      g.add(mesh(box(win.w + 0.24, 1.95, 0.08), frame, 0, 1.55, 0.04));
      g.add(mesh(new THREE.PlaneGeometry(win.w, 1.75), glass, 0, 1.52, 0.09, { cast: false, receive: false }));
      g.add(mesh(box(0.05, 1.75, 0.04), frame, 0, 1.52, 0.11));
      g.add(mesh(box(win.w, 0.05, 0.04), frame, 0, 1.3, 0.11));
      // Roman blind, half raised: flat panel on top, soft folds stacked at its hem.
      g.add(mesh(box(win.w + 0.14, 0.38, 0.04), fabric, 0, 2.28, 0.15));
      for (let i = 0; i < 3; i++) g.add(mesh(box(win.w + 0.18, 0.12, 0.1 + i * 0.03), fold, 0, 2.03 - i * 0.1, 0.17 + i * 0.015));
      g.add(mesh(box(win.w + 0.2, 0.04, 0.06), mat('#6e6352'), 0, 1.75, 0.2));
      g.add(mesh(new THREE.PlaneGeometry(win.w * 1.5, 5), poolMat, 0, 0.02, 2.5, { rx: -Math.PI / 2, cast: false, receive: false }));
      this.scene.add(g);
    }
  }

  buildChandelier() {
    const c = this.level.chandelier;
    if (!c) return;
    const g = group(c.x, 3.25, c.z);
    const metal = new THREE.MeshStandardMaterial({ color: '#e7e0cf', metalness: 0.65, roughness: 0.3, emissive: '#5a4a2a', emissiveIntensity: 0.35 });
    const rings = [
      [1.55, 0.05, 0.35, 0],
      [1.15, 0.045, -0.3, 0.8],
      [0.8, 0.04, 0.5, 1.9],
    ];
    for (const [r, t, tilt, spin] of rings) {
      const holder = group();
      holder.rotation.y = spin;
      holder.add(mesh(new THREE.TorusGeometry(r, t, 6, 48), metal, 0, 0, 0, { rx: Math.PI / 2 + tilt, cast: false }));
      g.add(holder);
    }
    const wire = mat('#bdb6a6');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      g.add(mesh(cyl(0.008, 0.008, 3, 3), wire, Math.cos(a) * 1.1, 1.5, Math.sin(a) * 1.1, { cast: false }));
    }
    this.chandelier = g;
    this.scene.add(g);
  }

  buildDoors() {
    const trim = mat('#3a2a22');
    const wood = mat('#6b4630');
    const knob = mat('#d8c08a', { metalness: 0.6, roughness: 0.4 });
    this.doorViews = this.level.doors.map((d) => {
      const hinge = group(d.x, 0, d.z - d.width / 2);
      hinge.add(mesh(box(0.08, 2.15, d.width - 0.06), wood, 0, 1.075, d.width / 2));
      hinge.add(mesh(ico(0.05, 0), knob, 0.07, 1.0, d.width - 0.25));
      hinge.add(mesh(ico(0.05, 0), knob, -0.07, 1.0, d.width - 0.25));
      this.scene.add(hinge);
      this.scene.add(mesh(box(0.4, 0.25, d.width), trim, d.x, 2.275, d.z));
      return hinge;
    });
  }

  buildCreaks() {
    const tex = this.track(woodFloor({ light: true }));
    tex.repeat.set(0.4, 0.4);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const c of this.level.creaks) {
      const { x, z, w, d } = center(c);
      this.scene.add(mesh(new THREE.PlaneGeometry(w, d), m, x, 0.012, z, { rx: -Math.PI / 2, cast: false }));
    }
  }

  buildCurtains() {
    this.curtainViews = new Map();
    const velvet = mat('#24493d');
    const rod = mat('#d8c08a', { metalness: 0.6, roughness: 0.4 });
    for (const s of this.level.hideSpots) {
      if (s.type !== 'curtain') continue;
      const g = group(s.hideX, 0, this.level.bounds.minZ + 0.25);
      for (let i = 0; i < 5; i++) g.add(mesh(cyl(0.1, 0.12, 2.75, 6), velvet, -0.4 + i * 0.2, 1.4, 0));
      g.add(mesh(cyl(0.025, 0.025, 1.3, 6), rod, 0, 2.8, 0, { rz: Math.PI / 2 }));
      this.scene.add(g);
      this.curtainViews.set(s.id, g);
    }
  }

  buildPickups() {
    const glow = this.track(radialGlow('rgba(255,214,120,0.9)', 'rgba(255,214,120,0)'));
    const haloMat = new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
    const haloGeo = new THREE.PlaneGeometry(1.6, 1.6);
    this.snackViews = this.level.snacks.map((s) => {
      const g = group(s.x, 0, s.z);
      const model = snackModel(s.kind);
      model.position.y = 0.55;
      model.scale.setScalar(1.25);
      g.add(model);
      g.add(mesh(haloGeo, haloMat, 0, 0.03, 0, { rx: -Math.PI / 2, cast: false, receive: false }));
      this.scene.add(g);
      return { g, model };
    });
    this.toyViews = this.level.toys.map((t) => {
      const m = toyModel(t.kind);
      m.position.set(t.x, 0, t.z);
      m.rotation.y = t.x * 1.7;
      this.scene.add(m);
      return m;
    });
  }

  buildExit() {
    const { x, z, w, d } = center(this.level.exitZone);
    this.exitMat = new THREE.MeshBasicMaterial({
      map: this.track(radialGlow('rgba(127,227,198,1)', 'rgba(127,227,198,0)')),
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.scene.add(mesh(new THREE.PlaneGeometry(w + 2, d + 2), this.exitMat, x, 0.03, z, { rx: -Math.PI / 2, cast: false, receive: false }));
    const bed = this.level.furniture.find((f) => f.type === 'bed');
    const spot = bed ? center(bed) : { x, z };
    this.exitBeacon = mesh(new THREE.TorusGeometry(0.45, 0.07, 6, 28), new THREE.MeshBasicMaterial({ color: '#7fe3c6' }), spot.x, 1.8, spot.z, { rx: Math.PI / 2, cast: false });
    this.exitBeacon.visible = false;
    this.scene.add(this.exitBeacon);
  }

  buildCharacters() {
    this.sleeperViews = this.level.sleepers.map((s) => {
      const v = new SleeperView(s);
      this.scene.add(v.root, v.pillow);
      return v;
    });
    this.patrolViews = this.level.patrollers.map((p) => {
      if (p.type === 'eye') return null;
      const v = p.type === 'cat' ? new CatView() : new VacuumView({ mower: p.type === 'mower' });
      this.scene.add(v.root);
      return v;
    });
  }

  buildCones() {
    this.cones = this.level.patrollers.map((p) => {
      const rays = 22;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array((rays + 2) * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const index = [];
      for (let i = 0; i < rays; i++) index.push(0, i + 1, i + 2);
      geo.setIndex(index);
      const color = new THREE.Color(CONE_COLORS[p.type] || '#cfe8ff');
      const material = new THREE.MeshBasicMaterial({ color: color.clone(), transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, material);
      m.frustumCulled = false;
      m.renderOrder = 1;
      this.scene.add(m);
      return { mesh: m, geo, pos, rays, material, base: color };
    });
    this.guardCone = this.makeCone(CONE_COLORS.guard);
  }

  makeCone(hex) {
    const rays = 22;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((rays + 2) * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const index = [];
    for (let i = 0; i < rays; i++) index.push(0, i + 1, i + 2);
    geo.setIndex(index);
    const color = new THREE.Color(hex);
    const material = new THREE.MeshBasicMaterial({ color: color.clone(), transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, material);
    m.frustumCulled = false;
    m.renderOrder = 1;
    m.visible = false;
    this.scene.add(m);
    return { mesh: m, geo, pos, rays, material, base: color };
  }

  buildPeekEyes() {
    const peek = group();
    const white = mat('#ffffff', { emissive: '#777777', emissiveIntensity: 0.6 });
    const pupil = mat('#121214');
    for (const s of [-1, 1]) {
      peek.add(mesh(ico(0.075, 1), white, s * 0.09, 0, 0, { cast: false }));
      peek.add(mesh(ico(0.038, 0), pupil, s * 0.09 + 0.025, 0, 0.06, { cast: false }));
    }
    peek.visible = false;
    this.scene.add(peek);
    return peek;
  }

  buildBubble() {
    const material = new THREE.MeshBasicMaterial({ color: '#7fe3c6', transparent: true, opacity: 0.12, depthWrite: false });
    const bubble = mesh(new THREE.CircleGeometry(1, 48), material, 0, 0.04, 0, { rx: -Math.PI / 2, cast: false, receive: false });
    bubble.scale.setScalar(TUNING.shh.bubbleRadius);
    bubble.visible = false;
    this.scene.add(bubble);
    return bubble;
  }

  // ---------------------------------------------------------------- runtime
  resetForRun() {
    this.effects.clear();
    this.victory = false;
    this.pov = false;
    this.facing = new Map();
    this.sleeperViews.forEach((v) => v.reset());
    this.peeks.forEach((p) => (p.visible = false));
    for (const g of this.curtainViews.values()) g.scale.z = 1;
  }

  handleEvent(e, sim) {
    switch (e.type) {
      case 'noise': {
        if (e.muted) {
          this.effects.ring(e.x, e.z, 1.2, '#7fe3c6', { duration: 0.5, opacity: 0.5 });
          if (e.kind !== 'step') this.effects.text('hushed', e.x, 1.6, e.z, '#7fe3c6', { size: 0.8 });
          break;
        }
        const color = NOISE_COLORS[e.kind] || '#ffffff';
        const loud = e.kind !== 'step';
        this.effects.ring(e.x, e.z, e.radius, color, { duration: loud ? 0.9 : 0.6, opacity: loud ? 0.75 : 0.22 });
        const word = e.kind === 'creak' ? this.level.creakWord || 'creak' : NOISE_WORDS[e.kind];
        if (word) this.effects.text(word, e.x, 1.8, e.z, color, { size: e.kind === 'creak' ? 0.9 : 1.2 });
        break;
      }
      case 'caught': {
        const p = sim.byId.get(e.id);
        if (p) this.effects.text('FOUND!', p.x, 2.2, p.z, '#ff6f6f', { size: 1.3, duration: 1.4 });
        break;
      }
      case 'busted': {
        const p = sim.byId.get(e.id);
        if (p) this.effects.text('back to start!', p.x, 2.2, p.z, '#ffcf5a', { size: 1.0, duration: 1.4 });
        break;
      }
      case 'grumble': {
        const s = sim.sleepers.find((x) => x.id === e.id);
        if (s) this.effects.text('mmph… zzz', s.x, 1.6, s.z, '#ffcf5a', { size: 1.0, duration: 1.6 });
        break;
      }
      case 'search': {
        const p = sim.byId.get(e.id);
        if (p) this.effects.text('searching…', p.x, 2.2, p.z, '#fff4c2', { size: 0.9 });
        break;
      }
      case 'wake': {
        const s = sim.sleepers.find((x) => x.id === e.id);
        if (s) this.effects.text(e.byBaby ? 'WHAT?!' : 'HEY!', s.x, 2.6, s.z, '#ff6f6f', { size: 1.5, duration: 1.4 });
        break;
      }
      case 'cry': {
        const s = sim.sleepers.find((x) => x.id === e.id);
        if (s) this.effects.text('WAAAH!', s.x, 2.0, s.z, '#ff8fc2', { size: 1.6, duration: 1.6 });
        break;
      }
      case 'grabbed': {
        const p = sim.byId.get(e.id);
        if (p) this.effects.text('GOTCHA!', p.x, 2.4, p.z, '#ff6f6f', { size: 1.5, duration: 1.4 });
        break;
      }
      case 'searching': {
        const s = sim.sleepers.find((x) => x.id === e.id);
        if (s) this.effects.text('where’d they go?', s.x, 2.6, s.z, '#ffcf5a', { size: 0.9, duration: 1.8 });
        break;
      }
      case 'back-to-bed': {
        const s = sim.sleepers.find((x) => x.id === e.id);
        if (s) this.effects.text('*yawn* … zzz', s.x, 1.6, s.z, '#b9b3ff', { size: 1.0, duration: 1.8 });
        break;
      }
      case 'stunned': {
        const s = sim.sleepers.find((x) => x.id === e.id);
        if (s) this.effects.text('huh…?', s.x, 2.6, s.z, '#7fe3c6', { size: 1.0 });
        break;
      }
      case 'hush-baby': {
        const s = sim.sleepers.find((x) => x.id === e.id);
        if (s) this.effects.text('shh shh… zzz', s.x, 1.4, s.z, '#7fe3c6', { size: 1.0, duration: 1.6 });
        break;
      }
      case 'eye-open': {
        const c = sim.patrollers.find((x) => x.id === e.id);
        if (c) this.effects.text('one eye opens…', c.x, 1.6, c.z, '#ffcf8a', { size: 0.9, duration: 1.4 });
        break;
      }
      case 'shh': {
        this.effects.ring(e.x, e.z, TUNING.shh.calmRadius, '#7fe3c6', { duration: 1.1, opacity: 0.8, thick: true, from: 0.5 });
        this.effects.ring(e.x, e.z, TUNING.shh.bubbleRadius, '#bdf7e6', { duration: 0.7, opacity: 0.6 });
        this.effects.text('shhh...', e.x, 2.4, e.z, '#7fe3c6', { size: 1.3, duration: 1.4 });
        for (const id of e.calmed) {
          const s = sim.sleepers.find((x) => x.id === id);
          if (s) this.effects.text('calm', s.x, 1.5, s.z, '#bdf7e6', { size: 0.8 });
        }
        break;
      }
      case 'snack':
        this.effects.text(e.stash ? 'THE STASH!' : `+1 ${e.name.toLowerCase()}`, e.x, 1.4, e.z, '#ffd27a', { size: e.stash ? 1.4 : 1.0 });
        this.effects.ring(e.x, e.z, 1.4, '#ffd27a', { duration: 0.5, opacity: 0.6 });
        break;
      case 'alarm':
        this.effects.ring(e.x, e.z, 1.6, '#ff6f6f', { duration: 0.5, opacity: 0.9, thick: true });
        if (e.kind === 'huh') this.effects.text('HUH?!', e.x, 1.8, e.z, '#ff6f6f', { size: 1.3 });
        break;
      default:
        break;
    }
  }

  sync(sim, dt, localId) {
    this.time += dt;
    const t = this.time;
    const p = sim.byId.get(localId) || sim.player;
    const hidden = !!p.hidden;

    // Heroes (one per player)
    for (const pl of sim.players) {
      const hero = this.heroes.get(pl.id);
      if (!hero) continue;
      const hid = !!pl.hidden;
      hero.root.visible = !hid && !pl.out && !(this.pov && pl.id === localId);
      hero.root.position.set(pl.x, 0, pl.z);
      const target = this.victory && pl.id === localId ? 0 : pl.facing;
      const f = approachAngle(this.facing.has(pl.id) ? this.facing.get(pl.id) : pl.facing, target, dt * 12);
      this.facing.set(pl.id, f);
      hero.root.rotation.y = f;
      hero.update(dt, { moving: pl.moving && !this.victory, mode: pl.mode, posing: pl.poseTimer > 0 || (this.victory && pl.id === localId), emote: pl.emote });
    }

    // Peeking eyes while hidden, and curtains that bulge around you.
    sim.players.forEach((pl, i) => {
      const peek = this.peeks[i];
      if (!peek) return;
      if (pl.hidden && pl.hidden.peek && !pl.out && !(this.pov && pl.id === localId)) {
        peek.visible = true;
        peek.position.set(pl.hidden.peek[0], pl.hidden.peek[1], pl.hidden.peek[2]);
        peek.scale.set(1, (t + i) % 3.2 > 3.05 ? 0.15 : 1, 1);
        peek.rotation.y = Math.sin(t * 0.9 + i) * 0.4;
      } else peek.visible = false;
    });
    for (const [id, g] of this.curtainViews) {
      const target = sim.players.some((pl) => pl.hidden && pl.hidden.id === id) ? 1.9 : 1;
      g.scale.z += (target - g.scale.z) * Math.min(1, dt * 8);
    }

    this.playerLight.position.set(p.x, 2.6, p.z);

    sim.players.forEach((pl, i) => {
      const b = this.bubbles[i];
      if (!b) return;
      b.visible = pl.bubbleTimer > 0;
      if (b.visible) {
        b.position.set(pl.x, 0.04, pl.z);
        b.material.opacity = (0.09 + Math.sin(t * 6) * 0.03) * Math.min(1, pl.bubbleTimer / 0.4);
      }
    });

    // Hide & Seek: the Night Guard's flashlight.
    const guard = sim.guardId && sim.byId.get(sim.guardId);
    if (guard && sim.phase === 'seeking') {
      const H = TUNING.hideseek;
      this.fillCone(this.guardCone, guard.x, guard.z, sim.fan(guard.x, guard.z, guard.facing, H.fov, H.range, this.guardCone.rays));
      this.guardCone.mesh.visible = true;
      this.guardCone.material.opacity = 0.26;
    } else this.guardCone.mesh.visible = false;

    sim.doors.forEach((d, i) => {
      this.doorViews[i].rotation.y = d.open * 1.45;
    });

    sim.snacks.forEach((s, i) => {
      const v = this.snackViews[i];
      v.g.visible = !s.taken;
      v.model.position.y = 0.55 + Math.sin(t * 2.2 + i) * 0.08;
      v.model.rotation.y = t * 1.5 + i;
    });
    sim.toys.forEach((toy, i) => {
      const k = toy.squash;
      this.toyViews[i].scale.set(1 + k * 0.35, 1 - k * 0.55, 1 + k * 0.35);
    });

    const stash = this.level.stashId && sim.snacks.find((x) => x.id === this.level.stashId);
    const ready = sim.mode === 'heist' && sim.collected >= this.level.snacksRequired && (!stash || stash.taken);
    this.exitMat.opacity = ready ? 0.38 + Math.sin(t * 3) * 0.14 : 0.08;
    this.exitBeacon.visible = ready;
    this.exitBeacon.position.y = 1.8 + Math.sin(t * 2.5) * 0.15;

    const eyes = sim.patrollers.filter((c) => c.type === 'eye');
    sim.sleepers.forEach((s, i) => {
      const eyeOpen = eyes.some((c) => c.sleeperId === s.id && c.watching);
      this.sleeperViews[i].update(dt, s, t, eyeOpen);
      if (s.stage === 'asleep' || s.stage === 'stirring') {
        this.zzz[i] -= dt;
        if (this.zzz[i] <= 0) {
          this.zzz[i] = s.stage === 'asleep' ? 1.6 : 2.6;
          const big = Math.sin(t * 3 + i) > 0;
          this.effects.text(big ? 'Z' : 'z', s.x + 0.3, s.y + 0.6 * s.scale + 0.4, s.z, '#b9b3ff', { size: big ? 0.8 : 0.6, duration: 1.8, rise: 1.3 });
        }
      }
    });

    sim.patrollers.forEach((c, i) => {
      if (this.patrolViews[i]) this.patrolViews[i].update(dt, c, t);
      this.updateCone(this.cones[i], sim, c);
    });

    if (this.chandelier) this.chandelier.rotation.y = Math.sin(t * 0.3) * 0.08;
    if (this.mobile) this.mobile.rotation.y = t * 0.4;

    // Fade the wall between the camera and the hero so you never lose sight of yourself.
    for (const fw of this.fadeWalls) {
      const b = fw.wall;
      const behind = !hidden && p.z < b.minZ && p.z > b.minZ - 4 && p.x > b.minX - 1 && p.x < b.maxX + 1;
      const target = behind ? 0.28 : 1;
      fw.opacity += (target - fw.opacity) * Math.min(1, dt * 8);
      for (const m of fw.mats) {
        m.opacity = fw.opacity;
        m.depthWrite = fw.opacity > 0.95;
      }
    }

    this.effects.update(dt);
  }

  updateCone(cone, sim, c) {
    if (!c.watching) {
      cone.mesh.visible = false;
      return;
    }
    cone.mesh.visible = true;
    this.fillCone(cone, c.x, c.z, sim.visionFan(c, cone.rays));
    const k = c.state === 'alert' ? 1 : Math.min(1, c.detect / 100);
    cone.material.color.copy(cone.base).lerp(ALERT, k);
    cone.material.opacity = 0.16 + k * 0.28;
  }

  fillCone(cone, x, z, pts) {
    const pos = cone.pos;
    pos[0] = x;
    pos[1] = 0.03;
    pos[2] = z;
    for (let i = 0; i <= cone.rays; i++) {
      pos[(i + 1) * 3] = pts[i * 2];
      pos[(i + 1) * 3 + 1] = 0.03;
      pos[(i + 1) * 3 + 2] = pts[i * 2 + 1];
    }
    cone.geo.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.effects.dispose();
    for (const h of this.heroes.values()) h.dispose();
    disposeTree(this.scene);
    for (const t of this.textures) t.dispose();
  }
}
