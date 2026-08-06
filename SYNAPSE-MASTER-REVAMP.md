# Synapse Platform Master Revamp Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan phase-by-phase.

**Goal:** Transform Synapse from a single-user AI learning app into a collaborative, agent-native knowledge platform where humans AND AI agents learn, generate, validate, and contribute cross-domain knowledge to an open science commons.

**Architecture:** Monolith React+Express+Postgres (existing) with incremental additions — vector search (pgvector), agent API layer (MCP server), real-time collaboration (WebSockets), and federated open-science publishing. No full rewrite. Each phase ships independently.

**Tech Stack:** React 18/19, Vite 5, TypeScript, Express, PostgreSQL + pgvector + pg_trgm, Drizzle ORM, Tailwind/shadcn, WebSockets, MCP protocol, Three.js knowledge graph.

---

## The Sustainability Model: "Learn Free, Create With Your Own"

### Core Principle
**Synapse never pays for content generation. Period.**

The platform's cost should be near-zero regardless of user count. Reading/studying existing content is free (just serving cached PostgreSQL rows). Generating new or improved content uses the CONTRIBUTOR'S compute, not the platform's.

### The Five Cost Tiers

```
┌─────────────────────────────────────────────────────────────┐
│                    SYNAPSE COST MODEL                        │
├────────────────────────┬────────────────────────────────────┤
│ READING cached content │ Platform pays: ~$0 (DB queries)    │
│ BROWSING knowledge map │ Platform pays: ~$0 (static data)   │
│ TTS (browser voices)   │ Platform pays: $0 (client-side)    │
│ REVIEWING/improving    │ Creator pays: their own API key    │
│ GENERATING new content │ Creator pays: their own API key    │
├────────────────────────┴────────────────────────────────────┤
│ Platform-only costs: hosting ($5-20/mo), DB ($0-5/mo)      │
│ These are fixed regardless of user count.                    │
└─────────────────────────────────────────────────────────────┘
```

### BYOK by Default (Bring Your Own Key)

Already partially built! The `userProfiles` table stores:
- `huggingFaceToken` — free tier (Meta Llama, Mistral, etc.)
- `ollamaUrl` — self-hosted (zero marginal cost)
- `openRouterKey` — pay-per-use with many models
- NEW: `xAIKey`, `anthropicKey`, `geminiKey` — direct provider keys

**The flow:**
1. User signs up → gets access to ALL existing seeded content (70 topics, 604 units) for free
2. User wants to generate a NEW custom topic → system asks for an API key or suggests local Ollama
3. Agent wants to contribute content → agent provides its own API key in the agent profile
4. Anyone wants to IMPROVE existing content → their key pays for the generation, content enters review

**For users with no keys:**
- All 604 pre-generated lessons remain free forever (cached, never regenerated on-demand)
- Browser-native TTS (Web Speech API / Kokoro WebGPU) = zero cost
- Community-generated content becomes available to everyone once reviewed and approved
- A "Community Pool" (see below) funds generation for underserved topics

### The Community Compute Pool

For users who can't afford their own API keys but want to contribute:
- **Seed fund:** Platform maintains a small shared API budget ($20-50/month)
- **Sponsorships:** GitHub Sponsors / Open Collective to fund the pool
- **Bounty model:** External sponsors post bounties ("Generate content about X, we pay $Y")
- **Agent donations:** Agents with surplus compute (e.g., running on free-tier HuggingFace) contribute for free
- **Strict caps:** Pool generates max 10 units/day, prioritized by community votes

This means the platform can ALWAYS serve content even if the seed fund runs dry — the 604 existing units are permanent. The pool is purely for growth.

### Content Review & Quality Gates

Without quality control, open contribution = spam and misinformation. Multi-tier trust system:

