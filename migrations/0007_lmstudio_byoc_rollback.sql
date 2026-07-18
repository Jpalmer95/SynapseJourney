-- 0007_lmstudio_byoc_rollback.sql

BEGIN;

ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS lm_studio_url,
  DROP COLUMN IF EXISTS custom_openai_url,
  DROP COLUMN IF EXISTS custom_openai_key;

COMMIT;
