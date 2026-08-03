import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const start = body.batch_start || 0;
    const size = body.batch_size || 8;

    // Fetch all word-tier nodes
    const wordNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'words' });

    // Fetch all concept nodes (base, bridge, shade)
    const baseNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'base' });
    const bridgeNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'bridge' });
    const shadeNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'shade' });

    const baseNames = new Set(baseNodes.map(n => n.name));
    const bridgeNames = new Set(bridgeNodes.map(n => n.name));
    const shadeNames = new Set(shadeNodes.map(n => n.name));

    // Find word nodes that are missing connections to any of the three concept tiers
    const unconnected = wordNodes.filter(n => {
      const parents = n.parents || [];
      const hasBase = parents.some(p => baseNames.has(p));
      const hasBridge = parents.some(p => bridgeNames.has(p));
      const hasShade = parents.some(p => shadeNames.has(p));
      return !(hasBase && hasBridge && hasShade);
    });

    const batch = unconnected.slice(start, start + size);
    if (batch.length === 0) {
      return Response.json({ done: true, message: 'All word nodes are connected to base, bridge, and shade', batch_start: start });
    }

    const batchInfo = batch.map((n, i) => `${i + 1}. "${n.name}" (hex: ${n.hex})`);
    const baseInfo = baseNodes.map(n => `"${n.name}"`).join(', ');
    const bridgeInfo = bridgeNodes.map(n => `"${n.name}"`).join(', ');
    const shadeInfo = shadeNodes.slice(0, 400).map(n => `"${n.name}"`).join(', ');

    // Call LLM to determine closest base, bridge, and shade for each word
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets and semantic relationships.

Given these ${batch.length} word-tier nodes:
${batchInfo.join('\n')}

And these existing concept nodes grouped by tier:

BASE anchors (foundational abstract):
${baseInfo}

BRIDGE concepts (intermediate linking domains):
${bridgeInfo}

SHADE concepts (nuanced variations):
${shadeInfo}

For EACH word, determine the CLOSEST match in each of the three tiers using WordNet synset distance, shared hypernyms, and semantic field overlap:
1. "closest_base" — the single closest BASE anchor (must be from the list above, or empty string if none is within 5 synset hops).
2. "closest_bridge" — the single closest BRIDGE concept (must be from the list above, or empty string if none within 5 synset hops).
3. "closest_shade" — the single closest SHADE concept (must be from the list above, or empty string if none within 5 synset hops).

Return a JSON object:
{
  "connections": [
    {
      "word": "exact word name",
      "closest_base": "base name or empty string",
      "closest_bridge": "bridge name or empty string",
      "closest_shade": "shade name or empty string"
    }
  ]
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          connections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                word: { type: 'string' },
                closest_base: { type: 'string' },
                closest_bridge: { type: 'string' },
                closest_shade: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const connections = result.connections || [];
    const wordMap = new Map(batch.map(n => [n.name, n]));
    const conceptMap = new Map();
    [...baseNodes, ...bridgeNodes, ...shadeNodes].forEach(n => conceptMap.set(n.name, n));

    // Build parent updates: merge closest base, bridge, and shade as parents
    const parentUpdates = [];
    let linkedCount = 0;

    for (const conn of connections) {
      const wordNode = wordMap.get(conn.word);
      if (!wordNode) continue;
      const existingParents = wordNode.parents || [];
      const toAdd = [];
      if (conn.closest_base && conceptMap.has(conn.closest_base) && !existingParents.includes(conn.closest_base)) {
        toAdd.push(conn.closest_base);
      }
      if (conn.closest_bridge && conceptMap.has(conn.closest_bridge) && !existingParents.includes(conn.closest_bridge)) {
        toAdd.push(conn.closest_bridge);
      }
      if (conn.closest_shade && conceptMap.has(conn.closest_shade) && !existingParents.includes(conn.closest_shade)) {
        toAdd.push(conn.closest_shade);
      }
      if (toAdd.length === 0) continue;
      const merged = [...new Set([...existingParents, ...toAdd])];
      parentUpdates.push({ id: wordNode.id, parents: merged });
      linkedCount += toAdd.length;
    }

    // Deduplicate updates by node id
    const dedupById = (updates) => {
      const map = new Map();
      for (const u of updates) {
        if (map.has(u.id)) {
          const existing = map.get(u.id);
          if (u.parents) existing.parents = [...new Set([...(existing.parents || []), ...u.parents])];
        } else {
          map.set(u.id, { ...u });
        }
      }
      return [...map.values()];
    };

    const dedupedUpdates = dedupById(parentUpdates);
    if (dedupedUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(dedupedUpdates);
    }

    return Response.json({
      success: true,
      batch_start: start,
      batch_size: batch.length,
      words_processed: batch.map(n => n.name),
      connections_made: linkedCount,
      remaining_unconnected: unconnected.length - (start + size),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});