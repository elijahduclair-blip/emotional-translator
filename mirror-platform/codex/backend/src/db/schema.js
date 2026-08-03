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

    // Runtime evaluations are recorded observations, not approved semantic truth.
    await query(`
      CREATE TABLE IF NOT EXISTS runtime_evaluations (
        id TEXT PRIMARY KEY,
        evaluation_id TEXT NOT NULL UNIQUE,
        user_id TEXT,
        input TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        climate_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
        evidence JSONB NOT NULL,
        boundary JSONB NOT NULL,
        translation JSONB NOT NULL DEFAULT '{}'::jsonb,
        graph_read JSONB,
        status TEXT NOT NULL DEFAULT 'recorded',
        created_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE runtime_evaluations ADD COLUMN IF NOT EXISTS translation JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE runtime_evaluations ADD COLUMN IF NOT EXISTS graph_read JSONB;
      CREATE INDEX IF NOT EXISTS idx_runtime_evaluations_fingerprint
        ON runtime_evaluations(fingerprint, created_at DESC);
    `);

    // Shared ChromaBridge vocabulary. This is reference knowledge, not memory.
    await query(`
      CREATE TABLE IF NOT EXISTS knowledge_nodes (
        id TEXT PRIMARY KEY,
        tier TEXT NOT NULL CHECK (tier IN ('base', 'bridge', 'shade', 'words')),
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        hex_color TEXT,
        semantic_code TEXT,
        coordinate_x DOUBLE PRECISION NOT NULL,
        coordinate_y DOUBLE PRECISION NOT NULL,
        coordinate_z DOUBLE PRECISION NOT NULL,
        fixed_anchor TEXT,
        degree_of_vision NUMERIC(6, 3),
        decimal_address TEXT,
        address_depth INTEGER,
        placement_basis TEXT,
        parents TEXT[] NOT NULL DEFAULT '{}',
        synonyms TEXT[] NOT NULL DEFAULT '{}',
        opposites TEXT[] NOT NULL DEFAULT '{}',
        semantic_labels TEXT[] NOT NULL DEFAULT '{}',
        source_document TEXT NOT NULL,
        source_sha256 TEXT NOT NULL,
        source_page INTEGER NOT NULL,
        source_row INTEGER NOT NULL,
        relationship_extraction_confidence TEXT NOT NULL,
        provenance JSONB NOT NULL,
        imported_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (source_sha256, source_page, source_row)
      );
      CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_name ON knowledge_nodes(normalized_name);
      CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_tier ON knowledge_nodes(tier);
      CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_parents ON knowledge_nodes USING GIN(parents);
      CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_synonyms ON knowledge_nodes USING GIN(synonyms);
      CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_opposites ON knowledge_nodes USING GIN(opposites);
      ALTER TABLE knowledge_nodes ADD COLUMN IF NOT EXISTS fixed_anchor TEXT;
      ALTER TABLE knowledge_nodes ADD COLUMN IF NOT EXISTS degree_of_vision NUMERIC(6, 3);
      ALTER TABLE knowledge_nodes ADD COLUMN IF NOT EXISTS decimal_address TEXT;
      ALTER TABLE knowledge_nodes ADD COLUMN IF NOT EXISTS address_depth INTEGER;
      ALTER TABLE knowledge_nodes ADD COLUMN IF NOT EXISTS placement_basis TEXT;
      CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_decimal_address ON knowledge_nodes(decimal_address);

      CREATE TABLE IF NOT EXISTS knowledge_edges (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
        relation_type TEXT NOT NULL CHECK (relation_type IN ('parent', 'synonym', 'antonym')),
        target_name TEXT NOT NULL,
        normalized_target_name TEXT NOT NULL,
        target_id TEXT REFERENCES knowledge_nodes(id) ON DELETE SET NULL,
        evidence JSONB NOT NULL,
        source_document TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source ON knowledge_edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target ON knowledge_edges(target_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target_name ON knowledge_edges(normalized_target_name);
      CREATE INDEX IF NOT EXISTS idx_knowledge_edges_relation ON knowledge_edges(relation_type);
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
