-- Migration 0002: Phase 1 — Living Knowledge Base
-- Content versioning, BYOK, community pool, freshness tracking
-- Run: psql $DATABASE_URL -f migrations/0002_living_knowledge_base.sql
-- Rollback: psql $DATABASE_URL -f migrations/0002_living_knowledge_base_rollback.sql

-- ── 1. Freshness: add last_verified_at to lesson_units ──────────────────────
ALTER TABLE lesson_units
  ADD COLUMN IF NOT EXISTS last_verified_at timestamp;

-- Set all existing units as "verified at creation time" so they're not immediately stale
UPDATE lesson_units SET last_verified_at = generated_at WHERE last_verified_at IS NULL;

-- ── 2. Extend user_profiles with additional BYOK key columns ─────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS xai_key text,
  ADD COLUMN IF NOT EXISTS anthropic_key text,
  ADD COLUMN IF NOT EXISTS gemini_key text;

-- ── 3. Content Versions (Wikipedia-style edit history) ──────────────────────
CREATE TABLE IF NOT EXISTS content_versions (
  id SERIAL PRIMARY KEY,
  unit_id INTEGER NOT NULL REFERENCES lesson_units(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  author_id VARCHAR NOT NULL,
  author_type TEXT NOT NULL DEFAULT 'human',  -- human | agent
  content_json JSONB NOT NULL,
  change_summary TEXT,
  model_used TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',  -- pending_review | approved | rejected | active
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS content_versions_unit_idx ON content_versions(unit_id);
CREATE INDEX IF NOT EXISTS content_versions_status_idx ON content_versions(status);
CREATE INDEX IF NOT EXISTS content_versions_author_idx ON content_versions(author_id);

-- ── 4. Content Reviews (approval workflow) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS content_reviews (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES content_versions(id) ON DELETE CASCADE,
  reviewer_id VARCHAR NOT NULL,
  reviewer_type TEXT NOT NULL DEFAULT 'human',  -- human | agent
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  approved BOOLEAN NOT NULL,
  reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS content_reviews_version_idx ON content_reviews(version_id);

-- ── 5. User API Keys (BYOK storage, encrypted at rest) ──────────────────────
CREATE TABLE IF NOT EXISTS user_api_keys (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  provider TEXT NOT NULL,  -- openai, anthropic, gemini, xai, openrouter, huggingface
  encrypted_key TEXT NOT NULL,  -- AES-256-GCM encrypted
  key_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS user_api_keys_user_idx ON user_api_keys(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_api_keys_user_provider_unique ON user_api_keys(user_id, provider) WHERE is_active = true;

-- ── 6. Agent Profiles (registered AI agents with owner accountability) ──────
CREATE TABLE IF NOT EXISTS agent_profiles (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR NOT NULL UNIQUE,
  owner_id VARCHAR NOT NULL,  -- human user who vouches for this agent
  name TEXT NOT NULL,
  description TEXT,
  api_key TEXT NOT NULL,  -- hashed agent auth key
  model_used TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 7. Community Pool Usage (daily budget tracking) ─────────────────────────
CREATE TABLE IF NOT EXISTS community_pool_usage (
  id SERIAL PRIMARY KEY,
  date VARCHAR NOT NULL,  -- YYYY-MM-DD
  units_generated INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS community_pool_usage_date_idx ON community_pool_usage(date);

-- ── 8. Community Pool Queue (queued generation requests) ────────────────────
CREATE TABLE IF NOT EXISTS community_pool_queue (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL,
  content_type TEXT DEFAULT 'balanced',
  status TEXT NOT NULL DEFAULT 'queued',  -- queued | processing | completed | failed | expired
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS community_pool_queue_status_idx ON community_pool_queue(status, priority DESC);

-- Verify all tables created
SELECT tablename FROM pg_tables 
WHERE tablename IN ('content_versions', 'content_reviews', 'user_api_keys', 
                    'agent_profiles', 'community_pool_usage', 'community_pool_queue')
ORDER BY tablename;
