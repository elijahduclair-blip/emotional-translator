import express from 'express';
import { query } from '../db/pool.js';
import crypto from 'crypto';
import { requireAuth, requirePasswordCurrent, requireSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

async function ensureUser(userId) {
  const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) {
    await query('INSERT INTO users (id, username) VALUES ($1, $2)', [userId, `user-${userId.slice(0, 8)}`]);
  }
  return userId;
}

router.get('/users/:id/profile', requireAuth, requirePasswordCurrent, requireSelfOrAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await ensureUser(id);
    const result = await query('SELECT * FROM user_profiles WHERE user_id = $1', [id]);
    res.json(result.rows[0] || { user_id: id, profile_data: {} });
  } catch (error) {
    next(error);
  }
});

router.post('/users/:id/profile', requireAuth, requirePasswordCurrent, requireSelfOrAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { profile_data } = req.body;
    await ensureUser(id);
    
    const profileId = crypto.randomUUID();
    const result = await query(
      `INSERT INTO user_profiles (id, user_id, profile_data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET profile_data = $3, updated_at = NOW()
       RETURNING *`,
      [profileId, id, JSON.stringify(profile_data)]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get('/users/:id/concepts', requireAuth, requirePasswordCurrent, requireSelfOrAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM user_concepts WHERE user_id = $1', [id]);
    res.json({ concepts: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/users/:id/concepts', requireAuth, requirePasswordCurrent, requireSelfOrAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { concept_name, theme_category, metadata } = req.body;
    await ensureUser(id);
    
    const conceptId = crypto.randomUUID();
    const result = await query(
      `INSERT INTO user_concepts (id, user_id, concept_name, theme_category, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [conceptId, id, concept_name, theme_category, JSON.stringify(metadata)]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
