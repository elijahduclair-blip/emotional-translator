import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const REVIEW_LABEL = 'needs_persona_review';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 5;

    // Fetch all ColorNodes (paginated)
    let allNodes: any[] = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500, skip);
      allNodes.push(...batch);
      if (batch.length < 500) break;
      skip += 500;
    }

    // Fetch all TrajectoryEdges (paginated)
    let allEdges: any[] = [];
    skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.TrajectoryEdge.list('-created_date', 500, skip);
      allEdges.push(...batch);
      if (batch.length < 500) break;
      skip += 500;
    }

    // Build set of node IDs that appear in any TrajectoryEdge
    const linkedIds = new Set<string>();
    for (const edge of allEdges) {
      if (edge.from_node_id) linkedIds.add(edge.from_node_id);
      if (edge.to_node_id) linkedIds.add(edge.to_node_id);
    }

    // Find ColorNodes with no TrajectoryEdges
    const unlinked = allNodes.filter(n => !linkedIds.has(n.id));

    if (unlinked.length === 0) {
      return Response.json({ done: true, message: 'All ColorNodes have TrajectoryEdges', unlinked_count: 0 });
    }

    // Process a batch to avoid timeouts (each connectNodeToAllBases call invokes an LLM)
    const batch = unlinked.slice(0, batchSize);
    const processed: any[] = [];
    const flagged: any[] = [];

    for (const node of batch) {
      try {
        const result = await base44.asServiceRole.functions.invoke('connectNodeToAllBases', {
          node_name: node.name,
        });

        const direct = result?.direct_connections || 0;
        const indirect = result?.indirect_connections || 0;
        const totalConnections = direct + indirect;

        processed.push({
          name: node.name,
          id: node.id,
          direct_connections: direct,
          indirect_connections: indirect,
          linked: totalConnections > 0,
        });

        // If the node remains unlinked, flag it for PersonaLibrarian review
        if (totalConnections === 0) {
          const existingLabels = node.semantic_labels || [];
          if (!existingLabels.includes(REVIEW_LABEL)) {
            const updatedLabels = [...existingLabels, REVIEW_LABEL];
            await base44.asServiceRole.entities.ColorNode.update(node.id, {
              semantic_labels: updatedLabels,
            });
          }
          flagged.push({ name: node.name, id: node.id });
        }
      } catch (err) {
        processed.push({
          name: node.name,
          id: node.id,
          error: err.message,
          linked: false,
        });
      }
    }

    return Response.json({
      success: true,
      total_unlinked: unlinked.length,
      processed_count: batch.length,
      remaining_unlinked: Math.max(0, unlinked.length - batchSize),
      processed,
      flagged_for_review: flagged,
      flagged_count: flagged.length,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});