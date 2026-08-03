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
    const basesFilter = Array.isArray(body.bases) ? body.bases.map(b => b.toLowerCase().trim()).filter(Boolean) : null;

    if (!nodeName) {
      return Response.json({ error: 'node_name is required' }, { status: 400 });
    }

    // Fetch all nodes and base nodes
    const allNodes = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500);
    const nameToNode = new Map();
    allNodes.forEach(n => nameToNode.set(n.name.toLowerCase(), n));
    const existingNames = new Set(allNodes.map(n => n.name.toLowerCase()));

    let baseNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'base' });

    // If a bases filter is provided, restrict to matching bases
    if (basesFilter && basesFilter.length > 0) {
      baseNodes = baseNodes.filter(b => basesFilter.includes(b.name.toLowerCase()));
    }

    if (baseNodes.length === 0) {
      return Response.json({ error: 'No matching base nodes found' }, { status: 400 });
    }

    // Find or create the target node
    let targetNode = nameToNode.get(nodeName);
    if (!targetNode) {
      // Ask LLM for positioning of the new node
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

    const baseInfo = baseNodes.map((b, i) => `${i + 1}. "${b.name}" (hex: ${b.hex})`).join('\n');

    // Ask LLM for WordNet relationship between target node and each base
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets, hypernyms, and semantic field relationships.

Target node: "${targetNode.name}" (hex: ${targetNode.hex}, coords: ${targetNode.x},${targetNode.y},${targetNode.z})

Base anchor concepts:
${baseInfo}

For EACH base concept, determine how "${targetNode.name}" connects to it using WordNet:

1. If "${targetNode.name}" has a direct semantic relationship to the base (synset distance ≤ 3 hops, shared hypernym, or direct hypernym/hyponym), set "direct" to true and leave "intermediate" empty.
2. If the semantic distance is large (> 3 hops), set "direct" to false and provide a single "intermediate" WordNet word (lowercase, single English noun/adjective) that serves as a semantic bridge between "${targetNode.name}" and that base.

Rules:
- Intermediate words must NOT be the same as the target or the base.
- Intermediate words should be genuine WordNet concepts on the semantic path.
- Each base gets exactly one entry.

Return a JSON object:
{
  "connections": [
    { "base": "exact base name", "direct": true, "intermediate": "" },
    { "base": "exact base name", "direct": false, "intermediate": "bridgeword" }
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
                base: { type: 'string' },
                direct: { type: 'boolean' },
                intermediate: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const connections = result.connections || [];
    const baseMap = new Map(baseNodes.map(b => [b.name.toLowerCase(), b]));

    // Collect intermediate nodes to create
    const intermediatesToCreate = [];
    const seenIntermediates = new Set();

    for (const conn of connections) {
      if (!conn.direct && conn.intermediate) {
        const word = conn.intermediate.toLowerCase().trim();
        if (!existingNames.has(word) && !seenIntermediates.has(word)) {
          const baseNode = baseMap.get(conn.base.toLowerCase());
          // Position: midpoint between target and base
          const t = 0.5;
          const x = Math.round((targetNode.x || 0) + (((baseNode?.x || 0)) - (targetNode.x || 0)) * t);
          const y = Math.round((targetNode.y || 0) + (((baseNode?.y || 0)) - (targetNode.y || 0)) * t);
          const z = Math.round((targetNode.z || 0) + (((baseNode?.z || 0)) - (targetNode.z || 0)) * t);
          const hex = blendHex(targetNode.hex, baseNode?.hex || '#888888', t);

          intermediatesToCreate.push({
            name: word,
            hex,
            x,
            y,
            z,
            tier: 'bridge',
            semantic_labels: ['wordnet-bridge'],
            parents: [],
          });
          seenIntermediates.add(word);
          existingNames.add(word);
        }
      }
    }

    let createdIntermediates = [];
    if (intermediatesToCreate.length > 0) {
      createdIntermediates = await base44.asServiceRole.entities.ColorNode.bulkCreate(intermediatesToCreate);
      createdIntermediates = Array.isArray(createdIntermediates) ? createdIntermediates : [createdIntermediates];
    }

    // Build intermediate name -> node map
    const intermediateMap = new Map();
    createdIntermediates.forEach(n => intermediateMap.set(n.name.toLowerCase(), n));
    // Also include existing intermediates from allNodes
    connections.forEach(conn => {
      if (!conn.direct && conn.intermediate) {
        const word = conn.intermediate.toLowerCase().trim();
        if (!intermediateMap.has(word) && nameToNode.has(word)) {
          intermediateMap.set(word, nameToNode.get(word));
        }
      }
    });

    // Build updates: connect target → intermediate → base (or target → base directly)
    const updates = [];
    const dedup = new Map();

    const addParent = (nodeId, parentName, existingParents) => {
      if (existingParents.includes(parentName)) return;
      const merged = [...new Set([...existingParents, parentName])];
      if (dedup.has(nodeId)) {
        dedup.get(nodeId).parents = [...new Set([...dedup.get(nodeId).parents, ...merged])];
      } else {
        dedup.set(nodeId, { id: nodeId, parents: merged });
      }
    };

    let directCount = 0;
    let indirectCount = 0;

    for (const conn of connections) {
      const baseNode = baseMap.get(conn.base.toLowerCase());
      if (!baseNode) continue;

      if (conn.direct) {
        // Direct: target → base (bidirectional)
        addParent(targetNode.id, baseNode.name, targetNode.parents || []);
        addParent(baseNode.id, targetNode.name, baseNode.parents || []);
        directCount++;
      } else if (conn.intermediate) {
        const word = conn.intermediate.toLowerCase().trim();
        const intermediateNode = intermediateMap.get(word);
        if (!intermediateNode) continue;

        // target → intermediate (bidirectional)
        addParent(targetNode.id, intermediateNode.name, targetNode.parents || []);
        addParent(intermediateNode.id, targetNode.name, intermediateNode.parents || []);
        // intermediate → base (bidirectional)
        addParent(intermediateNode.id, baseNode.name, intermediateNode.parents || []);
        addParent(baseNode.id, intermediateNode.name, baseNode.parents || []);
        indirectCount++;
      }
    }

    if (dedup.size > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate([...dedup.values()]);
    }

    return Response.json({
      success: true,
      target_node: targetNode.name,
      target_created: !nameToNode.has(nodeName),
      total_bases: baseNodes.length,
      direct_connections: directCount,
      indirect_connections: indirectCount,
      intermediates_created: createdIntermediates.length,
      new_intermediate_names: intermediatesToCreate.map(n => n.name),
      connections: connections.map(c => ({
        base: c.base,
        direct: c.direct,
        intermediate: c.direct ? null : c.intermediate,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});