```
┌──────────────────────────────────────────────────────────────┐
│                    CONTRIBUTOR TRUST TIERS                    │
├──────────┬───────────────────────────────────────────────────┤
│ Level 0  │ New contributor (human or agent)                  │
│ (New)    │ → 2 human approvals required                      │
│          │ → Auto quality check (format, length, coherence)  │
├──────────┼───────────────────────────────────────────────────┤
│ Level 1  │ 5+ approved contributions                         │
│ (Trusted)│ → 1 human approval OR 2 agent approvals          │
│          │ → Content goes live faster                        │
├──────────┼───────────────────────────────────────────────────┤
│ Level 2  │ 20+ approved contributions, 0 flags               │
│ (Expert) │ → Auto-approved if passes quality checks          │
│          │ → Can review others' contributions                │
├──────────┼───────────────────────────────────────────────────┤
│ Agent    │ Registered agent with owner accountability        │
│ Verified │ → Owner (human) vouches for agent behavior        │
│          │ → Rate-limited (50 units/hour)                    │
│          │ → All output logged with model name + version     │
└──────────┴───────────────────────────────────────────────────┘
```

### Automated Quality Checks (run on every submission)

1. **Format validation** — matches expected JSON schema (concept, analogy, quiz, etc.)
2. **Coherence scoring** — lightweight model checks if content is self-consistent
3. **Factual anchoring** — require at least 2 verifiable external sources per unit
4. **Plagiarism check** — embedding similarity against existing content (< 80% overlap)
5. **Safety filter** — block harmful content (violence, illegal, CSAM, spam patterns)

### Contributor Policy (click-to-accept on first contribution)

```
SYNAPSE CONTRIBUTOR POLICY (v1.0)

By contributing content to Synapse, you agree that:

1. LICENSE: Your contribution is licensed under CC-BY-SA 4.0.
   Anyone may use, share, and adapt it with attribution.

2. RESPONSIBILITY: You are responsible for the accuracy and
   legality of your contribution. The Synapse platform is a
   hosting service and does not endorse any contributed content.

3. AI-GENERATED: If your contribution was AI-generated, you
   must disclose the model used and review the output for
   accuracy before submitting.

4. REVIEW: Your contribution will undergo quality review.
   The platform reserves the right to remove content that
   fails review, receives community flags, or violates policy.

5. ATTRIBUTION: You will be credited as author. Agent-authored
   content credits both the agent and its human owner.

6. TAKEDOWN: The platform follows DMCA-compliant takedown
   procedures for copyright claims.
```

### Cost Protection Architecture

```
                    ┌─────────────────────┐
                    │   SYNAPSE SERVER    │
                    │  (your $5/mo VPS)   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼───────┐ ┌─────▼──────┐ ┌───────▼───────┐
     │ CACHED CONTENT │ │  BYOK API  │ │ COMMUNITY POOL│
     │ (604+ units)   │ │  ROUTING   │ │ (capped budget│
     │ Serves FREE    │ │ User's key │ │ $20-50/month) │
     │ forever        │ │ pays       │ │ shared fund   │
     └────────────────┘ └────────────┘ └───────────────┘
          │                  │                │
          │    All read the same content      │
          │    regardless of how it was       │
          └────── generated or funded ────────┘
```

**Key insight:** Your server cost is the DATABASE + WEB SERVER only.
The $5-20/month Coolify droplet handles thousands of concurrent readers
because serving JSON from PostgreSQL is trivially cheap. The expensive
part (LLM API calls) is always paid by whoever triggers the generation.

### Rate Limits & Abuse Prevention

| Actor | Generating | Reading | Reviewing |
|-------|-----------|---------|-----------|
| Anonymous | 0 | Unlimited | 0 |
| New user | 5/day (own key) | Unlimited | 10/day |
| Trusted user | 50/day (own key) | Unlimited | Unlimited |
| Agent | 50/hour (own key) | Unlimited | Unlimited |
| Community pool | 10/day (shared) | — | — |

### The Flywheel Without the Cost

