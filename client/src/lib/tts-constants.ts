export type VoiceTier = "local" | "cloud" | "server";

export const KOKORO_VOICES = [
  { id: "af_bella", name: "Bella", gender: "female", style: "Warm & friendly" },
  { id: "af_sky", name: "Sky", gender: "female", style: "Bright & clear" },
  { id: "af_heart", name: "Heart", gender: "female", style: "Calm & soothing" },
  { id: "am_michael", name: "Michael", gender: "male", style: "Professional" },
  { id: "bm_george", name: "George", gender: "male", style: "Authoritative" },
  { id: "am_adam", name: "Adam", gender: "male", style: "Thoughtful" },
] as const;

/**
 * Qwen3-TTS preset speakers (from the official HF Space).
 * These are the real speaker IDs accepted by the generate_custom_voice endpoint.
 * https://huggingface.co/spaces/Qwen/Qwen3-TTS
 */
export const QWEN_VOICES = [
  { id: "Serena", name: "Serena", gender: "female", color: "text-pink-500 dark:text-pink-400", voiceDescription: "A warm and natural female voice, great for educational content." },
  { id: "Vivian", name: "Vivian", gender: "female", color: "text-violet-500 dark:text-violet-400", voiceDescription: "A clear and articulate female voice, ideal for science topics." },
  { id: "Sohee", name: "Sohee", gender: "female", color: "text-blue-500 dark:text-blue-400", voiceDescription: "A gentle and soothing female voice, perfect for focused studying." },
  { id: "Ono_anna", name: "Anna", gender: "female", color: "text-cyan-500 dark:text-cyan-400", voiceDescription: "A professional female voice with a calm, measured delivery." },
  { id: "Ryan", name: "Ryan", gender: "male", color: "text-green-600 dark:text-green-400", voiceDescription: "A confident and clear male voice with professional delivery." },
  { id: "Aiden", name: "Aiden", gender: "male", color: "text-amber-600 dark:text-amber-400", voiceDescription: "A friendly and approachable male voice, great for beginners." },
  { id: "Dylan", name: "Dylan", gender: "male", color: "text-cyan-600 dark:text-cyan-400", voiceDescription: "A deep and resonant male voice, ideal for advanced content." },
  { id: "Eric", name: "Eric", gender: "male", color: "text-orange-600 dark:text-orange-400", voiceDescription: "A professional male voice with precise, authoritative delivery." },
  { id: "Uncle_fu", name: "Uncle Fu", gender: "male", color: "text-stone-600 dark:text-stone-400", voiceDescription: "A warm and authoritative male voice, great for philosophy." },
] as const;

export const KOKORO_DEFAULT_VOICE = "af_bella";
export const QWEN_DEFAULT_VOICE = "Ryan";

export type EnginePreset = "kokoro" | "browser" | "qwen" | "custom";

/**
 * Qwen3-TTS synthesis modes.
 * - custom_voice: preset speakers with optional style instructions
 * - voice_design: text-described custom voice (e.g. "calm female narrator with soft accent")
 * - voice_clone: clone a voice from a reference audio sample + transcript
 */
export type QwenMode = "custom_voice" | "voice_design" | "voice_clone";

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
