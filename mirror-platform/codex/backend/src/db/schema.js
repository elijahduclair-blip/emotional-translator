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

    // Braille Runtime modules are governed drafts. Activation may create a graph
    // proposal, but never writes directly to approved nodes or edges.
    await query(`
      CREATE TABLE IF NOT EXISTS braille_runtime_modules (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        entrypoint TEXT NOT NULL,
        compiled_instruction JSONB NOT NULL,
        module_plan JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'assembled',
        created_by TEXT NOT NULL,
        reviewer TEXT,
        review_note TEXT,
        activation_token_hash TEXT,
        activation_token_expires_at TIMESTAMP,
        activation_token_used_at TIMESTAMP,
        activation_result JSONB,
        graph_proposal_id TEXT REFERENCES graph_proposals(id),
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        activated_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_braille_runtime_modules_status ON braille_runtime_modules(status, created_at DESC);

      CREATE TABLE IF NOT EXISTS braille_runtime_module_events (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL REFERENCES braille_runtime_modules(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_braille_runtime_module_events_module ON braille_runtime_module_events(module_id, created_at);
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
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source TEXT NOT NULL DEFAULT 'legacy';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

      CREATE TABLE IF NOT EXISTS auth_action_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL CHECK (purpose IN ('verify_email','reset_password','agent_claim')),
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        consumed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE auth_action_tokens DROP CONSTRAINT IF EXISTS auth_action_tokens_purpose_check;
      ALTER TABLE auth_action_tokens ADD CONSTRAINT auth_action_tokens_purpose_check
        CHECK (purpose IN ('verify_email','reset_password','agent_claim'));
      CREATE INDEX IF NOT EXISTS idx_auth_action_tokens_user ON auth_action_tokens(user_id,purpose,created_at DESC);
    `);

    // Account-scoped Braille learning progress. Raw answers are intentionally not retained.
    await query(`
      CREATE TABLE IF NOT EXISTS braille_lesson_progress (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
        best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score BETWEEN 0 AND 100),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id,lesson_id)
      );
      CREATE TABLE IF NOT EXISTS braille_practice_attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('print_to_nemeth','nemeth_to_print')),
        correct BOOLEAN NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        mistake_categories TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_braille_attempts_user ON braille_practice_attempts(user_id,created_at DESC);
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

    // Account-scoped episodic memory. Events are append-only and ordered by the
    // database sequence; they never become shared graph or semantic records.
    await query(`
      CREATE TABLE IF NOT EXISTS private_conversation_events (
        sequence_no BIGSERIAL PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        interaction_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user','assistant')),
        content TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (user_id,interaction_id,role)
      );
      CREATE INDEX IF NOT EXISTS idx_private_conversation_events_user_sequence
        ON private_conversation_events(user_id,sequence_no DESC);
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

    // Research library: external references, never graph truth by themselves
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
        counterexample TEXT,
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
    await query(`ALTER TABLE research_items ALTER COLUMN counterexample DROP NOT NULL;`);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_research_items_status ON research_items(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_items_proposed_by ON research_items(proposed_by, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_items_kind ON research_items(kind, status, created_at DESC);
    `);

    // Governed conversational feedback, separated learning lanes, and personal graph overlays
    await query(`
      CREATE TABLE IF NOT EXISTS local_ai_feedback (
        id TEXT PRIMARY KEY,
        interaction_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        decision TEXT NOT NULL CHECK (decision IN ('approved','corrected')),
        input TEXT NOT NULL,
        canonical_english TEXT NOT NULL,
        model_name TEXT NOT NULL,
        model_response TEXT NOT NULL,
        correction TEXT,
        graph_source TEXT NOT NULL CHECK (graph_source IN ('approved_graph','chromabridge_knowledge','unresolved')),
        learned_alignment_status TEXT NOT NULL,
        contract_verified BOOLEAN NOT NULL DEFAULT FALSE,
        relational_evidence JSONB NOT NULL,
        response_sha256 TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','rejected')),
        reviewer TEXT REFERENCES users(id),
        review_note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (user_id,interaction_id)
      );
      CREATE INDEX IF NOT EXISTS idx_local_ai_feedback_user ON local_ai_feedback(user_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_local_ai_feedback_status ON local_ai_feedback(status,created_at DESC);

      CREATE TABLE IF NOT EXISTS local_ai_learning_candidates (
        id TEXT PRIMARY KEY,
        feedback_id TEXT NOT NULL REFERENCES local_ai_feedback(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lane TEXT NOT NULL CHECK (lane IN ('user_graph','model_retraining')),
        proposal JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected')),
        reviewer TEXT REFERENCES users(id),
        review_note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        applied_at TIMESTAMP,
        UNIQUE (feedback_id,lane)
      );
      CREATE INDEX IF NOT EXISTS idx_local_ai_learning_candidates_user ON local_ai_learning_candidates(user_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_local_ai_learning_candidates_lane_status ON local_ai_learning_candidates(lane,status,created_at DESC);

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
        source_feedback_id TEXT NOT NULL REFERENCES local_ai_feedback(id) ON DELETE CASCADE,
        learning_candidate_id TEXT NOT NULL UNIQUE REFERENCES local_ai_learning_candidates(id) ON DELETE CASCADE,
        record_status TEXT NOT NULL DEFAULT 'active' CHECK (record_status IN ('active','retired')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE user_graph_relationships ALTER COLUMN source_feedback_id DROP NOT NULL;
      ALTER TABLE user_graph_relationships ALTER COLUMN learning_candidate_id DROP NOT NULL;
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS mutation_source TEXT NOT NULL DEFAULT 'reviewed_feedback';
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS approved_by_user TEXT REFERENCES users(id);
      ALTER TABLE user_graph_relationships ADD COLUMN IF NOT EXISTS review_note TEXT;
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
      CREATE INDEX IF NOT EXISTS idx_user_graph_relationships_user ON user_graph_relationships(user_id,record_status,created_at DESC);

      INSERT INTO local_ai_learning_candidates
        (id,feedback_id,user_id,lane,proposal,status,reviewer,review_note,created_at,reviewed_at,applied_at)
      SELECT 'legacy_retraining_' || feedback.id, feedback.id, feedback.user_id, 'model_retraining',
        jsonb_build_object('source','accepted_feedback_backfill'), 'approved', feedback.reviewer,
        'Accepted before governed learning lanes were introduced.', feedback.created_at,
        COALESCE(feedback.reviewed_at,feedback.created_at), COALESCE(feedback.reviewed_at,feedback.created_at)
      FROM local_ai_feedback AS feedback
      WHERE feedback.status='accepted'
      ON CONFLICT (feedback_id,lane) DO NOTHING;

      CREATE TABLE IF NOT EXISTS local_ai_adapter_versions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        base_model TEXT NOT NULL DEFAULT 'Qwen/Qwen3-4B',
        runtime_base_model TEXT NOT NULL DEFAULT 'qwen3:4b-instruct',
        adapter_kind TEXT NOT NULL DEFAULT 'conversation_lora',
        dataset_sha256 TEXT NOT NULL,
        dataset_record_count INTEGER NOT NULL,
        training_feedback_ids TEXT[] NOT NULL,
        dataset_manifest JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','training','trained','validated','deployable','active','rejected','failed','archived')),
        artifact_path TEXT,
        artifact_sha256 TEXT,
        ollama_model_name TEXT,
        training_report JSONB,
        validation_report JSONB,
        deployment_report JSONB,
        created_by TEXT NOT NULL REFERENCES users(id),
        activated_by TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        trained_at TIMESTAMP,
        validated_at TIMESTAMP,
        deployed_at TIMESTAMP,
        activated_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_local_ai_adapter_versions_status ON local_ai_adapter_versions(status,created_at DESC);
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
        letter_accountability JSONB,
        analysis_version TEXT,
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
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS letter_accountability JSONB;
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS analysis_version TEXT;
      ALTER TABLE foundation_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
      CREATE INDEX IF NOT EXISTS idx_foundation_sessions_created_at ON foundation_sessions(created_at DESC);
    `);

    // Privacy-preserving Garden analytics. This ledger never stores message content,
    // raw IP addresses, user agents, email addresses, or service credentials.
    await query(`
      CREATE TABLE IF NOT EXISTS garden_analytics_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL CHECK (event_type IN ('page_view','cultivation','service_call','error')),
        visitor_key TEXT,
        session_key TEXT,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        room TEXT,
        service TEXT,
        entrance TEXT,
        status_code INTEGER CHECK (status_code BETWEEN 100 AND 599),
        duration_ms INTEGER CHECK (duration_ms >= 0),
        success BOOLEAN,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_garden_analytics_created_at
        ON garden_analytics_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_garden_analytics_event_type
        ON garden_analytics_events(event_type,created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_garden_analytics_room
        ON garden_analytics_events(room,created_at DESC) WHERE room IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_garden_analytics_service
        ON garden_analytics_events(service,created_at DESC) WHERE service IS NOT NULL;
    `);

    console.log('? Schema created successfully');
  } catch (error) {
    console.error('? Schema creation failed:', error);
    throw error;
  }
}
