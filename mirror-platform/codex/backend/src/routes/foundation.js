import express from 'express';
import crypto from 'crypto';
import { analyzeFoundationText } from '../lib/foundation-analysis.js';
import { compileBrailleRuntimeInstruction } from '../lib/braille-runtime-language.js';
import { assembleBrailleRuntimeModule } from '../lib/braille-runtime-module.js';
import { runStructuralLanguageLoop } from '../lib/language-loop.js';
import { buildVerifiedTrainingDataset, normalizeTrainingInputs } from '../lib/training-dataset.js';
import { buildColorAtlasTrainingDataset } from '../lib/color-atlas-training-dataset.js';
import {
  LETTER_ACCOUNTABILITY_VERSION,
  analyzeLetterAccountability,
  compareLetterPatterns,
  countGraphemes
} from '../lib/letter-accountability.js';
import { query } from '../db/pool.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = express.Router();
const MAX_LETTER_INPUT_CODE_POINTS = 10_000;
const MAX_COMPARISON_GRAPHEMES = 128;

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

router.post('/foundation/letters/analyze', (req, res, next) => {
  try {
    const text = String(req.body?.text || '');
    if (!text.trim()) return res.status(400).json({ error: 'text parameter required' });
    if ([...text].length > MAX_LETTER_INPUT_CODE_POINTS) return res.status(413).json({ error: 'text must be 10000 Unicode code points or fewer' });
    res.json({ input: text, engine: 'foundation_letters', ...analyzeLetterAccountability(text) });
  } catch (error) { next(error); }
});

router.post('/foundation/letters/compare', (req, res, next) => {
  try {
    const left = String(req.body?.left || '');
    const right = String(req.body?.right || '');
    if (!left.trim() || !right.trim()) return res.status(400).json({ error: 'left and right are required' });
    if (countGraphemes(left) > MAX_COMPARISON_GRAPHEMES || countGraphemes(right) > MAX_COMPARISON_GRAPHEMES) {
      return res.status(413).json({ error: 'comparison words must be 128 grapheme clusters or fewer' });
    }
    res.json(compareLetterPatterns(left, right));
  } catch (error) { next(error); }
});

router.post('/foundation/braille-runtime/compile', (req, res, next) => {
  try {
    res.json(compileBrailleRuntimeInstruction(req.body?.input, req.body?.observedValue));
  } catch (error) { next(error); }
});

router.post('/foundation/braille-runtime/assemble', (req, res, next) => {
  try {
    res.json(assembleBrailleRuntimeModule(
      req.body?.input,
      req.body?.observedValue,
      req.body?.proposalDecision
    ));
  } catch (error) { next(error); }
});

router.post('/foundation/language-loop', async (req, res, next) => {
  try {
    const loop = runStructuralLanguageLoop(req.body?.text);
    const approvedGraph = await readApprovedMeaning(loop.terms);
    res.json({
      ...loop,
      meaning: {
        principle: 'The encoding preserves the pattern; lexical, contextual, and approved relational connections provide evidence about what it means here.',
        approvedGraph,
        wordNet: loop.lexicalEvidence
      }
    });
  } catch (error) { next(error); }
});

router.post('/foundation/training/dataset', async (req, res, next) => {
  try {
    const inputs = normalizeTrainingInputs(req.body?.inputs);
    const samples = [];
    for (const text of inputs) {
      const loop = runStructuralLanguageLoop(text);
      const approvedGraph = await readApprovedMeaning(loop.terms);
      samples.push({
        loop,
        meaning: { approvedGraph, wordNet: loop.lexicalEvidence }
      });
    }
    res.json(buildVerifiedTrainingDataset(samples));
  } catch (error) { next(error); }
});

router.post('/foundation/training/color-atlas', (req, res, next) => {
  try {
    res.json(buildColorAtlasTrainingDataset({
      offset: req.body?.offset,
      limit: req.body?.limit
    }));
  } catch (error) { next(error); }
});

router.get('/foundation/sessions', requireAuth, requireAdmin, async (req, res, next) => {
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

router.post('/foundation/sessions', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const text = String(req.body?.text || '');
    if (!text.trim()) return res.status(400).json({ error: 'text parameter required' });
    if (text.length > 50000) return res.status(400).json({ error: 'text must be 50000 characters or fewer' });

    const options = normalizeOptions(req.body?.options || {});
    const title = normalizeTitle(req.body?.title, text);
    const analysis = analyzeFoundationText(text, options);
    const letterAccountability = [...text].length <= MAX_LETTER_INPUT_CODE_POINTS
      ? analyzeLetterAccountability(text)
      : null;
    const id = crypto.randomUUID();

    const result = await query(
      `INSERT INTO foundation_sessions
       (id, title, input_text, analysis_options, stats, word_counts, co_occurrences, pareto, patterns, letter_accountability, analysis_version, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, NOW())
       RETURNING id, title, input_text, analysis_options, stats, word_counts, co_occurrences, pareto, patterns, letter_accountability, analysis_version, created_at, updated_at`,
      [
        id,
        title,
        text,
        JSON.stringify(options),
        JSON.stringify(analysis.stats),
        JSON.stringify(analysis.wordCounts),
        JSON.stringify(analysis.coOccurrences),
        JSON.stringify(analysis.pareto),
        JSON.stringify(analysis.patterns),
        letterAccountability ? JSON.stringify(letterAccountability) : null,
        letterAccountability ? LETTER_ACCOUNTABILITY_VERSION : null
      ]
    );

    res.status(201).json({
      session: hydrateSession(result.rows[0])
    });
  } catch (error) {
    next(error);
  }
});

router.get('/foundation/sessions/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, title, input_text, analysis_options, stats, word_counts, co_occurrences, pareto, patterns, letter_accountability, analysis_version, created_at, updated_at
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

router.delete('/foundation/sessions/:id', requireAuth, requireAdmin, async (req, res, next) => {
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
    letterAccountability: row.letter_accountability || null,
    analysisVersion: row.analysis_version || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function readApprovedMeaning(terms) {
  if (!terms.length) return { sourceLayer: 'unresolved', nodes: [], routes: [] };
  const nodesResult = await query(
    `SELECT id,label,type,family,hex_color FROM nodes
     WHERE record_status='active' AND (LOWER(label)=ANY($1::text[]) OR id=ANY($1::text[]))
     ORDER BY label,id LIMIT 12`,
    [terms]
  );
  const ids = nodesResult.rows.map(node => node.id);
  if (!ids.length) return { sourceLayer: 'unresolved', nodes: [], routes: [] };
  const routesResult = await query(
    `SELECT e.id,e.source,e.target,e.type,e.confidence,s.label AS source_label,t.label AS target_label
     FROM edges e JOIN nodes s ON s.id=e.source JOIN nodes t ON t.id=e.target
     WHERE e.record_status='active' AND (e.source=ANY($1::text[]) OR e.target=ANY($1::text[]))
     ORDER BY CASE e.confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,e.id LIMIT 24`,
    [ids]
  );
  return {
    sourceLayer: 'approved_graph',
    nodes: nodesResult.rows.map(node => ({
      id: node.id, label: node.label, type: node.type, family: node.family, color: node.hex_color
    })),
    routes: routesResult.rows.map(route => ({
      id: route.id,
      source: { id: route.source, label: route.source_label },
      target: { id: route.target, label: route.target_label },
      type: route.type,
      confidence: route.confidence
    }))
  };
}
