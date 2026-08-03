import express from 'express';
import { query } from '../db/pool.js';
import crypto from 'crypto';

const router = express.Router();

// Helper: log audit trail
async function auditLog(entityType, entityId, action, userId, oldValue, newValue, reason) {
  const logId = crypto.randomUUID();
  await query(
    `INSERT INTO audit_log (id, entity_type, entity_id, action, user_id, old_value, new_value, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [logId, entityType, entityId, action, userId, JSON.stringify(oldValue), JSON.stringify(newValue), reason]
  );
}

// Get all pending entries for review
router.get('/shared-entries', async (req, res, next) => {
  try {
    const { status = 'proposed', limit = 50, offset = 0 } = req.query;
    
    let query_str = 'SELECT * FROM shared_entries';
    const params = [];
    
    if (status) {
      query_str += ` WHERE status = $${params.length + 1}`;
      params.push(status);
    }
    
    query_str += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(query_str, params);
    res.json({ entries: result.rows, total: result.rows.length });
  } catch (error) {
    next(error);
  }
});

// Propose a new shared entry
router.post('/shared-entries', async (req, res, next) => {
  try {
    const { content_type, content_id, content_data, created_by } = req.body;
    
    if (!content_type || !content_id || !content_data || !created_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const entryId = crypto.randomUUID();
    
    const result = await query(
      `INSERT INTO shared_entries (id, content_type, content_id, content_data, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [entryId, content_type, content_id, JSON.stringify(content_data), 'proposed', created_by]
    );

    await auditLog('shared_entry', entryId, 'proposed', created_by, null, result.rows[0], 'Initial proposal');

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Review an entry (approve or reject)
router.post('/shared-entries/:id/review', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reviewed_by, review_notes, reason } = req.body;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approved" or "rejected"' });
    }

    const entryResult = await query('SELECT * FROM shared_entries WHERE id = $1', [id]);
    if (entryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const oldEntry = entryResult.rows[0];
    
    const updateQuery = action === 'approved'
      ? `UPDATE shared_entries SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3, approved_at = NOW()
         WHERE id = $4 RETURNING *`
      : `UPDATE shared_entries SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3, rejected_reason = $5
         WHERE id = $4 RETURNING *`;

    const params = action === 'approved'
      ? [action, reviewed_by, review_notes, id]
      : [action, reviewed_by, review_notes, id, reason];

    const result = await query(updateQuery, params);

    await auditLog('shared_entry', id, action, reviewed_by, oldEntry, result.rows[0], reason || review_notes);

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get audit trail for an entry
router.get('/shared-entries/:id/audit', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT * FROM audit_log WHERE entity_type = 'shared_entry' AND entity_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    res.json({ auditTrail: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
