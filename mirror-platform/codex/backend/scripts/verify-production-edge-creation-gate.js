import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import express from 'express';
import { createAccessToken } from '../src/auth/tokens.js';
import { pool, query } from '../src/db/pool.js';
import { sha256, sealCreationReceipt } from '../src/lib/edge-creation-receipts.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import graphRouter from '../src/routes/graph.js';

const CAPABILITY = 'persistent-receipt-v2';
const REPORT_PATH = process.env.EDGE_GATE_SMOKE_REPORT || 'attempt-65-production-edge-gate-smoke.json';
const runId = crypto.randomUUID().slice(0, 8);
const actor = `attempt65-${runId}`;
const userId = `a65-${runId}-admin`;
const sourceId = `a65-${runId}-source`;
const targetId = `a65-${runId}-target`;
const edgeId = `a65-${runId}-edge`;
const receiptId = `CBER65-${runId}`;
let proposalId = null;
let server = null;

if (process.env.ALLOW_PRODUCTION_EDGE_GATE_SMOKE !== '1') {
  throw new Error('Set ALLOW_PRODUCTION_EDGE_GATE_SMOKE=1 to run the bounded production persistence probe.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error('A temporary AUTH_SECRET of at least 32 characters is required.');
}

const databaseHost = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
const localDatabase = ['127.0.0.1', 'localhost', '::1'].includes(databaseHost);
if (localDatabase && process.env.ALLOW_LOCAL_EDGE_GATE_SMOKE !== '1') {
  throw new Error('The production smoke command refuses a local database unless ALLOW_LOCAL_EDGE_GATE_SMOKE=1 is set.');
}

const report = {
  version: 'chromabridge-attempt-65-production-edge-gate-smoke.v1',
  capability: CAPABILITY,
  runId,
  startedAt: new Date().toISOString(),
  databaseBoundary: localDatabase ? 'explicit-local-verification' : 'production-database-secret',
  endpoints: {},
  persisted: {},
  replay: {},
  cleanup: {},
  result: 'RUNNING',
  boundary: 'Synthetic endpoints test the deployed persistence path. They do not assert color meaning or remain in the graph.'
};

try {
  await verifySchema();
  await installFixtures();
  const { baseUrl, close } = await startRouter();
  server = { close };
  const token = createAccessToken({
    id: userId,
    username: actor,
    email: `${actor}@invalid.example`,
    role: 'admin',
    token_version: 1
  });
  const receipt = makeReceipt();
  const relationship = makeRelationship();

  const proposed = await request(baseUrl, '/api/v1/graph/proposals', token, {
    method: 'POST',
    body: {
      operation: 'create_relationship',
      payload: { relationship, creationReceipt: receipt },
      rationale: 'Attempt 65 bounded production persistence smoke test.'
    }
  });
  assertStatus(proposed, 201, 'proposal');
  proposalId = proposed.body.id;
  report.endpoints.proposal = { status: proposed.status, proposalId, state: proposed.body.status };

  const reviewed = await request(baseUrl, `/api/v1/graph/proposals/${proposalId}/review`, token, {
    method: 'PATCH',
    body: { decision: 'reviewed', reviewNote: 'Attempt 65 synthetic production smoke review.' }
  });
  assertStatus(reviewed, 200, 'review');
  report.endpoints.review = { status: reviewed.status, state: reviewed.body.status };

  const approved = await request(baseUrl, `/api/v1/graph/proposals/${proposalId}/approve`, token, {
    method: 'POST', body: {}
  });
  assertStatus(approved, 200, 'approval');
  if (approved.body.disposition !== 'EDGE_AND_RECEIPT_COMMITTED') {
    throw new Error(`Approval returned unexpected disposition: ${approved.body.disposition}`);
  }
  report.endpoints.approval = {
    status: approved.status,
    state: approved.body.status,
    disposition: approved.body.disposition
  };

  const replayed = await request(baseUrl, `/api/v1/graph/proposals/${proposalId}/approve`, token, {
    method: 'POST', body: {}
  });
  assertStatus(replayed, 200, 'idempotent replay');
  if (!['EDGE_AND_RECEIPT_COMMITTED', 'IDEMPOTENT_REPLAY'].includes(replayed.body.disposition)
      || replayed.body.idempotent !== true) {
    throw new Error('Exact approval replay was not idempotent.');
  }
  report.replay = {
    status: replayed.status,
    disposition: replayed.body.disposition,
    idempotent: replayed.body.idempotent
  };

  report.persisted = await fixtureCounts();
  assertCounts(report.persisted, { proposals: 1, receipts: 1, edges: 1, history: 1 });
  report.result = 'LIVE PERSISTENT CREATION GATE VALIDATED';
} catch (error) {
  report.result = 'UNRESOLVED';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  if (server) await server.close();
  try {
    await cleanupFixtures();
    report.cleanup = await fixtureCounts();
    assertCounts(report.cleanup, { proposals: 0, receipts: 0, edges: 0, history: 0 });
    const nodes = await query('SELECT COUNT(*)::int AS count FROM nodes WHERE id IN ($1,$2)', [sourceId, targetId]);
    const users = await query('SELECT COUNT(*)::int AS count FROM users WHERE id=$1', [userId]);
    report.cleanup.nodes = nodes.rows[0].count;
    report.cleanup.users = users.rows[0].count;
    if (report.cleanup.nodes !== 0 || report.cleanup.users !== 0) throw new Error('Fixture cleanup left a node or user row.');
  } catch (cleanupError) {
    report.result = 'UNRESOLVED';
    report.cleanupError = cleanupError.message;
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  await pool.end();
}

async function verifySchema() {
  const result = await query("SELECT to_regclass('public.edge_creation_receipts') AS table_name");
  if (result.rows[0]?.table_name !== 'edge_creation_receipts') {
    throw new Error('edge_creation_receipts is not present in the target database.');
  }
}

async function installFixtures() {
  await query(
    `INSERT INTO users (id,username,email,password_hash,role,must_change_password,token_version,email_verified_at,signup_source)
     VALUES ($1,$2,$3,$4,'admin',FALSE,1,NOW(),'legacy')`,
    [userId, actor, `${actor}@invalid.example`, 'attempt-65-non-login-fixture']
  );
  await query(
    `INSERT INTO nodes (id,label,type,metadata) VALUES
     ($1,$2,'theme',$3),($4,$5,'theme',$6)`,
    [
      sourceId,
      'Attempt 65 source',
      { boundary: 'Synthetic production-persistence fixture.' },
      targetId,
      'Attempt 65 target',
      { boundary: 'Synthetic production-persistence fixture.' }
    ]
  );
}

async function startRouter() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/v1', graphRouter);
  app.use(errorHandler);
  const listener = await new Promise((resolve, reject) => {
    const candidate = app.listen(0, '127.0.0.1', () => resolve(candidate));
    candidate.on('error', reject);
  });
  const address = listener.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()))
  };
}

