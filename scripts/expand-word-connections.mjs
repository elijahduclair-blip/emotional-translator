import { readFileSync, writeFileSync } from 'node:fs';

const file = 'data/color-synonyms.json';
const raw = readFileSync(file, 'utf8');
const hadBom = raw.charCodeAt(0) === 0xfeff;
const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

const nodes = data.graph.nodes;
const edges = data.graph.edges;
const nodeById = new Map(nodes.map(node => [node.id, node]));

const familyTarget = family => family.includes('-') ? `subfamily-${family}` : `family-${family}`;
const slug = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function nodeByLabel(label, type = null) {
  const normalized = label.toLowerCase();
  return nodes.find(node => node.label.toLowerCase() === normalized && (!type || node.type === type));
}

function addNode(node) {
  if (nodeById.has(node.id)) return nodeById.get(node.id);
  nodes.push(node);
  nodeById.set(node.id, node);
  return node;
}

function addEdge(edge) {
  if (edges.some(item => item.id === edge.id || (item.source === edge.source && item.target === edge.target && item.type === edge.type))) return;
  edges.push(edge);
}

function upsertEmotion(entry) {
  const existing = nodeByLabel(entry.term, 'emotion_word');
  const node = existing || addNode({
    id: `emotion-${slug(entry.term)}`,
    label: entry.term,
    type: 'emotion_word',
    metadata: {
      emotionDefinition: entry.definition,
      tone: entry.tone,
      associationBasis: 'color-climate emotional association',
      definitionBasis: 'emotion input context, not strict color synonym',
      confidence: 'medium',
      climateFamily: entry.family
    }
  });

  const target = familyTarget(entry.family);
  if (nodeById.has(target)) {
    addEdge({
      id: `${node.id}-to-${target}-emotion-association`,
      source: node.id,
      target,
      type: 'emotion_association',
      description: `${entry.term} connects to ${entry.family} as an emotional color-climate route`,
      evidence: entry.evidence,
      metadata: {
        associationBasis: 'color-climate emotional association',
        confidence: 'medium',
        family: entry.family
      }
    });
  }

  data.emotionWords.mapped ||= [];
  if (!data.emotionWords.mapped.some(item => item.term.toLowerCase() === entry.term.toLowerCase())) {
    data.emotionWords.mapped.push({
      term: entry.term,
      aliases: entry.aliases || [],
      nodeId: node.id,
      status: 'connected',
      connectionType: 'emotion_association',
      confidence: 'medium',
      family: entry.family
    });
  }

  data.emotionTranslator.phraseCues ||= [];
  const cue = entry.cue || entry.term;
  if (!data.emotionTranslator.phraseCues.some(item => item.cue.toLowerCase() === cue.toLowerCase())) {
    data.emotionTranslator.phraseCues.push({
      cue,
      emotion: entry.term,
      targetNodeId: node.id,
      confidence: 'medium',
      evidence: `${cue} routes through ${entry.term} as ${entry.family} emotional climate`,
      basis: 'emotional phrase cue'
    });
  }

  return node;
}

function upsertCommon(entry) {
  const existing = nodeByLabel(entry.term, 'common_word');
  const node = existing || addNode({
    id: `english-${slug(entry.term)}`,
    label: entry.term,
    type: 'common_word',
    family: null,
    metadata: {
      source: 'curated local association',
      associationBasis: 'concrete, natural, or culturally legible color association',
      contextDefinition: entry.definition,
      definitionBasis: 'common-word context definition',
      promotedFromNeutral: true
    }
  });

  entry.families.forEach(family => {
    const target = familyTarget(family);
    if (!nodeById.has(target)) return;
    addEdge({
      id: `${node.id}-to-${target}-associated-color`,
      source: node.id,
      target,
      type: 'associated_color',
      description: `${entry.term} connects to ${family} through a concrete or culturally legible color association`,
      evidence: `common-word association: ${entry.definition}`,
      metadata: {
        associationBasis: 'common-word color association',
        confidence: 'medium',
        family
      }
    });
  });

  return node;
}

