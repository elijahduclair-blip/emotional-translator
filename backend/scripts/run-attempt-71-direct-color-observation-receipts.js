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
const REPORT_PATH = process.env.ATTEMPT_71_REPORT || 'attempt-71-direct-color-observation-receipts.json';
const EVIDENCE_PATH = path.resolve(__dirname, '../evidence/attempt-71-direct-color-observation-receipts.txt');
const OWNER_USERNAME = process.env.ATTEMPT_71_OWNER_USERNAME || 'elijah_duclair';
const CONTROLLING_REVIEW_SHA256 = 'f2e8832a07fd4b38949da08c6446217d13f7b24565b7833a88133edd12a073a6';
const RELATIONSHIP_TYPE = 'associates_color_climate';
const EXACT_STATEMENT = 'how about you use words that are associated with colors. for example stop and momentum is Red, slow and caution are yellow. green is grow or plants.';
const MAPPINGS = [
  { subject: 'momentum', color: 'Red', evidenceLine: 4, idempotencyKey: 'A71-MOMENTUM-RED-v1', expectedBefore: 'FIRST_OCCURRENCE', expectedAfter: 'STABLE_PERSONAL_PATTERN' },
  { subject: 'stop', color: 'Red', evidenceLine: 5, idempotencyKey: 'A71-STOP-RED-v1', expectedBefore: 'FIRST_OCCURRENCE', expectedAfter: 'STABLE_PERSONAL_PATTERN' },
  { subject: 'slow', color: 'Yellow', evidenceLine: 6, idempotencyKey: 'A71-SLOW-YELLOW-v1', expectedBefore: 'FIRST_OCCURRENCE', expectedAfter: 'STABLE_PERSONAL_PATTERN' },
  { subject: 'caution', color: 'Yellow', evidenceLine: 7, idempotencyKey: 'A71-CAUTION-YELLOW-v1', expectedBefore: 'FIRST_OCCURRENCE', expectedAfter: 'STABLE_PERSONAL_PATTERN' },
  { subject: 'grow', color: 'Green', evidenceLine: 8, idempotencyKey: 'A71-GROW-GREEN-v1', expectedBefore: null, expectedAfter: 'FIRST_OCCURRENCE' },
  { subject: 'plants', color: 'Green', evidenceLine: 9, idempotencyKey: 'A71-PLANTS-GREEN-v1', expectedBefore: null, expectedAfter: 'FIRST_OCCURRENCE' },
];
let server = null;

