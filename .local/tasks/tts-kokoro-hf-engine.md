# TTS Engine Overhaul: Kokoro Local + HF Cloud

## What & Why
Replace the current server-side-only TTS architecture with a two-tier hybrid engine:

**Tier 1 — Local (free, offline-capable):** Run the Kokoro 82M ONNX model client-side via a Web Worker using `kokoro-js` + `@huggingface/transformers` v4. The 8-bit quantised model (~86 MB) loads from the browser Cache API after first download, enabling instant offline playback on every subsequent visit. WebGPU is used when available, with automatic fallback to WASM (CPU) for older devices.

**Tier 2 — Cloud (user-authenticated):** Route premium voice requests directly from the browser to a Hugging Face ZeroGPU Space using the user's own HF Access Token (stored in localStorage/IndexedDB). Because the user supplies the token, GPU compute costs count against their personal HF quota — not the server. This tier retains voice cloning, voice description input, and the 6 existing AI preset personalities.

The current server-side Qwen Gradio call (broken since the Space API changed) is removed. The OpenAI TTS server path remains as a fallback for users who have neither a HF token nor working WebGPU/WASM.

## Done looks like
- First "Listen" click downloads the Kokoro model in the background; subsequent visits play instantly with no server round-trip
- A Web Worker handles all model inference, keeping the main thread and UI completely responsive
- Users on WebGPU-capable browsers (Chrome 113+, Edge) get GPU-accelerated local TTS; others get WASM CPU inference silently
- Users who paste a Hugging Face Access Token in Settings can access Qwen ZeroGPU cloud voices (aria, nova, lyra, echo, sage, orion)
- A "Warming up engine…" toast appears on the first cloud request (ZeroGPU cold-start latency of 15–20 s)
- If a user selects a cloud voice without a token, a prompt appears asking them to add a token
- Voice cloning (upload an audio sample) continues to work, routed through the HF cloud tier
- Kokoro voice names (e.g. af_bella, am_adam) are mapped to the existing preset personality names so the rest of the app sees no breaking changes

## Out of scope
- HF OAuth login flow (token paste-in only for now)
- Streaming audio from HF Space (single-shot response acceptable)
- Any changes to the TTS settings panel UI (handled in separate UI task)
- Changes to how sections/paragraphs are structured or the audio progress bar

## Tasks
1. **Install packages and configure Vite** — Add `@huggingface/transformers` and `kokoro-js` as dependencies. Configure Vite to exclude Node-only ONNX native binaries (`onnxruntime-node`) from the browser bundle so the client build stays lightweight.

2. **Create the Kokoro Web Worker** — Implement `client/src/workers/tts.worker.ts`. On first message, initialise `KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-ONNX", { dtype: "q8", device: "webgpu" })` with a WASM fallback when `navigator.gpu` is absent. Enable `env.useCustomCache = true` / Cache API caching for model weights. Accept messages of `{ type: "speak", text, voice }` and reply with a Float32Array audio buffer or an error.

3. **Wire Kokoro into use-tts hook** — Add a `useKokoroWorker()` internal hook that spawns the worker once, exposes `kokoroSpeak(text, voice)` returning a Blob URL, and tracks `kokoroReady` / `kokoroLoading` state. Update `speak()` and `speakSections()` to try Kokoro first when a local voice preset is selected, before falling back to the OpenAI server path.

4. **HF token management in use-tts hook** — Add `hfToken` state (loaded from localStorage key `hf_token`), `setHFToken(token)`, and `clearHFToken()` to the hook's return value. Add `fetchQwenCloudTTS(text, presetId, hfToken, referenceAudio?)` that POSTs to the configured HF Space URL with `Authorization: Bearer <token>` and returns an audio Blob URL.

5. **Update voice preset routing logic** — Introduce a `voiceTier: "local" | "cloud" | "server"` classifier. Local presets (Kokoro voices) use the worker. Cloud presets (Qwen voices) use `fetchQwenCloudTTS`. Server preset ("browser" or no worker) uses the existing OpenAI/server path as before. Persist the user's chosen preset in their profile as before.

6. **Update tts-constants.ts** — Add `KOKORO_VOICE_MAP` mapping the 6 existing preset IDs (aria, nova, lyra, echo, sage, orion) to sensible Kokoro voice names (e.g. aria→af_bella, nova→af_sky, lyra→af_heart, echo→am_michael, sage→bm_george, orion→am_adam). Add a `voiceTier` field to the constants so the UI task can read it without re-deriving.

## Relevant files
- `client/src/hooks/use-tts.tsx`
- `client/src/lib/tts-constants.ts`
- `vite.config.ts`
- `server/tts-service.ts`
- `server/routes.ts`
