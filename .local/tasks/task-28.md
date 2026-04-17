---
title: Pure TTS rollback — April 4 state, no additions
---
# Pure TTS Rollback to April 4

  ## What & Why
  Every attempt to revert the Listen feature has added layers on top of the
  rollback (progress bar, pause/resume, audioCtxRef) that have introduced new
  failure points. The user wants a clean, simple rollback to a confirmed working
  state with no additions. Restore the three TTS files to the exact content they
  had at the April 4 published checkpoint (commit `933708b`) and stop there.

  ## Done looks like
  - Listen works on mobile WebGPU and desktop
  - No SharedWorker, no Tesla workarounds, no iOS-specific patches
  - No progress bar, no audioCtxRef, no extra features — pure April 4 state
  - The three TTS files are byte-for-byte identical to commit `933708b`

  ## Out of scope
  - Adding any new features on top of the rollback
  - Progress bar, pause/resume improvements, or any other enhancements
  - Any files other than the three TTS files
  - Server-side TTS code

  ## Tasks

  1. **Restore tts.worker.ts** — Run `git show 933708b:client/src/workers/tts.worker.ts`
     and write that exact content as the new file. Do not add anything to it.

  2. **Restore use-tts.tsx** — Run `git show 933708b:client/src/hooks/use-tts.tsx`
     and write that exact content as the new file. Do not add anything to it.

  3. **Restore tts-button.tsx** — Run `git show 933708b:client/src/components/tts-button.tsx`
     and write that exact content as the new file. Do not add anything to it.

  4. **Verify** — Restart the app and confirm there are no TypeScript or runtime
     errors in the three files.

  ## Key technical notes
  - Commit `933708b` is "Published your App" on April 4, 2026 at 03:59 UTC.
  - The TTS at this commit is a simple 70-line DedicatedWorker (self.onmessage),
    1268-line hook, and 780-line button — all confirmed working on mobile WebGPU.
  - Do NOT add progress bar, audioCtxRef, pause/resume improvements, or any other
    feature. The sole goal is an exact restore of those three files.

  ## Relevant files
  - `client/src/workers/tts.worker.ts`
  - `client/src/hooks/use-tts.tsx`
  - `client/src/components/tts-button.tsx`