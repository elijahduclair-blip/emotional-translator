import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Polar-Opposite Anchoring Strategy
 *
 * For each non-base node, finds the nearest canonical anchor and computes
 * a directional bearing (unit vector from anchor → node). Stores:
 *   - parent_anchor_id: the nearest anchor's ID
 *   - anchor_bearing: [dx, dy, dz] normalized unit vector
 *
 * This enables directional sorting: nodes sharing the same anchor + similar
 * bearing are semantically clustered along the same trajectory from that anchor.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const start = body.batch_start || 0;
    const size = body.batch_size || 200;

    // Fetch the 8 canonical anchors
    const anchors = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'base' });

    // Fetch all non-base nodes (paginate)
    const allNonBase = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.filter(
        { tier: { $ne: 'base' } }, '-created_date', 500, skip
      );
      allNonBase.push(...batch);
      if (batch.length < 500) break;
      skip += 500;
    }

    // Process only nodes that lack a parent_anchor_id (idempotent)
    const needAssignment = allNonBase.filter(n => !n.parent_anchor_id);
    const batch = needAssignment.slice(start, start + size);

    if (batch.length === 0) {
      return Response.json({ done: true, message: 'All non-base nodes have anchor assignments', remaining: 0 });
    }

    // For each node, find nearest anchor + compute bearing
    const updates = [];
    for (const node of batch) {
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

      const dx = (node.x || 0) - (bestAnchor.x || 0);
      const dy = (node.y || 0) - (bestAnchor.y || 0);
      const dz = (node.z || 0) - (bestAnchor.z || 0);
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      updates.push({
        id: node.id,
        parent_anchor_id: bestAnchor.id,
        anchor_bearing: [dx / len, dy / len, dz / len],
      });
    }

    if (updates.length > 0) {
      // bulkUpdate cap is 500
      for (let i = 0; i < updates.length; i += 500) {
        await base44.asServiceRole.entities.ColorNode.bulkUpdate(updates.slice(i, i + 500));
      }
    }

    return Response.json({
      success: true,
      batch_start: start,
      batch_size: batch.length,
      assigned: updates.length,
      remaining: needAssignment.length - (start + size),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});