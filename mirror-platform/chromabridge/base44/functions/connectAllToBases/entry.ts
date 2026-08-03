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
    const batchSize = body.batch_size || 4;
    const batchStart = body.batch_start || 0;
    const tiers = Array.isArray(body.tiers) && body.tiers.length > 0
      ? body.tiers
      : ['bridge', 'shade', 'words'];

    // Fetch base anchors
    const baseNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'base' });
    if (baseNodes.length === 0) return Response.json({ error: 'No base anchors found' }, { status: 400 });
    const baseNameList = baseNodes.map(n => n.name);

    // Fetch all non-base nodes (paginate per tier)
    const allNonBase = [];
    for (const tier of tiers) {
      let skip = 0;
      while (true) {
        const page = await base44.asServiceRole.entities.ColorNode.filter({ tier }, '-created_date', 500, skip);
        allNonBase.push(...page);
        if (page.length < 500) break;
        skip += 500;
      }
    }

    // Build a name -> node lookup from everything we've loaded (base + non-base)
    const nameToNode = new Map();
    baseNodes.forEach(n => nameToNode.set(n.name.toLowerCase(), n));
    allNonBase.forEach(n => nameToNode.set(n.name.toLowerCase(), n));

    // Filter to nodes not yet processed by this function
    const unconnected = allNonBase.filter(n => {
      const labels = n.semantic_labels || [];
      return !labels.includes('bases-connected');
    });

    const batch = unconnected.slice(batchStart, batchStart + batchSize);
    if (batch.length === 0) {
      return Response.json({ done: true, remaining: 0, total_unconnected: unconnected.length });
    }

    const nodeInfo = batch.map((n, i) => `${i + 1}. "${n.name}" (tier: ${n.tier}, hex: ${n.hex})`);
    const baseInfo = baseNodes.map((b, i) => `${i + 1}. "${b.name}" (hex: ${b.hex})`);

    // Ask LLM: for each node, determine direct vs intermediate for each of the 8 bases
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets, hypernyms, and semantic field relationships.

TASK: Connect each concept node to all 8 foundational anchor concepts using WordNet.

NODES:
${nodeInfo.join('\n')}

BASE ANCHORS:
${baseInfo.join('\n')}

For EACH node, determine its relationship to EACH of the 8 base anchors:
1. If the node has a direct semantic relationship to the base (synset distance <= 3 hops, shared hypernym, or direct hypernym/hyponym), set "direct" to true and leave "intermediate" empty.
2. If the semantic distance is large (> 3 hops), set "direct" to false and provide a single "intermediate" WordNet word (lowercase, single English noun or adjective) that bridges the node to that base.

RULES:
- Intermediate words must NOT be the same as the node name or any base name.
- Intermediate words should be genuine WordNet concepts on the semantic path.
- Each node MUST have exactly 8 connection entries (one per base).
- Provide entries for ALL 8 bases for EVERY node.

Return JSON:
{
  "results": [
    {
      "node": "exact node name",
      "connections": [
        { "base": "Protect", "direct": true, "intermediate": "" },
        { "base": "Danger", "direct": false, "intermediate": "shield" }
      ]
    }
  ]
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                node: { type: 'string' },
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
          },
        },
      },
    });

    const results = result.results || [];
    const nodeMap = new Map(batch.map(n => [n.name, n]));
    const baseMap = new Map(baseNodes.map(b => [b.name, b]));

    // Collect intermediate words and check which already exist as nodes
    const intermediateWords = new Set();
    for (const r of results) {
      for (const conn of (r.connections || [])) {
        if (!conn.direct && conn.intermediate) {
          const word = conn.intermediate.toLowerCase().trim();
          if (word && !nodeMap.has(word) && !baseMap.has(word)) {
            intermediateWords.add(word);
          }
        }
      }
    }

    const existingIntermediates = new Map();
    for (const word of intermediateWords) {
      if (nameToNode.has(word)) {
        existingIntermediates.set(word, nameToNode.get(word));
      }
    }

    // Create intermediate nodes that don't exist yet
    const toCreate = [];
    const seenCreate = new Set();
    for (const r of results) {
      const node = nodeMap.get(r.node);
      if (!node) continue;
      for (const conn of (r.connections || [])) {
        if (!conn.direct && conn.intermediate) {
          const word = conn.intermediate.toLowerCase().trim();
          if (!word || existingIntermediates.has(word) || seenCreate.has(word)) continue;
          if (word === node.name.toLowerCase()) continue;
          const baseNode = baseMap.get(conn.base);
          if (!baseNode) continue;
          seenCreate.add(word);
          const t = 0.5;
          const x = (node.x || 0) + ((baseNode.x || 0) - (node.x || 0)) * t;
          const y = (node.y || 0) + ((baseNode.y || 0) - (node.y || 0)) * t;
          const z = (node.z || 0) + ((baseNode.z || 0) - (node.z || 0)) * t;
          const hex = blendHex(node.hex || '#888888', baseNode.hex, t);
          toCreate.push({
            name: word,
            hex,
            x,
            y,
            z,
            tier: 'bridge',
            semantic_labels: ['wordnet-bridge'],
            parents: [],
          });
        }
      }
    }

    let createdNodes = [];
    if (toCreate.length > 0) {
      createdNodes = await base44.asServiceRole.entities.ColorNode.bulkCreate(toCreate);
      createdNodes = Array.isArray(createdNodes) ? createdNodes : [createdNodes];
    }

    // Build full intermediate map: existing + newly created
    const intermediateMap = new Map(existingIntermediates);
    createdNodes.forEach(n => intermediateMap.set(n.name.toLowerCase(), n));

    // Wire connections bidirectionally via parents
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
    for (const r of results) {
      const node = nodeMap.get(r.node);
      if (!node) continue;
      for (const conn of (r.connections || [])) {
        const baseNode = baseMap.get(conn.base);
        if (!baseNode) continue;
        // Skip if node and base already directly connected
        if ((node.parents || []).includes(baseNode.name)) {
          directCount++; // already connected, count as direct
          continue;
        }

        if (conn.direct) {
          addParent(node.id, baseNode.name, node.parents || []);
          addParent(baseNode.id, node.name, baseNode.parents || []);
          directCount++;
        } else if (conn.intermediate) {
          const word = conn.intermediate.toLowerCase().trim();
          const intermediateNode = intermediateMap.get(word);
          if (!intermediateNode) continue;
          addParent(node.id, intermediateNode.name, node.parents || []);
          addParent(intermediateNode.id, node.name, intermediateNode.parents || []);
          addParent(intermediateNode.id, baseNode.name, intermediateNode.parents || []);
          addParent(baseNode.id, intermediateNode.name, baseNode.parents || []);
          indirectCount++;
        }
      }
    }

    // Mark all processed nodes as bases-connected
    for (const r of results) {
      const node = nodeMap.get(r.node);
      if (!node) continue;
      const labels = [...new Set([...(node.semantic_labels || []), 'bases-connected'])];
      if (dedup.has(node.id)) {
        dedup.get(node.id).semantic_labels = labels;
      } else {
        dedup.set(node.id, { id: node.id, semantic_labels: labels });
      }
    }

    if (dedup.size > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate([...dedup.values()]);
    }

    return Response.json({
      success: true,
      batch_start: batchStart,
      batch_size: batch.length,
      direct_connections: directCount,
      indirect_connections: indirectCount,
      intermediates_created: createdNodes.length,
      new_intermediate_names: toCreate.map(n => n.name),
      total_unconnected: unconnected.length,
      remaining: Math.max(0, unconnected.length - (batchStart + batchSize)),
      done: batchStart + batchSize >= unconnected.length,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});