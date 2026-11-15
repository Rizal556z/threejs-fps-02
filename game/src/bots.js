// Bots: the other nine soldiers. Defenders hold their sites and rotate when the
// spike goes down; attackers push lanes on waypoint routes. Every bot sees with a
// real line-of-sight raycast, hears gunfire, strafes while it shoots, and takes
// cover by falling back to its site when hurt. Player bullets hit them through
// their torso/head meshes (main.js raycasts); their bullets hit the player and
// each other by aimed probability, after the same line-of-sight check.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const BOT_SPEED = 3.6;
const BOT_HEALTH = 100;
const REACTION_MIN = 0.28;
const REACTION_MAX = 0.62;
const PERCEIVE_EVERY = 0.12;
const HEAR_RADIUS = 28;

const VANGUARD_NAMES = ['Rook', 'Havoc', 'Bishop', 'Nomad'];
const SENTINEL_NAMES = ['Warden', 'Sable', 'Onyx', 'Frost', 'Gale'];

function makeBody(team) {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: new THREE.Color(team === 'vanguard' ? '#8a6a2a' : '#2e4a6b'), roughness: 0.75 });
  const vest = new THREE.MeshStandardMaterial({ color: new THREE.Color(team === 'vanguard' ? PALETTE.vanguard : PALETTE.sentinel), roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a184'), roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1e2228'), roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), suit);
  torso.position.y = 1.08;
  const vestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.4, 0.32), vest);
  vestMesh.position.y = 1.14;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10), skin);
  head.position.y = 1.62;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), dark);
  helmet.position.y = 1.64;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), dark);
  legL.position.set(-0.14, 0.35, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.55), dark);
  gun.position.set(0.22, 1.15, -0.2);
  group.add(torso, vestMesh, head, helmet, legL, legR, gun);
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
  return { group, torso, head };
}

