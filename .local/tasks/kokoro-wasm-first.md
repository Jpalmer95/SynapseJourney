# Kokoro: WASM q8 First, Fix Cache Check

## What & Why
The current worker tries WebGPU fp32 first. The fp32 model is ~350 MB — on
mobile the browser downloads it successfully but then crashes (OOM) when trying
to load it into GPU memory during the "compile" phase. This forces a full page
reload, boots the user out of their lesson, and because the crash leaves the
fp32 cache entry in a bad state the next visit still re-downloads rather than
using cache.

The fix: flip the engine priority so WASM q8 (the ~80 MB quantized model) is
tried first. WASM q8 is safe on all devices, needs no GPU memory, and produces
indistinguishable TTS audio quality. WebGPU fp32 is removed from the first-load
path entirely — if WebGPU is desired in future it can be an optional upgrade
path after WASM is confirmed working.

The cache-detection helper also needs to be updated to look for the q8 model
file specifically, so the "Kokoro ready · instant playback" hint correctly
reflects a warm q8 cache.

## Done looks like
- First-time Kokoro load downloads ~80 MB (q8), not ~350 MB (fp32).
- No browser crash / page reload on any tested device or browser.
- After the model loads once, returning to the app shows "Kokoro ready · instant
  playback" without re-downloading.
- Engine diagnostic in the settings popover shows "WASM · q8 · Xs".
- If WASM q8 also fails (truly exceptional), the error is surfaced cleanly with
  the existing `kokoroLoadError` UI.

## Out of scope
- Re-introducing WebGPU as a primary or fallback path
- Changing voice quality, voices list, or any other TTS settings

## Tasks
1. **Swap engine order in worker** — Change `loadModel()` to attempt WASM q8
   first and remove the WebGPU fp32 attempt entirely (or move it to a secondary
   catch-only fallback that is clearly labeled experimental).

2. **Fix `checkFromCache` to target the q8 artifact** — Update the URL pattern
   from the generic `/onnx/model_` check to one that specifically matches the
   q8 model file (`model_q8.onnx`), so the cache-hit path correctly reflects
   what the new primary engine requires.

## Relevant files
- `client/src/workers/tts.worker.ts:141-215`
- `client/src/workers/tts.worker.ts:53-64`
