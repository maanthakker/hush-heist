import * as THREE from 'three';

// All textures are painted at runtime on <canvas>, so the repo ships zero image assets.

function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  return tex;
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// --- Palm-leaf wallpaper -----------------------------------------------------
function frond(ctx, x, y, angle, len, color, droop = 0.35) {
  const steps = 14;
  let px = x;
  let py = y;
  let a = angle;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const seg = len / steps;
    const nx = px + Math.cos(a) * seg;
    const ny = py + Math.sin(a) * seg;
    ctx.lineWidth = 2.2 * (1 - t) + 0.6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    const leaf = len * 0.32 * Math.sin(Math.PI * (0.15 + t * 0.85)) * (1 - t * 0.4);
    ctx.lineWidth = 1.4;
    for (const side of [-1, 1]) {
      const la = a + side * (1.05 - t * 0.25) + droop * 0.6;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.quadraticCurveTo(
        nx + Math.cos(la - side * 0.2) * leaf * 0.6,
        ny + Math.sin(la - side * 0.2) * leaf * 0.6,
        nx + Math.cos(la) * leaf,
        ny + Math.sin(la) * leaf + leaf * droop * 0.5,
      );
      ctx.stroke();
    }
    px = nx;
    py = ny;
    a += droop * 0.09;
  }
}

function palmTree(ctx, x, baseY, height, gold, dark) {
  ctx.strokeStyle = dark;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + height * 0.12, baseY - height * 0.5, x + height * 0.04, baseY - height);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    const tx = x + height * 0.12 * 2 * t * (1 - t) + height * 0.04 * t * t;
    const ty = baseY - height * t;
    ctx.beginPath();
    ctx.moveTo(tx - 4, ty);
    ctx.lineTo(tx + 4, ty - 2);
    ctx.stroke();
  }
  const topX = x + height * 0.04;
  const topY = baseY - height;
  const angles = [-2.9, -2.4, -1.9, -1.4, -0.9, -0.4, 0.1];
  angles.forEach((a, i) => frond(ctx, topX, topY, a, height * (0.5 + (i % 2) * 0.12), i % 2 ? gold : dark, 0.5));
}

export function palmWallpaper() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ecdfbd';
    ctx.fillRect(0, 0, w, h);
    const gold = '#c79a4b';
    const dark = '#a77a35';
    const light = '#dcbf7f';
    const motifs = [
      () => palmTree(ctx, 110, 470, 300, gold, dark),
      () => palmTree(ctx, 360, 250, 220, light, gold),
      () => frond(ctx, 250, 500, -1.2, 170, light, 0.6),
      () => frond(ctx, 470, 470, -2.0, 140, gold, 0.6),
      () => frond(ctx, 40, 230, -0.6, 120, light, 0.7),
      () => frond(ctx, 300, 120, -2.6, 110, dark, 0.5),
    ];
    // Draw each motif at the wrap offsets so the pattern tiles seamlessly.
    for (const dx of [-w, 0, w]) {
      for (const dy of [-h, 0, h]) {
        ctx.save();
        ctx.translate(dx, dy);
        motifs.forEach((m) => m());
        ctx.restore();
      }
    }
  });
}

// --- Wooden floor ------------------------------------------------------------
export function woodFloor({ base = '#5e4330', light = false } = {}) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const rand = seeded(light ? 91 : 17);
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rand() * 200;
      while (x < w) {
        const len = 140 + rand() * 160;
        const shade = 0.85 + rand() * 0.3;
        const c = new THREE.Color(base).multiplyScalar(light ? shade * 1.35 : shade);
        ctx.fillStyle = `#${c.getHexString()}`;
        ctx.fillRect(x, r * rh, len, rh);
        ctx.strokeStyle = 'rgba(20,10,5,0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, r * rh, len, rh);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let g = 0; g < 3; g++) {
          const gy = r * rh + 8 + rand() * (rh - 16);
          ctx.beginPath();
          ctx.moveTo(x + 6, gy);
          ctx.bezierCurveTo(x + len * 0.3, gy + 3, x + len * 0.6, gy - 3, x + len - 6, gy);
          ctx.stroke();
        }
        x += len;
      }
    }
    if (light) {
      // Cracks hint that this board is a creaky one.
      ctx.strokeStyle = 'rgba(30,15,8,0.7)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        let cx = rand() * w;
        let cy = rand() * h;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let k = 0; k < 4; k++) {
          cx += 10 + rand() * 18;
          cy += (rand() - 0.5) * 14;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    }
  });
}

