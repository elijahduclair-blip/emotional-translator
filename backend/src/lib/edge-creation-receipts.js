import crypto from 'node:crypto';

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalize(value[key])])
  );
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function evidenceSha256(receipt) {
  const core = {
    receiptVersion: receipt.receiptVersion,
    receiptClass: receipt.receiptClass,
    creationContext: receipt.creationContext,
    edge: receipt.edge,
    source: receipt.source,
    endpointEvidence: receipt.endpointEvidence,
    relation: receipt.relation,
    decision: {
      status: receipt.decision?.status,
      ruleId: receipt.decision?.ruleId,
      explanation: receipt.decision?.explanation
    },
    provenance: receipt.provenance,
    requestedAction: receipt.requestedAction
  };
  return sha256(Buffer.from(canonicalJson(core), 'utf8'));
}

function legacyEvidenceSha256(receipt) {
  const core = {
    receiptVersion: receipt.receiptVersion,
    receiptClass: receipt.receiptClass,
    creationContext: receipt.creationContext,
    edge: receipt.edge,
    source: receipt.source,
    endpointEvidence: receipt.endpointEvidence,
    relation: receipt.relation,
    decision: {
      status: receipt.decision?.status,
      ruleId: receipt.decision?.ruleId,
      explanation: receipt.decision?.explanation
    },
    provenance: receipt.provenance,
    requestedAction: receipt.requestedAction
  };
  return sha256(Buffer.from(JSON.stringify(core), 'utf8'));
}

export function receiptSha256(receipt) {
  const hashable = structuredClone(receipt);
  if (!hashable.integrity) hashable.integrity = {};
  delete hashable.integrity.receiptSha256;
  return sha256(Buffer.from(canonicalJson(hashable), 'utf8'));
}

function legacyReceiptSha256(receipt) {
  const hashable = structuredClone(receipt);
  if (!hashable.integrity) hashable.integrity = {};
  delete hashable.integrity.receiptSha256;
  return sha256(Buffer.from(JSON.stringify(hashable), 'utf8'));
}

export function sealCreationReceipt(receipt) {
  const sealed = structuredClone(receipt);
  sealed.decision.evidenceSha256 = evidenceSha256(sealed);
  sealed.integrity = { receiptSha256: null };
  sealed.integrity.receiptSha256 = receiptSha256(sealed);
  return sealed;
}

function hasLocator(item) {
  const locator = item?.locator ?? item;
  return Boolean(locator?.file && Number.isInteger(locator?.line) && locator.line > 0 && locator?.lineSha256);
}

