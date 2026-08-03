import crypto from 'node:crypto';
import express from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

router.post('/runtime/evaluations', requireRuntimeService, async (req, res, next) => {
  try {
    const evaluation = normalizeRuntimeEvaluation(req.body?.evaluation);
    const translation = normalizeEmotionalTranslation(req.body?.translation);
    const graphRead = optionalObject(req.body?.graphRead);
    const result = await query(
      `INSERT INTO runtime_evaluations
        (id, evaluation_id, user_id, input, fingerprint, climate_signals, evidence, boundary, translation, graph_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (evaluation_id) DO UPDATE SET evaluation_id = EXCLUDED.evaluation_id
       RETURNING id, evaluation_id, status, created_at`,
      [
        crypto.randomUUID(),
        evaluation.id,
        evaluation.userId,
        evaluation.input,
        evaluation.fingerprint,
        JSON.stringify(evaluation.climateSignals),
        JSON.stringify(evaluation.evidence),
        JSON.stringify(evaluation.boundary),
        JSON.stringify(translation),
        graphRead == null ? null : JSON.stringify(graphRead)
      ]
    );
    const stored = result.rows[0];
    res.status(201).json({
      id: stored.id,
      evaluationId: stored.evaluation_id,
      status: stored.status,
      createdAt: stored.created_at
    });
  } catch (error) {
    next(error);
  }
});

export function normalizeRuntimeEvaluation(value) {
  if (!value || typeof value !== 'object') throw httpError(400, 'evaluation is required.');
  if (value.kind !== 'evaluated_observation' || value.status !== 'proposed') {
    throw httpError(400, 'Only proposed evaluated observations can be recorded.');
  }
  if (value.boundary?.mode !== 'proposal_only' || value.boundary?.semanticMutationAllowed !== false) {
    throw httpError(400, 'Evaluation must preserve the proposal-only semantic boundary.');
  }

  return {
    id: requiredText(value.id, 'evaluation.id is required.', 200),
    userId: optionalText(value.userId, 200),
    input: requiredText(value.input, 'evaluation.input is required.', 4000),
    fingerprint: requiredText(value.fingerprint, 'evaluation.fingerprint is required.', 128),
    climateSignals: Array.isArray(value.climateSignals) ? value.climateSignals : [],
    evidence: value.evidence && typeof value.evidence === 'object' ? value.evidence : {},
    boundary: value.boundary
  };
}

export function normalizeEmotionalTranslation(value) {
  if (!value || typeof value !== 'object') throw httpError(400, 'translation is required.');
  if (!['codex_graph', 'chromabridge_fallback'].includes(value.source)) {
    throw httpError(400, 'translation.source must identify Codex graph evidence or ChromaBridge fallback.');
  }
  return {
    ...value,
    climateName: requiredText(value.climateName, 'translation.climateName is required.', 300),
    relationalRead: requiredText(value.relationalRead, 'translation.relationalRead is required.', 4000),
    matchedNodes: Array.isArray(value.matchedNodes) ? value.matchedNodes : [],
    supportedRoutes: Array.isArray(value.supportedRoutes) ? value.supportedRoutes : []
  };
}

function requireRuntimeService(req, res, next) {
  const configuredToken = process.env.RUNTIME_SERVICE_TOKEN || '';
  if (!configuredToken) return next(httpError(503, 'Runtime persistence is not configured.'));

  const providedToken = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const provided = Buffer.from(providedToken);
  const configured = Buffer.from(configuredToken);
  if (provided.length !== configured.length || !crypto.timingSafeEqual(provided, configured)) {
    return next(httpError(401, 'Invalid runtime service token.'));
  }
  return next();
}

function requiredText(value, message, maxLength) {
  if (typeof value !== 'string' || !value.trim()) throw httpError(400, message);
  if (value.length > maxLength) throw httpError(400, `${message.replace(/\.$/, '')} (maximum ${maxLength} characters).`);
  return value.trim();
}

function optionalText(value, maxLength) {
  if (value == null || value === '') return null;
  return requiredText(value, 'Value must be text.', maxLength);
}

function optionalObject(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'graphRead must be an object.');
  return value;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export default router;
