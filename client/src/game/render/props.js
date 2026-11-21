import * as THREE from 'three';
import { box, center, cyl, group, ico, mat, mesh } from './kit.js';

// Low-poly furniture. Every builder takes a furniture entry from the level
// (an axis-aligned footprint) and returns a group standing on the floor.
const C = {
  walnut: '#6b4630',
  darkWood: '#43291b',
  lightWood: '#a5794c',
  olive: '#56653a',
  oliveLight: '#66784a',
  mustard: '#b0812d',
  cream: '#efe9e0',
  navy: '#34407a',
  teal: '#2f7a78',
  leaf: '#3f7d4a',
  leafLight: '#55985a',
  pot: '#8f5b3f',
  brass: '#d8c08a',
};

function legs(g, w, d, h, inset = 0.08, color = C.darkWood, r = 0.05) {
  const geo = box(r * 2, h, r * 2);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(mesh(geo, mat(color), sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset)));
    }
  }
}

// Where the backrest goes for something that "faces" a direction.
function backSlab(face, w, d, t) {
  switch (face) {
    case 'n':
      return { x: 0, z: d / 2 - t / 2, bw: w, bd: t };
    case 's':
      return { x: 0, z: -d / 2 + t / 2, bw: w, bd: t };
    case 'e':
      return { x: -w / 2 + t / 2, z: 0, bw: t, bd: d };
    default:
      return { x: w / 2 - t / 2, z: 0, bw: t, bd: d };
  }
}

function bed(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.35, d), mat(C.darkWood), 0, 0.175, 0));
  g.add(mesh(box(w, 1.0, 0.14), mat(C.darkWood), 0, 0.5, -d / 2 + 0.07));
  g.add(mesh(box(w - 0.16, 0.2, d - 0.2), mat(C.cream), 0, 0.45, 0.04));
  g.add(mesh(box(w - 0.06, 0.14, d * 0.62), mat(C.navy), 0, 0.6, d * 0.17));
  g.add(mesh(box(w * 0.62, 0.14, 0.5), mat('#f4f1ea'), 0, 0.62, -d / 2 + 0.5));
  // Little stars on the blanket.
  for (let i = 0; i < 6; i++) {
    const sx = (((i * 37) % 10) / 10 - 0.5) * (w - 0.6);
    const sz = d * 0.17 + ((((i * 53) % 10) / 10) - 0.5) * d * 0.5;
    g.add(mesh(box(0.12, 0.02, 0.12), mat('#f2d27a', { emissive: '#7a6320', emissiveIntensity: 0.6 }), sx, 0.68, sz, { ry: 0.6, cast: false }));
  }
  return g;
}

function desk(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.07, d), mat(C.lightWood), 0, 0.78, 0));
  legs(g, w, d, 0.75, 0.08, C.walnut);
  g.add(mesh(box(0.6, 0.05, 0.42), mat('#d9e4f2'), -0.4, 0.84, 0.05, { ry: 0.2 }));
  const lamp = group(w / 2 - 0.4, 0.82, -0.1);
  lamp.add(mesh(cyl(0.12, 0.14, 0.05), mat('#2d2d3a'), 0, 0.02, 0));
  lamp.add(mesh(cyl(0.02, 0.02, 0.4), mat('#2d2d3a'), 0, 0.22, 0));
  lamp.add(mesh(new THREE.ConeGeometry(0.2, 0.22, 8, 1, true), mat('#ffd59a', { emissive: '#ffb050', emissiveIntensity: 0.9, side: THREE.DoubleSide }), 0, 0.46, 0));
  g.add(lamp);
  return g;
}

function sofa(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.42, d), mat(C.olive), 0, 0.21, 0));
  g.add(mesh(box(w, 0.6, 0.34), mat(C.olive), 0, 0.72, -d / 2 + 0.17));
  for (const s of [-1, 1]) g.add(mesh(box(0.34, 0.32, d), mat(C.olive), s * (w / 2 - 0.17), 0.58, 0));
  const cw = (w - 0.7) / 3;
  for (let i = 0; i < 3; i++) {
    g.add(mesh(box(cw - 0.05, 0.1, d - 0.4), mat(C.oliveLight), -w / 2 + 0.35 + cw * (i + 0.5), 0.47, 0.12));
  }
  return g;
}

