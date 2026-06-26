# TTS Read-Aloud Overhaul Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix and overhaul the TTS read-aloud system to support Kokoro (WebGPU), Qwen3-TTS (3 modes via ZeroGPU), and Browser TTS fallback — robust on any device.

**Architecture:** Three-tier TTS with clear separation: Kokoro runs client-side in a Web Worker, Qwen3-TTS calls go through the server (Gradio REST API to the HF Space), and Browser TTS is the universal fallback. The server acts as a proxy for Qwen3-TTS so the user's HF token never touches the browser and ZeroGPU auth works correctly.

**Tech Stack:** React, Express, Drizzle/PG, kokoro-js, @huggingface/transformers, Gradio 5.x REST API, Web Speech API

---

## Current Problems

### 1. Build broken — wrong import paths in `server/routes/ai.ts`
Dynamic imports use `./tts-service`, `./storage`, `./link-validator` but ai.ts is in `server/routes/` and those files are in `server/`. Should be `../tts-service`, `../storage`, `../link-validator`.

### 2. Kokoro worker crashes at runtime
The screenshot shows "Kokoro worker crashed — please refresh the page." The SharedWorker construction may fail silently in some browsers, or the module worker type may not be supported. Need better error handling and fallback.

### 3. Qwen3-TTS server code calls wrong endpoint
`callQwen3TTS` in `server/tts-service.ts` uses `apiName = "synthesize"` but the Space has 3 endpoints: `generate_voice_design`, `generate_voice_clone`, `generate_custom_voice`. Each has different parameters.

### 4. Client-side Qwen calls are broken
`fetchQwenCloudTTS` in `use-tts.tsx` tries to call `api-inference.huggingface.co/models/Qwen/Qwen3-TTS` from the browser. ZeroGPU Spaces cannot be called via the HF Inference API — they must be called via the Gradio REST API on the Space itself, and the user's HF token must be sent as a Bearer header. This must go through the server to avoid CORS and token exposure.

### 5. Voice cloning data format wrong
Server passes base64 audio as a string in the data array, but the Gradio API expects a FileData object (handle upload first). The Voice Clone endpoint requires: `ref_audio` (filepath), `ref_text` (transcript), `target_text`, `language`, `use_xvector_only`, `model_size`.

### 6. No Voice Design mode
The user wants text-described custom voice TTS (Qwen3-TTS Voice Design mode). Currently only "preset speakers" and "custom (voice clone)" are available. Need a third Qwen sub-mode.

### 7. Qwen voice presets don't match actual speakers
The `QWEN_VOICES` constant uses made-up names (Aria, Nova, Lyra, etc.) with voice descriptions. The actual Qwen3-TTS CustomVoice speakers are: Aiden, Dylan, Eric, Ono_anna, Ryan, Serena, Sohee, Uncle_fu, Vivian.

---

## Implementation Plan

### Task 1: Fix import paths in server/routes/ai.ts

**Objective:** Fix the broken TypeScript build errors for TTS imports.

**Files:**
- Modify: `server/routes/ai.ts` (lines 251, 326, 438, 540, 556, 725, 876, 1009, 1395, 1519, 1673, 1674)

**Steps:**
1. Replace all `await import("./tts-service")` with `await import("../tts-service")`
2. Replace all `await import("./storage")` with `await import("../storage")`
3. Replace all `await import("./link-validator")` with `await import("../link-validator")`
4. Run `npm run check` to verify the TTS-related errors are gone
5. Commit

---

### Task 2: Rewrite server-side Qwen3-TTS to use correct Gradio API

**Objective:** Replace the single `callQwen3TTS` function with three separate functions matching the real Space endpoints, plus a unified dispatcher.

**Files:**
- Modify: `server/tts-service.ts`

**New API design:**

