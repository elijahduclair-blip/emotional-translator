import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReviewedFeedbackDataset,
  createFeedbackReceiptSignature,
  normalizeLocalAiFeedback,
  verifyFeedbackReceipt
} from '../src/lib/local-ai-feedback.js';

const serviceToken = 'feedback-test-service-token';

test('signed approved feedback remains a proposal and verifies exact interaction fields', () => {
  const value = feedbackValue({ decision: 'approved' });
  const normalized = normalizeLocalAiFeedback(value);
  assert.equal(verifyFeedbackReceipt(normalized, serviceToken, Date.parse(value.receipt.issuedAt)), true);
  assert.equal(normalized.decision, 'approved');
  assert.equal(normalized.relationalEvidence.relationshipClaimsSupported, false);
});

test('tampering with a signed model response is rejected', () => {
  const value = feedbackValue({ decision: 'approved' });
  value.modelResponse = 'A replacement that was never generated.';
  const normalized = normalizeLocalAiFeedback(value);
  assert.throws(() => verifyFeedbackReceipt(normalized, serviceToken, Date.parse(value.receipt.issuedAt)), /does not match/);
});

test('corrected feedback requires the person-supplied replacement', () => {
  assert.throws(() => normalizeLocalAiFeedback(feedbackValue({ decision: 'corrected', correction: undefined })), /correction is required/);
});

test('reviewed feedback produces a separate conversational LoRA dataset', () => {
  const dataset = buildReviewedFeedbackDataset([{
    id: 'feedback-1', interaction_id: 'interaction-1', decision: 'corrected',
    canonical_english: 'What is moving here?', model_response: 'A fixed label.', correction: 'A moving climate remains open to revision.',
    graph_source: 'unresolved', learned_alignment_status: 'not_applicable', contract_verified: false,
    relational_evidence: { sourceLayer: 'unresolved', matchedNodeCount: 0, confirmedRouteCount: 0, relationshipClaimsSupported: false }
  }]);
  assert.equal(dataset.recordCount, 1);
  assert.equal(dataset.records[0].messages[2].content, 'A moving climate remains open to revision.');
  assert.equal(dataset.records[0].metadata.targetModel, 'qwen3:4b-instruct');
  assert.equal(dataset.records[0].metadata.alignmentVerifierTrainingAllowed, false);
  assert.equal(dataset.boundary.trainingStarted, false);
  assert.equal(dataset.boundary.modelWeightsChanged, false);
  assert.equal(dataset.boundary.activeAdapterChanged, false);
  assert.equal(dataset.readiness.readyToPrepareVersion, false);
});

test('twenty reviewed records reserve a deterministic held-out activation gate', () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({
    id: `feedback-${index}`, interaction_id: `interaction-${index}`, decision: 'corrected',
    canonical_english: `Question ${index}`, model_response: 'Unreviewed response.', correction: `Reviewed response ${index}.`,
    graph_source: 'unresolved', learned_alignment_status: 'not_applicable', contract_verified: false,
    relational_evidence: { sourceLayer: 'unresolved', matchedNodeCount: 0, confirmedRouteCount: 0, relationshipClaimsSupported: false }
  }));
  const first = buildReviewedFeedbackDataset(rows);
  const second = buildReviewedFeedbackDataset([...rows].reverse());
  assert.equal(first.readiness.readyToPrepareVersion, true);
  assert.equal(first.splits.training.recordCount, 16);
  assert.equal(first.splits.validation.recordCount, 4);
  assert.equal(first.splits.training.sha256, second.splits.training.sha256);
  assert.equal(first.splits.validation.sha256, second.splits.validation.sha256);
});

function feedbackValue(overrides = {}) {
  const issuedAt = '2026-08-03T18:00:00.000Z';
  const base = {
    decision: 'approved',
    input: 'Amber Glow',
    canonicalEnglish: 'Amber Glow',
    modelName: 'qwen3:4b-instruct',
    modelResponse: 'Amber Glow is a reference match; no route establishes a relationship.',
    graphSource: 'chromabridge_knowledge',
    learnedAlignmentStatus: 'verified',
    contractVerified: true,
    relationalEvidence: {
      sourceLayer: 'chromabridge_knowledge', matchedNodeCount: 1, confirmedRouteCount: 0,
      relationshipClaimsSupported: false, notice: 'No graph route was supplied.'
    },
    receipt: { version: '1.0.0', interactionId: 'interaction-1', issuedAt, signature: '' },
    ...overrides
  };
  base.receipt.signature = createFeedbackReceiptSignature(base, serviceToken);
  return base;
}
