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

/** Slight color variation for the synonym node — nudge each channel toward the synonym concept */
function variantHex(hex, offset) {
  const { r, g, b } = hexToRgb(hex);
  const jitter = (ch) => Math.max(0, Math.min(255, ch + offset));
  return rgbToHex(jitter(r), jitter(g), jitter(b));
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
    const nodeMap = new Map(allNodes.map(n => [n.name.toLowerCase(), n]));

    // Only process shades that have no synonyms yet
    const needSynonyms = shades.filter(n => (n.synonyms || []).length === 0);
    const batch = needSynonyms.slice(start, start + size);

    if (batch.length === 0) {
      return Response.json({ done: true, message: 'All shades have synonyms', remaining: 0 });
    }

    const shadeInfo = batch.map((n, i) =>
      `${i + 1}. "${n.name}" (hex: ${n.hex}, coords: ${n.x},${n.y},${n.z})`
    ).join('\n');

    // Ask LLM for WordNet synonyms
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synset relationships.

For each of these ${batch.length} shade concept words, determine its closest synonym using WordNet synsets. Pick the word that shares the most common synset with the input word — a true synonym, not just a related concept.

Shade words:
${shadeInfo}

Rules:
- Return exactly ONE synonym word per shade (single word, lowercase, no spaces).
- The synonym must be a genuine WordNet synonym (same synset), not just a hypernym or related word.
- If the word is already itself a synonym of another common word, return that common word.
- Do NOT return the same word as the input.

Return a JSON object:
{
  "synonyms": [
    { "shade": "exact shade name", "synonym": "the synonym word" }
  ]
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          synonyms: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                shade: { type: 'string' },
                synonym: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const synonyms = result.synonyms || [];
    const shadeMap = new Map(batch.map(n => [n.name, n]));

    const toCreate = [];
    const parentUpdates = [];
    const reverseUpdates = [];
    const newSynonymData = [];

    for (const entry of synonyms) {
      const shade = shadeMap.get(entry.shade);
      if (!shade) continue;
      const synonym = entry.synonym.toLowerCase().trim();
      if (!synonym || synonym === shade.name.toLowerCase()) continue;

      const alreadyExists = existingNames.has(synonym);

      if (alreadyExists) {
        // Link bidirectionally
        const merged = [...new Set([...(shade.synonyms || []), synonym])];
        parentUpdates.push({ id: shade.id, synonyms: merged });
        const synNode = nodeMap.get(synonym);
        if (synNode) {
          const revMerged = [...new Set([...(synNode.synonyms || []), shade.name])];
          reverseUpdates.push({ id: synNode.id, synonyms: revMerged });
        }
        newSynonymData.push({ shade: shade.name, synonym, created: false });
      } else {
        // Create a new shade node near the original (slightly offset coordinates, variant color)
        const offset = (toCreate.length % 2 === 0 ? 1 : -1) * 8; // small jitter
        toCreate.push({
          name: synonym,
          hex: variantHex(shade.hex, offset * 10),
          x: shade.x + offset,
          y: shade.y,
          z: shade.z + (offset * 0.5),
          tier: 'shade',
          semantic_labels: ['wordnet-synonym'],
          synonyms: [shade.name],
          parents: shade.parents || [], // inherit same parents
        });
        const merged = [...new Set([...(shade.synonyms || []), synonym])];
        parentUpdates.push({ id: shade.id, synonyms: merged });
        existingNames.add(synonym);
        newSynonymData.push({ shade: shade.name, synonym, created: true });
      }
    }

    // Create new synonym nodes
    let createdNodes = [];
    if (toCreate.length > 0) {
      createdNodes = await base44.asServiceRole.entities.ColorNode.bulkCreate(toCreate);
    }

    // Update shades with their new synonyms
    if (parentUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(parentUpdates);
    }

    // Update existing synonym nodes with reverse relationship
    if (reverseUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(reverseUpdates);
    }

    return Response.json({
      success: true,
      batch_start: start,
      batch_size: batch.length,
      processed: batch.map(n => n.name),
      synonyms_assigned: parentUpdates.length,
      new_nodes_created: createdNodes.length,
      new_node_names: toCreate.map(n => n.name),
      existing_synonyms_linked: reverseUpdates.length,
      remaining: needSynonyms.length - (start + size),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});