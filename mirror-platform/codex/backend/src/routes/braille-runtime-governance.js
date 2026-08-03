import crypto from 'node:crypto';
import express from 'express';
import { pool, query } from '../db/pool.js';
import { requireAdmin, requireAuth, requirePasswordCurrent } from '../middleware/auth.js';
import { assembleBrailleRuntimeModule } from '../lib/braille-runtime-module.js';

const router = express.Router();
const TOKEN_TTL_MINUTES = 15;
const ROUTE_ACTIONS = new Set(['propose_route', 'propose_relationship']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);

router.post('/foundation/braille-runtime/modules', requireAuth, requirePasswordCurrent, async (req, res, next) => {
  let client;
  try {
    const assembled = assembleBrailleRuntimeModule(req.body?.input, req.body?.observedValue, req.body?.proposalDecision);
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO braille_runtime_modules
       (id,template_id,entrypoint,compiled_instruction,module_plan,status,created_by)
       VALUES ($1,$2,$3,$4,$5,'assembled',$6)
       ON CONFLICT (id) DO NOTHING RETURNING *`,
      [assembled.module.id, assembled.module.templateId, assembled.module.entrypoint, assembled.compiledInstruction, assembled.module, req.user.username]
    );
    if (!result.rows.length) throw httpError(409, 'This deterministic module has already been submitted.');
    await addEvent(client, assembled.module.id, 'assembled', req.user.username, {
      templateId: assembled.module.templateId,
      boundary: assembled.boundary.mode
    });
    await client.query('COMMIT');
    res.status(201).json({ module: publicModule(result.rows[0]), boundary: assembled.boundary });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { client?.release(); }
});

router.get('/foundation/braille-runtime/modules', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = nullableText(req.query.status);
    const result = status
      ? await query('SELECT * FROM braille_runtime_modules WHERE status=$1 ORDER BY created_at DESC LIMIT 200', [status])
      : await query('SELECT * FROM braille_runtime_modules ORDER BY created_at DESC LIMIT 200');
    res.json({ modules: result.rows.map(publicModule), count: result.rows.length });
  } catch (error) { next(error); }
});

router.post('/foundation/braille-runtime/modules/:id/review', requireAuth, requireAdmin, async (req, res, next) => {
  let client;
  try {
    const decision = String(req.body?.decision || '');
    if (!['approved', 'rejected'].includes(decision)) throw httpError(400, 'Decision must be approved or rejected.');
    const reviewNote = requiredText(req.body?.reviewNote, 'Review note is required.');
    const rawToken = decision === 'approved' ? crypto.randomBytes(32).toString('base64url') : null;
    const tokenHash = rawToken ? hashToken(rawToken) : null;
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE braille_runtime_modules SET status=$2,reviewer=$3,review_note=$4,reviewed_at=NOW(),updated_at=NOW(),
       activation_token_hash=$5::text,activation_token_expires_at=CASE WHEN $5::text IS NULL THEN NULL ELSE NOW() + INTERVAL '${TOKEN_TTL_MINUTES} minutes' END
       WHERE id=$1 AND status='assembled' RETURNING *`,
      [req.params.id, decision === 'approved' ? 'reviewed' : 'rejected', req.user.username, reviewNote, tokenHash]
    );
    if (!result.rows.length) throw httpError(409, 'Only assembled modules can be reviewed.');
    await addEvent(client, req.params.id, decision === 'approved' ? 'reviewed' : 'rejected', req.user.username, { reviewNote });
    await client.query('COMMIT');
    res.json({
      module: publicModule(result.rows[0]),
      ...(rawToken ? { activation: { token: rawToken, expiresInSeconds: TOKEN_TTL_MINUTES * 60, singleUse: true } } : {})
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { client?.release(); }
});

router.post('/foundation/braille-runtime/modules/:id/activate', requireAuth, requireAdmin, async (req, res, next) => {
  let client;
  try {
    const rawToken = requiredText(req.body?.activationToken, 'Activation token is required.');
    const suppliedHash = hashToken(rawToken);
    client = await pool.connect();
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM braille_runtime_modules WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!found.rows.length) throw httpError(404, 'Braille Runtime module not found.');
    const module = found.rows[0];
    if (!safeEqual(suppliedHash, module.activation_token_hash)) throw httpError(403, 'Activation authority is invalid.');
    if (module.status === 'activated' && module.activation_result) {
      await client.query('COMMIT');
      return res.json({ module: publicModule(module), result: module.activation_result, idempotent: true });
    }
    if (module.status !== 'reviewed') throw httpError(409, 'The module is not approved for activation.');
    if (module.activation_token_used_at) throw httpError(409, 'Activation authority has already been used.');
    if (!module.activation_token_expires_at || new Date(module.activation_token_expires_at).getTime() <= Date.now()) {
      throw httpError(410, 'Activation authority has expired.');
    }

    const action = module.compiled_instruction.action;
    const activationResult = ROUTE_ACTIONS.has(action)
      ? await createRelationshipProposal(client, module, req.user.username, req.body?.parameters)
      : {
          type: action === 'propose_rule' ? 'rule_review_record' : action === 'record_evidence' ? 'evidence_review_record' : 'pattern_evaluation_record',
          status: 'recorded_for_review',
          graphProposalId: null
        };
    const updated = await client.query(
      `UPDATE braille_runtime_modules SET status='activated',activation_token_used_at=NOW(),activation_result=$2,
       graph_proposal_id=$3,activated_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING *`,
      [module.id, activationResult, activationResult.graphProposalId]
    );
    await addEvent(client, module.id, 'activated', req.user.username, activationResult);
    await client.query('COMMIT');
    res.json({ module: publicModule(updated.rows[0]), result: activationResult, idempotent: false });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { client?.release(); }
});

router.post('/foundation/braille-runtime/modules/:id/authority', requireAuth, requireAdmin, async (req, res, next) => {
  let client;
  try {
    const reason = requiredText(req.body?.reason, 'Authority issuance reason is required.');
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE braille_runtime_modules SET activation_token_hash=$2,activation_token_expires_at=NOW() + INTERVAL '${TOKEN_TTL_MINUTES} minutes',
       activation_token_used_at=NULL,updated_at=NOW() WHERE id=$1 AND status='reviewed' RETURNING *`,
      [req.params.id, tokenHash]
    );
    if (!result.rows.length) throw httpError(409, 'Only a reviewed, inactive module can receive activation authority.');
    await addEvent(client, req.params.id, 'authority_issued', req.user.username, { reason, expiresInSeconds: TOKEN_TTL_MINUTES * 60 });
    await client.query('COMMIT');
    res.json({ module: publicModule(result.rows[0]), activation: { token: rawToken, expiresInSeconds: TOKEN_TTL_MINUTES * 60, singleUse: true } });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { client?.release(); }
});

router.get('/foundation/braille-runtime/modules/:id/events', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id,module_id,event_type,actor,details,created_at FROM braille_runtime_module_events WHERE module_id=$1 ORDER BY created_at,id',
      [req.params.id]
    );
    res.json({ events: result.rows, count: result.rows.length });
  } catch (error) { next(error); }
});

export default router;

async function createRelationshipProposal(client, module, actor, value = {}) {
  const source = identifier(value?.sourceNodeId, 'Source node id is required.');
  const target = identifier(value?.targetNodeId, 'Target node id is required.');
  if (source === target) throw httpError(400, 'A relationship route requires different source and target nodes.');
  const type = requiredText(value?.relationshipType, 'Relationship type is required.');
  if (!/^[a-z0-9_]+$/.test(type)) throw httpError(400, 'Relationship type must use lowercase letters, numbers, and underscores.');
  const confidence = String(value?.confidence || 'medium');
  if (!CONFIDENCE.has(confidence)) throw httpError(400, 'Confidence must be high, medium, or low.');
  const evidence = requiredText(value?.evidence, 'Relationship evidence is required.');
  const counterexample = requiredText(value?.counterexample, 'Counterexample or falsification condition is required.');
  const existing = await client.query("SELECT id FROM nodes WHERE id IN ($1,$2) AND record_status='active'", [source, target]);
  if (existing.rows.length !== 2) throw httpError(400, 'Both route endpoints must be active approved graph nodes.');
  const proposalId = crypto.randomUUID();
  const edgeId = `${source}->${target}:${type}`;
  const relationship = {
    id: edgeId,
    source,
    target,
    type,
    evidence,
    confidence,
    evidenceData: {
      source: `braille-runtime-module:${module.id}`,
      evidenceType: 'system_rule',
      boundary: 'Module activation creates a proposal for review, not approved semantic truth.',
      author: actor,
      date: new Date().toISOString(),
      reviewStatus: 'proposed',
      counterexample
    }
  };
  await client.query(
    `INSERT INTO graph_proposals (id,operation,target_id,payload,status,author,rationale)
     VALUES ($1,'create_relationship',NULL,$2,'proposed',$3,$4)`,
    [proposalId, { relationship }, actor, `Governed Braille Runtime module ${module.id}: ${module.compiled_instruction.originalEnglish}`]
  );
  return { type: 'graph_relationship_proposal', status: 'proposed', graphProposalId: proposalId, relationshipId: edgeId };
}

async function addEvent(client, moduleId, eventType, actor, details) {
  await client.query(
    'INSERT INTO braille_runtime_module_events (id,module_id,event_type,actor,details) VALUES ($1,$2,$3,$4,$5)',
    [crypto.randomUUID(), moduleId, eventType, actor, details]
  );
}

function publicModule(row) {
  return {
    id: row.id,
    templateId: row.template_id,
    entrypoint: row.entrypoint,
    compiledInstruction: row.compiled_instruction,
    modulePlan: row.module_plan,
    status: row.status,
    createdBy: row.created_by,
    reviewer: row.reviewer,
    reviewNote: row.review_note,
    graphProposalId: row.graph_proposal_id,
    activationResult: row.activation_result,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    activatedAt: row.activated_at,
    updatedAt: row.updated_at
  };
}

function hashToken(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function requiredText(value, message) {
  const text = String(value || '').trim();
  if (!text) throw httpError(400, message);
  return text;
}
function identifier(value, message) {
  const text = requiredText(value, message);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(text)) throw httpError(400, 'Node ids must use lowercase letters, numbers, and hyphens.');
  return text;
}
function nullableText(value) { const text = String(value || '').trim(); return text || null; }
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
