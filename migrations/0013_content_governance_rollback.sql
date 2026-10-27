DROP INDEX IF EXISTS idx_topics_owner;
DROP INDEX IF EXISTS idx_topics_normalized_title;
DROP INDEX IF EXISTS idx_topics_published;

ALTER TABLE topics DROP COLUMN IF EXISTS owner_user_id;
ALTER TABLE topics DROP COLUMN IF EXISTS normalized_title;
ALTER TABLE topics DROP COLUMN IF EXISTS kind;
ALTER TABLE topics DROP COLUMN IF EXISTS last_audited_at;
ALTER TABLE topics DROP COLUMN IF EXISTS quality_report;
ALTER TABLE topics DROP COLUMN IF EXISTS quality_score;
ALTER TABLE topics DROP COLUMN IF EXISTS reviewed;
ALTER TABLE topics DROP COLUMN IF EXISTS published;
