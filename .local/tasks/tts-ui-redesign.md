# TTS Settings Panel Redesign

## What & Why
Redesign the TTS settings popover in `tts-button.tsx` to clearly surface the two new engine tiers introduced in the engine overhaul task:

- **Standard Voices** (Kokoro local): instant, offline-capable, zero cost — badged with a Lightning / Offline icon
- **Cloud Voices** (Qwen ZeroGPU via HF): high-quality AI preset voices and voice cloning — badged with a Cloud / Pro icon

The current 3-tab layout (AI Voices / Browser / Clone) is replaced with a 2-section layout that maps to the new architecture. Browser TTS is demoted to a fallback and no longer prominently offered as a first-class choice. A HF Access Token input is added to the Cloud section so users can authenticate without leaving the app.

## Done looks like
- Settings popover shows two clearly labelled sections: "Standard" (local Kokoro voices) and "Cloud" (Qwen/HF voices)
- Standard voices display a "⚡ Offline" badge; cloud voices display a "☁ Pro" badge
- Selecting any standard voice immediately triggers Kokoro model initialisation (no server call)
- The Cloud section shows a token input field; if no token is set, a subtle "Add HF token to use cloud voices" prompt is shown
- When a cloud voice is selected and the ZeroGPU Space is cold, a "Warming up engine…" toast appears (can take up to 20 s)
- Voice cloning (audio file upload) stays in the Cloud section
- Speed slider and browser fallback option remain accessible but are moved to a collapsed "Advanced" row
- The main Listen button tooltip and badge accurately reflect whether the active voice is Local or Cloud

## Out of scope
- Any changes to the hook logic, Web Worker, or server TTS paths (all in the engine task)
- HF OAuth login (token paste-in only)
- Redesigning the audio progress bar or per-section playback controls

## Tasks
1. **Redesign settings popover structure** — Replace the 3-tab layout with a 2-section scrollable list (Standard Voices → Cloud Voices). Read `voiceTier` from `tts-constants.ts` to group presets automatically. The section headers should be visually distinct but not heavy — a small label with an icon is sufficient.

2. **Add voice tier badges** — Each preset card shows either a "⚡ Offline" badge (local) or a "☁ Pro" badge (cloud). The active preset's card is highlighted with a primary-colour border as before.

3. **HF token input in Cloud section** — Add a small collapsible input at the bottom of the Cloud section for users to paste their HF Access Token. On save, call `setHFToken(token)` from the hook. Show a green tick when a token is already stored, and a subtle prompt when none exists. Include a link to https://huggingface.co/settings/tokens that opens in a new tab.

4. **Cold-start toast for ZeroGPU** — In `tts-button.tsx`, intercept the cloud TTS loading state. When `isLoading` is true and the active preset is a cloud voice, show a toast after 3 seconds saying "Warming up cloud engine… this may take up to 20 s". Dismiss the toast once audio starts playing.

5. **Update Listen button badge and tooltip** — Show "Local" or "Cloud" badge next to the Listen button label depending on the active preset tier. Update the tooltip to reflect the active engine (e.g. "Read aloud · Kokoro local" vs "Read aloud · Qwen cloud").

6. **Demote browser fallback to Advanced** — Move "Browser TTS" into a collapsed "Advanced" disclosure row at the bottom of the popover, keeping it accessible but not prominent.

## Relevant files
- `client/src/components/tts-button.tsx`
- `client/src/lib/tts-constants.ts`
- `client/src/hooks/use-tts.tsx`