export function validateCreationReceipt(receipt) {
  const errors = [];
  const decision = receipt?.decision?.status;
  const decisive = decision === 'VERIFY' || decision === 'REJECT';
  const selectedPath = receipt?.relation?.selectedPath;
  const wordSenses = receipt?.endpointEvidence?.wordSenseKeys ?? [];
  const baseSenses = receipt?.endpointEvidence?.baseSenseKeys ?? [];
  const transitions = selectedPath?.transitionLocators ?? [];
  const frozenFiles = receipt?.source?.frozenFiles ?? [];

  if (receipt?.receiptVersion !== 'chromabridge-edge-receipt.v2') errors.push('receipt version is not v2');
  if (receipt?.receiptClass !== 'CREATION') errors.push('receipt class is not CREATION');
  if (!receipt?.receiptId || !receipt?.edge?.edgeId) errors.push('receipt or edge identity is missing');
  if (!receipt?.creationContext?.requestId || !receipt?.creationContext?.idempotencyKey || !receipt?.creationContext?.createdAt || !receipt?.creationContext?.actorId || !receipt?.creationContext?.profileScope) errors.push('creation context is incomplete');
  if (!receipt?.source?.system || !receipt?.source?.version) errors.push('source identity or version is missing');
  if (!frozenFiles.length || frozenFiles.some(file => !file?.file || !file?.sha256 || !Number.isInteger(file?.bytes))) errors.push('frozen source file identity is incomplete');
  if (!wordSenses.length || !baseSenses.length) errors.push('exact endpoint senses are missing');
  if (wordSenses.some(item => !item?.senseKey || !item?.synsetId || !hasLocator(item)) || baseSenses.some(item => !item?.senseKey || !item?.synsetId || !hasLocator(item))) errors.push('endpoint sense locator is incomplete');
  if (!['VERIFY', 'REJECT', 'UNRESOLVED'].includes(decision)) errors.push('decision state is invalid');
  if (!receipt?.decision?.ruleId || !receipt?.decision?.evidenceSha256) errors.push('decision rule or evidence hash is missing');
  if (decisive && (!selectedPath || !transitions.length)) errors.push('decisive outcome lacks a selected path');
  if (decisive && transitions.some(item => !hasLocator(item) || !item?.pointerSymbol || !item?.pointerDirection || !item?.pointerTarget || !item?.synsetId)) errors.push('decisive path locator is incomplete');
  if (decision === 'VERIFY' && receipt?.relation?.pathDisposition !== 'SUPPORTS') errors.push('VERIFY path is not marked SUPPORTS');
  if (decision === 'REJECT' && receipt?.relation?.pathDisposition !== 'CONTRADICTS') errors.push('REJECT path is not marked CONTRADICTS');
  if (decision === 'UNRESOLVED' && (selectedPath !== null || !(receipt?.provenance?.gaps ?? []).length)) errors.push('UNRESOLVED outcome does not preserve a gap');
  const expectedAction = decision === 'VERIFY' ? 'COMMIT_EDGE' : 'RECEIPT_ONLY';
  if (receipt?.requestedAction !== expectedAction) errors.push('requested action does not match decision state');
  if (receipt?.decision?.evidenceSha256
      && receipt.decision.evidenceSha256 !== evidenceSha256(receipt)
      && receipt.decision.evidenceSha256 !== legacyEvidenceSha256(receipt)) errors.push('decision evidence hash mismatch');
  if (!receipt?.integrity?.receiptSha256
      || (receipt.integrity.receiptSha256 !== receiptSha256(receipt)
        && receipt.integrity.receiptSha256 !== legacyReceiptSha256(receipt))) errors.push('receipt hash mismatch');
  return { valid: errors.length === 0, errors };
}

export function validateCreationReceiptForEdge(receipt, edge) {
  const errors = [...validateCreationReceipt(receipt).errors];
  if (receipt?.edge?.edgeId !== edge?.id) errors.push('receipt edge identity does not match the proposed relationship');
  if (receipt?.edge?.wordNode?.recordId !== edge?.source) errors.push('receipt source endpoint does not match the proposed relationship');
  if (receipt?.edge?.baseNode?.recordId !== edge?.target) errors.push('receipt target endpoint does not match the proposed relationship');
  return { valid: errors.length === 0, errors };
}

export function creationRequestSha256(proposalId, receipt) {
  return sha256(Buffer.from(JSON.stringify({
    proposalId,
    idempotencyKey: receipt?.creationContext?.idempotencyKey,
    receiptSha256: receipt?.integrity?.receiptSha256
  }), 'utf8'));
}

export async function findPersistedCreation(client, proposalId) {
  const result = await client.query(
    'SELECT * FROM edge_creation_receipts WHERE proposal_id=$1 ORDER BY created_at DESC LIMIT 1',
    [proposalId]
  );
  if (!result.rows.length) return null;
  const stored = result.rows[0];
  const edgeResult = stored.edge_id
    ? await client.query('SELECT * FROM edges WHERE id=$1', [stored.edge_id])
    : { rows: [] };
  return {
    disposition: stored.outcome,
    receipt: stored,
    relationship: edgeResult.rows[0] ?? null,
    idempotent: true,
    proposalStatus: stored.decision === 'VERIFY' ? 'approved' : stored.decision.toLowerCase()
  };
}

