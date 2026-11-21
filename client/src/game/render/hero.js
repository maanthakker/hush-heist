import * as THREE from 'three';
import { box, cyl, group, ico, mat, mesh } from './kit.js';
import { outfitShirt } from './textures.js';
import { DEFAULT_LOOK, HAIR_BY_ID, OUTFITS, OUTFIT_BY_ID } from '@shared/catalog.js';

// The hero: a low-poly kid with thick black hair, short sides and a choppy fringe,
// a brown shirt with white and salmon-pink stripes, and a sly one-eyebrow-up look.
// Phase 2: knees, blinking, emotes. Phase 5: outfits and hair colors.
export const HERO_COLORS = { skin: '#b97c5a', skinShade: '#a26a4a', socks: '#ececf3' };

const DOWN = new THREE.Vector3(0, -1, 0);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, target, rate, dt) => v + (target - v) * Math.min(1, dt * rate);

export class HeroModel {
  constructor(look = DEFAULT_LOOK) {
    const outfit = OUTFIT_BY_ID[look?.outfit] || OUTFITS[0];
    const hairColor = (HAIR_BY_ID[look?.hair] || HAIR_BY_ID.black).color;
    this.root = new THREE.Group();
    this.body = group();
    this.root.add(this.body);

    this.shirtTexture = outfitShirt(outfit);
    const shirt = new THREE.MeshStandardMaterial({ map: this.shirtTexture, roughness: 0.9, flatShading: true });
    this.ownMaterials = [shirt];
    const skin = mat(HERO_COLORS.skin);
    const skinShade = mat(HERO_COLORS.skinShade);
    const hair = mat(hairColor, { roughness: 0.7 });
    const pants = mat(outfit.pants);

    // Legs: hip -> knee, in socks (perfect for sneaking).
    this.legs = [0.12, -0.12].map((x) => {
      const hip = group(x, 0.62, 0);
      hip.add(mesh(box(0.17, 0.3, 0.19), pants, 0, -0.14, 0));
      const knee = group(0, -0.28, 0);
      knee.add(mesh(box(0.16, 0.26, 0.18), pants, 0, -0.12, 0));
      const foot = group(0, -0.28, 0.04);
      foot.add(mesh(box(0.18, 0.08, 0.3), mat(HERO_COLORS.socks), 0, 0, 0));
      knee.add(foot);
      hip.add(knee);
      this.body.add(hip);
      return { hip, knee, foot };
    });
    this.body.add(mesh(box(0.42, 0.18, 0.24), pants, 0, 0.66, 0));

    this.torso = mesh(box(0.5, 0.52, 0.28), shirt, 0, 0.98, 0);
    this.body.add(this.torso);
    this.body.add(mesh(box(0.3, 0.05, 0.2), mat(outfit.bands?.[0] || '#f1e9dd'), 0, 1.25, 0.02));
    this.body.add(mesh(cyl(0.08, 0.09, 0.1, 6), skin, 0, 1.29, 0));
    if (outfit.hood) this.body.add(mesh(box(0.42, 0.2, 0.14), mat(outfit.bands[0]), 0, 1.28, -0.18));
    if (outfit.spikes) {
      for (let i = 0; i < 5; i++) this.body.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 4), mat('#f2d27a'), 0, 1.3 - i * 0.14, -0.17, { rx: -0.6 }));
    }

    // Head
    this.head = group(0, 1.53, 0);
    this.body.add(this.head);
    const skull = mesh(ico(0.31, 1), skin, 0, 0, 0);
    skull.scale.set(1, 1.04, 0.96);
    this.head.add(skull);
    for (const s of [-1, 1]) this.head.add(mesh(box(0.07, 0.12, 0.07), skin, s * 0.31, 0, 0));

    // Face: half-lidded side-eye, left eyebrow up, a little smirk.
    const white = mat('#f5f2ec');
    const pupil = mat('#1a0f0a');
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eye = group(s * 0.1, 0.03, 0.29);
      eye.add(mesh(box(0.085, 0.055, 0.02), white, 0, 0, 0, { cast: false }));
      eye.add(mesh(box(0.04, 0.05, 0.02), pupil, 0.022, -0.005, 0.008, { cast: false }));
      this.head.add(eye);
      this.eyes.push(eye);
      this.head.add(mesh(box(0.1, 0.03, 0.025), skinShade, s * 0.1, 0.062, 0.298, { cast: false }));
    }
    this.browL = mesh(box(0.12, 0.035, 0.03), hair, 0.1, 0.165, 0.278, { rz: 0.28, cast: false });
    this.browR = mesh(box(0.12, 0.035, 0.03), hair, -0.1, 0.125, 0.28, { rz: 0.1, cast: false });
    this.head.add(this.browL, this.browR);
    this.head.add(mesh(box(0.06, 0.08, 0.05), skinShade, 0, -0.02, 0.3, { cast: false }));
    this.mouth = mesh(box(0.1, 0.025, 0.02), mat('#5a2622'), 0.035, -0.12, 0.276, { rz: 0.2, cast: false });
    this.head.add(this.mouth);
    if (outfit.mask) {
      this.head.add(mesh(box(0.56, 0.15, 0.5), mat('#1c1d26'), 0, -0.09, 0.03));
      this.head.add(mesh(new THREE.TorusGeometry(0.31, 0.03, 4, 16), mat('#c94b3a'), 0, 0.2, 0, { rx: Math.PI / 2 }));
    }

    // Hair: thick top, short sides, choppy fringe.
    const cap = mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), hair, 0, 0.02, 0, { rx: -0.4 });
    cap.scale.set(1.02, 1.05, 1.05);
    this.head.add(cap);
    const volume = mesh(new THREE.SphereGeometry(0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.16, -0.02, { rx: -0.35 });
    volume.scale.set(1.05, 0.7, 1.08);
    this.head.add(volume);
    const spike = new THREE.ConeGeometry(0.055, 0.13, 4);
    [0.9, 1.25, 0.8, 1.15, 0.95, 1.3, 0.85].forEach((len, i) => {
      const holder = group();
      holder.rotation.y = -0.75 + i * 0.25;
      const m = mesh(spike, hair, 0, 0.215, 0.3, { rx: Math.PI - 0.5 });
      m.scale.y = len;
      holder.add(m);
      this.head.add(holder);
    });
    const tuft = new THREE.ConeGeometry(0.075, 0.17, 4);
    [[0.1, 0.33, 0.06], [-0.1, 0.34, 0.04], [0, 0.36, -0.06], [0.14, 0.28, -0.12], [-0.14, 0.28, -0.12]].forEach(([x, y, z], i) => {
      this.head.add(mesh(tuft, hair, x, y, z, { rx: -0.6, rz: (i - 2) * 0.25 }));
    });
    if (outfit.hat) {
      this.head.add(mesh(cyl(0.27, 0.25, 0.32, 10), mat('#f7f5ef'), 0, 0.42, -0.03));
      this.head.add(mesh(ico(0.24, 1), mat('#f7f5ef'), 0, 0.62, -0.03));
    }

    this.armL = this.makeArm(0.32, shirt, skin, false);
    this.armR = this.makeArm(-0.32, shirt, skin, true);

    this.computeShhPose();
    Object.assign(this, { phase: 0, moveW: 0, tipW: 0, runW: 0, poseW: 0, emoteW: 0, time: Math.random() * 10, blink: 0, lastEmote: null });
    this.euler = new THREE.Euler();
    this.quat = new THREE.Quaternion();
  }

  makeArm(x, shirt, skin, right) {
    const shoulder = group(x, 1.2, 0);
    shoulder.add(mesh(box(0.15, 0.3, 0.16), shirt, 0, -0.14, 0));
    const elbow = group(0, -0.28, 0);
    elbow.add(mesh(box(0.12, 0.24, 0.13), skin, 0, -0.12, 0));
    elbow.add(mesh(box(0.13, 0.11, 0.13), skin, 0, -0.29, 0));
    elbow.add(mesh(box(0.04, 0.07, 0.05), skin, right ? 0.08 : -0.08, -0.27, 0.04));
    let finger = null;
    let thumb = null;
    if (right) {
      finger = mesh(box(0.04, 0.13, 0.04), skin, 0, -0.4, 0.02);
      finger.visible = false;
      thumb = mesh(box(0.045, 0.1, 0.045), skin, 0, -0.29, 0.1, { rx: -1.5 });
      thumb.visible = false;
      elbow.add(finger, thumb);
    }
    shoulder.add(elbow);
    this.body.add(shoulder);
    return { shoulder, elbow, finger, thumb };
  }

  computeShhPose() {
    const S = new THREE.Vector3(-0.32, 1.2, 0);
    const E = new THREE.Vector3(-0.2, 1.0, 0.26);
    const lips = new THREE.Vector3(-0.01, 1.43, 0.33);
    const d1 = E.clone().sub(S).normalize();
    const elbowAt = S.clone().addScaledVector(d1, 0.28);
    const d2 = lips.clone().sub(elbowAt).normalize();
    this.shhShoulder = new THREE.Quaternion().setFromUnitVectors(DOWN, d1);
    const forearm = new THREE.Quaternion().setFromUnitVectors(DOWN, d2);
    this.shhElbow = this.shhShoulder.clone().invert().multiply(forearm);
  }

  setArm(arm, sx, sz, ex, poseShoulder, poseElbow, w) {
    this.quat.setFromEuler(this.euler.set(sx, 0, sz));
    arm.shoulder.quaternion.copy(this.quat);
    if (poseShoulder && w > 0) arm.shoulder.quaternion.slerp(poseShoulder, w);
    this.quat.setFromEuler(this.euler.set(ex, 0, 0));
    arm.elbow.quaternion.copy(this.quat);
    if (poseElbow && w > 0) arm.elbow.quaternion.slerp(poseElbow, w);
  }

  /** s = { moving, mode: 'tiptoe'|'walk'|'run', posing, emote } */
  update(dt, s) {
    this.time += dt;
    const t = this.time;
    const mode = s.mode || 'walk';
    const em = s.emote && s.emote !== 'shh' ? s.emote : null;
    if (em) this.lastEmote = em;
    this.moveW = approach(this.moveW, s.moving ? 1 : 0, 10, dt);
    this.tipW = approach(this.tipW, mode === 'tiptoe' ? 1 : 0, 8, dt);
    this.runW = approach(this.runW, mode === 'run' && s.moving ? 1 : 0, 8, dt);
    this.poseW = approach(this.poseW, s.posing || s.emote === 'shh' ? 1 : 0, 14, dt);
    this.emoteW = approach(this.emoteW, em ? 1 : 0, 10, dt);
    const E = this.lastEmote;
    const ew = this.emoteW;

    const rate = mode === 'run' ? 14 : mode === 'tiptoe' ? 6.5 : 9.5;
    if (s.moving) this.phase += dt * rate;
    const sw = Math.sin(this.phase);
    const amp = (mode === 'run' ? 0.95 : mode === 'tiptoe' ? 0.4 : 0.6) * this.moveW;

    const dance = E === 'dance' ? ew : 0;
    this.legs.forEach((leg, i) => {
      const side = i === 0 ? 1 : -1;
      const swing = side * sw * amp + dance * Math.sin(t * 8 + i * Math.PI) * 0.35;
      leg.hip.rotation.x = swing;
      leg.knee.rotation.x = Math.max(0, -side * Math.sin(this.phase + 0.6)) * amp * 1.3 + this.tipW * 0.25;
      leg.foot.rotation.x = this.tipW * 0.45;
    });

    const bob = Math.abs(Math.cos(this.phase)) * (0.04 + this.runW * 0.04) * this.moveW + dance * Math.abs(Math.sin(t * 8)) * 0.08;
    this.body.position.y = bob - this.tipW * 0.1 * (1 - ew);
    this.body.rotation.x = (this.runW * 0.22 + this.tipW * 0.14) * (1 - this.poseW) * (1 - ew);
    this.body.rotation.y = dance * Math.sin(t * 4) * 0.6;
    this.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.012;

    // Base arms: swing, or "sneaky hands" up when tiptoeing.
    const swing = -sw * amp * 0.9;
    const sneakS = -0.7 + sw * 0.08 * this.moveW;
    const runE = -0.2 - this.runW * 1.0;
    let L = [lerp(-swing, sneakS, this.tipW), 0.08, lerp(runE, -1.35, this.tipW)];
    let R = [lerp(swing, sneakS, this.tipW), -0.08, lerp(runE, -1.35, this.tipW)];
    let eL = null;
    let eR = null;
    if (E === 'wave') eR = [0, -2.7, -0.4 + Math.sin(t * 12) * 0.45];
    if (E === 'dance') {
      eR = [0, -2.4 + Math.sin(t * 8) * 0.4, -0.3];
      eL = [0, 2.4 + Math.sin(t * 8 + Math.PI) * 0.4, -0.3];
    }
    if (E === 'shrug') {
      eR = [-0.2, -0.45, -1.6];
      eL = [-0.2, 0.45, -1.6];
    }
    if (E === 'thumbs') eR = [-1.45, -0.05, -0.15];
    if (eR) R = R.map((v, i) => lerp(v, eR[i], ew));
    if (eL) L = L.map((v, i) => lerp(v, eL[i], ew));
    this.setArm(this.armL, L[0], L[1], L[2], null, null, 0);
    this.setArm(this.armR, R[0], R[1], R[2], this.shhShoulder, this.shhElbow, this.poseW);
    this.armR.finger.visible = this.poseW > 0.35;
    this.armR.thumb.visible = E === 'thumbs' && ew > 0.4;

    this.head.rotation.z = this.poseW * 0.12 + (E === 'shrug' ? ew * 0.18 : 0);
    this.head.rotation.y = Math.sin(t * 0.7) * 0.15 * (1 - this.moveW) * (1 - this.poseW) * (1 - ew);
    this.head.rotation.x = -this.poseW * 0.05;
    this.browL.position.y = 0.165 + this.poseW * 0.02 + (E === 'shrug' ? ew * 0.03 : 0);

    // Blink every few seconds.
    this.blink -= dt;
    if (this.blink < -0.12) this.blink = 2.5 + Math.random() * 2.5;
    const closed = this.blink < 0;
    for (const eye of this.eyes) eye.scale.y = closed ? 0.15 : 1;
  }

  dispose() {
    this.shirtTexture.dispose();
    this.ownMaterials.forEach((m) => m.dispose());
  }
}
