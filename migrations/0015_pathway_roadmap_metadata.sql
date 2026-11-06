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
  END IF;
END $$;
