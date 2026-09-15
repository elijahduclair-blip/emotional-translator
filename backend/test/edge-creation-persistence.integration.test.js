import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createSchema } from '../src/db/schema.js';
import { pool, query } from '../src/db/pool.js';
import {
  persistEdgeCreation,
  sealCreationReceipt,
  sha256
} from '../src/lib/edge-creation-receipts.js';

const runId = crypto.randomUUID().slice(0, 8);
const actor = `attempt64-${runId}`;
const scenarioResults = [];

test.before(async () => {
  await createSchema();
});

test('Attempt 64 persists the ten creation-gate scenarios in PostgreSQL', async () => {
  await scenario('VERIFY_COMMITS_ATOMICALLY', async context => {
    const result = await transact(context);
    assert.equal(result.disposition, 'EDGE_AND_RECEIPT_COMMITTED');
    return counts(context);
  }, { receipts: 1, edges: 1, history: 1 });

  await scenario('REJECT_STORES_RECEIPT_ONLY', async context => {
    context.receipt = makeReceipt(context, 'REJECT');
    await updateProposalReceipt(context);
    const result = await transact(context);
    assert.equal(result.disposition, 'RECEIPT_ONLY_COMMITTED');
    return counts(context);
  }, { receipts: 1, edges: 0, history: 0 });

  await scenario('UNRESOLVED_STORES_RECEIPT_ONLY', async context => {
    context.receipt = makeReceipt(context, 'UNRESOLVED');
    await updateProposalReceipt(context);
    const result = await transact(context);
    assert.equal(result.disposition, 'RECEIPT_ONLY_COMMITTED');
    return counts(context);
  }, { receipts: 1, edges: 0, history: 0 });

  await scenario('VERIFY_MISSING_PATH', async context => {
    const invalid = structuredClone(context.receipt);
    invalid.relation.selectedPath = null;
    context.receipt = sealCreationReceipt(invalid);
    await updateProposalReceipt(context);
    await assert.rejects(transact(context), /decisive outcome lacks a selected path/);
    return counts(context);
  }, { receipts: 0, edges: 0, history: 0 });

  await scenario('MISSING_SOURCE_VERSION', async context => {
    const invalid = structuredClone(context.receipt);
    invalid.source.version = '';
    context.receipt = sealCreationReceipt(invalid);
    await updateProposalReceipt(context);
    await assert.rejects(transact(context), /source identity or version is missing/);
    return counts(context);
  }, { receipts: 0, edges: 0, history: 0 });

  await scenario('TAMPERED_AFTER_SEALING', async context => {
    context.receipt.edge.wordNode.name = 'tampered-after-sealing';
    await updateProposalReceipt(context);
    await assert.rejects(transact(context), /hash mismatch/);
    return counts(context);
  }, { receipts: 0, edges: 0, history: 0 });

  await scenario('RECEIPT_STORE_FAILURE_ROLLS_BACK', async context => {
    await assert.rejects(transact(context, 'receipt-store'), /injected receipt store failure/);
    return counts(context);
  }, { receipts: 0, edges: 0, history: 0 });

  await scenario('EDGE_STORE_FAILURE_ROLLS_BACK', async context => {
    await assert.rejects(transact(context, 'edge-store'), /injected edge store failure/);
    return counts(context);
  }, { receipts: 0, edges: 0, history: 0 });

  await scenario('IDEMPOTENT_REPLAY', async context => {
    const first = await transact(context);
    const replay = await transact(context);
    assert.equal(first.disposition, 'EDGE_AND_RECEIPT_COMMITTED');
    assert.equal(replay.disposition, 'IDEMPOTENT_REPLAY');
    assert.equal(replay.idempotent, true);
    return counts(context);
  }, { receipts: 1, edges: 1, history: 1 });

  await scenario('IDEMPOTENCY_CONFLICT', async context => {
    await transact(context);
    const changed = structuredClone(context.receipt);
    changed.receiptId = `${changed.receiptId}-conflict`;
    changed.decision.explanation = 'Different sealed request using the same idempotency key.';
    context.receipt = sealCreationReceipt(changed);
    await updateProposalReceipt(context);
    await assert.rejects(transact(context), /Idempotency key was reused/);
    return counts(context);
  }, { receipts: 1, edges: 1, history: 1 });

  assert.equal(scenarioResults.length, 10);
  assert.ok(scenarioResults.every(item => item.pass));
});

test.after(async () => {
  await query("DELETE FROM graph_history WHERE author=$1", [actor]);
  await query("DELETE FROM edges WHERE id LIKE $1", [`a64-${runId}-%`]);
  await query("DELETE FROM edge_creation_receipts WHERE created_by=$1", [actor]);
  await query("DELETE FROM graph_proposals WHERE author=$1", [actor]);
  await query("DELETE FROM nodes WHERE id LIKE $1", [`a64-${runId}-%`]);
  await pool.end();
});

async function scenario(name, execute, expected) {
  const context = await installScenario(name);
  let observed;
  try {
    observed = await execute(context);
    assert.deepEqual(observed, expected);
    scenarioResults.push({ name, expected, observed, pass: true });
  } catch (error) {
    scenarioResults.push({ name, expected, observed, pass: false, error: error.message });
    throw error;
  }
}

