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

export function comparePersonalMappingPatterns(rows, { minimumObservations = 2, minimumDistinctEvidence = 2 } = {}) {
  const observationThreshold = boundedThreshold(minimumObservations, 'minimumObservations');
  const evidenceThreshold = boundedThreshold(minimumDistinctEvidence, 'minimumDistinctEvidence');
  const groups = new Map();
  for (const row of rows) {
    const pairKey = `${row.subject_key}\u0000${row.color_key}`;
    const current = groups.get(pairKey) || {
      subject: row.subject_label,
      color: row.color_label,
      relationshipType: row.relationship_type,
      observations: [],
      receiptIds: new Set(),
      evidenceFingerprints: new Set(),
    };
    current.observations.push(row);
    if (row.receipt_id) current.receiptIds.add(row.receipt_id);
    current.evidenceFingerprints.add(sha256Json({
      exactStatement: row.exact_statement,
      sourceName: row.source_name,
      evidence: row.evidence || {},
    }));
    groups.set(pairKey, current);
  }

  const pairs = [...groups.values()].map(group => {
    const observationCount = group.observations.length;
    const distinctReceiptCount = group.receiptIds.size;
    const distinctEvidenceCount = group.evidenceFingerprints.size;
    const stablePersonalPattern = observationCount >= observationThreshold
      && distinctReceiptCount >= observationThreshold
      && distinctEvidenceCount >= evidenceThreshold;
    const observedTimes = group.observations.map(row => new Date(row.observed_at).valueOf()).filter(Number.isFinite).sort((a, b) => a - b);
    return {
      subject: group.subject,
      color: group.color,
      relationshipType: group.relationshipType,
      observationCount,
      distinctReceiptCount,
      distinctEvidenceCount,
      firstObservedAt: observedTimes.length ? new Date(observedTimes[0]).toISOString() : null,
      lastObservedAt: observedTimes.length ? new Date(observedTimes.at(-1)).toISOString() : null,
      stablePersonalPattern,
      status: stablePersonalPattern ? 'STABLE_PERSONAL_PATTERN' : observationCount > 1 ? 'REPETITION_NOT_INDEPENDENT' : 'FIRST_OCCURRENCE',
    };
  }).sort((a, b) => Number(b.stablePersonalPattern) - Number(a.stablePersonalPattern)
    || b.observationCount - a.observationCount || a.subject.localeCompare(b.subject));
  const recurrence = summarizePersonalMappingObservations(rows);
  return {
    policy: {
      minimumObservations: observationThreshold,
      minimumDistinctReceipts: observationThreshold,
      minimumDistinctEvidence: evidenceThreshold,
      unit: 'exact normalized subject-color pair',
      evidenceFingerprint: 'SHA-256 of exact statement, source name, and evidence object',
    },
    observationCount: rows.length,
    pairCount: pairs.length,
    stablePersonalPatternCount: pairs.filter(item => item.stablePersonalPattern).length,
    firstOccurrenceCount: pairs.filter(item => item.status === 'FIRST_OCCURRENCE').length,
    nonIndependentRepetitionCount: pairs.filter(item => item.status === 'REPETITION_NOT_INDEPENDENT').length,
    patterns: pairs.filter(item => item.stablePersonalPattern),
    pairs,
    colorRecurrence: recurrence.colors,
  };
}

