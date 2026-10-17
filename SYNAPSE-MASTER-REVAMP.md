# SynapseJourney — Polymath Learning & Open Science Platform Master Plan

> **For Autonomous Agents (Hermes, Claude, Codex):** Execute phases IN ORDER. Each phase ends with binary **Success Criteria** — only mark `[x]` after verifying with `tsc --noEmit`, `npm run build`, and concrete API/UI checks. Never introduce platform-funded LLM calls (BYOC is absolute).

**Goal:** Rebuild and unify SynapseJourney (`https://synapsejourney.org`) into a rapid, multifunctional, cross-industry learning and open-science platform where humans and personal AI agents learn anything breadthwise, depthwise, or via laser-focused JIT goals, map their personal 3D knowledge web over time, and apply cross-domain thinking against real SOTA bottlenecks and hypotheses.

**Architecture:** React 18 + Vite + TypeScript + Express + PostgreSQL (`pgvector` 768-dim HNSW + `pg_trgm`) + Three.js 3D PCA Knowledge Cloud + Native MCP Server (`/api/mcp`). Single operational + vector store (Option A: PostgreSQL `pgvector` + `pg_trgm` for topics, lessons, OER resources, and SOTA bottlenecks, with clean abstraction to scale to Qdrant/Milvus only if corpus exceeds ~500k vectors).

---

## 1. How to Use This Document

1. **Phase-by-phase execution:** Complete and verify Phase $N$ before starting Phase $N+1$.
2. **Strict BYOC invariant:** Reading cached content, browsing the 3D map, searching vectors, and client-side/ZeroGPU TTS are free. **Every** LLM generation path (outlines, lesson units, quizzes, posters, Socratic/Feynman chat, hypothesis reviews) MUST use the user's own configured provider (`generateByokOrPool(userConfig)`) or external agent authoring (`POST /api/learn/ingest` / `/api/mcp`) and return `402 BYOC_REQUIRED` when no user compute is configured.
3. **Findability & Resume Continuum invariant:** Every custom, goal, fused, or agent-ingested course MUST appear immediately in the user's Library / Command Center (`GET /api/learn/my-courses`) and resume at the exact unit/section where the learner left off.
4. **Canonical + Derived invariant:** PostgreSQL text/JSONB rows are canonical; `pgvector` embeddings and `topic_coordinates` 3D PCA projections are derived automatically on write and rebuildable anytime.

---

## 2. Vision & Core Pillars

1. **Adaptive Multi-Modal Learning (Depth, Breadth, JIT Goal, Cross-Domain Fusion):**
   - Courses dynamically fit the subject and the learner's intent—from a 3-unit, 2-tier rapid JIT repair/library guide to a 28-unit, 5-tier Physics curriculum with decomposable sub-topics.
   - **Feynman & Socratic Studio:** Interactive tutoring modes where learners either get guided by Socratic questioning or teach the AI student (Feynman mode) and receive structured rubric grading (*Clarity, Jargon-Free, Completeness, Analogy*) that awards mastery credit and logs to their timeline.
2. **Self-Growing Vector Knowledge & Resource Flywheel (`pgvector` + `pg_trgm`):**
   - As users and agents generate or ingest courses, lessons, OER links (MIT OCW, arXiv, OpenStax, LibreTexts, videos, tools), and SOTA roadblocks, the system automatically extracts, deduplicates, embeds, and indexes them into a searchable vector commons (`knowledge_resources` + `sota_bottlenecks`) and projects new topics into the 3D PCA coordinate space.
3. **Personal 3D+ Vector Knowledge Web & Account Timeline:**
   - Every learner has an evolving 3D semantic point map (`Applied ↔ Theoretical`, `Natural ↔ Synthetic`, `Micro ↔ Macro`) with real-time mastery sync (`0–100%`), a working time-horizon filter, a toggle between **My Knowledge Web** and **Global Atlas**, multi-node selection to **Fuse Courses** or run a **Synthesis Quest**, and void/gap detection.
   - Profile & Journey view surfaces the user's full chronological `learning_timeline`, real streaks, earned `course_posters`, and contributions.
4. **SOTA Bottleneck Registry & Open Science Commons:**
   - Every field/topic surfaces both curated and AI-identified **SOTA Bottlenecks & Open Roadblocks** (`sota_bottlenecks`).
   - Learners are encouraged to apply their unique cross-industry thinking against these bottlenecks: 1-click **"Apply My Thinking / Propose Hypothesis"** bridges any lesson or bottleneck directly into a structured Open Science hypothesis (`hypothesis`, `methodology`, `falsifiability`, `crossDomainTopicIds`, `bottleneckId`) with optional BYOC/agent peer review.