async function installScenario(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const source = `a64-${runId}-${slug}-source`;
  const target = `a64-${runId}-${slug}-target`;
  const proposalId = `a64-${runId}-${slug}-proposal`;
  const edge = {
    id: `a64-${runId}-${slug}-edge`,
    source,
    target,
    type: 'supports',
    evidence: 'Attempt 64 persistent-transaction fixture.',
    confidence: 'medium',
    evidenceData: {
      source: 'attempt-64-postgresql-fixture',
      evidenceType: 'system_rule',
      boundary: 'Synthetic persistence fixture; it asserts transaction behavior, not color meaning.',
      author: actor,
      date: '2026-09-14T12:00:00.000Z',
      reviewStatus: 'reviewed',
      counterexample: 'Reject if the persistent receipt and edge cannot be committed together.'
    }
  };
  await query(
    `INSERT INTO nodes (id,label,type,metadata) VALUES
     ($1,$2,'theme',$3),($4,$5,'theme',$6)`,
    [source, `${name} source`, { boundary: 'Attempt 64 test node.' }, target, `${name} target`, { boundary: 'Attempt 64 test node.' }]
  );
  const context = { name, source, target, proposalId, edge, receipt: null };
  context.receipt = makeReceipt(context, 'VERIFY');
  await query(
    `INSERT INTO graph_proposals (id,operation,payload,status,author,rationale)
     VALUES ($1,'create_relationship',$2,'reviewed',$3,$4)`,
    [proposalId, { relationship: edge, creationReceipt: context.receipt }, actor, 'Attempt 64 persistent gate scenario.']
  );
  return context;
}

function makeReceipt(context, decision) {
  const sourceText = JSON.stringify({
    scenario: context.name,
    source: context.source,
    target: context.target,
    relation: context.edge.type,
    decision
  });
  const sourceHash = sha256(Buffer.from(sourceText, 'utf8'));
  const decisive = decision !== 'UNRESOLVED';
  return sealCreationReceipt({
    receiptVersion: 'chromabridge-edge-receipt.v2',
    receiptId: `CBER64-${runId}-${context.name}-${decision}`,
    receiptClass: 'CREATION',
    fixtureUse: 'POSTGRESQL_TRANSACTION_TEST_ONLY',
    creationContext: {
      requestId: `A64-REQ-${runId}-${context.name}`,
      idempotencyKey: `A64-IDEM-${runId}-${context.name}`,
      createdAt: '2026-09-14T12:00:00.000Z',
      actorId: actor,
      profileScope: 'isolated-postgresql-test'
    },
    edge: {
      edgeId: context.edge.id,
      relationship: context.edge.type,
      wordNode: { recordId: context.source, name: `${context.name} source`, tier: 'test' },
      baseNode: { recordId: context.target, name: `${context.name} target`, tier: 'test' }
    },
    source: {
      system: 'Attempt 64 PostgreSQL transaction fixture',
      version: '1',
      frozenFiles: [{ file: `postgres-fixture:${context.name}`, sha256: sourceHash, bytes: Buffer.byteLength(sourceText) }]
    },
    endpointEvidence: {
      wordSenseKeys: [{ senseKey: `${context.source}%test`, synsetId: context.source, locator: { file: `postgres-fixture:${context.name}`, line: 1, lineSha256: sourceHash } }],
      baseSenseKeys: [{ senseKey: `${context.target}%test`, synsetId: context.target, locator: { file: `postgres-fixture:${context.name}`, line: 1, lineSha256: sourceHash } }]
    },
    relation: {
      pathDisposition: decision === 'VERIFY' ? 'SUPPORTS' : decision === 'REJECT' ? 'CONTRADICTS' : null,
      selectedPath: decisive ? {
        length: 1,
        nodes: [context.source, context.target],
        symbols: [context.edge.type],
        directions: ['forward'],
        transitionLocators: [{
          file: `postgres-fixture:${context.name}`,
          line: 1,
          lineSha256: sourceHash,
          synsetId: context.source,
          pointerSymbol: context.edge.type,
          pointerDirection: 'forward',
          pointerTarget: context.target
        }]
      } : null,
      candidatePaths: [],
      maxPointerHops: 1
    },
    decision: {
      status: decision,
      ruleId: 'A64-PERSISTENCE-FIXTURE-v1',
      explanation: `${decision} persistence fixture.`,
      evidenceSha256: null
    },
    provenance: {
      capturedAtCreation: true,
      sourceReceipt: null,
      gaps: decision === 'UNRESOLVED' ? ['No qualifying relation path in this fixture.'] : []
    },
    requestedAction: decision === 'VERIFY' ? 'COMMIT_EDGE' : 'RECEIPT_ONLY',
    integrity: { receiptSha256: null }
  });
}

async function updateProposalReceipt(context) {
  await query(
    `UPDATE graph_proposals SET payload=jsonb_set(payload,'{creationReceipt}',$2::jsonb) WHERE id=$1`,
    [context.proposalId, JSON.stringify(context.receipt)]
  );
}

async function transact(context, injectFailure = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const proposalResult = await client.query('SELECT * FROM graph_proposals WHERE id=$1 FOR UPDATE', [context.proposalId]);
    const result = await persistEdgeCreation(client, {
      proposal: proposalResult.rows[0],
      edge: context.edge,
      author: actor,
      injectFailure
    });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function counts(context) {
  const [receipts, edges, history] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM edge_creation_receipts WHERE proposal_id=$1', [context.proposalId]),
    query('SELECT COUNT(*)::int AS count FROM edges WHERE id=$1', [context.edge.id]),
    query("SELECT COUNT(*)::int AS count FROM graph_history WHERE entity_type='edge' AND entity_id=$1", [context.edge.id])
  ]);
  return {
    receipts: receipts.rows[0].count,
    edges: edges.rows[0].count,
    history: history.rows[0].count
  };
}