```
Existing content (free) ──→ User learns ──→ User/agent wants
                                    │         to contribute
                                    │              │
                                    ▼              ▼
                            Knowledge grows   They bring their
                            (more free        own API keys
                             content)         (their cost)
                                    │              │
                                    └──────┬───────┘
                                           ▼
                                   Better platform
                                   attracts more users
                                   (readers = free)
```

**The point:** Every new reader costs you nothing. Every new contributor
pays their own way. The platform's cost is approximately constant regardless
of growth.

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

- **Anyone** can learn any topic at the speed of reading/listening — from Rubik's Cube to Quantum Mechanics
- **Dynamic course sizing** — courses are not forced into a fixed template; AI determines the optimal curriculum shape, depth, and structure for each subject
- **Content is alive** — generated, improved, and versioned by humans and agents collaboratively
- **Knowledge connects** — a semantic web of cross-domain insights that grows with every learner
- **Discovery leads to contribution** — learners become researchers, generating novel cross-topic hypotheses
- **Agents are first-class citizens** — they learn, teach, review, and discover alongside humans
- **On-demand quizzes** — quizzes are generated when the learner requests them (using their own compute), not pre-baked into every lesson — saving 30%+ token cost
- **Open Educational Resources** — curricula are built around free OER (MIT OCW, Khan Academy, OpenStax, LibreTexts, Wikiversity, arXiv)
- **Course completion posters** — fun, visually condensed summaries generated after completing all sections of a course
- **Progress timeline** — track learning journey over time for review and encouragement
- **Open decentralized science board** — anyone can contribute ideas and hypotheses; the open science community + AI test, consider, and discuss them openly
- **Cross-topic insights** — encourage novel approaches using blended methodology and critical thinking across industries and domains

### Design Principles

1. **Not accreditation — learning.** The goal is to enhance learning capacity, cross-industry knowledge, and speed. Any user can learn at any pace on any subject.
2. **Learn free, create with your own.** Reading cached content is free forever. Generation uses the contributor's own compute (BYOK).
3. **Dynamic, not rigid.** Courses should fit the subject, not force the subject into a fixed box. A micro-topic gets 2-6 units; an interdisciplinary field gets 20-30+ with sub-topic decomposition.
4. **PWA first.** Works anywhere on nearly any device — offline-capable, installable, responsive.
5. **Open by default.** Source code on GitHub, content CC-BY-SA 4.0, built on open educational resources.

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
- **Live:** https://synapsejourney.org (primary) · https://www.synapsejourney.org · legacy: synapse.167.99.125.127.sslip.io (Coolify Traefik on DigitalOcean droplet)
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
- [x] Add `GET /api/search?q=...` endpoint with:
  - [x] Vector similarity search (cosine distance < 0.3)
  - [x] pg_trgm fuzzy text match (similarity > 0.15)
  - [ ] Combined ranked results (currently separate, needs merge logic)
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
- [x] Every content edit creates a new `content_version` (never overwrite)
- [ ] "Improve this lesson" button on every unit → opens editor with current content
- [x] Submitted improvements go to review queue
- [x] 2+ approvals (human or agent) → new version becomes active
- [ ] Show version history sidebar on lesson pages (like Wikipedia "View history")
- **Success Criteria:** Can edit a lesson, submit for review, and see it in the review queue

### 1.3 — BYOK Content Generation Pipeline (PLATFORM PAYS NOTHING)

This is the most critical new feature. All generation uses contributor's key, not the platform's.

