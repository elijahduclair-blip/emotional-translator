import express from 'express';
import { query } from '../db/pool.js';
import { translate } from './translate.js';

const router = express.Router();
const AI_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const AI_LIMIT_MAX = 120;
const aiRequestWindows = new Map();

export const AI_REFERENCE = Object.freeze({
  name: 'Theory of Alignment Emotional Color Translator',
  version: '1.0.0',
  purpose: 'Interpret words and feelings through supported relational color-climate routes.',
  sourceOfTruth: 'Approved PostgreSQL nodes and edges. Personal profiles, research drafts, and proposals are excluded.',
  defaultStance: 'Read meaning through relation, route, climate, filter, and pressure before assigning an isolated label.',
  formulas: {
    sharedRead: 'input -> supported route -> color family or mixture -> environment condition -> emotional climate',
    themeRead: 'source + filter -> theme',
    compositionRead: 'theme A + theme B -> composed climate',
    falsifiability: 'If a read cannot name its route, filter, or evidence, mark it weak or unresolved.'
  },
  axes: {
    x: 'cool negative to warm positive',
    y: 'dark negative to light positive',
    z: 'muted negative to vivid positive'
  },
  anchorClimates: {
    obsidianShadow: 'shadow, concealment, pressure, protection, reinvention',
    emberAmber: 'heat, activation, urgency, motion, release',
    roseIntimacy: 'soft contact, tenderness, attachment, connection',
    midnightOcean: 'depth, distance, atmosphere, reflection',
    greenRegulation: 'regulation, growth, balance, recovery, endurance',
    silverMist: 'fog, ambiguity, partial signal, revision, openness',
    earthArchive: 'ground, body, material memory, archive, steadiness'
  },
  requiredBehavior: [
    'Preserve mixed or coexisting climates instead of forcing one answer.',
    'Distinguish graph-supported routes from evocative interpretation.',
    'Treat themes as presentation climates rather than permanent essence.',
    'Use unresolved when the graph does not support a route.',
    'State a concise boundary with every interpretive read.'
  ],
  universalBoundary: 'Interpretive relational vocabulary, not diagnosis, proof of essence, or universal truth.'
});

router.use('/ai', limitAiRequests);

router.get('/ai/reference', (req, res) => {
  res.json(AI_REFERENCE);
});

router.post('/ai/translate', async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text parameter required' });
    if (text.length > 500) return res.status(400).json({ error: 'text must be 500 characters or fewer' });
    const result = await translate(text, false);
    res.json({
      ...result,
      interpretationRule: result.unresolved
        ? 'The approved graph does not currently support a defensible route. Keep the read unresolved.'
        : 'Explain the supported route before offering evocative interpretation.',
      boundary: AI_REFERENCE.universalBoundary
    });
  } catch (error) { next(error); }
});

router.get('/ai/context', async (req, res, next) => {
  try {
    const searchQuery = String(req.query.query || '').trim();
    if (!searchQuery) return res.status(400).json({ error: 'query parameter required' });
    if (searchQuery.length > 180) return res.status(400).json({ error: 'query must be 180 characters or fewer' });
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 20);
    const terms = normalizeTerms(searchQuery);
    const patterns = terms.map(term => `%${term}%`);
    const nodesResult = await query(
      `SELECT id,label,type,family,hex_color,metadata
       FROM nodes WHERE record_status='active'
       AND LOWER(label) LIKE ANY($1::text[])
       ORDER BY CASE WHEN LOWER(label)=$2 THEN 0 ELSE 1 END,label LIMIT $3`,
      [patterns, searchQuery.toLowerCase(), limit]
    );
    const ids = nodesResult.rows.map(node => node.id);
    const edgesResult = ids.length
      ? await query(
        `SELECT e.id,e.source,e.target,e.type,e.evidence,e.confidence,e.evidence_data,
                s.label AS source_label,t.label AS target_label
         FROM edges e JOIN nodes s ON s.id=e.source JOIN nodes t ON t.id=e.target
         WHERE e.record_status='active' AND s.record_status='active' AND t.record_status='active'
         AND (e.source=ANY($1::text[]) OR e.target=ANY($1::text[]))
         ORDER BY e.confidence DESC,e.type LIMIT $2`,
        [ids, Math.min(limit * 3, 50)]
      )
      : { rows: [] };
    res.json({
      query: searchQuery,
      matches: nodesResult.rows,
      relationships: edgesResult.rows,
      matchCount: nodesResult.rows.length,
      connectionStrength: nodesResult.rows.length >= 3 ? 'strong' : nodesResult.rows.length ? 'weak' : 'unresolved',
      boundary: AI_REFERENCE.universalBoundary
    });
  } catch (error) { next(error); }
});

function normalizeTerms(value) {
  const normalized = String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  return [...new Set([normalized, ...normalized.split(' ').filter(term => term.length > 2)])].filter(Boolean);
}

function limitAiRequests(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = aiRequestWindows.get(key);
  if (!current || now - current.startedAt >= AI_LIMIT_WINDOW_MS) {
    aiRequestWindows.set(key, { startedAt: now, count: 1 });
    return next();
  }
  current.count += 1;
  if (current.count > AI_LIMIT_MAX) {
    res.setHeader('Retry-After', String(Math.ceil((AI_LIMIT_WINDOW_MS - (now - current.startedAt)) / 1000)));
    const error = new Error('AI tool request limit reached. Try again in a few minutes.');
    error.status = 429;
    return next(error);
  }
  next();
}

export { limitAiRequests, normalizeTerms };
export default router;
