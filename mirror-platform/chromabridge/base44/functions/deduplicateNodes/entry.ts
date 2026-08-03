import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const BOUND_X = 255;
const BOUND_Y = 255;
const BOUND_Z = 255;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
const coordKey = (x, y, z) => `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;

function hexToRgb(hex) {
  const h = (hex || '#888888').replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => clampByte(v).toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch ALL nodes (paginated)
    const allNodes = [];
    let page = 0;
    let batch;
    do {
      batch = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500, page * 500);
      allNodes.push(...batch);
      page++;
    } while (batch.length === 500 && page < 30);

    // --- Phase 1: Deduplicate coordinates ---
    // Group by quantized coordinate key (catches near-collisions within 0.5 units)
    const coordGroups = new Map();
    for (const node of allNodes) {
      const key = coordKey(node.x, node.y, node.z);
      if (!coordGroups.has(key)) coordGroups.set(key, []);
      coordGroups.get(key).push(node);
    }

    // Track all existing + assigned coordinates to avoid cross-group collisions
    const usedCoords = new Set();
    for (const node of allNodes) {
      usedCoords.add(coordKey(node.x, node.y, node.z));
    }

    // For each group with duplicates, spread using a 3D grid that guarantees uniqueness
    const coordUpdates = new Map(); // id -> {x, y, z}
    let coordDupGroups = 0;
    let coordNodesSpread = 0;
    const step = 0.5;

    for (const [key, group] of coordGroups) {
      if (group.length <= 1) continue;
      coordDupGroups++;
      const [xStr, yStr, zStr] = key.split(',');
      const baseX = parseFloat(xStr);
      const baseY = parseFloat(yStr);
      const baseZ = parseFloat(zStr);

      for (let i = 1; i < group.length; i++) {
        const node = group[i];
        // 3D grid offset: cycle through 7x7x7 = 343 unique positions
        const ix = i % 7;
        const iy = Math.floor(i / 7) % 7;
        const iz = Math.floor(i / 49) % 7;
        const offsetX = (ix - 3) * step;
        const offsetY = (iy - 3) * step;
        const offsetZ = (iz - 3) * step;

        let newX = clamp(baseX + offsetX, -BOUND_X, BOUND_X);
        let newY = clamp(baseY + offsetY, 0, BOUND_Y);
        let newZ = clamp(baseZ + offsetZ, -BOUND_Z, BOUND_Z);

        // If this spot is already taken (collision with another node), nudge further
        let attempts = 0;
        while (usedCoords.has(coordKey(newX, newY, newZ)) && attempts < 50) {
          newX = clamp(newX + 0.3, -BOUND_X, BOUND_X);
          if (usedCoords.has(coordKey(newX, newY, newZ))) {
            newZ = clamp(newZ + 0.3, -BOUND_Z, BOUND_Z);
          }
          if (usedCoords.has(coordKey(newX, newY, newZ))) {
            newY = clamp(newY + 0.3, 0, BOUND_Y);
          }
          attempts++;
        }
        usedCoords.add(coordKey(newX, newY, newZ));

        coordUpdates.set(node.id, { x: newX, y: newY, z: newZ });
        coordNodesSpread++;
      }
    }

    // --- Phase 2: Deduplicate hex values ---
    // Build a map of node id -> current (possibly updated) coordinates
    const nodeCoordMap = new Map();
    for (const node of allNodes) {
      if (coordUpdates.has(node.id)) {
        nodeCoordMap.set(node.id, coordUpdates.get(node.id));
      } else {
        nodeCoordMap.set(node.id, { x: node.x, y: node.y, z: node.z });
      }
    }

    // Group by hex
    const hexGroups = new Map();
    for (const node of allNodes) {
      const hexKey = (node.hex || '#888888').toLowerCase();
      if (!hexGroups.has(hexKey)) hexGroups.set(hexKey, []);
      hexGroups.get(hexKey).push(node);
    }

    // Track all existing + assigned hex values to avoid cross-group collisions
    const usedHexes = new Set();
    for (const node of allNodes) {
      usedHexes.add((node.hex || '#888888').toLowerCase());
    }

    const hexUpdates = new Map(); // id -> {hex}
    let hexDupGroups = 0;
    let hexNodesSpread = 0;

    for (const [hexKey, group] of hexGroups) {
      if (group.length <= 1) continue;
      hexDupGroups++;
      const { r, g, b } = hexToRgb(hexKey);
      // Per-channel direction: channels near 255 jitter down, channels near 0 jitter up
      const dirR = r > 127 ? -1 : 1;
      const dirG = g > 127 ? -1 : 1;
      const dirB = b > 127 ? -1 : 1;

      for (let i = 1; i < group.length; i++) {
        const node = group[i];
        // Decompose index across B, G, R channels (like a 3-byte counter)
        const deltaB = dirB * (i % 256);
        const deltaG = dirG * (Math.floor(i / 256) % 256);
        const deltaR = dirR * (Math.floor(i / 65536) % 256);

        let newR = r + deltaR;
        let newG = g + deltaG;
        let newB = b + deltaB;

        let newHex = rgbToHex(newR, newG, newB);

        // If collision, try nudging each channel in its available direction
        let attempts = 0;
        while (usedHexes.has(newHex) && attempts < 768) {
          const phase = attempts % 3;
          if (phase === 0) newB = newB + dirB;
          else if (phase === 1) newG = newG + dirG;
          else newR = newR + dirR;
          newHex = rgbToHex(newR, newG, newB);
          attempts++;
        }
        usedHexes.add(newHex);

        hexUpdates.set(node.id, { hex: newHex });
        hexNodesSpread++;
      }
    }

    // --- Phase 3: Merge and bulk update ---
    // Combine coord + hex updates per node
    const allUpdateIds = new Set([...coordUpdates.keys(), ...hexUpdates.keys()]);
    const mergedUpdates = [];
    for (const id of allUpdateIds) {
      const coordUpdate = coordUpdates.get(id) || {};
      const hexUpdate = hexUpdates.get(id) || {};
      mergedUpdates.push({
        id,
        ...(coordUpdate.x !== undefined ? coordUpdate : {}),
        ...(hexUpdate.hex !== undefined ? hexUpdate : {}),
      });
    }

    // Process ALL updates in batches of 500 (bulkUpdate limit)
    let updatedCount = 0;
    const BATCH = 500;
    for (let i = 0; i < mergedUpdates.length; i += BATCH) {
      const chunk = mergedUpdates.slice(i, i + BATCH);
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(chunk);
      updatedCount += chunk.length;
    }

    return Response.json({
      success: true,
      total_nodes: allNodes.length,
      coord_dup_groups: coordDupGroups,
      coord_nodes_spread: coordNodesSpread,
      hex_dup_groups: hexDupGroups,
      hex_nodes_spread: hexNodesSpread,
      total_updates: mergedUpdates.length,
      updated: updatedCount,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});