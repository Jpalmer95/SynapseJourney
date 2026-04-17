---
title: TTS Engine Simplification
---
# TTS Engine Simplification

## What & Why
Simplify the TTS architecture into three clearly distinct, toggleable engines, each with its own independent voice sub-selection. The current design conflates the Kokoro voice lookup with a named preset map (KOKORO_VOICE_MAP["aria"] etc.) which breaks with new preset IDs and causes gibberish. The new model gives each engine one job:

- **Kokoro** — local browser TTS, offline-capable. Shows 3–6 native Kokoro voice options using real Kokoro voice IDs directly (af_bella, af_sky, af_heart, am_michael, bm_george, am_adam). Voice selection is stored separately from the engine selection.
- **Browser TTS** — device speech synthesis, optional fallback. No sub-options.
- **Qwen (HF ZeroGPU)** — cloud engine. Separate set of 6 AI voice characters (Aria, Nova, Lyra, Echo, Sage, Orion) forwarded as `voice_description` text to Qwen3-TTS, plus custom voice upload (cloning) and free-text voice description input. Requires HF token.

These two voice lists are completely independent — Kokoro voices are real model voice IDs, Qwen voices are natural-language style descriptions.

## Done looks like
- Settings panel shows three top-level engine rows (radio-style): Kokoro (default, ⚡ badge), Browser TTS, Qwen Cloud (☁ badge).
- Selecting Kokoro expands a sub-grid of Kokoro voice options (e.g. Bella, Sky, Heart, Michael, George, Adam) — each labeled with gender and style. Kokoro produces clean, intelligible audio from the selected voice.
- Selecting Browser TTS works the same as before with no sub-options.
- Selecting Qwen expands a separate sub-section with: 6 AI voice character cards (Aria, Nova, Lyra, Echo, Sage, Orion — used as Qwen voice descriptions), a custom voice upload dropzone, a free-text voice description input, and the HF token field.
- The Listen button tooltip reflects the active engine: "Read aloud · Kokoro local", "Read aloud · Qwen cloud", or "Read aloud · Browser".
- Cold-start warming toast and HF token management continue to work for Qwen.
- Server (OpenAI) remains the silent last-resort fallback for all three engines.
- Changing the active engine or sub-voice does not affect the other engine's saved sub-voice choice.

## Out of scope
- Adding new Kokoro voices beyond the 6 already mapped.
- Changing audio progress bar or per-section playback controls.
- HF OAuth login (token paste only).

## Tasks

1. **Update constants** — In `tts-constants.ts`: add `KOKORO_VOICES` array with entries `{ id: string (e.g. "af_bella"), name: string, gender, style }` for the 6 voices; rename existing 6 preset entries into `QWEN_VOICES` array with `{ id, name, gender, color, voiceDescription }` fields; add `KOKORO_DEFAULT_VOICE = "af_bella"`, `QWEN_DEFAULT_VOICE = "aria"`; simplify `getVoiceTier()` to accept `"kokoro" | "browser" | "qwen" | "custom"`.

2. **Update hook routing** — In `use-tts.tsx`: add `kokoroVoice` state (localStorage `"kokoro_voice"`, default `"af_bella"`) and expose `setKokoroVoice`; add `qwenVoice` state (localStorage `"qwen_voice"`, default `"aria"`) and expose `setQwenVoice`. Update `speak()` and `speakSections()` routing: `"kokoro"` → Kokoro worker using `kokoroVoice` ID directly; `"qwen"` → Qwen cloud using the `voiceDescription` from `QWEN_VOICES[qwenVoice]`; `"custom"` → Qwen cloud with reference audio. Change default preset from `"browser"` to `"kokoro"`.

3. **Redesign settings panel** — In `tts-button.tsx`, replace 2-section layout with 3-engine toggle rows. Each row is a radio button with icon + label + badge. Kokoro row: when active, expands to show Kokoro voice sub-grid. Qwen row: when active, expands to show Qwen voice character cards, custom upload dropzone, free-text description input, and HF token field. Speed slider stays in Advanced.

4. **Update server preset validation** — In `server/routes.ts`, change both `VALID_PRESETS` arrays to `["kokoro", "browser", "qwen", "custom"]`. In `server/storage.ts`, change the default from `"browser"` to `"kokoro"`. In `server/tts-service.ts`, ensure `callTTSDirect` uses a reasonable default OpenAI voice (e.g. "alloy") for presets `"kokoro"` and `"qwen"` since these no longer map to named OpenAI voices.

## Relevant files
- `client/src/lib/tts-constants.ts`
- `client/src/hooks/use-tts.tsx:600-835`
- `client/src/hooks/use-tts.tsx:835-1000`
- `client/src/components/tts-button.tsx`
- `server/routes.ts:855-870`
- `server/routes.ts:915-925`
- `server/storage.ts:1799-1815`
- `server/tts-service.ts`