function coffeeTable(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.08, d), mat(C.walnut), 0, 0.5, 0));
  legs(g, w, d, 0.46, 0.12, C.darkWood, 0.05);
  g.add(mesh(box(0.7, 0.03, 0.5), mat('#c8d6c4'), -0.6, 0.555, 0.1, { ry: 0.3 }));
  g.add(mesh(cyl(0.08, 0.07, 0.16), mat('#e9e1d2'), 0.8, 0.62, -0.2));
  return g;
}

function armchair(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.42, d), mat(C.mustard), 0, 0.21, 0));
  const b = backSlab(f.face, w, d, 0.3);
  g.add(mesh(box(b.bw, 0.62, b.bd), mat(C.mustard), b.x, 0.72, b.z));
  const side = f.face === 'e' || f.face === 'w';
  for (const s of [-1, 1]) {
    if (side) g.add(mesh(box(w, 0.3, 0.26), mat(C.mustard), 0, 0.56, s * (d / 2 - 0.13)));
    else g.add(mesh(box(0.26, 0.3, d), mat(C.mustard), s * (w / 2 - 0.13), 0.56, 0));
  }
  return g;
}

function sideTable(f) {
  const { x, z } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(cyl(0.38, 0.38, 0.05, 10), mat(C.walnut), 0, 0.62, 0));
  g.add(mesh(cyl(0.05, 0.08, 0.6), mat(C.darkWood), 0, 0.3, 0));
  g.add(mesh(cyl(0.08, 0.1, 0.3), mat('#cfc6b2'), 0, 0.8, 0));
  g.add(mesh(new THREE.ConeGeometry(0.22, 0.24, 8), mat('#e7dcc3'), 0, 1.05, 0));
  return g;
}

function diningTable(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.09, d), mat(C.walnut), 0, 0.8, 0));
  legs(g, w, d, 0.76, 0.2, C.darkWood, 0.07);
  g.add(mesh(box(w * 0.8, 0.01, 0.5), mat('#c9b48a'), 0, 0.85, 0));
  g.add(mesh(new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#d9d2c2', { side: THREE.DoubleSide }), 0, 1.15, 0));
  for (let i = 0; i < 4; i++) {
    const c = ['#e2a33b', '#c94b3a', '#e2a33b', '#7fa84a'][i];
    g.add(mesh(ico(0.11, 0), mat(c), Math.cos(i * 1.6) * 0.14, 0.95, Math.sin(i * 1.6) * 0.14));
  }
  return g;
}

function chair(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.06, d), mat(C.lightWood), 0, 0.45, 0));
  legs(g, w, d, 0.43, 0.06, C.walnut, 0.035);
  const b = backSlab(f.face, w, d, 0.07);
  g.add(mesh(box(b.bw, 0.55, b.bd), mat(C.lightWood), b.x, 0.75, b.z));
  return g;
}

function crib(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.32, d), mat(C.cream), 0, 0.26, 0));
  g.add(mesh(box(w - 0.12, 0.12, d - 0.12), mat('#cfe3f0'), 0, 0.42, 0));
  const railMat = mat(C.cream);
  for (const s of [-1, 1]) {
    g.add(mesh(box(w, 0.06, 0.07), railMat, 0, 1.0, s * (d / 2 - 0.035)));
    g.add(mesh(box(0.07, 0.06, d), railMat, s * (w / 2 - 0.035), 1.0, 0));
  }
  const bar = cyl(0.025, 0.025, 0.58, 5);
  const n = Math.floor(w / 0.3);
  for (let i = 0; i <= n; i++) {
    const bx = -w / 2 + 0.05 + (i * (w - 0.1)) / n;
    for (const s of [-1, 1]) g.add(mesh(bar, railMat, bx, 0.7, s * (d / 2 - 0.035), { cast: false }));
  }
  const m = Math.floor(d / 0.3);
  for (let i = 1; i < m; i++) {
    const bz = -d / 2 + (i * d) / m;
    for (const s of [-1, 1]) g.add(mesh(bar, railMat, s * (w / 2 - 0.035), 0.7, bz, { cast: false }));
  }
  // Mobile of little stars hanging over the crib.
  const mobile = group(0, 1.75, 0);
  mobile.add(mesh(cyl(0.01, 0.01, 0.5, 4), mat('#d8d0c0'), 0, 0.25, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    mobile.add(mesh(ico(0.07, 0), mat(['#f2d27a', '#9fd6ff', '#f5a7c0'][i % 3], { emissive: '#3a3010', emissiveIntensity: 0.4 }), Math.cos(a) * 0.4, -0.15, Math.sin(a) * 0.4));
  }
  mobile.name = 'mobile';
  g.add(mobile);
  return g;
}

