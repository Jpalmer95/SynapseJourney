-- 0010_prepaid_inference.sql
-- Prepaid inference lane (BYOK-first, prepaid-only fallback).
--
-- user_credits         — a single prepaid balance (in cents) per user.
-- inference_charges    — append-only audit ledger: every credit (Stripe purchase)
--                        and every debit (generation spend) with the model,
--                        token counts, operator cost, sell price, and balance_after.
--
-- Hard invariant: a generation can NEVER draw on operator funds. The only
-- balance that can go to zero is the user's own prepaid `user_credits.balance_cents`.

CREATE TABLE IF NOT EXISTS user_credits (
  id            SERIAL PRIMARY KEY,
  user_id       VARCHAR NOT NULL UNIQUE,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inference_charges (
  id                  SERIAL PRIMARY KEY,
  user_id             VARCHAR NOT NULL,
  kind                VARCHAR NOT NULL,           -- 'credit' (Stripe purchase) | 'debit' (generation)
  amount_cents        INTEGER NOT NULL,           -- positive for credit, positive for debit (amount spent)
  balance_after_cents INTEGER NOT NULL,
  model               VARCHAR,                    -- pinned prepaid model used (debits only)
  prompt_tokens       INTEGER,
  completion_tokens   INTEGER,
  total_tokens        INTEGER,
  cost_cents          INTEGER,                    -- operator cost (what the platform pays)
  sell_cents          INTEGER,                    -- what the user was charged (cost × margin, floored)
  source              VARCHAR,                    -- e.g. 'stripe' | 'course_generation' | 'explore' | 'fusion'
  stripe_event_id     VARCHAR UNIQUE,             -- Stripe event id for idempotent webhook processing
  metadata            JSONB,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_inference_charges_user ON inference_charges(user_id, created_at);

-- App connects as sjuser (not postgres) — grants required after CREATE as superuser
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjuser') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE user_credits TO sjuser';
    EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE user_credits_id_seq TO sjuser';
    EXECUTE 'ALTER TABLE user_credits OWNER TO sjuser';
    EXECUTE 'ALTER SEQUENCE user_credits_id_seq OWNER TO sjuser';

    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE inference_charges TO sjuser';
    EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE inference_charges_id_seq TO sjuser';
    EXECUTE 'ALTER TABLE inference_charges OWNER TO sjuser';
    EXECUTE 'ALTER SEQUENCE inference_charges_id_seq OWNER TO sjuser';
  END IF;
END $$;
