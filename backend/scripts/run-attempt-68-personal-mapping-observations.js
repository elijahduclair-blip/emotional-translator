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
const REPORT_PATH = process.env.ATTEMPT_68_REPORT || 'attempt-68-personal-mapping-observations.json';
const EVIDENCE_PATH = path.resolve(__dirname, '../evidence/attempt-68-personal-mapping-observations.txt');
const OWNER_USERNAME = process.env.ATTEMPT_68_OWNER_USERNAME || 'elijah_duclair';
const CONTROLLING_REVIEW_SHA256 = '7b8bd64ebf9d58daea78525d82d922535c551d84ad076f0b66352ceff8ec87a4';
const RELATIONSHIP_TYPE = 'associates_color_climate';
const MAPPINGS = [
  { subject: 'momentum', color: 'Red', exactStatement: 'Red is momentum', evidenceLine: 3, idempotencyKey: 'A68-MOMENTUM-RED-v1' },
  { subject: 'stop', color: 'Red', exactStatement: 'Red is also stop and yellow is slow and caution', evidenceLine: 4, idempotencyKey: 'A68-STOP-RED-v1' },
  { subject: 'slow', color: 'Yellow', exactStatement: 'Red is also stop and yellow is slow and caution', evidenceLine: 4, idempotencyKey: 'A68-SLOW-YELLOW-v1' },
  { subject: 'caution', color: 'Yellow', exactStatement: 'Red is also stop and yellow is slow and caution', evidenceLine: 4, idempotencyKey: 'A68-CAUTION-YELLOW-v1' },
];
let server = null;

if (process.env.ALLOW_PRODUCTION_PERSONAL_OBSERVATIONS !== '1') {
  throw new Error('Set ALLOW_PRODUCTION_PERSONAL_OBSERVATIONS=1 to store the bounded Attempt 68 observations.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error('A temporary AUTH_SECRET of at least 32 characters is required.');
}

const databaseHost = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
if (['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) {
  throw new Error('Attempt 68 requires the production database secret.');
}

const report = {
  version: 'chromabridge-attempt-68-personal-mapping-observations.v1',
  capability: 'personal-mapping-observation-v1',
  startedAt: new Date().toISOString(),
  controllingReviewSha256: CONTROLLING_REVIEW_SHA256,
  owner: { username: OWNER_USERNAME, profileScope: 'personal' },
  requestedMappings: MAPPINGS.map(({ subject, color, exactStatement }) => ({ subject, color, exactStatement })),
  evidence: {},
  endpoints: { placements: [], replays: [] },
  observations: {},
  relationships: {},
  sharedGraph: {},
  result: 'RUNNING',
  boundary: 'Each mapping is an owner-confirmed personal observation. No personal relationship, shared graph, or Color Atlas mutation is authorized.'
};

try {
  const evidence = await loadEvidence();
  report.evidence = evidence.summary;
  const owner = await findOwner();
  report.owner.id = owner.id;
  report.observations.before = await personalObservationCounts(owner.id);
  report.relationships.before = await personalRelationshipCount(owner.id);
  report.sharedGraph.before = await sharedCounts();

  const { baseUrl, close } = await startRouter();
  server = { close };
  const token = createAccessToken(owner);

  for (const [index, mapping] of MAPPINGS.entries()) {
    const body = {
      confirmed: true,
      subject: mapping.subject,
      color: mapping.color,
      relationshipType: RELATIONSHIP_TYPE,
      exactStatement: mapping.exactStatement,
      sourceName: 'Elijah and Codex conversation',
      evidence: {
        type: 'owner_direct_statement',
        file: report.evidence.file,
        sha256: report.evidence.sha256,
        line: mapping.evidenceLine,
      },
      context: {
        attempt: 68,
        mappingIndex: index + 1,
        controllingReviewSha256: CONTROLLING_REVIEW_SHA256,
        scopeInstructionLine: 5,
      },
      idempotencyKey: mapping.idempotencyKey,
    };
    const stored = await request(baseUrl, `/api/v1/users/${owner.id}/graph/observations`, token, { method: 'POST', body });
    if (![200, 201].includes(stored.status)) {
      throw new Error(`${mapping.subject} to ${mapping.color} returned HTTP ${stored.status}: ${stored.body?.error || 'unexpected response'}`);
    }
    if (!['PERSONAL_MAPPING_OBSERVATION_AND_RECEIPT_COMMITTED', 'PERSONAL_MAPPING_OBSERVATION_ALREADY_PRESENT'].includes(stored.body?.disposition)) {
      throw new Error(`Unexpected observation disposition for ${mapping.subject}: ${stored.body?.disposition}`);
    }
    if (stored.body?.observation?.subject !== mapping.subject || stored.body?.observation?.color !== mapping.color
        || stored.body?.boundary?.relationshipMutationAllowed !== false || stored.body?.boundary?.sharedGraphMutationAllowed !== false) {
      throw new Error(`Observation response did not preserve the ${mapping.subject} to ${mapping.color} mapping and boundary.`);
    }
    report.endpoints.placements.push({
      subject: mapping.subject,
      color: mapping.color,
      status: stored.status,
      disposition: stored.body.disposition,
      idempotent: stored.body.idempotent,
      observationId: stored.body.observation.id,
      receiptId: stored.body.receipt.receiptId,
      receiptSha256: stored.body.receipt.receiptSha256,
    });

    const replay = await request(baseUrl, `/api/v1/users/${owner.id}/graph/observations`, token, { method: 'POST', body });
    if (replay.status !== 200 || replay.body?.idempotent !== true
        || replay.body?.observation?.id !== stored.body?.observation?.id
        || replay.body?.receipt?.receiptId !== stored.body?.receipt?.receiptId) {
      throw new Error(`Exact replay for ${mapping.subject} to ${mapping.color} was not idempotent.`);
    }
    report.endpoints.replays.push({ subject: mapping.subject, color: mapping.color, status: replay.status, idempotent: true });
  }

  const lookup = await request(baseUrl, `/api/v1/users/${owner.id}/graph/observations`, token);
  if (lookup.status !== 200 || lookup.body?.boundary?.automaticLearningAllowed !== false) {
    throw new Error('ARI personal observation lookup did not preserve the observation-only boundary.');
  }
  const exact = (lookup.body?.observations || []).filter(item => MAPPINGS.some(mapping => mapping.idempotencyKey === item.context?.idempotencyKey
    || (mapping.subject === item.subject && mapping.color.toLowerCase() === item.color.toLowerCase()
      && item.context?.attempt === 68 && item.context?.mappingIndex)));
  const exactIds = new Set(exact.map(item => item.id));
  const exactReceipts = new Set(exact.map(item => item.receiptId));
  if (exact.length !== 4 || exactIds.size !== 4 || exactReceipts.size !== 4) {
    throw new Error(`Expected four exact Attempt 68 observations with four receipts; observed ${exact.length}/${exactReceipts.size}.`);
  }
  const exactSummary = summarize(exact);
  if (exactSummary.observationCount !== 4 || exactSummary.distinctPairCount !== 4 || exactSummary.repeatedPairCount !== 0
      || exactSummary.colors.Red?.distinctSubjectCount !== 2 || exactSummary.colors.Yellow?.distinctSubjectCount !== 2) {
    throw new Error('Attempt 68 recurrence summary did not preserve four distinct pairs and two subjects per color family.');
  }
  report.endpoints.lookup = { status: lookup.status, exactObservationCount: exact.length, sourceLayer: lookup.body.sourceLayer };
  report.observations.attempt68 = exactSummary;
  report.observations.records = exact.map(item => ({
    id: item.id,
    subject: item.subject,
    color: item.color,
    exactStatement: item.exactStatement,
    receiptId: item.receiptId,
    receiptSha256: item.receiptSha256,
    observedAt: item.observedAt,
  }));
  report.observations.after = await personalObservationCounts(owner.id);
  report.relationships.after = await personalRelationshipCount(owner.id);
  if (report.relationships.after !== report.relationships.before) throw new Error('Attempt 68 changed the personal relationship graph.');
  report.sharedGraph.after = await sharedCounts();
  if (JSON.stringify(report.sharedGraph.after) !== JSON.stringify(report.sharedGraph.before)) {
    throw new Error('Attempt 68 changed the shared graph.');
  }
  report.result = 'FOUR PERSONAL COLOR MAPPINGS STORED AS RECEIPT-BACKED OBSERVATIONS';
} catch (error) {
  report.result = 'ATTEMPT 68 FAILED';
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
  if (lines.length !== 10) throw new Error(`Expected 10 evidence lines; observed ${lines.length}.`);
  if (!lines[1].includes(CONTROLLING_REVIEW_SHA256)) throw new Error('Evidence does not preserve the controlling review hash.');
  return {
    lines,
    summary: {
      file: 'backend/evidence/attempt-68-personal-mapping-observations.txt',
      bytes: body.length,
      sha256: sha256(body),
      controllingReviewLine: 2,
      directStatementLines: [3, 4],
      scopeInstructionLine: 5,
      boundaryLine: 10,
    },
  };
}

async function findOwner() {
  const result = await query(
    `SELECT id,username,email,role,token_version,must_change_password
     FROM users WHERE LOWER(username)=LOWER($1) AND password_hash IS NOT NULL`,
    [OWNER_USERNAME]
  );
  if (result.rows.length !== 1) throw new Error(`Expected exactly one active owner account for username ${OWNER_USERNAME}.`);
  if (result.rows[0].must_change_password) throw new Error('The owner account must have a current password before storing personal observations.');
  return result.rows[0];
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
    close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())),
  };
}

