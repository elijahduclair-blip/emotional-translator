import express from 'express';
import { query } from '../db/pool.js';
import { logRuntimeMetrics } from '../engine/metrics.js';

const router = express.Router();
const PHRASE_CUES = new Map([
  ['scared', 'fear'],
  ['afraid', 'fear'],
  ['fearful', 'fear'],
  ['hopeful', 'hope'],
  ['hoping', 'hope'],
  ['joyful', 'joy'],
  ['angry', 'anger'],
  ['calmly', 'calm'],
  ['on edge', 'anxiety']
]);

function normalize(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
}

const STOP_WORDS = new Set([
  'i',
  'me',
  'my',
  'feel',
  'feeling',
  'felt',
  'am',
  'is',
  'are',
  'was',
  'were',
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'to',
  'of',
  'in',
  'on',
  'for',
  'today',
  'tonight',
  'currently',
  'right',
  'now'
]);

function inputTerms(text) {
  const normalized = normalize(text);
  const terms = new Set();

  normalized
    .split(' ')
    .filter(word => (
      word.length > 2 &&
      !STOP_WORDS.has(word)
    ))
    .forEach(word => terms.add(word));

  PHRASE_CUES.forEach((target, cue) => {
    if (normalized.includes(cue)) {
      terms.add(target);
    }
  });

  return [...terms].filter(Boolean);
}

function nodeSearchValues(node = {}) {
  const metadata = node.metadata && typeof node.metadata === 'object' ? node.metadata : {};
  const aliases = Array.isArray(metadata.aliases)
    ? metadata.aliases
    : Array.isArray(metadata.alias)
      ? metadata.alias
      : [metadata.aliases, metadata.alias].filter(value => typeof value === 'string');
  return [
    node.label,
    node.name,
    metadata.name,
    ...aliases
  ].map(normalize).filter(Boolean);
}

function nodeMatchesTerms(node, terms) {
  const values = nodeSearchValues(node);
  return terms.some(term => values.some(value => value === term || value.includes(term)));
}

