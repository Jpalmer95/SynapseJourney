# Kokoro SharedWorker + Engine Diagnostics

## What & Why
Currently each browser tab spawns its own Web Worker with its own copy of the Kokoro model in GPU memory. On iOS — where per-tab and total GPU memory is severely limited — opening two tabs of the app simultaneously loads the model twice, risking tab termination. Additionally, the code has no visibility into which audio engine actually ran (WebGPU fp32 vs WASM q8 fallback), making it impossible to diagnose whether iOS is actually using WebGPU at all.

This task converts the Kokoro worker to a `SharedWorker` so all tabs in the same browser session share one model instance, and adds structured diagnostic logging that surfaces the active engine, load time, and cache status to both the console and the TTS button UI.

Also reverts all iOS-disabling code introduced by the previous (incorrect) Task #19 fix: `effectivePreset`, `onIOS`, `disabled={onIOS}`, `"Not available on iOS"` labels, and the `!isIOS()` guards around `voiceTier === "local"` calls in `use-tts.tsx`. Kokoro must be fully available on iOS — never hidden or disabled by platform.

## Done looks like
- Opening the app in two browser tabs on the same device loads the Kokoro model only once — visible in DevTools as a single SharedWorker process.
- The browser console shows clear `[TTS Worker]` log lines: which dtype/device was attempted, which succeeded, load duration in seconds, and whether it was loaded from the browser's disk cache or freshly downloaded.
- The TTS button's Kokoro engine row shows a live status line (e.g., "WebGPU · fp32 · loaded in 2.1s" or "WASM · q8 · cached") replacing the generic "Local · offline, no token needed" text once the model is ready.
- On devices that don't support SharedWorker (older Safari < 16), the code silently falls back to a regular Worker with identical behavior.
- Kokoro is fully enabled on iOS with no platform-based UI restrictions — same experience as desktop.

## Out of scope
- Changing the dtype used (fp32 for WebGPU, q8 for WASM) — those choices are confirmed correct.
- Persistent cross-session preload or service worker integration.
- Changing the three-tier fallback chain (Kokoro → cloud Qwen → server OpenAI → browser speech).

## Tasks

1. **Convert tts.worker.ts to a SharedWorker** — Rewrite the worker to use the SharedWorker `onconnect`/port interface. The model instance (`kokoroTTS`) stays in module scope and is shared across all connected ports. Track an `isReady` flag and a `loadingPromise` so any port that sends `init` while loading is in progress waits for the shared result rather than re-triggering a load. Each `speak` request is routed back to the port that sent it.

2. **Add structured diagnostic logging** — In the worker, add `console.log('[TTS Worker] ...')` lines before each load attempt, on success (with elapsed milliseconds and which engine won), and on fallback. Include `fromCache` detection by checking the browser's Cache API before calling `from_pretrained` (look up the model's primary ONNX file in `caches.open('transformers-cache')`). Emit an enriched `"ready"` message that includes `{ engine: "webgpu-fp32" | "wasm-q8", loadMs: number, fromCache: boolean }`.

3. **Update use-tts.tsx to use SharedWorker** — Replace `new Worker(...)` with `new SharedWorker(...)` and use `worker.port` for messaging. Add a `typeof SharedWorker === "undefined"` guard that falls back to a plain Worker. Expose the new diagnostic fields (`kokoroEngine`, `kokoroLoadMs`, `kokoroFromCache`) via the TTS context.

4. **Update tts-button.tsx — revert iOS guards and show diagnostics** — Remove `effectivePreset`, `onIOS`, `disabled={onIOS}`, `"Not available on iOS"` sublabel, and all `!onIOS &&` guards. Replace them with the plain `serverVoicePreset` references that existed before Task #19. Update the Kokoro engine row status line to display the engine diagnostic string once ready (e.g. "WebGPU · fp32 · 2.1s" or "WASM · q8 · cached").

5. **Revert iOS guards in use-tts.tsx** — Remove the two `!isIOS()` conditions that gate the `voiceTier === "local"` Kokoro path in `speak` and `speakSections`. Kokoro should be attempted on all platforms equally.

## Relevant files
- `client/src/workers/tts.worker.ts`
- `client/src/hooks/use-tts.tsx:219-225,460-531`
- `client/src/components/tts-button.tsx:89-90,121,224,257,302,319-351,388-402,721`
- `client/src/lib/utils.ts`
