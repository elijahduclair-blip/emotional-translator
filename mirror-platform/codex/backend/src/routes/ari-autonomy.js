import crypto from 'node:crypto';
import express from 'express';
import { pool, query } from '../db/pool.js';
import { requireAuth, requirePasswordCurrent } from '../middleware/auth.js';
import {
  autonomyBoundary,
  normalizeAutonomyObjective,
  normalizeAutonomyOutcome,
  normalizeAutonomyStep
} from '../lib/ari-autonomy.js';

const router = express.Router();

router.use('/ari/autonomy', requireAuth, requirePasswordCurrent);

router.post('/ari/autonomy/objectives', async (req, res, next) => {
  try {
    const input = normalizeAutonomyObjective(req.body);
    const result = await query(
      `INSERT INTO ari_autonomy_objectives
        (id,user_id,objective,success_criteria,max_steps,allowed_tools,status,working_memory)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,'active','[]'::jsonb)
       RETURNING *`,
      [crypto.randomUUID(), req.user.sub, input.objective, JSON.stringify(input.successCriteria), input.maxSteps, input.allowedTools]
    );
    res.status(201).json({ objective: serializeObjective(result.rows[0], [], []), boundary: autonomyBoundary() });
  } catch (error) { next(error); }
});

router.get('/ari/autonomy/objectives', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT objective.*,
              COUNT(step.id)::int AS step_count,
              (SELECT COUNT(*)::int FROM ari_autonomy_outcomes outcome
               WHERE outcome.objective_id=objective.id) AS lesson_count
       FROM ari_autonomy_objectives objective
       LEFT JOIN ari_autonomy_steps step ON step.objective_id=objective.id
       WHERE objective.user_id=$1
       GROUP BY objective.id
       ORDER BY objective.created_at DESC
       LIMIT 25`,
      [req.user.sub]
    );
    res.json({
      objectives: result.rows.map(row => serializeObjective(row, null, null)),
      count: result.rows.length,
      boundary: autonomyBoundary()
    });
  } catch (error) { next(error); }
});

router.post('/ari/autonomy/objectives/:id/outcomes', async (req, res, next) => {
  let client;
  try {
    const outcome = normalizeAutonomyOutcome(req.body);
    client = await pool.connect();
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT objective.*,
              (SELECT COUNT(*)::int FROM ari_autonomy_steps WHERE objective_id=objective.id) AS step_count
       FROM ari_autonomy_objectives objective
       WHERE objective.id=$1 AND objective.user_id=$2
       FOR UPDATE`,
      [req.params.id, req.user.sub]
    );
    if (!current.rows.length) throw httpError(404, 'Autonomy objective not found.');
    const objective = current.rows[0];
    if (outcome.stepSequence !== null && outcome.stepSequence > Number(objective.step_count)) {
      throw httpError(400, 'The lesson cannot reference a step that has not happened.');
    }
    const result = await client.query(
      `INSERT INTO ari_autonomy_outcomes
        (id,objective_id,step_sequence,classification,consequence,lesson,next_attempt,reversible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [crypto.randomUUID(), objective.id, outcome.stepSequence, outcome.classification,
        outcome.consequence, outcome.lesson, outcome.nextAttempt, outcome.reversible]
    );
    const lessonMemory = {
      kind: 'lesson',
      classification: outcome.classification,
      consequence: outcome.consequence,
      lesson: outcome.lesson,
      nextAttempt: outcome.nextAttempt,
      reversible: outcome.reversible,
      sourceObjectiveId: objective.id,
      sourceStepSequence: outcome.stepSequence
    };
    const memory = [...(Array.isArray(objective.working_memory) ? objective.working_memory : []), lessonMemory].slice(-8);
    await client.query(
      `UPDATE ari_autonomy_objectives SET working_memory=$2::jsonb, updated_at=NOW() WHERE id=$1`,
      [objective.id, JSON.stringify(memory)]
    );
    await client.query('COMMIT');
    res.status(201).json({
      outcome: serializeOutcome(result.rows[0]),
      objective: await readObjective(req.user.sub, objective.id),
      boundary: autonomyBoundary()
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { client?.release(); }
});

router.post('/ari/autonomy/objectives/:id/retry', async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT * FROM ari_autonomy_objectives WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [req.params.id, req.user.sub]
    );
    if (!current.rows.length) throw httpError(404, 'Autonomy objective not found.');
    const objective = current.rows[0];
    if (!['completed', 'blocked', 'step_limit'].includes(objective.status)) {
      throw httpError(409, 'The current attempt must finish or reach a recorded boundary before creating a revised attempt.');
    }
    const lessons = await client.query(
      `SELECT * FROM ari_autonomy_outcomes WHERE objective_id=$1 ORDER BY created_at`,
      [objective.id]
    );
    if (!lessons.rows.length) throw httpError(409, 'Record at least one consequence and lesson before retrying.');
    const inheritedLessons = lessons.rows.slice(-8).map(row => ({
      kind: 'lesson',
      classification: row.classification,
      consequence: row.consequence,
      lesson: row.lesson,
      nextAttempt: row.next_attempt,
      reversible: row.reversible,
      sourceObjectiveId: objective.id,
      sourceStepSequence: row.step_sequence
    }));
    const result = await client.query(
      `INSERT INTO ari_autonomy_objectives
        (id,user_id,parent_objective_id,attempt_no,objective,success_criteria,max_steps,allowed_tools,status,working_memory)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,'active',$9::jsonb)
       RETURNING *`,
      [crypto.randomUUID(), req.user.sub, objective.id, Number(objective.attempt_no || 1) + 1,
        objective.objective, JSON.stringify(objective.success_criteria || []), objective.max_steps,
        objective.allowed_tools, JSON.stringify(inheritedLessons)]
    );
    await client.query('COMMIT');
    res.status(201).json({
      objective: serializeObjective(result.rows[0], [], []),
      inheritedLessonCount: inheritedLessons.length,
      boundary: autonomyBoundary()
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { client?.release(); }
});

router.get('/ari/autonomy/objectives/:id', async (req, res, next) => {
  try {
    const objective = await readObjective(req.user.sub, req.params.id);
    if (!objective) throw httpError(404, 'Autonomy objective not found.');
    res.json({ objective, boundary: autonomyBoundary() });
  } catch (error) { next(error); }
});

router.patch('/ari/autonomy/objectives/:id', async (req, res, next) => {
  try {
    const action = String(req.body?.action || '').trim();
    const nextStatus = action === 'pause' ? 'paused' : action === 'resume' ? 'active' : action === 'cancel' ? 'cancelled' : null;
    if (!nextStatus) throw httpError(400, 'action must be pause, resume, or cancel.');
    const result = await query(
      `UPDATE ari_autonomy_objectives
       SET status=$3, updated_at=NOW(),
           completed_at=CASE WHEN $3='cancelled' THEN NOW() ELSE NULL END
       WHERE id=$1 AND user_id=$2
         AND status = ANY(CASE WHEN $3='active' THEN ARRAY['paused']::text[] ELSE ARRAY['active','paused','step_limit']::text[] END)
       RETURNING *`,
      [req.params.id, req.user.sub, nextStatus]
    );
    if (!result.rows.length) throw httpError(409, 'The objective cannot make that transition from its current state.');
    const objective = await readObjective(req.user.sub, req.params.id);
    res.json({ objective, boundary: autonomyBoundary() });
  } catch (error) { next(error); }
});

router.post('/ari/autonomy/objectives/:id/steps', async (req, res, next) => {
  let client;
  try {
    const step = normalizeAutonomyStep(req.body);
    client = await pool.connect();
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT objective.*,
              (SELECT COUNT(*)::int FROM ari_autonomy_steps WHERE objective_id=objective.id) AS step_count
       FROM ari_autonomy_objectives objective
       WHERE objective.id=$1 AND objective.user_id=$2
       FOR UPDATE`,
      [req.params.id, req.user.sub]
    );
    if (!current.rows.length) throw httpError(404, 'Autonomy objective not found.');
    const objective = current.rows[0];
    if (!['active', 'paused'].includes(objective.status)) throw httpError(409, 'Only an active or just-paused autonomy objective may record its in-flight step.');
    if (Number(objective.step_count) + 1 !== step.sequence) throw httpError(409, 'Autonomy step sequence does not match the persisted audit.');
    if (!objective.allowed_tools.includes(step.toolId) && step.toolId !== null) {
      throw httpError(403, 'ARI attempted a tool outside this objective authorization.');
    }
    const nextStatus = objective.status === 'paused' && step.objectiveStatus === 'active'
      ? 'paused'
      : step.objectiveStatus;
    await client.query(
      `INSERT INTO ari_autonomy_steps
        (id,objective_id,sequence_no,action,tool_id,status,reason,observation,receipt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)`,
      [crypto.randomUUID(), objective.id, step.sequence, step.action, step.toolId, step.status, step.reason,
        JSON.stringify(step.observation), step.receipt ? JSON.stringify(step.receipt) : null]
    );
    const memory = [...(Array.isArray(objective.working_memory) ? objective.working_memory : []), {
      sequence: step.sequence,
      toolId: step.toolId,
      status: step.status,
      summary: step.observation.summary
    }].slice(-8);
    await client.query(
      `UPDATE ari_autonomy_objectives
       SET status=$2, working_memory=$3::jsonb,
           completion_summary=COALESCE($4,completion_summary), updated_at=NOW(),
           completed_at=CASE WHEN $2 IN ('completed','blocked','cancelled','step_limit') THEN NOW() ELSE NULL END
       WHERE id=$1`,
      [objective.id, nextStatus, JSON.stringify(memory), step.completionSummary]
    );
    await client.query('COMMIT');
    const saved = await readObjective(req.user.sub, objective.id);
    res.status(201).json({ objective: saved, boundary: autonomyBoundary() });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally { client?.release(); }
});