function makeRelationship() {
  return {
    id: edgeId,
    source: sourceId,
    target: targetId,
    type: 'supports',
    evidence: 'Attempt 65 bounded production persistence fixture.',
    confidence: 'medium',
    evidenceData: {
      source: 'attempt-65-production-smoke',
      evidenceType: 'system_rule',
      boundary: 'Synthetic fixture; verifies persistence behavior, not color meaning.',
      author: actor,
      date: new Date().toISOString(),
      reviewStatus: 'reviewed',
      counterexample: 'Reject if receipt, edge, and history are not committed together.'
    }
  };
}

function makeReceipt() {
  const sourceText = JSON.stringify({ runId, sourceId, targetId, edgeId, capability: CAPABILITY });
  const sourceHash = sha256(Buffer.from(sourceText, 'utf8'));
  const frozenFile = `production-smoke:${runId}`;
  return sealCreationReceipt({
    receiptVersion: 'chromabridge-edge-receipt.v2',
    receiptId,
    receiptClass: 'CREATION',
    fixtureUse: 'BOUNDED_PRODUCTION_PERSISTENCE_TEST_ONLY',
    creationContext: {
      requestId: `A65-REQ-${runId}`,
      idempotencyKey: `A65-IDEM-${runId}`,
      createdAt: new Date().toISOString(),
      actorId: actor,
      profileScope: 'bounded-production-smoke'
    },
    edge: {
      edgeId,
      relationship: 'supports',
      wordNode: { recordId: sourceId, name: 'Attempt 65 source', tier: 'test' },
      baseNode: { recordId: targetId, name: 'Attempt 65 target', tier: 'test' }
    },
    source: {
      system: 'Attempt 65 production persistence smoke',
      version: '1',
      frozenFiles: [{ file: frozenFile, sha256: sourceHash, bytes: Buffer.byteLength(sourceText) }]
    },
    endpointEvidence: {
      wordSenseKeys: [{ senseKey: `${sourceId}%test`, synsetId: sourceId, locator: { file: frozenFile, line: 1, lineSha256: sourceHash } }],
      baseSenseKeys: [{ senseKey: `${targetId}%test`, synsetId: targetId, locator: { file: frozenFile, line: 1, lineSha256: sourceHash } }]
    },
    relation: {
      pathDisposition: 'SUPPORTS',
      selectedPath: {
        length: 1,
        nodes: [sourceId, targetId],
        symbols: ['supports'],
        directions: ['forward'],
        transitionLocators: [{
          file: frozenFile,
          line: 1,
          lineSha256: sourceHash,
          synsetId: sourceId,
          pointerSymbol: 'supports',
          pointerDirection: 'forward',
          pointerTarget: targetId
        }]
      },
      candidatePaths: [],
      maxPointerHops: 1
    },
    decision: {
      status: 'VERIFY',
      ruleId: 'A65-BOUNDED-PRODUCTION-SMOKE-v1',
      explanation: 'Verify the persistent creation gate, not a semantic color claim.',
      evidenceSha256: null
    },
    provenance: { capturedAtCreation: true, sourceReceipt: null, gaps: [] },
    requestedAction: 'COMMIT_EDGE',
    integrity: { receiptSha256: null }
  });
}

