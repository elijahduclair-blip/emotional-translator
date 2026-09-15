import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { createAccessToken } from '../src/auth/tokens.js';
import { hashPassword } from '../src/auth/passwords.js';
import { createSchema } from '../src/db/schema.js';
import { pool, query } from '../src/db/pool.js';
import { persistPersonalMappingObservation } from '../src/lib/personal-observations.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import usersRouter from '../src/routes/users.js';

process.env.AUTH_SECRET ||= 'attempt-68-personal-observation-test-secret-00000000';

const runId = crypto.randomUUID().slice(0, 8);
const ownerId = `a68-${runId}-owner`;
const ownerUsername = `elijah_observation_${runId}`;
const adminId = `a68-${runId}-admin`;
const adminUsername = `attempt68_${runId}`;
let listener;
let baseUrl;
let ownerToken;
let adminToken;

test.before(async () => {
  await createSchema();
  await query(
    `INSERT INTO users (id,username,email,password_hash,role,must_change_password,token_version)
     VALUES ($1,$2,$3,$4,'user',FALSE,1),($5,$6,$7,$8,'admin',FALSE,1)`,
    [
      ownerId, ownerUsername, `${ownerUsername}@invalid.example`, await hashPassword('OwnerPass2026'),
      adminId, adminUsername, `${adminUsername}@invalid.example`, await hashPassword('AdminPass2026'),
    ]
  );
  ownerToken = createAccessToken({ id: ownerId, username: ownerUsername, email: `${ownerUsername}@invalid.example`, role: 'user', token_version: 1 });
  adminToken = createAccessToken({ id: adminId, username: adminUsername, email: `${adminUsername}@invalid.example`, role: 'admin', token_version: 1 });
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

test('Attempt 68 stores owner-confirmed mapping observations with sealed receipts and measured recurrence', async () => {
  const body = observationBody('A68-PRIMARY', 'momentum', 'Red', 'Red is momentum');
  const unconfirmed = await request(`/api/v1/users/${ownerId}/graph/observations`, adminToken, { method: 'POST', body: { ...body, confirmed: false } });
  assert.equal(unconfirmed.status, 400);

  const stored = await request(`/api/v1/users/${ownerId}/graph/observations`, adminToken, { method: 'POST', body });
  assert.equal(stored.status, 201);
  assert.equal(stored.body.disposition, 'PERSONAL_MAPPING_OBSERVATION_AND_RECEIPT_COMMITTED');
  assert.equal(stored.body.observation.subject, 'momentum');
  assert.equal(stored.body.observation.color, 'Red');
  assert.equal(stored.body.receipt.status, 'OBSERVED_NOT_GENERALIZED');
  assert.match(stored.body.receipt.receiptId, /^CBPO-[0-9A-F]{16}$/);
  assert.equal(stored.body.boundary.relationshipMutationAllowed, false);
  assert.equal(stored.body.boundary.sharedGraphMutationAllowed, false);

  const replay = await request(`/api/v1/users/${ownerId}/graph/observations`, adminToken, { method: 'POST', body });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.idempotent, true);
  assert.equal(replay.body.observation.id, stored.body.observation.id);

  const conflict = await request(`/api/v1/users/${ownerId}/graph/observations`, ownerToken, {
    method: 'POST', body: { ...body, subject: 'changed' }
  });
  assert.equal(conflict.status, 409);

  const secondOccurrence = await request(`/api/v1/users/${ownerId}/graph/observations`, ownerToken, {
    method: 'POST', body: observationBody('A68-SECOND-OCCURRENCE', 'momentum', 'Red', 'Red is momentum', { occurrence: 2 })
  });
  assert.equal(secondOccurrence.status, 201);

  const lookup = await request(`/api/v1/users/${ownerId}/graph/observations?subject=momentum&color=red`, ownerToken);
  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.summary.observationCount, 2);
  assert.equal(lookup.body.summary.distinctPairCount, 1);
  assert.equal(lookup.body.summary.repeatedPairCount, 1);
  assert.equal(lookup.body.summary.pairs[0].observationCount, 2);
  assert.equal(lookup.body.boundary.automaticLearningAllowed, false);

  const repeatedSameEvidence = await request(`/api/v1/users/${ownerId}/graph/patterns`, ownerToken);
  assert.equal(repeatedSameEvidence.status, 200);
  assert.equal(repeatedSameEvidence.body.comparison.stablePersonalPatternCount, 0);
  assert.equal(repeatedSameEvidence.body.comparison.nonIndependentRepetitionCount, 1);
  assert.equal(repeatedSameEvidence.body.comparison.pairs[0].distinctEvidenceCount, 1);

  const independentOccurrence = await request(`/api/v1/users/${ownerId}/graph/observations`, ownerToken, {
    method: 'POST',
    body: {
      ...observationBody('A69-INDEPENDENT-OCCURRENCE', 'momentum', 'Red', 'Momentum feels Red here', { occurrence: 3 }),
      sourceName: 'Attempt 69 independent observation fixture',
      evidence: { type: 'owner_direct_statement', occurrenceId: 'independent-3' },
    },
  });
  assert.equal(independentOccurrence.status, 201);
  const stablePattern = await request(`/api/v1/users/${ownerId}/graph/patterns`, ownerToken);
  assert.equal(stablePattern.status, 200);
  assert.equal(stablePattern.body.comparison.stablePersonalPatternCount, 1);
  assert.equal(stablePattern.body.comparison.patterns[0].subject, 'momentum');
  assert.equal(stablePattern.body.comparison.patterns[0].color, 'Red');
  assert.equal(stablePattern.body.comparison.patterns[0].observationCount, 3);
  assert.equal(stablePattern.body.comparison.patterns[0].distinctReceiptCount, 3);
  assert.equal(stablePattern.body.comparison.patterns[0].distinctEvidenceCount, 2);
  assert.equal(stablePattern.body.boundary.personalRelationshipMutationAllowed, false);
  assert.equal(stablePattern.body.boundary.automaticGeneralizationAllowed, false);
});

