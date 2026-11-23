-- 0018_credits_and_provenance.sql
-- Adds:
--   1. Course & lesson unit provenance / freshness metadata for long-term scalability
--      and recursive periodic quality improvement.
--   2. Zero-loss prepaid credits wallet & immutable transaction ledger (integer micro-dollars:
--      1_000_000 micros = $1.00 USD) with strict DB non-negative balance CHECK constraints
--      and idempotent Stripe webhook deduplication.

-- 1. Provenance & Freshness Metadata on topics
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS generated_by_model TEXT,
  ADD COLUMN IF NOT EXISTS generated_by_provider TEXT,
  ADD COLUMN IF NOT EXISTS generator_version TEXT,
  ADD COLUMN IF NOT EXISTS content_updated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS volatility TEXT NOT NULL DEFAULT 'evolving',
  ADD COLUMN IF NOT EXISTS next_refresh_due_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS links_checked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS broken_link_count INTEGER NOT NULL DEFAULT 0;

-- Backfill content_updated_at from last_audited_at or created_at for existing courses
UPDATE topics
SET content_updated_at = COALESCE(last_audited_at, created_at)
WHERE content_updated_at IS NULL;

-- 2. Provenance Metadata on lesson_units
ALTER TABLE lesson_units
  ADD COLUMN IF NOT EXISTS generated_by_model TEXT,
  ADD COLUMN IF NOT EXISTS generated_by_provider TEXT,
  ADD COLUMN IF NOT EXISTS generator_version TEXT;

-- 3. Prepaid Credit Balances (strict DB-enforced non-negative balances)
CREATE TABLE IF NOT EXISTS user_credit_balances (
  user_id VARCHAR PRIMARY KEY,
  balance_micros BIGINT NOT NULL DEFAULT 0 CHECK (balance_micros >= 0),
  reserved_micros BIGINT NOT NULL DEFAULT 0 CHECK (reserved_micros >= 0),
  lifetime_purchased_micros BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_purchased_micros >= 0),
  lifetime_spent_micros BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_spent_micros >= 0),
  credit_tier_preference TEXT NOT NULL DEFAULT 'balanced',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Immutable Credit Ledger (idempotent Stripe event & session keys)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  kind TEXT NOT NULL,
  amount_micros BIGINT NOT NULL,
  balance_after_micros BIGINT NOT NULL,
  mode TEXT,
  model_used TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  raw_cost_micros BIGINT,
  markup_multiplier DOUBLE PRECISION,
  stripe_event_id TEXT UNIQUE,
  stripe_session_id TEXT UNIQUE,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
  ON credit_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topics_next_refresh_due
  ON topics (next_refresh_due_at)
  WHERE published = true;
