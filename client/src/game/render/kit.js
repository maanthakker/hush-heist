import * as THREE from 'three';

// Shared low-poly building blocks.
const matCache = new Map();

export function mat(color, opts = {}) {
  const simple = Object.values(opts).every((v) => v === null || typeof v !== 'object');
  const key = simple ? `${color}|${JSON.stringify(opts)}` : null;
  if (key && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...opts });
  if (key) matCache.set(key, m);
  return m;
}

export function clearMaterialCache() {
  matCache.clear();
}

export function mesh(geometry, material, x = 0, y = 0, z = 0, opts = {}) {
  const { rx = 0, ry = 0, rz = 0, cast = true, receive = true } = opts;
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const ico = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);

export function group(x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

export const center = (b) => ({
  x: (b.minX + b.maxX) / 2,
  z: (b.minZ + b.maxZ) / 2,
  w: b.maxX - b.minX,
  d: b.maxZ - b.minZ,
});

// Free every geometry and material under a root object.
export function disposeTree(root) {
  const geos = new Set();
  const mats = new Set();
  root.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => {
    if (m.map) m.map.dispose();
    m.dispose();
  });
}
