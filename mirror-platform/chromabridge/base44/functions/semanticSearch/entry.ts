import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const query = (body.query || '').trim();
    const rawWeights = { w_s: 0.25, w_g: 0.25, w_c: 0.25, w_p: 0.25, ...(body.weights || {}) };
    const anchorIds = body.anchorIds || [];
    const topN = body.topN || 15;

    if (!query) return Response.json({ error: 'Query is required' }, { status: 400 });

    // Normalize weights to sum to 1
    const wsum = rawWeights.w_s + rawWeights.w_g + rawWeights.w_c + rawWeights.w_p;
    const w = wsum > 0
      ? { w_s: rawWeights.w_s / wsum, w_g: rawWeights.w_g / wsum, w_c: rawWeights.w_c / wsum, w_p: rawWeights.w_p / wsum }
      : { w_s: 0.25, w_g: 0.25, w_c: 0.25, w_p: 0.25 };

    const nodes = await base44.entities.ColorNode.list();
    if (nodes.length === 0) {
      return Response.json({ query_interpretation: null, results: [], total_nodes: 0 });
    }

    // ── Step 1: LLM interprets the query into the semantic color space ──
    const nodeNames = nodes.map(n => n.name).slice(0, 200);
    const llmRes = await base44.integrations.Core.InvokeLLM({
      prompt: `You are interpreting a search query against a 3D semantic color space.

Axes:
- X: Cool (-100, blue/green/calm) to Warm (+100, red/orange/energetic)
- Y: Abstract (0, primitive/fundamental) to Differentiated (100, complex/refined)
- Z: Muted (-100, gray/neutral/subdued) to Vivid (+100, saturated/vivid/intense)

Existing concepts in the system: ${nodeNames.join(', ')}

Query: "${query}"

Respond with:
- query_labels: 3-5 semantic keywords describing what the query is about
- estimated_coord: { x, y, z } where this query would sit in the space (x: -100 to 100, y: 0 to 100, z: -100 to 100)
- closest_names: 3-5 existing concept names most semantically related to this query`,
      response_json_schema: {
        type: 'object',
        properties: {
          query_labels: { type: 'array', items: { type: 'string' } },
          estimated_coord: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
          },
          closest_names: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    const queryLabels = (llmRes.query_labels || []).map((l) => l.toLowerCase());
    const estCoord = llmRes.estimated_coord || { x: 0, y: 50, z: 0 };
    const closestNames = (llmRes.closest_names || []).map((n) => n.toLowerCase());

    // ── Pre-compute graph metrics ──
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const anchors = anchorIds.map((id) => nodeMap.get(id)).filter(Boolean);

    // Degree centrality: parents + children
    const degreeMap = new Map();
    for (const n of nodes) {
      const parents = (n.parents || []).length;
      const children = nodes.filter((o) => (o.parents || []).includes(n.name)).length;
      degreeMap.set(n.id, parents + children);
    }
    const maxDegree = Math.max(1, ...degreeMap.values());

    // Top 2 hub nodes for P fallback (betweenness proxy along the structural axis)
    const hubs = [...degreeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => nodeMap.get(id));

    // ── Step 2: Score each node: R(q,d) = w_s·S + w_g·G + w_c·C + w_p·P ──
    const results = nodes.map((node) => {
      // S: Text similarity (Jaccard on labels + name, boosted by closest_names)
      const nodeLabelSet = new Set([
        ...((node.semantic_labels || []).map((l) => l.toLowerCase())),
        node.name.toLowerCase(),
      ]);
      const qLabelSet = new Set([...queryLabels, ...closestNames]);
      let sIntersect = 0;
      for (const nl of nodeLabelSet) {
        for (const ql of qLabelSet) {
          if (ql === nl || ql.includes(nl) || nl.includes(ql)) sIntersect++;
        }
      }
      const sUnion = new Set([...nodeLabelSet, ...qLabelSet]).size;
      const sJaccard = sUnion > 0 ? sIntersect / sUnion : 0;
      const nameBoost = closestNames.includes(node.name.toLowerCase()) ? 0.3 : 0;
      const S = Math.min(1, sJaccard + nameBoost);

      // C: Coordinate proximity (inverse 3D distance from query's estimated position)
      const dx = node.x - estCoord.x;
      const dy = node.y - estCoord.y;
      const dz = node.z - estCoord.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const C = 1 / (1 + dist / 50);

      // G: Graph relationship strength (normalized degree centrality)
      const G = degreeMap.get(node.id) / maxDegree;

      // P: Path / contextual compatibility
      let P;
      if (anchors.length >= 2) {
        // Proximity to midpoint between selected anchor nodes
        const midX = (anchors[0].x + anchors[1].x) / 2;
        const midY = (anchors[0].y + anchors[1].y) / 2;
        const midZ = (anchors[0].z + anchors[1].z) / 2;
        const midDist = Math.sqrt((node.x - midX) ** 2 + (node.y - midY) ** 2 + (node.z - midZ) ** 2);
        P = 1 / (1 + midDist / 50);
      } else if (hubs.length >= 2) {
        // Distance from the line connecting the two highest-degree hubs (betweenness proxy)
        const a = hubs[0], b = hubs[1];
        const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
        const abLenSq = abx * abx + aby * aby + abz * abz;
        if (abLenSq < 0.001) {
          P = C;
        } else {
          const t = Math.max(0, Math.min(1,
            ((node.x - a.x) * abx + (node.y - a.y) * aby + (node.z - a.z) * abz) / abLenSq
          ));
          const projX = a.x + t * abx;
          const projY = a.y + t * aby;
          const projZ = a.z + t * abz;
          const lineDist = Math.sqrt((node.x - projX) ** 2 + (node.y - projY) ** 2 + (node.z - projZ) ** 2);
          P = 1 / (1 + lineDist / 50);
        }
      } else {
        P = C;
      }

      // Combined relevance score
      const R = w.w_s * S + w.w_g * G + w.w_c * C + w.w_p * P;

      return {
        node_id: node.id,
        name: node.name,
        hex: node.hex,
        tier: node.tier,
        x: node.x,
        y: node.y,
        z: node.z,
        scores: {
          S: Math.round(S * 100) / 100,
          G: Math.round(G * 100) / 100,
          C: Math.round(C * 100) / 100,
          P: Math.round(P * 100) / 100,
        },
        combined: Math.round(R * 1000) / 1000,
      };
    });

    results.sort((a, b) => b.combined - a.combined);

    return Response.json({
      query_interpretation: {
        query_labels: llmRes.query_labels || [],
        estimated_coord: estCoord,
        closest_names: llmRes.closest_names || [],
      },
      results: results.slice(0, topN),
      total_nodes: nodes.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});