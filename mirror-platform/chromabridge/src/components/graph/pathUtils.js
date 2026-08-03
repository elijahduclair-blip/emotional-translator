import { vectorDistance, translationProfile, midpoint, closestClimate } from './vectorEngine';
import Octree from './octree';

const TIER_ORDER = ['base', 'bridge', 'shade'];

/** Tier compatibility factor (higher = stronger semantic link). */
function tierCompat(a, b) {
  if (!a.tier || !b.tier) return 0.7;
  if (a.tier === b.tier) return 1.0;
  const diff = Math.abs(TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  return diff === 1 ? 0.8 : 0.5;
}

/** Parent-relationship factor (higher = stronger conceptual link). */
function parentFactor(a, b) {
  const aParents = new Set(a.parents || []);
  const bParents = new Set(b.parents || []);
  if (aParents.has(b.name) || bParents.has(a.name)) return 1.0;
  const shared = [...aParents].some(p => bParents.has(p));
  return shared ? 0.9 : 0.7;
}

/**
 * Anchor-bearing factor — boosts link strength for nodes that share the same
 * canonical anchor AND point in a similar direction from it. Nodes on the same
 * semantic trajectory (parallel bearings) get the strongest boost; anti-parallel
 * bearings (semantic opposites) are penalised. Nodes without anchor data or on
 * different anchors are neutral.
 *
 * Returns a multiplier: 0.7 (anti-parallel) … 1.0 (neutral) … 1.3 (parallel).
 */
function anchorBearingFactor(a, b) {
  if (!a.parent_anchor_id || !b.parent_anchor_id) return 1.0;
  if (a.parent_anchor_id !== b.parent_anchor_id) return 1.0;
  const va = a.anchor_bearing;
  const vb = b.anchor_bearing;
  if (!Array.isArray(va) || !Array.isArray(vb) || va.length < 3 || vb.length < 3) return 1.0;
  const dot = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
  const cos = Math.max(-1, Math.min(1, dot)); // unit vectors → cosine similarity
  return 0.7 + (cos + 1) * 0.3; // map [-1,1] → [0.7, 1.3]
}

/** Dijkstra edge cost: distance weakened by semantic strength (lower = better). */
function edgeCost(a, b, distance) {
  return distance / (tierCompat(a, b) * parentFactor(a, b) * anchorBearingFactor(a, b));
}

/** Per-hop semantic strength score (0–1). */
function hopStrength(a, b, distance, adjThreshold) {
  const prox = Math.max(0.1, 1 - distance / adjThreshold);
  return prox * tierCompat(a, b) * parentFactor(a, b) * anchorBearingFactor(a, b);
}

/**
 * Computes the strongest semantic bridge between two nodes using Dijkstra
 * with weighted edges. Edge cost = 3D distance ÷ (tier compat × parent link),
 * so paths prefer close, same-tier, hierarchically-related nodes.
 * Falls back to routing through the nearest anchor (White or Black) when no
 * proximity path exists.
 */
export function computePath(nodes, idA, idB, threshold) {
  if (idA === idB) return null;
  const a = nodes.find(n => n.id === idA);
  const b = nodes.find(n => n.id === idB);
  if (!a || !b) return null;

  const idToNode = new Map(nodes.map(n => [n.id, n]));
  const adjThreshold = Math.max(threshold, 45);

  // Build weighted adjacency
  const adj = new Map();
  nodes.forEach(n => adj.set(n.id, []));
  const tree = new Octree();
  tree.build(nodes);
  for (let i = 0; i < nodes.length; i++) {
    const na = nodes[i];
    const neighbors = tree.radiusSearch(na, adjThreshold);
    for (const { node: nb, distanceSq } of neighbors) {
      if (nb.id === na.id) continue;
      const dist = Math.sqrt(distanceSq);
      const cost = edgeCost(na, nb, dist);
      adj.get(na.id).push({ id: nb.id, cost });
    }
  }

  // Dijkstra — simple sorted-array priority queue
  const dist = new Map();
  const prev = new Map();
  nodes.forEach(n => dist.set(n.id, Infinity));
  dist.set(idA, 0);
  const visited = new Set();
  const pq = [{ id: idA, cost: 0 }];
  let found = false;
  while (pq.length) {
    pq.sort((x, y) => x.cost - y.cost);
    const cur = pq.shift();
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);
    if (cur.id === idB) { found = true; break; }
    for (const edge of adj.get(cur.id)) {
      if (visited.has(edge.id)) continue;
      const newCost = dist.get(cur.id) + edge.cost;
      if (newCost < dist.get(edge.id)) {
        dist.set(edge.id, newCost);
        prev.set(edge.id, cur.id);
        pq.push({ id: edge.id, cost: newCost });
      }
    }
  }

  let pathIds;
  if (found) {
    pathIds = [idB];
    let cur = idB;
    while (cur !== idA) { cur = prev.get(cur); if (!cur) return null; pathIds.unshift(cur); }
  } else {
    const anchors = nodes.filter(n => n.name === 'White' || n.name === 'Black');
    let bestAnchor = null;
    let bestCost = Infinity;
    for (const anchor of anchors) {
      if (anchor.id === idA || anchor.id === idB) continue;
      const cost = vectorDistance(a, anchor) + vectorDistance(anchor, b);
      if (cost < bestCost) { bestCost = cost; bestAnchor = anchor; }
    }
    pathIds = bestAnchor ? [idA, bestAnchor.id, idB] : [idA, idB];
  }
  return pathIds.map(id => idToNode.get(id)).filter(Boolean);
}

/**
 * Computes a 0–100 semantic strength score for a resolved path,
 * averaging per-hop strength (proximity × tier compat × parent link).
 */
export function computePathScore(pathSequence, threshold) {
  if (!pathSequence || pathSequence.length < 2) return 0;
  const adjThreshold = Math.max(threshold, 45);
  let total = 0;
  for (let i = 0; i < pathSequence.length - 1; i++) {
    const a = pathSequence[i];
    const b = pathSequence[i + 1];
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    total += hopStrength(a, b, dist, adjThreshold);
  }
  return Math.round((total / (pathSequence.length - 1)) * 100);
}

/**
 * Returns the full vector physics profile for a translation between two nodes.
 */
export function getTranslationProfile(nodes, idA, idB) {
  const a = nodes.find(n => n.id === idA);
  const b = nodes.find(n => n.id === idB);
  if (!a || !b) return null;
  return translationProfile(a, b, nodes);
}

export { midpoint, closestClimate };