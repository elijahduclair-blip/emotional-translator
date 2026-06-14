import express from 'express';
import crypto from 'crypto';
import { pool, query } from '../db/pool.js';
import { requireAuth, requireAdmin, requirePasswordCurrent } from '../middleware/auth.js';

const router = express.Router();
const ALLOWED_NODE_TYPES = new Set(['family', 'subfamily', 'shade', 'alias', 'synonym', 'emotion_word', 'common_word', 'neutral_word', 'environment_condition', 'environment_term', 'theme']);
const ALLOWED_CONFIDENCE = new Set(['high', 'medium', 'low']);
const ALLOWED_EVIDENCE_TYPES = new Set(['definition', 'dictionary', 'cultural', 'historical', 'scientific', 'artistic', 'observational', 'personal_pattern', 'system_rule']);

router.get('/graph', async (req, res, next) => {
  try {
    const [nodesResult, edgesResult] = await Promise.all([
      query("SELECT * FROM nodes WHERE record_status = 'active' ORDER BY id"),
      query("SELECT * FROM edges WHERE record_status = 'active' ORDER BY id")
    ]);
    const graph = {
      version: '2.0.0',
      authority: 'nodes_and_edges',
      description: 'Approved Theory of Alignment graph records from PostgreSQL',
      nodes: nodesResult.rows,
      edges: edgesResult.rows
    };
    res.json(graph);
  } catch (error) { next(error); }
});

router.get('/graph/proposals', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = nullableText(req.query.status);
    const result = status
      ? await query('SELECT * FROM graph_proposals WHERE status = $1 ORDER BY created_at DESC', [status])
      : await query('SELECT * FROM graph_proposals ORDER BY created_at DESC LIMIT 200');
    res.json({ proposals: result.rows, count: result.rows.length });
  } catch (error) { next(error); }
});

