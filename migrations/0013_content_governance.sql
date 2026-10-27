-- Content governance: publish state, ownership, quality scoring, dedupe keys.
--
-- Before this, every topic was global and public the moment an agent created it.
-- That is how a corpus of 725 templated units became the site's front page, and how
-- per-user "just-in-time" courses leaked into the shared catalogue.

ALTER TABLE topics ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS quality_report JSONB;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS last_audited_at TIMESTAMP;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'core';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS normalized_title TEXT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR;

-- Backfill the dedupe key with the same normalisation used in server/content-quality.ts.
UPDATE topics
SET normalized_title = trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'))
WHERE normalized_title IS NULL;

CREATE INDEX IF NOT EXISTS idx_topics_published ON topics(published);
CREATE INDEX IF NOT EXISTS idx_topics_normalized_title ON topics(normalized_title);
CREATE INDEX IF NOT EXISTS idx_topics_owner ON topics(owner_user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjuser') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON topics TO sjuser;
    GRANT USAGE, SELECT ON SEQUENCE topics_id_seq TO sjuser;
  END IF;
END $$;
