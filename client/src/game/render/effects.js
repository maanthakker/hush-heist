import * as THREE from 'three';
import { textTexture } from './textures.js';

// Short-lived visuals: sound rings, the Shh wave, floating words.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.ringGeo = new THREE.RingGeometry(0.9, 1, 48);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.thickRingGeo = new THREE.RingGeometry(0.7, 1, 64);
    this.thickRingGeo.rotateX(-Math.PI / 2);
  }

  ring(x, z, radius, color, { duration = 0.7, opacity = 0.6, y = 0.06, thick = false, from = 0.2 } = {}) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const m = new THREE.Mesh(thick ? this.thickRingGeo : this.ringGeo, material);
    m.position.set(x, y, z);
    m.scale.setScalar(Math.max(0.01, from));
    m.renderOrder = 2;
    this.scene.add(m);
    this.items.push({ obj: m, material, life: 0, duration, from, to: radius, opacity, kind: 'ring' });
  }

  text(str, x, y, z, color = '#ffffff', { duration = 1.1, rise = 1.1, size = 1.2 } = {}) {
    const material = new THREE.SpriteMaterial({ map: textTexture(str, color), transparent: true, depthWrite: false, depthTest: false });
    const s = new THREE.Sprite(material);
    s.position.set(x, y, z);
    s.scale.set(size * 2, size, 1);
    s.renderOrder = 5;
    this.scene.add(s);
    this.items.push({ obj: s, material, life: 0, duration, startY: y, rise, kind: 'text', opacity: 1 });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life += dt;
      const k = Math.min(1, it.life / it.duration);
      if (it.kind === 'ring') {
        const ease = 1 - (1 - k) * (1 - k);
        it.obj.scale.setScalar(Math.max(0.01, it.from + (it.to - it.from) * ease));
        it.material.opacity = it.opacity * (1 - k);
      } else {
        it.obj.position.y = it.startY + it.rise * k;
        it.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      }
      if (k >= 1) {
        this.scene.remove(it.obj);
        it.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) {
      this.scene.remove(it.obj);
      it.material.dispose();
    }
    this.items = [];
  }

  dispose() {
    this.clear();
    this.ringGeo.dispose();
    this.thickRingGeo.dispose();
  }
}
