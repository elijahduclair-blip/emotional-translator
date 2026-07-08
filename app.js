const FAMILY_COLORS = {
  blue: '#2f6fa3',
  green: '#3f8b4d',
  red: '#b33129',
  pink: '#d9579b',
  purple: '#742cc7',
  yellow: '#e7b936',
  orange: '#ef7d2d',
  brown: '#ad6328',
  gray: '#77808a',
  black: '#07141c',
  white: '#f4f6f8',
  common: '#4f6f68',
  neutral: '#8d8176',
  emotion: '#9a4f6d',
  'blue-purple': '#5651b7',
  'green-gray': '#6f8972',
  'green-yellow': '#8fab45',
  'red-orange': '#d6532a',
  'pink-red': '#ce465f',
  'purple-red': '#973070',
  'pink-orange': '#e77758',
  'yellow-brown': '#b98935',
  'yellow-orange': '#e99b2c',
  'brown-orange': '#bd6b2b',
  'red-brown': '#9f4c35',
  'brown-gray': '#82736a',
  'gray-white': '#b8bdbe',
  'blue-gray': '#6c8499',
  'blue-black': '#10293e',
  'gray-black': '#34383c',
  'yellow-white': '#e5d79a'
};

const SHADE_AXIS_LABELS = {
  x: 'Cool / warm',
  y: 'Degree of differentiation',
  z: 'Muted / vivid'
};

const SHADE_AXIS_POLARITIES = {
  x: {
    min: -100,
    max: 100,
    negative: 'cool',
    positive: 'warm'
  },
  y: {
    min: 0,
    max: 100,
    start: 'black field / abstract',
    end: 'white / differentiated'
  },
  z: {
    min: -100,
    max: 100,
    negative: 'muted',
    positive: 'vivid'
  }
};

const CONDITION_FAMILY_VECTORS = {
  blue: { x: -92, y: 66, z: 10 },
  green: { x: -58, y: 72, z: -6 },
  yellow: { x: 58, y: 86, z: 46 },
  red: { x: 92, y: 78, z: 80 },
  black: { x: 0, y: 0, z: -96 },
  white: { x: 0, y: 100, z: 0 }
};

const PRIMARY_COLOR_ANCHORS = new Set(['blue', 'green', 'yellow', 'red', 'black', 'white']);

const BRIDGE_FAMILY_RULES = {
  orange: { parents: ['yellow', 'red'], weights: [0.52, 0.48] },
  purple: { parents: ['blue', 'red'], weights: [0.58, 0.42] },
  pink: { parents: ['red', 'white'], weights: [0.42, 0.58] },
  brown: { parents: ['black', 'red'], weights: [0.56, 0.44] },
  gray: { parents: ['black', 'white'], weights: [0.74, 0.26] }
};

const DIFFERENTIATION_BANDS = {
  field: { min: 0, max: 0 },
  partial: { min: 14, max: 24 },
  blackBridge: { min: 26, max: 40 },
  bridge: { min: 44, max: 60 },
  primary: { min: 68, max: 86 },
  whiteBridge: { min: 82, max: 94 },
  white: { min: 100, max: 100 }
};

function bandRange(name) {
  return DIFFERENTIATION_BANDS[name] || DIFFERENTIATION_BANDS.bridge;
}

function bandMidpoint(name) {
  const band = bandRange(name);
  return (band.min + band.max) / 2;
}

function interpolateBand(name, ratio = 0.5) {
  const band = bandRange(name);
  const clampedRatio = clamp(ratio, 0, 1);
  if (band.min === band.max) return band.min;
  return band.min + (band.max - band.min) * clampedRatio;
}

function differentiationBandForParents(parents = []) {
  const normalizedParents = parents.map(parent => normalizeFamilyId(parent)).filter(Boolean);
  const includesBlack = normalizedParents.includes('black');
  const includesWhite = normalizedParents.includes('white');
  if (includesBlack && includesWhite) return 'partial';
  if (includesBlack) return 'blackBridge';
  if (includesWhite) return 'whiteBridge';
  return 'bridge';
}

function weightedInfluenceRatio(weights = []) {
  if (!weights.length) return 0.5;
  if (weights.length === 1) return 0.5;
  const numeric = weights.map(value => Number(value)).filter(Number.isFinite).map(value => Math.max(0, value));
  const total = numeric.reduce((sum, value) => sum + value, 0);
  if (!numeric.length || total <= 0) return 0.5;
  return numeric.reduce((sum, value, index) => {
    const normalized = value / total;
    const position = index / (numeric.length - 1);
    return sum + position * normalized;
  }, 0);
}

const ENVIRONMENT_CONDITIONS = {
  red: {
    condition: 'heat / activation / urgency',
    climate: 'A high-energy condition where attention, friction, blood, threat, love, or motion can become visible.',
    axes: 'Activation-positive X, higher differentiation Y, clarity-positive Z.',
    emotionalUse: 'Emotion reads through activation first; anger, passion, danger, and intensity are possible routes, not automatic meanings.'
  },
  orange: {
    condition: 'motion / release / transition heat',
    climate: 'A moving-warm condition where pressure turns into action, appetite, change, or social signal.',
    axes: 'Activation-positive X, rising differentiation Y, clarity-positive Z.',
    emotionalUse: 'Emotion reads through momentum; excitement, restlessness, courage, and release can share this climate.'
  },
  yellow: {
    condition: 'signal / exposure / attention',
    climate: 'A bright condition where things become noticeable, named, warned, invited, or brought into daylight.',
    axes: 'Activation-positive X, strongly differentiation-positive Y, clarity-positive Z.',
    emotionalUse: 'Emotion reads through visibility; joy, caution, hope, anxiety, and alertness can all use the same exposed light.'
  },
  green: {
    condition: 'regulation / growth / living balance',
    climate: 'A bridging condition where systems recover, stabilize, grow, or mediate between hotter and cooler states.',
    axes: 'Regulation-negative X, mid-to-high differentiation Y, and balanced Z where clarity and diffusion negotiate.',
    emotionalUse: 'Emotion reads through regulation; calm, hope, trust, envy, and endurance depend on the filter around it.'
  },
  blue: {
    condition: 'depth / distance / atmosphere',
    climate: 'A cool-depth condition where reflection, space, water, sky, memory, or emotional distance becomes readable.',
    axes: 'Regulation-leaning negative X, lower differentiation Y, and middle-to-clear Z.',
    emotionalUse: 'Emotion reads through atmosphere; sadness, serenity, longing, clarity, and fear can land differently inside the same depth.'
  },
  purple: {
    condition: 'threshold / mystery / symbolic pressure',
    climate: 'A boundary condition where red activation and blue depth meet as ritual, imagination, royalty, or inner intensity.',
    axes: 'Near-threshold X, lower-to-mid differentiation Y, and charged Z between clarity and ambiguity.',
    emotionalUse: 'Emotion reads through charged ambiguity; awe, desire, grief, power, and transformation can pass through this condition.'
  },
  pink: {
    condition: 'soft contact / tenderness / attachment',
    climate: 'A relational-warm condition where red activation is softened into care, intimacy, vulnerability, or invitation.',
    axes: 'Activation-positive X, higher differentiation Y, and soft-but-present Z.',
    emotionalUse: 'Emotion reads through contact; affection, embarrassment, sweetness, longing, and tenderness are possible routes.'
  },
  brown: {
    condition: 'ground / body / material memory',
    climate: 'A dense-earth condition where warmth becomes soil, age, shelter, habit, labor, or embodied memory.',
    axes: 'Mild activation-positive X, lower differentiation Y, and diffusion-leaning negative Z.',
    emotionalUse: 'Emotion reads through grounding; comfort, heaviness, nostalgia, fatigue, and steadiness depend on context.'
  },
  gray: {
    condition: 'partial differentiation / gradient / becoming',
    climate: 'A low-saturation transition field where experience is in process, not fully hidden and not fully manifest yet.',
    axes: 'Near-center X, partial-differentiation Y, and strong diffusion-negative Z.',
    emotionalUse: 'Emotion reads through becoming; numbness, doubt, revision, calm, and grief can remain partially formed until context differentiates them.'
  },
  black: {
    condition: 'abstract baseline / undifferentiated potential / concealment',
    climate: 'A background condition where distinction has not yet emerged, or where signal is compressed back into unseen possibility, pressure, or shadow.',
    axes: 'Baseline 0 differentiation Y, diffusion-negative Z, with X carried mostly by undertone pressure.',
    emotionalUse: 'Emotion reads through compressed potential and shadow; fear, grief, seriousness, protection, and reinvention are possible routes before differentiation.'
  },
  white: {
    condition: 'differentiation / manifestation / exposure',
    climate: 'A high-visibility condition where signal becomes explicit, recognizable, reflected, or fully exposed after passing through experience and condition.',
    axes: 'Maximum differentiation Y, near-center X, and low-pressure Z until a condition sharpens it.',
    emotionalUse: 'Emotion reads through manifestation; peace, exposure, clarity, hope, and overwhelm depend on what has become fully visible.'
  }
};

const ASSOCIATION_SYNONYM_SETS = {
  volcano: ['eruption', 'lava', 'pressure', 'heat', 'release'],
  fire: ['flame', 'heat', 'burning', 'spark', 'ignition'],
  blood: ['life force', 'wound', 'pulse', 'body', 'vitality'],
  rose: ['blossom', 'romance', 'tenderness', 'petal', 'attachment'],
  ocean: ['sea', 'depth', 'tide', 'vastness', 'blue distance'],
  sky: ['air', 'atmosphere', 'height', 'open space', 'distance'],
  snow: ['winter', 'blankness', 'quiet', 'white cover', 'cold light'],
  fog: ['mist', 'haze', 'uncertainty', 'blur', 'partial signal'],
  coffee: ['roast', 'earth', 'warmth', 'habit', 'bitterness'],
  soil: ['ground', 'earth', 'root', 'material memory', 'body'],
  grass: ['growth', 'field', 'living surface', 'renewal', 'green ground'],
  money: ['cash', 'value', 'exchange', 'security', 'resource'],
  gold: ['wealth', 'sunlight', 'honor', 'attention', 'treasure'],
  moon: ['night light', 'reflection', 'cycle', 'silver', 'distance'],
  wedding: ['bond', 'ritual', 'promise', 'white signal', 'union'],
  church: ['ritual', 'sanctuary', 'devotion', 'structure', 'sacred frame'],
  mask: ['costume', 'cover', 'role', 'hidden face', 'threshold'],
  electricity: ['charge', 'current', 'signal', 'spark', 'activation'],
  heat: ['warmth', 'activation', 'friction', 'intensity', 'pressure'],
  activation: ['arousal', 'ignition', 'charge', 'motion', 'response'],
  urgency: ['alarm', 'pressure', 'need', 'rush', 'immediacy'],
  depth: ['distance', 'underlayer', 'vastness', 'submergence', 'reflection'],
  atmosphere: ['mood', 'air', 'climate', 'surrounding field', 'weather'],
  regulation: ['balance', 'stabilizing', 'recovery', 'control', 'settling'],
  ambiguity: ['uncertainty', 'fog', 'revision', 'in-between', 'unresolved'],
  reflection: ['mirror', 'returning light', 'openness', 'reset', 'possibility'],
  grounding: ['anchoring', 'earth', 'body', 'stability', 'material memory']
};

const state = {
  data: null,
  dataSource: {
    mode: 'loading',
    label: 'Loading data source',
    apiAvailable: false,
    apiGraphCount: 0,
    databaseNodeIds: new Set()
  },
  governance: {
    proposals: [],
    history: [],
    loading: false,
    loaded: false
  },
  research: {
    results: [],
    suggestions: null,
    items: [],
    query: '',
    warnings: [],
    loading: false,
    loaded: false,
    message: null
  },
  historyIndex: {
    selectedEntryId: null,
    query: '',
    eraId: 'all',
    lane: 'all',
    region: 'all',
    type: 'all'
  },
  wordStorage: {
    input: '',
    records: [],
    groups: [],
    unresolved: [],
    totalWords: 0,
    distinctWords: 0,
    foundation: null,
    sourceMode: 'local',
    sourceLabel: 'Local analysis',
    loading: false,
    error: '',
    requestId: 0
  },
  assistant: {
    input: '',
    mode: 'auto',
    loading: false,
    message: null,
    history: []
  },
  auth: {
    configured: false,
    checked: false,
    token: sessionStorage.getItem('emotionalTranslator.authToken') || '',
    user: null,
    accounts: []
  },
  baseNodes: [],
  baseEdges: [],
  nodes: [],
  edges: [],
  nodeById: new Map(),
  customConcepts: [],
  activeThemeFilterIds: [],
  personProfile: null,
  surveyPatternText: '',
  pinnedRouteKeys: new Set(),
  activeSchemaPackId: 'color',
  selectedId: null,
  view: 'families',
  query: '',
  emotionFilter: false,
  baseSetting: true,
  ecosystemMode: true,
  categoryFilters: {
    families: true,
    bridges: true,
    shadeLanguage: true,
    conditions: true
  },
  routeHealthFilters: {
    usable: true,
    tentative: true,
    weak: true
  },
  layout: new Map(),
  dragId: null,
  dragOffset: { x: 0, y: 0 },
  infoCollapsed: false,
  graphMode: 'ring',
  three: {
    renderer: null,
    scene: null,
    camera: null,
    group: null,
    raycaster: null,
    pointer: null,
    nodeMeshes: new Map(),
    projected: new Map(),
    rotation: { x: -0.35, y: 0.55 },
    axisView: 'free',
    dragging: false,
    startPointer: { x: 0, y: 0 },
    lastPointer: { x: 0, y: 0 },
    animationId: null
  },
  perception: {
    profile: null,
    visibleNodeIds: new Set(),
    visibleEdges: [],
    wordStorageTargets: []
  },
  currentTranslation: null,
  scale: 1,
  pan: { x: 0, y: 0 }
};

const CUSTOM_CONCEPTS_KEY = 'emotionalTranslator.customConcepts.v1';
const THEME_FILTERS_KEY = 'emotionalTranslator.activeThemeFilters.v1';
const BASE_SETTING_KEY = 'emotionalTranslator.baseSetting.v1';
const PERSONAL_PROFILE_KEY = 'emotionalTranslator.personalProfile.v1';
const SURVEY_PATTERN_KEY = 'emotionalTranslator.surveyPatternText.v1';
const ECOSYSTEM_MODE_KEY = 'emotionalTranslator.ecosystemMode.v1';
const ROUTE_HEALTH_FILTERS_KEY = 'emotionalTranslator.routeHealthFilters.v1';
const PINNED_ROUTE_KEYS_KEY = 'emotionalTranslator.pinnedRouteKeys.v1';
const SCHEMA_PACK_KEY = 'emotionalTranslator.activeSchemaPack.v1';
const WORD_STORAGE_INPUT_KEY = 'emotionalTranslator.wordStorageInput.v1';
const AUTH_TOKEN_KEY = 'emotionalTranslator.authToken';
const PERSON_PROFILE_URL = 'person-0.json';
const API_BASE_URL = window.EMOTIONAL_TRANSLATOR_CONFIG?.API_BASE_URL || 'http://localhost:3000/api';
const API_TIMEOUT_MS = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 2500 : 60000;
const PROFILE_CONTEXT_TYPES = [
  { id: 'anchor', label: 'Personal anchors' },
  { id: 'pressure', label: 'Recurring pressures' },
  { id: 'relationship', label: 'Relationships / roles' },
  { id: 'season', label: 'Seasons / time periods' },
  { id: 'memory', label: 'Memories / places' },
  { id: 'place', label: 'Places' },
  { id: 'boundary', label: 'Boundaries / do not assume' }
];

const PERSONAL_SHAPE_OPTIONS = [
  'square',
  'rectangle',
  'parallelogram',
  'trapezoid',
  'rhombus',
  'kite',
  'irregular quadrilateral',
  'trapezium'
];

const SCHEMA_PACK_DEFS = {
  color: {
    id: 'color',
    label: 'Color',
    shortLabel: 'color spine',
    description: 'Reads the shared graph through color structure, shade precision, natural source, and synonym support.',
    routeVocabulary: 'color-climate routes',
    conditionVocabulary: 'theme conditions weight color routes without replacing them',
    traceRule: 'source -> color route -> shade landing',
    reasoning: 'Color stays the canonical backbone, so the cluster foregrounds family, branch, shade, source, and synonym structure.'
  },
  theme: {
    id: 'theme',
    label: 'Theme',
    shortLabel: 'theme lens',
    description: 'Reads the same shared graph through filter, condition, source image, visible expression, and activated route behavior.',
    routeVocabulary: 'theme-conditioned routes',
    conditionVocabulary: 'theme conditions act as the filter/cover layer for the read',
    traceRule: 'source + filter -> theme -> color-climate condition',
    reasoning: 'The graph stays shared, but this pack reads nodes as relational presentation under active conditions rather than only as color taxonomy.'
  }
};

const els = {
  search: document.querySelector('#searchInput'),
  clear: document.querySelector('#clearButton'),
  emotionFilter: document.querySelector('#emotionFilterToggle'),
  baseSetting: document.querySelector('#baseSettingToggle'),
  ecosystemMode: document.querySelector('#ecosystemModeToggle'),
  categoryButtons: document.querySelectorAll('.category-button'),
  routeHealthButtons: document.querySelectorAll('[data-route-health-filter]'),
  dataSourceStatus: document.querySelector('#dataSourceStatus'),
  authStatus: document.querySelector('#authStatus'),
  authForm: document.querySelector('#authForm'),
  authEmail: document.querySelector('#authEmail'),
  authUsername: document.querySelector('#authUsername'),
  authPassword: document.querySelector('#authPassword'),
  authSignIn: document.querySelector('#authSignInButton'),
  authCreate: document.querySelector('#authCreateButton'),
  authLogout: document.querySelector('#authLogoutButton'),
  authMessage: document.querySelector('#authMessage'),
  authTools: document.querySelector('#authAccountTools'),
  context: document.querySelector('#contextPanel'),
  wordStorageInput: document.querySelector('#wordStorageInput'),
  wordStorageSubmit: document.querySelector('#wordStorageSubmitButton'),
  wordStorageClear: document.querySelector('#wordStorageClearButton'),
  schemaPack: document.querySelector('#schemaPackSelect'),
  tabs: document.querySelectorAll('.tab'),
  viewGroups: document.querySelectorAll('.tab-group[data-view-group]'),
  list: document.querySelector('#listPanel'),
  title: document.querySelector('#detailTitle'),
  stats: document.querySelector('#stats'),
  swatch: document.querySelector('#selectedSwatch'),
  content: document.querySelector('#selectedContent'),
  canvas: document.querySelector('#graphCanvas'),
  threeGraph: document.querySelector('#threeGraph'),
  resizeHandle: document.querySelector('#resizeHandle'),
  contentGrid: document.querySelector('.content-grid'),
  detailToggle: document.querySelector('#detailToggleButton'),
  graphMode: document.querySelector('#graphModeButton'),
  colorMapToggle: document.querySelector('#colorMapToggleButton'),
  zoomOut: document.querySelector('#zoomOutButton'),
  zoomIn: document.querySelector('#zoomInButton'),
  axisView: document.querySelector('#axisViewButton'),
  fit: document.querySelector('#fitButton'),
  copy: document.querySelector('#copyButton')
};

const ctx = els.canvas.getContext('2d');
const VIEW_GROUPS = {
  foundation: new Set(['families', 'bridges', 'shade-language']),
  conditions: new Set(['common', 'emotions', 'neutral', 'associations', 'word-storage', 'shade-graph', 'natural-atlas'])
};

const VIEW_FALLBACK_ORDER = [
  'families',
  'bridges',
  'shade-language',
  'common',
  'emotions',
  'neutral',
  'associations',
  'word-storage',
  'shade-graph',
  'natural-atlas',
  'theme-categories',
  'theme-filters',
  'history-index',
  'type-architecture',
  'assistant',
  'selection-climate',
  'my-concepts',
  'personal-profile',
  'research',
  'shared-graph'
];
const GRAPH_ZOOM_MIN = 0.55;
const GRAPH_ZOOM_MAX = 2.6;
const GRAPH_ZOOM_STEP = 1.18;

async function init() {
  try {
    state.data = await loadTranslatorDataset();
    applyEnvironmentConditionGraph(state.data.graph);
    normalizeGraphNodeMetadata(state.data.graph);
    state.baseNodes = state.data.graph.nodes;
    state.baseEdges = state.data.graph.edges;
    state.customConcepts = loadCustomConcepts();
    state.activeThemeFilterIds = loadActiveThemeFilters();
    state.surveyPatternText = loadSurveyPatternText();
    state.baseSetting = loadBaseSetting();
    state.ecosystemMode = loadEcosystemMode();
    state.routeHealthFilters = loadRouteHealthFilters();
    state.pinnedRouteKeys = loadPinnedRouteKeys();
    state.activeSchemaPackId = loadSchemaPack();
    state.wordStorage.input = loadWordStorageInput();
    if (els.baseSetting) els.baseSetting.checked = state.baseSetting;
    if (els.ecosystemMode) els.ecosystemMode.checked = state.ecosystemMode;
    if (els.schemaPack) els.schemaPack.value = state.activeSchemaPackId;
    if (els.wordStorageInput) els.wordStorageInput.value = state.wordStorage.input;
    state.personProfile = await loadPersonalProfile();
    await loadAuthState();
    state.view = initialViewFromUrl();
    state.graphMode = initialGraphModeFromUrl();
    state.three.axisView = initialAxisViewFromUrl();
    applyAxisView(state.three.axisView);
    state.selectedId = 'family-red';
    rebuildActiveGraph();
    buildLayout();
    bindEvents();
    render();
  } catch (error) {
    els.title.textContent = 'Dataset could not load';
    els.content.innerHTML = `<p class="meta">${escapeHtml(error.message)}. Run a local web server from this folder so the browser can fetch the JSON file.</p>`;
  }
}

async function loadTranslatorDataset() {
  const [atlasResponse, historyResponse] = await Promise.all([
    fetch('data/color-synonyms.json'),
    fetch('data/history-index.json')
  ]);
  if (!atlasResponse.ok) throw new Error(`Dataset request failed: ${atlasResponse.status}`);
  if (!historyResponse.ok) throw new Error(`History index request failed: ${historyResponse.status}`);
  const localData = await atlasResponse.json();
  localData.historyIndex = await historyResponse.json();

  try {
    const apiGraph = await fetchJsonWithTimeout(`${API_BASE_URL}/v1/graph`, API_TIMEOUT_MS);
    const apiNodes = Array.isArray(apiGraph?.nodes) ? apiGraph.nodes : [];
    const apiEdges = Array.isArray(apiGraph?.edges) ? apiGraph.edges : [];
    state.dataSource.apiAvailable = true;
    state.dataSource.apiGraphCount = apiNodes.length;
    state.dataSource.databaseNodeIds = new Set(apiNodes.map(node => node.id));

    if (apiNodes.length && apiEdges.length) {
      localData.graph = mergeApiGraph(localData.graph, apiGraph);
      state.dataSource.mode = 'database';
      state.dataSource.label = `Database connected · ${apiNodes.length} nodes`;
    } else {
      state.dataSource.mode = 'hybrid-empty';
      state.dataSource.label = 'API connected · database graph empty · using local atlas';
    }
  } catch (error) {
    state.dataSource.mode = 'local';
    state.dataSource.label = 'Local atlas · API offline';
  }

  normalizeGraphNodeMetadata(localData.graph);

  return localData;
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function mergeApiGraph(localGraph, apiGraph) {
  const localNodes = Array.isArray(localGraph?.nodes) ? localGraph.nodes : [];
  const localEdges = Array.isArray(localGraph?.edges) ? localGraph.edges : [];
  const apiNodes = (apiGraph.nodes || []).map(normalizeApiNode);
  const apiEdges = (apiGraph.edges || []).map(normalizeApiEdge);
  const nodes = new Map(localNodes.map(node => [node.id, node]));
  const edges = new Map(localEdges.map(edge => [edge.id || `${edge.source}->${edge.target}:${edge.type}`, edge]));

  apiNodes.forEach(node => {
    const local = nodes.get(node.id) || {};
    nodes.set(node.id, { ...local, ...node, metadata: { ...(local.metadata || {}), ...(node.metadata || {}) } });
  });
  apiEdges.forEach(edge => {
    const key = edge.id || `${edge.source}->${edge.target}:${edge.type}`;
    edges.set(key, { ...(edges.get(key) || {}), ...edge });
  });

  return { ...localGraph, nodes: [...nodes.values()], edges: [...edges.values()] };
}

function normalizeApiNode(node) {
  const metadata = typeof node.metadata === 'string' ? safeJsonObject(node.metadata) : (node.metadata || {});
  const hexColor = node.hexColor || node.hex_color || null;
  return {
    ...node,
    metadata: hexColor && !metadata.hex ? { ...metadata, hex: hexColor } : metadata,
    hexColor
  };
}

function normalizeApiEdge(edge) {
  return { ...edge };
}

function safeJsonObject(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function normalizeGraphNodeMetadata(graph) {
  if (!graph || !Array.isArray(graph.nodes)) return graph;
  graph.nodes = graph.nodes.map(node => ({
    ...node,
    metadata: node.metadata && typeof node.metadata === 'object' ? { ...node.metadata } : {}
  }));
  return graph;
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function bindEvents() {
  els.authForm?.addEventListener('submit', event => authenticate(event, 'login'));
  els.authCreate?.addEventListener('click', event => authenticate(event, state.auth.configured ? 'register' : 'bootstrap'));
  els.authLogout?.addEventListener('click', logout);
  els.search.addEventListener('input', event => {
    state.query = event.target.value.trim().toLowerCase();
    rebuildActiveGraph();
    render();
  });

  els.clear.addEventListener('click', () => {
    state.query = '';
    els.search.value = '';
    rebuildActiveGraph();
    render();
  });

  els.wordStorageInput?.addEventListener('input', event => {
    state.wordStorage.input = event.target.value;
    saveWordStorageInput();
  });

  els.wordStorageSubmit?.addEventListener('click', () => {
    submitWordStorageText();
  });

  els.wordStorageClear?.addEventListener('click', () => {
    clearWordStorageText();
  });

  els.emotionFilter?.addEventListener('change', event => {
    state.emotionFilter = event.target.checked;
    if (state.emotionFilter && !emotionVisibleNodeIds().has(state.selectedId)) {
      state.selectedId = 'emotion-joy';
    }
    render();
  });

  els.baseSetting?.addEventListener('change', event => {
    state.baseSetting = event.target.checked;
    saveBaseSetting();
    renderContextPanel();
  });

  els.ecosystemMode?.addEventListener('change', event => {
    state.ecosystemMode = event.target.checked;
    saveEcosystemMode();
    rebuildActiveGraph();
    render();
  });

  els.schemaPack?.addEventListener('change', event => {
    state.activeSchemaPackId = event.target.value in SCHEMA_PACK_DEFS ? event.target.value : 'color';
    saveSchemaPack();
    render();
  });

  els.categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.categoryFilter;
      if (key === 'conditions') {
        setConditionBankVisibility(!conditionBankVisible());
        return;
      }
      state.categoryFilters[key] = !state.categoryFilters[key];
      renderCategoryButtons();
      renderLayerToggleButtons();
      if (!nodePassesCategoryFilter(state.nodeById.get(state.selectedId))) {
        state.selectedId = firstFilteredNodeId() || state.selectedId;
      }
      render();
    });
  });

  els.colorMapToggle?.addEventListener('click', () => {
    const nextActive = !colorMapVisible();
    setColorMapVisibility(nextActive);
  });

  els.routeHealthButtons.forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.routeHealthFilter;
      state.routeHealthFilters[key] = !state.routeHealthFilters[key];
      saveRouteHealthFilters();
      renderRouteHealthButtons();
      render();
    });
  });

  els.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      state.view = tab.dataset.view;
      renderTabs();
      renderList();
      if (state.view === 'research' && state.auth.user && !state.research.loaded) loadResearchItems();
      if (state.view === 'history-index' && state.auth.user && !state.research.loaded) loadResearchItems(false);
    });
  });

  els.fit.addEventListener('click', () => {
    if (state.graphMode === '3d') {
      state.three.axisView = 'free';
      applyAxisView('free');
      state.three.rotation = { x: -0.35, y: 0.55 };
      renderAxisViewButton();
      drawGraph();
      return;
    }
    resetGraphView();
    drawGraph();
  });

  els.graphMode?.addEventListener('click', () => {
    state.graphMode = nextGraphMode(state.graphMode);
    renderGraphModeButton();
    renderZoomButtons();
    renderAxisViewButton();
    buildLayout();
    drawGraph();
  });

  els.zoomIn?.addEventListener('click', () => {
    if (state.graphMode === '3d') return;
    zoomGraphView(GRAPH_ZOOM_STEP);
  });

  els.zoomOut?.addEventListener('click', () => {
    if (state.graphMode === '3d') return;
    zoomGraphView(1 / GRAPH_ZOOM_STEP);
  });

  els.axisView?.addEventListener('click', () => {
    state.three.axisView = nextAxisView(state.three.axisView);
    applyAxisView(state.three.axisView);
    renderAxisViewButton();
    drawGraph();
  });

  els.detailToggle?.addEventListener('click', () => {
    setInfoCollapsed(!state.infoCollapsed);
  });

  bindPanelResize();

  els.copy.addEventListener('click', async () => {
    const node = state.nodeById.get(state.selectedId);
    if (!node || !navigator.clipboard) return;
    await navigator.clipboard.writeText(node.label);
  });

  els.canvas.addEventListener('pointerdown', event => {
    if (state.view === 'word-storage') {
      const point = canvasScreenPoint(event);
      const hit = hitTestWordStorage(point.x, point.y);
      if (hit?.nodeId && state.nodeById.has(hit.nodeId)) {
        state.selectedId = hit.nodeId;
        render();
      }
      return;
    }
    const point = canvasPoint(event);
    if (state.graphMode === '3d') {
      state.three.dragging = true;
      state.three.startPointer = { x: event.clientX, y: event.clientY };
      state.three.lastPointer = { x: event.clientX, y: event.clientY };
      els.canvas.setPointerCapture(event.pointerId);
      return;
    }
    const hit = hitTest(point.x, point.y);
    if (!hit) return;
    state.selectedId = hit.id;
    state.dragId = hit.id;
    const pos = layoutPositionForNode(hit.id) || state.layout.get(hit.id);
    state.dragOffset = { x: point.x - pos.x, y: point.y - pos.y };
    els.canvas.setPointerCapture(event.pointerId);
    render();
  });

  els.canvas.addEventListener('pointermove', event => {
    if (state.graphMode === '3d' && state.three.dragging) {
      const dx = event.clientX - state.three.lastPointer.x;
      const dy = event.clientY - state.three.lastPointer.y;
      state.three.rotation.y += dx * 0.008;
      state.three.rotation.x = clamp(state.three.rotation.x + dy * 0.006, -1.2, 1.2);
      state.three.axisView = 'free';
      renderAxisViewButton();
      state.three.lastPointer = { x: event.clientX, y: event.clientY };
      drawGraph();
      return;
    }
    if (!state.dragId) return;
    const point = canvasPoint(event);
    state.layout.set(state.dragId, {
      ...state.layout.get(state.dragId),
      x: point.x - state.dragOffset.x,
      y: point.y - state.dragOffset.y
    });
    drawGraph();
  });

  els.canvas.addEventListener('pointerup', event => {
    if (state.graphMode === '3d') {
      const moved = Math.hypot(event.clientX - state.three.startPointer.x, event.clientY - state.three.startPointer.y);
      state.three.dragging = false;
      els.canvas.releasePointerCapture(event.pointerId);
      if (moved < 3) {
        const point = canvasPoint(event);
        const hit = hitTestThree(point.x, point.y);
        if (hit) {
          state.selectedId = hit.id;
          render();
        }
      }
      return;
    }
    state.dragId = null;
    els.canvas.releasePointerCapture(event.pointerId);
  });

  els.canvas.addEventListener('wheel', event => {
    if (state.graphMode === '3d') return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? GRAPH_ZOOM_STEP : 1 / GRAPH_ZOOM_STEP;
    zoomGraphView(factor, canvasScreenPoint(event));
  }, { passive: false });

  els.threeGraph?.addEventListener('pointerdown', event => {
    if (state.graphMode !== '3d') return;
    state.three.dragging = true;
    state.three.startPointer = { x: event.clientX, y: event.clientY };
    state.three.lastPointer = { x: event.clientX, y: event.clientY };
    els.threeGraph.setPointerCapture(event.pointerId);
  });

  els.threeGraph?.addEventListener('pointermove', event => {
    if (state.graphMode !== '3d' || !state.three.dragging) return;
    const dx = event.clientX - state.three.lastPointer.x;
    const dy = event.clientY - state.three.lastPointer.y;
    state.three.rotation.y += dx * 0.008;
    state.three.rotation.x = clamp(state.three.rotation.x + dy * 0.006, -1.2, 1.2);
    state.three.axisView = 'free';
    renderAxisViewButton();
    state.three.lastPointer = { x: event.clientX, y: event.clientY };
    renderThreeFrame();
  });

  els.threeGraph?.addEventListener('pointerup', event => {
    if (state.graphMode !== '3d') return;
    const moved = Math.hypot(event.clientX - state.three.startPointer.x, event.clientY - state.three.startPointer.y);
    state.three.dragging = false;
    els.threeGraph.releasePointerCapture(event.pointerId);
    if (moved < 3) selectThreeNodeAt(event);
  });

  window.addEventListener('resize', () => {
    buildLayout();
    drawGraph();
  });
}

function bindPanelResize() {
  if (!els.resizeHandle) return;
  let startX = 0;
  let startWidth = 0;

  const resize = event => {
    const delta = startX - event.clientX;
    const maxWidth = Math.min(940, Math.max(420, window.innerWidth * 0.68));
    const nextWidth = clamp(startWidth + delta, 220, maxWidth);
    document.documentElement.style.setProperty('--info-width', `${nextWidth}px`);
    buildLayout();
    drawGraph();
  };

  const stop = () => {
    els.resizeHandle.classList.remove('is-dragging');
    window.removeEventListener('pointermove', resize);
    window.removeEventListener('pointerup', stop);
  };

  els.resizeHandle.addEventListener('pointerdown', event => {
    if (state.infoCollapsed) return;
    const detail = document.querySelector('.node-detail');
    startX = event.clientX;
    startWidth = detail?.getBoundingClientRect().width || 360;
    els.resizeHandle.classList.add('is-dragging');
    els.resizeHandle.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', stop);
  });

  els.resizeHandle.addEventListener('dblclick', () => {
    document.documentElement.style.setProperty('--info-width', '360px');
    buildLayout();
    drawGraph();
  });
}

function setInfoCollapsed(collapsed) {
  state.infoCollapsed = collapsed;
  els.contentGrid?.classList.toggle('is-info-collapsed', collapsed);
  if (els.detailToggle) {
    els.detailToggle.setAttribute('aria-pressed', String(collapsed));
    els.detailToggle.setAttribute('aria-label', collapsed ? 'Show information panel' : 'Hide information panel');
    els.detailToggle.setAttribute('title', collapsed ? 'Show information panel' : 'Hide information panel');
  }
  requestAnimationFrame(() => {
    buildLayout();
    drawGraph();
  });
}

function resetGraphView() {
  state.scale = 1;
  state.pan = { x: 0, y: 0 };
}

function zoomGraphView(factor, anchor = null) {
  const rect = els.canvas.getBoundingClientRect();
  const focus = anchor || { x: rect.width / 2, y: rect.height / 2 };
  const graphPoint = screenToGraphPoint(focus.x, focus.y);
  const nextScale = clamp(state.scale * factor, GRAPH_ZOOM_MIN, GRAPH_ZOOM_MAX);
  state.scale = nextScale;
  state.pan = {
    x: focus.x - graphPoint.x * nextScale,
    y: focus.y - graphPoint.y * nextScale
  };
  drawGraph();
}

function applyGraphViewTransform() {
  ctx.translate(state.pan.x, state.pan.y);
  ctx.scale(state.scale, state.scale);
}

function screenToGraphPoint(x, y) {
  return {
    x: (x - state.pan.x) / state.scale,
    y: (y - state.pan.y) / state.scale
  };
}

function buildLayout() {
  const width = els.canvas.clientWidth || 900;
  const height = els.canvas.clientHeight || 560;
  state.layout.clear();
  const centerX = width / 2;
  const centerY = height / 2;
  const selected = state.nodeById.get(state.selectedId);
  const firstRing = Math.max(150, Math.min(width, height) * 0.29);
  const secondRing = Math.max(270, Math.min(width, height) * 0.49);

  if (!selected) return;

  state.perception.profile = currentPerceptionProfile();
  state.perception.visibleNodeIds = neighborhood(selected.id, state.perception.profile);

  if (state.graphMode === '3d') return;

  if (state.graphMode === 'topology') {
    buildTopologyLayout(selected, width, height);
    return;
  }

  if (state.graphMode === 'scatter') {
    buildScatterLayout(selected, width, height);
    return;
  }

  state.layout.set(selected.id, {
    x: centerX,
    y: centerY,
    radius: nodeRadius(selected, true),
    ring: 0
  });

  const direct = directNeighborGroups(selected.id, state.perception.visibleNodeIds, state.perception.profile);
  const used = new Set([selected.id]);

  placeArc(direct.outgoing, centerX, centerY, firstRing, -55, 55, used, 1, 'outgoing');
  placeArc(direct.incoming, centerX, centerY, firstRing, 125, 235, used, 1, 'incoming');
  placeArc(direct.both, centerX, centerY, firstRing, 250, 290, used, 1, 'both');

  const second = secondRingNodes(selected.id, used, state.perception.visibleNodeIds, state.perception.profile);
  placeSecondRing(second, centerX, centerY, secondRing, used);
}

function directNeighborGroups(selectedId, visibleSet = state.perception?.visibleNodeIds, profile = state.perception?.profile || currentPerceptionProfile()) {
  const outgoingIds = new Set(
    outgoing(selectedId)
      .filter(edge => edgePassesCategoryFilter(edge) && (!visibleSet || visibleSet.has(edge.target)))
      .sort((a, b) => edgePerceptionScore(b, profile, visibleSet) - edgePerceptionScore(a, profile, visibleSet))
      .map(edge => edge.target)
  );
  const incomingIds = new Set(
    incoming(selectedId)
      .filter(edge => edgePassesCategoryFilter(edge) && (!visibleSet || visibleSet.has(edge.source)))
      .sort((a, b) => edgePerceptionScore(b, profile, visibleSet) - edgePerceptionScore(a, profile, visibleSet))
      .map(edge => edge.source)
  );
  const both = [...outgoingIds].filter(id => incomingIds.has(id)).map(id => state.nodeById.get(id)).filter(Boolean);
  const bothIds = new Set(both.map(node => node.id));
  const sortByPerception = (a, b) =>
    nodePerceptionScore(b, profile) - nodePerceptionScore(a, profile)
    || sortNodesForLayout(a, b);

  return {
    outgoing: [...outgoingIds].filter(id => !bothIds.has(id)).map(id => state.nodeById.get(id)).filter(Boolean).sort(sortByPerception),
    incoming: [...incomingIds].filter(id => !bothIds.has(id)).map(id => state.nodeById.get(id)).filter(Boolean).sort(sortByPerception),
    both: both.sort(sortByPerception)
  };
}

function placeArc(nodes, centerX, centerY, radius, startDeg, endDeg, used, ring, direction = '') {
  if (!nodes.length) return;
  const span = endDeg - startDeg;
  nodes.forEach((node, index) => {
    if (used.has(node.id)) return;
    const ratio = nodes.length === 1 ? 0.5 : index / (nodes.length - 1);
    const angle = degToRad(startDeg + span * ratio);
    state.layout.set(node.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      radius: nodeRadius(node),
      ring,
      direction
    });
    used.add(node.id);
  });
}

function secondRingNodes(selectedId, used, visibleSet = state.perception?.visibleNodeIds, profile = state.perception?.profile || currentPerceptionProfile()) {
  const second = new Map();
  [...used].forEach(parentId => {
    if (parentId === selectedId) return;
    [...outgoing(parentId), ...incoming(parentId)].forEach(edge => {
      if (!edgePassesCategoryFilter(edge)) return;
      const otherId = edge.source === parentId ? edge.target : edge.source;
      if (used.has(otherId) || otherId === selectedId || second.has(otherId) || (visibleSet && !visibleSet.has(otherId))) return;
      const node = state.nodeById.get(otherId);
      if (!node) return;
      const parentPos = state.layout.get(parentId);
      const parentAngle = parentPos ? Math.atan2(parentPos.y - (els.canvas.clientHeight || 560) / 2, parentPos.x - (els.canvas.clientWidth || 900) / 2) : 0;
      second.set(otherId, { node, parentAngle });
    });
  });
  return [...second.values()].sort((a, b) =>
    nodePerceptionScore(b.node, profile) - nodePerceptionScore(a.node, profile)
    || a.parentAngle - b.parentAngle
    || sortNodesForLayout(a.node, b.node)
  );
}

function placeSecondRing(items, centerX, centerY, radius, used) {
  if (!items.length) return;
  const minGap = degToRad(12);
  items.forEach((item, index) => {
    const baseAngle = item.parentAngle;
    const offset = (index % 5 - 2) * minGap + Math.floor(index / 5) * degToRad(4);
    const angle = baseAngle + offset;
    const node = item.node;
    if (used.has(node.id)) return;
    state.layout.set(node.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      radius: nodeRadius(node),
      ring: 2
    });
    used.add(node.id);
  });
}

function buildTopologyLayout(selected, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const visibleIds = [...neighborhood(selected.id)].filter(id => state.nodeById.has(id));
  const visibleSet = new Set(visibleIds);
  const direct = directNeighborGroups(selected.id, visibleSet, state.perception.profile);
  const outgoingIds = new Set(direct.outgoing.map(node => node.id));
  const incomingIds = new Set(direct.incoming.map(node => node.id));
  const bothIds = new Set(direct.both.map(node => node.id));
  const distances = graphDistances(selected.id, visibleSet);
  const clusters = topologyClusters(visibleIds, distances);
  const maxDistance = Math.max(1, ...visibleIds.map(id => distances.get(id) || 1));
  const baseRadius = Math.max(90, Math.min(width, height) * 0.16);
  const radiusStep = Math.max(72, Math.min(width, height) * 0.13);
  const clusterAngles = new Map(clusters.map((cluster, index) => [
    cluster.key,
    degToRad(-90 + (360 * index) / Math.max(1, clusters.length))
  ]));

  state.layout.set(selected.id, {
    x: centerX,
    y: centerY,
    radius: nodeRadius(selected, true),
    ring: 0,
    centrality: graphDegree(selected.id, visibleSet),
    cluster: topologyClusterKey(selected)
  });

  clusters.forEach(cluster => {
    const angle = clusterAngles.get(cluster.key) || 0;
    const sorted = cluster.nodes
      .filter(node => node.id !== selected.id)
      .sort((a, b) => (distances.get(a.id) || 9) - (distances.get(b.id) || 9) || graphDegree(b.id, visibleSet) - graphDegree(a.id, visibleSet) || a.label.localeCompare(b.label));
    sorted.forEach((node, index) => {
      const distance = distances.get(node.id) || maxDistance;
      const spread = (index - (sorted.length - 1) / 2) * degToRad(distance === 1 ? 16 : 13);
      const degreePull = Math.min(38, graphDegree(node.id, visibleSet) * 2.2);
      const radius = baseRadius + radiusStep * Math.min(distance, 3) - degreePull;
      const direction = outgoingIds.has(node.id) ? 'outgoing' : incomingIds.has(node.id) ? 'incoming' : bothIds.has(node.id) ? 'both' : '';
      const directionalBase = direction === 'outgoing'
        ? 0
        : direction === 'incoming'
          ? Math.PI
          : direction === 'both'
            ? Math.PI / 2
            : angle;
      const nodeAngle = distance === 1
        ? directionalBase + spread
        : angle + spread + (distance - 1) * degToRad(6);
      state.layout.set(node.id, {
        x: clamp(centerX + Math.cos(nodeAngle) * radius, 34, width - 34),
        y: clamp(centerY + Math.sin(nodeAngle) * radius, 34, height - 34),
        radius: nodeRadius(node),
        ring: distance,
        centrality: graphDegree(node.id, visibleSet),
        cluster: cluster.key,
        direction
      });
    });
  });
}

function buildScatterLayout(selected, width, height) {
  const margin = {
    left: Math.max(74, width * 0.1),
    right: Math.max(46, width * 0.06),
    top: Math.max(48, height * 0.1),
    bottom: Math.max(70, height * 0.12)
  };
  const plotWidth = Math.max(220, width - margin.left - margin.right);
  const plotHeight = Math.max(180, height - margin.top - margin.bottom);
  const visibleIds = [...neighborhood(selected.id)].filter(id => state.nodeById.has(id));
  const visibleSet = new Set(visibleIds);
  const direct = directNeighborGroups(selected.id, visibleSet, state.perception.profile);
  const outgoingIds = new Set(direct.outgoing.map(node => node.id));
  const incomingIds = new Set(direct.incoming.map(node => node.id));
  const bothIds = new Set(direct.both.map(node => node.id));
  const distances = graphDistances(selected.id, visibleSet);
  const degrees = visibleIds.map(id => graphDegree(id, visibleSet));
  const minDegree = Math.min(...degrees);
  const maxDegree = Math.max(...degrees);
  const maxDistance = Math.max(1, ...visibleIds.map(id => distances.get(id) ?? 1));
  const lanes = new Map();

  visibleIds
    .map(id => state.nodeById.get(id))
    .filter(Boolean)
    .sort((a, b) => (distances.get(a.id) ?? 9) - (distances.get(b.id) ?? 9) || graphDegree(b.id, visibleSet) - graphDegree(a.id, visibleSet) || a.label.localeCompare(b.label))
    .forEach(node => {
      const degree = graphDegree(node.id, visibleSet);
      const distance = distances.get(node.id) ?? maxDistance;
      const degreeRatio = maxDegree === minDegree ? 0.5 : (degree - minDegree) / (maxDegree - minDegree);
      const distanceRatio = maxDistance <= 0 ? 0 : distance / maxDistance;
      const cluster = topologyClusterKey(node);
      const direction = outgoingIds.has(node.id) ? 'outgoing' : incomingIds.has(node.id) ? 'incoming' : bothIds.has(node.id) ? 'both' : '';
      const laneKey = `${distance}|${cluster}`;
      const laneIndex = lanes.get(laneKey) || 0;
      lanes.set(laneKey, laneIndex + 1);
      const jitter = scatterJitter(node.id, laneIndex);
      const directionBias = distance === 1
        ? direction === 'outgoing'
          ? plotWidth * 0.27
          : direction === 'incoming'
            ? -plotWidth * 0.27
            : 0
        : 0;
      const x = margin.left + plotWidth * degreeRatio + jitter.x + directionBias;
      const y = margin.top + plotHeight * distanceRatio + jitter.y;

      state.layout.set(node.id, {
        x: clamp(x, margin.left + 18, width - margin.right - 18),
        y: clamp(y, margin.top + 18, height - margin.bottom - 18),
        radius: nodeRadius(node, node.id === selected.id),
        ring: distance,
        distance,
        centrality: degree,
        cluster,
        direction
      });
    });
}

function scatterJitter(id, laneIndex) {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const side = laneIndex % 2 === 0 ? 1 : -1;
  const step = Math.ceil(laneIndex / 2);
  return {
    x: side * Math.min(34, step * 15 + (seed % 9) - 4),
    y: ((seed % 7) - 3) * 3
  };
}

function graphDistances(startId, allowedIds) {
  const distances = new Map([[startId, 0]]);
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    const nextDistance = (distances.get(id) || 0) + 1;
    [...outgoing(id), ...incoming(id)].forEach(edge => {
      if (!edgePassesCategoryFilter(edge)) return;
      const nextId = edge.source === id ? edge.target : edge.source;
      if (!allowedIds.has(nextId) || distances.has(nextId)) return;
      distances.set(nextId, nextDistance);
      queue.push(nextId);
    });
  }
  return distances;
}

function topologyClusters(ids, distances) {
  const byCluster = new Map();
  ids.forEach(id => {
    const node = state.nodeById.get(id);
    if (!node) return;
    const key = topologyClusterKey(node);
    if (!byCluster.has(key)) byCluster.set(key, []);
    byCluster.get(key).push(node);
  });
  return [...byCluster.entries()]
    .map(([key, nodes]) => ({ key, nodes }))
    .sort((a, b) => clusterScore(b, distances) - clusterScore(a, distances) || a.key.localeCompare(b.key));
}

function clusterScore(cluster, distances) {
  return cluster.nodes.reduce((sum, node) => sum + graphDegree(node.id) + (distances.get(node.id) === 1 ? 8 : 0), 0);
}

function topologyClusterKey(node) {
  if (!node) return 'context';
  if (node.family) return node.family;
  if (node.type === 'family') return node.id.replace('family-', '');
  if (node.type === 'emotion_word') return 'emotion';
  if (node.type === 'common_word') return 'common';
  if (node.type === 'neutral_word') return 'neutral';
  return node.type || 'context';
}

function graphDegree(id, allowedIds = null) {
  return state.edges.filter(edge => {
    if (edge.source !== id && edge.target !== id) return false;
    if (!edgePassesCategoryFilter(edge)) return false;
    if (!allowedIds) return true;
    const otherId = edge.source === id ? edge.target : edge.source;
    return allowedIds.has(otherId);
  }).length;
}

function graphTheoryStats(node) {
  const incomingCount = incoming(node.id).filter(edgePassesCategoryFilter).length;
  const outgoingCount = outgoing(node.id).filter(edgePassesCategoryFilter).length;
  const position = layoutPositionForNode(node.id);
  return {
    degree: incomingCount + outgoingCount,
    incoming: incomingCount,
    outgoing: outgoingCount,
    cluster: topologyClusterKey(node),
    distance: position?.distance ?? position?.ring ?? 0,
    centrality: position?.centrality ?? incomingCount + outgoingCount
  };
}

function currentPerceptionProfile() {
  const normalized = normalizeConceptTerm(state.query || '');
  const tokens = normalized ? uniqueStrings([normalized, ...tokenizeInput(normalized)].filter(Boolean)) : [];
  const personalSignal = personalInfluenceSignal(state.personProfile);
  const currentTranslation = state.currentTranslation && state.currentTranslation.input === normalized
    ? state.currentTranslation
    : null;
  const activeThemes = activeThemeFilters();
  const matchedThemes = normalized ? matchingCompositionThemes(normalized) : [];
  const themeRead = normalized ? themeCompositionForQuery(normalized) : null;
  const selectionClimate = normalized ? selectionClimateForQuery(normalized) : null;
  const focusNodeIds = new Set(state.selectedId ? [state.selectedId] : []);
  const queryMatchedNodeIds = new Set();
  const activeConditionIds = new Set();
  const activeFamilies = new Set();
  const exactLabels = new Set(tokens);
  const translationNodeIds = new Set();
  const translationPairs = new Set();
  const translationNodeStrengths = new Map();
  const translationPairStrengths = new Map();
  const personalNodeIds = new Set(personalSignal.nodeIds);
  const personalFamilies = new Set(personalSignal.families);
  const pinnedRouteKeys = new Set(state.pinnedRouteKeys || []);
  const pinnedNodeIds = new Set();

  const addFamily = family => {
    if (family) activeFamilies.add(family);
  };
  const addConditionNode = id => {
    if (id && state.nodeById.has(id)) activeConditionIds.add(id);
  };
  const registerThemeCondition = theme => {
    if (!theme) return;
    addConditionNode(`condition-theme-filter-${slugify(theme.id || theme.label)}`);
    addConditionNode(`condition-theme-category-${slugify(themeCategoryByLabel(theme.category)?.id || theme.category)}`);
    uniqueStrings((theme.anchorIds || anchorsForCategory(theme.category)).map(anchorIdToFamily).filter(Boolean)).forEach(addFamily);
  };

  activeThemes.forEach(registerThemeCondition);
  matchedThemes.forEach(registerThemeCondition);
  uniqueStrings((themeRead?.anchorIds || []).map(anchorIdToFamily).filter(Boolean)).forEach(addFamily);

  (selectionClimate?.matchedSelections || []).forEach(entry => {
    uniqueStrings((entry.anchorIds || []).map(anchorIdToFamily).filter(Boolean)).forEach(addFamily);
  });

  state.nodes.forEach(node => {
    if (!nodePassesCategoryFilter(node)) return;
    const text = searchText(node);
    const exact = exactLabels.has(normalizeConceptTerm(node.label));
    const tokenMatch = tokens.some(term => term.length > 1 && text.includes(term));
    if (!exact && !tokenMatch) return;
    queryMatchedNodeIds.add(node.id);
    focusNodeIds.add(node.id);
    addFamily(node.family || nodeColorKey(node));
    if (node.type === 'theme_condition') activeConditionIds.add(node.id);
  });

  (currentTranslation?.allPaths || currentTranslation?.paths || []).slice(0, 6).forEach(path => {
    const bucket = pathRouteHealth(path);
    (path.nodeIds || []).forEach(nodeId => {
      if (!state.nodeById.has(nodeId)) return;
      translationNodeIds.add(nodeId);
      focusNodeIds.add(nodeId);
      const node = state.nodeById.get(nodeId);
      addFamily(node?.family || nodeColorKey(node));
      const currentBucket = translationNodeStrengths.get(nodeId) || 'weak';
      translationNodeStrengths.set(nodeId, strongerRouteBucket(currentBucket, bucket));
    });
    for (let index = 0; index < (path.nodeIds || []).length - 1; index += 1) {
      const a = path.nodeIds[index];
      const b = path.nodeIds[index + 1];
      if (a && b) {
        const key = nodePairKey(a, b);
        translationPairs.add(key);
        const currentBucket = translationPairStrengths.get(key) || 'weak';
        translationPairStrengths.set(key, strongerRouteBucket(currentBucket, bucket));
      }
    }
  });

  if (state.ecosystemMode && (tokens.length || activeThemes.length || matchedThemes.length)) {
    ['ecosystem-conditions', 'ecosystem-weather', 'ecosystem-evergreen', 'ecosystem-experience'].forEach(addConditionNode);
  }

  state.edges.forEach(edge => {
    if (!pinnedRouteKeys.has(edgeRouteKey(edge))) return;
    pinnedNodeIds.add(edge.source);
    pinnedNodeIds.add(edge.target);
    focusNodeIds.add(edge.source);
    focusNodeIds.add(edge.target);
  });

  personalFamilies.forEach(addFamily);
  personalNodeIds.forEach(nodeId => focusNodeIds.add(nodeId));
  pinnedNodeIds.forEach(nodeId => focusNodeIds.add(nodeId));
  if (personalSignal.month) {
    addConditionNode('condition-theme-category-season');
    if (state.ecosystemMode) addConditionNode('ecosystem-weather');
  }

  [...activeFamilies].forEach(family => {
    addConditionNode(`environment-${family}`);
    if (state.nodeById.has(`family-${family}`)) focusNodeIds.add(`family-${family}`);
  });

  return {
    normalized,
    tokens,
    activeThemes,
    matchedThemes,
    themeRead,
    selectionClimate,
    focusNodeIds,
    queryMatchedNodeIds,
    activeConditionIds,
    activeFamilies,
    translationNodeIds,
    translationPairs,
    translationNodeStrengths,
    translationPairStrengths,
    personalNodeIds,
    personalFamilies,
    personalSignal,
    pinnedRouteKeys,
    pinnedNodeIds
  };
}

function edgeRouteKey(edge) {
  if (!edge) return '';
  return String(edge.id || `${edge.source}::${edge.target}::${edge.type || 'route'}`);
}

function nodePairKey(a, b) {
  return [a, b].sort().join('::');
}

function toggleRoutePin(routeKey) {
  if (!routeKey) return;
  const next = new Set(state.pinnedRouteKeys || []);
  if (next.has(routeKey)) next.delete(routeKey);
  else next.add(routeKey);
  state.pinnedRouteKeys = next;
  savePinnedRouteKeys();
  render();
}

function historyLaneActive(lane, profile = state.perception?.profile || currentPerceptionProfile()) {
  const activeNames = uniqueStrings([
    ...activeThemeFilters().map(theme => theme.label.toLowerCase()),
    ...activeThemeFilters().map(theme => theme.category.toLowerCase()),
    ...(profile.activeThemes || []).map(theme => (theme.label || '').toLowerCase()),
    ...(profile.activeThemes || []).map(theme => (theme.category || '').toLowerCase()),
    ...(profile.matchedThemes || []).map(theme => (theme.label || '').toLowerCase()),
    ...(profile.matchedThemes || []).map(theme => (theme.category || '').toLowerCase())
  ]);
  return activeNames.includes(String(lane || '').toLowerCase());
}

function historyEntryNodeScore(entry, node) {
  if (!entry || !node) return 0;
  const normalizedLabel = normalizeConceptTerm(node.label || '');
  const family = node.family || nodeColorKey(node);
  let score = 0;
  if ((entry.routeSeeds || []).some(seed => normalizeConceptTerm(seed) === normalizedLabel)) score += 3;
  if ((entry.relatedEntries || []).some(seed => normalizeConceptTerm(seed) === normalizedLabel)) score += 1;
  if ((entry.anchorHints || []).some(seed => normalizeConceptTerm(seed) === normalizeConceptTerm(family || ''))) score += 2;
  if (normalizeConceptTerm(entry.label || '').includes(normalizedLabel) || normalizedLabel.includes(normalizeConceptTerm(entry.label || ''))) score += 1;
  return score;
}

function historyContextEntriesForNode(node, profile = state.perception?.profile || currentPerceptionProfile(), limit = 4) {
  const selectedHistory = historyEntryById();
  return allHistoryIndexEntries()
    .map(entry => {
      let score = historyEntryNodeScore(entry, node);
      const laneActive = historyLaneActive(entry.lane, profile);
      if (laneActive) score += 2;
      if (selectedHistory?.id === entry.id) score += 3;
      if ((entry.themeConditions || []).some(condition => historyLaneActive(condition, profile))) score += 1;
      return { entry, score, laneActive };
    })
    .filter(item => item.score > 0 && (item.laneActive || selectedHistory?.id === item.entry.id))
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
    .slice(0, limit);
}

function edgeActivationSources(edge, profile = state.perception?.profile || currentPerceptionProfile()) {
  const sourceNode = state.nodeById.get(edge.source);
  const targetNode = state.nodeById.get(edge.target);
  if (!sourceNode || !targetNode) return [];
  const key = nodePairKey(edge.source, edge.target);
  const sourceFamily = sourceNode.family || nodeColorKey(sourceNode);
  const targetFamily = targetNode.family || nodeColorKey(targetNode);
  const touchesCondition = profile.activeConditionIds.has(edge.source) || profile.activeConditionIds.has(edge.target);
  const touchesQuery = profile.queryMatchedNodeIds.has(edge.source) || profile.queryMatchedNodeIds.has(edge.target);
  const touchesActiveFamily = profile.activeFamilies.has(sourceFamily) || profile.activeFamilies.has(targetFamily);
  const touchesPersonal = profile.personalNodeIds?.has(edge.source)
    || profile.personalNodeIds?.has(edge.target)
    || profile.personalFamilies?.has(sourceFamily)
    || profile.personalFamilies?.has(targetFamily);
  const atlasInfluenced = !!atlasInfluenceForNode(sourceNode) || !!atlasInfluenceForNode(targetNode);
  const historyInfluence = historyContextEntriesForNode(sourceNode, profile, 2).length || historyContextEntriesForNode(targetNode, profile, 2).length;
  const sources = [];

  if (profile.pinnedRouteKeys?.has(edgeRouteKey(edge))) sources.push('manual pin');
  if (profile.translationPairs?.has(key)) sources.push('search');
  else if (touchesQuery) sources.push('search context');
  if ((profile.activeThemes?.length || profile.matchedThemes?.length) && (touchesCondition || touchesActiveFamily)) sources.push('theme condition');
  if (profile.selectionClimate && (touchesQuery || touchesActiveFamily)) sources.push('selection climate');
  if (touchesCondition) sources.push('environment condition');
  if (touchesPersonal) sources.push('personal influence');
  if (atlasInfluenced) sources.push('atlas influence');
  if (historyInfluence) sources.push('history index');

  return uniqueStrings(sources);
}

function edgeRuntimeActivation(edge, profile = state.perception?.profile || currentPerceptionProfile(), visibleNodeIds = null) {
  const key = nodePairKey(edge.source, edge.target);
  const routeKey = edgeRouteKey(edge);
  const score = edge.__perceptionScore ?? edgePerceptionScore(edge, profile, visibleNodeIds);
  const sources = edgeActivationSources(edge, profile);
  const isPinned = profile.pinnedRouteKeys?.has(routeKey) || false;
  const onTranslationRoute = profile.translationPairs?.has(key) || false;
  const touchesSelected = edge.source === state.selectedId || edge.target === state.selectedId;
  const nonPinSources = sources.filter(source => source !== 'manual pin');
  let stateName = 'stored';

  if (isPinned || onTranslationRoute || (touchesSelected && nonPinSources.length >= 2 && score >= 0.42) || (nonPinSources.length >= 3 && score >= 0.6)) {
    stateName = 'active';
  } else if (nonPinSources.length) {
    stateName = 'context_selected';
  }

  return {
    state: stateName,
    activationSources: sources,
    activationWeight: clamp(score + (isPinned ? 0.18 : 0) + (onTranslationRoute ? 0.08 : 0), 0.08, 1),
    isPinned,
    activationReason: stateName === 'stored'
      ? null
      : `${stateName === 'active' ? 'Active because' : 'Context-selected because'}: ${sources.join(' + ')}`
  };
}

function decorateRuntimeEdge(edge, profile = state.perception?.profile || currentPerceptionProfile(), visibleNodeIds = null) {
  const score = edge.__perceptionScore ?? edgePerceptionScore(edge, profile, visibleNodeIds);
  const activation = edgeRuntimeActivation(edge, profile, visibleNodeIds);
  return {
    ...edge,
    __perceptionScore: score,
    __routeState: activation.state,
    __activationReason: activation.activationReason,
    __activationSources: activation.activationSources,
    __activationWeight: activation.activationWeight,
    __isPinned: activation.isPinned
  };
}

function nodeRouteBucket(nodeId, profile = state.perception?.profile || currentPerceptionProfile()) {
  if (!profile.translationNodeStrengths?.size) return null;
  return profile.translationNodeStrengths.get(nodeId) || 'weak';
}

function edgeRouteBucket(edge, profile = state.perception?.profile || currentPerceptionProfile()) {
  if (!profile.translationPairStrengths?.size) return null;
  return profile.translationPairStrengths.get(nodePairKey(edge.source, edge.target)) || 'weak';
}

function nodePerceptionScore(node, profile = state.perception?.profile || currentPerceptionProfile()) {
  if (!node) return 0;
  if (node.id === state.selectedId) return 1;
  let score = 0.08;
  const family = node.family || nodeColorKey(node);
  const directToSelected = outgoing(state.selectedId).some(edge => edge.target === node.id) || incoming(state.selectedId).some(edge => edge.source === node.id);

  if (profile.focusNodeIds.has(node.id)) score += 0.44;
  if (profile.queryMatchedNodeIds.has(node.id)) score += 0.2;
  if (profile.translationNodeIds?.has(node.id)) score += 0.24;
  if (profile.personalNodeIds?.has(node.id)) score += 0.26;
  if (profile.pinnedNodeIds?.has(node.id)) score += 0.24;
  if (profile.activeConditionIds.has(node.id)) score += 0.34;
  if (profile.activeFamilies.has(family)) score += 0.24;
  if (profile.personalFamilies?.has(family)) score += 0.18;
  if (directToSelected) score += 0.18;
  if (node.metadata?.ecosystem && (profile.tokens.length || profile.activeConditionIds.size)) score += 0.12;
  if (node.type === 'theme_condition') score += 0.08;
  if (node.type === 'environment_condition' && profile.activeFamilies.has(family)) score += 0.12;
  if (node.type === 'family' && profile.activeFamilies.has(node.id.replace('family-', ''))) score += 0.18;

  return clamp(score, 0.08, 1);
}

function edgePerceptionScore(edge, profile = state.perception?.profile || currentPerceptionProfile(), visibleNodeIds = null) {
  const sourceNode = state.nodeById.get(edge.source);
  const targetNode = state.nodeById.get(edge.target);
  if (!sourceNode || !targetNode) return 0;
  if (visibleNodeIds && (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target))) return 0;
  let score = 0.08;
  const sourceFamily = sourceNode.family || nodeColorKey(sourceNode);
  const targetFamily = targetNode.family || nodeColorKey(targetNode);
  const sourceScore = nodePerceptionScore(sourceNode, profile);
  const targetScore = nodePerceptionScore(targetNode, profile);
  const touchesSelected = edge.source === state.selectedId || edge.target === state.selectedId;
  const touchesCondition = profile.activeConditionIds.has(edge.source) || profile.activeConditionIds.has(edge.target);
  const touchesQuery = profile.queryMatchedNodeIds.has(edge.source) || profile.queryMatchedNodeIds.has(edge.target);
  const touchesTranslationRoute = profile.translationPairs?.has(nodePairKey(edge.source, edge.target));
  const touchesActiveFamily = profile.activeFamilies.has(sourceFamily) || profile.activeFamilies.has(targetFamily);
  const touchesPersonal = profile.personalNodeIds?.has(edge.source) || profile.personalNodeIds?.has(edge.target) || profile.personalFamilies?.has(sourceFamily) || profile.personalFamilies?.has(targetFamily);
  const isPinned = profile.pinnedRouteKeys?.has(edgeRouteKey(edge));
  const isConditionEdge = ['environment_condition', 'condition_has_synonym', 'contains condition', 'currently filters', 'belongs to condition', 'weights color climate', 'conditions growth'].includes(edge.type);

  if (touchesSelected) score += 0.36;
  if (touchesCondition) score += 0.24;
  if (touchesQuery) score += 0.18;
  if (touchesTranslationRoute) score += 0.26;
  if (touchesActiveFamily) score += 0.14;
  if (touchesPersonal) score += 0.14;
  if (isPinned) score += 0.28;
  if (isConditionEdge) score += 0.14;
  if (edge.type === 'emotion_association' || edge.type === 'associated_color') score += 0.08;
  if (sourceScore > 0.42 && targetScore > 0.42) score += 0.18;

  return clamp(score, 0.08, 1);
}

function sortNodesForLayout(a, b) {
  const rank = { family: 0, ecosystem_foundation: 1, theme_condition: 2, ecosystem_signal: 3, ecosystem_weather: 4, environment_condition: 5, environment_term: 6, subfamily: 7, shade: 8, alias: 9, synonym: 10, emotion_word: 11, common_word: 12, neutral_word: 13 };
  return (rank[a.type] ?? 9) - (rank[b.type] ?? 9) || a.label.localeCompare(b.label);
}

function nodeRadius(node, selected = false) {
  if (selected) return 34;
  if (state.graphMode === 'topology' || state.graphMode === 'scatter' || state.graphMode === '3d') {
    const degreeBoost = Math.min(10, graphDegree(node.id) * 0.45);
    if (node.type === 'family') return 28 + degreeBoost;
    if (node.type === 'ecosystem_foundation') return 25 + degreeBoost;
    if (node.type === 'theme_condition') return 20 + degreeBoost;
    if (node.type === 'ecosystem_signal') return 18 + degreeBoost;
    if (node.type === 'ecosystem_weather') return 16 + degreeBoost;
    if (node.type === 'environment_condition') return 20 + degreeBoost;
    if (node.type === 'environment_term') return 15 + degreeBoost;
    if (node.type === 'subfamily') return 22 + degreeBoost;
    if (node.type === 'shade') return 17 + degreeBoost;
    if (node.type === 'alias') return 18 + degreeBoost;
    if (node.type === 'emotion_word') return 17 + degreeBoost;
    if (node.type === 'synonym') return 14 + degreeBoost;
    return 13 + degreeBoost;
  }
  if (node.type === 'family') return 32;
  if (node.type === 'ecosystem_foundation') return 27;
  if (node.type === 'theme_condition') return 21;
  if (node.type === 'ecosystem_signal') return 19;
  if (node.type === 'ecosystem_weather') return 17;
  if (node.type === 'environment_condition') return 22;
  if (node.type === 'environment_term') return 16;
  if (node.type === 'subfamily') return 24;
  if (node.type === 'shade') return 18;
  if (node.type === 'alias') return 20;
  if (node.type === 'emotion_word') return 18;
  if (node.type === 'synonym') return 15;
  return 14;
}

function nextGraphMode(mode) {
  const modes = ['ring', 'topology', 'scatter', '3d'];
  return modes[(modes.indexOf(mode) + 1) % modes.length] || 'ring';
}

function initialGraphModeFromUrl() {
  const mode = new URLSearchParams(window.location.search).get('graphMode');
  return ['ring', 'topology', 'scatter', '3d'].includes(mode) ? mode : state.graphMode;
}

function initialAxisViewFromUrl() {
  const view = new URLSearchParams(window.location.search).get('axisView');
  return ['free', 'x', 'y', 'z'].includes(view) ? view : state.three.axisView;
}

function initialViewFromUrl() {
  const view = new URLSearchParams(window.location.search).get('view');
  const supported = new Set([...els.tabs].map(tab => tab.dataset.view));
  return supported.has(view) ? view : state.view;
}

function applyEnvironmentConditionGraph(graph) {
  if (!graph || graph.environmentConditionsApplied) return;
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const nodeIds = new Set(nodes.map(node => node.id));
  const edgeIds = new Set(edges.map(edge => edge.id || `${edge.source}->${edge.target}:${edge.type}`));

  const addNode = node => {
    if (nodeIds.has(node.id)) return;
    nodes.push(node);
    nodeIds.add(node.id);
  };
  const addEdge = edge => {
    const id = edge.id || `${edge.source}->${edge.target}:${edge.type}`;
    if (edgeIds.has(id)) return;
    edges.push({ id, ...edge });
    edgeIds.add(id);
  };

  Object.entries(ENVIRONMENT_CONDITIONS).forEach(([family, condition]) => {
    const familyId = `family-${family}`;
    if (!nodeIds.has(familyId)) return;
    const conditionId = `environment-${family}`;
    addNode({
      id: conditionId,
      label: condition.condition,
      type: 'environment_condition',
      family,
      metadata: {
        definitionBasis: 'environment condition',
        contextDefinition: condition.climate,
        condition: condition.condition,
        axes: condition.axes,
        emotionalUse: condition.emotionalUse,
        boundary: 'Condition context, not strict color synonym.'
      }
    });
    addEdge({
      source: familyId,
      target: conditionId,
      type: 'environment_condition',
      evidence: `${family} behaves as ${condition.condition} in the environment-condition layer.`
    });

    conditionTerms(condition.condition)
      .slice(0, 8)
      .forEach(term => {
        const termId = `environment-term-${slugify(term)}`;
        addNode({
          id: termId,
          label: term,
          type: 'environment_term',
          family,
          metadata: {
            definitionBasis: 'condition synonym',
            contextDefinition: `${term} is condition language connected to ${family}: ${condition.condition}.`,
            boundary: 'Condition synonym, not strict dictionary color synonym.'
          }
        });
        addEdge({
          source: conditionId,
          target: termId,
          type: 'condition_has_synonym',
          evidence: `${term} is part of the ${family} environment condition.`
        });
      });
  });

  graph.environmentConditionsApplied = true;
}

function conditionTerms(condition) {
  return uniqueStrings(
    String(condition || '')
      .split('/')
      .map(term => term.trim().toLowerCase())
      .filter(Boolean)
  );
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function rebuildActiveGraph() {
  const nodes = [...(state.baseNodes || [])];
  const edges = [...(state.baseEdges || [])];

  const foundation = ecosystemFoundationGraph();
  const nodeIds = new Set(nodes.map(node => node.id));
  foundation.nodes.forEach(node => {
    if (nodeIds.has(node.id)) return;
    nodes.push(node);
    nodeIds.add(node.id);
  });

  const edgeIds = new Set(edges.map(edge => edge.id || `${edge.source}->${edge.target}:${edge.type}`));
  foundation.edges.forEach(edge => {
    const id = edge.id || `${edge.source}->${edge.target}:${edge.type}`;
    if (edgeIds.has(id)) return;
    edges.push({ id, ...edge });
    edgeIds.add(id);
  });

  state.nodes = nodes.map(node => ({ ...node, metadata: node.metadata && typeof node.metadata === 'object' ? { ...node.metadata } : {} }));
  state.edges = edges;
  state.nodeById = new Map(state.nodes.map(node => [node.id, node]));
  if (!state.nodeById.has(state.selectedId)) state.selectedId = firstFilteredNodeId() || 'family-green';
}

function ecosystemFoundationGraph() {
  const nodes = [
    ecosystemFoundationNode('ecosystem-experience', 'Experience', 'white', 'Raw contact before the system translates it.'),
    ecosystemFoundationNode('ecosystem-conditions', 'Condition field', 'gray', 'The environmental field that shapes how experience becomes readable.'),
    ecosystemFoundationNode('ecosystem-emotion', 'Emotion', 'pink', 'Feeling after experience passes through conditions.'),
    ecosystemFoundationNode('ecosystem-adaptation', 'Adaptation', 'green', 'The response that adjusts to changing conditions.'),
    ecosystemFoundationNode('ecosystem-behavior', 'Behavior', 'orange', 'The visible action pattern produced by adaptation.'),
    ecosystemFoundationNode('ecosystem-language', 'Language', 'blue', 'The translation layer that names and organizes behavior into signal.'),
    ecosystemFoundationNode('ecosystem-pattern', 'Pattern', 'green', 'Repeated language and behavior becoming structure.'),
    ecosystemFoundationNode('ecosystem-identity-tendency', 'Identity tendency', 'purple', 'A recurring tendency, not a permanent essence.'),
    ecosystemFoundationNode('ecosystem-bedrock', 'Bedrock foundation', 'purple', 'Things that rarely change: experience, emotion, adaptation, behavior, language, pattern, and identity.'),
    ecosystemFoundationNode('ecosystem-evergreen', 'Evergreen growth', 'green', 'Things that grow through review: new associations, shade relationships, themes, and recurring patterns.'),
    ecosystemFoundationNode('ecosystem-weather', 'Weather condition', 'gray', 'Things that change constantly: current mood, current interests, and current emotional climate.'),
    ecosystemFoundationNode('condition-light', 'Light condition', 'yellow', 'Visibility, exposure, reflection, and readable signal.'),
    ecosystemFoundationNode('condition-water', 'Water condition', 'blue', 'Flow, depth, permeability, carrying, and emotional movement.'),
    ecosystemFoundationNode('condition-soil', 'Soil condition', 'brown', 'Ground, memory, nutrient, constraint, and what growth can root into.'),
    ecosystemFoundationNode('condition-temperature', 'Temperature condition', 'orange', 'Activation, pressure, warmth, cooling, and energetic rate of change.')
  ];
  const edges = [
    ecosystemEdge('ecosystem-flow-experience-conditions', 'ecosystem-experience', 'ecosystem-conditions', 'passes through', 'Experience becomes readable only after conditions shape it.'),
    ecosystemEdge('ecosystem-flow-conditions-emotion', 'ecosystem-conditions', 'ecosystem-emotion', 'shapes', 'Conditions change which emotions strengthen, soften, or become visible.'),
    ecosystemEdge('ecosystem-flow-emotion-adaptation', 'ecosystem-emotion', 'ecosystem-adaptation', 'presses into', 'Emotion creates adaptive response rather than fixed identity.'),
    ecosystemEdge('ecosystem-flow-adaptation-behavior', 'ecosystem-adaptation', 'ecosystem-behavior', 'expresses as', 'Adaptation becomes visible through behavior.'),
    ecosystemEdge('ecosystem-flow-behavior-language', 'ecosystem-behavior', 'ecosystem-language', 'is translated by', 'Behavior becomes communicable through language.'),
    ecosystemEdge('ecosystem-flow-language-pattern', 'ecosystem-language', 'ecosystem-pattern', 'repeats into', 'Repeated language forms pattern.'),
    ecosystemEdge('ecosystem-flow-pattern-identity', 'ecosystem-pattern', 'ecosystem-identity-tendency', 'may stabilize as', 'Repeated pattern can suggest identity tendency without becoming permanent essence.'),
    ecosystemEdge('ecosystem-light-conditions', 'condition-light', 'ecosystem-conditions', 'creates condition', 'Light changes visibility and exposure.'),
    ecosystemEdge('ecosystem-water-conditions', 'condition-water', 'ecosystem-conditions', 'creates condition', 'Water changes flow, depth, and permeability.'),
    ecosystemEdge('ecosystem-soil-conditions', 'condition-soil', 'ecosystem-conditions', 'creates condition', 'Soil changes rooting, memory, and growth support.'),
    ecosystemEdge('ecosystem-temperature-conditions', 'condition-temperature', 'ecosystem-conditions', 'creates condition', 'Temperature changes activation, pressure, and growth rate.'),
    ecosystemEdge('ecosystem-bedrock-purple', 'family-purple', 'ecosystem-bedrock', 'anchors', 'Bedrock holds the slower symbolic foundation.'),
    ecosystemEdge('ecosystem-evergreen-green', 'family-green', 'ecosystem-evergreen', 'regulates', 'Evergreen growth keeps adaptation tied to living balance.'),
    ecosystemEdge('ecosystem-weather-gray', 'family-gray', 'ecosystem-weather', 'changes through', 'Weather keeps fast-changing context visible without rewriting the graph.'),
    ecosystemEdge('ecosystem-conditions-weather', 'ecosystem-conditions', 'ecosystem-weather', 'contains fast conditions', 'Weather is a fast condition inside the larger condition field.'),
    ecosystemEdge('ecosystem-conditions-evergreen', 'ecosystem-conditions', 'ecosystem-evergreen', 'shapes growth', 'Conditions determine which repeated patterns can keep growing.'),
    ecosystemEdge('ecosystem-weather-evergreen', 'ecosystem-weather', 'ecosystem-evergreen', 'may become', 'Repeated weather can become evergreen only after pattern evidence appears.'),
    ecosystemEdge('ecosystem-evergreen-bedrock', 'ecosystem-evergreen', 'ecosystem-bedrock', 'must respect', 'Growth adds depth without silently rewriting truth.')
  ];

  const evergreen = evergreenSignalGraph();
  const weather = state.ecosystemMode ? weatherQueryGraph() : { nodes: [], edges: [] };
  const conditions = themeConditionGraph();
  conditions.nodes.forEach(node => nodes.push(node));
  conditions.edges.forEach(edge => edges.push(edge));
  evergreen.nodes.forEach(node => nodes.push(node));
  evergreen.edges.forEach(edge => edges.push(edge));
  weather.nodes.forEach(node => nodes.push(node));
  weather.edges.forEach(edge => edges.push(edge));

  return { nodes, edges };
}

function ecosystemFoundationNode(id, label, family, description) {
  return {
    id,
    label,
    type: 'ecosystem_foundation',
    family,
    metadata: {
      hex: familyColor(family),
      ecosystem: true,
      reviewStatus: id.endsWith('bedrock') ? 'stable' : id.endsWith('evergreen') ? 'emerging-review' : 'temporary',
      description,
      boundary: 'Condition-field foundation, not a strict color synonym.'
    }
  };
}

function themeConditionGraph() {
  const nodes = [];
  const edges = [];
  const activeIds = new Set(state.activeThemeFilterIds);
  const categories = state.data.themeComposition?.categories || [];
  const themes = allCompositionThemes();
  categories.forEach(category => {
    const anchors = anchorsForCategory(category.label);
    const family = anchorIdToFamily(anchors[0]) || anchors[0] || 'gray';
    const id = `condition-theme-category-${slugify(category.id || category.label)}`;
    nodes.push({
      id,
      label: `${category.label} condition`,
      type: 'theme_condition',
      family,
      metadata: {
        hex: familyColor(family),
        ecosystem: true,
        conditionType: 'theme-category',
        description: category.role || 'Theme condition acting on meaning.',
        boundary: 'Theme condition, not a strict synonym.'
      }
    });
    edges.push(ecosystemEdge(`${id}-evergreen`, 'ecosystem-evergreen', id, 'conditions growth', `${category.label} shapes how new patterns become readable.`));
    edges.push(ecosystemEdge(`${id}-condition-field`, 'ecosystem-conditions', id, 'contains condition', `${category.label} is a condition field that can shape connected words.`));
    uniqueStrings(anchors.map(anchorIdToFamily).filter(Boolean)).forEach(item => {
      const target = `family-${item}`;
      if (state.baseNodes.some(node => node.id === target)) {
        edges.push(ecosystemEdge(`${id}-${target}`, id, target, 'conditions color climate', `${category.label} can shift words through the ${item} climate.`));
      }
    });
  });

  themes
    .filter(theme => activeIds.has(theme.id))
    .forEach(theme => {
      const anchors = theme.anchorIds || anchorsForCategory(theme.category);
      const family = anchorIdToFamily(anchors[0]) || anchors[0] || 'gray';
      const id = `condition-theme-filter-${slugify(theme.id || theme.label)}`;
      const categoryId = `condition-theme-category-${slugify(themeCategoryByLabel(theme.category)?.id || theme.category)}`;
      nodes.push({
        id,
        label: `${theme.label} filter condition`,
        type: 'theme_condition',
        family,
        metadata: {
          hex: familyColor(family),
          ecosystem: true,
          conditionType: 'active-filter',
          description: theme.emotionalLogic || themeTermForTheme(theme) || 'Active theme filter acting as a condition.',
          boundary: 'Active filter as condition, not a strict synonym.'
        }
      });
      edges.push(ecosystemEdge(`${id}-weather`, 'ecosystem-weather', id, 'currently filters', `${theme.label} changes how connected words are read right now.`));
      if (nodes.some(node => node.id === categoryId)) {
        edges.push(ecosystemEdge(`${id}-category`, id, categoryId, 'belongs to condition', `${theme.label} is a condition inside ${theme.category}.`));
      }
      uniqueStrings(anchors.map(anchorIdToFamily).filter(Boolean)).forEach(item => {
        const target = `family-${item}`;
        if (state.baseNodes.some(node => node.id === target)) {
          edges.push(ecosystemEdge(`${id}-${target}`, id, target, 'weights color climate', `${theme.label} makes the ${item} climate more active for connected words.`));
        }
      });
      conditionReactionTargets(theme, anchors).forEach(target => {
        edges.push(ecosystemEdge(`${id}-${target.id}`, id, target.id, target.type, target.evidence));
      });
    });

  return { nodes, edges };
}

function conditionReactionTargets(theme, anchors = []) {
  const cueTerms = uniqueStrings([
    theme.label,
    theme.category,
    ...(theme.cues || []),
    ...(theme.bridgeTags || []),
    ...(theme.components || [])
  ].map(normalizeConceptTerm).filter(term => term && term.length > 2));
  const families = uniqueStrings(anchors.map(anchorIdToFamily).filter(Boolean));
  const targets = [];

  state.baseNodes.forEach(node => {
    if (!node || node.type === 'family') return;
    const text = searchText(node);
    const cueMatch = cueTerms.some(term => text.includes(term));
    const familyMatch = families.length && families.includes(node.family);
    if (!cueMatch && !familyMatch) return;
    targets.push({
      id: node.id,
      type: cueMatch ? 'strengthens connection' : 'weights nearby climate',
      evidence: cueMatch
        ? `${theme.label} condition makes ${node.label} more visible because the cue appears in its graph text.`
        : `${theme.label} condition gives ${node.label} more weight through the ${node.family} climate.`
    });
  });

  return targets.slice(0, 10);
}

function evergreenSignalGraph() {
  const analysis = surveyPatternAnalysis(state.surveyPatternText);
  const nodes = [];
  const edges = [];
  (analysis.evergreenSignals || []).forEach(signal => {
    const id = `ecosystem-signal-${slugify(signal.key)}`;
    const families = uniqueStrings((signal.anchorIds || []).map(anchorIdToFamily).filter(Boolean));
    const family = families[0] || 'green';
    nodes.push({
      id,
      label: signal.label,
      type: 'ecosystem_signal',
      family,
      metadata: {
        hex: familyColor(family),
        ecosystem: true,
        reviewStatus: 'emerging',
        count: signal.count,
        strength: signal.strength,
        signalType: signal.type,
        emotionalLogic: signal.emotionalLogic,
        boundary: signal.boundary || 'Emerging local pattern, not universal truth.'
      }
    });
    edges.push(ecosystemEdge(`${id}-evergreen`, 'ecosystem-evergreen', id, 'grows into', signal.emotionalLogic));
    const conditionId = themeConditionIdForSignal(signal);
    if (conditionId) {
      edges.push(ecosystemEdge(`${id}-condition`, id, conditionId, 'affects condition', `${signal.label} can shift the ${signal.categoryLabel} condition when the pattern repeats.`));
    }
    families.forEach(item => {
      const target = `family-${item}`;
      if (!state.baseNodes.some(node => node.id === target)) return;
      edges.push(ecosystemEdge(`${id}-${target}`, id, target, 'affects connected color', `${signal.label} repeats near the ${item} family, so nearby words can shift through that color climate.`));
    });
  });
  return { nodes, edges };
}

function themeConditionIdForSignal(signal) {
  const byId = themeCategoryById().get(signal.categoryId);
  const byLabel = themeCategoryByLabel(signal.categoryLabel);
  const category = byId || byLabel;
  return category ? `condition-theme-category-${slugify(category.id || category.label)}` : '';
}

function weatherQueryGraph() {
  const term = normalizeConceptTerm(state.query);
  if (!term) return { nodes: [], edges: [] };
  const families = uniqueStrings(suggestedFamiliesForTerm(term).filter(familyColorExists));
  const family = families[0] || 'gray';
  const id = `ecosystem-weather-${slugify(term)}`;
  const nodes = [{
    id,
    label: titleCase(term),
    type: 'ecosystem_weather',
    family,
    metadata: {
      hex: familyColor(family),
      ecosystem: true,
      reviewStatus: 'temporary',
      description: 'Current search context. It can suggest a route, but it does not become graph truth by itself.',
      boundary: 'Weather context changes constantly and must be repeated or reviewed before becoming evergreen.'
    }
  }];
  const edges = [ecosystemEdge(`${id}-weather`, 'ecosystem-weather', id, 'currently frames', 'The current search is weather: useful context, not permanent structure.')];
  families.forEach(item => {
    const target = `family-${item}`;
    if (!state.baseNodes.some(node => node.id === target)) return;
    edges.push(ecosystemEdge(`${id}-${target}`, id, target, 'leans toward', `Current context leans toward ${item}.`));
  });
  return { nodes, edges };
}

function ecosystemEdge(id, source, target, type, evidence) {
  return {
    id,
    source,
    target,
    type,
    evidence,
    confidence: 'local',
    metadata: {
      ecosystem: true,
      boundary: 'Display overlay only; baseline graph remains unchanged.'
    }
  };
}

function anchorIdToFamily(anchorId) {
  const map = {
    obsidian: 'black',
    ember: 'red',
    rose: 'pink',
    midnight: 'blue',
    green: 'green',
    silver: 'gray',
    earth: 'brown'
  };
  return map[anchorId] || (familyColorExists(anchorId) ? anchorId : null);
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function render() {
  renderDataSourceStatus();
  renderAuthPanel();
  renderTabs();
  renderCategoryButtons();
  renderLayerToggleButtons();
  renderRouteHealthButtons();
  renderSchemaPackSelect();
  renderGraphModeButton();
  renderZoomButtons();
  renderAxisViewButton();
  renderStats();
  renderContextPanel();
  renderList();
  buildLayout();
  renderDetail();
  drawGraph();
}

async function loadAuthState() {
  try {
    const status = await fetch(`${API_BASE_URL}/v1/auth/status`, { cache: 'no-store' }).then(response => response.json());
    state.auth.configured = Boolean(status.configured);
    if (state.auth.token) {
      const response = await fetch(`${API_BASE_URL}/v1/auth/me`, { headers: authHeaders() });
      if (response.ok) state.auth.user = (await response.json()).user;
      else clearAuthSession();
    }
  } catch {
    state.auth.configured = false;
  } finally {
    state.auth.checked = true;
  }
}

function renderAuthPanel() {
  if (!els.authStatus) return;
  const user = state.auth.user;
  els.authStatus.textContent = user
    ? `${user.username} · ${user.role}`
    : state.auth.configured
      ? 'Sign in to edit the shared graph'
      : 'Create the first administrator account';
  els.authForm.hidden = Boolean(user);
  els.authLogout.hidden = !user;
  if (els.authCreate) {
    els.authCreate.hidden = state.auth.configured;
    els.authCreate.textContent = 'Set up admin';
  }
  if (els.authSignIn) els.authSignIn.hidden = !state.auth.configured;
  if (els.authUsername) els.authUsername.required = !state.auth.configured;
  renderAuthTools();
}

function renderAuthTools() {
  if (!els.authTools) return;
  const user = state.auth.user;
  if (!user) {
    els.authTools.innerHTML = '';
    return;
  }
  const forced = Boolean(user.must_change_password);
  els.authTools.innerHTML = `
    ${forced ? '<div class="graph-entry-message is-error">Your password appeared in a browser URL. Change it now to unlock protected features.</div>' : ''}
    <details class="auth-tool" ${forced ? 'open' : ''}>
      <summary>Change password</summary>
      <form data-password-form>
        <input name="currentPassword" type="password" autocomplete="current-password" placeholder="Current password" required>
        <input name="newPassword" type="password" autocomplete="new-password" placeholder="New password" minlength="10" required>
        <input name="confirmPassword" type="password" autocomplete="new-password" placeholder="Confirm new password" minlength="10" required>
        <button type="submit">Update password</button>
      </form>
    </details>
    ${user.role === 'admin' && !forced ? `
      <details class="auth-tool">
        <summary>Manage accounts</summary>
        <form data-account-create-form>
          <input name="email" type="email" placeholder="New account email" required>
          <input name="username" type="text" placeholder="Display name" required>
          <input name="password" type="password" placeholder="Temporary password" minlength="10" required>
          <button type="submit">Create user</button>
        </form>
        <div data-account-list>${renderAccountList()}</div>
      </details>` : ''}
  `;
  els.authTools.querySelector('[data-password-form]')?.addEventListener('submit', changePassword);
  els.authTools.querySelector('[data-account-create-form]')?.addEventListener('submit', createManagedAccount);
  bindAccountActions();
  if (user.role === 'admin' && !forced && !state.auth.accounts.length) loadManagedAccounts();
}

function renderAccountList() {
  if (!state.auth.accounts.length) return '<p class="meta">Loading accounts...</p>';
  return state.auth.accounts.map(account => `
    <div class="account-row">
      <strong>${escapeHtml(account.username)}</strong>
      <span>${escapeHtml(account.email)} · ${escapeHtml(account.role)}${account.must_change_password ? ' · password change required' : ''}</span>
      ${account.id === state.auth.user?.id ? '<span class="meta">Current account</span>' : `
        <div class="account-actions">
          <button type="button" data-account-role="${account.id}" data-next-role="${account.role === 'admin' ? 'user' : 'admin'}">Make ${account.role === 'admin' ? 'user' : 'admin'}</button>
          <button type="button" data-account-reset="${account.id}">Force reset</button>
          <button type="button" data-account-delete="${account.id}">Delete</button>
        </div>`}
    </div>
  `).join('');
}

async function changePassword(event) {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  const currentPassword = String(values.get('currentPassword') || '');
  const newPassword = String(values.get('newPassword') || '');
  if (newPassword !== values.get('confirmPassword')) {
    els.authMessage.textContent = 'New passwords do not match.';
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/change-password`, {
      method: 'POST', headers: authHeaders(true), body: JSON.stringify({ currentPassword, newPassword })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Password update failed: ${response.status}`);
    state.auth.token = result.token;
    state.auth.user = result.user;
    sessionStorage.setItem(AUTH_TOKEN_KEY, result.token);
    els.authMessage.textContent = 'Password changed. Older sessions are now invalid.';
    render();
  } catch (error) {
    els.authMessage.textContent = error.message;
  }
}

async function loadManagedAccounts() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/users`, { headers: authHeaders(), cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Accounts could not load.');
    state.auth.accounts = result.users || [];
    renderAuthPanel();
  } catch (error) {
    els.authMessage.textContent = error.message;
  }
}

async function createManagedAccount(event) {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
      method: 'POST', headers: authHeaders(true), body: JSON.stringify(Object.fromEntries(values))
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Account could not be created.');
    event.currentTarget.reset();
    state.auth.accounts = [];
    els.authMessage.textContent = `${result.user.username} was created.`;
    await loadManagedAccounts();
  } catch (error) {
    els.authMessage.textContent = error.message;
  }
}

function bindAccountActions() {
  els.authTools.querySelectorAll('[data-account-role]').forEach(button => button.addEventListener('click', () => updateManagedAccount(button.dataset.accountRole, { role: button.dataset.nextRole })));
  els.authTools.querySelectorAll('[data-account-reset]').forEach(button => button.addEventListener('click', () => updateManagedAccount(button.dataset.accountReset, { forcePasswordChange: true })));
  els.authTools.querySelectorAll('[data-account-delete]').forEach(button => button.addEventListener('click', async () => {
    if (!window.confirm('Delete this account and its private profile data?')) return;
    await deleteManagedAccount(button.dataset.accountDelete);
  }));
}

async function updateManagedAccount(id, changes) {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/users/${id}`, { method: 'PATCH', headers: authHeaders(true), body: JSON.stringify(changes) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Account could not be updated.');
    state.auth.accounts = [];
    await loadManagedAccounts();
  } catch (error) {
    els.authMessage.textContent = error.message;
  }
}

async function deleteManagedAccount(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/users/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Account could not be deleted.');
    }
    state.auth.accounts = [];
    await loadManagedAccounts();
  } catch (error) {
    els.authMessage.textContent = error.message;
  }
}

async function authenticate(event, action) {
  event.preventDefault();
  const email = els.authEmail.value.trim();
  const username = els.authUsername.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) return;
  els.authMessage.textContent = '';
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Authentication failed: ${response.status}`);
    state.auth.token = result.token;
    state.auth.user = result.user;
    state.auth.configured = true;
    sessionStorage.setItem(AUTH_TOKEN_KEY, result.token);
    els.authForm.reset();
    state.governance.loaded = false;
    render();
  } catch (error) {
    els.authMessage.textContent = error.message;
  }
}

function logout() {
  clearAuthSession();
  state.governance = { proposals: [], history: [], loading: false, loaded: false };
  state.auth.accounts = [];
  render();
}

function clearAuthSession() {
  state.auth.token = '';
  state.auth.user = null;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function authHeaders(json = false) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (state.auth.token) headers.Authorization = `Bearer ${state.auth.token}`;
  return headers;
}

function renderDataSourceStatus() {
  if (!els.dataSourceStatus) return;
  els.dataSourceStatus.className = `data-source-status is-${state.dataSource.mode}`;
  els.dataSourceStatus.innerHTML = `
    <span class="source-dot" aria-hidden="true"></span>
    <span>${escapeHtml(state.dataSource.label)}</span>
  `;
}

function renderContextPanel() {
  if (!els.context) return;

  if (!state.query) {
    state.currentTranslation = null;
    els.context.innerHTML = `
      <div class="context-heading">Condition Engine</div>
      <div class="context-copy-stack">
        <p class="context-copy"><strong>This system measures influence, not meaning.</strong></p>
        <p class="context-copy">Structural Space -> Core Rules -> Stored Graph -> Condition Engine -> Current Read</p>
      </div>
      <div class="context-doctrine">
        <div class="context-route"><strong>Nodes</strong><span>store experience.</span></div>
        <div class="context-route"><strong>Routes</strong><span>connect experiences.</span></div>
        <div class="context-route"><strong>Conditions</strong><span>change which experiences matter.</span></div>
        <div class="context-route"><strong>W.A.T.E.R</strong><span>carries new experience through the graph.</span></div>
        <div class="context-route"><strong>Gradients</strong><span>are differences in accumulated experience.</span></div>
        <div class="context-route"><strong>Meaning</strong><span>emerges from traversing those gradients.</span></div>
      </div>
      <div class="context-state semantic_bridge">
        <strong>activationWeight</strong>
        <span>First measurable graph unit</span>
      </div>
      <p class="context-copy">Type a feeling, phrase, everyday word, color, or condition source to inspect which stored routes become active now.</p>
      <p class="meta">Structural Humility: every local climate read is provisional, evidence-bound, and can return unresolved when the graph does not support a stronger route.</p>
    `;
    return;
  }

  const analysis = analyzeInputContext(state.query);
  const translation = resolveTranslation(state.query, analysis);
  state.currentTranslation = translation;
  const showBase = state.baseSetting;
  els.context.innerHTML = `
    <div class="context-heading">Input context layer</div>
    <div class="context-state ${escapeHtml(analysis.stateId)}">
      <strong>${escapeHtml(analysis.label)}</strong>
      <span>${escapeHtml(analysis.confidence)} confidence</span>
    </div>
    <div class="chip-list">
      ${analysis.signals.map(signal => `<span class="chip">${escapeHtml(signal)}</span>`).join('')}
    </div>
    ${analysis.senses.length ? `
      <div class="context-routes">
        ${analysis.senses.map(sense => `
          <div class="context-route">
            <strong>${escapeHtml(sense.shape)}</strong>
            <span>${escapeHtml(sense.route)}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
    ${showBase ? `
      <div class="context-routes">
        ${analysis.routes.length ? analysis.routes.map(route => `
          <div class="context-route">
            <strong>${escapeHtml(route.title)}</strong>
            <span>${escapeHtml(route.detail)}</span>
          </div>
        `).join('') : '<p class="meta">No evidence-backed route yet. Keep this neutral until context or citation supports a path.</p>'}
      </div>
    ` : `
      <div class="context-routes">
        <p class="meta">Base setting is off, so evidence-backed input routes are hidden for this read.</p>
      </div>
    `}
    ${renderTranslationResult(translation)}
  `;
}

function renderTranslationResult(result) {
  const primaryPath = result.paths[0];
  const showBase = state.baseSetting;
  return `
    <div class="translation-panel">
      ${result.structuralSummary ? renderStructuralRouteSummary(result.structuralSummary) : ''}
      ${showBase ? `
        <div class="context-heading">Translation path</div>
        ${primaryPath ? renderTranslationPath(primaryPath) : `<p class="meta">${escapeHtml(result.unresolvedReason || 'No color landing found.')}</p>`}
      ` : renderBaseSettingOffNotice(result)}
      ${result.emotionalRead ? renderEmotionalRead(result.emotionalRead) : ''}
      ${result.emotionalBlend ? renderEmotionalBlend(result.emotionalBlend) : ''}
      ${result.emotionConnections?.length ? renderEmotionConnections(result.emotionConnections) : ''}
      ${result.evocativeAssociation ? renderEvocativeAssociation(result.evocativeAssociation, showBase) : ''}
      ${result.themeComposition ? renderThemeComposition(result.themeComposition) : ''}
      ${result.selectionClimate ? renderSelectionClimate(result.selectionClimate) : ''}
      ${result.personalRead ? renderPersonalRead(result.personalRead) : ''}
      ${result.themeRead ? renderThemeRead(result.themeRead) : ''}
      ${result.humanBridges?.length ? renderHumanBridges(result.humanBridges) : ''}
      ${result.logicChecks ? renderLogicChecks(result.logicChecks) : ''}
      ${showBase ? `
        <div class="translation-section">
          <div class="context-heading">Color landing</div>
          ${result.primaryLanding ? renderLanding(result.primaryLanding, result.confidence) : `<p class="meta">${escapeHtml(result.unresolvedReason || 'Neutral unresolved input.')}</p>`}
        </div>
      ` : ''}
      ${result.evocativeSuggestions.length ? `
        <div class="translation-section">
          <div class="context-heading">Evocative outputs</div>
          <div class="evocative-grid">
            ${result.evocativeSuggestions.map(renderEvocativeGroup).join('')}
          </div>
        </div>
      ` : ''}
      ${showBase && result.alternativeLandings.length ? `
        <div class="translation-section">
          <div class="context-heading">Alternative paths</div>
          <div class="context-routes">
            ${result.alternativeLandings.map(path => renderTranslationPath(path)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderStructuralRouteSummary(summary) {
  return `
    <div class="translation-section">
      <div class="context-heading">Route health</div>
      <div class="route-health route-health-${escapeHtml(summary.primaryStrength || 'unresolved')}">
        <strong>${escapeHtml(summary.headline)}</strong>
        <span>${escapeHtml(summary.supportedCount)} usable route${summary.supportedCount === 1 ? '' : 's'} · ${escapeHtml(summary.weakCount)} weak route${summary.weakCount === 1 ? '' : 's'} kept in the background</span>
        ${summary.reasons?.length ? `<small>${escapeHtml(summary.reasons.join(' | '))}</small>` : ''}
      </div>
    </div>
  `;
}

function renderBaseSettingOffNotice(result) {
  const hasInterpretiveLayer = result.emotionalRead || result.emotionalBlend || result.emotionConnections?.length || result.evocativeAssociation || result.themeComposition || result.selectionClimate || result.themeRead || result.humanBridges?.length;
  return `
    <div class="translation-section">
      <div class="context-heading">Base setting off</div>
      <p class="meta">${escapeHtml(hasInterpretiveLayer
        ? 'Evidence-backed routes are hidden for this read. Theme, emotion, bridge, and evocative layers remain visible as interpretive context.'
        : result.unresolvedReason || 'No supported interpretive route yet.')}</p>
    </div>
  `;
}

function renderThemeComposition(composition) {
  const isComposed = composition.kind === 'composed';
  const expression = isComposed ? themeExpressionForComposition(composition) : themeTermForTheme(composition.theme);
  return `
    <div class="translation-section">
      <div class="context-heading">Theme composition</div>
      <div class="theme-composition">
        <div class="composition-head">
          <strong>${escapeHtml(expression)}</strong>
          <span>${escapeHtml(isComposed ? 'theme expression' : 'theme term')}</span>
        </div>
        ${composition.categoryMap?.length ? renderCompositionCategoryMap(composition.categoryMap) : ''}
        ${isComposed ? `
          <div class="composition-pair">
            ${composition.themes.map(theme => `
              <span>
                <strong>${escapeHtml(theme.label)}</strong>
                <small>${escapeHtml(themeTermForTheme(theme))}</small>
              </span>
            `).join('')}
          </div>
          <dl>
            <dt>Theme shift</dt>
            <dd>${escapeHtml(composition.themeShift || composition.colorShift)}</dd>
            <dt>Emotional shift</dt>
            <dd>${escapeHtml(composition.emotionalShift)}</dd>
            <dt>Meaning shift</dt>
            <dd>${escapeHtml(composition.meaningShift)}</dd>
          </dl>
          <p>${escapeHtml(composition.boundary)}</p>
        ` : `
          <dl>
            <dt>Theme</dt>
            <dd>${escapeHtml(composition.theme.label)}</dd>
            <dt>Theme term</dt>
            <dd>${escapeHtml(themeTermForTheme(composition.theme))}</dd>
            <dt>Meaning</dt>
            <dd>${escapeHtml(composition.theme.emotionalLogic)}</dd>
          </dl>
          <p>${escapeHtml(composition.theme.boundary)}</p>
        `}
      </div>
    </div>
  `;
}

function renderCompositionCategoryMap(categories) {
  return `
    <div class="composition-categories">
      ${categories.map(category => `
        <div class="composition-category">
          <strong>${escapeHtml(category.label)}</strong>
          <span>${escapeHtml(category.role)}</span>
          <small>${escapeHtml(category.matchedThemes.join(', '))}</small>
          <p>${escapeHtml(category.question)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderThemeRead(read) {
  return `
    <div class="translation-section">
      <div class="context-heading">Theme read</div>
      <div class="theme-read">
        <strong>${escapeHtml(read.theme)}</strong>
        <span>${escapeHtml(read.route)}</span>
        ${read.forwardTrace ? `<p><strong>Forward trace:</strong> ${escapeHtml(read.forwardTrace)}</p>` : ''}
        ${read.reverseTrace ? `<p><strong>Reverse trace:</strong> ${escapeHtml(read.reverseTrace)}</p>` : ''}
        <p>${escapeHtml(read.emotionalClimate)}</p>
        <small>${escapeHtml(read.boundary)}</small>
      </div>
    </div>
  `;
}

function themeTermForTheme(theme) {
  return theme?.themeTerm || theme?.baseClimate || theme?.label || 'theme condition';
}

function themeExpressionForComposition(composition) {
  if (!composition) return 'theme expression';
  return composition.themeExpression || composition.composedClimate || composition.themeTerm || 'theme expression';
}

function renderSelectionClimate(read) {
  return `
    <div class="translation-section">
      <div class="context-heading">Pattern extraction</div>
      <div class="personal-read selection-climate-read">
        <div class="composition-head">
          <strong>${escapeHtml(read.finalRead)}</strong>
          <span>${escapeHtml(read.connectionStrength)} connection</span>
        </div>
        ${read.extractedAttributes?.length ? `
          <div class="theme-token-row">
            ${read.extractedAttributes.map(item => `<span>${escapeHtml(item.label)} x${escapeHtml(String(item.count))}</span>`).join('')}
          </div>
        ` : ''}
        <dl>
          <dt>Extracted attributes</dt>
          <dd>${escapeHtml((read.extractedAttributes || []).map(item => item.label).join(' | ') || 'No extracted attributes')}</dd>
          <dt>Observable pattern</dt>
          <dd>${escapeHtml(read.observablePatterns.join(' | '))}</dd>
          <dt>Inferred preference</dt>
          <dd>${escapeHtml(read.inferredPreferences.join(' | '))}</dd>
          <dt>Environment condition</dt>
          <dd>${escapeHtml(read.environmentCondition || 'Repeated choices create the condition more than any one symbol alone.')}</dd>
          <dt>Filter read</dt>
          <dd>${escapeHtml(read.filterRead)}</dd>
        </dl>
        ${read.storedExample ? `
          <div class="theme-category-item">
            <strong>Stored example</strong>
            <p>Local case-study read for how this pattern behaves under environment and exposure.</p>
            <dl>
              <dt>Context</dt>
              <dd>${escapeHtml(read.storedExample.context)}</dd>
              <dt>Environment</dt>
              <dd>${escapeHtml(read.storedExample.environment)}</dd>
              <dt>Exposure</dt>
              <dd>${escapeHtml(read.storedExample.exposure)}</dd>
              <dt>Structural change</dt>
              <dd>${escapeHtml(read.storedExample.structuralChange)}</dd>
              <dt>Observable pattern</dt>
              <dd>${escapeHtml(read.storedExample.observablePattern)}</dd>
              <dt>Stored-example read</dt>
              <dd>${escapeHtml(read.storedExample.interpretation)}</dd>
            </dl>
          </div>
        ` : ''}
        ${read.repeatedClimates.length ? `
          <div class="theme-token-row">
            ${read.repeatedClimates.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
          </div>
        ` : ''}
        ${renderGrowthPatternsSection('Growth patterns', read.growthPatterns || [], 'Repeated preferences that are starting to deepen the graph instead of staying isolated selections.')}
        ${read.matchedSelections.length ? `
          <div class="context-routes">
            ${read.matchedSelections.map(item => `
              <div class="context-route">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(item.observation)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${read.boundaryChecks?.length ? `
          <div class="logic-checks">
            ${read.boundaryChecks.map(item => `
              <div class="logic-check">
                <span>Boundary</span>
                <div>${escapeHtml(item)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <p class="meta">${escapeHtml(read.boundary)}</p>
      </div>
    </div>
  `;
}

function renderGrowthPatternsSection(title, patterns, description = '') {
  if (!patterns?.length) return '';
  return `
    <div class="theme-category-item">
      <strong>${escapeHtml(title)}</strong>
      ${description ? `<p>${escapeHtml(description)}</p>` : ''}
      <div class="context-routes">
        ${patterns.map(item => `
          <div class="context-route">
            <span>${escapeHtml(item)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderPersonalRead(read) {
  return `
    <div class="translation-section">
      <div class="context-heading">Personal read</div>
      <div class="personal-read">
        <div class="composition-head">
          <strong>${escapeHtml(read.title)}</strong>
          <span>${escapeHtml(read.strength)}</span>
        </div>
        <dl>
          <dt>Shared route</dt>
          <dd>${escapeHtml(read.sharedRoute)}</dd>
          <dt>Personal context</dt>
          <dd>${escapeHtml(read.personalContext)}</dd>
          <dt>Personal climate shift</dt>
          <dd>${escapeHtml(read.personalClimateShift)}</dd>
          <dt>Emotional logic</dt>
          <dd>${escapeHtml(read.emotionalLogic)}</dd>
        </dl>
        ${read.entries.length ? `
          <div class="theme-token-row">
            ${read.entries.map(entry => `<span>${escapeHtml(entry.term)} · ${escapeHtml(profileContextLabel(entry.contextType))}</span>`).join('')}
          </div>
        ` : ''}
        <p class="meta">${escapeHtml(read.boundary)}</p>
      </div>
    </div>
  `;
}

function renderHumanBridges(bridges) {
  return `
    <div class="translation-section">
      <div class="context-heading">Human bridges</div>
      <div class="human-bridge-grid">
        ${bridges.map(bridge => `
          <div class="human-bridge-card">
            <div>
              <strong>${escapeHtml(bridge.label)}</strong>
              <span>${escapeHtml(bridge.strength)} connection</span>
            </div>
            <dl>
              <dt>Myth</dt>
              <dd>${escapeHtml(bridge.myth)}</dd>
              <dt>History</dt>
              <dd>${escapeHtml(bridge.history)}</dd>
              <dt>Science</dt>
              <dd>${escapeHtml(bridge.science)}</dd>
              <dt>Arts</dt>
              <dd>${escapeHtml(bridge.arts)}</dd>
            </dl>
            <p>${escapeHtml(bridge.emotionalLogic)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderLogicChecks(checks) {
  return `
    <div class="translation-section">
      <div class="context-heading">Logic + feeling checks</div>
      <div class="logic-checks">
        ${checks.items.map(item => `
          <div class="logic-check">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.value)}</span>
          </div>
        `).join('')}
      </div>
      <p class="meta">${escapeHtml(checks.boundary)}</p>
    </div>
  `;
}

function renderEmotionalRead(read) {
  return `
    <div class="translation-section">
      <div class="context-heading">Emotional read</div>
      <div class="emotion-read">
        <div>
          <strong>${escapeHtml(read.label)}</strong>
          <span>${escapeHtml(read.tone)} tone · ${escapeHtml(read.confidence)} confidence</span>
        </div>
        <p>${escapeHtml(read.definition)}</p>
        <p>${escapeHtml(read.evidence)}</p>
      </div>
    </div>
  `;
}

function renderEmotionalBlend(blend) {
  return `
    <div class="translation-section">
      <div class="context-heading">Emotional blend</div>
      <div class="emotion-blend">
        <div class="blend-components">
          ${blend.components.map(component => `
            <span class="blend-chip">
              <strong>${escapeHtml(component.label)}</strong>
              <span>${escapeHtml(component.tone)} · ${escapeHtml(component.family)}</span>
            </span>
          `).join('')}
        </div>
        <div class="blend-palette">
          ${blend.palette.map(item => `
            <button class="blend-swatch" type="button" onclick="selectNode('${item.nodeId}')" title="${escapeHtml(item.label)}">
              <span style="background:${familyColor(item.family)}"></span>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.family)}</small>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderEmotionConnections(connections) {
  return `
    <div class="translation-section">
      <div class="context-heading">Emotion connections</div>
      <div class="emotion-connection-grid">
        ${connections.map(connection => `
          <button class="emotion-connection-card" type="button" onclick="selectNode('${connection.nodeId}')">
            <span class="dot" style="background:${familyColor(connection.family)}"></span>
            <span>
              <strong>${escapeHtml(connection.label)}</strong>
              <small>${escapeHtml(connection.tone)} · ${escapeHtml(connection.family)} climate</small>
              <em>${escapeHtml(connection.boundary)}</em>
            </span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderEvocativeAssociation(association, showBase = true) {
  return `
    <div class="translation-section">
      <div class="context-heading">Evocative association</div>
      <div class="evocative-association">
        <div class="composition-head">
          <strong>${escapeHtml(association.title)}</strong>
          <span>${escapeHtml(association.strength)}</span>
        </div>
        <dl>
          ${showBase ? `
            <dt>Baseline route</dt>
            <dd>${escapeHtml(association.baselineRoute)}</dd>
          ` : ''}
          <dt>Emotional climate</dt>
          <dd>${escapeHtml(association.emotionalClimate)}</dd>
          <dt>Evocative meaning</dt>
          <dd>${escapeHtml(association.evocativeMeaning)}</dd>
          <dt>Dot connection</dt>
          <dd>${escapeHtml(association.dotConnection)}</dd>
        </dl>
        <p>${escapeHtml(association.boundary)}</p>
      </div>
    </div>
  `;
}

function renderTranslationPath(path) {
  return `
    <div class="translation-path translation-path-${escapeHtml(path.structuralStrength || 'unresolved')}">
      <strong>${path.nodes.map(escapeHtml).join(' -> ')}</strong>
      <span>${escapeHtml(path.confidence)} confidence · ${escapeHtml(path.structuralStrength || 'unresolved')} structure · ${escapeHtml(path.edgeTypes.join(', ') || 'direct match')}</span>
      ${path.structuralTypes?.length ? `<span>${escapeHtml(path.structuralTypes.join(' -> '))}</span>` : ''}
      ${path.structuralReasons?.length ? `<span>${escapeHtml(path.structuralReasons.join(' | '))}</span>` : ''}
      ${path.evidence.length ? `<span>${escapeHtml(path.evidence.join(' | '))}</span>` : ''}
    </div>
  `;
}

function renderLanding(landing, confidence) {
  const target = landing.node;
  const family = landing.family;
  const structure = nodeStructureInfo(target);
  return `
    <button class="landing-card" type="button" onclick="selectNode('${target.id}')">
      <span class="dot" style="background:${familyColor(family)}"></span>
      <span>
        <strong>${escapeHtml(target.label)}</strong>
        <span>${escapeHtml(landingKindLabel(landing.kind))} · ${escapeHtml(structure.shortLabel)} · ${escapeHtml(family)} · ${escapeHtml(confidence)} confidence</span>
      </span>
    </button>
  `;
}

function landingKindLabel(kind) {
  const labels = {
    family: 'base color',
    alias: 'shade',
    bridge: 'secondary color',
    shade: 'shade phrase',
    synonym: 'shade synonym'
  };
  return labels[kind] || kind || 'route';
}

function renderEvocativeGroup(group) {
  return `
    <div class="evocative-group">
      <strong>${escapeHtml(group.label)}</strong>
      <span>${escapeHtml(group.intensity || 'editorial')}</span>
      <p>${group.names.map(escapeHtml).join(', ')}</p>
    </div>
  `;
}

function renderStats() {
  const profile = state.perception?.profile || currentPerceptionProfile();
  const visibleNodeIds = state.perception?.visibleNodeIds?.size ? state.perception.visibleNodeIds : neighborhood(state.selectedId, profile);
  const visibleEdges = state.perception?.visibleEdges?.length ? state.perception.visibleEdges : visibleGraphEdges(visibleNodeIds, profile);
  const counts = {
    Families: state.nodes.filter(node => node.type === 'family').length,
    Bridges: state.nodes.filter(node => node.type === 'subfamily').length,
    'Shade language': state.nodes.filter(node => ['alias', 'shade', 'synonym'].includes(node.type)).length,
    Conditions: state.nodes.filter(node => node.type === 'environment_condition' || node.type === 'environment_term').length,
    Emotions: state.nodes.filter(node => node.type === 'emotion_word').length,
    Common: state.nodes.filter(node => node.type === 'common_word').length,
    Ecosystem: state.nodes.filter(node => node.metadata?.ecosystem).length,
    Edges: state.edges.length,
    Visible: visibleNodeIds.size,
    Active: visibleEdges.length,
    Neutral: neutralTerms().length,
    Themes: state.data.themeComposition?.categories?.length || 0,
    History: allHistoryIndexEntries().length,
    Saved: state.customConcepts.length,
    Filters: state.activeThemeFilterIds.length,
    Perception: profile.activeConditionIds.size
  };

  els.stats.innerHTML = Object.entries(counts)
    .map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`)
    .join('');
}

function renderCategoryButtons() {
  els.categoryButtons.forEach(button => {
    const key = button.dataset.categoryFilter;
    const active = !!state.categoryFilters[key];
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function colorMapVisible() {
  return !!(state.categoryFilters.families && state.categoryFilters.bridges && state.categoryFilters.shadeLanguage);
}

function conditionBankVisible() {
  return !!state.categoryFilters.conditions;
}

function syncSelectionToVisibleCategories() {
  if (!nodePassesCategoryFilter(state.nodeById.get(state.selectedId))) {
    state.selectedId = firstFilteredNodeId() || state.selectedId;
  }
}

function setColorMapVisibility(active) {
  state.categoryFilters.families = active;
  state.categoryFilters.bridges = active;
  state.categoryFilters.shadeLanguage = active;
  renderCategoryButtons();
  renderLayerToggleButtons();
  syncSelectionToVisibleCategories();
  render();
}

function setConditionBankVisibility(active) {
  state.categoryFilters.conditions = active;
  renderCategoryButtons();
  renderLayerToggleButtons();
  syncSelectionToVisibleCategories();
  render();
}

function renderLayerToggleButtons() {
  if (els.colorMapToggle) {
    const active = colorMapVisible();
    els.colorMapToggle.classList.toggle('is-active', active);
    els.colorMapToggle.setAttribute('aria-pressed', String(active));
    els.colorMapToggle.setAttribute('title', active ? 'Turn color map off' : 'Turn color map on');
    els.colorMapToggle.setAttribute('aria-label', active ? 'Turn color map off' : 'Turn color map on');
  }
}

function renderRouteHealthButtons() {
  els.routeHealthButtons.forEach(button => {
    const key = button.dataset.routeHealthFilter;
    const active = !!state.routeHealthFilters[key];
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderSchemaPackSelect() {
  if (!els.schemaPack) return;
  const selectedNode = state.nodeById.get(state.selectedId);
  const available = availableSchemaPacksForNode(selectedNode);
  const activeId = resolvedSchemaPackId(selectedNode);
  els.schemaPack.innerHTML = available
    .map(pack => `<option value="${escapeHtml(pack.id)}"${pack.id === activeId ? ' selected' : ''}>${escapeHtml(pack.label)}</option>`)
    .join('');
  els.schemaPack.value = activeId;
  state.activeSchemaPackId = activeId;
}

function renderTabs() {
  ensureVisibleView();
  renderViewGroups();
  els.tabs.forEach(tab => {
    tab.classList.toggle('is-active', tab.dataset.view === state.view);
  });
}

function renderViewGroups() {
  const visible = visibleViewGroups();
  els.viewGroups.forEach(group => {
    const groupKey = group.dataset.viewGroup;
    group.hidden = !visible[groupKey];
  });
}

function visibleViewGroups() {
  return {
    foundation: colorMapVisible(),
    conditions: conditionBankVisible()
  };
}

function viewGroupForView(view) {
  if (VIEW_GROUPS.foundation.has(view)) return 'foundation';
  if (VIEW_GROUPS.conditions.has(view)) return 'conditions';
  return 'always';
}

function isViewVisible(view) {
  const group = viewGroupForView(view);
  if (group === 'foundation') return colorMapVisible();
  if (group === 'conditions') return conditionBankVisible();
  return true;
}

function ensureVisibleView() {
  if (isViewVisible(state.view)) return;
  const nextView = VIEW_FALLBACK_ORDER.find(isViewVisible);
  if (nextView) state.view = nextView;
}

function renderGraphModeButton() {
  if (!els.graphMode) return;
  const labels = {
    ring: 'Ring graph view',
    topology: 'Graph theory view',
    scatter: 'Connected scatter plot',
    '3d': '3D color web'
  };
  const nextLabel = labels[nextGraphMode(state.graphMode)];
  const active = state.graphMode !== 'ring';
  els.graphMode.classList.toggle('is-active', active);
  els.graphMode.setAttribute('aria-pressed', String(active));
  els.graphMode.setAttribute('title', `Use ${nextLabel.toLowerCase()}`);
  els.graphMode.setAttribute('aria-label', `Use ${nextLabel.toLowerCase()}`);
}

function renderZoomButtons() {
  const disabled = state.graphMode === '3d';
  if (els.zoomIn) {
    els.zoomIn.disabled = disabled;
    els.zoomIn.setAttribute('aria-label', disabled ? 'Zoom is unavailable in 3D color web' : 'Zoom in graph');
    els.zoomIn.setAttribute('title', disabled ? 'Zoom is unavailable in 3D color web' : 'Zoom in graph');
  }
  if (els.zoomOut) {
    els.zoomOut.disabled = disabled;
    els.zoomOut.setAttribute('aria-label', disabled ? 'Zoom is unavailable in 3D color web' : 'Zoom out graph');
    els.zoomOut.setAttribute('title', disabled ? 'Zoom is unavailable in 3D color web' : 'Zoom out graph');
  }
}

function nextAxisView(view) {
  const views = ['free', 'x', 'y', 'z'];
  const index = views.indexOf(view);
  return views[(index + 1) % views.length] || 'free';
}

function axisViewRotation(view) {
  const rotations = {
    free: { x: -0.35, y: 0.55 },
    x: { x: 0, y: -Math.PI / 2 },
    y: { x: Math.PI / 2, y: 0 },
    z: { x: 0, y: 0 }
  };
  return rotations[view] || rotations.free;
}

function applyAxisView(view) {
  const rotation = axisViewRotation(view);
  state.three.rotation.x = rotation.x;
  state.three.rotation.y = rotation.y;
}

function renderAxisViewButton() {
  if (!els.axisView) return;
  const view = state.three.axisView || 'free';
  const labels = {
    free: 'Axis view: free',
    x: 'Axis view: through X',
    y: 'Axis view: through Y',
    z: 'Axis view: through Z'
  };
  const nextLabel = labels[nextAxisView(view)] || labels.free;
  const active = state.graphMode === '3d' && view !== 'free';
  els.axisView.classList.toggle('is-active', active);
  els.axisView.disabled = state.graphMode !== '3d';
  els.axisView.setAttribute('aria-pressed', String(active));
  els.axisView.setAttribute('title', state.graphMode === '3d' ? `Use ${nextLabel.toLowerCase()}` : 'Axis view is available in 3D color web');
  els.axisView.setAttribute('aria-label', labels[view] || labels.free);
  const label = els.axisView.querySelector('span');
  if (label) label.textContent = view === 'free' ? '3D' : view.toUpperCase();
}

function renderList() {
  if (state.view === 'word-storage') {
    renderWordStorageList();
    return;
  }

  if (state.view === 'research') {
    renderResearchInbox();
    return;
  }

  if (state.view === 'shared-graph') {
    renderSharedGraphEditor();
    return;
  }

  if (state.view === 'type-architecture') {
    renderTypeArchitectureList();
    return;
  }

  if (state.view === 'shade-graph') {
    renderShadeGraphList();
    return;
  }

  if (state.view === 'natural-atlas') {
    renderNaturalShadeAtlas();
    return;
  }

  if (state.view === 'assistant') {
    renderAssistantWorkspace();
    return;
  }

  if (state.query) {
    renderSearchResults();
    return;
  }

  if (state.view === 'theme-categories') {
    renderThemeCategoryList();
    return;
  }

  if (state.view === 'theme-filters') {
    renderThemeFilterList();
    return;
  }

  if (state.view === 'history-index') {
    renderHistoryIndex();
    return;
  }

  if (state.view === 'selection-climate') {
    renderSelectionClimateList();
    return;
  }

  if (state.view === 'my-concepts') {
    renderCustomConceptList();
    return;
  }

  if (state.view === 'personal-profile') {
    renderPersonProfileList();
    return;
  }

  if (state.view === 'associations') {
    renderAssociationMapList();
    return;
  }

  if (state.view === 'neutral') {
    renderNeutralWordList();
    return;
  }

  if (state.view === 'bridges') {
    renderFamilyGroupedNodeList('subfamily', 'secondary colors');
    return;
  }

  if (state.view === 'shade-language') {
    renderFamilyGroupedNodeList(['alias', 'shade', 'synonym'], 'shade terms');
    return;
  }

  const type = state.view === 'families' ? 'family' : state.view === 'bridges' ? 'subfamily' : state.view === 'shade-language' ? ['alias', 'shade', 'synonym'] : state.view === 'emotions' ? 'emotion_word' : 'common_word';
  const items = state.nodes
    .filter(node => Array.isArray(type) ? type.includes(node.type) : node.type === type)
    .filter(node => !state.emotionFilter || emotionVisibleNodeIds().has(node.id))
    .filter(node => nodePassesCategoryFilter(node))
    .sort((a, b) => a.label.localeCompare(b.label));

  els.list.innerHTML = items.length ? items.map(node => renderNodeListItem(node)).join('') : '<p class="meta">No items in this filter.</p>';

  els.list.querySelectorAll('.list-item').forEach(button => {
    if (!button.dataset.nodeId) return;
    button.addEventListener('click', () => {
      state.selectedId = button.dataset.nodeId;
      render();
    });
  });
}

function renderResearchInbox() {
  const signedIn = Boolean(state.auth.user);
  const isAdmin = state.auth.user?.role === 'admin';
  const message = state.research.message;
  const query = state.research.query || state.query || '';
  const suggestions = state.research.suggestions;
  els.list.innerHTML = `
    <section class="research-inbox">
      <div class="theme-filter-summary">
        <strong>Research inbox</strong>
        <span>Search public reference sources, preserve evidence, and submit connections for human review.</span>
      </div>
      <div class="shared-graph-review">
        <strong>Evidence does not become truth automatically.</strong>
        <span>Saved results enter as proposed research. Approval can create a separate graph proposal, which still requires graph review.</span>
      </div>
      ${message ? `<div class="graph-entry-message is-${escapeHtml(message.type)}">${escapeHtml(message.text)}</div>` : ''}
      ${!signedIn ? '<div class="graph-entry-message is-error">Sign in to search sources or save research evidence.</div>' : ''}
      <form class="research-search-form" data-research-search>
        <label class="form-wide">
          <span>Concept or question</span>
          <input name="query" type="search" maxlength="180" value="${escapeHtml(query)}" placeholder="winter ritual, color and emotion, religious calendar" required>
        </label>
        <fieldset>
          <legend>Sources</legend>
          <label><input name="sources" type="checkbox" value="wikipedia" checked> Wikipedia</label>
          <label><input name="sources" type="checkbox" value="crossref" checked> Crossref scholarly records</label>
        </fieldset>
        <p class="meta">Your search phrase is sent to the public sources you select. Account details and personal-profile entries are not sent.</p>
        <button class="primary-command" type="submit" ${signedIn && !state.research.loading ? '' : 'disabled'}>${state.research.loading ? 'Searching...' : 'Search sources'}</button>
      </form>
      ${state.research.warnings.length ? `<div class="graph-entry-message is-error">${state.research.warnings.map(escapeHtml).join(' | ')}</div>` : ''}
      ${suggestions ? renderResearchSuggestions(suggestions) : ''}
      <section class="research-results" aria-label="Research search results">
        ${state.research.results.length
          ? state.research.results.map((item, index) => renderResearchResult(item, index)).join('')
          : '<p class="meta">Search results will appear here. Nothing is added until you save a result with a boundary and counterexample.</p>'}
      </section>
      <section class="governance-section">
        <div class="governance-head">
          <strong>${isAdmin ? 'All research proposals' : 'My research proposals'}</strong>
          <button type="button" data-refresh-research ${signedIn ? '' : 'disabled'}>Refresh</button>
        </div>
        ${state.research.items.length
          ? state.research.items.map(item => renderResearchRecord(item, isAdmin)).join('')
          : '<p class="meta">No saved research proposals yet.</p>'}
      </section>
    </section>`;

  els.list.querySelector('[data-research-search]')?.addEventListener('submit', searchResearch);
  els.list.querySelectorAll('[data-save-research]').forEach(form => form.addEventListener('submit', saveResearchResult));
  els.list.querySelector('[data-refresh-research]')?.addEventListener('click', loadResearchItems);
  els.list.querySelectorAll('[data-research-decision]').forEach(button => button.addEventListener('click', () => reviewResearchItem(button.dataset.researchId, button.dataset.researchDecision)));
  els.list.querySelectorAll('[data-research-graph-proposal]').forEach(button => button.addEventListener('click', () => createResearchGraphProposal(button.dataset.researchGraphProposal)));
}

function historyIndexDataset() {
  return state.data?.historyIndex || { eras: [], lanes: [], entries: [], boundary: '' };
}

function approvedHistoryResearchEntries() {
  return (state.research.items || [])
    .filter(item => item.kind === 'history_index' && item.status === 'approved')
    .map(item => ({
      id: `research-${item.id}`,
      label: item.title,
      eraId: item.history_metadata?.eraId || 'unknown',
      lane: item.history_metadata?.lane || 'religion',
      region: item.history_metadata?.region || '',
      civilization: item.history_metadata?.civilization || '',
      type: item.history_metadata?.type || 'record',
      summary: item.history_metadata?.summary || item.excerpt || '',
      wikipediaTitle: item.history_metadata?.wikipediaTitle || item.title,
      wikipediaUrl: item.source_url,
      sourceNote: item.history_metadata?.sourceNote || item.source_name,
      boundary: item.boundary,
      routeSeeds: item.history_metadata?.routeSeeds || [],
      themeConditions: item.history_metadata?.themeConditions || [titleCase(item.history_metadata?.lane || 'religion')],
      anchorHints: item.history_metadata?.anchorHints || [],
      relatedEntries: item.history_metadata?.relatedEntries || [],
      sourceLayer: 'Approved research'
    }));
}

function allHistoryIndexEntries() {
  const dataset = historyIndexDataset();
  const merged = new Map((dataset.entries || []).map(entry => [entry.id, { ...entry, sourceLayer: 'Curated history dataset' }]));
  approvedHistoryResearchEntries().forEach(entry => merged.set(entry.id, entry));
  return [...merged.values()];
}

function historyEntryById(entryId = state.historyIndex.selectedEntryId) {
  if (!entryId) return null;
  return allHistoryIndexEntries().find(entry => entry.id === entryId) || null;
}

function historyEraMap() {
  return new Map((historyIndexDataset().eras || []).map(era => [era.id, era]));
}

function filteredHistoryIndexEntries() {
  const query = normalizeConceptTerm(state.historyIndex.query || '');
  const entries = allHistoryIndexEntries();
  return entries.filter(entry => {
    if (state.historyIndex.eraId !== 'all' && entry.eraId !== state.historyIndex.eraId) return false;
    if (state.historyIndex.lane !== 'all' && entry.lane !== state.historyIndex.lane) return false;
    if (state.historyIndex.region !== 'all' && (entry.region || '') !== state.historyIndex.region) return false;
    if (state.historyIndex.type !== 'all' && (entry.type || '') !== state.historyIndex.type) return false;
    if (!query) return true;
    const haystack = [
      entry.label,
      entry.summary,
      entry.region,
      entry.civilization,
      entry.type,
      ...(entry.routeSeeds || []),
      ...(entry.relatedEntries || [])
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query);
  }).sort((a, b) => {
    const eraOrder = (historyEraMap().get(a.eraId)?.order || 999) - (historyEraMap().get(b.eraId)?.order || 999);
    return eraOrder || a.lane.localeCompare(b.lane) || a.label.localeCompare(b.label);
  });
}

function ensureHistorySelection(entries = filteredHistoryIndexEntries()) {
  if (entries.some(entry => entry.id === state.historyIndex.selectedEntryId)) return;
  state.historyIndex.selectedEntryId = entries[0]?.id || null;
}

function historyThemeForLane(lane) {
  return allCompositionThemes().find(theme =>
    theme.label.toLowerCase() === lane.toLowerCase()
    || theme.category.toLowerCase() === lane.toLowerCase()
  ) || null;
}

function activateThemeForHistoryLane(lane) {
  const theme = historyThemeForLane(lane);
  if (!theme) return;
  const next = new Set(state.activeThemeFilterIds);
  next.add(theme.id);
  state.activeThemeFilterIds = [...next];
  saveActiveThemeFilters();
}

function sendHistoryEntryToGraph(entryId) {
  const entry = historyEntryById(entryId);
  if (!entry) return;
  activateThemeForHistoryLane(entry.lane);
  state.historyIndex.selectedEntryId = entry.id;
  const query = (entry.routeSeeds || []).slice(0, 3).join(' ') || entry.label;
  state.query = String(query || '').trim().toLowerCase();
  if (els.search) els.search.value = state.query;
  rebuildActiveGraph();
  const selected = findNodeForSearchQuery(state.query) || findBestHistorySeedNode(entry);
  if (selected) state.selectedId = selected.id;
  render();
}

function findBestHistorySeedNode(entry) {
  const seeds = entry?.routeSeeds || [];
  for (const seed of seeds) {
    const node = findNodeForSearchQuery(seed);
    if (node) return node;
  }
  return null;
}

function findNodeForSearchQuery(query) {
  const normalized = normalizeConceptTerm(query || '');
  if (!normalized) return null;
  return state.nodes.find(node => normalizeConceptTerm(node.label) === normalized) || null;
}

function renderHistoryEntryCard(entry) {
  const era = historyEraMap().get(entry.eraId);
  const selected = entry.id === state.historyIndex.selectedEntryId;
  return `
    <button class="list-item ${selected ? 'is-selected' : ''}" type="button" data-history-entry="${escapeHtml(entry.id)}">
      <span class="dot" style="background:${familyColor(entry.lane === 'religion' ? 'purple' : 'yellow')}"></span>
      <span class="entry-main">
        <strong>${escapeHtml(entry.label)}</strong>
        <em>${escapeHtml(era?.label || entry.eraId)} · ${escapeHtml(titleCase(entry.lane))} · ${escapeHtml(entry.type || 'record')}</em>
      </span>
      <span class="status-pill">${escapeHtml((entry.routeSeeds || []).length)} seeds</span>
    </button>
  `;
}

function renderHistoryEntryDetail(entry) {
  if (!entry) {
    return `
      <section class="history-index-detail">
        <div class="theme-filter-summary">
          <strong>Local history context</strong>
          <span>Select an entry from the cabinet.</span>
        </div>
        <p class="meta">This index cabinet keeps history organized by era first, then by Religion or Arts, and only hands route seeds into the graph when the current read needs them.</p>
      </section>
    `;
  }

  const era = historyEraMap().get(entry.eraId);
  return `
    <section class="history-index-detail">
      <div class="theme-filter-summary">
        <strong>${escapeHtml(entry.label)}</strong>
        <span>${escapeHtml(era?.label || entry.eraId)} · ${escapeHtml(titleCase(entry.lane))}</span>
      </div>
      <div class="chip-list">
        ${entry.region ? `<span class="chip">${escapeHtml(entry.region)}</span>` : ''}
        ${entry.civilization ? `<span class="chip">${escapeHtml(entry.civilization)}</span>` : ''}
        ${entry.type ? `<span class="chip">${escapeHtml(entry.type)}</span>` : ''}
        <span class="chip">${escapeHtml(entry.sourceLayer || 'Wikipedia source layer')}</span>
      </div>
      <p>${escapeHtml(entry.summary || 'No summary yet.')}</p>
      <div class="detail-section cluster-section">
        <h3>Wikipedia Source</h3>
        <p class="meta"><strong>${escapeHtml(entry.wikipediaTitle || entry.label)}</strong></p>
        <a href="${escapeHtml(entry.wikipediaUrl)}" target="_blank" rel="noopener noreferrer">Open source</a>
        <p class="meta">${escapeHtml(entry.sourceNote || 'Wikipedia orientation source.')}</p>
      </div>
      <div class="detail-section cluster-section">
        <h3>Route Seeds Contributed By This Record</h3>
        <div class="research-chips">
          ${(entry.routeSeeds || []).map(seed => `<span>${escapeHtml(seed)}</span>`).join('') || '<span>No route seeds yet.</span>'}
        </div>
        <p class="meta"><strong>Boundary:</strong> ${escapeHtml(entry.boundary || historyIndexDataset().boundary || '')}</p>
      </div>
      ${(entry.anchorHints || []).length ? `
        <div class="detail-section cluster-section">
          <h3>Anchor Hints</h3>
          <div class="research-chips">${entry.anchorHints.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
        </div>
      ` : ''}
      ${(entry.relatedEntries || []).length ? `
        <div class="detail-section cluster-section">
          <h3>Related Entries</h3>
          <div class="research-chips">${entry.relatedEntries.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
        </div>
      ` : ''}
      <div class="assistant-actions">
        <button class="primary-command" type="button" data-history-send="${escapeHtml(entry.id)}">Send to graph read</button>
      </div>
    </section>
  `;
}

function renderHistoryIndex() {
  const dataset = historyIndexDataset();
  const allEntries = allHistoryIndexEntries();
  const regions = ['all', ...uniqueStrings(allEntries.map(entry => entry.region).filter(Boolean))];
  const types = ['all', ...uniqueStrings(allEntries.map(entry => entry.type).filter(Boolean))];
  const eras = dataset.eras || [];
  const lanes = dataset.lanes || [];
  const entries = filteredHistoryIndexEntries();
  ensureHistorySelection(entries);
  const selectedEntry = historyEntryById();

  els.list.innerHTML = `
    <section class="history-index-panel">
      <div class="theme-filter-summary">
        <strong>History index</strong>
        <span>Era-first cabinet for Religion and Arts, with Wikipedia as the first-pass source layer.</span>
      </div>
      <div class="shared-graph-review">
        <strong>History record is not graph truth.</strong>
        <span>A history entry contributes route seeds and context. The graph stays canonical until governed routes are separately approved.</span>
      </div>
      <form class="research-search-form" data-history-filter-form>
        <label class="form-wide">
          <span>Search within history index</span>
          <input name="query" type="search" maxlength="180" value="${escapeHtml(state.historyIndex.query || '')}" placeholder="icon, ritual, architecture, archive">
        </label>
        <label>
          <span>Era</span>
          <select name="eraId">
            <option value="all">All eras</option>
            ${eras.map(era => `<option value="${escapeHtml(era.id)}"${state.historyIndex.eraId === era.id ? ' selected' : ''}>${escapeHtml(era.label)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Lane</span>
          <select name="lane">
            <option value="all">Religion + Arts</option>
            ${lanes.map(lane => `<option value="${escapeHtml(lane.id)}"${state.historyIndex.lane === lane.id ? ' selected' : ''}>${escapeHtml(lane.label)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Region</span>
          <select name="region">
            ${regions.map(region => `<option value="${escapeHtml(region)}"${state.historyIndex.region === region ? ' selected' : ''}>${escapeHtml(region === 'all' ? 'All regions' : region)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Type</span>
          <select name="type">
            ${types.map(type => `<option value="${escapeHtml(type)}"${state.historyIndex.type === type ? ' selected' : ''}>${escapeHtml(type === 'all' ? 'All types' : type)}</option>`).join('')}
          </select>
        </label>
      </form>
      <div class="history-index-grid">
        <section class="governance-section">
          <div class="governance-head">
            <strong>Entries</strong>
            <span>${entries.length} visible</span>
          </div>
          <div class="history-entry-list">
            ${entries.length ? entries.map(renderHistoryEntryCard).join('') : '<p class="meta">No history entries match this local cabinet view yet.</p>'}
          </div>
        </section>
        ${renderHistoryEntryDetail(selectedEntry)}
      </div>
    </section>
  `;

  els.list.querySelector('[data-history-filter-form]')?.addEventListener('input', event => {
    const form = new FormData(event.currentTarget);
    state.historyIndex.query = String(form.get('query') || '');
    state.historyIndex.eraId = String(form.get('eraId') || 'all');
    state.historyIndex.lane = String(form.get('lane') || 'all');
    state.historyIndex.region = String(form.get('region') || 'all');
    state.historyIndex.type = String(form.get('type') || 'all');
    renderHistoryIndex();
  });
  els.list.querySelectorAll('[data-history-entry]').forEach(button => {
    button.addEventListener('click', () => {
      state.historyIndex.selectedEntryId = button.dataset.historyEntry;
      renderHistoryIndex();
    });
  });
  els.list.querySelectorAll('[data-history-send]').forEach(button => {
    button.addEventListener('click', () => sendHistoryEntryToGraph(button.dataset.historySend));
  });
}

function renderAssistantWorkspace() {
  const turn = state.assistant.history[0] || null;
  const prompt = state.assistant.input || state.query || '';
  els.list.innerHTML = `
    <section class="assistant-workspace">
      <div class="theme-filter-summary">
        <strong>Project assistant</strong>
        <span>Routes your prompt through translation, context, pattern extraction, or reference without flattening the system into one generic voice.</span>
      </div>
      <div class="shared-graph-review">
        <strong>Local-first assistant</strong>
        <span>It uses your graph, theme system, route evidence, and framework rules first. The API can support it, but the project logic stays primary.</span>
      </div>
      ${state.assistant.message ? `<div class="graph-entry-message is-${escapeHtml(state.assistant.message.type)}">${escapeHtml(state.assistant.message.text)}</div>` : ''}
      <form class="assistant-form" data-assistant-form>
        <label class="form-wide">
          <span>Ask in project language</span>
          <textarea name="prompt" rows="5" maxlength="1200" placeholder="What does pressure do under a winter filter? | scared but hopeful | teal green, sapphire, evergreen">${escapeHtml(prompt)}</textarea>
        </label>
        <div class="assistant-controls">
          <label>
            <span>Route</span>
            <select name="mode">
              <option value="auto" ${state.assistant.mode === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="translate" ${state.assistant.mode === 'translate' ? 'selected' : ''}>Translate</option>
              <option value="context" ${state.assistant.mode === 'context' ? 'selected' : ''}>Context</option>
              <option value="pattern" ${state.assistant.mode === 'pattern' ? 'selected' : ''}>Pattern extraction</option>
              <option value="architecture" ${state.assistant.mode === 'architecture' ? 'selected' : ''}>Architecture</option>
              <option value="path" ${state.assistant.mode === 'path' ? 'selected' : ''}>Path builder</option>
              <option value="reference" ${state.assistant.mode === 'reference' ? 'selected' : ''}>Reference</option>
            </select>
          </label>
          <div class="assistant-actions">
            <button type="button" data-assistant-use-search ${state.query ? '' : 'disabled'}>Use current search</button>
            <button type="button" data-assistant-clear ${state.assistant.history.length ? '' : 'disabled'}>Clear</button>
            <button class="primary-command" type="submit" ${state.assistant.loading ? 'disabled' : ''}>${state.assistant.loading ? 'Thinking...' : 'Run assistant'}</button>
          </div>
        </div>
      </form>
      ${turn ? renderAssistantTurn(turn) : `
        <div class="assistant-empty">
          <strong>Ready</strong>
          <p>Ask for a translation, a pattern read, a node context check, a path build, or a system architecture read. Auto mode will choose the best route first.</p>
          <div class="assistant-copy">
            <p><strong>What this assistant can do:</strong> translate color-climate input, inspect stored experience, trace routes, explain system rules, extract repeated patterns, and build travel paths through the graph.</p>
          </div>
          <div class="theme-token-row">
            <span>scared but hopeful</span>
            <span>pressure under winter</span>
            <span>fear</span>
            <span>teal green, sapphire, evergreen</span>
            <span>what are the rules for route evidence?</span>
            <span>what are the minimum node types?</span>
            <span>build a path from fear to obsidian</span>
          </div>
        </div>
      `}
    </section>
  `;

  els.list.querySelector('[data-assistant-form]')?.addEventListener('submit', submitAssistantPrompt);
  els.list.querySelector('[data-assistant-use-search]')?.addEventListener('click', () => {
    state.assistant.input = state.query || '';
    renderAssistantWorkspace();
  });
  els.list.querySelector('[data-assistant-clear]')?.addEventListener('click', () => {
    state.assistant.history = [];
    state.assistant.message = null;
    state.assistant.input = '';
    renderAssistantWorkspace();
  });
  els.list.querySelectorAll('[data-assistant-select-node]').forEach(button => {
    button.addEventListener('click', () => {
      const nodeId = button.dataset.assistantSelectNode;
      if (!nodeId) return;
      state.selectedId = nodeId;
      render();
    });
  });
}

function renderAssistantTurn(turn) {
  return `
    <article class="assistant-turn">
      <div class="assistant-turn-head">
        <strong>${escapeHtml(turn.title)}</strong>
        <span>${escapeHtml(turn.routeLabel)}</span>
      </div>
      <p class="assistant-prompt">${escapeHtml(turn.prompt)}</p>
      ${turn.summary ? `<p>${escapeHtml(turn.summary)}</p>` : ''}
      ${turn.sections?.length ? turn.sections.map(section => renderAssistantSection(section)).join('') : '<p class="meta">No supported route yet.</p>'}
      ${turn.boundary ? `<p class="meta">${escapeHtml(turn.boundary)}</p>` : ''}
    </article>
  `;
}

function renderAssistantSection(section) {
  if (section.type === 'tokens') {
    return `
      <div class="assistant-section">
        <div class="context-heading">${escapeHtml(section.label)}</div>
        <div class="theme-token-row">
          ${(section.items || []).map(item => `<span>${escapeHtml(item)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  if (section.type === 'nodes') {
    return `
      <div class="assistant-section">
        <div class="context-heading">${escapeHtml(section.label)}</div>
        <div class="assistant-node-grid">
          ${(section.items || []).map(item => `
            <button class="assistant-node-card" type="button" data-assistant-select-node="${escapeHtml(item.id)}">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.subtitle)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div class="assistant-section">
      <div class="context-heading">${escapeHtml(section.label)}</div>
      <div class="assistant-copy">${(section.lines || []).map(line => `<p>${escapeHtml(line)}</p>`).join('')}</div>
    </div>
  `;
}

async function submitAssistantPrompt(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const prompt = String(form.get('prompt') || '').trim();
  const mode = String(form.get('mode') || 'auto');
  state.assistant.input = prompt;
  state.assistant.mode = mode;
  state.assistant.message = null;
  if (!prompt) {
    state.assistant.message = { type: 'error', text: 'Give the assistant a prompt first.' };
    return renderAssistantWorkspace();
  }
  state.assistant.loading = true;
  renderAssistantWorkspace();
  try {
    const turn = await runProjectAssistant(prompt, mode);
    state.assistant.history.unshift(turn);
    state.assistant.history = state.assistant.history.slice(0, 8);
  } catch (error) {
    state.assistant.message = { type: 'error', text: error.message };
  } finally {
    state.assistant.loading = false;
    renderAssistantWorkspace();
  }
}

async function runProjectAssistant(prompt, mode = 'auto') {
  const route = assistantRouteForPrompt(prompt, mode);
  if (route === 'translate') return assistantTranslateTurn(prompt);
  if (route === 'pattern') return assistantPatternTurn(prompt);
  if (route === 'context') return assistantContextTurn(prompt);
  if (route === 'architecture') return assistantArchitectureTurn(prompt);
  if (route === 'path') return assistantPathTurn(prompt);
  return assistantReferenceTurn(prompt);
}

function assistantRouteForPrompt(prompt, mode = 'auto') {
  if (mode && mode !== 'auto') return mode;
  const normalized = String(prompt || '').toLowerCase().trim();
  if (!normalized) return 'translate';
  if (/[,+\n]/.test(normalized) || /\b(pattern|repetition|repeated|selection|set|cluster|choices)\b/.test(normalized)) return 'pattern';
  if (/\b(ai|assistant|system|architecture|minimum node types|node type|types|clutter|species|forest|what kind of thing)\b/.test(normalized)) return 'architecture';
  if (/\b(path|route|travel|from .* to|connect .* to|routes from|routes into|how does it connect)\b/.test(normalized)) return 'path';
  if (/\b(reference|rules|framework|axes|anchor|white light|filter|theme|route evidence)\b/.test(normalized)) return 'reference';
  if (/\b(context|relationship|related|compare|neighbor|connection|why does|why is|graph)\b/.test(normalized)) return 'context';
  return 'translate';
}

function assistantTranslateTurn(prompt) {
  const analysis = analyzeInputContext(prompt);
  const result = resolveTranslation(prompt, analysis);
  return {
    title: 'Translation assistant',
    routeLabel: 'translate',
    prompt,
    summary: result.primaryLanding
      ? `The assistant found a supported route into ${result.primaryLanding.family || result.primaryLanding.node?.label || 'a landing'}.`
      : (result.unresolvedReason || 'No supported route was found.'),
    sections: [
      {
        label: 'Input',
        lines: [prompt]
      },
      {
        label: 'Supported route',
        lines: result.paths.length
          ? result.paths.slice(0, 3).map(path => `${path.nodes.join(' -> ')} (${path.confidence})`)
          : [result.unresolvedReason || 'No evidence-backed route yet.']
      },
      result.primaryLanding ? {
        label: 'Color-climate landing',
        lines: [`${result.primaryLanding.family || result.primaryLanding.node?.label || 'landing'} via ${result.primaryLanding.node?.label || 'node'}`]
      } : null,
      result.themeRead ? {
        label: 'Theme / filter read',
        lines: [
          `${result.themeRead.source} + ${result.themeRead.filter} -> ${result.themeRead.theme}`,
          result.themeRead.emotionalClimate || ''
        ].filter(Boolean)
      } : null,
      result.logicChecks ? {
        label: 'Logic + feeling checks',
        lines: [result.logicChecks.summary || result.logicChecks.primaryCheck || 'Supported route was checked against system boundaries.'].filter(Boolean)
      } : null,
      result.humanBridges?.length ? {
        type: 'tokens',
        label: 'Human bridges',
        items: result.humanBridges.map(item => `${item.label} · ${item.strength}`)
      } : null
    ].filter(Boolean),
    boundary: result.logicChecks?.boundary || result.themeRead?.boundary || AI_BOUNDARY_FALLBACK()
  };
}

function assistantPatternTurn(prompt) {
  const read = selectionClimateForQuery(prompt);
  if (!read) {
    return {
      title: 'Pattern extraction assistant',
      routeLabel: 'pattern extraction',
      prompt,
      summary: 'The assistant could not confirm a repeated supported pattern yet.',
      sections: [
        {
          label: 'Boundary',
          lines: ['Pattern extraction needs at least two supported repeated selections before inference becomes defensible.']
        }
      ],
      boundary: AI_BOUNDARY_FALLBACK()
    };
  }
  return {
    title: 'Pattern extraction assistant',
    routeLabel: 'pattern extraction',
    prompt,
    summary: read.finalRead,
    sections: [
      {
        type: 'tokens',
        label: 'Extracted attributes',
        items: (read.extractedAttributes || []).map(item => `${item.label} x${item.count}`)
      },
      {
        label: 'Observable pattern',
        lines: read.observablePatterns
      },
      {
        label: 'Inferred preference',
        lines: read.inferredPreferences
      },
      {
        label: 'Environment condition',
        lines: [read.environmentCondition || 'Repeated choices create the condition more than any one symbol alone.']
      },
      {
        label: 'Filter read',
        lines: [read.filterRead]
      }
    ],
    boundary: read.boundary || AI_BOUNDARY_FALLBACK()
  };
}

function assistantContextTurn(prompt) {
  const results = graphAwareSearch(prompt);
  const exact = (results.exact || []).slice(0, 4).map(node => assistantNodeCard(node, 'exact match'));
  const connected = (results.connected || []).slice(0, 4).map(item => assistantNodeCard(item.node, item.reason || 'connected match'));
  const emotion = (results.emotions || []).slice(0, 3).map(item => ({
    id: item.node?.id || item.id || '',
    label: item.node?.label || item.label || 'emotion path',
    subtitle: item.route?.join(' -> ') || item.reason || 'emotion path'
  }));
  const sections = [];
  if (exact.length) sections.push({ type: 'nodes', label: 'Exact matches', items: exact });
  if (connected.length) sections.push({ type: 'nodes', label: 'Connected matches', items: connected });
  if (emotion.length) sections.push({ type: 'nodes', label: 'Emotion paths', items: emotion });
  if (!sections.length) {
    sections.push({
      label: 'Context result',
      lines: ['No strong stored route context surfaced from the current local field.']
    });
  }
  return {
    title: 'Context assistant',
    routeLabel: 'context',
    prompt,
    summary: sections.length && (exact.length || connected.length)
      ? 'The assistant found nearby stored experience and route context to inspect.'
      : 'The assistant did not find a strong local context route.',
    sections,
    boundary: 'Node descriptions and route evidence can support a read, but they do not replace actual graph edges or proof by themselves.'
  };
}

function assistantArchitectureTurn(prompt) {
  const results = graphAwareSearch(prompt);
  const exactNodes = (results.exact || []).slice(0, 4);
  const exactCards = exactNodes.map(node => assistantNodeCard(node, `stored as ${nodeStructureInfo(node).label.toLowerCase()}`));
  const minimumTypes = CORE_NODE_TYPE_ORDER.map(typeId => STRUCTURAL_TYPE_DEFS[typeId].label).join(', ');
  const supportTypes = SUPPORT_NODE_TYPE_ORDER.map(typeId => STRUCTURAL_TYPE_DEFS[typeId].label).join(', ');
  const sections = [
    {
      label: 'System frame',
      lines: [
        'Node -> Type -> Context -> Relationships -> Verification.',
        'The graph should answer what connects.',
        'Node descriptions plus route evidence should answer why the node fits and how we know.'
      ]
    },
    {
      label: 'Node schema ladder',
      lines: [
        'Base color family -> Secondary color -> Shade -> Synonym.',
        'Natural source can connect across those levels because it gives the route real-world context instead of acting like a flat synonym.'
      ]
    },
    {
      label: 'Minimum node species',
      lines: [
        `Core: ${minimumTypes}.`,
        `Support: ${supportTypes}.`,
        'Everything else should usually become a relationship, condition, or evidence layer instead of a competing base type.'
      ]
    },
    {
      label: 'Why this reduces clutter',
      lines: [
        'Color is one layer of the system, not the whole graph.',
        'Leaves should not act like trees: a shade is not the same kind of thing as an object, an emotion, or a condition.',
        'When the computer knows the type first, path travel becomes cleaner and context becomes more trustworthy.'
      ]
    }
  ];

  if (exactCards.length) {
    sections.unshift({
      type: 'nodes',
      label: 'Nodes surfaced by your prompt',
      items: exactCards
    });
  }

  return {
    title: 'Architecture assistant',
    routeLabel: 'architecture',
    prompt,
    summary: 'The assistant treated this as a system-design question and answered from node types, context layers, and route verification structure.',
    sections,
    boundary: 'Type architecture organizes the graph for the computer. It does not remove relational ambiguity by itself; the routes still need evidence and context.'
  };
}

function assistantPathTurn(prompt) {
  const analysis = analyzeInputContext(prompt);
  const result = resolveTranslation(prompt, analysis);
  const context = graphAwareSearch(prompt);
  const anchorNodes = uniqueNodes([
    ...(context.exact || []),
    ...(context.connected || []).map(item => item.node)
  ]).slice(0, 4);
  const pathLines = [];

  (result.paths || []).slice(0, 4).forEach(path => {
    const health = pathRouteHealth(path);
    const score = structuralPathSummary(path);
    pathLines.push(`${path.nodes.join(' -> ')} · ${health} · ${score.shortLabel}`);
  });

  anchorNodes.forEach(node => {
    outgoing(node.id).slice(0, 2).forEach(edge => {
      const target = state.nodeById.get(edge.target);
      if (!target) return;
      pathLines.push(`${node.label} -> ${target.label} · routes from · ${edge.type}`);
    });
    incoming(node.id).slice(0, 2).forEach(edge => {
      const source = state.nodeById.get(edge.source);
      if (!source) return;
      pathLines.push(`${source.label} -> ${node.label} · routes into · ${edge.type}`);
    });
  });

  const uniquePathLines = uniqueStrings(pathLines).slice(0, 10);
  const nodeCards = anchorNodes.map(node => assistantNodeCard(node, `${nodeStructureInfo(node).shortLabel}`));

  return {
    title: 'Path builder assistant',
    routeLabel: 'path builder',
    prompt,
    summary: uniquePathLines.length
      ? 'The assistant found travelable routes through the current graph and separated outgoing from incoming movement.'
      : 'The assistant could not confirm a strong path from the current local graph.',
    sections: [
      nodeCards.length ? {
        type: 'nodes',
        label: 'Anchor nodes',
        items: nodeCards
      } : null,
      {
        label: 'Travel paths',
        lines: uniquePathLines.length
          ? uniquePathLines
          : ['No supported path surfaced yet. Try a more specific node, color, emotion, or condition term.']
      },
      {
        label: 'Path rule',
        lines: [
          'A path is stronger when node types differ cleanly across the route.',
          'A path is weaker when it only sounds poetic but cannot show type, relation, and verification support.'
        ]
      }
    ].filter(Boolean),
    boundary: 'Paths are context travel, not proof by themselves. Trust should rise when route health, node type, and route evidence agree.'
  };
}

function assistantReferenceTurn(prompt) {
  const reference = {
    whiteLight: state.data?.themeTranslator?.sourceDefault || 'white light',
    grammar: state.data?.themeTranslator?.grammar || 'source + filter -> theme',
    boundary: state.data?.themeTranslator?.boundary || AI_BOUNDARY_FALLBACK(),
    rivers: [
      'Climate River',
      'Relationship River'
    ],
  };
  return {
    title: 'Framework reference assistant',
    routeLabel: 'reference',
    prompt,
    summary: 'The assistant answered from the project rules and preferred structures.',
    sections: [
      {
        label: 'Core grammar',
        lines: [
          `White light: ${reference.whiteLight}`,
          `Theme grammar: ${reference.grammar}`,
          'Meaning comes from relation before isolated label.'
        ]
      },
      {
        type: 'tokens',
        label: 'Compass rivers',
        items: reference.rivers
      },
      {
        label: 'System stance',
        lines: [
          'Themes are conditions or filters, not permanent essence.',
          'Relationship River asks how a node changes when another node is involved.',
          'Mixed climates can coexist.',
          'If the route cannot be named, keep the read weak or unresolved.'
        ]
      }
    ],
    boundary: reference.boundary
  };
}

function assistantNodeCard(node, subtitle = '') {
  return {
    id: node.id,
    label: node.label,
    subtitle: `${nodeTypeInfo(node.type).label}${node.family ? ` · ${node.family}` : ''}${subtitle ? ` · ${subtitle}` : ''}`
  };
}

function AI_BOUNDARY_FALLBACK() {
  return 'This is a relational climate read, not a diagnosis or permanent identity claim.';
}

function renderResearchSuggestions(suggestions) {
  const matches = suggestions.graphMatches || [];
  return `
    <div class="research-suggestions">
      <div class="governance-head"><strong>Possible route context</strong><span class="status-pill">${escapeHtml(suggestions.strength || 'unresolved')}</span></div>
      ${matches.length ? `<div class="research-chips">${matches.map(match => `<span>${escapeHtml(match.label)} · ${escapeHtml(match.type)}${match.family ? ` · ${escapeHtml(match.family)}` : ''}</span>`).join('')}</div>` : '<p class="meta">No lexical graph leads found.</p>'}
      <p class="meta">${escapeHtml(suggestions.boundary || '')}</p>
    </div>`;
}

function renderResearchResult(item, index) {
  const defaultLane = /art|icon|architecture|manuscript|painting|music|theater|performance/i.test(`${item.title} ${item.excerpt}`) ? 'arts' : 'religion';
  return `
    <form class="research-record research-result" data-save-research="${index}">
      <div class="governance-head">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.sourceName)} · ${escapeHtml(item.sourceType)}</span>
      </div>
      <p>${escapeHtml(item.excerpt || 'No abstract or excerpt supplied by this source.')}</p>
      <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Open source</a>
      <div class="research-evidence-form">
        <label><span>Save mode</span><select name="kind"><option value="general">General evidence</option><option value="history_index">History index record</option></select></label>
        <label class="form-wide"><span>Emotional or relational logic</span><textarea name="emotionalLogic" rows="2" placeholder="What structured relation might this evidence help explain?"></textarea></label>
        <label><span>Era</span><select name="eraId">
          <option value="prehistory-ancient">Prehistory / Ancient</option>
          <option value="classical">Classical</option>
          <option value="medieval-post-classical">Medieval / Post-classical</option>
          <option value="early-modern">Early Modern</option>
          <option value="modern">Modern</option>
          <option value="contemporary">Contemporary</option>
        </select></label>
        <label><span>Lane</span><select name="lane"><option value="religion"${defaultLane === 'religion' ? ' selected' : ''}>Religion</option><option value="arts"${defaultLane === 'arts' ? ' selected' : ''}>Arts</option></select></label>
        <label><span>Type</span><input name="historyType" type="text" maxlength="120" placeholder="tradition, movement, symbol, architecture"></label>
        <label><span>Region / civilization</span><input name="region" type="text" maxlength="160" placeholder="Byzantine Empire, Europe, Nile Valley"></label>
        <label class="form-wide"><span>History summary</span><textarea name="historySummary" rows="2" placeholder="Short orientation summary for the history index."></textarea></label>
        <label class="form-wide"><span>Route seeds</span><input name="routeSeeds" type="text" maxlength="320" placeholder="ritual, icon, devotion, archive, architecture"></label>
        <label class="form-wide"><span>Theme conditions</span><input name="themeConditions" type="text" maxlength="120" value="${escapeHtml(titleCase(defaultLane))}" placeholder="Religion, Arts"></label>
        <label class="form-wide"><span>Anchor hints</span><input name="anchorHints" type="text" maxlength="180" placeholder="gold, midnight, green"></label>
        <label class="form-wide"><span>Boundary</span><textarea name="boundary" rows="2" required>${escapeHtml(item.boundary || 'Research context, not a strict synonym or universal emotional claim.')}</textarea></label>
        <label class="form-wide"><span>Counterexample / falsification condition</span><textarea name="counterexample" rows="2" required placeholder="What would show that this connection does not hold?"></textarea></label>
        <label><span>Confidence</span><select name="confidence"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <button class="primary-command" type="submit">Save as proposed evidence</button>
      </div>
    </form>`;
}

function renderResearchRecord(item, isAdmin) {
  const suggestions = item.suggestions?.graphMatches || [];
  const awaitingReview = ['proposed', 'needs_revision'].includes(item.status);
  return `
    <article class="research-record">
      <div class="governance-head">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="status-pill is-${escapeHtml(item.status)}">${escapeHtml(item.status.replaceAll('_', ' '))}</span>
      </div>
      <small>${escapeHtml(item.source_name)} · ${escapeHtml(item.proposed_by_name || 'unknown')} · ${escapeHtml(formatDateTime(item.created_at))}</small>
      <p>${escapeHtml(item.excerpt || 'No excerpt.')}</p>
      <a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">Open evidence source</a>
      ${item.kind === 'history_index' ? `<p><strong>History index:</strong> ${(item.history_metadata?.eraId || 'unknown')} · ${(item.history_metadata?.lane || 'unknown')} · ${(item.history_metadata?.type || 'record')}</p>` : ''}
      ${item.history_metadata?.routeSeeds?.length ? `<div class="research-chips">${item.history_metadata.routeSeeds.map(seed => `<span>${escapeHtml(seed)}</span>`).join('')}</div>` : ''}
      ${item.emotional_logic ? `<p><strong>Logic:</strong> ${escapeHtml(item.emotional_logic)}</p>` : ''}
      <p><strong>Boundary:</strong> ${escapeHtml(item.boundary)}</p>
      <p><strong>Counterexample:</strong> ${escapeHtml(item.counterexample)}</p>
      ${suggestions.length ? `<div class="research-chips">${suggestions.map(match => `<span>${escapeHtml(match.label)}</span>`).join('')}</div>` : ''}
      ${item.review_note ? `<p><strong>Review:</strong> ${escapeHtml(item.review_note)}</p>` : ''}
      ${isAdmin && awaitingReview ? `<div class="governance-actions">
        <button type="button" data-research-id="${escapeHtml(item.id)}" data-research-decision="approved">Approve evidence</button>
        <button type="button" data-research-id="${escapeHtml(item.id)}" data-research-decision="needs_revision">Needs revision</button>
        <button type="button" data-research-id="${escapeHtml(item.id)}" data-research-decision="rejected">Reject</button>
      </div>` : ''}
      ${isAdmin && item.status === 'approved' && !item.graph_proposal_id ? `<button class="primary-command" type="button" data-research-graph-proposal="${escapeHtml(item.id)}">Create graph proposal</button>` : ''}
      ${item.graph_proposal_id ? `<small>Graph proposal: ${escapeHtml(item.graph_proposal_id)}</small>` : ''}
    </article>`;
}

async function searchResearch(event) {
  event.preventDefault();
  if (!state.auth.user) return;
  const form = new FormData(event.currentTarget);
  const query = String(form.get('query') || '').trim();
  const sources = form.getAll('sources');
  if (!sources.length) {
    state.research.message = { type: 'error', text: 'Choose at least one research source.' };
    return renderResearchInbox();
  }
  state.research.loading = true;
  state.research.message = null;
  state.research.query = query;
  renderResearchInbox();
  try {
    const params = new URLSearchParams({ q: query, sources: sources.join(',') });
    const response = await fetch(`${API_BASE_URL}/v1/research/search?${params}`, { headers: authHeaders(), cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Research search failed: ${response.status}`);
    state.research.results = result.results || [];
    state.research.suggestions = result.suggestions || null;
    state.research.warnings = result.warnings || [];
    state.research.message = { type: 'success', text: `${state.research.results.length} evidence leads found${result.cached ? ' from the short-term cache' : ''}.` };
  } catch (error) {
    state.research.message = { type: 'error', text: error.message };
  } finally {
    state.research.loading = false;
    renderResearchInbox();
  }
}

async function saveResearchResult(event) {
  event.preventDefault();
  const index = Number(event.currentTarget.dataset.saveResearch);
  const candidate = state.research.results[index];
  if (!candidate) return;
  const values = new FormData(event.currentTarget);
  try {
    const response = await fetch(`${API_BASE_URL}/v1/research/items`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        query: state.research.query,
        title: candidate.title,
        kind: values.get('kind'),
        sourceName: candidate.sourceName,
        sourceType: candidate.sourceType,
        sourceUrl: candidate.url,
        excerpt: candidate.excerpt,
        publishedAt: candidate.publishedAt,
        suggestions: { ...(state.research.suggestions || {}), externalId: candidate.externalId, retrievedAt: candidate.retrievedAt },
        historyMetadata: {
          eraId: values.get('eraId'),
          lane: values.get('lane'),
          region: values.get('region'),
          type: values.get('historyType'),
          summary: values.get('historySummary'),
          wikipediaTitle: candidate.title,
          sourceNote: `${candidate.sourceName} orientation record`,
          routeSeeds: String(values.get('routeSeeds') || '').split(',').map(item => item.trim()).filter(Boolean),
          themeConditions: String(values.get('themeConditions') || '').split(',').map(item => item.trim()).filter(Boolean),
          anchorHints: String(values.get('anchorHints') || '').split(',').map(item => item.trim()).filter(Boolean)
        },
        emotionalLogic: values.get('emotionalLogic'),
        boundary: values.get('boundary'),
        counterexample: values.get('counterexample'),
        confidence: values.get('confidence')
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Research item could not be saved: ${response.status}`);
    state.research.message = { type: 'success', text: 'Evidence saved as proposed. It is waiting for review.' };
    await loadResearchItems(false);
  } catch (error) {
    state.research.message = { type: 'error', text: error.message };
    renderResearchInbox();
  }
}

async function loadResearchItems(showLoading = true) {
  if (!state.auth.user) return;
  if (showLoading) {
    state.research.loading = true;
    renderResearchInbox();
  }
  try {
    const response = await fetch(`${API_BASE_URL}/v1/research/items`, { headers: authHeaders(), cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Research inbox could not load: ${response.status}`);
    state.research.items = result.items || [];
    state.research.loaded = true;
  } catch (error) {
    state.research.message = { type: 'error', text: error.message };
  } finally {
    state.research.loading = false;
    if (state.view === 'research') renderResearchInbox();
  }
}

async function reviewResearchItem(id, decision) {
  const reviewNote = window.prompt(`Review note for ${decision.replaceAll('_', ' ')}:`);
  if (!reviewNote?.trim()) return;
  await researchMutation(`${API_BASE_URL}/v1/research/items/${id}/review`, 'PATCH', { decision, reviewNote }, `Evidence marked ${decision.replaceAll('_', ' ')}.`);
}

async function createResearchGraphProposal(id) {
  const item = state.research.items.find(entry => entry.id === id);
  if (!item) return;
  const label = window.prompt('Graph label for this proposal:', item.query);
  if (!label?.trim()) return;
  const suggestedFamily = item.suggestions?.graphMatches?.find(match => match.family)?.family || '';
  const family = window.prompt('Color family or mixture (optional):', suggestedFamily);
  await researchMutation(`${API_BASE_URL}/v1/research/items/${id}/graph-proposal`, 'POST', { label, family: family?.trim() || null }, 'A separate graph proposal was created. The graph has not changed yet.');
}

async function researchMutation(url, method, body, successText) {
  try {
    const response = await fetch(url, { method, headers: authHeaders(true), body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Research request failed: ${response.status}`);
    state.research.message = { type: 'success', text: successText };
    await loadResearchItems(false);
  } catch (error) {
    state.research.message = { type: 'error', text: error.message };
    renderResearchInbox();
  }
}

function renderSharedGraphEditor(message = null) {
  const databaseNodes = state.nodes
    .filter(node => state.dataSource.databaseNodeIds.has(node.id))
    .sort((a, b) => a.label.localeCompare(b.label));
  const suggestedLabel = state.query ? titleCase(state.query) : '';
  const signedIn = Boolean(state.auth.user);
  const isAdmin = state.auth.user?.role === 'admin';
  const available = state.dataSource.apiAvailable && state.dataSource.apiGraphCount > 0 && signedIn;
  els.list.innerHTML = `
    <section class="shared-graph-editor">
      <div class="theme-filter-summary">
        <strong>Shared graph editor</strong>
        <span>Propose, review, approve, revise, delete, and undo shared PostgreSQL graph information.</span>
      </div>
      <div class="shared-graph-review">
        <strong>Model the type before the path.</strong>
        <span>Ask what kind of thing the node is first: color, shade, object, emotion, word, sense, theme, condition, or evidence support.</span>
      </div>
      ${message ? `<div class="graph-entry-message is-${escapeHtml(message.type)}">${escapeHtml(message.text)}</div>` : ''}
      ${!signedIn ? '<div class="graph-entry-message is-error">Sign in before proposing or reviewing shared graph changes.</div>' : ''}
      ${signedIn && (!state.dataSource.apiAvailable || state.dataSource.apiGraphCount <= 0) ? '<div class="graph-entry-message is-error">The database graph must be connected before shared entries can be added.</div>' : ''}
      <form class="shared-graph-form" data-shared-graph-form>
        <fieldset ${available ? '' : 'disabled'}>
          <legend>Proposal</legend>
          <label>
            <span>Operation</span>
            <select name="operation" data-governance-operation>
              <option value="create">Create node</option>
              <option value="edit">Edit existing node</option>
              <option value="delete">Delete existing node</option>
            </select>
          </label>
          <label>
            <span>Author</span>
            <input name="author" required maxlength="100" value="${escapeHtml(state.auth.user?.username || '')}" readonly>
          </label>
          <label class="form-wide" data-target-field hidden>
            <span>Existing node</span>
            <input name="targetId" list="shared-node-options" placeholder="Select an existing node id">
          </label>
          <label class="form-wide">
            <span>Why this change is needed</span>
            <textarea name="rationale" required rows="2" placeholder="State the reason for proposing this change."></textarea>
          </label>
        </fieldset>

        <fieldset ${available ? '' : 'disabled'} data-node-fields>
          <legend>Node</legend>
          <label>
            <span>Word or concept</span>
            <input name="label" required maxlength="120" value="${escapeHtml(suggestedLabel)}" placeholder="winter room">
          </label>
          <label>
            <span>Node type</span>
            <select name="type" required>
              ${sharedGraphNodeTypes().map(type => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)}</option>`).join('')}
            </select>
          </label>
          <div class="governance-type-preview" data-type-preview></div>
          <label>
            <span>Color family or mixture</span>
            <input name="family" list="shared-family-options" placeholder="blue-gray">
          </label>
          <datalist id="shared-family-options">
            ${Object.keys(FAMILY_COLORS).filter(familyColorExists).sort().map(family => `<option value="${escapeHtml(family)}"></option>`).join('')}
          </datalist>
          <label>
            <span>Hex shade (optional)</span>
            <input name="hexColor" pattern="#[0-9A-Fa-f]{6}" placeholder="#6c8499">
          </label>
          <label class="form-wide">
            <span>Definition</span>
            <textarea name="definition" required rows="3" placeholder="What this word or concept means in the shared system."></textarea>
          </label>
          <label class="form-wide">
            <span>Emotional logic</span>
            <textarea name="emotionalLogic" rows="3" placeholder="Why this route belongs near this climate, without claiming permanent identity."></textarea>
          </label>
          <label class="form-wide">
            <span>Boundary</span>
            <textarea name="boundary" required rows="2">Relational color-climate context, not a strict synonym, diagnosis, or permanent identity.</textarea>
          </label>
        </fieldset>

        <fieldset ${available ? '' : 'disabled'} data-relationship-fields>
          <legend>Optional relationship and route evidence</legend>
          <label class="form-wide">
            <span>Connect to existing node</span>
            <input name="target" list="shared-node-options" placeholder="family-blue">
          </label>
          <datalist id="shared-node-options">
            ${databaseNodes.map(node => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.label)} · ${escapeHtml(node.type)}</option>`).join('')}
          </datalist>
          <label>
            <span>Relationship type</span>
            <select name="relationshipType">
              <option value="">No relationship</option>
              ${sharedGraphRelationshipTypes().map(type => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span>Confidence</span>
            <select name="confidence">
              <option value="high">High</option>
              <option value="medium" selected>Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label class="form-wide">
            <span>Route evidence or reason</span>
            <textarea name="evidence" rows="3" placeholder="Explain why this route is defensible."></textarea>
          </label>
          <label>
            <span>Route evidence source</span>
            <input name="evidenceSource" placeholder="Dictionary, study, observation, system rule">
          </label>
          <label>
            <span>Route evidence type</span>
            <select name="evidenceType">
              ${['definition','dictionary','cultural','historical','scientific','artistic','observational','personal_pattern','system_rule'].map(type => `<option value="${type}">${titleCase(type.replace('_', ' '))}</option>`).join('')}
            </select>
          </label>
          <label class="form-wide">
            <span>Relationship boundary</span>
            <textarea name="evidenceBoundary" rows="2">Translator context, not a strict synonym or permanent identity.</textarea>
          </label>
          <label class="form-wide">
            <span>Counterexample / falsification condition</span>
            <textarea name="counterexample" rows="2" placeholder="What observation would weaken or disprove this connection?"></textarea>
          </label>
        </fieldset>

        <div class="shared-graph-review">
          <strong>Review boundary</strong>
          <span>Submitting creates a proposal. It enters the approved graph only after a separate review and approval.</span>
        </div>
        <button class="primary-command" type="submit" ${available ? '' : 'disabled'}>Submit proposal</button>
      </form>

      ${isAdmin ? `<section class="governance-section">
        <div class="alias-family-heading"><strong>Approval queue</strong><span>${state.governance.proposals.length} records</span></div>
        <div data-proposal-list>${renderGovernanceProposals()}</div>
      </section>
      <section class="governance-section">
        <div class="alias-family-heading"><strong>Change history</strong><span>${state.governance.history.length} records</span></div>
        <div data-history-list>${renderGovernanceHistory()}</div>
      </section>` : '<section class="governance-section"><p class="meta">Administrators review proposals and change history.</p></section>'}
    </section>
  `;

  els.list.querySelector('[data-shared-graph-form]')?.addEventListener('submit', submitSharedGraphEntry);
  els.list.querySelector('[data-governance-operation]')?.addEventListener('change', updateGovernanceFormMode);
  els.list.querySelector('[data-shared-graph-form] select[name="type"]')?.addEventListener('change', updateSharedGraphTypePreview);
  updateSharedGraphTypePreview();
  bindGovernanceActions();
  if (isAdmin && !state.governance.loaded && !state.governance.loading && available) loadGovernanceData();
}

function updateSharedGraphTypePreview() {
  const preview = els.list.querySelector('[data-type-preview]');
  const typeField = els.list.querySelector('[data-shared-graph-form] select[name="type"]');
  if (!preview || !typeField) return;
  const info = nodeStructureInfo({ type: typeField.value, metadata: {} });
  preview.innerHTML = `
    <strong>${escapeHtml(info.label)}</strong>
    <span>${escapeHtml(info.description)}</span>
    <small><strong>Computer asks:</strong> ${escapeHtml(info.computerQuestion)}</small>
    <small><strong>Why store it this way:</strong> ${escapeHtml(info.migrationHint)}</small>
  `;
}

function updateGovernanceFormMode(event) {
  const form = event.currentTarget.form;
  const operation = event.currentTarget.value;
  const targetField = form.querySelector('[data-target-field]');
  const nodeFields = form.querySelector('[data-node-fields]');
  const relationshipFields = form.querySelector('[data-relationship-fields]');
  targetField.hidden = operation === 'create';
  targetField.querySelector('input').required = operation !== 'create';
  nodeFields.hidden = operation === 'delete';
  nodeFields.disabled = operation === 'delete';
  relationshipFields.hidden = operation !== 'create';
  relationshipFields.disabled = operation !== 'create';
}

function renderGovernanceProposals() {
  if (state.governance.loading) return '<p class="meta">Loading proposals...</p>';
  if (!state.governance.proposals.length) return '<p class="meta">No proposals yet.</p>';
  return state.governance.proposals.map(proposal => `
    <article class="governance-record">
      <div class="governance-head">
        <strong>${escapeHtml(proposal.payload?.node?.label || proposal.target_id || proposal.operation)}</strong>
        <span class="status-pill is-${escapeHtml(proposal.status)}">${escapeHtml(proposal.status)}</span>
      </div>
      <small>${escapeHtml(proposal.operation)} · by ${escapeHtml(proposal.author)} · ${escapeHtml(formatDateTime(proposal.created_at))}</small>
      <p>${escapeHtml(proposal.rationale)}</p>
      ${renderProposalFaceSummary(proposal.payload?.node)}
      ${proposal.review_note ? `<p><strong>Review:</strong> ${escapeHtml(proposal.review_note)}</p>` : ''}
      <div class="governance-actions">
        ${proposal.status === 'proposed' ? `<button type="button" data-review-proposal="${proposal.id}">Mark reviewed</button><button type="button" data-reject-proposal="${proposal.id}">Reject</button>` : ''}
        ${proposal.status === 'reviewed' ? `<button type="button" data-approve-proposal="${proposal.id}">Approve</button>` : ''}
      </div>
    </article>
  `).join('');
}

function renderGovernanceHistory() {
  if (state.governance.loading) return '<p class="meta">Loading history...</p>';
  if (!state.governance.history.length) return '<p class="meta">No approved changes yet.</p>';
  return state.governance.history.map(item => `
    <article class="governance-record">
      <div class="governance-head"><strong>${escapeHtml(item.entity_id)}</strong><span>${escapeHtml(item.action)}</span></div>
      <small>${escapeHtml(item.author)} · ${escapeHtml(formatDateTime(item.created_at))}</small>
      <p>${escapeHtml(item.reason)}</p>
      ${renderHistoryFaceSummary(item.after_data)}
      <div class="governance-actions">${item.undone_at ? '<span class="meta">Already undone</span>' : `<button type="button" data-undo-history="${item.id}">Undo this change</button>`}</div>
    </article>
  `).join('');
}

function renderProposalFaceSummary(nodeData) {
  const metadata = nodeData?.metadata || {};
  const structure = nodeData?.type ? nodeStructureInfo({ type: nodeData.type, metadata }) : null;
  if (!structure && !metadata.definition && !metadata.emotionalLogic) return '';
  return `
    <div class="governance-face-summary">
      <strong>Node summary</strong>
      ${structure ? `<span>${escapeHtml(`${structure.label} · ${structure.shortLabel}`)}</span>` : ''}
      ${metadata.definition ? `<small>${escapeHtml(metadata.definition)}</small>` : ''}
    </div>
  `;
}

function renderHistoryFaceSummary(afterData) {
  const nodeData = afterData?.node || (afterData?.metadata ? afterData : null);
  if (!nodeData) return '';
  return renderProposalFaceSummary(nodeData);
}

async function loadGovernanceData(message = null) {
  state.governance.loading = true;
  renderSharedGraphEditor(message);
  try {
    const [proposalsResponse, historyResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/v1/graph/proposals`, { cache: 'no-store', headers: authHeaders() }),
      fetch(`${API_BASE_URL}/v1/graph/history`, { cache: 'no-store', headers: authHeaders() })
    ]);
    if (!proposalsResponse.ok || !historyResponse.ok) throw new Error('Governance records could not load.');
    const proposals = await proposalsResponse.json();
    const history = await historyResponse.json();
    state.governance.proposals = proposals.proposals || [];
    state.governance.history = history.history || [];
    state.governance.loaded = true;
  } catch (error) {
    message = { type: 'error', text: error.message };
  } finally {
    state.governance.loading = false;
    renderSharedGraphEditor(message);
  }
}

function bindGovernanceActions() {
  els.list.querySelectorAll('[data-review-proposal]').forEach(button => button.addEventListener('click', () => reviewProposal(button.dataset.reviewProposal, 'reviewed')));
  els.list.querySelectorAll('[data-reject-proposal]').forEach(button => button.addEventListener('click', () => reviewProposal(button.dataset.rejectProposal, 'rejected')));
  els.list.querySelectorAll('[data-approve-proposal]').forEach(button => button.addEventListener('click', () => approveProposal(button.dataset.approveProposal)));
  els.list.querySelectorAll('[data-undo-history]').forEach(button => button.addEventListener('click', () => undoHistory(button.dataset.undoHistory)));
}

async function reviewProposal(id, decision) {
  const note = window.prompt(decision === 'rejected' ? 'Why is this proposal rejected?' : 'What did the review confirm?');
  if (!note) return;
  await governanceRequest(`${API_BASE_URL}/v1/graph/proposals/${id}/review`, 'PATCH', { reviewer: 'local_reviewer', reviewNote: note, decision }, `Proposal ${decision}.`);
}

async function approveProposal(id) {
  await governanceRequest(`${API_BASE_URL}/v1/graph/proposals/${id}/approve`, 'POST', { reviewer: 'local_reviewer' }, 'Proposal approved and added to the graph.', true);
}

async function undoHistory(id) {
  const reason = window.prompt('Why should this change be undone?');
  if (!reason) return;
  await governanceRequest(`${API_BASE_URL}/v1/graph/history/${id}/undo`, 'POST', { author: 'local_reviewer', reason }, 'Change undone.', true);
}

async function governanceRequest(url, method, body, successText, reloadGraph = false) {
  try {
    const response = await fetch(url, { method, headers: authHeaders(true), body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed: ${response.status}`);
    if (reloadGraph) await reloadDatabaseGraph();
    state.governance.loaded = false;
    await loadGovernanceData({ type: 'success', text: successText });
  } catch (error) {
    renderSharedGraphEditor({ type: 'error', text: error.message });
  }
}

async function reloadDatabaseGraph() {
  const apiGraph = await fetchJsonWithTimeout(`${API_BASE_URL}/v1/graph`, 5000);
  const localResponse = await fetch('data/color-synonyms.json', { cache: 'no-store' });
  const localData = await localResponse.json();
  localData.graph = mergeApiGraph(localData.graph, apiGraph);
  applyEnvironmentConditionGraph(localData.graph);
  normalizeGraphNodeMetadata(localData.graph);
  state.data = localData;
  state.baseNodes = localData.graph.nodes;
  state.baseEdges = localData.graph.edges;
  rebuildActiveGraph();
  state.dataSource.databaseNodeIds = new Set((apiGraph.nodes || []).map(node => node.id));
  state.dataSource.apiGraphCount = apiGraph.nodes?.length || 0;
  state.dataSource.label = `Database connected · ${state.dataSource.apiGraphCount} nodes`;
  buildLayout();
}

function formatDateTime(value) {
  if (!value) return 'unknown date';
  return new Date(value).toLocaleString();
}

function sharedGraphNodeTypes() {
  return [
    { id: 'alias', label: 'Shade' },
    { id: 'shade', label: 'Shade phrase' },
    { id: 'subfamily', label: 'Secondary color' },
    { id: 'common_word', label: 'Common word / object' },
    { id: 'emotion_word', label: 'Emotion word' },
    { id: 'synonym', label: 'Shade synonym / wording support' },
    { id: 'neutral_word', label: 'Neutral word' },
    { id: 'environment_term', label: 'Sense / environment term' },
    { id: 'theme_condition', label: 'Theme condition / filter' },
    { id: 'environment_condition', label: 'Environment condition' },
    { id: 'ecosystem_signal', label: 'Evidence / growth signal' }
  ];
}

function sharedGraphRelationshipTypes() {
  return [
    { id: 'associated_color', label: 'Associated color' },
    { id: 'emotion_association', label: 'Emotion association' },
    { id: 'has_synonym', label: 'Has synonym' },
    { id: 'has_alias', label: 'Has alias' },
    { id: 'has_subfamily', label: 'Has bridge family' },
    { id: 'condition_has_synonym', label: 'Condition has related term' },
    { id: 'related_context', label: 'Related context' },
    { id: 'theme_influence', label: 'Theme influence' }
  ];
}

async function submitSharedGraphEntry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const values = new FormData(form);
  const label = String(values.get('label') || '').trim();
  const target = String(values.get('target') || '').trim();
  const relationshipType = String(values.get('relationshipType') || '').trim();
  const operation = String(values.get('operation') || 'create');

  if ((target && !relationshipType) || (!target && relationshipType)) {
    renderSharedGraphEditor({ type: 'error', text: 'Choose both a relationship target and relationship type, or leave both blank.' });
    return;
  }
  if (target && !String(values.get('evidence') || '').trim()) {
    renderSharedGraphEditor({ type: 'error', text: 'A relationship needs evidence or a reason before it can enter the shared graph.' });
    return;
  }

  const payload = {
    operation,
    targetId: operation === 'create' ? null : String(values.get('targetId') || '').trim(),
    author: String(values.get('author') || '').trim(),
    rationale: String(values.get('rationale') || '').trim(),
    payload: {
      node: operation === 'delete' ? null : {
        label,
        type: values.get('type'),
        family: values.get('family'),
        hexColor: values.get('hexColor'),
        metadata: {
          definition: String(values.get('definition') || '').trim(),
          emotionalLogic: String(values.get('emotionalLogic') || '').trim(),
          boundary: String(values.get('boundary') || '').trim(),
          source: 'shared_graph_editor',
          createdBy: String(values.get('author') || '').trim()
        }
      },
      relationships: operation === 'create' && target ? [{
        target,
        type: relationshipType,
        evidence: String(values.get('evidence') || '').trim(),
        confidence: values.get('confidence'),
        source: String(values.get('evidenceSource') || '').trim(),
        evidenceType: values.get('evidenceType'),
        boundary: String(values.get('evidenceBoundary') || '').trim(),
        author: String(values.get('author') || '').trim(),
        counterexample: String(values.get('counterexample') || '').trim()
      }] : []
    }
  };

  submit.disabled = true;
  submit.textContent = 'Adding...';
  try {
    const response = await fetch(`${API_BASE_URL}/v1/graph/proposals`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Database request failed: ${response.status}`);
    state.query = '';
    els.search.value = '';
    state.governance.loaded = false;
    await loadGovernanceData({ type: 'success', text: `${label || payload.targetId} was submitted for review.` });
  } catch (error) {
    renderSharedGraphEditor({ type: 'error', text: error.message });
  }
}

function addDatabaseEntryToState(result) {
  const node = normalizeApiNode(result.node);
  const relationships = (result.relationships || []).map(normalizeApiEdge);
  state.nodes.push(node);
  state.edges.push(...relationships);
  state.nodeById.set(node.id, node);
  state.dataSource.databaseNodeIds.add(node.id);
  state.dataSource.apiGraphCount += 1;
  state.dataSource.label = `Database connected · ${state.dataSource.apiGraphCount} nodes`;
  buildLayout();
}

function renderFamilyGroupedNodeList(type, label) {
  const types = Array.isArray(type) ? type : [type];
  const items = state.nodes
    .filter(node => types.includes(node.type))
    .filter(node => !state.emotionFilter || emotionVisibleNodeIds().has(node.id))
    .filter(nodePassesCategoryFilter)
    .sort((a, b) => a.label.localeCompare(b.label));

  if (!items.length) {
    els.list.innerHTML = `<p class="meta">No ${escapeHtml(label)} in this filter.</p>`;
    return;
  }

  const familyOrder = state.nodes
    .filter(node => node.type === 'family')
    .map(node => node.id.replace('family-', ''));
  const bridgeOrder = state.nodes
    .filter(node => node.type === 'subfamily')
    .map(node => node.family || node.id.replace('subfamily-', ''));
  const grouped = items.reduce((groups, node) => {
    const family = node.family || 'neutral';
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(node);
    return groups;
  }, new Map());

  const families = [...grouped.keys()].sort((a, b) => {
    const aIndex = familyOrder.indexOf(a);
    const bIndex = familyOrder.indexOf(b);
    const aBridgeIndex = bridgeOrder.indexOf(a);
    const bBridgeIndex = bridgeOrder.indexOf(b);
    const aRank = aIndex === -1 ? aBridgeIndex === -1 ? 99 : 30 + aBridgeIndex : aIndex;
    const bRank = bIndex === -1 ? bBridgeIndex === -1 ? 99 : 30 + bBridgeIndex : bIndex;
    return aRank - bRank || a.localeCompare(b);
  });

  els.list.innerHTML = families.map(family => {
    const nodes = grouped.get(family) || [];
    const familyNode = state.nodeById.get(`family-${family}`);
    const title = familyNode?.label || titleCase(family);
    const singular = label.endsWith('s') ? label.slice(0, -1) : label;
    return `
      <section class="alias-family-group">
        <div class="alias-family-heading">
          <span class="dot" style="background:${familyColor(family)}"></span>
          <strong>${escapeHtml(title)}</strong>
          <span>${nodes.length} ${nodes.length === 1 ? singular : label}</span>
        </div>
        <div class="alias-family-items">
          ${nodes.map(node => renderNodeListItem(node)).join('')}
        </div>
      </section>
    `;
  }).join('');

  bindListNodeClicks();
}

function bindListNodeClicks() {
  els.list.querySelectorAll('.list-item[data-node-id], .shade-point[data-node-id]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedId = button.dataset.nodeId;
      render();
    });
  });
}

function renderNeutralWordList() {
  const items = neutralTerms()
    .slice()
    .sort((a, b) => neutralReasonGroup(a.reason).localeCompare(neutralReasonGroup(b.reason)) || a.term.localeCompare(b.term));

  if (!items.length) {
    els.list.innerHTML = '<p class="meta">No unresolved neutral words in this filter.</p>';
    return;
  }

  const groups = items.reduce((map, item) => {
    const group = neutralReasonGroup(item.reason);
    if (!map.has(group)) map.set(group, []);
    map.get(group).push(item);
    return map;
  }, new Map());

  els.list.innerHTML = [...groups.entries()].map(([group, groupItems]) => `
    <section class="association-section">
      <div class="alias-family-heading neutral-family-heading">
        <span class="dot" style="background:${familyColor('neutral')}"></span>
        <strong>${escapeHtml(group)}</strong>
        <span>${groupItems.length} words</span>
      </div>
      <div class="alias-family-items">
        ${groupItems.slice(0, 180).map(renderNeutralListItem).join('')}
        ${groupItems.length > 180 ? `<p class="meta">${groupItems.length - 180} more in this group. Use search to narrow the list.</p>` : ''}
      </div>
    </section>
  `).join('');
}

function neutralReasonGroup(reason = '') {
  const text = reason.toLowerCase();
  if (/function word|pronoun|question or response word|conversation word/.test(text)) return 'Function and conversation words';
  if (/abstract|broad descriptor/.test(text)) return 'Abstract or broad words';
  if (/verb|broad action/.test(text)) return 'Action words';
  if (/number|time word/.test(text)) return 'Time and number words';
  if (/concrete word is too broad|culturally variable/.test(text)) return 'Broad concrete words';
  return 'Other unresolved words';
}

function renderAssociationMapList() {
  const sections = [
    renderAssociationFamilySection('Direct color words', directWordAssociations()),
    renderAssociationFamilySection('Environment condition synonyms', environmentConditionAssociations()),
    renderAssociationFamilySection('Common word color routes', commonWordAssociations()),
    renderAssociationFamilySection('Neutral bridge routes', neutralBridgeAssociations()),
    renderAssociationFamilySection('Emotion color routes', emotionWordAssociations()),
    renderThemeAssociationSection('Reclassified theme words', themeWordAssociations())
  ].filter(Boolean);

  els.list.innerHTML = sections.length ? sections.join('') : '<p class="meta">No word associations available in this filter.</p>';
  bindListNodeClicks();
}

function renderShadeGraphList() {
  const selected = state.nodeById.get(state.selectedId);
  const queryColor = parseColorInput(state.query);
  const queryNode = queryColor ? null : colorNodeForQuery(state.query);
  const selectedColor = colorForNode(selected);
  const activeColor = queryColor || colorForNode(queryNode) || selectedColor;
  const activeLabel = queryColor ? state.query : queryNode?.label || selected?.label || 'Selected color';
  const activeNode = queryNode || selected || null;
  const position = queryColor
    ? (activeColor ? shadePosition(activeColor) : null)
    : (
        displayShadePositionForNode(activeNode)?.position
        || baselinePlacementForNode(activeNode)?.position
        || (activeColor ? shadePosition(activeColor, environmentFamiliesForNode(activeNode) || []) : null)
      );
  const comparable = shadeComparableNodes()
    .filter(item => !state.emotionFilter || emotionVisibleNodeIds().has(item.node.id))
    .filter(item => nodePassesCategoryFilter(item.node))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.node.label.localeCompare(b.node.label));

  els.list.innerHTML = `
    <section class="shade-tool">
      <div class="theme-filter-summary">
        <strong>Hex / RGB converter</strong>
        <span>Type a hex or RGB value in Search, or select a color node. The shade graph compares words by condition-space position, so shared depth, exposure, and signal rules can overlap even when hues differ.</span>
      </div>
      ${activeColor ? renderColorConversionCard(activeLabel, activeColor, position) : '<p class="meta">Select a color word or type a value like #6c8499, rgb(108,132,153), or 108 132 153.</p>'}
      ${position ? renderShadeAxisCard(position) : ''}
      <div class="shade-axis-legend">
        <span><strong>X</strong> ${SHADE_AXIS_LABELS.x}: ${axisRangeSummary('x')}</span>
        <span><strong>Y</strong> ${SHADE_AXIS_LABELS.y}: ${axisRangeSummary('y')}</span>
        <span><strong>Z</strong> ${SHADE_AXIS_LABELS.z}: ${axisRangeSummary('z')}</span>
      </div>
      <div class="shade-graph-plane" aria-label="Shade graph two axis plot">
        ${comparable.slice(0, 90).map(item => renderShadePoint(item, activeColor)).join('')}
      </div>
      <div class="result-group">
        <div class="result-group-title">Comparable word positions</div>
        ${comparable.slice(0, 80).map(renderShadeComparisonItem).join('')}
      </div>
    </section>
  `;

  bindListNodeClicks();
}

function renderColorConversionCard(label, color, position) {
  return `
    <div class="shade-conversion-card">
      <span class="shade-large-swatch" style="background:${escapeHtml(color.hex)}"></span>
      <div>
        <strong>${escapeHtml(label || color.hex)}</strong>
        <span>HEX ${escapeHtml(color.hex)} · RGB ${color.r}, ${color.g}, ${color.b}</span>
        <span>HSL ${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(color.l)}%</span>
        ${position ? `<span>X ${position.x} · Y ${position.y} · Z ${position.z}</span>` : ''}
      </div>
    </div>
  `;
}

function renderShadeAxisCard(position) {
  const axisRows = [
    ['X', SHADE_AXIS_LABELS.x, position.x, SHADE_AXIS_POLARITIES.x.min, SHADE_AXIS_POLARITIES.x.max],
    ['Y', SHADE_AXIS_LABELS.y, position.y, SHADE_AXIS_POLARITIES.y.min, SHADE_AXIS_POLARITIES.y.max],
    ['Z', SHADE_AXIS_LABELS.z, position.z, SHADE_AXIS_POLARITIES.z.min, SHADE_AXIS_POLARITIES.z.max]
  ];
  return `
    <div class="shade-axis-card">
      ${axisRows.map(([axis, label, value, min, max]) => {
        const percent = ((value - min) / (max - min)) * 100;
        return `
          <div class="shade-axis-row">
            <strong>${axis}</strong>
            <span>${escapeHtml(label)}</span>
            <meter min="${min}" max="${max}" value="${value}"></meter>
            <em>${value}</em>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderShadePoint(item, activeColor) {
  const xRange = SHADE_AXIS_POLARITIES.x;
  const yRange = SHADE_AXIS_POLARITIES.y;
  const left = clamp(((item.position.x - xRange.min) / (xRange.max - xRange.min)) * 100, 0, 100);
  const top = clamp(100 - (((item.position.y - yRange.min) / (yRange.max - yRange.min)) * 100), 0, 100);
  const active = activeColor && item.color.hex === activeColor.hex;
  return `
    <button class="shade-point ${active ? 'is-active' : ''}" type="button" data-node-id="${escapeHtml(item.node.id)}" style="left:${left}%; top:${top}%; background:${escapeHtml(item.color.hex)}" title="${escapeHtml(item.node.label)}">
      <span>${escapeHtml(item.node.label)}</span>
    </button>
  `;
}

function renderShadeComparisonItem(item) {
  const node = item.node;
  const pos = item.position;
  const mixNote = item.color.mixInfo?.components?.length > 1
    ? ` · mixed from ${item.color.mixInfo.components.map(component => component.label).join(' + ')}`
    : '';
  return `
    <button class="list-item shade-comparison-item" type="button" data-node-id="${escapeHtml(node.id)}">
      <span class="dot" style="background:${escapeHtml(item.color.hex)}"></span>
      <span>
        <span class="item-title">${escapeHtml(node.label)}</span>
        <span class="item-subtitle">${escapeHtml(node.type)} · X ${pos.x} · Y ${pos.y} · Z ${pos.z} · ${escapeHtml(item.color.hex)}${escapeHtml(mixNote)}</span>
      </span>
      <span class="pill">${escapeHtml(node.family || node.id.replace('family-', ''))}</span>
    </button>
  `;
}

function renderNaturalShadeAtlas() {
  const groups = naturalShadeAtlasGroups();
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  els.list.innerHTML = `
    <section class="shade-tool natural-atlas">
      <div class="theme-filter-summary">
        <strong>Natural shade atlas</strong>
        <span>Noun/source plus condition/state. Natural sources land in color families, environment conditions, and emotional routes without becoming strict color synonyms.</span>
      </div>
      <div class="shade-axis-legend">
        <span><strong>Structure</strong> source -> shade family -> environment condition -> emotion/association routes</span>
        <span><strong>Count</strong> ${total} natural shade entries from existing graph routes and curated local source groups</span>
      </div>
      ${groups.map(group => `
        <section class="natural-atlas-group">
          <div class="alias-family-heading">
            <span class="dot" style="background:${familyColor(group.primaryFamily)}"></span>
            <strong>${escapeHtml(group.label)}</strong>
            <span>${group.items.length} shades</span>
          </div>
          <div class="natural-atlas-grid">
            ${group.items.map(renderNaturalAtlasItem).join('')}
          </div>
        </section>
      `).join('')}
    </section>
  `;
  bindListNodeClicks();
}

function renderNaturalAtlasItem(item) {
  const condition = item.condition;
  const color = colorForNode(item.node) || parseColorInput(familyColor(item.family));
  const shadeInfo = displayShadePositionForNode(item.node);
  const shade = shadeInfo?.position || baselinePlacementForNode(item.node)?.position || (color ? shadePosition(color, environmentFamiliesForNode(item.node) || []) : null);
  const themeShift = shadeInfo?.themeCondition || null;
  const atlas = shadeInfo?.atlas || null;
  return `
    <button class="natural-atlas-card" type="button" data-node-id="${escapeHtml(item.node.id)}">
      <span class="shade-large-swatch" style="background:${escapeHtml(color?.hex || familyColor(item.family))}"></span>
      <span>
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(item.source)} source · ${escapeHtml(item.family)} family</small>
        ${condition ? `<em>${escapeHtml(condition.condition)}</em>` : ''}
        <small>${shade ? `X ${shade.x} · Y ${shade.y} · Z ${shade.z}` : 'No shade position'}</small>
        ${themeShift ? `<small>Theme pull ${themeShift.delta.x >= 0 ? '+' : ''}${themeShift.delta.x}, ${themeShift.delta.y >= 0 ? '+' : ''}${themeShift.delta.y}, ${themeShift.delta.z >= 0 ? '+' : ''}${themeShift.delta.z}</small>` : ''}
        ${atlas ? `<small>Atlas influence ${atlas.delta.x >= 0 ? '+' : ''}${atlas.delta.x}, ${atlas.delta.y >= 0 ? '+' : ''}${atlas.delta.y}, ${atlas.delta.z >= 0 ? '+' : ''}${atlas.delta.z}</small>` : ''}
        <small>${escapeHtml(item.route)}</small>
      </span>
    </button>
  `;
}

function naturalShadeAtlasGroups() {
  const groups = naturalSourceGroups();
  return groups
    .map(group => {
      const items = naturalAtlasItemsForGroup(group)
        .sort((a, b) => a.family.localeCompare(b.family) || a.label.localeCompare(b.label));
      return {
        ...group,
        items,
        primaryFamily: items[0]?.family || group.primaryFamily || 'green'
      };
    })
    .filter(group => group.items.length);
}

function naturalAtlasItemsForGroup(group) {
  const terms = new Set(group.terms.map(term => term.toLowerCase()));
  const items = [];
  const seen = new Set();
  const add = (node, source, route, familyOverride = null) => {
    if (!node) return;
    const landing = landingForColorNode(node);
    const family = familyOverride || landing?.family || node.family || nodeColorKey(node);
    if (!familyColorExists(family)) return;
    const key = `${node.id}|${family}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      node,
      label: node.label,
      source,
      family,
      condition: composeEnvironmentCondition(splitFamilyId(family), node.label),
      route
    });
  };

  state.nodes.forEach(node => {
    const text = [
      node.label,
      node.metadata?.definition,
      node.metadata?.definitionPhrase,
      node.metadata?.naturalNameBasis,
      node.metadata?.contextDefinition,
      node.metadata?.associationBasis
    ].filter(Boolean).join(' ').toLowerCase();
    const matched = [...terms].find(term => text.includes(term));
    if (!matched) return;
    if (node.type === 'common_word') {
      const paths = associatedColorPaths(node);
      const families = uniqueStrings(paths.map(path => path.landing?.family).filter(familyColorExists));
      if (families.length) {
        families.forEach(family => {
          add(node, group.label, `${matched} -> ${node.label} -> ${family}`, family);
        });
      }
      return;
    }
    if (['shade', 'alias', 'environment_term'].includes(node.type)) {
      add(node, group.label, `${matched} -> ${node.label}`);
    }
  });

  return items.slice(0, 48);
}

function naturalSourceGroups() {
  return [
    { id: 'sky-weather', label: 'Sky / weather', primaryFamily: 'blue', terms: ['sky', 'cloud', 'storm', 'fog', 'mist', 'rain', 'snow', 'frost', 'dusk', 'dawn', 'weather', 'atmosphere'] },
    { id: 'water-ice', label: 'Water / ice', primaryFamily: 'blue', terms: ['ocean', 'sea', 'river', 'lake', 'water', 'ice', 'glacier', 'wave', 'tide', 'foam'] },
    { id: 'earth-stone', label: 'Earth / stone', primaryFamily: 'brown', terms: ['earth', 'soil', 'clay', 'stone', 'slate', 'charcoal', 'basalt', 'sand', 'umber', 'ochre', 'terracotta', 'limestone'] },
    { id: 'plants', label: 'Plants', primaryFamily: 'green', terms: ['moss', 'sage', 'pine', 'grass', 'leaf', 'forest', 'rose', 'petal', 'lavender', 'olive', 'fern', 'flora'] },
    { id: 'fire-light', label: 'Fire / light', primaryFamily: 'orange', terms: ['fire', 'flame', 'ember', 'sun', 'sunlight', 'gold', 'saffron', 'honey', 'candle', 'spark', 'light'] },
    { id: 'body-material', label: 'Body / material', primaryFamily: 'red', terms: ['blood', 'bone', 'ivory', 'pearl', 'shell', 'skin', 'flesh', 'raven', 'coal', 'metal', 'silver'] },
    { id: 'season-time', label: 'Season / time', primaryFamily: 'yellow', terms: ['spring', 'summer', 'fall', 'autumn', 'winter', 'december', 'night', 'midnight', 'morning', 'evening'] }
  ];
}

const NATURAL_ATLAS_VECTORS = {
  'sky-weather': { x: -10, y: 16, z: -8, label: 'sky / weather lift' },
  'water-ice': { x: -16, y: 4, z: -10, label: 'water / ice depth' },
  'earth-stone': { x: 12, y: -18, z: -16, label: 'earth / stone grounding' },
  plants: { x: -4, y: 2, z: -6, label: 'plant regulation' },
  'fire-light': { x: 18, y: 14, z: 12, label: 'fire / light activation' },
  'body-material': { x: 8, y: -8, z: -4, label: 'material weight' },
  'season-time': { x: 0, y: 8, z: -10, label: 'season / time atmosphere' }
};

const ATLAS_INFLUENCE_NODE_TYPES = new Set(['alias', 'shade', 'synonym', 'common_word', 'neutral_word']);

function colorNodeForQuery(query) {
  const normalized = normalizeConceptTerm(query);
  if (!normalized) return null;
  return exactNodesByLabel(normalized)
    .find(node => ['family', 'environment_condition', 'environment_term', 'subfamily', 'shade', 'alias', 'synonym', 'emotion_word', 'common_word', 'neutral_word'].includes(node.type)) || null;
}

function renderAssociationFamilySection(title, items) {
  if (!items.length) return '';
  const groups = groupAssociationsByFamily(items);
  return `
    <section class="association-section">
      <div class="result-group-title">${escapeHtml(title)}</div>
      ${groups.map(group => `
        <section class="alias-family-group">
          <div class="alias-family-heading">
            <span class="dot" style="background:${familyColor(group.family)}"></span>
            <strong>${escapeHtml(group.label)}</strong>
            <span>${group.items.length} routes</span>
          </div>
          <div class="alias-family-items">
            ${group.items.map(renderAssociationItem).join('')}
          </div>
        </section>
      `).join('')}
    </section>
  `;
}

function renderThemeAssociationSection(title, items) {
  if (!items.length) return '';
  const byCategory = items.reduce((groups, item) => {
    if (!groups.has(item.categoryLabel)) groups.set(item.categoryLabel, []);
    groups.get(item.categoryLabel).push(item);
    return groups;
  }, new Map());
  const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b));
  return `
    <section class="association-section">
      <div class="result-group-title">${escapeHtml(title)}</div>
      ${categories.map(category => {
        const categoryItems = byCategory.get(category).sort((a, b) => a.label.localeCompare(b.label));
        return `
          <section class="alias-family-group">
            <div class="alias-family-heading">
              <span class="dot" style="background:${familyColor(anchorsForCategory(category)[0] || 'common')}"></span>
              <strong>${escapeHtml(category)}</strong>
              <span>${categoryItems.length} terms</span>
            </div>
            <div class="alias-family-items">
              ${categoryItems.map(renderThemeAssociationItem).join('')}
            </div>
          </section>
        `;
      }).join('')}
    </section>
  `;
}

function renderAssociationItem(item) {
  const synonyms = associationSynonyms(item);
  return `
    <button class="list-item association-item" type="button" data-node-id="${escapeHtml(item.nodeId)}">
      <span class="dot" style="background:${familyColor(item.family)}"></span>
      <span>
        <span class="item-title">${escapeHtml(item.label)}</span>
        <span class="item-subtitle">${escapeHtml(item.kind)} · ${escapeHtml(item.route)}</span>
        ${synonyms.length ? `<span class="item-subtitle association-synonyms">Synonyms: ${synonyms.map(escapeHtml).join(', ')}</span>` : ''}
      </span>
      <span class="pill">${escapeHtml(item.family)}</span>
    </button>
  `;
}

function associationSynonyms(item) {
  const terms = [];
  const add = value => {
    const text = String(value || '').trim();
    if (!text) return;
    if (text.toLowerCase() === String(item.label || '').toLowerCase()) return;
    terms.push(text);
  };

  const node = state.nodeById.get(item.nodeId);
  graphAssociationSynonyms(node).forEach(add);
  conditionTerms(ENVIRONMENT_CONDITIONS[item.family]?.condition).forEach(add);
  (ASSOCIATION_SYNONYM_SETS[String(item.label || '').toLowerCase()] || []).forEach(add);
  (ASSOCIATION_SYNONYM_SETS[String(item.family || '').toLowerCase()] || []).forEach(add);

  if (item.kind?.includes('emotion')) {
    emotionConnectionsForFamilies([item.family]).slice(0, 4).forEach(connection => add(connection.label));
  }

  return uniqueStrings(terms.map(term => term.toLowerCase()))
    .filter(term => !['color', 'word', 'route'].includes(term))
    .slice(0, 6);
}

function graphAssociationSynonyms(node) {
  if (!node) return [];
  const usefulTypes = new Set(['alias', 'synonym', 'environment_term', 'emotion_word', 'common_word']);
  return [...outgoing(node.id), ...incoming(node.id)]
    .map(edge => state.nodeById.get(edge.source === node.id ? edge.target : edge.source))
    .filter(target => target && usefulTypes.has(target.type))
    .map(target => target.label)
    .filter(Boolean)
    .slice(0, 8);
}

function environmentConditionAssociations() {
  return state.nodes
    .filter(node => node.type === 'environment_term')
    .filter(nodePassesCategoryFilter)
    .map(node => ({
      nodeId: node.id,
      label: node.label,
      family: node.family || 'neutral',
      kind: 'condition synonym',
      route: `${node.family || 'color'} -> ${node.label}`
    }));
}

function renderThemeAssociationItem(item) {
  return `
    <div class="list-item is-neutral association-item">
      <span class="dot" style="background:${familyColor(anchorsForCategory(item.categoryLabel)[0] || 'common')}"></span>
      <span>
        <span class="item-title">${escapeHtml(item.label)}</span>
        <span class="item-subtitle">theme word · ${escapeHtml(item.reason)}</span>
      </span>
      <span class="pill">${escapeHtml(item.categoryLabel)}</span>
    </div>
  `;
}

function groupAssociationsByFamily(items) {
  const familyOrder = state.nodes
    .filter(node => node.type === 'family')
    .map(node => node.id.replace('family-', ''));
  const groups = items.reduce((map, item) => {
    const family = item.family || 'neutral';
    if (!map.has(family)) map.set(family, []);
    map.get(family).push(item);
    return map;
  }, new Map());

  return [...groups.entries()]
    .sort(([a], [b]) => {
      const aIndex = familyOrder.indexOf(a);
      const bIndex = familyOrder.indexOf(b);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex) || a.localeCompare(b);
    })
    .map(([family, groupItems]) => ({
      family,
      label: state.nodeById.get(`family-${family}`)?.label || titleCase(family),
      items: groupItems.sort((a, b) => a.label.localeCompare(b.label))
    }));
}

function directWordAssociations() {
  return state.nodes
    .filter(node => ['alias', 'synonym'].includes(node.type))
    .filter(nodePassesCategoryFilter)
    .map(node => {
      const landing = landingForColorNode(node);
      if (!landing?.family) return null;
      return {
        nodeId: node.id,
        label: node.label,
        family: landing.family,
        kind: node.type === 'alias' ? 'alias color word' : 'cited synonym',
        route: `${node.label} -> ${landing.family}`
      };
    })
    .filter(Boolean);
}

function commonWordAssociations() {
  return state.nodes
    .filter(node => node.type === 'common_word')
    .filter(nodePassesCategoryFilter)
    .flatMap(node => associatedColorPaths(node).map(path => ({
      nodeId: node.id,
      label: node.label,
      family: path.landing.family,
      kind: 'common word',
      route: path.nodes.join(' -> ')
    })));
}

function neutralBridgeAssociations() {
  return state.nodes
    .filter(node => node.type === 'neutral_word')
    .filter(nodePassesCategoryFilter)
    .flatMap(node => neutralLandingPaths(node).map(path => ({
      nodeId: node.id,
      label: node.label,
      family: path.landing.family,
      kind: 'neutral bridge',
      route: path.nodes.join(' -> ')
    })));
}

function emotionWordAssociations() {
  return state.nodes
    .filter(node => node.type === 'emotion_word')
    .flatMap(node => emotionColorPaths(node).map(path => ({
      nodeId: node.id,
      label: node.label,
      family: path.landing.family,
      kind: 'emotion word',
      route: path.nodes.join(' -> ')
    })));
}

function themeWordAssociations() {
  return (state.data.neutralWords?.reclassified || []).map(item => ({
    label: item.term,
    categoryLabel: item.categoryLabel,
    reason: item.reason
  }));
}

function renderThemeCategoryList() {
  const categories = state.data.themeComposition?.categories || [];
  const themes = state.data.themeComposition?.themes || [];
  els.list.innerHTML = categories.length ? categories.map(category => {
    const categoryThemes = themes.filter(theme => theme.category.toLowerCase() === category.label.toLowerCase());
    const customCount = state.customConcepts.filter(concept => concept.categoryId === category.id).length;
    return `
      <div class="theme-category-item">
        <div>
          <strong>${escapeHtml(category.label)}</strong>
          <span>${escapeHtml(category.role)}</span>
        </div>
        <p>${escapeHtml(category.question)}</p>
        <div class="theme-token-row">
          ${categoryThemes.map(theme => `<span>${escapeHtml(theme.label)}</span>`).join('')}
          ${customCount ? `<span>${customCount} saved</span>` : ''}
        </div>
      </div>
    `;
  }).join('') : '<p class="meta">No theme conditions yet.</p>';
}

function renderThemeFilterList() {
  const themes = allCompositionThemes().sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
  const activeIds = new Set(state.activeThemeFilterIds);
  const activeThemes = themes.filter(theme => activeIds.has(theme.id));
  const inactiveThemes = themes.filter(theme => !activeIds.has(theme.id));
  const inactiveByCategory = inactiveThemes.reduce((groups, theme) => {
    if (!groups.has(theme.category)) groups.set(theme.category, []);
    groups.get(theme.category).push(theme);
    return groups;
  }, new Map());

  els.list.innerHTML = `
    <section class="theme-filter-panel">
      <div class="theme-filter-summary">
        <strong>Active theme conditions</strong>
        <span>${activeThemes.length ? activeThemes.map(theme => theme.label).join(' + ') : 'none'}</span>
      </div>
      <p class="meta">Active theme conditions change how typed words react. They do not become strict color synonyms.</p>
      <div class="theme-filter-list">
        ${activeThemes.length ? activeThemes.map(theme => renderThemeFilterButton(theme, true)).join('') : '<p class="meta">No active conditions. Add one below.</p>'}
      </div>
    </section>
    ${[...inactiveByCategory.entries()].map(([category, categoryThemes]) => `
      <section class="association-section">
        <div class="alias-family-heading">
          <span class="dot" style="background:${familyColor(anchorsForCategory(category)[0] || 'common')}"></span>
          <strong>${escapeHtml(category)} condition</strong>
          <span>${categoryThemes.length} condition filters</span>
        </div>
        <div class="theme-filter-list">
          ${categoryThemes.map(theme => renderThemeFilterButton(theme, false)).join('')}
        </div>
      </section>
    `).join('')}
  `;

  els.list.querySelectorAll('[data-theme-filter-id]').forEach(button => {
    button.addEventListener('click', () => {
      toggleThemeFilter(button.dataset.themeFilterId);
    });
  });
}

function renderThemeFilterButton(theme, active) {
  const anchors = theme.anchorIds || anchorsForCategory(theme.category);
  return `
    <button class="theme-filter-button ${active ? 'is-active' : ''}" type="button" data-theme-filter-id="${escapeHtml(theme.id)}" aria-pressed="${active}">
      <span class="dot" style="background:${familyColor(anchors[0] || 'common')}"></span>
      <span>
        <strong>${escapeHtml(theme.label)}</strong>
        <small>${escapeHtml(theme.category)} condition · ${escapeHtml(themeTermForTheme(theme) || 'custom theme condition')}</small>
      </span>
      <span class="pill">${active ? 'Remove' : 'Add'}</span>
    </button>
  `;
}

function renderSelectionClimateList() {
  const read = state.query ? selectionClimateForQuery(state.query) : null;
  const survey = surveyPatternAnalysis(state.surveyPatternText);
  els.list.innerHTML = `
    <section class="theme-filter-panel">
      <div class="theme-filter-summary">
        <strong>Pattern extraction</strong>
        <span>Extract repeated attributes, observable patterns, and inferred tendency across a set.</span>
      </div>
      <p class="meta">Paste a set like teal green, blue sapphire, evergreen, red mahogany, sand yellow, irregular quadrilateral. The app will extract repeated attributes first, then separate observation from inference.</p>
      ${state.data?.selectionClimate?.stages?.length ? `
        <div class="theme-category-item">
          <div>
            <strong>${escapeHtml(state.data.selectionClimate.systemName || 'Pattern Extraction System')}</strong>
            <span>stage flow</span>
          </div>
          <div class="theme-token-row">
            ${state.data.selectionClimate.stages.map(stage => `<span>${escapeHtml(stage.label)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      ${read ? renderSelectionClimate(read) : `
        <div class="theme-category-item">
          <div>
            <strong>No active selection set</strong>
            <span>waiting for a repeated pattern</span>
          </div>
          <p>Use commas, plus signs, or new lines so the translator can treat the input as a cluster of selections instead of one phrase.</p>
        </div>
      `}
      <div class="survey-pattern-panel">
        <div class="theme-filter-summary">
          <strong>Survey pattern workspace</strong>
          <span>Local-only notebook extraction for color, shape, date, and pairing patterns.</span>
        </div>
        <textarea data-survey-pattern-input rows="8" spellcheck="false" placeholder="Paste lines like (Name)(Jan 11)(Blue)(Triangle)">${escapeHtml(state.surveyPatternText)}</textarea>
        <div data-survey-pattern-results>
          ${renderSurveyPatternAnalysis(survey)}
        </div>
      </div>
    </section>
  `;
  const surveyInput = els.list.querySelector('[data-survey-pattern-input]');
  surveyInput?.addEventListener('input', event => {
    state.surveyPatternText = event.target.value;
    saveSurveyPatternText();
    rebuildActiveGraph();
    renderStats();
    buildLayout();
    drawGraph();
    renderSurveyPatternResults();
  });
  surveyInput?.addEventListener('change', () => {
    rebuildActiveGraph();
    renderSurveyPatternResults();
    renderStats();
    buildLayout();
    drawGraph();
  });
  surveyInput?.addEventListener('blur', () => {
    rebuildActiveGraph();
    renderSurveyPatternResults();
    renderStats();
    buildLayout();
    drawGraph();
  });
  bindSurveyPatternButtons();
}

function renderSurveyPatternResults() {
  const results = els.list.querySelector('[data-survey-pattern-results]');
  if (!results) return;
  results.innerHTML = renderSurveyPatternAnalysis(surveyPatternAnalysis(state.surveyPatternText));
  bindSurveyPatternButtons(results);
}

function bindSurveyPatternButtons(scope = els.list) {
  scope.querySelectorAll('[data-evergreen-signal]').forEach(button => {
    button.addEventListener('click', () => addEvergreenSignalConcept(button.dataset.evergreenSignal));
  });
  scope.querySelectorAll('[data-ecosystem-node]').forEach(button => {
    button.addEventListener('click', () => selectEcosystemNode(button.dataset.ecosystemNode));
  });
}

function selectEcosystemNode(nodeId) {
  if (!state.ecosystemMode) {
    state.ecosystemMode = true;
    if (els.ecosystemMode) els.ecosystemMode.checked = true;
    saveEcosystemMode();
  }
  rebuildActiveGraph();
  state.selectedId = state.nodeById.has(nodeId) ? nodeId : 'ecosystem-evergreen';
  render();
}

function toggleThemeFilter(themeId) {
  const ids = new Set(state.activeThemeFilterIds);
  if (ids.has(themeId)) {
    ids.delete(themeId);
  } else {
    ids.add(themeId);
  }
  state.activeThemeFilterIds = [...ids];
  saveActiveThemeFilters();
  rebuildActiveGraph();
  render();
}

function renderCustomConceptList() {
  if (!state.customConcepts.length) {
    els.list.innerHTML = '<p class="meta">Search for a word or concept, then add it to save it under a theme condition.</p>';
    return;
  }

  const categoryById = themeCategoryById();
  els.list.innerHTML = state.customConcepts
    .slice()
    .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel) || a.term.localeCompare(b.term))
    .map(concept => {
      const category = categoryById.get(concept.categoryId);
      return `
        <div class="theme-category-item concept-item">
          <div>
            <strong>${escapeHtml(concept.label)}</strong>
            <span>${escapeHtml(concept.categoryLabel)} · ${escapeHtml(concept.assignmentReason)}</span>
          </div>
          <p>${escapeHtml(category?.role || 'Custom theme concept')}</p>
          <div class="theme-token-row">
            ${(concept.anchorIds || []).map(anchorId => `<span>${escapeHtml(anchorLabel(anchorId))}</span>`).join('')}
          </div>
        </div>
      `;
    }).join('');
}

function renderPersonProfileList() {
  const profile = ensurePersonalProfile();
  const suggestedFamilies = suggestedFamiliesForQuery(state.query);
  const suggestedThemes = suggestedThemesForQuery(state.query);
  const influence = profile.influence || normalizePersonalInfluence();
  const influenceRows = personalInfluenceRows(profile);
  const entriesByType = PROFILE_CONTEXT_TYPES.map(type => ({
    ...type,
    entries: profile.entries.filter(entry => entry.contextType === type.id)
  }));

  els.list.innerHTML = `
    <div class="theme-category-item person-profile-card">
      <div>
        <strong>${escapeHtml(profile.label || 'Personal profile')}</strong>
        <span>local-only private overlay</span>
      </div>
      <p>${escapeHtml(profile.purpose || 'Life context that shapes this person’s color-climate web.')}</p>
      <p>${escapeHtml(profile.boundary || personalProfileBoundary())}</p>
    </div>
    <form class="personal-profile-form" data-profile-name-form>
      <label>
        <span>Profile name</span>
        <input name="profileLabel" type="text" value="${escapeHtml(profile.label || 'Personal profile')}" autocomplete="off">
      </label>
      <button type="submit">Save name</button>
    </form>
    <form class="personal-profile-form" data-profile-influence-form>
      <label>
        <span>Name</span>
        <input name="name" type="text" value="${escapeHtml(influence.name || '')}" placeholder="Elijah Duclair" autocomplete="off">
      </label>
      <label>
        <span>Date of birth</span>
        <input name="dob" type="text" value="${escapeHtml(influence.dob || '')}" placeholder="January 7, 2005 or 2005-01-07" autocomplete="off">
      </label>
      <label>
        <span>Chosen color</span>
        <input name="chosenColor" type="text" value="${escapeHtml(influence.chosenColor || '')}" placeholder="Teal Green" autocomplete="off">
      </label>
      <label>
        <span>Chosen shape</span>
        <select name="chosenShape">
          <option value="">Select shape</option>
          ${PERSONAL_SHAPE_OPTIONS.map(shape => `<option value="${escapeHtml(shape)}" ${normalizeConceptTerm(influence.chosenShape) === shape ? 'selected' : ''}>${escapeHtml(titleCase(shape))}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>Blue shade</span>
        <input name="blueShade" type="text" value="${escapeHtml(influence.blueShade || '')}" placeholder="Blue Sapphire" autocomplete="off">
      </label>
      <label>
        <span>Red shade</span>
        <input name="redShade" type="text" value="${escapeHtml(influence.redShade || '')}" placeholder="Red Mahogany" autocomplete="off">
      </label>
      <label>
        <span>Green shade</span>
        <input name="greenShade" type="text" value="${escapeHtml(influence.greenShade || '')}" placeholder="Evergreen" autocomplete="off">
      </label>
      <label>
        <span>Yellow shade</span>
        <input name="yellowShade" type="text" value="${escapeHtml(influence.yellowShade || '')}" placeholder="Sand Yellow" autocomplete="off">
      </label>
      <button type="submit">Save personal influence</button>
    </form>
    <div class="theme-category-item person-profile-card">
      <div>
        <strong>Personal influence</strong>
        <span>graph weighting overlay</span>
      </div>
      <p>These answers do not rewrite the base model. They brighten and prioritize routes that fit this person’s repeated preferences and time conditions.</p>
      ${influenceRows.length ? `
        <div class="personal-read">
          <dl>
            ${influenceRows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}
          </dl>
        </div>
      ` : '<p class="meta">No personal influence answers saved yet.</p>'}
    </div>
    <form class="personal-profile-form" data-profile-entry-form>
      <label>
        <span>Term or phrase</span>
        <input name="term" type="text" value="${escapeHtml(state.query || '')}" placeholder="pressure, winter room, friendship" autocomplete="off" required>
      </label>
      <label>
        <span>Context type</span>
        <select name="contextType">
          ${PROFILE_CONTEXT_TYPES.map(type => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>Linked colors</span>
        <input name="families" type="text" value="${escapeHtml(suggestedFamilies.join(', '))}" placeholder="red-orange, brown-gray">
      </label>
      <label>
        <span>Linked themes</span>
        <input name="themes" type="text" value="${escapeHtml(suggestedThemes.join(', '))}" placeholder="December, Friendship">
      </label>
      <label class="wide">
        <span>Emotional logic</span>
        <textarea name="emotionalLogic" rows="3" placeholder="Why this context changes the personal climate"></textarea>
      </label>
      <label class="wide">
        <span>Boundary note</span>
        <textarea name="boundary" rows="2" placeholder="What the translator should not assume"></textarea>
      </label>
      <button type="submit">Add profile entry</button>
    </form>
    ${entriesByType.map(group => `
      <div class="result-group">
        <div class="result-group-title">${escapeHtml(group.label)}</div>
        ${group.entries.length ? group.entries.map(renderPersonalProfileEntry).join('') : '<p class="meta">No entries yet.</p>'}
      </div>
    `).join('')}
  `;

  els.list.querySelector('[data-profile-name-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    state.personProfile.label = form.querySelector('[name="profileLabel"]').value.trim() || 'Personal profile';
    savePersonalProfile();
    render();
  });

  els.list.querySelector('[data-profile-influence-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    savePersonalInfluence(new FormData(event.currentTarget));
  });

  els.list.querySelector('[data-profile-entry-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    addPersonalProfileEntry(new FormData(event.currentTarget));
  });

  els.list.querySelectorAll('[data-remove-profile-entry]').forEach(button => {
    button.addEventListener('click', () => {
      removePersonalProfileEntry(button.dataset.removeProfileEntry);
    });
  });

  els.list.querySelectorAll('[data-person-term]').forEach(button => {
    button.addEventListener('click', () => {
      state.query = button.dataset.personTerm.toLowerCase();
      els.search.value = button.dataset.personTerm;
      render();
    });
  });
}

function renderPersonalProfileEntry(entry) {
  const primaryFamily = entry.families?.[0] || 'common';
  return `
    <div class="list-item person-term personal-profile-entry">
      <span class="dot" style="background:${familyColor(primaryFamily)}"></span>
      <button class="entry-main" type="button" data-person-term="${escapeHtml(entry.term)}">
        <span class="item-title">${escapeHtml(entry.term)}</span>
        <span class="item-subtitle">${escapeHtml(entry.emotionalLogic || 'Personal life-context overlay')}</span>
        <span class="theme-token-row">
          ${(entry.families || []).map(family => `<span>${escapeHtml(family)}</span>`).join('')}
          ${(entry.themes || []).map(theme => `<span>${escapeHtml(theme)}</span>`).join('')}
        </span>
        ${entry.boundary ? `<em>${escapeHtml(entry.boundary)}</em>` : ''}
      </button>
      <button class="remove-entry-button" type="button" data-remove-profile-entry="${escapeHtml(entry.id)}">Remove</button>
    </div>
  `;
}

function renderSearchResults() {
  const results = graphAwareSearch(state.query);
  const addPrompt = conceptAddPrompt(state.query);
  const blocks = state.emotionFilter
    ? [
        ['Emotion paths', results.emotions.filter(emotionPathPassesCategoryFilter).map(item => renderEmotionPathListItem(item))],
        ['Exact emotion matches', results.exact.filter(node => emotionVisibleNodeIds().has(node.id) && nodePassesCategoryFilter(node)).map(node => renderNodeListItem(node))],
        ['Connected emotion colors', results.connected.filter(item => emotionVisibleNodeIds().has(item.node.id) && nodePassesCategoryFilter(item.node)).map(item => renderNodeListItem(item.node, item.reason))]
      ].filter(([, items]) => items.length)
    : [
        ['Exact matches', [renderStructuredNodeMatches(results.exact.filter(nodePassesCategoryFilter))]],
        ['Emotion paths', results.emotions.filter(emotionPathPassesCategoryFilter).map(item => renderEmotionPathListItem(item))],
        ['Connected matches', [renderStructuredNodeMatches(results.connected.filter(item => nodePassesCategoryFilter(item.node)).map(item => ({ ...item, structureInfo: nodeStructureInfo(item.node) })), true)]],
        ['Saved concepts', results.customConcepts.map(renderCustomConceptSearchItem)],
        ['Reclassified neutral terms', results.reclassified.map(renderReclassifiedNeutralItem)],
        ['Neutral connections', results.bridges.map(item => renderBridgeListItem(item))],
        ['Neutral words', results.neutral.map(item => renderNeutralListItem(item))],
        ['Add concept', addPrompt ? [renderAddConceptPrompt(addPrompt)] : []]
      ].filter(([, items]) => items.length);

  if (!blocks.length) {
    els.list.innerHTML = `<p class="meta">${state.emotionFilter ? 'No emotion-path matches in this filter.' : 'No graph or neutral matches.'}</p>`;
    return;
  }

  els.list.innerHTML = blocks.map(([title, items]) => `
    <div class="result-group">
      <div class="result-group-title">${escapeHtml(title)}</div>
      ${items.join('')}
    </div>
  `).join('');

  els.list.querySelectorAll('.list-item[data-node-id]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedId = button.dataset.nodeId;
      render();
    });
  });

  els.list.querySelectorAll('[data-add-concept]').forEach(button => {
    button.addEventListener('click', () => {
      addConceptFromSearch(button.dataset.addConcept);
    });
  });
}

function renderStructuredNodeMatches(items, includeReason = false) {
  if (!items.length) return '<p class="meta">No typed node matches.</p>';
  const grouped = new Map();
  const normalized = items.map(item => item?.node ? item : { node: item, reason: '' });
  normalized.forEach(item => {
    const info = item.structureInfo || nodeStructureInfo(item.node);
    if (!grouped.has(info.typeId)) grouped.set(info.typeId, []);
    grouped.get(info.typeId).push(item);
  });

  const order = [...CORE_NODE_TYPE_ORDER, ...SUPPORT_NODE_TYPE_ORDER];
  return order
    .filter(typeId => grouped.has(typeId))
    .map(typeId => {
      const info = STRUCTURAL_TYPE_DEFS[typeId];
      const rows = grouped.get(typeId) || [];
      return `
        <section class="search-structure-group">
          <div class="search-structure-head">
            <strong>${escapeHtml(info.label)}</strong>
            <span>${rows.length}</span>
          </div>
          <p class="meta">${escapeHtml(info.computerQuestion)}</p>
          ${rows.map(item => renderNodeListItem(item.node, includeReason ? item.reason : '')).join('')}
        </section>
      `;
    })
    .join('');
}

function renderNodeListItem(node, reason = '') {
  const family = nodeColorKey(node);
  const typeInfo = nodeTypeInfo(node.type);
  const structureInfo = nodeStructureInfo(node);
  const nodeColor = colorForNode(node)?.hex || familyColor(family);
  return `
    <button class="list-item ${node.id === state.selectedId ? 'is-active' : ''}" type="button" data-node-id="${node.id}">
      <span class="dot" style="background:${escapeHtml(nodeColor)}"></span>
      <span>
        <span class="item-title">${escapeHtml(node.label)}</span>
        <span class="item-subtitle">${escapeHtml(typeInfo.label)} · ${escapeHtml(structureInfo.shortLabel)}${family ? ` · ${escapeHtml(family)}` : ''}${reason ? ` · ${escapeHtml(reason)}` : ''}</span>
      </span>
      <span class="pill">${outgoing(node.id).length + incoming(node.id).length}</span>
    </button>
  `;
}

function renderNeutralListItem(item) {
  return `
    <div class="list-item is-neutral">
      <span class="dot" style="background:${familyColor('common')}"></span>
      <span>
        <span class="item-title">${escapeHtml(item.term)}</span>
        <span class="item-subtitle">neutral · ${escapeHtml(item.reason)}</span>
      </span>
      <span class="pill">0</span>
    </div>
  `;
}

function renderWordStorageList() {
  if (!state.wordStorage.input.trim()) {
    els.list.innerHTML = `
      <section class="word-storage-summary">
        <strong>Word storage</strong>
        <p>Paste text into the box above, then submit it. The system will count each word and route it into the color storage it already belongs to.</p>
        <small>Words without a defensible stored route stay unresolved instead of being forced into a color bucket.</small>
      </section>
    `;
    return;
  }

  if (!state.wordStorage.records.length && !state.wordStorage.loading) {
    applyWordStorageAnalysis(state.wordStorage.input, {
      foundation: state.wordStorage.foundation,
      sourceMode: state.wordStorage.foundation ? 'foundation' : 'local',
      sourceLabel: state.wordStorage.foundation ? 'Foundation API' : 'Local analysis',
      loading: false,
      error: state.wordStorage.error || ''
    });
  }

  const analysis = state.wordStorage;
  const sourceLine = [
    analysis.sourceLabel,
    analysis.loading ? 'updating' : '',
    analysis.foundation?.stats?.totalCoOccurrences ? `${analysis.foundation.stats.totalCoOccurrences} co-occurrence links` : '',
    analysis.foundation?.patterns?.length ? `${analysis.foundation.patterns.length} structural patterns` : ''
  ].filter(Boolean).join(' · ');

  const groupMarkup = analysis.groups.map(group => `
    <section class="word-storage-section alias-family-group">
      <div class="alias-family-heading">
        <span class="dot" style="background:${familyColor(group.family)}"></span>
        <strong>${escapeHtml(group.label)}</strong>
        <span>${group.totalCount} words</span>
      </div>
      <div class="alias-family-items">
        ${group.items.map(renderWordStorageItem).join('')}
      </div>
    </section>
  `).join('');

  const unresolvedMarkup = analysis.unresolved.length ? `
    <section class="word-storage-section alias-family-group">
      <div class="alias-family-heading neutral-family-heading">
        <span class="dot" style="background:${familyColor('neutral')}"></span>
        <strong>Unresolved</strong>
        <span>${analysis.unresolved.reduce((sum, item) => sum + item.count, 0)} words</span>
      </div>
      <div class="alias-family-items">
        ${analysis.unresolved.map(renderWordStorageItem).join('')}
      </div>
    </section>
  ` : '';

  els.list.innerHTML = `
    <section class="word-storage-summary">
      <strong>${analysis.totalWords} total words · ${analysis.distinctWords} distinct words</strong>
      <p class="meta">${escapeHtml(sourceLine || 'Local analysis')}</p>
      <p>The graph is treating each word as a node candidate, then routing it into the nearest stored color bucket that already exists.</p>
      <small>Storage groups below reflect current graph truth. They do not invent new color routes.</small>
      ${analysis.error ? `<small>${escapeHtml(analysis.error)}</small>` : ''}
    </section>
    ${groupMarkup || '<p class="meta">No words in this text reached a stored color landing yet.</p>'}
    ${unresolvedMarkup}
  `;

  els.list.querySelectorAll('[data-word-storage-node-id]').forEach(button => {
    button.addEventListener('click', () => {
      const nodeId = button.dataset.wordStorageNodeId;
      if (!nodeId || !state.nodeById.has(nodeId)) return;
      state.selectedId = nodeId;
      render();
    });
  });
}

function renderWordStorageItem(item) {
  const subtitle = [item.storageLabel, item.routeTrace, item.reason].filter(Boolean).join(' · ');
  const countLabel = `${item.count}x`;
  const nodeId = item.nodeId ? ` data-word-storage-node-id="${escapeHtml(item.nodeId)}"` : '';
  const classes = item.nodeId ? 'list-item word-storage-word' : 'list-item is-neutral word-storage-word';
  return `
    <button class="${classes}" type="button"${nodeId}>
      <span class="dot" style="background:${familyColor(item.family || 'neutral')}"></span>
      <span>
        <span class="item-title">${escapeHtml(item.term)}</span>
        <span class="item-subtitle">${escapeHtml(subtitle || 'No resolved route yet.')}</span>
      </span>
      <span class="pill">${escapeHtml(countLabel)}</span>
    </button>
  `;
}

async function submitWordStorageText() {
  state.wordStorage.input = String(els.wordStorageInput?.value || '').trim();
  saveWordStorageInput();
  state.query = '';
  if (els.search) els.search.value = '';
  state.view = 'word-storage';
  if (!state.wordStorage.input) {
    clearWordStorageText();
    return;
  }
  const requestId = (state.wordStorage.requestId || 0) + 1;
  state.wordStorage.requestId = requestId;
  const analysis = applyWordStorageAnalysis(state.wordStorage.input, {
    foundation: null,
    sourceMode: 'local-preview',
    sourceLabel: 'Local preview',
    loading: true,
    error: ''
  });
  const firstResolved = analysis.records.find(item => item.nodeId && state.nodeById.has(item.nodeId));
  if (firstResolved) state.selectedId = firstResolved.nodeId;
  rebuildActiveGraph();
  render();

  try {
    const response = await fetch(`${API_BASE_URL}/v1/foundation/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: state.wordStorage.input })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Foundation analysis failed.');
    if (state.wordStorage.requestId !== requestId) return;
    const foundationAnalysis = applyWordStorageAnalysis(state.wordStorage.input, {
      foundation: result,
      sourceMode: 'foundation',
      sourceLabel: 'Foundation API',
      loading: false,
      error: ''
    });
    const resolvedNode = foundationAnalysis.records.find(item => item.nodeId && state.nodeById.has(item.nodeId));
    if (resolvedNode) state.selectedId = resolvedNode.nodeId;
    rebuildActiveGraph();
    render();
  } catch (error) {
    if (state.wordStorage.requestId !== requestId) return;
    applyWordStorageAnalysis(state.wordStorage.input, {
      foundation: null,
      sourceMode: 'local-fallback',
      sourceLabel: 'Local fallback',
      loading: false,
      error: `${error.message} Using local structure only.`
    });
    rebuildActiveGraph();
    render();
  }
}

function clearWordStorageText() {
  state.wordStorage = {
    input: '',
    records: [],
    groups: [],
    unresolved: [],
    totalWords: 0,
    distinctWords: 0,
    foundation: null,
    sourceMode: 'local',
    sourceLabel: 'Local analysis',
    loading: false,
    error: '',
    requestId: state.wordStorage?.requestId || 0
  };
  saveWordStorageInput();
  if (els.wordStorageInput) els.wordStorageInput.value = '';
  render();
}

function applyWordStorageAnalysis(text, options = {}) {
  const foundation = options.foundation || null;
  const analysis = foundation ? wordStorageAnalysisFromFoundation(text, foundation) : wordStorageAnalysis(text);
  state.wordStorage.records = analysis.records;
  state.wordStorage.groups = analysis.groups;
  state.wordStorage.unresolved = analysis.unresolved;
  state.wordStorage.totalWords = analysis.totalWords;
  state.wordStorage.distinctWords = analysis.distinctWords;
  state.wordStorage.foundation = foundation;
  state.wordStorage.sourceMode = options.sourceMode || 'local';
  state.wordStorage.sourceLabel = options.sourceLabel || 'Local analysis';
  state.wordStorage.loading = Boolean(options.loading);
  state.wordStorage.error = options.error || '';
  return analysis;
}

function wordStorageAnalysis(text) {
  const tokens = tokenizeInput(String(text || ''));
  const counts = tokens.reduce((map, term) => {
    map.set(term, (map.get(term) || 0) + 1);
    return map;
  }, new Map());
  const records = [...counts.entries()]
    .map(([term, count]) => resolveWordStorageRecord(term, count))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
  const groupsMap = new Map();
  const unresolved = [];

  records.forEach(record => {
    if (!record.family) {
      unresolved.push(record);
      return;
    }
    if (!groupsMap.has(record.family)) {
      groupsMap.set(record.family, {
        family: record.family,
        label: familyStorageLabel(record.family),
        totalCount: 0,
        items: []
      });
    }
    const group = groupsMap.get(record.family);
    group.items.push(record);
    group.totalCount += record.count;
  });

  const groups = [...groupsMap.values()]
    .sort((a, b) => b.totalCount - a.totalCount || a.label.localeCompare(b.label))
    .map(group => ({
      ...group,
      items: group.items.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    }));

  return {
    records,
    groups,
    unresolved,
    totalWords: tokens.length,
    distinctWords: counts.size
  };
}

function wordStorageAnalysisFromFoundation(text, foundation) {
  const wordCounts = Array.isArray(foundation?.wordCounts) ? foundation.wordCounts : [];
  const records = wordCounts
    .map(item => resolveWordStorageRecord(item.word, item.count))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
  const groupsMap = new Map();
  const unresolved = [];

  records.forEach(record => {
    if (!record.family) {
      unresolved.push(record);
      return;
    }
    if (!groupsMap.has(record.family)) {
      groupsMap.set(record.family, {
        family: record.family,
        label: familyStorageLabel(record.family),
        totalCount: 0,
        items: []
      });
    }
    const group = groupsMap.get(record.family);
    group.items.push(record);
    group.totalCount += record.count;
  });

  const groups = [...groupsMap.values()]
    .sort((a, b) => b.totalCount - a.totalCount || a.label.localeCompare(b.label))
    .map(group => ({
      ...group,
      items: group.items.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    }));

  return {
    records,
    groups,
    unresolved,
    totalWords: foundation?.stats?.totalWords || tokenizeInput(String(text || '')).length,
    distinctWords: foundation?.stats?.distinctWords || wordCounts.length
  };
}

function resolveWordStorageRecord(term, count) {
  const translation = resolveTranslation(term);
  const exactNode = exactNodesByLabel(term)[0] || null;
  const primaryPath = translation.paths?.[0] || null;
  const landing = translation.primaryLanding || primaryPath?.landing || landingForColorNode(exactNode);
  const family = landing?.family || exactNode?.family || null;
  const selectedNode = exactNode || landing?.node || null;
  const reason = firstNonEmptyText(
    primaryPath?.evidence?.[0],
    translation.themeRead?.reasoning,
    translation.unresolvedReason,
    exactNode?.metadata?.definition,
    exactNode?.metadata?.contextDefinition
  );
  const routeTrace = primaryPath?.nodes?.length
    ? primaryPath.nodes.join(' -> ')
    : selectedNode?.label
      ? `${selectedNode.label} -> ${familyStorageLabel(family)}`
      : '';

  return {
    term,
    count,
    nodeId: selectedNode?.id || '',
    family,
    storageLabel: landing ? `${landing.kind || 'landing'} storage` : 'unresolved storage',
    routeTrace,
    reason
  };
}

function familyStorageLabel(family) {
  const parts = splitFamilyId(family);
  if (!parts.length) return 'Unresolved';
  return parts.map(titleCase).join(' + ');
}

function renderReclassifiedNeutralItem(item) {
  const anchors = anchorsForCategory(item.categoryLabel);
  return `
    <div class="list-item is-neutral concept-search-item">
      <span class="dot" style="background:${familyColor(anchors[0] || 'common')}"></span>
      <span>
        <span class="item-title">${escapeHtml(item.term)}</span>
        <span class="item-subtitle">reclassified · ${escapeHtml(item.categoryLabel)} · ${escapeHtml(item.reason)}</span>
      </span>
      <span class="pill">${escapeHtml(item.categoryLabel)}</span>
    </div>
  `;
}

function renderCustomConceptSearchItem(concept) {
  return `
    <div class="list-item is-neutral concept-search-item">
      <span class="dot" style="background:${familyColor((concept.anchorIds || [])[0] || 'common')}"></span>
      <span>
        <span class="item-title">${escapeHtml(concept.label)}</span>
        <span class="item-subtitle">saved concept · ${escapeHtml(concept.categoryLabel)} · ${escapeHtml(concept.assignmentReason)}</span>
      </span>
      <span class="pill">${escapeHtml(concept.categoryLabel)}</span>
    </div>
  `;
}

function renderAddConceptPrompt(prompt) {
  return `
    <div class="add-concept-card">
      <div>
        <strong>${escapeHtml(prompt.label)}</strong>
        <span>Theme condition: ${escapeHtml(prompt.category.label)}</span>
      </div>
      <p>${escapeHtml(prompt.reason)}</p>
      <button type="button" data-add-concept="${escapeHtml(prompt.term)}">Add concept</button>
    </div>
  `;
}

function renderBridgeListItem(item) {
  const target = state.nodeById.get(item.targetNodeId);
  const neutralNode = state.nodeById.get(item.neutralNodeId);
  const title = `${item.neutralTerm} -> ${item.synonym} -> ${target?.label || item.targetNodeId}`;
  return `
    <button class="list-item" type="button" data-node-id="${item.neutralNodeId}">
      <span class="dot" style="background:${familyColor(target?.family || target?.id?.replace('family-', '') || 'common')}"></span>
      <span>
        <span class="item-title">${escapeHtml(title)}</span>
        <span class="item-subtitle">cited bridge · ${escapeHtml(item.evidence)}</span>
      </span>
      <span class="pill">${outgoing(neutralNode?.id || '').length}</span>
    </button>
  `;
}

function renderEmotionPathListItem(item) {
  const source = state.nodeById.get(item.sourceNodeId);
  const landing = item.path?.landing?.node;
  const family = item.path?.landing?.family || nodeColorKey(landing);
  const title = `${source?.label || item.sourceNodeId} -> ${landing?.label || 'color landing'}`;
  return `
    <button class="list-item" type="button" data-node-id="${source?.id || item.sourceNodeId}">
      <span class="dot" style="background:${familyColor(family)}"></span>
      <span>
        <span class="item-title">${escapeHtml(title)}</span>
        <span class="item-subtitle">emotion path · ${escapeHtml(item.evidence || item.path?.evidence?.[0] || 'contextual emotional color association')}</span>
      </span>
      <span class="pill">${escapeHtml(item.path?.confidence || 'medium')}</span>
    </button>
  `;
}

function graphAwareSearch(query) {
  const normalized = query.toLowerCase();
  const exact = [];
  const connectedById = new Map();
  const matchingNodes = state.nodes.filter(node => searchText(node).includes(normalized));

  matchingNodes.forEach(node => {
    if (node.label.toLowerCase() === normalized || node.id.toLowerCase().includes(normalized)) exact.push(node);
    [...outgoing(node.id), ...incoming(node.id)].forEach(edge => {
      const otherId = edge.source === node.id ? edge.target : edge.source;
      const other = state.nodeById.get(otherId);
      if (!other || other.id === node.id) return;
      if (!connectedById.has(other.id)) connectedById.set(other.id, { node: other, reason: edge.type });
    });
  });

  state.nodes.forEach(node => {
    if (!searchText(node).includes(normalized)) return;
    if (!exact.some(item => item.id === node.id) && !connectedById.has(node.id)) {
      connectedById.set(node.id, { node, reason: 'text match' });
    }
  });

  const exactReclassified = neutralReclassifiedTerms().has(normalized);
  const neutral = exactReclassified ? [] : neutralTerms()
    .filter(item => `${item.term} ${item.reason}`.toLowerCase().includes(normalized))
    .sort((a, b) => a.term.localeCompare(b.term))
    .slice(0, 80);

  const bridges = neutralConnectionResults(normalized);
  const emotions = emotionRouteResults(normalized);
  const reclassified = neutralReclassifiedResults(normalized);
  const customConcepts = state.customConcepts
    .filter(concept => [
      concept.term,
      concept.label,
      concept.categoryLabel,
      concept.assignmentReason
    ].filter(Boolean).join(' ').toLowerCase().includes(normalized))
    .slice(0, 40);

  return {
    exact: uniqueNodes(exact).sort((a, b) => a.label.localeCompare(b.label)).slice(0, 40),
    connected: [...connectedById.values()].sort((a, b) => a.node.label.localeCompare(b.node.label)).slice(0, 80),
    emotions,
    bridges,
    reclassified,
    customConcepts,
    neutral
  };
}

function analyzeInputContext(query) {
  const normalized = query.toLowerCase().trim();
  const terms = uniqueStrings([normalized, ...tokenizeInput(normalized)]);
  const routes = [];
  const signals = [];
  const directNodes = [];
  const commonNodes = [];
  const emotionNodes = emotionCueNodes(normalized);
  const neutralNodes = [];
  const neutralItems = [];
  const reclassifiedItems = [];
  const bridgeItems = [];
  const reclassifiedByTerm = neutralReclassifiedTerms();

  terms.forEach(term => {
    const exactNodes = state.nodes.filter(node => node.label.toLowerCase() === term);
    exactNodes.forEach(node => {
      if (['family', 'alias', 'synonym'].includes(node.type)) directNodes.push(node);
      if (node.type === 'common_word') commonNodes.push(node);
      if (node.type === 'emotion_word') emotionNodes.push(node);
      if (node.type === 'neutral_word') neutralNodes.push(node);
    });

    neutralTerms()
      .filter(item => item.term.toLowerCase() === term)
      .forEach(item => neutralItems.push(item));

    if (reclassifiedByTerm.has(term)) reclassifiedItems.push(reclassifiedByTerm.get(term));

    neutralConnectionResults(term)
      .filter(item => item.neutralTerm.toLowerCase() === term || item.synonym.toLowerCase() === term)
      .forEach(item => bridgeItems.push(item));
  });

  uniqueNodes(directNodes).slice(0, 6).forEach(node => {
    signals.push(node.type === 'family' ? 'direct family' : node.type === 'alias' ? 'direct alias' : 'cited color synonym');
    routes.push({
      title: `${node.label} -> ${node.family || node.id.replace('family-', '')}`,
      detail: node.metadata?.definition || node.metadata?.evidence || 'definition-backed color term'
    });
  });

  uniqueNodes(commonNodes).slice(0, 6).forEach(node => {
    signals.push('concrete association');
    const targets = outgoing(node.id)
      .filter(edge => edge.type === 'associated_color')
      .map(edge => state.nodeById.get(edge.target)?.label)
      .filter(Boolean)
      .join(', ');
    routes.push({
      title: `${node.label} -> ${targets || 'associated color'}`,
      detail: node.metadata?.contextDefinition || node.metadata?.associationBasis || 'concrete object color association'
    });
  });

  uniqueNodes(emotionNodes).slice(0, 6).forEach(node => {
    signals.push('emotion input');
    const cue = emotionPhraseCues(normalized).find(item => item.targetNodeId === node.id);
    const targets = outgoing(node.id)
      .filter(edge => edge.type === 'emotion_association')
      .map(edge => state.nodeById.get(edge.target)?.label)
      .filter(Boolean)
      .join(', ');
    routes.push({
      title: `${node.label} -> ${targets || 'emotional color route'}`,
      detail: cue?.evidence || node.metadata?.emotionDefinition || node.metadata?.associationBasis || 'contextual emotional color association'
    });
  });

  uniqueNodes(neutralNodes).slice(0, 6).forEach(node => {
    signals.push('neutral word');
    const targets = outgoing(node.id)
      .map(edge => state.nodeById.get(edge.target)?.label)
      .filter(Boolean)
      .join(', ');
    routes.push({
      title: `${node.label}${targets ? ` -> ${targets}` : ''}`,
      detail: node.metadata?.evidence || 'neutral word with cited bridge only when available'
    });
  });

  bridgeItems.slice(0, 6).forEach(item => {
    const target = state.nodeById.get(item.targetNodeId);
    signals.push('cited synonym bridge');
    routes.push({
      title: `${item.neutralTerm} -> ${item.synonym} -> ${target?.label || item.targetNodeId}`,
      detail: item.evidence
    });
  });

  reclassifiedItems.slice(0, 6).forEach(item => {
    signals.push('theme condition');
    routes.push({
      title: `${item.term} -> ${item.categoryLabel} condition`,
      detail: item.reason
    });
  });

  neutralItems.slice(0, 6).forEach(item => {
    if (routes.some(route => route.title.toLowerCase().startsWith(item.term.toLowerCase()))) return;
    signals.push('neutral unresolved');
    routes.push({
      title: `${item.term} -> neutral`,
      detail: item.reason
    });
  });

  const senses = inputContextSenses(terms);
  senses.forEach(sense => signals.push(`sense: ${sense.shape}`));

  const hasPhrase = tokenizeInput(normalized).length > 1;
  if (hasPhrase) signals.push('phrase context');

  let stateId = 'neutral_unresolved';
  let label = 'Neutral unresolved term';
  let confidence = 'low';
  if (directNodes.length) {
    stateId = 'direct_color';
    label = 'Direct color term';
    confidence = 'high';
  } else if (emotionNodes.length) {
    stateId = 'emotion_input';
    label = 'Emotional translator input';
    confidence = 'medium';
  } else if (commonNodes.length || bridgeItems.length || neutralNodes.some(node => outgoing(node.id).length)) {
    stateId = 'semantic_bridge';
    label = 'Semantic bridge term';
    confidence = 'medium';
  } else if (reclassifiedItems.length) {
    stateId = 'theme_context';
    label = 'Theme condition term';
    confidence = 'medium';
  } else if (hasPhrase && routes.length) {
    label = 'Context phrase';
  }

  return {
    stateId,
    label,
    confidence,
    signals: uniqueStrings(signals).slice(0, 10),
    routes: uniqueRoutes(routes).slice(0, 10),
    senses
  };
}

function resolveTranslation(query, analysis = analyzeInputContext(query)) {
  const normalized = query.toLowerCase().trim();
  if (!normalized) {
    return {
      input: '',
      contextState: analysis.stateId || 'neutral_unresolved',
      confidence: 'low',
      paths: [],
      emotionalRead: null,
      emotionalBlend: null,
      emotionConnections: [],
      evocativeAssociation: null,
      themeComposition: null,
      selectionClimate: null,
      personalRead: null,
      themeRead: null,
      humanBridges: [],
      logicChecks: null,
      primaryLanding: null,
      alternativeLandings: [],
      evocativeSuggestions: [],
      unresolvedReason: 'No color landing found.'
    };
  }

  const terms = uniqueStrings([normalized, ...tokenizeInput(normalized)]);
  const paths = [];

  emotionCueNodes(normalized).forEach(node => {
    emotionColorPaths(node).forEach(path => {
      const cue = emotionPhraseCues(normalized).find(item => item.targetNodeId === node.id);
      paths.push({
        ...path,
        input: normalized,
        evidence: cue ? [cue.evidence, ...path.evidence] : path.evidence
      });
    });
  });

  terms.forEach(term => {
    exactNodesByLabel(term).forEach(node => {
      if (['family', 'alias', 'synonym'].includes(node.type)) {
        const landing = landingForColorNode(node);
        if (!landing) return;
        paths.push({
          input: normalized,
          contextState: 'direct_color',
          confidence: 'high',
          nodes: [node.label],
          nodeIds: [node.id],
          edgeTypes: [],
          evidence: [node.metadata?.definition, node.metadata?.evidence, node.metadata?.definitionBasis].filter(Boolean),
          landing
        });
      }

      if (node.type === 'common_word') {
        associatedColorPaths(node).forEach(path => paths.push(path));
      }

      if (node.type === 'emotion_word') {
        emotionColorPaths(node).forEach(path => paths.push(path));
      }

      if (node.type === 'neutral_word') {
        neutralLandingPaths(node).forEach(path => paths.push(path));
      }
    });
  });

  const rankedPaths = rankTranslationPaths(uniqueTranslationPaths(paths));
  const displayPaths = displayTranslationPaths(rankedPaths);
  const primaryPath = displayPaths[0];
  const primaryLanding = primaryPath?.landing || null;
  const themeComposition = themeCompositionForQuery(normalized);
  const selectionClimate = selectionClimateForQuery(normalized);
  const themeRead = themeReadForTranslation(normalized, primaryPath, displayPaths, themeComposition);
  const humanBridges = humanBridgesForTranslation(normalized, displayPaths, themeRead, themeComposition);
  const logicChecks = logicChecksForTranslation(themeRead, humanBridges, primaryPath);
  const emotionConnections = emotionConnectionsForTranslation(displayPaths, themeComposition);
  const evocativeAssociation = evocativeAssociationForTranslation(primaryPath, emotionConnections, themeRead);
  const personalRead = personalOverlayForTranslation(normalized, {
    paths: displayPaths,
    primaryLanding,
    themeComposition,
    themeRead,
    emotionConnections
  });

  return {
    input: normalized,
    contextState: analysis.stateId,
    confidence: primaryPath?.confidence || 'low',
    paths: displayPaths,
    allPaths: rankedPaths,
    structuralSummary: summarizeStructuralRoutes(rankedPaths, displayPaths),
    emotionalRead: emotionalReadForPath(primaryPath, normalized),
    emotionalBlend: emotionalBlendForPaths(displayPaths, normalized),
    emotionConnections,
    evocativeAssociation,
    themeComposition,
    selectionClimate,
    personalRead,
    themeRead,
    humanBridges,
    logicChecks,
    primaryLanding,
    alternativeLandings: displayPaths.slice(1, 5),
    evocativeSuggestions: primaryLanding ? evocativeSuggestions(primaryLanding.family) : [],
    unresolvedReason: primaryPath ? '' : unresolvedReason(terms)
  };
}

function associatedColorPaths(node, prefix = null) {
  return outgoing(node.id)
    .filter(edge => edge.type === 'associated_color')
    .map(edge => {
      const target = state.nodeById.get(edge.target);
      const landing = landingForColorNode(target);
      if (!target || !landing) return null;
      const nodes = prefix ? [...prefix.nodes, target.label] : [node.label, target.label];
      const nodeIds = prefix ? [...prefix.nodeIds, target.id] : [node.id, target.id];
      const edgeTypes = prefix ? [...prefix.edgeTypes, edge.type] : [edge.type];
      const evidence = prefix ? [...prefix.evidence, edge.evidence || edge.description].filter(Boolean) : [edge.evidence || edge.description].filter(Boolean);
      if (node.metadata?.contextDefinition) evidence.unshift(node.metadata.contextDefinition);
      return {
        input: prefix?.input || node.label.toLowerCase(),
        contextState: prefix?.contextState || 'semantic_bridge',
        confidence: prefix?.confidence || 'medium',
        nodes,
        nodeIds,
        edgeTypes,
        evidence,
        landing
      };
    })
    .filter(Boolean);
}

function emotionColorPaths(node, prefix = null, visited = new Set()) {
  if (!node || visited.has(node.id)) return [];
  visited = new Set(visited);
  visited.add(node.id);

  return outgoing(node.id)
    .filter(edge => edge.type === 'emotion_association')
    .flatMap(edge => {
      const target = state.nodeById.get(edge.target);
      if (!target || visited.has(target.id)) return [];
      const next = {
        input: prefix?.input || node.label.toLowerCase(),
        contextState: 'semantic_bridge',
        confidence: prefix?.confidence || 'medium',
        nodes: prefix ? [...prefix.nodes, target.label] : [node.label, target.label],
        nodeIds: prefix ? [...prefix.nodeIds, target.id] : [node.id, target.id],
        edgeTypes: prefix ? [...prefix.edgeTypes, edge.type] : [edge.type],
        evidence: prefix ? [...prefix.evidence, edge.evidence || edge.description].filter(Boolean) : [node.metadata?.emotionDefinition, edge.evidence || edge.description].filter(Boolean)
      };
      const landing = landingForColorNode(target);
      if (landing) return [{ ...next, landing }];
      if (target.type === 'emotion_word') return emotionColorPaths(target, next, visited);
      return [];
    });
}

function neutralLandingPaths(startNode) {
  const complete = [];
  const queue = [{
    input: startNode.label.toLowerCase(),
    contextState: 'semantic_bridge',
    confidence: 'medium',
    nodes: [startNode.label],
    nodeIds: [startNode.id],
    edgeTypes: [],
    evidence: [],
    currentId: startNode.id
  }];
  const allowed = new Set(['neutral_synonym', 'synonym_to_mapped_word', 'synonym_to_color_alias', 'associated_color']);

  while (queue.length) {
    const path = queue.shift();
    if (path.edgeTypes.length >= 4) continue;

    outgoing(path.currentId)
      .filter(edge => allowed.has(edge.type))
      .forEach(edge => {
        const target = state.nodeById.get(edge.target);
        if (!target || path.nodeIds.includes(target.id)) return;

        const next = {
          ...path,
          nodes: [...path.nodes, target.label],
          nodeIds: [...path.nodeIds, target.id],
          edgeTypes: [...path.edgeTypes, edge.type],
          evidence: [...path.evidence, edge.evidence || edge.description].filter(Boolean),
          currentId: target.id
        };

        const landing = landingForColorNode(target);
        if (landing) {
          complete.push({
            ...next,
            confidence: next.edgeTypes.length <= 3 ? 'medium' : 'low',
            landing
          });
          return;
        }

        if (target.type === 'common_word') {
          associatedColorPaths(target, next).forEach(associatedPath => {
            complete.push({
              ...associatedPath,
              confidence: associatedPath.edgeTypes.length <= 3 ? 'medium' : 'low'
            });
          });
        }

        queue.push(next);
      });
  }

  return complete;
}

function landingForColorNode(node) {
  if (!node) return null;
  if (node.type === 'family') {
    return { node, family: node.family || node.id.replace('family-', ''), kind: 'family' };
  }
  if (node.type === 'alias') {
    return { node, family: node.family, kind: 'alias' };
  }
  if (node.type === 'synonym' && node.family) {
    const familyNode = state.nodeById.get(`family-${node.family}`);
    return { node: familyNode || node, family: node.family, kind: familyNode ? 'family' : 'synonym' };
  }
  if (node.type === 'subfamily') {
    return { node, family: node.family, kind: 'bridge' };
  }
  if (node.type === 'shade') {
    return { node, family: node.family, kind: 'shade' };
  }
  return null;
}

function structuralPathSummary(path) {
  const nodes = (path.nodeIds || []).map(id => state.nodeById.get(id)).filter(Boolean);
  const structureIds = nodes.map(node => nodeStructureInfo(node).typeId);
  const uniqueTypes = uniqueStrings(structureIds);
  let score = 0;
  const reasons = [];

  if (!nodes.length) {
    return { score: 0, strength: 'unresolved', reasons: ['No node structure found yet.'] };
  }

  if (structureIds.includes('color')) {
    score += 3;
    reasons.push('Touches a stable color field.');
  }

  if (structureIds.includes('shade')) {
    score += 2;
    reasons.push('Reaches specific shade language.');
  }

  if (structureIds.includes('object')) {
    score += 2;
    reasons.push('Uses a concrete object/context source.');
  }

  if (structureIds.includes('emotion')) {
    score += 2;
    reasons.push('Starts from an emotion route instead of a raw label jump.');
  }

  if (structureIds.includes('theme') || structureIds.includes('condition')) {
    score += 1;
    reasons.push('Includes a framing condition.');
  }

  if (structureIds.includes('evidence')) {
    score += 1;
    reasons.push('Includes verification/growth support.');
  }

  if (uniqueTypes.length >= 2) {
    score += 1;
    reasons.push('Moves across more than one valid node layer.');
  }

  if ((path.edgeTypes || []).length <= 2) {
    score += 1;
    reasons.push('Route stays compact.');
  } else if ((path.edgeTypes || []).length >= 4) {
    score -= 1;
    reasons.push('Route is starting to sprawl.');
  }

  const languageHeavy = structureIds.filter(typeId => typeId === 'word').length;
  if (languageHeavy >= 2 && !structureIds.includes('object') && !structureIds.includes('color') && !structureIds.includes('emotion')) {
    score -= 2;
    reasons.push('Mostly moves through language without enough grounding.');
  }

  const landingType = nodeStructureInfo(path.landing?.node).typeId;
  if (landingType === 'shade') {
    score += 1;
    reasons.push('Lands on a precise shade.');
  } else if (landingType === 'color') {
    score += 1;
    reasons.push('Lands on a stable base color.');
  }

  const strength = score >= 8 ? 'strong' : score >= 5 ? 'supported' : score >= 3 ? 'partial' : 'weak';
  return { score, strength, reasons, structureIds };
}

function annotateTranslationPath(path) {
  const structure = structuralPathSummary(path);
  return {
    ...path,
    structuralScore: structure.score,
    structuralStrength: structure.strength,
    structuralReasons: structure.reasons,
    structuralTypes: structure.structureIds
  };
}

function pathRouteHealth(path) {
  const strength = path?.structuralStrength || 'weak';
  if (strength === 'strong' || strength === 'supported') return 'usable';
  if (strength === 'partial') return 'tentative';
  return 'weak';
}

function routeBucketRank(bucket) {
  return { weak: 0, tentative: 1, usable: 2 }[bucket] ?? 0;
}

function routeFilterAllows(bucket = 'weak') {
  return state.routeHealthFilters[bucket] !== false;
}

function strongerRouteBucket(a = 'weak', b = 'weak') {
  return routeBucketRank(a) >= routeBucketRank(b) ? a : b;
}

function routeBucketOpacity(bucket) {
  return {
    usable: 1,
    tentative: 0.52,
    weak: 0.18
  }[bucket] ?? 1;
}

function connectionStrengthOpacity(score = 0, bucket = 'weak', min = 0.04, max = 1) {
  const bucketAlpha = routeBucketOpacity(bucket);
  const curvedStrength = Math.pow(clamp(score, 0, 1), 1.35);
  return clamp(min + (max - min) * curvedStrength * bucketAlpha, min, max);
}

function summarizeStructuralRoutes(allPaths = [], displayPaths = []) {
  const supportedCount = displayPaths.length;
  const weakCount = Math.max(0, allPaths.length - displayPaths.length);
  const primary = displayPaths[0] || allPaths[0] || null;
  const primaryStrength = primary?.structuralStrength || 'unresolved';
  const reasons = uniqueStrings((primary?.structuralReasons || []).slice(0, 3));
  const headlineMap = {
    strong: 'Grounded route: the graph is moving through stable layers, not just labels.',
    supported: 'Supported route: the graph has enough structure to travel with context.',
    partial: 'Partial route: enough structure to read, but still missing some grounding.',
    weak: 'Weak route: mostly language-level movement, so the graph is holding this lightly.',
    unresolved: 'No grounded route yet.'
  };
  return {
    supportedCount,
    weakCount,
    primaryStrength,
    reasons,
    headline: headlineMap[primaryStrength] || headlineMap.unresolved
  };
}

function displayTranslationPaths(paths = []) {
  const usable = paths.filter(path => pathRouteHealth(path) === 'usable');
  if (usable.length) return usable;
  const tentative = paths.filter(path => pathRouteHealth(path) === 'tentative');
  if (tentative.length) return tentative;
  return paths;
}

function rankTranslationPaths(paths) {
  const confidenceRank = { high: 0, medium: 1, low: 2 };
  const kindRank = { alias: 0, synonym: 1, family: 2, bridge: 3, shade: 4 };
  return [...paths].map(annotateTranslationPath).sort((a, b) => {
    const structural = (b.structuralScore || 0) - (a.structuralScore || 0);
    if (structural) return structural;
    const confidence = confidenceRank[a.confidence] - confidenceRank[b.confidence];
    if (confidence) return confidence;
    const length = a.edgeTypes.length - b.edgeTypes.length;
    if (length) return length;
    const kind = (kindRank[a.landing.kind] ?? 3) - (kindRank[b.landing.kind] ?? 3);
    if (kind) return kind;
    return a.landing.node.label.localeCompare(b.landing.node.label);
  });
}

function uniqueTranslationPaths(paths) {
  const seen = new Set();
  return paths.filter(path => {
    const key = `${path.nodeIds.join('>')}|${path.landing.node.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function exactNodesByLabel(term) {
  return state.nodes.filter(node => node.label.toLowerCase() === term);
}

function evocativeSuggestions(familyId) {
  const family = familyData(familyId);
  if (!family) return [];
  return family.moods.slice(0, 3).map(mood => ({
    id: mood.id,
    label: mood.label,
    intensity: mood.intensity,
    names: mood.names.slice(0, 3)
  }));
}

function familyData(familyId) {
  return state.data.families.find(item => item.id === familyId);
}

function unresolvedReason(terms) {
  const neutral = neutralTerms().find(item => terms.includes(item.term.toLowerCase()));
  if (neutral) return neutral.reason;
  return 'No direct color, concrete association, or cited synonym path reaches a color landing.';
}

function emotionalReadForPath(path, query) {
  if (!path || !path.nodeIds?.length) return null;
  const emotionNode = path.nodeIds
    .map(id => state.nodeById.get(id))
    .find(node => node?.type === 'emotion_word');
  if (!emotionNode) return null;
  const metadata = emotionNode.metadata || {};
  const cue = emotionPhraseCues(query).find(item => item.targetNodeId === emotionNode.id);
  return {
    label: emotionNode.label,
    tone: metadata.tone || 'emotional',
    confidence: path.confidence || metadata.confidence || 'medium',
    definition: metadata.emotionDefinition || 'emotional input context',
    evidence: cue?.evidence || path.evidence?.find(item => item && item !== metadata.emotionDefinition) || metadata.associationBasis || 'contextual emotional color association'
  };
}

function emotionalBlendForPaths(paths, query) {
  const componentsByEmotion = new Map();
  paths.forEach(path => {
    const emotionNode = path.nodeIds
      ?.map(id => state.nodeById.get(id))
      .find(node => node?.type === 'emotion_word');
    if (!emotionNode || componentsByEmotion.has(emotionNode.id)) return;
    const metadata = emotionNode.metadata || {};
    const cue = emotionPhraseCues(query).find(item => item.targetNodeId === emotionNode.id);
    componentsByEmotion.set(emotionNode.id, {
      id: emotionNode.id,
      label: emotionNode.label,
      tone: metadata.tone || 'emotional',
      definition: metadata.emotionDefinition || '',
      evidence: cue?.evidence || path.evidence?.[0] || '',
      family: path.landing?.family || '',
      landingLabel: path.landing?.node?.label || '',
      nodeId: path.landing?.node?.id || ''
    });
  });

  const components = [...componentsByEmotion.values()];
  if (components.length < 2) return null;

  const paletteByFamily = new Map();
  paths.forEach(path => {
    const landing = path.landing;
    if (!landing?.family || paletteByFamily.has(landing.family)) return;
    paletteByFamily.set(landing.family, {
      family: landing.family,
      label: landing.node.label,
      nodeId: landing.node.id
    });
  });

  return {
    components: components.slice(0, 5),
    palette: [...paletteByFamily.values()].slice(0, 6)
  };
}

function emotionConnectionsForTranslation(paths = [], themeComposition = null) {
  const families = new Set(paths.map(path => path.landing?.family).filter(Boolean));
  const anchorIds = themeComposition?.anchorIds || themeComposition?.theme?.anchorIds || [];
  const anchors = state.data.crossDomainBridges?.anchorFamilies || [];
  anchorIds.forEach(anchorId => {
    const anchor = anchors.find(item => item.id === anchorId);
    (anchor?.families || []).forEach(family => families.add(family));
  });
  return emotionConnectionsForFamilies([...families]);
}

function emotionConnectionsForFamilies(families = []) {
  const familySet = new Set(families.filter(Boolean));
  if (!familySet.size) return [];

  const preferredFamily = families.find(Boolean);
  const byEmotion = new Map();
  state.nodes
    .filter(node => node.type === 'emotion_word')
    .forEach(emotionNode => {
      outgoing(emotionNode.id)
        .filter(edge => edge.type === 'emotion_association')
        .forEach(edge => {
          const target = state.nodeById.get(edge.target);
          const landing = landingForColorNode(target);
          const family = landing?.family;
          if (!family || !familySet.has(family)) return;
          const metadata = emotionNode.metadata || {};
          if (!byEmotion.has(emotionNode.id)) {
            byEmotion.set(emotionNode.id, {
              nodeId: emotionNode.id,
              label: emotionNode.label,
              tone: metadata.tone || 'emotional',
              family,
              evidence: edge.evidence || edge.description || metadata.associationBasis || '',
              boundary: 'related through color-climate landing, not a fixed emotional label',
              degree: 0
            });
          }
          const current = byEmotion.get(emotionNode.id);
          current.degree += 1;
          if (family === preferredFamily) current.family = family;
        });
    });

  return [...byEmotion.values()]
    .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label))
    .slice(0, 8);
}

function emotionConnectionsForNode(node) {
  if (!node || node.type === 'emotion_word') return [];
  const landing = landingForColorNode(node);
  if (landing?.family) return emotionConnectionsForFamilies([landing.family]);
  if (node.type === 'common_word') {
    return emotionConnectionsForTranslation(associatedColorPaths(node));
  }
  if (node.type === 'neutral_word') {
    return emotionConnectionsForTranslation(neutralLandingPaths(node));
  }
  return [];
}

function evocativeAssociationForTranslation(primaryPath, emotionConnections = [], themeRead = null) {
  if (!primaryPath?.landing) return null;
  const landing = primaryPath.landing;
  const family = familyData(landing.family);
  const moods = (family?.moods || []).slice(0, 3);
  const moodLabels = moods.map(mood => mood.label);
  const moodNames = moods.flatMap(mood => mood.names.slice(0, 2));
  const emotionLabels = emotionConnections.slice(0, 5).map(item => item.label);
  const source = primaryPath.nodes[0] || primaryPath.input || 'input';
  const target = landing.node?.label || landing.family;
  const themePhrase = themeRead ? ` Through ${themeRead.filter}, this can tilt toward ${themeRead.theme}.` : '';
  return {
    title: `${source} -> ${target} association`,
    strength: primaryPath.confidence === 'high' ? 'strong baseline / interpretive overlay' : `${primaryPath.confidence} baseline / interpretive overlay`,
    baselineRoute: primaryPath.nodes.join(' -> '),
    emotionalClimate: emotionLabels.length
      ? emotionLabels.join(', ')
      : `${family?.label || landing.family} climate`,
    evocativeMeaning: moodLabels.length
      ? `${moodLabels.join(', ')}; example language: ${moodNames.slice(0, 6).join(', ')}`
      : `${family?.label || landing.family} presentation climate`,
    dotConnection: `${source} has a defensible route into ${family?.label || landing.family}; the emotion and mood language describes what that landing can suggest.${themePhrase}`,
    boundary: 'Baseline route is evidence-backed. Emotional and evocative associations are interpretive context, not strict synonyms or permanent identity.'
  };
}

function themeCompositionForQuery(query) {
  const themes = matchingCompositionThemes(query);
  if (!themes.length) return null;
  if (themes.length === 1) {
  return {
    kind: 'single',
    theme: themes[0],
    anchorIds: themes[0].anchorIds || [],
    categoryMap: categoryMapForThemes([themes[0]])
  };
  }
  return composeThemes(themes);
}

function matchingCompositionThemes(query) {
  const normalized = query.toLowerCase().trim();
  const tokens = tokenizeInput(normalized);
  const allThemes = allCompositionThemes();
  const activeCandidates = activeThemeFilters(allThemes);
  const queryCandidates = allThemes
    .filter(theme => (theme.cues || []).some(cue => cueMatchesQuery(cue, normalized, tokens)))
    .sort((a, b) => specificityScore(b) - specificityScore(a) || a.label.localeCompare(b.label));
  const candidates = uniqueThemes([...activeCandidates, ...queryCandidates])
    .sort((a, b) => specificityScore(b) - specificityScore(a) || a.label.localeCompare(b.label));
  const selected = [];
  const usedCategories = new Set();

  candidates.forEach(theme => {
    const isSpecificReligion = theme.category === 'Religion' && theme.id !== 'religion';
    if (theme.id === 'religion' && candidates.some(item => item.category === 'Religion' && item.id !== 'religion')) return;
    if (!isSpecificReligion && usedCategories.has(theme.category) && selected.length) return;
    selected.push(theme);
    usedCategories.add(theme.category);
  });

  return selected.slice(0, 3);
}

function activeThemeFilters(themes = allCompositionThemes()) {
  const byId = new Map(themes.map(theme => [theme.id, theme]));
  return state.activeThemeFilterIds.map(id => byId.get(id)).filter(Boolean);
}

function uniqueThemes(themes) {
  const seen = new Set();
  return themes.filter(theme => {
    if (!theme || seen.has(theme.id)) return false;
    seen.add(theme.id);
    return true;
  });
}

function composeThemes(themes) {
  const composition = exactCompositionForThemes(themes) || defaultCompositionForThemes(themes);
  return {
    kind: 'composed',
    themes: themes.slice(0, 3),
    composedClimate: composition.composedClimate,
    themeExpression: composition.themeExpression || composition.composedClimate,
    themeShift: composition.themeShift || composition.colorShift,
    colorShift: composition.colorShift,
    emotionalShift: composition.emotionalShift,
    meaningShift: composition.meaningShift,
    boundary: composition.boundary || state.data.themeComposition?.boundary || '',
    anchorIds: composition.anchorIds || uniqueStrings(themes.flatMap(theme => theme.anchorIds || [])),
    categoryMap: categoryMapForThemes(themes)
  };
}

function exactCompositionForThemes(themes) {
  const themeIds = new Set(themes.map(theme => theme.id));
  const categoryIds = new Set(themes.map(theme => theme.category.toLowerCase()));
  return (state.data.themeComposition?.compositions || [])
    .filter(composition => {
      const ids = composition.themeIds || [];
      return ids.every(id => themeIds.has(id) || categoryIds.has(id));
    })
    .sort((a, b) => compositionSpecificity(b, themeIds) - compositionSpecificity(a, themeIds))[0];
}

function compositionSpecificity(composition, themeIds) {
  return (composition.themeIds || []).filter(id => themeIds.has(id)).length;
}

function defaultCompositionForThemes(themes) {
  const defaults = state.data.themeComposition?.defaultComposition || {};
  const names = themes.map(theme => theme.label).join(' + ');
  const anchors = uniqueStrings(themes.flatMap(theme => theme.anchorIds || []));
  return {
    composedClimate: `${names} layered climate`,
    themeExpression: `${names} layered theme`,
    themeShift: defaults.themeShift || 'The theme terms change as the active conditions layer together.',
    colorShift: defaults.colorShift || 'The themes alter each other instead of staying separate.',
    emotionalShift: defaults.emotionalShift || 'The emotional tone becomes layered.',
    meaningShift: defaults.meaningShift || 'The meaning changes through relation.',
    boundary: defaults.boundary || state.data.themeComposition?.boundary || '',
    anchorIds: anchors
  };
}

function cueMatchesQuery(cue, normalized, tokens) {
  const cueText = cue.toLowerCase().trim();
  if (!cueText) return false;
  if (cueText.includes(' ')) return normalized.includes(cueText);
  return tokens.includes(cueText);
}

function specificityScore(theme) {
  const cueLength = Math.max(...(theme.cues || ['']).map(cue => cue.length));
  const categoryBonus = theme.category === 'Religion' && theme.id !== 'religion' ? 50 : 0;
  return categoryBonus + cueLength;
}

function categoryMapForThemes(themes) {
  const categoryByLabel = new Map((state.data.themeComposition?.categories || [])
    .map(category => [category.label.toLowerCase(), category]));
  const seen = new Set();
  return themes
    .map(theme => {
      const category = categoryByLabel.get(theme.category.toLowerCase());
      if (!category || seen.has(category.id)) return null;
      seen.add(category.id);
      return {
        ...category,
        matchedThemes: themes
          .filter(item => item.category === theme.category)
          .map(item => item.label)
      };
    })
    .filter(Boolean);
}

function allCompositionThemes() {
  return [
    ...(state.data.themeComposition?.themes || []),
    ...state.customConcepts.map(concept => ({
      id: `custom-${concept.id}`,
      label: concept.label,
      category: concept.categoryLabel,
      cues: [concept.term, concept.label],
      baseClimate: concept.baseClimate,
      anchorIds: concept.anchorIds || [],
      emotionalLogic: concept.emotionalLogic,
      boundary: 'Custom saved concept. Theme context, not strict synonym.'
    }))
  ];
}

function selectionClimateForQuery(query) {
  const config = state.data?.selectionClimate;
  if (!config) return null;

  const selections = selectionClimateSelections(query, config);
  const matchedSelections = selectionClimateMatchedEntries(selections, config);
  const minimumMatches = Number(config.minimumMatches || 2);
  if (matchedSelections.length < minimumMatches) return null;

  const attributeCounts = selectionClimateAttributeCounts(matchedSelections);
  const observablePatterns = selectionClimateRuleStatements(config.observableRules, attributeCounts);
  const inferredPreferences = selectionClimateRuleStatements(config.inferenceRules, attributeCounts);
  const growthPatterns = selectionClimateGrowthPatterns(attributeCounts, matchedSelections);
  const environmentCondition = selectionClimateEnvironmentCondition(attributeCounts);
  const filterRead = selectionClimateFilterRead(attributeCounts);
  const finalRead = selectionClimateFinalRead(config, attributeCounts);

  return {
    systemName: config.systemName || config.name || 'Pattern Extraction System',
    selections,
    matchedSelections,
    extractedAttributes: selectionClimateExtractedAttributes(config, attributeCounts),
    patternStages: config.stages || [],
    observablePatterns,
    inferredPreferences,
    repeatedClimates: selectionClimateRepeatedClimates(config, attributeCounts),
    growthPatterns,
    environmentCondition,
    filterRead,
    finalRead,
    storedExample: selectionClimateStoredExample(
      attributeCounts,
      matchedSelections,
      observablePatterns,
      inferredPreferences,
      environmentCondition,
      filterRead,
      finalRead
    ),
    connectionStrength: selectionClimateStrength(matchedSelections, observablePatterns, inferredPreferences),
    boundaryChecks: config.boundaryChecks || [],
    boundary: config.boundary || 'Selection climate is a relational read across repeated choices.'
  };
}

function selectionClimateSelections(query, config) {
  const normalized = String(query || '').toLowerCase().trim();
  if (!normalized) return [];

  if (/[,+\n]/.test(normalized)) {
    return uniqueStrings(
      normalized
        .split(/\r?\n|,|\+/)
        .map(item => normalizeConceptTerm(item))
        .filter(Boolean)
    );
  }

  const found = [];
  (config.entries || []).forEach(entry => {
    (entry.cues || []).forEach(cue => {
      const normalizedCue = normalizeConceptTerm(cue);
      if (normalized.includes(normalizedCue)) found.push(normalizedCue);
    });
  });
  return uniqueStrings(found);
}

function selectionClimateMatchedEntries(selections, config) {
  const matched = [];
  const seen = new Set();
  selections.forEach(selection => {
    (config.entries || []).forEach(entry => {
      if (seen.has(entry.id)) return;
      const cues = (entry.cues || []).map(cue => normalizeConceptTerm(cue));
      if (cues.includes(selection)) {
        matched.push(entry);
        seen.add(entry.id);
      }
    });
  });
  return matched;
}

function selectionClimateAttributeCounts(entries) {
  const counts = new Map();
  entries.forEach(entry => {
    (entry.attributes || []).forEach(attributeId => {
      counts.set(attributeId, (counts.get(attributeId) || 0) + 1);
    });
  });
  return counts;
}

function selectionClimateRuleStatements(rules = [], attributeCounts) {
  return rules
    .filter(rule => selectionClimateRuleMatches(rule, attributeCounts))
    .map(rule => rule.statement);
}

function selectionClimateRuleMatches(rule, attributeCounts) {
  const minimumCount = Number(rule.minimumCount || 1);
  const allOf = !rule.allOf?.length || rule.allOf.every(attributeId => (attributeCounts.get(attributeId) || 0) >= minimumCount);
  const anyTotal = (rule.anyOf || []).reduce((sum, attributeId) => sum + (attributeCounts.get(attributeId) || 0), 0);
  const anyOf = !rule.anyOf?.length || anyTotal >= minimumCount;
  if (rule.allOf?.length && rule.anyOf?.length) return allOf && anyOf;
  if (rule.allOf?.length) return allOf;
  if (rule.anyOf?.length) return anyOf;
  return false;
}

function selectionClimateRepeatedClimates(config, attributeCounts) {
  const attributeById = new Map((config.attributes || []).map(attribute => [attribute.id, attribute]));
  return [...attributeCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([attributeId]) => attributeById.get(attributeId)?.label)
    .filter(Boolean)
    .slice(0, 5);
}

function selectionClimateExtractedAttributes(config, attributeCounts) {
  const attributeById = new Map((config.attributes || []).map(attribute => [attribute.id, attribute]));
  return [...attributeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([attributeId, count]) => {
      const attribute = attributeById.get(attributeId);
      if (!attribute) return null;
      return {
        id: attribute.id,
        label: attribute.label,
        group: attribute.group || '',
        count,
        description: attribute.description || ''
      };
    })
    .filter(Boolean);
}

function selectionClimateEnvironmentCondition(attributeCounts) {
  const phrases = [];
  if ((attributeCounts.get('adaptive_structure') || 0) > 0 && (attributeCounts.get('contained') || 0) >= 2) {
    phrases.push('change without chaos');
    phrases.push('structure without rigidity');
  }
  if ((attributeCounts.get('growth') || 0) > 0 && (attributeCounts.get('regulation') || 0) > 0) {
    phrases.push('growth without overexpansion');
  }
  if ((attributeCounts.get('depth') || 0) > 0 && (attributeCounts.get('contained') || 0) >= 2) {
    phrases.push('feeling without emotional flooding');
  }
  return phrases.join(' | ');
}

function selectionClimateFilterRead(attributeCounts) {
  if ((attributeCounts.get('adaptive_structure') || 0) > 0 && (attributeCounts.get('regulation') || 0) > 0) {
    return 'How does a system remain coherent while changing?';
  }
  if ((attributeCounts.get('depth') || 0) > 0 && (attributeCounts.get('contained') || 0) >= 2) {
    return 'How is weight held without turning into spectacle?';
  }
  return 'What repeated preference pattern is appearing across the whole set?';
}

function selectionClimateFinalRead(config, attributeCounts) {
  return (config.finalReads || []).find(rule => selectionClimateRuleMatches(rule, attributeCounts))?.statement
    || 'The pattern points to repeated preference structure rather than isolated label meaning.';
}

function selectionClimateStrength(matchedSelections, observablePatterns, inferredPreferences) {
  if (matchedSelections.length >= 5 && observablePatterns.length >= 3 && inferredPreferences.length >= 2) return 'strong';
  if (matchedSelections.length >= 3 && observablePatterns.length >= 2) return 'medium';
  return 'weak';
}

function selectionClimateGrowthPatterns(attributeCounts, matchedSelections) {
  const patterns = [];
  const repeated = [...attributeCounts.entries()].filter(([, count]) => count >= 2);
  if (repeated.length >= 2) {
    patterns.push('Several attributes are repeating together, so the graph is growing around a shared pattern rather than isolated choices.');
  }
  if ((attributeCounts.get('growth') || 0) > 0 && (attributeCounts.get('regulation') || 0) > 0) {
    patterns.push('Growth is appearing with regulation, which means expansion is being held inside a stable condition.');
  }
  if ((attributeCounts.get('adaptive_structure') || 0) > 0 && (attributeCounts.get('contained') || 0) >= 2) {
    patterns.push('The pattern grows by variation inside structure, not by random drift or collapse.');
  }
  if ((attributeCounts.get('depth') || 0) > 0 && (attributeCounts.get('connection') || 0) > 0) {
    patterns.push('Depth and connection are growing together, so the read becomes more relational as repetition increases.');
  }
  if (matchedSelections.length >= 5) {
    patterns.push('This set has enough repeated selections to act like an evergreen growth cluster instead of a one-off impression.');
  }
  return patterns.slice(0, 5);
}

function selectionClimateStoredExample(
  attributeCounts,
  matchedSelections,
  observablePatterns,
  inferredPreferences,
  environmentCondition,
  filterRead,
  finalRead
) {
  const hasEnoughStructure = matchedSelections.length >= 3
    && (
      observablePatterns.length > 0
      || inferredPreferences.length > 0
      || Boolean(environmentCondition)
    );

  if (!hasEnoughStructure) return null;

  const repeatedAttributes = [...attributeCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([attributeId]) => attributeId.replace(/_/g, ' '));

  const environment = environmentCondition
    || 'A repeatable local environment is forming around the same preference pressure.';

  const exposure = repeatedAttributes.length
    ? `Repeated choices keep contacting the same attribute field: ${repeatedAttributes.join(' | ')}.`
    : 'Repeated choices are contacting the same local field strongly enough to leave a repeatable trace.';

  const structuralChange = observablePatterns[0]
    || inferredPreferences[0]
    || 'The repeated contact is beginning to reshape the local route bundle.';

  const observablePattern = observablePatterns[0]
    || 'The same environmental pressure is reappearing across the current set.';

  return {
    context: filterRead,
    environment,
    exposure,
    structuralChange,
    observablePattern,
    interpretation: `${finalRead} This can be retained as a stored example for later comparison, orientation, or activation support.`
  };
}

function surveyPatternAnalysis(text) {
  const records = parseSurveyPatternText(text);
  if (!records.length) {
    return {
      records,
      total: 0,
      colorCounts: [],
      shapeCounts: [],
      monthCounts: [],
      pairCounts: [],
      observations: [],
      unresolvedLines: parseSurveyUnresolvedLines(text)
    };
  }

  const colorCounts = countSurveyValues(records.flatMap(record => record.colors));
  const shapeCounts = countSurveyValues(records.flatMap(record => record.shapes));
  const monthCounts = countSurveyValues(records.map(record => record.month).filter(Boolean));
  const pairCounts = countSurveyValues(records.flatMap(record => {
    if (!record.colors.length || !record.shapes.length) return [];
    return record.colors.flatMap(color => record.shapes.map(shape => `${color} + ${shape}`));
  }));
  const evergreenSignals = surveyEvergreenSignals(records, colorCounts, shapeCounts, monthCounts, pairCounts);

  return {
    records,
    total: records.length,
    colorCounts,
    shapeCounts,
    monthCounts,
    pairCounts,
    observations: surveyPatternObservations(records, colorCounts, shapeCounts, monthCounts, pairCounts),
    growthPatterns: surveyGrowthPatterns(evergreenSignals),
    evergreenSignals,
    unresolvedLines: parseSurveyUnresolvedLines(text)
  };
}

function parseSurveyPatternText(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => parseSurveyPatternLine(line))
    .filter(Boolean);
}

function parseSurveyPatternLine(line) {
  const groups = [...String(line || '').matchAll(/\(([^)]*)\)/g)]
    .map(match => match[1].trim())
    .filter(Boolean);
  if (groups.length < 2) return null;

  const colors = [];
  const shapes = [];
  let month = '';

  groups.forEach(group => {
    const date = surveyMonth(group);
    if (date && !month) month = date;
    surveyColors(group).forEach(color => colors.push(color));
    surveyShapes(group).forEach(shape => shapes.push(shape));
  });

  if (!colors.length && !shapes.length && !month) return null;
  return {
    colors: uniqueStrings(colors),
    shapes: uniqueStrings(shapes),
    month
  };
}

function parseSurveyUnresolvedLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !parseSurveyPatternLine(line))
    .slice(0, 8);
}

function surveyColors(value) {
  const normalized = normalizeConceptTerm(value);
  if (!normalized) return [];
  const aliases = [
    ['black', ['blk', 'black']],
    ['blue', ['blue']],
    ['dark blue', ['dark blue']],
    ['sky blue', ['sky blue']],
    ['royal blue', ['royal blue']],
    ['red', ['red']],
    ['pink', ['pink']],
    ['purple', ['purple']],
    ['light purple', ['light purple', 'lilac']],
    ['green', ['green']],
    ['teal green', ['teal green']],
    ['sage green', ['sage green']],
    ['neon green', ['neon green']],
    ['turquoise', ['turqoes', 'turquoise', 'turques']],
    ['gold', ['gold']],
    ['light brown', ['light brown']]
  ];
  const matches = aliases
    .filter(([, cues]) => cues.some(cue => normalized.includes(cue)))
    .map(([label]) => label);
  const specificBlue = matches.some(label => ['dark blue', 'sky blue', 'royal blue'].includes(label));
  const specificGreen = matches.some(label => ['teal green', 'sage green', 'neon green'].includes(label));
  return matches.filter(label => {
    if (label === 'blue' && specificBlue) return false;
    if (label === 'green' && specificGreen) return false;
    return true;
  });
}

function surveyShapes(value) {
  const normalized = normalizeConceptTerm(value);
  if (!normalized) return [];
  const aliases = [
    ['triangle', ['triangle']],
    ['trapezoid', ['trapezoid', 'trapazoid', 'trapezoid']],
    ['square', ['square']],
    ['star', ['star']],
    ['heart', ['heart']],
    ['broken heart', ['broken heart']],
    ['pentagon', ['pentagon']],
    ['circle', ['circle']],
    ['hexagon', ['hexagon']],
    ['sphere', ['sphere']],
    ['diamond', ['diamond']],
    ['rectangle', ['rectangle']],
    ['kite', ['kite']],
    ['crescent', ['crescent']],
    ['parallelogram', ['parallelogram']],
    ['irregular quadrilateral', ['irregular quad', 'irregular quadrilateral']],
    ['none shape', ['none shape', 'no shape']]
  ];
  const matches = aliases
    .filter(([, cues]) => cues.some(cue => normalized.includes(cue)))
    .map(([label]) => label);
  return matches.filter(label => !(label === 'heart' && matches.includes('broken heart')));
}

function surveyMonth(value) {
  const normalized = normalizeConceptTerm(value);
  const match = normalized.match(/\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/);
  if (!match) return '';
  const months = {
    jan: 'January', january: 'January',
    feb: 'February', february: 'February',
    mar: 'March', march: 'March',
    apr: 'April', april: 'April',
    may: 'May',
    jun: 'June', june: 'June',
    jul: 'July', july: 'July',
    aug: 'August', august: 'August',
    sep: 'September', sept: 'September', september: 'September',
    oct: 'October', october: 'October',
    nov: 'November', november: 'November',
    dec: 'December', december: 'December'
  };
  return months[match[1]] || '';
}

function countSurveyValues(values) {
  const counts = new Map();
  values.filter(Boolean).forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function surveyPatternObservations(records, colorCounts, shapeCounts, monthCounts, pairCounts) {
  const observations = [];
  const topColor = colorCounts[0];
  const topShape = shapeCounts[0];
  const topMonth = monthCounts[0];
  const topPair = pairCounts[0];
  if (topColor) observations.push(`${titleCase(topColor.label)} is the strongest color signal at ${topColor.count}/${records.length} records.`);
  if (topShape) observations.push(`${titleCase(topShape.label)} is the strongest shape signal at ${topShape.count}/${records.length} records.`);
  if (topPair) observations.push(`${titleCase(topPair.label)} is the strongest color-shape pairing.`);
  if (topMonth) observations.push(`${topMonth.label} is the strongest time cluster.`);
  if (colorCounts.length >= 4) observations.push('The color field is plural rather than one-color dominant.');
  if (shapeCounts.length >= 5) observations.push('The shape field is varied enough to support comparison instead of a single fixed shape read.');
  return observations;
}

function surveyEvergreenSignals(records, colorCounts, shapeCounts, monthCounts, pairCounts) {
  const total = records.length || 1;
  return [
    ...pairCounts
      .filter(item => item.count >= 2)
      .slice(0, 6)
      .map(item => {
        const [color, shape] = item.label.split(' + ');
        return {
          key: `pair:${item.label}`,
          type: 'color-shape pair',
          label: titleCase(item.label),
          term: item.label,
          count: item.count,
          strength: surveySignalStrength(item.count, total),
          categoryId: 'pattern',
          categoryLabel: 'Pattern',
          anchorIds: surveyAnchorIdsForColor(color),
          baseClimate: `${titleCase(color)} filtered through ${shape} form`,
          emotionalLogic: `${titleCase(item.label)} repeats as a color-shape relationship. Treat it as a depth signal that may explain how color becomes form.`,
          boundary: 'Evergreen signal: repeated local pattern, not approved shared truth.'
        };
      }),
    ...colorCounts
      .filter(item => item.count >= 3)
      .slice(0, 5)
      .map(item => ({
        key: `color:${item.label}`,
        type: 'color signal',
        label: `${titleCase(item.label)} cluster`,
        term: `${item.label} cluster`,
        count: item.count,
        strength: surveySignalStrength(item.count, total),
        categoryId: 'translation',
        categoryLabel: 'Translation',
        anchorIds: surveyAnchorIdsForColor(item.label),
        baseClimate: `${titleCase(item.label)} as repeated translation climate`,
        emotionalLogic: `${titleCase(item.label)} repeats across multiple records, so the system can treat it as a recurring color-climate signal worth comparing.`,
        boundary: 'Evergreen signal: repeated local pattern, not approved shared truth.'
      })),
    ...shapeCounts
      .filter(item => item.count >= 3)
      .slice(0, 5)
      .map(item => ({
        key: `shape:${item.label}`,
        type: 'shape signal',
        label: `${titleCase(item.label)} form`,
        term: `${item.label} form`,
        count: item.count,
        strength: surveySignalStrength(item.count, total),
        categoryId: 'pattern',
        categoryLabel: 'Pattern',
        anchorIds: [],
        baseClimate: `${titleCase(item.label)} as repeated structure`,
        emotionalLogic: `${titleCase(item.label)} repeats as form, so it may act as a structure filter for how color becomes readable.`,
        boundary: 'Evergreen signal: repeated local pattern, not approved shared truth.'
      })),
    ...monthCounts
      .filter(item => item.count >= 3)
      .slice(0, 4)
      .map(item => ({
        key: `month:${item.label}`,
        type: 'time cluster',
        label: `${item.label} cluster`,
        term: `${item.label} cluster`,
        count: item.count,
        strength: surveySignalStrength(item.count, total),
        categoryId: 'season',
        categoryLabel: 'Season',
        anchorIds: anchorsForCategory('Season'),
        baseClimate: `${item.label} as repeated time filter`,
        emotionalLogic: `${item.label} repeats as a date cluster, so it may shape how color and form appear through time.`,
        boundary: 'Evergreen signal: repeated local pattern, not approved shared truth.'
      }))
  ].slice(0, 18);
}

function surveySignalStrength(count, total) {
  const ratio = count / Math.max(1, total);
  if (count >= 5 || ratio >= 0.25) return 'strong';
  if (count >= 3 || ratio >= 0.14) return 'medium';
  return 'emerging';
}

function surveyAnchorIdsForColor(color) {
  const normalized = normalizeConceptTerm(color);
  if (/black/.test(normalized)) return ['obsidian'];
  if (/red/.test(normalized)) return ['ember'];
  if (/pink/.test(normalized)) return ['rose'];
  if (/blue|turquoise/.test(normalized)) return ['midnight'];
  if (/green/.test(normalized)) return ['green'];
  if (/purple/.test(normalized)) return ['midnight', 'rose'];
  if (/gold|brown/.test(normalized)) return ['earth'];
  return [];
}

function renderSurveyPatternAnalysis(analysis) {
  return `
    <div class="survey-pattern-results">
      <div class="theme-category-item">
        <div>
          <strong>${analysis.total ? `${analysis.total} parsed records` : 'No parsed survey records yet'}</strong>
          <span>names stay out of the shared graph</span>
        </div>
        <p>${analysis.total ? 'The app is reading repeated survey structure: colors, shapes, months, and pairings.' : 'Paste transcribed notebook lines to turn the page into a pattern extraction set.'}</p>
        <div class="signal-actions">
          <button type="button" data-ecosystem-node="ecosystem-conditions">View condition field</button>
          <button type="button" data-ecosystem-node="ecosystem-evergreen" ${analysis.total ? '' : 'disabled'}>View evergreen growth</button>
          <button type="button" data-ecosystem-node="ecosystem-weather">View weather condition</button>
          <button type="button" data-ecosystem-node="ecosystem-bedrock">View bedrock foundation</button>
        </div>
      </div>
      ${analysis.observations.length ? `
        <div class="theme-category-item">
          <strong>Observable patterns</strong>
          <div class="context-routes">
            ${analysis.observations.map(item => `<div class="context-route"><span>${escapeHtml(item)}</span></div>`).join('')}
          </div>
        </div>
      ` : ''}
      ${renderGrowthPatternsSection('Growth patterns', analysis.growthPatterns || [], 'Repeated survey structure that is beginning to deepen the graph.')}
      ${renderSurveyCountGroup('Colors', analysis.colorCounts)}
      ${renderSurveyCountGroup('Shapes', analysis.shapeCounts)}
      ${renderSurveyCountGroup('Months', analysis.monthCounts)}
      ${renderSurveyCountGroup('Color + shape pairs', analysis.pairCounts)}
      ${renderEvergreenSignals(analysis.evergreenSignals || [])}
      ${analysis.unresolvedLines.length ? `
        <div class="theme-category-item">
          <strong>Unresolved lines</strong>
          <p>${escapeHtml(analysis.unresolvedLines.join(' | '))}</p>
        </div>
      ` : ''}
      <p class="meta">Boundary: this is survey-pattern extraction, not a claim about any person’s permanent identity.</p>
    </div>
  `;
}

function renderEvergreenSignals(signals) {
  if (!signals.length) return '';
  return `
    <div class="theme-category-item evergreen-signals">
      <strong>Evergreen growth signals</strong>
      <p>Repeated patterns the system found naturally. Add one to local concepts when it should deepen the web.</p>
      <div class="context-routes">
        ${signals.map(signal => `
          <div class="context-route evergreen-signal">
            <strong>${escapeHtml(signal.label)}</strong>
            <span>${escapeHtml(signal.type)} · ${escapeHtml(signal.strength)} · ${escapeHtml(String(signal.count))} records</span>
            <span>${escapeHtml(signal.emotionalLogic)}</span>
            <div class="signal-actions">
              <button type="button" data-ecosystem-node="ecosystem-signal-${escapeHtml(slugify(signal.key))}">View in graph</button>
              <button type="button" data-evergreen-signal="${escapeHtml(signal.key)}" ${customConceptExists(signal.term) ? 'disabled' : ''}>${customConceptExists(signal.term) ? 'Already added' : 'Add depth signal'}</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function surveyGrowthPatterns(signals = []) {
  return signals
    .slice(0, 6)
    .map(signal => {
      if (signal.type === 'time cluster') {
        return `${signal.label} is acting as a repeated time condition, so timing is starting to shape the graph instead of sitting outside it.`;
      }
      if (signal.type === 'color-shape pair') {
        return `${signal.label} is repeating as a color-form route, so color and structure are growing together.`;
      }
      if (signal.type === 'color signal') {
        return `${signal.label} is repeating enough to behave like an evergreen climate signal rather than a one-off preference.`;
      }
      if (signal.type === 'shape signal') {
        return `${signal.label} is repeating as structure, so form is becoming part of the graph's growth logic.`;
      }
      return `${signal.label} is repeating enough to become a growth signal for the graph.`;
    });
}

function addEvergreenSignalConcept(signalKey) {
  const analysis = surveyPatternAnalysis(state.surveyPatternText);
  const signal = (analysis.evergreenSignals || []).find(item => item.key === signalKey);
  if (!signal || customConceptExists(signal.term)) return;
  const category = themeCategoryById().get(signal.categoryId) || { id: signal.categoryId, label: signal.categoryLabel, role: 'pattern depth signal' };
  const concept = {
    id: `${Date.now()}-${normalizeConceptTerm(signal.term).replace(/[^a-z0-9]+/g, '-')}`,
    term: normalizeConceptTerm(signal.term),
    label: signal.label,
    categoryId: category.id,
    categoryLabel: category.label,
    assignmentReason: `evergreen extraction: ${signal.type}, ${signal.count} records, ${signal.strength}`,
    baseClimate: signal.baseClimate,
    anchorIds: signal.anchorIds || [],
    emotionalLogic: signal.emotionalLogic,
    boundary: signal.boundary,
    createdAt: new Date().toISOString()
  };
  state.customConcepts = [...state.customConcepts, concept];
  saveCustomConcepts();
  rebuildActiveGraph();
  renderSelectionClimateList();
  renderStats();
  buildLayout();
  drawGraph();
}

function renderSurveyCountGroup(label, counts) {
  if (!counts.length) return '';
  return `
    <div class="theme-category-item">
      <strong>${escapeHtml(label)}</strong>
      <div class="theme-token-row">
        ${counts.slice(0, 12).map(item => `<span>${escapeHtml(titleCase(item.label))} x${escapeHtml(String(item.count))}</span>`).join('')}
      </div>
    </div>
  `;
}

function conceptAddPrompt(query) {
  const term = normalizeConceptTerm(query);
  if (!term || term.length < 2) return null;
  if (isNonConceptTerm(term)) return null;
  if (compositionThemeExists(term) || customConceptExists(term)) return null;
  const assignment = assignConceptCategory(term);
  return {
    term,
    label: titleCase(term),
    category: assignment.category,
    reason: assignment.reason
  };
}

function addConceptFromSearch(value) {
  const term = normalizeConceptTerm(value || state.query);
  if (!term || customConceptExists(term)) return;
  const assignment = assignConceptCategory(term);
  const anchors = anchorsForCategory(assignment.category.label);
  const concept = {
    id: `${Date.now()}-${term.replace(/[^a-z0-9]+/g, '-')}`,
    term,
    label: titleCase(term),
    categoryId: assignment.category.id,
    categoryLabel: assignment.category.label,
    assignmentReason: assignment.reason,
    baseClimate: `${assignment.category.label} concept / ${assignment.category.role}`,
    anchorIds: anchors,
    emotionalLogic: `Saved as a ${assignment.category.label} concept because ${assignment.reason}. It can combine with other themes as a relational climate.`,
    createdAt: new Date().toISOString()
  };
  state.customConcepts = [...state.customConcepts, concept];
  saveCustomConcepts();
  state.query = '';
  els.search.value = '';
  state.view = 'my-concepts';
  els.tabs.forEach(item => item.classList.toggle('is-active', item.dataset.view === state.view));
  render();
}

function assignConceptCategory(term) {
  const categories = state.data.themeComposition?.categories || [];
  const themes = state.data.themeComposition?.themes || [];
  const normalized = term.toLowerCase();
  const tokens = tokenizeInput(normalized);
  const keywordMap = {
    religion: ['religion', 'religious', 'sacred', 'faith', 'god', 'gods', 'church', 'mosque', 'synagogue', 'prayer', 'christian', 'christianity', 'islam', 'muslim', 'judaism', 'jewish', 'torah'],
    season: ['season', 'spring', 'summer', 'fall', 'autumn', 'winter', 'december', 'weather', 'calendar', 'holiday'],
    history: ['history', 'historical', 'past', 'memory', 'archive', 'ritual', 'empire', 'migration', 'revolution', 'war', 'ancient', 'tradition'],
    science: ['science', 'light', 'optics', 'biology', 'geology', 'weather', 'geometry', 'symmetry', 'energy', 'system'],
    arts: ['art', 'arts', 'theater', 'stage', 'mask', 'performance', 'music', 'architecture', 'symbol', 'costume', 'story', 'myth', 'image', 'poem', 'design'],
    foundation: ['foundation', 'experience', 'perception', 'emotion', 'adaptation', 'behavior', 'human', 'inside'],
    pattern: ['pattern', 'repetition', 'structure', 'connection', 'relation', 'association', 'network', 'context', 'similarity', 'difference'],
    translation: ['translation', 'translate', 'translator', 'signal', 'symbol', 'representation', 'color', 'shade', 'climate', 'meaning', 'interpretation'],
    movement: ['movement', 'change', 'response', 'pressure', 'growth', 'stability', 'regulation', 'adjustment', 'transition'],
    identity: ['identity', 'preference', 'tendency', 'habit', 'trait', 'character', 'personality', 'individuality']
  };

  const scored = categories.map(category => {
    const categoryId = category.id;
    const categoryThemes = themes.filter(theme => theme.category.toLowerCase() === category.label.toLowerCase());
    let score = 0;
    const reasons = [];

    (keywordMap[categoryId] || []).forEach(keyword => {
      if (tokens.includes(keyword) || normalized.includes(keyword)) {
        score += 4;
        reasons.push(`matched ${keyword}`);
      }
    });

    categoryThemes.forEach(theme => {
      (theme.cues || []).forEach(cue => {
        if (cueMatchesQuery(cue, normalized, tokens)) {
          score += 6;
          reasons.push(`matched ${theme.label}`);
        }
      });
    });

    (category.contains || []).forEach(item => {
      if (normalized.includes(item.toLowerCase())) {
        score += 3;
        reasons.push(`belongs near ${item}`);
      }
    });

    const personHints = state.personProfile?.categoryHints?.[category.label] || [];
    personHints.forEach(hint => {
      if (normalized.includes(hint.toLowerCase()) || hint.toLowerCase().includes(normalized)) {
        score += 5;
        reasons.push(`personal profile hint: ${hint}`);
      }
    });

    return { category, score, reasons };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best?.score > 0) {
    return {
      category: best.category,
      reason: uniqueStrings(best.reasons).slice(0, 2).join(', ')
    };
  }

  const fallback = categories.find(category => category.id === 'arts') || categories[0];
  return {
    category: fallback,
    reason: 'defaulted to Arts because the concept enters as a symbol or form until more context is added'
  };
}

function anchorsForCategory(categoryLabel) {
  const themes = state.data.themeComposition?.themes || [];
  return uniqueStrings(themes
    .filter(theme => theme.category.toLowerCase() === categoryLabel.toLowerCase())
    .flatMap(theme => theme.anchorIds || []))
    .slice(0, 3);
}

function themeCategoryById() {
  return new Map((state.data.themeComposition?.categories || []).map(category => [category.id, category]));
}

function themeCategoryByLabel(label) {
  const normalized = normalizeConceptTerm(label);
  return (state.data.themeComposition?.categories || [])
    .find(category => normalizeConceptTerm(category.label) === normalized || normalizeConceptTerm(category.id) === normalized) || null;
}

function anchorLabel(anchorId) {
  const anchor = (state.data.crossDomainBridges?.anchorFamilies || []).find(item => item.id === anchorId);
  return anchor?.label?.split(' / ')[0] || anchorId;
}

function loadCustomConcepts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_CONCEPTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item?.term && item?.categoryId) : [];
  } catch {
    return [];
  }
}

function loadActiveThemeFilters() {
  try {
    const parsed = JSON.parse(localStorage.getItem(THEME_FILTERS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function loadBaseSetting() {
  try {
    const stored = localStorage.getItem(BASE_SETTING_KEY);
    return stored === null ? true : stored !== 'false';
  } catch {
    return true;
  }
}

function loadEcosystemMode() {
  try {
    const stored = localStorage.getItem(ECOSYSTEM_MODE_KEY);
    return stored === null ? true : stored !== 'false';
  } catch {
    return true;
  }
}

function loadRouteHealthFilters() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ROUTE_HEALTH_FILTERS_KEY) || 'null');
    return {
      usable: parsed?.usable !== false,
      tentative: parsed?.tentative !== false,
      weak: parsed?.weak !== false
    };
  } catch {
    return { usable: true, tentative: true, weak: true };
  }
}

function loadPinnedRouteKeys() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(PINNED_ROUTE_KEYS_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string' && item) : []);
  } catch {
    return new Set();
  }
}

function loadSchemaPack() {
  try {
    const stored = localStorage.getItem(SCHEMA_PACK_KEY) || 'color';
    return stored in SCHEMA_PACK_DEFS ? stored : 'color';
  } catch {
    return 'color';
  }
}

function loadSurveyPatternText() {
  try {
    return localStorage.getItem(SURVEY_PATTERN_KEY) || '';
  } catch {
    return '';
  }
}

function loadWordStorageInput() {
  try {
    return localStorage.getItem(WORD_STORAGE_INPUT_KEY) || '';
  } catch {
    return '';
  }
}

async function loadPersonalProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(PERSONAL_PROFILE_KEY) || 'null');
    if (stored?.id) return normalizePersonalProfile(stored);
  } catch {
    // If storage is unavailable or corrupt, fall back to a seed profile.
  }

  try {
    const response = await fetch(PERSON_PROFILE_URL, { cache: 'no-store' });
    if (response.ok) {
      const seed = await response.json();
      const profile = normalizePersonalProfile(seed);
      savePersonalProfile(profile);
      return profile;
    }
  } catch {
    // Local file is optional; the profile can start empty.
  }

  const profile = normalizePersonalProfile();
  savePersonalProfile(profile);
  return profile;
}

function normalizePersonalProfile(seed = {}) {
  const seedEntries = seed.entries || seedProfileEntries(seed);
  return {
    id: 'personal-profile',
    label: seed.label && seed.label !== 'Person 0' ? seed.label : 'Personal profile',
    scope: 'local-only private overlay',
    purpose: seed.purpose || 'Life context that shapes this person’s color-climate web.',
    boundary: seed.boundary || personalProfileBoundary(),
    categoryHints: seed.categoryHints || {},
    influence: normalizePersonalInfluence(seed.influence || seed.personalInfluence || {}),
    entries: Array.isArray(seedEntries) ? seedEntries.map(normalizePersonalEntry).filter(Boolean) : [],
    updatedAt: seed.updatedAt || new Date().toISOString()
  };
}

function normalizePersonalInfluence(raw = {}) {
  const name = String(raw.name || raw.profileName || '').trim();
  const dob = String(raw.dob || raw.dateOfBirth || '').trim();
  const birthMonth = personalInfluenceMonth(dob);
  return {
    name,
    dob,
    birthMonth,
    chosenColor: normalizeInfluenceValue(raw.chosenColor || raw.favoriteColor || ''),
    chosenShape: normalizeShapeInfluence(raw.chosenShape || raw.preferredShape || raw.preferredQuadrilateral || ''),
    blueShade: normalizeInfluenceValue(raw.blueShade || raw.favoriteBlueShade || ''),
    redShade: normalizeInfluenceValue(raw.redShade || raw.favoriteRedShade || ''),
    greenShade: normalizeInfluenceValue(raw.greenShade || raw.favoriteGreenShade || ''),
    yellowShade: normalizeInfluenceValue(raw.yellowShade || raw.favoriteYellowShade || '')
  };
}

function normalizeInfluenceValue(value) {
  return titleCase(normalizeConceptTerm(value));
}

function normalizeShapeInfluence(value) {
  const normalized = normalizeConceptTerm(value);
  if (!normalized) return '';
  const aliases = new Map([
    ['rhombuse', 'rhombus'],
    ['rhombus', 'rhombus'],
    ['trapezium', 'trapezium'],
    ['irregular quad', 'irregular quadrilateral'],
    ['irregular quadrilateral', 'irregular quadrilateral']
  ]);
  const resolved = aliases.get(normalized) || normalized;
  return titleCase(resolved);
}

function personalInfluenceMonth(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const named = surveyMonth(normalized);
  if (named) return named;
  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[Math.max(0, Math.min(11, Number(iso[2]) - 1))] || '';
  }
  const slash = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[Math.max(0, Math.min(11, Number(slash[1]) - 1))] || '';
  }
  return '';
}

function seedProfileEntries(seed = {}) {
  const entries = [];
  const hints = seed.categoryHints || {};
  Object.entries(hints).forEach(([category, terms]) => {
    terms.forEach(term => {
      entries.push({
        id: `seed-${category.toLowerCase()}-${String(term).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        term,
        contextType: category.toLowerCase() === 'season' ? 'season' : category.toLowerCase() === 'history' ? 'memory' : 'anchor',
        families: anchorsForCategory(category).map(anchorId => anchorFamiliesForAnchor(anchorId)).flat().slice(0, 3),
        themes: [category],
        emotionalLogic: `Seeded from ${category} profile hint. This is a local stress-test context, not a universal route.`,
        boundary: personalEntryBoundary()
      });
    });
  });
  (seed.stressTerms || []).forEach(term => {
    if (entries.some(entry => entry.term.toLowerCase() === String(term).toLowerCase())) return;
    entries.push({
      id: `seed-stress-${String(term).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      term,
      contextType: 'anchor',
      families: suggestedFamiliesForTerm(term),
      themes: [],
      emotionalLogic: 'Seeded from local profile stress terms as a personal test anchor.',
      boundary: personalEntryBoundary()
    });
  });
  return entries;
}

function normalizePersonalEntry(entry) {
  const term = normalizeConceptTerm(entry.term);
  if (!term) return null;
  const contextType = PROFILE_CONTEXT_TYPES.some(type => type.id === entry.contextType) ? entry.contextType : 'anchor';
  return {
    id: entry.id || `${Date.now()}-${term.replace(/[^a-z0-9]+/g, '-')}`,
    term,
    contextType,
    families: uniqueStrings((entry.families || []).map(family => normalizeFamilyId(family)).filter(family => familyColorExists(family))).slice(0, 5),
    themes: uniqueStrings((entry.themes || []).map(item => titleCase(normalizeConceptTerm(item))).filter(Boolean)).slice(0, 5),
    emotionalLogic: String(entry.emotionalLogic || '').trim(),
    boundary: String(entry.boundary || personalEntryBoundary()).trim(),
    createdAt: entry.createdAt || new Date().toISOString()
  };
}

function saveCustomConcepts() {
  try {
    localStorage.setItem(CUSTOM_CONCEPTS_KEY, JSON.stringify(state.customConcepts));
  } catch {
    // If storage is unavailable, keep concepts for this session only.
  }
}

function savePersonalProfile(profile = state.personProfile) {
  if (!profile) return;
  try {
    profile.updatedAt = new Date().toISOString();
    localStorage.setItem(PERSONAL_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // If storage is unavailable, keep profile changes for this session only.
  }
}

function saveActiveThemeFilters() {
  try {
    localStorage.setItem(THEME_FILTERS_KEY, JSON.stringify(state.activeThemeFilterIds));
  } catch {
    // If storage is unavailable, keep filters for this session only.
  }
}

function saveSchemaPack() {
  try {
    localStorage.setItem(SCHEMA_PACK_KEY, state.activeSchemaPackId || 'color');
  } catch {
    // If storage is unavailable, keep schema-pack choice for this session only.
  }
}

function saveBaseSetting() {
  try {
    localStorage.setItem(BASE_SETTING_KEY, String(state.baseSetting));
  } catch {
    // If storage is unavailable, keep the switch state for this session only.
  }
}

function saveEcosystemMode() {
  try {
    localStorage.setItem(ECOSYSTEM_MODE_KEY, String(state.ecosystemMode));
  } catch {
    // If storage is unavailable, keep the switch state for this session only.
  }
}

function saveRouteHealthFilters() {
  try {
    localStorage.setItem(ROUTE_HEALTH_FILTERS_KEY, JSON.stringify(state.routeHealthFilters));
  } catch {
    // If storage is unavailable, keep route filters for this session only.
  }
}

function savePinnedRouteKeys() {
  try {
    sessionStorage.setItem(PINNED_ROUTE_KEYS_KEY, JSON.stringify([...state.pinnedRouteKeys]));
  } catch {
    // If storage is unavailable, keep route pins for this session only.
  }
}

function saveSurveyPatternText() {
  try {
    localStorage.setItem(SURVEY_PATTERN_KEY, state.surveyPatternText || '');
  } catch {
    // If storage is unavailable, keep survey text for this session only.
  }
}

function saveWordStorageInput() {
  try {
    localStorage.setItem(WORD_STORAGE_INPUT_KEY, state.wordStorage.input || '');
  } catch {
    // If storage is unavailable, keep word storage text for this session only.
  }
}

function ensurePersonalProfile() {
  if (!state.personProfile) state.personProfile = normalizePersonalProfile();
  return state.personProfile;
}

function savePersonalInfluence(formData) {
  const profile = ensurePersonalProfile();
  profile.influence = normalizePersonalInfluence({
    name: formData.get('name'),
    dob: formData.get('dob'),
    chosenColor: formData.get('chosenColor'),
    chosenShape: formData.get('chosenShape'),
    blueShade: formData.get('blueShade'),
    redShade: formData.get('redShade'),
    greenShade: formData.get('greenShade'),
    yellowShade: formData.get('yellowShade')
  });
  if (profile.influence.name && (!profile.label || profile.label === 'Personal profile')) {
    profile.label = `${profile.influence.name}'s profile`;
  }
  savePersonalProfile();
  render();
}

function addPersonalProfileEntry(formData) {
  const profile = ensurePersonalProfile();
  const term = normalizeConceptTerm(formData.get('term'));
  if (!term) return;
  const entry = normalizePersonalEntry({
    id: `${Date.now()}-${term.replace(/[^a-z0-9]+/g, '-')}`,
    term,
    contextType: formData.get('contextType'),
    families: splitListInput(formData.get('families')),
    themes: splitListInput(formData.get('themes')),
    emotionalLogic: formData.get('emotionalLogic') || `Personal ${profileContextLabel(formData.get('contextType')).toLowerCase()} context changes how ${term} lands in this color web.`,
    boundary: formData.get('boundary') || personalEntryBoundary(),
    createdAt: new Date().toISOString()
  });
  if (!entry) return;
  profile.entries = [
    ...profile.entries.filter(item => !(item.term === entry.term && item.contextType === entry.contextType)),
    entry
  ];
  savePersonalProfile();
  render();
}

function removePersonalProfileEntry(entryId) {
  const profile = ensurePersonalProfile();
  profile.entries = profile.entries.filter(entry => entry.id !== entryId);
  savePersonalProfile();
  render();
}

function splitListInput(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeFamilyId(value) {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, '-');
}

function familyColorExists(family) {
  return Boolean(FAMILY_COLORS[family]) || state.nodeById.has(`family-${family}`) || state.nodeById.has(`subfamily-${family}`);
}

function anchorFamiliesForAnchor(anchorId) {
  const anchor = (state.data.crossDomainBridges?.anchorFamilies || []).find(item => item.id === anchorId);
  return anchor?.families || [];
}

function personalProfileBoundary() {
  return 'Local-only profile overlay. Use it to adjust the personal read, not to diagnose, fix identity, or rewrite the shared baseline graph.';
}

function personalEntryBoundary() {
  return 'Personal context, not a universal color synonym or permanent identity.';
}

function profileContextLabel(contextType) {
  return PROFILE_CONTEXT_TYPES.find(type => type.id === contextType)?.label || 'Personal context';
}

function personalInfluenceRows(profile = state.personProfile) {
  const influence = profile?.influence || normalizePersonalInfluence();
  return [
    ['Name', influence.name],
    ['Date of birth', influence.dob],
    ['Birth month influence', influence.birthMonth],
    ['Chosen color', influence.chosenColor],
    ['Chosen shape', influence.chosenShape],
    ['Blue shade', influence.blueShade],
    ['Red shade', influence.redShade],
    ['Green shade', influence.greenShade],
    ['Yellow shade', influence.yellowShade]
  ].filter(([, value]) => value);
}

function personalInfluenceTerms(profile = state.personProfile) {
  const influence = profile?.influence || normalizePersonalInfluence();
  return [
    { key: 'birthMonth', label: 'Birth month', term: influence.birthMonth, category: 'time condition' },
    { key: 'chosenColor', label: 'Chosen color', term: influence.chosenColor, category: 'base color' },
    { key: 'chosenShape', label: 'Chosen shape', term: influence.chosenShape, category: 'shape filter' },
    { key: 'blueShade', label: 'Blue shade', term: influence.blueShade, category: 'shade preference' },
    { key: 'redShade', label: 'Red shade', term: influence.redShade, category: 'shade preference' },
    { key: 'greenShade', label: 'Green shade', term: influence.greenShade, category: 'shade preference' },
    { key: 'yellowShade', label: 'Yellow shade', term: influence.yellowShade, category: 'shade preference' }
  ].filter(item => item.term);
}

function personalMonthFamilies(month) {
  const normalized = normalizeConceptTerm(month);
  if (!normalized) return [];
  const winter = ['december', 'january', 'february'];
  const spring = ['march', 'april', 'may'];
  const summer = ['june', 'july', 'august'];
  const autumn = ['september', 'october', 'november'];
  if (winter.includes(normalized)) return ['blue-gray', 'gray-white', 'white', 'blue'];
  if (spring.includes(normalized)) return ['green', 'yellow-green', 'yellow-white'].filter(familyColorExists);
  if (summer.includes(normalized)) return ['yellow', 'green', 'blue'];
  if (autumn.includes(normalized)) return ['brown', 'yellow-brown', 'red-brown', 'orange'].filter(familyColorExists);
  return [];
}

function personalInfluenceSignal(profile = state.personProfile) {
  const influenceTerms = personalInfluenceTerms(profile);
  const nodeIds = new Set();
  const families = new Set();
  const themes = new Set();
  const matches = [];

  influenceTerms.forEach(item => {
    const term = normalizeConceptTerm(item.term);
    if (!term) return;
    matches.push(item);
    exactNodesByLabel(term).forEach(node => {
      nodeIds.add(node.id);
      const family = node.family || nodeColorKey(node);
      if (family) families.add(family);
    });
    suggestedFamiliesForTerm(term).forEach(family => families.add(family));
    if (item.key === 'birthMonth') {
      personalMonthFamilies(item.term).forEach(family => families.add(family));
      themes.add('Season');
    }
  });

  return {
    matches,
    nodeIds,
    families,
    themes,
    month: profile?.influence?.birthMonth || ''
  };
}

function suggestedFamiliesForQuery(query) {
  return suggestedFamiliesForTerm(query).slice(0, 4);
}

function suggestedFamiliesForTerm(term) {
  const normalized = normalizeConceptTerm(term);
  if (!normalized || !state.data) return [];
  const paths = [];
  tokenizeInput(normalized).concat(normalized).forEach(part => {
    exactNodesByLabel(part).forEach(node => {
      if (node.type === 'common_word') paths.push(...associatedColorPaths(node));
      if (node.type === 'emotion_word') paths.push(...emotionColorPaths(node));
      const landing = landingForColorNode(node);
      if (landing?.family) paths.push({ landing });
    });
  });
  emotionCueNodes(normalized).forEach(node => paths.push(...emotionColorPaths(node)));
  const themeComposition = themeCompositionForQuery(normalized);
  const anchorFamilies = (themeComposition?.anchorIds || themeComposition?.theme?.anchorIds || [])
    .flatMap(anchorFamiliesForAnchor);
  return uniqueStrings([
    ...paths.map(path => path.landing?.family).filter(Boolean),
    ...anchorFamilies
  ]).filter(familyColorExists);
}

function suggestedThemesForQuery(query) {
  const themes = matchingCompositionThemes(normalizeConceptTerm(query));
  return themes.map(theme => theme.label).slice(0, 4);
}

function personalOverlayForTranslation(query, translation) {
  const profile = state.personProfile;
  const entryMatches = profile?.entries?.length ? matchingPersonalEntries(query, profile.entries) : [];
  const signal = personalInfluenceSignal(profile);
  const influenceMatches = signal.matches.filter(item => {
    const term = normalizeConceptTerm(item.term);
    const normalized = normalizeConceptTerm(query);
    return normalized && term && (normalized.includes(term) || term.includes(normalized));
  });
  if (!entryMatches.length && !influenceMatches.length) return null;

  const personalFamilies = uniqueStrings([
    ...entryMatches.flatMap(entry => entry.families || []),
    ...signal.families
  ]);
  const personalThemes = uniqueStrings([
    ...entryMatches.flatMap(entry => entry.themes || []),
    ...signal.themes
  ]);
  const sharedFamilies = uniqueStrings((translation.paths || []).map(path => path.landing?.family).filter(Boolean));
  const climateFamilies = uniqueStrings([...personalFamilies, ...sharedFamilies]).slice(0, 6);
  const sharedRoute = translation.paths?.[0]?.nodes?.join(' -> ')
    || translation.themeRead?.route
    || themeExpressionForComposition(translation.themeComposition)
    || 'no shared baseline route';
  const contextSummary = [
    ...entryMatches
    .map(entry => `${entry.term} (${profileContextLabel(entry.contextType)})`)
    ,
    ...influenceMatches.map(item => `${item.term} (${item.category})`)
  ]
    .filter(Boolean)
    .join(' + ');
  const logic = entryMatches
    .map(entry => entry.emotionalLogic)
    .filter(Boolean)
    .join(' ');

  return {
    title: `${query || entryMatches[0]?.term || influenceMatches[0]?.term} as personal climate`,
    strength: entryMatches.length + influenceMatches.length > 1 ? 'layered personal overlay' : 'personal overlay',
    sharedRoute,
    personalContext: contextSummary,
    personalClimateShift: climateFamilies.length
      ? `${climateFamilies.join(' + ')} becomes more relevant for this person${personalThemes.length ? ` through ${personalThemes.join(' + ')}` : ''}.`
      : 'The profile changes the interpretation, but no color family has been linked yet.',
    emotionalLogic: logic || 'Saved personal influence changes which routes become brighter, stronger, or more visible for this person.',
    entries: entryMatches,
    boundary: uniqueStrings(entryMatches.map(entry => entry.boundary).filter(Boolean)).join(' ') || personalProfileBoundary()
  };
}

function matchingPersonalEntries(query, entries) {
  const normalized = normalizeConceptTerm(query);
  const tokens = tokenizeInput(normalized);
  if (!normalized) return [];
  return entries
    .filter(entry => {
      const term = normalizeConceptTerm(entry.term);
      if (!term) return false;
      if (normalized === term || normalized.includes(term) || term.includes(normalized)) return true;
      return tokenizeInput(term).some(token => tokens.includes(token));
    })
    .sort((a, b) => specificityScoreForTerm(b.term) - specificityScoreForTerm(a.term) || a.term.localeCompare(b.term))
    .slice(0, 4);
}

function specificityScoreForTerm(term) {
  return tokenizeInput(term).length * 10 + String(term || '').length;
}

function compositionThemeExists(term) {
  const normalized = normalizeConceptTerm(term);
  return (state.data.themeComposition?.themes || [])
    .some(theme => theme.label.toLowerCase() === normalized || (theme.cues || []).some(cue => cue.toLowerCase() === normalized));
}

function customConceptExists(term) {
  const normalized = normalizeConceptTerm(term);
  return state.customConcepts.some(concept => concept.term === normalized);
}

function isNonConceptTerm(term) {
  const normalized = normalizeConceptTerm(term);
  const neutral = neutralTerms().find(item => item.term.toLowerCase() === normalized);
  if (!neutral) return false;
  return /function word|pronoun|question or response word|conversation word/i.test(neutral.reason || '');
}

function normalizeConceptTerm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^\+|\+$/g, '')
    .trim();
}

function titleCase(value) {
  return String(value)
    .split(/\s+/)
    .map(part => part ? part[0].toUpperCase() + part.slice(1) : '')
    .join(' ');
}

function themeReadForTranslation(query, primaryPath, paths, themeComposition = null) {
  if (themeComposition?.kind === 'composed') {
    const filterLabel = themeComposition.themes.map(theme => theme.label).join(' + ');
    const anchorIds = themeComposition.anchorIds || [];
    const expression = themeExpressionForComposition(themeComposition);
    return {
      id: `theme-composition-${anchorIds.join('-') || expression.toLowerCase().replaceAll(' ', '-')}`,
      source: 'theme input',
      filter: filterLabel,
      theme: expression,
      route: `${filterLabel} -> ${expression}`,
      forwardTrace: `theme input + ${filterLabel} filter -> ${expression}`,
      reverseTrace: `${expression} -> probable ${filterLabel} filter -> probable color-climate condition`,
      sharedStructure: themeComposition.meaningShift,
      emotionalClimate: themeComposition.emotionalShift,
      boundary: themeComposition.boundary,
      anchorIds,
      explicit: false
    };
  }

  const explicit = matchingThemeRoutes(query)[0];
  if (explicit) {
    return {
      id: explicit.id,
      source: explicit.source,
      filter: explicit.filter,
      theme: explicit.theme,
      route: explicit.route,
      forwardTrace: `${explicit.source} + ${explicit.filter} -> ${explicit.theme}`,
      reverseTrace: `${explicit.theme} -> probable ${explicit.filter} -> probable color-climate condition`,
      sharedStructure: explicit.sharedStructure,
      emotionalClimate: explicit.emotionalClimate,
      boundary: explicit.boundary,
      anchorIds: explicit.anchorIds || [],
      explicit: true
    };
  }

  if (themeComposition) {
    const anchorIds = themeComposition.anchorIds || themeComposition.theme?.anchorIds || [];
    const themeLabel = themeComposition.kind === 'composed'
      ? themeExpressionForComposition(themeComposition)
      : themeTermForTheme(themeComposition.theme);
    const filterLabel = themeComposition.kind === 'composed' ? themeComposition.themes.map(theme => theme.label).join(' + ') : themeComposition.theme.label;
    return {
      id: `theme-composition-${anchorIds.join('-') || themeLabel.toLowerCase().replaceAll(' ', '-')}`,
      source: 'theme input',
      filter: filterLabel,
      theme: themeLabel,
      route: themeComposition.kind === 'composed'
        ? `${themeComposition.themes.map(theme => theme.label).join(' + ')} -> ${themeExpressionForComposition(themeComposition)}`
        : `${themeComposition.theme.label} -> ${themeTermForTheme(themeComposition.theme)}`,
      forwardTrace: themeComposition.kind === 'composed'
        ? `theme input + ${filterLabel} filter -> ${themeExpressionForComposition(themeComposition)}`
        : `theme input + ${filterLabel} filter -> ${themeLabel}`,
      reverseTrace: `${themeLabel} -> probable ${filterLabel} filter -> probable color-climate condition`,
      sharedStructure: themeComposition.kind === 'composed' ? themeComposition.meaningShift : themeTermForTheme(themeComposition.theme),
      emotionalClimate: themeComposition.kind === 'composed' ? themeComposition.emotionalShift : themeComposition.theme.emotionalLogic,
      boundary: themeComposition.kind === 'composed' ? themeComposition.boundary : themeComposition.theme.boundary,
      anchorIds,
      explicit: false
    };
  }

  const emotionNode = primaryPath?.nodeIds
    ?.map(id => state.nodeById.get(id))
    .find(node => node?.type === 'emotion_word');
  const anchors = bridgeAnchorsForPaths(query, paths).slice(0, 2);
  if (!emotionNode || !anchors.length) return null;

  const emotionNodes = uniqueNodes(paths
    .flatMap(path => path.nodeIds || [])
    .map(id => state.nodeById.get(id))
    .filter(node => node?.type === 'emotion_word'));
  if (emotionNodes.length > 1) {
    const filterLabel = `${emotionNodes.map(node => node.label).join(' / ')} filters`;
    return {
      id: `theme-blend-${emotionNodes.map(node => node.id).join('-')}`,
      source: 'feeling signal',
      filter: filterLabel,
      theme: 'blended climate',
      route: `feeling signal + ${emotionNodes.map(node => node.label).join(' / ')} filters -> blended climate`,
      forwardTrace: `feeling signal + ${filterLabel} -> blended climate`,
      reverseTrace: `blended climate -> probable ${filterLabel} -> probable color-climate condition`,
      sharedStructure: anchors.map(anchor => anchor.sharedStructure).join(' + '),
      emotionalClimate: 'coexisting climates: ' + anchors.map(anchor => anchor.emotionalLogic).join(' / '),
      boundary: 'This blend explains coexisting emotional climates without forcing them into one identity.',
      anchorIds: anchors.map(item => item.id),
      explicit: false
    };
  }

  const emotion = emotionNode.label;
  const anchor = anchors[0];
  const themeName = `${anchor.label.split(' / ')[0]} climate`;
  return {
    id: `theme-${emotionNode.id}-${anchor.id}`,
    source: 'feeling signal',
    filter: `${emotion} filter`,
    theme: themeName,
    route: `feeling signal + ${emotion} filter -> ${themeName}`,
    forwardTrace: `feeling signal + ${emotion} filter -> ${themeName}`,
    reverseTrace: `${themeName} -> probable ${emotion} filter -> probable color-climate condition`,
    sharedStructure: anchor.sharedStructure,
    emotionalClimate: anchor.emotionalLogic,
    boundary: 'This is an emotional presentation climate, not a strict synonym or permanent identity.',
    anchorIds: anchors.map(item => item.id),
    explicit: false
  };
}

function humanBridgesForTranslation(query, paths = [], themeRead = null, themeComposition = null) {
  return bridgeAnchorsForPaths(query, paths, themeRead, themeComposition)
    .slice(0, 3)
    .map(anchor => {
      const fieldCount = ['myth', 'history', 'science', 'arts'].filter(field => anchor[field]).length;
      const strength = fieldCount >= 4 && anchor.sharedStructure && anchor.emotionalLogic ? 'strong' : 'weak';
      return { ...anchor, strength };
    });
}

function logicChecksForTranslation(themeRead, humanBridges, primaryPath) {
  if (!themeRead && !humanBridges.length) return null;
  return {
    items: [
      { label: 'Source', value: themeRead?.source || primaryPath?.input || 'feeling signal' },
      { label: 'Filter', value: themeRead?.filter || 'emotional color-climate filter' },
      { label: 'Shared structure', value: themeRead?.sharedStructure || humanBridges[0]?.sharedStructure || 'unresolved shared structure' },
      { label: 'Emotional climate', value: themeRead?.emotionalClimate || humanBridges[0]?.emotionalLogic || 'unresolved emotional climate' },
      { label: 'Connection strength', value: humanBridges.some(item => item.strength === 'strong') ? 'strong' : 'weak/unresolved' }
    ],
    boundary: state.data.crossDomainBridges?.boundaryChecks?.[0] || 'Bridge describes a relational state, not a fixed identity.'
  };
}

function matchingThemeRoutes(query) {
  const normalized = query.toLowerCase().trim();
  return (state.data.themeTranslator?.themeRoutes || [])
    .filter(route => (route.cues || []).some(cue => normalized.includes(cue.toLowerCase())));
}

function bridgeAnchorsForPaths(query, paths = [], themeRead = null, themeComposition = null) {
  const anchors = state.data.crossDomainBridges?.anchorFamilies || [];
  const anchorById = new Map(anchors.map(anchor => [anchor.id, anchor]));
  const selected = new Map();
  const normalized = query.toLowerCase().trim();

  (themeRead?.anchorIds || []).forEach(id => {
    const anchor = anchorById.get(id);
    if (anchor) selected.set(anchor.id, anchor);
  });

  (themeComposition?.anchorIds || themeComposition?.theme?.anchorIds || []).forEach(id => {
    const anchor = anchorById.get(id);
    if (anchor) selected.set(anchor.id, anchor);
  });

  anchors.forEach(anchor => {
    if ((anchor.cues || []).some(cue => normalized.includes(cue.toLowerCase()))) {
      selected.set(anchor.id, anchor);
    }
  });

  paths.forEach(path => {
    const family = path.landing?.family;
    if (!family) return;
    anchors
      .filter(anchor => (anchor.families || []).includes(family))
      .forEach(anchor => selected.set(anchor.id, anchor));
  });

  return [...selected.values()];
}

function inputContextSenses(terms) {
  return (state.data.inputContext?.wordSenseExamples || [])
    .filter(example => terms.includes(example.term.toLowerCase()))
    .flatMap(example => example.senses.map(sense => ({
      shape: `${example.term}: ${sense.shape}`,
      route: sense.route
    })));
}

function tokenizeInput(value) {
  return value
    .split(/[^a-z0-9-]+/i)
    .map(term => term.trim().toLowerCase())
    .filter(Boolean);
}

function uniqueStrings(items) {
  return [...new Set(items.filter(Boolean))];
}

function uniqueRoutes(routes) {
  const seen = new Set();
  return routes.filter(route => {
    const key = `${route.title}|${route.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function searchText(node) {
  const metadata = node.metadata || {};
  return [
    node.id,
    node.label,
    node.type,
    node.family,
    metadata.definition,
    metadata.contextDefinition,
    metadata.definitionPhrase,
    metadata.naturalNameBasis,
    metadata.emotionDefinition,
    metadata.tone,
    metadata.evidence,
    metadata.sourceTerm,
    metadata.associationBasis
  ].filter(Boolean).join(' ').toLowerCase();
}

function naturalAtlasGroupsForText(text) {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) return [];
  return naturalSourceGroups().filter(group => group.terms.some(term => normalized.includes(term)));
}

function directNeighborNodes(nodeId) {
  const seen = new Set();
  return state.edges.flatMap(edge => {
    if (edge.source === nodeId && !seen.has(edge.target)) {
      seen.add(edge.target);
      return state.nodeById.get(edge.target) || [];
    }
    if (edge.target === nodeId && !seen.has(edge.source)) {
      seen.add(edge.source);
      return state.nodeById.get(edge.source) || [];
    }
    return [];
  }).filter(Boolean);
}

function nodeSupportsAtlasInfluence(node) {
  return Boolean(node && ATLAS_INFLUENCE_NODE_TYPES.has(node.type));
}

function baselinePlacementForNode(node) {
  if (!node) return null;
  const color = colorForNode(node);
  if (!color) return null;

  if (node.type === 'family') {
    const family = normalizeFamilyId(nodeColorKey(node));
    if (PRIMARY_COLOR_ANCHORS.has(family)) {
      const anchor = CONDITION_FAMILY_VECTORS[family];
      if (anchor) {
        return {
          kind: 'base_family_anchor',
          position: { ...anchor },
          parentFamilies: [family],
          influenceWeights: [1],
          boundary: 'Base colors are fixed anchor points in the stored map.'
        };
      }
    }

    const bridgeFamily = bridgePlacementForFamily(node, family);
    if (bridgeFamily) {
      return bridgeFamily;
    }

    const anchor = CONDITION_FAMILY_VECTORS[family];
    if (anchor) {
      return {
        kind: 'fallback_family_anchor',
        position: { ...anchor },
        parentFamilies: [family],
        influenceWeights: [1],
        boundary: 'This family is using a direct stored anchor because a stronger primary-or-bridge rule was not resolved yet.'
      };
    }
  }

  if (node.type === 'subfamily') {
    const bridge = bridgePlacementForNode(node);
    if (bridge) return bridge;
  }

  const inherited = inheritedPlacementForNode(node, color);
  if (inherited) return inherited;

  return {
    kind: 'heuristic_fallback',
    position: shadePosition(color, environmentFamiliesForNode(node) || []),
    parentFamilies: uniqueStrings((environmentFamiliesForNode(node) || []).flatMap(family => splitFamilyId(family))),
    influenceWeights: [],
    boundary: 'This node is falling back to direct color geometry because a stronger bridge or base path was not resolved yet.'
  };
}

function baseShadePositionForNode(node) {
  return baselinePlacementForNode(node)?.position || null;
}

function activeThemeConditionProfiles(profile = state.perception?.profile || currentPerceptionProfile()) {
  const profiles = [];
  const seen = new Set();
  const pushTheme = (theme, source = 'theme condition') => {
    if (!theme) return;
    const id = theme.id || `${source}:${theme.label || theme.theme || 'theme'}`;
    if (seen.has(id)) return;
    seen.add(id);
    const families = uniqueStrings((theme.anchorIds || [])
      .map(anchorIdToFamily)
      .filter(Boolean));
    const vector = averageConditionVector(families);
    if (!families.length || !vector) return;
    profiles.push({
      id,
      label: theme.label || theme.theme || id,
      source,
      families,
      vector
    });
  };

  activeThemeFilters().forEach(theme => pushTheme(theme, 'theme condition'));
  (profile.matchedThemes || []).forEach(theme => pushTheme(theme, 'theme condition'));
  if (profile.themeRead?.anchorIds?.length) {
    pushTheme({
      id: profile.themeRead.id || `theme-read-${slugify(profile.themeRead.theme || profile.themeRead.filter || 'theme')}`,
      label: profile.themeRead.theme || profile.themeRead.filter || 'theme read',
      anchorIds: profile.themeRead.anchorIds
    }, 'theme condition');
  }

  return profiles;
}

function themeConditionInfluenceForNode(node, profile = state.perception?.profile || currentPerceptionProfile(), basePosition = null) {
  const base = basePosition || baseShadePositionForNode(node);
  if (!base) return null;
  const conditionProfiles = activeThemeConditionProfiles(profile);
  if (!conditionProfiles.length) return null;

  const nodeFamily = normalizeFamilyId(node.family || nodeColorKey(node));
  const neighborFamilies = new Set(
    directNeighborNodes(node.id)
      .flatMap(neighbor => splitFamilyId(neighbor.family || nodeColorKey(neighbor)))
      .map(normalizeFamilyId)
      .filter(Boolean)
  );
  const contributions = [];

  conditionProfiles.forEach(condition => {
    let weight = 0;
    const reasons = [];
    const familyMatches = condition.families.filter(family => family === nodeFamily);
    const neighborMatches = condition.families.filter(family => neighborFamilies.has(family));

    if (familyMatches.length) {
      weight += 1.15;
      reasons.push('direct family match');
    }
    if (neighborMatches.length) {
      weight += Math.min(0.8, neighborMatches.length * 0.24);
      reasons.push(`neighbor match via ${neighborMatches.join(', ')}`);
    }
    if (profile.translationNodeIds?.has(node.id)) {
      weight += 0.14;
      reasons.push('active translation route');
    }
    if (profile.focusNodeIds?.has(node.id)) {
      weight += 0.1;
      reasons.push('current local focus');
    }

    if (!weight) return;
    contributions.push({
      conditionId: condition.id,
      label: condition.label,
      vector: condition.vector,
      families: condition.families,
      weight,
      reasons
    });
  });

  if (!contributions.length) return null;

  const totalWeight = contributions.reduce((sum, item) => sum + item.weight, 0);
  const weightedVector = contributions.reduce((acc, item) => ({
    x: acc.x + item.vector.x * item.weight,
    y: acc.y + item.vector.y * item.weight,
    z: acc.z + item.vector.z * item.weight
  }), { x: 0, y: 0, z: 0 });

  const avgVector = {
    x: weightedVector.x / totalWeight,
    y: weightedVector.y / totalWeight,
    z: weightedVector.z / totalWeight
  };
  const strength = clamp(0.12 + totalWeight * 0.09, 0.12, 0.34);
  const delta = {
    x: Math.round(avgVector.x * strength),
    y: Math.round(avgVector.y * strength),
    z: Math.round(avgVector.z * strength)
  };
  const position = {
    x: clamp(base.x + delta.x, -100, 100),
    y: clamp(base.y + delta.y, 0, 100),
    z: clamp(base.z + delta.z, -100, 100)
  };

  return {
    base,
    position,
    delta,
    strength,
    conditions: contributions,
    boundary: 'Theme-condition influence is a runtime shift created by active filters. It changes the live read without overwriting the node’s base coordinates.'
  };
}

function atlasInfluenceForNode(node, basePosition = null) {
  if (!nodeSupportsAtlasInfluence(node)) return null;
  const base = basePosition || baseShadePositionForNode(node);
  if (!base) return null;

  const contributions = [];
  const directGroups = naturalAtlasGroupsForText(searchText(node));
  directGroups.forEach(group => {
    const vector = NATURAL_ATLAS_VECTORS[group.id];
    if (!vector) return;
    contributions.push({
      groupId: group.id,
      label: group.label,
      vector,
      weight: 1
    });
  });

  directNeighborNodes(node.id).forEach(neighbor => {
    naturalAtlasGroupsForText(searchText(neighbor)).forEach(group => {
      const vector = NATURAL_ATLAS_VECTORS[group.id];
      if (!vector) return;
      contributions.push({
        groupId: group.id,
        label: `${group.label} via ${neighbor.label}`,
        vector,
        weight: 0.55
      });
    });
  });

  if (!contributions.length) return null;

  const merged = new Map();
  contributions.forEach(item => {
    const existing = merged.get(item.groupId) || {
      groupId: item.groupId,
      label: item.label,
      vector: item.vector,
      weight: 0
    };
    existing.weight += item.weight;
    if (!merged.has(item.groupId)) merged.set(item.groupId, existing);
  });

  const items = [...merged.values()];
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return null;

  const weightedVector = items.reduce((acc, item) => ({
    x: acc.x + item.vector.x * item.weight,
    y: acc.y + item.vector.y * item.weight,
    z: acc.z + item.vector.z * item.weight
  }), { x: 0, y: 0, z: 0 });

  const avgVector = {
    x: weightedVector.x / totalWeight,
    y: weightedVector.y / totalWeight,
    z: weightedVector.z / totalWeight
  };
  const strength = clamp(0.2 + totalWeight * 0.08, 0.18, 0.42);
  const delta = {
    x: Math.round(avgVector.x * strength),
    y: Math.round(avgVector.y * strength),
    z: Math.round(avgVector.z * strength)
  };
  const position = {
    x: clamp(base.x + delta.x, -100, 100),
    y: clamp(base.y + delta.y, 0, 100),
    z: clamp(base.z + delta.z, -100, 100)
  };

  return {
    base,
    position,
    delta,
    strength,
    groups: items,
    boundary: 'Atlas influence is a contextual shift created by natural-source conditions. It does not overwrite the node’s base coordinates.'
  };
}

function displayShadePositionForNode(node) {
  const base = baseShadePositionForNode(node);
  if (!base) return null;
  const themeCondition = themeConditionInfluenceForNode(node, state.perception?.profile || currentPerceptionProfile(), base);
  const runtimeBase = themeCondition?.position || base;
  const atlas = atlasInfluenceForNode(node, runtimeBase);
  return {
    base,
    position: atlas?.position || runtimeBase,
    themeCondition,
    atlas
  };
}

function graphInfluenceOffsetForNode(node) {
  const display = displayShadePositionForNode(node);
  if (!display) {
    return {
      x: 0,
      y: 0,
      source: 'none',
      strength: 0
    };
  }

  const final = display.position || display.base;
  const dx = (final.x ?? 0) - (display.base.x ?? 0);
  const dy = (final.y ?? 0) - (display.base.y ?? 0);
  if (!dx && !dy) {
    return {
      x: 0,
      y: 0,
      source: 'none',
      strength: 0
    };
  }

  return {
    x: dx * 1.08,
    y: -dy * 1.08,
    source: display.atlas ? 'theme + atlas' : display.themeCondition ? 'theme' : 'atlas',
    strength: clamp((Math.abs(dx) + Math.abs(dy)) / 28, 0, 1)
  };
}

function layoutPositionForNode(nodeOrId, options = {}) {
  const node = typeof nodeOrId === 'string' ? state.nodeById.get(nodeOrId) : nodeOrId;
  if (!node) return null;
  const stored = state.layout.get(node.id);
  if (!stored) return null;
  if (options.raw) return stored;

  const offset = graphInfluenceOffsetForNode(node);
  if (!offset.x && !offset.y) return stored;
  return {
    ...stored,
    x: stored.x + offset.x,
    y: stored.y + offset.y,
    influenced: true,
    influenceSource: offset.source,
    influenceStrength: offset.strength
  };
}

function influencedPositionMap(nodeIds = state.nodes.map(node => node.id)) {
  const map = new Map();
  nodeIds.forEach(id => {
    const pos = layoutPositionForNode(id);
    if (pos) map.set(id, pos);
  });
  return map;
}

function neutralTerms() {
  const byTerm = new Map();
  const reclassified = neutralReclassifiedTerms();
  [
    ...(state.data.neutralWords?.unconnected || []),
    ...(state.data.commonWords?.neutralWords || []),
    ...(state.data.englishWords?.neutralWords || [])
  ].forEach(item => {
    if (reclassified.has(item.term.toLowerCase())) return;
    if (!byTerm.has(item.term)) byTerm.set(item.term, item);
  });
  return [...byTerm.values()];
}

function neutralReclassifiedTerms() {
  return new Map((state.data.neutralWords?.reclassified || [])
    .map(item => [item.term.toLowerCase(), item]));
}

function neutralConnectionResults(query) {
  return (state.data.neutralWordConnections?.synonymBridges || [])
    .filter(item => {
      const target = state.nodeById.get(item.targetNodeId);
      return [
        item.neutralTerm,
        item.synonym,
        item.evidence,
        item.sourceTerm,
        target?.label,
        target?.family
      ].filter(Boolean).join(' ').toLowerCase().includes(query);
    })
    .sort((a, b) => a.neutralTerm.localeCompare(b.neutralTerm))
    .slice(0, 60);
}

function neutralReclassifiedResults(query) {
  const normalized = query.toLowerCase().trim();
  return (state.data.neutralWords?.reclassified || [])
    .filter(item => [
      item.term,
      item.categoryLabel
    ].filter(Boolean).join(' ').toLowerCase().includes(normalized))
    .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel) || a.term.localeCompare(b.term))
    .slice(0, 60);
}

function emotionPhraseCues(query) {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return [];
  return (state.data.emotionTranslator?.phraseCues || [])
    .filter(item => normalized.includes(item.cue.toLowerCase()))
    .filter(item => state.nodeById.has(item.targetNodeId));
}

function emotionCueNodes(query) {
  const cues = emotionPhraseCues(query);
  if (!cues.length) return [];
  return uniqueNodes(cues
    .map(item => state.nodeById.get(item.targetNodeId))
    .filter(Boolean));
}

function emotionRouteResults(query) {
  const normalized = query.toLowerCase();
  const matches = [
    ...state.nodes.filter(node => node.type === 'emotion_word' && searchText(node).includes(normalized)).map(node => ({ node })),
    ...emotionPhraseCues(normalized).map(cue => ({ node: state.nodeById.get(cue.targetNodeId), cue }))
  ].filter(item => item.node);

  const results = [];
  matches.forEach(item => {
    emotionColorPaths(item.node).slice(0, 3).forEach(path => {
      results.push({
        sourceNodeId: item.node.id,
        path,
        evidence: item.cue?.evidence || path.evidence[0]
      });
    });
  });

  const seen = new Set();
  return results.filter(item => {
    const key = `${item.sourceNodeId}|${item.path.landing.node.id}|${item.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 60);
}

function uniqueNodes(nodes) {
  const seen = new Set();
  return nodes.filter(node => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

function uniqueEdges(edges) {
  const seen = new Set();
  return edges.filter(edge => {
    const key = edgeRouteKey(edge);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function routeStateRank(stateName) {
  if (stateName === 'active') return 3;
  if (stateName === 'context_selected') return 2;
  return 1;
}

function themeConditionContext(node) {
  if (!node || node.type !== 'theme_condition') return null;
  const categoryPrefix = 'condition-theme-category-';
  const filterPrefix = 'condition-theme-filter-';
  const allThemes = allCompositionThemes();
  const categories = state.data.themeComposition?.categories || [];
  const families = new Set();
  const themeIds = new Set();
  const conditionIds = new Set([node.id]);
  let mode = 'theme';
  let category = null;
  let theme = null;

  if (node.id.startsWith(filterPrefix)) {
    mode = 'theme-filter';
    const slug = node.id.slice(filterPrefix.length);
    theme = allThemes.find(item => slugify(item.id || item.label) === slug) || null;
    if (theme) {
      themeIds.add(theme.id);
      category = themeCategoryByLabel(theme.category) || null;
      if (category) {
        conditionIds.add(`condition-theme-category-${slugify(category.id || category.label)}`);
      }
      uniqueStrings((theme.anchorIds || anchorsForCategory(theme.category)).map(anchorIdToFamily).filter(Boolean)).forEach(family => families.add(family));
    }
  } else if (node.id.startsWith(categoryPrefix)) {
    mode = 'theme-category';
    const slug = node.id.slice(categoryPrefix.length);
    category = categories.find(item => slugify(item.id || item.label) === slug) || null;
    const categoryLabel = category?.label || String(node.label || '').replace(/\s+condition$/i, '');
    allThemes
      .filter(item => item.category === categoryLabel)
      .forEach(item => {
        themeIds.add(item.id);
        uniqueStrings((item.anchorIds || anchorsForCategory(item.category)).map(anchorIdToFamily).filter(Boolean)).forEach(family => families.add(family));
      });
    uniqueStrings(anchorsForCategory(categoryLabel).map(anchorIdToFamily).filter(Boolean)).forEach(family => families.add(family));
  }

  if (!families.size && node.family) families.add(node.family);

  return {
    mode,
    theme,
    category,
    themeIds,
    conditionIds,
    families,
    label: theme?.label || category?.label || String(node.label || '').replace(/\s+(condition|filter condition)$/i, ''),
    categoryLabel: category?.label || theme?.category || null
  };
}

function buildThemeFieldRoutes(node, themeContext, profile, visibleSet, directNeighborIds = new Set()) {
  if (!themeContext) {
    return { active: [], stored: [], nodeIds: new Set(), activationSources: [] };
  }

  const candidateMap = new Map();
  const familyIds = new Set([...themeContext.families].map(family => `family-${family}`));
  state.edges.forEach(rawEdge => {
    if (!edgePassesCategoryFilter(rawEdge)) return;
    if (rawEdge.source === node.id || rawEdge.target === node.id) return;

    const runtimeEdge = decorateRuntimeEdge(rawEdge, profile, visibleSet);
    if (!(runtimeEdge.__activationSources || []).includes('theme condition')) return;
    if (visibleSet && (!visibleSet.has(runtimeEdge.source) || !visibleSet.has(runtimeEdge.target))) return;

    const sourceNode = state.nodeById.get(runtimeEdge.source);
    const targetNode = state.nodeById.get(runtimeEdge.target);
    if (!sourceNode || !targetNode) return;

    const sourceFamilyId = sourceNode.family ? `family-${sourceNode.family}` : null;
    const targetFamilyId = targetNode.family ? `family-${targetNode.family}` : null;
    const touchesThemeFamily = (sourceFamilyId && familyIds.has(sourceFamilyId)) || (targetFamilyId && familyIds.has(targetFamilyId));
    const touchesThemeCondition = themeContext.conditionIds.has(runtimeEdge.source) || themeContext.conditionIds.has(runtimeEdge.target);
    const touchesDirectNeighbor = directNeighborIds.has(runtimeEdge.source) || directNeighborIds.has(runtimeEdge.target);
    const touchesFocus = profile.focusNodeIds?.has(runtimeEdge.source) || profile.focusNodeIds?.has(runtimeEdge.target);

    if (!touchesThemeFamily && !touchesThemeCondition && !touchesDirectNeighbor && !touchesFocus) return;

    const key = edgeRouteKey(runtimeEdge);
    const bucket = candidateMap.get(key) || {
      edge: {
        ...runtimeEdge,
        clusterState: 'theme-field',
        __clusterState: 'theme-field'
      },
      sourceHits: new Set(),
      familyHits: new Set()
    };

    (runtimeEdge.__activationSources || []).forEach(source => bucket.sourceHits.add(source));
    if (sourceNode.family && themeContext.families.has(sourceNode.family)) bucket.familyHits.add(sourceNode.family);
    if (targetNode.family && themeContext.families.has(targetNode.family)) bucket.familyHits.add(targetNode.family);
    candidateMap.set(key, bucket);
  });

  const sorted = [...candidateMap.values()]
    .sort((a, b) =>
      routeStateRank(b.edge.__routeState) - routeStateRank(a.edge.__routeState)
      || b.edge.__activationWeight - a.edge.__activationWeight
      || b.edge.__perceptionScore - a.edge.__perceptionScore
    )
    .slice(0, 12)
    .map(entry => ({
      ...entry.edge,
      __clusterNote: `${themeContext.label} is currently weighting this nearby route.`
    }));

  const active = sorted.filter(edge => edge.__routeState !== 'stored');
  const stored = sorted.filter(edge => edge.__routeState === 'stored');
  const nodeIds = new Set();
  sorted.forEach(edge => {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  });
  nodeIds.delete(node.id);

  return {
    active,
    stored,
    nodeIds,
    activationSources: uniqueStrings(active.flatMap(edge => edge.__activationSources || []))
  };
}

function clusterConditionCards(node, profile, routeActivationSources = []) {
  const sourceCounts = new Map();
  routeActivationSources.forEach(source => {
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  });

  const cards = [];
  const themeLabels = uniqueStrings([
    ...activeThemeFilters().map(theme => theme.label || theme.id),
    ...matchingCompositionThemes(normalizeConceptTerm(state.query || '')).map(theme => theme.label || theme.id)
  ]);
  const environmentCondition = environmentConditionForNode(node);
  const personalProfile = state.personProfile?.personalInfluence || {};
  const strengthWeight = { weak: 0.38, medium: 0.66, strong: 0.92 };
  const pushCard = (
    id,
    label,
    detail,
    strength = 'medium',
    visibleInCluster = false,
    sourceType = 'condition_source',
    scope = 'local cluster'
  ) => {
    cards.push({
      id,
      label,
      detail,
      strength,
      visibleInCluster,
      sourceType,
      sourceLabel: label,
      weight: strengthWeight[strength] || 0.66,
      scope,
      whyItApplies: detail
    });
  };

  if (sourceCounts.has('search') || sourceCounts.has('search context')) {
    pushCard(
      'search',
      'Search context',
      'The current input is directly selecting this local route bundle.',
      sourceCounts.has('search') ? 'strong' : 'medium',
      true,
      'search_context',
      'current read'
    );
  }

  if (sourceCounts.has('theme condition') && themeLabels.length) {
    pushCard(
      'theme-condition',
      'Theme conditions',
      `Active theme conditions are weighting this node through ${themeLabels.join(', ')}.`,
      sourceCounts.get('theme condition') > 1 ? 'strong' : 'medium',
      true,
      'theme_condition',
      'condition field'
    );
  }

  if (sourceCounts.has('selection climate')) {
    pushCard(
      'selection-climate',
      'Selection climate',
      'Repeated pattern from the current set input is strengthening these nearby routes.',
      sourceCounts.get('selection climate') > 1 ? 'strong' : 'medium',
      true,
      'selection_pattern',
      'current read'
    );
  }

  if (sourceCounts.has('environment condition') && environmentCondition) {
    pushCard(
      'environment-condition',
      environmentCondition.title,
      `${environmentCondition.condition}. ${environmentCondition.boundary}`,
      sourceCounts.get('environment condition') > 1 ? 'strong' : 'medium',
      true,
      'environment_condition',
      'condition field'
    );
  }

  if (sourceCounts.has('personal influence') && (personalProfile.name || personalProfile.color || personalProfile.shape)) {
    const parts = uniqueStrings([
      personalProfile.color ? `chosen color ${personalProfile.color}` : '',
      personalProfile.shape ? `chosen shape ${personalProfile.shape}` : '',
      personalProfile.month ? `birth-month ${personalProfile.month}` : ''
    ].filter(Boolean));
    pushCard(
      'personal-influence',
      'Personal influence',
      parts.length
        ? `Private profile weighting is brightening routes through ${parts.join(', ')}.`
        : 'Private profile weighting is affecting this cluster now.',
      sourceCounts.get('personal influence') > 1 ? 'strong' : 'medium',
      true,
      'personal_influence',
      'private overlay'
    );
  }

  if (sourceCounts.has('atlas influence')) {
    pushCard(
      'atlas-influence',
      'Atlas influence',
      'Natural atlas terms are temporarily shifting emphasis around this node without changing its fixed family coordinates.',
      sourceCounts.get('atlas influence') > 1 ? 'strong' : 'medium',
      true,
      'atlas_influence',
      'runtime position pull'
    );
  }

  if (sourceCounts.has('history index')) {
    const topHistory = historyContextEntriesForNode(node, profile, 2).map(item => item.entry.label);
    pushCard(
      'history-index',
      'History index',
      topHistory.length
        ? `Religion or Arts history context is weighting this node through ${topHistory.join(', ')}.`
        : 'A local history record is helping select nearby routes in this cluster.',
      sourceCounts.get('history index') > 1 ? 'strong' : 'medium',
      true,
      'history_index',
      'condition-source cabinet'
    );
  }

  if (sourceCounts.has('manual pin')) {
    pushCard(
      'manual-pin',
      'Pinned route',
      'At least one route is being held active manually for this read.',
      'strong',
      true,
      'manual_pin',
      'current view'
    );
  }

  return cards;
}

function buildNodeInfoCluster(node, profile = state.perception?.profile || currentPerceptionProfile(), visibleNodeIds = state.perception?.visibleNodeIds) {
  const visibleSet = visibleNodeIds || new Set(neighborhood(node.id, profile));
  const themeContext = themeConditionContext(node);
  const outgoingRuntime = outgoing(node.id)
    .filter(edgePassesCategoryFilter)
    .map(edge => ({ ...decorateRuntimeEdge(edge, profile, visibleSet), clusterState: 'core', __clusterState: 'core' }));
  const incomingRuntime = incoming(node.id)
    .filter(edgePassesCategoryFilter)
    .map(edge => ({ ...decorateRuntimeEdge(edge, profile, visibleSet), clusterState: 'core', __clusterState: 'core' }));

  const outgoingActive = outgoingRuntime.filter(edge => edge.__routeState !== 'stored');
  const incomingActive = incomingRuntime.filter(edge => edge.__routeState !== 'stored');
  const outgoingStored = outgoingRuntime.filter(edge => edge.__routeState === 'stored');
  const incomingStored = incomingRuntime.filter(edge => edge.__routeState === 'stored');
  const directEdges = [...outgoingRuntime, ...incomingRuntime];
  const activeDirectEdges = [...outgoingActive, ...incomingActive];
  const directNeighborIds = new Set(directEdges.map(edge => edge.source === node.id ? edge.target : edge.source));
  const themeField = buildThemeFieldRoutes(node, themeContext, profile, visibleSet, directNeighborIds);
  const localActiveEdges = themeContext ? uniqueEdges([...activeDirectEdges, ...themeField.active]) : activeDirectEdges;
  const localStoredEdges = themeContext ? uniqueEdges([...outgoingStored, ...incomingStored, ...themeField.stored]) : [...outgoingStored, ...incomingStored];
  const activationSources = uniqueStrings(localActiveEdges.flatMap(edge => edge.__activationSources || []));
  const conditionCards = clusterConditionCards(node, profile, localActiveEdges.flatMap(edge => edge.__activationSources || []));
  const historyContext = historyContextEntriesForNode(node, profile, 4);

  const repeatedSources = new Map();
  localActiveEdges.forEach(edge => {
    (edge.__activationSources || []).forEach(source => {
      repeatedSources.set(source, (repeatedSources.get(source) || 0) + 1);
    });
  });

  const extendedCandidateMap = new Map();
  directNeighborIds.forEach(neighborId => {
    const directSupport = directEdges.find(edge => (edge.source === node.id ? edge.target : edge.source) === neighborId);
    const directSupportRank = routeStateRank(directSupport?.__routeState);
    [...outgoing(neighborId), ...incoming(neighborId)].forEach(rawEdge => {
      if (!edgePassesCategoryFilter(rawEdge)) return;
      const otherId = rawEdge.source === neighborId ? rawEdge.target : rawEdge.source;
      if (!otherId || otherId === node.id || directNeighborIds.has(otherId)) return;
      if (visibleSet && !visibleSet.has(otherId)) return;
      const runtimeEdge = decorateRuntimeEdge(rawEdge, profile, visibleSet);
      const routeKey = edgeRouteKey(runtimeEdge);
      const entry = extendedCandidateMap.get(routeKey) || {
        edge: { ...runtimeEdge, clusterState: 'extended', __clusterState: 'extended' },
        via: new Set(),
        directRanks: [],
        repeatedSources: new Set(),
        convergenceCount: 0
      };
      entry.via.add(neighborId);
      entry.directRanks.push(directSupportRank);
      (runtimeEdge.__activationSources || []).forEach(source => {
        if ((repeatedSources.get(source) || 0) >= 2) entry.repeatedSources.add(source);
      });
      extendedCandidateMap.set(routeKey, entry);
    });
  });

  const extendedRoutes = [...extendedCandidateMap.values()]
    .map(entry => ({
      ...entry,
      convergenceCount: entry.via.size,
      strongestDirectRank: Math.max(0, ...entry.directRanks),
      qualifies:
        entry.via.size > 1
        || (entry.edge.__routeState === 'active' && Math.max(0, ...entry.directRanks) >= 2)
        || entry.repeatedSources.size > 0
    }))
    .filter(entry => entry.qualifies)
    .map(entry => {
      const viaLabels = [...entry.via]
        .map(id => state.nodeById.get(id)?.label || id)
        .slice(0, 3);
      const note = entry.convergenceCount > 1
        ? `Extended cluster reconverges through ${viaLabels.join(', ')}.`
        : `Extended cluster chains forward through ${viaLabels.join(', ')}.`;
      return {
        ...entry,
        edge: {
          ...entry.edge,
          clusterState: 'extended',
          __clusterNote: note
        }
      };
    })
    .sort((a, b) =>
      routeStateRank(b.edge.__routeState) - routeStateRank(a.edge.__routeState)
      || b.convergenceCount - a.convergenceCount
      || b.edge.__activationWeight - a.edge.__activationWeight
      || b.edge.__perceptionScore - a.edge.__perceptionScore
    )
    .slice(0, 8);

  const extendedNodeIds = new Set();
  extendedRoutes.forEach(entry => {
    extendedNodeIds.add(entry.edge.source);
    extendedNodeIds.add(entry.edge.target);
  });
  extendedNodeIds.delete(node.id);
  directNeighborIds.forEach(id => extendedNodeIds.delete(id));

  const repeatedBuckets = new Map();
  localActiveEdges.forEach(edge => {
    const bucket = edgeRouteBucket(edge, profile) || 'weak';
    repeatedBuckets.set(bucket, (repeatedBuckets.get(bucket) || 0) + 1);
  });

  const convergenceTarget = extendedRoutes.find(entry => entry.convergenceCount > 1);
  const repeatedSource = [...repeatedSources.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])[0];
  const repeatedBucket = [...repeatedBuckets.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])[0];

  let patternSummary = '';
  if (convergenceTarget) {
    const focusId = directNeighborIds.has(convergenceTarget.edge.source) ? convergenceTarget.edge.target : convergenceTarget.edge.source;
    const focusNode = state.nodeById.get(focusId);
    patternSummary = `Repeated convergence is appearing here: multiple direct routes reconverge on ${focusNode?.label || 'the same downstream node'}, which justifies the extended cluster view.`;
  } else if (themeContext && themeField.active.length > 1) {
    patternSummary = `${themeContext.label} is repeatedly weighting nearby routes in this local field. The pattern is not stored inside the theme alone; it is emerging through repeated activation around it.`;
  } else if (repeatedSource) {
    patternSummary = `Repeated activation source: ${repeatedSource[0]} is selecting ${repeatedSource[1]} nearby routes in this cluster right now.`;
  } else if (repeatedBucket) {
    patternSummary = `Route strength pattern: ${repeatedBucket[0]} routes repeat across this cluster, which makes the local read feel more stable than one-off activation.`;
  }

  const coreNodeIds = new Set([node.id, ...directNeighborIds, ...themeField.nodeIds]);
  const directSummary = themeContext
    ? `${themeContext.label} is being read as a local condition field, not just as a single endpoint node.`
    : `${1 + directNeighborIds.size} nodes are in the core cluster.`;
  const clusterSummary = [
    `Local activation bundle for why ${node.label} matters in the current field of experience.`,
    directSummary,
    themeContext && themeField.nodeIds.size
      ? `${themeField.nodeIds.size} nearby node${themeField.nodeIds.size === 1 ? '' : 's'} are currently inside this theme-centered field because the condition is weighting their routes.`
      : '',
    historyContext.length
      ? `${historyContext.length} history context entr${historyContext.length === 1 ? 'y is' : 'ies are'} currently close enough to shape this local read.`
      : '',
    extendedRoutes.length
      ? `${extendedNodeIds.size || extendedRoutes.length} more nodes are visible in the extended cluster because the current read chains or reconverges strongly enough.`
      : 'No second-hop expansion is justified yet, so the cluster stays local.'
  ].filter(Boolean).join(' ');

  const activeSchemaPack = schemaPackDefinition(resolvedSchemaPackId(node));
  const availableSchemaPacks = availableSchemaPacksForNode(node);
  const conditionCoverage = {
    activeCount: conditionCards.length,
    visibleCount: conditionCards.filter(card => card.visibleInCluster).length,
    selectorCount: conditionCards.filter(card => !card.visibleInCluster).length
  };
  const schemaReasoning = activeSchemaPack.id === 'theme'
    ? 'This cluster is being read through theme-conditioned behavior: filters and conditions decide which nearby experiences and routes matter now.'
    : 'This cluster is being read through color structure: base colors, bridge colors, shades, and synonym support stay in the foreground.';

  const activeMeaningSummary = !localActiveEdges.length
    ? 'No local meaning is emerging yet because no nearby stored route has become strongly active.'
    : (() => {
      const routeLabels = uniqueStrings(
        localActiveEdges
          .slice(0, 5)
          .map(edge => {
            const otherId = edge.source === node.id ? edge.target : edge.source;
            return state.nodeById.get(otherId)?.label || state.nodeById.get(edge.target)?.label || state.nodeById.get(edge.source)?.label || '';
          })
          .filter(Boolean)
      );
      const sourceLabels = conditionCards.map(card => card.sourceLabel);
      const routeText = routeLabels.length
        ? `The strongest activated routes currently lean toward ${routeLabels.join(', ')}.`
        : 'The strongest activated routes are local but not yet distinct enough to summarize by neighboring label.';
      const sourceText = sourceLabels.length
        ? `Condition sources shaping that activation now: ${sourceLabels.join(', ')}.`
        : 'No condition source is strongly dominating this read.';
      return `${routeText} ${sourceText} Meaning is emerging from active route travel and the gradients between accumulated experiences, not from the node by itself.`;
    })();

  return {
    mode: themeContext ? 'theme' : 'node',
    node,
    activeSchemaPack,
    availableSchemaPacks,
    clusterSchemaMode: themeContext ? 'theme-centered' : 'node-centered',
    clusterState: extendedRoutes.length ? 'extended' : 'core',
    conditionCoverage,
    schemaReasoning,
    themeContext,
    visibleSet,
    outgoingActive,
    incomingActive,
    outgoingStored,
    incomingStored,
    directEdges,
    activeDirectEdges,
    localActiveEdges,
    localStoredEdges,
    directNeighborIds,
    themeField,
    extendedRoutes,
    activationSources,
    conditionCards,
    conditionSources: conditionCards,
    historyContext,
    clusterSummary,
    activeMeaningSummary,
    patternSummary,
    coreNodeCount: coreNodeIds.size,
    extendedNodeCount: extendedNodeIds.size,
    storedRouteCount: localStoredEdges.length,
    activeRouteCount: localActiveEdges.length
  };
}

function renderClusterStatus(cluster) {
  const extendedText = cluster.extendedRoutes.length
    ? `Adaptive depth opened the extended cluster because current active routes either chain strongly or reconverge.`
    : `Adaptive depth stayed at one hop because the current activation bundle does not justify second-hop expansion yet.`;
  const lead = `This system measures influence, not meaning.`;
  const weightEdges = cluster.mode === 'theme'
    ? (cluster.themeField.active || [])
    : (cluster.localActiveEdges || []);
  const weightValues = weightEdges
    .map(edge => Number(edge.__activationWeight))
    .filter(value => Number.isFinite(value));
  const averageWeight = weightValues.length
    ? (weightValues.reduce((sum, value) => sum + value, 0) / weightValues.length)
    : null;
  const peakWeight = weightValues.length
    ? Math.max(...weightValues)
    : null;
  const support = cluster.mode === 'theme'
    ? `This local activation bundle shows how this theme condition is reshaping nearby stored experiences and routes right now, read through the ${cluster.activeSchemaPack.label} schema pack.`
    : `This local activation bundle shows why this node matters in the current field of experience, read through the ${cluster.activeSchemaPack.label} schema pack.`;
  return `
    <section class="detail-section cluster-section cluster-status">
      <h3>Condition Engine Status</h3>
      <p class="meta"><strong>${escapeHtml(lead)}</strong></p>
      <p class="meta"><strong>Measurement doctrine:</strong> activationWeight is the graph's first real unit. The system measures route influence first, then reads meaning from what activation and gradient travel make visible.</p>
      <p class="meta">${escapeHtml(support)}</p>
      <div class="chip-list">
        <span class="chip">Schema pack: ${escapeHtml(cluster.activeSchemaPack.label)}</span>
        <span class="chip">Cluster mode: ${escapeHtml(cluster.clusterSchemaMode)}</span>
        <span class="chip">Cluster state: ${escapeHtml(cluster.clusterState)}</span>
        <span class="chip">Core cluster: ${cluster.coreNodeCount} node${cluster.coreNodeCount === 1 ? '' : 's'}</span>
        <span class="chip">Extended cluster: ${cluster.extendedNodeCount} node${cluster.extendedNodeCount === 1 ? '' : 's'}</span>
        <span class="chip">Activated routes: ${cluster.activeRouteCount}</span>
        <span class="chip">Stored possibilities: ${cluster.storedRouteCount}</span>
        <span class="chip">Measured unit: activationWeight</span>
        <span class="chip">activationWeight: ${averageWeight == null ? 'stored only' : `avg ${averageWeight.toFixed(2)} / peak ${peakWeight.toFixed(2)}`}</span>
      </div>
      <p class="meta"><strong>activationWeight:</strong> the graph's first real unit. It measures how much present condition-source influence is pressing a stored route toward visible activation.</p>
      <p class="meta"><strong>Runtime rule:</strong> Influence + activationWeight + Context + Gradient travel -> Meaning.</p>
      <p class="meta"><strong>Structural humility:</strong> this Local Climate Read is a provisional, best-supported route hypothesis under current local evidence.</p>
      <p class="meta"><strong>Revision boundary:</strong> if condition sources shift, contradictory evidence enters, or repeated route pressure changes, the engine must recompute and the previous read becomes historical context rather than active truth.</p>
      <p class="meta"><strong>Unresolved:</strong> if available evidence cannot sufficiently distinguish among competing routes, unresolved is the correct result.</p>
      <p class="meta"><strong>Schema reasoning:</strong> ${escapeHtml(cluster.schemaReasoning)}</p>
      <p class="meta"><strong>Condition coverage:</strong> ${cluster.conditionCoverage.activeCount} condition source${cluster.conditionCoverage.activeCount === 1 ? '' : 's'} influencing this cluster now; ${cluster.conditionCoverage.visibleCount} visible in-cluster and ${cluster.conditionCoverage.selectorCount} acting as selector${cluster.conditionCoverage.selectorCount === 1 ? '' : 's'}.</p>
      <p class="meta">${escapeHtml(cluster.clusterSummary)}</p>
      <p class="meta">${escapeHtml(extendedText)}</p>
    </section>
  `;
}

function renderGraphRules(cluster) {
  const modeLead = cluster.mode === 'theme'
    ? 'This theme field is being read through the condition engine. Stored routes stay possible until present conditions press them into activation and shape which experiences matter now.'
    : 'This node is being read through the condition engine. Stored routes stay possible until present conditions press them into activation and shape which experiences matter now.';
  return `
    <section class="detail-section cluster-section graph-rules-section">
      <h3>Graph Rules</h3>
      <p class="meta"><strong>This system measures influence, not meaning.</strong></p>
      <p class="meta">${escapeHtml(modeLead)}</p>
      <div class="graph-rules-grid">
        <article class="graph-rule-card">
          <strong>Foundation</strong>
          <p>Node = stored experience.</p>
          <p>Stored route = possible path connecting experiences even when nothing is using it right now.</p>
        </article>
        <article class="graph-rule-card">
          <strong>Condition Engine</strong>
          <p>Condition source = anything that can weight or activate a stored route.</p>
          <p>activationWeight = the first measurable graph unit.</p>
        </article>
        <article class="graph-rule-card">
          <strong>Activation</strong>
          <p>Activation happens when a stored route becomes relevant now.</p>
          <p>Meaning emerges only after activation, context, and gradient travel make a route visible.</p>
        </article>
        <article class="graph-rule-card">
          <strong>Structural Humility</strong>
          <p>The engine reports the best-supported route now, not permanent certainty.</p>
          <p>If evidence is insufficient, unresolved is valid. If conditions change, the read must revise.</p>
        </article>
        <article class="graph-rule-card">
          <strong>External / Internal</strong>
          <p>Environment provides pressure. Exposure is contact. Structural change is the measurable result.</p>
          <p>Current state stores the accumulation. Future behavior follows from current state.</p>
        </article>
        <article class="graph-rule-card">
          <strong>Pattern</strong>
          <p>Pattern = repeated activation behavior across reads.</p>
          <p>Patterns are shown through connection behavior, not stored as isolated labels.</p>
        </article>
        <article class="graph-rule-card">
          <strong>W.A.T.E.R</strong>
          <p>Words Altered Together Entering Reuse.</p>
          <p>W.A.T.E.R carries new experience through the graph and increases influence through reuse and repeated entry.</p>
        </article>
        <article class="graph-rule-card">
          <strong>Gradient Field</strong>
          <p>Y = degree of differentiation.</p>
          <p>Black = abstract field, gray = partial differentiation, bridge colors = multiple influences, primary colors = stable attractors, white = maximum revealed structure.</p>
        </article>
      </div>
      <p class="meta"><strong>Runtime formula:</strong> Entry + Reuse + Proximity + Recurrence + Condition weight -> Influence. Influence + activationWeight + Context + Gradient travel -> Meaning. Repeated Activation / Meaning -> Pattern.</p>
      <p class="meta"><strong>Point of view:</strong> Nodes store experience. Routes connect experiences. Conditions change which experiences matter. W.A.T.E.R carries new experience through the graph. Gradients are differences in accumulated experience. Meaning emerges from traversing those gradients.</p>
    </section>
  `;
}

function renderSchemaPackControl(cluster) {
  const active = cluster.activeSchemaPack;
  const options = cluster.availableSchemaPacks
    .map(pack => `<option value="${escapeHtml(pack.id)}"${pack.id === active.id ? ' selected' : ''}>${escapeHtml(pack.label)}</option>`)
    .join('');
  const available = cluster.availableSchemaPacks.map(pack => pack.label).join(', ');
  return `
    <section class="detail-section cluster-section">
      <h3>Read Language</h3>
      <div class="schema-pack-header">
        <label class="schema-pack-inline" for="detailSchemaPackSelect">
          <span>Schema pack</span>
          <select id="detailSchemaPackSelect">
            ${options}
          </select>
        </label>
        <span class="chip">Available: ${escapeHtml(available)}</span>
      </div>
      <p class="meta"><strong>${escapeHtml(active.label)}</strong>: ${escapeHtml(active.description)}</p>
      <p class="meta"><strong>Trace rule:</strong> ${escapeHtml(active.traceRule)}</p>
      <p class="meta"><strong>Condition rule:</strong> ${escapeHtml(active.conditionVocabulary)}</p>
      <p class="meta"><strong>System rule:</strong> The graph is shared; the language changes the read.</p>
    </section>
  `;
}

function renderClusterConditions(cluster) {
  if (!cluster.conditionSources.length) {
    return `
      <section class="detail-section cluster-section">
        <h3>Condition Sources Affecting This Node Now</h3>
        <p class="meta">No condition source is strongly shaping this local bundle right now. Stored routes remain available until current context selects them.</p>
      </section>
    `;
  }

  return `
    <section class="detail-section cluster-section">
      <h3>Condition Sources Affecting This Node Now</h3>
      <div class="cluster-condition-grid">
        ${cluster.conditionSources.map(card => `
          <article class="cluster-condition-card strength-${escapeHtml(card.strength)}">
            <strong>${escapeHtml(card.sourceLabel)}</strong>
            <span>${escapeHtml(card.visibleInCluster ? `${titleCase(card.sourceType.replace(/_/g, ' '))} · visible in cluster` : `${titleCase(card.sourceType.replace(/_/g, ' '))} · selector`)}</span>
            <p>${escapeHtml(card.whyItApplies)}</p>
            <p><strong>Scope:</strong> ${escapeHtml(card.scope)} · <strong>Weight:</strong> ${escapeHtml(String(card.weight))}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderHistoryContextSection(cluster) {
  if (!cluster.historyContext?.length) {
    return `
      <section class="detail-section cluster-section">
        <h3>History Context Now</h3>
        <p class="meta">No Religion or Arts history condition source is strongly affecting this local cluster right now.</p>
      </section>
    `;
  }

  return `
    <section class="detail-section cluster-section">
      <h3>History Context Now</h3>
      <div class="cluster-condition-grid">
        ${cluster.historyContext.map(item => {
          const era = historyEraMap().get(item.entry.eraId);
          return `
            <article class="cluster-condition-card strength-${item.score >= 5 ? 'strong' : 'medium'}">
              <strong>${escapeHtml(item.entry.label)}</strong>
              <span>${escapeHtml(era?.label || item.entry.eraId)} · ${escapeHtml(titleCase(item.entry.lane))} · ${escapeHtml(item.entry.type || 'record')}</span>
              <p>${escapeHtml(item.entry.summary || 'No summary.')}</p>
              <p><strong>Route seeds:</strong> ${escapeHtml((item.entry.routeSeeds || []).join(', ') || 'none')}</p>
              <p><strong>Why active now:</strong> ${escapeHtml(item.laneActive ? `${titleCase(item.entry.lane)} is active and the node overlaps this record's route seeds.` : 'This record overlaps the current activation bundle strongly enough to surface.')}</p>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderClusterReasoning(cluster) {
  const reasoningEdges = cluster.mode === 'theme' ? cluster.localActiveEdges : cluster.activeDirectEdges;
  if (!reasoningEdges.length) {
    return `
      <section class="detail-section cluster-section">
        <h3>Why These Routes Activated</h3>
        <p class="meta">No nearby route is active yet. The graph is holding local possibilities in stored form until context or pinning activates them.</p>
      </section>
    `;
  }

  const lines = reasoningEdges
    .slice(0, 6)
    .map(edge => {
      if (cluster.mode === 'theme') {
        const sourceNode = state.nodeById.get(edge.source);
        const targetNode = state.nodeById.get(edge.target);
        return `<li><strong>${escapeHtml(sourceNode?.label || edge.source)} -> ${escapeHtml(targetNode?.label || edge.target)}</strong>: ${escapeHtml(edge.__activationReason || 'Active in current context.')}</li>`;
      }
      const otherId = edge.source === cluster.node.id ? edge.target : edge.source;
      const otherNode = state.nodeById.get(otherId);
      return `<li><strong>${escapeHtml(otherNode?.label || otherId)}</strong>: ${escapeHtml(edge.__activationReason || 'Active in current context.')}</li>`;
    })
    .join('');

  return `
    <section class="detail-section cluster-section">
      <h3>Why These Routes Activated</h3>
      <ul class="meta">${lines}</ul>
    </section>
  `;
}

function renderStoredRoutesNearby(cluster) {
  const directStored = [
    ...cluster.outgoingStored.map(edge => ({ ...edge, clusterState: 'core', __clusterState: 'core', __clusterNote: 'Core cluster possibility. Stored nearby until context selects it.' })),
    ...cluster.incomingStored.map(edge => ({ ...edge, clusterState: 'core', __clusterState: 'core', __clusterNote: 'Core cluster possibility. Stored nearby until context selects it.' }))
  ];
  const themeStored = cluster.mode === 'theme'
    ? cluster.themeField.stored.map(edge => ({ ...edge, __clusterNote: edge.__clusterNote || 'Stored nearby inside this theme field until current conditions activate it.' }))
    : [];
  const extendedStored = cluster.extendedRoutes
    .filter(entry => entry.edge.__routeState === 'stored')
    .map(entry => entry.edge);
  const allStored = uniqueEdges([...directStored, ...themeStored, ...extendedStored]);
  const intro = cluster.mode === 'theme'
    ? 'These routes sit inside the current theme field as nearby possibilities, but they are not the strongest live paths right now.'
    : 'These routes are still part of the local possibility store, but they are not the strongest live paths right now.';

  return `
    <section class="detail-section cluster-section">
      <h3>Stored Possibilities Nearby</h3>
      <p class="meta">${escapeHtml(intro)}</p>
      <div class="edge-list">${renderEdges(allStored, 'cluster', 'No nearby stored routes are visible in this cluster.')}</div>
    </section>
  `;
}

function renderThemeClusterField(cluster) {
  if (cluster.mode !== 'theme') return '';
  const activeField = cluster.themeField.active || [];
  const storedField = cluster.themeField.stored || [];
  if (!activeField.length && !storedField.length) {
    return `
      <section class="detail-section cluster-section">
        <h3>Theme-Centered Field</h3>
        <p class="meta">This theme condition is present, but it is not strongly reshaping nearby routes right now.</p>
      </section>
    `;
  }

  return `
    <section class="detail-section cluster-section">
      <h3>Theme-Centered Field</h3>
      <p class="meta">${escapeHtml(cluster.themeContext?.label || cluster.node.label)} is being treated as a condition field. These nearby routes are the ones it is currently weighting most strongly.</p>
      <div class="route-state-block">
        <h4>Active routes in this field</h4>
        <div class="edge-list">${renderEdges(activeField, 'cluster', 'No route in this field is active right now.')}</div>
      </div>
      ${storedField.length ? `
        <div class="route-state-block">
          <h4>Stored routes in this field</h4>
          <div class="edge-list">${renderEdges(storedField, 'cluster', 'No stored route is visible in this field.')}</div>
        </div>
      ` : ''}
    </section>
  `;
}

function renderExtendedCluster(cluster) {
  if (!cluster.extendedRoutes.length) return '';
  const intro = cluster.mode === 'theme'
    ? 'Second-hop context is visible because this theme field is chaining forward or reconverging strongly enough to justify one more step.'
    : 'Second-hop context is visible because the current read chains forward or reconverges strongly enough to justify one more step.';
  return `
    <section class="detail-section cluster-section cluster-section-extended">
      <h3>Extended Cluster</h3>
      <p class="meta">${escapeHtml(intro)}</p>
      <div class="edge-list">${renderEdges(cluster.extendedRoutes.map(entry => entry.edge), 'cluster', 'No extended cluster routes are active.')}</div>
    </section>
  `;
}

function renderLocalPattern(cluster) {
  if (!cluster.patternSummary) return '';
  return `
    <section class="detail-section cluster-section">
      <h3>Pattern Through Repeated Activation</h3>
      <p class="meta">${escapeHtml(cluster.patternSummary)}</p>
    </section>
  `;
}

function renderActiveMeaning(cluster) {
  return `
    <section class="detail-section cluster-section">
      <h3>Meaning Emerging From Active Routes</h3>
      <p class="meta">${escapeHtml(cluster.activeMeaningSummary)}</p>
    </section>
  `;
}

function renderDetail() {
  const node = state.nodeById.get(state.selectedId);
  if (!node) return;
  const profile = state.perception.profile = currentPerceptionProfile();
  const cluster = buildNodeInfoCluster(node, profile, state.perception?.visibleNodeIds);
  state.perception.cluster = cluster;

  const family = nodeColorKey(node);
  const selectedColor = colorForNode(node)?.hex || familyColor(family);
  els.title.textContent = node.label;
  els.swatch.style.background = selectedColor;
  els.swatch.style.borderBottomColor = family === 'white' ? '#d8d2c8' : selectedColor;

  const directionPolicy = state.data.graph.directionPolicy || {};
  const typeInfo = nodeTypeInfo(node.type);
  const structureInfo = nodeStructureInfo(node);
  const metadata = node.metadata || {};
  const graphStats = graphTheoryStats(node);
  const nodeEmotionConnections = emotionConnectionsForNode(node);
  const shade = shadeInfoForNode(node);
  const environmentCondition = environmentConditionForNode(node);
  const activeSchemaPack = cluster.activeSchemaPack;
  const outgoingActive = cluster.outgoingActive;
  const incomingActive = cluster.incomingActive;
  const outgoingStored = cluster.outgoingStored;
  const incomingStored = cluster.incomingStored;
  const routeActivationSources = cluster.activationSources;
  const routeStatusText = routeActivationSources.length
    ? `Activated because: ${routeActivationSources.join(' + ')}. Stored routes remain possible but quieter until context or pinning selects them.`
    : cluster.mode === 'theme'
      ? 'No route in this local theme field is active right now. Stored nearby routes remain possible until conditions, search, personal influence, atlas influence, or pinning make them relevant.'
      : 'No route is active right now. Stored routes remain possible until search, conditions, personal influence, atlas influence, or pinning makes them relevant.';

  els.content.innerHTML = `
    <section class="detail-section">
      <h3>Node</h3>
      <div class="chip-list">
        <span class="chip">${escapeHtml(typeInfo.label)}</span>
        <span class="chip">${escapeHtml(structureInfo.label)}</span>
        <span class="chip">${escapeHtml(activeSchemaPack.label)} schema pack</span>
        ${family ? `<span class="chip">${escapeHtml(family)}</span>` : ''}
        ${metadata.definitionBasis ? `<span class="chip">${escapeHtml(metadata.definitionBasis)}</span>` : ''}
      </div>
    </section>
    ${renderSchemaPackControl(cluster)}
    ${renderClusterStatus(cluster)}
    ${renderGraphRules(cluster)}
    ${renderWaterConditionSection(cluster, node)}
    <section class="detail-section">
      <h3>Computer Model</h3>
      <p class="meta"><strong>What is this?</strong> ${escapeHtml(structureInfo.description)}</p>
      <p class="meta"><strong>Role:</strong> ${escapeHtml(structureInfo.storageRole)}. ${escapeHtml(structureInfo.relationshipRole)}</p>
      <p class="meta"><strong>Why it matters:</strong> ${escapeHtml(structureInfo.migrationHint)}</p>
    </section>
    ${renderNodeSchemaSection(node, cluster)}
    ${renderStoredRoutesNearby(cluster)}
    ${renderClusterConditions(cluster)}
    ${renderHistoryContextSection(cluster)}
    ${shade ? renderShadeDetailBlock(shade) : ''}
    ${environmentCondition ? renderEnvironmentCondition(environmentCondition) : ''}
    ${detailBlock('Graph Theory', `Degree ${graphStats.degree}; topology ${escapeHtml(graphStats.cluster)}; path distance ${graphStats.distance}; ${graphStats.incoming} routes in / ${graphStats.outgoing} routes out.`)}
    ${detailBlock('Node Baseline', `${escapeHtml(typeInfo.simpleDefinition)} ${escapeHtml(typeInfo.plainRole)}`)}
    ${detailBlock('Activation Status', escapeHtml(routeStatusText))}
    ${renderThemeClusterField(cluster)}
    ${renderClusterReasoning(cluster)}
    ${renderActiveMeaning(cluster)}
    ${metadata.definitionPhrase ? detailBlock('Definition Phrase', metadata.definitionPhrase) : ''}
    ${metadata.naturalNameBasis ? detailBlock('Shade Naming Basis', metadata.naturalNameBasis) : ''}
    ${metadata.sourceUrl ? detailBlock('Source', `<a href="${metadata.sourceUrl}" target="_blank" rel="noreferrer">${escapeHtml(metadata.sourceName || 'Source')}</a>`) : ''}
    ${nodeEmotionConnections.length ? `
      <section class="detail-section">
        <h3>Emotion Connections</h3>
        <p class="meta">Related through shared color-climate landing, not fixed emotional identity.</p>
        <div class="emotion-connection-grid">${nodeEmotionConnections.map(connection => `
          <button class="emotion-connection-card" type="button" onclick="selectNode('${connection.nodeId}')">
            <span class="dot" style="background:${familyColor(connection.family)}"></span>
            <span>
              <strong>${escapeHtml(connection.label)}</strong>
              <small>${escapeHtml(connection.tone)} · ${escapeHtml(connection.family)} climate</small>
            </span>
          </button>
        `).join('')}</div>
      </section>
    ` : ''}
    <section class="detail-section route-section route-section-outgoing">
      <h3>${escapeHtml(directionPolicy.outgoingLabel || 'Routes From This Node')}</h3>
      <p class="meta">${escapeHtml(directionPolicy.outgoingDefinition || 'Edges where this node is the source.')} ${escapeHtml(`${outgoingActive.length} route${outgoingActive.length === 1 ? '' : 's'} are active or context-selected right now; ${outgoingStored.length} remain stored only.`)}</p>
      <div class="route-state-block">
        <h4>Active routes now</h4>
        <div class="edge-list">${renderEdges(outgoingActive, 'outgoing', 'No outgoing route is active right now.')}</div>
      </div>
    </section>
    <section class="detail-section route-section route-section-incoming">
      <h3>${escapeHtml(directionPolicy.incomingLabel || 'Routes Into This Node')}</h3>
      <p class="meta">${escapeHtml(directionPolicy.incomingDefinition || 'Edges where this node is the target.')} ${escapeHtml(`${incomingActive.length} route${incomingActive.length === 1 ? '' : 's'} are active or context-selected right now; ${incomingStored.length} remain stored only.`)}</p>
      <div class="route-state-block">
        <h4>Active routes now</h4>
        <div class="edge-list">${renderEdges(incomingActive, 'incoming', 'No incoming route is active right now.')}</div>
      </div>
    </section>
    ${renderExtendedCluster(cluster)}
    ${renderRouteEvidenceSummary(node, outgoingActive, incomingActive)}
    ${renderLocalPattern(cluster)}
  `;

  const detailSchemaPackSelect = document.querySelector('#detailSchemaPackSelect');
  if (detailSchemaPackSelect) {
    detailSchemaPackSelect.addEventListener('change', event => {
      state.activeSchemaPackId = event.target.value in SCHEMA_PACK_DEFS ? event.target.value : 'color';
      if (els.schemaPack) els.schemaPack.value = state.activeSchemaPackId;
      saveSchemaPack();
      render();
    });
  }
}

function detailBlock(title, value) {
  return `<section class="detail-section"><h3>${title}</h3><p class="meta">${value}</p></section>`;
}

function renderRouteEvidenceSummary(node, outgoingEdges = [], incomingEdges = []) {
  const samples = [
    ...outgoingEdges
      .filter(edge => String(edge.evidence || '').trim())
      .slice(0, 3)
      .map(edge => {
        const target = state.nodeById.get(edge.target);
        return `From ${node.label} to ${(target?.label || edge.target)}: ${edge.evidence}`;
      }),
    ...incomingEdges
      .filter(edge => String(edge.evidence || '').trim())
      .slice(0, 3)
      .map(edge => {
        const source = state.nodeById.get(edge.source);
        return `Into ${node.label} from ${(source?.label || edge.source)}: ${edge.evidence}`;
      })
  ].slice(0, 6);

  if (!samples.length) {
    return detailBlock('Route Evidence', 'No route evidence is attached to the active incoming or outgoing paths yet.');
  }

  return `
    <section class="detail-section">
      <h3>Route Evidence</h3>
      <p class="meta">Evidence belongs on routes. These notes explain why this node connects the way it does.</p>
      <ul class="meta">${samples.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </section>
  `;
}

function renderEnvironmentCondition(condition) {
  const atmosphereVisual = environmentConditionVisual(condition);
  return `
    <section class="detail-section">
      <h3>Environment Condition</h3>
      <div class="environment-condition ${escapeHtml(atmosphereVisual.className)}">
        <div class="composition-head">
          <strong>${escapeHtml(atmosphereVisual.title)}</strong>
          <span>${escapeHtml(condition.status)}</span>
        </div>
        ${atmosphereVisual.metaphor ? `<div class="environment-condition-metaphor">${escapeHtml(atmosphereVisual.metaphor)}</div>` : ''}
        <dl>
          <dt>Condition</dt>
          <dd>${escapeHtml(condition.condition)}</dd>
          <dt>Climate</dt>
          <dd>${escapeHtml(condition.climate)}</dd>
          <dt>Axis read</dt>
          <dd>${escapeHtml(condition.axes)}</dd>
          <dt>Emotion rule</dt>
          <dd>${escapeHtml(condition.emotionalUse)}</dd>
        </dl>
        <p>${escapeHtml(condition.boundary)}</p>
      </div>
    </section>
  `;
}

function environmentConditionVisual(condition) {
  const text = `${condition?.title || ''} ${condition?.condition || ''} ${condition?.climate || ''}`.toLowerCase();
  const isAtmosphere = ['depth', 'distance', 'atmosphere', 'sky', 'ocean', 'blue'].some(term => text.includes(term));
  if (isAtmosphere) {
    return {
      className: 'environment-condition-atmosphere',
      title: `${condition.title} cloud`,
      metaphor: 'Cloud read: blue condition behaves like atmosphere, distance, and suspended depth.'
    };
  }

  return {
    className: '',
    title: condition?.title || 'Environment condition',
    metaphor: ''
  };
}

function environmentConditionForNode(node) {
  if (!node) return null;
  const families = environmentFamiliesForNode(node);
  if (!families.length) return null;
  return composeEnvironmentCondition(families, node.label);
}

function environmentFamiliesForNode(node) {
  const families = [];
  const add = family => {
    const normalized = normalizeFamilyId(family);
    if (ENVIRONMENT_CONDITIONS[normalized] && !families.includes(normalized)) families.push(normalized);
  };

  if (node.type === 'family') add(node.id.replace('family-', ''));
  if (node.family) splitFamilyId(node.family).forEach(add);
  splitFamilyId(nodeColorKey(node)).forEach(add);

  const color = node.type === 'environment_condition' || node.type === 'environment_term'
    ? null
    : colorForNode(node);
  if (color?.mixInfo?.components?.length) {
    color.mixInfo.components.forEach(component => splitFamilyId(component.family).forEach(add));
  }

  if (node.type === 'emotion_word' && node.metadata?.climateFamily) {
    splitFamilyId(node.metadata.climateFamily).forEach(add);
  }

  return families.slice(0, 4);
}

function composeEnvironmentCondition(families, label) {
  const conditions = families.map(family => ENVIRONMENT_CONDITIONS[family]).filter(Boolean);
  if (!conditions.length) return null;
  if (conditions.length === 1) {
    const family = families[0];
    const condition = conditions[0];
    return {
      title: `${label} as ${family} condition`,
      status: 'base condition',
      ...condition,
      boundary: 'Environment conditions describe the climate a color creates. They do not claim a permanent emotion or strict synonym.'
    };
  }

  return {
    title: `${label} as mixed condition`,
    status: `${families.join(' + ')} condition blend`,
    condition: conditions.map(item => item.condition).join(' + '),
    climate: conditions.map((item, index) => `${families[index]}: ${item.climate}`).join(' '),
    axes: 'Mixed condition: compare the shade X/Y/Z position above to see how warmth, light-depth, and saturation combine.',
    emotionalUse: 'Read emotion through the blend: the feeling is shaped by several environmental conditions at once rather than reduced to one color label.',
    boundary: 'Mixed environment conditions are translator context, not strict color synonym evidence.'
  };
}

function splitFamilyId(family) {
  return String(family || '')
    .toLowerCase()
    .split('-')
    .map(part => part.trim())
    .filter(Boolean);
}

function edgeActivationLabel(edge) {
  if (edge.__isPinned) return 'pinned active';
  if (edge.__routeState === 'active') return 'active';
  if (edge.__routeState === 'context_selected') return 'context-selected';
  return 'stored';
}

function renderEdges(edges, direction, emptyText = 'No connections.') {
  if (!edges.length) return `<p class="meta">${escapeHtml(emptyText)}</p>`;
  return edges.slice(0, 12).map(edge => {
    const source = state.nodeById.get(edge.source);
    const target = state.nodeById.get(edge.target);
    const selectedIsSource = edge.source === state.selectedId;
    const selectedIsTarget = edge.target === state.selectedId;
    const sourceIsDirectNeighbor = !!(state.selectedId && (
      outgoing(state.selectedId).some(candidate => candidate.target === edge.source)
      || incoming(state.selectedId).some(candidate => candidate.source === edge.source)
    ));
    const targetIsDirectNeighbor = !!(state.selectedId && (
      outgoing(state.selectedId).some(candidate => candidate.target === edge.target)
      || incoming(state.selectedId).some(candidate => candidate.source === edge.target)
    ));
    const roleLabel = direction === 'cluster'
      ? (edge.__clusterState === 'extended' ? 'extended nearby route' : 'core nearby route')
      : (selectedIsSource ? 'starts here' : 'arrives here');
    const nextId = direction === 'cluster' && edge.__clusterState === 'extended' && !selectedIsSource && !selectedIsTarget
      ? (sourceIsDirectNeighbor && !targetIsDirectNeighbor ? edge.target : targetIsDirectNeighbor && !sourceIsDirectNeighbor ? edge.source : edge.target)
      : (selectedIsSource ? edge.target : edge.source);
    const bucket = edgeRouteBucket(edge, state.perception?.profile) || 'weak';
    const routeKey = edgeRouteKey(edge);
    const activationLabel = edgeActivationLabel(edge);
    const activationReason = edge.__activationReason || 'Stored as a possible route until current context selects it.';
    const activationWeight = Number.isFinite(Number(edge.__activationWeight))
      ? Number(edge.__activationWeight).toFixed(2)
      : null;
    const clusterLabel = edge.__clusterState ? ` · ${edge.__clusterState} cluster` : '';
    const clusterNote = edge.__clusterNote ? `<span class="edge-cluster-note">${escapeHtml(edge.__clusterNote)}</span>` : '';
    const directionClass = direction === 'incoming'
      ? 'is-incoming'
      : direction === 'outgoing'
        ? 'is-outgoing'
        : 'is-cluster';
    return `
      <div class="edge-card edge-card-${escapeHtml(edge.__routeState || 'stored')} ${edge.__isPinned ? 'is-pinned' : ''}">
        <button class="edge-row ${directionClass} edge-row-${escapeHtml(bucket)} edge-row-${escapeHtml(edge.__routeState || 'stored')}" type="button" onclick="selectNode('${nextId}')">
          <strong>${escapeHtml(source?.label || edge.source)} -> ${escapeHtml(target?.label || edge.target)}</strong>
          <span class="edge-role">${escapeHtml(roleLabel)} · ${escapeHtml(edge.type)} · ${escapeHtml(bucket)} · ${escapeHtml(activationLabel)}${escapeHtml(clusterLabel)}</span>
          <span>${escapeHtml(edgeMeaning(edge))}</span>
          <span class="edge-activation-weight">${activationWeight ? `activationWeight ${activationWeight}` : 'activationWeight stored-only'}</span>
          <span class="edge-activation">${escapeHtml(activationReason)}</span>
          ${clusterNote}
          ${edge.evidence ? `<span class="edge-evidence">${escapeHtml(edge.evidence)}</span>` : ''}
        </button>
        <button class="edge-pin ${edge.__isPinned ? 'is-active' : ''}" type="button" onclick='toggleRoutePin(${JSON.stringify(routeKey)})'>${edge.__isPinned ? 'Unpin route' : 'Pin route'}</button>
      </div>
    `;
  }).join('');
}

function edgeMeaning(edge) {
  const meanings = {
    has_synonym: 'source color family has the target as a direct color synonym',
    has_subfamily: 'source color family connects to an in-between bridge color',
    definition_contains: 'source term definition contains or leans into the target color family',
    synonym_overlap: 'source and target share the same definition phrase',
    has_expanded_synonym: 'source alias expands to the target cited synonym word',
    shade_of: 'source color word maps to this natural shade name using its definition phrase',
    shade_of_subfamily: 'source natural shade name belongs to this in-between bridge color',
    shade_mentions_family: 'source natural shade name points to this color family through its definition phrase',
    same_term: 'source and target use the same normalized word in different graph layers',
    associated_color: 'source common word has a concrete color association with the target',
    emotion_association: 'source emotion word has a contextual translator route to the target',
    environment_condition: 'source color family produces an environment condition',
    condition_has_synonym: 'source environment condition connects to a condition-language synonym',
    neutral_synonym: 'source neutral word connects to a cited synonym bridge',
    synonym_to_mapped_word: 'source synonym bridge reaches the target mapped common word',
    synonym_to_color_alias: 'source synonym bridge reaches the target color family or alias'
  };
  return meanings[edge.type] || edge.description || 'evidence-backed graph route';
}

function renderShadeDetailBlock(shade) {
  const color = shade.color;
  const pos = shade.position;
  const base = shade.basePosition || pos;
  const themeShift = shade.themeConditionInfluence;
  const mix = color.mixInfo;
  const atlas = shade.atlasInfluence;
  const placement = shade.baselinePlacement;
  const bridgeParents = placement?.parentFamilies || [];
  const bridgeWeights = placement?.influenceWeights || [];
  return `
    <section class="detail-section shade-detail-block">
      <h3>Shade Position</h3>
      <div class="shade-conversion-card compact">
        <span class="shade-large-swatch" style="background:${escapeHtml(color.hex)}"></span>
        <div>
          <strong>${escapeHtml(color.hex)}</strong>
          <span>RGB ${color.r}, ${color.g}, ${color.b} · HSL ${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(color.l)}%</span>
          <span>X ${pos.x} ${SHADE_AXIS_LABELS.x}; Y ${pos.y} ${SHADE_AXIS_LABELS.y}; Z ${pos.z} ${SHADE_AXIS_LABELS.z}</span>
          ${placement?.kind === 'base_family_anchor' ? `<span>Baseline rule: fixed base-color anchor.</span>` : ''}
          ${placement?.kind === 'bridge_family_anchor' ? `<span>Baseline rule: bridge family placed between two primary anchors.</span>` : ''}
          ${placement?.kind === 'shade_from_base' ? `<span>Baseline rule: shade inherits from its strongest base-color path.</span>` : ''}
          ${placement?.kind === 'shade_from_bridge' ? `<span>Baseline rule: shade inherits from its strongest bridge path.</span>` : ''}
          ${bridgeParents.length === 2 ? `<span>Bridge rule: ${escapeHtml(bridgeParents[0])} ${(bridgeWeights[0] * 100).toFixed(0)}% <-> ${escapeHtml(bridgeParents[1])} ${(bridgeWeights[1] * 100).toFixed(0)}%.</span>` : ''}
          ${placement?.parentNode ? `<span>Inherited through ${escapeHtml(placement.parentNode.label)} before live condition pull.</span>` : ''}
          ${themeShift ? `<span>Base X ${base.x}; Y ${base.y}; Z ${base.z} -> Theme-conditioned X ${themeShift.position.x}; Y ${themeShift.position.y}; Z ${themeShift.position.z}</span>` : ''}
          ${atlas ? `<span>${themeShift ? 'Theme-conditioned' : 'Base'} X ${(themeShift?.position || base).x}; Y ${(themeShift?.position || base).y}; Z ${(themeShift?.position || base).z} -> Atlas-influenced X ${pos.x}; Y ${pos.y}; Z ${pos.z}</span>` : ''}
        </div>
      </div>
      ${placement?.boundary ? `<p class="meta">${escapeHtml(placement.boundary)}</p>` : ''}
      ${themeShift ? `
        <p class="meta">${escapeHtml(themeShift.boundary)}</p>
        <div class="chip-list">
          ${themeShift.conditions.map(condition => `<span class="chip">${escapeHtml(condition.label)} · weight ${condition.weight.toFixed(2)}</span>`).join('')}
          <span class="chip">Net pull ${themeShift.delta.x >= 0 ? '+' : ''}${themeShift.delta.x}, ${themeShift.delta.y >= 0 ? '+' : ''}${themeShift.delta.y}, ${themeShift.delta.z >= 0 ? '+' : ''}${themeShift.delta.z}</span>
        </div>
      ` : ''}
      ${atlas ? `
        <p class="meta">${escapeHtml(atlas.boundary)}</p>
        <div class="chip-list">
          ${atlas.groups.map(group => `<span class="chip">${escapeHtml(group.label)} · weight ${group.weight.toFixed(2)}</span>`).join('')}
        </div>
      ` : ''}
      ${mix?.components?.length ? `
        <p class="meta">${escapeHtml(mix.boundary || 'Emotion shade is calculated from graph-supported color-climate routes, not treated as a strict synonym.')}</p>
        <div class="chip-list">
          ${mix.components.map(component => `<span class="chip"><span class="dot" style="background:${escapeHtml(component.hex)}"></span>${escapeHtml(component.label)}</span>`).join('')}
        </div>
      ` : ''}
    </section>
  `;
}

function shadeInfoForNode(node) {
  const color = colorForNode(node);
  if (!color) return null;
  const baseline = baselinePlacementForNode(node);
  const display = displayShadePositionForNode(node);
  return {
    color,
    position: display?.position || baseline?.position || shadePosition(color, environmentFamiliesForNode(node) || []),
    basePosition: display?.base || baseline?.position || shadePosition(color, environmentFamiliesForNode(node) || []),
    baselinePlacement: baseline || null,
    themeConditionInfluence: display?.themeCondition || null,
    atlasInfluence: display?.atlas || null
  };
}

function shadeComparableNodes() {
  return state.nodes
    .filter(node => ['family', 'ecosystem_foundation', 'theme_condition', 'ecosystem_signal', 'ecosystem_weather', 'environment_condition', 'environment_term', 'subfamily', 'shade', 'alias', 'synonym', 'emotion_word', 'common_word', 'neutral_word'].includes(node.type))
    .map(node => {
      const color = colorForNode(node);
      if (!color) return null;
      const display = displayShadePositionForNode(node);
      const baseline = baselinePlacementForNode(node);
      return {
        node,
        color,
        position: display?.position || baseline?.position || shadePosition(color, environmentFamiliesForNode(node) || []),
        themeConditionInfluence: display?.themeCondition || null,
        atlasInfluence: display?.atlas || null
      };
    })
    .filter(Boolean);
}

function colorForNode(node) {
  if (!node) return null;
  const direct = node.metadata?.hex || node.metadata?.color || node.metadata?.rgb;
  const directColor = parseColorInput(direct);
  if (directColor) return directColor;
  if (node.type === 'environment_condition' || node.type === 'environment_term') {
    const families = environmentFamiliesForNode(node);
    if (families.length > 1) {
      return mixComponentColors(families.map(family => ({
        label: family,
        hex: familyColor(family),
        family
      })));
    }
    return parseColorInput(familyColor(families[0] || node.family || 'neutral'));
  }
  if (node.type === 'emotion_word') {
    return emotionShadeColorForNode(node) || parseColorInput(familyColor('emotion'));
  }
  if (node.type === 'common_word' || node.type === 'neutral_word') {
    return wordRouteShadeColorForNode(node);
  }
  return baseColorForNode(node);
}

function baseColorForNode(node) {
  if (!node) return null;
  const direct = node.metadata?.hex || node.metadata?.color || node.metadata?.rgb;
  const directColor = parseColorInput(direct);
  if (directColor) return directColor;
  const family = nodeColorKey(node);
  return parseColorInput(familyColor(family));
}

function emotionShadeColorForNode(node, visited = new Set()) {
  if (!node || visited.has(node.id)) return null;
  visited.add(node.id);
  const components = [];

  outgoing(node.id)
    .filter(edge => edge.type === 'emotion_association')
    .forEach(edge => {
      const target = state.nodeById.get(edge.target);
      if (!target) return;
      if (target.type === 'emotion_word') {
        const routed = emotionShadeColorForNode(target, visited);
        if (routed?.mixInfo?.components?.length) {
          routed.mixInfo.components.forEach(component => components.push(component));
        } else if (routed) {
          components.push({
            label: target.label,
            hex: routed.hex,
            family: target.metadata?.climateFamily || nodeColorKey(target)
          });
        }
        return;
      }
      const color = baseColorForNode(target);
      if (!color) return;
      components.push({
        label: target.label,
        hex: color.hex,
        family: target.family || edge.metadata?.family || nodeColorKey(target)
      });
    });

  const climateFamily = node.metadata?.climateFamily;
  if (climateFamily && !components.length) {
    const color = parseColorInput(familyColor(climateFamily));
    if (color) components.push({ label: climateFamily, hex: color.hex, family: climateFamily });
  }

  const unique = [];
  const seen = new Set();
  components.forEach(component => {
    const key = `${component.hex}|${component.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(component);
  });
  if (!unique.length) return null;
  const mixed = mixComponentColors(unique);
  if (!mixed) return null;
  mixed.mixInfo = {
    kind: unique.length > 1 ? 'mixed emotion shade' : 'emotion shade',
    components: unique,
    boundary: unique.length > 1
      ? `${node.label} is shown as a mixed shade because its emotion routes connect to multiple color climates.`
      : `${node.label} is shown with its graph-supported emotion color route.`
  };
  return mixed;
}

function wordRouteShadeColorForNode(node) {
  if (!node) return null;
  const paths = node.type === 'common_word'
    ? associatedColorPaths(node)
    : node.type === 'neutral_word'
      ? neutralLandingPaths(node)
      : [];
  const components = paths
    .map(path => path.landing?.node)
    .filter(Boolean)
    .map(target => {
      const color = baseColorForNode(target);
      if (!color) return null;
      return {
        label: target.label,
        hex: color.hex,
        family: target.family || nodeColorKey(target),
        route: paths.find(path => path.landing?.node?.id === target.id)?.nodes?.join(' -> ')
      };
    })
    .filter(Boolean);

  const unique = [];
  const seen = new Set();
  components.forEach(component => {
    const key = `${component.hex}|${component.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(component);
  });
  if (!unique.length) return null;
  const mixed = mixComponentColors(unique);
  if (!mixed) return null;
  const typeLabel = node.type === 'neutral_word' ? 'neutral bridge' : 'common word';
  mixed.mixInfo = {
    kind: unique.length > 1 ? `mixed ${typeLabel} shade` : `${typeLabel} shade`,
    components: unique,
    boundary: unique.length > 1
      ? `${node.label} is shown as a mixed shade because its graph routes connect to multiple supported color climates.`
      : `${node.label} is shown with its graph-supported ${typeLabel} color route.`
  };
  return mixed;
}

function mixComponentColors(components) {
  const colors = components
    .map(component => parseColorInput(component.hex))
    .filter(Boolean);
  if (!colors.length) return null;
  const total = colors.reduce((acc, color) => ({
    r: acc.r + color.r,
    g: acc.g + color.g,
    b: acc.b + color.b
  }), { r: 0, g: 0, b: 0 });
  return rgbToColor(
    Math.round(total.r / colors.length),
    Math.round(total.g / colors.length),
    Math.round(total.b / colors.length)
  );
}

function parseColorInput(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  const hexMatch = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
    return rgbToColor(
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    );
  }

  const rgbMatch = text.match(/^rgba?\(([^)]+)\)$/);
  const parts = rgbMatch
    ? rgbMatch[1].split(',').map(part => part.trim())
    : text.match(/^\d{1,3}[\s,]+\d{1,3}[\s,]+\d{1,3}$/)
      ? text.split(/[\s,]+/)
      : [];
  if (parts.length >= 3) {
    const [r, g, b] = parts.map(part => Number.parseInt(part, 10));
    if ([r, g, b].every(value => Number.isFinite(value) && value >= 0 && value <= 255)) {
      return rgbToColor(r, g, b);
    }
  }
  return null;
}

function rgbToColor(r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  return {
    r,
    g,
    b,
    hex: rgbToHex(r, g, b),
    ...hsl
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / delta) % 6;
    if (max === gn) h = (bn - rn) / delta + 2;
    if (max === bn) h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h,
    s: s * 100,
    l: l * 100
  };
}

function shadePosition(color, families = []) {
  const warmth = warmthFromHue(color.h, color.s);
  const vividBias = clamp((color.s - 50) * 2, -100, 100);
  const familyVector = averageConditionVector(families);
  const pathX = familyVector ? familyVector.x : warmth;
  const pathZ = familyVector ? familyVector.z : vividBias;
  const rawDifferentiation = clamp(Math.round(color.l * 0.74 + color.s * 0.26), 0, 100);
  const localOffset = clamp(
    Math.round((color.l - 50) * 0.12 + (color.s - 50) * 0.04),
    -6,
    8
  );
  const pathY = familyVector ? familyVector.y : rawDifferentiation;
  return {
    x: Math.round(clamp(pathX * 0.64 + warmth * 0.36, -100, 100)),
    y: Math.round(clamp(familyVector ? pathY + localOffset : rawDifferentiation, 0, 100)),
    z: Math.round(clamp(pathZ * 0.48 + vividBias * 0.52, -100, 100))
  };
}

function axisRangeSummary(axis) {
  const polarity = SHADE_AXIS_POLARITIES[axis];
  if (!polarity) return '-100 to +100';
  if (typeof polarity.start === 'string' && typeof polarity.end === 'string') {
    return `${polarity.start} ${polarity.min} to ${polarity.end} ${polarity.max}`;
  }
  return `${polarity.negative} ${polarity.min} to ${polarity.positive} ${polarity.max}`;
}

function averageConditionVector(families) {
  const normalizedFamilies = uniqueStrings((families || [])
    .flatMap(family => splitFamilyId(family))
    .map(normalizeFamilyId));
  const vectors = normalizedFamilies
    .map(family => storedFamilyVector(family))
    .filter(Boolean);
  if (!vectors.length) return null;
  const summed = vectors.reduce((acc, vector) => ({
    x: acc.x + vector.x,
    y: acc.y + vector.y,
    z: acc.z + vector.z
  }), { x: 0, y: 0, z: 0 });
  return {
    x: summed.x / vectors.length,
    y: summed.y / vectors.length,
    z: summed.z / vectors.length
  };
}

function storedFamilyVector(family) {
  const normalized = normalizeFamilyId(family);
  if (!normalized) return null;

  const directAnchor = CONDITION_FAMILY_VECTORS[normalized];
  if (directAnchor) {
    return { ...directAnchor };
  }

  const bridgeRule = bridgeFamilyRuleForFamily(normalized);
  if (!bridgeRule?.parents?.length) return null;

  const weights = Array.isArray(bridgeRule.weights) && bridgeRule.weights.length >= bridgeRule.parents.length
    ? bridgeRule.weights.slice(0, bridgeRule.parents.length)
    : bridgeRule.parents.map(() => 1 / bridgeRule.parents.length);
  return weightedBridgePosition(bridgeRule.parents, weights);
}

function familyAnchorVector(family) {
  const normalized = normalizeFamilyId(family);
  if (!PRIMARY_COLOR_ANCHORS.has(normalized)) return null;
  const vector = CONDITION_FAMILY_VECTORS[normalized];
  return vector ? { ...vector } : null;
}

function bridgeFamilyRuleForFamily(family) {
  const normalized = normalizeFamilyId(family);
  return normalized ? BRIDGE_FAMILY_RULES[normalized] || null : null;
}

function familyNodesForBridge(node) {
  return uniqueNodes([
    ...incoming(node.id)
      .filter(edge => edge.type === 'has_subfamily')
      .map(edge => state.nodeById.get(edge.source)),
    ...outgoing(node.id)
      .filter(edge => edge.type === 'has_subfamily')
      .map(edge => state.nodeById.get(edge.target))
  ].filter(entry => entry && entry.type === 'family'));
}

function bridgeParentsForNode(node) {
  const explicitFamilyNodes = familyNodesForBridge(node);
  const explicitParents = explicitFamilyNodes
    .map(parent => normalizeFamilyId(nodeColorKey(parent)))
    .filter(Boolean);
  if (explicitParents.length >= 2) return explicitParents.slice(0, 2);

  const splitParents = uniqueStrings(
    splitFamilyId(node.family || nodeColorKey(node))
      .map(normalizeFamilyId)
      .filter(Boolean)
  );
  if (splitParents.length >= 2) return splitParents.slice(0, 2);

  const environmentParents = uniqueStrings((environmentFamiliesForNode(node) || [])
    .flatMap(family => splitFamilyId(family))
    .map(normalizeFamilyId)
    .filter(Boolean));
  return environmentParents.slice(0, 2);
}

function bridgeInfluenceWeightsForNode(node, parents) {
  const raw = node?.metadata?.influenceWeights;
  if (Array.isArray(raw) && raw.length >= parents.length) {
    const numeric = raw
      .slice(0, parents.length)
      .map(value => Number(value))
      .filter(Number.isFinite)
      .map(value => Math.max(0, value));
    const total = numeric.reduce((sum, value) => sum + value, 0);
    if (numeric.length === parents.length && total > 0) {
      return numeric.map(value => value / total);
    }
  }

  if (!parents.length) return [];
  const equal = 1 / parents.length;
  return parents.map(() => equal);
}

function bridgePlacementFromParents(parents, weights, kind = 'bridge_color', boundary = 'Bridge colors sit between the two strongest base-color parents. Closer to one parent means stronger influence from that side.') {
  if (parents.length < 2) return null;
  const normalizedParents = parents
    .map(parent => normalizeFamilyId(parent))
    .filter(Boolean);
  if (normalizedParents.length < 2) return null;
  const normalizedWeights = Array.isArray(weights) && weights.length >= normalizedParents.length
    ? weights.slice(0, normalizedParents.length)
    : new Array(normalizedParents.length).fill(1 / normalizedParents.length);
  const position = weightedBridgePosition(normalizedParents, normalizedWeights);
  if (!position) return null;
  return {
    kind,
    position,
    parentFamilies: normalizedParents,
    influenceWeights: normalizedWeights,
    boundary
  };
}

function bridgePlacementForFamily(node, family) {
  const rule = bridgeFamilyRuleForFamily(family);
  if (!rule?.parents?.length) return null;
  const weights = Array.isArray(node?.metadata?.influenceWeights) && node.metadata.influenceWeights.length >= rule.parents.length
    ? bridgeInfluenceWeightsForNode(node, rule.parents)
    : (rule.weights || bridgeInfluenceWeightsForNode(node, rule.parents));
  return bridgePlacementFromParents(
    rule.parents,
    weights,
    'bridge_family_anchor',
    'This family behaves as a bridge between two primary anchors in the stored map. Closer placement means stronger influence from that side.'
  );
}

function weightedBridgePosition(parents, weights) {
  if (!parents.length || parents.length !== weights.length) return null;
  const vectors = parents
    .map(parent => familyAnchorVector(parent))
    .filter(Boolean);
  if (vectors.length !== parents.length) return null;
  const weighted = vectors.reduce((acc, vector, index) => ({
    x: acc.x + vector.x * weights[index],
    y: acc.y + vector.y * weights[index],
    z: acc.z + vector.z * weights[index]
  }), { x: 0, y: 0, z: 0 });
  const normalizedParents = parents.map(parent => normalizeFamilyId(parent));
  const bridgeBand = differentiationBandForParents(normalizedParents);
  const weightedRatio = weightedInfluenceRatio(weights);
  const bridgeY = interpolateBand(bridgeBand, weightedRatio);

  return {
    x: Math.round(clamp(weighted.x, -100, 100)),
    y: Math.round(clamp(bridgeY, 0, 100)),
    z: Math.round(clamp(weighted.z, -100, 100))
  };
}

function bridgePlacementForNode(node) {
  const parents = bridgeParentsForNode(node);
  if (parents.length < 2) return null;
  const weights = bridgeInfluenceWeightsForNode(node, parents);
  return bridgePlacementFromParents(parents, weights);
}

function strongestParentNodeForShade(node) {
  const neighbors = uniqueNodes([
    ...incoming(node.id).map(edge => state.nodeById.get(edge.source)),
    ...outgoing(node.id).map(edge => state.nodeById.get(edge.target))
  ].filter(Boolean));

  const explicitBridge = neighbors.find(entry => entry.type === 'subfamily');
  if (explicitBridge) return explicitBridge;

  const explicitFamily = neighbors.find(entry => entry.type === 'family');
  if (explicitFamily) return explicitFamily;

  const inferredBridgeFamilies = uniqueStrings(splitFamilyId(node.family || nodeColorKey(node)).map(normalizeFamilyId).filter(Boolean));
  if (inferredBridgeFamilies.length >= 2) {
    const candidate = state.nodes.find(entry =>
      entry.type === 'subfamily'
      && uniqueStrings(splitFamilyId(entry.family || nodeColorKey(entry)).map(normalizeFamilyId).filter(Boolean)).join('|') === inferredBridgeFamilies.slice(0, 2).join('|')
    );
    if (candidate) return candidate;
  }

  const family = normalizeFamilyId(nodeColorKey(node))
    || normalizeFamilyId(inferredBridgeFamilies[0]);
  return familyNodeByFamily(family);
}

function outwardFactorForNode(node) {
  if (!node) return 0.18;
  if (node.type === 'shade') return 0.28;
  if (node.type === 'alias') return 0.22;
  if (node.type === 'synonym') return 0.18;
  if (node.type === 'common_word' || node.type === 'neutral_word') return 0.3;
  if (node.type === 'emotion_word') return 0.28;
  if (node.type === 'environment_condition' || node.type === 'environment_term') return 0.24;
  return 0.22;
}

function inheritedPlacementForNode(node, color) {
  const parentNode = strongestParentNodeForShade(node);
  const parentPlacement = parentNode ? baselinePlacementForNode(parentNode) : null;
  if (!parentPlacement?.position) return null;

  const heuristic = shadePosition(
    color,
    parentPlacement.parentFamilies?.length
      ? parentPlacement.parentFamilies
      : (environmentFamiliesForNode(node) || [])
  );
  const outward = outwardFactorForNode(node);
  const inward = 1 - outward;
  const bridgeParent = parentNode.type === 'subfamily';
  const shadeYOffset = clamp(
    (heuristic.y - parentPlacement.position.y) * (bridgeParent ? 0.45 : 0.55),
    bridgeParent ? -3 : -4,
    bridgeParent ? 4 : 6
  );
  return {
    kind: bridgeParent ? 'shade_from_bridge' : 'shade_from_base',
    position: {
      x: Math.round(clamp(parentPlacement.position.x * inward + heuristic.x * outward, -100, 100)),
      y: Math.round(clamp(parentPlacement.position.y + shadeYOffset, 0, 100)),
      z: Math.round(clamp(parentPlacement.position.z * inward + heuristic.z * outward, -100, 100))
    },
    parentFamilies: parentPlacement.parentFamilies || [],
    influenceWeights: parentPlacement.influenceWeights || [],
    parentNode,
    boundary: bridgeParent
      ? 'Shades inherit their baseline placement from the strongest bridge path, then move outward slightly to keep exact shade identity visible.'
      : 'Shades inherit their baseline placement from the strongest base-color path, then move outward slightly to keep exact shade identity visible.'
  };
}

function conditionAwareShadePosition(color, families = []) {
  const heuristic = shadePosition(color, families);
  const conditionVector = averageConditionVector(families);
  if (!conditionVector) return heuristic;
  const familyCount = uniqueStrings((families || []).flatMap(family => splitFamilyId(family))).length;
  const conditionWeight = clamp(0.62 + Math.max(0, familyCount - 1) * 0.06, 0.62, 0.76);
  const heuristicWeight = 1 - conditionWeight;
  return {
    x: Math.round(clamp(heuristic.x * heuristicWeight + conditionVector.x * conditionWeight, -100, 100)),
    y: Math.round(clamp(heuristic.y * heuristicWeight + conditionVector.y * conditionWeight, 0, 100)),
    z: Math.round(clamp(heuristic.z * heuristicWeight + conditionVector.z * conditionWeight, -100, 100))
  };
}

function warmthFromHue(hue, saturation) {
  if (saturation < 4) return 0;
  const warmCenter = 35;
  const coolCenter = 215;
  const warmDistance = hueDistance(hue, warmCenter);
  const coolDistance = hueDistance(hue, coolCenter);
  const raw = ((coolDistance - warmDistance) / 180) * 100;
  return clamp(raw * Math.min(1, saturation / 35), -100, 100);
}

function hueDistance(a, b) {
  const distance = Math.abs(a - b) % 360;
  return Math.min(distance, 360 - distance);
}

function nodeTypeInfo(type) {
  const fallback = {
    family: {
      label: 'Base color',
      simpleDefinition: 'A main base color group, like red, blue, green, black, or white.',
      plainRole: 'This is the broad base color bucket where related color routes land.'
    },
    alias: {
      label: 'Shade',
      simpleDefinition: 'A real color name that belongs under a base color or secondary color.',
      plainRole: 'This is a searchable shade name people can land on directly.'
    },
    synonym: {
      label: 'Cited synonym',
      simpleDefinition: 'A word connected by dictionary or thesaurus evidence.',
      plainRole: 'This helps the graph move from one real word to another without guessing.'
    },
    subfamily: {
      label: 'Secondary color',
      simpleDefinition: 'An in-between or mixed color zone made from base colors, like red-orange or blue-gray.',
      plainRole: 'This makes it easier to see how one base color connects to another.'
    },
    shade: {
      label: 'Shade phrase',
      simpleDefinition: 'A real definition phrase that says how a shade leans, like reddish orange or bluish gray.',
      plainRole: 'This explains the exact wording that creates a shade connection.'
    },
    common_word: {
      label: 'Common word',
      simpleDefinition: 'An everyday word that is not a color, but can have a clear color association.',
      plainRole: 'This can suggest a color through a concrete object or idea.'
    },
    emotion_word: {
      label: 'Emotion word',
      simpleDefinition: 'A feeling word that starts an emotional translation path.',
      plainRole: 'This can suggest colors through labeled emotional context, but it is not a strict color synonym.'
    },
    neutral_word: {
      label: 'Neutral word',
      simpleDefinition: 'A word that does not safely point to a color by itself.',
      plainRole: 'This stays unresolved unless evidence or context connects it to color.'
    },
    environment_condition: {
      label: 'Environment condition',
      simpleDefinition: 'A climate condition created by a base color, such as heat, depth, fog, exposure, growth, or reflection.',
      plainRole: 'This changes the map as translator context, but it is not a strict color synonym.'
    },
    environment_term: {
      label: 'Condition synonym',
      simpleDefinition: 'A word that names part of an environment condition, such as heat, urgency, atmosphere, or grounding.',
      plainRole: 'This connects condition language to color-climate without claiming a dictionary synonym. Color-climate follows the environment-condition rules.'
    },
    ecosystem_foundation: {
      label: 'Condition field foundation',
      simpleDefinition: 'The living field of the graph: bedrock holds slower accumulated state, evergreen grows through repeated signals, and weather changes quickly.',
      plainRole: 'This lets stored experience receive pressure and change without silently rewriting truth.'
    },
    theme_condition: {
      label: 'Theme condition',
      simpleDefinition: 'A theme condition or active filter that changes how connected words react.',
      plainRole: 'This is a condition on influence, not a strict synonym.'
    },
    ecosystem_signal: {
      label: 'Evergreen growth signal',
      simpleDefinition: 'A repeated local pattern that may deepen the graph after review.',
      plainRole: 'This is emerging pattern evidence, not a strict synonym or permanent truth.'
    },
    ecosystem_weather: {
      label: 'Weather context',
      simpleDefinition: 'A temporary search or current context that can frame the graph for the moment.',
      plainRole: 'This can influence the read, but it does not become graph truth by itself.'
    }
  };
  return state.data.graph.nodeTypeDefinitions?.[type] || fallback[type] || {
    label: type,
    simpleDefinition: 'A graph item.',
    plainRole: 'This participates in graph routes.'
  };
}

const CORE_NODE_TYPE_ORDER = ['color', 'shade', 'object', 'emotion', 'word', 'sense'];
const SUPPORT_NODE_TYPE_ORDER = ['theme', 'condition', 'evidence'];
const CORE_NODE_SCHEMA_ORDER = ['base_color_family', 'secondary_color', 'natural_source', 'shade', 'synonym'];
const THEME_NODE_SCHEMA_ORDER = ['condition', 'natural_source', 'association', 'shade', 'synonym'];

const NODE_SCHEMA_DEFS = {
  base_color_family: {
    label: 'Base color family',
    shortLabel: 'base family',
    description: 'A stable root color field such as red, blue, green, yellow, black, or white.',
    computerQuestion: 'What broad color field does this belong to?',
    role: 'Acts as the anchor bucket that branches, shades, sources, and routes can travel through.'
  },
  secondary_color: {
    label: 'Secondary color',
    shortLabel: 'secondary color',
    description: 'A branch under a base color family, often mixed, in-between, or climate-specific.',
    computerQuestion: 'What branch color sits under the family?',
    role: 'Connects a broad family to more precise color behavior and shade language.'
  },
  natural_source: {
    label: 'Natural source',
    shortLabel: 'natural source',
    description: 'A real-world source image such as ocean, pine, clay, ember, or mist that gives color relational meaning.',
    computerQuestion: 'What real source in the world gives this color its felt context?',
    role: 'Supplies atlas pull, environmental memory, and lived context without replacing the color family.'
  },
  shade: {
    label: 'Shade',
    shortLabel: 'shade',
    description: 'A precise color variation or shade phrase that makes the route more exact.',
    computerQuestion: 'What specific color variation is this?',
    role: 'Holds precision. This is where broad family logic becomes a concrete landed color.'
  },
  synonym: {
    label: 'Synonym',
    shortLabel: 'synonym',
    description: 'An alternate wording path that points toward an existing shade, branch, or family.',
    computerQuestion: 'What alternate wording reaches this route?',
    role: 'Gives the computer more language entry points without pretending every synonym is the color itself.'
  },
  association: {
    label: 'Association',
    shortLabel: 'association',
    description: 'A connected contextual concept that helps a route become legible without acting like a base color.',
    computerQuestion: 'What associated concept helps this route make sense?',
    role: 'Adds nearby local truth that supports a read, object path, or world reference.'
  },
  emotion: {
    label: 'Emotion route',
    shortLabel: 'emotion route',
    description: 'A feeling-state node that uses climate logic to reach color rather than direct synonym logic.',
    computerQuestion: 'What feeling path starts here?',
    role: 'Launches emotional translation into the graph.'
  },
  condition: {
    label: 'Condition',
    shortLabel: 'condition',
    description: 'A selector or climate state that changes which routes brighten, quiet down, or become active now.',
    computerQuestion: 'What condition is shaping the read right now?',
    role: 'Weights route activation without rewriting stored graph truth.'
  },
  word: {
    label: 'Word support',
    shortLabel: 'word support',
    description: 'A language-support node that has not yet earned a more specific schema role.',
    computerQuestion: 'What language entry point is this?',
    role: 'Stays available as wording support until context or evidence makes the route more specific.'
  }
};

const SCHEMA_PACK_ROLE_DEFS = {
  color: {
    family: {
      label: 'Base color family',
      description: 'Stable root anchor for the color system.',
      role: 'Acts as the canonical landing family for connected routes.'
    },
    subfamily: {
      label: 'Secondary color',
      description: 'Bridge or branch color inside the base family.',
      role: 'Lets the graph travel through mixed or intermediate climate space.'
    },
    natural_source: {
      label: 'Natural source',
      description: 'Real-world source image that gives color its lived context.',
      role: 'Supplies atlas pull, memory, and source context without replacing color structure.'
    },
    shade: {
      label: 'Shade',
      description: 'Exact visible color expression or landed shade.',
      role: 'Carries precision where broad family logic becomes concrete.'
    },
    synonym: {
      label: 'Synonym',
      description: 'Alternate wording path into an existing color route.',
      role: 'Expands language entry without changing the underlying color truth.'
    },
    association: {
      label: 'Association',
      description: 'Nearby contextual concept attached to the color route.',
      role: 'Adds local support without becoming a base color claim.'
    },
    condition: {
      label: 'Condition',
      description: 'Selector shaping route weighting around the current color read.',
      role: 'Changes which color routes are bright right now without rewriting stored graph truth.'
    },
    emotion: {
      label: 'Emotion route',
      description: 'Feeling-state path that lands in color through climate logic.',
      role: 'Starts an emotional route into the color backbone.'
    },
    word: {
      label: 'Word support',
      description: 'Language entry point waiting for stronger color-route support.',
      role: 'Keeps the graph readable without forcing a false color claim.'
    }
  },
  theme: {
    family: {
      label: 'Climate anchor',
      description: 'Base anchor the theme read can stabilize around.',
      role: 'Acts as the shared climate backbone beneath the visible theme.'
    },
    subfamily: {
      label: 'Condition branch',
      description: 'Intermediate branch where a theme starts leaning a route one way instead of another.',
      role: 'Connects the base climate anchor to a more specific presentation logic.'
    },
    natural_source: {
      label: 'Source image',
      description: 'Real-world image or source object that gives the theme its lived surface.',
      role: 'Supplies the visible world material the theme can be felt through.'
    },
    shade: {
      label: 'Visible expression',
      description: 'Specific visible form the theme takes under current conditions.',
      role: 'Shows how the shared graph is being presented right now.'
    },
    synonym: {
      label: 'Language path',
      description: 'Alternate wording that reaches the same theme-conditioned route.',
      role: 'Lets multiple phrases travel into one active theme read.'
    },
    association: {
      label: 'Nearby effect',
      description: 'Contextual concept changed by the active theme condition.',
      role: 'Shows what the theme is doing to nearby meaning rather than only what the node is by itself.'
    },
    condition: {
      label: 'Theme condition',
      description: 'Filter / cover layer changing what becomes visible or weighted now.',
      role: 'Acts as the selector that reshapes the local cluster read.'
    },
    emotion: {
      label: 'Climate response',
      description: 'Emotional route being pulled by the active theme condition.',
      role: 'Shows the feeling-side response created by the theme-conditioned route.'
    },
    word: {
      label: 'Language signal',
      description: 'A wording signal that may become meaningful under the current theme filter.',
      role: 'Supplies entry language without pretending every signal is already resolved.'
    }
  }
};

const STRUCTURAL_TYPE_DEFS = {
  color: {
    label: 'Color',
    shortLabel: 'color layer',
    description: 'A base climate field the graph can route through, such as red, blue, green, black, or white.',
    storageRole: 'Foundational node',
    computerQuestion: 'What color field is this?',
    relationshipRole: 'Acts as a stable landing surface that shades, objects, words, and emotions can point into.'
  },
  shade: {
    label: 'Shade',
    shortLabel: 'shade layer',
    description: 'A more specific color expression under or between color families, such as scarlet, teal green, or blue-gray.',
    storageRole: 'Specific example node',
    computerQuestion: 'What specific color form is this?',
    relationshipRole: 'Connects broad color families to precise lived color language.'
  },
  object: {
    label: 'Object',
    shortLabel: 'object layer',
    description: 'A concrete thing or referent, such as fire, blood, moss, or snow, that can carry color context.',
    storageRole: 'Context source node',
    computerQuestion: 'What real-world thing is this pointing to?',
    relationshipRole: 'Provides a concrete route from the world into color.'
  },
  emotion: {
    label: 'Emotion',
    shortLabel: 'emotion layer',
    description: 'A feeling state that routes into color through climate logic rather than direct synonym claims.',
    storageRole: 'Translator node',
    computerQuestion: 'What feeling or internal state is this?',
    relationshipRole: 'Starts emotional translation paths that land in climate anchors.'
  },
  word: {
    label: 'Word',
    shortLabel: 'word layer',
    description: 'A language item that can connect, stay unresolved, or help supply route support for other nodes.',
    storageRole: 'Language node',
    computerQuestion: 'What piece of language is this?',
    relationshipRole: 'Carries naming, wording, and lexical variation without pretending every word is a color.'
  },
  sense: {
    label: 'Sense',
    shortLabel: 'sense layer',
    description: 'A sensory cue such as sight, touch, sound, smell, taste, or effects that adds context to meaning.',
    storageRole: 'Texture node',
    computerQuestion: 'What sensed quality helps explain this?',
    relationshipRole: 'Adds sensory context so the graph can explain why a node reacts the way it does.'
  },
  theme: {
    label: 'Theme',
    shortLabel: 'theme condition',
    description: 'A framing condition such as religion, season, friendship, or ritual calendar.',
    storageRole: 'Context condition',
    computerQuestion: 'What framing system is active here?',
    relationshipRole: 'Changes how connections are interpreted without replacing the underlying nodes.'
  },
  condition: {
    label: 'Condition',
    shortLabel: 'ecosystem condition',
    description: 'An active environment such as weather, pressure, depth, fog, or system context that changes salience.',
    storageRole: 'Perception condition',
    computerQuestion: 'What condition is shaping the graph right now?',
    relationshipRole: 'Changes what becomes brighter, quieter, stronger, or more visible in the graph.'
  },
  evidence: {
    label: 'Route Evidence',
    shortLabel: 'evidence layer',
    description: 'A growth signal, cited support, or verification-bearing structure that explains why a route should be trusted.',
    storageRole: 'Verification support',
    computerQuestion: 'Why should this route be believed or reviewed?',
    relationshipRole: 'Adds trust, reviewability, and falsification instead of silent assumption.'
  }
};

function nodeStructureInfo(node) {
  if (!node) {
    return {
      typeId: 'word',
      ...STRUCTURAL_TYPE_DEFS.word,
      migrationHint: 'Unresolved node type.'
    };
  }

  const metadata = node.metadata || {};
  const structure = (() => {
    switch (node.type) {
      case 'family':
        return { typeId: 'color', def: STRUCTURAL_TYPE_DEFS.color };
      case 'alias':
      case 'subfamily':
      case 'shade':
        return { typeId: 'shade', def: STRUCTURAL_TYPE_DEFS.shade };
      case 'common_word':
        return { typeId: 'object', def: STRUCTURAL_TYPE_DEFS.object };
      case 'emotion_word':
        return { typeId: 'emotion', def: STRUCTURAL_TYPE_DEFS.emotion };
      case 'neutral_word':
      case 'synonym':
        return { typeId: 'word', def: STRUCTURAL_TYPE_DEFS.word };
      case 'theme_condition':
        return { typeId: 'theme', def: STRUCTURAL_TYPE_DEFS.theme };
      case 'environment_condition':
      case 'ecosystem_foundation':
      case 'ecosystem_weather':
        return { typeId: 'condition', def: STRUCTURAL_TYPE_DEFS.condition };
      case 'environment_term':
        return { typeId: 'sense', def: STRUCTURAL_TYPE_DEFS.sense };
      case 'ecosystem_signal':
        return { typeId: 'evidence', def: STRUCTURAL_TYPE_DEFS.evidence };
      default:
        return { typeId: 'word', def: STRUCTURAL_TYPE_DEFS.word };
    }
  })();

  const migrationHint = ({
    family: 'Keep this as a stable color node. Let the path create context around it instead of turning it into every connected concept.',
    alias: 'Treat this as a specific shade expression under a color family, not as a competing parent category.',
    subfamily: 'Treat this as a bridge shade between families so the computer can travel through mixed climate space.',
    shade: 'Treat this as a definition-backed shade phrase that clarifies how color language leans.',
    common_word: 'Treat this as an object or referent that points toward color through association, not as a second color family.',
    emotion_word: 'Treat this as an emotion route starter that lands in color through climate logic.',
    neutral_word: 'Keep this as language until context earns a stronger route.',
    synonym: 'Use this as wording support and evidence-backed travel between terms, not as a replacement for the underlying color node.',
    theme_condition: 'Treat this as a filter or condition that changes interpretation weight across the graph.',
    environment_condition: 'Treat this as a live condition that changes salience and climate read across connected nodes.',
    environment_term: 'Treat this as sensed condition language that gives texture to climate, not as a base family.',
    ecosystem_foundation: 'Treat this as slow-moving system context that shapes the whole graph.',
    ecosystem_weather: 'Treat this as temporary weather that can foreground a route without rewriting the base graph.',
    ecosystem_signal: 'Treat this as growth evidence that can deepen the graph after review instead of automatically rewriting truth.'
  })[node.type] || 'Use this node type to answer what the node is before asking how it connects.';

  return {
    typeId: structure.typeId,
    ...structure.def,
    currentNodeType: node.type,
    verificationStatus: 'route-based',
    faceCount: 0,
    migrationHint
  };
}

function nodeAtlasText(node) {
  return [
    node?.label,
    node?.metadata?.definition,
    node?.metadata?.definitionPhrase,
    node?.metadata?.naturalNameBasis,
    node?.metadata?.contextDefinition,
    node?.metadata?.associationBasis
  ].filter(Boolean).join(' ').toLowerCase();
}

function nodeNaturalSourceGroups(node) {
  const text = nodeAtlasText(node);
  if (!text) return [];
  return naturalSourceGroups().filter(group => group.terms.some(term => text.includes(term.toLowerCase())));
}

function nodeSupportsNaturalSourceSchema(node) {
  if (!node) return false;
  if (!['common_word', 'alias', 'shade', 'environment_term', 'neutral_word', 'synonym'].includes(node.type)) return false;
  return nodeNaturalSourceGroups(node).length > 0;
}

function familyNodeByFamily(family) {
  if (!family) return null;
  return state.nodes.find(node => node.type === 'family' && nodeColorKey(node) === family) || null;
}

function nodeSchemaInfo(node) {
  if (!node) return { id: 'word', ...NODE_SCHEMA_DEFS.word };
  if (node.type === 'family') return { id: 'base_color_family', ...NODE_SCHEMA_DEFS.base_color_family };
  if (node.type === 'subfamily') return { id: 'secondary_color', ...NODE_SCHEMA_DEFS.secondary_color };
  if (nodeSupportsNaturalSourceSchema(node)) return { id: 'natural_source', ...NODE_SCHEMA_DEFS.natural_source };
  if (node.type === 'alias' || node.type === 'shade') return { id: 'shade', ...NODE_SCHEMA_DEFS.shade };
  if (node.type === 'synonym') return { id: 'synonym', ...NODE_SCHEMA_DEFS.synonym };
  if (node.type === 'emotion_word') return { id: 'emotion', ...NODE_SCHEMA_DEFS.emotion };
  if (['theme_condition', 'environment_condition', 'environment_term', 'ecosystem_foundation', 'ecosystem_weather', 'ecosystem_signal'].includes(node.type)) {
    return { id: 'condition', ...NODE_SCHEMA_DEFS.condition };
  }
  if (node.type === 'common_word') return { id: 'association', ...NODE_SCHEMA_DEFS.association };
  return { id: 'word', ...NODE_SCHEMA_DEFS.word };
}

function schemaPackDefinition(packId = state.activeSchemaPackId) {
  return SCHEMA_PACK_DEFS[packId] || SCHEMA_PACK_DEFS.color;
}

function availableSchemaPacksForNode(node) {
  if (!node) return [SCHEMA_PACK_DEFS.color];
  const packs = [SCHEMA_PACK_DEFS.color];
  const themeEligible = [
    'theme_condition',
    'environment_condition',
    'environment_term',
    'common_word',
    'neutral_word',
    'emotion_word',
    'family',
    'subfamily',
    'alias',
    'shade',
    'synonym'
  ].includes(node.type);
  if (themeEligible) packs.push(SCHEMA_PACK_DEFS.theme);
  return packs;
}

function resolvedSchemaPackId(node) {
  const available = new Set(availableSchemaPacksForNode(node).map(pack => pack.id));
  return available.has(state.activeSchemaPackId) ? state.activeSchemaPackId : 'color';
}

function schemaPackRoleKey(node, schema) {
  if (!node) return 'word';
  if (schema?.id === 'natural_source') return 'natural_source';
  if (schema?.id === 'emotion') return 'emotion';
  if (schema?.id === 'condition') return 'condition';
  if (schema?.id === 'association') return 'association';
  if (schema?.id === 'synonym') return 'synonym';
  if (schema?.id === 'shade') return 'shade';
  if (schema?.id === 'secondary_color') return 'subfamily';
  if (schema?.id === 'base_color_family') return 'family';
  return 'word';
}

function schemaPackRoleInfo(node, packId = state.activeSchemaPackId) {
  const schema = nodeSchemaInfo(node);
  const roleKey = schemaPackRoleKey(node, schema);
  const pack = schemaPackDefinition(packId);
  const role = SCHEMA_PACK_ROLE_DEFS[pack.id]?.[roleKey] || SCHEMA_PACK_ROLE_DEFS.color.word;
  return {
    pack,
    roleKey,
    label: role.label,
    description: role.description,
    role: role.role,
    schemaId: schema.id
  };
}

function schemaPackSectionLabels(packId = state.activeSchemaPackId) {
  if (packId === 'theme') {
    return {
      parent: 'Upstream anchors',
      children: 'Downstream expressions',
      naturalSources: 'Source images',
      synonyms: 'Language paths',
      associations: 'Nearby effects'
    };
  }
  return {
    parent: 'Parent',
    children: 'Children',
    naturalSources: 'Natural sources',
    synonyms: 'Synonyms',
    associations: 'Associations'
  };
}

function nodeSchemaParentNodes(node, schema) {
  const neighbors = uniqueNodes([
    ...incoming(node.id).map(edge => state.nodeById.get(edge.source)),
    ...outgoing(node.id).map(edge => state.nodeById.get(edge.target))
  ].filter(Boolean));
  const familyNode = familyNodeByFamily(nodeColorKey(node));

  if (schema.id === 'secondary_color') {
    const parentFamilies = bridgeParentsForNode(node);
    const parentNodes = uniqueNodes(parentFamilies
      .map(parent => familyNodeByFamily(parent))
      .filter(Boolean));
    if (parentNodes.length) return parentNodes.slice(0, 2);
    return familyNode ? [familyNode] : [];
  }
  if (schema.id === 'shade') {
    const parents = neighbors.filter(entry => ['subfamily', 'family'].includes(entry.type));
    if (parents.length) return parents.slice(0, 3);
    return familyNode ? [familyNode] : [];
  }
  if (schema.id === 'synonym') {
    const parents = neighbors.filter(entry => ['alias', 'shade', 'subfamily', 'family'].includes(entry.type));
    return parents.slice(0, 4);
  }
  if (schema.id === 'natural_source') {
    const parents = neighbors.filter(entry => ['family', 'subfamily', 'alias', 'shade'].includes(entry.type));
    return parents.slice(0, 4);
  }
  return [];
}

function nodeSchemaChildNodes(node, schema) {
  if (schema.id === 'base_color_family') {
    return state.nodes
      .filter(entry => {
        if (entry.type !== 'subfamily') return false;
        const bridgeParents = bridgeParentsForNode(entry);
        if (bridgeParents.length) return bridgeParents.includes(nodeColorKey(node));
        return nodeColorKey(entry) === nodeColorKey(node);
      })
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 6);
  }
  if (schema.id === 'secondary_color') {
    return uniqueNodes([
      ...outgoing(node.id).map(edge => state.nodeById.get(edge.target)),
      ...incoming(node.id).map(edge => state.nodeById.get(edge.source))
    ].filter(entry => entry && ['alias', 'shade', 'synonym'].includes(entry.type)))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 6);
  }
  if (schema.id === 'shade') {
    return uniqueNodes([
      ...outgoing(node.id).map(edge => state.nodeById.get(edge.target)),
      ...incoming(node.id).map(edge => state.nodeById.get(edge.source))
    ].filter(entry => entry && entry.type === 'synonym'))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 6);
  }
  return [];
}

function nodeSchemaNaturalSourceNodes(node) {
  const direct = uniqueNodes([
    ...outgoing(node.id).map(edge => state.nodeById.get(edge.target)),
    ...incoming(node.id).map(edge => state.nodeById.get(edge.source))
  ].filter(entry => entry && nodeSupportsNaturalSourceSchema(entry)));

  if (direct.length) return direct.slice(0, 6);

  const ownGroups = nodeNaturalSourceGroups(node);
  if (!ownGroups.length) return [];
  const ownIds = new Set(ownGroups.map(group => group.id));
  return state.nodes
    .filter(entry => entry.id !== node.id && nodeSupportsNaturalSourceSchema(entry))
    .filter(entry => nodeNaturalSourceGroups(entry).some(group => ownIds.has(group.id)))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 6);
}

function nodeSchemaSynonymNodes(node) {
  return uniqueNodes([
    ...outgoing(node.id).map(edge => state.nodeById.get(edge.target)),
    ...incoming(node.id).map(edge => state.nodeById.get(edge.source))
  ].filter(entry => entry && entry.type === 'synonym'))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 6);
}

function nodeSchemaAssociationNodes(node) {
  return uniqueNodes([
    ...outgoing(node.id).map(edge => state.nodeById.get(edge.target)),
    ...incoming(node.id).map(edge => state.nodeById.get(edge.source))
  ].filter(entry => entry && ['common_word', 'emotion_word', 'environment_term', 'environment_condition', 'neutral_word'].includes(entry.type)))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 6);
}

function nodeSchemaBundle(node) {
  const schema = nodeSchemaInfo(node);
  const parents = nodeSchemaParentNodes(node, schema);
  const children = nodeSchemaChildNodes(node, schema);
  const naturalSources = schema.id === 'natural_source' ? uniqueNodes([node, ...nodeSchemaNaturalSourceNodes(node)]).slice(0, 6) : nodeSchemaNaturalSourceNodes(node);
  const synonyms = schema.id === 'synonym' ? uniqueNodes([node, ...nodeSchemaSynonymNodes(node)]).slice(0, 6) : nodeSchemaSynonymNodes(node);
  const associations = nodeSchemaAssociationNodes(node).filter(entry => !synonyms.some(syn => syn.id === entry.id) && !naturalSources.some(source => source.id === entry.id));
  return {
    schema,
    parents,
    children,
    naturalSources,
    synonyms,
    associations
  };
}

function structuralTypeCountMap() {
  const counts = new Map();
  Object.keys(STRUCTURAL_TYPE_DEFS).forEach(key => counts.set(key, 0));
  state.nodes.forEach(node => {
    const info = nodeStructureInfo(node);
    counts.set(info.typeId, (counts.get(info.typeId) || 0) + 1);
  });
  return counts;
}

function sampleNodesForStructuralType(typeId, limit = 5) {
  return state.nodes
    .filter(node => nodeStructureInfo(node).typeId === typeId)
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, limit);
}

function renderStructuralTypeCard(typeId) {
  const def = STRUCTURAL_TYPE_DEFS[typeId];
  const count = structuralTypeCountMap().get(typeId) || 0;
  const examples = sampleNodesForStructuralType(typeId);
  return `
    <article class="architecture-card">
      <div class="architecture-card-head">
        <strong>${escapeHtml(def.label)}</strong>
        <span>${count}</span>
      </div>
      <p>${escapeHtml(def.description)}</p>
      <small><strong>Computer asks:</strong> ${escapeHtml(def.computerQuestion)}</small>
      <small><strong>Role:</strong> ${escapeHtml(def.relationshipRole)}</small>
      ${examples.length ? `<div class="chip-list">${examples.map(node => `<button class="chip chip-button" type="button" data-node-id="${escapeHtml(node.id)}">${escapeHtml(node.label)}</button>`).join('')}</div>` : '<small>Nothing is stored here yet.</small>'}
    </article>
  `;
}

function renderTypeArchitectureList() {
  const counts = structuralTypeCountMap();
  const coreCount = CORE_NODE_TYPE_ORDER.reduce((sum, key) => sum + (counts.get(key) || 0), 0);
  const supportCount = SUPPORT_NODE_TYPE_ORDER.reduce((sum, key) => sum + (counts.get(key) || 0), 0);
  const schemaPackCards = Object.values(SCHEMA_PACK_DEFS).map(pack => `
    <article class="architecture-card">
      <div class="architecture-card-head">
        <strong>${escapeHtml(pack.label)}</strong>
        <span>${escapeHtml(pack.shortLabel)}</span>
      </div>
      <p>${escapeHtml(pack.description)}</p>
      <small><strong>Trace rule:</strong> ${escapeHtml(pack.traceRule)}</small>
      <small><strong>Condition rule:</strong> ${escapeHtml(pack.conditionVocabulary)}</small>
      <small><strong>Reasoning:</strong> ${escapeHtml(pack.reasoning)}</small>
    </article>
  `).join('');
  els.list.innerHTML = `
    <section class="type-architecture">
      <div class="theme-filter-summary">
        <strong>Type architecture</strong>
        <span>Before the graph asks how something connects, the computer needs to know what kind of thing it is.</span>
      </div>
      <div class="shared-graph-review">
        <strong>Computer path</strong>
        <span>Node -> Type -> Context -> Relationships -> Verification. The graph is shared; the language changes the read.</span>
      </div>
      <section class="architecture-section">
        <h3>Schema packs</h3>
        <p class="meta">Schema packs let the same stored graph be read through different concept languages without duplicating graph truth.</p>
        <div class="architecture-grid">
          ${schemaPackCards}
        </div>
      </section>
      <section class="architecture-section">
        <h3>Core node types</h3>
        <p class="meta">These are the main species in the forest. Right now the graph has ${coreCount} nodes living in the six core buckets.</p>
        <div class="architecture-grid">
          ${CORE_NODE_TYPE_ORDER.map(renderStructuralTypeCard).join('')}
        </div>
      </section>
      <section class="architecture-section">
        <h3>Support and condition roles</h3>
        <p class="meta">These are not the whole forest. They change context, verification, and salience.</p>
        <div class="architecture-grid">
          ${SUPPORT_NODE_TYPE_ORDER.map(renderStructuralTypeCard).join('')}
        </div>
      </section>
      <section class="architecture-section">
        <h3>Node schema ladder</h3>
        <p class="meta">This is the current pack-ready ladder. Color remains canonical, and theme can read the same local structure through a different vocabulary.</p>
        <div class="architecture-note">
          <strong>Base color family -> Secondary color -> Shade -> Synonym</strong>
          <p>Natural source does not always sit under one branch like a child. It can connect across the family, branch, or shade level because it supplies real-world source context.</p>
        </div>
        <div class="architecture-grid">
          ${CORE_NODE_SCHEMA_ORDER.map(renderNodeSchemaSummaryCard).join('')}
        </div>
        <div class="architecture-note">
          <strong>Theme pack read</strong>
          <p>Condition -> Source image -> Nearby effect -> Visible expression -> Language path. Same network, different readable lens.</p>
        </div>
        <div class="architecture-grid">
          ${THEME_NODE_SCHEMA_ORDER.map(renderNodeSchemaSummaryCard).join('')}
        </div>
      </section>
      <section class="architecture-section">
        <h3>Why this reduces clutter</h3>
        <div class="architecture-note">
          <strong>When leaves act like trees, the graph feels crowded.</strong>
          <p>If a node is really a shade, object, condition, or evidence support, naming that role lets the computer travel through the path more cleanly.</p>
          <ul class="architecture-list">
            <li><code>Red</code> can stay a color field.</li>
            <li><code>Scarlet</code> can stay a shade under that field.</li>
            <li><code>Fire</code> can act like an object that points into red.</li>
            <li><code>Warm</code> can act like a condition or sensed quality.</li>
            <li><code>Fear</code> can act like an emotion route starter.</li>
            <li><code>Evidence</code> can explain why a route should be trusted.</li>
          </ul>
        </div>
      </section>
    </section>
  `;

  els.list.querySelectorAll('[data-node-id]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedId = button.dataset.nodeId;
      render();
    });
  });
}

function renderNodeSchemaSummaryCard(schemaId) {
  const def = NODE_SCHEMA_DEFS[schemaId];
  return `
    <article class="architecture-card">
      <div class="architecture-card-head">
        <strong>${escapeHtml(def.label)}</strong>
        <span>${escapeHtml(def.shortLabel)}</span>
      </div>
      <p>${escapeHtml(def.description)}</p>
      <small><strong>Computer asks:</strong> ${escapeHtml(def.computerQuestion)}</small>
      <small><strong>Role:</strong> ${escapeHtml(def.role)}</small>
    </article>
  `;
}

function renderNodeSchemaList(title, nodes, emptyText) {
  if (!nodes.length) {
    return `<p class="meta">${escapeHtml(emptyText)}</p>`;
  }
  return `
    <div class="chip-list">
      ${nodes.map(item => `<button class="chip chip-button" type="button" onclick="selectNode('${item.id}')">${escapeHtml(item.label)}</button>`).join('')}
    </div>
  `;
}

function renderNodeSchemaSection(node, cluster) {
  const bundle = nodeSchemaBundle(node);
  const activePackId = cluster?.activeSchemaPack?.id || resolvedSchemaPackId(node);
  const labels = schemaPackSectionLabels(activePackId);
  const roleInfo = schemaPackRoleInfo(node, activePackId);
  const heading = activePackId === 'theme' ? 'Node Language Role' : 'Node Schema';
  const roleInGraph = activePackId === 'theme'
    ? 'This is how the selected node behaves when the shared graph is being read through a theme-conditioned lens.'
    : 'This is how the selected node behaves inside the shared color backbone.';
  return `
    <section class="detail-section">
      <h3>${escapeHtml(heading)}</h3>
      <p class="meta"><strong>Node schema role:</strong> ${escapeHtml(bundle.schema.label)}. ${escapeHtml(bundle.schema.description)}</p>
      <p class="meta"><strong>${escapeHtml(cluster?.activeSchemaPack?.label || 'Color')} pack role:</strong> ${escapeHtml(roleInfo.label)}. ${escapeHtml(roleInfo.description)}</p>
      <p class="meta"><strong>Computer asks:</strong> ${escapeHtml(bundle.schema.computerQuestion)}</p>
      <p class="meta"><strong>Role in the graph:</strong> ${escapeHtml(roleInGraph)}</p>
      <p class="meta"><strong>Schema reasoning:</strong> ${escapeHtml(roleInfo.role)}</p>
      <div class="schema-grid">
        <div class="schema-card">
          <strong>${escapeHtml(labels.parent)}</strong>
          ${renderNodeSchemaList(labels.parent, bundle.parents, activePackId === 'theme' ? 'No stronger upstream anchor is being surfaced for this theme read right now.' : 'This node is acting without a stronger parent bucket right now.')}
        </div>
        <div class="schema-card">
          <strong>${escapeHtml(labels.children)}</strong>
          ${renderNodeSchemaList(labels.children, bundle.children, activePackId === 'theme' ? 'No downstream expression is being surfaced for this node right now.' : 'No child branch is being surfaced for this node right now.')}
        </div>
        <div class="schema-card">
          <strong>${escapeHtml(labels.naturalSources)}</strong>
          ${renderNodeSchemaList(labels.naturalSources, bundle.naturalSources, activePackId === 'theme' ? 'No source-image context is being surfaced for this node yet.' : 'No natural-source context is being surfaced for this node yet.')}
        </div>
        <div class="schema-card">
          <strong>${escapeHtml(labels.synonyms)}</strong>
          ${renderNodeSchemaList(labels.synonyms, bundle.synonyms, activePackId === 'theme' ? 'No alternate language path is attached nearby right now.' : 'No synonym support is attached nearby right now.')}
        </div>
        <div class="schema-card">
          <strong>${escapeHtml(labels.associations)}</strong>
          ${renderNodeSchemaList(labels.associations, bundle.associations, activePackId === 'theme' ? 'No nearby effect is being surfaced for this node right now.' : 'No direct association support is being surfaced for this node right now.')}
        </div>
      </div>
    </section>
  `;
}

function renderWaterConditionSection(cluster, node) {
  const activeRouteCount = cluster?.activeRouteCount || 0;
  const activeSourceText = cluster?.activationSources?.length
    ? cluster.activationSources.join(' + ')
    : 'current context';
  const nodeLabel = node?.label || 'this node';
  return `
    <section class="detail-section">
      <h3>Three Dimensional W.A.T.E.R</h3>
      <p class="meta"><strong>Movement rule:</strong> W.A.T.E.R is how new experience enters stored routes and changes influence. Movement can travel horizontally, vertically, or diagonally depending on which stored paths current conditions activate.</p>
      <p class="meta"><strong>Runtime read:</strong> ${escapeHtml(nodeLabel)} currently has ${activeRouteCount} active route${activeRouteCount === 1 ? '' : 's'} being weighted by ${escapeHtml(activeSourceText)}.</p>
      <div class="schema-grid">
        <div class="schema-card">
          <strong>W = Words</strong>
          <p>Entered language is the first water entering the graph. Words are how new experience reaches stored nodes and routes.</p>
        </div>
        <div class="schema-card">
          <strong>A = Altered</strong>
          <p>Once words enter context, route weight can change. Condition sources alter which stored paths matter now.</p>
        </div>
        <div class="schema-card">
          <strong>T = Together</strong>
          <p>Meaning does not come from one label alone. Nearby routes work together and form a local activation bundle.</p>
        </div>
        <div class="schema-card">
          <strong>E = Entering</strong>
          <p>Each repeated entry adds local gravity. Re-entry increases influence and makes nearby routes easier to activate again.</p>
        </div>
        <div class="schema-card">
          <strong>R = Reuse</strong>
          <p>Reused weighted routes become recognizable behavior. Repeated reuse is what eventually starts to look like pattern.</p>
        </div>
      </div>
      <p class="meta"><strong>Boundary:</strong> W.A.T.E.R changes runtime movement, route emphasis, and influence accumulation. It does not silently rewrite stored graph truth by itself.</p>
    </section>
  `;
}

window.selectNode = id => {
  state.selectedId = id;
  render();
};

function drawGraph() {
  const using3d = state.graphMode === '3d';
  els.canvas.classList.remove('is-hidden');
  if (!using3d) els.canvas.style.height = '';
  els.threeGraph?.classList.remove('is-active');
  els.threeGraph?.setAttribute('aria-hidden', 'true');
  if (using3d) {
    stopThreeAnimation();
    drawThreeCanvasGraph();
    return;
  }
  stopThreeAnimation();

  const rect = els.canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  els.canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  els.canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (state.view === 'word-storage') {
    drawWordStorageParetoChart(rect.width, rect.height);
    return;
  }

  const profile = state.perception.profile = currentPerceptionProfile();
  const visibleNodeIds = state.perception.visibleNodeIds = neighborhood(state.selectedId, profile);
  const visibleEdges = state.perception.visibleEdges = visibleGraphEdges(visibleNodeIds, profile);
  const runtimePositions = influencedPositionMap(visibleNodeIds);
  ctx.save();
  applyGraphViewTransform();
  drawConditionTerritories(runtimePositions, visibleNodeIds, profile, false);

  if (state.graphMode === 'scatter') {
    drawScatterGuides(rect.width, rect.height, visibleNodeIds);
  } else {
    drawSpiderGuides(rect.width, rect.height);
  }
  drawRouteSideGuides(rect.width, rect.height);
  visibleEdges.forEach(edge => drawEdge(edge));
  [...visibleNodeIds].forEach(id => drawNode(state.nodeById.get(id)));
  ctx.restore();
  if (els.graphHint) {
    const hints = {
      ring: 'Squares are base colors, pills are bridge colors between base anchors, and diamonds are exact shade phrases. Drag nodes to rearrange the web. Use +, -, or your mouse wheel to zoom.',
      topology: 'Graph theory view: closer nodes have shorter paths, larger nodes are higher-degree hubs, and clusters group by base color or type. Use +, -, or your mouse wheel to zoom.',
      scatter: 'Connected scatter plot: x shows degree centrality, y shows path distance from the selected node, and lines keep the relational routes visible. Use +, -, or your mouse wheel to zoom.',
      '3d': '3D color web: base colors stay fixed as anchors, bridge colors sit between their two strongest parents, and shades inherit through those paths. Y now measures degree of differentiation from black field to white. The graph measures influence, not meaning. Use axis view to look through X, Y, or Z; drag for a custom view; click a sphere to inspect it.'
    };
    const conditionCount = profile.activeConditionIds.size;
    const themeShiftCount = [...visibleNodeIds].filter(id => displayShadePositionForNode(state.nodeById.get(id))?.themeCondition).length;
    const routeFilterText = state.currentTranslation?.allPaths?.length
      ? ` Route clarity is showing ${Object.entries(state.routeHealthFilters).filter(([, active]) => active).map(([key]) => key).join(', ') || 'nothing'} routes.`
      : '';
    els.graphHint.textContent = `${hints[state.graphMode] || hints.ring} Current perception is foregrounding ${conditionCount || 'the baseline'} condition${conditionCount === 1 ? '' : 's'}, so active routes stay bright while quieter routes remain in the background.${themeShiftCount ? ` ${themeShiftCount} visible node${themeShiftCount === 1 ? '' : 's'} currently carry theme-conditioned position pull.` : ''}${routeFilterText}`;
  }
}

function wordStorageParetoItems(limit = 14) {
  return [...(state.wordStorage.records || [])]
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
}

function drawWordStorageParetoChart(width, height) {
  const items = wordStorageParetoItems();
  const total = Math.max(0, state.wordStorage.totalWords || 0);
  state.perception.wordStorageTargets = [];

  ctx.save();
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, width, height);

  if (!total || !items.length) {
    ctx.fillStyle = 'rgba(32, 37, 43, 0.9)';
    ctx.font = '700 24px Inter, sans-serif';
    ctx.fillText('Word storage Pareto chart', 36, 56);
    ctx.fillStyle = 'rgba(104, 112, 122, 0.94)';
    ctx.font = '15px Inter, sans-serif';
    ctx.fillText('Paste text into the Word counter, then press Count words.', 36, 94);
    ctx.fillText('The display will sort words by frequency and show the cumulative share of the text.', 36, 120);
    ctx.restore();
    if (els.graphHint) {
      els.graphHint.textContent = 'Word storage display: once text is counted, the canvas becomes a Pareto chart of the resolved words and their cumulative share.';
    }
    return;
  }

  const padding = {
    top: 96,
    right: 150,
    bottom: 215,
    left: 118
  };
  const chartWidth = Math.max(220, (width - padding.left - padding.right) * 0.82);
  const chartHeight = Math.max(190, (height - padding.top - padding.bottom) * 0.76);
  const maxCount = Math.max(...items.map(item => item.count), 1);
  const slotWidth = chartWidth / items.length;
  const barWidth = Math.min(42, slotWidth * 0.58);
  const baseX = padding.left + ((width - padding.left - padding.right) - chartWidth) / 2;
  const baseY = padding.top + ((height - padding.top - padding.bottom) - chartHeight) / 2 + chartHeight;

  ctx.fillStyle = 'rgba(32, 37, 43, 0.92)';
  ctx.font = '700 22px Inter, sans-serif';
  ctx.fillText('Word storage Pareto chart', 36, 46);
  ctx.fillStyle = 'rgba(104, 112, 122, 0.92)';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText(`${total} total words · ${state.wordStorage.distinctWords || items.length} distinct · top ${items.length} shown`, 36, 68);

  ctx.strokeStyle = 'rgba(216, 210, 200, 0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let step = 0; step <= 4; step += 1) {
    const y = padding.top + (chartHeight * step) / 4;
    ctx.moveTo(baseX, y);
    ctx.lineTo(baseX + chartWidth, y);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(74, 82, 92, 0.9)';
  ctx.beginPath();
  ctx.moveTo(baseX, padding.top);
  ctx.lineTo(baseX, baseY);
  ctx.lineTo(baseX + chartWidth, baseY);
  ctx.stroke();

  ctx.fillStyle = 'rgba(74, 82, 92, 0.9)';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let step = 0; step <= 4; step += 1) {
    const value = Math.round(maxCount - (maxCount * step) / 4);
    const y = padding.top + (chartHeight * step) / 4;
    ctx.fillText(String(value), baseX - 10, y);
  }

  ctx.textAlign = 'left';
  const rightX = baseX + chartWidth + 10;
  for (let step = 0; step <= 4; step += 1) {
    const value = 100 - step * 25;
    const y = padding.top + (chartHeight * step) / 4;
    ctx.fillText(`${value}%`, rightX, y);
  }

  let cumulativeCount = 0;
  const linePoints = [];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  items.forEach((item, index) => {
    const slotCenter = baseX + slotWidth * index + slotWidth / 2;
    const barHeight = (item.count / maxCount) * chartHeight;
    const x = slotCenter - barWidth / 2;
    const y = baseY - barHeight;
    const resolvedColor = familyColor(item.family || 'neutral');
    const isSelected = item.nodeId && item.nodeId === state.selectedId;

    ctx.fillStyle = resolvedColor;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = isSelected ? 'rgba(32, 37, 43, 0.92)' : 'rgba(32, 37, 43, 0.12)';
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.strokeRect(x, y, barWidth, barHeight);

    state.perception.wordStorageTargets.push({
      x,
      y,
      width: barWidth,
      height: barHeight,
      nodeId: item.nodeId || null,
      term: item.term
    });

    ctx.fillStyle = 'rgba(32, 37, 43, 0.92)';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.fillText(String(item.count), slotCenter, y - 8);

    cumulativeCount += item.count;
    const cumulativePercent = total ? cumulativeCount / total : 0;
    const lineY = baseY - cumulativePercent * chartHeight;
    linePoints.push({ x: slotCenter, y: lineY, percent: cumulativePercent });

    const label = item.term.length > 14 ? `${item.term.slice(0, 12)}…` : item.term;
    ctx.save();
    ctx.translate(slotCenter, baseY + 14);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = 'rgba(32, 37, 43, 0.92)';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label, 0, 0);
    ctx.restore();

    ctx.fillStyle = 'rgba(104, 112, 122, 0.85)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.storageLabel || familyStorageLabel(item.family || 'neutral'), slotCenter, baseY + 52);
  });

  if (linePoints.length) {
    ctx.strokeStyle = '#1f5fa7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    linePoints.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    linePoints.forEach(point => {
      ctx.fillStyle = '#1f5fa7';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
    });

    const finalPoint = linePoints[linePoints.length - 1];
    ctx.fillStyle = '#1f5fa7';
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(finalPoint.percent * 100)}% shown`, Math.min(baseX + chartWidth - 16, finalPoint.x + 10), finalPoint.y - 10);
  }

  ctx.fillStyle = 'rgba(104, 112, 122, 0.88)';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Bars = raw count', 36, height - 28);
  ctx.fillText('Blue line = cumulative percent of total text', 160, height - 28);
  ctx.restore();

  if (els.graphHint) {
    const topWord = items[0];
    const unresolvedCount = (state.wordStorage.unresolved || []).reduce((sum, item) => sum + item.count, 0);
    els.graphHint.textContent = `Word storage display: Pareto chart of counted words. Bars show raw count, the blue line shows cumulative share, and each bar keeps the color storage it resolved into. Current highest word: ${topWord.term} (${topWord.count}).${unresolvedCount ? ` ${unresolvedCount} words are still unresolved and stay outside the color buckets.` : ''}`;
  }
}

function drawThreeCanvasGraph() {
  const rect = els.canvas.getBoundingClientRect();
  const visibleHeight = Math.max(420, Math.min(rect.height || 620, window.innerHeight - rect.top - 22));
  els.canvas.style.height = `${visibleHeight}px`;
  const sizedRect = els.canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  els.canvas.width = Math.max(1, Math.floor(sizedRect.width * ratio));
  els.canvas.height = Math.max(1, Math.floor(sizedRect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, sizedRect.width, sizedRect.height);
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, sizedRect.width, sizedRect.height);
  drawThreeAxes(sizedRect.width, sizedRect.height);

  const profile = state.perception.profile = currentPerceptionProfile();
  const visibleNodeIds = [...neighborhood(state.selectedId, profile)].filter(id => state.nodeById.has(id));
  const visibleSet = new Set(visibleNodeIds);
  state.perception.visibleNodeIds = visibleSet;
  const distances = graphDistances(state.selectedId, visibleSet);
  const positions = threeCanvasPositions(visibleNodeIds, distances, sizedRect.width, sizedRect.height);
  state.three.projected = positions;
  drawConditionTerritories(positions, visibleSet, profile, true);
  drawThreeRouteSideGuides(positions, sizedRect.width, sizedRect.height);

  const visibleEdges = state.perception.visibleEdges = visibleGraphEdges(new Set(visibleNodeIds), profile);
  visibleEdges.forEach(edge => drawThreeCanvasEdge(edge, positions, profile));
  [...positions.entries()]
    .sort(([, a], [, b]) => a.depth - b.depth)
    .forEach(([id, pos]) => drawThreeCanvasNode(state.nodeById.get(id), pos, id === state.selectedId, profile));

  if (els.graphHint) {
    const conditionCount = profile.activeConditionIds.size;
    const themeShifted = visibleNodeIds.filter(id => displayShadePositionForNode(state.nodeById.get(id))?.themeCondition).length;
    const atlasInfluenced = visibleNodeIds.filter(id => atlasInfluenceForNode(state.nodeById.get(id))).length;
    const routeFilterText = state.currentTranslation?.allPaths?.length
      ? ` Route clarity is showing ${Object.entries(state.routeHealthFilters).filter(([, active]) => active).map(([key]) => key).join(', ') || 'nothing'} routes.`
      : '';
      els.graphHint.textContent = `3D color web: base colors stay fixed as anchors, bridge colors sit between the two strongest parent colors, and shades inherit their baseline through that base-or-bridge path. Y is degree of differentiation: black is the abstract field at 0, gray is partial differentiation, bridge colors hold multiple influences, primary colors act as stable attractors, and white sits at maximum revealed structure. This system measures influence, not meaning. Theme conditions and atlas-linked sources can still temporarily pull the live positions without rewriting the stored backbone. ${conditionCount ? `${conditionCount} active condition${conditionCount === 1 ? '' : 's'} are currently weighting the graph.` : 'No extra condition filters are active, so the stored bridge-distance baseline is showing.'} ${themeShifted ? `${themeShifted} visible node${themeShifted === 1 ? '' : 's'} currently carry theme-conditioned pull.` : 'No visible nodes currently carry theme-conditioned pull.'} ${atlasInfluenced ? `${atlasInfluenced} visible node${atlasInfluenced === 1 ? '' : 's'} currently carry atlas influence.` : 'No visible nodes currently carry atlas influence.'}${routeFilterText}`;
  }
}

function threeCanvasPositions(ids, distances, width, height) {
  const map = new Map();
  const scaleBase = Math.min(width, height) / 390;
  const yMid = (SHADE_AXIS_POLARITIES.y.min + SHADE_AXIS_POLARITIES.y.max) / 2;

  ids.forEach(id => {
    const node = state.nodeById.get(id);
    const color = colorForNode(node) || parseColorInput(familyColor(nodeColorKey(node)));
    const shade = displayShadePositionForNode(node)?.position || baselinePlacementForNode(node)?.position || shadePosition(color, environmentFamiliesForNode(node) || []);
    const x0 = shade.x * 2.2;
    const y0 = (shade.y - yMid) * 1.55;
    const z0 = shade.z * 1.55;
    const projected = projectThreePoint(x0, y0, z0, width, height, scaleBase);
    const radius = (id === state.selectedId ? 15 : node.type === 'family' ? 12 : node.type === 'subfamily' ? 10 : node.type === 'emotion_word' ? 8 : 6) * projected.perspective;
    map.set(id, {
      x: projected.x,
      y: projected.y,
      z: projected.z,
      depth: projected.z,
      radius: clamp(radius, 4, 20),
      color,
      shade,
      perspective: projected.perspective
    });
  });
  return map;
}

function projectThreePoint(x0, y0, z0, width, height, scaleBase = Math.min(width, height) / 390) {
  const centerX = width / 2;
  const centerY = height / 2;
  const cameraDistance = 520;
  let x1;
  let y1;
  let z2;
  if (window.THREE?.Vector3 && window.THREE?.Euler) {
    const vector = new window.THREE.Vector3(x0, y0, z0);
    vector.applyEuler(new window.THREE.Euler(state.three.rotation.x, state.three.rotation.y, 0, 'XYZ'));
    x1 = vector.x;
    y1 = vector.y;
    z2 = vector.z;
  } else {
    const cosY = Math.cos(state.three.rotation.y);
    const sinY = Math.sin(state.three.rotation.y);
    const cosX = Math.cos(state.three.rotation.x);
    const sinX = Math.sin(state.three.rotation.x);
    const rotatedX = x0 * cosY - z0 * sinY;
    const rotatedZ = x0 * sinY + z0 * cosY;
    x1 = rotatedX;
    y1 = y0 * cosX - rotatedZ * sinX;
    z2 = y0 * sinX + rotatedZ * cosX;
  }
  const perspective = cameraDistance / (cameraDistance + z2 + 220);
  return {
    x: centerX + x1 * scaleBase * perspective,
    y: centerY - y1 * scaleBase * perspective,
    z: z2,
    perspective
  };
}

function drawThreeAxes(width, height) {
  ctx.save();
  const scaleBase = Math.min(width, height) / 390;
  const project = (x, y, z) => projectThreePoint(x, y, z, width, height, scaleBase);
  const yMid = (SHADE_AXIS_POLARITIES.y.min + SHADE_AXIS_POLARITIES.y.max) / 2;
  const axes = [
    {
      key: 'X',
      label: 'X cool / warm',
      color: 'rgba(174, 69, 49, 0.72)',
      ticks: [-100, -50, 0, 50, 100],
      point: value => [value * 2.2, 0, 0],
      note: ['cool / blue-green -100', 'warm / yellow-red +100']
    },
    {
      key: 'Y',
      label: 'Y degree of differentiation',
      color: 'rgba(56, 97, 148, 0.72)',
      ticks: [0, 25, 50, 75, 100],
      point: value => [0, (value - yMid) * 1.55, 0],
      note: ['black abstract field / 0', 'white revealed structure / 100']
    },
    {
      key: 'Z',
      label: 'Z muted / vivid',
      color: 'rgba(68, 126, 99, 0.72)',
      ticks: [-100, -50, 0, 50, 100],
      point: value => [0, 0, value * 1.55],
      note: ['muted / gray-brown -100', 'vivid / pink-orange +100']
    }
  ];

  ctx.font = '11px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  axes.forEach(axis => {
    const start = project(...axis.point(axis.ticks[0]));
    const end = project(...axis.point(axis.ticks[axis.ticks.length - 1]));
    ctx.strokeStyle = axis.color;
    ctx.fillStyle = axis.color;
    ctx.lineWidth = 1.35;
    ctx.setLineDash(axis.key === 'Z' ? [5, 5] : []);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    axis.ticks.forEach(value => {
      const tick = project(...axis.point(value));
      ctx.beginPath();
      ctx.arc(tick.x, tick.y, value === 0 ? 3.2 : 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(32, 37, 43, 0.62)';
      ctx.fillText(String(value), tick.x + 6, tick.y - 7);
      ctx.fillStyle = axis.color;
    });

    ctx.font = '700 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(32, 37, 43, 0.72)';
    const labelOffsetY = axis.key === 'Y' ? -18 : -12;
    ctx.fillText(axis.label, end.x + 8, end.y + labelOffsetY);
    ctx.font = '11px Inter, sans-serif';
  });

  ctx.fillStyle = 'rgba(32, 37, 43, 0.55)';
  ctx.fillText(`X: ${axisRangeSummary('x')}`, width * 0.12, height * 0.9);
  ctx.fillText(`Y: ${axisRangeSummary('y')}`, width * 0.12, height * 0.93);
  ctx.fillText(`Z: ${axisRangeSummary('z')}`, width * 0.12, height * 0.96);
  ctx.restore();
}

function drawThreeCanvasEdge(edge, positions, profile = state.perception?.profile || currentPerceptionProfile()) {
  const source = positions.get(edge.source);
  const target = positions.get(edge.target);
  if (!source || !target) return;
  const targetNode = state.nodeById.get(edge.target);
  const score = edge.__perceptionScore ?? edgePerceptionScore(edge, profile, state.perception?.visibleNodeIds);
  const routeState = edge.__routeState || edgeRuntimeActivation(edge, profile, state.perception?.visibleNodeIds).state;
  const isPinned = edge.__isPinned || false;
  const bucket = edgeRouteBucket(edge, profile);
  const onTranslationRoute = profile.translationPairs?.has(nodePairKey(edge.source, edge.target));
  ctx.save();
  ctx.strokeStyle = onTranslationRoute
    ? '#20252b'
    : routeState !== 'stored'
      ? familyColor(targetNode?.family || nodeColorKey(targetNode))
      : 'rgba(104, 112, 122, 0.24)';
  const activationOpacity = routeState === 'active' ? 1 : routeState === 'context_selected' ? 0.74 : 0.42;
  ctx.globalAlpha = clamp(connectionStrengthOpacity(score, bucket, 0.035, 0.96) * activationOpacity * (isPinned ? 1.08 : 1), 0.03, 1);
  ctx.lineWidth = 0.6 + score * 2.2 + (onTranslationRoute ? 0.7 : 0) + (routeState === 'active' ? 0.35 : 0) + (isPinned ? 0.25 : 0);
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.restore();
}

function drawThreeCanvasNode(node, pos, selected, profile = state.perception?.profile || currentPerceptionProfile()) {
  if (!node) return;
  const gradient = ctx.createRadialGradient(pos.x - pos.radius * 0.35, pos.y - pos.radius * 0.45, 1, pos.x, pos.y, pos.radius * 1.4);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.2, pos.color.hex);
  gradient.addColorStop(1, shadeColor(pos.color.hex, -32));
  const score = nodePerceptionScore(node, profile);
  const bucket = nodeRouteBucket(node.id, profile);
  ctx.save();
  ctx.globalAlpha = selected
    ? 1
    : clamp(connectionStrengthOpacity(score, bucket, 0.58, 1) * (0.84 + pos.perspective * 0.16), 0.58, 1);
  ctx.fillStyle = gradient;
  ctx.strokeStyle = selected ? '#20252b' : 'rgba(32, 37, 43, 0.42)';
  ctx.lineWidth = selected ? 3 : 1;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, pos.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (selected || score > 0.3 || pos.radius > 8.5) {
    ctx.fillStyle = '#20252b';
    ctx.font = selected ? '700 13px Inter, sans-serif' : '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.label, pos.x, pos.y + pos.radius + 5);
  }
  ctx.restore();
}

function hitTestThree(x, y) {
  const hits = [...state.three.projected.entries()]
    .map(([id, pos]) => ({ id, pos, distance: Math.hypot(x - pos.x, y - pos.y) }))
    .filter(item => item.distance <= item.pos.radius + 8)
    .sort((a, b) => b.pos.depth - a.pos.depth || a.distance - b.distance);
  return hits[0] || null;
}

function shadeColor(hex, amount) {
  const color = parseColorInput(hex);
  if (!color) return hex;
  return rgbToHex(
    clamp(color.r + amount, 0, 255),
    clamp(color.g + amount, 0, 255),
    clamp(color.b + amount, 0, 255)
  );
}

function drawThreeGraph() {
  if (!els.threeGraph) return;
  if (!window.THREE) {
    els.threeGraph.innerHTML = '<div class="three-fallback">3D mode needs the local Three.js file. Ring, Graph theory, and Scatter mode still work.</div>';
    if (els.graphHint) els.graphHint.textContent = '3D mode could not load the local Three.js file. The other graph modes still work.';
    return;
  }

  initThreeGraph();
  rebuildThreeScene();
  renderThreeFrame();
  if (els.graphHint) {
      els.graphHint.textContent = '3D color web: stable X/Y/Z positions built from fixed base-color anchors, bridge-distance placement, and inherited shade paths. Y measures degree of differentiation from black abstract field to white revealed structure. This system measures influence, not meaning. Use axis view to look through X, Y, or Z; drag for a custom view; click a sphere to inspect it.';
  }
}

function initThreeGraph() {
  if (state.three.renderer || !window.THREE || !els.threeGraph) return;
  const THREE = window.THREE;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfbfaf7);
  const camera = new THREE.PerspectiveCamera(48, 1, 1, 2400);
  camera.position.set(0, 0, 620);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'three-canvas';
  els.threeGraph.replaceChildren(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(180, 220, 300);
  scene.add(light);

  state.three.scene = scene;
  state.three.camera = camera;
  state.three.renderer = renderer;
  state.three.group = group;
  state.three.raycaster = new THREE.Raycaster();
  state.three.pointer = new THREE.Vector2();
}

function rebuildThreeScene() {
  const THREE = window.THREE;
  const three = state.three;
  if (!THREE || !three.group) return;

  while (three.group.children.length) {
    const child = three.group.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }
  three.nodeMeshes.clear();

  const profile = state.perception.profile = currentPerceptionProfile();
  const visibleNodeIds = [...neighborhood(state.selectedId, profile)].filter(id => state.nodeById.has(id));
  const visibleSet = new Set(visibleNodeIds);
  state.perception.visibleNodeIds = visibleSet;
  const distances = graphDistances(state.selectedId, visibleSet);
  const nodePositions = new Map();

  visibleNodeIds.forEach(id => {
    const node = state.nodeById.get(id);
    const color = colorForNode(node) || parseColorInput(familyColor(nodeColorKey(node)));
    const shade = displayShadePositionForNode(node)?.position || baselinePlacementForNode(node)?.position || shadePosition(color, environmentFamiliesForNode(node) || []);
    const yMid = (SHADE_AXIS_POLARITIES.y.min + SHADE_AXIS_POLARITIES.y.max) / 2;
    const pos = {
      x: shade.x * 2.15,
      y: (shade.y - yMid) * 1.7,
      z: shade.z * 1.5
    };
    nodePositions.set(id, pos);

    const radius = id === state.selectedId ? 14 : node.type === 'family' ? 11 : node.type === 'subfamily' ? 9 : node.type === 'emotion_word' ? 8 : 6;
    const geometry = new THREE.SphereGeometry(radius, 20, 14);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color.hex),
      roughness: 0.45,
      metalness: 0.08,
      emissive: new THREE.Color(id === state.selectedId ? color.hex : '#000000'),
      emissiveIntensity: id === state.selectedId ? 0.18 : 0
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.userData.nodeId = id;
    three.group.add(mesh);
    three.nodeMeshes.set(id, mesh);
  });

  state.perception.visibleEdges = visibleGraphEdges(new Set(visibleNodeIds), profile);
  state.perception.visibleEdges.forEach(edge => {
    const source = nodePositions.get(edge.source);
    const target = nodePositions.get(edge.target);
    if (!source || !target) return;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(source.x, source.y, source.z),
      new THREE.Vector3(target.x, target.y, target.z)
    ]);
    const targetNode = state.nodeById.get(edge.target);
    const score = edge.__perceptionScore ?? edgePerceptionScore(edge, profile, visibleSet);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(edge.type === 'emotion_association' ? familyColor('emotion') : familyColor(targetNode?.family || nodeColorKey(targetNode))),
      transparent: true,
      opacity: connectionStrengthOpacity(score, edgeRouteBucket(edge, profile), 0.035, 0.96)
    });
    three.group.add(new THREE.Line(geometry, material));
  });

  three.group.rotation.x = state.three.rotation.x;
  three.group.rotation.y = state.three.rotation.y;
  resizeThreeRenderer();
}

function resizeThreeRenderer() {
  const three = state.three;
  if (!three.renderer || !three.camera || !els.threeGraph) return;
  const rect = els.threeGraph.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  three.renderer.setSize(width, height, false);
  three.camera.aspect = width / height;
  three.camera.updateProjectionMatrix();
}

function renderThreeFrame() {
  const three = state.three;
  if (!three.renderer || !three.scene || !three.camera || !three.group) return;
  resizeThreeRenderer();
  three.group.rotation.x = state.three.rotation.x;
  three.group.rotation.y = state.three.rotation.y;
  three.renderer.render(three.scene, three.camera);
}

function startThreeAnimation() {
  if (state.three.animationId) return;
  const tick = () => {
    if (state.graphMode !== '3d') {
      stopThreeAnimation();
      return;
    }
    if (state.three.renderer && state.three.scene) {
      renderThreeFrame();
    } else {
      drawThreeCanvasGraph();
    }
    state.three.animationId = requestAnimationFrame(tick);
  };
  state.three.animationId = requestAnimationFrame(tick);
}

function stopThreeAnimation() {
  if (!state.three.animationId) return;
  cancelAnimationFrame(state.three.animationId);
  state.three.animationId = null;
}

function selectThreeNodeAt(event) {
  const THREE = window.THREE;
  const three = state.three;
  if (!THREE || !three.raycaster || !three.camera || !els.threeGraph) return;
  const rect = els.threeGraph.getBoundingClientRect();
  three.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  three.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  three.raycaster.setFromCamera(three.pointer, three.camera);
  const hits = three.raycaster.intersectObjects([...three.nodeMeshes.values()], false);
  const nodeId = hits[0]?.object?.userData?.nodeId;
  if (!nodeId) return;
  state.selectedId = nodeId;
  render();
}

function drawScatterGuides(width, height, visibleNodeIds) {
  const positions = [...visibleNodeIds].map(id => layoutPositionForNode(id)).filter(Boolean);
  if (!positions.length) return;
  const left = Math.min(...positions.map(pos => pos.x)) - 28;
  const right = Math.max(...positions.map(pos => pos.x)) + 28;
  const top = Math.min(...positions.map(pos => pos.y)) - 28;
  const bottom = Math.max(...positions.map(pos => pos.y)) + 28;
  const distances = [...new Set(positions.map(pos => pos.distance ?? pos.ring ?? 0))].sort((a, b) => a - b);

  ctx.save();
  ctx.strokeStyle = 'rgba(104, 112, 122, 0.2)';
  ctx.fillStyle = 'rgba(32, 37, 43, 0.6)';
  ctx.lineWidth = 1;
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  distances.forEach(distance => {
    const lane = positions.find(pos => (pos.distance ?? pos.ring ?? 0) === distance);
    if (!lane) return;
    ctx.beginPath();
    ctx.setLineDash([4, 8]);
    ctx.moveTo(clamp(left, 18, width - 18), lane.y);
    ctx.lineTo(clamp(right, 18, width - 18), lane.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(distance === 0 ? 'selected' : `distance ${distance}`, 16, clamp(lane.y, 18, height - 18));
  });

  ctx.strokeStyle = 'rgba(32, 37, 43, 0.35)';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(clamp(left, 18, width - 18), clamp(bottom, 18, height - 18));
  ctx.lineTo(clamp(right, 18, width - 18), clamp(bottom, 18, height - 18));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(clamp(left, 18, width - 18), clamp(top, 18, height - 18));
  ctx.lineTo(clamp(left, 18, width - 18), clamp(bottom, 18, height - 18));
  ctx.stroke();

  ctx.fillStyle = 'rgba(32, 37, 43, 0.72)';
  ctx.font = '700 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('degree centrality ->', (left + right) / 2, clamp(bottom + 28, 20, height - 12));
  ctx.save();
  ctx.translate(clamp(left - 42, 14, width - 14), (top + bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('path distance from selected ->', 0, 0);
  ctx.restore();
  ctx.restore();
}

function drawSpiderGuides(width, height) {
  const selected = layoutPositionForNode(state.selectedId);
  if (!selected) return;
  const direct = state.nodes.map(node => layoutPositionForNode(node.id)).filter(pos => pos?.ring === 1);
  const second = state.nodes.map(node => layoutPositionForNode(node.id)).filter(pos => pos?.ring === 2);
  const directRadius = direct[0] ? Math.hypot(direct[0].x - selected.x, direct[0].y - selected.y) : 0;
  const secondRadius = second[0] ? Math.hypot(second[0].x - selected.x, second[0].y - selected.y) : 0;

  ctx.save();
  ctx.strokeStyle = 'rgba(104, 112, 122, 0.18)';
  ctx.setLineDash([5, 8]);
  [directRadius, secondRadius].filter(Boolean).forEach(radius => {
    ctx.beginPath();
    ctx.arc(selected.x, selected.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(32, 37, 43, 0.55)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  if (directRadius) ctx.fillText('direct routes', selected.x, Math.max(14, selected.y - directRadius - 10));
  if (secondRadius) ctx.fillText('next routes', selected.x, Math.min(height - 12, selected.y - secondRadius - 10));
  ctx.restore();
}

function drawRouteSideGuides(width, height) {
  const selected = layoutPositionForNode(state.selectedId);
  if (!selected) return;
  const direct = directNeighborGroups(state.selectedId, state.perception?.visibleNodeIds, state.perception?.profile);
  if (!direct.outgoing.length && !direct.incoming.length) return;

  const leftX = clamp(selected.x - 150, 46, width * 0.45);
  const rightX = clamp(selected.x + 150, width * 0.55, width - 46);
  const labelY = clamp(selected.y - selected.radius - 26, 24, height - 24);

  ctx.save();
  ctx.font = '700 11px Inter, sans-serif';
  ctx.textBaseline = 'middle';

  if (direct.incoming.length) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(121, 92, 67, 0.88)';
    ctx.fillText(`Routes into (${direct.incoming.length})`, leftX, labelY);
  }

  if (direct.outgoing.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(35, 100, 170, 0.9)';
    ctx.fillText(`Routes from (${direct.outgoing.length})`, rightX, labelY);
  }

  ctx.restore();
}

function drawThreeRouteSideGuides(positions, width, height) {
  const selected = positions.get(state.selectedId);
  if (!selected) return;
  const direct = directNeighborGroups(state.selectedId, state.perception?.visibleNodeIds, state.perception?.profile);
  if (!direct.outgoing.length && !direct.incoming.length) return;

  const leftX = clamp(selected.x - 150, 46, width * 0.45);
  const rightX = clamp(selected.x + 150, width * 0.55, width - 46);
  const labelY = clamp(selected.y - selected.radius - 26, 24, height - 24);

  ctx.save();
  ctx.font = '700 11px Inter, sans-serif';
  ctx.textBaseline = 'middle';

  if (direct.incoming.length) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(121, 92, 67, 0.88)';
    ctx.fillText(`Routes into (${direct.incoming.length})`, leftX, labelY);
  }

  if (direct.outgoing.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(35, 100, 170, 0.9)';
    ctx.fillText(`Routes from (${direct.outgoing.length})`, rightX, labelY);
  }

  ctx.restore();
}

function drawConditionTerritories(positionMap, visibleNodeIds, profile = state.perception?.profile || currentPerceptionProfile(), isThree = false) {
  const territories = conditionTerritories(positionMap, visibleNodeIds, profile);
  territories.forEach(territory => drawConditionTerritory(territory, isThree));
}

function conditionTerritories(positionMap, visibleNodeIds, profile = state.perception?.profile || currentPerceptionProfile()) {
  const territoryFamilies = new Set(profile.activeFamilies || []);
  environmentFamiliesForNode(state.nodeById.get(state.selectedId)).forEach(family => territoryFamilies.add(family));

  return [...territoryFamilies]
    .map(family => buildConditionTerritory(family, positionMap, visibleNodeIds))
    .filter(Boolean);
}

function buildConditionTerritory(family, positionMap, visibleNodeIds) {
  const base = ENVIRONMENT_CONDITIONS[family];
  const anchorId = `family-${family}`;
  const anchor = positionMap.get(anchorId);
  if (!base || !anchor) return null;

  const visibleIds = visibleNodeIds instanceof Set ? [...visibleNodeIds] : [...visibleNodeIds];
  const influencePoints = visibleIds
    .map(id => ({ id, node: state.nodeById.get(id), pos: positionMap.get(id) }))
    .filter(item => item.node && item.pos && territoryMatchesFamily(item.node, family));

  const maxDistance = influencePoints.reduce((max, item) => {
    const distance = Math.hypot(item.pos.x - anchor.x, item.pos.y - anchor.y);
    return Math.max(max, distance);
  }, 0);

  const influenceCount = influencePoints.length;
  const baseRadius = family === 'blue' ? 92 : family === 'green' ? 86 : 80;
  const countRadius = Math.sqrt(Math.max(1, influenceCount)) * (family === 'blue' ? 18 : 16);
  const spreadAdjustment = Math.min(34, maxDistance * 0.08);
  const radius = clamp(
    baseRadius + countRadius + spreadAdjustment,
    baseRadius,
    family === 'blue' ? 260 : 220
  );

  return {
    family,
    anchor,
    radius,
    label: base.condition,
    influenceCount,
    style: territoryStyleForFamily(family)
  };
}

function territoryMatchesFamily(node, family) {
  if (!node) return false;
  if (node.type === 'family') return node.id === `family-${family}`;
  if (node.type === 'environment_condition') return node.id === `environment-${family}`;
  const families = new Set();
  if (node.family) splitFamilyId(node.family).forEach(item => families.add(item));
  splitFamilyId(nodeColorKey(node)).forEach(item => families.add(item));
  if (node.metadata?.climateFamily) splitFamilyId(node.metadata.climateFamily).forEach(item => families.add(item));
  return families.has(family);
}

function territoryStyleForFamily(family) {
  const color = parseColorInput(familyColor(family)) || parseColorInput('#888888');
  const defaults = {
    baseColor: color,
    fill: rgba(color, 0.085),
    edge: rgba(color, 0.26),
    text: rgba(color, 0.76)
  };

  const styles = {
    red: { kind: 'ember', fill: rgba(color, 0.11), edge: rgba(color, 0.38), text: rgba(color, 0.84) },
    orange: { kind: 'current', fill: rgba(color, 0.1), edge: rgba(color, 0.34), text: rgba(color, 0.82) },
    yellow: { kind: 'radiance', fill: rgba(color, 0.095), edge: rgba(color, 0.32), text: rgba(color, 0.82) },
    green: { kind: 'canopy', fill: rgba(color, 0.1), edge: rgba(color, 0.3), text: rgba(color, 0.8) },
    blue: { kind: 'cloud', fill: rgba(color, 0.11), edge: rgba(color, 0.34), text: rgba(color, 0.82) },
    purple: { kind: 'veil', fill: rgba(color, 0.1), edge: rgba(color, 0.34), text: rgba(color, 0.8) },
    pink: { kind: 'petal', fill: rgba(color, 0.1), edge: rgba(color, 0.3), text: rgba(color, 0.8) },
    brown: { kind: 'soil', fill: rgba(color, 0.1), edge: rgba(color, 0.28), text: rgba(color, 0.78) },
    gray: { kind: 'mist', fill: rgba(color, 0.085), edge: rgba(color, 0.24), text: rgba(color, 0.72) },
    black: { kind: 'shadow', fill: rgba(color, 0.12), edge: rgba(color, 0.28), text: 'rgba(32, 37, 43, 0.82)' },
    white: { kind: 'glow', fill: rgba(color, 0.12), edge: 'rgba(180, 190, 198, 0.34)', text: 'rgba(88, 98, 108, 0.82)' }
  };

  return {
    ...defaults,
    ...(styles[family] || { kind: 'halo' })
  };
}

function drawConditionTerritory(territory, isThree = false) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';

  switch (territory.style.kind) {
    case 'cloud':
      drawCloudTerritory(territory, isThree);
      break;
    case 'ember':
      drawEmberTerritory(territory, isThree);
      break;
    case 'current':
      drawCurrentTerritory(territory, isThree);
      break;
    case 'radiance':
      drawRadianceTerritory(territory, isThree);
      break;
    case 'canopy':
      drawCanopyTerritory(territory, isThree);
      break;
    case 'veil':
      drawVeilTerritory(territory, isThree);
      break;
    case 'petal':
      drawPetalTerritory(territory, isThree);
      break;
    case 'soil':
      drawSoilTerritory(territory, isThree);
      break;
    case 'mist':
      drawMistTerritory(territory, isThree);
      break;
    case 'shadow':
      drawShadowTerritory(territory, isThree);
      break;
    case 'glow':
      drawGlowTerritory(territory, isThree);
      break;
    default:
      drawHaloTerritory(territory, isThree);
      break;
  }

  ctx.restore();
}

function drawHaloTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  const gradient = ctx.createRadialGradient(anchor.x, anchor.y, radius * 0.16, anchor.x, anchor.y, radius);
  gradient.addColorStop(0, style.fill);
  gradient.addColorStop(0.68, rgba(style.baseColor, 0.08));
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = style.edge;
  ctx.lineWidth = isThree ? 1.2 : 1.4;
  ctx.setLineDash([7, 10]);
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = style.text;
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${label} (${influenceCount})`, anchor.x, anchor.y - radius - 8);
}

function drawCloudTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  const blobs = [
    { x: anchor.x - radius * 0.26, y: anchor.y + radius * 0.04, r: radius * 0.42 },
    { x: anchor.x, y: anchor.y - radius * 0.08, r: radius * 0.5 },
    { x: anchor.x + radius * 0.24, y: anchor.y + radius * 0.02, r: radius * 0.4 }
  ];
  drawSoftBlobGroup(blobs, style);
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = isThree ? 1 : 1.2;
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, radius * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  drawTerritoryLabel(anchor.x, anchor.y - radius * 0.66, `${label} (${influenceCount})`, style.text);
}

function drawEmberTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  const blobs = [
    { x: anchor.x - radius * 0.16, y: anchor.y + radius * 0.08, r: radius * 0.36 },
    { x: anchor.x + radius * 0.12, y: anchor.y + radius * 0.04, r: radius * 0.3 },
    { x: anchor.x, y: anchor.y - radius * 0.1, r: radius * 0.26 }
  ];
  drawSoftBlobGroup(blobs, style);
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = isThree ? 1 : 1.2;
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, radius * 0.54, 0, Math.PI * 2);
  ctx.stroke();
  drawTerritoryLabel(anchor.x, anchor.y - radius * 0.62, `${label} (${influenceCount})`, style.text);
}

function drawCurrentTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = isThree ? 1 : 1.2;
  [-0.16, 0.16].forEach(offset => {
    ctx.beginPath();
    ctx.moveTo(anchor.x - radius * 0.62, anchor.y + radius * offset);
    ctx.bezierCurveTo(
      anchor.x - radius * 0.22, anchor.y - radius * (0.18 + offset),
      anchor.x + radius * 0.18, anchor.y + radius * (0.18 + offset),
      anchor.x + radius * 0.62, anchor.y - radius * offset
    );
    ctx.stroke();
  });
  drawTerritoryCore(anchor, radius, style.fill, 0.3);
  drawTerritoryLabel(anchor.x, anchor.y - radius * 0.56, `${label} (${influenceCount})`, style.text);
}

function drawRadianceTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  drawTerritoryCore(anchor, radius, style.fill, 0.68);
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = isThree ? 1 : 1.15;
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    ctx.beginPath();
    ctx.moveTo(anchor.x + Math.cos(angle) * radius * 0.42, anchor.y + Math.sin(angle) * radius * 0.42);
    ctx.lineTo(anchor.x + Math.cos(angle) * radius * 0.8, anchor.y + Math.sin(angle) * radius * 0.8);
    ctx.stroke();
  }
  drawTerritoryLabel(anchor.x, anchor.y - radius * 0.9, `${label} (${influenceCount})`, style.text);
}

function drawCanopyTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  const crowns = [
    { x: anchor.x - radius * 0.2, y: anchor.y - radius * 0.04, r: radius * 0.3 },
    { x: anchor.x, y: anchor.y - radius * 0.12, r: radius * 0.36 },
    { x: anchor.x + radius * 0.2, y: anchor.y - radius * 0.02, r: radius * 0.28 }
  ];
  drawSoftBlobGroup(crowns, style);
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = isThree ? 1 : 1.15;
  ctx.beginPath();
  ctx.moveTo(anchor.x - radius * 0.5, anchor.y + radius * 0.18);
  ctx.lineTo(anchor.x + radius * 0.5, anchor.y + radius * 0.18);
  ctx.stroke();
  drawTerritoryLabel(anchor.x, anchor.y - radius * 0.62, `${label} (${influenceCount})`, style.text);
}

function drawVeilTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  ctx.fillStyle = style.fill;
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y - radius * 0.56);
  ctx.lineTo(anchor.x + radius * 0.48, anchor.y);
  ctx.lineTo(anchor.x, anchor.y + radius * 0.56);
  ctx.lineTo(anchor.x - radius * 0.48, anchor.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = isThree ? 1 : 1.15;
  ctx.stroke();
  drawTerritoryLabel(anchor.x, anchor.y - radius * 0.68, `${label} (${influenceCount})`, style.text);
}

function drawPetalTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  const petals = [
    { x: 0, y: -0.22 }, { x: 0.22, y: 0 }, { x: 0, y: 0.22 }, { x: -0.22, y: 0 }
  ];
  petals.forEach(petal => {
    const px = anchor.x + radius * petal.x;
    const py = anchor.y + radius * petal.y;
    const gradient = ctx.createRadialGradient(px, py, radius * 0.04, px, py, radius * 0.24);
    gradient.addColorStop(0, style.fill);
    gradient.addColorStop(0.8, rgba(style.baseColor, 0.05));
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(px, py, radius * 0.16, radius * 0.24, petal.x === 0 ? 0 : Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = isThree ? 1 : 1.1;
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, radius * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  drawTerritoryLabel(anchor.x, anchor.y - radius * 0.58, `${label} (${influenceCount})`, style.text);
}

function drawSoilTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  const topY = anchor.y - radius * 0.26;
  const layerHeights = [0.14, 0.12, 0.1];
  layerHeights.forEach((ratio, index) => {
    const y = topY + radius * index * 0.22;
    const h = radius * ratio;
    ctx.fillStyle = rgba(style.baseColor, 0.11 - index * 0.02);
    ctx.fillRect(anchor.x - radius * 0.56, y, radius * 1.12, h);
  });
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = isThree ? 1 : 1.1;
  [0, 1, 2].forEach(index => {
    const y = topY + radius * index * 0.22;
    ctx.beginPath();
    ctx.moveTo(anchor.x - radius * 0.56, y);
    ctx.lineTo(anchor.x + radius * 0.56, y);
    ctx.stroke();
  });
  drawTerritoryLabel(anchor.x, anchor.y - radius * 0.42, `${label} (${influenceCount})`, style.text);
}

function drawMistTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  [-0.16, 0.16].forEach(offset => {
    const gradient = ctx.createLinearGradient(anchor.x - radius, anchor.y + radius * offset, anchor.x + radius, anchor.y + radius * offset);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.2, style.fill);
    gradient.addColorStop(0.8, style.fill);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = (isThree ? 8 : 10) - Math.abs(offset) * 8;
    ctx.beginPath();
    ctx.moveTo(anchor.x - radius * 0.62, anchor.y + radius * offset);
    ctx.lineTo(anchor.x + radius * 0.62, anchor.y + radius * offset);
    ctx.stroke();
  });
  drawTerritoryLabel(anchor.x, anchor.y - radius * 0.56, `${label} (${influenceCount})`, style.text);
}

function drawShadowTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  const gradient = ctx.createRadialGradient(anchor.x, anchor.y + radius * 0.14, radius * 0.08, anchor.x, anchor.y + radius * 0.14, radius);
  gradient.addColorStop(0, style.fill);
  gradient.addColorStop(0.72, rgba(style.baseColor, 0.07));
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(anchor.x, anchor.y + radius * 0.12, radius * 0.62, radius * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = isThree ? 1 : 1.1;
  ctx.beginPath();
  ctx.ellipse(anchor.x, anchor.y + radius * 0.12, radius * 0.62, radius * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();
  drawTerritoryLabel(anchor.x, anchor.y - radius * 0.34, `${label} (${influenceCount})`, style.text);
}

function drawGlowTerritory(territory, isThree = false) {
  const { anchor, radius, style, label, influenceCount } = territory;
  drawTerritoryCore(anchor, radius, style.fill, 0.78);
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = isThree ? 1 : 1.1;
  [0.5, 0.82].forEach(ratio => {
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, radius * ratio, 0, Math.PI * 2);
    ctx.stroke();
  });
  drawTerritoryLabel(anchor.x, anchor.y - radius * 0.84, `${label} (${influenceCount})`, style.text);
}

function drawSoftBlobGroup(blobs, style) {
  blobs.forEach(blob => {
    const gradient = ctx.createRadialGradient(blob.x, blob.y, blob.r * 0.08, blob.x, blob.y, blob.r);
    gradient.addColorStop(0, style.fill);
    gradient.addColorStop(0.8, rgba(style.baseColor, 0.05));
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawTerritoryCore(anchor, radius, fill, ratio = 0.4) {
  const gradient = ctx.createRadialGradient(anchor.x, anchor.y, radius * 0.04, anchor.x, anchor.y, radius * ratio);
  gradient.addColorStop(0, fill);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, radius * ratio, 0, Math.PI * 2);
  ctx.fill();
}

function drawTerritoryLabel(x, y, text, color) {
  ctx.fillStyle = color;
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, x, y);
}

function rgba(color, alpha) {
  const parsed = typeof color === 'string' ? parseColorInput(color) : color;
  if (!parsed) return `rgba(136, 136, 136, ${alpha})`;
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

function pointOnNodeSide(pos, side, pad = 2) {
  const radius = (pos?.radius || 0) + pad;
  if (side === 'left') return { x: pos.x - radius, y: pos.y };
  if (side === 'right') return { x: pos.x + radius, y: pos.y };
  if (side === 'top') return { x: pos.x, y: pos.y - radius };
  if (side === 'bottom') return { x: pos.x, y: pos.y + radius };
  return { x: pos.x, y: pos.y };
}

function sideVector(side) {
  if (side === 'left') return { x: -1, y: 0 };
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'top') return { x: 0, y: -1 };
  if (side === 'bottom') return { x: 0, y: 1 };
  return { x: 0, y: 0 };
}

function sideFacingPoint(pos, target) {
  if (!pos || !target) return '';
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

function edgeAnchorPoints(edge, source, target) {
  const selected = layoutPositionForNode(state.selectedId);
  if (!selected) {
    return {
      start: { x: source.x, y: source.y },
      end: { x: target.x, y: target.y },
      startSide: '',
      endSide: ''
    };
  }

  let startSide = '';
  let endSide = '';

  if (edge.source === state.selectedId) {
    startSide = 'right';
  } else if (edge.target === state.selectedId) {
    endSide = 'left';
  }

  if (edge.source !== state.selectedId && edge.target === state.selectedId) {
    startSide = sideFacingPoint(source, selected);
  }

  if (edge.target !== state.selectedId && edge.source === state.selectedId) {
    endSide = sideFacingPoint(target, selected);
  }

  return {
    start: startSide ? pointOnNodeSide(source, startSide) : { x: source.x, y: source.y },
    end: endSide ? pointOnNodeSide(target, endSide) : { x: target.x, y: target.y },
    startSide,
    endSide
  };
}

function drawEdge(edge) {
  const source = layoutPositionForNode(edge.source);
  const target = layoutPositionForNode(edge.target);
  if (!source || !target) return;
  const targetNode = state.nodeById.get(edge.target);
  const sourceNode = state.nodeById.get(edge.source);
  const landsOnFamily = targetNode?.type === 'family' && sourceNode?.type !== 'family';
  const landsOnBridge = targetNode?.type === 'subfamily' || targetNode?.type === 'shade';
  const isConditionEdge = edge.type === 'environment_condition' || edge.type === 'condition_has_synonym';
  const score = edge.__perceptionScore ?? edgePerceptionScore(edge, state.perception?.profile, state.perception?.visibleNodeIds);
  const onTranslationRoute = state.perception?.profile?.translationPairs?.has(nodePairKey(edge.source, edge.target));
  const routeState = edge.__routeState || edgeRuntimeActivation(edge, state.perception?.profile, state.perception?.visibleNodeIds).state;
  const isPinned = edge.__isPinned || false;
  const bucket = edgeRouteBucket(edge, state.perception?.profile);
  const anchors = edgeAnchorPoints(edge, source, target);
  const selectedInvolved = edge.source === state.selectedId || edge.target === state.selectedId;
  const curveStrength = 28 + score * 26;
  const startVector = sideVector(anchors.startSide);
  const endVector = sideVector(anchors.endSide);
  const startControl = selectedInvolved && anchors.startSide
    ? {
        x: anchors.start.x + startVector.x * curveStrength,
        y: anchors.start.y + startVector.y * curveStrength
      }
    : anchors.start;
  const endControl = selectedInvolved && anchors.endSide
    ? {
        x: anchors.end.x + endVector.x * curveStrength,
        y: anchors.end.y + endVector.y * curveStrength
      }
    : anchors.end;

  ctx.save();
  ctx.strokeStyle = onTranslationRoute
    ? '#20252b'
    : landsOnFamily || landsOnBridge
    ? familyColor(targetNode.family || targetNode.id.replace('family-', ''))
    : isConditionEdge
      ? familyColor(targetNode?.family || sourceNode?.family || nodeColorKey(sourceNode))
      : edge.type === 'emotion_association'
        ? familyColor('emotion')
        : edge.type === 'has_synonym'
          ? '#8f352f'
        : edge.type === 'has_expanded_synonym'
            ? '#2364aa'
            : '#7b7f86';
  const activationOpacity = routeState === 'active' ? 1 : routeState === 'context_selected' ? 0.76 : 0.45;
  ctx.globalAlpha = clamp(connectionStrengthOpacity(score, bucket, 0.04, 1) * activationOpacity * (isPinned ? 1.08 : 1), 0.04, 1);
  ctx.lineWidth = (landsOnFamily ? 2.2 : landsOnBridge || isConditionEdge ? 1.9 : 0.9)
    + score * 1.7
    + (onTranslationRoute ? 0.8 : 0)
    + (routeState === 'active' ? 0.35 : 0)
    + (isPinned ? 0.25 : 0);
  if (score < 0.26) ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(anchors.start.x, anchors.start.y);
  if (selectedInvolved && (anchors.startSide || anchors.endSide)) {
    ctx.bezierCurveTo(startControl.x, startControl.y, endControl.x, endControl.y, anchors.end.x, anchors.end.y);
  } else {
    ctx.lineTo(anchors.end.x, anchors.end.y);
  }
  ctx.stroke();

  if (score >= 0.22) {
    const tangentX = selectedInvolved && anchors.endSide
      ? anchors.end.x - endControl.x
      : anchors.end.x - anchors.start.x;
    const tangentY = selectedInvolved && anchors.endSide
      ? anchors.end.y - endControl.y
      : anchors.end.y - anchors.start.y;
    const angle = Math.atan2(tangentY, tangentX);
    const arrowX = anchors.end.x;
    const arrowY = anchors.end.y;
    const arrowSize = 4 + score * 4;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - Math.cos(angle - 0.45) * arrowSize, arrowY - Math.sin(angle - 0.45) * arrowSize);
    ctx.lineTo(arrowX - Math.cos(angle + 0.45) * arrowSize, arrowY - Math.sin(angle + 0.45) * arrowSize);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }
  ctx.restore();
}

function drawNode(node) {
  if (!node) return;
  const pos = layoutPositionForNode(node.id);
  if (!pos) return;
  const family = nodeColorKey(node);
  const selected = node.id === state.selectedId;
  const prominence = nodePerceptionScore(node, state.perception?.profile);
  const bucket = nodeRouteBucket(node.id, state.perception?.profile);
  const nodeAlpha = selected ? 1 : connectionStrengthOpacity(prominence, bucket, 0.62, 1);

  if (node.type === 'family') {
    drawFamilyNode(node, pos, family, selected, prominence, nodeAlpha);
    return;
  }
  if (node.type === 'subfamily') {
    drawSubfamilyNode(node, pos, family, selected, prominence, nodeAlpha);
    return;
  }
  if (node.type === 'shade') {
    drawShadeNode(node, pos, family, selected, prominence, nodeAlpha);
    return;
  }

  const nodeColor = colorForNode(node)?.hex || familyColor(family);
  ctx.save();
  ctx.globalAlpha = nodeAlpha;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, pos.radius + (selected ? 5 : 0), 0, Math.PI * 2);
  ctx.fillStyle = selected ? '#ffffff' : nodeColor;
  ctx.fill();
  ctx.lineWidth = selected ? 4 : 1.5;
  ctx.strokeStyle = nodeColor;
  ctx.stroke();

  ctx.fillStyle = family === 'white' || selected ? '#20252b' : '#ffffff';
  ctx.font = `${node.type === 'family' ? 700 : 600} ${node.type === 'family' ? 13 : 10}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  wrapCanvasText(node.label, pos.x, pos.y, Math.max(42, pos.radius * 2.8), node.type === 'family' ? 14 : 11);
  ctx.restore();
}

function drawSubfamilyNode(node, pos, family, selected, prominence = 1, nodeAlpha = 1) {
  const width = selected ? 106 : 92;
  const height = selected ? 46 : 38;
  const color = familyColor(family);

  ctx.save();
  ctx.globalAlpha = nodeAlpha;
  roundedRectPath(pos.x - width / 2, pos.y - height / 2, width, height, 18);
  ctx.fillStyle = selected ? '#ffffff' : hexToRgba(color, 0.92);
  ctx.fill();
  ctx.lineWidth = selected ? 4 : 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = selected ? '#20252b' : '#ffffff';
  ctx.font = '800 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, pos.x, pos.y - 4);
  ctx.font = '700 8px Inter, sans-serif';
  ctx.fillText('BRIDGE', pos.x, pos.y + 10);
  ctx.restore();
}

function drawShadeNode(node, pos, family, selected, prominence = 1, nodeAlpha = 1) {
  const size = selected ? 52 : 42;
  const color = familyColor(family);

  ctx.save();
  ctx.globalAlpha = nodeAlpha;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - size / 2);
  ctx.lineTo(pos.x + size / 2, pos.y);
  ctx.lineTo(pos.x, pos.y + size / 2);
  ctx.lineTo(pos.x - size / 2, pos.y);
  ctx.closePath();
  ctx.fillStyle = selected ? '#ffffff' : hexToRgba(color, 0.9);
  ctx.fill();
  ctx.lineWidth = selected ? 4 : 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = selected ? '#20252b' : '#ffffff';
  ctx.font = '700 8px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  wrapCanvasText(node.label, pos.x, pos.y, size * 0.9, 9);
  ctx.restore();
}

function drawFamilyNode(node, pos, family, selected, prominence = 1, nodeAlpha = 1) {
  const size = (pos.radius + (selected ? 7 : 3)) * 2;
  const x = pos.x - size / 2;
  const y = pos.y - size / 2;
  const color = familyColor(family);
  const placementKind = baselinePlacementForNode(node)?.kind || 'base_family_anchor';
  const isBridgeFamily = placementKind === 'bridge_family_anchor';
  const roleLabel = isBridgeFamily ? 'BRIDGE FAMILY' : 'ANCHOR';
  const hasCrossFamilyRoute = incoming(node.id).some(edge => edge.type === 'definition_contains' || edge.type === 'synonym_to_color_alias' || edge.type === 'associated_color' || edge.type === 'emotion_association' || edge.type === 'environment_condition');

  ctx.save();
  ctx.globalAlpha = nodeAlpha;
  if (hasCrossFamilyRoute || selected) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(color, 0.16);
    ctx.fill();
  }

  if (isBridgeFamily) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#ffffff' : color;
    ctx.fill();
    ctx.lineWidth = selected ? 4 : 2.5;
    ctx.strokeStyle = color;
    ctx.stroke();
  } else {
    roundedRectPath(x, y, size, size, 8);
    ctx.fillStyle = selected ? '#ffffff' : color;
    ctx.fill();
    ctx.lineWidth = selected ? 4 : 2.5;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  roundedRectPath(x - 5, y - 5, size + 10, size + 10, 10);
  ctx.lineWidth = hasCrossFamilyRoute ? 3 : 1.5;
  ctx.strokeStyle = hasCrossFamilyRoute ? color : 'rgba(32, 37, 43, 0.25)';
  ctx.stroke();

  ctx.fillStyle = selected || family === 'white' ? '#20252b' : '#ffffff';
  ctx.font = '800 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, pos.x, pos.y - 5);
  ctx.font = '700 8px Inter, sans-serif';
  ctx.fillText(roleLabel, pos.x, pos.y + 11);
  ctx.restore();
}

function roundedRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.split('').map(char => char + char).join('') : clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function wrapCanvasText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach(word => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  lines.push(line);
  const start = y - ((lines.length - 1) * lineHeight) / 2;
  lines.slice(0, 3).forEach((item, index) => ctx.fillText(item, x, start + index * lineHeight));
}

function neighborhood(id, profile = state.perception?.profile || currentPerceptionProfile()) {
  if (state.emotionFilter) {
    const allowed = emotionVisibleNodeIds();
    const startId = allowed.has(id) ? id : 'emotion-joy';
    const ids = new Set([startId]);
    state.edges.forEach(edge => {
      if (!isEmotionFilterEdge(edge)) return;
      if (edge.source === startId && allowed.has(edge.target) && nodePassesCategoryFilter(state.nodeById.get(edge.target))) ids.add(edge.target);
      if (edge.target === startId && allowed.has(edge.source) && nodePassesCategoryFilter(state.nodeById.get(edge.source))) ids.add(edge.source);
    });
    [...ids].forEach(nodeId => {
      state.edges.forEach(edge => {
        if (!isEmotionFilterEdge(edge) || ids.size >= 90) return;
        if (edge.source === nodeId && allowed.has(edge.target) && nodePassesCategoryFilter(state.nodeById.get(edge.target))) ids.add(edge.target);
        if (edge.target === nodeId && allowed.has(edge.source) && nodePassesCategoryFilter(state.nodeById.get(edge.source))) ids.add(edge.source);
      });
    });
    const ranked = [...ids]
      .sort((a, b) => nodePerceptionScore(state.nodeById.get(b), profile) - nodePerceptionScore(state.nodeById.get(a), profile));
    return new Set(ranked.slice(0, 70));
  }

  const start = nodePassesCategoryFilter(state.nodeById.get(id)) ? id : firstFilteredNodeId();
  if (!start) return new Set();

  const ids = new Set([start]);
  const distances = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length && ids.size < 180) {
    const current = queue.shift();
    const distance = distances.get(current) || 0;
    if (distance >= 2) continue;
    state.edges.forEach(edge => {
      if (!edgePassesCategoryFilter(edge)) return;
      const next = edge.source === current ? edge.target : edge.target === current ? edge.source : null;
      if (!next || ids.has(next)) return;
      ids.add(next);
      distances.set(next, distance + 1);
      queue.push(next);
    });
  }

  const keep = new Set([start]);
  profile.activeConditionIds.forEach(nodeId => {
    if (ids.has(nodeId)) keep.add(nodeId);
  });
  profile.focusNodeIds.forEach(nodeId => {
    if (ids.has(nodeId)) keep.add(nodeId);
  });

  const limit = state.graphMode === 'topology' || state.graphMode === 'scatter' ? 72 : state.graphMode === '3d' ? 64 : 54;
  const ranked = [...ids]
    .map(nodeId => ({
      id: nodeId,
      distance: distances.get(nodeId) ?? 2,
      score: nodePerceptionScore(state.nodeById.get(nodeId), profile),
      degree: graphDegree(nodeId)
    }))
    .sort((a, b) =>
      a.distance - b.distance
      || b.score - a.score
      || b.degree - a.degree
      || a.id.localeCompare(b.id)
    );

  ranked.forEach(item => {
    if (keep.size >= limit) return;
    const bucket = nodeRouteBucket(item.id, profile);
    if (bucket && !routeFilterAllows(bucket) && item.id !== state.selectedId && !profile.activeConditionIds.has(item.id)) return;
    if (item.score >= 0.18 || item.distance <= 1) keep.add(item.id);
  });

  return keep;
}

function visibleGraphEdges(visibleNodeIds, profile = state.perception?.profile || currentPerceptionProfile()) {
  const limit = state.graphMode === 'topology' || state.graphMode === 'scatter' ? 220 : state.graphMode === '3d' ? 180 : 140;
  return state.edges
    .filter(edge => {
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) return false;
      if (!edgePassesCategoryFilter(edge)) return false;
      const bucket = edgeRouteBucket(edge, profile);
      if (bucket && !routeFilterAllows(bucket)) return false;
      return !state.emotionFilter || isEmotionFilterEdge(edge);
    })
    .map(edge => decorateRuntimeEdge(edge, profile, visibleNodeIds))
    .filter(edge =>
      edge.__perceptionScore >= 0.16
      || edge.source === state.selectedId
      || edge.target === state.selectedId
      || profile.activeConditionIds.has(edge.source)
      || profile.activeConditionIds.has(edge.target)
    )
    .sort((a, b) => b.__perceptionScore - a.__perceptionScore || a.source.localeCompare(b.source) || a.target.localeCompare(b.target))
    .slice(0, limit);
}

function isEmotionFilterEdge(edge) {
  return ['emotion_association', 'has_synonym', 'has_subfamily', 'definition_contains', 'shade_mentions_family', 'shade_of_subfamily'].includes(edge.type);
}

function emotionVisibleNodeIds() {
  const ids = new Set();
  state.nodes
    .filter(node => node.type === 'emotion_word')
    .forEach(node => ids.add(node.id));
  state.edges
    .filter(edge => edge.type === 'emotion_association')
    .forEach(edge => {
      ids.add(edge.source);
      ids.add(edge.target);
    });
  return ids;
}

function categoryForNode(node) {
  if (!node) return '';
  if (node.type === 'ecosystem_foundation') return 'families';
  if (node.type === 'family') return 'families';
  if (node.type === 'subfamily') return 'bridges';
  if (node.type === 'shade' || node.type === 'alias' || node.type === 'synonym') return 'shadeLanguage';
  if (
    node.type === 'ecosystem_signal' ||
    node.type === 'ecosystem_weather' ||
    node.type === 'theme_condition' ||
    node.type === 'environment_condition' ||
    node.type === 'environment_term' ||
    node.type === 'common_word' ||
    node.type === 'neutral_word' ||
    node.type === 'emotion_word'
  ) return 'conditions';
  return 'conditions';
}

function nodePassesCategoryFilter(node) {
  const category = categoryForNode(node);
  return !!state.categoryFilters[category];
}

function edgePassesCategoryFilter(edge) {
  const source = state.nodeById.get(edge.source);
  const target = state.nodeById.get(edge.target);
  return nodePassesCategoryFilter(source) && nodePassesCategoryFilter(target);
}

function emotionPathPassesCategoryFilter(item) {
  return nodePassesCategoryFilter(item.path?.landing?.node);
}

function firstFilteredNodeId() {
  const ids = state.emotionFilter ? emotionVisibleNodeIds() : new Set(state.nodes.map(node => node.id));
  const node = state.nodes.find(item => ids.has(item.id) && nodePassesCategoryFilter(item));
  return node?.id || null;
}

function hitTest(x, y) {
  const ids = [...neighborhood(state.selectedId)];
  for (let index = ids.length - 1; index >= 0; index--) {
    const node = state.nodeById.get(ids[index]);
    const pos = layoutPositionForNode(ids[index]);
    if (!node || !pos) continue;
    const distance = Math.hypot(x - pos.x, y - pos.y);
    if (distance <= pos.radius + 8) return node;
  }
  return null;
}

function hitTestWordStorage(x, y) {
  const targets = state.perception.wordStorageTargets || [];
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const target = targets[index];
    if (
      x >= target.x &&
      x <= target.x + target.width &&
      y >= target.y &&
      y <= target.y + target.height
    ) {
      return target;
    }
  }
  return null;
}

function canvasScreenPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function canvasPoint(event) {
  const point = canvasScreenPoint(event);
  if (state.graphMode === '3d' || state.view === 'word-storage') return point;
  return screenToGraphPoint(point.x, point.y);
}

function outgoing(id) {
  return state.edges.filter(edge => edge.source === id);
}

function incoming(id) {
  return state.edges.filter(edge => edge.target === id);
}

function familyColor(family) {
  return FAMILY_COLORS[family] || '#8d8176';
}

function nodeColorKey(node) {
  if (!node) return 'neutral';
  if (node.type === 'common_word') return 'common';
  if (node.type === 'neutral_word') return 'neutral';
  if (node.type === 'emotion_word') return 'emotion';
  return node.family || node.id.replace('family-', '');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

init();
