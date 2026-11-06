-- Migration 0014: Unified Knowledge Ledger & Linear Course Breadth/Depth Steering
--
-- Connects the 3 core learning modes into one persistent 3D knowledge ledger:
--   1. Laser-focused JIT Goal courses (`stream = 'jit'`)
--   2. Generalized Linear Mastery courses (`stream = 'linear'`)
--   3. Agentic Conversation-based open-ended learnings (`stream = 'agent_chat' | 'mcp_agent'`)
--
-- Whenever a user learns a concept in ANY stream (JIT, Linear, in-app Agent Chat, or
-- external Hermes/MCP agent), it is logged to `user_knowledge_ledger`, reconciled against
-- canonical `topics` and `lesson_units`, and reflected in `user_progress` on the 3D Map.

CREATE TABLE IF NOT EXISTS user_knowledge_ledger (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
  source_topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  matched_unit_id INTEGER REFERENCES lesson_units(id) ON DELETE SET NULL,
  concept_title TEXT NOT NULL,
  normalized_concept TEXT NOT NULL,
  summary TEXT NOT NULL,
  stream TEXT NOT NULL DEFAULT 'linear', -- 'jit' | 'linear' | 'agent_chat' | 'mcp_agent'
  depth_level TEXT NOT NULL DEFAULT 'core', -- 'intro' | 'core' | 'advanced' | 'frontier'
  confidence INTEGER NOT NULL DEFAULT 80,
  tags TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ukl_user_id ON user_knowledge_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ukl_user_topic ON user_knowledge_ledger(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_ukl_matched_unit ON user_knowledge_ledger(user_id, matched_unit_id);
CREATE INDEX IF NOT EXISTS idx_ukl_norm_concept ON user_knowledge_ledger(user_id, normalized_concept);

ALTER TABLE topic_learning_prefs ADD COLUMN IF NOT EXISTS pace_mode TEXT NOT NULL DEFAULT 'balanced';
ALTER TABLE topic_learning_prefs ADD COLUMN IF NOT EXISTS interest_focus TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjuser') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON user_knowledge_ledger TO sjuser;
    GRANT USAGE, SELECT ON SEQUENCE user_knowledge_ledger_id_seq TO sjuser;
    GRANT SELECT, INSERT, UPDATE, DELETE ON topic_learning_prefs TO sjuser;
  END IF;
END $$;