export async function persistEdgeCreation(client, { proposal, edge, author, injectFailure = null }) {
  const receipt = proposal?.payload?.creationReceipt;
  const validation = validateCreationReceiptForEdge(receipt, edge);
  if (!validation.valid) throw httpError(400, `Invalid edge creation receipt: ${validation.errors.join('; ')}`);
  if (receipt.creationContext.actorId !== proposal.author) {
    throw httpError(400, 'Receipt actor does not match the proposal author.');
  }

  const idempotencyKey = receipt.creationContext.idempotencyKey;
  const requestHash = creationRequestSha256(proposal.id, receipt);
  if (injectFailure === 'receipt-store') throw new Error('injected receipt store failure');

  const outcome = receipt.decision.status === 'VERIFY'
    ? 'EDGE_AND_RECEIPT_COMMITTED'
    : 'RECEIPT_ONLY_COMMITTED';
  let stored;
  try {
    const inserted = await client.query(
      `INSERT INTO edge_creation_receipts
       (receipt_id,proposal_id,edge_id,decision,requested_action,idempotency_key,request_sha256,receipt_sha256,receipt,outcome,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [
        receipt.receiptId,
        proposal.id,
        receipt.decision.status === 'VERIFY' ? edge.id : null,
        receipt.decision.status,
        receipt.requestedAction,
        idempotencyKey,
        requestHash,
        receipt.integrity.receiptSha256,
        receipt,
        outcome,
        author
      ]
    );
    stored = inserted.rows[0];
  } catch (error) {
    if (error?.code === '23505') throw httpError(409, 'Receipt identity already exists.');
    throw error;
  }

  if (!stored) {
    const priorResult = await client.query(
      'SELECT * FROM edge_creation_receipts WHERE idempotency_key=$1 FOR UPDATE',
      [idempotencyKey]
    );
    const prior = priorResult.rows[0];
    if (prior?.request_sha256 !== requestHash) {
      throw httpError(409, 'Idempotency key was reused for a different edge-creation request.');
    }
    const edgeResult = prior.edge_id
      ? await client.query('SELECT * FROM edges WHERE id=$1', [prior.edge_id])
      : { rows: [] };
    return {
      disposition: 'IDEMPOTENT_REPLAY',
      receipt: prior,
      relationship: edgeResult.rows[0] ?? null,
      idempotent: true,
      proposalStatus: prior.decision === 'VERIFY' ? 'approved' : prior.decision.toLowerCase()
    };
  }

  if (receipt.decision.status !== 'VERIFY') {
    return {
      disposition: outcome,
      receipt: stored,
      relationship: null,
      idempotent: false,
      proposalStatus: receipt.decision.status.toLowerCase()
    };
  }

  const endpoints = await client.query(
    "SELECT id FROM nodes WHERE id IN ($1,$2) AND record_status='active'",
    [edge.source, edge.target]
  );
  if (endpoints.rows.length !== 2) throw httpError(400, 'Both relationship endpoints must exist and be active.');
  if (injectFailure === 'edge-store') throw new Error('injected edge store failure');

  const evidenceData = {
    ...edge.evidenceData,
    creationReceiptId: receipt.receiptId,
    creationReceiptSha256: receipt.integrity.receiptSha256
  };
  let relationship;
  try {
    const edgeResult = await client.query(
      `INSERT INTO edges (id,source,target,type,evidence,confidence,evidence_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [edge.id, edge.source, edge.target, edge.type, edge.evidence, edge.confidence, evidenceData]
    );
    relationship = edgeResult.rows[0];
  } catch (error) {
    if (error?.code === '23505') throw httpError(409, `Relationship id already exists: ${edge.id}`);
    throw error;
  }

  await client.query(
    `INSERT INTO graph_history (id,entity_type,entity_id,action,before_data,after_data,author,reason,proposal_id)
     VALUES ($1,'edge',$2,'create',NULL,$3,$4,$5,$6)`,
    [crypto.randomUUID(), edge.id, relationship, author, proposal.rationale, proposal.id]
  );
  return {
    disposition: outcome,
    receipt: stored,
    relationship,
    idempotent: false,
    proposalStatus: 'approved'
  };
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}


