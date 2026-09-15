import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { createAccessToken } from '../src/auth/tokens.js';
import { hashPassword } from '../src/auth/passwords.js';
import { createSchema } from '../src/db/schema.js';
import { pool, query } from '../src/db/pool.js';
import { persistEdgeCreation, sealCreationReceipt, sha256 } from '../src/lib/edge-creation-receipts.js';
import { persistPersonalGraphPlacement } from '../src/lib/personal-graph.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import usersRouter from '../src/routes/users.js';

process.env.AUTH_SECRET ||= 'attempt-67-personal-graph-test-secret-000000000000';

const runId = crypto.randomUUID().slice(0, 8);
const ownerId = `a67-${runId}-owner`;
const ownerUsername = `elijah_fixture_${runId}`;
const adminId = `a67-${runId}-admin`;
const actor = `attempt67-${runId}`;
const fixtureIds = [];
let listener;
let baseUrl;
let ownerToken;
let adminToken;
let primary;

test.before(async () => {
  await createSchema();
  await query(
    `INSERT INTO users (id,username,email,password_hash,role,must_change_password,token_version)
     VALUES ($1,$2,$3,$4,'user',FALSE,1),($5,$6,$7,$8,'admin',FALSE,1)`,
    [
      ownerId, ownerUsername, `${ownerUsername}@invalid.example`, await hashPassword('OwnerPass2026'),
      adminId, actor, `${actor}@invalid.example`, await hashPassword('AdminPass2026')
    ]
  );
  ownerToken = createAccessToken({ id: ownerId, username: ownerUsername, email: `${ownerUsername}@invalid.example`, role: 'user', token_version: 1 });
  adminToken = createAccessToken({ id: adminId, username: actor, email: `${actor}@invalid.example`, role: 'admin', token_version: 1 });
  primary = await installReceipt('primary', 'flow', 'Gray');
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/v1', usersRouter);
  app.use(errorHandler);
  listener = await new Promise((resolve, reject) => {
    const candidate = app.listen(0, '127.0.0.1', () => resolve(candidate));
    candidate.on('error', reject);
  });
  baseUrl = `http://127.0.0.1:${listener.address().port}`;
});

test('Attempt 67 places a receipt-backed relationship only in the selected personal graph', async () => {
  const sharedBefore = await sharedCounts(primary);
  const body = placementBody(primary, 'A67-PRIMARY-IDEMPOTENCY');

  const unconfirmed = await request(`/api/v1/users/${ownerId}/graph/relationships/from-receipt`, adminToken, {
    method: 'POST', body: { ...body, confirmed: false }
  });
  assert.equal(unconfirmed.status, 400);
  assert.equal(await personalRelationshipCount(primary), 0);

  const placed = await request(`/api/v1/users/${ownerId}/graph/relationships/from-receipt`, adminToken, {
    method: 'POST', body
  });
  assert.equal(placed.status, 201);
  assert.equal(placed.body.disposition, 'PERSONAL_RELATIONSHIP_AND_HISTORY_COMMITTED');
  assert.equal(placed.body.idempotent, false);
  assert.equal(placed.body.relationship.source, 'flow');
  assert.equal(placed.body.relationship.target, 'Gray');
  assert.equal(placed.body.relationship.sourceReceiptId, primary.receiptId);
  assert.equal(placed.body.boundary.personalGraphMutated, true);
  assert.equal(placed.body.boundary.sharedGraphMutationAllowed, false);

  const replay = await request(`/api/v1/users/${ownerId}/graph/relationships/from-receipt`, adminToken, {
    method: 'POST', body
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.idempotent, true);
  assert.equal(replay.body.relationship.id, placed.body.relationship.id);

  const lookup = await request(`/api/v1/users/${ownerId}/graph?text=flow%20gray`, ownerToken);
  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.relationshipCount, 1);
  assert.equal(lookup.body.relationships[0].sourceLayer, 'user_graph');
  assert.equal(lookup.body.boundary.sharedGraphMutationAllowed, false);

  const conflict = await request(`/api/v1/users/${ownerId}/graph/relationships/from-receipt`, adminToken, {
    method: 'POST', body: { ...body, reviewNote: 'A different request body must not reuse the same key.' }
  });
  assert.equal(conflict.status, 409);

  assert.equal(await personalRelationshipCount(primary), 1);
  assert.equal(await personalHistoryCount(primary), 1);
  assert.deepEqual(await sharedCounts(primary), sharedBefore);
});

