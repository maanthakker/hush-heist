// Player-made levels: the editor's building pieces, the "data" format saved
// online, a builder that turns that data into a real level for the game, and a
// validator (used by both the editor and the server) that makes sure a level is
// actually playable before it goes online.
import { box, outerWalls } from './levels/helpers.js';
import { TUNING } from './sim/tuning.js';
import { resolveCircle } from './sim/geometry2d.js';

export const SIZES = {
  s: { w: 24, d: 18, label: 'Small' },
  m: { w: 32, d: 22, label: 'Medium' },
  l: { w: 40, d: 28, label: 'Large' },
};

export const THEMES = {
  jungle: { label: 'Jungle Room', floor: 'wood', wall: 'palm', sky: '#151938', creakWord: 'creak' },
  kitchen: { label: 'Kitchen', floor: 'tile', wall: 'kitchen', sky: '#131a33', creakWord: 'clack' },
  garage: { label: 'Garage', floor: 'concrete', wall: 'garage', sky: '#121726', creakWord: 'crunch' },
  attic: { label: 'Attic', floor: 'attic', wall: 'attic', sky: '#16121f', creakWord: 'creak' },
};

// Level names are built from these words: no free typing, so every name is friendly.
export const NAME_WORDS = [
  ['Sneaky', 'Silent', 'Sleepy', 'Midnight', 'Moonlit', 'Tiptoe', 'Creaky', 'Secret', 'Cozy', 'Giant', 'Tiny', 'Wobbly', 'Spooky', 'Snack-Filled', 'Twisty', 'Super'],
  ['Hallway', 'Kitchen', 'Garage', 'Attic', 'Mansion', 'Treehouse', 'Basement', 'Library', 'Bedroom', 'Living Room', 'Cabin', 'Castle', 'Bakery', 'Lab', 'Hotel', 'Museum'],
  ['Heist', 'Escape', 'Maze', 'Mission', 'Sneak', 'Caper', 'Run', 'Challenge', 'Puzzle', 'Adventure', 'Dash', 'Quest'],
];
export const levelName = (n = [0, 0, 0]) => NAME_WORDS.map((words, i) => words[n[i]] ?? words[0]).join(' ');

// Furniture: footprint in grid cells when not rotated. hide = what kind of hiding spot it makes.
export const FURNITURE = {
  bed: { label: 'Bed', w: 3, d: 4, color: '#34407a' },
  sofa: { label: 'Sofa', w: 5, d: 2, color: '#56653a' },
  daybed: { label: 'Daybed', w: 4, d: 2, color: '#d9d2c2' },
  armchair: { label: 'Armchair', w: 2, d: 2, color: '#b0812d' },
  beanbag: { label: 'Beanbag', w: 2, d: 2, color: '#2f7a78' },
  coffeeTable: { label: 'Coffee table', w: 3, d: 2, color: '#6b4630', hide: 'table' },
  diningTable: { label: 'Dining table', w: 4, d: 3, color: '#7a5038', hide: 'table' },
  chair: { label: 'Chair', w: 1, d: 1, color: '#a5794c' },
  closet: { label: 'Closet', w: 2, d: 2, color: '#5d3d28', hide: 'closet', sight: true },
  crates: { label: 'Boxes', w: 2, d: 2, color: '#b98a55', hide: 'crates', sight: true },
  trunk: { label: 'Trunk', w: 2, d: 1, color: '#6b4630', hide: 'trunk' },
  car: { label: 'Car', w: 7, d: 4, color: '#3b6fa8', hide: 'car', sight: true },
  bookshelf: { label: 'Bookshelf', w: 1, d: 3, color: '#43291b', sight: true },
  counter: { label: 'Counter', w: 3, d: 1, color: '#e9e3d6' },
  stove: { label: 'Stove', w: 2, d: 1, color: '#d9dadf' },
  fridge: { label: 'Fridge', w: 2, d: 1, color: '#e8ecf1', sight: true },
  crib: { label: 'Crib', w: 3, d: 2, color: '#efe9e0' },
  palm: { label: 'Plant', w: 1, d: 1, color: '#3f7d4a' },
  block: { label: 'Pillar', w: 1, d: 1, color: '#8a8f99', sight: true },
};

