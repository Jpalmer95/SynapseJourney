# Voice Settings & Fast-Play Listen

  ## What & Why
  Two connected improvements to the TTS listen experience:
  1. **Voice & Audio settings section** — users currently can only change their voice preset through a small gear icon inside each lesson's listen button. A dedicated settings section makes it discoverable and lets users set their default before ever opening a lesson.
  2. **Paragraph-first fast play** — the first time a user clicks Listen on a lesson, the server must generate the full audio (~20–40 seconds). This feels slow. Instead, generate the intro text (first 1–2 paragraphs) immediately for a fast start, then generate and queue the remaining audio in the background while the user is already listening.

  ## Done looks like
  - Settings page has a "Voice & Audio" section with the 6 AI voice preset cards, a custom voice upload dropzone, and a playback speed slider — selecting any of these saves as the user's default immediately
  - Clicking Listen on a lesson plays intro audio within 2–5 seconds (vs 20–40 seconds currently) on first load
  - After the intro plays, the remaining lesson audio transitions seamlessly without interruption or gap
  - Subsequent listens (audio already cached) are unaffected — still play the full cached audio immediately
  - The cached audio status badge on the listen button reflects pre-generation state correctly

  ## Out of scope
  - Text-description / prompt-based voice generation (voice clone by audio upload already exists)
  - Streaming word-by-word or sentence-by-sentence TTS (paragraph-level chunks only)
  - Any changes to how predictive pre-generation works across lessons

  ## Tasks
  1. **Voice & Audio settings section** — Add a "Voice & Audio" collapsible section to the Settings page. Render the 6 AI preset cards (same visual style as the inline panel), the custom voice file upload area, and a playback speed slider. All interactions use the existing `/api/tts/settings` (GET/PUT) and `/api/tts/voice-upload` (POST) endpoints.

  2. **Intro-first TTS generation endpoint** — Add a `firstParagraphOnly: true` option to the `POST /api/tts/generate` route. When set, extract only the first 1–2 paragraphs from the unit's content, generate TTS for just that text, and return immediately without caching. Simultaneously fire a non-blocking background job to generate and cache the full unit audio as normal.

  3. **Client-side sequential play** — Update the `useTTS` hook's `speak(text, unitId)` function. On first listen (cache miss): (a) request intro audio with `firstParagraphOnly: true`, play immediately; (b) simultaneously request full audio in background; (c) when intro ends, play the remainder (full audio minus the intro text, requested as arbitrary `text`). On cache hit: play full cached audio immediately as today.

  ## Relevant files
  - `client/src/pages/settings.tsx`
  - `client/src/components/tts-button.tsx:22-386`
  - `client/src/hooks/use-tts.ts`
  - `server/routes.ts:825-1070`
  - `server/tts-service.ts`
  