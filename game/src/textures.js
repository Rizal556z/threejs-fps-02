// Procedural textures, painted on canvas at boot: no image files, no network, and
// the map gets real surface detail instead of flat colours. Every texture repeats.
import * as THREE from 'three';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d')];
}

function speckle(ctx, size, n, colors, rMin, rMax) {
  for (let i = 0; i < n; i += 1) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.globalAlpha = 0.12 + Math.random() * 0.25;
    const r = rMin + Math.random() * (rMax - rMin);
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function tex(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function sandTexture() {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#b98d5f';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 900, ['#a37a4e', '#c9a273', '#8a6a45', '#d4b183'], 0.6, 2.4);
  // tyre tracks
  ctx.strokeStyle = 'rgba(90,66,40,0.35)';
  ctx.lineWidth = 9;
  for (const y of [52, 204]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y - 14, 170, y + 12, 256, y - 4);
    ctx.stroke();
  }
  // cracks
  ctx.strokeStyle = 'rgba(70,50,30,0.4)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 7; i += 1) {
    let x = Math.random() * 256;
    let y = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s += 1) { x += (Math.random() - 0.5) * 44; y += (Math.random() - 0.5) * 44; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return tex(c, 8);
}

export function concreteTexture() {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#7d7f78';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 700, ['#6b6d66', '#8f918a', '#54565a', '#9a9c95'], 0.6, 2.2);
  // stains running down
  for (let i = 0; i < 10; i += 1) {
    const x = Math.random() * 256;
    const g = ctx.createLinearGradient(x, 0, x, 256);
    g.addColorStop(0, 'rgba(60,60,58,0.35)');
    g.addColorStop(1, 'rgba(60,60,58,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 4 + Math.random() * 10, 256);
  }
  // expansion joints
  ctx.strokeStyle = 'rgba(40,40,40,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);
  ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();
  return tex(c, 2);
}

export function containerTexture(base, label) {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  // corrugation
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, 0, 5, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x + 8, 0, 4, 256);
  }
  speckle(ctx, 256, 260, ['#00000033', '#ffffff22'], 0.8, 2.6);
  // stencil label
  ctx.fillStyle = 'rgba(233,230,223,0.85)';
  ctx.font = 'bold 34px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, 128, 132);
  ctx.font = '20px ui-monospace, monospace';
  ctx.fillText('YARD 7', 128, 162);
  // rust streaks
  for (let i = 0; i < 8; i += 1) {
    const x = Math.random() * 256;
    ctx.fillStyle = 'rgba(120,60,20,0.28)';
    ctx.fillRect(x, Math.random() * 60, 3 + Math.random() * 5, 60 + Math.random() * 120);
  }
  return tex(c, 1);
}

export function crateTexture() {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#9a7a4e';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 42) {
    ctx.fillStyle = y % 84 === 0 ? '#8a6a42' : '#a5855a';
    ctx.fillRect(0, y, 256, 40);
    ctx.fillStyle = 'rgba(40,26,12,0.55)';
    ctx.fillRect(0, y + 40, 256, 2);
    // nail heads
    ctx.fillStyle = 'rgba(30,30,30,0.7)';
    for (const x of [14, 242]) { ctx.beginPath(); ctx.arc(x, y + 20, 3, 0, Math.PI * 2); ctx.fill(); }
  }
  speckle(ctx, 256, 200, ['#6b4e2c', '#c2a06b'], 0.7, 2.0);
  // stencil
  ctx.strokeStyle = 'rgba(233,230,223,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeRect(78, 78, 100, 100);
  ctx.font = 'bold 44px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(233,230,223,0.8)';
  ctx.fillText('7', 128, 138);
  return tex(c, 1);
}

export function hazardTexture() {
  const [c, ctx] = canvas(128);
  ctx.fillStyle = '#f0a830';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#14161a';
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 128);
    ctx.lineTo(i + 16, 128);
    ctx.lineTo(i + 16 + 128, 0);
    ctx.lineTo(i + 128, 0);
    ctx.closePath();
    ctx.fill();
  }
  return tex(c, 1);
}

// Dusk sky: a vertical gradient painted once, mapped on the inside of a big sphere.
export function skyTexture() {
  const [c, ctx] = canvas(512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, '#1d2739');
  g.addColorStop(0.45, '#2b3648');
  g.addColorStop(0.62, '#7a5a44');
  g.addColorStop(0.72, '#c98a4b');
  g.addColorStop(0.78, '#e8b06a');
  g.addColorStop(1.0, '#3a3f4a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  // a few early stars up high
  ctx.fillStyle = 'rgba(233,230,223,0.8)';
  for (let i = 0; i < 40; i += 1) {
    ctx.globalAlpha = 0.2 + Math.random() * 0.6;
    ctx.fillRect(Math.random() * 512, Math.random() * 150, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
  return tex(c, 1);
}
