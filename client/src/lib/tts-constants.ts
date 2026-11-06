export type VoiceTier = "local" | "cloud" | "server";

/**
 * All 54 Kokoro-82M voice packs (authoritative list from hexgrad/Kokoro-82M).
 * Metadata is derived from the voice id: the 2nd char is gender (f/m) and the
 * 1st char is the language/accent.
 */
const KOKORO_LANGUAGE: Record<string, string> = {
  a: "American English",
  b: "British English",
  e: "English",
  f: "French",
  h: "Hindi",
  i: "Italian",
  j: "Japanese",
  p: "Portuguese",
  z: "Mandarin",
};

const KOKORO_IDS = [
  // Top-graded American & British English voices first
  "af_heart", "af_bella", "af_nicole", "af_kore", "af_sarah", "af_aoede",
  "af_nova", "af_alloy", "af_sky", "af_jessica", "af_river",
  "am_michael", "am_fenrir", "am_puck", "am_echo", "am_eric", "am_liam",
  "am_onyx", "am_adam", "am_santa",
  "bf_emma", "bf_isabella", "bf_alice", "bf_lily",
  "bm_george", "bm_fable", "bm_lewis", "bm_daniel",
  // Additional international voices
  "ef_dora", "em_alex", "em_santa",
  "ff_siwis",
  "hf_alpha", "hf_beta", "hm_omega", "hm_psi",
  "if_sara", "im_nicola",
  "jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo",
  "pf_dora", "pm_alex", "pm_santa",
  "zf_xiaobei", "zf_xiaoni", "zf_xiaoxiao", "zf_xiaoyi",
  "zm_yunjian", "zm_yunxi", "zm_yunxia", "zm_yunyang",
];

export const KOKORO_VOICES = KOKORO_IDS.map((id) => {
  const gender = id.charAt(1) === "f" ? "female" : "male";
  const langCode = id.charAt(0);
  const style = KOKORO_LANGUAGE[langCode] ?? "English";
  const raw = id.split("_")[1];
  const name = raw.charAt(0).toUpperCase() + raw.slice(1);
  const isEnglish = langCode === "a" || langCode === "b" || langCode === "e";
  return { id, name, gender, style, isEnglish };
});

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
 * Clean markdown & LaTeX syntax from lesson prose so TTS engines (Kokoro, Browser, Qwen)
 * speak natural words instead of reading raw punctuation ("hash hash", "asterisk", "backslash frac").
 */
export function cleanTextForTTS(raw: string): string {
  if (!raw) return "";
  let s = raw;

  // Replace fenced code blocks with a brief spoken cue
  s = s.replace(/```[\s\S]*?```/g, " See the code example in the lesson. ");

  // Convert display math $$...$$ and inline math $...$ into readable text
  const cleanLatex = (math: string): string => {
    return math
      .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1 over $2")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, "square root of $1")
      .replace(/\\(?:mathbf|mathrm|mathit|mathcal|text|operatorname)\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\Delta\b/g, "delta ")
      .replace(/\\delta\b/g, "delta ")
      .replace(/\\alpha\b/g, "alpha ")
      .replace(/\\beta\b/g, "beta ")
      .replace(/\\gamma\b/g, "gamma ")
      .replace(/\\theta\b/g, "theta ")
      .replace(/\\lambda\b/g, "lambda ")
      .replace(/\\sigma\b/g, "sigma ")
      .replace(/\\omega\b/g, "omega ")
      .replace(/\\Omega\b/g, "omega ")
      .replace(/\\pi\b/g, "pi ")
      .replace(/\\mu\b/g, "mu ")
      .replace(/\\tau\b/g, "tau ")
      .replace(/\\rho\b/g, "rho ")
      .replace(/\\phi\b/g, "phi ")
      .replace(/\\epsilon\b/g, "epsilon ")
      .replace(/\\infty\b/g, "infinity ")
      .replace(/\\approx\b/g, " approximately equals ")
      .replace(/\\neq\b/g, " is not equal to ")
      .replace(/\\leq\b/g, " is less than or equal to ")
      .replace(/\\geq\b/g, " is greater than or equal to ")
      .replace(/\\(?:times|cdot)\b/g, " times ")
      .replace(/\\(?:rightarrow|to|implies)\b/g, " leads to ")
      .replace(/\\sum\b/g, " sum ")
      .replace(/\\int\b/g, " integral ")
      .replace(/\\[a-zA-Z]+/g, " ")
      .replace(/[{}^_]/g, " ")
      .replace(/=/g, " equals ")
      .replace(/\s+/g, " ")
      .trim();
  };

  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner) => ` ${cleanLatex(inner)}. `);
  s = s.replace(/\$([^$\n]+)\$/g, (_m, inner) => ` ${cleanLatex(inner)} `);

  // Strip markdown links [label](url) -> label, and bare URLs
  s = s.replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]+\)/g, "$1");
  s = s.replace(/https?:\/\/\S+/g, "");

  // Convert markdown headings and list items into clean sentence breaks
  s = s.replace(/^[ \t]*#{1,6}[ \t]+(.+)$/gm, "$1.");
  s = s.replace(/^[ \t]*[-*+][ \t]+/gm, "");
  s = s.replace(/^[ \t]*\d+[.)][ \t]+/gm, "");
  s = s.replace(/^[ \t]*>[ \t]*/gm, "");
  s = s.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, " ");

  // Strip inline formatting (**bold**, *italic*, `code`, ~~strike~~)
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/~~([^~]+)~~/g, "$1");

  // Ensure paragraph/line breaks become sentence pauses if not already punctuated
  s = s
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (/[.!?;:]$/.test(line) ? line : `${line}.`))
    .join(" ");

  return s.replace(/\s{2,}/g, " ").trim();
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
