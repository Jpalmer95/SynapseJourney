-- Social sign-in identities (Google) + passkey (WebAuthn) credentials.
CREATE TABLE IF NOT EXISTS user_identities (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_identities_provider_account
  ON user_identities(provider, provider_account_id);
CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id);

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  device_label TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_webauthn_credentials_credential_id
  ON webauthn_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id);

-- App connects as sjuser (not postgres) — grants required after CREATE as superuser
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjuser') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE user_identities TO sjuser';
    EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE user_identities_id_seq TO sjuser';
    EXECUTE 'ALTER TABLE user_identities OWNER TO sjuser';
    EXECUTE 'ALTER SEQUENCE user_identities_id_seq OWNER TO sjuser';

    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE webauthn_credentials TO sjuser';
    EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE webauthn_credentials_id_seq TO sjuser';
    EXECUTE 'ALTER TABLE webauthn_credentials OWNER TO sjuser';
    EXECUTE 'ALTER SEQUENCE webauthn_credentials_id_seq OWNER TO sjuser';
  END IF;
END $$;
