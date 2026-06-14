import express from 'express';
import { query } from '../db/pool.js';

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

function inputTerms(text) {
  const normalized = normalize(text);
  const terms = new Set([normalized]);
  normalized.split(' ').filter(word => word.length > 2).forEach(word => terms.add(PHRASE_CUES.get(word) || word));
  PHRASE_CUES.forEach((target, cue) => {
    if (normalized.includes(cue)) terms.add(target);
  });
  return [...terms].filter(Boolean);
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
    components.push({ id: route.target, label: route.target_label, type: route.target_type, family: route.target_family || familyFromId(route.target), color: route.target_color, relationship: route.type });
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
  if (includeDetails) response.details = { matchedNodes, routes };
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

export default router;
