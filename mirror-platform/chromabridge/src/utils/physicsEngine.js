/**
 * ChromaBridge Physics Engine
 *
 * Shape-traits exert physics forces on the cognitive 3D space:
 *   - Gravity (Stability, Structure, Balance): pull nearby nodes into orderly grids
 *   - Current  (Movement, Directionality):      push nodes along directional vectors
 *   - Refraction (Complexity, Uniqueness):       bend and distort nearby node trajectories
 *
 * Forces are computed as spatial field functions — each node with a shape-trait
 * contributes a force vector at any query point based on distance and the
 * trait's physics parameters.
 */

import { SHAPE_TRAITS, FORCE_GROUPS } from '@/utils/shapeTraits';
import { vectorDistance, distanceFromWhite, distanceFromBlack } from '@/components/graph/vectorEngine';

// Force exertion parameters per physics group
const FORCE_PARAMS = {
  gravity: {
    radius: 80,        // influence radius
    strength: 0.15,     // pull strength toward anchor
    snap: 12,           // snap-to-grid distance threshold
    gridSpacing: 20,   // ideal grid spacing for orderly arrangement
  },
  current: {
    radius: 100,       // influence radius
    strength: 0.08,     // push strength along bearing
    decay: 0.92,        // velocity decay per step
  },
  refraction: {
    radius: 70,         // influence radius
    strength: 0.12,     // distortion magnitude
    bend: 0.3,          // how much it bends the trajectory (0=none, 1=full perpendicular)
  },
};

/**
 * Get the physics force group for a node based on its shape-trait metadata.
 * Falls back to null if the node has no shape-trait assignment.
 */
export function getNodeForceGroup(node) {
  // Check direct shape_trait field
  if (node.shape_trait) {
    const cat = Object.values(SHAPE_TRAITS).find((s) => s.trait === node.shape_trait);
    if (cat) return cat.physicsForce;
  }
  // Check trait_associations for shape-trait matches
  if (node.trait_associations && node.trait_associations.length > 0) {
    for (const trait of node.trait_associations) {
      const cat = Object.values(SHAPE_TRAITS).find((s) => s.trait === trait);
      if (cat) return cat.physicsForce;
    }
  }
  return null;
}

/**
 * Compute the gravity force exerted by a node at a query point.
 * Gravity pulls the query point toward the nearest grid position around the node.
 */
function gravityForce(node, point) {
  const params = FORCE_PARAMS.gravity;
  const dist = vectorDistance(node, point);
  if (dist > params.radius || dist < 0.01) return { fx: 0, fy: 0, fz: 0 };

  // Snap to nearest grid intersection near the node
  const gx = Math.round(point.x / params.gridSpacing) * params.gridSpacing;
  const gy = Math.round(point.y / params.gridSpacing) * params.gridSpacing;
  const gz = Math.round(point.z / params.gridSpacing) * params.gridSpacing;

  // Force pulls point toward the nearest grid position
  const dx = gx - point.x;
  const dy = gy - point.y;
  const dz = gz - point.z;

  // Falloff: stronger at mid-range, weaker at edge and very close (avoid self-collapse)
  const falloff = 1 - (dist / params.radius);
  const magnitude = params.strength * falloff;

  return {
    fx: dx * magnitude,
    fy: dy * magnitude,
    fz: dz * magnitude,
  };
}

/**
 * Compute the current force exerted by a node at a query point.
 * Current pushes the query point along the node's anchor bearing (directional flow).
 */
function currentForce(node, point) {
  const params = FORCE_PARAMS.current;
  const dist = vectorDistance(node, point);
  if (dist > params.radius || dist < 0.01) return { fx: 0, fy: 0, fz: 0 };

  // Direction from the node's anchor bearing, or fall back to node→point direction
  let dx, dy, dz;
  if (node.anchor_bearing && node.anchor_bearing.length >= 3) {
    dx = node.anchor_bearing[0];
    dy = node.anchor_bearing[1];
    dz = node.anchor_bearing[2];
  } else {
    dx = point.x - node.x;
    dy = point.y - node.y;
    dz = point.z - node.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    dx /= len; dy /= len; dz /= len;
  }

  const falloff = 1 - (dist / params.radius);
  const magnitude = params.strength * falloff;

  return {
    fx: dx * magnitude,
    fy: dy * magnitude,
    fz: dz * magnitude,
  };
}

/**
 * Compute the refraction force exerted by a node at a query point.
 * Refraction bends the trajectory by applying a perpendicular distortion.
 */
function refractionForce(node, point) {
  const params = FORCE_PARAMS.refraction;
  const dist = vectorDistance(node, point);
  if (dist > params.radius || dist < 0.01) return { fx: 0, fy: 0, fz: 0 };

  // Vector from node to point
  const dx = point.x - node.x;
  const dy = point.y - node.y;
  const dz = point.z - node.z;

  // Refraction bends perpendicular to the radial direction
  // Using a perpendicularized vector (rotate 90° in XZ plane)
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const nz = dz / len;

  // Perpendicular: rotate in XZ plane
  const px = -nz;
  const py = ny * params.bend;
  const pz = nx;

  const falloff = 1 - (dist / params.radius);
  const magnitude = params.strength * falloff * (0.5 + 0.5 * Math.sin(dist * 0.05));

  return {
    fx: px * magnitude,
    fy: py * magnitude,
    fz: pz * magnitude,
  };
}

