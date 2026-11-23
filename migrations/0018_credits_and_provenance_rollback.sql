-- Rollback for 0018_credits_and_provenance.sql
DROP INDEX IF EXISTS idx_topics_next_refresh_due;
DROP INDEX IF EXISTS idx_credit_transactions_user_created;
DROP TABLE IF EXISTS credit_transactions;
DROP TABLE IF EXISTS user_credit_balances;

ALTER TABLE lesson_units
  DROP COLUMN IF EXISTS generated_by_model,
  DROP COLUMN IF EXISTS generated_by_provider,
  DROP COLUMN IF EXISTS generator_version;

ALTER TABLE topics
  DROP COLUMN IF EXISTS generated_by_model,
  DROP COLUMN IF EXISTS generated_by_provider,
  DROP COLUMN IF EXISTS generator_version,
  DROP COLUMN IF EXISTS content_updated_at,
  DROP COLUMN IF EXISTS volatility,
  DROP COLUMN IF EXISTS next_refresh_due_at,
  DROP COLUMN IF EXISTS links_checked_at,
  DROP COLUMN IF EXISTS broken_link_count;
