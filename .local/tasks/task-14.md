---
title: xAI Grok integration for course generation
---
# xAI Grok Integration for Course Generation

## What & Why
Replace Gemini as the primary course content generation engine with xAI's Grok API
(model: `grok-4.20-reasoning`). Grok is more cost-effective, uses a more recent
knowledge cutoff, and produces high-quality structured text. The existing Gemini
provider stays in place as an automatic fallback if xAI is unreachable.

The infographic generator (`server/infographic-generator.ts`) is explicitly OUT OF
SCOPE — it uses Gemini's image generation capability (returning raw PNG bytes), which
has no equivalent in Grok's text API. It stays on Gemini unchanged.

## Done looks like
- Custom course generation (new and retry) succeeds using Grok 4.20-reasoning
- Server startup log shows: `[AI] Course content model: grok-4.20-reasoning via xAI (fallback: gemini-2.0-flash)`
- If xAI returns a 4xx/5xx or is unreachable, the system automatically retries with
  the existing Gemini fallback and logs a warning — no silent failures, no user-facing errors
- `XAI_COURSE_MODEL` env var (default: `grok-4.20-reasoning`) allows upgrading the
  Grok model without a code change
- Infographic generation is unaffected and still works via Gemini

## Out of scope
- Infographic image generation (`server/infographic-generator.ts`) — stays on Gemini
- User chat AI provider system — unchanged
- Any UI changes

## Tasks

1. **Add GrokProvider class** — In `server/ai-providers.ts`, add a `GrokProvider`
   class that uses the already-installed OpenAI SDK pointed at `https://api.x.ai/v1`
   with `process.env.XAI_API_KEY`. Use `XAI_COURSE_MODEL` env var (default:
   `grok-4.20-reasoning`) as the model. The class implements the same `AIProvider`
   interface as the existing providers.

2. **Wire Grok as primary course content engine** — Update `generateCourseContent()`
   and `getCourseContentProvider()` to use `GrokProvider` when `XAI_API_KEY` is set,
   falling back to `defaultGeminiProvider` otherwise. Wrap the Grok call in try/catch:
   on any error (network, 4xx, 5xx), log a warning and retry with Gemini. Update the
   startup log line to reflect the active primary engine and fallback.

3. **Update comments and env var docs** — Replace all references to "Gemini" in the
   course-content architecture comments with the accurate description (Grok primary,
   Gemini fallback). Add a comment above `GEMINI_FALLBACK_MODEL` explaining it now
   serves as the fallback for when xAI is unavailable.

## Relevant files
- `server/ai-providers.ts:28-46`
- `server/ai-providers.ts:64-125`
- `server/ai-providers.ts:309-355`
- `server/infographic-generator.ts` (read-only reference — do NOT modify)