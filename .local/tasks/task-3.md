---
title: Link validation & topic-specific relevance
---
# Link Validation & Relevance Enhancement

## What & Why
External resource links in lesson content are AI-generated and may be expired, unavailable, or not specific enough to the user's exact topic/industry. This task adds server-side link validation (checking that URLs actually resolve) and strengthens the AI prompts so links are always tightly matched to the specific topic, domain, and difficulty level — not just generic subject-area defaults.

## Done looks like
- When lesson content is generated, each `externalResources` URL is validated by the server (HEAD/GET request with timeout). Any URL that returns a 4xx/5xx response, connection error, or redirect to a generic "not found" page is removed from the final stored result or replaced by triggering a re-ask to the AI for an alternative.
- AI prompts for link generation are updated to include the full topic name and any available industry/domain context so that links are hyper-specific (e.g., for a "Cardiology — Heart Failure" topic, links point to AHA guidelines or relevant cardiology journals, not generic medicine).
- A background validation job re-checks all previously stored external resource URLs on a periodic schedule (or on first access after a configurable staleness window) and flags/removes broken ones so users never encounter a dead link.
- In the frontend, if a link was flagged as broken, it is hidden from the resource list rather than shown with a dead URL.
- The improvement is invisible to users in the happy path — links just work — but the resource list may be shorter and more curated than before.

## Out of scope
- Scraping or archiving link content (Wayback Machine integration).
- User-submitted link reports or feedback UI (future work).
- Validating links inside quiz questions or chat responses.

## Tasks
1. **Server-side link validation utility** — Create a utility function that takes a list of URLs and validates each one with an HTTP HEAD request (with a short timeout and user-agent header to avoid bot blocks), returning a filtered list of live URLs only. Handle redirects gracefully (follow up to 2 hops).

2. **Integrate validation into lesson content generation** — After the AI returns `externalResources`, run each URL through the validation utility before saving to the database. If fewer than 2 links survive, re-prompt the AI asking specifically for replacement URLs for the ones that failed, then validate again before persisting.

3. **Strengthen AI prompts for topic/industry specificity** — Update the lesson content generation prompts to include the full topic name, parent category, and (if available) any custom domain/industry tag. Provide examples in the prompt of what hyper-specific links look like vs. generic ones. Add an explicit instruction that links must be from domains relevant to the topic's professional field, not just the subject area broadly.

4. **Background staleness re-validation** — Add a lightweight scheduled job (or trigger it lazily on lesson content fetch if the record is older than 30 days) that re-validates stored URLs and sets a `brokenLinks` flag or removes the bad entries from the stored JSON.

5. **Frontend filtering of broken links** — Update the external resources renderer in `rabbit-hole.tsx` to skip links marked as broken (or simply rely on the server already having cleaned them from stored content).

## Relevant files
- `server/routes.ts`
- `server/ai-providers.ts`
- `shared/schema.ts`
- `client/src/components/rabbit-hole.tsx`