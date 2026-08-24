-- 0009_topic_coordinates.sql
-- Store precomputed 3D "knowledge axis" coordinates for topics, derived from
-- PCA over their 768-dim embeddings. Enables the relational 3D knowledge cloud
-- where similar topics cluster and dissimilar topics are far apart.
-- Recomputable via the bootcamp's compute_knowledge_axes.py (PCA over embeddings).

CREATE TABLE IF NOT EXISTS topic_coordinates (
  topic_id    integer PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
  x           double precision NOT NULL,
  y           double precision NOT NULL,
  z           double precision NOT NULL,
  axis_0_label text,           -- human label for the x-axis semantic direction
  axis_1_label text,
  axis_2_label text,
  computed_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON topic_coordinates TO sjuser;
