-- Migration: Enable pgvector and pg_trgm extensions for semantic search
-- Run: psql $DATABASE_URL -f migrations/0001_pgvector_extensions.sql
-- Or via drizzle-kit: npx drizzle-kit push (after running this script)
--
-- pgvector: enables vector similarity search for topic/lesson embeddings
-- pg_trgm: enables trigram-based fuzzy text search for topic titles

-- Enable extensions (requires superuser or rds_superuser on managed PG)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add embedding columns to topics and lesson_units
-- Using 1536 dimensions (OpenAI text-embedding-3-small default)
-- Compatible with most embedding providers that output 1536-dim vectors

ALTER TABLE topics 
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE lesson_units 
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create HNSW index for vector similarity search
-- HNSW is preferred over IVFFlat for small-medium datasets (better recall)
-- cosine distance is ideal for embedding similarity
CREATE INDEX IF NOT EXISTS topics_embedding_idx 
  ON topics USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS lesson_units_embedding_idx 
  ON lesson_units USING hnsw (embedding vector_cosine_ops);

-- Create trigram index for fuzzy text search on topic titles
CREATE INDEX IF NOT EXISTS topics_title_trgm_idx 
  ON topics USING gin (title gin_trgm_ops);

-- Verify extensions
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');
