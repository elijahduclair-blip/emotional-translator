import express from 'express';
import { buildWordNetEvidence } from '../lib/wordnet-evidence.js';
import { limitWordNetRequests, requireWordNetAccess } from '../middleware/public-api.js';

const router = express.Router();
const MAX_TERMS = 12;
const MAX_TERM_LENGTH = 80;

router.use('/wordnet', limitWordNetRequests, requireWordNetAccess, (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.get('/wordnet/lookup', (req, res, next) => {
  try {
    const terms = normalizeTerms(req.query.term);
    if (!terms.length) return res.status(400).json({ error: 'term query parameter required' });
    return res.json(lookupResponse(terms));
  } catch (error) {
    next(error);
  }
});

router.post('/wordnet/lookup', (req, res, next) => {
  try {
    const terms = normalizeTerms(req.body?.terms ?? req.body?.term);
    if (!terms.length) return res.status(400).json({ error: 'term or terms parameter required' });
    return res.json(lookupResponse(terms));
  } catch (error) {
    next(error);
  }
});

export default router;

export function normalizeTerms(value) {
  const input = Array.isArray(value) ? value : [value];
  const terms = [];
  const seen = new Set();

  for (const item of input) {
    const term = String(item || '')
      .toLowerCase()
      .trim()
      .replace(/[_-]+/g, ' ')
      .replace(/[^a-z0-9' ]+/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, MAX_TERM_LENGTH);
    if (!term || seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
    if (terms.length === MAX_TERMS) break;
  }

  return terms;
}

function lookupResponse(terms) {
  const evidence = buildWordNetEvidence(terms);
  return {
    ...evidence,
    provider: {
      name: 'codex_wordnet_lexicon',
      mode: 'local_read_only',
      scope: evidence.status === 'local_seed' ? 'curated_seed' : evidence.status
    },
    query: {
      terms,
      termLimit: MAX_TERMS,
      exactOrMorphological: true
    },
    governance: {
      mutationAllowed: false,
      canAssignColor: false,
      canAssignAddress: false,
      canActivateRoute: false
    }
  };
}
