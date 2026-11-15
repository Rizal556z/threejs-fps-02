// The spike: carried, planted, ticking, defused. Planting takes 3 seconds of
// holding E inside a site; the fuse runs 35 seconds with beeps that speed up; a
// defender standing at it for 5 seconds defuses it. The spike is a small blinking
// box the world can see from across the map.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const PLANT_TIME = 3;
export const FUSE_TIME = 35;
export const DEFUSE_TIME = 5;

export function createBomb(scene) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.22, 0.22),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#1e2228'), roughness: 0.5, metalness: 0.4 }),
  );
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.danger) }),
  );
  light.position.set(0, 0.14, 0);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.05, 0.23),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }),
  );
  stripe.position.y = 0.06;
  group.add(body, light, stripe);
  group.visible = false;
  scene.add(group);

  const state = {
    phase: 'carried', // carried | planted
    site: null,
    position: new THREE.Vector3(),
    plantProgress: 0,
    fuseLeft: FUSE_TIME,
    lastBeep: 0,
  };

  function step(dt, ctx) {
    if (state.phase !== 'planted') return;
    state.fuseLeft -= dt;
    const blink = Math.sin(ctx.time * (state.fuseLeft < 10 ? 18 : 8)) > 0;
    light.visible = blink;
    const interval = state.fuseLeft < 10 ? 0.5 : 1;
    if (ctx.time - state.lastBeep > interval) {
      state.lastBeep = ctx.time;
      ctx.onBeep(state.fuseLeft < 10);
    }
    if (state.fuseLeft <= 0) {
      state.fuseLeft = 0;
      ctx.onDetonated();
    }
  }

  return {
    state,
    step,
    plant(siteKey, position) {
      state.phase = 'planted';
      state.site = siteKey;
      state.position.copy(position);
      state.position.y = 0.12;
      state.fuseLeft = FUSE_TIME;
      state.lastBeep = 0;
      group.position.copy(state.position);
      group.visible = true;
    },
    clear() {
      state.phase = 'carried';
      state.site = null;
      state.plantProgress = 0;
      state.fuseLeft = FUSE_TIME;
      group.visible = false;
    },
  };
}
