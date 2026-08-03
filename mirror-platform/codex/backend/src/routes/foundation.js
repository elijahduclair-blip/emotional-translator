import express from 'express';
import crypto from 'crypto';
import { analyzeFoundationText } from '../lib/foundation-analysis.js';
import { query } from '../db/pool.js';

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

router.get('/foundation/sessions', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
    const result = await query(
      `SELECT id, title, input_text, stats, created_at, updated_at
       FROM foundation_sessions
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({
      sessions: result.rows.map(row => summarizeSession(row)),
      count: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

router.post('/foundation/sessions', async (req, res, next) => {
  try {
    const text = String(req.body?.text || '');
    if (!text.trim()) return res.status(400).json({ error: 'text parameter required' });
    if (text.length > 50000) return res.status(400).json({ error: 'text must be 50000 characters or fewer' });

    const options = normalizeOptions(req.body?.options || {});
    const title = normalizeTitle(req.body?.title, text);
    const analysis = analyzeFoundationText(text, options);
    const id = crypto.randomUUID();

    const result = await query(
      `INSERT INTO foundation_sessions
       (id, title, input_text, analysis_options, stats, word_counts, co_occurrences, pareto, patterns, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, NOW())
       RETURNING id, title, input_text, analysis_options, stats, word_counts, co_occurrences, pareto, patterns, created_at, updated_at`,
      [
        id,
        title,
        text,
        JSON.stringify(options),
        JSON.stringify(analysis.stats),
        JSON.stringify(analysis.wordCounts),
        JSON.stringify(analysis.coOccurrences),
        JSON.stringify(analysis.pareto),
        JSON.stringify(analysis.patterns)
      ]
    );

    res.status(201).json({
      session: hydrateSession(result.rows[0])
    });
  } catch (error) {
    next(error);
  }
});

router.get('/foundation/sessions/:id', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, title, input_text, analysis_options, stats, word_counts, co_occurrences, pareto, patterns, created_at, updated_at
       FROM foundation_sessions
       WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Foundation session not found' });
    res.json({ session: hydrateSession(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.delete('/foundation/sessions/:id', async (req, res, next) => {
  try {
    const result = await query('DELETE FROM foundation_sessions WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Foundation session not found' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

function normalizeOptions(value) {
  const windowSize = Math.min(Math.max(Number.parseInt(value?.windowSize, 10) || 2, 2), 8);
  return { windowSize };
}

function normalizeTitle(title, text) {
  const provided = String(title || '').trim();
  if (provided) return provided.slice(0, 120);
  const preview = String(text || '').trim().replace(/\s+/g, ' ');
  return (preview.slice(0, 57) + (preview.length > 57 ? '...' : '')) || 'Untitled session';
}

function summarizeSession(row) {
  const session = hydrateSession(row);
  return {
    id: session.id,
    title: session.title,
    preview: session.input.length > 140 ? `${session.input.slice(0, 137)}...` : session.input,
    stats: session.stats,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

function hydrateSession(row) {
  return {
    id: row.id,
    title: row.title,
    input: row.input_text,
    options: row.analysis_options || {},
    stats: row.stats || {},
    wordCounts: row.word_counts || [],
    coOccurrences: row.co_occurrences || [],
    pareto: row.pareto || [],
    patterns: row.patterns || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
