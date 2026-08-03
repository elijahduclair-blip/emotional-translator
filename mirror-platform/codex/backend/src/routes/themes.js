import express from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

router.get('/themes', async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM nodes WHERE record_status = 'active' AND type = 'theme' ORDER BY label");
    res.json({ themes: result.rows, count: result.rows.length });
  } catch (error) {
    next(error);
  }
});

export default router;
