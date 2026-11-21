import * as THREE from 'three';
import { box, cyl, group, ico, mat, mesh } from './kit.js';

const approach = (v, target, rate, dt) => v + (target - v) * Math.min(1, dt * rate);

// --------------------------------------------------------------- sleepers
const LOOKS = {
  dad: { skin: '#a8714f', hair: '#1b1414', blanket: '#8a3b3b', fold: '#d9b36b', longHair: false },
  sis: { skin: '#b07a58', hair: '#1f1512', blanket: '#7262c9', fold: '#e8ddff', longHair: true },
  baby: { skin: '#c18a66', hair: '#3a2a22', blanket: '#f4c7d8', fold: '#ffffff', longHair: false },
  mom: { skin: '#b07a58', hair: '#1f1512', blanket: '#3b7a6a', fold: '#e8ddcf', longHair: true },
  bro: { skin: '#b98261', hair: '#1a1414', blanket: '#e0a33b', fold: '#ffffff', longHair: false },
  uncle: { skin: '#9c6648', hair: '#222222', blanket: '#56653a', fold: '#d9b36b', longHair: false, mustache: '#222222' },
  bigbro: { skin: '#a8714f', hair: '#141012', blanket: '#c94b3a', fold: '#f1e9dd', longHair: false },
  grandpa: { skin: '#a87a5c', hair: '#dedad2', blanket: '#6b4f8a', fold: '#e8ddff', longHair: false, mustache: '#dedad2' },
};

