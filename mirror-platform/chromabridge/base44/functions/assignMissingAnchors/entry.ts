import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ANCHOR_MAP, buildCoordinateAddress } from '../../shared/coordinateAddress.ts';

/**
 * Finds all non-base ColorNodes that lack a base anchor name in their
 * parents array, assigns the nearest anchor by Euclidean coordinate
 * distance, adds it to parents, and computes their inherited_address
 * in a single pass. No LLM calls — pure geometry.
 *
 * Admin-only. Paginates through all non-base nodes.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const anchors = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'base' });
    if (anchors.length === 0) {
      return Response.json({ error: 'No base anchors found' }, { status: 400 });
    }

    const anchorNames = new Set(anchors.map(a => a.name));

    let assigned = 0;
    let alreadyHad = 0;
    let total = 0;
    let hasMore = true;
    let skip = 0;
    const batchSize = 500;
    const updates = [];

    while (hasMore) {
      const batch = await base44.asServiceRole.entities.ColorNode.filter(
        { tier: { $ne: 'base' } },
        '-created_date',
        batchSize,
        skip
      );

      if (!batch || batch.length === 0) break;
      total += batch.length;

      for (const node of batch) {
        const parents = node.parents || [];
        const existingAnchor = parents.find(p => anchorNames.has(p));

        if (existingAnchor) {
          alreadyHad++;
          if (!node.inherited_address) {
            updates.push({
              id: node.id,
              inherited_address: buildCoordinateAddress(node.x || 0, node.y || 0, node.z || 0, existingAnchor),
            });
            assigned++;
          }
          continue;
        }

        // Find nearest anchor by coordinate distance
        let bestAnchor = null;
        let bestDist = Infinity;
        for (const a of anchors) {
          const dx = (node.x || 0) - (a.x || 0);
          const dy = (node.y || 0) - (a.y || 0);
          const dz = (node.z || 0) - (a.z || 0);
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < bestDist) {
            bestDist = dist;
            bestAnchor = a;
          }
        }

        if (!bestAnchor) continue;

        const newParents = [...new Set([...parents, bestAnchor.name])];
        const address = buildCoordinateAddress(
          node.x || 0, node.y || 0, node.z || 0, bestAnchor.name
        );

        updates.push({
          id: node.id,
          parents: newParents,
          parent_anchor_id: bestAnchor.id,
          inherited_address: address,
        });
        assigned++;
      }

      skip += batch.length;
      hasMore = batch.length === batchSize;
    }

    let updated = 0;
    for (let i = 0; i < updates.length; i += 500) {
      const chunk = updates.slice(i, i + 500);
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(chunk);
      updated += chunk.length;
    }

    return Response.json({
      status: 'success',
      total_non_base: total,
      nodes_assigned: assigned,
      already_had_anchor: alreadyHad,
      updated: updated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}