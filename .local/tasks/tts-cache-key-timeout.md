# Fix Listen: correct cache key + init timeout

  ## Root cause (confirmed by source inspection)

  Two bugs found:

  ### Bug 1: env.cacheDir is a no-op in browser
  The Task #29 fix set `env.cacheDir = "kokoro-v2"` to bust the stale model cache
  left by Tasks #21–25. Source inspection of transformers.web.js confirmed that in the
  browser, the library uses `env.cacheKey` (not `env.cacheDir`) for `caches.open()`:

    // line 6266-6281 of transformers.web.js
    if (!cache2 && env.useBrowserCache) {
      cache2 = await caches.open(env.cacheKey);  // default: "transformers-cache"
    }
    if (!cache2 && env.useFSCache) {             // false in browser
      cache2 = new FileCache(file_cache_dir ?? env.cacheDir);  // never reached
    }

  env.cacheDir only applies when env.useFSCache = true (Node.js). It is never reached
  in browser context. The stale WASM q8 files from Tasks #21–25 remain cached.

  ### Bug 2: No timeout on model init
  ensureKokoroInit() in use-tts.tsx posts an "init" message to the worker and waits
  on a Promise with no timeout. If from_pretrained() stalls — which it can, because
  WebGPU shader compilation for fp32 models can take 3–5 minutes, or fail silently —
  the UI shows "loading" forever with no recovery path.

  ## Fix: two targeted changes

  ### Change 1 — tts.worker.ts
  Replace the no-op line with the correct browser property:
    REMOVE: env.cacheDir = "kokoro-v2";
    ADD:    env.cacheKey = "transformers-cache-kokoro-v2";

  This opens a fresh browser cache store, bypassing the stale WASM-format files.

  ### Change 2 — use-tts.tsx
  In ensureKokoroInit(), wrap the pending Promise with a 3-minute (180 000ms) timeout.
  If the model has not sent a "ready" message within that window:
    - reject with "Model load timed out — please try again"
    - clear workerReadyPromiseRef.current so the next click retries from scratch
    - setKokoroLoading(false)

  Implement with a simple Promise.race:

    const INIT_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
    workerReadyPromiseRef.current = Promise.race([
      new Promise<void>((resolve, reject) => {
        // ... existing pending-map logic unchanged ...
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Model load timed out — please try again")), INIT_TIMEOUT_MS)
      ),
    ]).catch((err) => {
      workerReadyPromiseRef.current = null;
      setKokoroLoading(false);
      throw err;
    });

  Do NOT change tts-button.tsx or any other file. The error will surface through the
  existing ttsError display path in the button.

  ## Done looks like
  - Fresh page load forces a re-download of the correct WebGPU fp32 model files
    into "transformers-cache-kokoro-v2" instead of finding stale WASM q8 files
  - If init takes more than 3 minutes, an error appears and the user can tap to retry
  - No other logic changes — button, playback, voice selection all unchanged

  ## Files to edit
  - client/src/workers/tts.worker.ts  (1 line: cacheDir → cacheKey)
  - client/src/hooks/use-tts.tsx      (small: add Promise.race timeout in ensureKokoroInit)
  