// --- Shirt: brown with white and salmon-pink stripes -------------------------
export function stripedShirt() {
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5a3826';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f1e9dd';
    ctx.fillRect(0, 22, w, 12);
    ctx.fillStyle = '#ef9a85';
    ctx.fillRect(0, 34, w, 20);
    ctx.fillStyle = '#f1e9dd';
    ctx.fillRect(0, 54, w, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// --- Soft radial glow for light pools, snack halos and the exit marker -------
export function radialGlow(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Fades from the wall (top of texture) into the room: moonlight under a window.
export function moonPool() {
  const tex = canvasTexture(64, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(200,220,255,0.9)');
    g.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const side = ctx.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)');
    side.addColorStop(0.2, 'rgba(0,0,0,0)');
    side.addColorStop(0.8, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, w, h);
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// --- Text sprites (Zzz, SQUEAK!, shhh...) -------------------------------------
const textCache = new Map();
export function textTexture(text, color = '#ffffff') {
  const key = `${text}|${color}`;
  if (textCache.has(key)) return textCache.get(key);
  const tex = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.font = '700 64px Fredoka, "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(15,16,40,0.85)';
    ctx.strokeText(text, w / 2, h / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2);
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  textCache.set(key, tex);
  return tex;
}

export function disposeTextCache() {
  for (const tex of textCache.values()) tex.dispose();
  textCache.clear();
}

// --- Outfit shirts (Phase 5 locker) ------------------------------------------
export function outfitShirt(outfit) {
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = outfit.shirt;
    ctx.fillRect(0, 0, w, h);
    const [a, b] = outfit.bands || [outfit.shirt, outfit.shirt];
    ctx.fillStyle = a;
    ctx.fillRect(0, 22, w, 12);
    ctx.fillStyle = b;
    ctx.fillRect(0, 34, w, 20);
    ctx.fillStyle = a;
    ctx.fillRect(0, 54, w, 8);
    if (outfit.pattern === 'stars') {
      ctx.fillStyle = '#f2d27a';
      for (let i = 0; i < 14; i++) {
        const x = (i * 37) % w;
        const y = (i * 53) % h;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 2.5 : 6;
          const ang = (k / 10) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
        }
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// --- Level themes ----------------------------------------------------------------
export function floorTexture(kind) {
  if (kind === 'tile') {
    return canvasTexture(256, 256, (ctx, w, h) => {
      const s = w / 4;
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          ctx.fillStyle = (x + y) % 2 ? '#c9cfc9' : '#e9e6dc';
          ctx.fillRect(x * s, y * s, s, s);
        }
      }
      ctx.strokeStyle = 'rgba(40,40,50,0.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s, 0);
        ctx.lineTo(i * s, h);
        ctx.moveTo(0, i * s);
        ctx.lineTo(w, i * s);
        ctx.stroke();
      }
    });
  }
  if (kind === 'concrete') {
    return canvasTexture(256, 256, (ctx, w, h) => {
      const rand = seeded(5);
      ctx.fillStyle = '#7d8088';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) {
        ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rand() * 0.05})`;
        ctx.fillRect(rand() * w, rand() * h, 2 + rand() * 3, 2 + rand() * 3);
      }
      ctx.strokeStyle = 'rgba(30,30,35,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(20, 140);
      ctx.lineTo(70, 150);
      ctx.lineTo(110, 132);
      ctx.stroke();
    });
  }
  if (kind === 'attic') return woodFloor({ base: '#77583a' });
  return woodFloor();
}

export function wallTexture(kind) {
  if (kind === 'kitchen') {
    return canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e8e1cf';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#b9d8cf';
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
      ctx.strokeStyle = 'rgba(60,80,80,0.35)';
      ctx.lineWidth = 2;
      const th = 22;
      for (let row = 0; row * th < h * 0.55; row++) {
        const y = h * 0.45 + row * th;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        for (let x = (row % 2) * 24; x < w; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + th);
          ctx.stroke();
        }
      }
    });
  }
  if (kind === 'garage') {
    return canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#8a9099';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(40,44,52,0.5)';
      ctx.lineWidth = 3;
      const bh = 42;
      for (let row = 0; row * bh < h; row++) {
        const y = row * bh;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        for (let x = (row % 2) * 48; x < w; x += 96) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + bh);
          ctx.stroke();
        }
      }
    });
  }
  if (kind === 'attic') {
    return canvasTexture(256, 256, (ctx, w, h) => {
      const rand = seeded(23);
      for (let x = 0; x < w; x += 32) {
        const c = new THREE.Color('#6e4f33').multiplyScalar(0.85 + rand() * 0.3);
        ctx.fillStyle = `#${c.getHexString()}`;
        ctx.fillRect(x, 0, 32, h);
        ctx.fillStyle = 'rgba(20,10,5,0.5)';
        ctx.fillRect(x, 0, 2, h);
        ctx.fillStyle = 'rgba(20,10,5,0.6)';
        ctx.fillRect(x + 8 + rand() * 14, 20 + rand() * 200, 3, 3);
      }
    });
  }
  return palmWallpaper();
}
