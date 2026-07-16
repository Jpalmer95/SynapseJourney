-- Phase 9: Adaptive Learning UX
-- course plans, goals, timeline, topic prefs, resume fields

ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS last_unit_id INTEGER;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS last_section TEXT;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS default_depth_mode TEXT DEFAULT 'standard';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_tutor_mode TEXT DEFAULT 'direct';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS default_content_view TEXT DEFAULT 'full';

CREATE TABLE IF NOT EXISTS course_plans (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  learning_intent TEXT NOT NULL DEFAULT 'standard',
  goal_description TEXT,
  plan_json JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_by_user_id VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_course_plans_topic ON course_plans(topic_id);

CREATE TABLE IF NOT EXISTS learning_goals (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  goal_text TEXT NOT NULL,
  topic_id INTEGER REFERENCES topics(id),
  status TEXT NOT NULL DEFAULT 'active',
  plan_json JSONB,
  milestones JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_learning_goals_user ON learning_goals(user_id);

CREATE TABLE IF NOT EXISTS learning_timeline (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  topic_id INTEGER REFERENCES topics(id),
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learning_timeline_user ON learning_timeline(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_timeline_user_created ON learning_timeline(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS topic_learning_prefs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  depth_mode TEXT NOT NULL DEFAULT 'standard',
  tutor_mode TEXT NOT NULL DEFAULT 'direct',
  content_view TEXT NOT NULL DEFAULT 'full',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_learning_prefs_user_topic
  ON topic_learning_prefs(user_id, topic_id);
