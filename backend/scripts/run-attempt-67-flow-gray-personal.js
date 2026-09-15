import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createAccessToken } from '../src/auth/tokens.js';
import { pool, query } from '../src/db/pool.js';
import { sha256 } from '../src/lib/edge-creation-receipts.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import usersRouter from '../src/routes/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPABILITY = 'personal-receipt-placement-v1';
const REPORT_PATH = process.env.ATTEMPT_67_REPORT || 'attempt-67-flow-gray-personal.json';
const EVIDENCE_PATH = path.resolve(__dirname, '../evidence/attempt-67-flow-gray-personal.txt');
const OWNER_USERNAME = process.env.ATTEMPT_67_OWNER_USERNAME || 'elijah_duclair';
const RECEIPT_ID = 'CBER66-FLOW-GRAY';
const IDEMPOTENCY_KEY = 'A67-FLOW-GRAY-PERSONAL-v1';
const SOURCE_ID = 'condition-word-flow';
const TARGET_ID = 'family-gray';
const RELATIONSHIP_TYPE = 'conditions_color_climate';
let server = null;

if (process.env.ALLOW_PRODUCTION_PERSONAL_PLACEMENT !== '1') {
  throw new Error('Set ALLOW_PRODUCTION_PERSONAL_PLACEMENT=1 to place the bounded Attempt 67 personal relationship.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error('A temporary AUTH_SECRET of at least 32 characters is required.');
}

const databaseHost = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
if (['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) {
  throw new Error('Attempt 67 requires the production database secret.');
}

const report = {
  version: 'chromabridge-attempt-67-flow-gray-personal.v1',
  capability: CAPABILITY,
  startedAt: new Date().toISOString(),
  candidate: {
    source: SOURCE_ID,
    target: TARGET_ID,
    relationship: RELATIONSHIP_TYPE,
    sourceReceiptId: RECEIPT_ID,
    destination: 'elijah_personal_graph'
  },
  evidence: {},
  owner: { username: OWNER_USERNAME, profileScope: 'personal' },
  receipt: {},
  endpoints: {},
  personalGraph: {},
  sharedGraph: {},
  result: 'RUNNING',
  boundary: 'This placement changes only Elijah personal overlay. The shared graph and Color Atlas remain unchanged.'
};

try {
  const evidence = await loadEvidence();
  report.evidence = evidence.summary;
  const owner = await findOwner();
  report.receipt = await receiptState();
  assertReceipt(report.receipt);
  report.sharedGraph.before = await sharedCounts();
  report.personalGraph.before = await personalCounts(owner.id);

  const { baseUrl, close } = await startRouter();
  server = { close };
  const token = createAccessToken(owner);
  const body = {
    confirmed: true,
    receiptId: RECEIPT_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    confidence: 'high',
    reviewNote: `Elijah explicitly selected the personal graph lane. Evidence: backend/evidence/attempt-67-flow-gray-personal.txt sha256 ${evidence.summary.sha256}.`,
    counterexample: 'Retire or revise this personal relationship if Elijah changes or withdraws the flow-to-Gray association.'
  };

  const placed = await request(baseUrl, `/api/v1/users/${owner.id}/graph/relationships/from-receipt`, token, {
    method: 'POST', body
  });
  if (![200, 201].includes(placed.status)) {
    throw new Error(`Personal placement returned HTTP ${placed.status}: ${placed.body?.error || 'unexpected response'}`);
  }
  if (!['PERSONAL_RELATIONSHIP_AND_HISTORY_COMMITTED', 'PERSONAL_RELATIONSHIP_ALREADY_PRESENT'].includes(placed.body?.disposition)) {
    throw new Error(`Unexpected personal placement disposition: ${placed.body?.disposition}`);
  }
  if (placed.body?.relationship?.sourceReceiptId !== RECEIPT_ID
      || placed.body?.relationship?.sourceId !== SOURCE_ID
      || placed.body?.relationship?.targetId !== TARGET_ID
      || placed.body?.boundary?.sharedGraphMutationAllowed !== false) {
    throw new Error('Personal placement response did not preserve the receipt, endpoints, and shared-graph boundary.');
  }
  report.endpoints.placement = {
    status: placed.status,
    disposition: placed.body.disposition,
    idempotent: placed.body.idempotent
  };

  const replay = await request(baseUrl, `/api/v1/users/${owner.id}/graph/relationships/from-receipt`, token, {
    method: 'POST', body
  });
  if (replay.status !== 200 || replay.body?.idempotent !== true
      || replay.body?.relationship?.id !== placed.body?.relationship?.id) {
    throw new Error('Exact personal placement replay was not idempotent.');
  }
  report.endpoints.replay = {
    status: replay.status,
    disposition: replay.body.disposition,
    idempotent: replay.body.idempotent
  };

  const lookup = await request(baseUrl, `/api/v1/users/${owner.id}/graph?text=flow%20gray`, token);
  if (lookup.status !== 200) throw new Error(`Personal lookup returned HTTP ${lookup.status}.`);
  const exact = (lookup.body?.relationships || []).filter(item => item.sourceId === SOURCE_ID
    && item.targetId === TARGET_ID && item.relationshipType === RELATIONSHIP_TYPE);
  if (exact.length !== 1 || lookup.body?.boundary?.sharedGraphMutationAllowed !== false) {
    throw new Error('ARI personal graph lookup did not return exactly one bounded flow-to-Gray relationship.');
  }
  report.endpoints.lookup = {
    status: lookup.status,
    exactRelationshipCount: exact.length,
    sourceLayer: lookup.body.sourceLayer
  };

  report.personalGraph.after = await personalCounts(owner.id);
  if (report.personalGraph.after.relationships !== 1 || report.personalGraph.after.history !== 1) {
    throw new Error('Personal placement did not retain exactly one relationship and one history record.');
  }
  report.sharedGraph.after = await sharedCounts();
  if (JSON.stringify(report.sharedGraph.after) !== JSON.stringify(report.sharedGraph.before)) {
    throw new Error('Attempt 67 changed the shared graph.');
  }
  report.result = 'FLOW → GRAY PLACED IN ELIJAH PERSONAL GRAPH';
} catch (error) {
  report.result = 'ATTEMPT 67 FAILED';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  if (server) await server.close();
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  await pool.end();
}

async function loadEvidence() {
  const body = await fs.readFile(EVIDENCE_PATH);
  const lines = body.toString('utf8').replace(/\r\n/g, '\n').trimEnd().split('\n');
  if (lines.length !== 8) throw new Error(`Expected 8 evidence lines; observed ${lines.length}.`);
  return {
    lines,
    summary: {
      file: 'backend/evidence/attempt-67-flow-gray-personal.txt',
      bytes: body.length,
      sha256: sha256(body),
      personalInstructionLine: 3,
      retainedReceiptLine: 4,
      candidatePathLine: 7,
      resolutionLine: 8
    }
  };
}

async function findOwner() {
  const result = await query(
    `SELECT id,username,email,role,token_version,must_change_password
     FROM users WHERE LOWER(username)=LOWER($1) AND password_hash IS NOT NULL`,
    [OWNER_USERNAME]
  );
  if (result.rows.length !== 1) throw new Error(`Expected exactly one active owner account for username ${OWNER_USERNAME}.`);
  if (result.rows[0].must_change_password) throw new Error('The owner account must have a current password before personal graph placement.');
  return result.rows[0];
}

async function receiptState() {
  const result = await query(
    `SELECT receipt_id,edge_id,decision,requested_action,receipt_sha256,outcome,receipt
     FROM edge_creation_receipts WHERE receipt_id=$1`,
    [RECEIPT_ID]
  );
  if (result.rows.length !== 1) throw new Error(`Retained receipt ${RECEIPT_ID} was not found.`);
  const row = result.rows[0];
  return {
    receiptId: row.receipt_id,
    edgeId: row.edge_id,
    decision: row.decision,
    requestedAction: row.requested_action,
    receiptSha256: row.receipt_sha256,
    outcome: row.outcome,
    profileScope: row.receipt?.creationContext?.profileScope,
    personalLane: (row.receipt?.relation?.candidatePaths || []).find(item => item?.lane === 'user_graph')?.status || null,
    sharedLane: (row.receipt?.relation?.candidatePaths || []).find(item => item?.lane === 'shared_graph')?.status || null,
    placementScopeGap: (row.receipt?.provenance?.gaps || []).some(item => item?.type === 'placement_scope')
  };
}

function assertReceipt(receipt) {
  if (receipt.receiptId !== RECEIPT_ID || receipt.edgeId !== null || receipt.decision !== 'UNRESOLVED'
      || receipt.requestedAction !== 'RECEIPT_ONLY' || receipt.outcome !== 'RECEIPT_ONLY_COMMITTED'
      || receipt.personalLane !== 'supported' || receipt.sharedLane !== 'unresolved' || !receipt.placementScopeGap) {
    throw new Error('Attempt 66 receipt no longer preserves the supported personal lane and unresolved shared lane.');
  }
}

async function startRouter() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/v1', usersRouter);
  app.use(errorHandler);
  const listener = await new Promise((resolve, reject) => {
    const candidate = app.listen(0, '127.0.0.1', () => resolve(candidate));
    candidate.on('error', reject);
  });
  return {
    baseUrl: `http://127.0.0.1:${listener.address().port}`,
    close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()))
  };
}

