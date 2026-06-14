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
  x: 'Warmth',
  y: 'Light depth',
  z: 'Saturation / clarity'
};

const ENVIRONMENT_CONDITIONS = {
  red: {
    condition: 'heat / activation / urgency',
    climate: 'A high-energy condition where attention, friction, blood, threat, love, or motion can become visible.',
    axes: 'Warm positive X, vivid positive Z, usually below the light midpoint on Y.',
    emotionalUse: 'Emotion reads through activation first; anger, passion, danger, and intensity are possible routes, not automatic meanings.'
  },
  orange: {
    condition: 'motion / release / transition heat',
    climate: 'A moving-warm condition where pressure turns into action, appetite, change, or social signal.',
    axes: 'Warm positive X, vivid positive Z, middle-to-lower Y depending on shade.',
    emotionalUse: 'Emotion reads through momentum; excitement, restlessness, courage, and release can share this climate.'
  },
  yellow: {
    condition: 'signal / exposure / attention',
    climate: 'A bright condition where things become noticeable, named, warned, invited, or brought into daylight.',
    axes: 'Warm positive X, light positive Y, vivid positive Z.',
    emotionalUse: 'Emotion reads through visibility; joy, caution, hope, anxiety, and alertness can all use the same exposed light.'
  },
  green: {
    condition: 'regulation / growth / living balance',
    climate: 'A bridging condition where systems recover, stabilize, grow, or mediate between hotter and cooler states.',
    axes: 'Near the center bridge between warm/cool X, often mid-light Y and moderate-to-vivid Z.',
    emotionalUse: 'Emotion reads through regulation; calm, hope, trust, envy, and endurance depend on the filter around it.'
  },
  blue: {
    condition: 'depth / distance / atmosphere',
    climate: 'A cool-depth condition where reflection, space, water, sky, memory, or emotional distance becomes readable.',
    axes: 'Cool negative X, variable Y, moderate-to-vivid Z.',
    emotionalUse: 'Emotion reads through atmosphere; sadness, serenity, longing, clarity, and fear can land differently inside the same depth.'
  },
  purple: {
    condition: 'threshold / mystery / symbolic pressure',
    climate: 'A boundary condition where red activation and blue depth meet as ritual, imagination, royalty, or inner intensity.',
    axes: 'Cool-to-middle X with vivid Z and usually lower-to-middle Y.',
    emotionalUse: 'Emotion reads through charged ambiguity; awe, desire, grief, power, and transformation can pass through this condition.'
  },
  pink: {
    condition: 'soft contact / tenderness / attachment',
    climate: 'A relational-warm condition where red activation is softened into care, intimacy, vulnerability, or invitation.',
    axes: 'Warm positive X, light-to-middle Y, vivid-to-moderate Z.',
    emotionalUse: 'Emotion reads through contact; affection, embarrassment, sweetness, longing, and tenderness are possible routes.'
  },
  brown: {
    condition: 'ground / body / material memory',
    climate: 'A dense-earth condition where warmth becomes soil, age, shelter, habit, labor, or embodied memory.',
    axes: 'Warm positive X, darker negative Y, muted negative Z.',
    emotionalUse: 'Emotion reads through grounding; comfort, heaviness, nostalgia, fatigue, and steadiness depend on context.'
  },
  gray: {
    condition: 'fog / ambiguity / partial signal',
    climate: 'A low-saturation condition where clarity is reduced, revised, delayed, or suspended between states.',
    axes: 'Centered X, variable Y, muted negative Z.',
    emotionalUse: 'Emotion reads through uncertainty; numbness, doubt, calm, grief, and neutrality stay unresolved until context sharpens them.'
  },
  black: {
    condition: 'absorption / concealment / unknown pressure',
    climate: 'A low-light condition where signal is hidden, compressed, protected, erased, or forced into shadow.',
    axes: 'Dark negative Y, muted negative Z, X depends on undertone.',
    emotionalUse: 'Emotion reads through pressure and visibility loss; fear, grief, seriousness, protection, and reinvention are possible routes.'
  },
  white: {
    condition: 'reflection / openness / undifferentiated possibility',
    climate: 'A high-light condition where signal spreads, reflects, resets, or waits before a filter gives it theme.',
    axes: 'Light positive Y, muted negative Z, centered X.',
    emotionalUse: 'Emotion reads through openness; peace, blankness, hope, exposure, and overwhelm depend on the filter it passes through.'
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
  auth: {
    configured: false,
    checked: false,
    token: sessionStorage.getItem('emotionalTranslator.authToken') || '',
    user: null,
    accounts: []
  },
  nodes: [],
  edges: [],
  nodeById: new Map(),
  customConcepts: [],
  activeThemeFilterIds: [],
  personProfile: null,
  selectedId: null,
  view: 'families',
  query: '',
  emotionFilter: false,
  baseSetting: true,
  categoryFilters: {
    families: true,
    bridges: true,
    aliases: true,
    synonyms: true,
    conditions: true
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
  scale: 1,
  pan: { x: 0, y: 0 }
};

const CUSTOM_CONCEPTS_KEY = 'emotionalTranslator.customConcepts.v1';
const THEME_FILTERS_KEY = 'emotionalTranslator.activeThemeFilters.v1';
const BASE_SETTING_KEY = 'emotionalTranslator.baseSetting.v1';
const PERSONAL_PROFILE_KEY = 'emotionalTranslator.personalProfile.v1';
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

const els = {
  search: document.querySelector('#searchInput'),
  clear: document.querySelector('#clearButton'),
  emotionFilter: document.querySelector('#emotionFilterToggle'),
  baseSetting: document.querySelector('#baseSettingToggle'),
  categoryButtons: document.querySelectorAll('.category-button'),
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
  tabs: document.querySelectorAll('.tab'),
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
  axisView: document.querySelector('#axisViewButton'),
  fit: document.querySelector('#fitButton'),
  copy: document.querySelector('#copyButton')
};

const ctx = els.canvas.getContext('2d');

async function init() {
  try {
    state.data = await loadTranslatorDataset();
    applyEnvironmentConditionGraph(state.data.graph);
    state.nodes = state.data.graph.nodes;
    state.edges = state.data.graph.edges;
    state.nodeById = new Map(state.nodes.map(node => [node.id, node]));
    state.customConcepts = loadCustomConcepts();
    state.activeThemeFilterIds = loadActiveThemeFilters();
    state.baseSetting = loadBaseSetting();
    if (els.baseSetting) els.baseSetting.checked = state.baseSetting;
    state.personProfile = await loadPersonalProfile();
    await loadAuthState();
    state.view = initialViewFromUrl();
    state.graphMode = initialGraphModeFromUrl();
    state.three.axisView = initialAxisViewFromUrl();
    applyAxisView(state.three.axisView);
    state.selectedId = 'family-red';
    buildLayout();
    bindEvents();
    render();
  } catch (error) {
    els.title.textContent = 'Dataset could not load';
    els.content.innerHTML = `<p class="meta">${escapeHtml(error.message)}. Run a local web server from this folder so the browser can fetch the JSON file.</p>`;
  }
}

async function loadTranslatorDataset() {
  const response = await fetch('data/color-synonyms.json');
  if (!response.ok) throw new Error(`Dataset request failed: ${response.status}`);
  const localData = await response.json();

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

function bindEvents() {
  els.authForm?.addEventListener('submit', event => authenticate(event, 'login'));
  els.authCreate?.addEventListener('click', event => authenticate(event, state.auth.configured ? 'register' : 'bootstrap'));
  els.authLogout?.addEventListener('click', logout);
  els.search.addEventListener('input', event => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  els.clear.addEventListener('click', () => {
    state.query = '';
    els.search.value = '';
    render();
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

  els.categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.categoryFilter;
      state.categoryFilters[key] = !state.categoryFilters[key];
      renderCategoryButtons();
      if (!nodePassesCategoryFilter(state.nodeById.get(state.selectedId))) {
        state.selectedId = firstFilteredNodeId() || state.selectedId;
      }
      render();
    });
  });

  els.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      state.view = tab.dataset.view;
      renderTabs();
      renderList();
      if (state.view === 'research' && state.auth.user && !state.research.loaded) loadResearchItems();
    });
  });

  els.fit.addEventListener('click', () => {
    buildLayout();
    drawGraph();
  });

  els.graphMode?.addEventListener('click', () => {
    state.graphMode = nextGraphMode(state.graphMode);
    renderGraphModeButton();
    renderAxisViewButton();
    buildLayout();
    drawGraph();
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
    const pos = state.layout.get(hit.id);
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

  const direct = directNeighborGroups(selected.id);
  const used = new Set([selected.id]);

  placeArc(direct.outgoing, centerX, centerY, firstRing, -70, 70, used, 1);
  placeArc(direct.incoming, centerX, centerY, firstRing, 110, 250, used, 1);
  placeArc(direct.both, centerX, centerY, firstRing, 250, 290, used, 1);

  const second = secondRingNodes(selected.id, used);
  placeSecondRing(second, centerX, centerY, secondRing, used);
}

function directNeighborGroups(selectedId) {
  const outgoingIds = new Set(outgoing(selectedId).map(edge => edge.target));
  const incomingIds = new Set(incoming(selectedId).map(edge => edge.source));
  const both = [...outgoingIds].filter(id => incomingIds.has(id)).map(id => state.nodeById.get(id)).filter(Boolean);
  const bothIds = new Set(both.map(node => node.id));

  return {
    outgoing: [...outgoingIds].filter(id => !bothIds.has(id)).map(id => state.nodeById.get(id)).filter(Boolean).sort(sortNodesForLayout),
    incoming: [...incomingIds].filter(id => !bothIds.has(id)).map(id => state.nodeById.get(id)).filter(Boolean).sort(sortNodesForLayout),
    both: both.sort(sortNodesForLayout)
  };
}

function placeArc(nodes, centerX, centerY, radius, startDeg, endDeg, used, ring) {
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
      ring
    });
    used.add(node.id);
  });
}

