import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Associates ALL ColorNodes with persona traits using spatial proximity.
 *
 * For each ColorNode (excluding persona tier, base tier, and trait bridges),
 * finds the nearest trait bridge node by Euclidean distance in 3D space and:
 *   - Appends the trait string to the node's trait_associations array
 *   - Sets persona_node_id to the nearest trait bridge's ID
 *
 * Input: { profile_id?: string } — if provided, only that profile's traits are used.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetProfileId = body.profile_id;

    // 1. Gather all trait bridge nodes
    const traitFilter = { is_trait: true };
    if (targetProfileId) traitFilter.trait_profile_id = targetProfileId;

    const traitBridges = [];
    let tSkip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.filter(traitFilter, null, 500, tSkip);
      traitBridges.push(...batch);
      if (batch.length < 500) break;
      tSkip += 500;
    }

    if (traitBridges.length === 0) {
      return Response.json({ error: 'No trait bridge nodes found. Promote traits first.' }, { status: 400 });
    }

    // Pre-extract trait bridge coordinates for fast distance calc
    const traitCoords = traitBridges.map((tb) => ({
      id: tb.id,
      name: tb.name,
      x: tb.x || 0,
      y: tb.y || 0,
      z: tb.z || 0,
      profile_id: tb.trait_profile_id,
    }));

    function findNearestTrait(x, y, z) {
      let best = null;
      let bestDist = Infinity;
      for (const t of traitCoords) {
        const dx = (x - t.x);
        const dy = (y - t.y);
        const dz = (z - t.z);
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist < bestDist) {
          bestDist = dist;
          best = t;
        }
      }
      return best;
    }

    // 2. Iterate all ColorNodes in pages
    let updated = 0;
    let checked = 0;
    let batchUpdates = [];
    const batchSize = 400;

    let nodeSkip = 0;
    while (true) {
      const nodes = await base44.asServiceRole.entities.ColorNode.filter(
        {},
        null,
        500,
        nodeSkip
      );
      if (nodes.length === 0) break;

      for (const node of nodes) {
        // Skip persona-tier and base-tier nodes — structural
        if (node.tier === 'persona' || node.tier === 'base') continue;
        // Skip trait bridge nodes themselves
        if (node.is_trait) continue;

        checked++;

        const nx = node.x || 0;
        const ny = node.y || 0;
        const nz = node.z || 0;
        const nearest = findNearestTrait(nx, ny, nz);
        if (!nearest) continue;

        const existingTraits = node.trait_associations || [];
        const newTraits = [...existingTraits];
        let changed = false;

        if (!newTraits.includes(nearest.name)) {
          newTraits.push(nearest.name);
          changed = true;
        }

        const personaNodeId = node.persona_node_id || nearest.id;
        if (personaNodeId !== node.persona_node_id) {
          changed = true;
        }

        if (changed) {
          batchUpdates.push({
            id: node.id,
            trait_associations: newTraits,
            persona_node_id: personaNodeId,
          });
        }

        if (batchUpdates.length >= batchSize) {
          await base44.asServiceRole.entities.ColorNode.bulkUpdate(batchUpdates);
          updated += batchUpdates.length;
          batchUpdates = [];
        }
      }

      if (nodes.length < 500) break;
      nodeSkip += 500;
    }

    // Flush remaining
    if (batchUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(batchUpdates);
      updated += batchUpdates.length;
    }

    return Response.json({
      success: true,
      checked,
      updated,
      trait_bridges: traitBridges.length,
      method: 'spatial_proximity',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}