function bookshelf(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w * 0.3, 2.3, d), mat(C.darkWood), w * 0.35, 1.15, 0));
  for (let s = 0; s < 5; s++) g.add(mesh(box(w, 0.06, d), mat(C.walnut), 0, 0.1 + s * 0.52, 0));
  for (const sz of [-1, 1]) g.add(mesh(box(w, 2.3, 0.06), mat(C.walnut), 0, 1.15, sz * (d / 2 - 0.03)));
  const colors = ['#b94b3d', '#3e6ea8', '#e0b04a', '#4e8b5c', '#8a5aa8', '#d9d2c2'];
  let k = 0;
  for (let s = 0; s < 4; s++) {
    let bz = -d / 2 + 0.12;
    while (bz < d / 2 - 0.2) {
      const t = 0.08 + ((k * 7) % 5) * 0.025;
      const h = 0.3 + ((k * 13) % 4) * 0.04;
      g.add(mesh(box(w * 0.55, h, t), mat(colors[k % colors.length]), -0.02, 0.13 + s * 0.52 + h / 2, bz + t / 2, { cast: false }));
      bz += t + 0.02;
      k += 1;
    }
  }
  return g;
}

function closet(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 2.6, d), mat('#5d3d28'), 0, 1.3, 0));
  g.add(mesh(box(w + 0.06, 0.1, d + 0.06), mat(C.darkWood), 0, 2.62, 0));
  const doorMat = mat('#734c33');
  const knob = mat(C.brass, { metalness: 0.6, roughness: 0.4 });
  if (f.face === 'w' || f.face === 'e') {
    const fx = (f.face === 'w' ? -1 : 1) * (w / 2 + 0.02);
    for (const s of [-1, 1]) {
      g.add(mesh(box(0.04, 2.3, d / 2 - 0.12), doorMat, fx, 1.25, s * (d / 4)));
      g.add(mesh(ico(0.05, 0), knob, fx * 1.02, 1.2, s * 0.12));
    }
  } else {
    const fz = (f.face === 'n' ? -1 : 1) * (d / 2 + 0.02);
    for (const s of [-1, 1]) {
      g.add(mesh(box(w / 2 - 0.12, 2.3, 0.04), doorMat, s * (w / 4), 1.25, fz));
      g.add(mesh(ico(0.05, 0), knob, s * 0.12, 1.2, fz * 1.02));
    }
  }
  return g;
}

function beanbag(f) {
  const { x, z } = center(f);
  const g = group(x, 0, z);
  const bag = mesh(ico(1, 1), mat(C.teal), 0, 0.38, 0);
  bag.scale.set(1.05, 0.42, 1.05);
  g.add(bag);
  return g;
}

function palm(f) {
  const { x, z } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(cyl(0.32, 0.24, 0.5, 8), mat(C.pot), 0, 0.25, 0));
  g.add(mesh(cyl(0.29, 0.29, 0.03, 8), mat('#3a2a1e'), 0, 0.49, 0));
  let ty = 0.5;
  for (let i = 0; i < 4; i++) {
    g.add(mesh(cyl(0.06, 0.08, 0.38, 6), mat(i % 2 ? '#8a6a43' : '#7a5b37'), 0.02 * i, ty + 0.19, 0));
    ty += 0.36;
  }
  const crown = group(0.06, ty, 0);
  const leafGeo = new THREE.ConeGeometry(0.17, 1.05, 4);
  for (let i = 0; i < 7; i++) {
    const spin = group();
    spin.rotation.y = (i / 7) * Math.PI * 2 + (x + z) * 0.3;
    const tilt = group();
    tilt.rotation.z = -1.2 - (i % 3) * 0.22;
    const leaf = mesh(leafGeo, mat(i % 2 ? C.leaf : C.leafLight), 0, 0.5, 0);
    leaf.scale.set(1, 1, 0.28);
    tilt.add(leaf);
    spin.add(tilt);
    crown.add(spin);
  }
  g.add(crown);
  return g;
}

