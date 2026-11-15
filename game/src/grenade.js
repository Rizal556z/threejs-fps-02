// Frag grenades: thrown on an arc, bounce off the world, then blow. Damage falls
// off with distance and needs line of sight — a crate between you and the blast
// saves your life. The explosion is a flash of light, an expanding shell and a
// shake for the player.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const GRAVITY = 14;
const FUSE_AFTER_BOUNCE = 1.1;
const FUSE_MAX = 1.8;
const BLAST_RADIUS = 6.5;
const BLAST_MAX_DAMAGE = 120;

export function createGrenades(scene, world) {
  const grenades = [];
  const geo = new THREE.SphereGeometry(0.09, 10, 8);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.olive), roughness: 0.6, metalness: 0.4 });
  const raycaster = new THREE.Raycaster();
  const tmp = new THREE.Vector3();

  function throwGrenade(from, dir, power) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from);
    scene.add(mesh);
    grenades.push({
      mesh,
      vel: dir.clone().multiplyScalar(power).add(new THREE.Vector3(0, 4.2, 0)),
      age: 0,
      bounced: false,
      fuseAt: FUSE_MAX,
    });
  }

  function step(dt, ctx) {
    for (let i = grenades.length - 1; i >= 0; i -= 1) {
      const g = grenades[i];
      g.age += dt;
      g.vel.y -= GRAVITY * dt;
      const next = tmp.copy(g.mesh.position).addScaledVector(g.vel, dt);
      // bounce: test the next position against colliders, one axis at a time
      const p = g.mesh.position;
      let bounced = false;
      for (const axis of ['x', 'y', 'z']) {
        const save = p[axis];
        p[axis] = next[axis];
        for (const box of world.colliders) {
          if (box.containsPoint(p)) {
            p[axis] = save;
            g.vel[axis] *= -0.45;
            bounced = true;
            break;
          }
        }
      }
      if (bounced && !g.bounced) {
        g.bounced = true;
        g.fuseAt = Math.min(g.fuseAt, g.age + FUSE_AFTER_BOUNCE);
      }
      if (p.y < 0.09) { p.y = 0.09; if (Math.abs(g.vel.y) > 0.5) g.vel.y *= -0.45; else g.vel.y = 0; g.vel.x *= 0.7; g.vel.z *= 0.7; }
      if (g.age >= g.fuseAt) {
        explode(g, ctx);
        scene.remove(g.mesh);
        grenades.splice(i, 1);
      }
    }
  }

  function explode(g, ctx) {
    const pos = g.mesh.position.clone();
    ctx.onExplosion(pos);
    // damage everyone in the blast with line of sight
    const victims = ctx.victims();
    for (const v of victims) {
      const d = pos.distanceTo(v.pos);
      if (d > BLAST_RADIUS) continue;
      raycaster.set(pos, tmp.copy(v.pos).sub(pos).normalize());
      raycaster.far = d;
      if (raycaster.intersectObjects(world.shootables, false).length > 0) continue;
      const dmg = Math.round(BLAST_MAX_DAMAGE * (1 - d / BLAST_RADIUS));
      ctx.damageVictim(v, dmg);
    }
  }

  return { throwGrenade, step, count: () => grenades.length };
}
