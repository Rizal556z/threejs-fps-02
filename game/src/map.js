// Yard 7 — the map, as data. Everything the world builds comes from here: the
// boxes and cylinders, the spawns, the two bomb sites and the waypoint graph the
// bots walk. Coordinates: x east, z south. Attackers spawn south (z +17),
// defenders north (z -17). Site A (Warehouse) is west, Site B (Silos) is east.
//
// Box entry: [width, height, depth, x, y, z, material]
// Cylinder entry: [radius, height, x, z, material]
// Waypoint: [x, z]. Edges are computed at load: pairs within 11 m whose segment
// at knee height clears every collider.

export const MAP = {
  bounds: { minX: -22, maxX: 22, minZ: -20, maxZ: 20 },
  boxes: [
    // ground
    [44.4, 0.4, 40.4, 0, -0.2, 0, 'sand'],
    // outer walls
    [44.4, 5, 0.4, 0, 2.5, -20.2, 'concrete'],
    [44.4, 5, 0.4, 0, 2.5, 20.2, 'concrete'],
    [0.4, 5, 40.4, -22.2, 2.5, 0, 'concrete'],
    [0.4, 5, 40.4, 22.2, 2.5, 0, 'concrete'],
    // --- Site A: warehouse, open to the east ---
    [0.4, 3.4, 9, -19.5, 1.7, -11, 'concreteDark'],
    [9, 3.4, 0.4, -15, 1.7, -15.5, 'concreteDark'],
    [9, 3.4, 0.4, -15, 1.7, -6.5, 'concreteDark'],
    [1.2, 1.2, 1.2, -17, 0.6, -9, 'crate'],
    [1.2, 1.2, 1.2, -13.5, 0.6, -13, 'crate'],
    [2.4, 1.2, 1.2, -15.5, 0.6, -8.5, 'crate'],
    [1.2, 2.4, 1.2, -17.5, 1.2, -13.5, 'crate'],
    // --- Site B: silo yard ---
    [1.2, 1.2, 1.2, 14, 0.6, -13, 'crate'],
    [2.4, 1.2, 1.2, 17.5, 0.6, -12.5, 'crate'],
    [1.2, 1.2, 1.2, 13.5, 0.6, -8.5, 'crate'],
    // --- mid lane dividers ---
    [0.4, 2.6, 8, -8, 1.3, -6, 'steel'],
    [0.4, 2.6, 8, 8, 1.3, -6, 'steel'],
    [6, 2.2, 0.4, 0, 1.1, 4, 'concrete'],
    // mid platform (low enough to jump on)
    [6, 0.5, 4, 0, 0.25, -1, 'concreteDark'],
    // --- containers ---
    [6, 2.6, 2.4, -12, 1.3, 2, 'rust'],
    [6, 2.6, 2.4, 12, 1.3, 2, 'steel'],
    [2.4, 2.6, 6, -5, 1.3, -12, 'olive'],
    [2.4, 2.6, 6, 5, 1.3, -12, 'steel'],
    // --- crate stacks ---
    [3, 1.2, 3, -9, 0.6, 8, 'crate'],
    [3, 1.2, 3, 9, 0.6, 8, 'crate'],
    [1.2, 1.2, 1.2, -9, 1.8, 8, 'crate'],
    [1.2, 1.2, 1.2, 9, 1.8, 8, 'crate'],
    // --- pillars ---
    [1, 4, 1, -11, 2, -2, 'concreteDark'],
    [1, 4, 1, 11, 2, -2, 'concreteDark'],
    [1, 4, 1, 0, 2, 8, 'concreteDark'],
    // --- spawn cover ---
    [4, 1.1, 0.6, -6, 0.55, 14.5, 'concrete'],
    [4, 1.1, 0.6, 6, 0.55, 14.5, 'concrete'],
    [4, 1.1, 0.6, -6, 0.55, -14.5, 'concrete'],
    [4, 1.1, 0.6, 6, 0.55, -14.5, 'concrete'],
  ],
  cylinders: [
    // silos at B (radius, height, x, z, material)
    [1.6, 6, 17, -14.5, 'steelLight'],
    [1.6, 6, 13.5, -10.5, 'steelLight'],
    [1.6, 6, 19, -9, 'rust'],
    // barrels (low, decorative cover)
    [0.45, 1.1, -3, 12, 'rust'],
    [0.45, 1.1, -2, 12.6, 'olive'],
    [0.45, 1.1, 3, -14, 'rust'],
    [0.45, 1.1, -12, -4, 'olive'],
    [0.45, 1.1, 12, -4, 'rust'],
  ],
  attackerSpawns: [
    [-6, 17], [0, 17.5], [6, 17], [-3, 18.5], [3, 18.5],
  ],
  defenderSpawns: [
    [-6, -17], [0, -17.5], [6, -17], [-3, -18.5], [3, -18.5],
  ],
  sites: {
    A: { name: 'Warehouse', center: [-16, -11], radius: 4.5 },
    B: { name: 'Silos', center: [16, -11], radius: 4.5 },
  },
  waypoints: [
    [-6, 17], [0, 17], [6, 17],
    [-4, 10], [4, 10], [0, 8],
    [-14, 12], [-18, 6], [-18, -2], [-14, -6],
    [14, 12], [18, 6], [18, -2], [14, -6],
    [-4, 2], [4, 2], [0, -4], [-4, -8], [4, -8],
    [-16, -11], [-12, -11], [-16, -14.5],
    [16, -11], [12, -11], [16, -14.5],
    [-6, -17], [0, -17], [6, -17],
    [-8, -2], [8, -2],
  ],
};
