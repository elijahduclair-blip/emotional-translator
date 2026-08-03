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

/** Complementary color (255 - each channel) for the opposite node */
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
    const start = body.batch_start || 0;
    const size = body.batch_size || 25; // base nodes are few, process all at once

    // Fetch all base nodes and all existing node names
    const baseNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'base' });
    const allNodes = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500);
    const existingNames = new Set(allNodes.map(n => n.name.toLowerCase()));
    const nodeMap = new Map(allNodes.map(n => [n.name.toLowerCase(), n]));

    // Only process base nodes that have no opposites yet
    const needOpposites = baseNodes.filter(n => (n.opposites || []).length === 0);
    const batch = needOpposites.slice(start, start + size);

    if (batch.length === 0) {
      return Response.json({ done: true, message: 'All base nodes have opposites', remaining: 0 });
    }

    const baseInfo = batch.map((n, i) =>
      `${i + 1}. "${n.name}" (hex: ${n.hex}, coords: ${n.x},${n.y},${n.z})`
    ).join('\n');

    // Ask LLM for WordNet antonyms
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets and antonym relationships.

For each of these ${batch.length} base concept words, determine their primary antonym (opposite) using WordNet's antonym relations. If a word has multiple senses, pick the most common everyday sense.

Base words:
${baseInfo}

Rules:
- Return exactly ONE antonym word per base node (single word, no spaces).
- The antonym should be a genuine WordNet antonym, not just a vague contrast.
- If no direct WordNet antonym exists, use the closest contrasting concept (still a single word).
- Keep proper nouns capitalized if the input is capitalized (e.g., "Growth" → "Decay").

Return a JSON object:
{
  "opposites": [
    { "base": "exact base name", "antonym": "the antonym word" }
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
                base: { type: 'string' },
                antonym: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const opposites = result.opposites || [];
    const baseMap = new Map(batch.map(n => [n.name, n]));

    // Separate into: existing (just update relationships) vs new (create nodes)
    const toCreate = [];
    const parentUpdates = [];
    const newOppositeData = [];

    for (const entry of opposites) {
      const baseNode = baseMap.get(entry.base);
      if (!baseNode) continue;
      const antonym = entry.antonym.trim();
      if (!antonym) continue;

      const alreadyExists = existingNames.has(antonym.toLowerCase());

      if (alreadyExists) {
        newOppositeData.push({ baseId: baseNode.id, baseName: baseNode.name, antonym, existing: true });
        const merged = [...new Set([...(baseNode.opposites || []), antonym])];
        parentUpdates.push({ id: baseNode.id, opposites: merged });
      } else {
        // Create a new bridge node at mirrored coordinates (never base — base tier is reserved for canonical anchors)
        const mirrorX = -baseNode.x;   // flip abstract/concrete
        const mirrorZ = -baseNode.z;   // flip passive/active
        const mirrorHex = complementaryHex(baseNode.hex);
        toCreate.push({
          name: antonym,
          hex: mirrorHex,
          x: mirrorX,
          y: baseNode.y,
          z: mirrorZ,
          tier: 'bridge',
          semantic_labels: ['wordnet-antonym'],
          opposites: [baseNode.name],
          parents: [],
        });
        const merged = [...new Set([...(baseNode.opposites || []), antonym])];
        parentUpdates.push({ id: baseNode.id, opposites: merged });
        newOppositeData.push({ baseId: baseNode.id, baseName: baseNode.name, antonym, existing: false });
        existingNames.add(antonym.toLowerCase());
      }
    }

    // Create new opposite nodes
    let createdNodes = [];
    if (toCreate.length > 0) {
      createdNodes = await base44.asServiceRole.entities.ColorNode.bulkCreate(toCreate);
      createdNodes = Array.isArray(createdNodes) ? createdNodes : [createdNodes];
    }

    // Update base nodes with their new opposites
    if (parentUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(parentUpdates);
    }

    // For existing antonym nodes, add the reverse opposite relationship
    const reverseUpdates = [];
    for (const d of newOppositeData.filter(d => d.existing)) {
      const antonymNode = nodeMap.get(d.antonym.toLowerCase());
      if (antonymNode) {
        const merged = [...new Set([...(antonymNode.opposites || []), d.baseName])];
        reverseUpdates.push({ id: antonymNode.id, opposites: merged });
      }
    }
    if (reverseUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(reverseUpdates);
    }

    return Response.json({
      success: true,
      batch_start: start,
      batch_size: batch.length,
      processed: batch.map(n => n.name),
      opposites_assigned: parentUpdates.length,
      new_nodes_created: createdNodes.length,
      new_node_names: toCreate.map(n => n.name),
      existing_opposites_linked: reverseUpdates.length,
      remaining: needOpposites.length - (start + size),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});