# Synapse Platform Master Revamp Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan phase-by-phase.

**Goal:** Transform Synapse from a single-user AI learning app into a collaborative, agent-native knowledge platform where humans AND AI agents learn, generate, validate, and contribute cross-domain knowledge to an open science commons.

**Architecture:** Monolith React+Express+Postgres (existing) with incremental additions — vector search (pgvector), agent API layer (MCP server), real-time collaboration (WebSockets), and federated open-science publishing. No full rewrite. Each phase ships independently.

**Tech Stack:** React 18/19, Vite 5, TypeScript, Express, PostgreSQL + pgvector + pg_trgm, Drizzle ORM, Tailwind/shadcn, WebSockets, MCP protocol, Three.js knowledge graph.

---

## How to Use This Document

1. Execute phases IN ORDER. Each phase has binary Success Criteria — do NOT mark [x] until ALL criteria pass.
2. Every task gets an atomic commit: `feat(scope): description` or `refactor(scope): description`.
3. Never commit secrets. Use `.env` + Coolify environment variables.
4. After completing a phase, update this doc's checkboxes and push.
5. This document is authoritative — if the README conflicts, update the README.

---

## Vision

Synapse is the learning platform humans AND AI agents wish they had:

- **Anyone** can learn any topic at the speed of reading/listening
- **Content is alive** — generated, improved, and versioned by humans and agents collaboratively
- **Knowledge connects** — a semantic web of cross-domain insights that grows with every learner
- **Discovery leads to contribution** — learners become researchers, generating novel cross-topic hypotheses
- **Agents are first-class citizens** — they learn, teach, review, and discover alongside humans

---

## Current State (May 2026)

### What Works
- 70 topics, 604 lesson units, 8 categories (seeded DB content)
- AI syllabus generation (xAI Grok primary, Gemini fallback)
- Kokoro WebGPU TTS with server-side fallback chain
- SM-2 spaced repetition flashcards
- 3D knowledge graph (react-force-graph-3d / Three.js)
- Mermaid.js concept diagrams, Sandpack code editors
- Pathways system (Physics, Engineering, etc.) with DAG prerequisites
- Open Science feed (submit ideas, upvote, comment)
- Practice tests (MCAT, GRE, SAT) with question bank
- Gamification: XP, levels, achievements, streaks, unlock keys, Nova Coins
- Custom topic generation from free-text
- Multi-provider AI: xAI, Gemini, HuggingFace, Ollama, OpenRouter
- Email/password auth (bcryptjs + express-session)

### What's Broken / Missing
- **No agent API** — Hermes or any agent can't interact programmatically
- **Content is static** — 604 units generated once, never improved by community
- **Knowledge graph is cosmetic** — nodes/edges aren't semantically queryable
- **No real-time features** — no collaborative annotations, study groups, or live discussions
- **Open Science is bare-bones** — submit text + upvote, no review pipeline, no structured hypotheses
- **No semantic search** — topics are found by scrolling/pagination, not by meaning
- **No content versioning** — can't see who improved what, can't roll back
- **No public read access** — gated behind auth, limiting discoverability
- **Cross-topic synthesis exist only as a chat prompt** — no dedicated system
- **Monolith routes file** — `server/routes.ts` is 4,941 lines

### Environment
- **Repo:** github.com/Jpalmer95/SynapseJourney
- **Live:** synapse.167.99.125.127.sslip.io (Coolify on DigitalOcean droplet)
- **DB:** PostgreSQL (neon.tech or self-hosted — verify)
- **Deploy:** GitHub push → Coolify auto-redeploy
- **Branch:** `main` only (no branch protection currently)

---

## Phase 0: Infrastructure Hardening & DX

**Why first:** The routes file is a 5000-line monolith. Before building new features, we need a maintainable foundation and proper branch workflow.

### 0.1 — Branch Protection & Feature Branch Workflow
- [ ] Create `develop` branch from `main`
- [ ] Enable branch protection on `main` (require PR + 1 review)
- [ ] Coolify auto-deploy on `develop` branch (staging) and `main` (production)
- **Success Criteria:** `git push origin develop` triggers staging deploy; `main` only via PR merge

