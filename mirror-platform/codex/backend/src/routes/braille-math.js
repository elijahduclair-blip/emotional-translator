import crypto from 'node:crypto';
import express from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/public-api.js';
import { BRAILLE_MATH_CURRICULUM } from '../lib/braille-curriculum.js';
import { checkBrailleMath, translateBrailleMath } from '../lib/braille-math.js';

const router = express.Router();
const limitBrailleMath = createRateLimiter({ name: 'Braille math', windowMs: 60_000, maxRequests: 120 });

router.use('/braille/math', limitBrailleMath);

router.get('/braille/math/curriculum', (req, res) => res.json(BRAILLE_MATH_CURRICULUM));

router.post('/braille/math/translate', (req, res, next) => {
  try { res.json(translateBrailleMath(req.body || {})); } catch (error) { next(error); }
});

router.post('/braille/math/check', (req, res, next) => {
  try { res.json(checkBrailleMath(req.body || {})); } catch (error) { next(error); }
});

router.get('/braille/math/progress', requireAuth, async (req, res, next) => {
  try {
    const progress = await query(
      `SELECT lesson_id AS "lessonId", status, best_score AS "bestScore", attempt_count AS "attemptCount", completed_at AS "completedAt", updated_at AS "updatedAt"
       FROM braille_lesson_progress WHERE user_id=$1 ORDER BY lesson_id`,
      [req.user.sub]
    );
    const attempts = await query(
      `SELECT id, lesson_id AS "lessonId", direction, correct, duration_ms AS "durationMs", mistake_categories AS "mistakeCategories", created_at AS "createdAt"
       FROM braille_practice_attempts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.sub]
    );
    res.json({ curriculumVersion: BRAILLE_MATH_CURRICULUM.version, progress: progress.rows, attempts: attempts.rows });
  } catch (error) { next(error); }
});

router.put('/braille/math/progress', requireAuth, async (req, res, next) => {
  try {
    const lessonId = String(req.body?.lessonId || '');
    const lesson = BRAILLE_MATH_CURRICULUM.lessons.find(item => item.id === lessonId);
    if (!lesson) return res.status(400).json({ error: 'Unknown lessonId.' });
    const status = String(req.body?.status || 'in_progress');
    if (!['not_started', 'in_progress', 'completed'].includes(status)) return res.status(400).json({ error: 'status must be not_started, in_progress, or completed.' });
    const score = Math.max(0, Math.min(100, Number(req.body?.score) || 0));
    const correct = Boolean(req.body?.correct);
    const durationMs = Math.max(0, Math.min(3_600_000, Number(req.body?.durationMs) || 0));
    const direction = String(req.body?.direction || 'print_to_nemeth');
    if (!['print_to_nemeth', 'nemeth_to_print'].includes(direction)) return res.status(400).json({ error: 'Invalid direction.' });
    const allowedMistakes = new Set(['braille_cell_sequence', 'print_structure', 'numeric_indicator', 'spacing', 'grouping', 'fraction', 'exponent']);
    const mistakes = [...new Set((Array.isArray(req.body?.mistakeCategories) ? req.body.mistakeCategories : []).map(String).filter(value => allowedMistakes.has(value)))].slice(0, 8);

    const progress = await query(
      `INSERT INTO braille_lesson_progress (user_id, lesson_id, status, best_score, attempt_count, completed_at, updated_at)
       VALUES ($1,$2,$3,$4,1,CASE WHEN $3='completed' THEN NOW() ELSE NULL END,NOW())
       ON CONFLICT (user_id,lesson_id) DO UPDATE SET
         status=CASE WHEN braille_lesson_progress.status='completed' THEN 'completed' ELSE EXCLUDED.status END,
         best_score=GREATEST(braille_lesson_progress.best_score,EXCLUDED.best_score),
         attempt_count=braille_lesson_progress.attempt_count+1,
         completed_at=COALESCE(braille_lesson_progress.completed_at,EXCLUDED.completed_at), updated_at=NOW()
       RETURNING lesson_id AS "lessonId",status,best_score AS "bestScore",attempt_count AS "attemptCount",completed_at AS "completedAt",updated_at AS "updatedAt"`,
      [req.user.sub, lessonId, status, score]
    );
    await query(
      `INSERT INTO braille_practice_attempts (id,user_id,lesson_id,direction,correct,duration_ms,mistake_categories)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [crypto.randomUUID(), req.user.sub, lessonId, direction, correct, durationMs, mistakes]
    );
    res.json({ progress: progress.rows[0] });
  } catch (error) { next(error); }
});

export default router;

