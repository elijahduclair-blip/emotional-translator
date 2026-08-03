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
    const tier = body.tier || 'shade';
    const start = body.batch_start || 0;
    const size = body.batch_size || 12;

    const nodes = await base44.asServiceRole.entities.ColorNode.filter({ tier });
    const allNodes = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500);
    const existingNames = new Set(allNodes.map(n => n.name.toLowerCase()));
    const nodeMap = new Map(allNodes.map(n => [n.name.toLowerCase(), n]));

    const needSynonyms = nodes.filter(n => (n.synonyms || []).length === 0);
    const batch = needSynonyms.slice(start, start + size);

    if (batch.length === 0) {
      return Response.json({ done: true, tier, message: `All ${tier} nodes have synonyms`, remaining: 0 });
    }

    const nodeInfo = batch.map((n, i) =>
      `${i + 1}. "${n.name}" (hex: ${n.hex}, coords: ${n.x},${n.y},${n.z})`
    ).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synset relationships.

For each of these ${batch.length} concept words, determine its closest synonym using WordNet synsets. Pick the word that shares the most common synset with the input word — a true synonym, not just a related concept.

Words:
${nodeInfo}

Rules:
- Return exactly ONE synonym word per input (single word, lowercase, no spaces).
- The synonym must be a genuine WordNet synonym (same synset), not just a hypernym or related word.
- Do NOT return the same word as the input.

Return a JSON object:
{
  "synonyms": [
    { "word": "exact input name", "synonym": "the synonym word" }
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
                word: { type: 'string' },
                synonym: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const synonyms = result.synonyms || [];
    const batchMap = new Map(batch.map(n => [n.name, n]));

    const toCreate = [];
    const parentUpdates = [];
    const reverseUpdates = [];
    const newSynonymData = [];

    for (const entry of synonyms) {
      const node = batchMap.get(entry.word);
      if (!node) continue;
      const synonym = entry.synonym.toLowerCase().trim();
      if (!synonym || synonym === node.name.toLowerCase()) continue;

      const alreadyExists = existingNames.has(synonym);

      if (alreadyExists) {
        const merged = [...new Set([...(node.synonyms || []), synonym])];
        parentUpdates.push({ id: node.id, synonyms: merged });
        const synNode = nodeMap.get(synonym);
        if (synNode) {
          const revMerged = [...new Set([...(synNode.synonyms || []), node.name])];
          reverseUpdates.push({ id: synNode.id, synonyms: revMerged });
        }
        newSynonymData.push({ word: node.name, synonym, created: false });
      } else {
        const offset = (toCreate.length % 2 === 0 ? 1 : -1) * 8;
        toCreate.push({
          name: synonym,
          hex: variantHex(node.hex, offset * 10),
          x: node.x + offset,
          y: node.y,
          z: node.z + (offset * 0.5),
          tier,
          semantic_labels: ['wordnet-synonym'],
          synonyms: [node.name],
          parents: node.parents || [],
        });
        const merged = [...new Set([...(node.synonyms || []), synonym])];
        parentUpdates.push({ id: node.id, synonyms: merged });
        existingNames.add(synonym);
        newSynonymData.push({ word: node.name, synonym, created: true });
      }
    }

    let createdNodes = [];
    if (toCreate.length > 0) {
      createdNodes = await base44.asServiceRole.entities.ColorNode.bulkCreate(toCreate);
    }

    // Deduplicate updates by node id (multiple nodes may share the same synonym target)
    const dedupById = (updates) => {
      const map = new Map();
      for (const u of updates) {
        if (map.has(u.id)) {
          const existing = map.get(u.id);
          if (u.synonyms) existing.synonyms = [...new Set([...(existing.synonyms || []), ...u.synonyms])];
        } else {
          map.set(u.id, { ...u });
        }
      }
      return [...map.values()];
    };

    const dedupedParentUpdates = dedupById(parentUpdates);
    const parentIdSet = new Set(dedupedParentUpdates.map(u => u.id));
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