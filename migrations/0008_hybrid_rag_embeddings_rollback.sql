-- 0008_hybrid_rag_embeddings_rollback.sql
-- Restore 1536-dim columns (matching the original embedding schema).

ALTER TABLE topics       ALTER COLUMN embedding TYPE vector(1536);
ALTER TABLE lesson_units ALTER COLUMN embedding TYPE vector(1536);

UPDATE topics       SET embedding = NULL;
UPDATE lesson_units SET embedding = NULL;
