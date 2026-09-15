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
const REPORT_PATH = process.env.ATTEMPT_74_REPORT || 'attempt-74-inside-out-personal-paths.json';
const EVIDENCE_PATH = path.resolve(__dirname, '../evidence/attempt-74-inside-out-personal-paths.txt');
const OWNER_USERNAME = process.env.ATTEMPT_74_OWNER_USERNAME || 'elijah_duclair';
const CONTROLLING_REVIEW_SHA256 = '173f4c7e50f156d8b2bf05868452bc593945cde3abef9155ea31582b588344ee';
const ASSERTIONS = [
  { source: 'grass', relation: 'color', target: 'Green', exactStatement: 'grass is green.' },
  { source: 'grass', relation: 'process', target: 'grows', exactStatement: 'grass grows.' },
  { source: 'blood', relation: 'color', target: 'Red', exactStatement: 'red and blood match in color.' },
  { source: 'Red', relation: 'personal association', target: 'pain', exactStatement: 'when i think of red i associate it with pain' },
];
let server = null;

if (process.env.ALLOW_PRODUCTION_INSIDE_OUT_PATHS !== '1') throw new Error('Set ALLOW_PRODUCTION_INSIDE_OUT_PATHS=1 to run bounded Attempt 74.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('A temporary AUTH_SECRET of at least 32 characters is required.');
const databaseHost = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
if (['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) throw new Error('Attempt 74 requires the production database secret.');

const report = {
  version: 'chromabridge-attempt-74-inside-out-personal-paths.v1',
  capability: 'existing-personal-path-inside-out-v1',
  startedAt: new Date().toISOString(),
  controllingReviewSha256: CONTROLLING_REVIEW_SHA256,
  owner: { username: OWNER_USERNAME, profileScope: 'personal' },
  evidence: {}, before: {}, pathResponse: {}, after: {},
  result: 'RUNNING',
  boundary: 'Read-only traversal of owner-supplied typed personal relations. Exterior comparison follows personal path recognition. No observation, relationship, direct edge, shared graph, Color Atlas, synonym, or meaning mutation is authorized.',
};

try {
  report.evidence = await loadEvidence();
  const owner = await findOwner();
  report.owner.id = owner.id;
  report.before = await stateCounts(owner.id);
  const { baseUrl, close } = await startRouter();
  server = { close };
  const token = createAccessToken(owner);
  const response = await request(baseUrl, `/api/v1/users/${owner.id}/graph/inside-out-paths`, token, { assertions: ASSERTIONS });
  if (response.status !== 200 || response.body?.sourceLayer !== 'user_graph_inside_out_path') throw new Error(`Inside-out path traversal returned HTTP ${response.status} without the expected source layer.`);
  const pathSet = response.body.pathSet;
  if (pathSet.policy?.searchDirection !== 'inside_out' || pathSet.policy?.reverseTraversalAllowed !== true
    || pathSet.policy?.directEdgeInferenceAllowed !== false || pathSet.policy?.synonymInferenceAllowed !== false
    || pathSet.policy?.automaticMeaningAssignmentAllowed !== false || pathSet.policy?.graphMutationAllowed !== false) throw new Error('Inside-out path policy changed.');
  if (pathSet.assertionCount !== 4 || pathSet.distinctAssertionCount !== 4 || pathSet.networkCount !== 2
    || pathSet.pathCount !== 2 || pathSet.seedAssertionCount !== 0) throw new Error('Inside-out traversal did not produce the expected two existing personal paths.');
  const grass = pathSet.paths.find(item => item.terms.includes('grass'));
  const blood = pathSet.paths.find(item => item.terms.includes('blood'));
  if (!grass || JSON.stringify(grass.terms) !== JSON.stringify(['Green', 'grass', 'grows'])
    || JSON.stringify(grass.steps.map(step => step.traversal)) !== JSON.stringify(['reverse', 'forward'])
    || grass.pathExpression !== 'Green --reverse(color)--> grass --forward(process)--> grows') throw new Error('Grass backward-then-forward path changed.');
  if (!blood || JSON.stringify(blood.terms) !== JSON.stringify(['blood', 'Red', 'pain'])
    || JSON.stringify(blood.steps.map(step => step.traversal)) !== JSON.stringify(['forward', 'forward'])
    || blood.pathExpression !== 'blood --forward(color)--> Red --forward(personal association)--> pain') throw new Error('Blood-to-Red-to-pain path changed.');
  for (const personalPath of pathSet.paths) {
    if (personalPath.relationship?.type !== 'existing_indirect_typed_path' || personalPath.relationship?.direct !== false
      || personalPath.personalPathExists !== true || personalPath.directRelationshipCreated !== false
      || personalPath.status !== 'EXISTING_PERSONAL_PATH' || personalPath.exteriorComparison?.direction !== 'inside_out'
      || personalPath.exteriorComparison?.status !== 'READY_FOR_EXTERIOR_COMPARISON') throw new Error('An existing personal path was degraded into a missing or direct relationship.');
  }
  if (response.body.boundary?.existingPersonalPathRecognized !== true || response.body.boundary?.directRelationshipCreated !== false
    || response.body.boundary?.personalObservationMutationAllowed !== false || response.body.boundary?.personalRelationshipMutationAllowed !== false
    || response.body.boundary?.sharedGraphMutationAllowed !== false) throw new Error('Inside-out traversal boundary changed.');
  report.pathResponse = {
    status: response.status,
    sourceLayer: response.body.sourceLayer,
    policy: pathSet.policy,
    assertionCount: pathSet.assertionCount,
    distinctAssertionCount: pathSet.distinctAssertionCount,
    networkCount: pathSet.networkCount,
    pathCount: pathSet.pathCount,
    paths: pathSet.paths,
    boundary: response.body.boundary,
  };
  report.after = await stateCounts(owner.id);
  if (JSON.stringify(report.after) !== JSON.stringify(report.before)) throw new Error('Attempt 74 changed persisted state.');
  report.result = 'TWO EXISTING PERSONAL PATHS TRACED INSIDE-OUT; NO DIRECT EDGE OR GRAPH MUTATION CREATED';
} catch (error) {
  report.result = 'ATTEMPT 74 FAILED';
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
  if (lines.length !== 10 || !lines[1].includes(CONTROLLING_REVIEW_SHA256)) throw new Error('Attempt 74 evidence is incomplete or has the wrong controlling review.');
  return { file: 'backend/evidence/attempt-74-inside-out-personal-paths.txt', bytes: body.length, sha256: sha256(body), lineCount: lines.length };
}

async function findOwner() {
  const result = await query('SELECT id,username,email,role,token_version,must_change_password FROM users WHERE LOWER(username)=LOWER($1) AND password_hash IS NOT NULL', [OWNER_USERNAME]);
  if (result.rows.length !== 1) throw new Error(`Expected exactly one active owner account for username ${OWNER_USERNAME}.`);
  if (result.rows[0].must_change_password) throw new Error('The owner account must have a current password before inside-out traversal.');
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

async function request(baseUrl, pathname, token, body) {
  const response = await fetch(`${baseUrl}${pathname}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await response.text(); let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  return { status: response.status, body: parsed };
}