- [x] Extend `userProfiles` with: `xai_key`, `anthropic_key`, `gemini_key` (encrypted at rest with app-level encryption key)
- [x] Create `user_api_keys` table for BYOK storage (separate from user session auth)
- [ ] Refactor `server/ai-providers.ts` to accept per-request credentials: `getProvider(userCredentials)` returns a client configured with the user's key
- [ ] Add middleware: `requireByokProvider` — checks user has a configured key before allowing generation endpoints
- [ ] Update all generation endpoints (`/api/custom-topics`, `/api/chat`, `/api/agents/generate-units`) to route through user's key
- [x] Add "Connect AI Provider" API: POST /api/byok/keys (frontend settings page still needed)
- [ ] Add "Community Pool" provider mode: platform's small shared key with strict daily budget cap (env var `POOL_DAILY_BUDGET=50`)
- [ ] Pool queue: if pool is exhausted (daily budget spent), show "Pool exhausted. Connect your own key or try again tomorrow."
- **Success Criteria:** Platform API key env vars can be removed entirely. All generation uses user/agent keys. Pool has a hard daily spend cap that cannot be exceeded.

### 1.4 — Agent Content Generation Endpoint
- [ ] Add `POST /api/agents/generate-units` endpoint (authenticated with agent API key)
- [ ] Agent submits: `{ topic_id, difficulty, count, model_used, content_versions[] }`
- [ ] Agent's API key pays for any server-side generation (BYOK or community pool)
- [ ] Generated content enters review queue like human contributions
- [ ] Rate limit: 50 units/hour per agent API key
- [ ] Track which agent/model generated each version (audit trail)
- **Success Criteria:** Hermes agent can generate 5 lesson units for a topic via API, using its own key, and they appear in review queue

### 1.5 — Knowledge Freshness System
- [x] Add `last_verified_at` timestamp to `lesson_units`
- [ ] Cron job: flag units older than 180 days as "needs verification"
- [x] Agents and humans can "verify" content (confirm still accurate) or flag for update
- [x] Show freshness badge on lessons (✓ Verified 12 days ago, ⚠ Needs review)
- **Success Criteria:** Stale content displays warning badge; verification updates the timestamp

### 1.6 — Public Read Access
- [x] Make `/api/topics`, `/api/topics/:id`, `/api/topics/:id/cards` publicly accessible (no auth)
- [x] Make lesson content readable without login (read-only via optionalAuth middleware)
- [x] Keep progress tracking, chat, contribution, and open science behind auth
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

## Phase 8: Dynamic Course Architecture & Open Learning Enhancement

**Core concept:** Courses should fit the subject, not force the subject into a fixed box. AI determines the optimal curriculum shape, quizzes are on-demand, and content is built around open educational resources.

### 8.1 — AI-First Dynamic Course Planning
Instead of forcing every topic into beginner/intermediate/advanced/nextgen with fixed unit counts, an LLM now determines the optimal curriculum structure for each topic.

- [x] Create `server/course-planner.ts` — AI-driven curriculum planning that determines:
  - Scope (micro / focused / standard / broad / interdisciplinary)
  - Number of tiers (1-5+, with descriptive names — not always "beginner/advanced")
  - Units per tier (based on actual depth needed, not a fixed template)
  - Content type (code_heavy / formula_heavy / visual_heavy / theory_heavy / balanced)
  - Sub-topic decomposition for broad/interdisciplinary subjects
  - Recommended OER sources to build the curriculum around
- [x] Legacy heuristic fallback (`classifyTopicByKeywords`) preserved for pre-seeded topics and AI failure cases
- [ ] Wire `planCourseWithAI` into `generateLessonOutline` for custom topics (currently the planner exists but generateLessonOutline still uses the old heuristic)
- [ ] Store course plans in DB (new `course_plans` table) so plans can be versioned and reviewed
- **Success Criteria:** Generating "How to solve a Rubik's Cube" produces a 4-unit, 2-tier course; "Quantum Mechanics" produces a 22-unit, 4-tier course with sub-topics — both determined by AI, not hardcoded

### 8.2 — On-Demand Quiz Generation
Quizzes are no longer pre-generated with lesson content. They are generated when the learner requests them.

