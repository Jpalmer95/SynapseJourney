# The Hermes ↔ Synapse Learning Loop

How a learner works with a personal agent while the platform stays the source of truth.

## The shape of it

```
  ┌──────────────┐   1. search_knowledge / get_course    ┌────────────────────┐
  │  Hermes /    │ ───────────────────────────────────▶  │  Synapse cloud     │
  │  Claude /    │                                        │  • topics & units  │
  │  Cursor      │ ◀─── 2. unit outline + OER anchors ── │  • pgvector index  │
  │  (your       │                                        │  • SOTA bottlenecks│
  │   compute)   │ ── 3. teaches unit-by-unit ──┐         │  • OER commons     │
  └──────────────┘    4. ingest_course / ingest  │         └─────────┬──────────┘
          ▲                                      ▼                   │
          │                            ┌──────────────────┐          │
          └───── progress, next unit ──│  your browser    │◀─────────┘
                                       │  course view     │   5. 3D map, timeline,
                                       │  3D knowledge map│      mastery, posters
                                       └──────────────────┘
```

Two entry points, one dataset:

- **Agent-first:** the agent talks, quizzes, and teaches; Synapse stores what was learned.
- **Site-first:** the learner reads the same units in the browser, resumes exactly where they
  left off, and watches the map fill in.
- Both operate on the same `topics` / `lesson_units` / `user_progress` rows, so switching
  between them loses nothing.

## Setup (once)

1. synapsejourney.org → Settings → **Create Hermes token** → `sj_…`.
2. `echo 'SYNAPSE_PAT=sj_...' >> ~/.hermes/.env`
3. The agent connects over MCP at `https://synapsejourney.org/api/mcp` (JSON-RPC 2.0,
   `Authorization: Bearer $SYNAPSE_PAT`).

Verify: `synapse.get_3d_map` returns your nodes; `synapse.search_knowledge` returns hits.

## The loop, step by step

**1. Pick or create the course.** Either the learner creates it on the site (Command Center →
JIT goal / depth-breadth / fusion), or the agent authors it with Hermes compute and uploads:

```bash
curl -sS -X POST https://synapsejourney.org/api/learn/ingest \
  -H "Authorization: Bearer $SYNAPSE_PAT" -H "Content-Type: application/json" \
  -d @course.json     # 201 → topic id, unitsCreated, goal
```

`course.json` carries `archetype` (`rapid_bootstrap` | `foundation` | …), which fixes unit
count and section length (see `docs/COURSE-ARCHETYPES.md`).

**2. The agent pulls the plan, not a blank page.** `synapse.get_course` returns outline, units,
course plan, OER anchors, and attached SOTA bottlenecks. The agent now teaches *this* course
instead of inventing a parallel one.

**3. Teaching happens in the agent.** Hermes walks unit by unit: explain → quiz → Feynman
(the learner explains it back) → mark complete. The learner's own compute pays for this;
the platform never runs a funded LLM for it.

**4. Progress is written back.** Completing a unit updates `lesson_progress`, recalculates
`user_progress.mastery` (0–100), appends a `learning_timeline` event, and — on course
completion — issues a course poster.

**5. The map grows.** Every new topic is embedded (768-d) and projected into the 3D PCA space
(`Applied ↔ Theoretical`, `Natural ↔ Synthetic`, `Micro ↔ Macro`), with nearest-neighbour
connections. `/map` shows **My Web** (only what you touched), **Global Atlas**, and a
time-horizon slider, so "what did I actually learn this month" is a visual answer.

**6. Depth is added, not regenerated.** `POST /api/learn/ingest` with `topicId` **appends**
units to an existing course: "go deeper on unit 4" becomes two new units with full
`contentJson`, titles deduped, progress untouched. Same rail for the agent and for the
"deepen" button in the UI.

## Why the corpus compounds

- **Shared, not siloed.** A course is a row in the global corpus. Another learner searching
  "orbital mechanics" hits the same units and OER anchors; nothing needs regenerating.
- **Free to read.** Browsing, the 3D map, vector search, cached content, and TTS are free.
  Only *new* generation costs anything, and it is paid by whoever's keys are used (BYOC).
- **OER is extracted, not lost.** Every unit's `externalResources` are harvested into
  `knowledge_resources` and surfaced in the Open Science → OER Commons tab, searchable by
  anyone.
- **Frontier problems are first-class.** `sota_bottlenecks` collects real open problems per
  domain; a learner (or agent) can turn any lesson into a structured hypothesis
  (`hypothesis`, `methodology`, `falsifiability`, cross-domain topic links) in the Open
  Science commons, with optional BYOC peer review.
- **Cross-domain is a feature, not a hack.** Fusion courses require every unit to pull from
  two domains and end in one buildable capstone — the mechanism for applying field A to a
  bottleneck in field B.

## Curation per day, per learner

The archetype is chosen from the learner's time horizon, not the topic's size:

| Time available | Archetype | What they get |
|---|---|---|
| < 1 hour, deadline today | `rapid_bootstrap` | 3–5 actionable units, verify-at-the-end |
| A week | `focused_skill` | 6–10 units, concept → drill |
| A weekend deep dive | `deep_dive` | 12–18 units on one niche |
| A semester | `foundation` | 18–28 units, textbook-anchored, problem sets |
| "What's broken in X" | `frontier_survey` | 6–10 units of SOTA + bottlenecks |
| Two fields, one build | `cross_domain` | 8–14 units + capstone |

Agents can pass `archetype` to `/api/learn/goal`, `/api/learn/custom-course`, and
`/api/learn/ingest`; the site infers it from intent when it is omitted.

## Practical example

> "I want to understand orbital mechanics well enough to reason about constellation design."

1. Site: `foundation` course "Orbital Mechanics" → 22 units, 5 tiers, OpenStax + MIT 16.07 +
   Vallado chapters attached.
2. Hermes: `get_course` → teaches tier 1–2 over a week, quizzing each unit.
3. Site: `/map` shows the cluster forming next to "Physics" and "Control Theory".
4. Agent: `ingest_course` with `topicId` appends "J2 perturbation for Walker constellations"
   as a deep-dive pair of units.
5. Open Science: the agent files a hypothesis about constellation phasing against a live
   bottleneck in orbital debris tracking.

Nothing was regenerated; every step added to the same course, the same map, and the same
public corpus.