function counter(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.88, d), mat(f.island ? '#56707a' : '#e9e3d6'), 0, 0.44, 0));
  g.add(mesh(box(w + 0.06, 0.07, d + 0.06), mat('#3b3f48', { roughness: 0.5 }), 0, 0.92, 0));
  const doors = Math.max(1, Math.round(w / 0.8));
  for (let i = 1; i < doors; i++) g.add(mesh(box(0.03, 0.7, 0.02), mat('#a9a294'), -w / 2 + (i * w) / doors, 0.45, d / 2 + 0.01, { cast: false }));
  if (!f.island) g.add(mesh(box(0.7, 0.04, 0.45), mat('#b9c2cc', { metalness: 0.5, roughness: 0.3 }), w * 0.2, 0.96, 0));
  return g;
}

function stove(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.9, d), mat('#d9dadf'), 0, 0.45, 0));
  g.add(mesh(box(w, 0.05, d), mat('#2b2e35'), 0, 0.92, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.14, 0.025, 4, 12), mat('#4a4d55'), sx * w * 0.24, 0.95, sz * d * 0.22, { rx: Math.PI / 2, cast: false }));
  g.add(mesh(box(w * 0.7, 0.35, 0.02), mat('#1b1d24', { roughness: 0.3 }), 0, 0.45, d / 2 + 0.01, { cast: false }));
  return g;
}

function fridge(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 2.3, d), mat('#e8ecf1', { roughness: 0.4, metalness: 0.2 }), 0, 1.15, 0));
  g.add(mesh(box(w, 0.03, 0.02), mat('#9aa0ab'), 0, 1.5, d / 2 + 0.01, { cast: false }));
  g.add(mesh(box(0.04, 0.9, 0.05), mat('#b9c2cc', { metalness: 0.6 }), w / 2 - 0.15, 1.95, d / 2 + 0.03));
  g.add(mesh(box(0.04, 0.7, 0.05), mat('#b9c2cc', { metalness: 0.6 }), w / 2 - 0.15, 0.95, d / 2 + 0.03));
  ['#e2b65a', '#c94b3a', '#3e6ea8', '#7fe3c6'].forEach((c, i) => g.add(mesh(box(0.1, 0.1, 0.02), mat(c), -w * 0.25 + (i % 2) * 0.25, 1.7 + Math.floor(i / 2) * 0.22, d / 2 + 0.02, { cast: false })));
  return g;
}

function daybed(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.32, d), mat('#5d3d28'), 0, 0.16, 0));
  g.add(mesh(box(w - 0.1, 0.16, d - 0.1), mat('#d9d2c2'), 0, 0.4, 0));
  g.add(mesh(box(0.55, 0.14, d * 0.6), mat('#f4f1ea'), w / 2 - 0.4, 0.52, 0));
  return g;
}

function crates(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  const cols = Math.max(1, Math.round(w / 1.1));
  const rows = Math.max(1, Math.round(d / 1.1));
  const cw = w / cols;
  const cd = d / rows;
  const colors = f.color ? [f.color, f.color] : ['#b98a55', '#a77b48', '#c4996a'];
  let k = 0;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const h = 0.7 + ((i * 7 + j * 3) % 3) * 0.25;
      g.add(mesh(box(cw - 0.06, h, cd - 0.06), mat(colors[k % colors.length]), -w / 2 + cw * (i + 0.5), h / 2, -d / 2 + cd * (j + 0.5), { ry: ((k % 3) - 1) * 0.05 }));
      if (!f.color && (i + j) % 2 === 0) g.add(mesh(box(cw * 0.6, 0.5, cd * 0.6), mat('#c9a676'), -w / 2 + cw * (i + 0.5), h + 0.25, -d / 2 + cd * (j + 0.5), { ry: 0.2 }));
      k += 1;
    }
  }
  return g;
}

