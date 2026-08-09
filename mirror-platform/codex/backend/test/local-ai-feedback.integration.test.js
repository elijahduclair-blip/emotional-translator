import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { createAccessToken } from '../src/auth/tokens.js';
import { query, pool } from '../src/db/pool.js';
import { createFeedbackReceiptSignature } from '../src/lib/local-ai-feedback.js';

dotenv.config();
const PORT = 3112;
const API = `http://127.0.0.1:${PORT}/api/v1`;
const SERVICE_TOKEN = 'local-ai-feedback-integration-secret';
let server;

test('signed feedback remains governed through review and dataset preparation', async () => {
  await startServer();
  const suffix = crypto.randomUUID().slice(0, 8);
  const learner = await installUser(`feedback-learner-${suffix}`, 'user');
  const other = await installUser(`feedback-other-${suffix}`, 'user');
  const admin = await installUser(`feedback-admin-${suffix}`, 'admin');
  let feedbackId;
  let adapterVersionId;

  try {
    const value = signedFeedback(`interaction-${suffix}`);
    const submitted = await request('/local-ai/feedback', learner, { method: 'POST', body: value });
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    feedbackId = submitted.body.feedback.id;
    assert.equal(submitted.body.feedback.status, 'proposed');
    assert.equal(submitted.body.boundary.modelWeightsChanged, false);

    const duplicate = await request('/local-ai/feedback', learner, { method: 'POST', body: value });
    assert.equal(duplicate.status, 409);

    const tampered = signedFeedback(`tampered-${suffix}`);
    tampered.modelResponse = 'A response that was not signed by Mirror Runtime.';
    assert.equal((await request('/local-ai/feedback', learner, { method: 'POST', body: tampered })).status, 400);

    const own = await request('/local-ai/feedback', learner);
    const isolated = await request('/local-ai/feedback', other);
    assert.equal(own.body.count, 1);
    assert.equal(isolated.body.count, 0);

    const reviewed = await request(`/local-ai/feedback/${feedbackId}/review`, admin, {
      method: 'PATCH', body: { decision: 'accepted', reviewNote: 'Conversation and evidence boundary verified.' }
    });
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
    assert.equal(reviewed.body.feedback.status, 'accepted');
    assert.equal(reviewed.body.learningCandidate.lane, 'model_retraining');
    assert.equal(reviewed.body.learningCandidate.status, 'proposed');
    assert.equal(reviewed.body.boundary.activeAdapterChanged, false);

    const blockedCandidates = await request('/local-ai/training/candidates', admin);
    assert.equal(blockedCandidates.status, 200);
    assert.ok(!blockedCandidates.body.records.some(record => record.metadata.sourceFeedbackId === feedbackId));

    const approvedRetraining = await request(`/local-ai/learning-candidates/${reviewed.body.learningCandidate.id}/review`, admin, {
      method: 'PATCH', body: { decision: 'approved', reviewNote: 'Admit this reviewed response to a future adapter dataset.' }
    });
    assert.equal(approvedRetraining.status, 200, JSON.stringify(approvedRetraining.body));
    assert.equal(approvedRetraining.body.candidate.status, 'approved');
    assert.equal(approvedRetraining.body.relationship, null);

    const candidates = await request('/local-ai/training/candidates', admin);
    assert.equal(candidates.status, 200);
    assert.ok(candidates.body.records.some(record => record.metadata.sourceFeedbackId === feedbackId));
    assert.equal(candidates.body.targetModel, 'qwen3:4b-instruct');
    assert.equal(candidates.body.boundary.trainingStarted, false);
    assert.equal(candidates.body.boundary.alignmentVerifierTrainingAllowed, false);

    const sharedBefore = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM nodes WHERE record_status='active'`),
      query(`SELECT COUNT(*)::int AS count FROM edges WHERE record_status='active'`)
    ]);
    const incompleteGraphCandidate = await request(`/local-ai/feedback/${feedbackId}/learning-candidates`, learner, {
      method: 'POST',
      body: {
        lane: 'user_graph',
        proposal: {
          source: 'Amber Glow', target: 'Reflection', relationshipType: 'moves_toward', confidence: 'medium',
          evidence: 'Evidence without a falsification condition must not be enough.'
        }
      }
    });
    assert.equal(incompleteGraphCandidate.status, 400);
    const graphCandidate = await request(`/local-ai/feedback/${feedbackId}/learning-candidates`, learner, {
      method: 'POST',
      body: {
        lane: 'user_graph',
        proposal: {
          source: 'Amber Glow', target: 'Reflection', relationshipType: 'moves_toward', confidence: 'medium',
          evidence: 'This reviewed interaction places Amber Glow beside reflection for this learner.',
          counterexample: 'Reject the route if later reviewed interactions consistently separate the two.'
        }
      }
    });
    assert.equal(graphCandidate.status, 201, JSON.stringify(graphCandidate.body));
    assert.equal((await request('/local-ai/learning-candidates', other)).body.count, 0);
    const approvedGraph = await request(`/local-ai/learning-candidates/${graphCandidate.body.candidate.id}/review`, admin, {
      method: 'PATCH', body: { decision: 'approved', reviewNote: 'Evidence and falsification condition are bounded to the learner.' }
    });
    assert.equal(approvedGraph.status, 200, JSON.stringify(approvedGraph.body));
    assert.equal(approvedGraph.body.relationship.source, 'Amber Glow');
    const personalGraph = await request('/local-ai/user-graph?text=amber%20glow', learner);
    assert.equal(personalGraph.status, 200);
    assert.equal(personalGraph.body.relationshipCount, 1);
    assert.equal((await request('/local-ai/user-graph?text=young', learner)).body.relationshipCount, 0);
    assert.equal((await request('/local-ai/user-graph?text=amber%20glow', other)).body.relationshipCount, 0);
    const sharedAfter = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM nodes WHERE record_status='active'`),
      query(`SELECT COUNT(*)::int AS count FROM edges WHERE record_status='active'`)
    ]);
    assert.deepEqual(sharedAfter.map(result => result.rows[0].count), sharedBefore.map(result => result.rows[0].count));

    const readiness = await request('/local-ai/training/status', admin);
    assert.equal(readiness.status, 200);
    assert.ok(readiness.body.readiness.acceptedFeedback >= 1);

    for (let index = 1; index < 20; index += 1) {
      await query(
        `INSERT INTO local_ai_feedback
          (id,interaction_id,user_id,decision,input,canonical_english,model_name,model_response,correction,
           graph_source,learned_alignment_status,contract_verified,relational_evidence,response_sha256,status,reviewer,review_note,reviewed_at)
         VALUES ($1,$2,$3,'corrected',$4,$4,'qwen3:4b-instruct','Unreviewed response.',$5,
           'unresolved','not_applicable',FALSE,$6,$7,'accepted',$8,'Integration review.',NOW())`,
        [`feedback-${suffix}-${index}`, `interaction-${suffix}-${index}`, learner.id, `Question ${index}`, `Reviewed response ${index}.`,
          JSON.stringify({ sourceLayer: 'unresolved', matchedNodeCount: 0, confirmedRouteCount: 0, relationshipClaimsSupported: false }),
          crypto.createHash('sha256').update('Unreviewed response.').digest('hex'), admin.id]
      );
      await query(
        `INSERT INTO local_ai_learning_candidates
          (id,feedback_id,user_id,lane,proposal,status,reviewer,review_note,reviewed_at,applied_at)
         VALUES ($1,$2,$3,'model_retraining',$4,'approved',$5,'Integration candidate review.',NOW(),NOW())`,
        [`candidate-${suffix}-${index}`, `feedback-${suffix}-${index}`, learner.id,
          JSON.stringify({ source: 'integration_fixture' }), admin.id]
      );
    }
    const prepared = await request('/local-ai/training/versions', admin, {
      method: 'POST', body: { name: `feedback-integration-${suffix}` }
    });
    assert.equal(prepared.status, 201, JSON.stringify(prepared.body));
    adapterVersionId = prepared.body.version.id;
    assert.equal(prepared.body.version.status, 'prepared');
    assert.ok(prepared.body.package.manifest.splits.validation.recordCount >= 4);

    const trained = await requestService(`/local-ai/training/versions/${adapterVersionId}/report`, {
      phase: 'training', artifactPath: `training/output/${adapterVersionId}`, artifactSha256: 'a'.repeat(64),
      report: { boundary: { baseWeightsChanged: false, adapterWeightsChanged: true, semanticAuthorityGranted: false, graphMutationAllowed: false } }
    });
    assert.equal(trained.status, 200);
    assert.equal(trained.body.version.status, 'trained');
    const heldOutExamples = prepared.body.package.manifest.splits.validation.recordCount;
    const validated = await requestService(`/local-ai/training/versions/${adapterVersionId}/report`, {
      phase: 'validation', report: {
        validatorVersion: '2.0.0', heldOutExamples, contractMatches: heldOutExamples,
        wordForWordMatches: 0, exactMatches: 0, emptyResponses: 0, boundaryViolations: 0,
        unsupportedGraphClaims: 0, evidenceCountMismatches: 0,
        semanticMutationClaims: 0, graphMutationClaims: 0
      }
    });
    assert.equal(validated.status, 200);
    assert.equal(validated.body.version.status, 'validated');
    const deployed = await requestService(`/local-ai/training/versions/${adapterVersionId}/report`, {
      phase: 'deployment', report: { verified: true, provider: 'ollama', modelName: `mirror-qwen3-${suffix}`, probeResponseSha256: 'b'.repeat(64) }
    });
    assert.equal(deployed.status, 200);
    assert.equal(deployed.body.version.status, 'deployable');
  } finally {
    if (adapterVersionId) await query('DELETE FROM local_ai_adapter_versions WHERE id=$1', [adapterVersionId]);
    if (feedbackId) await query('DELETE FROM local_ai_feedback WHERE id=$1', [feedbackId]);
    await query('DELETE FROM users WHERE id=$1 OR id=$2 OR id=$3', [learner.id, other.id, admin.id]);
  }
});

