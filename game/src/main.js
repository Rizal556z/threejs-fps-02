// Boot and the one loop: a fixed 60 Hz simulation feeding a render at the
// display's rate. Rounds, money, the spike, the bots and the shooting all live
// here; the modules own one job each and this file wires them together.
// ?shot=start|play|end with &seed=N sets up a deterministic frame for a capture,
// renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { MAP } from './map.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapons, WEAPONS } from './weapons.js';
import { createBots } from './bots.js';
import { createGrenades } from './grenade.js';
import { createBomb } from './bomb.js';
import { createMatch, BUY_TIME } from './rounds.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createMinimap } from './minimap.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seededRandom = mulberry32(seed);
let rng = Math.random;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 200);
scene.add(camera);

const world = createWorld(scene);
const player = createPlayer(world.colliders, MAP.attackerSpawns[1]);
const weapons = createWeapons(camera, scene);
const bots = createBots(scene, world);
const grenades = createGrenades(scene, world);
const bomb = createBomb(scene);
const match = createMatch();
const hud = createHud();
const audio = createAudio();
const minimap = createMinimap(document.getElementById('minimap'));
const input = createInput(renderer.domElement, onLockChange);
const raycaster = new THREE.Raycaster();
raycaster.far = 90;

const body = player.state;
const direction = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();
let elapsed = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let playerHasBomb = true;
let spectateBot = null;
let buyMenuOpen = false;
let minimapAt = 0;
let stepSoundAt = 0;
const recentShots = [];
const seenEnemies = [];

function syncCamera() {
  if (!body.alive && spectateBot) {
    const b = spectateBot;
    camera.position.set(b.pos.x, b.pos.y + 1.55, b.pos.z);
    camera.rotation.set(0, b.yaw, 0, 'YXZ');
    return;
  }
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
  camera.fov = weapons.isScoped() ? 74 * WEAPONS[weapons.current()].zoom : 74;
  camera.updateProjectionMatrix();
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function heardShot(pos) {
  recentShots.push({ pos: pos.clone(), at: elapsed });
  if (recentShots.length > 12) recentShots.shift();
}

function shoot(spread) {
  const def = weapons.def();
  if (!weapons.takeRound()) {
    audio.dryClick();
    return false;
  }
  camera.getWorldDirection(direction);
  direction.x += (rng() * 2 - 1) * spread;
  direction.y += (rng() * 2 - 1) * spread;
  direction.z += (rng() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, direction);
  const targets = world.shootables.concat(bots.hitMeshes());
  const hit = raycaster.intersectObjects(targets, false)[0];
  const muzzle = weapons.muzzleWorld(tmpV, camera);
  const end = hit ? hit.point : tmpV2.copy(camera.position).addScaledVector(direction, 60);
  weapons.tracer(muzzle, end, def.tracer);
  if (hit && hit.object.userData.bot) {
    const bot = hit.object.userData.bot;
    const part = hit.object.userData.part;
    const dmg = part === 'head' ? def.damage * def.headMult : def.damage;
    const killed = bots.damage(bot, dmg, part);
    hud.hitMarker(killed, killed ? 400 : 90);
    if (killed) {
      match.addKill();
      hud.killfeed('You', bot.name, part === 'head');
      audio.kill();
      if (bot.hasBomb) {
        bot.hasBomb = false;
        bots.giveBombToNearestCarrier(bot.pos);
      }
    } else {
      if (part === 'head') audio.headshot();
      else audio.hit();
    }
  } else if (hit) {
    // impact: a short spark at the hit point
    weapons.tracer(end, tmpV3.copy(end).add(new THREE.Vector3(0, 0.06, 0)), 0xffffff);
  }
  weapons.pullTrigger();
  player.recoil(0.009 + rng() * 0.004, (rng() * 2 - 1) * 0.004);
  audio.shot(true);
  heardShot(body.position);
  hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve);
  return true;
}

