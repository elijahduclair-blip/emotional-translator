import { query } from './pool.js';

// Compatibility tables used by the separate approval API routes.

export async function createApprovalSchema() {
  try {
    // Shared Entries (with approval workflow)
    await query(`
      CREATE TABLE IF NOT EXISTS shared_entries (
        id TEXT PRIMARY KEY,
        content_type TEXT NOT NULL,
        content_id TEXT NOT NULL,
        content_data JSONB NOT NULL,
        status TEXT DEFAULT 'proposed',
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        approved_at TIMESTAMP,
        rejected_reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_shared_entries_status ON shared_entries(status);
      CREATE INDEX IF NOT EXISTS idx_shared_entries_created_by ON shared_entries(created_by);
    `);

    // Audit Log (who, what, when, why)
    await query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        user_id TEXT NOT NULL,
        old_value JSONB,
        new_value JSONB,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    `);

    console.log('? Approval schema created');
  } catch (error) {
    console.error('? Approval schema failed:', error);
    throw error;
  }
}
