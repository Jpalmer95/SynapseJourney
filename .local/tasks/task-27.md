---
title: Deep revert Listen to April 4 + fresh progress bar
---
# Deep Revert Listen + Add Progress Bar Fresh

  ## What & Why
  The Listen feature is still broken after the Task #26 partial revert. The root
  cause is that the Task #21 SharedWorker rewrite fundamentally changed the
  worker architecture in ways that are hard to partially undo. The safest path is
  to restore all three TTS files to the April 4 published state (commit
  `933708b`) — a clean 70-line DedicatedWorker that is known to work on mobile
  WebGPU and desktop — and then layer the download progress bar UI cleanly on
  top of that simpler base.

  ## Done looks like
  - Tapping Listen on mobile loads and plays Kokoro audio (WebGPU path)
  - Desktop browsers play Listen audio without issues
  - During first-time download, a progress bar shows percentage + "Downloading/Compiling" label
  - Pause and resume mid-playback works (using audioCtxRef.suspend/resume from commit 6349d11)
  - No SharedWorker, no Tesla-browser workarounds, no iOS-specific audio context playback path

  ## Out of scope
  - Tesla browser / Chromium WebView compatibility
  - Server-side TTS routes, backend, or any non-TTS files
  - Any changes outside the three TTS files

  ## Tasks

  1. **Restore tts.worker.ts to April 4 state** — Replace the current file with
     the content from commit `933708b`. This gives a clean 70-line
     DedicatedWorker with WebGPU fp32 primary + WASM q8 fallback and simple
     `self.onmessage` / `self.postMessage`.

  2. **Add download progress callback to tts.worker.ts** — On top of the
     restored worker, add: a `ProgressPayload` type, a `makeProgressCallback()`
     function that tracks per-file progress and emits `{ id: -1, type:
     "progress", percent, phase }` via `self.postMessage`, and wire
     `progress_callback: makeProgressCallback(phase)` into both
     `from_pretrained` calls (WebGPU and WASM fallback).

  3. **Restore use-tts.tsx to April 4 state** — Replace the current hook with
     the content from commit `933708b`. This removes all SharedWorker port
     tracking, iOS-specific fixes, and Tesla-era changes.

  4. **Add progress state + handler to use-tts.tsx** — On top of the restored
     hook, add `kokoroDownloadPercent: number | null` and `kokoroDownloadPhase:
     "download" | "compile" | null` state fields (to the interface and
     implementation), handle the `type === "progress"` message from the worker
     (call `setKokoroDownloadPercent` and `setKokoroDownloadPhase`), clear both
     on "ready" and on worker error, and expose both in the return value.

  5. **Add audioCtxRef + improved pause/resume to use-tts.tsx** — Add
     `audioCtxRef = useRef<AudioContext | null>(null)` alongside the other refs.
     Update the `pause` callback to check `audioCtxRef.current.state ===
     "running"` and call `.suspend()`, and the `resume` callback to check
     `audioCtxRef.current.state === "suspended"` and call `.resume()`, as in
     commit `6349d11`. Keep the existing `audioRef.current.pause/play` path as
     the primary branch.

  6. **Restore tts-button.tsx to April 4 state** — Replace the current button
     component with the content from commit `933708b`.

  7. **Add progress bar UI to tts-button.tsx** — Pull `kokoroDownloadPercent`
     and `kokoroDownloadPhase` from `useTTS()`. Replace the simple
     "Loading model…" spinner with the full progress bar: a "Downloading model…"
     / "Compiling model…" phase label, percentage text, and an animated emerald
     bar (`bg-emerald-500`) with a pulsing fallback during compile phase. Apply
     this in all locations where `kokoroLoading` is shown (the settings popover,
     the tooltip, and the status line below the button).

  ## Key technical notes
  - The restored worker uses message types "init" (model load) and "speak"
    (generate audio). The progress payload uses `id: -1` as a sentinel to
    distinguish it from pending request responses.
  - The hook's `onmessage` handler already keyed off `id` to route responses;
    add an early return for `id === -1` (progress) before the pending-map lookup.
  - Do NOT introduce SharedWorker, WorkerBridge, or any port-tracking logic.
    Keep `workerRef.current` typed as `Worker` (not a union type).

  ## Relevant files
  - `client/src/workers/tts.worker.ts`
  - `client/src/hooks/use-tts.tsx`
  - `client/src/components/tts-button.tsx`