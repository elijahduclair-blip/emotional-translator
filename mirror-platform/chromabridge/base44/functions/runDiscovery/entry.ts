import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ── Inlined Octree (backend functions can't do local imports) ──

const MAX_POINTS_PER_LEAF = 8;
const MAX_DEPTH = 12;

function makeOctreeNode(cx, cy, cz, half, depth) {
  return { cx, cy, cz, half, depth, points: null, children: null };
}

function octantContaining(point, node) {
  return (point.x >= node.cx ? 4 : 0) | (point.y >= node.cy ? 2 : 0) | (point.z >= node.cz ? 1 : 0);
}

function childCenter(parent, octant) {
  const q = parent.half / 2;
  return [
    parent.cx + (octant & 4 ? q : -q),
    parent.cy + (octant & 2 ? q : -q),
    parent.cz + (octant & 1 ? q : -q),
  ];
}

function insertPoint(point, node) {
  if (node.children) {
    const o = octantContaining(point, node);
    const [cx, cy, cz] = childCenter(node, o);
    if (!node.children[o]) node.children[o] = makeOctreeNode(cx, cy, cz, node.half / 2, node.depth + 1);
    insertPoint(point, node.children[o]);
    return;
  }
  if (!node.points) node.points = [];
  node.points.push(point);
  if (node.points.length > MAX_POINTS_PER_LEAF && node.depth < MAX_DEPTH) {
    node.children = new Array(8).fill(null);
    const old = node.points;
    node.points = null;
    for (const p of old) {
      const o = octantContaining(p, node);
      const [cx, cy, cz] = childCenter(node, o);
      if (!node.children[o]) node.children[o] = makeOctreeNode(cx, cy, cz, node.half / 2, node.depth + 1);
      insertPoint(p, node.children[o]);
    }
  }
}

function distSqToBox(point, node) {
  const dx = Math.max(Math.abs(point.x - node.cx) - node.half, 0);
  const dy = Math.max(Math.abs(point.y - node.cy) - node.half, 0);
  const dz = Math.max(Math.abs(point.z - node.cz) - node.half, 0);
  return dx * dx + dy * dy + dz * dz;
}

function radiusSearchRecursive(point, rSq, node, results) {
  if (distSqToBox(point, node) > rSq) return;
  if (node.children) {
    for (const child of node.children) {
      if (child) radiusSearchRecursive(point, rSq, child, results);
    }
    return;
  }
  if (node.points) {
    for (const p of node.points) {
      const dx = p.x - point.x, dy = p.y - point.y, dz = p.z - point.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq <= rSq) results.push({ node: p, distanceSq: dSq });
    }
  }
}

class Octree {
  constructor() {
    this.root = null;
    this._size = 0;
  }