async function request(baseUrl, pathname, token, { method, body }) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  return { status: response.status, body: parsed };
}

function assertStatus(response, expected, stage) {
  if (response.status !== expected) {
    throw new Error(`${stage} returned HTTP ${response.status}: ${response.body?.error || 'unexpected response'}`);
  }
}

async function fixtureCounts() {
  const [proposals, receipts, edges, history] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM graph_proposals WHERE author=$1', [actor]),
    query('SELECT COUNT(*)::int AS count FROM edge_creation_receipts WHERE created_by=$1', [actor]),
    query('SELECT COUNT(*)::int AS count FROM edges WHERE id=$1', [edgeId]),
    query("SELECT COUNT(*)::int AS count FROM graph_history WHERE entity_type='edge' AND entity_id=$1", [edgeId])
  ]);
  return {
    proposals: proposals.rows[0].count,
    receipts: receipts.rows[0].count,
    edges: edges.rows[0].count,
    history: history.rows[0].count
  };
}

function assertCounts(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) throw new Error(`Expected ${key}=${value}; observed ${actual[key]}.`);
  }
}

async function cleanupFixtures() {
  await query("DELETE FROM graph_history WHERE author=$1 OR (entity_type='edge' AND entity_id=$2)", [actor, edgeId]);
  await query('DELETE FROM edges WHERE id=$1', [edgeId]);
  await query('DELETE FROM edge_creation_receipts WHERE created_by=$1', [actor]);
  await query('DELETE FROM graph_proposals WHERE author=$1', [actor]);
  await query('DELETE FROM nodes WHERE id IN ($1,$2)', [sourceId, targetId]);
  await query('DELETE FROM users WHERE id=$1', [userId]);
}