```
callQwenVoiceDesign(text, voiceDescription, hfToken) → Buffer | null
  POST /gradio_api/call/generate_voice_design
  data: [text, "English", voiceDescription]

callQwenVoiceClone(text, refAudioBase64, refText, hfToken) → Buffer | null
  POST /gradio_api/call/generate_voice_clone
  Step 1: upload ref_audio via /gradio_api/upload
  Step 2: POST /gradio_api/call/generate_voice_clone
  data: [uploaded_file_path, refText, text, "English", false, "1.7B"]

callQwenCustomVoice(text, speaker, styleInstruction, hfToken) → Buffer | null
  POST /gradio_api/call/generate_custom_voice
  data: [text, "English", speaker, styleInstruction || "", "1.7B"]
```

**Steps:**
1. Remove the old `callQwen3TTS` function
2. Add `callQwenVoiceDesign(text, voiceDescription, hfToken)` — uses Gradio REST: POST `/call/generate_voice_design`, then GET SSE stream for result
3. Add `callQwenVoiceClone(text, refAudioBase64, refText, hfToken)` — uploads audio via `/gradio_api/upload`, then calls `/call/generate_voice_clone`
4. Add `callQwenCustomVoice(text, speaker, styleInstruction, hfToken)` — calls `/call/generate_custom_voice`
5. Add `callQwen3TTS(text, opts)` dispatcher that routes to the right function based on `opts.mode`
6. Update `generateTTSAudio` and `callTTSDirect` to use the new dispatcher
7. Run `npm run check`
8. Commit

---

### Task 3: Update Qwen voice constants to match real speakers

**Objective:** Replace the fake voice presets with the actual Qwen3-TTS CustomVoice speakers.

**Files:**
- Modify: `client/src/lib/tts-constants.ts`

**New Qwen speakers (from the Space):**
```typescript
export const QWEN_VOICES = [
  { id: "Serena", name: "Serena", gender: "female", voiceDescription: "A warm and natural female voice." },
  { id: "Vivian", name: "Vivian", gender: "female", voiceDescription: "A clear and articulate female voice." },
  { id: "Sohee", name: "Sohee", gender: "female", voiceDescription: "A gentle and soothing female voice." },
  { id: "Ono_anna", name: "Anna", gender: "female", voiceDescription: "A professional female voice with a calm delivery." },
  { id: "Ryan", name: "Ryan", gender: "male", voiceDescription: "A confident and clear male voice." },
  { id: "Aiden", name: "Aiden", gender: "male", voiceDescription: "A friendly and approachable male voice." },
  { id: "Dylan", name: "Dylan", gender: "male", voiceDescription: "A deep and resonant male voice." },
  { id: "Eric", name: "Eric", gender: "male", voiceDescription: "A professional male voice with precise delivery." },
  { id: "Uncle_fu", name: "Uncle Fu", gender: "male", voiceDescription: "A warm and authoritative male voice." },
] as const;
```

Also add Qwen mode types:
```typescript
export type QwenMode = "custom_voice" | "voice_design" | "voice_clone";
```

**Steps:**
1. Replace `QWEN_VOICES` with the real speakers
2. Update `QWEN_DEFAULT_VOICE` to `"Ryan"`
3. Add `QwenMode` type
4. Run `npm run check`
5. Commit

---

### Task 4: Update server routes for new Qwen3-TTS modes

**Objective:** Update the `/api/tts/generate` endpoint and settings to support the three Qwen modes.

**Files:**
- Modify: `server/routes/ai.ts`
- Modify: `shared/schema.ts` (add `ttsQwenMode`, `ttsQwenStyleInstruction`, `ttsQwenVoiceDescription`, `ttsRefText` columns)

**Schema additions:**
```typescript
// On userProfiles table:
ttsQwenMode: text("tts_qwen_mode").default("custom_voice"), // "custom_voice" | "voice_design" | "voice_clone"
ttsQwenStyleInstruction: text("tts_qwen_style_instruction"), // optional style for custom_voice mode
ttsQwenVoiceDescription: text("tts_qwen_voice_description"), // for voice_design mode
ttsRefText: text("tts_ref_text"), // transcript for voice_clone mode
```

