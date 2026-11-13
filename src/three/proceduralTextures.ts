import * as THREE from 'three';
import type { CelestialBodyId } from '../types/mission';

export function createKaptonTextures(maxAniso: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  // Base metallic gold Kapton
  ctx.fillStyle = '#d49428';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  // Crinkled quilt facets
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 6 + rand() * 20;
    const shade = Math.floor(170 + rand() * 80);
    ctx.fillStyle = `rgba(${shade}, ${Math.floor(shade * 0.68)}, ${Math.floor(shade * 0.16)}, 0.32)`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * r, y + (rand() - 0.5) * r);
    ctx.lineTo(x + (rand() - 0.5) * r, y + (rand() - 0.5) * r);
    ctx.closePath();
    ctx.fill();

    const bVal = Math.floor(80 + rand() * 140);
    bctx.fillStyle = `rgba(${bVal}, ${bVal}, ${bVal}, 0.45)`;
    bctx.beginPath();
    bctx.moveTo(x, y);
    bctx.lineTo(x + (rand() - 0.5) * r, y + (rand() - 0.5) * r);
    bctx.lineTo(x + (rand() - 0.5) * r, y + (rand() - 0.5) * r);
    bctx.closePath();
    bctx.fill();
  }

  // Quilt seams
  ctx.strokeStyle = 'rgba(110, 65, 10, 0.45)';
  ctx.lineWidth = 1.5;
  bctx.strokeStyle = '#303030';
  bctx.lineWidth = 2;
  for (let g = 32; g < size; g += 64) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, size);
    ctx.moveTo(0, g);
    ctx.lineTo(size, g);
    ctx.stroke();

    bctx.beginPath();
    bctx.moveTo(g, 0);
    bctx.lineTo(g, size);
    bctx.moveTo(0, g);
    bctx.lineTo(size, g);
    bctx.stroke();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAniso;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAniso;

  return { map, bumpMap };
}

export function createSolarPanelTexture(maxAniso: number): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Deep GaAs photovoltaic blue-indigo
  ctx.fillStyle = '#0c1e3e';
  ctx.fillRect(0, 0, w, h);

  // Subtle iridescent gradient across cells
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(30, 64, 175, 0.35)');
  grad.addColorStop(0.5, 'rgba(14, 116, 144, 0.25)');
  grad.addColorStop(1, 'rgba(30, 58, 138, 0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Individual solar cell rectangles
  const cols = 4;
  const rows = 8;
  const cw = w / cols;
  const ch = h / rows;

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      ctx.strokeRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
      // Fine silver busbar
      ctx.fillStyle = 'rgba(203, 213, 225, 0.45)';
      ctx.fillRect(c * cw + cw * 0.48, r * ch + 2, 1.5, ch - 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createHullPlatingTexture(maxAniso: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, size, size);

  // Brushed horizontal streaks
  for (let y = 0; y < size; y += 2) {
    const alpha = (y % 6 === 0 ? 0.08 : 0.03);
    ctx.fillStyle = `rgba(15, 23, 42, ${alpha})`;
    ctx.fillRect(0, y, size, 1);
  }

  // Aerospace panel seams & rivets
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(8, 8, size - 16, size - 16);
  ctx.beginPath();
  ctx.moveTo(size / 2, 8);
  ctx.lineTo(size / 2, size - 8);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.05,
    size / 2,
    size / 2,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.68)');
  grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.28)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPlanetTexture(body: CelestialBodyId, maxAniso: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  let seed = body.charCodeAt(0) * 137 + 19;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  if (body === 'earth') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#e2e8f0');
    grad.addColorStop(0.14, '#0f4c81');
    grad.addColorStop(0.5, '#0b3a66');
    grad.addColorStop(0.86, '#0f4c81');
    grad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Continents
    ctx.fillStyle = '#2d6a4f';
    for (let i = 0; i < 24; i++) {
      const cx = rand() * w;
      const cy = 40 + rand() * (h - 80);
      const rx = 18 + rand() * 55;
      const ry = 12 + rand() * 34;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cloud bands
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * w, rand() * h, 28 + rand() * 70, 4 + rand() * 8, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (body === 'moon') {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.beginPath();
      ctx.ellipse(rand() * w, rand() * h, 24 + rand() * 55, 18 + rand() * 40, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 95; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 3 + rand() * 16;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(30, 41, 59, 0.25)';
      ctx.fill();
    }
  } else if (body === 'mars') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f1f5f9');
    grad.addColorStop(0.1, '#c25934');
    grad.addColorStop(0.5, '#a84422');
    grad.addColorStop(0.9, '#8b3519');
    grad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 35; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(69, 26, 15, 0.25)' : 'rgba(229, 134, 86, 0.22)';
      ctx.beginPath();
      ctx.ellipse(rand() * w, 25 + rand() * (h - 50), 20 + rand() * 65, 10 + rand() * 28, rand(), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (body === 'europa') {
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(0, 0, w, h);
    // Warm icy patches
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.beginPath();
      ctx.ellipse(rand() * w, rand() * h, 25 + rand() * 60, 15 + rand() * 35, rand(), 0, Math.PI * 2);
      ctx.fill();
    }
    // Reddish-ochre tectonic ice lineae fractures
    ctx.strokeStyle = 'rgba(154, 72, 42, 0.55)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 42; i++) {
      ctx.beginPath();
      const y1 = rand() * h;
      const y2 = rand() * h;
      ctx.moveTo(0, y1);
      ctx.bezierCurveTo(w * 0.33, y1 + (rand() - 0.5) * 60, w * 0.66, y2 + (rand() - 0.5) * 60, w, y2);
      ctx.stroke();
    }
  } else {
    // 16 Psyche metallic asteroid
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 65; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 4 + rand() * 22;
      ctx.fillStyle = rand() > 0.4 ? 'rgba(148, 163, 184, 0.35)' : 'rgba(30, 41, 59, 0.45)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}