const HIDE_INFO = {
  table: { label: 'Slide under the table', peekY: 0.33 },
  closet: { label: 'Squeeze into the closet', peekY: 1.5 },
  crates: { label: 'Hide behind the boxes', peekY: 1.1 },
  trunk: { label: 'Climb into the trunk', peekY: 0.9 },
  car: { label: 'Roll under the car', peekY: 0.25 },
};

export const SLEEPERS = {
  dad: { name: 'Dad', sens: 0.7, scale: 1 },
  mom: { name: 'Mom', sens: 0.9, scale: 0.95 },
  sis: { name: 'Big Sis', sens: 1.0, scale: 0.85 },
  bro: { name: 'Little Bro', sens: 1.2, scale: 0.7 },
  baby: { name: 'Baby', sens: 1.5, scale: 0.5 },
  grandpa: { name: 'Grandpa', sens: 1.3, scale: 1 },
  uncle: { name: 'Uncle', sens: 0.8, scale: 1 },
};

const DEG = Math.PI / 180;
export const PATROLLERS = {
  cat: { label: 'Cat', name: 'Mochi the cat', speed: 1.1, turnRate: 3.5, range: 4.5, fov: 80 * DEG, napChance: 0.45 },
  vacuum: { label: 'Robot vacuum', name: 'Dusty the robot vacuum', speed: 1.7, turnRate: 2.2, range: 6, fov: 55 * DEG, napChance: 0 },
  mower: { label: 'Robot mower', name: 'Mowbot the robot mower', speed: 1.5, turnRate: 2, range: 6.5, fov: 55 * DEG, napChance: 0 },
};

export const LIMITS = { furniture: 60, sleepers: 6, patrollers: 4, pathPoints: 6, snacks: 12, toys: 12, creaks: 40, walls: 600 };

export function emptyLevel(size = 'm', theme = 'jungle') {
  const { w, d } = SIZES[size];
  return {
    v: 1,
    size,
    theme,
    name: [0, 0, 0],
    required: 1,
    walls: [],
    creaks: [],
    toys: [],
    snacks: [],
    stash: null,
    furniture: [],
    sleepers: [],
    patrollers: [],
    start: [2, d - 3],
    exit: [2, d - 3],
  };
}

// Cells covered by a piece of furniture.
export function footprint(f) {
  const def = FURNITURE[f.k];
  if (!def) return [];
  const w = f.r % 2 ? def.d : def.w;
  const d = f.r % 2 ? def.w : def.d;
  const cells = [];
  for (let x = f.x; x < f.x + w; x++) for (let z = f.z; z < f.z + d; z++) cells.push([x, z]);
  return cells;
}

const int = (v) => (Number.isInteger(v) ? v : NaN);
const cellOk = (c, W, D) => Array.isArray(c) && c.length === 2 && int(c[0]) >= 0 && int(c[0]) < W && int(c[1]) >= 0 && int(c[1]) < D;

/** Clean untrusted data: keep only known fields, known kinds and in-range cells. */
export function sanitize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const size = SIZES[r.size] ? r.size : 'm';
  const { w: W, d: D } = SIZES[size];
  const cells = (list, max) => (Array.isArray(list) ? list.filter((c) => cellOk(c, W, D)).slice(0, max).map(([x, z]) => [x, z]) : []);
  const name = Array.isArray(r.name) ? r.name.slice(0, 3).map((n, i) => (Number.isInteger(n) && n >= 0 && n < NAME_WORDS[i].length ? n : 0)) : [0, 0, 0];
  while (name.length < 3) name.push(0);
  return {
    v: 1,
    size,
    theme: THEMES[r.theme] ? r.theme : 'jungle',
    name,
    required: Number.isInteger(r.required) ? Math.max(1, Math.min(LIMITS.snacks, r.required)) : 1,
    walls: cells(r.walls, LIMITS.walls),
    creaks: cells(r.creaks, LIMITS.creaks),
    toys: cells(r.toys, LIMITS.toys),
    snacks: cells(r.snacks, LIMITS.snacks),
    stash: cellOk(r.stash, W, D) ? [r.stash[0], r.stash[1]] : null,
    furniture: (Array.isArray(r.furniture) ? r.furniture : [])
      .filter((f) => f && FURNITURE[f.k] && cellOk([f.x, f.z], W, D))
      .slice(0, LIMITS.furniture)
      .map((f) => ({ k: f.k, x: f.x, z: f.z, r: [0, 1, 2, 3].includes(f.r) ? f.r : 0 })),
    sleepers: (Array.isArray(r.sleepers) ? r.sleepers : [])
      .filter((s) => s && SLEEPERS[s.k] && cellOk([s.x, s.z], W, D))
      .slice(0, LIMITS.sleepers)
      .map((s) => ({ k: s.k, x: s.x, z: s.z, r: [0, 1, 2, 3].includes(s.r) ? s.r : 0 })),
    patrollers: (Array.isArray(r.patrollers) ? r.patrollers : [])
      .filter((p) => p && PATROLLERS[p.k])
      .slice(0, LIMITS.patrollers)
      .map((p) => ({ k: p.k, path: cells(p.path, LIMITS.pathPoints) })),
    start: cellOk(r.start, W, D) ? [r.start[0], r.start[1]] : [2, D - 3],
    exit: cellOk(r.exit, W, D) ? [r.exit[0], r.exit[1]] : [2, D - 3],
  };
}

