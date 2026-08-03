/**
 * Shape-Trait Taxonomy
 * Maps each geometric shape to a cognitive trait category.
 * These categories serve as trackable behavioral clusters for the persona.
 */

export const SHAPE_TRAITS = {
  Square: {
    trait: 'Stability',
    description: 'Consistency, rule-following, long-term planning',
    physicsForce: 'gravity',
    icon: 'square',
  },
  Rectangle: {
    trait: 'Structure',
    description: 'Logical sequencing, building, foundational thinking',
    physicsForce: 'gravity',
    icon: 'rectangle-horizontal',
  },
  Rhombus: {
    trait: 'Balance',
    description: 'Adaptability while maintaining core structure',
    physicsForce: 'gravity',
    icon: 'diamond',
  },
  Parallelogram: {
    trait: 'Movement',
    description: 'Curiosity, travel, desire for change',
    physicsForce: 'current',
    icon: 'parallelogram',
  },
  Trapezoid: {
    trait: 'Directionality',
    description: 'Goal-oriented focus, path-finding',
    physicsForce: 'current',
    icon: 'trapezoid',
  },
  Kite: {
    trait: 'Complexity',
    description: 'Multi-faceted interests, social complexity',
    physicsForce: 'refraction',
    icon: 'kite',
  },
  Irregular: {
    trait: 'Uniqueness',
    description: 'Divergent thinking, creativity, unique problem-solving',
    physicsForce: 'refraction',
    icon: 'irregular',
  },
};

export const TRAIT_CATEGORIES = [
  { trait: 'Stability', shape: 'Square', force: 'gravity', color: '#4a90d9' },
  { trait: 'Structure', shape: 'Rectangle', force: 'gravity', color: '#5b6ee0' },
  { trait: 'Balance', shape: 'Rhombus', force: 'gravity', color: '#7c5fd0' },
  { trait: 'Movement', shape: 'Parallelogram', force: 'current', color: '#d9a64a' },
  { trait: 'Directionality', shape: 'Trapezoid', force: 'current', color: '#d96a4a' },
  { trait: 'Complexity', shape: 'Kite', force: 'refraction', color: '#4ad97a' },
  { trait: 'Uniqueness', shape: 'Irregular', force: 'refraction', color: '#d94a9a' },
];

export const FORCE_GROUPS = {
  gravity: { label: 'Stable', description: 'Gravity wells — anchor and pull nodes into orderly grids', color: '#5b6ee0' },
  current: { label: 'Flowing', description: 'Currents — exert directional force along paths', color: '#d9a64a' },
  refraction: { label: 'Complex', description: 'Refractors — bend and distort the cognitive field', color: '#4ad97a' },
};

/**
 * Given a list of shapes, returns a distribution of trait categories.
 */
export function computeShapeDistribution(shapes) {
  const dist = {};
  for (const shape of shapes || []) {
    const entry = SHAPE_TRAITS[shape];
    if (!entry) continue;
    if (!dist[entry.trait]) {
      dist[entry.trait] = { count: 0, shapes: [], force: entry.physicsForce };
    }
    dist[entry.trait].count++;
    dist[entry.trait].shapes.push(shape);
  }
  return dist;
}

/**
 * Given a distribution, returns the dominant force group.
 */
export function getDominantForce(distribution) {
  const forceCounts = { gravity: 0, current: 0, refraction: 0 };
  for (const trait of Object.values(distribution)) {
    if (forceCounts[trait.force] !== undefined) {
      forceCounts[trait.force] += trait.count;
    }
  }
  let dominant = 'gravity';
  let max = 0;
  for (const [force, count] of Object.entries(forceCounts)) {
    if (count > max) {
      max = count;
      dominant = force;
    }
  }
  return { force: dominant, counts: forceCounts };
}