-- 0017_oauth_subscriptions.sql
-- Add Bring Your Own Subscription (BYOS) OAuth connection storage on user_profiles.
-- Stores AES-256-GCM encrypted access/refresh tokens + metadata per provider
-- (xai_oauth, nous_oauth, openai_codex, minimax_oauth).

BEGIN;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS oauth_subscriptions JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjuser') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO sjuser;
  END IF;
END $$;

COMMIT;