export function buildPersonalPatternInquiries(rows, { minimumStablePatternsPerColor = 2 } = {}) {
  const colorThreshold = boundedThreshold(minimumStablePatternsPerColor, 'minimumStablePatternsPerColor');
  const comparison = comparePersonalMappingPatterns(rows);
  const groups = new Map();
  for (const pair of comparison.patterns) {
    const colorKey = normalizePersonalGraphKey(pair.color);
    const current = groups.get(colorKey) || { color: pair.color, colorKey, pairs: [] };
    current.pairs.push(pair);
    groups.set(colorKey, current);
  }

  const inquiries = [...groups.values()]
    .filter(group => group.pairs.length >= colorThreshold)
    .map(group => {
      const pairs = [...group.pairs].sort((a, b) => a.subject.localeCompare(b.subject));
      const subjects = pairs.map(pair => pair.subject);
      const subjectList = naturalList(subjects);
      return {
        inquiryId: `CBPI-${sha256Json({ colorKey: group.colorKey, subjects: subjects.map(normalizePersonalGraphKey) }).slice(0, 16).toUpperCase()}`,
        color: group.color,
        subjects,
        stablePairCount: pairs.length,
        evidence: pairs.map(pair => ({
          subject: pair.subject,
          color: pair.color,
          observationCount: pair.observationCount,
          distinctReceiptCount: pair.distinctReceiptCount,
          distinctEvidenceCount: pair.distinctEvidenceCount,
          status: pair.status,
        })),
        status: 'OWNER_INTERPRETATION_REQUESTED',
        question: `${group.color} has stable personal associations with ${subjectList}. What relationship, if any, connects these words for you?`,
        counterexamplePrompt: `What ${group.color}-associated word would not fit that relationship?`,
        proposedMeaning: null,
      };
    })
    .sort((a, b) => a.color.localeCompare(b.color));

  return {
    policy: {
      minimumStablePatternsPerColor: colorThreshold,
      inputUnit: 'stable exact normalized subject-color pair',
      outputMode: 'owner relation and counterexample inquiry',
      automaticMeaningAssignmentAllowed: false,
    },
    stablePersonalPatternCount: comparison.stablePersonalPatternCount,
    inquiryCount: inquiries.length,
    inquiries,
  };
}

