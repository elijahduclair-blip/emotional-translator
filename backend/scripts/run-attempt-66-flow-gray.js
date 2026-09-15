import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createAccessToken } from '../src/auth/tokens.js';
import { pool, query } from '../src/db/pool.js';
import { sha256, sealCreationReceipt } from '../src/lib/edge-creation-receipts.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import graphRouter from '../src/routes/graph.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPABILITY = 'persistent-receipt-v2';
const REPORT_PATH = process.env.ATTEMPT_66_REPORT || 'attempt-66-flow-gray.json';
const EVIDENCE_PATH = path.resolve(__dirname, '../evidence/attempt-66-flow-gray.txt');
const RECEIPT_ID = 'CBER66-FLOW-GRAY';
const IDEMPOTENCY_KEY = 'A66-FLOW-GRAY-v1';
const SOURCE_ID = 'condition-word-flow';
const TARGET_ID = 'family-gray';
const EDGE_ID = 'condition-word-flow-to-family-gray-elijah-profile-association';
const runId = crypto.randomUUID().slice(0, 8);
const actor = `attempt66-evidence-runner-${runId}`;
const userId = `a66-${runId}-admin`;
let proposalId = null;
let server = null;

if (process.env.ALLOW_PRODUCTION_COLOR_RECEIPT !== '1') {
  throw new Error('Set ALLOW_PRODUCTION_COLOR_RECEIPT=1 to preserve the bounded Attempt 66 receipt.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error('A temporary AUTH_SECRET of at least 32 characters is required.');
}

const databaseHost = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
if (['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) {
  throw new Error('Attempt 66 requires the production database secret.');
}

const report = {
  version: 'chromabridge-attempt-66-flow-gray.v1',
  capability: CAPABILITY,
  startedAt: new Date().toISOString(),
  candidate: {
    source: SOURCE_ID,
    target: TARGET_ID,
    relationship: 'conditions_color_climate',
    proposedEdgeId: EDGE_ID
  },
  evidence: {},
  endpoints: {},
  persisted: {},
  graph: {},
  result: 'RUNNING',
  boundary: 'The evidence supports a personal-profile association. It does not establish permission to create a shared graph edge.'
};

try {
  const existing = await query(
    `SELECT r.*, p.status AS proposal_status, p.author, p.reviewer, p.review_note
     FROM edge_creation_receipts r JOIN graph_proposals p ON p.id=r.proposal_id
     WHERE r.receipt_id=$1`,
    [RECEIPT_ID]
  );
  if (existing.rows.length) {
    report.result = 'REAL COLOR RELATIONSHIP PRESERVED AS UNRESOLVED';
    report.reusedExistingReceipt = true;
    report.persisted = summarizeStored(existing.rows[0]);
  } else {
    await verifyEndpointsAndAbsence();
    report.graph.before = await graphCounts();
    const evidence = await loadEvidence();
    report.evidence = evidence.summary;
    await installRunner();
    const { baseUrl, close } = await startRouter();
    server = { close };
    const token = createAccessToken({
      id: userId,
      username: actor,
      email: `${actor}@invalid.example`,
      role: 'admin',
      token_version: 1
    });
    const relationship = makeRelationship();
    const receipt = makeReceipt(evidence);

    const proposed = await request(baseUrl, '/api/v1/graph/proposals', token, {
      method: 'POST',
      body: {
        operation: 'create_relationship',
        payload: { relationship, creationReceipt: receipt },
        rationale: 'Preserve Elijah flow-to-Gray candidate while its personal-versus-shared placement remains unresolved.'
      }
    });
    assertStatus(proposed, 201, 'proposal');
    proposalId = proposed.body.id;
    report.endpoints.proposal = { status: proposed.status, proposalId, state: proposed.body.status };

    const reviewed = await request(baseUrl, `/api/v1/graph/proposals/${proposalId}/review`, token, {
      method: 'PATCH',
      body: {
        decision: 'reviewed',
        reviewNote: 'The statements support the personal association. Shared-graph scope is not established, so the gate must retain an UNRESOLVED receipt only.'
      }
    });
    assertStatus(reviewed, 200, 'review');
    report.endpoints.review = { status: reviewed.status, state: reviewed.body.status };

    const approved = await request(baseUrl, `/api/v1/graph/proposals/${proposalId}/approve`, token, {
      method: 'POST', body: {}
    });
    assertStatus(approved, 200, 'receipt decision');
    if (approved.body.disposition !== 'RECEIPT_ONLY_COMMITTED' || approved.body.status !== 'unresolved') {
      throw new Error(`Unexpected gate result: ${approved.body.disposition} / ${approved.body.status}`);
    }
    report.endpoints.decision = {
      status: approved.status,
      state: approved.body.status,
      disposition: approved.body.disposition
    };

    const replayed = await request(baseUrl, `/api/v1/graph/proposals/${proposalId}/approve`, token, {
      method: 'POST', body: {}
    });
    assertStatus(replayed, 200, 'idempotent replay');
    if (replayed.body.disposition !== 'RECEIPT_ONLY_COMMITTED' || replayed.body.idempotent !== true) {
      throw new Error('Exact UNRESOLVED receipt replay was not idempotent.');
    }
    report.endpoints.replay = {
      status: replayed.status,
      disposition: replayed.body.disposition,
      idempotent: replayed.body.idempotent
    };

    report.persisted = await persistedState(proposalId);
    assertState(report.persisted);
    report.graph.after = await graphCounts();
    if (report.graph.after.activeNodes !== report.graph.before.activeNodes
        || report.graph.after.activeEdges !== report.graph.before.activeEdges) {
      throw new Error('The UNRESOLVED receipt changed the active graph counts.');
    }
    report.result = 'REAL COLOR RELATIONSHIP PRESERVED AS UNRESOLVED';
  }
} catch (error) {
  report.result = 'ATTEMPT 66 FAILED';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  if (server) await server.close();
  try {
    await query('DELETE FROM users WHERE id=$1', [userId]);
    if (process.exitCode && proposalId) {
      const retained = await query('SELECT 1 FROM edge_creation_receipts WHERE proposal_id=$1', [proposalId]);
      if (!retained.rows.length) await query('DELETE FROM graph_proposals WHERE id=$1', [proposalId]);
    }
  } catch (cleanupError) {
    report.cleanupError = cleanupError.message;
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  await pool.end();
}

async function verifyEndpointsAndAbsence() {
  const endpoints = await query(
    "SELECT id,label,type,record_status FROM nodes WHERE id IN ($1,$2) AND record_status='active' ORDER BY id",
    [SOURCE_ID, TARGET_ID]
  );
  if (endpoints.rows.length !== 2) throw new Error('Both real relationship endpoints must exist and be active.');
  const exact = await query(
    "SELECT id FROM edges WHERE source=$1 AND target=$2 AND record_status='active'",
    [SOURCE_ID, TARGET_ID]
  );
  if (exact.rows.length) throw new Error('The live graph already contains the flow-to-Gray relationship.');
  report.graph.endpoints = endpoints.rows;
  report.graph.exactRelationshipBefore = 0;
}

async function loadEvidence() {
  const body = await fs.readFile(EVIDENCE_PATH);
  const text = body.toString('utf8').replace(/\r\n/g, '\n');
  const lines = text.trimEnd().split('\n');
  if (lines.length !== 8) throw new Error(`Expected 8 evidence lines; observed ${lines.length}.`);
  return {
    file: 'backend/evidence/attempt-66-flow-gray.txt',
    bytes: body.length,
    sha256: sha256(body),
    lines,
    lineHashes: lines.map(line => sha256(Buffer.from(line, 'utf8'))),
    summary: {
      file: 'backend/evidence/attempt-66-flow-gray.txt',
      bytes: body.length,
      sha256: sha256(body),
      statementLine: 2,
      scopeLine: 3,
      sourceEndpointLine: 4,
      targetEndpointLine: 5,
      gapLine: 7,
      boundaryLine: 8
    }
  };
}

async function installRunner() {
  await query(
    `INSERT INTO users (id,username,email,password_hash,role,must_change_password,token_version)
     VALUES ($1,$2,$3,$4,'admin',FALSE,1)`,
    [userId, actor, `${actor}@invalid.example`, 'attempt-66-non-login-evidence-runner']
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
    id: EDGE_ID,
    source: SOURCE_ID,
    target: TARGET_ID,
    type: 'conditions_color_climate',
    evidence: 'Elijah stated that making flow grey is the first step and placed the color associations in his profile context.',
    confidence: 'high',
    evidenceData: {
      source: 'attempt-66-flow-gray-evidence',
      evidenceType: 'personal_pattern',
      boundary: 'Personal-profile evidence does not authorize a shared graph edge.',
      author: actor,
      date: new Date().toISOString(),
      reviewStatus: 'reviewed',
      counterexample: 'Resolve as shared only if Elijah explicitly places this association in the shared Theory of Alignment graph.'
    }
  };
}

function makeReceipt(evidence) {
  const locator = line => ({
    file: evidence.file,
    line,
    lineSha256: evidence.lineHashes[line - 1]
  });
  return sealCreationReceipt({
    receiptVersion: 'chromabridge-edge-receipt.v2',
    receiptId: RECEIPT_ID,
    receiptClass: 'CREATION',
    creationContext: {
      requestId: 'A66-REQ-FLOW-GRAY',
      idempotencyKey: IDEMPOTENCY_KEY,
      createdAt: new Date().toISOString(),
      actorId: actor,
      profileScope: 'elijah-personal-profile-candidate'
    },
    edge: {
      edgeId: EDGE_ID,
      relationship: 'conditions_color_climate',
      wordNode: { recordId: SOURCE_ID, name: 'flow', tier: 'common_word' },
      baseNode: { recordId: TARGET_ID, name: 'Gray', tier: 'family' }
    },
    source: {
      system: 'Elijah Theory of Alignment conversation evidence',
      version: 'attempt-66-v1',
      frozenFiles: [{ file: evidence.file, sha256: evidence.sha256, bytes: evidence.bytes }]
    },
    endpointEvidence: {
      wordSenseKeys: [{
        senseKey: 'flow%elijah-condition-climate',
        synsetId: SOURCE_ID,
        locator: locator(4)
      }],
      baseSenseKeys: [{
        senseKey: 'gray%chromabridge-family',
        synsetId: TARGET_ID,
        locator: locator(5)
      }]
    },
    relation: {
      pathDisposition: null,
      selectedPath: null,
      candidatePaths: [
        { lane: 'user_graph', support: [locator(2), locator(3)], status: 'supported' },
        { lane: 'shared_graph', support: [locator(2)], gap: locator(7), status: 'unresolved' }
      ],
      maxPointerHops: 1
    },
    decision: {
      status: 'UNRESOLVED',
      ruleId: 'A66-PERSONAL-SHARED-SCOPE-v1',
      explanation: 'Flow-to-Gray is supported for Elijah personal profile, but the shared graph placement is not authorized by the evidence.',
      evidenceSha256: null
    },
    provenance: {
      capturedAtCreation: true,
      sourceReceipt: null,
      gaps: [{
        type: 'placement_scope',
        locator: locator(7),
        resolution: 'Elijah must explicitly choose personal graph or shared graph.'
      }]
    },
    requestedAction: 'RECEIPT_ONLY',
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

async function persistedState(id) {
  const [proposal, receipt, edge, history] = await Promise.all([
    query('SELECT id,status,author,reviewer,review_note FROM graph_proposals WHERE id=$1', [id]),
    query('SELECT receipt_id,proposal_id,edge_id,decision,requested_action,idempotency_key,receipt_sha256,outcome,created_by,created_at FROM edge_creation_receipts WHERE proposal_id=$1', [id]),
    query('SELECT id FROM edges WHERE id=$1', [EDGE_ID]),
    query("SELECT id FROM graph_history WHERE entity_type='edge' AND entity_id=$1", [EDGE_ID])
  ]);
  return {
    proposalCount: proposal.rows.length,
    receiptCount: receipt.rows.length,
    edgeCount: edge.rows.length,
    historyCount: history.rows.length,
    proposal: proposal.rows[0] ?? null,
    receipt: receipt.rows[0] ?? null
  };
}

function assertState(state) {
  if (state.proposalCount !== 1 || state.receiptCount !== 1 || state.edgeCount !== 0 || state.historyCount !== 0) {
    throw new Error('The retained UNRESOLVED state is not proposal=1, receipt=1, edge=0, history=0.');
  }
  if (state.proposal?.status !== 'unresolved' || state.receipt?.decision !== 'UNRESOLVED'
      || state.receipt?.requested_action !== 'RECEIPT_ONLY' || state.receipt?.edge_id !== null) {
    throw new Error('The retained proposal or receipt state is inconsistent.');
  }
}

function summarizeStored(row) {
  return {
    proposalCount: 1,
    receiptCount: 1,
    edgeCount: 0,
    historyCount: 0,
    proposal: {
      id: row.proposal_id,
      status: row.proposal_status,
      author: row.author,
      reviewer: row.reviewer,
      review_note: row.review_note
    },
    receipt: {
      receipt_id: row.receipt_id,
      proposal_id: row.proposal_id,
      edge_id: row.edge_id,
      decision: row.decision,
      requested_action: row.requested_action,
      idempotency_key: row.idempotency_key,
      receipt_sha256: row.receipt_sha256,
      outcome: row.outcome,
      created_by: row.created_by,
      created_at: row.created_at
    }
  };
}

async function graphCounts() {
  const [nodes, edges, exact] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM nodes WHERE record_status='active'"),
    query("SELECT COUNT(*)::int AS count FROM edges WHERE record_status='active'"),
    query("SELECT COUNT(*)::int AS count FROM edges WHERE id=$1 AND record_status='active'", [EDGE_ID])
  ]);
  return {
    activeNodes: nodes.rows[0].count,
    activeEdges: edges.rows[0].count,
    flowGrayEdge: exact.rows[0].count
  };
}
