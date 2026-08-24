# Session Prompt — Usability Roadmap Buildout (A → C first)

You are working on **SynapseJourney**, an open-source, agent-native learning platform.

## Repo & environment
- Repo: `/home/jonathan/dev/synapse` (already cloned). Branch `main`.
- Live: https://synapsejourney.org · Deploy: `ssh root@167.99.125.127`, app at `/var/www/SynapseJourney`,
  served by PM2 process `synapsejourney` (NOT Docker).
- Load the `synapse-platform` skill FIRST (Express+Drizzle+pgvector patterns, "Synapse Sprint Pattern",
  pitfalls: relative imports `../`, snake_case vs camelCase, `sjuser` GRANTs, BYOC-only generation).
- Also load `writing-plans` and use `subagent-driven-development` if you delegate subtasks.

## Read these before writing code
1. `SYNAPSE-MASTER-REVAMP.md` — **"Prioritized Usability Roadmap (impact ÷ effort)"** section is the
   authoritative plan. Implement items in order A → B → C, then (only if time) D.
2. `client/src/components/` — `nebula-feed.tsx`, `onboarding.tsx`, `my-courses-strip.tsx`,
   `knowledge-card.tsx`, `knowledge-graph-3d.tsx`, `navigation.tsx`, `user-profile-menu.tsx`.
3. `client/src/pages/home.tsx` — where the feed + header assemble.
4. `server/routes/contributions.ts` — `/api/search` is already hybrid (pgvector + pg_trgm) and works;
   the roadmap item C is about **surfacing** it, not rebuilding it.

## Recent context (already done — do NOT redo)
- Hybrid semantic search + forum search shipped (pgvector 768-dim + Ollama local embeddings).
- 3D map is now relationally indexed via fixed semantic axes (Applied↔Theoretical, Natural↔Synthetic,
  Micro↔Macro) with a tooltip legend. Don't touch the axis math.
- Landing page already has: collapsible "My courses & goals" header, pinned Save/Dive action bar,
  fixed profile-menu/"View all" overlap.

## The task — make Synapse easy to learn for anyone, on any device
Goal: frictionless first-run, works on phone/car-browser/PC, and content is discoverable by meaning.

### A. First-60-seconds onboarding (do first)
New user with no progress → a single guided funnel: (1) pick a topic (from map or search),
(2) take one lesson, (3) earn first badge. Tighten the existing `Onboarding` component + auto-enroll
logic in `nebula-feed.tsx` into ONE smooth flow. Success: a fresh user can complete all three steps
in under ~60s with no dead-ends. Make every step skippable (don't trap users).

### B. Mobile / narrow-screen polish
- Feed card action bar (Save / Dive Deep) must be thumb-friendly and never clipped on small viewports.
- `knowledge-graph-3d.tsx` must degrade gracefully to a touch-friendly 2D/zoomable list or simplified
  view on small screens (react-force-graph-3d is desktop-centric and may be broken/unusable on touch).
- Verify the collapsible header + bottom nav behave on ~360px width.

### C. Search discoverability
- Add a real, visible search box to the home feed (not buried). On submit, call the existing
  `/api/search?q=...`.
- Results should show **relationships**, not a flat list: surface the topic's axis position and/or
  nearest neighbors (the knowledge graph already returns `x/y/z` coords — use them to say "similar to
  X, Y" or group results by the three axes).

### D. (Only if A–C complete and time permits) Generative map features
- Select 1+ points on the map → ask a question with those topics included as context (reuse `AiChat`).
- Select a point → "generate a new topic like this, but with [context twist]".
- Select a void → gap-detection: check nearest neighbors in coordinate space, propose whether a known
  topic/industry fits that gap, ask for confirmation + extra context to generate it.
  (These are the "eventually" features — only start after A/B/C are solid.)

## Success criteria
- [ ] `tsc --noEmit` clean; `npm run build` passes.
- [ ] Manual check of A, B, C on a fresh (unauthenticated or new-user) state.
- [ ] No regression to search, map, or BYOC flows.
- [ ] Update `SYNAPSE-MASTER-REVAMP.md` — mark completed roadmap items and note what remains.

## Do NOT
- Do not change the axis math or embedding pipeline.
- Do not re-enable a free platform compute pool.
- Deploy only AFTER the user reviews. Build + typecheck locally, open a PR, STOP. No `pm2 restart`
  without explicit go-ahead.

Deliver: a PR on a `feature/usability-roadmap` branch, with a short summary of A/B/C done, what D is
scoped to, and any screenshots or manual-test notes.
