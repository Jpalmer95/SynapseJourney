# Plan: Port the pagevoice reader UX into Synapse TTS

Status: **PROPOSAL — awaiting review before implementation.**
Branch: `feature/pagevoice-reader-port`
Related: `references/tts-architecture.md`, `docs/tts-audit-2026-08-06.md`
Source of the UX: the standalone `pagevoice` project (Brave extension + local GPU server).

## 1. Objective

Bring the polish and fluidity of the pagevoice reader into the in-app Synapse
read-aloud experience — per-paragraph navigation, click-to-start, pitch-preserved
speed, instant replay, and a clean floating reader — while keeping Synapse's
existing multi-user TTS backends.

## 2. Key architectural decision (why NOT "the same way as the extension")

pagevoice = a local FastAPI server (Kokoro + Qwen3 on the author's RTX 4070 Ti) +
a browser extension. That model **does not port to a hosted, multi-user platform**:

- Synapse runs on a droplet with **no GPU**, and a local server only serves the
  machine it runs on. Other students on synapsejourney.org don't have that GPU.
- Synapse already has the correct multi-user synthesis tiering:
  1. **Kokoro in-browser via WebGPU** (ONNX through `@huggingface/transformers`) —
     runs on the *end user's* GPU, free, no server. (Equivalent to pagevoice's
     "fast default" tier, but per-user rather than a shared box.)
  2. **Qwen3-TTS via the HF Gradio Space** (cloud ZeroGPU) — presets, voice design,
     voice cloning.
  3. **Browser TTS** (Web Speech API) fallback.

**Decision: keep the synthesis backends; port the reader UX on top of them.**

## 3. What already exists (do not reinvent)

- `client/src/hooks/use-tts.tsx` — engine orchestration, WebWorker Kokoro,
  sentence-level chunking with gapless pipelining, Web Audio playback.
- `client/src/components/tts-mini-player.tsx` — sticky mini-player under TTSProvider.
- `client/src/components/tts-button.tsx` — settings popover (engine rows + Qwen modes).
- `client/src/workers/tts.worker.ts` — Kokoro-82M ONNX in SharedWorker (WebGPU/WASM).
- `client/src/lib/tts-constants.ts` — voice lists (`QWEN_VOICES`, Kokoro list).
- `server/tts-service.ts` — server-side Qwen3 Gradio routing.
- DB: `user_profiles` TTS columns (preset, speed, reference audio, qwen modes).

## 4. The pagevoice UX delta to port

| pagevoice feature | Synapse today | Action |
|---|---|---|
| Per-paragraph click-to-start | lesson-level / section-level only | add block-level reading with highlight + auto-scroll |
| Pitch-preserved 0.5–3× speed slider | playback_speed (likely whole-audio rate) | port `preservesPitch` / playbackRate approach |
| LRU audio cache (instant replay) | none | add cache keyed by `voice\|blockId`, byte-capped LRU |
| Lookahead prefetch (gapless) | sentence-level pipelining exists | extend to block-level lookahead + cache fill |
| Prev / next / stop + keyboard shortcuts | partial | port controls + `Space`/`[`/`]`/`+`/`-`/`Esc` |
| Grouped voice-picker dropdown | popover engine rows | align Kokoro list to the corrected 54 names |

### Concrete cross-cutting fixes to carry over from pagevoice
- **Kokoro voice list correctness**: pagevoice's hardcoded list had invalid names
  (`af_sadie`, `af_dora`, `af_lily`, `am_patrik` → 404 → error). Verify
  `tts-constants.ts` Kokoro list against the authoritative 54 packs in
  `hexgrad/Kokoro-82M` and correct any fictional entries.
- **Graceful synthesis errors**: surface a readable message instead of a raw 500.

## 5. Implementation plan (phased, each independently shippable)

### Phase 1 — Reader UX on existing backends (the "polish")
1. `client/src/lib/tts-cache.ts` (new) — port pagevoice's LRU cache: `Map<voice|blockId, ArrayBuffer>`, byte cap (~40 MB), `inFlight` dedupe map, touch-on-get.
2. `client/src/hooks/use-tts.tsx` — add: block/paragraph model (chunk content into blocks), `readBlock(i)`, `prefetchAhead(depth)`, `jumpTo(i)`, cache integration, pitch-preserved speed (`playbackRate` + `preservesPitch` for HTMLAudio; `AudioBufferSourceNode.playbackRate` for Kokoro Web Audio).
3. `client/src/components/tts-mini-player.tsx` — upgrade to a floating reader: play/pause/stop/prev/next, speed slider (0.5–3×), grouped voice dropdown, keyboard shortcuts, status line. Reuse Synapse's charcoal/blue theme.
4. Lesson content view — make each paragraph/block clickable to start reading there; highlight the active block + scroll it into view.
5. `client/src/lib/tts-constants.ts` — correct the Kokoro voice list (54 names).

### Phase 2 — BYOC "local pagevoice server" backend (optional, fits BYOC philosophy)
1. Settings: new `ttsVoicePreset = "local"` + `local_tts_server_url` field.
2. Client: when `local`, route `/synthesize` + `/voices` to the user-supplied URL
   (same contract as pagevoice's server — `GET /voices`, `POST /synthesize`).
3. Enables local custom-voice cloning/design on a GPU-owner's own box (author's 4070 Ti).
4. Server: no droplet changes; the local server is self-hosted per user.

## 6. Acceptance criteria

- Clicking any lesson paragraph starts reading there; active paragraph is highlighted and auto-scrolls.
- Speed 0.5–3× is pitch-preserved and continuous (no chipmunk).
- Re-reading an already-heard block is instant (cache hit); continuous reading has no inter-block gap (prefetch).
- Voice picker shows all 54 Kokoro voices (all working), Qwen3 speakers, and any custom voices.
- Keyboard shortcuts work: `Space` play/pause, `[`/`]` prev/next, `+`/`-` speed, `Esc` close.
- No regression to existing Qwen3 voice design/clone or BYOC generation paths.

## 7. Open questions for review

1. **Phase 2 (BYOC local server) in or out?** In keeps your 4070 Ti usable for custom
   voice cloning inside Synapse; out keeps scope minimal.
2. **Reader placement**: floating overlay (like pagevoice) vs. expanding the existing
   sticky mini-player in place?
3. **Default voice**: keep "browser" default, or switch the fast-default to Kokoro WebGPU?

## 8. Workflow

Per repo convention: this branch → `tsc --noEmit` → `npm run build` → PR → merge to `main`
→ deploy (`git pull`, migrate if needed, `npm run build`, `docker restart synapsejourney`).