test.after(async () => { server?.kill(); await pool.end(); });

function signedFeedback(interactionId) {
  const value = {
    decision: 'corrected',
    correction: 'Amber Glow is an imported reference match. No supplied route establishes a relationship.',
    input: 'Amber Glow', canonicalEnglish: 'Amber Glow', modelName: 'qwen3:4b-instruct',
    modelResponse: 'Amber Glow is connected to other concepts.', graphSource: 'chromabridge_knowledge',
    learnedAlignmentStatus: 'verified', contractVerified: true,
    relationalEvidence: {
      sourceLayer: 'chromabridge_knowledge', matchedNodeCount: 1, confirmedRouteCount: 0,
      relationshipClaimsSupported: false, notice: 'No graph route was supplied.'
    },
    receipt: { version: '1.0.0', interactionId, issuedAt: new Date().toISOString(), signature: '' }
  };
  value.receipt.signature = createFeedbackReceiptSignature(value, SERVICE_TOKEN);
  return value;
}

async function requestService(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${SERVICE_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function request(path, user, options = {}) {
  const response = await fetch(`${API}${path}`, {
    method: options.method || 'GET',
    headers: { authorization: `Bearer ${createAccessToken(user)}`, 'content-type': 'application/json' },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  return { status: response.status, body: await response.json() };
}

async function installUser(username, role) {
  const id = crypto.randomUUID();
  const result = await query(
    `INSERT INTO users (id,username,email,password_hash,role,email_verified_at,signup_source,token_version,must_change_password)
     VALUES ($1,$2,$3,'test-only',$4,NOW(),'legacy',1,FALSE)
     RETURNING id,username,email,role,token_version,must_change_password`,
    [id, username, `${username}@local.test`, role]
  );
  return result.rows[0];
}

async function startServer() {
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(PORT), RUNTIME_SERVICE_TOKEN: SERVICE_TOKEN },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Local AI feedback integration server did not start.');
}