const emotionEntries = [
  ['serene', 'blue', 'quiet and reflective', 'calm atmosphere, open sky, and cool water create a blue emotional climate'],
  ['reflective', 'blue', 'thoughtful and inward', 'reflection routes through blue as depth, water, and inward attention'],
  ['lonely', 'blue', 'separate and longing', 'loneliness often reads as blue distance and cool absence'],
  ['centered', 'green', 'regulated and steady', 'green routes through balance, breath, growth, and nervous-system steadiness'],
  ['grounded', 'green', 'stable and embodied', 'grounded feeling connects to green growth and rooted endurance'],
  ['renewed', 'green', 'recovering and fresh', 'renewal routes through green as recovery, repair, and return'],
  ['urgent', 'red', 'immediate and alarmed', 'urgency routes through red signal, heat, danger, and demand'],
  ['alarmed', 'red', 'startled and activated', 'alarm reads through red warning and heightened attention'],
  ['passionate', 'red', 'intense and attached', 'passion routes through red heat, body charge, and desire'],
  ['tender', 'pink', 'soft and emotionally open', 'tenderness routes through pink as softness, care, and attachment'],
  ['affectionate', 'pink', 'warmly attached', 'affection reads through pink closeness and gentle contact'],
  ['vulnerable', 'pink', 'exposed but soft', 'vulnerability routes through pink as open feeling and delicate attachment'],
  ['mysterious', 'purple', 'symbolic and hidden', 'mystery routes through purple as depth, ritual, and unseen meaning'],
  ['reverent', 'purple', 'awed and respectful', 'reverence connects to purple ceremony, dignity, and sacred distance'],
  ['imaginative', 'purple', 'visionary and associative', 'imagination routes through purple as symbolic possibility'],
  ['cheerful', 'yellow', 'bright and lifted', 'cheer routes through yellow light, warmth, and visible optimism'],
  ['curious', 'yellow', 'alert and interested', 'curiosity routes through yellow attention and mental brightness'],
  ['awake', 'yellow', 'clear and stimulated', 'awakeness routes through yellow light and alert perception'],
  ['excited', 'orange', 'animated and eager', 'excitement routes through orange motion, appetite, and social charge'],
  ['playful', 'orange', 'lively and spontaneous', 'playfulness connects to orange warmth and movement'],
  ['driven', 'orange', 'motivated and moving', 'drive routes through orange momentum and active pressure'],
  ['secure', 'brown', 'held and materially safe', 'security routes through brown earth, shelter, wood, and familiar weight'],
  ['rooted', 'brown', 'settled and enduring', 'rooted feeling connects to brown soil, trunk, and lived stability'],
  ['practical', 'brown', 'plain and workable', 'practicality routes through brown material usefulness and grounded action'],
  ['uncertain', 'gray', 'ambiguous and undecided', 'uncertainty routes through gray partial visibility and unresolved weather'],
  ['numb', 'gray', 'muted and flattened', 'numbness reads through gray low-signal emotional weather'],
  ['resigned', 'gray', 'tiredly accepting', 'resignation routes through gray quiet, fatigue, and low contrast'],
  ['guarded', 'black', 'protected and closed', 'guarded feeling routes through black boundary, concealment, and protection'],
  ['grieving', 'black', 'mourning and heavy', 'grief routes through black mourning, depth, and absence'],
  ['exposed', 'black', 'seen under pressure', 'exposure routes through black shadow becoming visible'],
  ['clear', 'white', 'open and unobscured', 'clarity routes through white visibility, space, and clean signal'],
  ['relieved', 'white', 'released and lighter', 'relief routes through white opening, breath, and pressure release'],
  ['innocent', 'white', 'unmarked and beginning', 'innocence routes through white untouched possibility'],
  ['dreamy', 'blue-purple', 'softly unreal and inward', 'blue-purple mixes blue reflection with purple symbolism'],
  ['liminal', 'blue-purple', 'between states', 'blue-purple reads as threshold, twilight, and symbolic transition'],
  ['haunted', 'blue-purple', 'remembered and atmospheric', 'haunting routes through blue-purple memory and shadowed imagination'],
  ['regulated', 'green-gray', 'steady but muted', 'green-gray mixes green regulation with gray restraint'],
  ['cautious', 'green-gray', 'careful and contained', 'caution routes through green-gray guarded steadiness'],
  ['muted', 'green-gray', 'softened and low intensity', 'muted feeling reads through green-gray reduced signal'],
  ['fresh', 'green-yellow', 'new and brightening', 'green-yellow combines growth with yellow light'],
  ['expectant', 'green-yellow', 'waiting with growth', 'expectancy routes through green-yellow emerging possibility'],
  ['adapting', 'green-yellow', 'adjusting and growing', 'adaptation mixes green recovery with yellow attention'],
  ['agitated', 'red-orange', 'heated and restless', 'red-orange combines red alarm with orange motion'],
  ['activated', 'red-orange', 'mobilized and charged', 'activation routes through red-orange pressure and movement'],
  ['impulsive', 'red-orange', 'fast and heated', 'impulse reads through red-orange action before settling'],
  ['attached', 'pink-red', 'bonded and intense', 'pink-red combines pink connection with red urgency'],
  ['longing', 'pink-red', 'wanting closeness', 'longing routes through pink-red attachment under pressure'],
  ['raw', 'pink-red', 'open and stinging', 'raw feeling mixes pink vulnerability with red exposure'],
  ['intense', 'purple-red', 'deep and pressurized', 'purple-red combines symbolic depth with red charge'],
  ['obsessed', 'purple-red', 'fixed and consuming', 'obsession routes through purple-red depth, fixation, and heat'],
  ['dramatic', 'purple-red', 'heightened and expressive', 'drama reads through purple-red ritual and emotional charge'],
  ['sociable', 'pink-orange', 'warm and reaching', 'pink-orange mixes pink connection with orange social motion'],
  ['flirtatious', 'pink-orange', 'playful and inviting', 'flirtation routes through pink-orange affection and spark'],
  ['warmhearted', 'pink-orange', 'open and warmly attached', 'warmhearted feeling combines pink care with orange warmth'],
  ['nostalgic', 'yellow-brown', 'warmly remembered', 'yellow-brown mixes yellow memory-light with brown age and material past'],
  ['seasoned', 'yellow-brown', 'aged and knowing', 'seasoned feeling routes through yellow-brown harvest and lived experience'],
  ['mellow', 'yellow-brown', 'softened and warm', 'mellow reads through yellow-brown gentle warmth and settled age'],
  ['encouraged', 'yellow-orange', 'lifted into action', 'yellow-orange combines optimism with movement'],
  ['energized', 'yellow-orange', 'bright and active', 'energy routes through yellow-orange alert warmth'],
  ['radiant', 'yellow-orange', 'brightly expressive', 'radiance reads through yellow-orange light and outward warmth'],
  ['industrious', 'brown-orange', 'working and active', 'brown-orange mixes brown material labor with orange motion'],
  ['earthy', 'brown-orange', 'warm and bodily grounded', 'earthy feeling routes through brown-orange soil warmth and physicality'],
  ['persistent', 'brown-orange', 'steady under motion', 'persistence mixes brown endurance with orange forward movement'],
  ['stubborn', 'red-brown', 'fixed under pressure', 'red-brown combines red force with brown density'],
  ['resentful', 'red-brown', 'old heat held in the body', 'resentment routes through red-brown stored pressure'],
  ['burdened', 'red-brown', 'heavy and pressured', 'burden reads through red-brown weight and strain'],
  ['fatigued', 'brown-gray', 'worn down and slowed', 'brown-gray mixes material heaviness with gray depletion'],
  ['weathered', 'brown-gray', 'aged by pressure', 'weathered feeling routes through brown-gray endurance and wear'],
  ['restrained', 'brown-gray', 'held back and low', 'restraint reads through brown-gray contained weight'],
  ['foggy', 'gray-white', 'unclear but light', 'gray-white mixes fog, partial visibility, and pale openness'],
  ['suspended', 'gray-white', 'paused between clarity and fog', 'suspension routes through gray-white unresolved air'],
  ['distant', 'gray-white', 'far and softened', 'distance reads through gray-white fading visibility'],
  ['melancholy', 'blue-gray', 'cool sadness', 'blue-gray mixes blue feeling with gray weather'],
  ['watchful', 'blue-gray', 'quietly alert', 'watchfulness routes through blue-gray vigilance and distance'],
  ['doubtful', 'blue-gray', 'uncertain and reflective', 'doubt mixes blue reflection with gray ambiguity'],
  ['isolated', 'blue-black', 'alone in depth', 'blue-black combines blue distance with black enclosure'],
  ['vigilant', 'blue-black', 'alert in darkness', 'vigilance routes through blue-black night watchfulness'],
  ['solemn', 'blue-black', 'serious and deep', 'solemn feeling reads through blue-black depth and gravity'],
  ['bleak', 'gray-black', 'low and closed', 'gray-black combines gray depletion with black enclosure'],
  ['trapped', 'gray-black', 'contained without clarity', 'trapped feeling routes through gray-black blocked atmosphere'],
  ['hidden', 'gray-black', 'concealed and dim', 'hidden feeling reads through gray-black low visibility'],
  ['blessed', 'yellow-white', 'lifted and held in light', 'yellow-white combines warm light with white openness'],
  ['trusting', 'yellow-white', 'open with faith', 'trusting routes through yellow-white gentle visibility'],
  ['lifted', 'yellow-white', 'made lighter', 'lifted feeling reads through yellow-white release and illumination'],
  ['cold', 'blue-gray', 'cool, distant, or emotionally low-temperature', 'cold routes through blue-gray when the input means emotional distance or winter atmosphere'],
  ['pressure', 'red-orange', 'compressed and activated', 'pressure routes through red-orange as heat, demand, and motion under strain'],
  ['tired', 'brown-gray', 'depleted and slowed', 'tired routes through brown-gray as worn material energy and low movement'],
  ['alone', 'blue-black', 'separate and enclosed', 'alone routes through blue-black as distance, night, and interior isolation'],
  ['heavy', 'brown-gray', 'weighted and slowed', 'heavy routes through brown-gray as emotional weight and material burden'],
  ['open', 'white', 'available and unclosed', 'open routes through white as space, exposure, and possibility'],
  ['closed', 'gray-black', 'shut down and guarded', 'closed routes through gray-black as blocked signal and low visibility'],
  ['memory', 'yellow-brown', 'remembered and aged by time', 'memory routes through yellow-brown as warm recall, archive, and lived age'],
  ['change', 'green-yellow', 'adjusting and becoming', 'change routes through green-yellow as growth, adaptation, and transition'],
  ['light', 'yellow-white', 'visible, lifted, and revealing', 'light routes through yellow-white as illumination, clarity, and readable signal']
].map(([term, family, tone, evidence]) => ({
  term,
  family,
  tone,
  evidence,
  definition: `${term} as a ${family} emotional climate`
}));