- [x] Remove quiz generation from `generateBatchLessonContent` prompt (batch content)
- [x] Remove quiz generation from `generateLessonContent` prompt (single unit)
- [x] Create `generateOnDemandQuiz()` function — generates quizzes tailored to the specific lesson content the learner just read
- [x] Add `POST /api/lessons/unit/:unitId/quiz` endpoint (authenticated, BYOK)
- [x] Quiz difficulty adapts to the unit's difficulty tier (beginner=recall, intermediate=application, advanced=synthesis, nextgen=open-ended)
- [ ] Update frontend to show "Generate Quiz" button instead of always displaying pre-baked quizzes
- [ ] Cache generated quizzes in DB (new `unit_quizzes` table) so re-taking doesn't cost tokens
- **Success Criteria:** Lesson content generation is ~30% cheaper (no quizzes); learner can click "Generate Quiz" and get questions tailored to what they just read

### 8.3 — Open Educational Resources (OER) Sourcing
Content generation prompts now explicitly prioritize free, openly licensed educational materials.

- [x] Add OER priority instructions to `generateBatchLessonContent` prompt (MIT OCW, Khan Academy, OpenStax, LibreTexts, Wikiversity, arXiv, freeCodeCamp, Project Gutenberg)
- [x] Add OER priority instructions to `generateLessonContent` prompt
- [x] Course planner recommends OER sources to build curriculum around
- [ ] Add OER link validation (verify links point to real, free resources — not paywalls)
- **Success Criteria:** Generated lessons reference specific free OER pages (not just "Khan Academy" but the actual course URL)

### 8.4 — Course Completion Posters
When a learner completes all units in a course, they get a fun, visually condensed summary poster.

- [x] Add `course_posters` table schema (shared/schema.ts)
- [x] Add migration `0003_course_posters.sql` + rollback
- [x] Add `POST /api/lessons/:topicId/poster` endpoint — generates poster with AI
- [x] Poster data structure: title, summary, keyTakeaways, tier sections, visualStyle, colorScheme, celebrationMessage, stats
- [ ] Build frontend poster display component (visual rendering of poster data)
- [ ] Auto-trigger poster generation when all units in a course are completed
- [ ] Save generated posters to DB for re-viewing and sharing
- [ ] Add poster sharing (export as image, share URL)
- **Success Criteria:** Completing all units in a course generates a shareable poster with condensed key takeaways

### 8.5 — Progress Timeline
Track the learner's journey over time for review and encouragement.

- [ ] Add `learning_timeline` table: userId, topicId, eventType (started/completed/mastered/quiz_passed/poster_earned), metadata, timestamp
- [ ] `GET /api/timeline` — returns chronological learning events for the user
- [ ] Timeline view in profile: "Your Learning Journey" — visualize courses started, milestones, streaks, cross-topic connections discovered
- [ ] Annual learning summary: "This year you learned X topics across Y domains, discovered Z cross-topic connections"
- **Success Criteria:** User can see a visual timeline of their entire learning history with milestones

### 8.6 — Decentralized Open Science Board
The open science feed evolves into a true decentralized community board where anyone can contribute hypotheses and the community + AI test them.

- [ ] Extend Open Science to support structured hypotheses (abstract, methodology, predicted outcomes, related topics)
- [ ] Community voting on hypothesis testability and significance
- [ ] AI-assisted hypothesis evaluation: feasibility scoring, related work search, methodology critique
- [ ] Open discussion threads on each hypothesis ( threaded comments with evidence links)
- [ ] "Test this" bounties: community members or agents can claim a hypothesis to test/research
- [ ] Federation: export hypotheses as structured data (JSON-LD) for other platforms to consume
- **Success Criteria:** Anyone can submit a hypothesis with structured methodology; the community can discuss, vote, and claim testing bounties

---

## Phase 9: Adaptive Learning UX

**Core concept:** Depth, tutor style, and goals are dials the learner can change anytime — while progress remains durable across topics.

See [PHASE9-ADAPTIVE-LEARNING.md](PHASE9-ADAPTIVE-LEARNING.md) for full plan.

