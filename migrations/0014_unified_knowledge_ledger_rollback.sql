-- Rollback Migration 0014: Unified Knowledge Ledger & Linear Course Breadth/Depth Steering

ALTER TABLE topic_learning_prefs DROP COLUMN IF EXISTS interest_focus;
ALTER TABLE topic_learning_prefs DROP COLUMN IF EXISTS pace_mode;
DROP TABLE IF EXISTS user_knowledge_ledger;