function car(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  const paint = mat('#3b6fa8', { roughness: 0.4, metalness: 0.3 });
  g.add(mesh(box(w, 0.6, d - 0.1), paint, 0, 0.6, 0));
  g.add(mesh(box(w * 0.52, 0.5, d * 0.84), mat('#2e5687', { roughness: 0.4 }), -w * 0.05, 1.12, 0));
  g.add(mesh(box(w * 0.48, 0.38, d * 0.86), mat('#1d2633', { roughness: 0.15, metalness: 0.4 }), -w * 0.05, 1.12, 0, { cast: false }));
  const wheel = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(wheel, mat('#1c1d22'), sx * w * 0.32, 0.38, sz * (d / 2 - 0.12), { rx: Math.PI / 2 }));
  for (const sz of [-1, 1]) {
    g.add(mesh(box(0.05, 0.12, 0.35), mat('#fff6d8', { emissive: '#ffeaa0', emissiveIntensity: 0.6 }), w / 2 + 0.01, 0.65, sz * (d / 2 - 0.45), { cast: false }));
    g.add(mesh(box(0.05, 0.12, 0.35), mat('#c94b3a', { emissive: '#801010', emissiveIntensity: 0.5 }), -w / 2 - 0.01, 0.65, sz * (d / 2 - 0.45), { cast: false }));
  }
  return g;
}

function bench(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.08, d), mat('#a5794c'), 0, 0.9, 0));
  legs(g, w, d, 0.86, 0.1, '#5d3d28', 0.05);
  g.add(mesh(box(w - 0.2, 0.05, d - 0.1), mat('#8a6a43'), 0, 0.3, 0));
  g.add(mesh(box(w, 1.1, 0.05), mat('#b89668'), 0, 1.75, -d / 2 + 0.02));
  ['#c94b3a', '#3e6ea8', '#e2b65a', '#4e8b5c'].forEach((c, i) => g.add(mesh(box(0.08, 0.4, 0.04), mat(c), -w / 2 + 0.6 + i * 0.9, 1.75, -d / 2 + 0.06, { rz: 0.2 * (i - 1.5) })));
  g.add(mesh(box(0.5, 0.2, 0.3), mat('#c94b3a'), w / 4, 1.04, 0));
  return g;
}

function shelf(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  const metal = mat('#9aa0ab', { metalness: 0.5, roughness: 0.5 });
  for (let s = 0; s < 4; s++) g.add(mesh(box(w, 0.04, d), metal, 0, 0.2 + s * 0.65, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(box(0.05, 2.2, 0.05), metal, sx * (w / 2 - 0.03), 1.1, sz * (d / 2 - 0.03)));
  const colors = ['#e2b65a', '#3e6ea8', '#c94b3a', '#b98a55', '#4e8b5c'];
  for (let s = 0; s < 3; s++) for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.12, 0.12, 0.28, 8), mat(colors[(s + i) % 5]), -w / 2 + 0.5 + i * (w - 1) / 3, 0.36 + s * 0.65, 0));
  return g;
}

function trunk(f) {
  const { x, z, w, d } = center(f);
  const g = group(x, 0, z);
  g.add(mesh(box(w, 0.6, d), mat('#6b4630'), 0, 0.3, 0));
  const lid = mesh(new THREE.CylinderGeometry(d / 2, d / 2, w, 10, 1, false, 0, Math.PI), mat('#5d3d28'), 0, 0.6, 0, { rz: Math.PI / 2 });
  g.add(lid);
  for (const sx of [-0.3, 0.3]) g.add(mesh(box(0.08, 0.62, d + 0.02), mat('#d8c08a', { metalness: 0.6 }), sx * w, 0.31, 0));
  return g;
}

function block(f) {
  const { x, z, w, d } = center(f);
  const h = f.h || 1;
  const g = group(x, 0, z);
  g.add(mesh(box(w, h, d), mat(f.color || '#8a8f99'), 0, h / 2, 0));
  return g;
}

const BUILDERS = { bed, desk, sofa, coffeeTable, armchair, sideTable, diningTable, chair, crib, bookshelf, closet, beanbag, palm, counter, stove, fridge, daybed, crates, car, bench, shelf, trunk, block };

export function buildFurniture(f) {
  const make = BUILDERS[f.type];
  if (!make) return group();
  const g = make(f);
  g.name = f.id;
  return g;
}