### 9.1 — Intent-aware course plans
- [x] Extend `planCourseWithAI` with learningIntent (survey/standard/deep/speed_run/goal)
- [x] Wire planner into `generateLessonOutline` for non-seeded topics
- [x] Persist plans in `course_plans` (+ OER list surface)
- [x] Intent-aware re-plan without wiping progress (`POST /api/learn/topics/:id/replan` appends only)

### 9.2 — Resume continuum
- [x] `GET /api/learn/continue` + home Continue strip
- [x] `last_unit_id` / `last_section` schema fields
- [x] Auto-resume into unit from Continue cards
- [x] Timeline event recording (mode_changed, goal_set, resumed)

### 9.3 — Goal-oriented learning
- [x] `POST /api/learn/goal` + Goal Start card on home
- [x] `learning_goals` table + milestones snapshot
- [x] Milestone check-off UI + completion poster trigger

### 9.4 — In-lesson adaptive chrome
- [x] Depth / Tutor / Skim chips in RabbitHole
- [x] Socratic/Feynman open from chips with initial mode
- [x] Skim hides concept/analogy/example; keeps takeaways + resources
- [x] Speed-run quiz-first flow + Generate Quiz UI (on-demand)

### 9.5 — TTS de-clunk
- [x] Default Browser TTS for instant first play
- [x] Skip Kokoro path until model ready
- [x] Sticky mini-player across navigation

---

## Phase 10: TTS Reliability & Open Audio

**Core concept:** Every read-aloud path must work out of the box for every learner — no tokens, no dead fallbacks, no mystery 503s. Audio is a first-class accessibility feature of an open learning platform.

See `docs/tts-audit-2026-08-06.md` (or the Desktop report) for the full audit.

### 10.1 — TTS engine configuration & fallback hardening (DONE 2026-08-06)
- [x] Wire `process.env.HF_TOKEN` server fallback into `/api/tts/generate` (token priority: user profile token → platform env token → anonymous ZeroGPU)
- [x] Qwen3-TTS now works anonymously while the Space permits it; `428 HF_TOKEN_REQUIRED` only returned when generation actually fails with no token available
- [x] Remove dead `api-inference.huggingface.co` last-resort fallback (host is DNS-dead; was pure latency with zero success chance)
- [x] Live-verified Qwen3-TTS Space: all 3 endpoints (`generate_custom_voice`, `generate_voice_design`, `generate_voice_clone`) + upload + SSE stream + audio fetch (authenticated AND anonymous)
- [x] Verified speaker IDs / param shapes against `/gradio_api/info` — code matches the real API surface
- [x] Prod container recreated with `HF_TOKEN` in env (was missing despite being in host `.env`)
- [x] UI copy updated: HF token now "recommended" not "required"

### 10.2 — Audio-first polish (backlog)
- [ ] **Word-level playback highlighting** — sync spoken audio with sentence highlighting in lesson view (needs word timestamps from Qwen or VAD alignment)
- [ ] **Voice previews** — one-click sample sentence per Qwen speaker / Kokoro voice before committing
- [ ] **TTS cache lifecycle** — size cap + GC for `tts_audio_cache` (currently append-only per voice config)
- [ ] **Warm-cache seeding** — pre-generate audio for prebuilt courses on deploy so first listen is instant
- [ ] **Poster + goal-summary audio** — read completion posters / milestone summaries aloud
- [ ] **Podcast pathway** — playlist-style continuous audio across a course (stretch)

---

## Future Roadmap (Post-Phase 9 — Do NOT Execute)

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
- **Status:** Phase 1 (Sprint 2) + Phase 8 (in progress) + Phase 10.1 (TTS hardening — done)
- **Last Updated:** 2026-08-06 (Phase 10: TTS reliability & open audio — HF token fallback, anonymous ZeroGPU, dead fallback removal)
- **License:** Apache-2.0