async function request(baseUrl, pathname, token, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  return { status: response.status, body: parsed };
}

async function personalCounts(ownerId) {
  const [relationships, history] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS count FROM user_graph_relationships
       WHERE user_id=$1 AND source_node_id=$2 AND target_node_id=$3
         AND relationship_type=$4 AND source_receipt_id=$5 AND record_status='active'`,
      [ownerId, SOURCE_ID, TARGET_ID, RELATIONSHIP_TYPE, RECEIPT_ID]
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM user_graph_history
       WHERE user_id=$1 AND source_receipt_id=$2 AND action='create'`,
      [ownerId, RECEIPT_ID]
    )
  ]);
  return { relationships: relationships.rows[0].count, history: history.rows[0].count };
}

async function sharedCounts() {
  const [nodes, edges, exact, history] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM nodes WHERE record_status='active'"),
    query("SELECT COUNT(*)::int AS count FROM edges WHERE record_status='active'"),
    query("SELECT COUNT(*)::int AS count FROM edges WHERE source=$1 AND target=$2 AND record_status='active'", [SOURCE_ID, TARGET_ID]),
    query(
      `SELECT COUNT(*)::int AS count FROM graph_history
       WHERE entity_type='edge' AND entity_id='condition-word-flow-to-family-gray-elijah-profile-association'`
    )
  ]);
  return {
    activeNodes: nodes.rows[0].count,
    activeEdges: edges.rows[0].count,
    exactRelationship: exact.rows[0].count,
    exactSharedHistory: history.rows[0].count
  };
}