### 0.2 — Route Decomposition
- [ ] Split `server/routes.ts` (4941 lines) into domain modules:
  - `server/routes/auth.ts` — authentication
  - `server/routes/topics.ts` — topics, categories, cards, feed
  - `server/routes/learning.ts` — roadmaps, progress, mastery, pathways
  - `server/routes/content.ts` — lesson units, SRS, custom topics
  - `server/routes/social.ts` — open science, achievements, challenges
  - `server/routes/ai.ts` — chat, content generation, infographics
  - `server/routes/tests.ts` — practice tests, question bank
  - `server/routes/agents.ts` — (new) agent API endpoints (stub)
  - `server/routes/index.ts` — re-exports all sub-routers
- **Success Criteria:** All existing endpoints work identically; no route file exceeds 600 lines

### 0.3 — Add pgvector Extension
- [ ] Enable pgvector on PostgreSQL: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Add `embedding` columns (`vector(1536)`) to `topics` and `lesson_units` tables via migration
- [ ] Add `pg_trgm` extension for full-text search: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- **Success Criteria:** `\dx` shows `vector` and `pg_trgm` installed; migration is reversible

### 0.4 — Environment & Secrets Audit
- [ ] Move all hardcoded API keys / emails to env vars (ADMIN_EMAILS already exists, verify others)
- [ ] Document required env vars in `.env.example`
- **Success Criteria:** `grep -r "api.key" server/` returns zero hardcoded secrets

---

## Phase 1: The Living Knowledge Base

**Core concept:** Content is not static. Every learner, every agent, every review improves the knowledge base. Think Wikipedia meets Anki meets AI.

### 1.1 — Semantic Search & Discovery
- [ ] Generate embeddings for all 70 topics using OpenAI `text-embedding-3-small` (or Gemini embedding)
- [ ] Add `GET /api/topics/search?q=...` endpoint with:
  - Vector similarity search (cosine distance < 0.3)
  - pg_trgm fuzzy text match (similarity > 0.3)
  - Combined ranked results
- [ ] Replace topic pagination on Explore page with search-first UI (search box prominent, browse secondary)
- **Success Criteria:** Searching "how do neural networks learn" returns "Machine Learning", "Neural Networks", "Deep Learning" in <500ms

### 1.2 — Content Versioning & Contribution System
New tables:
```
content_versions:
  id, unit_id, version_number, author_id, author_type (human|agent),
  content_json, change_summary, created_at

content_reviews:
  id, version_id, reviewer_id, reviewer_type, rating (1-5),
  feedback, approved (bool), reviewed_at
```
- [ ] Every content edit creates a new `content_version` (never overwrite)
- [ ] "Improve this lesson" button on every unit → opens editor with current content
- [ ] Submitted improvements go to review queue
- [ ] 2+ approvals (human or agent) → new version becomes active
- [ ] Show version history sidebar on lesson pages (like Wikipedia "View history")
- **Success Criteria:** Can edit a lesson, submit for review, and see it in the review queue

### 1.3 — Agent Content Generation Pipeline
- [ ] Add `POST /api/agents/generate-units` endpoint (authenticated with API key)
- [ ] Agent submits: `{ topic_id, difficulty, count, model_used, content_versions[] }`
- [ ] Generated content enters review queue like human contributions
- [ ] Rate limit: 50 units/hour per agent API key
- [ ] Track which agent/model generated each version (audit trail)
- **Success Criteria:** Hermes agent can generate 5 lesson units for a topic via API and they appear in review queue

### 1.4 — Knowledge Freshness System
- [ ] Add `last_verified_at` timestamp to `lesson_units`
- [ ] Cron job: flag units older than 180 days as "needs verification"
- [ ] Agents and humans can "verify" content (confirm still accurate) or flag for update
- [ ] Show freshness badge on lessons (✓ Verified 12 days ago, ⚠ Needs review)
- **Success Criteria:** Stale content displays warning badge; verification updates the timestamp

### 1.5 — Public Read Access
- [ ] Make `/api/topics`, `/api/topics/:id`, `/api/topics/:id/cards` publicly accessible (no auth)
- [ ] Make lesson content readable without login (read-only)
- [ ] Keep progress tracking, chat, contribution, and open science behind auth
- [ ] Add SEO meta tags + Open Graph for public topic pages
- **Success Criteria:** Unauthenticated user can browse topics, read lessons, see knowledge graph

