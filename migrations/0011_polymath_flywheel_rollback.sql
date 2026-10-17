-- 0011_polymath_flywheel_rollback.sql
ALTER TABLE open_science_ideas
  DROP COLUMN IF EXISTS bottleneck_id,
  DROP COLUMN IF EXISTS hypothesis,
  DROP COLUMN IF EXISTS methodology,
  DROP COLUMN IF EXISTS falsifiability,
  DROP COLUMN IF EXISTS cross_domain_topic_ids,
  DROP COLUMN IF EXISTS evidence_links,
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS ai_review_json,
  DROP COLUMN IF EXISTS status;

DROP TABLE IF EXISTS knowledge_resources;
DROP TABLE IF EXISTS sota_bottlenecks;
