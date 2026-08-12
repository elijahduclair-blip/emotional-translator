import crypto from 'node:crypto';

const RECEIPT_VERSION = '1.0.0';
const RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
const GRAPH_SOURCES = new Set(['approved_graph', 'chromabridge_knowledge', 'unresolved']);

export function normalizeLocalAiFeedback(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'Feedback is required.');
  const decision = String(value.decision || '');
  if (!['approved', 'corrected'].includes(decision)) throw httpError(400, 'decision must be approved or corrected.');
  const correction = optionalText(value.correction, 8_000);
  if (decision === 'corrected' && !correction) throw httpError(400, 'A correction is required when decision is corrected.');
  if (decision === 'approved' && correction) throw httpError(400, 'Approved feedback must not include a correction.');

  const graphSource = requiredText(value.graphSource, 'graphSource is required.', 80);
  if (!GRAPH_SOURCES.has(graphSource)) throw httpError(400, 'graphSource is not recognized.');
  const relationalEvidence = normalizeRelationalEvidence(value.relationalEvidence);
  const receipt = normalizeReceipt(value.receipt);

  return {
    decision,
    correction,
    interactionId: receipt.interactionId,
    issuedAt: receipt.issuedAt,
    receipt,
    input: requiredText(value.input, 'input is required.', 10_000),
    canonicalEnglish: requiredText(value.canonicalEnglish, 'canonicalEnglish is required.', 10_000),
    modelName: requiredText(value.modelName, 'modelName is required.', 160),
    modelResponse: requiredText(value.modelResponse, 'modelResponse is required.', 8_000),
    graphSource,
    learnedAlignmentStatus: requiredText(value.learnedAlignmentStatus || 'not_applicable', 'learnedAlignmentStatus is required.', 80),
    contractVerified: value.contractVerified === true,
    relationalEvidence
  };
}

export function verifyFeedbackReceipt(feedback, serviceToken, now = Date.now()) {
  if (!serviceToken) throw httpError(503, 'Runtime feedback verification is not configured.');
  const issuedAt = Date.parse(feedback.receipt.issuedAt);
  if (!Number.isFinite(issuedAt) || issuedAt > now + 5 * 60 * 1000 || now - issuedAt > RECEIPT_TTL_MS) {
    throw httpError(400, 'Feedback receipt is expired or invalid.');
  }
  const expected = createFeedbackReceiptSignature(feedback, serviceToken);
  const provided = Buffer.from(feedback.receipt.signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length || !crypto.timingSafeEqual(provided, expectedBuffer)) {
    throw httpError(400, 'Feedback receipt does not match the recorded interaction.');
  }
  return true;
}

export function createFeedbackReceiptSignature(value, serviceToken) {
  return crypto.createHmac('sha256', serviceToken).update(feedbackReceiptPayload(value)).digest('base64url');
}

