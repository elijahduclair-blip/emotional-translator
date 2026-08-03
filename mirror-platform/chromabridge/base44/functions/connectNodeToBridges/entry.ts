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

    // Fetch all nodes and bridge nodes
    const allNodes = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500);
    const nameToNode = new Map();
    allNodes.forEach(n => nameToNode.set(n.name.toLowerCase(), n));
    const existingNames = new Set(allNodes.map(n => n.name.toLowerCase()));

    const bridges = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'bridge' });
    const bridgeNames = bridges.map(s => s.name);

    if (bridgeNames.length === 0) {
      return Response.json({ error: 'No bridge nodes found' }, { status: 400 });
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

    const bridgeListStr = bridgeNames.slice(0, 500).map(s => `"${s}"`).join(', ');

    // Ask LLM for the closest bridges + any new bridges needed
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets, hypernyms, and semantic field relationships.

Target node: "${targetNode.name}" (hex: ${targetNode.hex}, coords: ${targetNode.x},${targetNode.y},${targetNode.z})

Existing bridge concept nodes (intermediate semantic connectors):
${bridgeListStr}

For "${targetNode.name}", identify up to ${maxLinks} of its CLOSEST semantic bridges using WordNet synset distance, shared hypernyms, and semantic field overlap.

Rules:
1. Pick the most semantically close bridges first (shortest synset distance).
2. If fewer than ${maxLinks} existing bridges are close (synset distance ≤ 4 hops), create NEW bridge words to fill the gap — each a single lowercase WordNet English word capturing a distinct semantic facet of "${targetNode.name}" that isn't already in the bridge list.
3. Each new bridge must be a genuine WordNet concept, not a duplicate of the target word.
4. For each new bridge, assign approximate coordinates (x: Abstract -255 to Concrete 255, y: General 0 to Specific 255, z: Passive -255 to Active 255) and a hex color.

Return a JSON object:
{
  "links": [
    {
      "bridge": "existing bridge name",
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
                bridge: { type: 'string' },
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

    // Create new bridge nodes
    const newBridgesToCreate = [];
    const seenNew = new Set();
    for (const link of links) {
      if (link.is_new && link.bridge) {
        const word = link.bridge.toLowerCase().trim();
        if (!existingNames.has(word) && !seenNew.has(word)) {
          newBridgesToCreate.push({
            name: word,
            hex: link.hex || blendHex(targetNode.hex, '#888888', 0.5),
            x: link.x || targetNode.x || 0,
            y: link.y || 128,
            z: link.z || targetNode.z || 0,
            tier: 'bridge',
            semantic_labels: ['wordnet-bridge'],
            parents: [],
          });
          seenNew.add(word);
          existingNames.add(word);
        }
      }
    }

    let createdBridges = [];
    if (newBridgesToCreate.length > 0) {
      createdBridges = await base44.asServiceRole.entities.ColorNode.bulkCreate(newBridgesToCreate);
      createdBridges = Array.isArray(createdBridges) ? createdBridges : [createdBridges];
    }

    // Build bridge name -> node map (existing + new)
    const bridgeMap = new Map();
    bridges.forEach(s => bridgeMap.set(s.name.toLowerCase(), s));
    createdBridges.forEach(s => bridgeMap.set(s.name.toLowerCase(), s));

    // Link target node → each bridge (bidirectional: target parent=bridge, bridge synonym=target)
    const dedupTarget = new Map();
    const dedupBridge = new Map();
    let linkedCount = 0;

    for (const link of links) {
      const bridgeName = link.bridge.toLowerCase().trim();
      const bridgeNode = bridgeMap.get(bridgeName);
      if (!bridgeNode) continue;

      // Target → bridge as parent
      const existingParents = targetNode.parents || [];
      if (!existingParents.includes(bridgeNode.name)) {
        const merged = [...new Set([...existingParents, bridgeNode.name])];
        dedupTarget.set(targetNode.id, { id: targetNode.id, parents: merged });
      }

      // Bridge → target as synonym (bidirectional)
      const existingSynonyms = bridgeNode.synonyms || [];
      if (!existingSynonyms.includes(targetNode.name)) {
        if (dedupBridge.has(bridgeNode.id)) {
          const existing = dedupBridge.get(bridgeNode.id);
          existing.synonyms = [...new Set([...(existing.synonyms || []), targetNode.name])];
        } else {
          dedupBridge.set(bridgeNode.id, { id: bridgeNode.id, synonyms:!existingSynonyms.includes(targetNode.name) ? [...new Set([...existingSynonyms, targetNode.name])] : existingSynonyms });
        }
      }
      linkedCount++;
    }

    const targetUpdates = [...dedupTarget.values()];
    const bridgeUpdates = [...dedupBridge.values()];

    if (targetUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(targetUpdates);
    }
    if (bridgeUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(bridgeUpdates);
    }

    return Response.json({
      success: true,
      target_node: targetNode.name,
      target_created: !nameToNode.has(nodeName),
      total_bridges: bridgeNames.length,
      links_made: linkedCount,
      new_bridges_created: createdBridges.length,
      new_bridge_names: newBridgesToCreate.map(n => n.name),
      links: links.map(l => ({
        bridge: l.bridge,
        is_new: l.is_new,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});