export function buildSourceAnchoredRelationalSearch(assertions) {
  if (!Array.isArray(assertions) || assertions.length === 0) throw httpError(400, 'assertions must be a non-empty array.');
  if (assertions.length > 100) throw httpError(413, 'assertions must contain 100 items or fewer.');

  const distinctAssertions = new Map();
  const termLabels = new Map();
  assertions.forEach((value, index) => {
    const assertion = plainObject(value, `assertions[${index}]`);
    const source = requiredText(assertion.source, `assertions[${index}].source is required.`, 200);
    const relation = requiredText(assertion.relation, `assertions[${index}].relation is required.`, 100);
    const target = requiredText(assertion.target, `assertions[${index}].target is required.`, 200);
    const exactStatement = requiredText(assertion.exactStatement, `assertions[${index}].exactStatement is required.`, 4_000);
    const sourceKey = normalizePersonalGraphKey(source);
    const relationKey = normalizePersonalGraphKey(relation);
    const targetKey = normalizePersonalGraphKey(target);
    if (sourceKey === targetKey) throw httpError(400, `assertions[${index}] must connect two different terms.`);
    termLabels.set(sourceKey, termLabels.get(sourceKey) || source);
    termLabels.set(targetKey, termLabels.get(targetKey) || target);
    const key = `${sourceKey}\u0000${relationKey}\u0000${targetKey}`;
    const current = distinctAssertions.get(key) || {
      source, sourceKey, relation, relationKey, target, targetKey, exactStatements: new Set(), occurrenceCount: 0,
    };
    current.exactStatements.add(exactStatement);
    current.occurrenceCount += 1;
    distinctAssertions.set(key, current);
  });

  const edges = [...distinctAssertions.values()].map(edge => ({
    assertionId: `CBSRA-${sha256Json({ sourceKey: edge.sourceKey, relationKey: edge.relationKey, targetKey: edge.targetKey }).slice(0, 16).toUpperCase()}`,
    source: edge.source,
    sourceKey: edge.sourceKey,
    relation: edge.relation,
    relationKey: edge.relationKey,
    target: edge.target,
    targetKey: edge.targetKey,
    exactStatements: [...edge.exactStatements],
    occurrenceCount: edge.occurrenceCount,
  })).sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.relationKey.localeCompare(b.relationKey) || a.targetKey.localeCompare(b.targetKey));

  const adjacency = new Map();
  for (const edge of edges) {
    addNeighbor(adjacency, edge.sourceKey, edge.targetKey);
    addNeighbor(adjacency, edge.targetKey, edge.sourceKey);
  }
  const components = connectedComponents(adjacency);
  const networks = [];
  const seedAssertions = [];
  for (const component of components) {
    const componentKeys = new Set(component);
    const componentEdges = edges.filter(edge => componentKeys.has(edge.sourceKey) && componentKeys.has(edge.targetKey));
    const anchorKeys = component.filter(key => (adjacency.get(key)?.size || 0) >= 2);
    if (component.length < 3 || componentEdges.length < 2 || anchorKeys.length === 0) {
      seedAssertions.push(...componentEdges);
      continue;
    }

    const directPairs = new Set();
    for (const edge of componentEdges) {
      directPairs.add(undirectedPairKey(edge.sourceKey, edge.targetKey));
    }
    const lateralSearches = [];
    let truncated = false;
    for (const anchorKey of anchorKeys.sort()) {
      const neighborKeys = [...adjacency.get(anchorKey)].sort();
      for (let left = 0; left < neighborKeys.length; left += 1) {
        for (let right = left + 1; right < neighborKeys.length; right += 1) {
          if (directPairs.has(undirectedPairKey(neighborKeys[left], neighborKeys[right]))) continue;
          if (lateralSearches.length >= 200) {
            truncated = true;
            break;
          }
          const terms = [termLabels.get(anchorKey), termLabels.get(neighborKeys[left]), termLabels.get(neighborKeys[right])];
          lateralSearches.push({
            anchor: terms[0],
            left: terms[1],
            right: terms[2],
            terms,
            query: terms.join(' '),
            relationship: null,
            status: 'CANDIDATE_SEARCH_ONLY',
          });
        }
        if (truncated) break;
      }
      if (truncated) break;
    }
    const normalizedNetwork = componentEdges.map(edge => ({ sourceKey: edge.sourceKey, relationKey: edge.relationKey, targetKey: edge.targetKey }));
    networks.push({
      networkId: `CBSRN-${sha256Json(normalizedNetwork).slice(0, 16).toUpperCase()}`,
      status: 'SOURCE_ANCHORED_SEARCH_PACKET',
      terms: component.map(key => termLabels.get(key)),
      anchorTerms: anchorKeys.map(key => termLabels.get(key)),
      assertions: componentEdges,
      lateralSearches,
      lateralSearchCount: lateralSearches.length,
      lateralSearchesTruncated: truncated,
      proposedMeaning: null,
    });
  }

  networks.sort((a, b) => a.networkId.localeCompare(b.networkId));
  return {
    policy: {
      inputUnit: 'owner-supplied typed relation assertion',
      groupingRule: 'connected terms joined only by supplied typed relations',
      searchRule: 'an anchor plus two unconnected neighbors may become a candidate search query',
      relationLabelsPreserved: true,
      externalSearchPerformed: false,
      synonymInferenceAllowed: false,
      automaticMeaningAssignmentAllowed: false,
      graphMutationAllowed: false,
    },
    assertionCount: assertions.length,
    distinctAssertionCount: edges.length,
    networkCount: networks.length,
    networks,
    seedAssertionCount: seedAssertions.length,
    seedAssertions,
  };
}