const commonEntries = [
  ['sky', ['blue', 'blue-gray'], 'open atmosphere commonly associated with blue daylight and blue-gray weather'],
  ['ocean', ['blue', 'blue-black'], 'large body of water commonly associated with blue surface and dark depth'],
  ['lake', ['blue', 'green-gray'], 'still water commonly associated with blue reflection and green-gray shore'],
  ['denim', ['blue', 'blue-gray'], 'woven cloth commonly associated with blue and faded blue-gray'],
  ['forest', ['green', 'green-gray'], 'dense tree landscape commonly associated with green growth and shadowed green-gray'],
  ['moss', ['green', 'green-gray'], 'soft plant growth commonly associated with green and muted green-gray'],
  ['leaf', ['green', 'green-yellow'], 'plant leaf commonly associated with green growth and yellow-green newness'],
  ['herb', ['green', 'green-gray'], 'aromatic plant commonly associated with green living material'],
  ['blood', ['red', 'red-brown'], 'body fluid commonly associated with red and dark red-brown when dried'],
  ['warning', ['red', 'yellow'], 'alert signal commonly associated with red danger and yellow caution'],
  ['rose', ['red', 'pink', 'pink-red'], 'flower commonly associated with red, pink, and pink-red intimacy'],
  ['heart', ['red', 'pink-red'], 'body organ and love symbol commonly associated with red and pink-red attachment'],
  ['blush', ['pink', 'pink-red'], 'skin warmth commonly associated with pink and pink-red embarrassment or tenderness'],
  ['cotton candy', ['pink', 'pink-orange'], 'sweet spun sugar commonly associated with pink and warm carnival color'],
  ['rose petal', ['pink', 'pink-red'], 'flower petal commonly associated with pink softness and red attachment'],
  ['violet', ['purple', 'blue-purple'], 'flower and color name commonly associated with purple and blue-purple'],
  ['amethyst', ['purple', 'blue-purple'], 'purple quartz commonly associated with purple and blue-purple depth'],
  ['plum', ['purple', 'purple-red'], 'fruit commonly associated with purple and red-purple skin'],
  ['sunlight', ['yellow', 'yellow-white'], 'visible daylight commonly associated with yellow and white illumination'],
  ['lemon', ['yellow', 'green-yellow'], 'citrus fruit commonly associated with yellow and green-yellow rind'],
  ['pollen', ['yellow', 'yellow-brown'], 'plant powder commonly associated with yellow and warm yellow-brown'],
  ['sunset', ['orange', 'yellow-orange', 'pink-orange'], 'evening sky commonly associated with orange, yellow-orange, and pink-orange'],
  ['pumpkin', ['orange', 'brown-orange'], 'fall fruit commonly associated with orange and earthy brown-orange'],
  ['carrot', ['orange', 'yellow-orange'], 'root vegetable commonly associated with orange and yellow-orange'],
  ['soil', ['brown', 'brown-gray'], 'earth material commonly associated with brown and brown-gray'],
  ['bark', ['brown', 'brown-gray'], 'tree covering commonly associated with brown and weathered gray-brown'],
  ['leather', ['brown', 'red-brown'], 'treated hide commonly associated with brown and red-brown'],
  ['fog', ['gray', 'gray-white'], 'low cloud or mist commonly associated with gray and gray-white visibility'],
  ['ash', ['gray', 'gray-black'], 'burn residue commonly associated with gray and gray-black'],
  ['concrete', ['gray', 'brown-gray'], 'building material commonly associated with gray and brown-gray dust'],
  ['night', ['black', 'blue-black'], 'dark time commonly associated with black and blue-black atmosphere'],
  ['shadow', ['black', 'gray-black'], 'blocked light commonly associated with black and gray-black partial visibility'],
  ['coal', ['black', 'gray-black'], 'dark carbon material commonly associated with black and gray-black'],
  ['snow', ['white', 'gray-white'], 'frozen precipitation commonly associated with white and gray-white winter light'],
  ['milk', ['white', 'yellow-white'], 'pale liquid commonly associated with white and warm off-white'],
  ['bone', ['white', 'yellow-white'], 'skeletal material commonly associated with white and yellow-white ivory tones'],
  ['twilight', ['blue-purple', 'blue-black'], 'between-day-and-night sky commonly associated with blue-purple and blue-black'],
  ['lichen', ['green-gray', 'green-yellow'], 'plantlike growth commonly associated with green-gray and green-yellow'],
  ['olive', ['green-yellow', 'green-gray'], 'fruit and color commonly associated with green-yellow and muted green-gray'],
  ['lava', ['red-orange', 'orange'], 'molten rock commonly associated with red-orange heat'],
  ['flame', ['red-orange', 'yellow-orange'], 'visible fire commonly associated with red-orange and yellow-orange'],
  ['coral', ['pink-orange', 'pink-red'], 'marine organism and color commonly associated with pink-orange and pink-red'],
  ['wine', ['purple-red', 'red-brown'], 'fermented drink commonly associated with purple-red and red-brown'],
  ['wheat', ['yellow-brown', 'yellow'], 'grain commonly associated with yellow-brown harvest color'],
  ['honey', ['yellow-orange', 'yellow-brown'], 'sweet substance commonly associated with yellow-orange and amber yellow-brown'],
  ['copper', ['brown-orange', 'orange'], 'metal commonly associated with brown-orange and orange warmth'],
  ['rust', ['red-brown', 'brown-orange'], 'oxidized metal commonly associated with red-brown and brown-orange'],
  ['driftwood', ['brown-gray', 'gray'], 'weathered wood commonly associated with brown-gray'],
  ['mist', ['gray-white', 'blue-gray'], 'fine suspended water commonly associated with gray-white and blue-gray'],
  ['steel', ['blue-gray', 'gray'], 'metal commonly associated with blue-gray and gray'],
  ['midnight', ['blue-black', 'black'], 'deep night commonly associated with blue-black and black'],
  ['charcoal', ['gray-black', 'black'], 'burned carbon commonly associated with gray-black and black'],
  ['candlelight', ['yellow-white', 'yellow-orange'], 'small flame light commonly associated with yellow-white and yellow-orange'],
  ['cold', ['blue-gray', 'gray-white', 'white'], 'low temperature or winter condition commonly associated with blue-gray, gray-white, and white'],
  ['light', ['white', 'yellow-white', 'yellow'], 'visible illumination commonly associated with white, yellow-white, and yellow'],
  ['darkness', ['black', 'blue-black', 'gray-black'], 'absence of light commonly associated with black, blue-black, and gray-black'],
  ['doorway', ['brown', 'gray-white', 'blue-gray'], 'threshold opening commonly associated with brown material, pale entry light, and blue-gray transition'],
  ['window', ['white', 'blue-gray', 'yellow-white'], 'glass opening commonly associated with white light, blue-gray reflection, and warm light'],
  ['weight', ['brown-gray', 'gray-black'], 'physical heaviness commonly associated with brown-gray mass and gray-black compression'],
  ['archive', ['yellow-brown', 'brown-gray'], 'stored record space commonly associated with aged paper, yellow-brown, and brown-gray'],
  ['signal', ['yellow', 'red', 'yellow-white'], 'visible cue or alert commonly associated with yellow attention, red warning, and white clarity'],
  ['threshold', ['blue-purple', 'gray-white'], 'between-space commonly associated with blue-purple transition and gray-white uncertainty']
].map(([term, families, definition]) => ({ term, families, definition }));

