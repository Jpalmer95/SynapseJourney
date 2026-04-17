# Revert Listen to Last Working State

  ## What & Why
  The Listen/TTS feature broke after a series of attempts to make it work in a Tesla browser (Tasks #21–25 introduced SharedWorker support, WASM-only model switching, timeout handling, and iOS fixes). These changes collectively broke the feature on mobile WebGPU and desktop. The goal is to restore the three core TTS files to the last known-good state (commit `daf935f`, the "Improve voice model loading" commit after Task #22), which had: the download progress bar, working WebGPU on mobile, and working desktop playback. The pause/resume fix (commit `6349d11`) should be cherry-picked on top since it is a small, self-contained improvement that doesn't conflict.

  ## Done looks like
  - Listen works on mobile (WebGPU path loads and plays audio)
  - Listen works on desktop browsers
  - The download progress bar (percentage + animated bar) shows when the Kokoro model is being downloaded for the first time
  - Pause and resume mid-playback works

  ## Out of scope
  - Tesla browser / Chromium WebView compatibility
  - Any changes to server-side TTS routes or backend
  - Any non-TTS files

  ## Tasks
  1. **Restore tts.worker.ts** — Replace the current file with the version at commit `daf935f` (after Task #22, before Task #23). This is the WASM+WebGPU worker with download progress broadcast but without the Tesla-era timeout/compile-stuck workarounds.

  2. **Restore use-tts.tsx** — Replace the current hook with the version at commit `daf935f`, which includes the `kokoroDownloadPercent` state and progress message handling but before the SharedWorker-only port tracking and iOS-specific workarounds that broke playback.

  3. **Restore tts-button.tsx** — Replace with the version at commit `daf935f`, which renders the progress bar UI (percentage label + animated green bar + "Downloading / Compiling" phase label).

  4. **Cherry-pick pause/resume** — Apply the two-line change from commit `6349d11` to `use-tts.tsx`: replace the pause/resume functions to call `audioCtxRef.current.suspend()` and `audioCtxRef.current.resume()` respectively.

  5. **Smoke-test** — Start the app, open the Listen panel, trigger a Kokoro listen, and confirm audio plays and progress bar appears on first load.

  ## Relevant files
  - `client/src/workers/tts.worker.ts`
  - `client/src/hooks/use-tts.tsx`
  - `client/src/components/tts-button.tsx`
  