function secondRingNodes(selectedId, used) {
  const second = new Map();
  [...used].forEach(parentId => {
    if (parentId === selectedId) return;
    [...outgoing(parentId), ...incoming(parentId)].forEach(edge => {
      const otherId = edge.source === parentId ? edge.target : edge.source;
      if (used.has(otherId) || otherId === selectedId || second.has(otherId)) return;
      const node = state.nodeById.get(otherId);
      if (!node) return;
      const parentPos = state.layout.get(parentId);
      const parentAngle = parentPos ? Math.atan2(parentPos.y - (els.canvas.clientHeight || 560) / 2, parentPos.x - (els.canvas.clientWidth || 900) / 2) : 0;
      second.set(otherId, { node, parentAngle });
    });
  });
  return [...second.values()].sort((a, b) => a.parentAngle - b.parentAngle || sortNodesForLayout(a.node, b.node));
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
      const spread = (index - (sorted.length - 1) / 2) * degToRad(13);
      const degreePull = Math.min(38, graphDegree(node.id, visibleSet) * 2.2);
      const radius = baseRadius + radiusStep * Math.min(distance, 3) - degreePull;
      const nodeAngle = angle + spread + (distance - 1) * degToRad(6);
      state.layout.set(node.id, {
        x: clamp(centerX + Math.cos(nodeAngle) * radius, 34, width - 34),
        y: clamp(centerY + Math.sin(nodeAngle) * radius, 34, height - 34),
        radius: nodeRadius(node),
        ring: distance,
        centrality: graphDegree(node.id, visibleSet),
        cluster: cluster.key
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
      const laneKey = `${distance}|${cluster}`;
      const laneIndex = lanes.get(laneKey) || 0;
      lanes.set(laneKey, laneIndex + 1);
      const jitter = scatterJitter(node.id, laneIndex);
      const x = margin.left + plotWidth * degreeRatio + jitter.x;
      const y = margin.top + plotHeight * distanceRatio + jitter.y;

      state.layout.set(node.id, {
        x: clamp(x, margin.left + 18, width - margin.right - 18),
        y: clamp(y, margin.top + 18, height - margin.bottom - 18),
        radius: nodeRadius(node, node.id === selected.id),
        ring: distance,
        distance,
        centrality: degree,
        cluster
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
  const position = state.layout.get(node.id);
  return {
    degree: incomingCount + outgoingCount,
    incoming: incomingCount,
    outgoing: outgoingCount,
    cluster: topologyClusterKey(node),
    distance: position?.distance ?? position?.ring ?? 0,
    centrality: position?.centrality ?? incomingCount + outgoingCount
  };
}

function sortNodesForLayout(a, b) {
  const rank = { family: 0, environment_condition: 1, environment_term: 2, subfamily: 3, shade: 4, alias: 5, synonym: 6, emotion_word: 7, common_word: 8, neutral_word: 9 };
  return (rank[a.type] ?? 9) - (rank[b.type] ?? 9) || a.label.localeCompare(b.label);
}

function nodeRadius(node, selected = false) {
  if (selected) return 34;
  if (state.graphMode === 'topology' || state.graphMode === 'scatter' || state.graphMode === '3d') {
    const degreeBoost = Math.min(10, graphDegree(node.id) * 0.45);
    if (node.type === 'family') return 28 + degreeBoost;
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
  renderGraphModeButton();
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
    els.context.innerHTML = `
      <div class="context-heading">Input context layer</div>
      <p class="context-copy">Type a feeling, phrase, everyday word, or color. The translator will explain the path into color before offering evocative names.</p>
    `;
    return;
  }

  const analysis = analyzeInputContext(state.query);
  const translation = resolveTranslation(state.query, analysis);
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
      ${showBase ? `
        <div class="context-heading">Translation path</div>
        ${primaryPath ? renderTranslationPath(primaryPath) : `<p class="meta">${escapeHtml(result.unresolvedReason || 'No color landing found.')}</p>`}
      ` : renderBaseSettingOffNotice(result)}
      ${result.emotionalRead ? renderEmotionalRead(result.emotionalRead) : ''}
      ${result.emotionalBlend ? renderEmotionalBlend(result.emotionalBlend) : ''}
      ${result.emotionConnections?.length ? renderEmotionConnections(result.emotionConnections) : ''}
      ${result.evocativeAssociation ? renderEvocativeAssociation(result.evocativeAssociation, showBase) : ''}
      ${result.themeComposition ? renderThemeComposition(result.themeComposition) : ''}
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

function renderBaseSettingOffNotice(result) {
  const hasInterpretiveLayer = result.emotionalRead || result.emotionalBlend || result.emotionConnections?.length || result.evocativeAssociation || result.themeComposition || result.themeRead || result.humanBridges?.length;
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
  return `
    <div class="translation-section">
      <div class="context-heading">Theme composition</div>
      <div class="theme-composition">
        <div class="composition-head">
          <strong>${escapeHtml(isComposed ? composition.composedClimate : composition.theme.label)}</strong>
          <span>${escapeHtml(isComposed ? 'composed climate' : 'base climate')}</span>
        </div>
        ${composition.categoryMap?.length ? renderCompositionCategoryMap(composition.categoryMap) : ''}
        ${isComposed ? `
          <div class="composition-pair">
            ${composition.themes.map(theme => `
              <span>
                <strong>${escapeHtml(theme.label)}</strong>
                <small>${escapeHtml(theme.baseClimate)}</small>
              </span>
            `).join('')}
          </div>
          <dl>
            <dt>Color shift</dt>
            <dd>${escapeHtml(composition.colorShift)}</dd>
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
            <dt>Base climate</dt>
            <dd>${escapeHtml(composition.theme.baseClimate)}</dd>
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
        <p>${escapeHtml(read.emotionalClimate)}</p>
        <small>${escapeHtml(read.boundary)}</small>
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
    <div class="translation-path">
      <strong>${path.nodes.map(escapeHtml).join(' -> ')}</strong>
      <span>${escapeHtml(path.confidence)} confidence · ${escapeHtml(path.edgeTypes.join(', ') || 'direct match')}</span>
      ${path.evidence.length ? `<span>${escapeHtml(path.evidence.join(' | '))}</span>` : ''}
    </div>
  `;
}

function renderLanding(landing, confidence) {
  const target = landing.node;
  const family = landing.family;
  return `
    <button class="landing-card" type="button" onclick="selectNode('${target.id}')">
      <span class="dot" style="background:${familyColor(family)}"></span>
      <span>
        <strong>${escapeHtml(target.label)}</strong>
        <span>${escapeHtml(landing.kind)} · ${escapeHtml(family)} · ${escapeHtml(confidence)} confidence</span>
      </span>
    </button>
  `;
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
  const counts = {
    Families: state.nodes.filter(node => node.type === 'family').length,
    Bridges: state.nodes.filter(node => node.type === 'subfamily').length,
    Shades: state.nodes.filter(node => node.type === 'shade').length,
    Aliases: state.nodes.filter(node => node.type === 'alias').length,
    Synonyms: state.nodes.filter(node => node.type === 'synonym').length,
    Conditions: state.nodes.filter(node => node.type === 'environment_condition' || node.type === 'environment_term').length,
    Emotions: state.nodes.filter(node => node.type === 'emotion_word').length,
    Common: state.nodes.filter(node => node.type === 'common_word').length,
    Edges: state.edges.length,
    Neutral: neutralTerms().length,
    Themes: state.data.themeComposition?.categories?.length || 0,
    Saved: state.customConcepts.length,
    Filters: state.activeThemeFilterIds.length
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

function renderTabs() {
  els.tabs.forEach(tab => {
    tab.classList.toggle('is-active', tab.dataset.view === state.view);
  });
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
  if (state.view === 'research') {
    renderResearchInbox();
    return;
  }

  if (state.view === 'shared-graph') {
    renderSharedGraphEditor();
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
    renderFamilyGroupedNodeList(['subfamily', 'shade'], 'bridges');
    return;
  }

  if (state.view === 'aliases') {
    renderFamilyGroupedNodeList('alias', 'aliases');
    return;
  }

  if (state.view === 'synonyms') {
    renderFamilyGroupedNodeList('synonym', 'synonyms');
    return;
  }

  const type = state.view === 'families' ? 'family' : state.view === 'bridges' ? ['subfamily', 'shade'] : state.view === 'aliases' ? 'alias' : state.view === 'synonyms' ? 'synonym' : state.view === 'emotions' ? 'emotion_word' : 'common_word';
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

function renderResearchSuggestions(suggestions) {
  const matches = suggestions.graphMatches || [];
  return `
    <div class="research-suggestions">
      <div class="governance-head"><strong>Possible graph context</strong><span class="status-pill">${escapeHtml(suggestions.strength || 'unresolved')}</span></div>
      ${matches.length ? `<div class="research-chips">${matches.map(match => `<span>${escapeHtml(match.label)} · ${escapeHtml(match.type)}${match.family ? ` · ${escapeHtml(match.family)}` : ''}</span>`).join('')}</div>` : '<p class="meta">No lexical graph leads found.</p>'}
      <p class="meta">${escapeHtml(suggestions.boundary || '')}</p>
    </div>`;
}

function renderResearchResult(item, index) {
  return `
    <form class="research-record research-result" data-save-research="${index}">
      <div class="governance-head">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.sourceName)} · ${escapeHtml(item.sourceType)}</span>
      </div>
      <p>${escapeHtml(item.excerpt || 'No abstract or excerpt supplied by this source.')}</p>
      <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Open source</a>
      <div class="research-evidence-form">
        <label class="form-wide"><span>Emotional or relational logic</span><textarea name="emotionalLogic" rows="2" placeholder="What structured relation might this evidence help explain?"></textarea></label>
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
        sourceName: candidate.sourceName,
        sourceType: candidate.sourceType,
        sourceUrl: candidate.url,
        excerpt: candidate.excerpt,
        publishedAt: candidate.publishedAt,
        suggestions: { ...(state.research.suggestions || {}), externalId: candidate.externalId, retrievedAt: candidate.retrievedAt },
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
          <legend>Optional relationship and structured evidence</legend>
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
            <span>Evidence or reason</span>
            <textarea name="evidence" rows="3" placeholder="Explain why this connection is defensible."></textarea>
          </label>
          <label>
            <span>Evidence source</span>
            <input name="evidenceSource" placeholder="Dictionary, study, observation, system rule">
          </label>
          <label>
            <span>Evidence type</span>
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
  bindGovernanceActions();
  if (isAdmin && !state.governance.loaded && !state.governance.loading && available) loadGovernanceData();
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
      <div class="governance-actions">${item.undone_at ? '<span class="meta">Already undone</span>' : `<button type="button" data-undo-history="${item.id}">Undo this change</button>`}</div>
    </article>
  `).join('');
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
  state.data = localData;
  state.nodes = localData.graph.nodes;
  state.edges = localData.graph.edges;
  state.nodeById = new Map(state.nodes.map(node => [node.id, node]));
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
    { id: 'common_word', label: 'Common word / concept' },
    { id: 'emotion_word', label: 'Emotion word' },
    { id: 'neutral_word', label: 'Neutral word' },
    { id: 'alias', label: 'Color alias' },
    { id: 'synonym', label: 'Color synonym' },
    { id: 'shade', label: 'Natural shade' },
    { id: 'subfamily', label: 'Bridge / mixed family' },
    { id: 'environment_term', label: 'Environment condition term' },
    { id: 'theme', label: 'Theme context' }
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
  const position = activeColor ? shadePosition(activeColor) : null;
  const comparable = shadeComparableNodes()
    .filter(item => !state.emotionFilter || emotionVisibleNodeIds().has(item.node.id))
    .filter(item => nodePassesCategoryFilter(item.node))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.node.label.localeCompare(b.node.label));

  els.list.innerHTML = `
    <section class="shade-tool">
      <div class="theme-filter-summary">
        <strong>Hex / RGB converter</strong>
        <span>Type a hex or RGB value in Search, or select a color node. The shade graph compares words by measurable color position.</span>
      </div>
      ${activeColor ? renderColorConversionCard(activeLabel, activeColor, position) : '<p class="meta">Select a color word or type a value like #6c8499, rgb(108,132,153), or 108 132 153.</p>'}
      ${position ? renderShadeAxisCard(position) : ''}
      <div class="shade-axis-legend">
        <span><strong>X</strong> ${SHADE_AXIS_LABELS.x}: cool -100 to warm +100</span>
        <span><strong>Y</strong> ${SHADE_AXIS_LABELS.y}: dark -100 to light +100</span>
        <span><strong>Z</strong> ${SHADE_AXIS_LABELS.z}: muted -100 to vivid +100</span>
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
  return `
    <div class="shade-axis-card">
      ${[
        ['X', SHADE_AXIS_LABELS.x, position.x, -100, 100],
        ['Y', SHADE_AXIS_LABELS.y, position.y, -100, 100],
        ['Z', SHADE_AXIS_LABELS.z, position.z, -100, 100]
      ].map(([axis, label, value, min, max]) => {
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
  const left = clamp((item.position.x + 100) / 2, 0, 100);
  const top = clamp(50 - item.position.y / 2, 0, 100);
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
  const shade = color ? shadePosition(color) : null;
  return `
    <button class="natural-atlas-card" type="button" data-node-id="${escapeHtml(item.node.id)}">
      <span class="shade-large-swatch" style="background:${escapeHtml(color?.hex || familyColor(item.family))}"></span>
      <span>
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(item.source)} source · ${escapeHtml(item.family)} family</small>
        ${condition ? `<em>${escapeHtml(condition.condition)}</em>` : ''}
        <small>${shade ? `X ${shade.x} · Y ${shade.y} · Z ${shade.z}` : 'No shade position'}</small>
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
  }).join('') : '<p class="meta">No theme categories yet.</p>';
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
        <strong>Active theme filters</strong>
        <span>${activeThemes.length ? activeThemes.map(theme => theme.label).join(' + ') : 'none'}</span>
      </div>
      <p class="meta">Active filters are added to typed searches as a relational frame. They do not become strict color synonyms.</p>
      <div class="theme-filter-list">
        ${activeThemes.length ? activeThemes.map(theme => renderThemeFilterButton(theme, true)).join('') : '<p class="meta">No active filters. Add one below.</p>'}
      </div>
    </section>
    ${[...inactiveByCategory.entries()].map(([category, categoryThemes]) => `
      <section class="association-section">
        <div class="alias-family-heading">
          <span class="dot" style="background:${familyColor(anchorsForCategory(category)[0] || 'common')}"></span>
          <strong>${escapeHtml(category)}</strong>
          <span>${categoryThemes.length} filters</span>
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
        <small>${escapeHtml(theme.category)} · ${escapeHtml(theme.baseClimate || 'custom theme filter')}</small>
      </span>
      <span class="pill">${active ? 'Remove' : 'Add'}</span>
    </button>
  `;
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
  render();
}

function renderCustomConceptList() {
  if (!state.customConcepts.length) {
    els.list.innerHTML = '<p class="meta">Search for a word or concept, then add it to save it under a theme category.</p>';
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
        ['Exact matches', results.exact.filter(nodePassesCategoryFilter).map(node => renderNodeListItem(node))],
        ['Emotion paths', results.emotions.filter(emotionPathPassesCategoryFilter).map(item => renderEmotionPathListItem(item))],
        ['Connected matches', results.connected.filter(item => nodePassesCategoryFilter(item.node)).map(item => renderNodeListItem(item.node, item.reason))],
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

function renderNodeListItem(node, reason = '') {
  const family = nodeColorKey(node);
  const typeInfo = nodeTypeInfo(node.type);
  const nodeColor = colorForNode(node)?.hex || familyColor(family);
  return `
    <button class="list-item ${node.id === state.selectedId ? 'is-active' : ''}" type="button" data-node-id="${node.id}">
      <span class="dot" style="background:${escapeHtml(nodeColor)}"></span>
      <span>
        <span class="item-title">${escapeHtml(node.label)}</span>
        <span class="item-subtitle">${escapeHtml(typeInfo.label)}${family ? ` · ${escapeHtml(family)}` : ''}${reason ? ` · ${escapeHtml(reason)}` : ''}</span>
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
        <span>Theme category: ${escapeHtml(prompt.category.label)}</span>
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
    signals.push('theme layer');
    routes.push({
      title: `${item.term} -> ${item.categoryLabel} layer`,
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
    label = 'Theme layer term';
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
  const primaryPath = rankedPaths[0];
  const primaryLanding = primaryPath?.landing || null;
  const themeComposition = themeCompositionForQuery(normalized);
  const themeRead = themeReadForTranslation(normalized, primaryPath, rankedPaths, themeComposition);
  const humanBridges = humanBridgesForTranslation(normalized, rankedPaths, themeRead, themeComposition);
  const logicChecks = logicChecksForTranslation(themeRead, humanBridges, primaryPath);
  const emotionConnections = emotionConnectionsForTranslation(rankedPaths, themeComposition);
  const evocativeAssociation = evocativeAssociationForTranslation(primaryPath, emotionConnections, themeRead);
  const personalRead = personalOverlayForTranslation(normalized, {
    paths: rankedPaths,
    primaryLanding,
    themeComposition,
    themeRead,
    emotionConnections
  });

  return {
    input: normalized,
    contextState: analysis.stateId,
    confidence: primaryPath?.confidence || 'low',
    paths: rankedPaths,
    emotionalRead: emotionalReadForPath(primaryPath, normalized),
    emotionalBlend: emotionalBlendForPaths(rankedPaths, normalized),
    emotionConnections,
    evocativeAssociation,
    themeComposition,
    personalRead,
    themeRead,
    humanBridges,
    logicChecks,
    primaryLanding,
    alternativeLandings: rankedPaths.slice(1, 5),
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

function rankTranslationPaths(paths) {
  const confidenceRank = { high: 0, medium: 1, low: 2 };
  const kindRank = { alias: 0, synonym: 1, family: 2, bridge: 3, shade: 4 };
  return [...paths].sort((a, b) => {
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
    if (theme.id === 'season' && candidates.some(item => item.category === 'Season' && item.id !== 'season')) return;
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
  const categoryBonus = ['Religion', 'Season'].includes(theme.category) && !['religion', 'season'].includes(theme.id) ? 50 : 0;
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
    entries: Array.isArray(seedEntries) ? seedEntries.map(normalizePersonalEntry).filter(Boolean) : [],
    updatedAt: seed.updatedAt || new Date().toISOString()
  };
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

function saveBaseSetting() {
  try {
    localStorage.setItem(BASE_SETTING_KEY, String(state.baseSetting));
  } catch {
    // If storage is unavailable, keep the switch state for this session only.
  }
}

function ensurePersonalProfile() {
  if (!state.personProfile) state.personProfile = normalizePersonalProfile();
  return state.personProfile;
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
  if (!profile?.entries?.length) return null;
  const matches = matchingPersonalEntries(query, profile.entries);
  if (!matches.length) return null;

  const personalFamilies = uniqueStrings(matches.flatMap(entry => entry.families || []));
  const personalThemes = uniqueStrings(matches.flatMap(entry => entry.themes || []));
  const sharedFamilies = uniqueStrings((translation.paths || []).map(path => path.landing?.family).filter(Boolean));
  const climateFamilies = uniqueStrings([...personalFamilies, ...sharedFamilies]).slice(0, 6);
  const sharedRoute = translation.paths?.[0]?.nodes?.join(' -> ')
    || translation.themeRead?.route
    || translation.themeComposition?.composedClimate
    || 'no shared baseline route';
  const contextSummary = matches
    .map(entry => `${entry.term} (${profileContextLabel(entry.contextType)})`)
    .join(' + ');
  const logic = matches
    .map(entry => entry.emotionalLogic)
    .filter(Boolean)
    .join(' ');

  return {
    title: `${query || matches[0].term} as personal climate`,
    strength: matches.length > 1 ? 'layered personal overlay' : 'personal overlay',
    sharedRoute,
    personalContext: contextSummary,
    personalClimateShift: climateFamilies.length
      ? `${climateFamilies.join(' + ')} becomes more relevant for this person${personalThemes.length ? ` through ${personalThemes.join(' + ')}` : ''}.`
      : 'The profile changes the interpretation, but no color family has been linked yet.',
    emotionalLogic: logic || 'Saved life context changes how this term should be approached for this person.',
    entries: matches,
    boundary: uniqueStrings(matches.map(entry => entry.boundary).filter(Boolean)).join(' ') || personalProfileBoundary()
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
    const anchorIds = themeComposition.anchorIds || [];
    return {
      id: `theme-composition-${anchorIds.join('-') || themeComposition.composedClimate.toLowerCase().replaceAll(' ', '-')}`,
      source: 'theme input',
      filter: themeComposition.themes.map(theme => theme.label).join(' + '),
      theme: themeComposition.composedClimate,
      route: `${themeComposition.themes.map(theme => theme.label).join(' + ')} -> ${themeComposition.composedClimate}`,
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
      sharedStructure: explicit.sharedStructure,
      emotionalClimate: explicit.emotionalClimate,
      boundary: explicit.boundary,
      anchorIds: explicit.anchorIds || [],
      explicit: true
    };
  }

  if (themeComposition) {
    const anchorIds = themeComposition.anchorIds || themeComposition.theme?.anchorIds || [];
    const themeLabel = themeComposition.kind === 'composed' ? themeComposition.composedClimate : themeComposition.theme.label;
    return {
      id: `theme-composition-${anchorIds.join('-') || themeLabel.toLowerCase().replaceAll(' ', '-')}`,
      source: 'theme input',
      filter: themeComposition.kind === 'composed' ? themeComposition.themes.map(theme => theme.label).join(' + ') : themeComposition.theme.label,
      theme: themeLabel,
      route: themeComposition.kind === 'composed'
        ? `${themeComposition.themes.map(theme => theme.label).join(' + ')} -> ${themeComposition.composedClimate}`
        : `${themeComposition.theme.label} -> ${themeComposition.theme.baseClimate}`,
      sharedStructure: themeComposition.kind === 'composed' ? themeComposition.meaningShift : themeComposition.theme.baseClimate,
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
    return {
      id: `theme-blend-${emotionNodes.map(node => node.id).join('-')}`,
      source: 'feeling signal',
      filter: `${emotionNodes.map(node => node.label).join(' / ')} filters`,
      theme: 'blended climate',
      route: `feeling signal + ${emotionNodes.map(node => node.label).join(' / ')} filters -> blended climate`,
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
function renderDetail() {
  const node = state.nodeById.get(state.selectedId);
  if (!node) return;

  const family = nodeColorKey(node);
  const selectedColor = colorForNode(node)?.hex || familyColor(family);
  els.title.textContent = node.label;
  els.swatch.style.background = selectedColor;
  els.swatch.style.borderBottomColor = family === 'white' ? '#d8d2c8' : selectedColor;

  const outgoingEdges = outgoing(node.id);
  const incomingEdges = incoming(node.id);
  const directionPolicy = state.data.graph.directionPolicy || {};
  const typeInfo = nodeTypeInfo(node.type);
  const metadata = node.metadata || {};
  const graphStats = graphTheoryStats(node);
  const nodeEmotionConnections = emotionConnectionsForNode(node);
  const shade = shadeInfoForNode(node);
  const environmentCondition = environmentConditionForNode(node);

  els.content.innerHTML = `
    <section class="detail-section">
      <h3>Node</h3>
      <div class="chip-list">
        <span class="chip">${escapeHtml(typeInfo.label)}</span>
        ${family ? `<span class="chip">${escapeHtml(family)}</span>` : ''}
        ${metadata.definitionBasis ? `<span class="chip">${escapeHtml(metadata.definitionBasis)}</span>` : ''}
      </div>
    </section>
    ${shade ? renderShadeDetailBlock(shade) : ''}
    ${environmentCondition ? renderEnvironmentCondition(environmentCondition) : ''}
    ${detailBlock('Graph Theory', `Degree ${graphStats.degree}; ${escapeHtml(graphStats.cluster)} cluster; path distance ${graphStats.distance}; ${graphStats.incoming} routes in / ${graphStats.outgoing} routes out.`)}
    ${detailBlock('What This Node Means', `${escapeHtml(typeInfo.simpleDefinition)} ${escapeHtml(typeInfo.plainRole)}`)}
    ${metadata.definition ? detailBlock('Definition', metadata.definition) : ''}
    ${metadata.contextDefinition ? detailBlock('Context Definition', metadata.contextDefinition) : ''}
    ${metadata.emotionDefinition ? detailBlock('Emotion Definition', metadata.emotionDefinition) : ''}
    ${metadata.definitionPhrase ? detailBlock('Definition Phrase', metadata.definitionPhrase) : ''}
    ${metadata.naturalNameBasis ? detailBlock('Shade Naming Basis', metadata.naturalNameBasis) : ''}
    ${metadata.evidence ? detailBlock('Evidence', metadata.evidence) : ''}
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
    <section class="detail-section">
      <h3>${escapeHtml(directionPolicy.outgoingLabel || 'Routes From This Node')}</h3>
      <p class="meta">${escapeHtml(directionPolicy.outgoingDefinition || 'Edges where this node is the source.')}</p>
      <div class="edge-list">${renderEdges(outgoingEdges, 'outgoing')}</div>
    </section>
    <section class="detail-section">
      <h3>${escapeHtml(directionPolicy.incomingLabel || 'Routes Into This Node')}</h3>
      <p class="meta">${escapeHtml(directionPolicy.incomingDefinition || 'Edges where this node is the target.')}</p>
      <div class="edge-list">${renderEdges(incomingEdges, 'incoming')}</div>
    </section>
  `;
}

function detailBlock(title, value) {
  return `<section class="detail-section"><h3>${title}</h3><p class="meta">${value}</p></section>`;
}

function renderEnvironmentCondition(condition) {
  return `
    <section class="detail-section">
      <h3>Environment Condition</h3>
      <div class="environment-condition">
        <div class="composition-head">
          <strong>${escapeHtml(condition.title)}</strong>
          <span>${escapeHtml(condition.status)}</span>
        </div>
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

function renderEdges(edges, direction) {
  if (!edges.length) return '<p class="meta">No connections.</p>';
  return edges.slice(0, 12).map(edge => {
    const source = state.nodeById.get(edge.source);
    const target = state.nodeById.get(edge.target);
    const selectedIsSource = edge.source === state.selectedId;
    const roleLabel = selectedIsSource ? 'starts here' : 'arrives here';
    const nextId = selectedIsSource ? edge.target : edge.source;
    return `
      <button class="edge-row ${direction === 'incoming' ? 'is-incoming' : 'is-outgoing'}" type="button" onclick="selectNode('${nextId}')">
        <strong>${escapeHtml(source?.label || edge.source)} -> ${escapeHtml(target?.label || edge.target)}</strong>
        <span class="edge-role">${escapeHtml(roleLabel)} · ${escapeHtml(edge.type)}</span>
        <span>${escapeHtml(edgeMeaning(edge))}</span>
        ${edge.evidence ? `<span class="edge-evidence">${escapeHtml(edge.evidence)}</span>` : ''}
      </button>
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
  const mix = color.mixInfo;
  return `
    <section class="detail-section shade-detail-block">
      <h3>Shade Position</h3>
      <div class="shade-conversion-card compact">
        <span class="shade-large-swatch" style="background:${escapeHtml(color.hex)}"></span>
        <div>
          <strong>${escapeHtml(color.hex)}</strong>
          <span>RGB ${color.r}, ${color.g}, ${color.b} · HSL ${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(color.l)}%</span>
          <span>X ${pos.x} ${SHADE_AXIS_LABELS.x}; Y ${pos.y} ${SHADE_AXIS_LABELS.y}; Z ${pos.z} ${SHADE_AXIS_LABELS.z}</span>
        </div>
      </div>
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
  return {
    color,
    position: shadePosition(color)
  };
}

function shadeComparableNodes() {
  return state.nodes
    .filter(node => ['family', 'environment_condition', 'environment_term', 'subfamily', 'shade', 'alias', 'synonym', 'emotion_word', 'common_word', 'neutral_word'].includes(node.type))
    .map(node => {
      const color = colorForNode(node);
      if (!color) return null;
      return { node, color, position: shadePosition(color) };
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

function shadePosition(color) {
  const warmth = warmthFromHue(color.h, color.s);
  return {
    x: Math.round(warmth),
    y: Math.round((color.l - 50) * 2),
    z: Math.round((color.s - 50) * 2)
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
      label: 'Color family',
      simpleDefinition: 'A main color group, like red, blue, green, black, or white.',
      plainRole: 'This is the broad color bucket where related color words land.'
    },
    alias: {
      label: 'Color word',
      simpleDefinition: 'A real color name that belongs to a color family.',
      plainRole: 'This is a specific color word people can search for directly.'
    },
    synonym: {
      label: 'Cited synonym',
      simpleDefinition: 'A word connected by dictionary or thesaurus evidence.',
      plainRole: 'This helps the graph move from one real word to another without guessing.'
    },
    subfamily: {
      label: 'Color bridge',
      simpleDefinition: 'An in-between color zone made from two color families, like red-orange or blue-gray.',
      plainRole: 'This makes it easier to see how one family connects to another.'
    },
    shade: {
      label: 'Shade phrase',
      simpleDefinition: 'A real definition phrase that says how a color leans, like reddish orange or bluish gray.',
      plainRole: 'This explains the exact wording that creates a cross-family connection.'
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
      plainRole: 'This connects condition language to color climate without claiming a dictionary synonym.'
    }
  };
  return state.data.graph.nodeTypeDefinitions?.[type] || fallback[type] || {
    label: type,
    simpleDefinition: 'A graph item.',
    plainRole: 'This participates in graph routes.'
  };
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

  const visibleNodeIds = neighborhood(state.selectedId);
  const visibleEdges = visibleGraphEdges(visibleNodeIds);

  if (state.graphMode === 'scatter') {
    drawScatterGuides(rect.width, rect.height, visibleNodeIds);
  } else {
    drawSpiderGuides(rect.width, rect.height);
  }
  visibleEdges.forEach(edge => drawEdge(edge));
  [...visibleNodeIds].forEach(id => drawNode(state.nodeById.get(id)));
  if (els.graphHint) {
    const hints = {
      ring: 'Squares are families, pills are bridge colors, diamonds are exact shade phrases. Drag nodes to rearrange the web.',
      topology: 'Graph theory view: closer nodes have shorter paths, larger nodes are higher-degree hubs, and clusters group by family or type.',
      scatter: 'Connected scatter plot: x shows degree centrality, y shows path distance from the selected node, and lines keep the relational routes visible.',
      '3d': '3D color web: stable X/Y/Z positions. Use axis view to look through X, Y, or Z; drag for a custom view; click a sphere to inspect it.'
    };
    els.graphHint.textContent = hints[state.graphMode] || hints.ring;
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

  const visibleNodeIds = [...neighborhood(state.selectedId)].filter(id => state.nodeById.has(id));
  const visibleSet = new Set(visibleNodeIds);
  const distances = graphDistances(state.selectedId, visibleSet);
  const positions = threeCanvasPositions(visibleNodeIds, distances, sizedRect.width, sizedRect.height);
  state.three.projected = positions;

  visibleGraphEdges(new Set(visibleNodeIds)).forEach(edge => drawThreeCanvasEdge(edge, positions));
  [...positions.entries()]
    .sort(([, a], [, b]) => a.depth - b.depth)
    .forEach(([id, pos]) => drawThreeCanvasNode(state.nodeById.get(id), pos, id === state.selectedId));

  if (els.graphHint) {
    els.graphHint.textContent = '3D color web: stable X/Y/Z positions. Use axis view to look through X, Y, or Z; drag for a custom view; click a sphere to inspect it.';
  }
}

function threeCanvasPositions(ids, distances, width, height) {
  const map = new Map();
  const scaleBase = Math.min(width, height) / 390;

  ids.forEach(id => {
    const node = state.nodeById.get(id);
    const color = colorForNode(node) || parseColorInput(familyColor(nodeColorKey(node)));
    const shade = shadePosition(color);
    const x0 = shade.x * 2.2;
    const y0 = shade.y * 1.55;
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
  const axes = [
    {
      key: 'X',
      label: 'X warmth',
      color: 'rgba(174, 69, 49, 0.72)',
      ticks: [-100, -50, 0, 50, 100],
      point: value => [value * 2.2, 0, 0],
      note: ['cool -100', 'warm +100']
    },
    {
      key: 'Y',
      label: 'Y light-depth',
      color: 'rgba(56, 97, 148, 0.72)',
      ticks: [-100, -50, 0, 50, 100],
      point: value => [0, value * 1.55, 0],
      note: ['dark -100', 'light +100']
    },
    {
      key: 'Z',
      label: 'Z saturation / clarity',
      color: 'rgba(68, 126, 99, 0.72)',
      ticks: [-100, -50, 0, 50, 100],
      point: value => [0, 0, value * 1.55],
      note: ['muted -100', 'vivid +100']
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
  ctx.fillText('X: cool -100 to warm +100', width * 0.12, height * 0.9);
  ctx.fillText('Y: dark -100 to light +100', width * 0.12, height * 0.93);
  ctx.fillText('Z: muted -100 to vivid +100', width * 0.12, height * 0.96);
  ctx.restore();
}

function drawThreeCanvasEdge(edge, positions) {
  const source = positions.get(edge.source);
  const target = positions.get(edge.target);
  if (!source || !target) return;
  const targetNode = state.nodeById.get(edge.target);
  const active = edge.source === state.selectedId || edge.target === state.selectedId;
  ctx.save();
  ctx.strokeStyle = active ? familyColor(targetNode?.family || nodeColorKey(targetNode)) : 'rgba(104, 112, 122, 0.24)';
  ctx.globalAlpha = active ? 0.62 : 0.34;
  ctx.lineWidth = active ? 2 : 1;
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.restore();
}

function drawThreeCanvasNode(node, pos, selected) {
  if (!node) return;
  const gradient = ctx.createRadialGradient(pos.x - pos.radius * 0.35, pos.y - pos.radius * 0.45, 1, pos.x, pos.y, pos.radius * 1.4);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.2, pos.color.hex);
  gradient.addColorStop(1, shadeColor(pos.color.hex, -32));
  ctx.save();
  ctx.globalAlpha = clamp(0.58 + pos.perspective * 0.42, 0.45, 1);
  ctx.fillStyle = gradient;
  ctx.strokeStyle = selected ? '#20252b' : 'rgba(32, 37, 43, 0.42)';
  ctx.lineWidth = selected ? 3 : 1;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, pos.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (selected || pos.radius > 8.5) {
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
    els.graphHint.textContent = '3D color web: stable X/Y/Z positions. Use axis view to look through X, Y, or Z; drag for a custom view; click a sphere to inspect it.';
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

  const visibleNodeIds = [...neighborhood(state.selectedId)].filter(id => state.nodeById.has(id));
  const visibleSet = new Set(visibleNodeIds);
  const distances = graphDistances(state.selectedId, visibleSet);
  const nodePositions = new Map();

  visibleNodeIds.forEach(id => {
    const node = state.nodeById.get(id);
    const color = colorForNode(node) || parseColorInput(familyColor(nodeColorKey(node)));
    const shade = shadePosition(color);
    const pos = {
      x: shade.x * 2.15,
      y: shade.y * 1.7,
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

  visibleGraphEdges(new Set(visibleNodeIds)).forEach(edge => {
    const source = nodePositions.get(edge.source);
    const target = nodePositions.get(edge.target);
    if (!source || !target) return;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(source.x, source.y, source.z),
      new THREE.Vector3(target.x, target.y, target.z)
    ]);
    const targetNode = state.nodeById.get(edge.target);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(edge.type === 'emotion_association' ? familyColor('emotion') : familyColor(targetNode?.family || nodeColorKey(targetNode))),
      transparent: true,
      opacity: edge.source === state.selectedId || edge.target === state.selectedId ? 0.58 : 0.22
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
  const positions = [...visibleNodeIds].map(id => state.layout.get(id)).filter(Boolean);
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
  const selected = state.layout.get(state.selectedId);
  if (!selected) return;
  const direct = [...state.layout.values()].filter(pos => pos.ring === 1);
  const second = [...state.layout.values()].filter(pos => pos.ring === 2);
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

function drawEdge(edge) {
  const source = state.layout.get(edge.source);
  const target = state.layout.get(edge.target);
  if (!source || !target) return;
  const targetNode = state.nodeById.get(edge.target);
  const sourceNode = state.nodeById.get(edge.source);
  const landsOnFamily = targetNode?.type === 'family' && sourceNode?.type !== 'family';
  const landsOnBridge = targetNode?.type === 'subfamily' || targetNode?.type === 'shade';
  const isConditionEdge = edge.type === 'environment_condition' || edge.type === 'condition_has_synonym';

  ctx.save();
  ctx.strokeStyle = landsOnFamily || landsOnBridge
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
  ctx.lineWidth = landsOnFamily ? 3.2 : landsOnBridge || isConditionEdge ? 2.8 : edge.source === state.selectedId || edge.target === state.selectedId ? 2.5 : 1.2;
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();

  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const arrowX = target.x - Math.cos(angle) * (target.radius + 2);
  const arrowY = target.y - Math.sin(angle) * (target.radius + 2);
  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(arrowX - Math.cos(angle - 0.45) * 8, arrowY - Math.sin(angle - 0.45) * 8);
  ctx.lineTo(arrowX - Math.cos(angle + 0.45) * 8, arrowY - Math.sin(angle + 0.45) * 8);
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.restore();
}

function drawNode(node) {
  if (!node) return;
  const pos = state.layout.get(node.id);
  if (!pos) return;
  const family = nodeColorKey(node);
  const selected = node.id === state.selectedId;

  if (node.type === 'family') {
    drawFamilyNode(node, pos, family, selected);
    return;
  }
  if (node.type === 'subfamily') {
    drawSubfamilyNode(node, pos, family, selected);
    return;
  }
  if (node.type === 'shade') {
    drawShadeNode(node, pos, family, selected);
    return;
  }

  const nodeColor = colorForNode(node)?.hex || familyColor(family);
  ctx.save();
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

function drawSubfamilyNode(node, pos, family, selected) {
  const width = selected ? 106 : 92;
  const height = selected ? 46 : 38;
  const color = familyColor(family);

  ctx.save();
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

function drawShadeNode(node, pos, family, selected) {
  const size = selected ? 52 : 42;
  const color = familyColor(family);

  ctx.save();
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

function drawFamilyNode(node, pos, family, selected) {
  const size = (pos.radius + (selected ? 7 : 3)) * 2;
  const x = pos.x - size / 2;
  const y = pos.y - size / 2;
  const color = familyColor(family);
  const hasCrossFamilyRoute = incoming(node.id).some(edge => edge.type === 'definition_contains' || edge.type === 'synonym_to_color_alias' || edge.type === 'associated_color' || edge.type === 'emotion_association' || edge.type === 'environment_condition');

  ctx.save();
  if (hasCrossFamilyRoute || selected) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(color, 0.16);
    ctx.fill();
  }

  roundedRectPath(x, y, size, size, 8);
  ctx.fillStyle = selected ? '#ffffff' : color;
  ctx.fill();
  ctx.lineWidth = selected ? 4 : 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();

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
  ctx.fillText('FAMILY', pos.x, pos.y + 11);
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

function neighborhood(id) {
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
    return ids;
  }

  const start = nodePassesCategoryFilter(state.nodeById.get(id)) ? id : firstFilteredNodeId();
  const ids = new Set(start ? [start] : []);
  state.edges.forEach(edge => {
    if (!edgePassesCategoryFilter(edge)) return;
    if (edge.source === start) ids.add(edge.target);
    if (edge.target === start) ids.add(edge.source);
  });
  [...ids].forEach(nodeId => {
    state.edges.forEach(edge => {
      if (!edgePassesCategoryFilter(edge)) return;
      if (edge.source === nodeId && ids.size < 90) ids.add(edge.target);
      if (edge.target === nodeId && ids.size < 90) ids.add(edge.source);
    });
  });
  return ids;
}

function visibleGraphEdges(visibleNodeIds) {
  return state.edges.filter(edge => {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) return false;
    if (!edgePassesCategoryFilter(edge)) return false;
    return !state.emotionFilter || isEmotionFilterEdge(edge);
  });
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
  if (node.type === 'family') return 'families';
  if (node.type === 'subfamily' || node.type === 'shade') return 'bridges';
  if (node.type === 'alias') return 'aliases';
  if (node.type === 'synonym') return 'synonyms';
  if (node.type === 'environment_condition' || node.type === 'environment_term') return 'conditions';
  return 'context';
}

function nodePassesCategoryFilter(node) {
  const category = categoryForNode(node);
  return category === 'context' || state.categoryFilters[category];
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
    const pos = state.layout.get(ids[index]);
    if (!node || !pos) continue;
    const distance = Math.hypot(x - pos.x, y - pos.y);
    if (distance <= pos.radius + 8) return node;
  }
  return null;
}

function canvasPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
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