---

## Phase 2: The Semantic Knowledge Web

**Core concept:** Knowledge isn't a tree — it's a web. The 3D graph becomes a real semantic network with queryable relationships, cross-domain bridges, and emergent insights.

### 2.1 — Semantic Topic Connections
Current `topic_connections` table has `connection_type` and `strength` but no semantic meaning.
New approach:
```
semantic_connections:
  id, from_topic_id, to_topic_id,
  connection_type (prerequisite|analogous|applies|contradicts|extends|inspires),
  description ("Fourier transforms in signal processing are mathematically
                analogous to decomposing quantum wavefunctions"),
  embedding vector(1536),    -- embedding of the description
  source (human|agent|system),
  confidence (0-100),
  created_at
```
- [ ] Migrate existing `topic_connections` → `semantic_connections` (enrich with descriptions)
- [ ] AI generates cross-domain connections: for each topic pair in different categories, generate a connection description
- [ ] Users/agents can propose new connections with explanation
- [ ] Connections ranked by confidence score
- **Success Criteria:** "Quantum Mechanics" ↔ "Music Theory" has a human-readable explanation of their mathematical relationship

### 2.2 — Knowledge Graph Becomes Queryable
- [ ] Knowledge graph nodes carry semantic data (not just position/color)
- [ ] Click a node → see: mastery level, connections with explanations, related Open Science ideas
- [ ] "Bridge Explorer" — given two mastered topics, show all semantic paths between them
- [ ] "Weak Links" — show connections with low confidence that need community validation
- **Success Criteria:** Clicking a node in the 3D graph shows a rich info panel with connections and explanations

### 2.3 — Embedding-Based "Related Insights" Sidebar
- [ ] On every lesson page, compute: "Learners who studied X also found Y insightful"
- [ ] Use embedding similarity across lesson content to find surprising cross-topic parallels
- [ ] Agent-generated "Did you know?" facts based on cross-domain embeddings
- **Success Criteria:** Reading about protein folding shows insight from origami mathematics

---

## Phase 3: Agent-Native Learning

**Core concept:** AI agents are first-class learners. They have profiles, track progress, generate content, ask questions, and collaborate with humans.

### 3.1 — MCP Server Endpoint
- [ ] Add `POST /api/mcp` endpoint implementing Model Context Protocol
- [ ] Tools exposed:
  - `synapse.search_topics(query)` — semantic search
  - `synapse.get_topic(topic_id)` — get topic + syllabus
  - `synapse.get_lesson(topic_id, unit_index)` — read lesson content
  - `synapse.submit_improvement(unit_id, content, rationale)` — propose edit
  - `synapse.submit_connection(from_topic, to_topic, explanation)` — propose bridge
  - `synapse.submit_idea(title, content, topics[])` — open science contribution
  - `synapse.get_knowledge_graph(user_id)` — user's knowledge map
- [ ] API key auth for agents (separate from user sessions)
- **Success Criteria:** Hermes can `hermes mcp add synapse --url https://synapse.../api/mcp` and use all tools

### 3.2 — Agent Learner Profiles
- [ ] Extend `userProfiles` or create `agent_profiles`:
  - agent_name, owner_user_id, api_key_hash, capabilities[]
  - topics_studied, contributions_count, review_score_average
- [ ] Agent dashboard on web UI showing what agents have learned/generated
- [ ] Agents earn the same XP/achievements as humans
- **Success Criteria:** Agent profile page shows learning history and contribution stats

### 3.3 — Agent-Human Collaboration Workflows
- [ ] "Agent Tutor" mode: an agent walks a human through a topic via the chat interface
- [ ] "Human Reviewer" queue: agents submit content, humans approve/reject with feedback
- [ ] "Agent Reviewer" agents: specialized agents that fact-check, find outdated info, suggest improvements
- [ ] Notification system: "An agent improved a lesson you studied — review the changes?"
- **Success Criteria:** End-to-end flow: agent generates content → enters review queue → human approves → becomes active lesson

