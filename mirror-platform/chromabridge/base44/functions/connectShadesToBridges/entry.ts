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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const start = body.batch_start || 0;
    const size = body.batch_size || 10;

    // Fetch all shades and bridges via filter (list() is capped at 500)
    const shades = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'shade' });
    const bridges = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'bridge' });
    const bridgeNames = new Set(bridges.map(b => b.name));

    // Only process shades that don't already have a bridge-tier parent
    const unconnected = shades.filter(n => {
      const parents = n.parents || [];
      return !parents.some(p => bridgeNames.has(p));
    });

    const batch = unconnected.slice(start, start + size);
    if (batch.length === 0) {
      return Response.json({ done: true, message: 'All shades are connected to bridges', remaining: 0 });
    }

    const shadeInfo = batch.map((n, i) =>
      `${i + 1}. "${n.name}" (hex: ${n.hex}, coords: ${n.x},${n.y},${n.z})`
    ).join('\n');

    const bridgeInfo = bridges.slice(0, 200).map(b => `"${b.name}"`).join(', ');

    // Ask LLM for closest bridge per shade using WordNet
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synset relationships.

For each of these ${batch.length} color shade words, find the SINGLE closest abstract concept bridge using WordNet synset distance, shared hypernyms, and semantic field overlap.

Shade words:
${shadeInfo}

Available bridge concepts:
${bridgeInfo}

Rules:
- Return exactly ONE closest bridge per shade. The bridge MUST be from the list above.
- If NO bridge from the list is semantically close to the shade (synset distance > 3 hops), set "needs_new_bridge" to true and provide a "new_bridge_word" — a single WordNet English word that captures the semantic midpoint between the shade's color concept and the nearest bridge cluster.
- new_bridge_word must NOT already exist in the bridge list.
- new_bridge_word should be a concrete English noun or adjective from WordNet.

Return a JSON object:
{
  "connections": [
    { "shade": "exact shade name", "bridge": "closest bridge name or empty string", "needs_new_bridge": false, "new_bridge_word": "" }
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
                shade: { type: 'string' },
                bridge: { type: 'string' },
                needs_new_bridge: { type: 'boolean' },
                new_bridge_word: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const connections = result.connections || [];
    const shadeMap = new Map(batch.map(n => [n.name, n]));
    const bridgeMap = new Map(bridges.map(b => [b.name, b]));

    // Collect new bridge nodes to create
    const newBridgesToCreate = [];
    const newBridgeSpecs = []; // { word, shadeNode }
    const existingNames = new Set([...shades.map(n => n.name), ...bridges.map(n => n.name)]);

    for (const conn of connections) {
      const shade = shadeMap.get(conn.shade);
      if (!shade) continue;

      if (conn.needs_new_bridge && conn.new_bridge_word) {
        const word = conn.new_bridge_word.toLowerCase().trim();
        if (!existingNames.has(word)) {
          // Position: midpoint between shade and nearest bridge cluster centroid
          const allBridgeCentroid = bridges.length > 0 ? {
            x: bridges.reduce((s, b) => s + (b.x || 0), 0) / bridges.length,
            y: bridges.reduce((s, b) => s + (b.y || 0), 0) / bridges.length,
            z: bridges.reduce((s, b) => s + (b.z || 0), 0) / bridges.length,
          } : { x: 0, y: 0, z: 0 };

          const mx = Math.round(((shade.x || 0) + allBridgeCentroid.x) / 2);
          const my = Math.round(((shade.y || 0) + allBridgeCentroid.y) / 2);
          const mz = Math.round(((shade.z || 0) + allBridgeCentroid.z) / 2);

          // Blend shade color toward neutral gray (bridge = more abstract)
          const shadeRgb = hexToRgb(shade.hex);
          const grayVal = (shadeRgb.r + shadeRgb.g + shadeRgb.b) / 3;
          const hex = rgbToHex(
            (shadeRgb.r + grayVal) / 2,
            (shadeRgb.g + grayVal) / 2,
            (shadeRgb.b + grayVal) / 2
          );

          newBridgesToCreate.push({
            name: word,
            hex,
            x: mx,
            y: my,
            z: mz,
            tier: 'bridge',
            semantic_labels: ['wordnet-bridge'],
            favorite: false,
          });
          newBridgeSpecs.push({ word, shadeNode: shade });
          existingNames.add(word);
        }
      }
    }

    // Create new bridge nodes
    let createdBridges = [];
    if (newBridgesToCreate.length > 0) {
      createdBridges = await base44.asServiceRole.entities.ColorNode.bulkCreate(newBridgesToCreate);
      createdBridges = Array.isArray(createdBridges) ? createdBridges : [createdBridges];
    }

    // Build final connection map: shade -> bridge name (existing or newly created)
    const createdBridgeMap = new Map();
    createdBridges.forEach((b, idx) => {
      createdBridgeMap.set(newBridgeSpecs[idx].word, b);
    });

    // Update each shade: add the bridge as a parent
    const shadeUpdates = [];
    let linkedCount = 0;

    for (const conn of connections) {
      const shade = shadeMap.get(conn.shade);
      if (!shade) continue;

      let bridgeName;
      if (conn.needs_new_bridge && conn.new_bridge_word) {
        const word = conn.new_bridge_word.toLowerCase().trim();
        const created = createdBridgeMap.get(word);
        bridgeName = created ? created.name : word;
      } else if (conn.bridge) {
        bridgeName = conn.bridge;
      }

      if (!bridgeName) continue;

      const existingParents = shade.parents || [];
      if (existingParents.includes(bridgeName)) continue;
      const merged = [...new Set([...existingParents, bridgeName])];
      shadeUpdates.push({ id: shade.id, parents: merged });
      linkedCount++;
    }

    if (shadeUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(shadeUpdates);
    }

    return Response.json({
      success: true,
      batch_start: start,
      batch_size: batch.length,
      shades_processed: batch.map(n => n.name),
      new_bridges_created: createdBridges.length,
      new_bridge_names: newBridgesToCreate.map(b => b.name),
      shades_linked: linkedCount,
      remaining: unconnected.length - (start + size),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});