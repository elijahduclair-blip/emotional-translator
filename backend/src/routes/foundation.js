import express from 'express';
import { analyzeFoundationText } from '../lib/foundation-analysis.js';

const router = express.Router();

router.post('/foundation/analyze', (req, res, next) => {
  try {
    const text = String(req.body?.text || '');
    if (!text.trim()) return res.status(400).json({ error: 'text parameter required' });
    if (text.length > 50000) return res.status(400).json({ error: 'text must be 50000 characters or fewer' });

    const result = analyzeFoundationText(text, req.body?.options || {});
    res.json({
      input: text,
      engine: 'foundation',
      version: '1.0.0',
      boundary: 'Foundation returns structure only: counts, co-occurrences, Pareto, and repeat patterns. Color, route activation, and meaning belong to later layers.',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
