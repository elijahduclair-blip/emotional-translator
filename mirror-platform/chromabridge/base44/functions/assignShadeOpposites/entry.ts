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
    const size = body.batch_size || 12;

    // Fetch all shades and all existing node names
    const shades = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'shade' });
    const allNodes = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500);
    const existingNames = new Set(allNodes.map(n => n.name.toLowerCase()));

    // Only process shades that have no opposites yet
    const needOpposites = shades.filter(n => (n.opposites || []).length === 0);
    const batch = needOpposites.slice(start, start + size);

    if (batch.length === 0) {
      return Response.json({ done: true, message: 'All shades have opposites', remaining: 0 });
    }

    const shadeInfo = batch.map((n, i) =>
      `${i + 1}. "${n.name}" (hex: ${n.hex}, coords: ${n.x},${n.y},${n.z})`
    ).join('\n');

    // Ask LLM for WordNet antonyms
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets and antonym relationships.

For each of these ${batch.length} shade concept words, determine their primary antonym (opposite) using WordNet's antonym relations. If a word has multiple senses, pick the most common everyday sense.

Shade words:
${shadeInfo}

Rules:
- Return exactly ONE antonym word per shade (single word, lowercase, no spaces).
- The antonym should be a genuine WordNet antonym, not just a vague contrast.
- If no direct WordNet antonym exists, use the closest contrasting concept (still a single word).

Return a JSON object:
{
  "opposites": [
    { "shade": "exact shade name", "antonym": "the antonym word" }
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
                shade: { type: 'string' },
                antonym: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const opposites = result.opposites || [];
    const shadeMap = new Map(batch.map(n => [n.name, n]));

    // Separate into: existing (just update relationships) vs new (create nodes)
    const toCreate = [];
    const parentUpdates = [];
    const newOppositeData = []; // track for bidirectional updates

    for (const entry of opposites) {
      const shade = shadeMap.get(entry.shade);
      if (!shade) continue;
      const antonym = entry.antonym.toLowerCase().trim();
      if (!antonym) continue;

      const alreadyExists = existingNames.has(antonym);

      if (alreadyExists) {
        // Find the existing node — it may or may not be in the 500 list
        // We'll add the antonym name to the shade's opposites, and handle bidirectional later
        newOppositeData.push({ shadeId: shade.id, shadeName: shade.name, antonym, existing: true });
        const merged = [...new Set([...(shade.opposites || []), antonym])];
        parentUpdates.push({ id: shade.id, opposites: merged });
      } else {
        // Create a new shade node at mirrored coordinates
        const mirrorX = -shade.x;   // flip abstract/concrete
        const mirrorZ = -shade.z;   // flip passive/active
        const mirrorHex = complementaryHex(shade.hex);
        toCreate.push({
          name: antonym,
          hex: mirrorHex,
          x: mirrorX,
          y: shade.y,
          z: mirrorZ,
          tier: 'shade',
          semantic_labels: ['wordnet-antonym'],
          opposites: [shade.name],
          parents: [],
        });
        // Add the new antonym to the shade's opposites
        const merged = [...new Set([...(shade.opposites || []), antonym])];
        parentUpdates.push({ id: shade.id, opposites: merged });
        newOppositeData.push({ shadeId: shade.id, shadeName: shade.name, antonym, existing: false });
        existingNames.add(antonym); // prevent duplicates within this batch
      }
    }

    // Create new opposite nodes
    let createdNodes = [];
    if (toCreate.length > 0) {
      createdNodes = await base44.asServiceRole.entities.ColorNode.bulkCreate(toCreate);
    }

    // Update shades with their new opposites
    if (parentUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(parentUpdates);
    }

    // For existing antonym nodes, add the reverse opposite relationship
    const existingAntonymNames = newOppositeData.filter(d => d.existing).map(d => d.antonym);
    const reverseUpdates = [];
    if (existingAntonymNames.length > 0) {
      // Fetch the existing antonym nodes that we didn't get from the 500-list
      // Use the full allNodes list we already have, plus any we need to fetch
      const nodeMap = new Map(allNodes.map(n => [n.name.toLowerCase(), n]));
      for (const d of newOppositeData.filter(d => d.existing)) {
        const antonymNode = nodeMap.get(d.antonym);
        if (antonymNode) {
          const merged = [...new Set([...(antonymNode.opposites || []), d.shadeName])];
          reverseUpdates.push({ id: antonymNode.id, opposites: merged });
        }
      }
      if (reverseUpdates.length > 0) {
        await base44.asServiceRole.entities.ColorNode.bulkUpdate(reverseUpdates);
      }
    }

    return Response.json({
      success: true,
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