5. **Polymath Command Center UI & Agent-Native MCP:**
   - Replaces the legacy single-card swipe feed on `/` with the **Polymath Command Center**: Unified Search + `Cmd+K` palette, Active Journeys continuum, 4-Mode Launchpad (*JIT Goal, Custom Depth/Breadth, Cross-Domain Fusion, Personalized Explore*), Due SRS Flashcards, Live Mini-3D Web, and SOTA Bottleneck Pulse.
   - Exposes a native **MCP Server (`/api/mcp`)** authenticated with `sj_...` PATs so Hermes Agent, Claude, Cursor, or any personal agent can search the vector graph, inspect the learner's progress/map, upload courses/expansions, and contribute SOTA bottlenecks or hypotheses.

---

## 3. Current Audit & Root-Cause Bottlenecks (Resolved by This Plan)

1. **BYOC Cost Leaks:** `GET /api/lessons/unit/:unitId/content`, `POST /api/lessons/unit/:unitId/quiz`, `POST /api/lessons/:topicId/poster`, `GET /api/roadmap/:topicId`, and `POST /api/custom-topics` still called `generateCourseContent()` (platform keys) instead of `generateByokOrPool(userConfig)`.
2. **Rigid 4-Tab Course UI & Dropped Sub-Topics:** `planCourseWithAI` produced custom tier names (`tierName`, `tierIndex`) and `subTopics`, but `rabbit-hole.tsx` rendered a hardcoded 4-tab (`beginner/intermediate/advanced/nextgen`) selector and ignored `subTopics` and `pitchFramework`.
3. **Silent Vector & 3D Map Drift on New Topics:** Creating a topic via Goal, Custom Course, Fusion, or Hermes Ingest left `topics.embedding` NULL and created no `topic_coordinates` row, making new courses invisible to vector search and placing them in a fake fallback circle on the 3D map.
4. **Disconnected Progress → 3D Map Mastery:** `completeLesson()` updated `lesson_progress` and `topic_mastery`, but never updated `user_progress.mastery` (`0–100%`) or `user_progress.status` (`learning` → `mastered`), leaving the user's 3D map stuck at `0%`.
5. **Siloed Open Science:** NextGen `openRoadblocks`, unit-level `idea_contributions` (Pioneer board), and `/open-science` (`open_science_ideas`) were three separate, unlinked islands with no structured hypothesis schema or bottleneck registry.
6. **Home UX & Navigation Fragmentation:** `/` trapped users in a 1-card-at-a-time vertical swipe feed (`NebulaFeed`) and split navigation across 8 cramped items; `profile.tsx` had hardcoded streak numbers (`currentStreak: 7`) and never rendered `learning_timeline` or `course_posters`.

---

## 4. Phased Execution Plan

### Phase 1: Core Engine Hardening — Strict BYOC, Dynamic Course Tiers/Sub-Topics, Auto-Vector & 3D Projection, and Mastery Sync
**Objective:** Close all platform AI cost leaks, make the course viewer render dynamic AI-planned tiers and sub-topics, automatically embed + project every new/ingested course into `pgvector` and the 3D PCA map, and sync unit completions to `user_progress` so the 3D map reflects real mastery.

- [x] **1.1 Strict BYOC Enforcement Across All Generation Paths**
  - Update `server/ai-providers.ts` to support native Anthropic (`https://api.anthropic.com/v1/messages`) in `ByokAnthropicProvider` and `testByokConnection`.
  - Refactor `generateLessonContent`, `generateBatchLessonContent`, `generateNextGenContent`, and `generateOnDemandQuiz` in `server/routes/ai.ts` to accept `userConfig?: ProviderConfig` and route through `generateByokOrPool` (never platform keys).
  - Update `GET /api/lessons/unit/:unitId/content`, `POST /api/lessons/unit/:unitId/quiz`, `POST /api/lessons/:topicId/poster`, `GET /api/roadmap/:topicId`, and `POST /api/custom-topics` in `server/routes.ts` to load the user's BYOC config from `userProfiles` / `userApiKeys` and return `402 BYOC_REQUIRED` (with clear Settings + Hermes PAT guidance) when unconfigured.
  - Remove legacy Dogecoin / Unlock Key purchase UI dead code from `rabbit-hole.tsx`.