test('Attempt 67 rolls back personal placement when its history record cannot be stored', async () => {
  const rollbackFixture = await installReceipt('rollback', 'current', 'Gray');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(
      persistPersonalGraphPlacement(client, {
        userId: ownerId,
        receiptId: rollbackFixture.receiptId,
        idempotencyKey: 'A67-ROLLBACK-IDEMPOTENCY',
        confidence: 'high',
        reviewNote: 'Synthetic owner-confirmed personal placement rollback test.',
        counterexample: 'Retire if the owner withdraws this association.',
        placedByUser: adminId
      }, { injectFailure: 'history-store' }),
      /injected personal history store failure/
    );
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  assert.equal(await personalRelationshipCount(rollbackFixture), 0);
  assert.equal(await personalHistoryCount(rollbackFixture), 0);
  assert.equal((await sharedCounts(rollbackFixture)).exactRelationship, 0);
});

test('Attempt 67 serializes concurrent exact retries into one personal relationship', async () => {
  const concurrentFixture = await installReceipt('concurrent', 'movement', 'Gray');
  const body = placementBody(concurrentFixture, 'A67-CONCURRENT-IDEMPOTENCY');
  const requests = await Promise.all([
    request(`/api/v1/users/${ownerId}/graph/relationships/from-receipt`, ownerToken, { method: 'POST', body }),
    request(`/api/v1/users/${ownerId}/graph/relationships/from-receipt`, ownerToken, { method: 'POST', body })
  ]);
  assert.deepEqual(requests.map(item => item.status).sort(), [200, 201]);
  assert.deepEqual(requests.map(item => item.body.idempotent).sort(), [false, true]);
  assert.equal(await personalRelationshipCount(concurrentFixture), 1);
  assert.equal(await personalHistoryCount(concurrentFixture), 1);
  assert.equal((await sharedCounts(concurrentFixture)).exactRelationship, 0);
});

test.after(async () => {
  if (listener) await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  await query('DELETE FROM user_graph_history WHERE user_id=$1', [ownerId]);
  await query('DELETE FROM user_graph_relationships WHERE user_id=$1', [ownerId]);
  await query('DELETE FROM edge_creation_receipts WHERE receipt_id = ANY($1::text[])', [fixtureIds.map(item => item.receiptId)]);
  await query('DELETE FROM graph_proposals WHERE id = ANY($1::text[])', [fixtureIds.map(item => item.proposalId)]);
  await query('DELETE FROM nodes WHERE id = ANY($1::text[])', [fixtureIds.flatMap(item => [item.sourceId, item.targetId])]);
  await query('DELETE FROM users WHERE id IN ($1,$2)', [ownerId, adminId]);
  await pool.end();
});

