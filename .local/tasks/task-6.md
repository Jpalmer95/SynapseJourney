---
title: Audio player redesign & paragraph listening
---
# Audio Player Redesign & Paragraph Listening

## What & Why
Three related improvements to the listen/audio experience:

1. **Fix silent playback** — `playServerAudio` converts audio to a base64 data URI which iOS
   Safari silently drops when the payload exceeds ~2MB (typical for a full lesson). The fix is
   to decode the base64 string into a `Blob` and use `URL.createObjectURL()` instead of a data
   URI. Also ensure the `onerror` handler properly exits the `isSpeaking` state so the button
   does not stay stuck in "playing" on failure.

2. **Redesign audio controls** — The current layout (play/pause + a `VolumeX` icon + gear) is
   confusing: `VolumeX` looks like a mute control but is actually stop. Replace `VolumeX` with a
   `Square` icon for stop. Add a compact persistent audio bar that appears below the lesson header
   while audio is active, showing the current section name, a progress bar, and clear pause/stop
   controls so users always know what is happening.

3. **Paragraph / section listening** — Users want to click any section of the lesson to start
   listening from that point. Each named section (Concept, Analogy, Example, etc.) gets a subtle
   "play from here" icon that appears on hover. The currently-reading section is highlighted with
   a left accent border. For server TTS: sections are spoken sequentially (one small API call each)
   starting from the chosen section. For browser TTS: existing chunk flow is adapted per section.

## Done looks like
- AI voice audio actually plays on iOS Safari (no more silent "generating → stuck-playing" state)
- Errors during audio playback surface a short inline message and reset the button to idle
- The stop button uses a `Square` icon — clearly distinct from pause and mute
- While listening, an audio bar appears inside the lesson view showing: section label, progress
  dots or a bar, pause/resume, and stop — users always know where they are in the content
- Hovering any lesson section (Concept, Analogy, Example block, etc.) reveals a small ▶ icon;
  clicking it starts listening from that section
- The currently-reading section has a visible left-border highlight that advances as playback
  progresses through sections
- All existing behavior (voice presets, speed control, caching) continues to work

## Out of scope
- Full waveform / scrub-bar seeking within a section (sections are discrete units, not seekable)
- Push-to-talk or real-time transcription
- Paragraph-level progress for the "cached full-audio" fast path (cached audio plays as one blob;
  section tracking only applies to the sequential-section path)

## Tasks

1. **Fix `playServerAudio` to use Blob URLs** — Replace the base64 → data URI conversion with
   a base64 → `Uint8Array` → `Blob` → `URL.createObjectURL()` flow. Call `URL.revokeObjectURL()`
   when playback ends or errors. Ensure `onerror` always exits `isSpeaking` and surfaces the error.

2. **Add section-aware speak path to `useTTS`** — Extend the hook with a `speakSections` function
   that accepts `{ label: string; text: string }[]` and an optional `startIndex`. For server TTS,
   call `/api/tts/generate` with raw text for each section sequentially. Track `currentSectionIndex`
   in state and expose it in the hook's return value. Keep the existing `speak(text)` path intact
   for the cached-full-audio case and for browser TTS fallback.

3. **Redesign `TTSButton` audio controls** — Change the stop icon from `VolumeX` to `Square`.
   Replace the three-button strip with a compact audio bar component (rendered inline inside the
   lesson, not as a floating overlay): section label, a row of progress dots (one per section,
   filled up to current), pause/resume button, stop button. The gear/settings popover stays as-is
   but moves into the audio bar when active. Show an inline error badge if playback fails.

4. **Add per-section play buttons in `rabbit-hole.tsx`** — Decompose the lesson text into a
   `sections` array passed to `speakSections`. Wrap each rendered content block (Concept, Analogy,
   Example, etc.) in a container that shows a `▶` icon on hover, styled as a ghost icon button at
   the left edge. The currently-active section (`currentSectionIndex`) gets a colored left-border
   accent. Wire the "Listen" button at the top to call `speakSections` from index 0.

## Relevant files
- `client/src/hooks/use-tts.ts`
- `client/src/components/tts-button.tsx`
- `client/src/components/rabbit-hole.tsx`
- `client/src/lib/tts-constants.ts`