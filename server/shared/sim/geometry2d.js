// Small 2D helpers. The game simulates on the floor plane (x, z); three.js only draws it.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function inBox(x, z, b) {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

export function wrapAngle(a) {
  const TAU = Math.PI * 2;
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export const angleDiff = (a, b) => wrapAngle(a - b);

export function turnToward(a, target, maxStep) {
  const d = angleDiff(target, a);
  if (Math.abs(d) <= maxStep) return target;
  return wrapAngle(a + Math.sign(d) * maxStep);
}

// Push a circle out of every axis-aligned box it overlaps.
export function resolveCircle(x, z, r, boxes) {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const b of boxes) {
      const cx = clamp(x, b.minX, b.maxX);
      const cz = clamp(z, b.minZ, b.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x += (dx / d) * (r - d);
        z += (dz / d) * (r - d);
      } else {
        const left = x - b.minX;
        const right = b.maxX - x;
        const top = z - b.minZ;
        const bottom = b.maxZ - z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.minX - r;
        else if (m === right) x = b.maxX + r;
        else if (m === top) z = b.minZ - r;
        else z = b.maxZ + r;
      }
      moved = true;
    }
    if (!moved) break;
  }
  return { x, z };
}

// Ray vs box (slab test). Returns the entry distance t (in units of the direction
// vector) or Infinity when the ray misses.
export function rayBox(ox, oz, dx, dz, b) {
  let tmin = -Infinity;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ox < b.minX || ox > b.maxX) return Infinity;
  } else {
    let t1 = (b.minX - ox) / dx;
    let t2 = (b.maxX - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dz) < 1e-9) {
    if (oz < b.minZ || oz > b.maxZ) return Infinity;
  } else {
    let t1 = (b.minZ - oz) / dz;
    let t2 = (b.maxZ - oz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (tmax < Math.max(tmin, 0)) return Infinity;
  return Math.max(tmin, 0);
}

export function castRay(ox, oz, dx, dz, maxT, boxes) {
  let t = maxT;
  for (const b of boxes) {
    const hit = rayBox(ox, oz, dx, dz, b);
    if (hit < t) t = hit;
  }
  return t;
}

export function segmentBlocked(x1, z1, x2, z2, boxes) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  for (const b of boxes) {
    if (rayBox(x1, z1, dx, dz, b) < 1) return true;
  }
  return false;
}

// Tiny seeded random generator so the cat's naps are repeatable in tests.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
