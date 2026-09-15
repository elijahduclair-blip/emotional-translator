import crypto from 'node:crypto';
import { normalizePersonalGraphKey } from './personal-graph.js';

const RELATIONSHIP_TYPE = 'associates_color_climate';

export function formatPersonalMappingObservation(row) {
  return {
    id: row.id,
    subject: row.subject_label,
    subjectKey: row.subject_key,
    color: row.color_label,
    colorKey: row.color_key,
    relationshipType: row.relationship_type,
    exactStatement: row.exact_statement,
    sourceName: row.source_name,
    evidence: row.evidence,
    context: row.context,
    scope: row.scope,
    receiptId: row.receipt_id,
    receiptSha256: row.receipt_sha256,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    sourceLayer: 'user_graph_observation',
  };
}

export async function persistPersonalMappingObservation(client, input, { injectFailure = null } = {}) {
  const userId = requiredText(input.userId, 'userId is required.', 200);
  const observedByUser = requiredText(input.observedByUser, 'observedByUser is required.', 200);
  const subject = requiredText(input.subject, 'subject is required.', 200);
  const color = requiredText(input.color, 'color is required.', 200);
  const exactStatement = requiredText(input.exactStatement, 'exactStatement is required.', 4_000);
  const sourceName = requiredText(input.sourceName, 'sourceName is required.', 500);
  const idempotencyKey = requiredText(input.idempotencyKey, 'idempotencyKey is required.', 200);
  const relationshipType = String(input.relationshipType || RELATIONSHIP_TYPE).trim();
  if (relationshipType !== RELATIONSHIP_TYPE) throw httpError(400, `relationshipType must be ${RELATIONSHIP_TYPE}.`);
  const evidence = plainObject(input.evidence, 'evidence');
  const context = plainObject(input.context, 'context');
  const observedAtInput = input.observedAt == null ? null : validDate(input.observedAt);

  const owner = (await client.query(
    'SELECT id,username FROM users WHERE id=$1 AND password_hash IS NOT NULL FOR UPDATE',
    [userId]
  )).rows[0];
  if (!owner) throw httpError(404, 'Personal graph owner was not found.');

  const request = { userId, subject, color, relationshipType, exactStatement, sourceName, evidence, context, observedAt: observedAtInput, observedByUser };
  const requestSha256 = sha256Json(request);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`personal-observation-idempotency:${idempotencyKey}`]);

  const replay = (await client.query(
    `SELECT observation.*,receipt.receipt_id,receipt.receipt_sha256,receipt.receipt
     FROM user_graph_observations AS observation
     INNER JOIN user_graph_observation_receipts AS receipt ON receipt.observation_id=observation.id
     WHERE observation.idempotency_key=$1 FOR UPDATE OF observation,receipt`,
    [idempotencyKey]
  )).rows[0];
  if (replay) {
    if (replay.request_sha256 !== requestSha256) throw httpError(409, 'Idempotency key was reused for a different personal mapping observation.');
    return { observation: replay, receipt: replay.receipt, idempotent: true, disposition: 'PERSONAL_MAPPING_OBSERVATION_ALREADY_PRESENT' };
  }

  const observationId = crypto.randomUUID();
  const inserted = (await client.query(
    `INSERT INTO user_graph_observations
      (id,user_id,subject_label,subject_key,color_label,color_key,relationship_type,exact_statement,source_name,
       evidence,context,scope,idempotency_key,request_sha256,observed_by_user,observed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'personal',$12,$13,$14,COALESCE($15::timestamptz,NOW()))
     RETURNING *`,
    [observationId, userId, subject, normalizePersonalGraphKey(subject), color, normalizePersonalGraphKey(color), relationshipType,
      exactStatement, sourceName, evidence, context, idempotencyKey, requestSha256, observedByUser, observedAtInput]
  )).rows[0];

  if (injectFailure === 'receipt-store') throw new Error('injected personal observation receipt store failure');

  const receiptId = `CBPO-${requestSha256.slice(0, 16).toUpperCase()}`;
  const receiptBody = {
    receiptVersion: 'chromabridge-personal-observation.v1',
    receiptId,
    observationId,
    owner: { userId, username: owner.username },
    association: { subject, color, relationshipType },
    evidence: { exactStatement, sourceName, details: evidence, context },
    scope: {
      selectedLane: 'user_graph_observation',
      personal: true,
      relationshipMutationAllowed: false,
      sharedGraphMutationAllowed: false,
      colorAtlasMutationAllowed: false,
      automaticLearningAllowed: false,
    },
    decision: {
      status: 'OBSERVED_NOT_GENERALIZED',
      explanation: 'Store the owner-confirmed personal mapping as an observation. Repetition must be measured from later observations rather than assumed.',
    },
    provenance: { capturedAtObservation: true, observedByUser, observedAt: inserted.observed_at, requestSha256 },
  };
  const receiptSha256 = sha256Json(receiptBody);
  const sealedReceipt = { ...receiptBody, integrity: { receiptSha256 } };
  await client.query(
    `INSERT INTO user_graph_observation_receipts (receipt_id,observation_id,user_id,receipt,receipt_sha256)
     VALUES ($1,$2,$3,$4,$5)`,
    [receiptId, observationId, userId, sealedReceipt, receiptSha256]
  );
  return {
    observation: { ...inserted, receipt_id: receiptId, receipt_sha256: receiptSha256 },
    receipt: sealedReceipt,
    idempotent: false,
    disposition: 'PERSONAL_MAPPING_OBSERVATION_AND_RECEIPT_COMMITTED',
  };
}

export function summarizePersonalMappingObservations(rows) {
  const pairCounts = new Map();
  const colorCounts = new Map();
  for (const row of rows) {
    const pairKey = `${row.subject_key}\u0000${row.color_key}`;
    pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
    const current = colorCounts.get(row.color_key) || { color: row.color_label, observationCount: 0, subjects: new Set() };
    current.observationCount += 1;
    current.subjects.add(row.subject_key);
    colorCounts.set(row.color_key, current);
  }
  const pairs = [...pairCounts.entries()].map(([key, observationCount]) => {
    const [subjectKey, colorKey] = key.split('\u0000');
    const row = rows.find(item => item.subject_key === subjectKey && item.color_key === colorKey);
    return { subject: row.subject_label, color: row.color_label, observationCount, repeated: observationCount > 1 };
  }).sort((a, b) => b.observationCount - a.observationCount || a.subject.localeCompare(b.subject));
  const colors = [...colorCounts.values()].map(item => ({ color: item.color, observationCount: item.observationCount, distinctSubjectCount: item.subjects.size }))
    .sort((a, b) => b.observationCount - a.observationCount || a.color.localeCompare(b.color));
  return { observationCount: rows.length, distinctPairCount: pairs.length, repeatedPairCount: pairs.filter(item => item.repeated).length, pairs, colors };
}

function requiredText(value, message, maxLength) {
  const text = String(value || '').normalize('NFC').trim();
  if (!text) throw httpError(400, message);
  if ([...text].length > maxLength) throw httpError(413, `${message.replace(/\.$/, '')} and must be ${maxLength} Unicode code points or fewer.`);
  return text;
}

function plainObject(value, field) {
  if (value == null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, `${field} must be an object.`);
  return value;
}

function validDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw httpError(400, 'observedAt must be a valid date-time.');
  return date.toISOString();
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
