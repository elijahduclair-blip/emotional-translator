import crypto from 'node:crypto';
import { validateCreationReceipt } from './edge-creation-receipts.js';

export const normalizePersonalGraphKey = value => String(value || '')
  .normalize('NFC')
  .toLocaleLowerCase('en-US')
  .trim()
  .replace(/\s+/gu, ' ');

export function formatPersonalGraphRelationship(row) {
  return {
    id: row.id,
    source: row.source_label,
    sourceId: row.source_node_id,
    target: row.target_label,
    targetId: row.target_node_id,
    relationshipType: row.relationship_type,
    confidence: row.confidence,
    evidence: row.evidence,
    counterexample: row.counterexample,
    sourceReceiptId: row.source_receipt_id,
    receiptSha256: row.receipt_sha256 || null,
    mutationSource: row.mutation_source,
    approvedByUser: row.approved_by_user,
    placedByUser: row.placed_by_user,
    reviewNote: row.review_note,
    recordStatus: row.record_status,
    sourceLayer: 'user_graph',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function persistPersonalGraphPlacement(client, input, { injectFailure = null } = {}) {
  const userId = requiredText(input.userId, 'userId is required.', 200);
  const receiptId = requiredText(input.receiptId, 'receiptId is required.', 200);
  const idempotencyKey = requiredText(input.idempotencyKey, 'idempotencyKey is required.', 200);
  const placedByUser = requiredText(input.placedByUser, 'placedByUser is required.', 200);
  const reviewNote = requiredText(input.reviewNote, 'reviewNote is required.', 1_000);
  const counterexample = requiredText(input.counterexample, 'counterexample is required.', 1_000);
  const confidence = String(input.confidence || 'high').trim().toLowerCase();
  if (!['high', 'medium', 'low'].includes(confidence)) throw httpError(400, 'confidence must be high, medium, or low.');

  const owner = (await client.query(
    'SELECT id,username FROM users WHERE id=$1 AND password_hash IS NOT NULL FOR UPDATE',
    [userId]
  )).rows[0];
  if (!owner) throw httpError(404, 'Personal graph owner was not found.');

  const stored = (await client.query(
    `SELECT receipt.*, proposal.payload AS proposal_payload
     FROM edge_creation_receipts AS receipt
     INNER JOIN graph_proposals AS proposal ON proposal.id=receipt.proposal_id
     WHERE receipt.receipt_id=$1 FOR UPDATE OF receipt`,
    [receiptId]
  )).rows[0];
  if (!stored) throw httpError(404, 'Creation receipt was not found.');
  const creationReceipt = stored.receipt;
  validatePersonalPlacementReceipt(stored, creationReceipt, owner.username);

  const wordNode = creationReceipt.edge.wordNode;
  const baseNode = creationReceipt.edge.baseNode;
  const relationshipType = requiredText(creationReceipt.edge.relationship, 'Receipt relationship is missing.', 120);
  const proposalRelationship = stored.proposal_payload?.relationship || {};
  const evidence = requiredText(
    proposalRelationship.evidence || creationReceipt.decision.explanation,
    'Receipt evidence is missing.',
    1_000
  );
  const endpoints = await client.query(
    "SELECT id FROM nodes WHERE id IN ($1,$2) AND record_status='active'",
    [wordNode.recordId, baseNode.recordId]
  );
  if (endpoints.rows.length !== 2) throw httpError(409, 'Both receipt endpoints must remain active.');

  const requestHash = sha256Json({
    userId,
    receiptId,
    receiptSha256: stored.receipt_sha256,
    idempotencyKey,
    confidence,
    counterexample,
    reviewNote,
  });
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [`personal-placement-idempotency:${idempotencyKey}`]
  );
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [`personal-placement-relation:${userId}:${wordNode.recordId}:${baseNode.recordId}:${relationshipType}`]
  );
  const replay = (await client.query(
    'SELECT * FROM user_graph_relationships WHERE placement_idempotency_key=$1 FOR UPDATE',
    [idempotencyKey]
  )).rows[0];
  if (replay) {
    if (replay.placement_request_sha256 !== requestHash) {
      throw httpError(409, 'Idempotency key was reused for a different personal-graph placement.');
    }
    return { relationship: { ...replay, receipt_sha256: stored.receipt_sha256 }, history: null, idempotent: true, disposition: 'PERSONAL_RELATIONSHIP_ALREADY_PRESENT' };
  }

  const existing = (await client.query(
    `SELECT * FROM user_graph_relationships
     WHERE user_id=$1 AND source_node_id=$2 AND target_node_id=$3 AND relationship_type=$4 AND record_status='active'
     ORDER BY created_at,id LIMIT 1 FOR UPDATE`,
    [userId, wordNode.recordId, baseNode.recordId, relationshipType]
  )).rows[0];
  if (existing) {
    if (existing.source_receipt_id !== receiptId) {
      throw httpError(409, 'This personal relationship already exists with different receipt provenance.');
    }
    return { relationship: { ...existing, receipt_sha256: stored.receipt_sha256 }, history: null, idempotent: true, disposition: 'PERSONAL_RELATIONSHIP_ALREADY_PRESENT' };
  }

  const relationshipId = crypto.randomUUID();
  const inserted = (await client.query(
    `INSERT INTO user_graph_relationships
      (id,user_id,source_label,source_key,target_label,target_key,relationship_type,confidence,evidence,counterexample,
       mutation_source,approved_by_user,review_note,source_node_id,target_node_id,source_receipt_id,
       placement_idempotency_key,placement_request_sha256,placed_by_user)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'user_directed',$2,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      relationshipId,
      userId,
      wordNode.name,
      normalizePersonalGraphKey(wordNode.name),
      baseNode.name,
      normalizePersonalGraphKey(baseNode.name),
      relationshipType,
      confidence,
      evidence,
      counterexample,
      reviewNote,
      wordNode.recordId,
      baseNode.recordId,
      receiptId,
      idempotencyKey,
      requestHash,
      placedByUser,
    ]
  )).rows[0];
  if (injectFailure === 'history-store') throw new Error('injected personal history store failure');
  const history = (await client.query(
    `INSERT INTO user_graph_history
      (id,relationship_id,user_id,action,before_data,after_data,source_receipt_id,actor_user_id,reason)
     VALUES ($1,$2,$3,'create',NULL,$4,$5,$6,$7) RETURNING *`,
    [crypto.randomUUID(), relationshipId, userId, inserted, receiptId, placedByUser, reviewNote]
  )).rows[0];
  return { relationship: { ...inserted, receipt_sha256: stored.receipt_sha256 }, history, idempotent: false, disposition: 'PERSONAL_RELATIONSHIP_AND_HISTORY_COMMITTED' };
}

function validatePersonalPlacementReceipt(stored, receipt, username) {
  const validation = validateCreationReceipt(receipt);
  if (!validation.valid) throw httpError(400, `Invalid creation receipt: ${validation.errors.join('; ')}`);
  if (stored.receipt_id !== receipt.receiptId || stored.receipt_sha256 !== receipt.integrity?.receiptSha256
      || stored.decision !== receipt.decision?.status || stored.requested_action !== receipt.requestedAction) {
    throw httpError(409, 'Stored receipt metadata does not match its sealed receipt body.');
  }
  if (stored.decision !== 'UNRESOLVED' || stored.requested_action !== 'RECEIPT_ONLY'
      || stored.outcome !== 'RECEIPT_ONLY_COMMITTED' || stored.edge_id !== null) {
    throw httpError(409, 'Only an unresolved receipt-only decision may enter the personal placement lane.');
  }
  const scope = normalizePersonalGraphKey(receipt.creationContext?.profileScope).replace(/[^a-z0-9]+/g, ' ');
  const ownerTokens = normalizePersonalGraphKey(username).split(/[^a-z0-9]+/g).filter(token => token.length >= 3);
  if (!scope.includes('personal') || !ownerTokens.some(token => scope.includes(token))) {
    throw httpError(409, 'Receipt profile scope does not identify this personal graph owner.');
  }
  const personalPath = (receipt.relation?.candidatePaths || []).find(path => path?.lane === 'user_graph');
  if (personalPath?.status !== 'supported') {
    throw httpError(409, 'Receipt does not contain a supported personal-graph lane.');
  }
  const placementGap = (receipt.provenance?.gaps || []).some(gap => gap?.type === 'placement_scope');
  if (!placementGap) throw httpError(409, 'Receipt does not preserve the placement-scope gap being resolved.');
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requiredText(value, message, maxLength) {
  if (typeof value !== 'string' || !value.trim()) throw httpError(400, message);
  if ([...value].length > maxLength) throw httpError(413, `${message.replace(/\.$/, '')} (maximum ${maxLength} Unicode code points).`);
  return value.trim();
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
