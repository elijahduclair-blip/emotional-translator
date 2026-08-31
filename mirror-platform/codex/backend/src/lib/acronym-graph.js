import { analyzeLetterAccountability, buildWordSignature } from './letter-accountability.js';

export const ACRONYM_GRAPH_VERSION = 'acronym-graph.v1';
export const ACRONYM_FRONTIER_VERSION = 'acronym-frontier.v1';

const MAX_DEFINITIONS = 256;
const MAX_CONTINUATION_WORDS = 2048;
const MAX_WORD_CODE_POINTS = 128;
const DEFAULT_MAX_NODES = 48;
const DEFAULT_MAX_EDGES = 96;
const BRIGDE_EXPANSION = Object.freeze([
  'Buildable',
  'Reusable',
  'Independent',
  'Grouped',
  'Dots',
  'Enterconnected'
]);

export const ACRONYM_GRAPH_BOUNDARY = Object.freeze({
  mode: 'structure_only',
  expansionCreatesMeaning: false,
  semanticMutationAllowed: false,
  colorAssignmentAllowed: false,
  graphMutationAllowed: false,
  sourceMutationAllowed: false,
  reason: 'An acronym expansion is an attributed structural proposal. Repetition may support investigation, but it does not establish meaning or mutate either graph.'
});

export function expandAcronymGraph(input = {}) {
  const definitions = normalizeDefinitions(input.definitions);
  const continuation = normalizeContinuation(input.continuation);
  const roots = continuation
    ? continuation.pendingWords
    : normalizeRoots(input.text, input.roots);
  if (!roots.length) throw httpError(400, 'text, roots, or a continuation frontier is required');

  const degreeOfVision = normalizeDegreeOfVision(input.degreeOfVision);
  const expanded = new Set(continuation?.expandedWords || []);
  const known = new Set(continuation?.knownWords || []);
  const queue = uniqueWords(roots).map(word => word.surface);
  const queued = new Set(queue.map(normalizeWord));
  const nodes = new Map();
  const edges = [];
  const awaitingDefinitions = [];
  const deferredWords = [];
  let cursor = 0;

  while (cursor < queue.length) {
    const surface = queue[cursor];
    const key = normalizeWord(surface);
    if (expanded.has(key)) {
      cursor += 1;
      continue;
    }

    const definition = definitions.get(key);
    const node = buildNode(surface, definition, known.has(key));
    const nodeIsNewToView = !nodes.has(key);
    if (nodeIsNewToView && nodes.size >= degreeOfVision.maxNodes) break;
    if (nodeIsNewToView) nodes.set(key, node);
    known.add(key);

    if (!definition) {
      node.expansionStatus = 'awaiting_definition';
      awaitingDefinitions.push(surface);
      cursor += 1;
      continue;
    }

    const missingChildKeys = definition.expandsTo
      .map(normalizeWord)
      .filter((childKey, index, values) => values.indexOf(childKey) === index && !nodes.has(childKey));
    if (edges.length + definition.expandsTo.length > degreeOfVision.maxEdges
      || nodes.size + missingChildKeys.length > degreeOfVision.maxNodes) {
      node.expansionStatus = 'deferred_by_degree_of_vision';
      deferredWords.push(surface);
      break;
    }

    node.expansionStatus = 'expanded_in_view';
    node.slots = node.slots.map((slot, index) => ({
      ...slot,
      term: definition.expandsTo[index],
      termNodeId: nodeId(normalizeWord(definition.expandsTo[index])),
      status: 'connected'
    }));
    expanded.add(key);

    definition.expandsTo.forEach((term, index) => {
      const childKey = normalizeWord(term);
      const childWasKnown = known.has(childKey) || nodes.has(childKey);
      if (!nodes.has(childKey)) nodes.set(childKey, buildNode(term, definitions.get(childKey), known.has(childKey)));
      known.add(childKey);
      edges.push({
        id: `${nodeId(key)}.p${index + 1}.${nodeId(childKey)}`,
        from: nodeId(key),
        to: nodeId(childKey),
        position: index + 1,
        letter: node.slots[index].letter,
        relationship: 'acronym_expansion',
        directed: true,
        reusesExistingNode: childWasKnown,
        closesCycle: childKey === key || expanded.has(childKey),
        source: definition.source
      });
      if (!expanded.has(childKey) && !queued.has(childKey)) {
        queue.push(term);
        queued.add(childKey);
      }
    });
    cursor += 1;
  }

  const unvisited = queue.slice(cursor);
  const pendingWords = uniqueWords([...deferredWords, ...unvisited, ...awaitingDefinitions]).map(word => word.surface);
  const frontier = {
    awaitingDefinitions: uniqueWords(awaitingDefinitions).map(word => word.surface),
    deferredByDegreeOfVision: uniqueWords([...deferredWords, ...unvisited]).map(word => word.surface),
    pendingWords
  };

  return {
    version: ACRONYM_GRAPH_VERSION,
    engine: 'foundation_acronym_graph',
    principle: 'Every word remains an open acronym. Each request sees a finite region; the graph and its preserved frontier have no permanent depth limit.',
    roots: uniqueWords(roots).map(word => word.surface),
    definitionsConsulted: definitions.size,
    degreeOfVision: {
      ...degreeOfVision,
      nodesVisible: nodes.size,
      edgesVisible: edges.length,
      expandedWordsVisible: [...expanded].filter(word => nodes.has(word)).length,
      boundedExecution: true,
      permanentDepthLimit: null
    },
    growth: {
      openEnded: true,
      terminal: false,
      currentViewExhausted: frontier.deferredByDegreeOfVision.length === 0,
      requiresMoreDefinitions: frontier.awaitingDefinitions.length > 0
    },
    nodes: [...nodes.values()],
    edges,
    frontier,
    continuation: {
      version: ACRONYM_FRONTIER_VERSION,
      available: pendingWords.length > 0,
      pendingWords,
      expandedWords: [...expanded],
      knownWords: [...known]
    },
    boundary: ACRONYM_GRAPH_BOUNDARY
  };
}

