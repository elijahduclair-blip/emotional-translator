import express from 'express';
import { query } from '../db/pool.js';
import { logRuntimeMetrics } from '../engine/metrics.js';
import { fixedAnchor } from '../engine/fixed-color-space.js';

const router = express.Router();
const MAX_MATCHED_NODES = 12;
const MAX_SUPPORTED_ROUTES = 24;
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

export function inputTerms(text) {
  const normalized = normalize(text);
  const terms = new Set();
  const words = normalized
    .split(' ')
    .filter(word => (
      word.length > 2 &&
      !STOP_WORDS.has(word)
    ));

  words.forEach(word => terms.add(word));
  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= words.length - size; index += 1) {
      terms.add(words.slice(index, index + size).join(' '));
    }
  }

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

export function nodeMatchesTerms(node, terms) {
  const values = nodeSearchValues(node);
  return terms.some(term => values.some(value => value === term));
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

async function readKnowledgeLayer(terms) {
  if (!terms.length) return emptyKnowledgeLayer();

  const nodesResult = await query(
    `SELECT id, tier, name, normalized_name, hex_color, semantic_code,
       coordinate_x, coordinate_y, coordinate_z, parents,
       fixed_anchor, degree_of_vision, decimal_address, address_depth, placement_basis,
       source_document, source_page, source_row, relationship_extraction_confidence
     FROM knowledge_nodes
     WHERE normalized_name = ANY($1::text[])
       OR EXISTS (
         SELECT 1
         FROM unnest(parents || synonyms || opposites) AS relationship(value)
         WHERE LOWER(value) = ANY($1::text[])
       )
     ORDER BY
       CASE WHEN normalized_name = ANY($1::text[]) THEN 0 ELSE 1 END,
       LENGTH(normalized_name) DESC,
       CASE tier WHEN 'base' THEN 0 WHEN 'shade' THEN 1 WHEN 'bridge' THEN 2 ELSE 3 END,
       name, source_page, source_row
     LIMIT $2`,
    [terms, MAX_MATCHED_NODES + 1]
  );

  if (!nodesResult.rows.length) return emptyKnowledgeLayer();
  const nodeTruncated = nodesResult.rows.length > MAX_MATCHED_NODES;
  const nodeRows = nodesResult.rows.slice(0, MAX_MATCHED_NODES);
  const ids = nodeRows.map(node => node.id);
  const edgesResult = await query(
    `SELECT edge.*,
       source.name AS source_label,
       source.tier AS source_tier,
       source.hex_color AS source_color,
       source.parents AS source_parents,
       target.name AS target_label,
       target.tier AS target_tier,
       target.hex_color AS target_color,
       target.parents AS target_parents
     FROM knowledge_edges edge
     JOIN knowledge_nodes source ON source.id = edge.source_id
     LEFT JOIN knowledge_nodes target ON target.id = edge.target_id
     WHERE edge.source_id = ANY($1::text[])
     ORDER BY
       CASE WHEN edge.target_id IS NOT NULL THEN 0 ELSE 1 END,
       CASE edge.relation_type WHEN 'parent' THEN 0 WHEN 'synonym' THEN 1 ELSE 2 END,
       CASE target.tier WHEN 'base' THEN 0 WHEN 'shade' THEN 1 WHEN 'bridge' THEN 2 ELSE 3 END,
       edge.target_name, edge.id
     LIMIT $2`,
    [ids, MAX_SUPPORTED_ROUTES + 1]
  );

  const edgeTruncated = edgesResult.rows.length > MAX_SUPPORTED_ROUTES;
  const edgeRows = edgesResult.rows.slice(0, MAX_SUPPORTED_ROUTES);
  const matchedNodes = nodeRows.map(node => knowledgeNode(node));
  const supportedRoutes = edgeRows.map(edge => ({
    id: edge.id,
    source: edge.source_id,
    sourceLabel: edge.source_label,
    target: edge.target_id || `knowledge-name:${normalize(edge.target_name)}`,
    targetLabel: edge.target_label || edge.target_name,
    type: edge.relation_type,
    confidence: edge.evidence?.extractionConfidence || 'source-import',
    weight: edge.target_id ? 1 : 0.5,
    sourceLayer: 'chromabridge_knowledge',
    sourceRef: {
      document: edge.source_document,
      page: edge.evidence?.page || null,
      row: edge.evidence?.row || null,
      extractionConfidence: edge.evidence?.extractionConfidence || null
    }
  }));
  const landingEdge = edgeRows.find(edge => (
    edge.relation_type === 'parent' && edge.target_id && edge.target_tier !== 'words'
  ));
  const landingNode = landingEdge
    ? {
        id: landingEdge.target_id,
        name: landingEdge.target_label,
        tier: landingEdge.target_tier,
        hex_color: landingEdge.target_color,
        parents: landingEdge.target_parents
      }
    : nodeRows.find(node => node.tier !== 'words') || nodeRows[0];
  const colorClimateLanding = {
    id: landingNode.id,
    label: landingNode.name,
    family: landingNode.parents?.[0] || landingNode.tier,
    color: landingNode.hex_color || null
  };
  const totalWeight = supportedRoutes.reduce((sum, route) => sum + route.weight, 0);

  return {
    matchedNodes,
    supportedRoutes,
    colorClimateLanding,
    connectionStrength: connectionStrengthFromRoutes(supportedRoutes.length, totalWeight),
    evidence: {
      nodeCount: matchedNodes.length,
      routeCount: supportedRoutes.length,
      confidenceBasis: `Matched ${matchedNodes.length} imported knowledge node(s) and ${supportedRoutes.length} documented relationship(s).`,
      sourceDocuments: [...new Set(nodeRows.map(node => node.source_document))]
    },
    summary: knowledgeLayerSummary({
      consulted: true,
      matchedNodes,
      supportedRoutes,
      truncated: nodeTruncated || edgeTruncated,
      sourceDocuments: [...new Set(nodeRows.map(node => node.source_document))]
    })
  };
}

function knowledgeNode(node) {
  return {
    id: node.id,
    label: node.name,
    type: node.tier,
    family: node.parents?.[0] || node.tier,
    hexColor: node.hex_color || null,
    semanticCode: node.semantic_code || null,
    fixedSpace: node.fixed_anchor ? {
      anchor: node.fixed_anchor,
      degreeOfVision: Number(node.degree_of_vision),
      decimalAddress: node.decimal_address,
      addressDepth: node.address_depth,
      placementBasis: node.placement_basis
    } : null,
    coordinate: {
      x: node.coordinate_x,
      y: node.coordinate_y,
      z: node.coordinate_z
    },
    sourceLayer: 'chromabridge_knowledge',
    sourceRef: {
      document: node.source_document,
      page: node.source_page,
      row: node.source_row,
      extractionConfidence: node.relationship_extraction_confidence
    }
  };
}

function emptyKnowledgeLayer() {
  return {
    matchedNodes: [],
    supportedRoutes: [],
    colorClimateLanding: null,
    connectionStrength: 'unresolved',
    evidence: {
      nodeCount: 0,
      routeCount: 0,
      confidenceBasis: 'No imported knowledge nodes matched the normalized input.',
      sourceDocuments: []
    },
    summary: knowledgeLayerSummary({ consulted: true })
  };
}

async function readFixedPlacements(names) {
  const normalizedNames = [...new Set(names.map(normalize).filter(Boolean))];
  if (!normalizedNames.length) return new Map();
  const result = await query(
    `SELECT DISTINCT ON (normalized_name)
       normalized_name, fixed_anchor, degree_of_vision, decimal_address, address_depth, placement_basis
     FROM knowledge_nodes
     WHERE normalized_name = ANY($1::text[])
       AND decimal_address IS NOT NULL
     ORDER BY normalized_name,
       CASE tier WHEN 'base' THEN 0 WHEN 'bridge' THEN 1 WHEN 'shade' THEN 2 ELSE 3 END,
       source_page, source_row`,
    [normalizedNames]
  );
  return new Map(result.rows.map(row => [row.normalized_name, fixedSpaceFromRow(row)]));
}

function fixedSpaceFromRow(row) {
  return {
    anchor: row.fixed_anchor,
    degreeOfVision: Number(row.degree_of_vision),
    decimalAddress: row.decimal_address,
    addressDepth: row.address_depth,
    placementBasis: row.placement_basis
  };
}

function directAnchorPlacement(...values) {
  const anchor = values.map(fixedAnchor).find(Boolean);
  if (!anchor) return null;
  return {
    anchor: anchor.name,
    degreeOfVision: anchor.degreeOfVision,
    decimalAddress: anchor.addressRoot,
    addressDepth: 0,
    placementBasis: 'fixed_anchor'
  };
}

function knowledgeLayerSummary({
  consulted = false,
  matchedNodes = [],
  supportedRoutes = [],
  truncated = false,
  sourceDocuments = []
} = {}) {
  return {
    source: 'chromabridge_pdf_knowledge',
    consulted,
    nodeCount: matchedNodes.length,
    routeCount: supportedRoutes.length,
    truncated,
    sourceDocuments
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
  sourceLayer: 'unresolved',
  matchedNodes: [],
  supportedRoutes: [],
  colorClimateLanding: null,
  connectionStrength: 'unresolved',
  evidence: {
    nodeCount: 0,
    routeCount: 0,
    confidenceBasis: 'No normalized input was available to match against graph labels, names, or aliases.'
  },
  knowledgeLayer: knowledgeLayerSummary(),
  boundary
});
    }

    const terms = inputTerms(text);
    const nodesResult = await query(
      `SELECT *
       FROM nodes
       WHERE record_status='active'
         AND (
           LOWER(label) = ANY($1::text[])
           OR LOWER(COALESCE(metadata->>'name', '')) = ANY($1::text[])
           OR LOWER(CASE WHEN jsonb_typeof(metadata->'alias') = 'string' THEN metadata->>'alias' ELSE '' END) = ANY($1::text[])
           OR LOWER(CASE WHEN jsonb_typeof(metadata->'aliases') = 'string' THEN metadata->>'aliases' ELSE '' END) = ANY($1::text[])
           OR EXISTS (
             SELECT 1
             FROM jsonb_array_elements_text(
               CASE WHEN jsonb_typeof(metadata->'alias') = 'array' THEN metadata->'alias' ELSE '[]'::jsonb END
             ) AS alias(value)
             WHERE LOWER(value) = ANY($1::text[])
           )
           OR EXISTS (
             SELECT 1
             FROM jsonb_array_elements_text(
               CASE WHEN jsonb_typeof(metadata->'aliases') = 'array' THEN metadata->'aliases' ELSE '[]'::jsonb END
             ) AS alias(value)
             WHERE LOWER(value) = ANY($1::text[])
           )
         )
       ORDER BY label, id
       LIMIT $2`,
      [terms, MAX_MATCHED_NODES]
    );
    const matchedNodeRows = nodesResult.rows.filter(node => nodeMatchesTerms(node, terms));
    const fixedPlacements = await readFixedPlacements(matchedNodeRows.map(node => node.label));
    const matchedNodes = matchedNodeRows.map(node => ({
      id: node.id,
      label: node.label,
      type: node.type,
      family: node.family,
      hexColor: node.hex_color || null,
      sourceLayer: 'approved_graph',
      fixedSpace: fixedPlacements.get(normalize(node.label))
        || directAnchorPlacement(node.label, node.family)
    }));

    if (!matchedNodes.length) {
      const knowledgeLayer = await readKnowledgeLayer(terms);
      logRuntimeMetrics({
        nodes: knowledgeLayer.matchedNodes,
        edges: knowledgeLayer.supportedRoutes,
        activeRoutes: knowledgeLayer.supportedRoutes
      });
      return res.json({
        input: text,
        sourceLayer: knowledgeLayer.matchedNodes.length ? 'chromabridge_knowledge' : 'unresolved',
        matchedNodes: knowledgeLayer.matchedNodes,
        supportedRoutes: knowledgeLayer.supportedRoutes,
        colorClimateLanding: knowledgeLayer.colorClimateLanding,
        connectionStrength: knowledgeLayer.connectionStrength,
        evidence: knowledgeLayer.evidence,
        knowledgeLayer: knowledgeLayer.summary,
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

    const rankedRouteRows = routesResult.rows
      .sort((left, right) => routeWeight(right) - routeWeight(left) || String(left.id).localeCompare(String(right.id)))
      .slice(0, MAX_SUPPORTED_ROUTES);
    const supportedRoutes = rankedRouteRows
      .map(route => ({
        id: route.id,
        source: route.source,
        sourceLabel: route.source_label,
        target: route.target,
        targetLabel: route.target_label,
        type: route.type,
        confidence: route.confidence,
        weight: routeWeight(route),
        sourceLayer: 'approved_graph',
        sourceRef: { graph: 'approved_semantic_graph' }
      }));

    const totalWeight = supportedRoutes.reduce((sum, route) => sum + route.weight, 0);
    const matchedIdSet = new Set(matchedIds);
    const colorClimateLanding = colorClimateLandingFromRoute(rankedRouteRows[0], matchedIdSet);
    const connectionStrength = connectionStrengthFromRoutes(supportedRoutes.length, totalWeight);

    logRuntimeMetrics({
      nodes: matchedNodes,
      edges: supportedRoutes,
      activeRoutes: supportedRoutes
    });

    res.json({
      input: text,
      sourceLayer: 'approved_graph',
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
      knowledgeLayer: knowledgeLayerSummary(),
      boundary
    });
  } catch (error) { next(error); }
});

export default router;
