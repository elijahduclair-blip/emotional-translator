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
    const phrase = body.phrase || '';

    // Tokenize: lowercase, strip punctuation, split on whitespace, dedupe
    const rawWords = phrase.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 0);
    const words = [...new Set(rawWords)];

    if (words.length === 0) {
      return Response.json({ error: 'No words found in phrase' }, { status: 400 });
    }

    // Fetch all existing nodes to check which words already exist
    const allNodes = await base44.asServiceRole.entities.ColorNode.list('-created_date', 500);
    const existingMap = new Map(allNodes.map(n => [n.name.toLowerCase(), n]));
    const existingNames = new Set(allNodes.map(n => n.name.toLowerCase()));

    // Fetch all base and bridge nodes for WordNet matching
    const baseNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'base' });
    const bridgeNodes = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'bridge' });
    const targetNodes = [...baseNodes, ...bridgeNodes];
    const targetNames = targetNodes.map(n => n.name);
    const targetTierByName = new Map(targetNodes.map(n => [n.name, n.tier]));

    // Determine which words need new nodes
    const wordsToCreate = words.filter(w => !existingNames.has(w));
    const wordsExisting = words.filter(w => existingNames.has(w));

    // Ask LLM to: (1) position new word nodes, (2) find closest base/bridge for every word
    const wordList = words.map((w, i) => `${i + 1}. "${w}"`).join('\n');
    const targetList = targetNames.slice(0, 400).map(n => `"${n}" (${targetTierByName.get(n)})`).join(', ');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets and semantic relationships.

Given these words from a sentence:
${wordList}

And these existing concept nodes (labeled by tier — base or bridge):
${targetList}

For EACH word:
1. Determine the single closest concept node (base or bridge) using WordNet synset distance, shared hypernyms, and semantic field overlap.
2. If no existing node is semantically close (synset distance > 4 hops), set "needs_new_concept" to true and provide a "new_concept_word" — a single WordNet English word capturing the concept, plus "new_concept_tier" being either "base" or "bridge" (base = foundational abstract anchor, bridge = intermediate concept linking domains).
3. For positioning new word nodes, assign approximate coordinates:
   - x: Abstract (-255) to Concrete (255)
   - y: General (0) to Specific (255)
   - z: Passive (-255) to Active (255)
4. For color: assign a hex color that reflects the word's emotional/semantic climate.

