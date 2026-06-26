-- Course Completion Posters
-- Stores AI-generated condensed summaries of completed courses
-- Generated when a learner completes all units in a course topic

CREATE TABLE IF NOT EXISTS course_posters (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    poster_data JSONB NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index for looking up a user's posters
CREATE INDEX IF NOT EXISTS idx_course_posters_user_id ON course_posters(user_id);

-- Index for checking if a poster already exists for a user+topic
CREATE INDEX IF NOT EXISTS idx_course_posters_user_topic ON course_posters(user_id, topic_id);
