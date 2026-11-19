-- 0017_oauth_subscriptions_rollback.sql

BEGIN;

ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS oauth_subscriptions;

COMMIT;
