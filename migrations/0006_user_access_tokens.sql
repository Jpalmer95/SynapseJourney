-- Personal access tokens for Hermes / external agents (BYOC upload path)
CREATE TABLE IF NOT EXISTS user_access_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  name TEXT NOT NULL DEFAULT 'Hermes',
  token_prefix VARCHAR(16) NOT NULL,
  token_hash TEXT NOT NULL,
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_access_tokens_user ON user_access_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_tokens_hash ON user_access_tokens(token_hash);

-- App connects as sjuser (not postgres) — grants required after CREATE as superuser
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjuser') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE user_access_tokens TO sjuser';
    EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE user_access_tokens_id_seq TO sjuser';
    EXECUTE 'ALTER TABLE user_access_tokens OWNER TO sjuser';
    EXECUTE 'ALTER SEQUENCE user_access_tokens_id_seq OWNER TO sjuser';
  END IF;
END $$;