router.post('/graph/proposals', requireAuth, requirePasswordCurrent, async (req, res, next) => {
  try {
    const proposal = normalizeProposal({ ...req.body, author: req.user.username });
    proposal.payload.relationships?.forEach(relationship => { relationship.evidenceData.author = req.user.username; });
    validateProposal(proposal);
    const result = await query(
      `INSERT INTO graph_proposals (id, operation, target_id, payload, status, author, rationale)
       VALUES ($1, $2, $3, $4, 'proposed', $5, $6) RETURNING *`,
      [proposal.id, proposal.operation, proposal.targetId, proposal.payload, proposal.author, proposal.rationale]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

router.patch('/graph/proposals/:id/review', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const reviewer = req.user.username;
    const reviewNote = requiredText(req.body?.reviewNote, 'Review note is required.');
    const decision = String(req.body?.decision || 'reviewed');
    if (!['reviewed', 'rejected'].includes(decision)) throw httpError(400, 'Decision must be reviewed or rejected.');
    const result = await query(
      `UPDATE graph_proposals SET status = $2, reviewer = $3, review_note = $4,
       reviewed_at = NOW(), decided_at = CASE WHEN $2 = 'rejected' THEN NOW() ELSE decided_at END
       WHERE id = $1 AND status = 'proposed' RETURNING *`,
      [req.params.id, decision, reviewer, reviewNote]
    );
    if (!result.rows.length) throw httpError(409, 'Only proposed entries can be reviewed or rejected.');
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

router.post('/graph/proposals/:id/approve', requireAuth, requireAdmin, async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const proposalResult = await client.query("SELECT * FROM graph_proposals WHERE id = $1 AND status = 'reviewed' FOR UPDATE", [req.params.id]);
    if (!proposalResult.rows.length) throw httpError(409, 'A proposal must be reviewed before approval.');
    const proposal = proposalResult.rows[0];
    const reviewer = req.user.username;
    const outcome = await applyProposal(client, proposal, reviewer);
    await client.query("UPDATE graph_proposals SET status = 'approved', reviewer = $2, decided_at = NOW() WHERE id = $1", [proposal.id, reviewer]);
    await client.query('COMMIT');
    clearGraphCache();
    res.json({ proposalId: proposal.id, status: 'approved', ...outcome });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { client?.release(); }
});

router.get('/graph/history', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const entityId = nullableText(req.query.entityId);
    const result = entityId
      ? await query('SELECT * FROM graph_history WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 100', [entityId])
      : await query('SELECT * FROM graph_history ORDER BY created_at DESC LIMIT 200');
    res.json({ history: result.rows, count: result.rows.length });
  } catch (error) { next(error); }
});

router.post('/graph/history/:id/undo', requireAuth, requireAdmin, async (req, res, next) => {
  let client;
  try {
    const author = req.user.username;
    const reason = requiredText(req.body?.reason, 'Undo reason is required.');
    client = await pool.connect();
    await client.query('BEGIN');
    const historyResult = await client.query('SELECT * FROM graph_history WHERE id = $1 AND undone_at IS NULL FOR UPDATE', [req.params.id]);
    if (!historyResult.rows.length) throw httpError(404, 'History record not found.');
    const item = historyResult.rows[0];
    await restoreSnapshot(client, item.entity_type, item.entity_id, item.before_data);
    await addHistory(client, item.entity_type, item.entity_id, 'undo', item.after_data, item.before_data, author, reason, null);
    await client.query('UPDATE graph_history SET undone_at = NOW() WHERE id = $1', [item.id]);
    await client.query('COMMIT');
    clearGraphCache();
    res.json({ status: 'undone', entityId: item.entity_id });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { client?.release(); }
});

// Backwards-compatible endpoint now creates a proposal instead of approved truth.
router.post('/graph/entries', requireAuth, requirePasswordCurrent, async (req, res, next) => {
  try {
    const proposal = normalizeProposal({
      operation: 'create',
      author: req.user.username,
      rationale: req.body?.rationale || req.body?.node?.metadata?.definition || 'Shared graph proposal',
      payload: { node: req.body?.node, relationships: req.body?.relationships || [] }
    });
    proposal.payload.relationships?.forEach(relationship => { relationship.evidenceData.author = req.user.username; });
    validateProposal(proposal);
    const result = await query(
      `INSERT INTO graph_proposals (id, operation, target_id, payload, status, author, rationale)
       VALUES ($1, 'create', NULL, $2, 'proposed', $3, $4) RETURNING *`,
      [proposal.id, proposal.payload, proposal.author, proposal.rationale]
    );
    res.status(202).json({ proposal: result.rows[0], status: 'proposed' });
  } catch (error) { next(error); }
});

function normalizeProposal(value = {}) {
  const operation = String(value.operation || 'create').trim();
  const payload = value.payload || { node: value.node, relationships: value.relationships || [] };
  if (payload.node) payload.node = normalizeNodeInput(payload.node);
  if (payload.relationships) payload.relationships = normalizeRelationships(payload.relationships, payload.node?.id || value.targetId);
  return {
    id: crypto.randomUUID(),
    operation,
    targetId: nullableText(value.targetId),
    payload,
    author: requiredText(value.author, 'Author is required.'),
    rationale: requiredText(value.rationale, 'Rationale is required.')
  };
}

function validateProposal(proposal) {
  if (!['create', 'edit', 'delete'].includes(proposal.operation)) throw httpError(400, 'Operation must be create, edit, or delete.');
  if (proposal.operation === 'create') {
    validateNodeInput(proposal.payload.node);
    for (const relationship of proposal.payload.relationships || []) validateRelationship(relationship);
  } else if (!proposal.targetId) throw httpError(400, 'Edit and delete proposals require a target id.');
  if (proposal.operation === 'edit' && proposal.payload.node) validateNodeInput(proposal.payload.node);
}

async function applyProposal(client, proposal, author) {
  if (proposal.operation === 'create') return applyCreate(client, proposal, author);
  if (proposal.operation === 'edit') return applyEdit(client, proposal, author);
  return applyDelete(client, proposal, author);
}

async function applyCreate(client, proposal, author) {
  const node = proposal.payload.node;
  const duplicate = await client.query('SELECT id FROM nodes WHERE id = $1', [node.id]);
  if (duplicate.rows.length) throw httpError(409, `Node id already exists: ${node.id}`);
  const inserted = await client.query(
    `INSERT INTO nodes (id, label, type, family, hex_color, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [node.id, node.label, node.type, node.family, node.hexColor, node.metadata]
  );
  await addHistory(client, 'node', node.id, 'create', null, inserted.rows[0], author, proposal.rationale, proposal.id);
  const edges = [];
  for (const edge of proposal.payload.relationships || []) {
    const target = await client.query("SELECT id FROM nodes WHERE id = $1 AND record_status = 'active'", [edge.target]);
    if (!target.rows.length) throw httpError(400, `Relationship target does not exist: ${edge.target}`);
    const result = await client.query(
      `INSERT INTO edges (id, source, target, type, evidence, confidence, evidence_data) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [edge.id, edge.source, edge.target, edge.type, edge.evidence, edge.confidence, edge.evidenceData]
    );
    edges.push(result.rows[0]);
    await addHistory(client, 'edge', edge.id, 'create', null, result.rows[0], author, proposal.rationale, proposal.id);
  }
  return { node: inserted.rows[0], relationships: edges };
}

async function applyEdit(client, proposal, author) {
  const beforeResult = await client.query('SELECT * FROM nodes WHERE id = $1 FOR UPDATE', [proposal.target_id]);
  if (!beforeResult.rows.length) throw httpError(404, 'Node not found.');
  const before = beforeResult.rows[0];
  const node = { ...normalizeNodeInput({ ...before, ...proposal.payload.node, hexColor: proposal.payload.node?.hexColor ?? before.hex_color }), id: before.id };
  validateNodeInput(node);
  const result = await client.query(
    `UPDATE nodes SET label=$2,type=$3,family=$4,hex_color=$5,metadata=$6,record_status='active',revision=revision+1,updated_at=NOW() WHERE id=$1 RETURNING *`,
    [before.id, node.label, node.type, node.family, node.hexColor, node.metadata]
  );
  await addHistory(client, 'node', before.id, 'edit', before, result.rows[0], author, proposal.rationale, proposal.id);
  return { node: result.rows[0], relationships: [] };
}

async function applyDelete(client, proposal, author) {
  const beforeResult = await client.query('SELECT * FROM nodes WHERE id = $1 FOR UPDATE', [proposal.target_id]);
  if (!beforeResult.rows.length) throw httpError(404, 'Node not found.');
  const before = beforeResult.rows[0];
  const edgesBefore = await client.query("SELECT * FROM edges WHERE (source=$1 OR target=$1) AND record_status='active'", [before.id]);
  const result = await client.query("UPDATE nodes SET record_status='deleted',revision=revision+1,updated_at=NOW() WHERE id=$1 RETURNING *", [before.id]);
  await client.query("UPDATE edges SET record_status='deleted',revision=revision+1,updated_at=NOW() WHERE source=$1 OR target=$1", [before.id]);
  await addHistory(client, 'node', before.id, 'delete', { node: before, edges: edgesBefore.rows }, result.rows[0], author, proposal.rationale, proposal.id);
  return { node: result.rows[0], relationships: [] };
}

async function restoreSnapshot(client, entityType, entityId, snapshot) {
  const table = entityType === 'edge' ? 'edges' : 'nodes';
  if (!snapshot) {
    await client.query(`UPDATE ${table} SET record_status='deleted', revision=revision+1, updated_at=NOW() WHERE id=$1`, [entityId]);
    if (entityType === 'node') await client.query("UPDATE edges SET record_status='deleted', revision=revision+1, updated_at=NOW() WHERE source=$1 OR target=$1", [entityId]);
    return;
  }
  const nodeSnapshot = entityType === 'node' && snapshot.node ? snapshot.node : snapshot;
  if (entityType === 'node') {
    await client.query(
      `INSERT INTO nodes (id,label,type,family,hex_color,metadata,record_status,revision,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) ON CONFLICT(id) DO UPDATE SET
       label=$2,type=$3,family=$4,hex_color=$5,metadata=$6,record_status=$7,revision=nodes.revision+1,updated_at=NOW()`,
      [nodeSnapshot.id, nodeSnapshot.label, nodeSnapshot.type, nodeSnapshot.family, nodeSnapshot.hex_color, nodeSnapshot.metadata, nodeSnapshot.record_status || 'active', nodeSnapshot.revision || 1, nodeSnapshot.created_at]
    );
    for (const edge of snapshot.edges || []) await restoreSnapshot(client, 'edge', edge.id, edge);
  } else {
    await client.query(
      `INSERT INTO edges (id,source,target,type,evidence,confidence,evidence_data,record_status,revision,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) ON CONFLICT(id) DO UPDATE SET
       source=$2,target=$3,type=$4,evidence=$5,confidence=$6,evidence_data=$7,record_status=$8,revision=edges.revision+1,updated_at=NOW()`,
      [snapshot.id, snapshot.source, snapshot.target, snapshot.type, snapshot.evidence, snapshot.confidence, snapshot.evidence_data, snapshot.record_status || 'active', snapshot.revision || 1, snapshot.created_at]
    );
  }
}

async function addHistory(client, entityType, entityId, action, before, after, author, reason, proposalId) {
  await client.query(
    `INSERT INTO graph_history (id,entity_type,entity_id,action,before_data,after_data,author,reason,proposal_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [crypto.randomUUID(), entityType, entityId, action, before, after, author, reason, proposalId]
  );
}

function normalizeNodeInput(value = {}) {
  const label = String(value.label || '').trim();
  return { id: slugify(value.id || label), label, type: String(value.type || '').trim(), family: nullableText(value.family), hexColor: nullableText(value.hexColor || value.hex_color), metadata: value.metadata && typeof value.metadata === 'object' ? value.metadata : {} };
}

function normalizeRelationships(values, sourceId) {
  return values.filter(value => value && (value.target || value.type)).map(value => {
    const target = String(value.target || '').trim();
    const type = String(value.type || '').trim();
    const evidenceData = {
      source: requiredText(value.source, 'Evidence source is required.'),
      evidenceType: requiredText(value.evidenceType, 'Evidence type is required.'),
      boundary: requiredText(value.boundary, 'Evidence boundary is required.'),
      author: requiredText(value.author, 'Evidence author is required.'),
      date: value.date || new Date().toISOString(),
      reviewStatus: 'proposed',
      counterexample: requiredText(value.counterexample, 'Counterexample or falsification condition is required.')
    };
    if (!ALLOWED_EVIDENCE_TYPES.has(evidenceData.evidenceType)) throw httpError(400, `Unsupported evidence type: ${evidenceData.evidenceType}`);
    return { id: String(value.id || `${sourceId}->${target}:${type}`).trim(), source: sourceId, target, type, evidence: requiredText(value.evidence, 'Relationship evidence is required.'), confidence: nullableText(value.confidence) || 'medium', evidenceData };
  });
}

function validateNodeInput(node) {
  if (!node?.id || !node.label || !node.type) throw httpError(400, 'Node label and type are required.');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(node.id)) throw httpError(400, 'Node id must use lowercase letters, numbers, and hyphens.');
  if (!ALLOWED_NODE_TYPES.has(node.type)) throw httpError(400, `Unsupported node type: ${node.type}`);
  if (node.hexColor && !/^#[0-9a-f]{6}$/i.test(node.hexColor)) throw httpError(400, 'Hex color must use #RRGGBB format.');
  if (!String(node.metadata.boundary || '').trim()) throw httpError(400, 'A boundary note is required.');
}

function validateRelationship(edge) {
  if (!edge.target || !edge.type) throw httpError(400, 'Relationship target and type are required.');
  if (!/^[a-z0-9_]+$/.test(edge.type)) throw httpError(400, 'Relationship type must use lowercase letters, numbers, and underscores.');
  if (!ALLOWED_CONFIDENCE.has(edge.confidence)) throw httpError(400, 'Confidence must be high, medium, or low.');
}

function requiredText(value, message) { const text = String(value || '').trim(); if (!text) throw httpError(400, message); return text; }
function nullableText(value) { const text = String(value || '').trim(); return text || null; }
function slugify(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function clearGraphCache() {}
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }

export default router;
