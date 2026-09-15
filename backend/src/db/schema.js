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

      CREATE TABLE IF NOT EXISTS edge_creation_receipts (
        receipt_id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL REFERENCES graph_proposals(id) ON DELETE RESTRICT,
        edge_id TEXT,
        decision TEXT NOT NULL CHECK (decision IN ('VERIFY','REJECT','UNRESOLVED')),
        requested_action TEXT NOT NULL CHECK (requested_action IN ('COMMIT_EDGE','RECEIPT_ONLY')),
        idempotency_key TEXT NOT NULL UNIQUE,
        request_sha256 TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL,
        receipt JSONB NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('EDGE_AND_RECEIPT_COMMITTED','RECEIPT_ONLY_COMMITTED')),
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_edge_creation_receipts_proposal
        ON edge_creation_receipts(proposal_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_edge_creation_receipts_edge
        ON edge_creation_receipts(edge_id) WHERE edge_id IS NOT NULL;
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

    // Receipt-backed personal graph overlays. These records remain user-scoped and never enter shared edges.
    await query(`
      CREATE TABLE IF NOT EXISTS user_graph_relationships (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_label TEXT NOT NULL,
        source_key TEXT NOT NULL,
        target_label TEXT NOT NULL,
        target_key TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        confidence TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
        evidence TEXT NOT NULL,
        counterexample TEXT NOT NULL,
        source_feedback_id TEXT,
        learning_candidate_id TEXT,
        mutation_source TEXT NOT NULL DEFAULT 'user_directed',
        approved_by_user TEXT REFERENCES users(id),
        review_note TEXT,
        source_node_id TEXT REFERENCES nodes(id) ON DELETE RESTRICT,
        target_node_id TEXT REFERENCES nodes(id) ON DELETE RESTRICT,
        source_receipt_id TEXT REFERENCES edge_creation_receipts(receipt_id) ON DELETE RESTRICT,
        placement_idempotency_key TEXT,
        placement_request_sha256 TEXT,
        placed_by_user TEXT REFERENCES users(id),
        record_status TEXT NOT NULL DEFAULT 'active' CHECK (record_status IN ('active','retired')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS source_feedback_id TEXT;
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS learning_candidate_id TEXT;
      ALTER TABLE user_graph_relationships ALTER COLUMN source_feedback_id DROP NOT NULL;
      ALTER TABLE user_graph_relationships ALTER COLUMN learning_candidate_id DROP NOT NULL;
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS mutation_source TEXT NOT NULL DEFAULT 'user_directed';
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS approved_by_user TEXT REFERENCES users(id);
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS review_note TEXT;
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS source_node_id TEXT REFERENCES nodes(id) ON DELETE RESTRICT;
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS target_node_id TEXT REFERENCES nodes(id) ON DELETE RESTRICT;
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS source_receipt_id TEXT REFERENCES edge_creation_receipts(receipt_id) ON DELETE RESTRICT;
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS placement_idempotency_key TEXT;
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS placement_request_sha256 TEXT;
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS placed_by_user TEXT REFERENCES users(id);
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'user_graph_relationships_provenance_check'
        ) THEN
          ALTER TABLE user_graph_relationships
            ADD CONSTRAINT user_graph_relationships_provenance_check CHECK (
              (mutation_source = 'reviewed_feedback' AND source_feedback_id IS NOT NULL AND learning_candidate_id IS NOT NULL)
              OR
              (mutation_source = 'user_directed' AND approved_by_user IS NOT NULL AND review_note IS NOT NULL)
            );
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_user_graph_relationships_user
        ON user_graph_relationships(user_id,record_status,created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_graph_relationships_placement_idempotency
        ON user_graph_relationships(placement_idempotency_key) WHERE placement_idempotency_key IS NOT NULL;

      CREATE TABLE IF NOT EXISTS user_graph_history (
        id TEXT PRIMARY KEY,
        relationship_id TEXT NOT NULL REFERENCES user_graph_relationships(id) ON DELETE RESTRICT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL CHECK (action IN ('create','update','retire')),
        before_data JSONB,
        after_data JSONB NOT NULL,
        source_receipt_id TEXT NOT NULL REFERENCES edge_creation_receipts(receipt_id) ON DELETE RESTRICT,
        actor_user_id TEXT NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_user_graph_history_relationship
        ON user_graph_history(relationship_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_graph_history_user
        ON user_graph_history(user_id,created_at DESC);
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

    // Research inbox: external evidence candidates, never graph truth by themselves
    await query(`
      CREATE TABLE IF NOT EXISTS research_items (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'general',
        source_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_url TEXT NOT NULL,
        excerpt TEXT,
        published_at TIMESTAMP,
        retrieved_at TIMESTAMP NOT NULL DEFAULT NOW(),
        suggestions JSONB NOT NULL DEFAULT '{}'::jsonb,
        history_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        emotional_logic TEXT,
        boundary TEXT NOT NULL,
        counterexample TEXT NOT NULL,
        confidence TEXT NOT NULL DEFAULT 'low',
        status TEXT NOT NULL DEFAULT 'proposed',
        proposed_by TEXT NOT NULL REFERENCES users(id),
        reviewer TEXT REFERENCES users(id),
        review_note TEXT,
        graph_proposal_id TEXT REFERENCES graph_proposals(id),
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP
      );
    `);
    await query(`ALTER TABLE research_items ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'general';`);
    await query(`ALTER TABLE research_items ADD COLUMN IF NOT EXISTS history_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;`);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_research_items_status ON research_items(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_items_proposed_by ON research_items(proposed_by, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_items_kind ON research_items(kind, status, created_at DESC);
    `);

    // Foundation sessions: saved structure-only word analysis for Base44 and other frontends
    await query(`
      CREATE TABLE IF NOT EXISTS foundation_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        input_text TEXT NOT NULL,
        analysis_options JSONB NOT NULL DEFAULT '{}'::jsonb,
        stats JSONB NOT NULL DEFAULT '{}'::jsonb,
        word_counts JSONB NOT NULL DEFAULT '[]'::jsonb,
        co_occurrences JSONB NOT NULL DEFAULT '[]'::jsonb,
        pareto JSONB NOT NULL DEFAULT '[]'::jsonb,
        patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled session';
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS input_text TEXT NOT NULL DEFAULT '';
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS analysis_options JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS stats JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS word_counts JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS co_occurrences JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS pareto JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS patterns JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
      CREATE INDEX IF NOT EXISTS idx_foundation_sessions_created_at ON foundation_sessions(created_at DESC);
    `);

    console.log('? Schema created successfully');
  } catch (error) {
    console.error('? Schema creation failed:', error);
    throw error;
  }
}
