-- Migration: Rollback pgvector/pg_trgm extensions and indexes
-- Run: psql $DATABASE_URL -f migrations/0001_pgvector_extensions_rollback.sql

DROP INDEX IF EXISTS topics_title_trgm_idx;
DROP INDEX IF EXISTS lesson_units_embedding_idx;
DROP INDEX IF EXISTS topics_embedding_idx;

ALTER TABLE lesson_units DROP COLUMN IF EXISTS embedding;
ALTER TABLE topics DROP COLUMN IF EXISTS embedding;

-- Note: extensions are NOT dropped on rollback — other tables may use them
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS vector;
