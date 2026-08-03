/**
 * ChromaBridge Vector Physics Engine
 *
 * Anchors:
 *   White (0, 100, 0)  — structural stability ceiling, form definition origin
 *   Black (0, 0, -96)  — structural flatness floor, signal suppression origin
 *
 * Axes:
 *   ΔX = |x₁ - x₂|              — thermodynamic separation (activation-regulation continuum)
 *   ΔY = 100 - y                 — structural erosion (drop from clean definition)
 *   Z elevation = z - (-96)      — signal vividness (lift out of total opacity)
 */

export const WHITE = { x: 0, y: 100, z: 0 };
export const BLACK = { x: 0, y: 0, z: -96 };

/** Thermodynamic separation — pure lateral vector distance along the activation-regulation continuum. */
export function deltaX(a, b) {
  return Math.abs(a.x - b.x);
}

/** Structural erosion — how far dropped from absolute clean definition (White ceiling). */
export function deltaY(node) {
  return 100 - node.y;
}

/** Signal vividness — how far elevated out of total opacity (Black floor). */
export function signalVividness(node) {
  return node.z - BLACK.z;
}

/** Distance from the White anchor — measure of a node's complexity relative to the form ceiling. */
export function distanceFromWhite(node) {
  return Math.sqrt((node.x - WHITE.x) ** 2 + (node.y - WHITE.y) ** 2 + (node.z - WHITE.z) ** 2);
}

/** Distance from the Black anchor — measure of structural flatness + signal suppression. */
export function distanceFromBlack(node) {
  return Math.sqrt((node.x - BLACK.x) ** 2 + (node.y - BLACK.y) ** 2 + (node.z - BLACK.z) ** 2);
}

/** Full 3D vector distance between two nodes. */
export function vectorDistance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/** Midpoint vector — the dynamic mixture result when two inputs occur simultaneously. */
export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/**
 * Falsifiability check — rejects a transition if the vector distances violate
 * the claimed direction of change. A valid translation from A to B must show
 * movement consistent with the structural/signal delta between the two states.
 *
 * Returns { valid, reason }.
 */
export function validateTransition(a, b) {
  const dWhiteA = distanceFromWhite(a);
  const dWhiteB = distanceFromWhite(b);
  const dBlackA = distanceFromBlack(a);
  const dBlackB = distanceFromBlack(b);

  // A "descent toward abstraction" (toward Black) must decrease distance from Black
  // AND increase distance from White — otherwise the claim is geometrically invalid.
  const movingTowardBlack = dBlackB < dBlackA;
  const movingAwayFromWhite = dWhiteB > dWhiteA;
  const descending = deltaY(b) > deltaY(a);

  if (descending && !(movingTowardBlack && movingAwayFromWhite)) {
    return {
      valid: false,
      reason: `Transition claims structural descent (ΔY ${deltaY(a).toFixed(0)}→${deltaY(b).toFixed(0)}) but vector distances don't confirm movement toward Black / away from White.`,
    };
  }

  return { valid: true, reason: null };
}

/**
 * Find the closest canonical color climate to a given vector position.
 * Used for dynamic mixture calculations — the midpoint is classified by
 * nearest vector bracket rather than a blend-rule lookup.
 */
export function closestClimate(point, nodes) {
  let best = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    const d = Math.sqrt((n.x - point.x) ** 2 + (n.y - point.y) ** 2 + (n.z - point.z) ** 2);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best ? { node: best, distance: bestDist } : null;
}

/**
 * Anchor trajectory alignment between two nodes.
 * Reports whether both nodes trace to the same canonical anchor and, if so,
 * how aligned their directional bearings are (cosine similarity, -1 to 1).
 */
export function anchorAlignment(a, b) {
  if (!a.parent_anchor_id || !b.parent_anchor_id) {
    return { shared: false, cosine: null, label: 'No anchor' };
  }
  if (a.parent_anchor_id !== b.parent_anchor_id) {
    return { shared: false, cosine: null, label: 'Cross-anchor' };
  }
  const va = a.anchor_bearing;
  const vb = b.anchor_bearing;
  if (!Array.isArray(va) || !Array.isArray(vb) || va.length < 3 || vb.length < 3) {
    return { shared: true, cosine: null, label: 'Shared anchor' };
  }
  const dot = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
  const cos = Math.max(-1, Math.min(1, dot));
  const label = cos > 0.5 ? 'Same trajectory' : cos < -0.5 ? 'Opposite' : 'Divergent';
  return { shared: true, cosine: cos, label };
}

/**
 * Compute the full vector profile for a translation between two nodes.
 * Returns all physics metrics for display / validation.
 */
export function translationProfile(a, b, allNodes) {
  const mid = midpoint(a, b);
  const climate = closestClimate(mid, allNodes);
  const validation = validateTransition(a, b);
  return {
    coordDeltas: { dx: b.x - a.x, dy: b.y - a.y, dz: b.z - a.z },
    deltaX: deltaX(a, b),
    deltaYErosion: deltaY(b) - deltaY(a),
    vividnessShift: signalVividness(b) - signalVividness(a),
    vectorDistance: vectorDistance(a, b),
    distFromWhite_A: distanceFromWhite(a),
    distFromWhite_B: distanceFromWhite(b),
    distFromBlack_A: distanceFromBlack(a),
    distFromBlack_B: distanceFromBlack(b),
    midpoint: mid,
    closestClimate: climate,
    anchorAlignment: anchorAlignment(a, b),
    validation,
  };
}