---
title: Grokipedia links in Go Deeper
---
# Grokipedia Links in Go Deeper

## What & Why
The "Go Deeper" section on every lesson currently shows AI-generated external resources (videos, courses, papers, etc.). Grokipedia (grokipedia.com) is a comprehensive encyclopedia with high-quality pages covering virtually every topic taught in the platform — making it a natural and always-relevant addition to every lesson's resource list. Adding a Grokipedia link to each lesson's Go Deeper section ensures learners always have a rich, encyclopedic starting point regardless of the unit.

## Done looks like
- Every lesson's Go Deeper section includes at least one Grokipedia link alongside the existing AI-generated resources.
- The Grokipedia link uses the topic title to construct the URL (e.g., `https://grokipedia.com/page/Electromagnetism` for the Electromagnetism topic, or the unit title if a more specific page is relevant).
- Grokipedia entries show a distinct "encyclopedia" resource type with an appropriate icon and color (distinct from video/course/paper/book/forum/tool).
- The link is appended programmatically after AI content generation — it does not rely on the AI including it in the response, making it guaranteed and consistent.
- The Grokipedia link also appears in Next Gen units.
- Existing cached lesson content is served with the Grokipedia link injected at response time (so already-generated lessons get it immediately without requiring content regeneration).

## Out of scope
- Verifying which specific Grokipedia sub-pages exist at build time (use topic title with spaces replaced by underscores as the URL slug, following Wikipedia conventions).
- Replacing existing AI-generated resources with Grokipedia links.
- Allowing users to disable or remove the Grokipedia link.

## Tasks
1. **Add "encyclopedia" resource type icon to frontend** — Add a new icon/color mapping for resource type `"encyclopedia"` in the Go Deeper section of rabbit-hole.tsx, using a distinct visual style (e.g., globe or book icon in a teal/cyan color).

2. **Inject Grokipedia link at content-serve time** — In the lesson content fetch route (`/api/lessons/:unitId/content`), after retrieving or generating content, append a Grokipedia resource object to `externalResources` based on the topic title. Construct the URL as `https://grokipedia.com/page/{topic_title_underscored}`. This ensures all lessons — both newly generated and already cached — consistently include the link without requiring a full regeneration.

3. **Include Grokipedia guidance in AI prompts** — Update the lesson content generation prompts (`generateLessonContent`, `generateBatchLessonContent`, `generateNextGenContent`) to mention Grokipedia as an additional resource source the AI can reference, so AI-generated content can optionally include more specific Grokipedia sub-pages (e.g., for a unit titled "Quantum Entanglement" within a Quantum Mechanics course, the AI might link `https://grokipedia.com/page/Quantum_entanglement` as well as the topic-level page).

## Relevant files
- `client/src/components/rabbit-hole.tsx:1327-1395`
- `server/routes.ts:690-840`
- `server/routes.ts:3563-3625`
- `server/routes.ts:3640-3800`