async function readObjective(userId, objectiveId) {
  const [objective, steps, outcomes] = await Promise.all([
    query('SELECT * FROM ari_autonomy_objectives WHERE id=$1 AND user_id=$2', [objectiveId, userId]),
    query(`SELECT * FROM ari_autonomy_steps
           WHERE objective_id=$1 AND EXISTS (
             SELECT 1 FROM ari_autonomy_objectives WHERE id=$1 AND user_id=$2
           ) ORDER BY sequence_no`, [objectiveId, userId]),
    query(`SELECT * FROM ari_autonomy_outcomes
           WHERE objective_id=$1 AND EXISTS (
             SELECT 1 FROM ari_autonomy_objectives WHERE id=$1 AND user_id=$2
           ) ORDER BY created_at`, [objectiveId, userId])
  ]);
  return objective.rows.length ? serializeObjective(objective.rows[0], steps.rows, outcomes.rows) : null;
}

function serializeObjective(row, steps, outcomes) {
  const serializedSteps = steps === null ? undefined : (steps || []).map(step => ({
    id: step.id,
    sequence: Number(step.sequence_no),
    action: step.action,
    toolId: step.tool_id,
    status: step.status,
    reason: step.reason,
    observation: step.observation || {},
    receipt: step.receipt || null,
    createdAt: step.created_at
  }));
  return {
    id: row.id,
    parentObjectiveId: row.parent_objective_id || null,
    attemptNumber: Number(row.attempt_no || 1),
    objective: row.objective,
    successCriteria: row.success_criteria || [],
    status: row.status,
    maxSteps: Number(row.max_steps),
    allowedTools: row.allowed_tools || [],
    stepCount: serializedSteps ? serializedSteps.length : Number(row.step_count || 0),
    workingMemory: row.working_memory || [],
    lessonCount: outcomes === null ? Number(row.lesson_count || 0) : (outcomes || []).length,
    completionSummary: row.completion_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    ...(serializedSteps ? { steps: serializedSteps } : {}),
    ...(outcomes === null ? {} : { outcomes: (outcomes || []).map(serializeOutcome) })
  };
}

function serializeOutcome(row) {
  return {
    id: row.id,
    stepSequence: row.step_sequence === null ? null : Number(row.step_sequence),
    classification: row.classification,
    consequence: row.consequence,
    lesson: row.lesson,
    nextAttempt: row.next_attempt,
    reversible: row.reversible === true,
    createdAt: row.created_at
  };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export default router;
