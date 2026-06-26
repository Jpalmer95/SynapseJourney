# Synapse Phase 8 Buildout — Handoff Prompt

## Context
You are continuing work on the SynapseJourney platform (github.com/Jpalmer95/SynapseJourney), an open-source PWA learning platform where anyone can learn any subject at any pace. The repo is at /home/jonathan/dev/synapse on branch feature/revamp-master-plan.

Load the `synapse-platform` skill first (skill_view name='synapse-platform') and read SYNAPSE-MASTER-REVAMP.md for the full 8-phase roadmap. The master plan is authoritative.

## What's Already Done (commit 3ffb94f)
Phase 8 first pass is complete and pushed:
- **server/course-planner.ts** — AI-first dynamic curriculum planning (planCourseWithAI). Determines optimal scope, tiers, unit counts, sub-topic decomposition, OER sources. Falls back to legacy classifyTopicByKeywords heuristic.
- **On-demand quizzes** — Removed quiz generation from generateBatchLessonContent + generateLessonContent prompts. Added generateOnDemandQuiz() in server/routes/ai.ts and POST /api/lessons/unit/:unitId/quiz endpoint in server/routes.ts.
- **OER sourcing** — Content generation prompts now explicitly prioritize MIT OCW, Khan Academy, OpenStax, LibreTexts, Wikiversity, arXiv, freeCodeCamp, Project Gutenberg.
- **Course completion posters** — course_posters table schema (shared/schema.ts), migration 0003_course_posters.sql, POST /api/lessons/:topicId/poster endpoint. Generates AI poster with title, summary, keyTakeaways, tier sections, visualStyle, colorScheme, celebrationMessage.
- **SYNAPSE-MASTER-REVAMP.md** — Phase 8 added with 6 sub-sections (8.1-8.6), vision expanded, design principles, key decisions log.

## Remaining Phase 8 Roadmap Items (in priority order)

### 8.1 — Wire planCourseWithAI into generateLessonOutline
The course planner exists but generateLessonOutline (server/routes/ai.ts ~line 871) still uses the old classifyTopicByKeywords heuristic. Wire them together:
- In generateLessonOutline, call planCourseWithAI() instead of classifyTopicByKeywords for custom topics (not pre-seeded ones — check SYLLABI_MAP first)
- Map the CoursePlan's units to DB rows (they have tierIndex, tierName, difficulty)
- Store the course plan for future reference (new course_plans table — needs schema + migration)
- The plan's recommendedOER should be passed to the content generation prompts

### 8.2 — Frontend: On-Demand Quiz UI
Quizzes are no longer pre-generated in lesson content. The frontend needs updating:
- In client/src/components/rabbit-hole.tsx (where quizzes render ~line 1360), replace the always-visible quiz section with a "Generate Quiz" button
- On click, POST to /api/lessons/unit/:unitId/quiz
- Display the generated quiz questions
- Handle loading state, errors, and the case where lesson content doesn't exist yet (409 response)
- Optionally cache generated quizzes in a new unit_quizzes table so re-taking is free

### 8.4 — Frontend: Course Completion Poster Component
The poster endpoint exists but there's no UI to display it:
- Build a poster display component that renders posterData JSON visually
- Support the visualStyle options (minimal, infographic, mind-map) and colorScheme options (charcoal-rust, ocean, forest, sunset, aurora)
- Auto-trigger poster generation when all units in a course are completed (check in the lesson completion flow in routes.ts)
- Save generated posters to the course_posters DB table (storage methods needed)
- Add a poster gallery in the user profile showing all earned posters
- Add poster sharing (export as image via canvas, or shareable URL)

### 8.5 — Progress Timeline
Not started. Needs:
- New learning_timeline table: userId, topicId, eventType (started/completed/mastered/quiz_passed/poster_earned), metadata JSONB, timestamp
- Storage methods: recordTimelineEvent, getTimeline, getTimelineSummary
- Record events from existing flows (lesson start, lesson complete, mastery unlock, quiz pass, poster earned)
- GET /api/timeline endpoint returning chronological events
- Timeline view in profile: "Your Learning Journey" — visualize courses, milestones, streaks, cross-topic connections
- Annual learning summary

### 8.6 — Decentralized Open Science Board
Not started. The existing openScienceIdeas table needs extending:
- Add structured hypothesis fields: abstract, methodology, predicted_outcomes, related_topic_ids, confidence_score, status (draft/submitted/under_review/published/rejected), doi, version
- Migration to add new columns
- Guided submission wizard (frontend): AI helps structure raw ideas into proper hypothesis format
- Community voting on hypothesis testability and significance
- AI-assisted hypothesis evaluation: feasibility scoring, related work search, methodology critique
- Threaded discussion comments with evidence links
- "Test this" bounties: community members or agents can claim a hypothesis to test/research
- Federation: export hypotheses as JSON-LD

## Key Technical Context
- Stack: React 18 + Vite + TypeScript + Express + Drizzle ORM + PostgreSQL + pgvector
- Follow the "Synapse Sprint Pattern" in the skill: schema → migration → storage interface → storage impl → route → register → typecheck
- BYOK model: generation uses the contributor's own API key. Reading cached content is free.
- Pre-existing TS errors exist (28 count) — do NOT try to fix them unless they're in files you're modifying
- The ./storage and ./tts-service and ./link-validator dynamic import errors in ai.ts are pre-existing and known
- Run migrations with: psql $DATABASE_URL -f migrations/NNNN_name.sql
- Branch strategy: feature/revamp-master-plan → develop (staging) → main (prod)

## Verification Commands
- Typecheck: ./node_modules/.bin/tsc --noEmit (expect ~28 pre-existing errors)
- Build: npm run build
- Run dev: npm run dev
