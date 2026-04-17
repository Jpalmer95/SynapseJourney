---
title: Kokoro download progress bar
---
# Kokoro Download Progress Bar

## What & Why
When the Kokoro model (~82 MB fp32 / ~44 MB q8) is downloading for the first time, the UI only shows a spinner and static text. Users can't tell whether the download is still progressing or has silently stalled. The `@huggingface/transformers` library fires a `progress_callback` during `from_pretrained` with per-file 0–100% progress info — this is not wired up at all. The fix broadcasts real-time progress from the worker to the hook, then renders a proper progress bar in the TTS button.

## Done looks like
- During first-time Kokoro download, the loading indicator in both the TTS button tooltip and the voice settings popover header shows a horizontal progress bar with a live percentage (e.g., "Downloading… 47%").
- The progress bar updates smoothly as the ONNX model file downloads — the main file dominates (~80 MB), so its progress is a reliable proxy for total progress.
- Once download finishes and the model is compiling/loading into WebGPU or WASM, the bar shows 100% or a "Compiling…" phase label so users know it's not frozen.
- On subsequent loads (model already cached), the progress bar is skipped entirely — the model appears ready almost instantly.
- In SharedWorker mode, progress broadcasts to all connected tabs — every open tab sees the same progress bar simultaneously.

## Out of scope
- Weighted multi-file progress aggregation (the ONNX model file progress alone is a good enough proxy).
- Retry UI or abort-download controls.
- Persisting download progress across page refreshes.

## Tasks

1. **Wire progress_callback in the worker** — Pass a `progress_callback` to both `from_pretrained` calls that emits a `{ type: "progress", percent: number, phase: "download" | "compile", file?: string }` message. For SharedWorker mode, broadcast to all currently connected ports (maintain a `connectedPorts` Set in module scope). For DedicatedWorker mode, post to `self`. Only fire progress events when `status === "progress"` or `status === "initiate"`/`"done"` from the callback.

2. **Expose progress state in the hook** — Handle the new `progress` message type in `use-tts.tsx`. Add `kokoroDownloadPercent: number | null` to the TTS context (null = not loading, 0-100 = in progress, cleared to null on ready or error). Store in `useState` alongside existing `kokoroLoading` / `kokoroReady` state.

3. **Render progress bar in the TTS button** — Replace the plain spinner+text during `kokoroLoading` in `tts-button.tsx` with a compact progress bar showing the live percentage. Show this in both the popover header loading line and the status text area near the Listen button. When `kokoroDownloadPercent` is null but `kokoroLoading` is true (compiling phase), show a pulsing indeterminate bar with "Compiling model…" label.

## Relevant files
- `client/src/workers/tts.worker.ts`
- `client/src/hooks/use-tts.tsx:60-70,196-215,480-565`
- `client/src/components/tts-button.tsx:119-132,218-230,318-340,720-735`