// Merge wall cells into as few boxes as possible (rows, then stacked rows).
function mergeWalls(cells, toWorld) {
  const rows = new Map();
  for (const [x, z] of cells) {
    if (!rows.has(z)) rows.set(z, new Set());
    rows.get(z).add(x);
  }
  const runs = [];
  for (const [z, xs] of rows) {
    const sorted = [...xs].sort((a, b) => a - b);
    let s = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        runs.push({ x0: s, x1: sorted[i - 1], z0: z, z1: z });
        s = sorted[i];
      }
    }
  }
  runs.sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1 || a.z0 - b.z0);
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && last.x0 === r.x0 && last.x1 === r.x1 && last.z1 + 1 === r.z0) last.z1 = r.z0;
    else merged.push({ ...r });
  }
  return merged.map((m, i) => {
    const a = toWorld(m.x0, m.z0);
    const b = toWorld(m.x1, m.z1);
    return box(a.x - 0.5, b.x + 0.5, a.z - 0.5, b.z + 0.5, { id: `wall-${i}`, h: 2.4 });
  });
}

/** Turn saved editor data into a level the game engine can play. */
export function buildCustomLevel(raw, meta = {}) {
  const data = sanitize(raw);
  const { w: W, d: D } = SIZES[data.size];
  const theme = THEMES[data.theme];
  const toWorld = (x, z) => ({ x: x - W / 2 + 0.5, z: z - D / 2 + 0.5 });
  const walls = [...outerWalls(-W / 2, W / 2, -D / 2, D / 2), ...mergeWalls(data.walls, toWorld)];

  const furniture = data.furniture.map((f, i) => {
    const def = FURNITURE[f.k];
    const cells = footprint(f);
    const xs = cells.map((c) => c[0]);
    const zs = cells.map((c) => c[1]);
    const a = toWorld(Math.min(...xs), Math.min(...zs));
    const b = toWorld(Math.max(...xs), Math.max(...zs));
    return box(a.x - 0.5 + 0.05, b.x + 0.5 - 0.05, a.z - 0.5 + 0.05, b.z + 0.5 - 0.05, {
      id: `f-${i}`,
      type: f.k,
      face: ['s', 'w', 'n', 'e'][f.r],
      blocksSight: !!def.sight,
      ...(f.k === 'block' ? { h: 2.4, color: def.color } : {}),
      ...(f.k === 'crates' ? {} : {}),
    });
  });
  const colliders = [...walls, ...furniture];
  const free = (x, z) => {
    const res = resolveCircle(x, z, TUNING.playerRadius, colliders);
    return Math.abs(res.x - x) < 1e-6 && Math.abs(res.z - z) < 1e-6;
  };

  // Every hiding piece gets a spot to stand at: in front of it if possible.
  const hideSpots = [];
  furniture.forEach((f, i) => {
    const def = FURNITURE[data.furniture[i].k];
    if (!def.hide) return;
    const info = HIDE_INFO[def.hide];
    const cx = (f.minX + f.maxX) / 2;
    const cz = (f.minZ + f.maxZ) / 2;
    const options = [
      [cx, f.maxZ + 0.6, [cx, info.peekY, f.maxZ + 0.02]],
      [cx, f.minZ - 0.6, [cx, info.peekY, f.minZ - 0.02]],
      [f.maxX + 0.6, cz, [f.maxX + 0.02, info.peekY, cz]],
      [f.minX - 0.6, cz, [f.minX - 0.02, info.peekY, cz]],
    ];
    const pick = options.find(([x, z]) => free(x, z));
    if (!pick) return;
    hideSpots.push({ id: `hide-${i}`, type: def.hide, x: pick[0], z: pick[1], hideX: cx, hideZ: cz, peek: pick[2], label: info.label });
  });

  const kinds = ['cookie', 'chips', 'choco', 'juice', 'donut', 'popcorn'];
  const names = { cookie: 'Cookie', chips: 'Chips', choco: 'Choco bar', juice: 'Juice box', donut: 'Donut', popcorn: 'Popcorn' };
  const snacks = data.snacks.map(([x, z], i) => {
    const w = toWorld(x, z);
    const kind = kinds[i % kinds.length];
    return { id: `s-${i}`, kind, name: names[kind], x: w.x, z: w.z };
  });
  if (data.stash) {
    const w = toWorld(...data.stash);
    snacks.push({ id: 'stash', kind: 'stash', name: 'The Midnight Snack Stash', x: w.x, z: w.z });
  }

  const onFurniture = (x, z) => data.furniture.some((f) => ['bed', 'sofa', 'daybed'].includes(f.k) && footprint(f).some(([a, b]) => a === x && b === z));
  const sleepers = data.sleepers.map((s, i) => {
    const def = SLEEPERS[s.k];
    const w = toWorld(s.x, s.z);
    return { id: `sl-${i}`, name: def.name, x: w.x, z: w.z, rot: (s.r * Math.PI) / 2, y: onFurniture(s.x, s.z) ? 0.55 : 0.12, sens: def.sens, scale: def.scale, look: s.k };
  });
  const patrollers = data.patrollers
    .filter((p) => p.path.length >= 2)
    .map((p, i) => ({ id: `pa-${i}`, type: p.k, ...PATROLLERS[p.k], path: p.path.map(([x, z]) => {
      const w = toWorld(x, z);
      return [w.x, w.z];
    }) }));

  const st = toWorld(...data.start);
  const ex = toWorld(...data.exit);
  const offsets = [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1], [1, 1], [-1, 1]];
  const spawns = offsets.map(([ox, oz]) => [st.x + ox, st.z + oz]).filter(([x, z]) => free(x, z)).slice(0, 4);
  while (spawns.length < 4) spawns.push([st.x, st.z]);

  return {
    id: meta.id ? `custom:${meta.id}` : 'custom',
    custom: true,
    number: 0,
    name: levelName(data.name),
    intro: `Grab ${Math.min(data.required, snacks.length)} snack${data.required === 1 ? '' : 's'}${data.stash ? ' and the stash' : ''}, then get back to the exit mat.`,
    theme: { floor: theme.floor, wall: theme.wall, sky: theme.sky },
    bounds: box(-W / 2, W / 2, -D / 2, D / 2),
    start: { x: st.x, z: st.z, facing: Math.PI },
    spawns,
    exitZone: box(ex.x - 1.5, ex.x + 1.5, ex.z - 1.5, ex.z + 1.5),
    exitName: 'the exit mat',
    creakWord: theme.creakWord,
    snacksRequired: Math.max(1, Math.min(data.required, data.snacks.length || 1)),
    stashId: data.stash ? 'stash' : undefined,
    parTime: 25 + snacks.length * 6,
    walls,
    doors: [],
    furniture,
    rugs: [],
    windows: [],
    creaks: data.creaks.map(([x, z], i) => {
      const w = toWorld(x, z);
      return box(w.x - 0.5, w.x + 0.5, w.z - 0.5, w.z + 0.5, { id: `c-${i}` });
    }),
    toys: data.toys.map(([x, z], i) => ({ id: `t-${i}`, kind: i % 2 ? 'ball' : 'bone', ...toWorld(x, z) })),
    hideSpots,
    snacks,
    sleepers,
    patrollers,
  };
}

