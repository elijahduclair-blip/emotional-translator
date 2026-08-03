import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/** Convert a 1-indexed integer to a bijective base-26 string (A=1, B=2, ..., Z=26, AA=27...). */
function toBase26(n: number): string {
  if (n <= 0) return '';
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

const MAX_DEPTH = 3;

/** Run DBSCAN on a set of nodes, returning clusters and noise. */
function dbscan(nodes: any[], epsilon: number, minPts: number) {
  const cellSize = epsilon;
  const grid = new Map<string, any[]>();
  function cellKey(x: number, y: number, z: number) {
    return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`;
  }
  for (const node of nodes) {
    const key = cellKey(node.x || 0, node.y || 0, node.z || 0);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(node);
  }
  function getNeighbors(node: any) {
    const neighbors: any[] = [];
    const cx = Math.floor((node.x || 0) / cellSize);
    const cy = Math.floor((node.y || 0) / cellSize);
    const cz = Math.floor((node.z || 0) / cellSize);
    const epsSq = epsilon * epsilon;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!cell) continue;
          for (const other of cell) {
            const distSq = (other.x - node.x) ** 2 + (other.y - node.y) ** 2 + (other.z - node.z) ** 2;
            if (distSq <= epsSq) neighbors.push(other);
          }
        }
      }
    }
    return neighbors;
  }

  const visited = new Set<string>();
  const clusters: any[][] = [];
  const noise: any[] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    const neighbors = getNeighbors(node);
    if (neighbors.length < minPts) {
      noise.push(node);
      continue;
    }
    const cluster: any[] = [node];
    const queue: any[] = [];
    const queued = new Set<string>();
    for (const n of neighbors) {
      if (!visited.has(n.id) && !queued.has(n.id)) {
        queue.push(n);
        queued.add(n.id);
      }
    }
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      cluster.push(current);
      const currentNeighbors = getNeighbors(current);
      if (currentNeighbors.length >= minPts) {
        for (const n of currentNeighbors) {
          if (!visited.has(n.id) && !queued.has(n.id)) {
            queue.push(n);
            queued.add(n.id);
          }
        }
      }
    }
    clusters.push(cluster);
  }
  return { clusters, noise };
}

/** Compute cluster centroid, radius, label node, and blend color. */
function computeClusterMeta(cluster: any[]) {
  const cx = cluster.reduce((s, n) => s + (n.x || 0), 0) / cluster.length;
  const cy = cluster.reduce((s, n) => s + (n.y || 0), 0) / cluster.length;
  const cz = cluster.reduce((s, n) => s + (n.z || 0), 0) / cluster.length;
  let labelNode = cluster[0];
  let minDist = Infinity;
  let radius = 0;
  for (const n of cluster) {
    const d = (n.x - cx) ** 2 + (n.y - cy) ** 2 + (n.z - cz) ** 2;
    if (d < minDist) { minDist = d; labelNode = n; }
    const dr = Math.sqrt(d);
    if (dr > radius) radius = dr;
  }
  let r = 0, g = 0, b = 0;
  for (const n of cluster) {
    const h = (n.hex || '#888888').replace('#', '');
    r += parseInt(h.substring(0, 2), 16) || 0;
    g += parseInt(h.substring(2, 4), 16) || 0;
    b += parseInt(h.substring(4, 6), 16) || 0;
  }
  r = Math.round(r / cluster.length);
  g = Math.round(g / cluster.length);
  b = Math.round(b / cluster.length);
  const color = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  return { centroid: { x: cx, y: cy, z: cz }, labelNode, radius, color };
}

/** Assign final leaf indices using the node's name letters as the code. */
function assignLeafIndices(nodes: any[], depth: number, prefix: string, addressMap: Map<string, string>) {
  if (nodes.length === 0) return;

  const groups = new Map<string, any[]>();
  for (const node of nodes) {
    const raw = (node.name || '').toUpperCase();
    const clean = raw.replace(/[^A-Z]/g, '') || 'A';
    const char = clean[depth % clean.length];
    if (!groups.has(char)) groups.set(char, []);
    groups.get(char)!.push(node);
  }

  for (const [char, groupNodes] of groups) {
    if (groupNodes.length === 1) {
      const node = groupNodes[0];
      addressMap.set(node.id, prefix ? `${prefix}.${char}` : char);
    } else {
      groupNodes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      for (let i = 0; i < groupNodes.length; i++) {
        const node = groupNodes[i];
        const leaf = i === 0 ? char : `${char}${toBase26(i + 1)}`;
        addressMap.set(node.id, prefix ? `${prefix}.${leaf}` : leaf);
      }
    }
  }
}

/**
 * Recursively sub-partition nodes within a domain using DBSCAN.
 * The top-level domain assignment (depth 0) is done by base-anchor proximity;
 * this function handles depth 1+ sub-partitioning.
 */
function partitionSub(
  nodes: any[],
  depth: number,
  prefix: string,
  epsilon: number,
  minPts: number,
  addressMap: Map<string, string>
) {
  if (nodes.length === 0) return;

  if (depth >= MAX_DEPTH || nodes.length < minPts * 2) {
    assignLeafIndices(nodes, depth, prefix, addressMap);
    return;
  }

  const { clusters, noise } = dbscan(nodes, epsilon, minPts);
  clusters.sort((a, b) => b.length - a.length);

  for (let ci = 0; ci < clusters.length; ci++) {
    const cluster = clusters[ci];
    const digit = toBase26(ci + 1);
    const newPrefix = prefix ? `${prefix}.${digit}` : digit;
    const meta = computeClusterMeta(cluster);
    const subEpsilon = Math.max(meta.radius * 0.25, 5);
    partitionSub(cluster, depth + 1, newPrefix, subEpsilon, minPts, addressMap);
  }

  if (noise.length > 0 && depth > 0) {
    assignLeafIndices(noise, depth, prefix, addressMap);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const minPts = body.min_pts || 5;

    // Fetch all nodes (paginated)
    let allNodes: any[] = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500, skip);
      allNodes.push(...batch);
      if (batch.length < 500) break;
      skip += 500;
    }

    if (allNodes.length === 0) {
      return Response.json({ error: 'No nodes found' }, { status: 400 });
    }

    // Base anchors ARE the domains
    const baseAnchors = allNodes.filter(n => n.tier === 'base');
    if (baseAnchors.length === 0) {
      return Response.json({ error: 'No base-tier anchors found — cannot define domains' }, { status: 400 });
    }

    // Voronoi partition: assign each node to its nearest base anchor
    const domains: { anchor: any; members: any[] }[] = baseAnchors.map(a => ({ anchor: a, members: [] }));
    const nonBase = allNodes.filter(n => n.tier !== 'base');

    for (const node of nonBase) {
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < baseAnchors.length; i++) {
        const a = baseAnchors[i];
        const distSq = (node.x - a.x) ** 2 + (node.y - a.y) ** 2 + (node.z - a.z) ** 2;
        if (distSq < nearestDist) {
          nearestDist = distSq;
          nearestIdx = i;
        }
      }
      domains[nearestIdx].members.push(node);
    }

    // Sort domains by member count descending (largest = A)
    domains.sort((a, b) => b.members.length - a.members.length);

    const addressMap = new Map<string, string>();
    const domainRecords: any[] = [];

    for (let di = 0; di < domains.length; di++) {
      const { anchor, members } = domains[di];
      const domainDigit = toBase26(di + 1);
      const memberIds = new Set(members.map(m => m.id));

      // Compute domain metadata from members (centroid/radius/color) — falls back to anchor itself
      let centroid = { x: anchor.x, y: anchor.y, z: anchor.z };
      let radius = 0;
      let color = anchor.hex;
      if (members.length > 0) {
        const meta = computeClusterMeta(members);
        centroid = meta.centroid;
        radius = meta.radius;
        color = meta.color;
      }

      domainRecords.push({
        anchor,
        members,
        domainDigit,
        centroid,
        radius,
        color,
        memberIds,
      });

      // Sub-partition within this domain using DBSCAN (depth 1+)
      const initialEpsilon = Math.max(radius * 0.4, 15);
      partitionSub(members, 1, domainDigit, initialEpsilon, minPts, addressMap);

      // Base anchor gets its own address: just the domain digit
      addressMap.set(anchor.id, domainDigit);
    }

    // Clear old domains
    await base44.asServiceRole.entities.Domain.deleteMany({});

    // Create Domain records — one per base anchor
    const createdDomains: any[] = [];
    for (const dr of domainRecords) {
      const domain = await base44.asServiceRole.entities.Domain.create({
        name: dr.anchor.name,
        centroid_x: Math.round(dr.centroid.x * 100) / 100,
        centroid_y: Math.round(dr.centroid.y * 100) / 100,
        centroid_z: Math.round(dr.centroid.z * 100) / 100,
        radius: Math.round(dr.radius * 100) / 100,
        member_count: dr.members.length,
        color: dr.color,
        label_node_id: dr.anchor.id,
      });
      createdDomains.push({ id: domain.id, ...dr });
    }

    // Build node updates: domain assignment, symbolic address, intersection detection
    const domainUpdates: any[] = [];
    let intersectionCount = 0;

    for (let di = 0; di < createdDomains.length; di++) {
      const dr = createdDomains[di];
      for (const node of dr.members) {
        let isIntersection = false;
        for (let oi = 0; oi < createdDomains.length; oi++) {
          if (oi === di) continue;
          const other = createdDomains[oi];
          const distSq = (node.x - other.centroid.x) ** 2 + (node.y - other.centroid.y) ** 2 + (node.z - other.centroid.z) ** 2;
          const threshold = other.radius * 1.2;
          if (distSq <= threshold * threshold) {
            isIntersection = true;
            break;
          }
        }
        if (isIntersection) intersectionCount++;
        domainUpdates.push({
          id: node.id,
          domain_id: dr.id,
          is_intersection: isIntersection,
          symbolic_address: addressMap.get(node.id) || '',
        });
      }
      // Base anchor update
      domainUpdates.push({
        id: dr.anchor.id,
        domain_id: dr.id,
        is_intersection: false,
        symbolic_address: addressMap.get(dr.anchor.id) || '',
      });
    }

    // Bulk update in batches of 500
    for (let i = 0; i < domainUpdates.length; i += 500) {
      const chunk = domainUpdates.slice(i, i + 500);
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(chunk);
    }

    return Response.json({
      domains_detected: createdDomains.length,
      domain_names: createdDomains.map(d => `${d.anchor.name} (${d.members.length})`),
      nodes_assigned: nonBase.length,
      intersections_found: intersectionCount,
      total_nodes: allNodes.length,
      max_depth: MAX_DEPTH,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});