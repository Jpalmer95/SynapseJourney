-- Rollback: Course Completion Posters
DROP TABLE IF EXISTS course_posters;
DROP INDEX IF EXISTS idx_course_posters_user_id;
DROP INDEX IF EXISTS idx_course_posters_user_topic;
