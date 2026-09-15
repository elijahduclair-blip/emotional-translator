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
const REPORT_PATH = process.env.ATTEMPT_69_REPORT || 'attempt-69-personal-pattern-comparison.json';
const EVIDENCE_PATH = path.resolve(__dirname, '../evidence/attempt-69-personal-pattern-comparison.txt');
const OWNER_USERNAME = process.env.ATTEMPT_69_OWNER_USERNAME || 'elijah_duclair';
const CONTROLLING_REVIEW_SHA256 = 'c932ac953a03bb60d5eae27fc47e81f07d507d4ed00d5a79c055244fba59a973';
const EXPECTED_PAIRS = [
  ['momentum', 'red'],
  ['stop', 'red'],
  ['slow', 'yellow'],
  ['caution', 'yellow'],
];
let server = null;

if (process.env.ALLOW_PRODUCTION_PERSONAL_PATTERN_COMPARISON !== '1') {
  throw new Error('Set ALLOW_PRODUCTION_PERSONAL_PATTERN_COMPARISON=1 to run the bounded Attempt 69 comparison.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('A temporary AUTH_SECRET of at least 32 characters is required.');
const databaseHost = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
if (['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) throw new Error('Attempt 69 requires the production database secret.');

const report = {
  version: 'chromabridge-attempt-69-personal-pattern-comparison.v1',
  capability: 'personal-evidence-comparison-v1',
  startedAt: new Date().toISOString(),
  controllingReviewSha256: CONTROLLING_REVIEW_SHA256,
  owner: { username: OWNER_USERNAME, profileScope: 'personal' },
  evidence: {},
  before: {},
  comparison: {},
  after: {},
  result: 'RUNNING',
  boundary: 'Read-only personal comparison. No personal relationship, shared graph, or Color Atlas mutation is authorized.',
};

try {
  report.evidence = await loadEvidence();
  const owner = await findOwner();
  report.owner.id = owner.id;
  report.before = await stateCounts(owner.id);

  const { baseUrl, close } = await startRouter();
  server = { close };
  const token = createAccessToken(owner);
  const response = await request(baseUrl, `/api/v1/users/${owner.id}/graph/patterns`, token);
  if (response.status !== 200) throw new Error(`Personal pattern comparison returned HTTP ${response.status}.`);
  const comparison = response.body?.comparison;
  if (!comparison || response.body?.sourceLayer !== 'user_graph_observation_comparison') throw new Error('Comparison response is missing its source layer.');
  if (comparison.policy?.minimumObservations !== 2 || comparison.policy?.minimumDistinctReceipts !== 2 || comparison.policy?.minimumDistinctEvidence !== 2) {
    throw new Error('Comparison policy does not preserve the two-observation, two-receipt, two-evidence gate.');
  }
  const expected = comparison.pairs.filter(pair => EXPECTED_PAIRS.some(([subject, color]) => pair.subject.toLowerCase() === subject && pair.color.toLowerCase() === color));
  if (expected.length !== 4 || expected.some(pair => pair.status !== 'FIRST_OCCURRENCE' || pair.observationCount !== 1 || pair.distinctEvidenceCount !== 1)) {
    throw new Error('Expected four first-occurrence Attempt 68 pairs with one evidence fingerprint each.');
  }
  const red = comparison.colorRecurrence.find(item => item.color.toLowerCase() === 'red');
  const yellow = comparison.colorRecurrence.find(item => item.color.toLowerCase() === 'yellow');
  if (red?.observationCount !== 2 || red?.distinctSubjectCount !== 2 || yellow?.observationCount !== 2 || yellow?.distinctSubjectCount !== 2) {
    throw new Error('Expected Red and Yellow to recur across two distinct subjects each.');
  }
  if (comparison.stablePersonalPatternCount !== 0 || comparison.firstOccurrenceCount < 4 || response.body?.boundary?.automaticGeneralizationAllowed !== false) {
    throw new Error('Attempt 69 must not promote first occurrences or color-family recurrence into a stable or shared pattern.');
  }
  report.comparison = {
    status: response.status,
    sourceLayer: response.body.sourceLayer,
    policy: comparison.policy,
    observationCount: comparison.observationCount,
    pairCount: comparison.pairCount,
    stablePersonalPatternCount: comparison.stablePersonalPatternCount,
    firstOccurrenceCount: comparison.firstOccurrenceCount,
    nonIndependentRepetitionCount: comparison.nonIndependentRepetitionCount,
    expectedPairs: expected,
    colorRecurrence: [red, yellow],
    boundary: response.body.boundary,
  };
  report.after = await stateCounts(owner.id);
  if (JSON.stringify(report.after) !== JSON.stringify(report.before)) throw new Error('Read-only comparison changed persisted state.');
  report.result = 'NO STABLE PERSONAL PATTERN YET; FOUR FIRST OCCURRENCES PRESERVED';
} catch (error) {
  report.result = 'ATTEMPT 69 FAILED';
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
  if (!lines[1].includes(CONTROLLING_REVIEW_SHA256)) throw new Error('Evidence does not preserve the controlling review hash.');
  return { file: 'backend/evidence/attempt-69-personal-pattern-comparison.txt', bytes: body.length, sha256: sha256(body), lineCount: lines.length };
}

async function findOwner() {
  const result = await query(
    `SELECT id,username,email,role,token_version,must_change_password FROM users
     WHERE LOWER(username)=LOWER($1) AND password_hash IS NOT NULL`,
    [OWNER_USERNAME]
  );
  if (result.rows.length !== 1) throw new Error(`Expected exactly one active owner account for username ${OWNER_USERNAME}.`);
  if (result.rows[0].must_change_password) throw new Error('The owner account must have a current password before comparison.');
  return result.rows[0];
}

async function stateCounts(ownerId) {
  const [observations, relationships, nodes, edges] = await Promise.all([
    query(`SELECT COUNT(*)::int AS observations,COUNT(receipt.receipt_id)::int AS receipts
      FROM user_graph_observations observation LEFT JOIN user_graph_observation_receipts receipt ON receipt.observation_id=observation.id
      WHERE observation.user_id=$1`, [ownerId]),
    query("SELECT COUNT(*)::int AS count FROM user_graph_relationships WHERE user_id=$1 AND record_status='active'", [ownerId]),
    query("SELECT COUNT(*)::int AS count FROM nodes WHERE record_status='active'"),
    query("SELECT COUNT(*)::int AS count FROM edges WHERE record_status='active'"),
  ]);
  return {
    personalObservations: observations.rows[0].observations,
    personalObservationReceipts: observations.rows[0].receipts,
    personalRelationships: relationships.rows[0].count,
    sharedActiveNodes: nodes.rows[0].count,
    sharedActiveEdges: edges.rows[0].count,
  };
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
  return { baseUrl: `http://127.0.0.1:${listener.address().port}`, close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())) };
}

async function request(baseUrl, pathname, token) {
  const response = await fetch(`${baseUrl}${pathname}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { status: response.status, body };
}