// ------------------------------------------------------------- collectibles
export function snackModel(kind) {
  const g = group();
  switch (kind) {
    case 'cookie': {
      g.add(mesh(cyl(0.24, 0.24, 0.07, 10), mat('#c58a4a'), 0, 0, 0, { rx: 1.2 }));
      for (let i = 0; i < 5; i++) g.add(mesh(box(0.05, 0.05, 0.05), mat('#3b2216'), Math.cos(i * 1.3) * 0.12, Math.sin(i * 1.3) * 0.12, 0.05));
      break;
    }
    case 'chips': {
      g.add(mesh(box(0.34, 0.44, 0.14), mat('#e8a33a'), 0, 0, 0));
      g.add(mesh(box(0.36, 0.05, 0.08), mat('#c4352f'), 0, 0.23, 0));
      g.add(mesh(box(0.36, 0.05, 0.08), mat('#c4352f'), 0, -0.23, 0));
      g.add(mesh(ico(0.08, 0), mat('#f6d26b'), 0, 0.02, 0.08));
      break;
    }
    case 'choco': {
      g.add(mesh(box(0.5, 0.2, 0.08), mat('#6b3b22'), 0, 0, 0));
      g.add(mesh(box(0.22, 0.21, 0.09), mat('#c8423a'), 0.08, 0, 0));
      break;
    }
    case 'juice': {
      g.add(mesh(box(0.2, 0.32, 0.13), mat('#5fbf6a'), 0, 0, 0));
      g.add(mesh(box(0.21, 0.1, 0.14), mat('#f2e8c9'), 0, 0.02, 0));
      g.add(mesh(cyl(0.015, 0.015, 0.18, 4), mat('#ffffff'), 0.05, 0.22, 0, { rz: 0.3 }));
      break;
    }
    case 'donut': {
      g.add(mesh(new THREE.TorusGeometry(0.15, 0.08, 6, 12), mat('#d9a86a'), 0, 0, 0));
      g.add(mesh(new THREE.TorusGeometry(0.15, 0.06, 6, 12), mat('#f08fb0'), 0, 0, 0.04));
      break;
    }
    case 'stash': {
      const gold = mat('#e2b65a', { emissive: '#7a5a10', emissiveIntensity: 0.6, metalness: 0.3 });
      g.add(mesh(box(0.56, 0.34, 0.42), gold, 0, 0, 0));
      g.add(mesh(box(0.6, 0.1, 0.46), mat('#f2d27a', { emissive: '#7a5a10', emissiveIntensity: 0.5 }), 0, 0.2, 0));
      g.add(mesh(box(0.08, 0.46, 0.47), mat('#c94b3a'), 0, 0.03, 0));
      g.add(mesh(box(0.61, 0.11, 0.08), mat('#c94b3a'), 0, 0.2, 0));
      g.add(mesh(new THREE.TorusGeometry(0.08, 0.03, 4, 10), mat('#c94b3a'), -0.06, 0.32, 0, { rz: 0.6 }));
      g.add(mesh(new THREE.TorusGeometry(0.08, 0.03, 4, 10), mat('#c94b3a'), 0.06, 0.32, 0, { rz: -0.6 }));
      break;
    }
    case 'popcorn':
    default: {
      g.add(mesh(cyl(0.17, 0.12, 0.3, 8), mat('#d94343'), 0, 0, 0));
      for (let i = 0; i < 7; i++) g.add(mesh(ico(0.06, 0), mat('#fff3d6'), Math.cos(i) * 0.1, 0.17 + (i % 2) * 0.04, Math.sin(i) * 0.1));
      break;
    }
  }
  return g;
}

export function toyModel(kind) {
  const g = group();
  if (kind === 'bone') {
    const pink = mat('#f06aa0');
    g.add(mesh(cyl(0.05, 0.05, 0.32, 6), pink, 0, 0.07, 0, { rz: Math.PI / 2 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(ico(0.065, 0), pink, sx * 0.17, 0.07, sz * 0.05));
  } else {
    g.add(mesh(ico(0.14, 1), mat('#ffd23f'), 0, 0.14, 0));
    g.add(mesh(new THREE.TorusGeometry(0.14, 0.02, 4, 12), mat('#3e6ea8'), 0, 0.14, 0, { rx: Math.PI / 2 }));
  }
  return g;
}
