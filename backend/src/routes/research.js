import express from 'express';
import crypto from 'crypto';
import { query } from '../db/pool.js';
import { requireAdmin, requireAuth, requirePasswordCurrent } from '../middleware/auth.js';

const router = express.Router();
const ALLOWED_SOURCES = new Set(['wikipedia', 'crossref']);
const ALLOWED_CONFIDENCE = new Set(['low', 'medium', 'high']);
const USER_AGENT = 'EmotionalTranslatorResearch/1.0 (https://elijahduclair-blip.github.io/emotional-translator/)';
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const SEARCH_LIMIT_MAX = 30;
const searchCache = new Map();
const searchWindows = new Map();

router.get('/research/search', requireAuth, requirePasswordCurrent, limitResearchSearch, async (req, res, next) => {
  try {
    const searchQuery = requiredText(req.query.q, 'A research query is required.').slice(0, 180);
    const sources = parseSources(req.query.sources);
    const cacheKey = `${searchQuery.toLowerCase()}|${[...sources].sort().join(',')}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.savedAt < SEARCH_CACHE_TTL_MS) {
      return res.json({ ...cached.value, cached: true });
    }
    const searches = [...sources].map(source => ({
      source,
      promise: source === 'wikipedia' ? searchWikipedia(searchQuery) : searchCrossref(searchQuery)
    }));
    const settled = await Promise.allSettled(searches.map(item => item.promise));
    const results = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const warnings = settled.flatMap((result, index) => result.status === 'rejected'
      ? [`${searches[index].source}: ${result.reason?.message || 'source unavailable'}`]
      : []);
    if (!results.length && warnings.length === searches.length) throw httpError(502, 'All selected research sources are currently unavailable.');
    const suggestions = await suggestionContext(searchQuery, results);
    const value = { query: searchQuery, sources: [...sources], suggestions, results, warnings };
    searchCache.set(cacheKey, { savedAt: Date.now(), value });
    res.json({ ...value, cached: false });
  } catch (error) { next(error); }
});

router.get('/research/items', requireAuth, requirePasswordCurrent, async (req, res, next) => {
  try {
    const status = nullableText(req.query.status);
    const params = [];
    const conditions = [];
    if (req.user.role !== 'admin') { params.push(req.user.sub); conditions.push(`r.proposed_by=$${params.length}`); }
    if (status) { params.push(status); conditions.push(`r.status=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT r.*, proposer.username AS proposed_by_name, reviewer.username AS reviewer_name
       FROM research_items r JOIN users proposer ON proposer.id=r.proposed_by
       LEFT JOIN users reviewer ON reviewer.id=r.reviewer
       ${where} ORDER BY r.created_at DESC LIMIT 200`, params
    );
    res.json({ items: result.rows, count: result.rows.length });
  } catch (error) { next(error); }
});

router.post('/research/items', requireAuth, requirePasswordCurrent, async (req, res, next) => {
  try {
    const item = normalizeResearchItem(req.body);
    const result = await query(
      `INSERT INTO research_items
       (id,query,title,source_name,source_type,source_url,excerpt,published_at,suggestions,emotional_logic,boundary,counterexample,confidence,status,proposed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'proposed',$14) RETURNING *`,
      [crypto.randomUUID(), item.query, item.title, item.sourceName, item.sourceType, item.sourceUrl, item.excerpt,
        item.publishedAt, item.suggestions, item.emotionalLogic, item.boundary, item.counterexample, item.confidence, req.user.sub]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (error) { next(error); }
});

router.patch('/research/items/:id/review', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const decision = String(req.body?.decision || '');
    if (!['approved', 'rejected', 'needs_revision'].includes(decision)) throw httpError(400, 'Decision must be approved, rejected, or needs_revision.');
    const reviewNote = requiredText(req.body?.reviewNote, 'A review note is required.');
    const result = await query(
      `UPDATE research_items SET status=$2,reviewer=$3,review_note=$4,reviewed_at=NOW()
       WHERE id=$1 AND status IN ('proposed','needs_revision') RETURNING *`,
      [req.params.id, decision, req.user.sub, reviewNote]
    );
    if (!result.rows.length) throw httpError(409, 'This research item is not awaiting review.');
    res.json({ item: result.rows[0] });
  } catch (error) { next(error); }
});

router.post('/research/items/:id/graph-proposal', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const researchResult = await query("SELECT * FROM research_items WHERE id=$1 AND status='approved'", [req.params.id]);
    if (!researchResult.rows.length) throw httpError(409, 'Research must be approved before it can become a graph proposal.');
    const item = researchResult.rows[0];
    if (item.graph_proposal_id) throw httpError(409, 'This research item already has a graph proposal.');
    const label = requiredText(req.body?.label || item.query, 'A graph label is required.');
    const nodeId = slugify(req.body?.nodeId || label);
    const nodeType = String(req.body?.nodeType || 'common_word');
    const allowedTypes = new Set(['common_word', 'neutral_word', 'emotion_word', 'theme', 'environment_term']);
    if (!allowedTypes.has(nodeType)) throw httpError(400, 'Unsupported graph node type.');
    const payload = {
      node: {
        id: nodeId,
        label,
        type: nodeType,
        family: nullableText(req.body?.family),
        hexColor: null,
        metadata: {
          definition: item.excerpt,
          emotionalLogic: item.emotional_logic,
          boundary: item.boundary,
          researchItemId: item.id,
          sourceUrl: item.source_url,
          sourceName: item.source_name,
          suggestions: item.suggestions
        }
      },
      relationships: []
    };
    const proposalId = crypto.randomUUID();
    await query(
      `INSERT INTO graph_proposals (id,operation,target_id,payload,status,author,rationale)
       VALUES ($1,'create',NULL,$2,'proposed',$3,$4)`,
      [proposalId, payload, req.user.username, `Approved research evidence from ${item.source_name}: ${item.source_url}`]
    );
    await query('UPDATE research_items SET graph_proposal_id=$2 WHERE id=$1', [item.id, proposalId]);
    res.status(201).json({ proposalId, status: 'proposed' });
  } catch (error) { next(error); }
});

async function searchWikipedia(searchQuery) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', list: 'search', srsearch: searchQuery, srlimit: '6', format: 'json', origin: '*' });
  const response = await externalFetch(url);
  return (response.query?.search || []).map(item => ({
    externalId: `wikipedia:${item.pageid}`,
    title: item.title,
    sourceName: 'Wikipedia',
    sourceType: 'encyclopedic',
    url: `https://en.wikipedia.org/?curid=${item.pageid}`,
    excerpt: stripHtml(item.snippet),
    publishedAt: null,
    retrievedAt: new Date().toISOString(),
    boundary: 'Encyclopedic orientation and cultural context; verify contested or high-stakes claims with primary sources.'
  }));
}