- [x] **1.2 Self-Growing Vector & 3D Coordinate Flywheel + Resource/Bottleneck Tables**
  - Add `knowledge_resources` table (`id`, `topicId`, `unitId`, `title`, `url`, `resourceType`, `description`, `isFreeOer`, `embedding vector(768)`, `createdAt`) and `sota_bottlenecks` table (`id`, `topicId`, `unitId`, `domain`, `title`, `description`, `whyItMatters`, `currentApproaches jsonb`, `openQuestions jsonb`, `difficulty`, `status`, `source`, `createdByUserId`, `upvotes`, `embedding vector(768)`, `createdAt`) in `shared/schema.ts` + SQL migration `migrations/0011_polymath_flywheel.sql`.
  - Extend `open_science_ideas` with structured hypothesis columns (`bottleneckId`, `hypothesis`, `methodology`, `falsifiability`, `crossDomainTopicIds integer[]`, `evidenceLinks jsonb`, `confidenceScore integer`, `aiReviewJson jsonb`, `status text`).
  - Upgrade `server/embeddings.ts` with `indexTopicToFlywheel(topicId)` and `indexUnitToFlywheel(unitId, topicId, contentJson)`:
    - Computes 768-dim embedding via local Ollama (`nomic-embed-text`) when reachable.
    - Projects the topic onto the 3D semantic axes (`Applied ↔ Theoretical`, `Natural ↔ Synthetic`, `Micro ↔ Macro`) by computing cosine/ridge projection against existing `topic_coordinates` anchor poles (or semantic keyword + neighbor interpolation when Ollama is offline) and upserts `topic_coordinates` + nearest-neighbor `topic_connections`.
    - Automatically extracts `externalResources` / `recommendedOER` into `knowledge_resources` and `openRoadblocks` / `industryChallenge` into `sota_bottlenecks`.
  - Hook `indexTopicToFlywheel` and `indexUnitToFlywheel` into `/api/learn/goal`, `/api/learn/custom-course`, `/api/learn/fuse`, `/api/learn/ingest`, and unit content generation.
- [x] **1.3 Real Progress, Mastery & Streak Synchronization**
  - Update `storage.completeLesson(userId, unitId, quizScore)` and `/api/lessons/complete` so completing a unit:
    - Recalculates `completedUnits / totalUnits` (0–100%) for the topic and updates `user_progress.mastery` and `user_progress.status` (`learning` → `mastered` at $\ge 80\%$ or all non-nextgen units complete).
    - Records `completed` and `mastered` events in `learning_timeline`.
  - Fix `GET /api/user/stats` in `server/routes.ts` to return real `currentStreak` and `longestStreak` from `storage.getUserStreak(userId)` instead of hardcoded `7` and `14`.
- [x] **1.4 Dynamic Course Architecture UI (Custom Tiers, Sub-Topics, Pitch Framework)**
  - Update `GET /api/lessons/:topicId/outline` to include `coursePlan` (`tiers`, `scope`, `subTopics`, `recommendedOER`, `fusion`, `agentContext`) alongside `units`.
  - Refactor `client/src/components/rabbit-hole.tsx`:
    - Dynamically render only the tiers that actually have units (or the tiers defined in `coursePlan`), displaying the AI-chosen descriptive tier names (`tierName` extracted from unit outline `[Tier Name]` or `coursePlan.tiers`) instead of forcing 4 empty tabs.
    - Render **Sub-Topic Modules** when `coursePlan.planJson.subTopics` is present, allowing 1-click spawning/opening of any sub-topic as a linked course.
    - Render the `pitchFramework` and `crossDomainInsights` sections in Frontier/NextGen units, with a 1-click **"Turn into Open Science Hypothesis"** button.
- **Phase 1 Success Criteria:**
  - `./node_modules/.bin/tsc --noEmit` and `npm run build` succeed with 0 errors.
  - Unconfigured users triggering uncached generation receive `402 BYOC_REQUIRED` (zero platform key fallback).
  - Ingesting or creating a course populates `topic_coordinates` and `user_progress`, renders custom tier names in `RabbitHole`, and updates 3D map mastery % on unit completion.

---

### Phase 2: Polymath Command Center, Global `Cmd+K`, & Navigation Unification
**Objective:** Replace the legacy single-card swipe feed on `/` with the **Polymath Command Center**, unify navigation into 5 high-signal destinations, and add a global `Cmd+K` command palette.