function throwGrenade() {
  if (weapons.state.grenades <= 0 || match.state.phase !== 'live') return;
  weapons.state.grenades -= 1;
  camera.getWorldDirection(direction);
  grenades.throwGrenade(tmpV.copy(camera.position).addScaledVector(direction, 0.5), direction, 13);
  audio.grenadeThrow();
  hud.setGrenades(weapons.state.grenades);
}

function plantProgress(dt) {
  if (match.state.phase !== 'live' || !playerHasBomb || !body.alive) return;
  const site = siteAt(body.position);
  if (!site) { bomb.state.plantProgress = 0; return; }
  if (!input.state.keys.has('KeyE')) { bomb.state.plantProgress = 0; return; }
  bomb.state.plantProgress += dt;
  hud.setBomb(`PLANTING ${site}… ${Math.ceil(3 - bomb.state.plantProgress)}`, false);
  if (bomb.state.plantProgress >= 3) {
    bomb.state.plantProgress = 0;
    playerHasBomb = false;
    bomb.plant(site, body.position);
    match.addPlant();
    hud.setBomb('SPIKE PLANTED — 35s', true);
    hud.showBanner('SPIKE PLANTED', `Defend site ${site} until it blows`, 3000);
    audio.plantBeep(true);
  }
}

function siteAt(pos) {
  for (const [key, site] of Object.entries(world.sites)) {
    const dx = pos.x - site.center.x;
    const dz = pos.z - site.center.z;
    if (Math.hypot(dx, dz) < site.radius - 0.5) return key;
  }
  return null;
}

function startMatch() {
  match.reset();
  weapons.resetToPistol();
  startRound();
  hud.hideOverlay();
  hud.setScore(0, 0, 1);
  hud.setMoney(match.state.money);
}

function startRound() {
  match.startRound();
  player.respawn(MAP.attackerSpawns[1]);
  playerHasBomb = true;
  spectateBot = null;
  bomb.clear();
  bots.respawnAll(MAP.attackerSpawns, MAP.defenderSpawns);
  bots.assignAttackRoutes();
  weapons.refill();
  weapons.state.grenades = 0;
  hud.setHealth(100);
  hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve);
  hud.setGrenades(0);
  hud.setWeapon(weapons.def().name);
  hud.setBomb('', false);
  hud.showBuyMenu(match.buyList(), match.state.money, match.state.round, onBuy);
  buyMenuOpen = true;
  syncCamera();
}

function onBuy(item) {
  if (match.state.phase !== 'buy') return;
  if (item.index === 99) {
    if (weapons.state.grenades >= 2) { audio.deny(); return; }
    if (match.state.money < item.price) { audio.deny(); return; }
    match.state.money -= item.price;
    weapons.state.grenades += 1;
    audio.buy();
    hud.setGrenades(weapons.state.grenades);
  } else {
    if (weapons.owned[item.index].owned) { weapons.switchTo(item.index); audio.buy(); }
    else if (match.state.money < item.price) { audio.deny(); return; }
    else {
      match.state.money -= item.price;
      weapons.buy(item.index);
      weapons.switchTo(item.index);
      audio.buy();
    }
    hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve);
    hud.setWeapon(weapons.def().name);
  }
  hud.setMoney(match.state.money);
  hud.showBuyMenu(match.buyList(), match.state.money, match.state.round, onBuy);
}

