---
title: Fix Kokoro Audio + Set Browser Default
---
# Fix Kokoro Audio + Set Browser Default

## What & Why
Multiple interconnected TTS bugs to fix:

**Bug 1 — Kokoro "alien speech":** The worker uses `dtype: "q8"` with WebGPU. The kokoro-js docs explicitly say WebGPU requires `dtype: "fp32"` — q8 causes garbled/alien output. Additionally the model ID `"onnx-community/Kokoro-82M-ONNX"` is outdated; the current stable version is `"onnx-community/Kokoro-82M-v1.0-ONNX"`.

**Bug 2 — Kokoro is slow every listen, not just first:** Because q8+WebGPU silently falls back to WASM inference, it re-runs the slow WASM path each time (~30–90 s). With fp32+WebGPU on a GPU machine, inference should be near real-time.

**Bug 3 — Browser TTS + Kokoro play simultaneously:** `speak()` and `speakSections()` read `serverVoicePreset` from a captured closure (line 709: `const currentPreset = serverVoicePreset`). Unlike all other engine values (`hfTokenRef`, `kokoroVoiceRef`, etc.), there is no `serverVoicePresetRef`. When a user switches from Kokoro → Browser TTS and immediately clicks Listen, `speak()` runs with the stale "kokoro" value, launching Kokoro loading in the background. After the state re-render, if they click Listen again, Browser TTS also starts. 30–90 seconds later, Kokoro finishes and plays on top.

**Bug 4 — Default should be Browser TTS:** Three places hardcode `"kokoro"` as the default. Until Kokoro stability is verified, Browser TTS should be the safe fallback.

**Fix 5 — Engine order:** The UI should show Browser TTS first, Kokoro second, Qwen third.

## Done looks like
- Kokoro produces natural speech (no alien/garbled audio)
- On a GPU-capable machine, Kokoro inference is fast after model loads (not 30–90 s per listen)
- Switching from Kokoro to Browser TTS and clicking Listen immediately uses Browser TTS — no Kokoro audio loads or overplays
- New users and users without a saved preference default to Browser TTS
- Settings panel engine order: Browser TTS → Kokoro → Qwen Cloud
- Existing users who already explicitly chose Kokoro or Qwen keep their saved preference

## Out of scope
- Changes to the Kokoro voice character list or UI
- Qwen behavior changes

## Tasks

1. **Fix Kokoro worker** — In `tts.worker.ts`: (a) change model ID from `"onnx-community/Kokoro-82M-ONNX"` to `"onnx-community/Kokoro-82M-v1.0-ONNX"` in both `from_pretrained` calls, (b) use `dtype: "fp32"` for the WebGPU path and keep `dtype: "q8"` only for the WASM fallback path.

2. **Fix stale closure bug** — Add `serverVoicePresetRef` in `use-tts.tsx` (mirroring the pattern used by `hfTokenRef`, `kokoroVoiceRef`, etc.), update it synchronously inside `setServerVoicePreset()` (not just via a useEffect), and replace the `const currentPreset = serverVoicePreset` line in `speak()` and the equivalent in `speakSections()` with `serverVoicePresetRef.current`.

3. **Change default preset to Browser TTS** — Update the three hardcoded `"kokoro"` defaults to `"browser"`: the server storage fallback in `storage.ts`, the client initial state in `use-tts.tsx`, and the API response fallback in the same file.

4. **Reorder engine rows in settings UI** — In `tts-button.tsx`, reorder the three engine sections so Browser TTS renders first, Kokoro second, Qwen third. No content changes, ordering only.

## Relevant files
- `client/src/workers/tts.worker.ts`
- `client/src/hooks/use-tts.tsx:174,209-214,692-716,980-995`
- `server/storage.ts:1800-1810`
- `client/src/components/tts-button.tsx:322-600`