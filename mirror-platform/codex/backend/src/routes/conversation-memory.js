import crypto from 'node:crypto';
import express from 'express';
import { pool, query } from '../db/pool.js';
import { requireAuth, requirePasswordCurrent } from '../middleware/auth.js';
import { extractJournalDocument } from '../lib/journal-document-extraction.js';
import { JOURNAL_OCR_VERSION, ocrJournalPdf } from '../lib/journal-document-ocr.js';

const router = express.Router();
const MAX_EVENT_CODE_POINTS = 20_000;
const DEFAULT_TRANSCRIPT_LIMIT = 100;
const MAX_TRANSCRIPT_LIMIT = 200;
const DEFAULT_CONTEXT_EVENTS = 24;
const MAX_CONTEXT_EVENTS = 40;
const DEFAULT_CONTEXT_CHARACTERS = 12_000;
const MAX_CONTEXT_CHARACTERS = 16_000;
const MAX_IMPORT_EVENTS = 25;
const MAX_ARCHIVE_CONTEXT_EVENTS = 8;
const MAX_ARCHIVE_CONTEXT_CHARACTERS = 6_000;
const MAX_JOURNAL_CONTEXT_CHUNKS = 6;
const MAX_JOURNAL_CONTEXT_CHARACTERS = 8_000;
let journalOcrQueue = Promise.resolve();

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
                ROW_NUMBER() OVER (ORDER BY sequence_no) AS account_sequence,
                COUNT(*) FILTER (WHERE role='user') OVER () AS total_user_events,
                COUNT(*) FILTER (WHERE role='assistant') OVER () AS total_assistant_events
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

