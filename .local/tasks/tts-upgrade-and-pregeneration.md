# TTS Upgrade & Predictive Pre-Generation

## What & Why
The current "Listen" feature uses the browser's Web Speech API, which is not supported in Tesla's embedded browser and lacks voice quality/customization. This task upgrades TTS to use Qwen3-TTS (via the Hugging Face Spaces ZeroGPU API), adds voice customization (presets + custom voice upload via reference audio), falls back gracefully to browser TTS when the AI service is unavailable, and introduces predictive pre-generation so the next lesson and its audio are ready before the user clicks "Start".

## Done looks like
- A new TTS settings panel lets users choose from preset voices (e.g. "Aria", "Echo", "Nova") or upload a short reference audio clip to clone their own voice.
- The "Listen" button works in Tesla's browser (and any environment that doesn't support `window.speechSynthesis`) by routing through the server-side Qwen3-TTS pipeline.
- When a user starts a lesson within a topic, the server silently pre-generates the content and TTS audio for the next lesson in the sequence and caches it (database or server-side cache), so it is ready instantly when the user navigates there.
- If the Hugging Face API is unreachable or quota is exhausted, the UI falls back to browser TTS (or a clear offline indicator on platforms like Tesla where neither is available).
- TTS voice settings (preset name, reference audio path) are persisted per user in the database so they carry across devices.
- Audio chunks are cached server-side (keyed by lessonUnitId + voiceConfig hash) so repeat listens and pre-generated audio are served without re-invoking the API.

## Out of scope
- On-device/offline TTS beyond the existing browser speech API fallback.
- Real-time streaming of audio (chunked generation is fine, full playback after short buffer).
- Purchasing or managing Hugging Face compute credits from within the app.

## Tasks
1. **Qwen3-TTS server integration** — Add a server-side endpoint (`POST /api/tts/generate`) that accepts lesson text and a voice config (preset name or reference audio file path), calls the Hugging Face Spaces Gradio API for Qwen3-TTS on ZeroGPU, returns audio (base64 or URL), and caches the result keyed on (lessonUnitId, voiceConfigHash). Handle API errors and quota exhaustion gracefully with a fallback flag in the response.

2. **Voice configuration storage** — Add a `ttsVoiceConfig` column (JSON) to the users table (or a dedicated `userTtsSettings` table) to store the user's selected preset name and optionally a reference audio file path. Add storage CRUD methods and a `/api/tts/settings` GET/PUT endpoint.

3. **Voice reference audio upload** — Add a `/api/tts/voice-upload` endpoint that accepts a short audio file (≤30 s), stores it in the server's file system or database (binary), and returns a reference path that gets saved in the user's voice config.

4. **Frontend TTS settings UI** — Redesign the TTS popover/settings panel in `tts-button.tsx` to show: (a) preset voice cards (name + brief description), (b) an "Upload your voice" option that opens a file picker, (c) a playback speed control (already exists, keep it), and (d) a "Default (Browser)" fallback option. Persist the selection to the new settings endpoint.

5. **Frontend audio playback via server TTS** — Update `use-tts.ts` to: detect whether the Qwen3 endpoint is configured and reachable, fetch audio from `/api/tts/generate` when available, play the returned audio via the HTML5 `<audio>` element (works in Tesla), and fall back to `window.speechSynthesis` when the server returns a fallback flag or is unreachable.

6. **Predictive lesson pre-generation** — When the server handles a lesson content request for unit N, look up the next unit N+1 in the same topic tier (or first unit of the next tier). If its content has not yet been generated, trigger its content generation asynchronously in the background (non-blocking). Also queue a background TTS generation job for unit N+1 using the requesting user's voice config, caching the result so the client can retrieve it instantly.

## Relevant files
- `client/src/components/tts-button.tsx`
- `client/src/hooks/use-tts.ts`
- `client/src/components/rabbit-hole.tsx`
- `server/routes.ts`
- `server/storage.ts`
- `server/ai-providers.ts`
- `shared/schema.ts`
