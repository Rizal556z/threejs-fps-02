// The look plan, in one place. Yard 7 at dusk: warm sand, cold steel, rust and one
// amber accent. Every colour in the game is one of these; the lighting makes every
// shade the scene needs. The same names are the CSS custom properties in index.html.
import * as THREE from 'three';

export const PALETTE = {
  sky: '#2b3648',
  skyLow: '#c98a4b',
  fog: '#3a3f4a',
  sand: '#b98d5f',
  sandDark: '#8a6a45',
  concrete: '#7d7f78',
  concreteDark: '#54565a',
  steel: '#4a5560',
  steelLight: '#6b7a88',
  rust: '#b4552d',
  olive: '#6b6f4e',
  ink: '#e9e6df',
  muted: '#98a0a8',
  accent: '#f0a830',
  vanguard: '#f0a830',
  sentinel: '#5b8dd9',
  danger: '#e5484d',
  ok: '#7fb069',
};

const cache = {};
export function material(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (cache[key]) return cache[key];
  const mat = new (opts.basic ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial)({
    color: new THREE.Color(PALETTE[name] ?? name),
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0.04,
  });
  if (opts.map) { mat.map = opts.map; mat.color.set('#ffffff'); }
  if (opts.emissive) mat.emissive = new THREE.Color(PALETTE[opts.emissive] ?? opts.emissive);
  if (opts.emissiveIntensity !== undefined) mat.emissiveIntensity = opts.emissiveIntensity;
  cache[key] = mat;
  return mat;
}