function endRoundUI(winner, reason) {
  const won = winner === 'vanguard';
  hud.showBanner(
    won ? 'ROUND WON' : 'ROUND LOST',
    reason,
    3600,
  );
  if (won) audio.roundWin();
  else audio.roundLose();
  hud.setScore(match.state.score.vanguard, match.state.score.sentinel, match.state.round);
  hud.setMoney(match.state.money);
  hud.setBomb('', false);
  if (match.state.phase === 'match') {
    setTimeout(() => {
      const mw = match.state.matchWinner === 'vanguard';
      hud.showOverlay('match', mw
        ? `Vanguard takes the match ${match.state.score.vanguard}–${match.state.score.sentinel}. You finished ${match.state.kills} kills, ${match.state.deaths} deaths, ${match.state.plants} plants.`
        : `Sentinel takes the match ${match.state.score.sentinel}–${match.state.score.vanguard}. You finished ${match.state.kills} kills, ${match.state.deaths} deaths, ${match.state.plants} plants.`);
      input.exitLock();
    }, 3800);
  }
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    audio.unlock();
    hud.hideOverlay();
    hud.hideBuyMenu();
    buyMenuOpen = false;
  } else if (match.state.phase === 'match') {
    hud.showOverlay('match', match.state.matchWinner === 'vanguard'
      ? `Vanguard takes the match ${match.state.score.vanguard}–${match.state.score.sentinel}.`
      : `Sentinel takes the match ${match.state.score.sentinel}–${match.state.score.vanguard}.`);
  } else if (started) {
    hud.showOverlay('paused');
  }
}

hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  if (match.state.phase === 'match') startMatch();
  input.requestLock();
});

// One bot context object, reused every step: its fields are refreshed in step()
// and its callbacks close over the live game state, so the hot loop allocates nothing.
const botCtx = {
  time: 0,
  playerAlive: true,
  playerPos: body.position,
  playerSpeed: 0,
  playerCrouching: false,
  shots: recentShots,
  bomb: { planted: false, position: bomb.state.position },
  livingVanguard: 5,
  livingSentinel: 5,
  onBotShot(bot, from, targetPos, hit, headshot) {
    const end = hit ? targetPos : tmpV3.copy(targetPos).add(new THREE.Vector3((rng() - 0.5) * 2, (rng() - 0.5) * 2, 0));
    weapons.tracer(from, end, 0xffd27a);
    const dist = from.distanceTo(body.position);
    if (dist < 40) audio.enemyShot(dist);
  },
  damagePlayer(amount, bot, headshot) {
    const died = player.damage(amount);
    hud.setHealth(body.health);
    hud.damageFlash();
    audio.hurt();
    if (died) {
      match.addDeath();
      hud.killfeed(bot.name, 'You', headshot);
      if (playerHasBomb) {
        playerHasBomb = false;
        bots.giveBombToNearestCarrier(body.position);
      }
      spectateBot = bots.bots.find((b) => b.team === 'vanguard' && b.alive) ?? null;
      hud.showBanner('YOU ARE DOWN', spectateBot ? `Spectating ${spectateBot.name}` : 'No teammates left', 3000);
    }
  },
  damageBot(target, amount, attacker, headshot) {
    const killed = bots.damage(target, amount, headshot ? 'head' : 'torso');
    if (killed) {
      hud.killfeed(attacker.name, target.name, headshot);
      if (target.hasBomb) {
        target.hasBomb = false;
        bots.giveBombToNearestCarrier(target.pos);
      }
    }
  },
  onPlanted(bot) {
    bomb.plant(bot.site, bot.pos);
    hud.setBomb('SPIKE PLANTED — 35s', true);
    hud.showBanner('SPIKE PLANTED', `${bot.name} planted at site ${bot.site}`, 3000);
    audio.plantBeep(true);
  },
  onDefused(bot) {
    bomb.clear();
    hud.setBomb('', false);
    if (match.endRound('sentinel', `${bot.name} defused the spike`)) endRoundUI('sentinel', `${bot.name} defused the spike`);
  },
};

