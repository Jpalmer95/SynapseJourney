-- Migration 0016: Proof-of-Work Portfolio Artifacts & Cross-Functional Dossier
--
-- Stores verifiable deliverables produced across Role/Industry/Alt-MBA/Classical
-- roadmaps and courses (architecture memos, quantitative financial/case models,
-- simulations, derivations, and linked SOTA hypotheses).

CREATE TABLE IF NOT EXISTS user_portfolio_artifacts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  pathway_id INTEGER REFERENCES pathways(id) ON DELETE SET NULL,
  topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  unit_id INTEGER REFERENCES lesson_units(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  artifact_type TEXT NOT NULL DEFAULT 'architecture_memo', -- 'architecture_memo' | 'code_simulation' | 'financial_case_model' | 'derivation_proof' | 'sota_hypothesis'
  summary TEXT NOT NULL,
  artifact_url TEXT,
  metrics_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_upa_user_id ON user_portfolio_artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_upa_pathway_id ON user_portfolio_artifacts(pathway_id);
CREATE INDEX IF NOT EXISTS idx_upa_topic_id ON user_portfolio_artifacts(topic_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjuser') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON user_portfolio_artifacts TO sjuser;
    GRANT USAGE, SELECT ON SEQUENCE user_portfolio_artifacts_id_seq TO sjuser;
  END IF;
END $$;
