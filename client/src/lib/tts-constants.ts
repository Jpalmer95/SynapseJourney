export type VoiceTier = "local" | "cloud" | "browser";

export const AI_VOICE_PRESETS = [
  { id: "aria", name: "Aria", description: "Warm educator", gender: "female", color: "text-pink-500 dark:text-pink-400", voiceTier: "local" as VoiceTier },
  { id: "nova", name: "Nova", description: "Energetic", gender: "female", color: "text-violet-500 dark:text-violet-400", voiceTier: "local" as VoiceTier },
  { id: "lyra", name: "Lyra", description: "Calm & soothing", gender: "female", color: "text-blue-500 dark:text-blue-400", voiceTier: "local" as VoiceTier },
  { id: "echo", name: "Echo", description: "Professional", gender: "male", color: "text-green-600 dark:text-green-400", voiceTier: "local" as VoiceTier },
  { id: "sage", name: "Sage", description: "Authoritative", gender: "male", color: "text-amber-600 dark:text-amber-400", voiceTier: "local" as VoiceTier },
  { id: "orion", name: "Orion", description: "Thoughtful", gender: "male", color: "text-cyan-600 dark:text-cyan-400", voiceTier: "local" as VoiceTier },
] as const;

export type VoicePresetId = typeof AI_VOICE_PRESETS[number]["id"];

export const KOKORO_VOICE_MAP: Record<string, string> = {
  aria: "af_bella",
  nova: "af_sky",
  lyra: "af_heart",
  echo: "am_michael",
  sage: "bm_george",
  orion: "am_adam",
};

export function getVoiceTier(presetId: string): VoiceTier {
  if (presetId === "browser") return "browser";
  if (presetId === "custom") return "cloud";
  const preset = AI_VOICE_PRESETS.find(p => p.id === presetId);
  return preset?.voiceTier ?? "local";
}

/**
 * Split lesson text into intro (first paragraph / ~500 chars) and rest.
 * Used to start playback immediately while full audio generates in background.
 */
export function splitIntroRest(text: string): { intro: string; rest: string } {
  if (!text || text.length <= 500) return { intro: text, rest: "" };

  const newlineSplit = text.indexOf("\n\n");
  if (newlineSplit > 0 && newlineSplit <= 700) {
    return { intro: text.slice(0, newlineSplit).trim(), rest: text.slice(newlineSplit).trim() };
  }

  const sentenceEnd = text.slice(300, 700).search(/[.!?]\s/);
  if (sentenceEnd >= 0) {
    const cutAt = 300 + sentenceEnd + 1;
    return { intro: text.slice(0, cutAt).trim(), rest: text.slice(cutAt).trim() };
  }

  return { intro: text.slice(0, 500).trim(), rest: text.slice(500).trim() };
}
