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
const REPORT_PATH = process.env.ATTEMPT_72_REPORT || 'attempt-72-owner-pattern-inquiries.json';
const EVIDENCE_PATH = path.resolve(__dirname, '../evidence/attempt-72-owner-pattern-inquiries.txt');
const OWNER_USERNAME = process.env.ATTEMPT_72_OWNER_USERNAME || 'elijah_duclair';
const CONTROLLING_REVIEW_SHA256 = 'cbe894b38c65f0272dc5b0d2cd63776611ce6755a1ccdd6f95588e01096c9747';
const EXPECTED = {
  Red: ['momentum', 'stop'],
  Yellow: ['caution', 'slow'],
};
let server = null;

if (process.env.ALLOW_PRODUCTION_PERSONAL_PATTERN_INQUIRIES !== '1') throw new Error('Set ALLOW_PRODUCTION_PERSONAL_PATTERN_INQUIRIES=1 to run bounded Attempt 72.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('A temporary AUTH_SECRET of at least 32 characters is required.');
const databaseHost = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
if (['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) throw new Error('Attempt 72 requires the production database secret.');

const report = {
  version: 'chromabridge-attempt-72-owner-pattern-inquiries.v1',
  capability: 'owner-interpretation-before-higher-order-meaning-v1',
  startedAt: new Date().toISOString(),
  controllingReviewSha256: CONTROLLING_REVIEW_SHA256,
  owner: { username: OWNER_USERNAME, profileScope: 'personal' },
  evidence: {}, before: {}, inquiryResponse: {}, after: {},
  result: 'RUNNING',
  boundary: 'Read-only owner inquiry generation. No observation, relationship, shared graph, Color Atlas, shade, or higher-order meaning mutation is authorized.',
};

try {
  report.evidence = await loadEvidence();
  const owner = await findOwner();
  report.owner.id = owner.id;
  report.before = await stateCounts(owner.id);
  const { baseUrl, close } = await startRouter();
  server = { close };
  const token = createAccessToken(owner);
  const response = await request(baseUrl, `/api/v1/users/${owner.id}/graph/pattern-inquiries`, token);
  if (response.status !== 200 || response.body?.sourceLayer !== 'user_graph_pattern_inquiry') throw new Error(`Pattern inquiry returned HTTP ${response.status} without the expected source layer.`);
  const set = response.body.inquirySet;
  if (set.policy?.minimumStablePatternsPerColor !== 2 || set.policy?.automaticMeaningAssignmentAllowed !== false) throw new Error('Pattern inquiry policy changed.');
  if (set.inquiryCount !== 2 || set.inquiries.length !== 2) throw new Error(`Expected two inquiries; observed ${set.inquiryCount}.`);
  for (const [color, subjects] of Object.entries(EXPECTED)) {
    const inquiry = set.inquiries.find(item => item.color === color);
    if (!inquiry || JSON.stringify(inquiry.subjects) !== JSON.stringify(subjects) || inquiry.stablePairCount !== 2
      || inquiry.status !== 'OWNER_INTERPRETATION_REQUESTED' || inquiry.proposedMeaning !== null
      || !inquiry.question.includes('What relationship, if any') || !inquiry.counterexamplePrompt.includes('would not fit')) {
      throw new Error(`Unexpected ${color} owner inquiry.`);
    }
    if (inquiry.evidence.some(item => item.status !== 'STABLE_PERSONAL_PATTERN' || item.observationCount < 2 || item.distinctReceiptCount < 2 || item.distinctEvidenceCount < 2)) throw new Error(`${color} inquiry contains an unstable pair.`);
  }
  if (set.inquiries.some(item => item.color.toLowerCase() === 'green')) throw new Error('Green crossed the inquiry gate before two stable exact pairs existed.');
  if (response.body.boundary?.inquiryOnly !== true || response.body.boundary?.automaticMeaningAssignmentAllowed !== false
    || response.body.boundary?.personalObservationMutationAllowed !== false || response.body.boundary?.personalRelationshipMutationAllowed !== false
    || response.body.boundary?.sharedGraphMutationAllowed !== false) throw new Error('Inquiry response did not preserve the read-only boundary.');
  report.inquiryResponse = { status: response.status, sourceLayer: response.body.sourceLayer, policy: set.policy, stablePersonalPatternCount: set.stablePersonalPatternCount, inquiryCount: set.inquiryCount, inquiries: set.inquiries, boundary: response.body.boundary };
  report.after = await stateCounts(owner.id);
  if (JSON.stringify(report.after) !== JSON.stringify(report.before)) throw new Error('Attempt 72 changed persisted state.');
  report.result = 'TWO OWNER INTERPRETATION INQUIRIES OPENED; NO HIGHER-ORDER MEANING ASSIGNED';
} catch (error) {
  report.result = 'ATTEMPT 72 FAILED';
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
  if (lines.length !== 10 || !lines[1].includes(CONTROLLING_REVIEW_SHA256)) throw new Error('Attempt 72 evidence is incomplete or has the wrong controlling review.');
  return { file: 'backend/evidence/attempt-72-owner-pattern-inquiries.txt', bytes: body.length, sha256: sha256(body), lineCount: lines.length };
}

async function findOwner() {
  const result = await query('SELECT id,username,email,role,token_version,must_change_password FROM users WHERE LOWER(username)=LOWER($1) AND password_hash IS NOT NULL', [OWNER_USERNAME]);
  if (result.rows.length !== 1) throw new Error(`Expected exactly one active owner account for username ${OWNER_USERNAME}.`);
  if (result.rows[0].must_change_password) throw new Error('The owner account must have a current password before inquiry.');
  return result.rows[0];
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
  const app = express(); app.use(express.json({ limit: '64kb' })); app.use('/api/v1', usersRouter); app.use(errorHandler);
  const listener = await new Promise((resolve, reject) => { const candidate = app.listen(0, '127.0.0.1', () => resolve(candidate)); candidate.on('error', reject); });
  return { baseUrl: `http://127.0.0.1:${listener.address().port}`, close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())) };
}

async function request(baseUrl, pathname, token) {
  const response = await fetch(`${baseUrl}${pathname}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text(); let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { status: response.status, body };
}
