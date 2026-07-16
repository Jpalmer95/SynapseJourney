# Phase 9 — Adaptive Learning UX

**Status:** In progress (foundation sprint)  
**Branch:** `feature/revamp-master-plan`  
**Goal:** Make Synapse the fastest way for curious / rapid learners to start any topic, switch depth or teaching style anytime, resume anywhere, and reach goals with AI-native structure + open resources.

---

## Product principles

1. **Zero cold-start friction** — type a topic or goal → structured path in seconds.
2. **Depth is a dial, not a prison** — survey one topic, deep-dive another; switch mid-course.
3. **Teaching style is ambient** — Socratic / Feynman / direct available in-context, not buried.
4. **Progress is durable** — pick up any topic exactly where you left off.
5. **Skim-first, drill-when-curious** — key takeaways + OER links always visible; deep content on demand.
6. **Goal-oriented paths** — “I need to X” produces a minimal efficient curriculum.
7. **Open knowledge first** — free OCW / OpenStax / LibreTexts / arXiv / freeCodeCamp links, validated.
8. **Audio that stays out of the way** — one-tap listen, smart engine defaults, no settings maze for first play.

---

## Learning modes

| Mode | Intent | Curriculum shape | Content rendering |
|------|--------|------------------|-------------------|
| **Survey** | Breadth, orientation | Fewer units, wide coverage | Skim cards + takeaways |
| **Standard** | Balanced path | AI-optimal plan | Full lesson sections |
| **Deep Dive** | Mastery | More units / sub-topics | Full + optional extensions |
| **Speed Run** | Test / rapid | Micro path | Takeaways + quiz-first |
| **Goal** | Task / trade outcome | Reverse-engineered from goal | How-to sequence + checkpoints |

**Tutor styles (orthogonal to depth):** Direct · Socratic · Feynman (optional graded).

Per-topic overrides beat global defaults. Changing mode never deletes progress; it re-ranks / re-presents remaining units.

---

## Architecture workstreams

### 9.1 Course planner wiring + intent-aware plans
- Wire `planCourseWithAI` into `generateLessonOutline` for non-seeded topics.
- Pass `learningIntent` + optional `goalDescription` into planner prompts.
- Persist plans in `course_plans` (versioned JSON + OER list).
- Seeded `SYLLABI_MAP` topics still use curated outlines.

### 9.2 Resume continuum
- `GET /api/learn/continue` — ranked in-progress topics with next unit + % complete.
- Home “Continue learning” strip + one-click resume into RabbitHole.
- Touch `user_progress` + `lesson_progress` on every unit open.
- Timeline events (`learning_timeline`) for started / completed / mode_changed / goal_set.

### 9.3 Goal-oriented learning
- `POST /api/learn/goal` — goal text → topic + intent-aware plan + first units.
- Goal cards on Explore/Home: “What do you want to accomplish?”
- Goals table tracks status, linked topic, milestone checklist.

### 9.4 In-lesson adaptive chrome
- Depth mode chips + tutor style chips in RabbitHole header.
- Skim view: keyTakeaways + externalResources + mermaid only.
- Full view: concept / analogy / example / practice.
- One-click open AI chat in Socratic or Feynman with unit context.

### 9.5 OER surface
- Surface `recommendedOER` from course plan on outline page.
- Prefer free resources in generation; keep SSRF-safe validation.

### 9.6 TTS de-clunk
- Default engine: Kokoro if ready, else Browser (instant). Advanced cloud under “More voices”.
- Sticky mini player while speaking (pause / skip section / speed).
- Prefer section-level speak (takeaways → concept) so learners can skim-listen.
- Don’t block first play on model download when Browser can speak immediately.

### 9.7 Open contribution hooks
- Document how contributors extend syllabi, OER maps, and planner prompts.
- Agent-friendly endpoints for plan generation + progress writeback (future MCP Phase 3).

---

## Schema (this sprint)

```
course_plans          — topicId, planJson, learningIntent, createdAt
learning_goals        — userId, goalText, topicId, status, planJson, createdAt
learning_timeline     — userId, topicId, eventType, metadata, createdAt
topic_learning_prefs  — userId, topicId, depthMode, tutorMode, contentView
user_profiles         — + defaultDepthMode, preferredTutorMode, defaultContentView
lesson_progress       — + lastSection (optional resume within unit)
user_progress         — + lastUnitId
```

---

## API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/learn/continue` | Resume cards |
| POST | `/api/learn/goal` | Goal → curriculum |
| GET/PUT | `/api/learn/prefs` | Global learning prefs |
| GET/PUT | `/api/learn/topics/:topicId/prefs` | Per-topic depth/tutor |
| GET | `/api/learn/timeline` | Learning journey events |
| GET | `/api/topics/:id/course-plan` | Stored AI plan + OER |

Outline generation accepts optional `learningIntent` when regenerating custom topics.

---

## Success criteria

1. Custom topic “How to solve a Rubik’s Cube” → micro plan; “Quantum Mechanics” → broad/deep plan (AI).
2. Logged-in home shows Continue cards; click resumes correct unit.
3. Learner can switch Survey ↔ Deep Dive mid-topic without losing completion.
4. Goal “Pass the first interview for backend eng” produces a practical multi-unit path with OER.
5. First TTS click speaks within ~1s on first visit (Browser fallback), Kokoro warms in background.
6. Socratic / Feynman toggles reachable from lesson view without hunting Settings.

---

## Out of scope this sprint (follow-ups)

- Full podcast / pathway audio playlist (Phase 7.2)
- Pre-assessment test-out UI (Phase 7.3)
- Email digest (Phase 7.4)
- Poster gallery UI (Phase 8.4 remaining)
- Open science board expansion (Phase 8.6)

---

## Implementation order

1. Schema + migration  
2. Storage + routes  
3. Wire planner + intents  
4. Continue + goal + prefs APIs  
5. Frontend chrome  
6. TTS default path polish  
7. Docs / master plan checkboxes / deploy notes  
