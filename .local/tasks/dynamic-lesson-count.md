# Dynamic Lesson Count + Batch Pre-generation

## What & Why
Currently every course has exactly 3–4 units per difficulty tier regardless of the topic's complexity. A simple tool tutorial might only need 2 beginner lessons, while an advanced physics course might need 5 or 6. Additionally, when a user first opens a course, each lesson is generated one at a time on demand, requiring a separate AI call per lesson click. This task adds two improvements: (1) let the AI decide how many lessons each tier needs (bounded between 2 and 6 per tier), and (2) after the outline is built, asynchronously pre-generate all lesson content in a single batch AI call so subsequent lesson clicks are instant.

## Done looks like
- A simple/narrow topic (e.g., "How to use git stash") generates 2 lessons in beginner, 2 in intermediate, etc.
- A deep/broad topic (e.g., "Quantum Field Theory") generates 5–6 lessons per tier.
- When a user opens a course for the first time, content for all lessons starts being pre-generated in the background immediately after the outline appears.
- Clicking any lesson in the outline after a short wait shows content instantly without a generation spinner.
- If background pre-generation hasn't finished yet for a lesson, clicking it falls back gracefully to on-demand generation as today.
- Custom topic creation triggers the same background pre-generation pipeline.
- Lesson count is visible in the tier progress indicator ("0 of 4 complete" instead of always "0 of 3").

## Out of scope
- Changing the 4-tier structure (beginner / intermediate / advanced / nextgen).
- Letting users manually set the lesson count.
- Batch generation for nextgen units (they use a different content structure and are generated individually as today).

## Tasks
1. **Modify outline prompt for variable lesson count** — Update `generateLessonOutline` to instruct the AI to choose between 2 and 6 units per tier based on topic breadth and depth. Include guidance: narrow/tool topics → 2–3, broad science/engineering topics → 4–6. The AI response format stays the same (array of unit objects); only the count changes. Validate that each tier has between 2 and 6 units before saving; default to the current 3 if the AI returns out-of-range values.

2. **Background batch pre-generation after outline** — After `generateLessonOutline` saves units to the DB (in both the outline route and `generateCustomTopicContent`), fire off a background call to `generateBatchLessonContent` for all non-nextgen units. Use the same fire-and-forget pattern as predictive pre-generation — do not block the outline response. The batch call should save each unit's content directly to `contentJson` if the unit currently has no content.

3. **Custom topic creation wired to batch pre-generation** — Ensure the `generateCustomTopicContent` background function also triggers the same batch pre-generation step after the outline is complete, so users who create custom courses don't have to wait for individual lesson generation.

4. **Frontend: show accurate lesson count** — The tier progress label already reads from `units.length`, so no change needed there. Verify that the "Loading..." placeholder on the outline page gracefully handles the case where outline units exist but content is still being generated in the background (content shows as loading only when the user actually clicks the lesson).

## Relevant files
- `server/routes.ts:3308-3364`
- `server/routes.ts:3368-3492`
- `server/routes.ts:3229-3307`
- `server/routes.ts:690-736`
- `client/src/components/rabbit-hole.tsx:1562-1700`
