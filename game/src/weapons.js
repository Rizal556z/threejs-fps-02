// Weapons: four hitscan guns and the numbers that make them feel different. This
// module owns the definitions, the view models, magazines, reloads and spread; the
// ray and the damage live in main.js, the bot guns in bots.js.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = [
  { id: 'p9', name: 'P9 Sidearm', price: 0, mag: 12, reserve: 48, damage: 26, headMult: 4, fireGap: 0.16, reloadTime: 1.3, spreadStill: 0.003, spreadMove: 0.02, auto: false, zoom: 0, tracer: 0xf0a830 },
  { id: 'vk9', name: 'VK-9 SMG', price: 900, mag: 28, reserve: 112, damage: 22, headMult: 4, fireGap: 0.075, reloadTime: 1.7, spreadStill: 0.006, spreadMove: 0.034, auto: true, zoom: 0, tracer: 0xf0a830 },
  { id: 'ar7', name: 'AR-7 Rifle', price: 1600, mag: 30, reserve: 90, damage: 34, headMult: 4, fireGap: 0.1, reloadTime: 1.9, spreadStill: 0.0022, spreadMove: 0.028, auto: true, zoom: 0, tracer: 0xffd27a },
  { id: 'lance', name: 'LANCE Sniper', price: 2400, mag: 5, reserve: 20, damage: 95, headMult: 4, fireGap: 1.15, reloadTime: 2.6, spreadStill: 0.0004, spreadMove: 0.05, auto: false, zoom: 0.38, tracer: 0x9fd4ff },
];

const GRENADE_PRICE = 300;

function buildViewModel(def) {
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const metal = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5, metalness: 0.2 });
  const model = new THREE.Group();
  const add = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    model.add(m);
    return m;
  };
  if (def.id === 'p9') {
    add(0.06, 0.09, 0.24, 0, 0, -0.1, metal);
    add(0.05, 0.12, 0.08, 0, -0.08, 0.04, dark);
    add(0.02, 0.02, 0.02, 0, 0.055, -0.2, accent);
  } else if (def.id === 'vk9') {
    add(0.08, 0.09, 0.34, 0, 0, -0.12, metal);
    add(0.04, 0.04, 0.3, 0, 0.02, -0.36, dark);
    add(0.05, 0.16, 0.06, 0, -0.1, -0.05, dark);
    add(0.05, 0.05, 0.1, 0, 0.07, -0.05, accent);
  } else if (def.id === 'ar7') {
    add(0.09, 0.1, 0.42, 0, 0, -0.14, metal);
    add(0.045, 0.045, 0.4, 0, 0.025, -0.5, dark);
    add(0.075, 0.08, 0.22, 0, -0.02, 0.16, dark);
    add(0.05, 0.14, 0.06, 0, -0.11, -0.08, dark);
    add(0.02, 0.03, 0.12, 0, 0.065, -0.2, accent);
  } else {
    add(0.07, 0.09, 0.5, 0, 0, -0.16, metal);
    add(0.04, 0.04, 0.42, 0, 0.02, -0.56, dark);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12), dark);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.075, -0.1);
    model.add(scope);
    add(0.06, 0.06, 0.2, 0, -0.03, 0.2, dark);
    add(0.02, 0.02, 0.02, 0, 0.05, -0.32, accent);
  }
  model.position.set(0.24, -0.2, -0.42);
  return model;
}

export function createWeapons(camera, scene) {
  const models = WEAPONS.map((def) => {
    const m = buildViewModel(def);
    m.visible = false;
    camera.add(m);
    return m;
  });

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  // Tracer pool: short-lived lines from muzzle to hit point, reused, never
  // allocated in the frame loop.
  const tracers = [];
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  for (let i = 0; i < 8; i += 1) {
    const line = new THREE.Line(tracerGeo.clone(), new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 }));
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tracerIndex = 0;
  const muzzle = new THREE.Vector3();

  const owned = WEAPONS.map((def) => ({ def, mag: def.mag, reserve: def.reserve, owned: def.id === 'p9' }));
  let current = 0;
  const state = { cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, scoped: false, grenades: 0 };

  function currentDef() { return WEAPONS[current]; }
  function currentState() { return owned[current]; }

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[current];
    model.position.z = -0.42 + state.kick;
    model.rotation.x = state.kick * 2.2 + (state.scoped ? 0.02 : 0);
    model.position.x = state.scoped ? 0 : 0.24;
    model.position.y = state.scoped ? -0.145 : -0.2;
    model.visible = true;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    const def = currentDef();
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (def.reloadTime - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const s = currentState();
        const take = Math.min(def.mag - s.mag, s.reserve);
        s.mag += take;
        s.reserve -= take;
      }
    }
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      if (t.life <= 0) t.line.visible = false;
    }
  }

  return {
    state,
    owned,
    current() { return current; },
    def() { return currentDef(); },
    ammo() { const s = currentState(); return { mag: s.mag, reserve: s.reserve }; },
    step,
    ready() {
      const s = currentState();
      return s.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    canFire() { return currentState().mag > 0 && state.cooldown === 0 && state.reloadLeft === 0; },
    pullTrigger() {
      state.cooldown = currentDef().fireGap;
      state.flash = 0.06;
      state.kick = 0.055;
    },
    takeRound() {
      const s = currentState();
      if (s.mag <= 0) return false;
      s.mag -= 1;
      return true;
    },
    reload() {
      const s = currentState();
      const def = currentDef();
      if (state.reloadLeft > 0 || s.mag === def.mag || s.reserve === 0) return;
      state.reloadLeft = def.reloadTime;
    },
    spread(speed) {
      const def = currentDef();
      return def.spreadStill + Math.min(1, speed / 5.2) * def.spreadMove;
    },
    switchTo(index) {
      if (index === current || !owned[index].owned) return false;
      models[current].visible = false;
      current = index;
      state.reloadLeft = 0;
      state.cooldown = Math.max(state.cooldown, 0.25);
      state.scoped = false;
      return true;
    },
    buy(index) {
      if (owned[index].owned) return { ok: false, reason: 'already owned' };
      owned[index].owned = true;
      owned[index].mag = WEAPONS[index].mag;
      owned[index].reserve = WEAPONS[index].reserve;
      return { ok: true };
    },
    refill() {
      for (const s of owned) {
        if (!s.owned) continue;
        s.mag = s.def.mag;
        s.reserve = s.def.reserve;
      }
      state.grenades = 0;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.scoped = false;
    },
    resetToPistol() {
      models[current].visible = false;
      current = 0;
      for (let i = 1; i < owned.length; i += 1) owned[i].owned = false;
      this.refill();
    },
    setScoped(on) {
      if (currentDef().zoom === 0) { state.scoped = false; return false; }
      state.scoped = on;
      return on;
    },
    isScoped() { return state.scoped; },
    muzzleWorld(out, cameraObj) {
      cameraObj.getWorldPosition(out);
      const dir = new THREE.Vector3();
      cameraObj.getWorldDirection(dir);
      out.addScaledVector(dir, 0.9);
      out.y -= 0.12;
      out.x += 0.18;
      return out;
    },
    tracer(from, to, color) {
      const t = tracers[tracerIndex];
      tracerIndex = (tracerIndex + 1) % tracers.length;
      const pos = t.line.geometry.attributes.position;
      pos.setXYZ(0, from.x, from.y, from.z);
      pos.setXYZ(1, to.x, to.y, to.z);
      pos.needsUpdate = true;
      t.line.material.color.set(color);
      t.line.visible = true;
      t.life = 0.09;
    },
  };
}

export { GRENADE_PRICE };