const FORCE_FNS = {
  gravity: gravityForce,
  current: currentForce,
  refraction: refractionForce,
};

/**
 * Compute the cumulative physics force at a query point from all active nodes.
 * Each node contributes its shape-trait force based on its force group.
 *
 * @param {Object} point - { x, y, z } query position
 * @param {Array} nodes - array of nodes with shape-trait metadata
 * @returns {Object} { fx, fy, fz, contributions } - total force vector and breakdown
 */
export function computeFieldForce(point, nodes) {
  let fx = 0, fy = 0, fz = 0;
  const contributions = { gravity: 0, current: 0, refraction: 0 };

  for (const node of nodes) {
    const group = getNodeForceGroup(node);
    if (!group) continue;
    const fn = FORCE_FNS[group];
    if (!fn) continue;
    const f = fn(node, point);
    fx += f.fx;
    fy += f.fy;
    fz += f.fz;
    contributions[group]++;
  }

  return { fx, fy, fz, contributions };
}

/**
 * Apply a single physics step to a set of nodes.
 * Each node's position is updated based on the cumulative force exerted on it
 * by all OTHER nodes in the field.
 *
 * @param {Array} nodes - nodes with x, y, z and shape-trait metadata
 * @param {Object} options - { dt: time step, velocityMap: Map of id→{vx,vy,vz} }
 * @returns {Object} { positions: Map of id→{x,y,z}, velocities: Map, maxDisplacement }
 */
export function physicsStep(nodes, options = {}) {
  const dt = options.dt ?? 1.0;
  const velocityMap = options.velocityMap || new Map();
  const positions = new Map();
  let maxDisplacement = 0;

  for (const node of nodes) {
    // Compute force at this node's position from all OTHER nodes
    const others = nodes.filter((n) => n.id !== node.id);
    const force = computeFieldForce(node, others);

    // Get or initialize velocity
    let vel = velocityMap.get(node.id);
    if (!vel) {
      vel = { vx: 0, vy: 0, vz: 0 };
      velocityMap.set(node.id, vel);
    }

    // Apply force to velocity
    vel.vx = (vel.vx + force.fx) * (FORCE_PARAMS.current.decay);
    vel.vy = (vel.vy + force.fy) * (FORCE_PARAMS.current.decay);
    vel.vz = (vel.vz + force.fz) * (FORCE_PARAMS.current.decay);

    // Compute new position
    const newX = node.x + vel.vx * dt;
    const newY = node.y + vel.vy * dt;
    const newZ = node.z + vel.vz * dt;

    const displacement = Math.sqrt(
      (newX - node.x) ** 2 + (newY - node.y) ** 2 + (newZ - node.z) ** 2
    );
    if (displacement > maxDisplacement) maxDisplacement = displacement;

    positions.set(node.id, { x: newX, y: newY, z: newZ });
  }

  return { positions, velocities: velocityMap, maxDisplacement };
}

/**
 * Compute a "cognitive drift" vector for a node — the direction its shape-trait
 * physics would push it if all forces resolved. Used for visualization arrows.
 *
 * @param {Object} node - the node to analyze
 * @param {Array} neighbors - nearby nodes exerting force
 * @returns {Object} { dx, dy, dz, magnitude, forceGroup }
 */
export function cognitiveDrift(node, neighbors) {
  const force = computeFieldForce(node, neighbors);
  const magnitude = Math.sqrt(force.fx ** 2 + force.fy ** 2 + force.fz ** 2);
  let dominantGroup = null;
  let maxContrib = 0;
  for (const [group, count] of Object.entries(force.contributions)) {
    if (count > maxContrib) {
      maxContrib = count;
      dominantGroup = group;
    }
  }
  return {
    dx: force.fx,
    dy: force.fy,
    dz: force.fz,
    magnitude,
    forceGroup: dominantGroup,
  };
}

/**
 * Compute physics metrics for a node relative to the field.
 * Integrates with the existing vector engine's White/Black anchor distances.
 */
export function nodePhysicsProfile(node, neighbors) {
  const drift = cognitiveDrift(node, neighbors);
  const group = getNodeForceGroup(node);
  const groupMeta = group ? FORCE_GROUPS[group] : null;

  return {
    forceGroup: group,
    forceLabel: groupMeta?.label || 'Neutral',
    forceColor: groupMeta?.color || '#888888',
    drift,
    distFromWhite: distanceFromWhite(node),
    distFromBlack: distanceFromBlack(node),
    // Energy = how much this node is actively exerting force on the field
    energy: drift.magnitude * (neighbors.length > 0 ? 1 : 0),
    // Resonance = how close this node is to both structural anchors simultaneously
    resonance: 1 / (1 + distanceFromWhite(node) + distanceFromBlack(node)),
  };
}