import crypto from 'node:crypto';
import express from 'express';
import { pool, query } from '../db/pool.js';
import { requireAdmin, requireAuth, requirePasswordCurrent } from '../middleware/auth.js';
import { buildReviewedFeedbackDataset, normalizeLocalAiFeedback, verifyFeedbackReceipt } from '../lib/local-ai-feedback.js';

const router = express.Router();

router.post('/local-ai/feedback', requireAuth, requirePasswordCurrent, async (req, res, next) => {
  try {
    const feedback = normalizeLocalAiFeedback(req.body);
    verifyFeedbackReceipt(feedback, process.env.RUNTIME_SERVICE_TOKEN || '');
    const result = await query(
      `INSERT INTO local_ai_feedback
        (id,interaction_id,user_id,decision,input,canonical_english,model_name,model_response,correction,
         graph_source,learned_alignment_status,contract_verified,relational_evidence,response_sha256,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'proposed')
       ON CONFLICT (user_id,interaction_id) DO NOTHING
       RETURNING id,interaction_id,decision,status,created_at`,
      [
        crypto.randomUUID(), feedback.interactionId, req.user.sub, feedback.decision, feedback.input,
        feedback.canonicalEnglish, feedback.modelName, feedback.modelResponse, feedback.correction,
        feedback.graphSource, feedback.learnedAlignmentStatus, feedback.contractVerified,
        JSON.stringify(feedback.relationalEvidence), crypto.createHash('sha256').update(feedback.modelResponse).digest('hex')
      ]
    );
    if (!result.rows.length) throw httpError(409, 'Feedback for this interaction has already been submitted.');
    res.status(201).json({
      feedback: formatFeedback(result.rows[0]),
      boundary: feedbackBoundary('Feedback is proposed for review. No training or model activation occurred.')
    });
  } catch (error) { next(error); }
});

