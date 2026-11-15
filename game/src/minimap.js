// Minimap: a top-down canvas in the HUD corner. Walls and crates as blocks, the
// two sites as rings, the player as an arrow, teammates as amber dots, enemies
// only where they were last seen (a fading red ghost), the spike as a blinking
// diamond. Redrawn at 10 Hz from the live game state.
import { MAP } from './map.js';

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const { minX, maxX, minZ, maxZ } = MAP.bounds;
  const sx = W / (maxX - minX);
  const sz = H / (maxZ - minZ);
  const X = (x) => (x - minX) * sx;
  const Z = (z) => (z - minZ) * sz;

  function draw(state) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20,22,26,0.82)';
    ctx.fillRect(0, 0, W, H);
    // ground
    ctx.fillStyle = '#6b5a40';
    ctx.fillRect(X(minX), Z(minZ), W, H);
    // cover blocks
    ctx.fillStyle = '#3d454f';
    for (const [w, h, d, x, y, z] of MAP.boxes) {
      if (h < 0.5) continue;
      ctx.fillRect(X(x - w / 2), Z(z - d / 2), w * sx, d * sz);
    }
    ctx.fillStyle = '#55606c';
    for (const [r, h, x, z] of MAP.cylinders) {
      ctx.beginPath();
      ctx.arc(X(x), Z(z), r * sx, 0, Math.PI * 2);
      ctx.fill();
    }
    // sites
    for (const [key, site] of Object.entries(MAP.sites)) {
      const [cx, cz] = site.center;
      ctx.strokeStyle = '#f0a830';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(X(cx), Z(cz), site.radius * sx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#f0a830';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(key, X(cx), Z(cz) + 4);
    }
    // last-seen enemies (fading)
    const now = state.time;
    for (const e of state.enemies) {
      const age = now - e.at;
      if (age > 6) continue;
      ctx.globalAlpha = Math.max(0.15, 1 - age / 6);
      ctx.fillStyle = '#e5484d';
      ctx.beginPath();
      ctx.arc(X(e.x), Z(e.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // teammates
    ctx.fillStyle = '#f0a830';
    for (const t of state.teammates) {
      ctx.beginPath();
      ctx.arc(X(t.x), Z(t.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // spike
    if (state.bomb) {
      const blink = Math.sin(now * 6) > 0;
      ctx.fillStyle = blink ? '#e5484d' : '#f0a830';
      const bx = X(state.bomb.x), bz = Z(state.bomb.z);
      ctx.beginPath();
      ctx.moveTo(bx, bz - 5); ctx.lineTo(bx + 5, bz); ctx.lineTo(bx, bz + 5); ctx.lineTo(bx - 5, bz);
      ctx.closePath();
      ctx.fill();
    }
    // player arrow: the canvas has north (-z) up, the arrow is drawn pointing up
    const px = X(state.player.x), pz = Z(state.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-state.player.yaw);
    ctx.fillStyle = '#e9e6df';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return { draw };
}