export function createBots(scene, world) {
  const bots = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const eyeTmp = new THREE.Vector3();

  function spawnBot(name, team, spawn, role, site) {
    const { group, torso, head } = makeBody(team);
    group.position.set(spawn[0], 0, spawn[1]);
    scene.add(group);
    const bot = {
      name, team, role, site,
      group, torso, head,
      pos: group.position,
      yaw: spawn[1] > 0 ? 0 : Math.PI,
      health: BOT_HEALTH,
      alive: true,
      state: 'hold',
      path: [],
      pathIndex: 0,
      dest: null,
      target: null,
      targetKind: null,
      lastSeen: new THREE.Vector3(),
      lastSeenAt: -99,
      reactAt: 0,
      burstLeft: 0,
      nextShotAt: 0,
      perceiveAt: Math.random() * PERCEIVE_EVERY,
      strafeDir: 1,
      strafeAt: 0,
      holdNode: world.nearestNode(spawn[0], spawn[1]),
      fall: 0,
      plantAt: 0,
      defuseAt: 0,
      speed: BOT_SPEED * (0.92 + Math.random() * 0.16),
      hasBomb: false,
      heardAt: -99,
      heardPos: new THREE.Vector3(),
    };
    torso.userData.bot = bot;
    torso.userData.part = 'torso';
    head.userData.bot = bot;
    head.userData.part = 'head';
    bots.push(bot);
    return bot;
  }

  // Attackers: 2 push A, 2 push B. Defenders: 2 hold A, 2 hold B, 1 roams mid.
  for (let i = 0; i < 4; i += 1) {
    const site = i < 2 ? 'A' : 'B';
    spawnBot(VANGUARD_NAMES[i], 'vanguard', [0, 0], 'push', site);
  }
  for (let i = 0; i < 5; i += 1) {
    const site = i < 2 ? 'A' : (i < 4 ? 'B' : 'mid');
    spawnBot(SENTINEL_NAMES[i], 'sentinel', [0, 0], 'hold', site);
  }

  function losClear(from, to) {
    tmpC.copy(to).sub(from);
    const dist = tmpC.length();
    if (dist < 0.01) return true;
    raycaster.set(from, tmpC.normalize());
    raycaster.far = dist;
    return raycaster.intersectObjects(world.shootables, false).length === 0;
  }

  function eyeOf(bot, out) {
    return out.set(bot.pos.x, bot.pos.y + 1.55, bot.pos.z);
  }

  function canSee(bot, pos, maxDist) {
    tmpA.copy(pos).sub(bot.pos);
    const dist = tmpA.length();
    if (dist > maxDist) return false;
    // field of view: 110 degrees around the bot's facing
    const facing = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
    tmpA.y = 0;
    tmpA.normalize();
    if (tmpA.dot(facing) < 0.25 && dist > 3) return false;
    eyeOf(bot, tmpB);
    tmpC.copy(pos);
    tmpC.y = pos.y + 1.1;
    return losClear(tmpB, tmpC);
  }

  function setPath(bot, nodeIndex) {
    const from = world.nearestNode(bot.pos.x, bot.pos.z);
    bot.path = world.findPath(from, nodeIndex);
    bot.pathIndex = 0;
    bot.state = 'move';
  }

  function pickSiteNode(bot, siteKey) {
    const site = world.sites[siteKey];
    const nodes = world.waypoints;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < nodes.length; i += 1) {
      const d = (nodes[i].x - site.center.x) ** 2 + (nodes[i].z - site.center.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function stepBot(bot, dt, ctx) {
    if (!bot.alive) {
      if (bot.fall < 1) {
        bot.fall = Math.min(1, bot.fall + dt / 0.4);
        bot.group.rotation.x = -bot.fall * 1.5;
        bot.group.position.y = -bot.fall * 0.1;
      }
      return;
    }
    const now = ctx.time;

    // --- perception, staggered ---
    if (now >= bot.perceiveAt) {
      bot.perceiveAt = now + PERCEIVE_EVERY * (0.8 + Math.random() * 0.4);
      perceive(bot, ctx);
    }

    // --- hearing: a recent shot nearby turns the bot toward it ---
    if (ctx.shots.length && now - bot.heardAt > 0.5) {
      for (const s of ctx.shots) {
        if (now - s.at > 0.4) continue;
        if (bot.pos.distanceToSquared(s.pos) < HEAR_RADIUS * HEAR_RADIUS) {
          bot.heardAt = now;
          bot.heardPos.copy(s.pos);
          if (!bot.target && bot.state !== 'defuse' && bot.state !== 'plant') {
            bot.dest = bot.heardPos;
            bot.state = 'investigate';
          }
          break;
        }
      }
    }

    // --- combat ---
    if (bot.target) {
      combat(bot, dt, ctx);
      return;
    }

    // --- bomb behaviours ---
    if (ctx.bomb.planted) {
      if (bot.team === 'sentinel' && bot.state !== 'defuse') {
        const siteClear = ctx.livingVanguard === 0;
        if (siteClear) {
          const d = bot.pos.distanceTo(ctx.bomb.position);
          if (d < 2.2) {
            bot.state = 'defuse';
            bot.defuseAt = now;
          } else if (bot.state !== 'move') {
            setPath(bot, world.nearestNode(ctx.bomb.position.x, ctx.bomb.position.z));
          }
        } else if (bot.state !== 'move' && bot.state !== 'engage') {
          setPath(bot, world.nearestNode(ctx.bomb.position.x, ctx.bomb.position.z));
        }
      }
      if (bot.state === 'defuse') {
        bot.yaw = Math.atan2(-(ctx.bomb.position.x - bot.pos.x), -(ctx.bomb.position.z - bot.pos.z));
        if (now - bot.defuseAt > 5) {
          ctx.onDefused(bot);
          bot.state = 'hold';
        }
        return;
      }
    } else if (bot.hasBomb && bot.team === 'vanguard') {
      const site = world.sites[bot.site];
      const d = Math.hypot(bot.pos.x - site.center.x, bot.pos.z - site.center.z);
      if (d < site.radius - 0.5) {
        const nearEnemy = ctx.livingSentinel > 0 && nearestEnemyDist(bot, ctx) < 14;
        if (!nearEnemy) {
          if (bot.state !== 'plant') { bot.state = 'plant'; bot.plantAt = now; }
          if (now - bot.plantAt > 3) {
            ctx.onPlanted(bot);
            bot.hasBomb = false;
            bot.state = 'hold';
          }
          return;
        }
      } else if (bot.state !== 'move') {
        setPath(bot, pickSiteNode(bot, bot.site));
      }
    }

    // --- movement along a path ---
    if (bot.state === 'move' || bot.state === 'investigate') {
      if (bot.pathIndex >= bot.path.length) {
        if (bot.state === 'investigate') bot.state = 'hold';
        else bot.state = bot.role === 'hold' ? 'hold' : 'hold';
        return;
      }
      const node = world.waypoints[bot.path[bot.pathIndex]];
      const dx = node.x - bot.pos.x;
      const dz = node.z - bot.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.6) { bot.pathIndex += 1; return; }
      const stepLen = bot.speed * dt;
      bot.pos.x += (dx / dist) * stepLen;
      bot.pos.z += (dz / dist) * stepLen;
      const targetYaw = Math.atan2(-dx, -dz);
      bot.yaw = turnToward(bot.yaw, targetYaw, dt * 6);
      return;
    }

    // --- hold: idle sway, look around ---
    if (bot.state === 'hold') {
      const lookYaw = (bot.role === 'hold' && bot.site !== 'mid')
        ? Math.atan2(-(world.sites[bot.site].center.x - bot.pos.x), -(world.sites[bot.site].center.z - bot.pos.z))
        : bot.yaw + Math.sin(now * 0.4 + bot.holdNode) * 0.3;
      bot.yaw = turnToward(bot.yaw, lookYaw, dt * 1.5);
    }
  }

  function nearestEnemyDist(bot, ctx) {
    let best = Infinity;
    if (bot.team === 'vanguard') {
      for (const o of bots) {
        if (o.team !== 'sentinel' || !o.alive) continue;
        best = Math.min(best, bot.pos.distanceTo(o.pos));
      }
    } else {
      if (ctx.playerAlive) best = Math.min(best, bot.pos.distanceTo(ctx.playerPos));
      for (const o of bots) {
        if (o.team !== 'vanguard' || !o.alive) continue;
        best = Math.min(best, bot.pos.distanceTo(o.pos));
      }
    }
    return best;
  }

  function perceive(bot, ctx) {
    // find the nearest visible enemy: the player or an opposing bot
    let best = null;
    let bestDist = 34;
    if (bot.team === 'sentinel' && ctx.playerAlive) {
      if (canSee(bot, ctx.playerPos, 34)) {
        best = { kind: 'player', pos: ctx.playerPos, dist: bot.pos.distanceTo(ctx.playerPos) };
        bestDist = best.dist;
      }
    }
    for (const o of bots) {
      if (o.team === bot.team || !o.alive) continue;
      const d = bot.pos.distanceTo(o.pos);
      if (d >= bestDist) continue;
      if (canSee(bot, o.pos, 34)) {
        best = { kind: 'bot', bot: o, pos: o.pos, dist: d };
        bestDist = d;
      }
    }
    if (best) {
      if (!bot.target || bot.targetKind !== best.kind || (best.kind === 'bot' && bot.target !== best.bot)) {
        bot.reactAt = ctx.time + REACTION_MIN + Math.random() * (REACTION_MAX - REACTION_MIN);
        bot.burstLeft = 0;
      }
      bot.target = best.kind === 'bot' ? best.bot : 'player';
      bot.targetKind = best.kind;
      bot.lastSeen.copy(best.pos);
      bot.lastSeenAt = ctx.time;
      bot.state = 'engage';
    } else if (bot.target && ctx.time - bot.lastSeenAt > 1.6) {
      bot.target = null;
      bot.targetKind = null;
      bot.state = bot.role === 'hold' ? 'hold' : 'move';
      if (bot.state === 'move') setPath(bot, bot.holdNode);
    }
  }

  function combat(bot, dt, ctx) {
    const now = ctx.time;
    const targetPos = bot.targetKind === 'player' ? ctx.playerPos : bot.target.pos;
    if ((bot.targetKind === 'player' && !ctx.playerAlive) || (bot.targetKind === 'bot' && !bot.target.alive)) {
      bot.target = null;
      bot.targetKind = null;
      bot.state = 'hold';
      return;
    }
    const dx = targetPos.x - bot.pos.x;
    const dz = targetPos.z - bot.pos.z;
    const dist = Math.hypot(dx, dz);
    const aimYaw = Math.atan2(-dx, -dz);
    bot.yaw = turnToward(bot.yaw, aimYaw, dt * 10);
    // strafe while engaging
    if (now > bot.strafeAt) {
      bot.strafeAt = now + 0.7 + Math.random() * 0.9;
      bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
    }
    const strafe = bot.strafeDir * bot.speed * 0.45 * dt;
    bot.pos.x += Math.cos(bot.yaw) * strafe;
    bot.pos.z += -Math.sin(bot.yaw) * strafe;

    if (now < bot.reactAt) return;
    if (now < bot.nextShotAt) return;
    if (bot.burstLeft <= 0) {
      bot.burstLeft = 3 + ((Math.random() * 3) | 0);
      bot.nextShotAt = now + 0.45 + Math.random() * 0.35;
      return;
    }
    bot.burstLeft -= 1;
    bot.nextShotAt = now + 0.11;
    // aimed probability: closer and slower targets are easier; crouch helps the target
    const targetMoving = bot.targetKind === 'player' ? ctx.playerSpeed : 2.5;
    let p = 0.62 - dist * 0.012 - Math.min(0.25, targetMoving * 0.03);
    if (bot.targetKind === 'player' && ctx.playerCrouching) p -= 0.08;
    p = Math.max(0.06, Math.min(0.8, p));
    const hit = Math.random() < p;
    const headshot = hit && Math.random() < 0.08;
    const from = eyeOf(bot, eyeTmp);
    ctx.onBotShot(bot, from, targetPos, hit, headshot);
    if (hit) {
      const dmg = headshot ? 34 : 11 + ((Math.random() * 5) | 0);
      if (bot.targetKind === 'player') ctx.damagePlayer(dmg, bot, headshot);
      else ctx.damageBot(bot.target, dmg, bot, headshot);
    }
  }

  function turnToward(yaw, target, maxStep) {
    let d = target - yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) <= maxStep) return target;
    return yaw + Math.sign(d) * maxStep;
  }

  return {
    bots,
    step(dt, ctx) {
      for (const bot of bots) stepBot(bot, dt, ctx);
      for (const bot of bots) {
        bot.group.rotation.y = bot.yaw;
        bot.group.position.set(bot.pos.x, bot.pos.y, bot.pos.z);
      }
    },
    hitMeshes() {
      const meshes = [];
      for (const bot of bots) {
        if (!bot.alive) continue;
        meshes.push(bot.torso, bot.head);
      }
      return meshes;
    },
    damage(bot, amount, part) {
      if (!bot.alive) return false;
      bot.health -= amount;
      if (bot.health <= 0) {
        bot.health = 0;
        bot.alive = false;
        bot.target = null;
        bot.state = 'dead';
        return true;
      }
      // getting shot makes the bot turn toward the shooter
      return false;
    },
    living(team) {
      let n = 0;
      for (const bot of bots) if (bot.team === team && bot.alive) n += 1;
      return n;
    },
    respawnAll(attackerSpawns, defenderSpawns) {
      let ai = 0, di = 0;
      for (const bot of bots) {
        const spawn = bot.team === 'vanguard' ? attackerSpawns[ai++ % attackerSpawns.length] : defenderSpawns[di++ % defenderSpawns.length];
        bot.pos.set(spawn[0], 0, spawn[1]);
        bot.group.position.copy(bot.pos);
        bot.group.rotation.set(0, 0, 0);
        bot.yaw = spawn[1] > 0 ? 0 : Math.PI;
        bot.health = BOT_HEALTH;
        bot.alive = true;
        bot.fall = 0;
        bot.path = [];
        bot.pathIndex = 0;
        bot.target = null;
        bot.targetKind = null;
        bot.hasBomb = false;
        if (bot.team === 'sentinel') {
          // walk to the site this bot holds, then stay there
          const siteNode = bot.site === 'mid' ? world.nearestNode(0, -4) : pickSiteNode(bot, bot.site);
          bot.holdNode = siteNode;
          setPath(bot, siteNode);
        } else {
          bot.holdNode = world.nearestNode(spawn[0], spawn[1]);
          bot.state = 'move';
        }
      }
    },
    assignAttackRoutes() {
      for (const bot of bots) {
        if (bot.team !== 'vanguard') continue;
        setPath(bot, pickSiteNode(bot, bot.site));
      }
    },
    giveBombToNearestCarrier(dropPos) {
      let best = null, bestD = Infinity;
      for (const bot of bots) {
        if (bot.team !== 'vanguard' || !bot.alive) continue;
        const d = bot.pos.distanceToSquared(dropPos);
        if (d < bestD) { bestD = d; best = bot; }
      }
      if (best) {
        best.hasBomb = true;
        setPath(best, pickSiteNode(best, best.site));
      }
      return best;
    },
  };
}