### 3.4 — Autonomous Learning Bounties
- [ ] System identifies "knowledge gaps" — topics with poor coverage, stale content, no cross-links
- [ ] Creates learning bounties: "Generate 5 advanced units for CRISPR Gene Editing (reward: 500 XP)"
- [ ] Agents and humans can claim bounties
- [ ] Completed bounties feed into the review pipeline
- **Success Criteria:** Bounty board shows open tasks; completing one routes content through review

---

## Phase 4: Collaborative Learning

**Core concept:** Learning is social. Study groups, shared annotations, live discussions, and community-driven quality.

### 4.1 — Real-Time Infrastructure
- [ ] Add WebSocket server (ws library, or Socket.IO for rooms)
- [ ] Presence system: see who's online and what they're studying
- [ ] Notification bus for real-time updates
- **Success Criteria:** Two browser tabs see each other's presence in real-time

### 4.2 — Shared Annotations
- [ ] Users can highlight text in lessons and add annotations (public or private)
- [ ] See other learners' public annotations (like Genius.com for learning)
- [ ] Agent annotations: AI highlights key passages with explanations
- **Success Criteria:** Can highlight text, add a note, and see it as another user

### 4.3 — Study Groups
New tables:
```
study_groups: id, name, description, topic_ids[], created_by, is_public, created_at
group_members: id, group_id, user_id, role (owner|member), joined_at
group_messages: id, group_id, user_id, content, created_at
```
- [ ] Create/join study groups around topics or pathways
- [ ] Group chat (WebSocket-based)
- [ ] Group learning sessions: "speed run" a topic together with shared progress
- [ ] Agent members: invite a tutor agent to your study group
- **Success Criteria:** Can create a group, invite members, chat, and see shared progress

### 4.4 — Community Quality Signals
- [ ] "Helpful" voting on individual lesson sections (concept, analogy, example, quiz)
- [ ] Content quality score per unit (aggregate of section votes + review ratings)
- [ ] "Top Contributors" leaderboard (humans and agents ranked separately)
- [ ] Quality badges on lessons: ⭐ Community Verified, 🤖 AI Enhanced, ✍️ Expert Authored
- **Success Criteria:** Every lesson has visible quality signals; voting updates in real-time

---

## Phase 5: The Polymath Protocol (Cross-Topic Synthesis)

**Core concept:** The magic happens at the intersections. Force connections between disparate mastered domains to generate novel insights.

### 5.1 — Synthesis Quest System
- [ ] When user masters 2+ topics in different categories, offer "Synthesis Quest"
- [ ] AI generates a cross-domain problem requiring knowledge from both (e.g., "Apply fluid dynamics principles to optimize jazz improvisation patterns")
- [ ] Structured response format: hypothesis, methodology, potential applications
- [ ] Completed quests become Open Science submissions automatically
- **Success Criteria:** User mastering Physics + Music Theory gets a compelling synthesis challenge

### 5.2 — Cross-Domain Insight Engine
- [ ] Background job: analyze embedding similarities between lessons in different categories
- [ ] Surface "unexpected connections" in user feed: "The math behind neural network backprop is nearly identical to how river deltas form"
- [ ] Users can create their own cross-domain insight cards
- [ ] Best insights promoted to the knowledge graph as semantic connections
- **Success Criteria:** Feed shows at least 3 cross-domain insights per day based on user's studied topics

### 5.3 — Research Workspace
- [ ] Dedicated page for cross-topic research: canvas-style layout
- [ ] Drag topics onto canvas, see AI-suggested connections between them
- [ ] Export research notes as structured Open Science submissions
- [ ] Collaborative: multiple users/agents on the same canvas
- **Success Criteria:** Can create a research canvas with 3+ topics and get AI-suggested bridges

---

## Phase 6: Open Science Commons

**Core concept:** Learning → Discovery → Publication. The open science feed becomes a real preprint-style platform with structured submissions, agent-assisted review, and citable outputs.

