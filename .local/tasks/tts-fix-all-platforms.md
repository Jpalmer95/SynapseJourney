# Fix TTS on Tesla, iPhone & AI Voices

## What & Why

Three TTS failures are reported:

1. **AI voices silent on all platforms** — The Qwen3-TTS Gradio Space API endpoint
   (`/call/synthesize`) returns 404 (the Space changed its API). No HF token is configured
   as a fallback. Every `/api/tts/generate` call returns 503, so AI voice presets produce
   nothing on any device.

2. **Tesla browser gets "synthesis-failed"** — Tesla's Chromium browser has
   `window.speechSynthesis` but cannot use it (fires `onerror` with `synthesis-failed`).
   The server fallback in `speak()` only catches `"speech_synthesis_error"` (thrown
   synchronously by `.speak()`), never matching the async `"synthesis-failed"` value. The
   server is never retried.

3. **iPhone "generates then does nothing"** — Server TTS fails (503), so the client falls
   through to browser TTS. By then the iOS user-gesture window may have expired (iOS blocks
   `audio.play()` if called too long after a tap), causing silent failure.

The project already has OpenAI integrated (`javascript_openai_ai_integrations==2.0.0`).
OpenAI's `/audio/speech` endpoint is reliable, fast (~1-2 s for typical lesson text), and
returns high-quality MP3. Replacing the broken Gradio Space with OpenAI TTS as the
primary server engine fixes AI voices everywhere. The Tesla catch broadening and iOS audio
unlock fix the remaining edge cases.

## Done looks like

- Tapping "Listen" with any AI voice preset (Aria, Nova, Lyra, Echo, Sage, Orion) produces
  audio within 1-3 seconds on iPhone, desktop, and Tesla.
- On Tesla with the default "Browser" preset, audio plays (either via server TTS fallback
  after "synthesis-failed", or automatically switched to server TTS).
- The AI voice name displayed in the audio bar matches the selected preset.
- Existing browser TTS still works on platforms that support it (desktop Chrome/Firefox).

## Out of scope

- Adding new voice presets or changing the voice selection UI.
- Voice cloning / custom reference audio (unchanged).
- Changing playback speed or equalizer settings.

## Tasks

1. **Switch primary server TTS to OpenAI** — In `server/tts-service.ts`, add a
   `callOpenAITTS(text, voicePresetId)` function that calls the OpenAI `/audio/speech` API
   using the existing OpenAI integration. Map the 6 preset IDs to OpenAI voice names
   (aria→shimmer, nova→nova, lyra→fable, echo→echo, sage→onyx, orion→alloy). Call this
   first in `generateTTSAudio` and `callTTSDirect` before the Qwen3-TTS Gradio attempt;
   keep Qwen3-TTS and HF Inference as fallbacks.

2. **Broaden Tesla browser TTS error handling** — In `use-tts.tsx`, update the outer `catch`
   block of `speak()` to also trigger the server TTS fallback for `"synthesis-failed"`,
   `"synthesis-unavailable"`, `"audio-hardware"`, and `"network"` error codes (not only
   `"speech_synthesis_error"`). Additionally, update `shouldTryServer` to be `true` when the
   browser preset is selected but `getVoices()` returns zero voices, so Tesla users
   automatically get server TTS without having to change settings.

3. **Fix iOS audio playback** — In `use-tts.tsx`, add a silent-audio "unlock" at the
   very start of `speak()` and `speakSections()` (before any `await`) that creates an
   `AudioContext`, runs a zero-length silent buffer source synchronously, then closes it.
   This tells iOS the page has intentionally started audio within the user gesture, allowing
   subsequent `audio.play()` calls (even after an async fetch) to succeed without a
   "NotAllowedError". Keep a ref so the unlock only runs once per session.

## Relevant files

- `server/tts-service.ts`
- `server/routes.ts:897-1010`
- `client/src/hooks/use-tts.tsx`
- `client/src/lib/tts-constants.ts`
