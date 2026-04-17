# Robust AI Model Management

## What & Why
Custom course generation is broken because the Gemini model ID (`gemini-3-pro-preview`) doesn't exist on the platform. But a one-line swap isn't sufficient — the same silent breakage will happen again when a model is deprecated or renamed. The goal is a system where: the model can be updated without a code change, and if the primary model fails with a "not found" error, the system automatically falls back gracefully instead of hard-failing all course generation.

## Done looks like
- Creating a new custom course works again; existing failed courses can be retried successfully
- The active model is logged at server startup so it's always visible in deployment logs
- A `GEMINI_COURSE_MODEL` environment variable (optional) overrides the default model, allowing the model to be changed without a code deployment
- If the configured model returns a 404/not-found error, the provider automatically retries with a known-good fallback model (`gemini-2.0-flash`) and logs a clear warning — no silent failures
- Comments in the code are updated to reflect the real model in use and explain how to change it

## Out of scope
- Changing the user chat AI provider system
- UI changes or admin panels
- Changing the infographic generator (it uses a separate direct API call)

## Tasks
1. **Fix the immediate model ID** — Replace `gemini-3-pro-preview` with `gemini-2.0-flash` in `DEFAULT_MODELS`. Read the `GEMINI_COURSE_MODEL` environment variable at startup and use it if set, falling back to `gemini-2.0-flash`. Log the active model name on server startup.

2. **Add 404 fallback in GeminiProvider** — Wrap the `generateContent` call in a try/catch. If the error is a 404 "not found" for the model, automatically retry with the hardcoded fallback `gemini-2.0-flash` and emit a console warning that includes the bad model name. Re-throw any other errors normally.

3. **Update comments** — Replace all references to "Gemini 3 Pro" in comments with the actual model in use and add a note explaining the env var override and fallback chain.

## Relevant files
- `server/ai-providers.ts:25-31`
- `server/ai-providers.ts:51-76`
- `server/ai-providers.ts:271-304`
