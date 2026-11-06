-- Rollback Migration 0015: Role / Industry / Classical Mastery Roadmap & Timeline Metadata

ALTER TABLE pathway_topics DROP COLUMN IF EXISTS why_it_matters;
ALTER TABLE pathway_topics DROP COLUMN IF EXISTS phase_label;
ALTER TABLE pathway_topics DROP COLUMN IF EXISTS estimated_hours;
ALTER TABLE pathway_topics DROP COLUMN IF EXISTS impact_tier;
ALTER TABLE pathway_topics DROP COLUMN IF EXISTS impact_score;

ALTER TABLE pathways DROP COLUMN IF EXISTS roadmap_meta;
ALTER TABLE pathways DROP COLUMN IF EXISTS target_role;
ALTER TABLE pathways DROP COLUMN IF EXISTS track_type;
