import { query } from './pool.js';

export async function createSchema() {
  try {
    // Nodes
    await query(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        type TEXT NOT NULL,
        family TEXT,
        hex_color TEXT,
        metadata JSONB,
        record_status TEXT NOT NULL DEFAULT 'active',
        revision INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE nodes ADD COLUMN IF NOT EXISTS record_status TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE nodes ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE nodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_family ON nodes(family);
    `);

    // Edges
    await query(`
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL REFERENCES nodes(id),
        target TEXT NOT NULL REFERENCES nodes(id),
        type TEXT NOT NULL,
        evidence TEXT,
        confidence TEXT,
        evidence_data JSONB,
        record_status TEXT NOT NULL DEFAULT 'active',
        revision INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE edges ADD COLUMN IF NOT EXISTS evidence_data JSONB;
      ALTER TABLE edges ADD COLUMN IF NOT EXISTS record_status TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE edges ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE edges ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
    `);

    // Governance: proposals and immutable change history
    await query(`
      CREATE TABLE IF NOT EXISTS graph_proposals (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL DEFAULT 'create',
        target_id TEXT,
        payload JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'proposed',
        author TEXT NOT NULL,
        rationale TEXT NOT NULL,
        reviewer TEXT,
        review_note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        decided_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_graph_proposals_status ON graph_proposals(status);

      CREATE TABLE IF NOT EXISTS graph_history (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        before_data JSONB,
        after_data JSONB,
        author TEXT NOT NULL,
        reason TEXT NOT NULL,
        proposal_id TEXT REFERENCES graph_proposals(id),
        created_at TIMESTAMP DEFAULT NOW(),
        undone_at TIMESTAMP
      );
      ALTER TABLE graph_history ADD COLUMN IF NOT EXISTS undone_at TIMESTAMP;
      CREATE INDEX IF NOT EXISTS idx_graph_history_entity ON graph_history(entity_type, entity_id, created_at DESC);
    `);

    // Themes
    await query(`
      CREATE TABLE IF NOT EXISTS themes (
        id TEXT PRIMARY KEY,
        cues TEXT[],
        source TEXT,
        filter TEXT,
        theme TEXT,
        anchor_ids TEXT[],
        route TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Emotions
    await query(`
      CREATE TABLE IF NOT EXISTS emotions (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        landed_families TEXT[],
        confidence TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Common Words
    await query(`
      CREATE TABLE IF NOT EXISTS common_words (
        id TEXT PRIMARY KEY,
        word TEXT NOT NULL UNIQUE,
        colors TEXT[],
        associations TEXT[],
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Users
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        token_version INTEGER NOT NULL DEFAULT 1,
        password_changed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
    `);

    // User Profiles
    await query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
    `);

    // User Concepts
    await query(`
      CREATE TABLE IF NOT EXISTS user_concepts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        concept_name TEXT NOT NULL,
        theme_category TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('? Schema created successfully');
  } catch (error) {
    console.error('? Schema creation failed:', error);
    throw error;
  }
}
