-- 0007_lmstudio_byoc.sql
-- Add LM Studio + generic OpenAI-compatible BYOC provider fields to user_profiles.
-- Apply as the postgres superuser, then GRANT to sjuser (see references/postgres-sjuser-grants.md).

BEGIN;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS lm_studio_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_openai_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_openai_key TEXT;

-- sjuser needs to read/write the new columns (table-level privileges already cover
-- new columns on existing tables, but be explicit for safety on this setup).
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO sjuser;

COMMIT;