const grenadeCtx = {
  onExplosion(pos) {
    audio.explosion();
    const light = new THREE.PointLight(new THREE.Color(0xffc266), 60, 18);
    light.position.copy(pos).y = pos.y + 1;
    scene.add(light);
    setTimeout(() => scene.remove(light), 260);
    if (body.alive && body.position.distanceTo(pos) < 9) {
      player.recoil(0.03, 0);
      hud.damageFlash();
    }
  },
  victims() {
    const list = [];
    if (body.alive) list.push({ kind: 'player', pos: body.position });
    for (const b of bots.bots) if (b.alive) list.push({ kind: 'bot', bot: b, pos: b.pos });
    return list;
  },
  damageVictim(v, dmg) {
    if (v.kind === 'player') {
      const died = player.damage(dmg);
      hud.setHealth(body.health);
      hud.damageFlash();
      if (died) {
        match.addDeath();
        hud.killfeed('Frag', 'You', false);
        if (playerHasBomb) {
          playerHasBomb = false;
          bots.giveBombToNearestCarrier(body.position);
        }
        spectateBot = bots.bots.find((b) => b.team === 'vanguard' && b.alive) ?? null;
      }
    } else {
      const killed = bots.damage(v.bot, dmg, 'torso');
      if (killed) {
        match.addKill();
        hud.killfeed('You', v.bot.name, false);
        audio.kill();
        if (v.bot.hasBomb) {
          v.bot.hasBomb = false;
          bots.giveBombToNearestCarrier(v.bot.pos);
        }
      }
    }
  },
};

const bombCtx = {
  time: 0,
  onBeep(urgent) { audio.plantBeep(urgent); },
  onDetonated() {
    bomb.clear();
    hud.setBomb('', false);
    audio.explosion();
    if (match.endRound('vanguard', 'The spike detonated')) endRoundUI('vanguard', 'The spike detonated');
  },
};

