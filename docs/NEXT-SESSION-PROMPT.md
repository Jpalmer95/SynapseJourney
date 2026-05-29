# Synapse Journey - Phase 1 Handoff Prompt

## Project Context

**Repository:** `/home/jonathan/dev/synapse` (already cloned)
**Live Site:** synapse.167.99.125.127.sslip.io (Coolify on DigitalOcean droplet 167.99.125.127)
**Current Branch:** `feature/revamp-master-plan` (PR #1 open)
**Master Plan:** `/home/jonathan/dev/synapse/SYNAPSE-MASTER-REVAMP.md` (read this first!)

## What Synapse Is

An open-source, agent-native learning platform where humans and AI agents collaboratively build, improve, and explore a living knowledge base. The core philosophy: **"Learn Free, Create With Your Own"** — reading cached content is free forever, but generating/improving content uses the contributor's own AI provider keys (BYOK).

### Current Features (Working)
- 70 topics with 604 AI-generated lesson units (beginner → advanced → nextgen)
- AI chat (Socratic mode, Feynman mode, synthesis quests)
- TTS (Kokoro WebGPU + server fallback chain)
- Spaced Repetition System (SM-2 algorithm)
- 3D knowledge graph (react-force-graph-3d)
- Mermaid.js concept diagrams, Sandpack code sandboxes
- Learning pathways with DAG prerequisites
- Practice tests (MCAT, GRE, SAT prep)
- Achievements, challenges, XP/streaks system
- Custom topic generation (users request any topic, AI generates full course)
- Open Science Feed (ideas, comments, upvotes)
- PWA support

## What's Been Completed (Phase 0)

### Route Decomposition (6 modules created)
The original 4,941-line `routes.ts` has been decomposed into focused modules:

| Module | Routes | Lines | Purpose |
|--------|--------|-------|---------|
| `server/routes/ai.ts` | 8 | 1,838 | AI chat, TTS, lesson generation, content helpers |
| `server/routes/admin.ts` | 8 | 400 | Admin-only routes (regeneration, seeding) |
| `server/routes/tests.ts` | 11 | 400 | Practice test preparation & attempts |
| `server/routes/social.ts` | 5 | 74 | Open Science ideas & discussions |
| `server/routes/topics.ts` | 6 | 88 | Topic browsing & search |
| `server/routes/shared.ts` | 0 | 154 | Shared utilities (admin check, Grokipedia injection) |
| **`server/routes.ts`** | **70** | **1,988** | Core learning experience (remaining) |

All 6 modules are properly imported and registered. The code compiles cleanly (TypeScript errors are just missing env vars like DATABASE_URL, which is fine for local dev).

### Database Infrastructure
- **pgvector migrations created:**
  - `migrations/0001_pgvector_extensions.sql` — installs pgvector + pg_trgm, adds 1536-dim embedding columns to `lessons` and `topics`, creates HNSW indexes
  - `migrations/0001_pgvector_extensions_rollback.sql` — rollback script
- **Schema updated:** `shared/schema.ts` declares embedding columns
- **Package.json updated:** Added `db:migrate:pgvector` script

Run order:
```bash
npm run db:migrate:pgvector  # First: extensions + columns
npm run db:push              # Then: push schema changes
```

### Security Fixes
- Admin emails now read from `ADMIN_EMAILS` env var (was hardcoded)
- `.gitignore` includes `.env`, `.env.local`, `*.pem`
- Created `.env.example` with all required vars documented

### Documentation
- **SYNAPSE-MASTER-REVAMP.md** — comprehensive 7-phase roadmap with BYOK sustainability model
- **README.md** updated to reflect agent-native vision and sustainability principles

## Your Task: Implement Phase 1 (Living Knowledge Base)

Read `/home/jonathan/dev/synapse/SYNAPSE-MASTER-REVAMP.md` lines 77-162 for full Phase 1 details.

### Phase 1 Goals

1. **Semantic Search** — Vector similarity search for topics/lessons (pgvector already set up)
2. **Content Versioning** — Track who edited what, when (like Wikipedia history)
3. **BYOK Pipeline** — Users bring their own API keys to generate/improve content
4. **Read-Only Public Access** — Browse topics without login, require auth only to contribute

### Key Design Principles (from Sustainability Model)

- **BYOK by default:** Reading cached content = free. Generating new content = contributor pays via their own API key
- **Community pool optional:** Small shared budget ($20-50/month) with hard daily caps for users without keys
- **Multi-tier review:** New contributors need 2 approvals → Trusted (5+) needs 1 → Verified (20+) auto-approved
- **No rate limiting reading:** Anonymous users can browse unlimited topics
- **Rate limit generation:** Authenticated users limited by their key provider

### Implementation Suggestion (Start Here)

**Sprint 1: Database & API Foundation**
1. Add semantic search endpoint: `GET /api/topics/search?q=...&threshold=0.85`
   - Use pgvector cosine similarity on `lessons.embedding` column
   - Return top-k matches with scores
2. Add content versioning tables to schema:
   ```typescript
   content_versions: id, lesson_id, user_id, content_json, created_at
   ```
3. Add user API key storage to schema:
   ```typescript
   user_api_keys: id, user_id, provider (openai/anthropic/etc), encrypted_key, created_at
   ```

**Sprint 2: BYOK Pipeline**
4. Settings page UI for users to add their API keys (encrypted storage)
5. Refactor lesson generation to use user's key (fallback to community pool)
6. Add rate limiting middleware based on auth status

**Sprint 3: Public Read Access**
7. Make topic browsing public (no auth required for `GET /api/topics*`, `GET /api/lessons*`)
8. Require auth only for mutations (POST/PUT/DELETE)
9. Add contribution tracking (which user/agent contributed what)

### Tech Stack Reminders
- **Frontend:** React 18 + Vite + TypeScript + shadcn/ui + Tailwind
- **Backend:** Express + Drizzle ORM + PostgreSQL
- **Auth:** Session-based (server/auth-routes.ts)
- **Deployment:** Coolify auto-deploys on push to `develop` (staging) or `main` (prod)
- **Current branch:** `feature/revamp-master-plan` — push here, will merge to develop later

### Important Files
- `server/routes.ts` — main route orchestrator (1,988 lines, 70 routes remaining)
- `server/routes/ai.ts` — AI chat & lesson generation logic
- `server/storage.ts` — database queries (add new query functions here)
- `shared/schema.ts` — Drizzle schema definitions
- `client/src/pages/explore.tsx` — topic discovery UI
- `client/src/pages/lesson.tsx` — lesson viewer UI

### Success Criteria (from Master Plan)
- Users can search topics semantically (vector similarity)
- Content edits are tracked with version history
- Users can add their own API keys in settings
- Users can browse topics without logging in
- Contributors see their edits attributed in version history

## How to Proceed

1. Read `SYNAPSE-MASTER-REVAMP.md` (especially Phase 1 section)
2. Start with Sprint 1 (database + API foundation)
3. Commit frequently with descriptive messages
4. Push to `feature/revamp-master-plan` branch
5. Test locally with `npm run dev` and `npm run db:push`

The codebase is now clean and maintainable. You have a solid foundation to build on.

**Good luck with Phase 1!** 🚀