if (process.env.ALLOW_PRODUCTION_PERSONAL_OBSERVATIONS !== '1') throw new Error('Set ALLOW_PRODUCTION_PERSONAL_OBSERVATIONS=1 to run bounded Attempt 71.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('A temporary AUTH_SECRET of at least 32 characters is required.');
const databaseHost = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
if (['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) throw new Error('Attempt 71 requires the production database secret.');

const report = {
  version: 'chromabridge-attempt-71-direct-color-observation-receipts.v1',
  capability: 'personal-observation-and-pattern-comparison-v1',
  startedAt: new Date().toISOString(),
  controllingReviewSha256: CONTROLLING_REVIEW_SHA256,
  owner: { username: OWNER_USERNAME, profileScope: 'personal' },
  requestedMappings: MAPPINGS.map(({ subject, color }) => ({ subject, color })),
  evidence: {}, before: {}, placements: [], replays: [], comparison: {}, after: {},
  result: 'RUNNING',
  boundary: 'Personal observations and comparison only. No personal relationship, shared graph, Color Atlas, or shade mutation is authorized.',
};

try {
  report.evidence = await loadEvidence();
  const owner = await findOwner();
  report.owner.id = owner.id;
  report.before = await stateCounts(owner.id);
  const { baseUrl, close } = await startRouter();
  server = { close };
  const token = createAccessToken(owner);

  const beforeComparison = await getComparison(baseUrl, owner.id, token);
  report.comparison.before = selectPairs(beforeComparison.comparison.pairs);
  verifyBefore(report.comparison.before);

  for (const [index, mapping] of MAPPINGS.entries()) {
    const body = {
      confirmed: true,
      subject: mapping.subject,
      color: mapping.color,
      relationshipType: RELATIONSHIP_TYPE,
      exactStatement: EXACT_STATEMENT,
      sourceName: 'Elijah and Codex conversation',
      evidence: { type: 'owner_direct_statement', file: report.evidence.file, sha256: report.evidence.sha256, line: mapping.evidenceLine },
      context: { attempt: 71, mappingIndex: index + 1, controllingReviewSha256: CONTROLLING_REVIEW_SHA256, scopeInstructionLine: 12 },
      idempotencyKey: mapping.idempotencyKey,
    };
    const stored = await request(baseUrl, `/api/v1/users/${owner.id}/graph/observations`, token, { method: 'POST', body });
    if (![200, 201].includes(stored.status)) throw new Error(`${mapping.subject} to ${mapping.color} returned HTTP ${stored.status}: ${stored.body?.error || 'unexpected response'}`);
    if (!['PERSONAL_MAPPING_OBSERVATION_AND_RECEIPT_COMMITTED', 'PERSONAL_MAPPING_OBSERVATION_ALREADY_PRESENT'].includes(stored.body?.disposition)) throw new Error(`Unexpected disposition for ${mapping.subject}: ${stored.body?.disposition}`);
    if (stored.body?.observation?.subject !== mapping.subject || stored.body?.observation?.color !== mapping.color
      || stored.body?.boundary?.relationshipMutationAllowed !== false || stored.body?.boundary?.sharedGraphMutationAllowed !== false) {
      throw new Error(`Observation response did not preserve ${mapping.subject} to ${mapping.color} and its boundary.`);
    }
    report.placements.push({ subject: mapping.subject, color: mapping.color, status: stored.status, disposition: stored.body.disposition, idempotent: stored.body.idempotent, observationId: stored.body.observation.id, receiptId: stored.body.receipt.receiptId, receiptSha256: stored.body.receipt.receiptSha256 });

    const replay = await request(baseUrl, `/api/v1/users/${owner.id}/graph/observations`, token, { method: 'POST', body });
    if (replay.status !== 200 || replay.body?.idempotent !== true || replay.body?.observation?.id !== stored.body?.observation?.id || replay.body?.receipt?.receiptId !== stored.body?.receipt?.receiptId) throw new Error(`Replay was not idempotent for ${mapping.subject} to ${mapping.color}.`);
    report.replays.push({ subject: mapping.subject, color: mapping.color, status: replay.status, idempotent: true });
  }

  const afterComparison = await getComparison(baseUrl, owner.id, token);
  report.comparison.policy = afterComparison.comparison.policy;
  report.comparison.after = selectPairs(afterComparison.comparison.pairs);
  report.comparison.colorRecurrence = afterComparison.comparison.colorRecurrence.filter(item => ['red', 'yellow', 'green'].includes(item.color.toLowerCase()));
  report.comparison.boundary = afterComparison.boundary;
  verifyAfter(report.comparison.after, afterComparison);
  report.after = await stateCounts(owner.id);

  const newPlacements = report.placements.filter(item => item.disposition === 'PERSONAL_MAPPING_OBSERVATION_AND_RECEIPT_COMMITTED').length;
  if (![0, 6].includes(newPlacements)) throw new Error(`Expected a clean first run or complete idempotent replay; observed ${newPlacements} new placements.`);
  if (report.after.personalObservations - report.before.personalObservations !== newPlacements
    || report.after.personalObservationReceipts - report.before.personalObservationReceipts !== newPlacements) throw new Error('Personal observation and receipt deltas do not match committed placements.');
  for (const key of ['personalRelationships', 'sharedActiveNodes', 'sharedActiveEdges']) {
    if (report.after[key] !== report.before[key]) throw new Error(`Attempt 71 changed protected state: ${key}.`);
  }
  report.result = 'FOUR PERSONAL COLOR PATTERNS STABILIZED; TWO GREEN FIRST OCCURRENCES PRESERVED';
} catch (error) {
  report.result = 'ATTEMPT 71 FAILED';
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
  if (lines.length !== 12) throw new Error(`Expected 12 evidence lines; observed ${lines.length}.`);
  if (!lines[1].includes(CONTROLLING_REVIEW_SHA256) || !lines[2].includes(EXACT_STATEMENT)) throw new Error('Evidence does not preserve the controlling review and exact owner statement.');
  return { file: 'backend/evidence/attempt-71-direct-color-observation-receipts.txt', bytes: body.length, sha256: sha256(body), lineCount: lines.length };
}

async function findOwner() {
  const result = await query(`SELECT id,username,email,role,token_version,must_change_password FROM users WHERE LOWER(username)=LOWER($1) AND password_hash IS NOT NULL`, [OWNER_USERNAME]);
  if (result.rows.length !== 1) throw new Error(`Expected exactly one active owner account for username ${OWNER_USERNAME}.`);
  if (result.rows[0].must_change_password) throw new Error('The owner account must have a current password before storing personal observations.');
  return result.rows[0];
}

async function getComparison(baseUrl, ownerId, token) {
  const response = await request(baseUrl, `/api/v1/users/${ownerId}/graph/patterns`, token);
  if (response.status !== 200 || response.body?.sourceLayer !== 'user_graph_observation_comparison') throw new Error(`Pattern comparison returned HTTP ${response.status} without the expected source layer.`);
  const comparison = response.body.comparison;
  if (comparison.policy?.minimumObservations !== 2 || comparison.policy?.minimumDistinctReceipts !== 2 || comparison.policy?.minimumDistinctEvidence !== 2) throw new Error('Pattern comparison policy changed.');
  return response.body;
}

function selectPairs(pairs) {
  return MAPPINGS.map(mapping => pairs.find(pair => pair.subject.toLowerCase() === mapping.subject && pair.color.toLowerCase() === mapping.color.toLowerCase()) || { subject: mapping.subject, color: mapping.color, status: null, observationCount: 0, distinctReceiptCount: 0, distinctEvidenceCount: 0 });
}

function verifyBefore(pairs) {
  for (const mapping of MAPPINGS) {
    const pair = pairs.find(item => item.subject.toLowerCase() === mapping.subject && item.color.toLowerCase() === mapping.color.toLowerCase());
    if (pair.status !== mapping.expectedBefore || pair.observationCount !== (mapping.expectedBefore ? 1 : 0)) throw new Error(`Unexpected precondition for ${mapping.subject} to ${mapping.color}: ${pair.status}/${pair.observationCount}.`);
  }
}

function verifyAfter(pairs, responseBody) {
  for (const mapping of MAPPINGS) {
    const pair = pairs.find(item => item.subject.toLowerCase() === mapping.subject && item.color.toLowerCase() === mapping.color.toLowerCase());
    const expectedCount = mapping.expectedAfter === 'STABLE_PERSONAL_PATTERN' ? 2 : 1;
    if (pair.status !== mapping.expectedAfter || pair.observationCount !== expectedCount || pair.distinctReceiptCount !== expectedCount || pair.distinctEvidenceCount !== expectedCount) throw new Error(`Unexpected final pattern for ${mapping.subject} to ${mapping.color}: ${pair.status}/${pair.observationCount}/${pair.distinctReceiptCount}/${pair.distinctEvidenceCount}.`);
  }
  const targetStable = pairs.filter(item => item.status === 'STABLE_PERSONAL_PATTERN').length;
  const targetFirst = pairs.filter(item => item.status === 'FIRST_OCCURRENCE').length;
  if (targetStable !== 4 || targetFirst !== 2 || responseBody.boundary?.automaticGeneralizationAllowed !== false || responseBody.boundary?.sharedGraphMutationAllowed !== false) throw new Error('Final comparison did not preserve the 4 stable / 2 first-occurrence result and boundary.');
}

async function stateCounts(ownerId) {
  const [observations, relationships, nodes, edges] = await Promise.all([
    query(`SELECT COUNT(*)::int AS observations,COUNT(receipt.receipt_id)::int AS receipts FROM user_graph_observations observation LEFT JOIN user_graph_observation_receipts receipt ON receipt.observation_id=observation.id WHERE observation.user_id=$1`, [ownerId]),
    query("SELECT COUNT(*)::int AS count FROM user_graph_relationships WHERE user_id=$1 AND record_status='active'", [ownerId]),
    query("SELECT COUNT(*)::int AS count FROM nodes WHERE record_status='active'"),
    query("SELECT COUNT(*)::int AS count FROM edges WHERE record_status='active'"),
  ]);
  return { personalObservations: observations.rows[0].observations, personalObservationReceipts: observations.rows[0].receipts, personalRelationships: relationships.rows[0].count, sharedActiveNodes: nodes.rows[0].count, sharedActiveEdges: edges.rows[0].count };
}

async function startRouter() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/v1', usersRouter);
  app.use(errorHandler);
  const listener = await new Promise((resolve, reject) => { const candidate = app.listen(0, '127.0.0.1', () => resolve(candidate)); candidate.on('error', reject); });
  return { baseUrl: `http://127.0.0.1:${listener.address().port}`, close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())) };
}

async function request(baseUrl, pathname, token, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  return { status: response.status, body: parsed };
}
