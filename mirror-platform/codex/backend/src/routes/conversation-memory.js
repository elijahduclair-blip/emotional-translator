import crypto from 'node:crypto';
import express from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requirePasswordCurrent } from '../middleware/auth.js';

const router = express.Router();
const MAX_EVENT_CODE_POINTS = 20_000;
const DEFAULT_TRANSCRIPT_LIMIT = 100;
const MAX_TRANSCRIPT_LIMIT = 200;
const DEFAULT_CONTEXT_EVENTS = 24;
const MAX_CONTEXT_EVENTS = 40;
const DEFAULT_CONTEXT_CHARACTERS = 12_000;
const MAX_CONTEXT_CHARACTERS = 16_000;

router.use('/conversation-memory', requireAuth, requirePasswordCurrent);

router.post('/conversation-memory/events', async (req, res, next) => {
  try {
    const interactionId = boundedId(req.body?.interactionId, 'interactionId');
    const role = String(req.body?.role || '').trim();
    if (!['user', 'assistant'].includes(role)) throw httpError(400, 'role must be user or assistant.');
    const content = boundedContent(req.body?.content);
    const metadata = normalizeMetadata(req.body?.metadata);
    const id = crypto.randomUUID();
    const inserted = await query(
      `INSERT INTO private_conversation_events
         (id,user_id,interaction_id,role,content,metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT (user_id,interaction_id,role) DO NOTHING
       RETURNING id`,
      [id, req.user.sub, interactionId, role, content, JSON.stringify(metadata)]
    );
    if (inserted.rows.length) {
      const event = await readRankedEvent(req.user.sub, inserted.rows[0].id);
      return res.status(201).json({ event: serializeEvent(event), idempotent: false, boundary: memoryBoundary() });
    }
    const existing = await query(
      `WITH ranked AS (
         SELECT sequence_no,id,interaction_id,role,content,metadata,created_at,
                ROW_NUMBER() OVER (ORDER BY sequence_no) AS account_sequence
         FROM private_conversation_events WHERE user_id=$1
       )
       SELECT * FROM ranked WHERE interaction_id=$2 AND role=$3`,
      [req.user.sub, interactionId, role]
    );
    if (!existing.rows.length || existing.rows[0].content !== content) {
      throw httpError(409, 'This interaction event already exists with different content.');
    }
    return res.json({ event: serializeEvent(existing.rows[0]), idempotent: true, boundary: memoryBoundary() });
  } catch (error) {
    next(error);
  }
});