function normalizeRoots(text, roots) {
  const supplied = Array.isArray(roots) ? roots : [];
  const fromText = String(text || '').trim()
    ? analyzeLetterAccountability(String(text)).wordSequence.map(item => item.surface)
    : [];
  return uniqueWords([...supplied, ...fromText]).map(word => word.surface);
}

function normalizeDefinitions(value) {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).map(([word, expandsTo]) => ({ word, expandsTo }))
      : [];
  if (entries.length > MAX_DEFINITIONS) throw httpError(413, `definitions must contain ${MAX_DEFINITIONS} entries or fewer`);

  const map = new Map();
  addDefinition(map, { word: 'BRIGDE', expandsTo: BRIGDE_EXPANSION, source: 'ari_foundation' });
  for (const entry of entries) addDefinition(map, entry);
  return map;
}

function addDefinition(map, entry) {
  const word = requireWord(entry?.word, 'definition word');
  const key = normalizeWord(word);
  const expandsTo = Array.isArray(entry?.expandsTo) ? entry.expandsTo.map((term, index) => requireWord(term, `expansion term ${index + 1}`)) : [];
  const signature = buildWordSignature(word, 'definition');
  if (expandsTo.length !== signature.letterCount) {
    throw httpError(422, `${word} has ${signature.letterCount} letter positions and requires exactly ${signature.letterCount} expansion terms`);
  }
  expandsTo.forEach((term, index) => {
    const initial = buildWordSignature(term, 'term').letters[0].normalized;
    if (initial !== signature.letters[index].normalized) {
      throw httpError(422, `${word} position ${index + 1} is ${signature.letters[index].surface}; ${term} does not begin with that letter`);
    }
  });

  const definition = {
    word,
    normalizedWord: key,
    expandsTo,
    source: String(entry?.source || 'supplied_definition').slice(0, 120)
  };
  const existing = map.get(key);
  if (existing && JSON.stringify(existing.expandsTo.map(normalizeWord)) !== JSON.stringify(expandsTo.map(normalizeWord))) {
    throw httpError(409, `${word} conflicts with the established ${existing.word} expansion`);
  }
  map.set(key, existing || definition);
}

function buildNode(surface, definition, seenBefore) {
  const signature = buildWordSignature(surface, 'acronym');
  return {
    id: nodeId(signature.normalizedWord),
    word: String(surface),
    normalizedWord: signature.normalizedWord,
    letterCount: signature.letterCount,
    seenBefore,
    isAcronym: true,
    expansionStatus: definition ? 'ready_to_expand' : 'awaiting_definition',
    slots: signature.letters.map(letter => ({
      position: letter.position,
      letter: letter.surface,
      normalizedLetter: letter.normalized,
      term: null,
      termNodeId: null,
      status: 'open'
    }))
  };
}

function normalizeContinuation(value) {
  if (value == null) return null;
  if (value?.version !== ACRONYM_FRONTIER_VERSION) throw httpError(422, 'continuation version is not supported');
  const pendingWords = boundedWordList(value.pendingWords, 'continuation pendingWords');
  const expandedWords = boundedNormalizedList(value.expandedWords, 'continuation expandedWords');
  const knownWords = boundedNormalizedList(value.knownWords, 'continuation knownWords');
  return { pendingWords, expandedWords, knownWords };
}

function boundedWordList(value, field) {
  if (!Array.isArray(value) || value.length > MAX_CONTINUATION_WORDS) throw httpError(413, `${field} is too large`);
  return uniqueWords(value).map(word => word.surface);
}

function boundedNormalizedList(value, field) {
  if (!Array.isArray(value) || value.length > MAX_CONTINUATION_WORDS) throw httpError(413, `${field} is too large`);
  return [...new Set(value.map(item => normalizeWord(requireWord(item, field))))];
}

function normalizeDegreeOfVision(value) {
  return {
    maxNodes: boundedInteger(value?.maxNodes, DEFAULT_MAX_NODES, 1, 256),
    maxEdges: boundedInteger(value?.maxEdges, DEFAULT_MAX_EDGES, 1, 512)
  };
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

function uniqueWords(values) {
  const found = new Map();
  for (const value of values) {
    const surface = requireWord(value, 'word');
    const key = normalizeWord(surface);
    if (!found.has(key)) found.set(key, { surface, key });
  }
  return [...found.values()];
}

function normalizeWord(value) {
  return buildWordSignature(requireWord(value, 'word'), 'normalize').normalizedWord;
}

function requireWord(value, field) {
  const word = String(value || '').trim().normalize('NFC');
  if (!word) throw httpError(400, `${field} is required`);
  if ([...word].length > MAX_WORD_CODE_POINTS) throw httpError(413, `${field} must be ${MAX_WORD_CODE_POINTS} Unicode code points or fewer`);
  if (/\s/u.test(word)) throw httpError(422, `${field} must contain one word rather than a phrase`);
  buildWordSignature(word, 'validation');
  return word;
}

function nodeId(key) {
  return `word:${encodeURIComponent(key)}`;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
