const fs = require("fs");
const path = require("path");

const root = process.cwd();
const graphPath = path.join(root, "data", "color-synonyms.json");
const wordnetPath = path.join(root, "data", "wordnet-foundation.json");

const data = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const wordnet = JSON.parse(fs.readFileSync(wordnetPath, "utf8"));

const graph = data.graph;
wordnet.entries ||= {};

const POSITIONING_MATH_RULE = {
  name: "wordnet-positioning-evidence",
  version: "1.0.0",
  principle: "This system measures influence, not meaning.",
  primaryEvidence: ["hierarchy", "synonym", "opposite"],
  secondaryEvidence: ["hex", "rgb"],
  hexRole: "secondary_display_reference",
  rule:
    "Node placement is constrained by lexical hierarchy, synonym proximity, and opposite contrast boundaries. HEX/RGB values render or label color but do not decide semantic position.",
};

const TERM_OPPOSITES = {
  filter: ["unfiltered", "raw", "pass-through"],
  number: ["uncounted", "innumerable"],
  translation: ["original", "source text"],
  search: ["ignore", "overlook"],
  engine: ["passive system", "load"],
  project: ["abandonment", "cancellation"],
  input: ["output"],
  output: ["input"],
  transform: ["preserve", "remain"],
  ranking: ["equality", "unordered"],
  evidence: ["disproof", "counterexample"],
  context: ["isolation", "decontextualized"],
  time: ["timelessness", "stillness"],
  sequence: ["randomness", "disorder"],
};

const slug = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

function exactLabelNode(label, type) {
  const lower = label.toLowerCase();
  return graph.nodes.find(
    (node) =>
      String(node.label || "").toLowerCase() === lower &&
      (!type || node.type === type),
  );
}

function ensureNode(node) {
  const existing = nodesById.get(node.id);
  if (existing) {
    existing.metadata = { ...(existing.metadata || {}), ...(node.metadata || {}) };
    return existing.id;
  }
  graph.nodes.push(node);
  nodesById.set(node.id, node);
  return node.id;
}

function ensureCommonWord(term, preferredId) {
  const existing =
    (preferredId && nodesById.get(preferredId)) ||
    exactLabelNode(term, "common_word");
  if (existing) {
    existing.metadata = {
      ...(existing.metadata || {}),
      wordnetBacked: true,
      boundary:
        "Common word node. WordNet-style lexical evidence supports routes, but does not assign color meaning by itself.",
    };
    return existing.id;
  }
  return ensureNode({
    id: preferredId || `common-${slug(term)}`,
    label: term,
    type: "common_word",
    family: null,
    metadata: {
      source: "wordnet-foundation",
      wordnetBacked: true,
      definitionBasis: "local WordNet-style lexical entry",
      boundary:
        "Common word node. WordNet-style lexical evidence supports routes, but does not assign color meaning by itself.",
    },
  });
}

function ensureSynonym(label) {
  const existing = exactLabelNode(label, "synonym");
  if (existing) return existing.id;
  return ensureNode({
    id: `synonym-${slug(label)}`,
    label,
    type: "synonym",
    family: null,
    metadata: {
      source: "wordnet-foundation",
      boundary:
        "Lexical support node. It can support route evidence, but it is not an independent shade placement.",
    },
  });
}

function ensureEdge(edge) {
  const existing = graph.edges.find(
    (candidate) =>
      candidate.source === edge.source &&
      candidate.target === edge.target &&
      candidate.type === edge.type,
  );
  if (existing) {
    Object.assign(existing, edge, { id: existing.id });
    return existing.id;
  }
  graph.edges.push({
    id: edge.id || `${edge.source}-to-${edge.target}-${edge.type}`,
    ...edge,
  });
  return edge.id;
}

function positioningMetadata(evidenceType, positioningRole, activationWeight, extra = {}) {
  return {
    source: "local-wordnet-curated",
    evidenceType,
    positioningEvidence: true,
    positioningRole,
    activationWeight,
    hexRole: POSITIONING_MATH_RULE.hexRole,
    boundary:
      "Lexical evidence affects positioning math. HEX/RGB remains secondary display metadata.",
    ...extra,
  };
}