/** Is this level playable? Returns { ok, errors, level }. Shared by editor and server. */
export function validateCustomLevel(raw) {
  const data = sanitize(raw);
  const errors = [];
  const { w: W, d: D } = SIZES[data.size];
  // Overlaps
  const taken = new Map();
  const mark = (x, z, what) => {
    const key = `${x},${z}`;
    if (taken.has(key)) return taken.get(key);
    taken.set(key, what);
    return null;
  };
  for (const [x, z] of data.walls) mark(x, z, 'wall');
  for (const f of data.furniture) {
    for (const [x, z] of footprint(f)) {
      if (x >= W || z >= D) {
        errors.push(`${FURNITURE[f.k].label} sticks out of the map.`);
        break;
      }
      if (mark(x, z, 'furniture')) {
        errors.push(`${FURNITURE[f.k].label} overlaps something.`);
        break;
      }
    }
  }
  const blocked = (c) => c && ['wall', 'furniture'].includes(taken.get(`${c[0]},${c[1]}`));
  if (blocked(data.start)) errors.push('The start is inside a wall or furniture.');
  if (blocked(data.exit)) errors.push('The exit is inside a wall or furniture.');
  if (data.snacks.length === 0) errors.push('Add at least one snack.');
  if (data.sleepers.length === 0) errors.push('Add at least one sleeping family member.');
  if (data.snacks.some(blocked) || blocked(data.stash)) errors.push('A snack is inside a wall or furniture.');
  if (data.patrollers.some((p) => p.path.length < 2)) errors.push('Give every patroller at least 2 route points.');

  const level = buildCustomLevel(data);
  if (errors.length) return { ok: false, errors: [...new Set(errors)], level, data };

  // Can the hero actually reach everything? (flood fill from the start)
  const colliders = [...level.walls, ...level.furniture];
  const r = TUNING.playerRadius;
  const G = 0.5;
  const B = level.bounds;
  const GW = Math.round((B.maxX - B.minX) / G);
  const GH = Math.round((B.maxZ - B.minZ) / G);
  const open = new Uint8Array(GW * GH);
  const cx = (i) => B.minX + (i + 0.5) * G;
  const cz = (j) => B.minZ + (j + 0.5) * G;
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const res = resolveCircle(cx(i), cz(j), r, colliders);
      open[j * GW + i] = Math.abs(res.x - cx(i)) < 1e-6 && Math.abs(res.z - cz(j)) < 1e-6 ? 1 : 0;
    }
  }
  const seen = new Uint8Array(GW * GH);
  const si = Math.floor((level.start.x - B.minX) / G);
  const sj = Math.floor((level.start.z - B.minZ) / G);
  const q = [];
  // Start from the nearest open cell to the start point.
  let best = -1;
  let bestD = 9e9;
  for (let j = Math.max(0, sj - 2); j <= Math.min(GH - 1, sj + 2); j++) {
    for (let i = Math.max(0, si - 2); i <= Math.min(GW - 1, si + 2); i++) {
      const d = Math.hypot(cx(i) - level.start.x, cz(j) - level.start.z);
      if (open[j * GW + i] && d < bestD) {
        best = j * GW + i;
        bestD = d;
      }
    }
  }
  if (best < 0) return { ok: false, errors: ['There’s no room to stand at the start.'], level, data };
  q.push(best);
  seen[best] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    const i = c % GW;
    const j = (c / GW) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
      const n = nj * GW + ni;
      if (open[n] && !seen[n]) {
        seen[n] = 1;
        q.push(n);
      }
    }
  }
  const reach = (x, z, within) => {
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        if (seen[j * GW + i] && Math.hypot(cx(i) - x, cz(j) - z) < within) return true;
      }
    }
    return false;
  };
  if (level.snacks.some((s) => !reach(s.x, s.z, TUNING.pickupRadius - 0.05))) errors.push('A snack can’t be reached from the start.');
  const ez = level.exitZone;
  if (!reach((ez.minX + ez.maxX) / 2, (ez.minZ + ez.maxZ) / 2, 1.6)) errors.push('The exit can’t be reached from the start.');
  for (const p of level.patrollers) {
    for (let k = 0; k < p.path.length; k++) {
      const [ax, az] = p.path[k];
      const [bx, bz] = p.path[(k + 1) % p.path.length];
      let bad = false;
      for (let t = 0; t <= 20 && !bad; t++) {
        const x = ax + ((bx - ax) * t) / 20;
        const z = az + ((bz - az) * t) / 20;
        if (colliders.some((b) => x > b.minX - 0.25 && x < b.maxX + 0.25 && z > b.minZ - 0.25 && z < b.maxZ + 0.25)) bad = true;
      }
      if (bad) {
        errors.push(`The ${PATROLLERS[p.type].label.toLowerCase()}’s route goes through a wall or furniture.`);
        break;
      }
    }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], level, data };
}