### 6.1 — Structured Hypothesis Format
Extend `openScienceIdeas`:
```
abstract, hypothesis, methodology, 
related_topic_ids[], confidence_score,
status (draft|submitted|under_review|published|rejected),
doi (assigned on publication),
version (for revisions)
```
- [ ] Guided submission wizard: AI helps structure raw ideas into proper format
- [ ] "Confidence score" — AI estimates how well-supported the hypothesis is based on existing knowledge base
- [ ] Revision system: update hypotheses based on feedback
- **Success Criteria:** Submitting an idea walks through abstract → hypothesis → methodology → related work

### 6.2 — Agent-Assisted Peer Review
- [ ] On submission, trigger agent review pipeline:
  1. Fact-checker agent: validates claims against knowledge base
  2. Literature agent: finds related work (arXiv, existing Synapse ideas)
  3. Critic agent: identifies weaknesses, suggests improvements
  4. Synthesizer agent: connects to cross-domain concepts
- [ ] Human reviewer sees agent analysis + can agree/disagree/add notes
- [ ] 2 human approvals (or 1 human + unanimous agents) → "Published" status
- **Success Criteria:** Submitting an idea triggers 4 agent reviews within 5 minutes; human can review with agent context

### 6.3 — Citable Open Science Database
- [ ] Assign DOI-style persistent identifiers to published ideas
- [ ] Public API for querying published ideas (`GET /api/open-science/published`)
- [ ] Export to academic formats (BibTeX, Markdown, PDF)
- [ ] Cross-reference with external sources (arXiv, Semantic Scholar)
- [ ] Annual "Synapse Anthology" — best ideas curated into a published collection
- **Success Criteria:** Published ideas have stable URLs, can be cited, and are queryable via public API

---

## Phase 7: Accelerated Learning UX

**Core concept:** The UI should feel like "speed of thought" — minimal friction, maximum signal, zero wasted clicks.

### 7.1 — Unified Search & Command Palette
- [ ] Global Cmd+K / Ctrl+K command palette (Cmdk library already installed)
- [ ] Commands: search topics, jump to lesson, start review, submit idea, open group
- [ ] Fuzzy matching + semantic search combined
- **Success Criteria:** Cmd+K from anywhere → type "quan" → jump to Quantum Mechanics in <100ms

### 7.2 — Audio-First Mode
- [ ] "Podcast mode" — auto-convert any pathway into a sequential audio course
- [ ] Background audio player persists across pages (mini player)
- [ ] Speed control, skip, bookmark timestamps
- [ ] Agent-generated audio summaries for every topic
- **Success Criteria:** Can start a "Physics Pathway" audio playlist and listen hands-free

### 7.3 — Adaptive Difficulty (Test-Out & Speed-Run)
- [ ] Leverage existing `allowTestOut` profile field
- [ ] Pre-assessment quiz before starting any topic
- [ ] Pass with >80% → skip to advanced content automatically
- [ ] "Speed Run" mode: show only key takeaways + quizzes, skip deep content
- **Success Criteria:** Expert user can test out of beginner content in <2 minutes per topic

### 7.4 — Daily Learning Digest
- [ ] Email/push notification: "Today's 5-minute learning plan"
- [ ] Based on: SRS reviews due, pathway progress, new community content in studied topics
- [ ] One-click to jump into the recommended session
- **Success Criteria:** Daily email with personalized learning plan; clicking link opens the right lesson

---

## Future Roadmap (Post-Phase 7 — Do NOT Execute)

- **XR/VR Learning Sandboxes** — physics-bound 3D environments for experimentation
- **Micro-credentialing** — verifiable blockchain credentials for mastery
- **Lightning Network micro-bounties** — stake crypto on unsolved research roadblocks  
- **Feynman Technique AI Student** — AI that learns FROM you, detecting knowledge gaps
- **Mobile Native App** — React Native or Capacitor wrapper
- **Federated Instances** — run your own Synapse, federate knowledge base via ActivityPub
- **Voice-First Interaction** — full Socratic dialogue via STT→LLM→TTS pipeline

---

## Metadata

- **Created:** 2026-05-28
- **Author:** Jonathan Korstad + Hermes Agent
- **Status:** Phase 0 — Not Started
- **Last Updated:** 2026-05-28
- **License:** Apache-2.0

This document is authoritative. Update it as phases complete.
