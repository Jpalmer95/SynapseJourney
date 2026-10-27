# Course Archetypes — Depth, Section Length, and Curation Rules

Every course in Synapse declares one archetype. The archetype is the contract between
*what the learner asked for*, *how the planner shapes the syllabus*, and *how long each
lesson section actually is*. Without it, every course drifts toward the same mushy middle:
a 4-unit "deep dive" that is too thin to be useful and too long to be fast.

Canonical source: `shared/course-archetypes.ts` (imported by the planner, the lesson
generator, and any agent authoring content). Change the shape there, not in prompts.

## The six archetypes

| Archetype | Use when | Units | Tiers | Words / section | Sections / unit | Resources / unit | Minutes / unit | Capstone |
|---|---|---|---|---|---|---|---|---|
| `rapid_bootstrap` | Unblock a project today | 3–5 | 1–2 | 140–240 | 1–2 | 2–3 | 7–12 | no |
| `focused_skill` | One capability, usable this week | 6–10 | 2–3 | 200–320 | 2 | 3–4 | 15–25 | no |
| `foundation` | Real underlayment (physics, EE, orbital mechanics, chemistry) | 18–28 | 4–5 | 420–650 | 2–3 | 4–6 | 35–50 | yes |
| `deep_dive` | A niche, done properly | 12–18 | 3–4 | 350–520 | 2–3 | 4–5 | 30–40 | yes |
| `frontier_survey` | Where a field is stuck right now | 6–10 | 2–3 | 260–380 | 2 | 4–6 | 20–30 | no |
| `cross_domain` | Two fields fused into one build | 8–14 | 3–4 | 320–480 | 2–3 | 3–5 | 30–40 | yes |

Takeaways per unit: 3 (bootstrap), 4 (focused, frontier), 5 (foundation, deep, cross-domain).

## What each one optimizes for

**rapid_bootstrap** — dependency chain, not a syllabus. Unit titles read like actions
("Wire the auth callback"), each unit must be executable right after the previous one, and
the last unit is a verification checklist. Zero background sections; define a concept inline
in one sentence if it is needed. OER policy: official docs + one canonical reference.

**focused_skill** — alternate concept and drill. Every conceptual unit is followed by a unit
where the learner produces something. One unit is explicitly about failure modes/debugging.

**foundation** — true prerequisite order; no unit may assume a concept not yet taught.
Foundations tier is 5+ units and establishes notation and units of measure before any
application. Every unit anchors to a named source: OpenStax or LibreTexts chapter, MIT OCW
lecture notes, a Feynman Lectures volume, a standard textbook (title/author/chapter), and one
full lecture video. Derivations carry units through, followed by one fully worked numerical
example. This is the archetype for "I want to actually know orbital mechanics."

**deep_dive** — assumes working knowledge of the parent field; no re-teaching of basics.
Budget goes to mechanism, current practice, limits. Cites specific papers with year and venue
and separates consensus from contested claims.

**frontier_survey** — every unit names at least one concrete unsolved bottleneck and who is
working on it. Ends with a unit on turning an observation into a falsifiable hypothesis, which
plugs directly into the Open Science commons.

**cross_domain** — every unit pulls from at least two domains; the final unit is a buildable
capstone with milestones, not a summary. This is the archetype for "apply my background in
A to a bottleneck in B."

## How curation works at request time

1. **The learner picks intent, not structure.** "Fix this today" → `rapid_bootstrap`.
   "Teach me physics" → `foundation`. "What's blocking fusion right now" → `frontier_survey`.
   If no archetype is supplied, `inferArchetype()` maps intent → shape
   (`speed_run`/`goal` → rapid_bootstrap, `deep` → foundation or deep_dive, `survey` → frontier_survey).
2. **The archetype drives the planner prompt** (`archetypePlannerBlock`): unit range, tier
   names, sequencing rules, OER policy.
3. **The archetype is persisted** in `course_plans.planJson.archetype` with the plan, so it
   survives replans and is visible to agents over MCP.
4. **The lesson generator reads it back** and injects `archetypeSectionBlock` into the content
   prompt, which explicitly overrides the generic "2–3 paragraphs" instruction. This is what
   keeps a bootstrap unit at ~200 words and a foundation unit at ~500 words per section.
5. **Agents authoring content** (`POST /api/learn/ingest`) should pass the same archetype in the
   payload so uploaded units match the shape of the course they are joining.

## Depth vs. time: the curation rule

The learner's usable time that day decides the archetype, not the size of the topic:

- **20 minutes before a meeting** → `rapid_bootstrap` or `frontier_survey`. Never a foundation.
- **A weekend to become dangerous** → `focused_skill`.
- **A semester** → `foundation`, with sub-topics decomposing into `deep_dive` courses later.
- **A career pivot** → `foundation` → `deep_dive` → `cross_domain`, each as separate courses
  linked in the 3D map.

A foundation course is expected to be split: each tier can spawn sub-topic courses that inherit
its OER anchors, so nobody has to regenerate "electromagnetism" from scratch to study antennas.

## Adding a new archetype

Add an entry to `ARCHETYPES` in `shared/course-archetypes.ts` with all fields filled. Then add
its id to `CourseArchetype`, `ARCHETYPE_IDS`, and the zod enums in
`server/routes/learn.ts` (`goalSchema`, `customCourseSchema`). No prompt edits are needed —
the planner and lesson prompts are generated from the spec.
