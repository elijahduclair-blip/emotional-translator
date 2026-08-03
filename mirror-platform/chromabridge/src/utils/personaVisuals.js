/**
 * Persona-driven visual transforms for the graph.
 * Maps UserProfile data to per-node visual properties.
 */

const ARCHETYPE_DOMAINS = {
  'Analytical Architect': 'Physics & Matter',
  'Empathetic Mirror': 'Psychology & Mind',
  'Conceptual Explorer': 'Art & Aesthetics',
};

const SHAPE_STYLES = {
  Square: { borderRadius: '0px' },
  Rectangle: { borderRadius: '0px', width: '16px', height: '11px' },
  Parallelogram: { clipPath: 'polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)' },
  Trapezoid: { clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)' },
  Rhombus: { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
  Kite: { clipPath: 'polygon(50% 0%, 85% 40%, 50% 100%, 15% 40%)' },
  Irregular: { clipPath: 'polygon(20% 0%, 80% 5%, 100% 60%, 75% 100%, 10% 85%, 0% 35%)' },
};

const TIER_ORDER = ['base', 'bridge', 'shade', 'words'];
const MAX_GLOW_DIST = 350;

export function getArchetypeDomainName(archetype) {
  return ARCHETYPE_DOMAINS[archetype] || null;
}

export function resolvePreferredDomainId(domains, archetype) {
  const name = getArchetypeDomainName(archetype);
  if (!name || !domains) return null;
  const match = domains.find(d => d.name === name);
  return match?.id || null;
}

export function getShapeForTier(profile, tier) {
  if (!profile || !profile.fav_shapes || profile.fav_shapes.length === 0) return null;
  const idx = TIER_ORDER.indexOf(tier);
  const shapeName = profile.fav_shapes[idx >= 0 ? idx % profile.fav_shapes.length : 0];
  return SHAPE_STYLES[shapeName] || null;
}

export function computeProximity(node, origin) {
  if (!origin) return 0;
  const dx = (node.x || 0) - (origin.x || 0);
  const dy = (node.y || 0) - (origin.y || 0);
  const dz = (node.z || 0) - (origin.z || 0);
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Math.max(0, 1 - dist / MAX_GLOW_DIST);
}