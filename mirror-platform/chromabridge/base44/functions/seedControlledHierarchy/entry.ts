import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Targeted re-seeding: assigns every non-base node to exactly ONE closest
 * base-tier anchor via LLM, replacing (not appending) the parents array.
 *
 * Processes nodes in a loop with a time budget. Returns progress so the
 * caller can resume with batch_start for subsequent calls.
 *
 * Uses manual text parsing (not response_json_schema) for reliability.
 */
Deno.serve(async (req) => {
  const startTime = Date.now();
  const TIME_BUDGET_MS = 85000;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const start = body.batch_start || 0;
    const llmBatchSize = body.llm_batch_size || 50;

    // Fetch the controlled base anchor set
    const baseNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'base' });
    const baseMap = new Map(baseNodes.map(b => [b.name, b]));
    const baseNames = Array.from(baseMap.keys());
    const baseSet = new Set(baseNames.map(n => n.toLowerCase()));

    if (baseNames.length === 0) {
      return Response.json({ error: 'No base anchors found' }, { status: 400 });
    }

    // Fetch ALL non-base nodes (paginated)
    let nonBaseNodes = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500, skip);
      nonBaseNodes.push(...batch.filter(n => n.tier !== 'base'));
      if (batch.length < 500) break;
      skip += 500;
    }

    let cursor = start;
    let connectionsMade = 0;

    while (cursor < nonBaseNodes.length && (Date.now() - startTime) < TIME_BUDGET_MS) {
      const slice = nonBaseNodes.slice(cursor, cursor + llmBatchSize);
      if (slice.length === 0) break;

      const nodeNames = slice.map(n => n.name);
      const baseInfo = baseNames.map(b => `"${b}"`).join(', ');

      const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are building a clean semantic hierarchy. Each concept must be connected to exactly ONE foundational domain anchor.

Domain anchors: ${baseInfo}

For EACH concept below, determine which single anchor is its CLOSEST semantic match using WordNet synset distance, shared hypernyms, and semantic field overlap. Every concept MUST map to exactly one anchor.

Return ONLY a valid JSON object mapping each concept name to its closest anchor name. No markdown, no explanation. Example: {"Red": "Art & Aesthetics", "Anxiety": "Psychology & Mind"}

Concepts: ${JSON.stringify(nodeNames)}`,
      });

      // Parse the string response as JSON
      const raw = typeof llmRes === 'string' ? llmRes : JSON.stringify(llmRes);
      const jsonStr = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      let mappings = {};
      try { mappings = JSON.parse(jsonStr); } catch { /* skip unparseable */ }

      const nodeMap = new Map(slice.map(n => [n.name, n]));
      const parentUpdates = [];
      for (const [nodeName, baseName] of Object.entries(mappings)) {
        const node = nodeMap.get(nodeName);
        if (!node) continue;
        // Match base case-insensitively
        let matchedBase = null;
        for (const [bName, bObj] of baseMap) {
          if (bName.toLowerCase() === String(baseName).toLowerCase()) {
            matchedBase = bObj;
            break;
          }
        }
        if (!matchedBase) continue;
        parentUpdates.push({ id: node.id, parents: [matchedBase.name] });
      }

      if (parentUpdates.length > 0) {
        await base44.asServiceRole.entities.ColorNode.bulkUpdate(parentUpdates);
        connectionsMade += parentUpdates.length;
      }

      cursor += llmBatchSize;
    }

    const done = cursor >= nonBaseNodes.length;
    return Response.json({
      success: true,
      batch_start: start,
      processed_to: cursor,
      connections_made: connectionsMade,
      remaining: Math.max(0, nonBaseNodes.length - cursor),
      total_non_base: nonBaseNodes.length,
      done,
      elapsed_ms: Date.now() - startTime,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack, processed_to: start }, { status: 500 });
  }
});