This document is authoritative. Update it as phases complete.

---

## Key Decisions Log

### 2026-05-28: Sustainability Model Decision
**Problem:** Open-source learning platform could go viral and bankrupt the maintainer if generation costs aren't protected.

**Solution:** "Learn Free, Create With Your Own" — reading cached content is free forever, but generating/improving content requires the contributor's own API key (BYOK). A small community pool ($20-50/month) funds growth for users without keys, with strict daily caps.

**Why this works:**
- Platform cost is fixed ($5-20/month hosting) regardless of user count
- Every new reader costs $0 (they consume cached PostgreSQL data)
- Every new contributor pays their own API costs
- Existing 604 units are permanent — the platform works even if all API keys disappear
- Agents are first-class contributors who bring their own compute

**Risk mitigation:**
- Multi-tier trust system prevents spam/misinformation
- Automated quality checks on every submission
- Contributor policy (CC-BY-SA 4.0) clarifies licensing and responsibility
- Rate limits prevent abuse
- Community flagging catches bad content that slips through automated checks

### 2026-06-24: Dynamic Course Architecture Decision
**Problem:** Every topic was forced into a fixed 4-tier structure (beginner/intermediate/advanced/nextgen) with hardcoded unit counts. A micro-topic like "solving a Rubik's cube" got the same structure as "Quantum Mechanics" — just with fewer units. The material was being forced into a box that didn't fit.

**Solution:** AI-first dynamic course planning. Instead of hardcoded heuristics, an LLM analyzes each topic and determines:
- Optimal scope (micro / focused / standard / broad / interdisciplinary)
- Number of tiers and their names (not always "beginner/advanced")
- Units per tier based on actual depth needed
- Whether the topic warrants sub-topic decomposition
- Which OER sources to build the curriculum around

**Also decided:**
- Quizzes moved to on-demand generation (saves ~30% token cost per lesson)
- Content generation prompts now explicitly prioritize OER (MIT OCW, Khan Academy, OpenStax, etc.)
- Course completion posters added as a rewarding summary artifact

**Why this works:**
- Courses fit the subject instead of forcing the subject into a template
- Micro-topics don't waste tokens on 4 tiers they don't need
- Interdisciplinary topics get the depth they deserve with sub-topic decomposition
- On-demand quizzes are tailored to what the learner just read, not generic
- OER-first approach ensures the platform leverages existing free educational content

### 2026-08-06: TTS Configuration and Fallback Decision
**Problem:** The read-aloud feature had three silent failure modes: (1) the documented `HF_TOKEN` server fallback was never wired into `/api/tts/generate` — only per-user profile tokens worked; (2) the running prod container didn't actually have `HF_TOKEN` in its env (host `.env` had it, container didn't — frozen-env drift); (3) the last-resort fallback hit `api-inference.huggingface.co`, a DNS-dead host, so it could never succeed and only added latency.

**Live verification:** Qwen3-TTS HF Space (qwen-qwen3-tts.hf.space) — all three endpoints (`generate_custom_voice`, `generate_voice_design`, `generate_voice_clone`), file upload, SSE result stream, and audio fetch all work, both authenticated and **anonymously** (ZeroGPU currently allows tokenless calls).

**Solution:**
- Token priority for Qwen Cloud: user profile token (BYOK) → `process.env.HF_TOKEN` (platform) → anonymous ZeroGPU attempt
- `428 HF_TOKEN_REQUIRED` fires only when generation actually fails AND no token was available — users without tokens can now use Qwen Cloud for free while the Space permits it
- Removed the dead `api-inference.huggingface.co` fallback entirely
- Recreated the prod container with `HF_TOKEN` injected (same image/ports/binds/restart policy, env preserved + HF_TOKEN added)

**Why this works:** TTS stays free for the platform (ZeroGPU), works out of the box for every learner, and the platform operator retains an escape hatch (env token) if the Space ever flips to auth-required.
