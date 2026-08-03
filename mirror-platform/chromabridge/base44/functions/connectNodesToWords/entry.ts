import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const start = body.batch_start || 0;
    const size = body.batch_size || 12;

    // Fetch all word-tier nodes (the target pool)
    const wordNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'words' });
    const wordNames = new Set(wordNodes.map(n => n.name.toLowerCase()));

    if (wordNames.size === 0) {
      return Response.json({ done: true, message: 'No word-tier nodes exist yet' });
    }

    // Fetch all non-word nodes (paginate past 500)
    const nonWordNodes = [];
    for (const tier of ['base', 'bridge', 'shade']) {
      const nodes = await base44.asServiceRole.entities.ColorNode.filter({ tier });
      nonWordNodes.push(...nodes);
    }

    // Find non-word nodes not yet connected to any word (no word name in their synonyms)
    const unconnected = nonWordNodes.filter(n => {
      const syns = (n.synonyms || []).map(s => s.toLowerCase());
      return !syns.some(s => wordNames.has(s));
    });

    const batch = unconnected.slice(start, start + size);
    if (batch.length === 0) {
      return Response.json({ done: true, message: 'All non-word nodes are connected to words', batch_start: start });
    }

    const batchInfo = batch.map((n, i) => `${i + 1}. "${n.name}" (tier: ${n.tier}, hex: ${n.hex})`);
    const wordList = wordNodes.map(n => `"${n.name}"`).join(', ');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets and semantic relationships.

Given these ${batch.length} concept nodes:
${batchInfo.join('\n')}

And these ${wordNodes.length} WORD-tier nodes (linguistic expressions):
${wordList}

For EACH concept node, determine which single WORD is its CLOSEST semantic match using WordNet synset distance, shared hypernyms, and semantic field overlap. The word should be a genuine linguistic expression of the concept.

Return a JSON object with a "connections" array where each element has:
{
  "node": "exact concept node name",
  "word": "closest word name (must be one from the list above)"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          connections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                node: { type: 'string' },
                word: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const connections = result.connections || [];
    const nodeMap = new Map(batch.map(n => [n.name, n]));
    const wordMap = new Map(wordNodes.map(w => [w.name.toLowerCase(), w]));

    const conceptUpdates = [];
    const wordUpdates = [];

    for (const conn of connections) {
      const node = nodeMap.get(conn.node);
      const word = wordMap.get((conn.word || '').toLowerCase().trim());
      if (!node || !word) continue;

      // Add word as synonym on the concept node
      const existingSyns = node.synonyms || [];
      if (!existingSyns.includes(word.name)) {
        conceptUpdates.push({ id: node.id, synonyms: [...new Set([...existingSyns, word.name])] });
      }

      // Add concept as parent on the word node (bidirectional)
      const existingParents = word.parents || [];
      if (!existingParents.includes(node.name)) {
        wordUpdates.push({ id: word.id, parents: [...new Set([...existingParents, node.name])] });
      }
    }

    // Deduplicate by id
    const dedupById = (updates) => {
      const map = new Map();
      for (const u of updates) {
        if (map.has(u.id)) {
          const ex = map.get(u.id);
          if (u.synonyms) ex.synonyms = [...new Set([...(ex.synonyms || []), ...u.synonyms])];
          if (u.parents) ex.parents = [...new Set([...(ex.parents || []), ...u.parents])];
        } else {
          map.set(u.id, { ...u });
        }
      }
      return [...map.values()];
    };

    const dedupedConceptUpdates = dedupById(conceptUpdates);
    const dedupedWordUpdates = dedupById(wordUpdates);

    if (dedupedConceptUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(dedupedConceptUpdates);
    }
    if (dedupedWordUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(dedupedWordUpdates);
    }

    const linksMade = Math.max(dedupedConceptUpdates.length, dedupedWordUpdates.length);

    return Response.json({
      success: true,
      batch_start: start,
      batch_size: batch.length,
      nodes_processed: batch.map(n => n.name),
      connections_made: linksMade,
      remaining: unconnected.length - (start + size),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});