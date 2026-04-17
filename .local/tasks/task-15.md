---
title: Fix duplicate lesson content within tiers
---
# Fix Duplicate Lesson Content Within a Tier

## What & Why
When a user opens a course and clicks lessons 2 or 3 within the same difficulty tier (e.g., Beginner), they see content that is identical or indistinguishable from lesson 1. This means only one unique lesson is actually being rendered per tier despite multiple lessons appearing in the list. The root cause is most likely one of: (a) the AI outline generator producing units with duplicate `unitIndex` values (all 0), which breaks the predictive pre-generation order and may cascade into duplicate content being saved, (b) the `generateLessonContent` prompt not including the unit's position within the tier ("Unit 2 of 3 in Beginner") so the AI produces similar generic content regardless of unit, or (c) a frontend rendering issue where quiz state or content is not properly cleared when switching units. All three paths need to be addressed.

## Done looks like
- Clicking lesson 2 in the Beginner tab shows different content from lesson 1 — different title in the header, different concept text, different quiz questions.
- Clicking lesson 3 also shows a third, distinct set of content.
- The same is true for Intermediate, Advanced, and Next Gen tiers.
- Quiz state (selected answers, submitted state) resets when switching to a different lesson.
- No console errors related to lesson unit fetching.

## Out of scope
- Changing the number of lessons per tier (that is Task #16).
- Redesigning the course UI layout.

## Tasks
1. **Add unit position context to content generation** — Modify `generateLessonContent` and `generateBatchLessonContent` to include the unit's 1-based position within its difficulty tier in the AI prompt (e.g., "Unit 2 of 3 in the Beginner tier") so the AI generates meaningfully distinct content per unit. Also pass the titles of the other units in the same tier as "do not duplicate" context.

2. **Improve outline prompt for uniqueness** — Update `generateLessonOutline` prompt to: (a) explicitly state that each unit must have a distinct title covering a different subtopic from the others in the same tier, (b) show a richer example with 3 distinct beginner units, 3 intermediate, 3 advanced, and 3 nextgen, and (c) remind the AI to assign correct sequential `unitIndex` values (0, 1, 2) within each tier.

3. **Fix predictive pre-generation when unitIndex values are identical** — In `predictivelyGenerateNextUnit`, add a fallback: if no unit is found at `currentUnit.unitIndex + 1`, fall back to finding units in the same difficulty by position in the sorted array (not by `unitIndex` equality) so prediction still works even with malformed indices.

4. **Fix frontend: reset quiz and content state on unit switch** — When `selectedUnit` changes, reset `quizAnswers`, `quizSubmitted`, and `showResources` state. Also force the content area to re-render cleanly by keying it on `selectedUnit.id` so React tears down and remounts the content pane, preventing any stale display.

5. **Add server-side content logging** — When content is generated or retrieved for a unit, log `[Lesson] unit_id=${unitId} title="${unit.title}" content_hash=...` so future duplicate issues are immediately visible in server logs.

## Relevant files
- `server/routes.ts:739-819` 
- `server/routes.ts:3119-3179`
- `server/routes.ts:3308-3364`
- `server/routes.ts:3368-3492`
- `server/routes.ts:3495-3600`
- `client/src/components/rabbit-hole.tsx:217-230`
- `client/src/components/rabbit-hole.tsx:498-509`
- `client/src/components/rabbit-hole.tsx:530-556`
- `client/src/components/rabbit-hole.tsx:1562-1700`