# Bulk Course Outline Regeneration

## What & Why
All 20 existing courses were generated with the old outline prompt (fixed 3 units per tier, older AI models). Now that the platform uses Grok for course generation and supports dynamic lesson counts (2–6 units per tier based on topic breadth), regenerating all outlines will produce higher-quality, appropriately-scaled courses. After outline regeneration, background batch pre-generation will fill in all lesson content automatically, so every course will be fully pre-loaded with fresh, Grok-generated content. This is a one-time admin operation to bring the entire existing catalog up to the new standard.

## Done looks like
- An admin-only API endpoint (`/api/admin/regenerate-all-outlines`) accepts a POST request and triggers sequential full regeneration of all topic outlines.
- For each topic: all existing lesson units (and their content) are deleted, a fresh outline is generated using the new dynamic-count prompt, and batch content pre-generation is immediately fired in the background.
- The endpoint returns a job-status response immediately (non-blocking), logging progress per-topic in the server console.
- An admin UI button on the admin panel (or a dedicated admin page) allows the admin to trigger the regeneration and view live status/progress (polling or SSE).
- After the job completes, simpler topics (e.g., "Benefits of Open Source") have 2–3 units per tier and complex topics (e.g., "Machine Learning", "Quantum Mechanics") have 4–6 units per tier.
- All 20 topics have fully pre-generated lesson content across all non-nextgen units.
- Topics are processed sequentially (one at a time) to avoid overwhelming the AI API with concurrent requests.

## Out of scope
- Regenerating Next Gen unit content (they continue to be generated on-demand per today's flow).
- Automated scheduling (this is a one-time manual admin action).
- Preserving any existing user progress data (mastery, quiz scores) — those are tied to unit IDs and will reset since units are deleted and recreated with new IDs.
- Custom user-created topics (there are currently 0, but the endpoint should skip them or handle separately).

## Important note on user progress
Deleting and recreating lesson units changes their database IDs, which means any existing user progress (quiz scores, completion status) for those topics will be orphaned. This is acceptable for a one-time catalog refresh, but the admin UI should display a clear warning before allowing the trigger.

## Tasks
1. **Backend regeneration endpoint** — Create a new admin-only POST `/api/admin/regenerate-all-outlines` route. For each topic (fetched from DB), delete all existing lesson_units, call `generateLessonOutline`, and fire `batchPregenerateUnits` in background. Process topics sequentially with per-topic logging. Return a 202 Accepted immediately with a status message; expose a GET `/api/admin/regeneration-status` endpoint that reports progress (topics completed, current topic, total).

2. **Admin UI trigger + progress display** — Add an "Admin Tools" section (or extend the existing admin panel) with a "Regenerate All Course Outlines" button and a confirmation modal warning about user progress reset. After triggering, show live progress (poll the status endpoint every 5 seconds): "Regenerating topic X of 20: Machine Learning..." with a progress bar. When complete, show a success summary.

3. **Storage helper: delete all units for topic** — Add a `deleteLessonUnitsByTopicId(topicId: number)` method to the storage interface and implementation that deletes all lesson_units rows for a given topic (cascading to content, since it's stored in the same row).

## Relevant files
- `server/routes.ts:690-740`
- `server/routes.ts:1437-1500`
- `server/routes.ts:1916-1960`
- `server/routes.ts:3351-3395`
- `server/routes.ts:3393-3480`
- `server/storage.ts:127-145`
- `server/storage.ts:739-760`
- `client/src/components/rabbit-hole.tsx`
