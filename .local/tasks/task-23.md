---
title: Fix Kokoro model loading on iOS / mobile
---
# Fix Kokoro Model Loading

## What & Why
The Kokoro model gets stuck in "Compiling model…" indefinitely on all tested browsers (Brave, Safari, Chrome on iOS). Four separate bugs compound to cause this:

1. **Phase transition bug** — any file's `"done"` event triggers the "compile" phase immediately, so the large 82MB ONNX model downloads silently behind the wrong "Compiling…" label for the entire download duration.
2. **WebGPU → WASM retry pollution** — on iOS (all three browsers use WebKit and likely fail WebGPU), the code retries with WASM but uses a new progress callback without resetting the stale "compile" state from the failed WebGPU attempt, so progress display breaks.
3. **No timeout / stuck-detection** — if WASM ONNX initialization hangs (common on low-memory mobile), there is no deadline that forces an error, leaving the UI stuck forever.
4. **Error path gap** — if both engines fail, the error may not fully clear the loading/progress state in the hook, leaving the spinner running even after failure.

## Done looks like
- Progress bar shows "Downloading model…" with accurate percentage for the full duration of the ONNX file download, then transitions to "Compiling model…" only after **all** files have finished downloading.
- When WebGPU fails and WASM retries, progress resets cleanly and shows the WASM download/compile progress correctly.
- If loading takes more than 90 seconds, an error is surfaced in the UI ("Model load timed out — try refreshing") and the loading state is fully cleared.
- If both WebGPU and WASM fail, the error message appears in the TTS button UI and `kokoroLoading` is cleared.
- The model successfully loads and produces audio on iOS WebKit browsers.

## Out of scope
- Changing which engine is tried first (WebGPU before WASM stays as-is)
- Changing the Kokoro model source or quantization level

## Tasks
1. **Fix phase transition in progress callback** — In `makeProgressCallback`, only emit the "compile" phase broadcast after ALL tracked files have reported `"done"` (i.e., every value in `fileProgress` is 100). Until the last file completes, continue emitting "download" phase with the averaged percent.

2. **Reset progress state between WebGPU and WASM attempts** — In the `loadModel` catch block that retries with WASM, broadcast a reset progress event (`percent: 0, phase: "download"`) before starting the WASM attempt, so the UI correctly shows fresh download progress for the fallback.

3. **Add a loading timeout** — Wrap `loadModel()` with a 90-second race. If it times out, reject with a clear user-facing message ("Kokoro model load timed out — please refresh and try again"), reset `loadingPromise` to null so a future attempt can retry, and ensure `kokoroLoading` is cleared.

4. **Verify and fix the error-clearance path** — Audit the hook's error handling (pending `reject` callback and `onError`) to confirm that a worker error or timeout fully clears `kokoroLoading`, `kokoroDownloadPercent`, and `kokoroDownloadPhase`. Add any missing state resets. Also surface the error string in the TTS button UI so the user sees a message rather than a stalled spinner.

## Relevant files
- `client/src/workers/tts.worker.ts`
- `client/src/hooks/use-tts.tsx`
- `client/src/components/tts-button.tsx`