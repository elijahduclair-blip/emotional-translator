import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parentlessOnly = body.parentless_only || false;

    let nodes;
    if (parentlessOnly) {
      nodes = [];
      let skip = 0;
      while (true) {
        const batch = await base44.asServiceRole.entities.ColorNode.filter({}, '-created_date', 500, skip);
        nodes.push(...batch.filter(n => !n.parents || n.parents.length === 0));
        if (batch.length < 500) break;
        skip += 500;
      }
    } else {
      nodes = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500);
    }
    if (nodes.length === 0) return Response.json({ error: 'No nodes found' }, { status: 400 });

    // Batch LLM calls — 20 names per batch to keep responses reliable
    const BATCH_SIZE = 20;
    const hierarchies = {};
    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const batch = nodes.slice(i, i + BATCH_SIZE).map(n => n.name);
      const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `For each concept below, list its WordNet hypernym chain (ancestor synsets, most specific first, max 5 levels). Exclude the concept itself. Use real WordNet synset headwords. If unknown, use an empty array.\n\nReturn ONLY a valid JSON object mapping each concept name to its array of ancestor names. No markdown, no explanation. Example: {"Red": ["chromatic color", "color", "visual property"], "Blue": ["chromatic color", "color", "visual property"]}\n\nConcepts: ${JSON.stringify(batch)}`
      });
      // Parse the string response as JSON
      const raw = typeof llmRes === 'string' ? llmRes : JSON.stringify(llmRes);
      const jsonStr = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      let batchResult = {};
      try { batchResult = JSON.parse(jsonStr); } catch { /* skip unparseable */ }
      for (const [k, v] of Object.entries(batchResult)) {
        if (Array.isArray(v)) hierarchies[k] = v;
      }
    }

    // Lookup of existing nodes by lowercase name
    const existingByName = new Map(nodes.map(n => [n.name.toLowerCase(), n]));

    // Collect hypernyms that don't exist yet, tracking which nodes reference them
    const newHypernyms = new Map();
    for (const node of nodes) {
      const chain = hierarchies[node.name] || [];
      for (const hypernym of chain) {
        if (!hypernym) continue;
        const key = hypernym.toLowerCase();
        if (key === node.name.toLowerCase()) continue;
        if (!existingByName.has(key)) {
          if (!newHypernyms.has(key)) {
            newHypernyms.set(key, { displayName: hypernym, children: [] });
          }
          if (!newHypernyms.get(key).children.includes(node)) {
            newHypernyms.get(key).children.push(node);
          }
        }
      }
    }

    // Create new base-tier nodes for hypernyms referenced by 2+ children
    let hypernymsCreated = 0;
    for (const [key, info] of newHypernyms) {
      if (info.children.length < 2) continue;

      // Position at centroid of children, lowered toward abstract on Y axis
      const cx = info.children.reduce((s, n) => s + (n.x || 0), 0) / info.children.length;
      const cy = Math.max(0, info.children.reduce((s, n) => s + (n.y || 0), 0) / info.children.length * 0.4);
      const cz = info.children.reduce((s, n) => s + (n.z || 0), 0) / info.children.length;

      // Blend children colors
      let r = 0, g = 0, b = 0;
      for (const c of info.children) {
        const h = (c.hex || '#888888').replace('#', '');
        r += parseInt(h.slice(0, 2), 16);
        g += parseInt(h.slice(2, 4), 16);
        b += parseInt(h.slice(4, 6), 16);
      }
      r = Math.round(r / info.children.length);
      g = Math.round(g / info.children.length);
      b = Math.round(b / info.children.length);
      const blendHex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

      const created = await base44.asServiceRole.entities.ColorNode.create({
        name: info.displayName,
        hex: blendHex,
        x: cx, y: cy, z: cz,
        tier: 'bridge',
        semantic_labels: [],
        parents: [],
      });
      existingByName.set(key, created);
      hypernymsCreated++;
    }

    // Wire parent relationships: each node gets all ancestor hypernyms that exist as nodes
    let parentsUpdated = 0;
    const updates = [];
    for (const node of nodes) {
      const chain = hierarchies[node.name] || [];
      const newParents = [];
      for (const hypernym of chain) {
        if (!hypernym) continue;
        const existing = existingByName.get(hypernym.toLowerCase());
        if (existing && existing.id !== node.id && !newParents.includes(existing.name)) {
          newParents.push(existing.name);
        }
      }
      if (newParents.length > 0) {
        const merged = [...new Set([...(node.parents || []), ...newParents])];
        updates.push(base44.asServiceRole.entities.ColorNode.update(node.id, { parents: merged }));
        parentsUpdated++;
      }
    }
    await Promise.all(updates);

    return Response.json({
      nodesScanned: nodes.length,
      hypernymsCreated,
      parentsUpdated,
      chainsResolved: Object.keys(hierarchies).length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});