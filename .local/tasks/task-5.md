---
title: Fix iOS speech synthesis crash
---
# Fix iOS Speech Synthesis Crash

## What & Why
On iOS Safari, the app crashes with `undefined is not an object (evaluating 'Object.getPrototypeOf(voice)')` immediately after the task #4 changes. This is a known WebKit bug triggered when `utterance.voice` is assigned a stale/detached `SpeechSynthesisVoice` object. The current `if (selectedVoice)` guard only blocks `null`/`undefined` — not detached voice objects that are truthy but rejected by WebKit's internal validator. The crash prevents the app from loading on iOS.

## Done looks like
- App loads without crashing on iOS Safari
- The WebKit `Object.getPrototypeOf(voice)` error no longer appears
- Browser TTS (if it works) still functions; if it throws, it silently falls back to server TTS
- No change to Android/desktop TTS behavior

## Out of scope
- Fixing other potential iOS WebKit SpeechSynthesis bugs not related to this crash
- Changes to the server TTS path

## Tasks
1. **Harden `speakChunk` against iOS voice errors** — In the `speakChunk` function in `use-tts.ts`: convert `getVoices()` return value with `Array.from()` for proper array methods; wrap the `utterance.voice` setter in a try/catch so a stale/detached voice silently falls back to the browser default; wrap `window.speechSynthesis.speak(utterance)` in a try/catch to catch any other iOS-specific errors and reject the promise cleanly.

2. **Harden `loadVoices` initializer** — In the `loadVoices` effect in `use-tts.ts`, also convert `getVoices()` with `Array.from()` and wrap the whole block in a try/catch so any iOS initialization errors don't propagate.

## Relevant files
- `client/src/hooks/use-tts.ts:155-175,195-221`