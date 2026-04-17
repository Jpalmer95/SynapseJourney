# Fix Kokoro on iOS with fp16 WebGPU

## What & Why
The previous fix disabled Kokoro on iOS Safari entirely, which is unacceptable — Kokoro should be the default listen experience on all devices, including iOS. The real root cause is that `fp32` dtype on WebGPU uses too much GPU memory on iOS Safari (iOS has strict per-tab memory limits), causing the tab to crash. The fix is to use `fp16` (16-bit float) dtype instead of `fp32` when running on iOS. This halves GPU memory usage while still producing natural-sounding audio — unlike `q8` which produces garbled speech on WebGPU.

## Done looks like
- Kokoro works on iOS Safari without crashing or refreshing the page.
- iOS users hear natural-sounding audio (fp16 quality, not garbled q8).
- Kokoro remains the default engine on all platforms — no platform-specific disabling.
- All iOS-disabling code from the previous fix (disabled button state, isIOS guards on speak/speakSections, effectivePreset remapping, "Not available on iOS" label) is removed.
- On non-iOS devices, fp32 continues to be used (no quality regression).
- If WebGPU with fp16 still fails on a particular iOS device, the WASM q8 fallback fires as normal — no tab crash.

## Out of scope
- Changes to the cloud (Qwen) or server TTS paths.
- Changing the default engine from Kokoro.

## Tasks
1. **Worker: accept lightweight flag for fp16** — Update `tts.worker.ts` to accept a `preferLightweight` boolean in the init message. When true, use `dtype: "fp16"` instead of `dtype: "fp32"` for the WebGPU load path. Keep the WASM q8 fallback unchanged.

2. **Hook: pass lightweight flag on iOS** — In `use-tts.tsx`, update the `ensureKokoroInit` call to detect iOS (via the existing `isIOS()` helper) and include `preferLightweight: isIOS()` in the worker init message. Remove the `&& !isIOS()` guards added to the Kokoro branches in `speak` and `speakSections`.

3. **UI: revert iOS disabling** — In `tts-button.tsx`, remove all iOS-disabling changes: remove `disabled={onIOS}` from the Kokoro EngineRow, restore the "Local · offline, no token needed" sublabel unconditionally, revert `effectivePreset` back to just `serverVoicePreset` for active state/tier display, remove the `!onIOS &&` guards on header status indicators, and restore the original Kokoro tooltip text. `isIOS()` may remain in utils.ts for potential future use but should no longer affect any Kokoro UI or logic.

## Relevant files
- `client/src/workers/tts.worker.ts`
- `client/src/hooks/use-tts.tsx:505-530`
- `client/src/hooks/use-tts.tsx:727-732`
- `client/src/hooks/use-tts.tsx:990-995`
- `client/src/components/tts-button.tsx:87-93`
- `client/src/components/tts-button.tsx:257-292`
- `client/src/components/tts-button.tsx:319-335`
- `client/src/components/tts-button.tsx:339-351`
- `client/src/components/tts-button.tsx:385-391`