const addedEmotionNodes = emotionEntries.map(upsertEmotion);
const addedCommonNodes = commonEntries.map(upsertCommon);

const connectedTerms = new Map((data.neutralWords.connected || []).map(item => [item.term.toLowerCase(), item]));
const nowConnected = [
  ...addedEmotionNodes.map(node => ({
    term: node.label,
    nodeId: node.id,
    status: 'connected',
    source: 'curated local emotion expansion',
    connectionTypes: ['emotion association']
  })),
  ...addedCommonNodes.map(node => ({
    term: node.label,
    nodeId: node.id,
    status: 'connected',
    source: 'curated local association',
    connectionTypes: ['association']
  }))
];

nowConnected.forEach(item => {
  const key = item.term.toLowerCase();
  if (!connectedTerms.has(key)) {
    connectedTerms.set(key, item);
    return;
  }
  const existing = connectedTerms.get(key);
  existing.connectionTypes = [...new Set([...(existing.connectionTypes || []), ...(item.connectionTypes || [])])];
  existing.relatedNodeIds = [...new Set([existing.nodeId, ...(existing.relatedNodeIds || []), item.nodeId].filter(Boolean))];
  if (!existing.source.includes(item.source)) existing.source = `${existing.source}; ${item.source}`;
});
data.neutralWords.connected = [...connectedTerms.values()].sort((a, b) => a.term.localeCompare(b.term));