router.get('/local-ai/feedback', requireAuth, requirePasswordCurrent, async (req, res, next) => {
  try {
    const result = req.user.role === 'admin'
      ? await query(`SELECT * FROM local_ai_feedback ORDER BY created_at DESC LIMIT 100`)
      : await query(`SELECT * FROM local_ai_feedback WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, [req.user.sub]);
    res.json({ feedback: result.rows.map(formatFeedback), count: result.rows.length, boundary: feedbackBoundary('Feedback records are review candidates, not active model knowledge.') });
  } catch (error) { next(error); }
});

router.patch('/local-ai/feedback/:id/review', requireAuth, requireAdmin, async (req, res, next) => {
  let client;
  try {
    const decision = String(req.body?.decision || '');
    if (!['accepted', 'rejected'].includes(decision)) throw httpError(400, 'decision must be accepted or rejected.');
    const reviewNote = requiredText(req.body?.reviewNote, 'reviewNote is required.', 1_000);
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE local_ai_feedback SET status=$2,reviewer=$3,review_note=$4,reviewed_at=NOW(),updated_at=NOW()
       WHERE id=$1 AND status='proposed' RETURNING *`,
      [req.params.id, decision, req.user.sub, reviewNote]
    );
    if (!result.rows.length) throw httpError(409, 'Feedback is missing or has already been reviewed.');
    let learningCandidate = null;
    if (decision === 'accepted') {
      const candidate = await client.query(
        `INSERT INTO local_ai_learning_candidates
          (id,feedback_id,user_id,lane,proposal,status)
         VALUES ($1,$2,$3,'model_retraining',$4,'proposed')
         ON CONFLICT (feedback_id,lane) DO UPDATE SET proposal=EXCLUDED.proposal
         RETURNING *`,
        [crypto.randomUUID(), result.rows[0].id, result.rows[0].user_id, JSON.stringify({ source: 'reviewed_conversation_feedback' })]
      );
      learningCandidate = formatLearningCandidate(candidate.rows[0]);
    }
    await client.query('COMMIT');
    res.json({
      feedback: formatFeedback(result.rows[0]),
      learningCandidate,
      boundary: feedbackBoundary(decision === 'accepted'
        ? 'The feedback was accepted and a separate retraining candidate was proposed. Neither model weights nor graph records changed.'
        : 'The feedback was rejected. No learning candidate was applied.')
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { client?.release(); }
});

router.post('/local-ai/feedback/:id/learning-candidates', requireAuth, requirePasswordCurrent, async (req, res, next) => {
  try {
    const feedback = (await query(`SELECT * FROM local_ai_feedback WHERE id=$1`, [req.params.id])).rows[0];
    if (!feedback) throw httpError(404, 'Feedback record not found.');
    if (req.user.role !== 'admin' && feedback.user_id !== req.user.sub) throw httpError(403, 'You can only propose learning from your own feedback.');
    if (feedback.status !== 'accepted') throw httpError(409, 'Feedback must be accepted before a learning candidate can be proposed.');
    const lane = String(req.body?.lane || '');
    if (!['user_graph', 'model_retraining'].includes(lane)) throw httpError(400, 'lane must be user_graph or model_retraining.');
    const proposal = lane === 'user_graph'
      ? normalizeUserGraphProposal(req.body?.proposal)
      : { source: 'reviewed_conversation_feedback' };
    const result = await query(
      `INSERT INTO local_ai_learning_candidates (id,feedback_id,user_id,lane,proposal,status)
       VALUES ($1,$2,$3,$4,$5,'proposed')
       ON CONFLICT (feedback_id,lane) DO NOTHING
       RETURNING *`,
      [crypto.randomUUID(), feedback.id, feedback.user_id, lane, JSON.stringify(proposal)]
    );
    if (!result.rows.length) throw httpError(409, `A ${lane} candidate already exists for this feedback.`);
    res.status(201).json({
      candidate: formatLearningCandidate(result.rows[0]),
      boundary: learningBoundary('The candidate is awaiting separate administrator review. No graph or model state changed.')
    });
  } catch (error) { next(error); }
});

router.get('/local-ai/learning-candidates', requireAuth, requirePasswordCurrent, async (req, res, next) => {
  try {
    const result = req.user.role === 'admin'
      ? await query(`SELECT * FROM local_ai_learning_candidates ORDER BY created_at DESC LIMIT 200`)
      : await query(`SELECT * FROM local_ai_learning_candidates WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200`, [req.user.sub]);
    res.json({
      candidates: result.rows.map(formatLearningCandidate),
      count: result.rows.length,
      boundary: learningBoundary('This queue separates personal graph proposals from future model-training examples.')
    });
  } catch (error) { next(error); }
});

router.patch('/local-ai/learning-candidates/:id/review', requireAuth, requireAdmin, async (req, res, next) => {
  let client;
  try {
    const decision = String(req.body?.decision || '');
    if (!['approved', 'rejected'].includes(decision)) throw httpError(400, 'decision must be approved or rejected.');
    const reviewNote = requiredText(req.body?.reviewNote, 'reviewNote is required.', 1_000);
    client = await pool.connect();
    await client.query('BEGIN');
    const current = (await client.query(
      `SELECT * FROM local_ai_learning_candidates WHERE id=$1 AND status='proposed' FOR UPDATE`,
      [req.params.id]
    )).rows[0];
    if (!current) throw httpError(409, 'Learning candidate is missing or has already been reviewed.');

    let relationship = null;
    if (decision === 'approved' && current.lane === 'user_graph') {
      const proposal = normalizeUserGraphProposal(current.proposal);
      const inserted = await client.query(
        `INSERT INTO user_graph_relationships
          (id,user_id,source_label,source_key,target_label,target_key,relationship_type,confidence,evidence,counterexample,
           source_feedback_id,learning_candidate_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [crypto.randomUUID(), current.user_id, proposal.source, normalizeGraphKey(proposal.source), proposal.target,
          normalizeGraphKey(proposal.target), proposal.relationshipType, proposal.confidence, proposal.evidence,
          proposal.counterexample, current.feedback_id, current.id]
      );
      relationship = formatUserGraphRelationship(inserted.rows[0]);
    }

    const updated = await client.query(
      `UPDATE local_ai_learning_candidates SET status=$2,reviewer=$3,review_note=$4,reviewed_at=NOW(),
         applied_at=CASE WHEN $2='approved' THEN NOW() ELSE NULL END
       WHERE id=$1 RETURNING *`,
      [current.id, decision, req.user.sub, reviewNote]
    );
    await client.query('COMMIT');
    res.json({
      candidate: formatLearningCandidate(updated.rows[0]),
      relationship,
      boundary: learningBoundary(decision === 'approved' && current.lane === 'user_graph'
        ? 'The approved relationship was added only to this user personal overlay. The shared graph and Color Atlas were not changed.'
        : decision === 'approved'
          ? 'The reviewed example is eligible for a future adapter version. No training or activation occurred.'
          : 'The candidate was rejected and no learning state changed.')
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { client?.release(); }
});

router.get('/local-ai/user-graph', requireAuth, requirePasswordCurrent, async (req, res, next) => {
  try {
    const text = String(req.query?.text || '');
    const terms = graphTerms(text);
    const result = terms.length
      ? await query(
        `SELECT * FROM user_graph_relationships
         WHERE user_id=$1 AND record_status='active' AND (source_key=ANY($2::text[]) OR target_key=ANY($2::text[]))
         ORDER BY source_key,target_key,relationship_type,id LIMIT 24`,
        [req.user.sub, terms]
      )
      : await query(
        `SELECT * FROM user_graph_relationships WHERE user_id=$1 AND record_status='active'
         ORDER BY created_at DESC,id LIMIT 100`,
        [req.user.sub]
      );
    res.json({
      sourceLayer: 'user_graph',
      consulted: true,
      relationships: result.rows.map(formatUserGraphRelationship),
      relationshipCount: result.rows.length,
      truncated: result.rows.length === (terms.length ? 24 : 100),
      boundary: learningBoundary('This is a user-specific adaptive overlay. It does not replace approved graph truth or fixed Color Atlas coordinates.')
    });
  } catch (error) { next(error); }
});

router.get('/local-ai/training/candidates', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await approvedTrainingFeedback();
    res.json(buildReviewedFeedbackDataset(result.rows));
  } catch (error) { next(error); }
});

router.get('/local-ai/training/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [feedback, learningCandidates, eligibleTraining, active, versions] = await Promise.all([
      query(`SELECT status,COUNT(*)::int AS count FROM local_ai_feedback GROUP BY status`),
      query(`SELECT lane,status,COUNT(*)::int AS count FROM local_ai_learning_candidates GROUP BY lane,status`),
      approvedTrainingFeedback(),
      query(`SELECT * FROM local_ai_adapter_versions WHERE status='active' ORDER BY activated_at DESC LIMIT 1`),
      query(`SELECT COUNT(*)::int AS count FROM local_ai_adapter_versions`)
    ]);
    const counts = Object.fromEntries(feedback.rows.map(row => [row.status, row.count]));
    const candidateCounts = Object.fromEntries(learningCandidates.rows.map(row => [`${row.lane}:${row.status}`, row.count]));
    const accepted = eligibleTraining.rows.length;
    res.json({
      feedback: { proposed: counts.proposed || 0, accepted: counts.accepted || 0, rejected: counts.rejected || 0 },
      learningCandidates: {
        userGraph: {
          proposed: candidateCounts['user_graph:proposed'] || 0,
          approved: candidateCounts['user_graph:approved'] || 0,
          rejected: candidateCounts['user_graph:rejected'] || 0
        },
        modelRetraining: {
          proposed: candidateCounts['model_retraining:proposed'] || 0,
          approved: candidateCounts['model_retraining:approved'] || 0,
          rejected: candidateCounts['model_retraining:rejected'] || 0
        }
      },
      readiness: { minimumAcceptedFeedback: 20, acceptedFeedback: accepted, eligibleTrainingFeedback: accepted, readyToPrepareVersion: accepted >= 20 },
      versionCount: versions.rows[0].count,
      activeVersion: active.rows[0] ? formatAdapterVersion(active.rows[0]) : null,
      boundary: adapterLifecycleBoundary('Status is observational. No training or activation occurred.')
    });
  } catch (error) { next(error); }
});

router.get('/local-ai/training/versions', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await query(`SELECT * FROM local_ai_adapter_versions ORDER BY created_at DESC LIMIT 100`);
    res.json({ versions: result.rows.map(formatAdapterVersion), count: result.rows.length, boundary: adapterLifecycleBoundary('Version records do not grant runtime authority.') });
  } catch (error) { next(error); }
});

router.post('/local-ai/training/versions', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const feedback = await approvedTrainingFeedback();
    const dataset = buildReviewedFeedbackDataset(feedback.rows);
    if (!dataset.readiness.readyToPrepareVersion) {
      throw httpError(422, `At least ${dataset.readiness.minimumFeedback} accepted feedback records with ${dataset.readiness.minimumValidation} held-out records are required; found ${dataset.feedbackCount}.`);
    }
    const id = `lav_${crypto.randomUUID()}`;
    const name = normalizeVersionName(req.body?.name, id);
    const manifest = {
      version: dataset.version,
      targetModel: dataset.targetModel,
      adapterKind: dataset.adapterKind,
      datasetSha256: dataset.sha256,
      feedbackCount: dataset.feedbackCount,
      readiness: dataset.readiness,
      splits: {
        strategy: dataset.splits.strategy,
        training: { recordCount: dataset.splits.training.recordCount, sha256: dataset.splits.training.sha256 },
        validation: { recordCount: dataset.splits.validation.recordCount, sha256: dataset.splits.validation.sha256 }
      },
      boundary: dataset.boundary
    };
    const result = await query(
      `INSERT INTO local_ai_adapter_versions
        (id,name,dataset_sha256,dataset_record_count,training_feedback_ids,dataset_manifest,status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'prepared',$7) RETURNING *`,
      [id, name, dataset.sha256, dataset.recordCount, feedback.rows.map(row => row.id), JSON.stringify(manifest), req.user.sub]
    );
    res.status(201).json({
      version: formatAdapterVersion(result.rows[0]),
      package: { manifest, trainingJsonl: dataset.splits.training.jsonl, validationJsonl: dataset.splits.validation.jsonl },
      boundary: adapterLifecycleBoundary('A deterministic package was prepared. Training has not started.')
    });
  } catch (error) { next(error); }
});

router.post('/local-ai/training/versions/:id/report', requireRuntimeService, async (req, res, next) => {
  try {
    const phase = String(req.body?.phase || '');
    const current = (await query(`SELECT * FROM local_ai_adapter_versions WHERE id=$1`, [req.params.id])).rows[0];
    if (!current) throw httpError(404, 'Adapter version not found.');

    if (phase === 'training') {
      const report = requiredObject(req.body?.report, 'report is required.');
      if (current.status !== 'prepared' && current.status !== 'training') throw httpError(409, 'Only a prepared version can receive a training report.');
      if (report.boundary?.baseWeightsChanged !== false || report.boundary?.adapterWeightsChanged !== true ||
          report.boundary?.semanticAuthorityGranted !== false || report.boundary?.graphMutationAllowed !== false) {
        throw httpError(400, 'Training report does not preserve the conversational LoRA boundary.');
      }
      const artifactPath = requiredText(req.body?.artifactPath, 'artifactPath is required.', 500);
      const artifactSha256 = sha256Text(req.body?.artifactSha256, 'artifactSha256');
      const result = await query(
        `UPDATE local_ai_adapter_versions SET status='trained',artifact_path=$2,artifact_sha256=$3,training_report=$4,trained_at=NOW(),updated_at=NOW()
         WHERE id=$1 RETURNING *`,
        [current.id, artifactPath, artifactSha256, JSON.stringify(report)]
      );
      return res.json({ version: formatAdapterVersion(result.rows[0]), boundary: adapterLifecycleBoundary('Adapter weights were reported, but the version is not validated or active.') });
    }

    if (phase === 'validation') {
      if (current.status !== 'trained') throw httpError(409, 'Only a trained version can receive validation.');
      const report = normalizeValidationReport(req.body?.report);
      const passed = validationPassed(report);
      const result = await query(
        `UPDATE local_ai_adapter_versions SET status=$2,validation_report=$3,validated_at=NOW(),updated_at=NOW()
         WHERE id=$1 RETURNING *`,
        [current.id, passed ? 'validated' : 'rejected', JSON.stringify(report)]
      );
      return res.json({ version: formatAdapterVersion(result.rows[0]), passed, boundary: adapterLifecycleBoundary(passed ? 'Validation passed; deployment verification is still required.' : 'Validation failed; activation is prohibited.') });
    }

    if (phase === 'deployment') {
      if (current.status !== 'validated') throw httpError(409, 'Only a validated version can receive deployment verification.');
      const report = requiredObject(req.body?.report, 'report is required.');
      if (report.verified !== true || report.provider !== 'ollama') throw httpError(400, 'Deployment report must verify the Ollama model.');
      const ollamaModelName = requiredText(report.modelName, 'report.modelName is required.', 200);
      const result = await query(
        `UPDATE local_ai_adapter_versions SET status='deployable',ollama_model_name=$2,deployment_report=$3,deployed_at=NOW(),updated_at=NOW()
         WHERE id=$1 RETURNING *`,
        [current.id, ollamaModelName, JSON.stringify(report)]
      );
      return res.json({ version: formatAdapterVersion(result.rows[0]), boundary: adapterLifecycleBoundary('The model is deployable but not active until administrator approval.') });
    }

    throw httpError(400, 'phase must be training, validation, or deployment.');
  } catch (error) { next(error); }
});

router.post('/local-ai/training/versions/:id/activate', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const reason = requiredText(req.body?.reason, 'reason is required.', 1_000);
    const current = (await query(`SELECT * FROM local_ai_adapter_versions WHERE id=$1`, [req.params.id])).rows[0];
    if (!current) throw httpError(404, 'Adapter version not found.');
    if (current.status !== 'deployable') throw httpError(409, 'Only a deployment-verified version can be activated.');
    if (!validationPassed(current.validation_report || {})) throw httpError(409, 'The stored validation report does not pass activation gates.');
    const result = await query(
      `WITH archived AS (
         UPDATE local_ai_adapter_versions SET status='archived',updated_at=NOW() WHERE status='active' AND id<>$1
       )
       UPDATE local_ai_adapter_versions SET status='active',activated_by=$2,activated_at=NOW(),updated_at=NOW(),
         deployment_report=deployment_report || $3::jsonb WHERE id=$1 AND status='deployable' RETURNING *`,
      [current.id, req.user.sub, JSON.stringify({ activationReason: reason })]
    );
    if (!result.rows.length) throw httpError(409, 'Adapter version activation state changed; refresh and retry.');
    res.json({ version: formatAdapterVersion(result.rows[0]), boundary: adapterLifecycleBoundary('The deployment-verified Ollama model is now selected for Mirror Runtime.') });
  } catch (error) { next(error); }
});

router.post('/local-ai/training/versions/:id/rollback', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const reason = requiredText(req.body?.reason, 'reason is required.', 1_000);
    const target = (await query(`SELECT * FROM local_ai_adapter_versions WHERE id=$1`, [req.params.id])).rows[0];
    if (!target?.ollama_model_name || !['archived', 'deployable'].includes(target.status) || !validationPassed(target.validation_report || {})) {
      throw httpError(409, 'Rollback target must be a previously validated, deployment-verified version.');
    }
    const result = await query(
      `WITH archived AS (
         UPDATE local_ai_adapter_versions SET status='archived',updated_at=NOW() WHERE status='active' AND id<>$1
       )
       UPDATE local_ai_adapter_versions SET status='active',activated_by=$2,activated_at=NOW(),updated_at=NOW(),
         deployment_report=deployment_report || $3::jsonb WHERE id=$1 RETURNING *`,
      [target.id, req.user.sub, JSON.stringify({ rollbackReason: reason })]
    );
    res.json({ version: formatAdapterVersion(result.rows[0]), boundary: adapterLifecycleBoundary('Rollback selected a previously validated Ollama model.') });
  } catch (error) { next(error); }
});

router.get('/local-ai/training/active', requireRuntimeService, async (req, res, next) => {
  try {
    const result = await query(`SELECT * FROM local_ai_adapter_versions WHERE status='active' ORDER BY activated_at DESC LIMIT 1`);
    res.json({ activeVersion: result.rows[0] ? formatAdapterVersion(result.rows[0]) : null, boundary: adapterLifecycleBoundary('This read only selects a previously validated deployment.') });
  } catch (error) { next(error); }
});

function formatFeedback(row) {
  return {
    id: row.id,
    interactionId: row.interaction_id,
    userId: row.user_id,
    decision: row.decision,
    input: row.input,
    canonicalEnglish: row.canonical_english,
    modelName: row.model_name,
    modelResponse: row.model_response,
    correction: row.correction,
    graphSource: row.graph_source,
    learnedAlignmentStatus: row.learned_alignment_status,
    contractVerified: row.contract_verified,
    relationalEvidence: row.relational_evidence,
    status: row.status,
    reviewer: row.reviewer,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

function formatLearningCandidate(row) {
  return {
    id: row.id,
    feedbackId: row.feedback_id,
    userId: row.user_id,
    lane: row.lane,
    proposal: row.proposal,
    status: row.status,
    reviewer: row.reviewer,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    appliedAt: row.applied_at
  };
}

function formatUserGraphRelationship(row) {
  return {
    id: row.id,
    source: row.source_label,
    target: row.target_label,
    relationshipType: row.relationship_type,
    confidence: row.confidence,
    evidence: row.evidence,
    counterexample: row.counterexample,
    sourceFeedbackId: row.source_feedback_id,
    learningCandidateId: row.learning_candidate_id,
    sourceLayer: 'user_graph',
    createdAt: row.created_at
  };
}

function normalizeUserGraphProposal(value) {
  const object = requiredObject(value, 'proposal is required.');
  const source = requiredText(object.source, 'proposal.source is required.', 120).normalize('NFC');
  const target = requiredText(object.target, 'proposal.target is required.', 120).normalize('NFC');
  if (normalizeGraphKey(source) === normalizeGraphKey(target)) throw httpError(400, 'A personal relationship must connect two different labels.');
  for (const [name, label] of [['source', source], ['target', target]]) {
    const words = graphWords(label);
    if (words.length < 1 || words.length > 3 || normalizeGraphKey(words.join(' ')) !== normalizeGraphKey(label)) {
      throw httpError(400, `proposal.${name} must be an exact one-to-three-word label.`);
    }
  }
  const confidence = String(object.confidence || 'medium').trim().toLowerCase();
  if (!['high', 'medium', 'low'].includes(confidence)) throw httpError(400, 'proposal.confidence must be high, medium, or low.');
  return {
    source,
    target,
    relationshipType: requiredText(object.relationshipType, 'proposal.relationshipType is required.', 80),
    confidence,
    evidence: requiredText(object.evidence, 'proposal.evidence is required.', 1_000),
    counterexample: requiredText(object.counterexample, 'proposal.counterexample is required.', 1_000)
  };
}

function normalizeGraphKey(value) {
  return String(value || '').normalize('NFC').toLocaleLowerCase('en-US').trim().replace(/\s+/gu, ' ');
}

function graphWords(value) {
  return String(value || '').normalize('NFC').match(/[\p{L}\p{N}]+(?:['\u2019_-][\p{L}\p{N}]+)*/gu) || [];
}

function graphTerms(value) {
  const words = graphWords(value).map(normalizeGraphKey);
  const terms = new Set();
  for (let start = 0; start < words.length; start += 1) {
    for (let length = 1; length <= 3 && start + length <= words.length; length += 1) {
      terms.add(words.slice(start, start + length).join(' '));
    }
  }
  return [...terms];
}

function approvedTrainingFeedback() {
  return query(
    `SELECT feedback.*
     FROM local_ai_feedback AS feedback
     INNER JOIN local_ai_learning_candidates AS candidate
       ON candidate.feedback_id=feedback.id
      AND candidate.lane='model_retraining'
      AND candidate.status='approved'
     WHERE feedback.status='accepted'
     ORDER BY feedback.created_at,feedback.id`
  );
}

function learningBoundary(reason) {
  return {
    mode: 'governed_dual_learning_lanes',
    automaticLearningAllowed: false,
    trainingStarted: false,
    modelWeightsChanged: false,
    activeAdapterChanged: false,
    sharedGraphMutationAllowed: false,
    colorAtlasMutationAllowed: false,
    personalOverlayRequiresApproval: true,
    reason
  };
}

function feedbackBoundary(reason) {
  return {
    mode: 'supervised_feedback_proposal_only',
    trainingStarted: false,
    modelWeightsChanged: false,
    activeAdapterChanged: false,
    semanticMutationAllowed: false,
    graphMutationAllowed: false,
    reason
  };
}

function requireRuntimeService(req, res, next) {
  const configuredToken = process.env.RUNTIME_SERVICE_TOKEN || '';
  if (!configuredToken) return next(httpError(503, 'Runtime service authentication is not configured.'));
  const providedToken = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const provided = Buffer.from(providedToken);
  const configured = Buffer.from(configuredToken);
  if (provided.length !== configured.length || !crypto.timingSafeEqual(provided, configured)) return next(httpError(401, 'Invalid runtime service token.'));
  next();
}

function adapterLifecycleBoundary(reason) {
  return {
    mode: 'validated_conversation_adapter_lifecycle',
    baseWeightsChangedByApi: false,
    semanticMutationAllowed: false,
    graphMutationAllowed: false,
    alignmentVerifierTrainingAllowed: false,
    reason
  };
}

function formatAdapterVersion(row) {
  return {
    id: row.id, name: row.name, baseModel: row.base_model, runtimeBaseModel: row.runtime_base_model,
    adapterKind: row.adapter_kind, datasetSha256: row.dataset_sha256, datasetRecordCount: row.dataset_record_count,
    status: row.status, artifactPath: row.artifact_path, artifactSha256: row.artifact_sha256,
    ollamaModelName: row.ollama_model_name, trainingReport: row.training_report,
    validationReport: row.validation_report, deploymentReport: row.deployment_report,
    createdBy: row.created_by, activatedBy: row.activated_by, createdAt: row.created_at,
    trainedAt: row.trained_at, validatedAt: row.validated_at, deployedAt: row.deployed_at, activatedAt: row.activated_at
  };
}

function normalizeVersionName(value, id) {
  const fallback = `qwen3-4b-conversation-${id.slice(-8)}`;
  const name = String(value || fallback).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(name)) throw httpError(400, 'Version name must be 3-80 lowercase letters, numbers, dots, underscores, or hyphens.');
  return name;
}

function normalizeValidationReport(value) {
  const report = requiredObject(value, 'report is required.');
  const validatorVersion = String(report.validatorVersion || '1.0.0');
  if (!['1.0.0', '2.0.0'].includes(validatorVersion)) throw httpError(400, 'validatorVersion is not supported.');
  return {
    validatorVersion,
    heldOutExamples: boundedInteger(report.heldOutExamples, 0, 100_000, 'heldOutExamples'),
    exactMatches: boundedInteger(report.exactMatches, 0, 100_000, 'exactMatches'),
    contractMatches: boundedInteger(report.contractMatches ?? report.exactMatches, 0, 100_000, 'contractMatches'),
    wordForWordMatches: boundedInteger(report.wordForWordMatches ?? report.exactMatches, 0, 100_000, 'wordForWordMatches'),
    emptyResponses: boundedInteger(report.emptyResponses ?? 0, 0, 100_000, 'emptyResponses'),
    boundaryViolations: boundedInteger(report.boundaryViolations, 0, 100_000, 'boundaryViolations'),
    unsupportedGraphClaims: boundedInteger(report.unsupportedGraphClaims, 0, 100_000, 'unsupportedGraphClaims'),
    evidenceCountMismatches: boundedInteger(report.evidenceCountMismatches ?? 0, 0, 100_000, 'evidenceCountMismatches'),
    semanticMutationClaims: boundedInteger(report.semanticMutationClaims, 0, 100_000, 'semanticMutationClaims'),
    graphMutationClaims: boundedInteger(report.graphMutationClaims, 0, 100_000, 'graphMutationClaims')
  };
}

function validationPassed(report) {
  const matches = report.validatorVersion === '2.0.0' ? report.contractMatches : report.exactMatches;
  return Number(report.heldOutExamples) >= 4 && Number(matches) === Number(report.heldOutExamples) &&
    Number(report.boundaryViolations) === 0 && Number(report.unsupportedGraphClaims) === 0 &&
    Number(report.evidenceCountMismatches || 0) === 0 && Number(report.emptyResponses || 0) === 0 &&
    Number(report.semanticMutationClaims) === 0 && Number(report.graphMutationClaims) === 0;
}

function requiredObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, message);
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 32 * 1024) throw httpError(413, 'Report exceeds 32 KB.');
  return value;
}

function boundedInteger(value, minimum, maximum, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw httpError(400, `${name} must be an integer from ${minimum} to ${maximum}.`);
  return number;
}

function sha256Text(value, name) {
  const text = requiredText(value, `${name} is required.`, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw httpError(400, `${name} must be a SHA-256 hex digest.`);
  return text;
}

function requiredText(value, message, maxLength) {
  if (typeof value !== 'string' || !value.trim()) throw httpError(400, message);
  if ([...value].length > maxLength) throw httpError(413, `${message.replace(/\.$/, '')} (maximum ${maxLength} Unicode code points).`);
  return value.trim();
}

function httpError(status, message) { return Object.assign(new Error(message), { status }); }

export default router;