router.get('/conversation-memory/context', async (req, res, next) => {
  try {
    const maxEvents = boundedInteger(req.query.maxEvents, DEFAULT_CONTEXT_EVENTS, 1, MAX_CONTEXT_EVENTS);
    const maxCharacters = boundedInteger(req.query.maxCharacters, DEFAULT_CONTEXT_CHARACTERS, 1000, MAX_CONTEXT_CHARACTERS);
    const result = await query(
      `SELECT sequence_no,id,interaction_id,role,content,metadata,created_at,
              ROW_NUMBER() OVER (ORDER BY sequence_no) AS account_sequence
       FROM private_conversation_events WHERE user_id=$1
       ORDER BY account_sequence DESC
       LIMIT $2`,
      [req.user.sub, maxEvents + 1]
    );
    const available = result.rows;
    const selected = [];
    let usedCharacters = 0;
    for (const row of available.slice(0, maxEvents)) {
      const eventCharacters = [...String(row.content || '')].length;
      if (selected.length && usedCharacters + eventCharacters > maxCharacters) break;
      if (!selected.length && eventCharacters > maxCharacters) {
        selected.push({ ...row, content: [...String(row.content)].slice(-maxCharacters).join('') });
        usedCharacters = maxCharacters;
        break;
      }
      selected.push(row);
      usedCharacters += eventCharacters;
    }
    selected.reverse();
    res.json({
      version: 'private-conversation-memory.v1',
      events: selected.map(serializeEvent),
      eventCount: selected.length,
      usedCharacters,
      throughSequence: selected.length ? Number(selected[selected.length - 1].account_sequence) : null,
      truncated: available.length > selected.length,
      boundary: memoryBoundary()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/conversation-memory/transcript', async (req, res, next) => {
  try {
    const limit = boundedInteger(req.query.limit, DEFAULT_TRANSCRIPT_LIMIT, 1, MAX_TRANSCRIPT_LIMIT);
    const before = req.query.before === undefined ? null : boundedInteger(req.query.before, null, 1, Number.MAX_SAFE_INTEGER);
    const result = await query(
      `WITH ranked AS (
         SELECT sequence_no,id,interaction_id,role,content,metadata,created_at,
                ROW_NUMBER() OVER (ORDER BY sequence_no) AS account_sequence
         FROM private_conversation_events WHERE user_id=$1
       )
       SELECT * FROM ranked
       WHERE ($2::bigint IS NULL OR account_sequence < $2::bigint)
       ORDER BY account_sequence DESC
       LIMIT $3`,
      [req.user.sub, before, limit + 1]
    );
    const hasMore = result.rows.length > limit;
    const page = result.rows.slice(0, limit).reverse();
    res.json({
      version: 'private-conversation-memory.v1',
      events: page.map(serializeEvent),
      count: page.length,
      hasMore,
      nextBefore: hasMore && page.length ? Number(page[0].account_sequence) : null,
      boundary: memoryBoundary()
    });
  } catch (error) {
    next(error);
  }
});

function boundedId(value, label) {
  const text = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(text)) throw httpError(400, `${label} is required.`);
  return text;
}

function boundedContent(value) {
  const text = typeof value === 'string' ? value.normalize('NFC') : '';
  if (!text.trim()) throw httpError(400, 'content is required.');
  if ([...text].length > MAX_EVENT_CODE_POINTS) throw httpError(413, `Conversation events must be ${MAX_EVENT_CODE_POINTS} Unicode code points or fewer.`);
  return text;
}

function normalizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = ['personal_entrance', 'combined_shell', 'local_ai'].includes(value.source) ? value.source : 'personal_entrance';
  const graphSource = ['approved_graph', 'chromabridge_knowledge', 'user_graph', 'unresolved'].includes(value.graphSource)
    ? value.graphSource : 'unresolved';
  const contextThroughSequence = Number.isSafeInteger(Number(value.contextThroughSequence)) && Number(value.contextThroughSequence) > 0
    ? Number(value.contextThroughSequence) : null;
  const comparison = normalizeComparisonMetadata(value.comparison);
  return { source, graphSource, contextThroughSequence, ...(comparison ? { comparison } : {}) };
}

function normalizeComparisonMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 'ari-comparison.v1') return null;
  const comparedObservationSequences = Array.isArray(value.comparedObservationSequences)
    ? [...new Set(value.comparedObservationSequences.map(validSequence).filter(Boolean))].slice(0, 5)
    : [];
  const strongestObservationSequence = validSequence(value.strongestObservationSequence);
  return {
    version: 'ari-comparison.v1',
    mode: 'observation_only',
    comparedObservationSequences,
    strongestObservationSequence: comparedObservationSequences.includes(strongestObservationSequence)
      ? strongestObservationSequence : null,
    repeatedTokenCount: boundedCount(value.repeatedTokenCount, 12),
    repeatedPhraseCount: boundedCount(value.repeatedPhraseCount, 12),
    comparisonCreatesMeaning: false,
    graphMutationAllowed: false
  };
}

function validSequence(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function boundedCount(value, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : 0;
}

function serializeEvent(row) {
  return {
    sequence: Number(row.account_sequence),
    id: row.id,
    interactionId: row.interaction_id,
    role: row.role,
    content: row.content,
    metadata: row.metadata || {},
    createdAt: row.created_at
  };
}

async function readRankedEvent(userId, eventId) {
  const result = await query(
    `WITH ranked AS (
       SELECT sequence_no,id,interaction_id,role,content,metadata,created_at,
              ROW_NUMBER() OVER (ORDER BY sequence_no) AS account_sequence
       FROM private_conversation_events WHERE user_id=$1
     )
     SELECT * FROM ranked WHERE id=$2`,
    [userId, eventId]
  );
  return result.rows[0];
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw httpError(400, 'Invalid pagination or context limit.');
  return parsed;
}

function memoryBoundary() {
  return {
    mode: 'account_scoped_append_only_transcript',
    crossPersonAccessAllowed: false,
    sharedGraphMutationAllowed: false,
    semanticMutationAllowed: false,
    automaticLearningAllowed: false,
    reason: 'Conversation events are private episodic memory and context. They do not become shared semantic truth or community graph data.'
  };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export default router;