**API changes:**
- `GET /api/tts/settings` — returns `qwenMode`, `qwenStyleInstruction`, `qwenVoiceDescription`, `refText`
- `PUT /api/tts/settings` — accepts `qwenMode`, `qwenStyleInstruction`, `qwenVoiceDescription`, `refText`
- `POST /api/tts/generate` — passes Qwen mode + params to `callQwen3TTS`

**Steps:**
1. Add new columns to `userProfiles` in `shared/schema.ts`
2. Create a Drizzle migration for the new columns
3. Update `GET/PUT /api/tts/settings` to include the new fields
4. Update `POST /api/tts/generate` to pass the correct Qwen mode params
5. Run `npm run check`
6. Run migration
7. Commit

---

### Task 5: Remove client-side Qwen cloud TTS — route through server

**Objective:** Remove `fetchQwenCloudTTS` from the client hook. All Qwen3-TTS calls go through the server `/api/tts/generate` endpoint (which has the Gradio REST integration). The client only needs to handle Kokoro (local) and Browser TTS.

**Files:**
- Modify: `client/src/hooks/use-tts.tsx`

**Changes:**
1. Remove `fetchQwenCloudTTS` function entirely
2. Remove `getHFEndpoint` function
3. Remove `HF_SPACE_URL_KEY` constant
4. Remove `hfWarming` state and related toast logic
5. Update `speak()` and `speakSections()` — when `voiceTier === "cloud"`, call `fetchServerTTSAudio` / `fetchServerTTSText` (which hits `/api/tts/generate`)
6. Keep the `hfToken` in localStorage but also sync it to the server (via PUT `/api/tts/settings`) so the server can use it for Gradio API calls. Actually — the `huggingFaceToken` is already stored on `userProfiles` via the settings page. The client-side `hfToken` in localStorage is redundant. Remove it and rely on the server-stored token.
7. Update the `UseTTSReturn` interface to remove `hfToken`, `setHFToken`, `clearHFToken`, `hfWarming`

**Steps:**
1. Remove client-side HF cloud TTS functions
2. Update the cloud tier to use server TTS calls
3. Remove `hfToken` state and related refs
4. Update the interface
5. Run `npm run check`
6. Commit

---

### Task 6: Overhaul the Voice Settings UI panel

**Objective:** Redesign the settings popover to clearly present the three engines and their sub-modes.

**Files:**
- Modify: `client/src/components/tts-button.tsx`

**New UI structure:**
```
Voice Settings
├── Kokoro (Local · offline)
│   └── Voice grid: Bella, Sky, Heart, Michael, George, Adam
├── Qwen Cloud (HF ZeroGPU · requires token)
│   ├── Mode tabs: Preset Speakers | Voice Design | Voice Clone
│   ├── Preset Speakers:
│   │   ├── Speaker grid: Serena, Vivian, Ryan, Aiden, etc.
│   │   └── Style instruction textarea (optional)
│   ├── Voice Design:
│   │   └── Voice description textarea (e.g. "calm female narrator with soft accent")
│   └── Voice Clone:
│       ├── Audio upload dropzone
│       └── Reference text input (transcript of the audio)
├── Browser TTS (Device speech engine)
└── Speed slider
```

