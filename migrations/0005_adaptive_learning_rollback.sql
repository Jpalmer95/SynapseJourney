-- Rollback Phase 9 adaptive learning

DROP TABLE IF EXISTS topic_learning_prefs;
DROP TABLE IF EXISTS learning_timeline;
DROP TABLE IF EXISTS learning_goals;
DROP TABLE IF EXISTS course_plans;

ALTER TABLE user_profiles DROP COLUMN IF EXISTS default_content_view;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS preferred_tutor_mode;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS default_depth_mode;

ALTER TABLE lesson_progress DROP COLUMN IF EXISTS last_section;
ALTER TABLE user_progress DROP COLUMN IF EXISTS last_unit_id;
