-- Migration 0015: Role / Industry / Classical Mastery Roadmap & Timeline Metadata
--
-- Extends `pathways` and `pathway_topics` so Synapse can curate end-to-end
-- industry/role roadmaps (e.g., "Frontier XR Chip Engineer") and classical
-- hard-science progressions broken into sequential phases AND highest-impact
-- building blocks, with per-topic estimated hours and prior-knowledge discounting.

ALTER TABLE pathways ADD COLUMN IF NOT EXISTS track_type TEXT NOT NULL DEFAULT 'classical_science';
ALTER TABLE pathways ADD COLUMN IF NOT EXISTS target_role TEXT;
ALTER TABLE pathways ADD COLUMN IF NOT EXISTS roadmap_meta JSONB;

ALTER TABLE pathway_topics ADD COLUMN IF NOT EXISTS impact_score INTEGER NOT NULL DEFAULT 80;
ALTER TABLE pathway_topics ADD COLUMN IF NOT EXISTS impact_tier TEXT NOT NULL DEFAULT 'core';
ALTER TABLE pathway_topics ADD COLUMN IF NOT EXISTS estimated_hours INTEGER NOT NULL DEFAULT 8;
ALTER TABLE pathway_topics ADD COLUMN IF NOT EXISTS phase_label TEXT;
ALTER TABLE pathway_topics ADD COLUMN IF NOT EXISTS why_it_matters TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjuser') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON pathways TO sjuser;
    GRANT SELECT, INSERT, UPDATE, DELETE ON pathway_topics TO sjuser;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sjuser;
  END IF;
END $$;

SELECT setval(pg_get_serial_sequence('pathways', 'id'), COALESCE((SELECT MAX(id) FROM pathways), 1), true);
SELECT setval(pg_get_serial_sequence('pathway_topics', 'id'), COALESCE((SELECT MAX(id) FROM pathway_topics), 1), true);
SELECT setval(pg_get_serial_sequence('user_pathways', 'id'), COALESCE((SELECT MAX(id) FROM user_pathways), 1), true);
SELECT setval(pg_get_serial_sequence('topics', 'id'), COALESCE((SELECT MAX(id) FROM topics), 1), true);
SELECT setval(pg_get_serial_sequence('lesson_units', 'id'), COALESCE((SELECT MAX(id) FROM lesson_units), 1), true);
