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

function blendHex(h1, h2, t) {
  const a = hexToRgb(h1);
  const b = hexToRgb(h2);
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 15;
    const maxLinks = body.max_links || 5;

    // Find parentless non-base nodes (paginate)
    const parentless = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.filter({}, '-created_date', 500, skip);
      parentless.push(...batch.filter(n => (!n.parents || n.parents.length === 0) && n.tier !== 'base'));
      if (batch.length < 500) break;
      skip += 500;
    }

    if (parentless.length === 0) {
      return Response.json({ done: true, message: 'No parentless nodes found' });
    }

    const toProcess = parentless.slice(0, batchSize);

    // Fetch shade nodes
    const shades = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'shade' });
    const shadeMap = new Map();
    shades.forEach(s => shadeMap.set(s.name.toLowerCase(), s));

    // Fetch all node names for dedup
    const allNames = new Set();
    let nameSkip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.filter({}, '-created_date', 500, nameSkip);
      batch.forEach(n => allNames.add(n.name.toLowerCase()));
      if (batch.length < 500) break;
      nameSkip += 500;
    }

    const shadeListStr = shades.slice(0, 500).map(s => `"${s.name}"`).join(', ');

    let totalLinks = 0;
    let totalNewShades = 0;
    const processed = [];

    for (const node of toProcess) {
      try {
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a semantic lexicon expert using WordNet synsets, hypernyms, and semantic field relationships.

Target node: "${node.name}" (hex: ${node.hex}, coords: ${node.x},${node.y},${node.z})

Existing shade concept nodes:
${shadeListStr}

For "${node.name}", identify up to ${maxLinks} of its CLOSEST semantic shades using WordNet synset distance, shared hypernyms, and semantic field overlap.

Rules:
1. Pick the most semantically close shades first (shortest synset distance).
2. If fewer than ${maxLinks} existing shades are close (synset distance ≤ 4 hops), create NEW shade words to fill the gap — each a single lowercase WordNet English word capturing a distinct semantic facet of "${node.name}" that isn't already in the shade list.
3. Each new shade must be a genuine WordNet concept, not a duplicate of the target word.
4. For each new shade, assign approximate coordinates (x: Abstract -255 to Concrete 255, y: General 0 to Specific 255, z: Passive -255 to Active 255) and a hex color.

Return a JSON object:
{
  "links": [
    {
      "shade": "existing shade name",
      "is_new": false,
      "x": 0,
      "y": 128,
      "z": 0,
      "hex": "#888888"
    }
  ]
}`,
          response_json_schema: {
            type: 'object',
            properties: {
              links: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    shade: { type: 'string' },
                    is_new: { type: 'boolean' },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    z: { type: 'number' },
                    hex: { type: 'string' },
                  },
                },
              },
            },
          },
        });

        const links = result.links || [];

        // Create new shade nodes
        const newShadesToCreate = [];
        const seenNew = new Set();
        for (const link of links) {
          if (link.is_new && link.shade) {
            const word = link.shade.toLowerCase().trim();
            if (!allNames.has(word) && !seenNew.has(word)) {
              newShadesToCreate.push({
                name: word,
                hex: link.hex || blendHex(node.hex, '#888888', 0.5),
                x: link.x || node.x || 0,
                y: link.y || 128,
                z: link.z || node.z || 0,
                tier: 'shade',
                semantic_labels: ['wordnet-shade'],
                parents: [],
              });
              seenNew.add(word);
              allNames.add(word);
            }
          }
        }

        let createdShades = [];
        if (newShadesToCreate.length > 0) {
          createdShades = await base44.asServiceRole.entities.ColorNode.bulkCreate(newShadesToCreate);
          createdShades = Array.isArray(createdShades) ? createdShades : [createdShades];
          createdShades.forEach(s => shadeMap.set(s.name.toLowerCase(), s));
          totalNewShades += createdShades.length;
        }

        // Build parent updates for target node and synonym updates for shades
        const dedupTarget = new Map();
        const dedupShade = new Map();
        let linkedCount = 0;

        for (const link of links) {
          const shadeName = link.shade.toLowerCase().trim();
          const shadeNode = shadeMap.get(shadeName);
          if (!shadeNode) continue;

          const existingParents = node.parents || [];
          if (!existingParents.includes(shadeNode.name)) {
            const merged = [...new Set([...existingParents, shadeNode.name])];
            dedupTarget.set(node.id, { id: node.id, parents: merged });
          }

          const existingSynonyms = shadeNode.synonyms || [];
          if (!existingSynonyms.includes(node.name)) {
            if (dedupShade.has(shadeNode.id)) {
              const existing = dedupShade.get(shadeNode.id);
              existing.synonyms = [...new Set([...(existing.synonyms || []), node.name])];
            } else {
              dedupShade.set(shadeNode.id, { id: shadeNode.id, synonyms: [...new Set([...existingSynonyms, node.name])] });
            }
          }
          linkedCount++;
        }

        if (dedupTarget.size > 0) {
          await base44.asServiceRole.entities.ColorNode.bulkUpdate([...dedupTarget.values()]);
        }
        if (dedupShade.size > 0) {
          await base44.asServiceRole.entities.ColorNode.bulkUpdate([...dedupShade.values()]);
        }

        totalLinks += linkedCount;
        processed.push({ name: node.name, links: linkedCount, new_shades: createdShades.length });
      } catch (err) {
        processed.push({ name: node.name, error: err.message });
      }
    }

    return Response.json({
      success: true,
      parentless_found: parentless.length,
      processed: processed.length,
      total_links: totalLinks,
      total_new_shades: totalNewShades,
      remaining: parentless.length - toProcess.length,
      details: processed,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});