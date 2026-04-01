export type VoiceTier = "local" | "cloud" | "server";

export const KOKORO_VOICES = [
  { id: "af_bella", name: "Bella", gender: "female", style: "Warm & friendly" },
  { id: "af_sky", name: "Sky", gender: "female", style: "Bright & clear" },
  { id: "af_heart", name: "Heart", gender: "female", style: "Calm & soothing" },
  { id: "am_michael", name: "Michael", gender: "male", style: "Professional" },
  { id: "bm_george", name: "George", gender: "male", style: "Authoritative" },
  { id: "am_adam", name: "Adam", gender: "male", style: "Thoughtful" },
] as const;

export const QWEN_VOICES = [
  { id: "aria", name: "Aria", gender: "female", color: "text-pink-500 dark:text-pink-400", voiceDescription: "A warm, friendly female educator with a clear and welcoming voice." },
  { id: "nova", name: "Nova", gender: "female", color: "text-violet-500 dark:text-violet-400", voiceDescription: "An energetic and enthusiastic female voice, great for science and technology topics." },
  { id: "lyra", name: "Lyra", gender: "female", color: "text-blue-500 dark:text-blue-400", voiceDescription: "A calm and soothing female voice, perfect for focused studying and meditation." },
  { id: "echo", name: "Echo", gender: "male", color: "text-green-600 dark:text-green-400", voiceDescription: "A clear, confident male narrator with a professional and precise delivery." },
  { id: "sage", name: "Sage", gender: "male", color: "text-amber-600 dark:text-amber-400", voiceDescription: "A deep and authoritative male voice, ideal for advanced academic content." },
  { id: "orion", name: "Orion", gender: "male", color: "text-cyan-600 dark:text-cyan-400", voiceDescription: "A thoughtful and measured male voice, great for philosophy and reflective content." },
] as const;

export const KOKORO_DEFAULT_VOICE = "af_bella";
export const QWEN_DEFAULT_VOICE = "aria";

export type EnginePreset = "kokoro" | "browser" | "qwen" | "custom";

export function getVoiceTier(presetId: EnginePreset | string): VoiceTier {
  if (presetId === "kokoro") return "local";
  if (presetId === "browser") return "server";
  if (presetId === "qwen" || presetId === "custom") return "cloud";
  return "server";
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
