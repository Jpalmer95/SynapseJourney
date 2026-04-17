---
title: TTS UX Quick Wins
---
# TTS UX Quick Wins

## What & Why
Two small polish items that improve first-time experience for the two trickiest TTS engines:
1. Kokoro's first-listen download can take 30–90 seconds with no clear explanation — users just see a generic spinner and may think the app is broken.
2. Qwen's HF token prompt is functional but doesn't clarify that a free HF account works or explain exactly where to get the token.

## Done looks like
- When Kokoro is selected and `kokoroLoading` is true (model initializing), the section audio bar and/or a toast shows "Downloading AI model... this only happens once" instead of the generic "Generating audio…"
- The Kokoro settings status text (already shown in popover) is also reflected inline near the Listen button area so users see it without opening settings
- In the Qwen settings sub-section, the "Add HF token" prompt includes a short sentence: "A free Hugging Face account is all you need." and the link text is clearer, pointing directly to huggingface.co/settings/tokens with a note about using a read token

## Out of scope
- Any changes to how Kokoro loads or how the HF token is stored/used
- Changes to Qwen's fallback behavior when no token is present
- Any UI work outside tts-button.tsx and use-tts.tsx

## Tasks
1. **Kokoro loading message** — When `kokoroLoading` is true and Kokoro is the active engine, show a contextual message ("Downloading AI model — first time only, ~90 MB") in the section audio bar and/or as a toast fired once when loading begins. Reuse the existing `kokoroLoading` and `kokoroReady` states from the TTS hook.

2. **Qwen HF token onboarding copy** — Update the HF token missing state in the Qwen sub-section to explain that a free HF account is sufficient, and update the link/button text to say "Get a free token at huggingface.co/settings/tokens" with a direct anchor link.

## Relevant files
- `client/src/components/tts-button.tsx:77-100`
- `client/src/components/tts-button.tsx:495-550`
- `client/src/components/tts-button.tsx:615-640`
- `client/src/hooks/use-tts.tsx`