import { vectorDistance } from './vectorEngine';
import Octree from './octree';

const DEFAULT_RADIUS = 50;
const DEFAULT_WEIGHTS = { wd: 0.4, wn: 0.3, wt: 0.2, wp: 0.1 };
const TIER_ORDER = ['base', 'bridge', 'shade'];

/** A semantic edge exists if either node lists the other as a parent. */
function hasSemanticEdge(a, b) {
  const aParents = new Set(a.parents || []);
  const bParents = new Set(b.parents || []);
  return aParents.has(b.name) || bParents.has(a.name);
}

/** Count nodes within the proximity threshold of BOTH a and b, using Octree. */
function sharedNeighborCount(a, b, tree, threshold) {
  const nearA = new Map();
  for (const { node: n } of tree.radiusSearch(a, threshold)) {
    if (n.id !== a.id && n.id !== b.id) nearA.set(n.id, true);
  }
  let count = 0;
  for (const { node: n } of tree.radiusSearch(b, threshold)) {
    if (n.id !== a.id && n.id !== b.id && nearA.has(n.id)) count++;
  }
  return count;
}

/** Tier compatibility — same tier scores highest; adjacent tiers moderate. */
function tierCompatibility(a, b) {
  if (a.tier === b.tier) return 1;
  const diff = Math.abs(TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  return diff === 1 ? 0.6 : 0.3;
}

/** Placement confidence — if parents don't overlap, placements are likely independent. */
function placementConfidence(a, b) {
  const aParents = new Set(a.parents || []);
  const bParents = new Set(b.parents || []);
  const shared = [...aParents].filter(p => bParents.has(p)).length;
  return shared === 0 ? 1 : 0.4;
}

/**
 * Discovery algorithm — finds node pairs that are geometrically close
 * but lack a direct semantic edge. Returns candidates ranked by score:
 *
 *   S(A,B) = w_d·D + w_n·N + w_t·T + w_p·P
 *
 * where D = normalized proximity, N = shared-neighbor score,
 * T = tier compatibility, P = independent placement confidence.
 *
 * Geometric closeness creates a CANDIDATE relationship — never an
 * automatic one. Review determines whether it becomes a bridge, a
 * boundary, or coincidence.
 */
export function discoverCandidates(nodes, radius = DEFAULT_RADIUS, threshold = 35, weights = DEFAULT_WEIGHTS) {
  if (!nodes || nodes.length < 2) return [];
  const tree = new Octree();
  tree.build(nodes);
  const candidates = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const neighbors = tree.radiusSearch(a, radius);
    for (const { node: b, distanceSq } of neighbors) {
      if (b.id <= a.id) continue;
      if (hasSemanticEdge(a, b)) continue;
      const d = Math.sqrt(distanceSq);
      if (d < 0.001) continue;

      const D = 1 - d / radius;
      const sharedN = sharedNeighborCount(a, b, tree, threshold);
      const N = Math.min(1, sharedN / 5);
      const T = tierCompatibility(a, b);
      const P = placementConfidence(a, b);

      // Cluster density: how many nodes populate the local region around A.
      const localDensity = tree.radiusSearch(a, radius).length - 1; // exclude self
      // New-node signal: densely populated region but low shared connectivity —
      // the geometry suggests an intermediate concept that doesn't exist yet.
      const type = (sharedN < 2 && localDensity > 4) ? 'new_node' : 'bridge';

      const score = weights.wd * D + weights.wn * N + weights.wt * T + weights.wp * P;

      candidates.push({
        nodeA: a,
        nodeB: b,
        distance: d,
        sharedNeighbors: sharedN,
        localDensity,
        placementSources: P === 1 ? 'independent' : 'shared lineage',
        semanticEdge: 'none',
        scores: { D, N, T, P },
        type,
        score,
      });
    }
  }
  return candidates.sort((x, y) => y.score - x.score);
}