**Steps:**
1. Update imports to use new constants
2. Redesign the Qwen sub-section with three mode tabs
3. Add style instruction textarea for Custom Voice mode
4. Add voice description textarea for Voice Design mode
5. Add reference text input for Voice Clone mode
6. Update the voice upload handler to also save reference text
7. Remove HF token UI from the TTS button (it's already in Settings page)
8. Run `npm run check`
9. Commit

---

### Task 7: Fix Kokoro worker resilience

**Objective:** Add better error handling for the SharedWorker construction and improve the fallback to DedicatedWorker.

**Files:**
- Modify: `client/src/hooks/use-tts.tsx`
- Modify: `client/src/workers/tts.worker.ts`

**Changes:**
1. In `getWorker()`, wrap SharedWorker construction in try/catch (already done) but also handle the case where the SharedWorker constructor succeeds but the port never connects (add a connection timeout)
2. Add a `workerError` event handler that logs the actual error details (currently just clears state)
3. In the worker, add a top-level error handler that posts an error message back to the main thread before dying
4. Add a `workerRetryCount` ref — if the worker crashes, retry once with a DedicatedWorker before giving up
5. If Kokoro is truly incompatible (no WebGPU + no WASM support), set `kokoroIncompatible` proactively and skip the worker entirely

**Steps:**
1. Add top-level `error` event listener in the worker
2. Add connection timeout in `getWorker()`
3. Add retry logic for worker crashes
4. Run `npm run check`
5. Commit

---

### Task 8: Update settings page for HF token and Qwen modes

**Objective:** Ensure the Settings page properly manages the HF token and new Qwen mode settings.

**Files:**
- Modify: `client/src/pages/settings.tsx`

**Changes:**
1. The `huggingFaceToken` field should be clearly labeled as "Hugging Face Token (for Qwen Cloud TTS)"
2. Add UI for Qwen mode selection (Preset Speakers / Voice Design / Voice Clone)
3. Add style instruction and voice description fields
4. Add reference text field for voice cloning

**Steps:**
1. Update the settings form to include Qwen mode fields
2. Ensure the PUT /api/tts/settings call includes all new fields
3. Run `npm run check`
4. Commit

---

### Task 9: Fix pre-existing TS errors (non-TTS)

**Objective:** Fix the other TypeScript errors that existed before this work.

**Files:**
- Modify: `client/src/components/skill-tree.tsx:295`
- Modify: `client/src/components/srs-widget.tsx:26,40,42,43,60,74`
- Modify: `client/src/pages/pathway-detail.tsx:211`
- Modify: `server/populateLessonUnits.ts:2`
- Modify: `server/replit_integrations/batch/utils.ts:110,159`
- Modify: `server/replit_integrations/image/client.ts:23,50`
- Modify: `server/replit_integrations/image/routes.ts:20`

**Steps:**
1. Fix each TS error
2. Run `npm run check` — should be clean
3. Commit

---

### Task 10: End-to-end verification

**Objective:** Verify the full TTS system works.

**Steps:**
1. Run `npm run check` — no errors
2. Run `npm run build` — builds successfully
3. Start the dev server
4. Navigate to a lesson page
5. Test Browser TTS — should work on any device
6. Test Kokoro — should download model and play (on WebGPU devices)
7. Test Qwen Custom Voice — select a preset speaker, enter text, play
8. Test Qwen Voice Design — enter a voice description, play
9. Test Qwen Voice Clone — upload audio, enter transcript, play
10. Test fallback chain — if Kokoro fails, should fall to Qwen, then Browser
11. Commit final fixes

---

## Risks & Tradeoffs

1. **ZeroGPU cold start** — Qwen3-TTS on ZeroGPU has a ~15-20s cold start. The UI already handles this with a toast, but we should make sure the server doesn't timeout. The Gradio SSE stream has a 45s timeout which should be enough.

2. **Gradio API stability** — The Gradio REST API on HF Spaces can change. We should make the endpoint names configurable via env vars (already done with `QWEN_TTS_SPACE_HOST`).

3. **Audio upload for voice cloning** — The Gradio upload endpoint requires the audio to be sent as multipart/form-data. The current `/api/tts/voice-upload` endpoint stores base64 in the DB. We need to convert this to a file upload to the Gradio Space at TTS generation time.

4. **Token management** — The HF token is stored on the user profile in the DB (encrypted at rest would be ideal but not currently implemented). We should NOT store it in localStorage on the client.

5. **Migration** — Adding new columns to `userProfiles` requires a DB migration. The app uses Drizzle, so we need to generate and run a migration.
