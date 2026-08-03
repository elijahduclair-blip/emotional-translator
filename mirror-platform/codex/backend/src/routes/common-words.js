import express from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

router.get('/common-words', async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM nodes WHERE record_status = 'active' AND type = 'common_word' ORDER BY label");
    res.json({ commonWords: result.rows, count: result.rows.length });
  } catch (error) {
    next(error);
  }
});

export default router;
