-- 0008_hybrid_rag_embeddings.sql
-- Resize pgvector embedding columns from 1536 -> 768 to match the local,
-- private embedding engine (Ollama nomic-embed-text). This is the "bring AI
-- to data anywhere" pattern: vectors computed in your own infra, at the edge.
-- Run as the owner (postgres). Embedded rows with the wrong dim are cleared so
-- the backfill job can recompute them.

ALTER TABLE topics       ALTER COLUMN embedding TYPE vector(768);
ALTER TABLE lesson_units ALTER COLUMN embedding TYPE vector(768);

-- Clear stale 1536-dim embeddings (they can't be re-cast), ready for backfill
UPDATE topics       SET embedding = NULL;
UPDATE lesson_units SET embedding = NULL;

GRANT SELECT, UPDATE ON topics       TO sjuser;
GRANT SELECT, UPDATE ON lesson_units TO sjuser;
