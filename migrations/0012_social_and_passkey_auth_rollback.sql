-- Rollback for 0012_social_and_passkey_auth.sql
DROP TABLE IF EXISTS webauthn_credentials;
DROP TABLE IF EXISTS user_identities;
