# Fix Kokoro TTS Crash on iOS Safari

## What & Why
On iOS Safari, tapping "Listen" with the Kokoro WebGPU engine selected causes the browser tab to crash (appearing as a page refresh). The root cause is that iOS Safari has strict per-tab memory limits (~200–500 MB depending on device), and loading the 82M-parameter Kokoro ONNX model (fp32, ~90 MB download + several hundred MB of runtime RAM) inside a Web Worker reliably exhausts that budget. Both the WebGPU and WASM paths are affected. The app needs to detect iOS at runtime and route around the Kokoro worker entirely on that platform.

## Done looks like
- On iOS Safari, tapping "Listen" works without crashing or refreshing the page — audio plays via the server TTS engine (or browser speech synthesis as a last resort).
- The Kokoro engine option in the settings panel is visibly disabled on iOS with a brief note (e.g. "Not supported on iOS") so users aren't confused by why it doesn't appear.
- If a user previously had "kokoro" saved as their preset and opens the app on iOS, the engine is silently rerouted to server TTS for playback (no crash, no error toast).
- On non-iOS devices, Kokoro continues to work exactly as before.

## Out of scope
- Changing the Kokoro model size or format (future optimization).
- Fixing any other audio issues unrelated to iOS Safari crashes.

## Tasks
1. **Add iOS detection utility** — Create a small `isIOS()` helper (detects iPhone/iPad via `navigator.userAgent` and `navigator.maxTouchPoints`) and export it from a shared utilities file.

2. **Guard Kokoro in the TTS hook** — In `use-tts.tsx`, before spawning the Kokoro Web Worker, check `isIOS()`. If true, skip `kokoroSpeak` and fall through to the server TTS path (same logic used when `voiceTier` is non-local). This prevents the tab crash entirely.

3. **Disable Kokoro in the settings panel on iOS** — In `tts-button.tsx`, when `isIOS()` is true, render the Kokoro `EngineRow` as visually disabled (muted text, no click handler) and add a short sublabel like "Not available on iOS". If the active preset is "kokoro" and the user is on iOS, treat the active badge as "browser" for display purposes.

## Relevant files
- `client/src/hooks/use-tts.tsx:459-545`
- `client/src/hooks/use-tts.tsx:697-730`
- `client/src/components/tts-button.tsx:254-281`
- `client/src/workers/tts.worker.ts`
