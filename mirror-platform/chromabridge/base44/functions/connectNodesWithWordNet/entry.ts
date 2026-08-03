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
    const nodeAName = (body.node_a || '').toLowerCase().trim();
    const nodeBName = (body.node_b || '').toLowerCase().trim();
    const maxHops = body.max_hops || 4;

    if (!nodeAName || !nodeBName) {
      return Response.json({ error: 'Both node_a and node_b are required' }, { status: 400 });
    }

    // Fetch all nodes to find the two endpoints and check existing names
    const allNodes = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500);
    const nameToNode = new Map();
    allNodes.forEach(n => nameToNode.set(n.name.toLowerCase(), n));
    const existingNames = new Set(allNodes.map(n => n.name.toLowerCase()));

    const nodeA = nameToNode.get(nodeAName);
    const nodeB = nameToNode.get(nodeBName);

    if (!nodeA || !nodeB) {
      return Response.json({
        error: `Could not find node: ${!nodeA ? nodeAName : nodeBName}`,
        node_a_found: !!nodeA,
        node_b_found: !!nodeB,
      }, { status: 404 });
    }

    if (nodeA.id === nodeB.id) {
      return Response.json({ success: true, message: 'Same node, nothing to connect', path: [nodeA.name] });
    }

    // Ask LLM for WordNet intermediate concepts bridging nodeA and nodeB
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets, hypernyms, and semantic field relationships.

Task: Build a semantic bridge path between two concept nodes using WordNet relationships.

Node A: "${nodeA.name}" (tier: ${nodeA.tier}, hex: ${nodeA.hex}, coords: ${nodeA.x},${nodeA.y},${nodeA.z})
Node B: "${nodeB.name}" (tier: ${nodeB.tier}, hex: ${nodeB.hex}, coords: ${nodeB.x},${nodeB.y},${nodeB.z})

Find ${maxHops - 1} intermediate WordNet concept words that semantically bridge Node A to Node B. The path should go:
Node A → intermediate 1 → intermediate 2 → ... → Node B

Rules:
- Each intermediate word MUST be a single lowercase English WordNet word (noun or adjective).
- Use WordNet hypernym/hyponym chains, shared hypernyms, and synset distance to trace a meaningful semantic path.
- Intermediate words should form a coherent conceptual progression (not random hops).
- Prefer concepts that genuinely belong on a semantic path between the two endpoints.
- Do NOT use the endpoint words themselves as intermediates.

Return a JSON object:
{
  "intermediates": ["word1", "word2", ...],
  "rationale": "brief explanation of the semantic path"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          intermediates: {
            type: 'array',
            items: { type: 'string' },
          },
          rationale: { type: 'string' },
        },
      },
    });

    const intermediates = (result.intermediates || []).filter(w => w && w.trim()).map(w => w.toLowerCase().trim());

    if (intermediates.length === 0) {
      // Direct connection fallback
      const aParents = [...new Set([...(nodeA.parents || []), nodeB.name])];
      const bParents = [...new Set([...(nodeB.parents || []), nodeA.name])];
      await base44.asServiceRole.entities.ColorNode.bulkUpdate([
        { id: nodeA.id, parents: aParents },
        { id: nodeB.id, parents: bParents },
      ]);
      return Response.json({
        success: true,
        node_a: nodeA.name,
        node_b: nodeB.name,
        intermediates_created: 0,
        path: [nodeA.name, nodeB.name],
        rationale: result.rationale || 'Direct connection (no intermediates found)',
      });
    }

    // Build the full path: A, intermediates..., B
    const fullPath = [nodeA.name, ...intermediates, nodeB.name];

    // Create intermediate nodes that don't exist yet (as 'bridge' tier)
    const toCreate = [];
    const createSpecs = [];
    for (let i = 0; i < intermediates.length; i++) {
      const word = intermediates[i];
      if (existingNames.has(word)) continue;

      // Position: interpolate along the path from A to B
      const t = (i + 1) / (intermediates.length + 1);
      const x = (nodeA.x || 0) + ((nodeB.x || 0) - (nodeA.x || 0)) * t;
      const y = (nodeA.y || 0) + ((nodeB.y || 0) - (nodeA.y || 0)) * t;
      const z = (nodeA.z || 0) + ((nodeB.z || 0) - (nodeA.z || 0)) * t;
      const hex = blendHex(nodeA.hex, nodeB.hex, t);

      toCreate.push({
        name: word,
        hex,
        x,
        y,
        z,
        tier: 'bridge',
        semantic_labels: ['wordnet-bridge-path'],
        parents: [],
      });
      createSpecs.push({ word, index: i });
      existingNames.add(word);
    }

    let createdNodes = [];
    if (toCreate.length > 0) {
      createdNodes = await base44.asServiceRole.entities.ColorNode.bulkCreate(toCreate);
      createdNodes = Array.isArray(createdNodes) ? createdNodes : [createdNodes];
    }

    // Build name -> node map for the full path (existing + created)
    const pathNodeMap = new Map();
    pathNodeMap.set(nodeA.name.toLowerCase(), nodeA);
    pathNodeMap.set(nodeB.name.toLowerCase(), nodeB);
    createdNodes.forEach(n => pathNodeMap.set(n.name.toLowerCase(), n));
    // Also pull existing intermediates from allNodes
    intermediates.forEach(w => {
      if (!pathNodeMap.has(w) && nameToNode.has(w)) {
        pathNodeMap.set(w, nameToNode.get(w));
      }
    });

    // Link the chain: each node gets the next as a parent (and reverse for bidirectionality)
    const updates = [];
    const dedup = new Map();

    const addLink = (fromName, toName) => {
      const fromNode = pathNodeMap.get(fromName.toLowerCase());
      if (!fromNode) return;
      const merged = [...new Set([...(fromNode.parents || []), toName])];
      if (merged.length === (fromNode.parents || []).length) return; // already linked
      if (dedup.has(fromNode.id)) {
        dedup.get(fromNode.id).parents = [...new Set([...dedup.get(fromNode.id).parents, ...merged])];
      } else {
        dedup.set(fromNode.id, { id: fromNode.id, parents: merged });
      }
    };

    for (let i = 0; i < fullPath.length - 1; i++) {
      addLink(fullPath[i], fullPath[i + 1]);
      addLink(fullPath[i + 1], fullPath[i]);
    }

    if (dedup.size > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate([...dedup.values()]);
    }

    return Response.json({
      success: true,
      node_a: nodeA.name,
      node_b: nodeB.name,
      intermediates_created: createdNodes.length,
      new_intermediate_names: toCreate.map(n => n.name),
      existing_intermediates_reused: intermediates.filter(w => !toCreate.some(c => c.name === w)),
      path: fullPath,
      rationale: result.rationale || '',
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});