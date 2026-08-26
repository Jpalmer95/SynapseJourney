-- Password reset tokens for the forgot-password flow (Synapse).
-- Only the SHA-256 hash of the raw token is stored (never the raw token).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);

-- App connects as sjuser (not postgres) — grants required after CREATE as superuser
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjuser') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE password_reset_tokens TO sjuser';
    EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE password_reset_tokens_id_seq TO sjuser';
    EXECUTE 'ALTER TABLE password_reset_tokens OWNER TO sjuser';
    EXECUTE 'ALTER SEQUENCE password_reset_tokens_id_seq OWNER TO sjuser';
  END IF;
END $$;