- [x] **2.1 Polymath Command Center (`client/src/pages/home.tsx`)**
  - Build `PolymathCommandCenter` as the primary `/` dashboard:
    1. **Hero Search & Intent Bar:** Instant hybrid search (`/api/search` across topics, lessons, OER resources, and SOTA bottlenecks) + `Cmd+K` trigger.
    2. **4-Mode Rapid Launchpad:** Prominent interactive studio for **JIT Goal** (*"Fix/build/solve X today"*), **Custom Depth/Breadth** (*Survey / Standard / Deep / Speed-Run*), **Cross-Domain Fusion** (*combine 2–6 topics into a synthesis course + capstone*), and **AI Curated Explore**.
    3. **Active Learning Continuum:** Resumable cards for active goals, Hermes-authored courses, and in-progress topics with progress bars, depth badges, and 1-click **"Resume Unit N"**.
    4. **Interactive 3D Knowledge Web Preview & Stats Widget:** Live mini-stats of explored/mastered nodes, active streak, due SRS flashcards (`SrsWidget`), and 1-click jump to the 3D Map.
    5. **SOTA Bottlenecks & Cross-Domain Pulse:** Highlights open industry bottlenecks and recent hypotheses from the user's studied categories.
    6. **Optional "Quick Discovery Cards" drawer/tab:** Preserves `NebulaFeed` as an optional secondary tab for casual browsing without blocking the Command Center.
- [x] **2.2 Global `Cmd+K` Command Palette (`client/src/components/command-palette.tsx`)**
  - Wire `cmdk` globally in `AppLayout` (`Cmd+K` / `Ctrl+K`): jump to any topic, search lessons/OER/bottlenecks, launch a JIT Goal or Fusion course, open Socratic/Feynman tutor, or navigate to any view in `<100ms`.
- [x] **2.3 Streamlined 5-Pillar Navigation (`client/src/components/navigation.tsx`)**
  - Consolidate desktop rail and mobile bottom nav into 5 clear destinations:
    1. **Command (`/`):** Polymath Command Center
    2. **3D Web (`/map`):** Personal & Global 3D Vector Knowledge Map
    3. **Pathways (`/pathways`):** Curated & Custom Multi-Topic Pathways
    4. **Open Science (`/open-science`):** SOTA Bottlenecks, Hypotheses, & OER Resource Commons
    5. **Journey (`/profile`):** Learning Timeline, Completion Posters, Trophies, Saved Library, & Stats
- **Phase 2 Success Criteria:**
  - Opening `/` renders the Polymath Command Center; `Cmd+K` works from every route; mobile and desktop navigation cleanly expose all 5 pillars.

---

### Phase 3: SOTA Bottleneck Registry & Open Science Commons Rebuild
**Objective:** Turn `/open-science` into a rigorous, engaging **SOTA Bottleneck & Open Science Commons** where fixed and generative industry roadblocks live alongside structured learner/agent hypotheses.

- [x] **3.1 SOTA Bottlenecks API & Seeded Frontier Roadblocks (`server/routes/social.ts`)**
  - Add endpoints:
    - `GET /api/open-science/bottlenecks` (filter by domain/topic, search semantically)
    - `POST /api/open-science/bottlenecks` (submit or AI-extract bottlenecks from a topic using BYOC or PAT)
    - `POST /api/open-science/:id/review` (BYOC AI peer-review: evaluates hypothesis feasibility, falsifiability, cross-domain novelty, and suggests next experiments)
  - Seed initial high-signal SOTA bottlenecks across STEM, AI/ML, Physics, Biotech, Energy, and Software Engineering, plus auto-harvest bottlenecks from existing NextGen units.
- [x] **3.2 Unified Open Science & Bottleneck UI (`client/src/pages/open-science.tsx`)**
  - Three-tab experience:
    - **SOTA Bottlenecks & Roadblocks:** Browse unsolved bottlenecks by industry/topic, see *Why It Matters*, *Current Approaches*, and *Open Questions*, and click **"Formulate Hypothesis"**.
    - **Hypotheses & Lab Notes:** Structured hypothesis cards showing linked bottleneck, cross-domain topic tags, abstract/hypothesis, methodology, falsifiability check, AI peer-review badge, community upvotes, and threaded discussion.
    - **OER Resource Commons:** Searchable Open Educational Resource library (`knowledge_resources`) across courses, textbooks, papers, and videos.
  - Bridge the lesson-view Pioneer Idea form (`rabbit-hole.tsx`) so roadblock cards pre-fill structured hypotheses.
