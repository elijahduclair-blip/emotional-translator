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
const REPORT_PATH = process.env.ATTEMPT_73_REPORT || 'attempt-73-source-anchored-relational-search.json';
const EVIDENCE_PATH = path.resolve(__dirname, '../evidence/attempt-73-source-anchored-relational-search.txt');
const OWNER_USERNAME = process.env.ATTEMPT_73_OWNER_USERNAME || 'elijah_duclair';
const CONTROLLING_REVIEW_SHA256 = '9cc6356ef4c4cb81b68f3f118e95c82b8c87bbae923e8f1196a3961770f830e7';
const ASSERTIONS = [
  { source: 'grass', relation: 'color', target: 'Green', exactStatement: 'grass is green.' },
  { source: 'grass', relation: 'process', target: 'grows', exactStatement: 'grass grows.' },
  { source: 'blood', relation: 'color', target: 'Red', exactStatement: 'red and blood match in color.' },
  { source: 'Red', relation: 'personal association', target: 'pain', exactStatement: 'when i think of red i associate it with pain' },
];
let server = null;

if (process.env.ALLOW_PRODUCTION_SOURCE_BRIDGE_SEARCH !== '1') throw new Error('Set ALLOW_PRODUCTION_SOURCE_BRIDGE_SEARCH=1 to run bounded Attempt 73.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('A temporary AUTH_SECRET of at least 32 characters is required.');
const databaseHost = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
if (['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) throw new Error('Attempt 73 requires the production database secret.');

const report = {
  version: 'chromabridge-attempt-73-source-anchored-relational-search.v1',
  capability: 'typed-source-anchor-search-packets-v1',
  startedAt: new Date().toISOString(),
  controllingReviewSha256: CONTROLLING_REVIEW_SHA256,
  owner: { username: OWNER_USERNAME, profileScope: 'personal' },
  evidence: {}, before: {}, searchResponse: {}, after: {},
  result: 'RUNNING',
  boundary: 'Read-only search packet generation from supplied typed assertions. No observation, relationship, shared graph, Color Atlas, synonym, or meaning mutation is authorized.',
};

try {
  report.evidence = await loadEvidence();
  const owner = await findOwner();
  report.owner.id = owner.id;
  report.before = await stateCounts(owner.id);
  const { baseUrl, close } = await startRouter();
  server = { close };
  const token = createAccessToken(owner);
  const response = await request(baseUrl, `/api/v1/users/${owner.id}/graph/source-bridge-search`, token, { assertions: ASSERTIONS });
  if (response.status !== 200 || response.body?.sourceLayer !== 'user_graph_source_bridge_search') throw new Error(`Source-bridge search returned HTTP ${response.status} without the expected source layer.`);
  const search = response.body.search;
  if (search.policy?.synonymInferenceAllowed !== false || search.policy?.automaticMeaningAssignmentAllowed !== false
    || search.policy?.graphMutationAllowed !== false || search.policy?.externalSearchPerformed !== false) throw new Error('Source-bridge search policy changed.');
  if (search.assertionCount !== 4 || search.distinctAssertionCount !== 4 || search.networkCount !== 2 || search.seedAssertionCount !== 0) throw new Error('Source-bridge search did not produce the expected two typed networks.');
  const grass = search.networks.find(network => network.terms.includes('grass'));
  const red = search.networks.find(network => network.terms.includes('blood'));
  if (!grass || JSON.stringify(grass.anchorTerms) !== JSON.stringify(['grass'])
    || JSON.stringify(grass.lateralSearches[0]?.terms) !== JSON.stringify(['grass', 'Green', 'grows'])
    || grass.lateralSearches[0]?.relationship !== null || grass.proposedMeaning !== null) throw new Error('Grass source packet changed.');
  if (!red || JSON.stringify(red.anchorTerms) !== JSON.stringify(['Red'])
    || JSON.stringify(red.lateralSearches[0]?.terms) !== JSON.stringify(['Red', 'blood', 'pain'])
    || red.lateralSearches[0]?.relationship !== null || red.proposedMeaning !== null) throw new Error('Red/blood source packet changed.');
  if (response.body.boundary?.previewOnly !== true || response.body.boundary?.personalObservationMutationAllowed !== false
    || response.body.boundary?.personalRelationshipMutationAllowed !== false || response.body.boundary?.sharedGraphMutationAllowed !== false
    || response.body.boundary?.synonymInferenceAllowed !== false) throw new Error('Source-bridge boundary changed.');
  report.searchResponse = { status: response.status, sourceLayer: response.body.sourceLayer, policy: search.policy, assertionCount: search.assertionCount, distinctAssertionCount: search.distinctAssertionCount, networkCount: search.networkCount, networks: search.networks, boundary: response.body.boundary };
  report.after = await stateCounts(owner.id);
  if (JSON.stringify(report.after) !== JSON.stringify(report.before)) throw new Error('Attempt 73 changed persisted state.');
  report.result = 'TWO TYPED SOURCE-ANCHORED SEARCH PACKETS BUILT; NO SYNONYM, MEANING, OR GRAPH CLAIM CREATED';
} catch (error) {
  report.result = 'ATTEMPT 73 FAILED';
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
  if (lines.length !== 10 || !lines[1].includes(CONTROLLING_REVIEW_SHA256)) throw new Error('Attempt 73 evidence is incomplete or has the wrong controlling review.');
  return { file: 'backend/evidence/attempt-73-source-anchored-relational-search.txt', bytes: body.length, sha256: sha256(body), lineCount: lines.length };
}

async function findOwner() {
  const result = await query('SELECT id,username,email,role,token_version,must_change_password FROM users WHERE LOWER(username)=LOWER($1) AND password_hash IS NOT NULL', [OWNER_USERNAME]);
  if (result.rows.length !== 1) throw new Error(`Expected exactly one active owner account for username ${OWNER_USERNAME}.`);
  if (result.rows[0].must_change_password) throw new Error('The owner account must have a current password before search packet generation.');
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