const promoted = new Set(nowConnected.map(item => item.term.toLowerCase()));
function removePromoted(items = []) {
  return items.filter(item => !promoted.has(item.term?.toLowerCase?.()));
}

data.neutralWords.unconnected = removePromoted(data.neutralWords.unconnected);
if (data.commonWords?.neutralWords) data.commonWords.neutralWords = removePromoted(data.commonWords.neutralWords);
if (data.englishWords?.neutralWords) data.englishWords.neutralWords = removePromoted(data.englishWords.neutralWords);

data.emotionWords.mapped.sort((a, b) => a.term.localeCompare(b.term));
data.emotionTranslator.phraseCues.sort((a, b) => a.cue.localeCompare(b.cue));
data.graph.nodes.sort((a, b) => {
  const typeRank = { family: 0, subfamily: 1, shade: 2, alias: 3, synonym: 4, common_word: 5, emotion_word: 6, neutral_word: 7 };
  return (typeRank[a.type] ?? 9) - (typeRank[b.type] ?? 9) || a.label.localeCompare(b.label);
});
data.graph.edges.sort((a, b) => a.type.localeCompare(b.type) || a.source.localeCompare(b.source) || a.target.localeCompare(b.target));

data.version = '1.1.0';
data.emotionWords.expansionPolicy = 'Every base and mixed color family receives emotion words so emotional translation can land across the whole climate palette.';
data.commonWords.expansionPolicy = 'Common words are connected through concrete, natural, or culturally legible color associations; they remain separate from strict color synonyms.';
data.neutralWords.updatePolicy = 'Neutral words are removed from unresolved lists only when promoted into emotion, common-word, cited bridge, or theme-context routes.';

writeFileSync(file, `${hadBom ? '\uFEFF' : ''}${JSON.stringify(data, null, 4)}\n`);

console.log(JSON.stringify({
  emotionNodes: addedEmotionNodes.length,
  commonNodes: addedCommonNodes.length,
  nodes: data.graph.nodes.length,
  edges: data.graph.edges.length,
  neutralConnected: data.neutralWords.connected.length,
  neutralUnconnected: data.neutralWords.unconnected.length
}, null, 2));
