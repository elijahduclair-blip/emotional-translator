import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ANCHOR_MAP, buildCoordinateAddress, computeDissonance } from '../../shared/coordinateAddress.ts';

/**
 * Re-indexes all ColorNodes with the pure base-26 coordinate address.
 * Each node's `inherited_address` is recomputed from its (x, y, z) and
 * the first base anchor in its `parents` array.
 *
 * Admin-only. Paginates through all nodes in batches of 200.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let updated = 0;
    let skipped = 0;
    let total = 0;
    let hasMore = true;
    let skip = 0;
    const batchSize = 200;

    while (hasMore) {
      const batch = await base44.asServiceRole.entities.ColorNode.list(
        '-created_date',
        batchSize,
        skip
      );

      if (!batch || batch.length === 0) break;
      total += batch.length;

      const updates = [];
      for (const node of batch) {
        const anchorName = (node.parents || []).find(
          (p) => ANCHOR_MAP[p]
        );

        if (!anchorName && node.tier !== 'base') {
          skipped++;
          continue;
        }

        const anchor = anchorName || node.name;
        const address = buildCoordinateAddress(
          node.x || 0,
          node.y || 0,
          node.z || 0,
          anchor
        );

        const tempNode = { ...node, inherited_address: address };
        updates.push({
          id: node.id,
          inherited_address: address,
          address_dissonance: computeDissonance(tempNode),
        });
      }

      if (updates.length > 0) {
        await base44.asServiceRole.entities.ColorNode.bulkUpdate(updates);
        updated += updates.length;
      }

      skip += batch.length;
      hasMore = batch.length === batchSize;
    }

    return Response.json({
      status: 'success',
      total_nodes: total,
      updated,
      skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}