function step(dt) {
  elapsed += dt;
  const phaseBefore = match.state.phase;

  // match clock
  const tickResult = match.tick(dt);
  if (tickResult === 'timeout' && phaseBefore === 'live' && bomb.state.phase !== 'planted') {
    if (match.endRound('sentinel', 'Time expired — the spike was never planted')) endRoundUI('sentinel', 'Time expired — the spike was never planted');
  } else if (tickResult === 'next') {
    if (match.state.phase === 'match') {
      // wait for the player to restart from the overlay
    } else {
      match.nextRound();
      startRound();
    }
  }
  if (phaseBefore === 'buy' && match.state.phase === 'live') { hud.hideBuyMenu(); buyMenuOpen = false; }

  const phase = match.state.phase;

  // movement and weapons run in buy and live; combat and objectives only live
  if (phase === 'live' || phase === 'buy') {
    const look = input.takeLook();
    if (body.alive && input.state.locked) player.look(look.x, look.y);
    player.step(dt, input.state.keys);
    weapons.step(dt);

    if (phase === 'live') {
      plantProgress(dt);
      botCtx.time = elapsed;
      botCtx.playerAlive = body.alive;
      botCtx.playerSpeed = player.groundSpeed();
      botCtx.playerCrouching = body.crouching;
      botCtx.bomb.planted = bomb.state.phase === 'planted';
      botCtx.livingVanguard = (body.alive ? 1 : 0) + bots.living('vanguard');
      botCtx.livingSentinel = bots.living('sentinel');
      bots.step(dt, botCtx);
      grenades.step(dt, grenadeCtx);
      bombCtx.time = elapsed;
      bomb.step(dt, bombCtx);

      // firing
      if (body.alive && input.state.locked) {
        const def = weapons.def();
        const firing = def.auto ? input.state.firing : (input.state.firing && weapons.canFire());
        if (firing && weapons.ready()) shoot(weapons.spread(player.groundSpeed()));
      }
      if (input.pressed('KeyG')) throwGrenade();

      // round win checks
      const sent = bots.living('sentinel');
      const vang = (body.alive ? 1 : 0) + bots.living('vanguard');
      if (sent === 0) {
        if (match.endRound('vanguard', 'Sentinel team eliminated')) endRoundUI('vanguard', 'Sentinel team eliminated');
      } else if (vang === 0) {
        if (match.endRound('sentinel', 'Vanguard team eliminated')) endRoundUI('sentinel', 'Vanguard team eliminated');
      }
    }

    if (input.pressed('KeyR')) weapons.reload();
    if (input.pressed('Digit1')) { if (weapons.switchTo(0)) { hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve); hud.setWeapon(weapons.def().name); } }
    if (input.pressed('Digit2')) { if (weapons.switchTo(1)) { hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve); hud.setWeapon(weapons.def().name); } }
    if (input.pressed('Digit3')) { if (weapons.switchTo(2)) { hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve); hud.setWeapon(weapons.def().name); } }
    if (input.pressed('Digit4')) { if (weapons.switchTo(3)) { hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve); hud.setWeapon(weapons.def().name); } }
    if (input.pressed('KeyM')) audio.toggleMute();
    if (input.pressed('KeyB') && phase === 'buy') {
      if (buyMenuOpen) { hud.hideBuyMenu(); buyMenuOpen = false; }
      else { hud.showBuyMenu(match.buyList(), match.state.money, match.state.round, onBuy); buyMenuOpen = true; }
    }
    // keyboard buying during the buy phase (the menu footer advertises it):
    // G buys a grenade, 1-4 buy (or select, if already owned) a weapon.
    if (phase === 'buy') {
      const list = match.buyList();
      if (input.pressed('KeyG')) { const g = list.find((i) => i.index === 99); if (g) onBuy(g); }
      for (let i = 0; i < 4; i += 1) {
        if (input.pressed('Digit' + (i + 1))) { const w = list.find((it) => it.index === i); if (w) onBuy(w); }
      }
    }
    if (input.state.scoped !== weapons.isScoped()) {
      if (input.state.scoped) weapons.setScoped(true);
      else weapons.setScoped(false);
    }

    // footstep sounds
    if (body.alive && player.groundSpeed() > 3 && elapsed - stepSoundAt > 0.38) {
      stepSoundAt = elapsed;
      audio.step();
    }
  }

  // spectate: keep following a living teammate
  if (!body.alive && phase === 'live') {
    if (!spectateBot || !spectateBot.alive) {
      spectateBot = bots.bots.find((b) => b.team === 'vanguard' && b.alive) ?? null;
    }
  }

  // HUD numbers
  hud.setHealth(body.health);
  hud.setMoney(match.state.money);
  hud.setScore(match.state.score.vanguard, match.state.score.sentinel, match.state.round);
  if (match.state.phase === 'buy') hud.setTimer(match.state.timer, false);
  else if (match.state.phase === 'live') hud.setTimer(match.state.timer, match.state.timer < 15);
  else hud.setTimer(0, false);
  if (bomb.state.phase === 'planted') hud.setBomb(`SPIKE — ${Math.ceil(bomb.state.fuseLeft)}s`, bomb.state.fuseLeft < 10);
  hud.setCrosshair(6 + weapons.spread(player.groundSpeed()) * 900);

  // minimap at 10 Hz: teammates, and enemies the player can actually see
  if (elapsed - minimapAt > 0.1) {
    minimapAt = elapsed;
    seenEnemies.length = 0;
    for (const b of bots.bots) {
      if (b.team !== 'sentinel' || !b.alive) continue;
      tmpV.copy(b.pos);
      tmpV.y = 1.1;
      const dist = camera.position.distanceTo(tmpV);
      if (dist > 42) continue;
      raycaster.set(camera.position, tmpV2.copy(tmpV).sub(camera.position).normalize());
      raycaster.far = dist;
      if (raycaster.intersectObjects(world.shootables, false).length === 0) {
        seenEnemies.push({ x: b.pos.x, z: b.pos.z, at: elapsed });
      }
    }
    minimap.draw({
      time: elapsed,
      player: { x: body.position.x, z: body.position.z, yaw: body.yaw },
      teammates: bots.bots.filter((b) => b.team === 'vanguard' && b.alive).map((b) => ({ x: b.pos.x, z: b.pos.z })),
      enemies: seenEnemies,
      bomb: bomb.state.phase === 'planted' ? { x: bomb.state.position.x, z: bomb.state.position.z } : null,
    });
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  rng = seededRandom;
  hud.hideOverlay();
  hud.hideBuyMenu();
  hud.hideBanner();
  body.pitch = 0;
  if (name === 'start') {
    startMatch();
    body.position.set(0, 0, 17.5);
    body.yaw = 0;
    settle(20);
    hud.showOverlay('start');
  } else if (name === 'play') {
    startMatch();
    match.startLive();
    // mid-round: player up the mid lane with a clear sightline to two Sentinels,
    // a teammate on the left. Two body shots then a headshot drop the first.
    body.position.set(-2, 0, -2);
    body.yaw = 0;
    const defs = bots.bots.filter((b) => b.team === 'sentinel');
    defs[0].pos.set(-2.5, 0, -8);
    defs[0].yaw = Math.PI;
    defs[1].pos.set(2, 0, -9);
    defs[1].yaw = Math.PI;
    const mates = bots.bots.filter((b) => b.team === 'vanguard');
    mates[0].pos.set(-5.5, 0, -3);
    mates[0].yaw = 0;
    settle(20);
    // two body shots then a headshot on the first defender: he drops
    aimAt(tmpV.set(defs[0].pos.x, 1.1, defs[0].pos.z));
    shoot(0);
    settle(8);
    aimAt(tmpV.set(defs[0].pos.x, 1.1, defs[0].pos.z));
    shoot(0);
    settle(8);
    aimAt(tmpV.set(defs[0].pos.x, 1.62, defs[0].pos.z));
    shoot(0);
    settle(8);
    match.state.timer = 62;
    hud.setTimer(62, false);
    hud.setScore(0, 0, 1);
    aimAt(tmpV.set(defs[1].pos.x, 1.2, defs[1].pos.z));
    settle(6);
  } else {
    // end: round won at site A, the spike's aftermath, banner up
    startMatch();
    match.state.score.vanguard = 1;
    match.state.round = 2;
    body.position.set(-11, 0, -7);
    body.yaw = 0.6;
    const defs = bots.bots.filter((b) => b.team === 'sentinel');
    defs[0].pos.set(-14, 0, -10);
    defs[0].yaw = 2.4;
    bots.damage(defs[0], 500, 'torso');
    // the fall animation runs in the live sim, which is paused here: lay him down
    defs[0].fall = 1;
    defs[0].group.rotation.x = -1.5;
    defs[0].group.position.y = -0.1;
    settle(30);
    match.state.kills = 2;
    match.state.money = 1425;
    hud.setMoney(1425);
    hud.setScore(1, 0, 2);
    hud.showBanner('ROUND WON', 'The spike detonated', 3600000);
  }
  hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve);
  hud.setHealth(body.health);
  hud.hideBuyMenu();
  buyMenuOpen = false;
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
if (shot) runShot(shot);
else {
  startMatch();
  hud.showOverlay('start');
  requestAnimationFrame(frame);
}

// Test hook: re-run a deterministic shot setup without reloading the page.
// The ?shot= protocol covers one capture per load; this lets a test driver take
// all three captures in one browser session (loopback navigations are blocked
// by this machine's Local Network Access policy, so a reload per shot is not
// possible here). Harmless in normal play: nothing calls it.
window.__setShot = (name) => {
  window.__shotReady = false;
  frozen = false;
  runShot(name);
};
// Test hook: read the live player position / phase for headless playtests.
window.__pos = () => ({ x: +body.position.x.toFixed(2), z: +body.position.z.toFixed(2), yaw: +body.yaw.toFixed(2), phase: match.state.phase, hp: body.health });