async function request(baseUrl, pathname, token, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  return { status: response.status, body: parsed };
}

async function personalObservationCounts(ownerId) {
  const result = await query(
    `SELECT COUNT(*)::int AS observations,COUNT(receipt.receipt_id)::int AS receipts
     FROM user_graph_observations AS observation
     LEFT JOIN user_graph_observation_receipts AS receipt ON receipt.observation_id=observation.id
     WHERE observation.user_id=$1`,
    [ownerId]
  );
  return result.rows[0];
}

async function personalRelationshipCount(ownerId) {
  const result = await query("SELECT COUNT(*)::int AS count FROM user_graph_relationships WHERE user_id=$1 AND record_status='active'", [ownerId]);
  return result.rows[0].count;
}

async function sharedCounts() {
  const [nodes, edges] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM nodes WHERE record_status='active'"),
    query("SELECT COUNT(*)::int AS count FROM edges WHERE record_status='active'"),
  ]);
  return { activeNodes: nodes.rows[0].count, activeEdges: edges.rows[0].count };
}

function summarize(rows) {
  const pairs = new Map();
  const colors = {};
  for (const row of rows) {
    const pair = `${row.subject.toLowerCase()}\u0000${row.color.toLowerCase()}`;
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
    colors[row.color] ||= { observationCount: 0, subjects: new Set() };
    colors[row.color].observationCount += 1;
    colors[row.color].subjects.add(row.subject.toLowerCase());
  }
  return {
    observationCount: rows.length,
    distinctPairCount: pairs.size,
    repeatedPairCount: [...pairs.values()].filter(count => count > 1).length,
    colors: Object.fromEntries(Object.entries(colors).map(([color, item]) => [color, {
      observationCount: item.observationCount,
      distinctSubjectCount: item.subjects.size,
    }])),
  };
}
