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
    const phrase = body.phrase || "I need you to tell me when I could be overlooking something.";

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

    // Fetch all shade nodes for WordNet matching
    const shades = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'shade' });
    const shadeNames = shades.map(s => s.name);

    // Determine which words need new nodes
    const wordsToCreate = words.filter(w => !existingNames.has(w));
    const wordsExisting = words.filter(w => existingNames.has(w));

    // Ask LLM to: (1) position new word nodes, (2) find closest shade for every word
    const wordList = words.map((w, i) => `${i + 1}. "${w}"`).join('\n');
    const shadeList = shadeNames.slice(0, 400).map(s => `"${s}"`).join(', ');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a semantic lexicon expert using WordNet synsets and semantic relationships.

Given these words from a sentence:
${wordList}

And these existing shade concept nodes:
${shadeList}

For EACH word:
1. Determine the single closest shade concept using WordNet synset distance, shared hypernyms, and semantic field overlap.
2. If no existing shade is semantically close (synset distance > 4 hops), set "needs_new_shade" to true and provide a "new_shade_word" — a single WordNet English word capturing the concept.
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
      "closest_shade": "existing shade name or empty string",
      "needs_new_shade": false,
      "new_shade_word": "",
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
                closest_shade: { type: 'string' },
                needs_new_shade: { type: 'boolean' },
                new_shade_word: { type: 'string' },
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

    // Step 1: Create new shade nodes for words that need them
    const newShadesToCreate = [];
    const newShadeSpecs = [];
    const shadeExistingNames = new Set(shadeNames.map(s => s.toLowerCase()));

    for (const wr of wordResults) {
      if (wr.needs_new_shade && wr.new_shade_word) {
        const word = wr.new_shade_word.toLowerCase().trim();
        if (!shadeExistingNames.has(word) && !existingNames.has(word)) {
          // Position near the word that references it, blended toward neutral
          newShadesToCreate.push({
            name: word,
            hex: wr.hex || '#888888',
            x: wr.x || 0,
            y: wr.y || 128,
            z: wr.z || 0,
            tier: 'shade',
            semantic_labels: ['wordnet-shade'],
            parents: [],
          });
          newShadeSpecs.push({ word, referencedBy: wr.word });
          shadeExistingNames.add(word);
          existingNames.add(word);
        }
      }
    }

    let createdShades = [];
    if (newShadesToCreate.length > 0) {
      createdShades = await base44.asServiceRole.entities.ColorNode.bulkCreate(newShadesToCreate);
      createdShades = Array.isArray(createdShades) ? createdShades : [createdShades];
    }

    // Build a map of shade name -> shade node (existing + newly created)
    const shadeMap = new Map();
    shades.forEach(s => shadeMap.set(s.name.toLowerCase(), s));
    createdShades.forEach(s => shadeMap.set(s.name.toLowerCase(), s));

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

    // Step 3: Link each word node to its closest shade (as parent)
    const wordUpdates = [];
    const shadeReverseUpdates = []; // add word as synonym on the shade
    let linkedCount = 0;

    for (const wr of wordResults) {
      const wordNode = wordNodeMap.get(wr.word);
      if (!wordNode) continue;

      let shadeName = '';
      if (wr.needs_new_shade && wr.new_shade_word) {
        shadeName = wr.new_shade_word.toLowerCase().trim();
      } else if (wr.closest_shade) {
        shadeName = wr.closest_shade.toLowerCase().trim();
      }

      if (!shadeName) continue;
      const shadeNode = shadeMap.get(shadeName);
      if (!shadeNode) continue;

      const existingParents = wordNode.parents || [];
      if (existingParents.includes(shadeNode.name)) continue;
      const merged = [...new Set([...existingParents, shadeNode.name])];
      wordUpdates.push({ id: wordNode.id, parents: merged });

      // Add word as synonym on the shade (bidirectional link)
      const existingSynonyms = shadeNode.synonyms || [];
      if (!existingSynonyms.includes(wordNode.name)) {
        shadeReverseUpdates.push({ id: shadeNode.id, synonyms: [...new Set([...existingSynonyms, wordNode.name])] });
      }
      linkedCount++;
    }

    // Deduplicate updates by node id (multiple words may link to the same shade)
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
    const dedupedShadeUpdates = dedupById(shadeReverseUpdates);

    if (dedupedWordUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(dedupedWordUpdates);
    }
    if (dedupedShadeUpdates.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(dedupedShadeUpdates);
    }

    return Response.json({
      success: true,
      phrase,
      words_found: words,
      new_word_nodes_created: createdWordNodes.length,
      new_word_names: wordNodesToCreate.map(n => n.name),
      existing_words_reused: wordsExisting,
      new_shades_created: createdShades.length,
      new_shade_names: newShadesToCreate.map(n => n.name),
      words_linked_to_shades: linkedCount,
      links: wordResults.map(wr => ({
        word: wr.word,
        shade: wr.needs_new_shade ? wr.new_shade_word : wr.closest_shade,
        new_shade: wr.needs_new_shade,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});