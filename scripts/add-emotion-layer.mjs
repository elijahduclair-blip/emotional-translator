import fs from 'node:fs';

const file = 'data/color-synonyms.json';
const raw = fs.readFileSync(file, 'utf8');
const hasBom = raw.charCodeAt(0) === 0xfeff;
const data = JSON.parse(hasBom ? raw.slice(1) : raw);

const graph = data.graph;
const nodes = graph.nodes;
const edges = graph.edges;
const nodeIds = new Set(nodes.map(node => node.id));
const edgeIds = new Set(edges.map(edge => edge.id));

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function addNode(node) {
  if (nodeIds.has(node.id)) return;
  nodes.push(node);
  nodeIds.add(node.id);
}

function addEdge(edge) {
  if (edgeIds.has(edge.id)) return;
  edges.push(edge);
  edgeIds.add(edge.id);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

addUnique(graph.allowedNodeTypes, 'emotion_word');
addUnique(graph.allowedEdgeTypes, 'emotion_association');

graph.nodeTypeDefinitions = graph.nodeTypeDefinitions || {};
graph.nodeTypeDefinitions.emotion_word = {
  label: 'Emotion word',
  simpleDefinition: 'A feeling word, like anger, joy, fear, calm, or love.',
  plainRole: 'This starts an emotional translation path, then lands on color only through labeled context association.'
};

data.emotionTranslator = {
  name: 'Emotional Translator Layer',
  policy: 'contextual-emotion-color-associations',
  purpose: 'Translate feeling words into explained color landings without treating emotions as strict color synonyms.',
  boundary: 'Emotion routes are contextual associations for translation and discovery. They do not override strict color definitions, aliases, synonym evidence, or common-word object associations.',
  confidencePolicy: {
    directEmotionAssociation: 'medium',
    multiStepEmotionPath: 'low',
    unrecognizedEmotion: 'low'
  },
  outputOrder: [
    'emotion input',
    'translation path',
    'color landing',
    'evocative suggestions',
    'alternative emotional routes'
  ]
};

const emotionRoutes = [
  {
    term: 'anger',
    aliases: ['angry'],
    definition: 'a strong feeling of displeasure or hostility',
    tone: 'heated',
    routes: [
      ['family-red', 'anger often routes through red idiom/color language such as seeing red'],
      ['subfamily-red-orange', 'anger can lean toward heated red-orange intensity']
    ]
  },
  {
    term: 'fear',
    aliases: ['afraid'],
    definition: 'an unpleasant feeling caused by threat, danger, or uncertainty',
    tone: 'alert',
    routes: [
      ['family-black', 'fear can route toward darkness and threat-coded black'],
      ['subfamily-blue-black', 'fear can lean toward cold dark blue-black atmosphere'],
      ['family-gray', 'fear can desaturate into uncertain gray']
    ]
  },
  {
    term: 'sad',
    aliases: ['sadness'],
    definition: 'a feeling of sorrow, unhappiness, or loss',
    tone: 'low',
    routes: [
      ['family-blue', 'sadness commonly routes through blue feeling language'],
      ['family-gray', 'sadness can land on gray as a muted low-energy color'],
      ['subfamily-blue-gray', 'sadness can blend blue feeling language with gray quietness']
    ]
  },
  {
    term: 'joy',
    aliases: ['happy', 'enjoy'],
    definition: 'a feeling of happiness, delight, or pleasure',
    tone: 'bright',
    routes: [
      ['family-yellow', 'joy can route toward bright yellow warmth and light'],
      ['subfamily-yellow-orange', 'joy can lean into yellow-orange energy'],
      ['family-orange', 'joy can land on orange as warm social brightness']
    ]
  },
  {
    term: 'love',
    aliases: ['lovely', 'lover'],
    definition: 'deep affection, care, or attachment',
    tone: 'tender',
    routes: [
      ['family-red', 'love commonly routes toward red romantic color language'],
      ['family-pink', 'love can land on pink as softer affection'],
      ['subfamily-pink-red', 'love can bridge red romance and pink tenderness']
    ]
  },
  {
    term: 'peace',
    aliases: ['calm'],
    definition: 'a state of quiet, safety, or freedom from disturbance',
    tone: 'quiet',
    routes: [
      ['family-blue', 'peace can route toward calm blue'],
      ['family-white', 'peace can land on white as quiet and simplicity'],
      ['subfamily-gray-white', 'peace can soften into pale gray-white restraint']
    ]
  },
  {
    term: 'hope',
    aliases: ['trust'],
    definition: 'a feeling of expectation, possibility, or confidence',
    tone: 'open',
    routes: [
      ['family-green', 'hope can route toward green growth and renewal'],
      ['family-yellow', 'hope can land on yellow as light and optimism'],
      ['subfamily-green-yellow', 'hope can bridge green renewal and yellow brightness']
    ]
  },
  {
    term: 'danger',
    aliases: ['dangerous'],
    definition: 'risk, threat, or exposure to harm',
    tone: 'warning',
    routes: [
      ['family-red', 'danger can route toward red warning color language'],
      ['family-orange', 'danger can land on orange as caution and hazard color language'],
      ['subfamily-red-orange', 'danger can bridge red warning and orange caution']
    ]
  },
  {
    term: 'trust',
    aliases: [],
    definition: 'confidence in reliability, truth, or safety',
    tone: 'steady',
    routes: [
      ['family-blue', 'trust can route toward blue stability and reliability'],
      ['subfamily-blue-gray', 'trust can land on restrained blue-gray'],
      ['family-green', 'trust can also point toward safe growth and permission']
    ]
  },
  {
    term: 'calm',
    aliases: [],
    definition: 'a quiet state with little agitation or disturbance',
    tone: 'serene',
    routes: [
      ['family-blue', 'calm can route toward serene blue'],
      ['family-green', 'calm can land on natural green'],
      ['subfamily-blue-gray', 'calm can soften into blue-gray quiet']
    ]
  }
];

data.emotionWords = {
  source: 'curated emotional translator seed set',
  policy: 'emotion words are contextual starts, not strict color terms',
  mapped: emotionRoutes.map(item => ({
    term: item.term,
    aliases: item.aliases,
    nodeId: `emotion-${slug(item.term)}`,
    status: 'connected',
    connectionType: 'emotion_association',
    confidence: 'medium'
  }))
};

emotionRoutes.forEach(item => {
  const id = `emotion-${slug(item.term)}`;
  addNode({
    id,
    label: item.term,
    type: 'emotion_word',
    metadata: {
      emotionDefinition: item.definition,
      tone: item.tone,
      associationBasis: 'contextual emotional color association',
      definitionBasis: 'emotion input context, not strict color synonym',
      confidence: 'medium',
      aliases: item.aliases
    }
  });

  item.aliases.forEach(alias => {
    addNode({
      id: `emotion-${slug(alias)}`,
      label: alias,
      type: 'emotion_word',
      metadata: {
        emotionDefinition: `${alias} routes through ${item.term}`,
        tone: item.tone,
        associationBasis: 'contextual emotional color association',
        definitionBasis: 'emotion input context, not strict color synonym',
        confidence: 'medium',
        canonicalEmotion: item.term
      }
    });
    addEdge({
      id: `emotion-${slug(alias)}-to-emotion-${slug(item.term)}-emotion-association`,
      source: `emotion-${slug(alias)}`,
      target: id,
      type: 'emotion_association',
      description: `${alias} routes through canonical emotion ${item.term}`,
      evidence: `emotion context alias: ${alias} -> ${item.term}`,
      metadata: {
        associationBasis: 'emotion alias route',
        confidence: 'medium'
      }
    });
  });

  item.routes.forEach(([targetId, evidence]) => {
    if (!nodeIds.has(targetId)) return;
    addEdge({
      id: `${id}-to-${targetId}-emotion-association`,
      source: id,
      target: targetId,
      type: 'emotion_association',
      description: `${item.term} has contextual emotional color route to ${targetId}`,
      evidence,
      metadata: {
        associationBasis: 'contextual emotional color association',
        confidence: 'medium',
        strictSynonym: false
      }
    });
  });
});

const text = `${JSON.stringify(data, null, 4)}\n`;
fs.writeFileSync(file, hasBom ? `\ufeff${text}` : text, 'utf8');