  build(nodes) {
    this.root = null;
    this._size = 0;
    if (!nodes || nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
      if (n.z < minZ) minZ = n.z; if (n.z > maxZ) maxZ = n.z;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    let half = Math.max(maxX - cx, maxY - cy, maxZ - cz) + 1;
    if (half < 1) half = 1;
    this.root = makeOctreeNode(cx, cy, cz, half, 0);
    for (const n of nodes) {
      insertPoint(n, this.root);
      this._size++;
    }
  }

  radiusSearch(point, r) {
    const results = [];
    if (!this.root) return results;
    radiusSearchRecursive(point, r * r, this.root, results);
    return results;
  }
}

// ── Pairwise discovery scoring ──

const TIER_ORDER = ['base', 'bridge', 'shade'];

function hasSemanticEdge(a, b) {
  const aParents = new Set(a.parents || []);
  const bParents = new Set(b.parents || []);
  return aParents.has(b.name) || bParents.has(a.name);
}

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

function tierCompatibility(a, b) {
  if (a.tier === b.tier) return 1;
  const diff = Math.abs(TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  return diff === 1 ? 0.6 : 0.3;
}

function placementConfidence(a, b) {
  const aParents = new Set(a.parents || []);
  const bParents = new Set(b.parents || []);
  const shared = [...aParents].filter(p => bParents.has(p)).length;
  return shared === 0 ? 1 : 0.4;
}

// ── Cluster analysis ──

function findClusters(nodes, tree, threshold) {
  const visited = new Set();
  const clusters = [];
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const members = [];
    const queue = [node];
    visited.add(node.id);
    while (queue.length > 0) {
      const cur = queue.shift();
      members.push(cur);
      for (const { node: n } of tree.radiusSearch(cur, threshold)) {
        if (!visited.has(n.id)) {
          visited.add(n.id);
          queue.push(n);
        }
      }
    }
    if (members.length >= 2) clusters.push(members);
  }
  return clusters;
}

function computeClusterMetrics(members) {
  const n = members.length;
  const cx = members.reduce((s, m) => s + (m.x || 0), 0) / n;
  const cy = members.reduce((s, m) => s + (m.y || 0), 0) / n;
  const cz = members.reduce((s, m) => s + (m.z || 0), 0) / n;
  let maxDist = 0, sumSq = 0;
  for (const m of members) {
    const dx = (m.x || 0) - cx, dy = (m.y || 0) - cy, dz = (m.z || 0) - cz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > maxDist) maxDist = dist;
    sumSq += dx * dx + dy * dy + dz * dz;
  }
  const radius = maxDist || 1;
  const variance = sumSq / n;
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  const density = n / volume;
  // Blend color
  let r = 0, g = 0, b = 0;
  for (const m of members) {
    const hex = (m.hex || '#888888').replace('#', '');
    r += parseInt(hex.slice(0, 2), 16);
    g += parseInt(hex.slice(2, 4), 16);
    b += parseInt(hex.slice(4, 6), 16);
  }
  const blendHex = '#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('');
  return { cx, cy, cz, radius, variance, density, blendHex, size: n };
}

function sphereOverlapPct(d, R, r) {
  if (d >= R + r) return 0;
  if (d <= Math.abs(R - r)) return 100;
  return Math.round(((R + r - d) / (2 * Math.min(R, r))) * 100);
}