function routeWeight(route = {}) {
  const weight = Number(
    route.weight
    ?? route.activation_weight
    ?? route.evidence_data?.weight
    ?? route.evidence_data?.activationWeight
  );
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

function connectionStrengthFromRoutes(routeCount, totalWeight) {
  if (!routeCount) return 'weak';
  return routeCount >= 3 || totalWeight >= 4 ? 'strong' : 'medium';
}

function colorClimateLandingFromRoute(route, matchedIds) {
  if (!route) return null;
  if (matchedIds.has(route.source) && !matchedIds.has(route.target)) {
    return {
      id: route.target,
      label: route.target_label,
      family: route.target_family,
      color: route.target_color || null
    };
  }
  return {
    id: route.source,
    label: route.source_label,
    family: route.source_family,
    color: route.source_color || null
  };
}

function activeRouteMetadata(reason = 'Active because the current input selected this stored route.') {
  return {
    routeState: 'active',
    activationReason: reason,
    activationSources: ['search'],
    activationWeight: 1,
    isPinned: false
  };
}

export async function translate(text, includeDetails = false) {
  const normalized = normalize(text);
  if (!normalized) return { input: text, landing: null, family: null, color: null, confidence: 'low', paths: 0, unresolved: true };

  const terms = inputTerms(text);
  const nodesResult = await query(
    `SELECT * FROM nodes
     WHERE record_status='active' AND LOWER(label) = ANY($1::text[])
     ORDER BY CASE WHEN LOWER(label)=$2 THEN 0 ELSE 1 END, label`,
    [terms, normalized]
  );
  const exactFull = nodesResult.rows.filter(node => normalize(node.label) === normalized);
  const matchedNodes = exactFull.length ? exactFull : nodesResult.rows;

  if (!matchedNodes.length) {
    return { input: text, landing: null, family: null, color: null, confidence: 'low', paths: 0, components: [], unresolved: true };
  }

  const ids = matchedNodes.map(node => node.id);
  const routesResult = await query(
    `SELECT e.*, t.label target_label, t.type target_type, t.family target_family, t.hex_color target_color
     FROM edges e JOIN nodes t ON t.id=e.target
     WHERE e.record_status='active' AND t.record_status='active' AND e.source = ANY($1::text[])
     ORDER BY e.source,e.type,e.target`,
    [ids]
  );
  const routes = routesResult.rows;
  const components = [];
  const seen = new Set();
  routes.forEach(route => {
    if (seen.has(route.target)) return;
    seen.add(route.target);
    components.push({
      id: route.target,
      label: route.target_label,
      type: route.target_type,
      family: route.target_family || familyFromId(route.target),
      color: route.target_color,
      relationship: route.type,
      ...activeRouteMetadata()
    });
  });

  const primary = components[0] || matchedNodes[0];
  const families = [...new Set(components.map(item => item.family).filter(Boolean))];
  const response = {
    input: text,
    matchedTerms: matchedNodes.map(node => node.label),
    landing: primary?.label || primary?.target_label || null,
    family: families[0] || primary?.family || familyFromId(primary?.id),
    families,
    color: primary?.color || primary?.hex_color || null,
    confidence: exactFull.length ? 'high' : matchedNodes.length ? 'medium' : 'low',
    paths: routes.length,
    blended: matchedNodes.length > 1 || families.length > 1,
    components,
    unresolved: false
  };
  if (includeDetails) {
    response.details = {
      matchedNodes,
      routes: routes.map(route => ({
        ...route,
        state: 'active',
        activationReason: 'Active because the current input matched this stored route now.',
        activationSources: ['search'],
        activationWeight: 1,
        isPinned: false
      }))
    };
  }
  return response;
}

function familyFromId(id = '') {
  if (id.startsWith('family-')) return id.slice(7);
  if (id.startsWith('subfamily-')) return id.slice(10);
  return null;
}

router.post('/translate', async (req, res, next) => {
  try {
    const { text, includeDetails = false } = req.body;
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text parameter required' });
    res.json(await translate(text, includeDetails));
  } catch (error) { next(error); }
});

router.post('/translate/batch', async (req, res, next) => {
  try {
    const { texts = [] } = req.body;
    if (!Array.isArray(texts)) return res.status(400).json({ error: 'texts must be an array' });
    const results = await Promise.all(texts.map(text => translate(text, false)));
    res.json({ results, count: results.length });
  } catch (error) { next(error); }
});

router.post('/translate/graph-read', async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text parameter required' });

    const normalized = normalize(text);
    const trace = [];

trace.push({
  step: 1,
  name: "Normalize Input",
  result: normalized
});
    const boundary = 'This is a relational climate read, not a diagnosis or permanent identity claim.';
    if (!normalized) {
      logRuntimeMetrics({ nodes: [], edges: [], activeRoutes: [] });
      return res.json({
  input: text,
  trace,
  matchedNodes: [],
  supportedRoutes: [],
  colorClimateLanding: null,
  connectionStrength: 'unresolved',
  evidence: {
    nodeCount: 0,
    routeCount: 0,
    confidenceBasis: 'No normalized input was available to match against graph labels, names, or aliases.'
  },
  boundary
});
    }

    const terms = inputTerms(text);
    const likeTerms = terms.map(term => `%${term}%`);
    const nodesResult = await query(
      `SELECT *
       FROM nodes
       WHERE record_status='active'
         AND (
           LOWER(label) = ANY($1::text[])
           OR LOWER(label) LIKE ANY($2::text[])
           OR LOWER(COALESCE(metadata->>'name', '')) = ANY($1::text[])
           OR LOWER(COALESCE(metadata->>'name', '')) LIKE ANY($2::text[])
           OR LOWER(COALESCE(metadata::text, '')) LIKE ANY($2::text[])
         )
       ORDER BY label`,
      [terms, likeTerms]
    );
    const matchedNodeRows = nodesResult.rows.filter(node => nodeMatchesTerms(node, terms));
    const matchedNodes = matchedNodeRows.map(node => ({
      id: node.id,
      label: node.label,
      type: node.type,
      family: node.family,
      hexColor: node.hex_color || null
    }));

    if (!matchedNodes.length) {
      logRuntimeMetrics({ nodes: [], edges: [], activeRoutes: [] });
      return res.json({
        input: text,
        matchedNodes: [],
        supportedRoutes: [],
        colorClimateLanding: null,
        connectionStrength: 'unresolved',
        evidence: {
          nodeCount: 0,
          routeCount: 0,
          confidenceBasis: 'No active graph nodes matched the normalized input by label, name, or alias.'
        },
        boundary
      });
    }

    const matchedIds = matchedNodes.map(node => node.id);
    const routesResult = await query(
      `SELECT
         e.*,
         s.label AS source_label,
         s.family AS source_family,
         s.hex_color AS source_color,
         t.label AS target_label,
         t.family AS target_family,
         t.hex_color AS target_color
       FROM edges e
       JOIN nodes s ON s.id = e.source
       JOIN nodes t ON t.id = e.target
       WHERE e.record_status='active'
         AND s.record_status='active'
         AND t.record_status='active'
         AND (e.source = ANY($1::text[]) OR e.target = ANY($1::text[]))`,
      [matchedIds]
    );

    const supportedRoutes = routesResult.rows
      .map(route => ({
        id: route.id,
        source: route.source,
        sourceLabel: route.source_label,
        target: route.target,
        targetLabel: route.target_label,
        type: route.type,
        confidence: route.confidence,
        evidence: route.evidence,
        weight: routeWeight(route)
      }))
      .sort((left, right) => right.weight - left.weight);

    const totalWeight = supportedRoutes.reduce((sum, route) => sum + route.weight, 0);
    const matchedIdSet = new Set(matchedIds);
    const rankedRoutes = [...routesResult.rows].sort((left, right) => routeWeight(right) - routeWeight(left));
    const colorClimateLanding = colorClimateLandingFromRoute(rankedRoutes[0], matchedIdSet);
    const connectionStrength = connectionStrengthFromRoutes(supportedRoutes.length, totalWeight);

    logRuntimeMetrics({
      nodes: matchedNodes,
      edges: supportedRoutes,
      activeRoutes: supportedRoutes
    });

    res.json({
      input: text,
      matchedNodes,
      supportedRoutes,
      colorClimateLanding,
      connectionStrength,
      evidence: {
        nodeCount: matchedNodes.length,
        routeCount: supportedRoutes.length,
        confidenceBasis: supportedRoutes.length
          ? `Matched ${matchedNodes.length} active node(s) and ranked ${supportedRoutes.length} connected route(s) with total weight ${totalWeight}.`
          : `Matched ${matchedNodes.length} active node(s), but found no connected active routes.`
      },
      boundary
    });
  } catch (error) { next(error); }
});

export default router;