const termSpecs = {
  filter: {
    definition:
      "a device, rule, or process that screens, refines, or selects what passes through",
    synonyms: ["screen", "sieve", "strain", "refine", "select", "sort"],
    hypernyms: ["device", "process", "selector"],
    related: ["condition", "boundary", "visibility"],
    colors: [
      ["shade-mist-silver", "filter screens input through partial visibility"],
      ["shade-fog-silver", "filter creates a fog-like boundary between source and output"],
      ["subfamily-gray-white", "filter clarifies by moving from ambiguity toward visibility"],
      ["family-gray", "filter can withhold or mute information"],
    ],
  },
  number: {
    definition:
      "a count, figure, or quantity used to measure and order something",
    synonyms: ["quantity", "count", "numeral", "measure", "figure", "amount"],
    hypernyms: ["measurement", "symbol", "quantity"],
    related: ["order", "ranking", "sequence"],
    colors: [
      ["family-white", "number exposes structure through countable definition"],
      ["shade-silver", "number acts as a neutral measurement trace"],
      ["subfamily-gray-white", "number turns partial information into clearer structure"],
      ["family-blue", "number supports ordered analysis and reflection"],
    ],
  },
  translation: {
    definition:
      "the rendering or conversion of meaning, language, or form into another readable form",
    synonyms: ["interpretation", "rendering", "version", "conversion", "transposition"],
    hypernyms: ["communication", "conversion", "interpretation"],
    related: ["language", "meaning", "bridge"],
    colors: [
      ["shade-teal", "translation bridges blue reflection and green relational growth"],
      ["subfamily-blue-green", "translation carries meaning between awareness and connection"],
      ["shade-lexicon", "translation routes through word-bank and lexicon structure"],
      ["shade-silver", "translation preserves trace information while changing form"],
    ],
  },
  search: {
    definition: "an act of seeking, querying, scanning, or trying to find something",
    synonyms: ["seek", "query", "scan", "hunt", "explore", "find"],
    hypernyms: ["inquiry", "investigation", "process"],
    related: ["question", "discovery", "selection"],
    colors: [
      ["shade-sunlit-gold", "search aims toward discovery and revealed signal"],
      ["family-yellow", "search activates curiosity and exploratory attention"],
      ["shade-clearing", "search clears a path through uncertainty"],
      ["family-blue", "search depends on observation and reflection"],
    ],
  },
  engine: {
    preferredId: "english-engine",
    definition:
      "a machine, mechanism, or driving system that converts input into motion or output",
    synonyms: ["motor", "machine", "mechanism", "drive"],
    hypernyms: ["machine", "system", "mechanism"],
    related: ["motion", "force", "output"],
    colors: [
      ["shade-ember", "engine carries heat, pressure, and activation"],
      ["shade-amber", "engine converts stored fuel into motion signal"],
      ["subfamily-red-orange", "engine sits between red activation and orange motion"],
      ["shade-conduct", "engine conducts energy through a system"],
    ],
  },
  project: {
    definition:
      "a planned undertaking, task, or designed work carried forward over time",
    synonyms: ["plan", "design", "undertaking", "enterprise", "task"],
    hypernyms: ["work", "plan", "activity"],
    related: ["goal", "structure", "development"],
    colors: [
      ["shade-foundation", "project begins from a structured foundation"],
      ["family-green", "project grows through sustained development"],
      ["family-yellow", "project contains exploratory planning"],
      ["family-blue", "project needs reflective organization"],
    ],
  },
  input: {
    definition:
      "information, signal, material, or stimulus entering a system",
    synonyms: ["entry", "intake", "signal", "stimulus", "data", "source"],
    hypernyms: ["information", "signal", "entry"],
    related: ["source", "condition", "exposure"],
    colors: [
      ["family-white", "input is revealed information entering the system"],
      ["shade-daylight", "input makes a system available to observation"],
      ["family-yellow", "input can trigger curiosity and activation"],
      ["family-blue", "input becomes material for reflection"],
    ],
  },
  output: {
    definition:
      "the result, product, expression, or response produced by a system",
    synonyms: ["result", "product", "yield", "emission", "expression", "response"],
    hypernyms: ["result", "product", "effect"],
    related: ["response", "display", "consequence"],
    colors: [
      ["family-white", "output is exposed result or visible structure"],
      ["shade-gold", "output can carry completed signal or value"],
      ["family-yellow", "output makes result available for attention"],
      ["shade-clearing", "output clarifies what the system produced"],
    ],
  },
  transform: {
    definition:
      "to change, convert, alter, or modify something from one state or form into another",
    synonyms: ["convert", "change", "alter", "transmute", "modify"],
    hypernyms: ["change", "process", "conversion"],
    related: ["transition", "adaptation", "mutation"],
    colors: [
      ["subfamily-blue-purple", "transform can move from reflection into altered state"],
      ["subfamily-blue-green", "transform can convert awareness into adaptive growth"],
      ["shade-alter", "transform directly matches alteration language"],
      ["shade-amber", "transform carries heat, change, and transitional motion"],
    ],
  },
  ranking: {
    definition:
      "an ordered position, grade, hierarchy, rating, or priority assignment",
    synonyms: ["order", "grade", "hierarchy", "rating", "priority", "rank"],
    hypernyms: ["order", "classification", "measurement"],
    related: ["number", "sequence", "comparison"],
    colors: [
      ["family-white", "ranking exposes relative position"],
      ["shade-silver", "ranking behaves as neutral comparison structure"],
      ["family-blue", "ranking depends on analysis and ordered reflection"],
      ["shade-direction", "ranking gives direction through ordered placement"],
    ],
  },
  evidence: {
    definition:
      "proof, support, indication, trace, record, or testimony used to justify a route",
    synonyms: ["proof", "support", "indication", "trace", "record", "testimony"],
    hypernyms: ["information", "support", "record"],
    related: ["reason", "validation", "falsifiability"],
    colors: [
      ["family-white", "evidence exposes what can be inspected"],
      ["shade-silver", "evidence acts as a trace rather than a final meaning"],
      ["family-blue", "evidence supports reflective verification"],
      ["shade-clearing", "evidence clears uncertainty when strong enough"],
    ],
  },
  context: {
    definition:
      "the surrounding situation, setting, frame, or circumstance that changes how a route is read",
    synonyms: ["setting", "background", "frame", "environment", "circumstance"],
    hypernyms: ["environment", "condition", "situation"],
    related: ["condition", "meaning", "activation"],
    colors: [
      ["family-gray", "context can hold ambiguity and partial information"],
      ["subfamily-blue-gray", "context frames reflective atmosphere"],
      ["family-green", "context regulates which routes matter"],
      ["shade-foundation", "context forms the local ground a read stands on"],
    ],
  },
  time: {
    preferredId: "support-time",
    definition:
      "duration, period, interval, sequence, or chronology through which changes accumulate",
    synonyms: ["duration", "period", "interval", "sequence", "chronology"],
    hypernyms: ["measure", "dimension", "order"],
    related: ["history", "patina", "change"],
    colors: [
      ["family-blue", "time supports reflection across change"],
      ["family-gray", "time accumulates partial traces and ambiguity"],
      ["shade-silver", "time leaves a neutral trace of sequence"],
      ["shade-daytime", "time can become visible through observed period"],
    ],
  },
  sequence: {
    definition:
      "an ordered series, chain, succession, or progression of things over time",
    synonyms: ["order", "series", "succession", "chain", "progression"],
    hypernyms: ["order", "arrangement", "progression"],
    related: ["time", "ranking", "path"],
    colors: [
      ["family-blue", "sequence depends on ordered reflection"],
      ["shade-silver", "sequence is a neutral trace across steps"],
      ["shade-direction", "sequence gives directional path structure"],
      ["family-green", "sequence can regulate growth or process"],
    ],
  },
};

