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
    const nodeName = (body.node_name || '').toLowerCase().trim();
    const maxLinks = body.max_links || 5;

    if (!nodeName) {
      return Response.json({ error: 'node_name is required' }, { status: 400 });
    }

    // Fetch all nodes and shade nodes
    const allNodes = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500);
    const nameToNode = new Map();
    allNodes.forEach(n => nameToNode.set(n.name.toLowerCase(), n));
    const existingNames = new Set(allNodes.map(n => n.name.toLowerCase()));

    const shades = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'shade' });
    const shadeNames = shades.map(s => s.name);

    if (shadeNames.length === 0) {
      return Response.json({ error: 'No shade nodes found' }, { status: 400 });
    }

    // Find or create the target node
    let targetNode = nameToNode.get(nodeName);
    if (!targetNode) {
      const positionResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a semantic lexicon expert using WordNet.

Position the word "${nodeName}" in a 3D semantic color space:
- x: Abstract (-255) to Concrete (255)
- y: General (0) to Specific (255)
- z: Passive (-255) to Active (255)

Also assign a hex color reflecting its emotional/semantic climate.

Return JSON: { "x": 0, "y": 128, "z": 0, "hex": "#888888" }`,
        response_json_schema: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' },
            hex: { type: 'string' },
          },
        },
      });

      targetNode = await base44.asServiceRole.entities.ColorNode.create({
        name: nodeName,
        hex: positionResult.hex || '#888888',
        x: positionResult.x || 0,
        y: positionResult.y || 128,
        z: positionResult.z || 0,
        tier: 'words',
        semantic_labels: ['phrase-word'],
        parents: [],
      });
      existingNames.add(nodeName);
    }

    const shadeListStr = shadeNames.slice(0, 500).map(s => `"${s}"`).join(', ');

    // Ask LLM for the closest shades + any new shades needed
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets, hypernyms, and semantic field relationships.

Target node: "${targetNode.name}" (hex: ${targetNode.hex}, coords: ${targetNode.x},${targetNode.y},${targetNode.z})

Existing shade concept nodes:
${shadeListStr}

For "${targetNode.name}", identify up to ${maxLinks} of its CLOSEST semantic shades using WordNet synset distance, shared hypernyms, and semantic field overlap.

Rules:
1. Pick the most semantically close shades first (shortest synset distance).
2. If fewer than ${maxLinks} existing shades are close (synset distance ≤ 4 hops), create NEW shade words to fill the gap — each a single lowercase WordNet English word capturing a distinct semantic facet of "${targetNode.name}" that isn't already in the shade list.
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
        if (!existingNames.has(word) && !seenNew.has(word)) {
          newShadesToCreate.push({
            name: word,
            hex: link.hex || blendHex(targetNode.hex, '#888888', 0.5),
            x: link.x || targetNode.x || 0,
            y: link.y || 128,
            z: link.z || targetNode.z || 0,
            tier: 'shade',
            semantic_labels: ['wordnet-shade'],
            parents: [],
          });
          seenNew.add(word);
          existingNames.add(word);
        }
      }
    }

    let createdShades = [];
    if (newShadesToCreate.length > 0) {
      createdShades = await base44.asServiceRole.entities.ColorNode.bulkCreate(newShadesToCreate);
      createdShades = Array.isArray(createdShades) ? createdShades : [createdShades];
    }

    // Build shade name -> node map (existing + new)
    const shadeMap = new Map();
    shades.forEach(s => shadeMap.set(s.name.toLowerCase(), s));
    createdShades.forEach(s => shadeMap.set(s.name.toLowerCase(), s));

    // Link target node → each shade (bidirectional: target parent=shade, shade synonym=target)
    const targetParentUpdates = [];
    const shadeSynonymUpdates = [];
    const dedupTarget = new Map();
    const dedupShade = new Map();
    let linkedCount = 0;

    for (const link of links) {
      const shadeName = link.shade.toLowerCase().trim();
      const shadeNode = shadeMap.get(shadeName);
      if (!shadeNode) continue;

      // Target → shade as parent
      const existingParents = targetNode.parents || [];
      if (!existingParents.includes(shadeNode.name)) {
        const merged = [...new Set([...existingParents, shadeNode.name])];
        dedupTarget.set(targetNode.id, { id: targetNode.id, parents: merged });
      }

      // Shade → target as synonym (bidirectional)
      const existingSynonyms = shadeNode.synonyms || [];
      if (!existingSynonyms.includes(targetNode.name)) {
        if (dedupShade.has(shadeNode.id)) {
          const existing = dedupShade.get(shadeNode.id);
          existing.synonyms = [...new Set([...(existing.synonyms || []), targetNode.name])];
        } else {
          dedupShade.set(shadeNode.id, { id: shadeNode.id, synonyms: [...new Set([...existingSynonyms, targetNode.name])] });
        }
      }
      linkedCount++;
    }

    const targetUpdates = [...dedupTarget.values()];
    const shadeUpdates = [...dedupShade.values()];

    if (targetUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(targetUpdates);
    }
    if (shadeUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(shadeUpdates);
    }

    return Response.json({
      success: true,
      target_node: targetNode.name,
      target_created: !nameToNode.has(nodeName),
      total_shades: shadeNames.length,
      links_made: linkedCount,
      new_shades_created: createdShades.length,
      new_shade_names: newShadesToCreate.map(n => n.name),
      links: links.map(l => ({
        shade: l.shade,
        is_new: l.is_new,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});