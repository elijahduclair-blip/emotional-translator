import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function hexToRgb(hex) {
  const h = (hex || '#888888').replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function complementaryHex(hex) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(255 - r, 255 - g, 255 - b);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tier = body.tier || 'shade';
    const start = body.batch_start || 0;
    const size = body.batch_size || 12;

    const nodes = await base44.asServiceRole.entities.ColorNode.filter({ tier });
    const allNodes = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500);
    const existingNames = new Set(allNodes.map(n => n.name.toLowerCase()));

    const needOpposites = nodes.filter(n => (n.opposites || []).length === 0);
    const batch = needOpposites.slice(start, start + size);

    if (batch.length === 0) {
      return Response.json({ done: true, tier, message: `All ${tier} nodes have opposites`, remaining: 0 });
    }

    const nodeInfo = batch.map((n, i) =>
      `${i + 1}. "${n.name}" (hex: ${n.hex}, coords: ${n.x},${n.y},${n.z})`
    ).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets and antonym relationships.

For each of these ${batch.length} concept words, determine their primary antonym (opposite) using WordNet's antonym relations. If a word has multiple senses, pick the most common everyday sense.

Words:
${nodeInfo}

Rules:
- Return exactly ONE antonym word per input (single word, lowercase, no spaces).
- The antonym should be a genuine WordNet antonym, not just a vague contrast.
- If no direct WordNet antonym exists, use the closest contrasting concept (still a single word).

Return a JSON object:
{
  "opposites": [
    { "word": "exact input name", "antonym": "the antonym word" }
  ]
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          opposites: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                word: { type: 'string' },
                antonym: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const opposites = result.opposites || [];
    const batchMap = new Map(batch.map(n => [n.name, n]));

    const toCreate = [];
    const parentUpdates = [];
    const newOppositeData = [];

    for (const entry of opposites) {
      const node = batchMap.get(entry.word);
      if (!node) continue;
      const antonym = entry.antonym.toLowerCase().trim();
      if (!antonym) continue;

      const alreadyExists = existingNames.has(antonym);

      if (alreadyExists) {
        newOppositeData.push({ nodeId: node.id, nodeName: node.name, antonym, existing: true });
        const merged = [...new Set([...(node.opposites || []), antonym])];
        parentUpdates.push({ id: node.id, opposites: merged });
      } else {
        const mirrorX = -node.x;
        const mirrorZ = -node.z;
        const mirrorHex = complementaryHex(node.hex);
        toCreate.push({
          name: antonym,
          hex: mirrorHex,
          x: mirrorX,
          y: node.y,
          z: mirrorZ,
          tier,
          semantic_labels: ['wordnet-antonym'],
          opposites: [node.name],
          parents: [],
        });
        const merged = [...new Set([...(node.opposites || []), antonym])];
        parentUpdates.push({ id: node.id, opposites: merged });
        newOppositeData.push({ nodeId: node.id, nodeName: node.name, antonym, existing: false });
        existingNames.add(antonym);
      }
    }

    let createdNodes = [];
    if (toCreate.length > 0) {
      createdNodes = await base44.asServiceRole.entities.ColorNode.bulkCreate(toCreate);
    }

    // Deduplicate updates by node id (multiple nodes may share the same antonym target)
    const dedupById = (updates) => {
      const map = new Map();
      for (const u of updates) {
        if (map.has(u.id)) {
          const existing = map.get(u.id);
          if (u.opposites) existing.opposites = [...new Set([...(existing.opposites || []), ...u.opposites])];
        } else {
          map.set(u.id, { ...u });
        }
      }
      return [...map.values()];
    };

    const dedupedParentUpdates = dedupById(parentUpdates);

    // Also remove any reverse update whose id already appears in parent updates
    const parentIdSet = new Set(dedupedParentUpdates.map(u => u.id));
    const existingAntonymNames = newOppositeData.filter(d => d.existing).map(d => d.antonym);
    const reverseUpdates = [];
    if (existingAntonymNames.length > 0) {
      const nodeMap = new Map(allNodes.map(n => [n.name.toLowerCase(), n]));
      for (const d of newOppositeData.filter(d => d.existing)) {
        const antonymNode = nodeMap.get(d.antonym);
        if (antonymNode) {
          const merged = [...new Set([...(antonymNode.opposites || []), d.nodeName])];
          reverseUpdates.push({ id: antonymNode.id, opposites: merged });
        }
      }
    }
    const dedupedReverseUpdates = dedupById(reverseUpdates).filter(u => !parentIdSet.has(u.id));

    if (dedupedParentUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(dedupedParentUpdates);
    }
    if (dedupedReverseUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(dedupedReverseUpdates);
    }

    return Response.json({
      success: true,
      tier,
      batch_start: start,
      batch_size: batch.length,
      processed: batch.map(n => n.name),
      opposites_assigned: parentUpdates.length,
      new_nodes_created: createdNodes.length,
      new_node_names: toCreate.map(n => n.name),
      existing_opposites_linked: existingAntonymNames.length,
      remaining: needOpposites.length - (start + size),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});