// A family member asleep on their back. Head points along +x before def.rot.
export class SleeperView {
  constructor(def) {
    const L = LOOKS[def.look] || LOOKS.dad;
    this.def = def;
    this.root = group(def.x, def.y, def.z);
    this.root.rotation.y = def.rot;
    this.root.scale.setScalar(def.scale);

    const blanket = mat(L.blanket);
    const skin = mat(L.skin);
    const hair = mat(L.hair);
    // The pillow stays on the bed; the figure can get up and walk (chase!).
    this.pillow = mesh(box(0.5, 0.12, 0.62), mat('#f1ece2'), def.x, def.y + 0.1 * def.scale, def.z);
    this.pillow.scale.setScalar(def.scale);
    this.figure = group();
    this.root.add(this.figure);
    this.figure.add(mesh(new THREE.CapsuleGeometry(0.24, 0.6, 3, 8), blanket, -0.55, 0.24, 0, { rz: Math.PI / 2 }));

    this.upper = group(-0.1, 0.24, 0);
    this.figure.add(this.upper);
    this.chest = mesh(new THREE.CapsuleGeometry(0.26, 0.2, 3, 8), blanket, 0.28, 0, 0, { rz: Math.PI / 2 });
    this.upper.add(this.chest);
    this.upper.add(mesh(box(0.14, 0.1, 0.6), mat(L.fold), 0.5, 0.2, 0));
    for (const s of [-1, 1]) {
      this.upper.add(mesh(new THREE.CapsuleGeometry(0.06, 0.3, 2, 6), skin, 0.32, 0.25, s * 0.2, { rz: Math.PI / 2 }));
    }
    this.headGroup = group(0.85, 0.06, 0);
    this.upper.add(this.headGroup);
    this.headGroup.add(mesh(ico(0.22, 1), skin, 0, 0, 0));
    // Hair covers the crown and the back of the head (on the pillow), never the face.
    this.headGroup.add(mesh(new THREE.SphereGeometry(0.235, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0.01, -0.01, 0, { rz: -Math.PI / 2 - 0.6 }));
    if (L.longHair) this.headGroup.add(mesh(box(0.4, 0.05, 0.42), hair, 0.28, -0.16, 0));

    // Eyes on the upward-facing face: closed lines and (hidden) open eyes.
    this.closedEyes = group();
    this.openEyes = group();
    const lid = box(0.03, 0.015, 0.08);
    const eye = box(0.05, 0.03, 0.06);
    for (const s of [-1, 1]) {
      this.closedEyes.add(mesh(lid, mat('#2a1a14'), 0.05, 0.215, s * 0.08, { cast: false }));
      this.openEyes.add(mesh(eye, mat('#ffffff'), 0.05, 0.215, s * 0.08, { cast: false }));
      this.openEyes.add(mesh(box(0.03, 0.02, 0.03), mat('#1a0f0a'), 0.05, 0.232, s * 0.08, { cast: false }));
    }
    this.openEyes.visible = false;
    this.headGroup.add(this.closedEyes, this.openEyes);
    // Grandpa's one open eye (Attic boss): glows while it watches.
    this.oneEye = group();
    this.oneEye.add(mesh(box(0.06, 0.035, 0.07), mat('#fff7d6', { emissive: '#ffcf5a', emissiveIntensity: 1.4 }), 0.05, 0.218, 0.08, { cast: false }));
    this.oneEye.visible = false;
    this.headGroup.add(this.oneEye);
    if (L.mustache) this.headGroup.add(mesh(box(0.05, 0.03, 0.16), mat(L.mustache), -0.08, 0.205, 0, { cast: false }));
    this.headGroup.add(mesh(box(0.06, 0.05, 0.05), mat(L.skin), -0.03, 0.22, 0, { cast: false }));
    this.headGroup.add(mesh(box(0.025, 0.012, 0.08), mat('#5a2622'), -0.12, 0.19, 0, { cast: false }));

    this.sit = 0;
    this.stand = 0;
    this.walk = 0;
  }

  reset() {
    this.sit = 0;
    this.stand = 0;
    this.figure.rotation.set(0, 0, 0);
    this.figure.position.set(0, 0, 0);
    this.root.position.set(this.def.x, this.def.y, this.def.z);
    this.root.rotation.y = this.def.rot;
    this.upper.rotation.set(0, 0, 0);
    this.openEyes.visible = false;
    this.closedEyes.visible = true;
  }

  update(dt, s, t, eyeOpen = false) {
    this.oneEye.visible = eyeOpen && s.stage !== 'awake';
    const up = s.state === 'chasing' || s.state === 'searching' || s.state === 'returning';
    const crying = s.state === 'crying';
    this.stand = approach(this.stand, up ? 1 : 0, 6, dt);
    const awake = crying;
    this.sit = approach(this.sit, awake ? 1 : 0, 5, dt);
    // Standing up: tip the whole lying figure upright and shuffle along.
    const moving = up && s.stun <= 0 && s.state !== 'searching';
    if (moving) this.walk += dt * 9;
    const bob = moving ? Math.abs(Math.sin(this.walk)) * 0.06 : 0;
    this.figure.rotation.z = this.stand * (Math.PI / 2);
    this.figure.rotation.x = moving ? Math.sin(this.walk) * 0.08 : s.stun > 0 ? Math.sin(t * 5) * 0.12 : 0;
    this.figure.position.y = this.stand * 1.1 + bob;
    if (this.stand > 0.02) {
      this.root.position.set(s.x, this.def.y * (1 - this.stand), s.z);
      this.root.rotation.y = this.stand > 0.5 ? s.heading + Math.PI / 2 : this.def.rot;
    } else {
      this.root.position.set(this.def.x, this.def.y, this.def.z);
      this.root.rotation.y = this.def.rot;
    }
    if (up) {
      this.upper.rotation.set(0, 0, 0);
      this.openEyes.visible = true;
      this.closedEyes.visible = false;
      return;
    }
    const breathe = Math.sin(t * 1.6 + this.def.x) * 0.05;
    this.chest.scale.set(1, 1 + breathe, 1 + breathe);
    let wobble = 0;
    let lift = 0;
    if (s.stage === 'stirring') wobble = Math.sin(t * 6) * 0.05;
    if (s.stage === 'waking') {
      wobble = Math.sin(t * 13) * 0.07;
      lift = 0.14;
    }
    this.upper.rotation.x = wobble;
    this.upper.rotation.z = lift + this.sit * 1.15;
    const peek = s.stage === 'waking' && Math.sin(t * 9) > 0.2;
    this.openEyes.visible = awake || peek;
    this.closedEyes.visible = !this.openEyes.visible;
  }
}

// -------------------------------------------------------------------- cat
export class CatView {
  constructor() {
    this.root = group();
    this.body = group();
    this.root.add(this.body);
    const fur = mat('#6f7380');
    const dark = mat('#4b4e58');
    const torso = mesh(new THREE.CapsuleGeometry(0.16, 0.38, 3, 8), fur, 0, 0.3, 0, { rx: Math.PI / 2 });
    this.body.add(torso);
    for (let i = 0; i < 3; i++) this.body.add(mesh(box(0.34, 0.03, 0.06), dark, 0, 0.45, -0.15 + i * 0.13, { cast: false }));
    this.legs = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = mesh(cyl(0.035, 0.035, 0.26, 5), fur, sx * 0.09, 0.13, sz * 0.17);
        this.legs.push(leg);
        this.body.add(leg);
      }
    }
    this.head = group(0, 0.45, 0.33);
    this.body.add(this.head);
    this.head.add(mesh(ico(0.16, 0), fur, 0, 0, 0));
    for (const s of [-1, 1]) this.head.add(mesh(new THREE.ConeGeometry(0.06, 0.13, 4), fur, s * 0.08, 0.15, -0.01, { rz: -s * 0.2 }));
    this.eyes = group(0, 0.02, 0.135);
    const eyeMat = mat('#d4ff70', { emissive: '#a8e040', emissiveIntensity: 1.2 });
    for (const s of [-1, 1]) this.eyes.add(mesh(box(0.05, 0.035, 0.02), eyeMat, s * 0.06, 0, 0, { cast: false }));
    this.head.add(this.eyes);
    this.head.add(mesh(box(0.03, 0.02, 0.02), mat('#e88aa0'), 0, -0.04, 0.155, { cast: false }));
    this.tail = group(0, 0.36, -0.32);
    this.body.add(this.tail);
    const seg = cyl(0.035, 0.03, 0.2, 5);
    let parent = this.tail;
    this.tailSegs = [];
    for (let i = 0; i < 3; i++) {
      const joint = group(0, i === 0 ? 0 : 0.18, 0);
      joint.add(mesh(seg, i === 2 ? dark : fur, 0, 0.09, 0));
      parent.add(joint);
      this.tailSegs.push(joint);
      parent = joint;
    }
    this.tail.rotation.x = -0.9;
    this.rest = 0;
    this.alertW = 0;
    this.walk = 0;
  }

  update(dt, c, t) {
    this.root.position.set(c.x, 0, c.z);
    this.root.rotation.y = c.heading;
    const resting = c.state === 'nap' || c.state === 'calmed';
    this.rest = approach(this.rest, resting ? 1 : 0, 4, dt);
    this.alertW = approach(this.alertW, c.state === 'alert' ? 1 : 0, 8, dt);
    if (c.state === 'patrol') this.walk += dt * 9;
    const step = Math.sin(this.walk) * 0.5 * (1 - this.rest);
    this.legs.forEach((leg, i) => {
      leg.rotation.x = (i % 2 ? step : -step) * (i < 2 ? 1 : -1);
      leg.visible = this.rest < 0.7;
    });
    this.body.position.y = -this.rest * 0.16 + this.alertW * 0.08;
    this.body.rotation.x = -this.alertW * 0.12;
    this.head.rotation.x = this.rest * 0.35;
    this.eyes.scale.y = lerp(1, 0.15, this.rest) * (1 + this.alertW * 0.6);
    this.tail.rotation.x = lerp(-0.9, -0.2, this.alertW) + this.rest * 0.8;
    this.tail.rotation.z = Math.sin(t * 2.2) * 0.35 * (1 - this.rest);
    this.tailSegs.forEach((j, i) => {
      j.rotation.x = -0.25 - this.rest * 0.4 + Math.sin(t * 2 + i) * 0.1;
    });
  }
}