async function installReceipt(name, sourceLabel, targetLabel) {
  const sourceId = `a67-${runId}-${name}-source`;
  const targetId = `a67-${runId}-${name}-target`;
  const proposalId = `a67-${runId}-${name}-proposal`;
  const receiptId = `CBER67-${runId}-${name}`;
  const edge = {
    id: `a67-${runId}-${name}-shared-edge`,
    source: sourceId,
    target: targetId,
    type: 'conditions_color_climate',
    evidence: `The profile owner associated ${sourceLabel} with ${targetLabel}.`,
    confidence: 'high',
    evidenceData: { boundary: 'Personal fixture only.' }
  };
  await query(
    `INSERT INTO nodes (id,label,type,metadata) VALUES
     ($1,$2,'common_word',$3),($4,$5,'family',$6)`,
    [sourceId, sourceLabel, { fixture: 'attempt-67' }, targetId, targetLabel, { fixture: 'attempt-67' }]
  );
  const sourceText = JSON.stringify({ name, sourceLabel, targetLabel, ownerUsername });
  const sourceHash = sha256(Buffer.from(sourceText, 'utf8'));
  const locator = { file: `postgres-fixture:${name}`, line: 1, lineSha256: sourceHash };
  const receipt = sealCreationReceipt({
    receiptVersion: 'chromabridge-edge-receipt.v2',
    receiptId,
    receiptClass: 'CREATION',
    creationContext: {
      requestId: `A67-REQ-${runId}-${name}`,
      idempotencyKey: `A67-RECEIPT-${runId}-${name}`,
      createdAt: '2026-09-15T12:00:00.000Z',
      actorId: actor,
      profileScope: `${ownerUsername}-personal-profile-candidate`
    },
    edge: {
      edgeId: edge.id,
      relationship: edge.type,
      wordNode: { recordId: sourceId, name: sourceLabel, tier: 'common_word' },
      baseNode: { recordId: targetId, name: targetLabel, tier: 'family' }
    },
    source: {
      system: 'Attempt 67 personal graph integration fixture', version: '1',
      frozenFiles: [{ file: locator.file, sha256: sourceHash, bytes: Buffer.byteLength(sourceText) }]
    },
    endpointEvidence: {
      wordSenseKeys: [{ senseKey: `${sourceId}%personal`, synsetId: sourceId, locator }],
      baseSenseKeys: [{ senseKey: `${targetId}%personal`, synsetId: targetId, locator }]
    },
    relation: {
      pathDisposition: null,
      selectedPath: null,
      candidatePaths: [
        { lane: 'user_graph', status: 'supported', support: [locator] },
        { lane: 'shared_graph', status: 'unresolved', gap: locator }
      ],
      maxPointerHops: 1
    },
    decision: {
      status: 'UNRESOLVED', ruleId: 'A67-PERSONAL-SHARED-SCOPE-v1',
      explanation: 'The relationship is supported personally; shared placement is unresolved.', evidenceSha256: null
    },
    provenance: {
      capturedAtCreation: true, sourceReceipt: null,
      gaps: [{ type: 'placement_scope', locator, resolution: 'The owner must select a graph lane.' }]
    },
    requestedAction: 'RECEIPT_ONLY',
    integrity: { receiptSha256: null }
  });
  await query(
    `INSERT INTO graph_proposals (id,operation,payload,status,author,rationale)
     VALUES ($1,'create_relationship',$2,'reviewed',$3,$4)`,
    [proposalId, { relationship: edge, creationReceipt: receipt }, actor, 'Attempt 67 personal graph fixture.']
  );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const proposal = (await client.query('SELECT * FROM graph_proposals WHERE id=$1 FOR UPDATE', [proposalId])).rows[0];
    await persistEdgeCreation(client, { proposal, edge, author: actor });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const fixture = { name, sourceId, targetId, proposalId, receiptId, edgeId: edge.id };
  fixtureIds.push(fixture);
  return fixture;
}

function placementBody(fixture, idempotencyKey) {
  return {
    confirmed: true,
    receiptId: fixture.receiptId,
    idempotencyKey,
    confidence: 'high',
    reviewNote: 'The profile owner explicitly selected the personal graph lane.',
    counterexample: 'Retire if the owner changes or withdraws this association.'
  };
}

async function request(pathname, token, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function personalRelationshipCount(fixture) {
  const result = await query(
    'SELECT COUNT(*)::int AS count FROM user_graph_relationships WHERE user_id=$1 AND source_receipt_id=$2',
    [ownerId, fixture.receiptId]
  );
  return result.rows[0].count;
}

async function personalHistoryCount(fixture) {
  const result = await query(
    'SELECT COUNT(*)::int AS count FROM user_graph_history WHERE user_id=$1 AND source_receipt_id=$2',
    [ownerId, fixture.receiptId]
  );
  return result.rows[0].count;
}

async function sharedCounts(fixture) {
  const [nodes, edges, exactRelationship, history] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM nodes WHERE record_status='active'"),
    query("SELECT COUNT(*)::int AS count FROM edges WHERE record_status='active'"),
    query("SELECT COUNT(*)::int AS count FROM edges WHERE source=$1 AND target=$2 AND record_status='active'", [fixture.sourceId, fixture.targetId]),
    query("SELECT COUNT(*)::int AS count FROM graph_history WHERE entity_type='edge' AND entity_id=$1", [fixture.edgeId])
  ]);
  return {
    activeNodes: nodes.rows[0].count,
    activeEdges: edges.rows[0].count,
    exactRelationship: exactRelationship.rows[0].count,
    sharedHistory: history.rows[0].count
  };
}