router.post('/conversation-memory/imports/codex', async (req, res, next) => {
  try {
    const threadId = boundedId(req.body?.threadId, 'threadId');
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    if (!events.length || events.length > MAX_IMPORT_EVENTS) {
      throw httpError(400, `events must contain between 1 and ${MAX_IMPORT_EVENTS} conversation events.`);
    }

    let imported = 0;
    let existing = 0;
    for (const candidate of events) {
      const event = normalizeCodexImportEvent(candidate);
      const inserted = await query(
        `INSERT INTO private_conversation_archive_events
           (id,user_id,source,source_thread_id,source_event_id,role,content,source_created_at,metadata)
         VALUES ($1,$2,'codex_history',$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT (user_id,source,source_thread_id,source_event_id) DO NOTHING
         RETURNING id`,
        [
          crypto.randomUUID(), req.user.sub, threadId, event.sourceEventId,
          event.role === 'assistant' ? 'codex_assistant' : 'user', event.content,
          event.createdAt, JSON.stringify({
            source: 'codex_history', sourceRole: event.role === 'assistant' ? 'codex' : 'person',
            historical: true, developmentalContext: true, automaticModelTrainingAllowed: false,
            sharedGraphMutationAllowed: false
          })
        ]
      );
      if (inserted.rows.length) imported += 1;
      else existing += 1;
    }

    const total = await query(
      `SELECT COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE role='user')::int AS person_events,
              COUNT(*) FILTER (WHERE role='codex_assistant')::int AS codex_events
       FROM private_conversation_archive_events
       WHERE user_id=$1 AND source='codex_history'`,
      [req.user.sub]
    );
    return res.status(imported ? 201 : 200).json({
      version: 'private-developmental-archive.v1',
      batch: { received: events.length, imported, existing },
      archive: {
        eventCount: Number(total.rows[0]?.count || 0),
        personEventCount: Number(total.rows[0]?.person_events || 0),
        codexEventCount: Number(total.rows[0]?.codex_events || 0)
      },
      boundary: archiveBoundary()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/conversation-memory/documents', async (req, res, next) => {
  let client;
  try {
    if (req.body?.privacyScope !== undefined && req.body.privacyScope !== 'personal') {
      throw httpError(400, 'Journal files are private to the authenticated person in this version.');
    }
    const extracted = await extractJournalDocument(req.body);
    const existing = await query(
      `SELECT * FROM private_journal_documents WHERE user_id=$1 AND sha256=$2`,
      [req.user.sub, extracted.sha256]
    );
    if (existing.rows.length) {
      return res.json({
        document: serializeJournalDocument(existing.rows[0]),
        idempotent: true,
        boundary: journalDocumentBoundary()
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const documentId = crypto.randomUUID();
    const inserted = await client.query(
      `INSERT INTO private_journal_documents
         (id,user_id,file_name,extension,media_type,size_bytes,sha256,original_data,privacy_scope,
          extraction_version,extraction_status,character_count,unit_count,warnings,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'personal',$9,$10,$11,$12,$13::jsonb,$14::jsonb)
       RETURNING *`,
      [
        documentId, req.user.sub, extracted.fileName, extracted.extension, extracted.mediaType,
        extracted.sizeBytes, extracted.sha256, extracted.data, extracted.version, extracted.status,
        extracted.characterCount, extracted.unitCount, JSON.stringify(extracted.warnings),
        JSON.stringify({
          source: 'uploaded_journal_file',
          searchableChunkCount: extracted.chunks.length,
          documentContentIsInstruction: false,
          automaticModelTrainingAllowed: false,
          sharedGraphMutationAllowed: false
        })
      ]
    );
    for (const chunk of extracted.chunks) {
      await client.query(
        `INSERT INTO private_journal_document_chunks
           (id,document_id,ordinal,locator,content,character_count)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
        [crypto.randomUUID(), documentId, chunk.ordinal, JSON.stringify(chunk.locator), chunk.content, chunk.characterCount]
      );
    }
    await client.query('COMMIT');
    return res.status(201).json({
      document: serializeJournalDocument(inserted.rows[0]),
      idempotent: false,
      boundary: journalDocumentBoundary()
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client?.release();
  }
});

router.get('/conversation-memory/documents', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM private_journal_documents
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.sub]
    );
    res.json({
      version: 'private-journal-files.v1',
      documents: result.rows.map(serializeJournalDocument),
      count: result.rows.length,
      supportedPrivacyScopes: ['personal'],
      boundary: journalDocumentBoundary()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/conversation-memory/documents/:documentId/ocr', async (req, res, next) => {
  try {
    const documentId = boundedId(req.params.documentId, 'documentId');
    const selected = await query(
      `SELECT * FROM private_journal_documents WHERE id=$1 AND user_id=$2`,
      [documentId, req.user.sub]
    );
    if (!selected.rows.length) throw httpError(404, 'Journal file not found.');
    const current = selected.rows[0];
    if (current.extension !== '.pdf') throw httpError(409, 'Private OCR is available for scanned PDF journal files.');
    if (current.extraction_status === 'ready') {
      return res.json({
        document: serializeJournalDocument(current),
        queued: false,
        idempotent: true,
        boundary: journalDocumentBoundary()
      });
    }
    if (current.extraction_status === 'processing_ocr') {
      return res.status(202).json({
        document: serializeJournalDocument(current),
        queued: true,
        idempotent: true,
        boundary: journalDocumentBoundary()
      });
    }

    const queued = await query(
      `UPDATE private_journal_documents
       SET extraction_status='processing_ocr',
           warnings='[]'::jsonb,
           metadata=metadata || $3::jsonb
       WHERE id=$1 AND user_id=$2 AND extraction_status IN ('needs_ocr','ocr_failed')
       RETURNING *`,
      [documentId, req.user.sub, JSON.stringify({
        ocr: {
          version: JOURNAL_OCR_VERSION,
          status: 'queued',
          processedPages: 0,
          queuedAt: new Date().toISOString()
        }
      })]
    );
    if (!queued.rows.length) throw httpError(409, 'This journal source cannot start OCR in its current state.');
    enqueueJournalOcr({
      documentId,
      userId: req.user.sub,
      fileName: current.file_name,
      data: current.original_data
    });
    return res.status(202).json({
      document: serializeJournalDocument(queued.rows[0]),
      queued: true,
      idempotent: false,
      boundary: journalDocumentBoundary()
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/conversation-memory/documents/:documentId', async (req, res, next) => {
  try {
    const documentId = boundedId(req.params.documentId, 'documentId');
    const result = await query(
      `DELETE FROM private_journal_documents WHERE id=$1 AND user_id=$2 RETURNING id,file_name`,
      [documentId, req.user.sub]
    );
    if (!result.rows.length) throw httpError(404, 'Journal file not found.');
    res.json({ deleted: true, documentId: result.rows[0].id, fileName: result.rows[0].file_name });
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
              ROW_NUMBER() OVER (ORDER BY sequence_no) AS account_sequence,
              COUNT(*) FILTER (WHERE role='user') OVER () AS total_user_events,
              COUNT(*) FILTER (WHERE role='assistant') OVER () AS total_assistant_events
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
    const personObservationCount = Number(available[0]?.total_user_events || 0);
    const ariResponseCount = Number(available[0]?.total_assistant_events || 0);
    const [archive, journalDocuments] = await Promise.all([
      readArchiveContext(req.user.sub, req.query.query),
      readJournalContext(req.user.sub, req.query.query)
    ]);
    res.json({
      version: 'private-conversation-memory.v1',
      events: selected.map(serializeEvent),
      eventCount: selected.length,
      usedCharacters,
      throughSequence: selected.length ? Number(selected[selected.length - 1].account_sequence) : null,
      truncated: available.length > selected.length,
      developmentalArchive: archive,
      journalDocuments,
      branch: buildPersonalAriBranch(req.user.sub, selected, personObservationCount, ariResponseCount),
      boundary: memoryBoundary()
    });
  } catch (error) {
    next(error);
  }
});

function normalizeCodexImportEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'Each imported event must be an object.');
  const sourceEventId = boundedId(value.sourceEventId, 'sourceEventId');
  const role = String(value.role || '').trim();
  if (!['user', 'assistant'].includes(role)) throw httpError(400, 'Imported event role must be user or assistant.');
  const content = boundedContent(value.content);
  const createdAt = new Date(String(value.createdAt || ''));
  if (!Number.isFinite(createdAt.getTime())) throw httpError(400, 'Imported event createdAt must be a valid timestamp.');
  return { sourceEventId, role, content, createdAt: createdAt.toISOString() };
}

async function readArchiveContext(userId, value) {
  const queryText = typeof value === 'string' ? value.normalize('NFC').trim().slice(0, 1_000) : '';
  const tokens = archiveQueryTokens(queryText);
  let result;
  let selection = 'recent';
  if (tokens.length) {
    result = await query(
      `SELECT id,source_thread_id,source_event_id,role,content,source_created_at,metadata,
              (SELECT COUNT(*) FROM unnest($2::text[]) token
               WHERE to_tsvector('simple',content) @@ plainto_tsquery('simple',token))::int AS relevance
       FROM private_conversation_archive_events
       WHERE user_id=$1 AND source='codex_history'
         AND EXISTS (SELECT 1 FROM unnest($2::text[]) token
                     WHERE to_tsvector('simple',content) @@ plainto_tsquery('simple',token))
       ORDER BY relevance DESC,source_created_at DESC
       LIMIT $3`,
      [userId, tokens, MAX_ARCHIVE_CONTEXT_EVENTS + 1]
    );
    selection = 'exact_lexical_relevance';
  }
  if (!result?.rows.length) {
    result = await query(
      `SELECT id,source_thread_id,source_event_id,role,content,source_created_at,metadata,0::int AS relevance
       FROM private_conversation_archive_events
       WHERE user_id=$1 AND source='codex_history'
       ORDER BY source_created_at DESC
       LIMIT $2`,
      [userId, MAX_ARCHIVE_CONTEXT_EVENTS + 1]
    );
    selection = 'recent';
  }

  const chosen = [];
  let usedCharacters = 0;
  for (const row of result.rows.slice(0, MAX_ARCHIVE_CONTEXT_EVENTS)) {
    const length = [...String(row.content || '')].length;
    if (chosen.length && usedCharacters + length > MAX_ARCHIVE_CONTEXT_CHARACTERS) continue;
    const content = length > MAX_ARCHIVE_CONTEXT_CHARACTERS
      ? [...String(row.content)].slice(0, MAX_ARCHIVE_CONTEXT_CHARACTERS).join('')
      : row.content;
    chosen.push({ ...row, content });
    usedCharacters += Math.min(length, MAX_ARCHIVE_CONTEXT_CHARACTERS);
  }
  chosen.sort((left, right) => new Date(left.source_created_at) - new Date(right.source_created_at));
  return {
    version: 'private-developmental-archive.v1',
    consulted: chosen.length > 0,
    source: 'codex_history',
    selection,
    events: chosen.map(serializeArchiveEvent),
    eventCount: chosen.length,
    usedCharacters,
    truncated: result.rows.length > chosen.length,
    boundary: archiveBoundary()
  };
}

async function readJournalContext(userId, value) {
  const queryText = typeof value === 'string' ? value.normalize('NFC').trim().slice(0, 1_000) : '';
  const tokens = archiveQueryTokens(queryText);
  let result = { rows: [] };
  let selection = 'none';
  if (tokens.length) {
    result = await query(
      `SELECT d.id AS document_id,d.file_name,d.media_type,d.sha256,d.created_at,
              c.ordinal,c.locator,c.content,
              (SELECT COUNT(*) FROM unnest($2::text[]) token
               WHERE to_tsvector('simple',c.content) @@ plainto_tsquery('simple',token))::int AS relevance
       FROM private_journal_document_chunks c
       JOIN private_journal_documents d ON d.id=c.document_id
       WHERE d.user_id=$1
         AND EXISTS (SELECT 1 FROM unnest($2::text[]) token
                     WHERE to_tsvector('simple',c.content) @@ plainto_tsquery('simple',token))
       ORDER BY relevance DESC,d.created_at DESC,c.ordinal
       LIMIT $3`,
      [userId, tokens, MAX_JOURNAL_CONTEXT_CHUNKS + 1]
    );
    selection = 'exact_lexical_relevance';
  }
  if (!result.rows.length && documentReferenceRequested(queryText)) {
    result = await query(
      `WITH latest AS (
         SELECT id FROM private_journal_documents WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1
       )
       SELECT d.id AS document_id,d.file_name,d.media_type,d.sha256,d.created_at,
              c.ordinal,c.locator,c.content,0::int AS relevance
       FROM private_journal_document_chunks c
       JOIN private_journal_documents d ON d.id=c.document_id
       JOIN latest ON latest.id=d.id
       ORDER BY c.ordinal LIMIT $2`,
      [userId, MAX_JOURNAL_CONTEXT_CHUNKS + 1]
    );
    selection = result.rows.length ? 'latest_document_reference' : 'none';
  }

  const excerpts = [];
  let usedCharacters = 0;
  for (const row of result.rows.slice(0, MAX_JOURNAL_CONTEXT_CHUNKS)) {
    const remaining = MAX_JOURNAL_CONTEXT_CHARACTERS - usedCharacters;
    if (remaining <= 0) break;
    const points = [...String(row.content || '')];
    const content = points.slice(0, remaining).join('');
    if (!content) continue;
    excerpts.push({
      documentId: row.document_id,
      fileName: row.file_name,
      mediaType: row.media_type,
      sha256: row.sha256,
      ordinal: Number(row.ordinal),
      locator: row.locator || {},
      content,
      relevance: Number(row.relevance || 0)
    });
    usedCharacters += [...content].length;
  }
  const sources = [...new Map(excerpts.map(excerpt => [excerpt.documentId, {
    documentId: excerpt.documentId,
    fileName: excerpt.fileName,
    mediaType: excerpt.mediaType,
    sha256: excerpt.sha256
  }])).values()];
  return {
    version: 'private-journal-context.v1',
    consulted: excerpts.length > 0,
    source: 'uploaded_journal_files',
    selection,
    sources,
    excerpts,
    excerptCount: excerpts.length,
    usedCharacters,
    truncated: result.rows.length > excerpts.length,
    boundary: journalDocumentBoundary()
  };
}

function documentReferenceRequested(value) {
  return /\b(?:this|the|my|latest|uploaded|attached)\s+(?:file|document|pdf|attachment|spreadsheet|presentation|book)\b|\b(?:summari[sz]e|scan|read)\s+(?:this|the|my|latest|uploaded|attached)\b/i.test(String(value || ''));
}

function archiveQueryTokens(value) {
  const stop = new Set(['about','after','again','also','and','are','because','been','but','can','could','does','for','from','have','her','here','how','into','just','like','meaning','more','need','not','our','should','that','the','their','them','then','there','these','they','this','those','through','want','was','were','what','when','where','which','who','why','will','with','would','you','your']);
  return [...new Set((String(value).toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu) || [])
    .filter(token => token.length >= 3 && !stop.has(token)))]
    .slice(0, 8);
}

function serializeArchiveEvent(row) {
  return {
    id: row.id,
    source: 'codex_history',
    sourceThreadId: row.source_thread_id,
    sourceEventId: row.source_event_id,
    speaker: row.role === 'codex_assistant' ? 'Codex' : 'You',
    role: row.role === 'codex_assistant' ? 'assistant_reference' : 'user',
    content: row.content,
    relevance: Number(row.relevance || 0),
    createdAt: row.source_created_at
  };
}

function archiveBoundary() {
  return {
    mode: 'private_developmental_context',
    crossPersonAccessAllowed: false,
    codexSpeechBecomesAriSpeech: false,
    sharedGraphMutationAllowed: false,
    semanticMutationAllowed: false,
    automaticLearningAllowed: false,
    automaticModelTrainingAllowed: false,
    contextualAdaptationAllowed: true,
    reason: 'Imported Codex conversations remain a private attributed archive. ARI may consult them for continuity, while user corrections retain their speaker and Codex responses remain reference dialogue rather than ARI identity or authority.'
  };
}

function serializeJournalDocument(row) {
  const ocr = row.metadata?.ocr && typeof row.metadata.ocr === 'object' ? row.metadata.ocr : null;
  return {
    id: row.id,
    fileName: row.file_name,
    extension: row.extension,
    mediaType: row.media_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    privacyScope: row.privacy_scope,
    extraction: {
      version: row.extraction_version,
      status: row.extraction_status,
      characterCount: Number(row.character_count || 0),
      unitCount: Number(row.unit_count || 0),
      warnings: Array.isArray(row.warnings) ? row.warnings : [],
      ocr: ocr ? {
        version: String(ocr.version || JOURNAL_OCR_VERSION),
        status: String(ocr.status || row.extraction_status),
        pageCount: Number(ocr.pageCount || 0),
        processedPages: Number(ocr.processedPages || 0),
        recognizedPageCount: Number(ocr.recognizedPageCount || 0),
        averageConfidence: Number(ocr.averageConfidence || 0),
        queuedAt: ocr.queuedAt || null,
        completedAt: ocr.completedAt || null
      } : null
    },
    createdAt: row.created_at
  };
}

function journalDocumentBoundary() {
  return {
    mode: 'private_journal_source',
    crossPersonAccessAllowed: false,
    documentContentIsInstruction: false,
    sharedGraphMutationAllowed: false,
    semanticMutationAllowed: false,
    automaticLearningAllowed: false,
    automaticModelTrainingAllowed: false,
    contextualRetrievalAllowed: true,
    reason: 'Uploaded files remain private attributed journal sources. Their contents may be quoted as context but never execute as instructions or silently become shared meaning.'
  };
}

function enqueueJournalOcr(job) {
  journalOcrQueue = journalOcrQueue
    .then(() => runJournalOcr(job), () => runJournalOcr(job))
    .catch(error => {
      console.error('Private journal OCR queue failure:', error instanceof Error ? error.message : 'unknown failure');
    });
}

async function runJournalOcr({ documentId, userId, fileName, data }) {
  try {
    await query(
      `UPDATE private_journal_documents
       SET metadata=metadata || $3::jsonb
       WHERE id=$1 AND user_id=$2 AND extraction_status='processing_ocr'`,
      [documentId, userId, JSON.stringify({
        ocr: {
          version: JOURNAL_OCR_VERSION,
          status: 'processing',
          processedPages: 0,
          startedAt: new Date().toISOString()
        }
      })]
    );
    const extracted = await ocrJournalPdf(data, {
      onPageComplete(progress) {
        return query(
          `UPDATE private_journal_documents
           SET metadata=metadata || $3::jsonb
           WHERE id=$1 AND user_id=$2 AND extraction_status='processing_ocr'`,
          [documentId, userId, JSON.stringify({
            ocr: {
              version: JOURNAL_OCR_VERSION,
              status: 'processing',
              pageCount: progress.pageCount,
              processedPages: progress.pageNumber,
              recognizedPageCount: progress.recognizedPageCount
            }
          })]
        ).catch(() => {});
      }
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM private_journal_document_chunks WHERE document_id=$1`, [documentId]);
      for (const chunk of extracted.chunks) {
        await client.query(
          `INSERT INTO private_journal_document_chunks
             (id,document_id,ordinal,locator,content,character_count)
           VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
          [crypto.randomUUID(), documentId, chunk.ordinal, JSON.stringify(chunk.locator), chunk.content, chunk.characterCount]
        );
      }
      await client.query(
        `UPDATE private_journal_documents
         SET extraction_version=$3,
             extraction_status='ready',
             character_count=$4,
             unit_count=$5,
             warnings=$6::jsonb,
             metadata=metadata || $7::jsonb
         WHERE id=$1 AND user_id=$2`,
        [documentId, userId, extracted.version, extracted.characterCount, extracted.unitCount,
          JSON.stringify(extracted.warnings), JSON.stringify({
            searchableChunkCount: extracted.chunks.length,
            ocr: {
              version: extracted.version,
              status: 'ready',
              pageCount: extracted.pageCount,
              processedPages: extracted.pageCount,
              recognizedPageCount: extracted.recognizedPageCount,
              averageConfidence: extracted.averageConfidence,
              completedAt: new Date().toISOString()
            }
          })]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const message = journalOcrFailureMessage(error, fileName);
    await query(
      `UPDATE private_journal_documents
       SET extraction_status='ocr_failed',
           warnings=$3::jsonb,
           metadata=metadata || $4::jsonb
       WHERE id=$1 AND user_id=$2`,
      [documentId, userId, JSON.stringify([message]), JSON.stringify({
        ocr: {
          version: JOURNAL_OCR_VERSION,
          status: 'failed',
          failedAt: new Date().toISOString()
        }
      })]
    ).catch(() => {});
    console.error(`Private journal OCR failed for ${documentId}:`, error instanceof Error ? error.message : 'unknown failure');
  }
}

function journalOcrFailureMessage(error, fileName) {
  const message = String(error?.message || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 300);
  if (message) return message;
  return `${String(fileName || 'The scanned PDF').slice(0, 180)} could not be read by the private OCR engine.`;
}

router.get('/conversation-memory/transcript', async (req, res, next) => {
  try {
    const limit = boundedInteger(req.query.limit, DEFAULT_TRANSCRIPT_LIMIT, 1, MAX_TRANSCRIPT_LIMIT);
    const before = req.query.before === undefined ? null : boundedInteger(req.query.before, null, 1, Number.MAX_SAFE_INTEGER);
    const [result, totals] = await Promise.all([query(
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
    ), query(
      `SELECT COUNT(*) FILTER (WHERE role='user')::int AS person_observations,
              COUNT(*) FILTER (WHERE role='assistant')::int AS ari_responses
       FROM private_conversation_events WHERE user_id=$1`,
      [req.user.sub]
    )]);
    const hasMore = result.rows.length > limit;
    const page = result.rows.slice(0, limit).reverse();
    res.json({
      version: 'private-conversation-memory.v1',
      events: page.map(serializeEvent),
      count: page.length,
      hasMore,
      nextBefore: hasMore && page.length ? Number(page[0].account_sequence) : null,
      branch: buildPersonalAriBranch(
        req.user.sub,
        page,
        Number(totals.rows[0]?.person_observations || 0),
        Number(totals.rows[0]?.ari_responses || 0)
      ),
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

function buildPersonalAriBranch(userId, rows, personObservationCount, ariResponseCount) {
  const personEvents = rows.filter(row => row.role === 'user');
  const moves = personEvents.map(row => classifyConversationMove(row.content));
  const moveCounts = moves.reduce((counts, move) => {
    counts[move] = (counts[move] || 0) + 1;
    return counts;
  }, {});
  const lengths = personEvents.map(row => [...String(row.content || '')].length).sort((left, right) => left - right);
  const medianLength = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 0;
  return {
    version: 'personal-ari-branch.v1',
    branchId: personalBranchId(userId),
    scope: 'authenticated_person_only',
    absorption: {
      personObservationCount,
      ariResponseCount,
      contextWindowObservationCount: personEvents.length,
      latestMove: moves.at(-1) || null
    },
    adaptation: {
      mode: 'conversation_context_not_model_training',
      expressionPacing: medianLength === 0 ? 'unestablished' : medianLength <= 60 ? 'concise' : medianLength <= 240 ? 'balanced' : 'expansive',
      recentMoveCounts: moveCounts,
      recentMoves: moves.slice(-8)
    },
    boundary: {
      crossPersonAccessAllowed: false,
      sharedGraphMutationAllowed: false,
      automaticModelTrainingAllowed: false,
      contextualAdaptationAllowed: true
    }
  };
}

function personalBranchId(userId) {
  const secret = String(process.env.AUTH_SECRET || 'community-garden-personal-ari-branch');
  return `ari_${crypto.createHmac('sha256', secret).update(String(userId)).digest('hex').slice(0, 16)}`;
}

function classifyConversationMove(value) {
  const text = String(value || '').normalize('NFC').toLocaleLowerCase('en-US').trim();
  const words = text.match(/[\p{L}\p{N}]+/gu) || [];
  if (/^(?:hey|hello|hi|hiya|yo)(?:\s+(?:ari|there))?[!.?]*$/u.test(text)) return 'greeting';
  if (/^(?:no\b|not\s+quite\b|i\s+mean\b|what\s+i\s+mean\b|you\s+(?:do not|don't)\s+understand\b|correction\b)/u.test(text)) return 'correction';
  if (/\?$/.test(text) || /^(?:what|why|when|where|who|which|how|can|could|do|does|did|is|are|will|would|should)\b/u.test(text)) return 'question';
  if (/\b(?:i want you to|remember that|learn that|means that|should|the rule is|an example is)\b/u.test(text)) return 'teaching';
  if (/\b(?:i think|i feel|i believe|i notice|i am|i'm)\b/u.test(text) && words.length >= 5) return 'reflection';
  return words.length <= 4 ? 'brief_statement' : 'continuation';
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
    automaticModelTrainingAllowed: false,
    contextualAdaptationAllowed: true,
    reason: 'Conversation events are absorbed as private episodic context for this person ARI branch. They do not become model weights, shared semantic truth, or community graph data.'
  };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export default router;