// ------------------------------------------------------------ robot vacuum
export class VacuumView {
  constructor({ mower = false } = {}) {
    this.root = group();
    this.base = mower ? '#ffd23f' : '#4fd6ff';
    if (mower) {
      this.root.scale.setScalar(1.25);
      this.root.add(mesh(box(0.7, 0.28, 0.9), mat('#3f8a4f', { roughness: 0.5 }), 0, 0.22, -0.05));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.root.add(mesh(cyl(0.13, 0.13, 0.08, 10), mat('#1c1d22'), sx * 0.38, 0.13, sz * 0.32, { rz: Math.PI / 2 }));
    }
    this.root.add(mesh(cyl(0.45, 0.47, 0.13, 20), mat(mower ? '#2f6b3d' : '#2b2e35', { roughness: 0.5 }), 0, 0.09, 0));
    this.root.add(mesh(cyl(0.36, 0.36, 0.02, 20), mat('#3b3f48', { roughness: 0.4 }), 0, 0.16, 0));
    this.ringMat = new THREE.MeshStandardMaterial({ color: this.base, emissive: this.base, emissiveIntensity: 1.2, flatShading: true });
    this.root.add(mesh(new THREE.TorusGeometry(0.27, 0.025, 6, 24), this.ringMat, 0, 0.17, 0, { rx: Math.PI / 2, cast: false }));
    this.root.add(mesh(box(0.6, 0.08, 0.12), mat('#9aa0ab'), 0, 0.08, 0.38));
    this.lamp = mesh(box(0.22, 0.05, 0.04), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 2 }), 0, 0.12, 0.45, { cast: false });
    this.root.add(this.lamp);
    this.brush = mesh(box(0.5, 0.02, 0.04), mat('#c94b3a'), 0, 0.03, 0.3, { cast: false });
    this.root.add(this.brush);
  }

  update(dt, c, t) {
    this.root.position.set(c.x, 0, c.z);
    this.root.rotation.y = c.heading;
    const alert = c.state === 'alert';
    const color = alert ? (Math.sin(t * 20) > 0 ? '#ff4d4d' : '#ffb84d') : this.base;
    this.ringMat.color.set(color);
    this.ringMat.emissive.set(color);
    this.brush.rotation.y = t * 12;
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
