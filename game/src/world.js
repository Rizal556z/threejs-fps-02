// The world: builds Yard 7 from MAP, lights the dusk scene, and computes the
// waypoint graph the bots walk. Colliders are axis-aligned boxes; cylinders get a
// square collider of the same footprint.
import * as THREE from 'three';
import { MAP } from './map.js';
import { PALETTE } from './palette.js';
import { sandTexture, concreteTexture, containerTexture, crateTexture, hazardTexture, skyTexture } from './textures.js';

const EDGE_MAX = 11;

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const shootables = [];

  const mats = {
    sand: new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 0.96 }),
    concrete: new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.94 }),
    concreteDark: new THREE.MeshStandardMaterial({ map: concreteTexture(), color: new THREE.Color('#8f8f88'), roughness: 0.94 }),
    steel: new THREE.MeshStandardMaterial({ map: containerTexture('#4a5560', 'ST-22'), roughness: 0.62, metalness: 0.28 }),
    steelLight: new THREE.MeshStandardMaterial({ map: containerTexture('#6b7a88', 'ST-09'), roughness: 0.58, metalness: 0.32 }),
    rust: new THREE.MeshStandardMaterial({ map: containerTexture('#b4552d', 'RX-41'), roughness: 0.72, metalness: 0.18 }),
    olive: new THREE.MeshStandardMaterial({ map: containerTexture('#6b6f4e', 'OL-17'), roughness: 0.7, metalness: 0.15 }),
    crate: new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.88 }),
  };

  function addCollider(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    colliders.push(box);
    shootables.push(mesh);
  }

  for (const [w, h, d, x, y, z, mat] of MAP.boxes) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[mat]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    addCollider(mesh);
  }
  for (const [r, h, x, z, mat] of MAP.cylinders) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), mats[mat]);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    // square collider of the same footprint
    colliders.push(new THREE.Box3(new THREE.Vector3(x - r, 0, z - r), new THREE.Vector3(x + r, h, z + r)));
    shootables.push(mesh);
  }

  // Site markers: a hazard ring flat on the ground, plus a floating letter.
  const hazard = hazardTexture();
  const ringGeo = new THREE.RingGeometry(0.9, 1, 24);
  const siteMarkers = {};
  for (const [key, site] of Object.entries(MAP.sites)) {
    const [cx, cz] = site.center;
    const ringMat = new THREE.MeshBasicMaterial({ map: hazard, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(site.radius - 0.35, site.radius, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.03, cz);
    group.add(ring);
    // letter sprite made from a canvas
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f0a830';
    ctx.font = 'bold 84px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(key, 64, 68);
    const st = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false }));
    sprite.scale.set(2.2, 2.2, 1);
    sprite.position.set(cx, 4.6, cz);
    group.add(sprite);
    siteMarkers[key] = { center: new THREE.Vector3(cx, 0, cz), radius: site.radius };
  }

  // Sky dome, sun and lights: dusk from the west, warm key, cool fill.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 26, 90);

  const hemi = new THREE.HemisphereLight(new THREE.Color('#8a94a8'), new THREE.Color('#5a4632'), 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffb066'), 2.4);
  sun.position.set(-26, 18, 10);
  sun.target.position.set(4, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#5b8dd9'), 0.5);
  fill.position.set(20, 12, -18);
  scene.add(fill);

  // Waypoint graph: connect pairs within EDGE_MAX whose knee-height segment
  // clears every collider. Precompute adjacency once; bots BFS over it.
  const nodes = MAP.waypoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const adjacency = nodes.map(() => []);
  function segmentClear(a, b) {
    // 2D segment vs box footprints, tested at knee height (y 0.5): a box blocks
    // only if it reaches above 0.5 and the segment crosses its footprint.
    for (const box of colliders) {
      if (box.max.y <= 0.5) continue;
      const minX = box.min.x - 0.35, maxX = box.max.x + 0.35;
      const minZ = box.min.z - 0.35, maxZ = box.max.z + 0.35;
      if (segmentHitsRect(a.x, a.z, b.x, b.z, minX, minZ, maxX, maxZ)) return false;
    }
    return true;
  }
  function segmentHitsRect(x1, z1, x2, z2, minX, minZ, maxX, maxZ) {
    // Liang-Barsky clip of the segment against the rectangle.
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dz = z2 - z1;
    const p = [-dx, dx, -dz, dz];
    const q = [x1 - minX, maxX - x1, z1 - minZ, maxZ - z1];
    for (let i = 0; i < 4; i += 1) {
      if (Math.abs(p[i]) < 1e-9) { if (q[i] < 0) return false; }
      else {
        const t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
    }
    return true;
  }
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (nodes[i].distanceTo(nodes[j]) > EDGE_MAX) continue;
      if (!segmentClear(nodes[i], nodes[j])) continue;
      adjacency[i].push(j);
      adjacency[j].push(i);
    }
  }

  function nearestNode(x, z) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < nodes.length; i += 1) {
      const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // BFS path between waypoint indices.
  function findPath(from, to) {
    if (from === to) return [to];
    const prev = new Array(nodes.length).fill(-1);
    const queue = [from];
    prev[from] = from;
    while (queue.length) {
      const cur = queue.shift();
      for (const next of adjacency[cur]) {
        if (prev[next] !== -1) continue;
        prev[next] = cur;
        if (next === to) {
          const path = [to];
          let n = to;
          while (n !== from) { n = prev[n]; path.unshift(n); }
          return path;
        }
        queue.push(next);
      }
    }
    return [to];
  }

  return {
    colliders, shootables, group, sites: siteMarkers,
    waypoints: nodes, adjacency, nearestNode, findPath,
    segmentClear,
  };
}