test('Attempt 68 rolls back the observation when receipt storage fails', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(
      persistPersonalMappingObservation(client, {
        userId: ownerId,
        observedByUser: adminId,
        subject: 'rollback',
        color: 'Yellow',
        exactStatement: 'Synthetic rollback observation.',
        sourceName: 'Attempt 68 integration test',
        evidence: { fixture: true },
        context: {},
        idempotencyKey: 'A68-ROLLBACK',
      }, { injectFailure: 'receipt-store' }),
      /injected personal observation receipt store failure/
    );
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  const count = await query("SELECT COUNT(*)::int AS count FROM user_graph_observations WHERE idempotency_key='A68-ROLLBACK'");
  assert.equal(count.rows[0].count, 0);
});

test('Attempt 68 serializes concurrent exact retries into one observation and one receipt', async () => {
  const body = observationBody('A68-CONCURRENT', 'caution', 'Yellow', 'Yellow is caution');
  const responses = await Promise.all([
    request(`/api/v1/users/${ownerId}/graph/observations`, ownerToken, { method: 'POST', body }),
    request(`/api/v1/users/${ownerId}/graph/observations`, ownerToken, { method: 'POST', body }),
  ]);
  assert.deepEqual(responses.map(item => item.status).sort(), [200, 201]);
  assert.deepEqual(responses.map(item => item.body.idempotent).sort(), [false, true]);
  const counts = await query(
    `SELECT COUNT(*)::int AS observations,COUNT(receipt.receipt_id)::int AS receipts
     FROM user_graph_observations AS observation
     LEFT JOIN user_graph_observation_receipts AS receipt ON receipt.observation_id=observation.id
     WHERE observation.idempotency_key='A68-CONCURRENT'`
  );
  assert.equal(counts.rows[0].observations, 1);
  assert.equal(counts.rows[0].receipts, 1);
});

test.after(async () => {
  if (listener) await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  await query('DELETE FROM user_graph_observation_receipts WHERE user_id=$1', [ownerId]);
  await query('DELETE FROM user_graph_observations WHERE user_id=$1', [ownerId]);
  await query('DELETE FROM users WHERE id IN ($1,$2)', [ownerId, adminId]);
  await pool.end();
});

function observationBody(idempotencyKey, subject, color, exactStatement, context = {}) {
  return {
    confirmed: true,
    subject,
    color,
    relationshipType: 'associates_color_climate',
    exactStatement,
    sourceName: 'Attempt 68 integration test',
    evidence: { type: 'user_direct_statement' },
    context,
    idempotencyKey,
  };
}

async function request(pathname, token, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json();
  return { status: response.status, body };
}