Return a JSON object:
{
  "words": [
    {
      "word": "exact word",
      "closest_concept": "existing concept name or empty string",
      "concept_tier": "base or bridge",
      "needs_new_concept": false,
      "new_concept_word": "",
      "new_concept_tier": "",
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
          words: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                word: { type: 'string' },
                closest_concept: { type: 'string' },
                concept_tier: { type: 'string' },
                needs_new_concept: { type: 'boolean' },
                new_concept_word: { type: 'string' },
                new_concept_tier: { type: 'string' },
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

    const wordResults = result.words || [];

    // Step 1: Create new base/bridge nodes for words that need them
    const newConceptsToCreate = [];
    const newConceptSpecs = [];
    const conceptExistingNames = new Set(targetNames.map(n => n.toLowerCase()));

    for (const wr of wordResults) {
      if (wr.needs_new_concept && wr.new_concept_word) {
        const word = wr.new_concept_word.toLowerCase().trim();
        const tier = (wr.new_concept_tier || 'bridge').toLowerCase();
        const validTier = tier === 'base' ? 'base' : 'bridge';
        if (!conceptExistingNames.has(word) && !existingNames.has(word)) {
          newConceptsToCreate.push({
            name: word,
            hex: wr.hex || '#888888',
            x: wr.x || 0,
            y: wr.y || 128,
            z: wr.z || 0,
            tier: validTier,
            semantic_labels: ['wordnet-concept'],
            parents: [],
          });
          newConceptSpecs.push({ word, referencedBy: wr.word, tier: validTier });
          conceptExistingNames.add(word);
          existingNames.add(word);
        }
      }
    }

    let createdConcepts = [];
    if (newConceptsToCreate.length > 0) {
      createdConcepts = await base44.asServiceRole.entities.ColorNode.bulkCreate(newConceptsToCreate);
      createdConcepts = Array.isArray(createdConcepts) ? createdConcepts : [createdConcepts];
    }

    // Build a map of concept name -> concept node (existing + newly created)
    const conceptMap = new Map();
    targetNodes.forEach(n => conceptMap.set(n.name.toLowerCase(), n));
    createdConcepts.forEach(n => conceptMap.set(n.name.toLowerCase(), n));

    // Step 2: Create new word-tier nodes for words that don't exist yet
    const wordNodesToCreate = [];
    for (const wr of wordResults) {
      if (!wordsToCreate.includes(wr.word)) continue;
      wordNodesToCreate.push({
        name: wr.word,
        hex: wr.hex || '#888888',
        x: wr.x || 0,
        y: wr.y || 128,
        z: wr.z || 0,
        tier: 'words',
        semantic_labels: ['phrase-word'],
        parents: [],
      });
    }

    let createdWordNodes = [];
    if (wordNodesToCreate.length > 0) {
      createdWordNodes = await base44.asServiceRole.entities.ColorNode.bulkCreate(wordNodesToCreate);
      createdWordNodes = Array.isArray(createdWordNodes) ? createdWordNodes : [createdWordNodes];
    }

    // Build word name -> word node map (existing + newly created)
    const wordNodeMap = new Map();
    wordsExisting.forEach(w => {
      const node = existingMap.get(w);
      if (node) wordNodeMap.set(w, node);
    });
    createdWordNodes.forEach(n => wordNodeMap.set(n.name, n));

    // Step 3: Link each word node to its closest concept (as parent)
    const wordUpdates = [];
    const conceptReverseUpdates = [];
    let linkedCount = 0;

    for (const wr of wordResults) {
      const wordNode = wordNodeMap.get(wr.word);
      if (!wordNode) continue;

      let conceptName = '';
      if (wr.needs_new_concept && wr.new_concept_word) {
        conceptName = wr.new_concept_word.toLowerCase().trim();
      } else if (wr.closest_concept) {
        conceptName = wr.closest_concept.toLowerCase().trim();
      }

      if (!conceptName) continue;
      const conceptNode = conceptMap.get(conceptName);
      if (!conceptNode) continue;

      const existingParents = wordNode.parents || [];
      if (existingParents.includes(conceptNode.name)) continue;
      const merged = [...new Set([...existingParents, conceptNode.name])];
      wordUpdates.push({ id: wordNode.id, parents: merged });

      // Add word as synonym on the concept (bidirectional link)
      const existingSynonyms = conceptNode.synonyms || [];
      if (!existingSynonyms.includes(wordNode.name)) {
        conceptReverseUpdates.push({ id: conceptNode.id, synonyms: [...new Set([...existingSynonyms, wordNode.name])] });
      }
      linkedCount++;
    }

    // Deduplicate updates by node id
    const dedupById = (updates) => {
      const map = new Map();
      for (const u of updates) {
        if (map.has(u.id)) {
          const existing = map.get(u.id);
          if (u.parents) existing.parents = [...new Set([...(existing.parents || []), ...u.parents])];
          if (u.synonyms) existing.synonyms = [...new Set([...(existing.synonyms || []), ...u.synonyms])];
        } else {
          map.set(u.id, { ...u });
        }
      }
      return [...map.values()];
    };

    const dedupedWordUpdates = dedupById(wordUpdates);
    const dedupedConceptUpdates = dedupById(conceptReverseUpdates);

    if (dedupedWordUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(dedupedWordUpdates);
    }
    if (dedupedConceptUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(dedupedConceptUpdates);
    }

    return Response.json({
      success: true,
      phrase,
      words_found: words,
      new_word_nodes_created: createdWordNodes.length,
      new_word_names: wordNodesToCreate.map(n => n.name),
      existing_words_reused: wordsExisting,
      new_concepts_created: createdConcepts.length,
      new_concept_names: newConceptsToCreate.map(n => ({ name: n.name, tier: n.tier })),
      words_linked_to_concepts: linkedCount,
      links: wordResults.map(wr => ({
        word: wr.word,
        concept: wr.needs_new_concept ? wr.new_concept_word : wr.closest_concept,
        tier: wr.needs_new_concept ? wr.new_concept_tier : wr.concept_tier,
        new_concept: wr.needs_new_concept,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});