async function searchCrossref(searchQuery) {
  const url = new URL('https://api.crossref.org/works');
  url.search = new URLSearchParams({ query: searchQuery, rows: '6', select: 'DOI,title,author,published,container-title,URL,abstract,type' });
  const response = await externalFetch(url);
  return (response.message?.items || []).filter(item => item.DOI).map(item => ({
    externalId: `crossref:${item.DOI}`,
    title: item.title?.[0] || item.DOI,
    sourceName: item['container-title']?.[0] || 'Crossref scholarly record',
    sourceType: 'scholarly_metadata',
    url: safeHttpsUrl(item.URL, `https://doi.org/${encodeURIComponent(item.DOI)}`),
    excerpt: stripHtml(item.abstract || authorSummary(item.author)),
    publishedAt: crossrefDate(item.published),
    retrievedAt: new Date().toISOString(),
    doi: item.DOI,
    boundary: 'Scholarly metadata record; title and abstract are evidence leads, not automatic proof of the translator connection.'
  }));
}

async function externalFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw httpError(502, `Research source returned ${response.status}.`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function limitResearchSearch(req, res, next) {
  const key = req.user?.sub || req.ip;
  const now = Date.now();
  const current = searchWindows.get(key);
  if (!current || now - current.startedAt >= SEARCH_LIMIT_WINDOW_MS) {
    searchWindows.set(key, { startedAt: now, count: 1 });
    return next();
  }
  current.count += 1;
  if (current.count > SEARCH_LIMIT_MAX) return next(httpError(429, 'Research search limit reached. Try again in a few minutes.'));
  next();
}

async function suggestionContext(searchQuery, results) {
  const text = `${searchQuery} ${results.map(item => `${item.title} ${item.excerpt}`).join(' ')}`.toLowerCase();
  const graphResult = await query(
    `SELECT id,label,type,family,metadata FROM nodes WHERE record_status='active'
     AND type IN ('family','emotion_word','theme','environment_condition','environment_term') ORDER BY type,label`
  );
  const scored = graphResult.rows.map(node => {
    const cues = [node.label, node.family, ...(node.metadata?.cues || [])].filter(Boolean).map(value => String(value).toLowerCase());
    const score = cues.reduce((sum, cue) => sum + (cue.length > 2 && text.includes(cue) ? 1 : 0), 0);
    return { id: node.id, label: node.label, type: node.type, family: node.family, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, 12);
  return {
    graphMatches: scored,
    strength: scored.length >= 4 ? 'strong' : scored.length >= 1 ? 'weak' : 'unresolved',
    boundary: 'Suggestions are lexical leads for human review, not synonyms, diagnoses, or approved graph relationships.'
  };
}

function normalizeResearchItem(value = {}) {
  const sourceType = requiredText(value.sourceType, 'Source type is required.');
  const sourceUrl = requiredText(value.sourceUrl, 'Source URL is required.');
  let parsed;
  try { parsed = new URL(sourceUrl); } catch { throw httpError(400, 'Source URL must be valid.'); }
  if (parsed.protocol !== 'https:') throw httpError(400, 'Source URL must use HTTPS.');
  const confidence = String(value.confidence || 'low');
  if (!ALLOWED_CONFIDENCE.has(confidence)) throw httpError(400, 'Confidence must be low, medium, or high.');
  return {
    query: requiredText(value.query, 'Research query is required.').slice(0, 180),
    title: requiredText(value.title, 'Title is required.').slice(0, 500),
    sourceName: requiredText(value.sourceName, 'Source name is required.').slice(0, 240),
    sourceType,
    sourceUrl: parsed.toString(),
    excerpt: nullableText(value.excerpt)?.slice(0, 4000) || null,
    publishedAt: value.publishedAt || null,
    suggestions: value.suggestions && typeof value.suggestions === 'object' ? value.suggestions : {},
    emotionalLogic: nullableText(value.emotionalLogic)?.slice(0, 2000) || null,
    boundary: requiredText(value.boundary, 'A boundary is required.').slice(0, 2000),
    counterexample: requiredText(value.counterexample, 'A counterexample or falsification condition is required.').slice(0, 2000),
    confidence
  };
}

function parseSources(value) {
  const requested = String(value || 'wikipedia,crossref').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  const sources = new Set(requested.filter(item => ALLOWED_SOURCES.has(item)));
  if (!sources.size) throw httpError(400, 'Choose Wikipedia, Crossref, or both.');
  return sources;
}

function stripHtml(value) { return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200); }
function authorSummary(authors = []) { return authors.slice(0, 5).map(author => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean).join(', '); }
function crossrefDate(value) { const parts = value?.['date-parts']?.[0]; return parts?.length ? `${parts[0]}-${String(parts[1] || 1).padStart(2, '0')}-${String(parts[2] || 1).padStart(2, '0')}` : null; }
function safeHttpsUrl(value, fallback) { try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : fallback; } catch { return fallback; } }
function requiredText(value, message) { const text = String(value || '').trim(); if (!text) throw httpError(400, message); return text; }
function nullableText(value) { const text = String(value || '').trim(); return text || null; }
function slugify(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }

export { normalizeResearchItem, parseSources, stripHtml };
export default router;
