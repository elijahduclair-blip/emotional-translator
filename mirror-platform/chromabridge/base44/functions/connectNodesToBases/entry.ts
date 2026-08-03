import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function hexToRgb(hex) {
  const h = (hex || '#888888').replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const start = body.batch_start || 0;
    const size = body.batch_size || 8;

    // Fetch nodes by tier (list() is capped at 500, so use filter to get everything)
    const baseNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'base' });
    const bridges = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'bridge' });
    const nonBase = bridges;

    const baseNames = new Set(baseNodes.map(n => n.name));

    // Find bridge nodes not yet directly connected to any base
    const unconnected = nonBase.filter(n => {
      const parents = n.parents || [];
      return !parents.some(p => baseNames.has(p));
    });

    const batch = unconnected.slice(start, start + size);
    if (batch.length === 0) {
      return Response.json({ done: true, message: 'All non-base nodes are connected to bases', batch_start: start });
    }

    const batchInfo = batch.map((n, i) => `${i + 1}. "${n.name}" (tier: ${n.tier}, hex: ${n.hex})`);
    const baseInfo = baseNodes.map(n => `"${n.name}" (hex: ${n.hex})`).join(', ');

    // Call LLM to determine closest base for each node
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are building a semantic hierarchy connecting concepts to foundational anchor concepts using WordNet semantic relationships.

Given these ${batch.length} nodes:
${batchInfo.join('\n')}

And these ${baseNodes.length} BASE anchor concepts:
${baseInfo}

For EACH node, determine which single base concept is its CLOSEST semantic match using WordNet synset distance, shared hypernyms, and semantic field overlap.

Return a JSON object with a "connections" array where each element has:
{
  "node": "exact node name",
  "base": "closest base name (must be one from the list above)"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          connections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                node: { type: 'string' },
                base: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const connections = result.connections || [];
    const nodeMap = new Map(batch.map(n => [n.name, n]));
    const baseMap = new Map(baseNodes.map(b => [b.name, b]));

    // Build parent updates: add closest base as a direct parent
    const parentUpdates = [];
    for (const conn of connections) {
      const node = nodeMap.get(conn.node);
      const base = baseMap.get(conn.base);
      if (!node || !base) continue;
      const existingParents = node.parents || [];
      if (existingParents.includes(base.name)) continue; // already connected
      const merged = [...new Set([...existingParents, base.name])];
      parentUpdates.push({ id: node.id, parents: merged });
    }

    // Bulk update node parents
    if (parentUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(parentUpdates);
    }

    return Response.json({
      success: true,
      batch_start: start,
      batch_size: batch.length,
      nodes_processed: batch.map(n => n.name),
      connections_made: parentUpdates.length,
      remaining_unconnected: unconnected.length - (start + size),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});