// ── Main handler ──

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* workflow context */ }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nodes = await base44.asServiceRole.entities.ColorNode.list();
    if (!nodes || nodes.length < 2) {
      return Response.json({ message: 'Not enough nodes to scan', scanned: nodes?.length || 0, candidates: 0 });
    }

    const radius = 50;
    const threshold = 35;
    const weights = { wd: 0.4, wn: 0.3, wt: 0.2, wp: 0.1 };

    const tree = new Octree();
    tree.build(nodes);

    const candidates = [];

    // ── Pairwise scan: bridge / new_node candidates ──
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
        const localDensity = tree.radiusSearch(a, radius).length - 1;
        const type = (sharedN < 2 && localDensity > 4) ? 'new_node' : 'bridge';
        const score = weights.wd * D + weights.wn * N + weights.wt * T + weights.wp * P;

        candidates.push({
          node_a_id: a.id, node_a_name: a.name, node_a_hex: a.hex,
          node_b_id: b.id, node_b_name: b.name, node_b_hex: b.hex,
          distance: d, shared_neighbors: sharedN, local_density: localDensity,
          score, type, status: 'pending',
        });
      }
    }

    // ── Cluster analysis: territory metrics + smarter discoveries ──
    const clusters = findClusters(nodes, tree, threshold);
    const clusterData = clusters.map(members => ({ members, ...computeClusterMetrics(members) }));

    // Inter-cluster metrics: nearest territory + max overlap
    for (let i = 0; i < clusterData.length; i++) {
      const a = clusterData[i];
      let nearestDist = Infinity;
      let maxOverlap = 0;
      for (let j = 0; j < clusterData.length; j++) {
        if (i === j) continue;
        const b = clusterData[j];
        const dx = a.cx - b.cx, dy = a.cy - b.cy, dz = a.cz - b.cz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < nearestDist) nearestDist = dist;
        const overlap = sphereOverlapPct(dist, a.radius, b.radius);
        if (overlap > maxOverlap) maxOverlap = overlap;
      }
      a.nearestTerritoryDist = nearestDist === Infinity ? 0 : nearestDist;
      a.maxOverlapPct = maxOverlap;
    }

    const maxDensity = Math.max(...clusterData.map(c => c.density), 1);
    const maxSize = Math.max(...clusterData.map(c => c.size), 1);

    // Detect territory/label mismatches
    for (const cd of clusterData) {
      const labelCounts = {};
      for (const m of cd.members) {
        for (const label of (m.semantic_labels || [])) {
          labelCounts[label] = (labelCounts[label] || 0) + 1;
        }
      }
      const sortedLabels = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]);
      const dominantLabel = sortedLabels[0]?.[0];
      if (!dominantLabel) continue;

      for (const m of cd.members) {
        const labels = m.semantic_labels || [];
        if (labels.length > 0 && !labels.includes(dominantLabel)) {
          const dx = (m.x || 0) - cd.cx, dy = (m.y || 0) - cd.cy, dz = (m.z || 0) - cd.cz;
          const distFromCentroid = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const score = 0.4 + 0.3 * Math.min(1, cd.density / maxDensity) + 0.3 * Math.min(1, distFromCentroid / cd.radius);
          candidates.push({
            node_a_id: m.id, node_a_name: m.name, node_a_hex: m.hex,
            node_b_id: '', node_b_name: '', node_b_hex: '',
            distance: distFromCentroid, shared_neighbors: 0, local_density: cd.size,
            score, type: 'territory_mismatch', status: 'pending',
            insight: `"${m.name}" lies inside the ${dominantLabel} territory but is labeled ${labels.join(', ')}.`,
            cluster_centroid_x: cd.cx, cluster_centroid_y: cd.cy, cluster_centroid_z: cd.cz,
            cluster_radius: cd.radius, cluster_density: cd.density, cluster_variance: cd.variance,
            cluster_overlap_pct: cd.maxOverlapPct, nearest_territory_distance: cd.nearestTerritoryDist,
            cluster_blend_hex: cd.blendHex,
          });
        }
      }
    }

    // Detect dense pockets without representative concepts
    for (const cd of clusterData) {
      const hasRep = cd.members.some(m => m.tier === 'base' || m.tier === 'bridge');
      if (!hasRep && cd.size >= 3) {
        const score = 0.4 + 0.3 * Math.min(1, cd.density / maxDensity) + 0.3 * Math.min(1, cd.size / maxSize);
        candidates.push({
          node_a_id: '', node_a_name: '', node_a_hex: '',
          node_b_id: '', node_b_name: '', node_b_hex: '',
          distance: 0, shared_neighbors: 0, local_density: cd.size,
          score, type: 'dense_pocket', status: 'pending',
          insight: `This territory contains a dense pocket (${cd.size} nodes) with no representative concept.`,
          cluster_centroid_x: cd.cx, cluster_centroid_y: cd.cy, cluster_centroid_z: cd.cz,
          cluster_radius: cd.radius, cluster_density: cd.density, cluster_variance: cd.variance,
          cluster_overlap_pct: cd.maxOverlapPct, nearest_territory_distance: cd.nearestTerritoryDist,
          cluster_blend_hex: cd.blendHex,
        });
      }
    }

    // Ensure type diversity: take top 15 per type, then best overall to fill 50
    const byType = { bridge: [], new_node: [], territory_mismatch: [], dense_pocket: [] };
    for (const c of candidates) {
      if (byType[c.type]) byType[c.type].push(c);
    }
    const diverseTop = [];
    for (const type of Object.keys(byType)) {
      byType[type].sort((a, b) => b.score - a.score);
      diverseTop.push(...byType[type].slice(0, 15));
    }
    diverseTop.sort((a, b) => b.score - a.score);
    const top = diverseTop.slice(0, 50);
    // Clear old pending candidates before storing fresh results
    await base44.asServiceRole.entities.DiscoveryCandidate.deleteMany({ status: 'pending' });

    if (top.length > 0) {
      await base44.asServiceRole.entities.DiscoveryCandidate.bulkCreate(top);
    }

    return Response.json({
      scanned: nodes.length,
      candidates: top.length,
      bridges: top.filter(c => c.type === 'bridge').length,
      newNodes: top.filter(c => c.type === 'new_node').length,
      territoryMismatches: top.filter(c => c.type === 'territory_mismatch').length,
      densePockets: top.filter(c => c.type === 'dense_pocket').length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});