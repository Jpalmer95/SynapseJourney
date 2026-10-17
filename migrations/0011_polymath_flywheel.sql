-- 0011_polymath_flywheel.sql
-- Adds SOTA Bottlenecks Registry, Knowledge Resources Commons (OER), and
-- structured hypothesis fields on open_science_ideas.

CREATE TABLE IF NOT EXISTS sota_bottlenecks (
  id                 serial PRIMARY KEY,
  topic_id           integer REFERENCES topics(id) ON DELETE SET NULL,
  unit_id            integer REFERENCES lesson_units(id) ON DELETE SET NULL,
  domain             text NOT NULL DEFAULT 'STEM',
  title              text NOT NULL,
  description        text NOT NULL,
  why_it_matters     text NOT NULL,
  current_approaches jsonb DEFAULT '[]'::jsonb,
  open_questions     jsonb DEFAULT '[]'::jsonb,
  difficulty         text NOT NULL DEFAULT 'frontier',
  status             text NOT NULL DEFAULT 'open',
  source             text NOT NULL DEFAULT 'curated',
  created_by_user_id varchar,
  upvotes            integer NOT NULL DEFAULT 0,
  embedding          vector(768),
  created_at         timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_resources (
  id            serial PRIMARY KEY,
  topic_id      integer REFERENCES topics(id) ON DELETE SET NULL,
  unit_id       integer REFERENCES lesson_units(id) ON DELETE SET NULL,
  title         text NOT NULL,
  url           text NOT NULL,
  resource_type text NOT NULL DEFAULT 'course',
  description   text NOT NULL,
  provider_name text,
  is_free_oer   boolean NOT NULL DEFAULT true,
  upvotes       integer NOT NULL DEFAULT 0,
  embedding     vector(768),
  created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_resources_url_unique_idx ON knowledge_resources (url);

ALTER TABLE open_science_ideas
  ADD COLUMN IF NOT EXISTS bottleneck_id integer REFERENCES sota_bottlenecks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hypothesis text,
  ADD COLUMN IF NOT EXISTS methodology text,
  ADD COLUMN IF NOT EXISTS falsifiability text,
  ADD COLUMN IF NOT EXISTS cross_domain_topic_ids integer[],
  ADD COLUMN IF NOT EXISTS evidence_links jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_score integer,
  ADD COLUMN IF NOT EXISTS ai_review_json jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sjuser') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON sota_bottlenecks TO sjuser;
    GRANT USAGE, SELECT ON SEQUENCE sota_bottlenecks_id_seq TO sjuser;
    GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_resources TO sjuser;
    GRANT USAGE, SELECT ON SEQUENCE knowledge_resources_id_seq TO sjuser;
  END IF;
END $$;