export function buildInsideOutPersonalPaths(assertions) {
  const sourceSearch = buildSourceAnchoredRelationalSearch(assertions);
  const paths = [];

  for (const network of sourceSearch.networks) {
    for (const candidate of network.lateralSearches) {
      const anchorKey = normalizePersonalGraphKey(candidate.anchor);
      const leftKey = normalizePersonalGraphKey(candidate.left);
      const rightKey = normalizePersonalGraphKey(candidate.right);
      const leftEdges = network.assertions.filter(edge => edgeTouches(edge, leftKey, anchorKey));
      const rightEdges = network.assertions.filter(edge => edgeTouches(edge, anchorKey, rightKey));

      for (const leftEdge of leftEdges) {
        for (const rightEdge of rightEdges) {
          const steps = [
            traversalStep(leftEdge, leftKey, anchorKey, candidate.left, candidate.anchor),
            traversalStep(rightEdge, anchorKey, rightKey, candidate.anchor, candidate.right),
          ];
          const signature = {
            networkId: network.networkId,
            startKey: leftKey,
            viaKey: anchorKey,
            endKey: rightKey,
            steps: steps.map(step => ({ relationKey: step.relationKey, traversal: step.traversal })),
          };
          const terms = [candidate.left, candidate.anchor, candidate.right];
          paths.push({
            personalPathId: `CBIPP-${sha256Json(signature).slice(0, 16).toUpperCase()}`,
            networkId: network.networkId,
            start: candidate.left,
            via: candidate.anchor,
            end: candidate.right,
            terms,
            pathExpression: steps.map((step, index) => `${index ? '' : `${step.from} `}--${step.traversal}(${step.relation})--> ${step.to}`).join(' '),
            steps,
            relationship: {
              type: 'existing_indirect_typed_path',
              via: candidate.anchor,
              stepCount: steps.length,
              direct: false,
            },
            personalPathExists: true,
            directRelationshipCreated: false,
            status: 'EXISTING_PERSONAL_PATH',
            exteriorComparison: {
              status: 'READY_FOR_EXTERIOR_COMPARISON',
              direction: 'inside_out',
              terms,
              query: terms.join(' '),
            },
          });
        }
      }
    }
  }

  paths.sort((a, b) => a.personalPathId.localeCompare(b.personalPathId));
  return {
    policy: {
      inputUnit: 'owner-supplied typed relation assertion',
      personalAuthority: 'owner-supplied typed relations are accepted as existing personal facts',
      traversalRule: 'ARI may follow supplied edges forward or backward while preserving their original direction and relation label',
      searchDirection: 'inside_out',
      exteriorEvidenceRole: 'compare how far an existing personal path travels outside the profile; do not authorize the personal path',
      relationLabelsPreserved: true,
      reverseTraversalAllowed: true,
      directEdgeInferenceAllowed: false,
      synonymInferenceAllowed: false,
      automaticMeaningAssignmentAllowed: false,
      graphMutationAllowed: false,
    },
    assertionCount: sourceSearch.assertionCount,
    distinctAssertionCount: sourceSearch.distinctAssertionCount,
    networkCount: sourceSearch.networkCount,
    pathCount: paths.length,
    paths,
    seedAssertionCount: sourceSearch.seedAssertionCount,
    seedAssertions: sourceSearch.seedAssertions,
  };
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

function boundedThreshold(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 2 || number > 100) throw httpError(400, `${field} must be an integer from 2 through 100.`);
  return number;
}

function addNeighbor(adjacency, source, target) {
  const neighbors = adjacency.get(source) || new Set();
  neighbors.add(target);
  adjacency.set(source, neighbors);
}

function connectedComponents(adjacency) {
  const components = [];
  const visited = new Set();
  for (const start of [...adjacency.keys()].sort()) {
    if (visited.has(start)) continue;
    const pending = [start];
    const component = [];
    visited.add(start);
    while (pending.length) {
      const current = pending.shift();
      component.push(current);
      for (const neighbor of [...(adjacency.get(current) || [])].sort()) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        pending.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

function undirectedPairKey(left, right) {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

function edgeTouches(edge, leftKey, rightKey) {
  return (edge.sourceKey === leftKey && edge.targetKey === rightKey)
    || (edge.sourceKey === rightKey && edge.targetKey === leftKey);
}

function traversalStep(edge, fromKey, toKey, from, to) {
  const traversal = edge.sourceKey === fromKey && edge.targetKey === toKey ? 'forward' : 'reverse';
  return {
    from,
    to,
    relation: edge.relation,
    relationKey: edge.relationKey,
    traversal,
    suppliedAssertionId: edge.assertionId,
    originalDirection: { source: edge.source, relation: edge.relation, target: edge.target },
  };
}

function naturalList(values) {
  if (values.length < 2) return values[0] || '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
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