for (const [term, spec] of Object.entries(termSpecs)) {
  const source = ensureCommonWord(term, spec.preferredId);
  const sourceNode = nodesById.get(source);
  const opposites = spec.opposites || spec.antonyms || TERM_OPPOSITES[term] || [];

  sourceNode.metadata = {
    ...(sourceNode.metadata || {}),
    positioningEvidence: {
      primary: POSITIONING_MATH_RULE.primaryEvidence,
      secondary: POSITIONING_MATH_RULE.secondaryEvidence,
      hexRole: POSITIONING_MATH_RULE.hexRole,
      rule:
        "Hierarchy, synonyms, and opposites constrain position before HEX/RGB is considered.",
    },
  };

  wordnet.entries[term] = {
    ...(wordnet.entries[term] || {}),
    senses: [
      {
        partOfSpeech: "noun",
        definition: spec.definition,
        synonyms: spec.synonyms,
        antonyms: opposites,
        hypernyms: spec.hypernyms,
        related: spec.related,
        source: "local-wordnet-curated",
        positioningEvidence: POSITIONING_MATH_RULE.primaryEvidence,
        hexRole: POSITIONING_MATH_RULE.hexRole,
        boundary:
          "Lexical evidence only. Hierarchies, synonyms, and opposites support positioning influence; HEX/RGB remains secondary display metadata.",
      },
    ],
  };

  for (const synonym of spec.synonyms) {
    const target = ensureSynonym(synonym);
    ensureEdge({
      id: `${source}-to-${target}-has-synonym`,
      source,
      target,
      type: "has_synonym",
      description: `${term} has lexical support through "${synonym}"`,
      evidence: "local WordNet-style synonym set",
      metadata: positioningMetadata("synonym", "lexical_proximity", 0.62),
    });
  }

  for (const hypernym of spec.hypernyms) {
    const target = ensureSynonym(hypernym);
    ensureEdge({
      id: `${source}-to-${target}-wordnet-hierarchy`,
      source,
      target,
      type: "wordnet_hierarchy",
      description: `${term} is constrained by parent concept "${hypernym}"`,
      evidence: "local WordNet-style hypernym hierarchy",
      metadata: positioningMetadata("hierarchy", "parent_constraint", 0.7),
    });
  }

  for (const related of [...spec.hypernyms, ...spec.related]) {
    const target = ensureSynonym(related);
    ensureEdge({
      id: `${source}-to-${target}-definition-contains`,
      source,
      target,
      type: "definition_contains",
      description: `${term} definition contains or depends on "${related}"`,
      evidence: "local WordNet-style definition, hypernym, or related term",
      metadata: positioningMetadata("definition", "supporting_context", 0.5),
    });
  }

  for (const opposite of opposites) {
    const target = ensureSynonym(opposite);
    ensureEdge({
      id: `${source}-to-${target}-wordnet-opposite`,
      source,
      target,
      type: "wordnet_opposite",
      description: `${term} has contrast boundary against "${opposite}"`,
      evidence: "local WordNet-style opposite/contrast set",
      metadata: positioningMetadata("opposite", "contrast_boundary", -0.58, {
        contrastBoundary: true,
      }),
    });
  }

  for (const [target, reason] of spec.colors) {
    if (!nodesById.has(target)) {
      throw new Error(`Missing color target ${target} for ${term}`);
    }
    ensureEdge({
      id: `${source}-to-${target}-wordnet-shade-association`,
      source,
      target,
      type: "associated_color",
      description: `${term} connects to ${nodesById.get(target).label}: ${reason}`,
      evidence:
        "WordNet-style lexical support plus existing color-climate structure; evidence supports influence, not fixed meaning.",
      metadata: positioningMetadata("color_association", "secondary_route_support", 0.48, {
        colorReason: reason,
      }),
    });
  }
}

data.positioningMath = POSITIONING_MATH_RULE;
graph.positioningMath = POSITIONING_MATH_RULE;
wordnet.positioningMath = POSITIONING_MATH_RULE;

fs.writeFileSync(graphPath, `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(wordnetPath, `${JSON.stringify(wordnet, null, 2)}\n`);
