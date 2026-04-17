# TTS Browser Cache Bust

  ## What & Why
  After rolling back the TTS code to the exact April 4 working state, Listen still
  fails. Investigation confirmed:
  - kokoro-js is still 1.2.1 (no package drift)
  - April 3 and April 4 TTS files are byte-for-byte identical (rolling back further
    won't change the TTS code)
  - The worker uses env.useBrowserCache = true, storing model weights in the browser
    Cache API

  Root cause: Tasks #21–25 switched the model format (WASM q8 instead of WebGPU fp32)
  while caching was enabled. Those incompatible model files are now cached in users'
  browsers under the same cache keys. Rolling back the code doesn't clear the user's
  browser cache, so the reverted WebGPU fp32 code finds cached WASM q8 files and fails.

  ## Fix
  Add a versioned cache prefix to the @huggingface/transformers env so a new cache
  namespace is used. This causes a fresh model download for all users, bypassing the
  stale cached files. Only the worker file needs to change.

  ## Done looks like
  - Listen feature works on fresh load (new cache key forces clean download)
  - WebGPU fp32 model loads correctly; WASM q8 fallback still works on non-WebGPU devices
  - No other TTS logic is changed — this is purely a cache namespace addition

  ## Scope
  Only edit: client/src/workers/tts.worker.ts

  Add after `env.useBrowserCache = true`:
    env.cacheDir = "kokoro-v2";   // bust stale WASM-format cache from Tasks #21–25

  Do NOT change use-tts.tsx, tts-button.tsx, tts-constants.ts, or any other file.

  ## Key technical notes
  - `env.cacheDir` sets the cache namespace used by @huggingface/transformers
  - "kokoro-v2" is arbitrary but distinct from the default ("transformers-cache" or similar)
  - On next load, the browser will not find a match in the new namespace and will
    re-download the correct WebGPU fp32 model files
  - This is safe and reversible; it does not affect logic, only cache key prefix
  