export function buildReviewedFeedbackDataset(rows) {
  const records = rows.map(row => {
    const target = row.decision === 'corrected' ? row.correction : row.model_response;
    return {
      id: `conversation_feedback_${row.id}`,
      task: 'mirror_conversation_response',
      messages: [
        {
          role: 'system',
          content: 'Respond in clear English using only supplied bounded evidence. Treat color-climate language relationally. Search matches are not graph routes. Never claim semantic, graph, memory, or source-code mutation authority.'
        },
        {
          role: 'user',
          content: JSON.stringify({
            userEnglish: row.canonical_english,
            relationalEvidence: row.relational_evidence,
            graphSource: row.graph_source,
            learnedAlignment: {
              status: row.learned_alignment_status,
              contractVerified: row.contract_verified
            }
          })
        },
        { role: 'assistant', content: target }
      ],
      metadata: {
        sourceFeedbackId: row.id,
        interactionId: row.interaction_id,
        decision: row.decision,
        reviewed: true,
        targetModel: 'qwen3:4b-instruct',
        adapterKind: 'conversation_lora',
        semanticAuthority: false,
        graphMutationAllowed: false,
        alignmentVerifierTrainingAllowed: false
      }
    };
  });
  const jsonl = records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '');
  const ordered = [...records].sort((left, right) => sha256(left.metadata.sourceFeedbackId).localeCompare(sha256(right.metadata.sourceFeedbackId)));
  const validationCount = ordered.length >= 5 ? Math.max(1, Math.ceil(ordered.length * 0.2)) : 0;
  const validationRecords = ordered.slice(0, validationCount);
  const trainingRecords = ordered.slice(validationCount);
  const trainingJsonl = recordsToJsonl(trainingRecords);
  const validationJsonl = recordsToJsonl(validationRecords);
  return {
    version: '1.0.0',
    targetModel: 'qwen3:4b-instruct',
    adapterKind: 'conversation_lora',
    feedbackCount: rows.length,
    recordCount: records.length,
    sha256: crypto.createHash('sha256').update(jsonl).digest('hex'),
    records,
    jsonl,
    readiness: {
      minimumFeedback: 20,
      acceptedFeedback: rows.length,
      minimumValidation: 4,
      trainingRecords: trainingRecords.length,
      validationRecords: validationRecords.length,
      readyToPrepareVersion: rows.length >= 20 && validationRecords.length >= 4
    },
    splits: {
      strategy: 'deterministic_sha256_by_feedback_id',
      training: { recordCount: trainingRecords.length, sha256: sha256(trainingJsonl), records: trainingRecords, jsonl: trainingJsonl },
      validation: { recordCount: validationRecords.length, sha256: sha256(validationJsonl), records: validationRecords, jsonl: validationJsonl }
    },
    boundary: {
      mode: 'reviewed_training_candidates_only',
      trainingStarted: false,
      modelWeightsChanged: false,
      activeAdapterChanged: false,
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      alignmentVerifierTrainingAllowed: false
    }
  };
}

function recordsToJsonl(records) {
  return records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function feedbackReceiptPayload(value) {
  return JSON.stringify([
    RECEIPT_VERSION,
    value.receipt?.interactionId || value.interactionId,
    value.receipt?.issuedAt || value.issuedAt,
    value.input,
    value.canonicalEnglish,
    value.modelName,
    value.modelResponse,
    value.graphSource,
    value.learnedAlignmentStatus,
    value.contractVerified === true,
    value.relationalEvidence.sourceLayer,
    value.relationalEvidence.matchedNodeCount,
    value.relationalEvidence.confirmedRouteCount,
    value.relationalEvidence.relationshipClaimsSupported === true
  ]);
}

function normalizeReceipt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'A signed feedback receipt is required.');
  if (value.version !== RECEIPT_VERSION) throw httpError(400, 'Feedback receipt version is not supported.');
  return {
    version: RECEIPT_VERSION,
    interactionId: requiredText(value.interactionId, 'receipt.interactionId is required.', 120),
    issuedAt: requiredText(value.issuedAt, 'receipt.issuedAt is required.', 80),
    signature: requiredText(value.signature, 'receipt.signature is required.', 160)
  };
}

function normalizeRelationalEvidence(value) {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const sourceLayer = requiredText(object.sourceLayer || 'unresolved', 'relationalEvidence.sourceLayer is required.', 80);
  if (!GRAPH_SOURCES.has(sourceLayer)) throw httpError(400, 'relationalEvidence.sourceLayer is not recognized.');
  const matchedNodeCount = boundedInteger(object.matchedNodeCount, 0, 12, 'matchedNodeCount');
  const confirmedRouteCount = boundedInteger(object.confirmedRouteCount, 0, 24, 'confirmedRouteCount');
  return {
    sourceLayer,
    matchedNodeCount,
    confirmedRouteCount,
    relationshipClaimsSupported: confirmedRouteCount > 0 && object.relationshipClaimsSupported === true,
    notice: optionalText(object.notice, 500) || ''
  };
}

function boundedInteger(value, minimum, maximum, name) {
  const number = Number(value ?? 0);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw httpError(400, `${name} must be an integer from ${minimum} to ${maximum}.`);
  return number;
}

function requiredText(value, message, maxLength) {
  if (typeof value !== 'string' || !value.trim()) throw httpError(400, message);
  if ([...value].length > maxLength) throw httpError(413, `${message.replace(/\.$/, '')} (maximum ${maxLength} Unicode code points).`);
  return value.trim();
}

function optionalText(value, maxLength) {
  if (value == null || value === '') return null;
  return requiredText(value, 'Value must contain text.', maxLength);
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
