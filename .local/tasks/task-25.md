---
title: Kokoro: fix audio never playing after WASM synthesis (iOS + mobile)
---
# Kokoro: Fix audio never playing after WASM synthesis (iOS + mobile)

## What & Why

The model loads successfully (WASM q8, ~80 MB), the UI enters "rendering" state,
but audio never plays. Two root causes:

### Root cause 1 — iOS audio is blocked after async WASM synthesis

`unlockAudio()` creates a *temporary* AudioContext, plays a 1-sample silent
buffer, then immediately calls `ctx.close()`. This disposes the context. On iOS
Safari, `HTMLAudioElement.play()` is only allowed within a very short window
after a user gesture. WASM synthesis takes 30-300 s on mobile CPU — the gesture
window is gone before the blob is ready. iOS silently blocks `.play()` with
"NotAllowedError" (the `audio.play().catch(err => ...)` handler swallows it and
rejects, causing the Kokoro path to silently fail and fall through).

Fix: replace the temporary AudioContext with a **persistent singleton** AudioContext
(`audioCtxRef.current`) that is `resume()`d once during the user gesture.
Change `playBlobAudio` to use Web Audio API:
  1. `await audioCtx.decodeAudioData(await blob.arrayBuffer())`
  2. `const src = audioCtx.createBufferSource(); src.buffer = decoded; src.connect(audioCtx.destination); src.start(0)`
  
AudioBufferSourceNode playback via a pre-unlocked persistent context does NOT
require a fresh user gesture — the unlock carries across the async gap. This is
the standard iOS audio fix for async audio generation.

### Root cause 2 — Synthesis latency: full section text sent at once

A full lesson section can be 300-600 words. WASM CPU inference takes roughly
80-150 ms per token on mobile, meaning a 400-word section can take 60-300 s.
The user sees "rendering" for minutes and gives up.

Fix: **sentence-level chunking** for Kokoro. Add a `splitIntoSentences(text)`
utility that splits on `.`, `!`, `?`, and `;` boundaries (preserving punctuation,
merging short fragments). In the Kokoro section of `speakSections`, iterate over
sentences: for each sentence call `kokoroSpeak(sentence, voice)`, then immediately
`playBlobAudio(blob)` — the next synthesis starts during playback. The user
hears audio within 3-8 s of clicking Listen instead of waiting 30-300 s.

Apply the same sentence chunking inside `speak()` (the single-text path) using
the same sentence iterator.

### Root cause 3 — No per-synthesis timeout

The 90 s timeout added in Task #23 only covers model loading. If the WASM
runtime stalls during text generation (not loading), the pending promise hangs
forever. Add a 30 s timeout around `kokoroSpeak` calls. On timeout, log a
warning, skip that chunk, and fall through to the server TTS fallback.

## Done looks like
- On iOS Safari: clicking Listen begins playing the first sentence within ~5-10 s.
- On Android Chrome: first sentence plays within ~3-8 s.
- On desktop: unchanged or faster (WASM is fast on desktop).
- If Kokoro synthesis hangs: times out after 30 s per chunk and falls through to
  server TTS, with no stuck "rendering" UI.
- `playBlobAudio` uses a persistent pre-unlocked AudioContext — no HTMLAudioElement
  for blob playback.

## Out of scope
- Changing voices, voice presets, or any other TTS settings
- Changing how the model is loaded (WASM q8 stays as-is from Task #24)
- Changing the server TTS fallback path

## Files to change
- `client/src/hooks/use-tts.tsx`
  - Add `audioCtxRef` (persistent AudioContext singleton)
  - Modify `unlockAudio()` to `resume()` the persistent context instead of
    creating+closing a temporary one
  - Rewrite `playBlobAudio()` to use Web Audio API
    (`decodeAudioData` + `AudioBufferSourceNode`)
  - Add `splitIntoSentences(text): string[]` pure utility function
  - Modify the Kokoro section in `speakSections` to iterate sentences
  - Modify the Kokoro section in `speak()` to iterate sentences
  - Wrap `kokoroSpeak` calls with a 30 s synthesis timeout
- `client/src/lib/utils.ts` (optional: export `splitIntoSentences` from here
  instead if it's useful app-wide)