- **Phase 3 Success Criteria:**
  - Learners can browse SOTA bottlenecks, click "Formulate Hypothesis" from either `/open-science` or inside a course unit, submit a structured cross-domain hypothesis, and run a BYOC peer-review evaluation.

---

### Phase 4: Interactive 3D+ Personal Knowledge Web & Journey Portfolio
**Objective:** Upgrade the 3D Knowledge Graph into a true **Personal Vector Point Map** with timeline filtering, personal web toggle, and a rich **Journey & Portfolio** profile page.

- [x] **4.1 3D Personal Knowledge Web Upgrades (`client/src/components/knowledge-graph-3d.tsx`)**
  - **View Filter Toggle:** Switch between **Global Atlas**, **My Web** (only topics started, mastered, or created by the user), and **Mastered**.
  - **Working Time-Horizon Slider:** Connect the bottom timeline slider (`Last N days` / `All Time`) to filter nodes by `userProgress.lastAccessedAt`.
  - **Origin-Centered Deterministic Placement:** Nodes without PCA coordinates sit cleanly inside `[-120, 120]` around the 3D semantic axes origin, while new/ingested topics auto-project into `topic_coordinates`.
- [x] **4.2 Journey Timeline & Poster Portfolio (`client/src/pages/profile.tsx`)**
  - Add **Chronological Learning Log** (`GET /api/learn/timeline` with badges for goals started, units completed, and mastery events).
  - Add **Earned Course Completion Posters Gallery** (`GET /api/learn/posters`) with `CoursePoster` cards.
  - Add quick links to Saved Library (`/saved`), Trophies (`/achievements`), and BYOC & MCP Settings (`/settings`).
- [x] **4.3 Enhanced Feynman & Socratic Studio (`client/src/components/ai-chat.tsx` + `server/routes/ai.ts`)**
  - Support Direct, Socratic, and Feynman tutor modes across all 8 BYOC providers (`xai`, `gemini`, `anthropic`, `openrouter`, `huggingface`, `ollama`, `lmstudio`, `custom_openai`).
- **Phase 4 Success Criteria:**
  - The 3D map filters by personal web and time horizon, and `/profile` displays the real learning timeline, streaks, and earned completion posters.

---

### Phase 5: Agent-Native MCP Server & Unified Resource Library
**Objective:** Allow any personal AI agent (Hermes Agent, Claude Desktop, Cursor, custom MCP clients) to connect to SynapseJourney via standard JSON-RPC MCP, and expose the growing OER Resource Library in the UI.

- [x] **5.1 Native MCP Server Endpoint (`server/routes/mcp.ts`)**
  - Implement JSON-RPC 2.0 MCP endpoint at `POST /api/mcp` and `GET /api/mcp` discovery manifest (authenticated via `Authorization: Bearer sj_...` PAT or session):
    - `synapse.search_knowledge`: Hybrid semantic + keyword search across topics, lessons, OER resources, and SOTA bottlenecks.
    - `synapse.get_course`: Returns full outline, units, course plan, SOTA bottlenecks, and OER resources for a topic.
    - `synapse.ingest_course`: Uploads a newly authored course or appends deep-dive units to an existing `topicId` (zero server AI).
    - `synapse.list_sota_bottlenecks` & `synapse.propose_sota_bottleneck`: Lists or registers SOTA bottlenecks for a topic/domain.
    - `synapse.submit_hypothesis`: Publishes a structured cross-domain hypothesis to the Open Science Commons.
    - `synapse.get_3d_map`: Returns the user's 3D knowledge graph nodes, semantic coordinates, and mastery.
- [x] **5.2 Searchable OER & Media Resource Library (`/api/resources` + Open Science OER Commons tab)**
  - Add `GET /api/resources` and `POST /api/resources` backed by the `knowledge_resources` table + automatic extraction from course plans and lesson units.
- [x] **5.3 Update `synapse-journey` Hermes Skill**
  - Update the local `synapse-journey` skill (`SKILL.md`) with the new MCP endpoint and SOTA bottleneck / hypothesis authoring flows.
- **Phase 5 Success Criteria:**
  - `POST /api/mcp` responds to `initialize`, `tools/list`, and `tools/call` for all 7 tools using a PAT; OER Commons surfaces searchable resources; `tsc --noEmit` and `npm run build` pass cleanly.

---

## Metadata
- **Updated:** 2026-10-17
- **Owner:** Jonathan Korstad + Hermes Agent
- **Branch:** `feat/polymath-platform-rebuild`
- **Status:** Completed Phases 1–5 (Verified & Ready for Production)
