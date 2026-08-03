/**
 * ChromaBridge Concept Anchor System
 *
 * 8 semantic anchor concepts define the positioning space.
 * Every word is positioned via WordNet semantic similarity to these anchors.
 *
 * Axes:
 *   X: Abstract (-255) ↔ Concrete (+255)
 *   Y: General (0) ↔ Specific (255)
 *   Z: Passive (-255) ↔ Active (+255)
 */

export const ANCHOR_CONCEPTS = [
  { name: 'Protect', hex: '#5C6BC0', x: 140, y: 170, z: 220 },
  { name: 'Danger',  hex: '#EF5350', x: 160, y: 100, z: -150 },
  { name: 'Hope',    hex: '#FFD54F', x: -120, y: 180, z: 160 },
  { name: 'Shadow',  hex: '#3A3A4A', x: -180, y: 60, z: -180 },
  { name: 'Light',   hex: '#FFF59D', x: 120, y: 240, z: 150 },
  { name: 'Growth',  hex: '#66BB6A', x: 160, y: 210, z: 200 },
  { name: 'Fear',    hex: '#7E57C2', x: -140, y: 90, z: -200 },
  { name: 'Trust',   hex: '#42A5F5', x: -100, y: 170, z: -120 },
];

export const ANCHOR_NAMES = ANCHOR_CONCEPTS.map(a => a.name);