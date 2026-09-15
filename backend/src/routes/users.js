import express from 'express';
import { pool, query } from '../db/pool.js';
import crypto from 'crypto';
import { requireAuth, requirePasswordCurrent, requireSelfOrAdmin } from '../middleware/auth.js';
import { formatPersonalGraphRelationship, normalizePersonalGraphKey, persistPersonalGraphPlacement } from '../lib/personal-graph.js';

const router = express.Router();

async function ensureUser(userId) {
  const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) {
    await query('INSERT INTO users (id, username) VALUES ($1, $2)', [userId, `user-${userId.slice(0, 8)}`]);
  }
  return userId;
}

router.get('/users/:id/profile', requireAuth, requirePasswordCurrent, requireSelfOrAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await ensureUser(id);
    const result = await query('SELECT * FROM user_profiles WHERE user_id = $1', [id]);
    res.json(result.rows[0] || { user_id: id, profile_data: {} });
  } catch (error) {
    next(error);
  }
});

router.post('/users/:id/profile', requireAuth, requirePasswordCurrent, requireSelfOrAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { profile_data } = req.body;
    await ensureUser(id);
    
    const profileId = crypto.randomUUID();
    const result = await query(
      `INSERT INTO user_profiles (id, user_id, profile_data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET profile_data = $3, updated_at = NOW()
       RETURNING *`,
      [profileId, id, JSON.stringify(profile_data)]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get('/users/:id/concepts', requireAuth, requirePasswordCurrent, requireSelfOrAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM user_concepts WHERE user_id = $1', [id]);
    res.json({ concepts: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/users/:id/concepts', requireAuth, requirePasswordCurrent, requireSelfOrAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { concept_name, theme_category, metadata } = req.body;
    await ensureUser(id);
    
    const conceptId = crypto.randomUUID();
    const result = await query(
      `INSERT INTO user_concepts (id, user_id, concept_name, theme_category, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [conceptId, id, concept_name, theme_category, JSON.stringify(metadata)]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get('/users/:id/graph', requireAuth, requirePasswordCurrent, requireSelfOrAdmin, async (req, res, next) => {
  try {
    const text = String(req.query?.text || '');
    if ([...text].length > 10_000) throw httpError(413, 'Personal graph lookup text must be 10000 Unicode code points or fewer.');
    const terms = graphTerms(text);
    const values = [req.params.id];
    let where = "relationship.user_id=$1 AND relationship.record_status='active'";
    if (terms.length) {
      values.push(terms);
      where += ' AND (relationship.source_key=ANY($2::text[]) OR relationship.target_key=ANY($2::text[]))';
    }
    const result = await query(
      `SELECT relationship.*, receipt.receipt_sha256
       FROM user_graph_relationships AS relationship
       LEFT JOIN edge_creation_receipts AS receipt ON receipt.receipt_id=relationship.source_receipt_id
       WHERE ${where}
       ORDER BY relationship.created_at DESC,relationship.id
       LIMIT ${terms.length ? 24 : 100}`,
      values
    );
    res.json({
      sourceLayer: 'user_graph',
      relationships: result.rows.map(formatPersonalGraphRelationship),
      relationshipCount: result.rows.length,
      truncated: result.rows.length === (terms.length ? 24 : 100),
      boundary: personalGraphBoundary('This user-specific overlay may guide ARI for this profile. It does not modify shared graph truth or Color Atlas coordinates.')
    });
  } catch (error) {
    next(error);
  }
});

router.post('/users/:id/graph/relationships/from-receipt', requireAuth, requirePasswordCurrent, requireSelfOrAdmin, async (req, res, next) => {
  let client;
  try {
    if (req.body?.confirmed !== true) throw httpError(400, 'confirmed must be true for a personal graph mutation.');
    client = await pool.connect();
    await client.query('BEGIN');
    const placement = await persistPersonalGraphPlacement(client, {
      userId: req.params.id,
      receiptId: req.body?.receiptId,
      idempotencyKey: req.body?.idempotencyKey,
      confidence: req.body?.confidence,
      counterexample: req.body?.counterexample,
      reviewNote: req.body?.reviewNote,
      placedByUser: req.user.sub,
    });
    await client.query('COMMIT');
    res.status(placement.idempotent ? 200 : 201).json({
      sourceLayer: 'user_graph',
      disposition: placement.disposition,
      idempotent: placement.idempotent,
      relationship: formatPersonalGraphRelationship(placement.relationship),
      history: placement.history ? { id: placement.history.id, action: placement.history.action, createdAt: placement.history.created_at } : null,
      boundary: personalGraphBoundary(
        'The profile owner explicitly selected the personal lane preserved in the receipt. ARI may consult this relationship for that profile only.',
        { mutated: !placement.idempotent, confirmed: true }
      )
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally {
    client?.release();
  }
});

function graphTerms(value) {
  const words = String(value || '').normalize('NFC').match(/[\p{L}\p{N}]+(?:['\u2019_-][\p{L}\p{N}]+)*/gu) || [];
  const terms = new Set();
  for (let start = 0; start < words.length; start += 1) {
    for (let length = 1; length <= 3 && start + length <= words.length; length += 1) {
      terms.add(normalizePersonalGraphKey(words.slice(start, start + length).join(' ')));
    }
  }
  return [...terms];
}

function personalGraphBoundary(reason, { mutated = false, confirmed = false } = {}) {
  return {
    mode: 'receipt_backed_personal_graph',
    personalGraphMutated: mutated,
    profileOwnerConfirmed: confirmed,
    sharedGraphMutationAllowed: false,
    colorAtlasMutationAllowed: false,
    automaticLearningAllowed: false,
    reason,
  };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export default router;
