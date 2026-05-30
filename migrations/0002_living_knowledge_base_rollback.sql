-- Rollback Migration 0002: Phase 1 — Living Knowledge Base
-- Run: psql $DATABASE_URL -f migrations/0002_living_knowledge_base_rollback.sql

DROP TABLE IF EXISTS community_pool_queue;
DROP TABLE IF EXISTS community_pool_usage;
DROP TABLE IF EXISTS agent_profiles;
DROP TABLE IF EXISTS user_api_keys;
DROP TABLE IF EXISTS content_reviews;
DROP TABLE IF EXISTS content_versions;

ALTER TABLE user_profiles DROP COLUMN IF EXISTS xai_key;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS anthropic_key;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS gemini_key;

ALTER TABLE lesson_units DROP COLUMN IF EXISTS last_verified_at;
