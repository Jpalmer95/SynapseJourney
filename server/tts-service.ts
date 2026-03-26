import { createHash } from "crypto";
import { db } from "./db";
import { ttsAudioCache } from "@shared/schema";
import { and, eq } from "drizzle-orm";

export interface VoicePreset {
  id: string;
  name: string;
  description: string;
  gender: "female" | "male" | "neutral";
  style: string;
}

export const VOICE_PRESETS: VoicePreset[] = [
  { id: "aria", name: "Aria", description: "Warm, friendly educator — clear and welcoming", gender: "female", style: "friendly" },
  { id: "nova", name: "Nova", description: "Energetic and enthusiastic — great for science topics", gender: "female", style: "energetic" },
  { id: "lyra", name: "Lyra", description: "Calm and soothing — perfect for focused studying", gender: "female", style: "calm" },
  { id: "echo", name: "Echo", description: "Clear, confident narrator — professional and precise", gender: "male", style: "professional" },
  { id: "sage", name: "Sage", description: "Deep and authoritative — ideal for advanced content", gender: "male", style: "authoritative" },
  { id: "orion", name: "Orion", description: "Thoughtful and measured — great for philosophy and theory", gender: "male", style: "thoughtful" },
];

export function getVoicePreset(id: string): VoicePreset | undefined {
  return VOICE_PRESETS.find(v => v.id === id);
}

export function hashVoiceConfig(preset: string, referenceAudioHash?: string): string {
  const input = `${preset}:${referenceAudioHash || ""}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export function hashBase64(data: string): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

async function getCachedAudio(unitId: number, voiceConfigHash: string): Promise<{ audioData: string; audioFormat: string } | null> {
  const [cached] = await db.select()
    .from(ttsAudioCache)
    .where(and(eq(ttsAudioCache.unitId, unitId), eq(ttsAudioCache.voiceConfigHash, voiceConfigHash)));
  if (!cached) return null;
  return { audioData: cached.audioData, audioFormat: cached.audioFormat || "wav" };
}

async function saveCachedAudio(unitId: number, voiceConfigHash: string, audioData: string, audioFormat: string): Promise<void> {
  await db.insert(ttsAudioCache).values({ unitId, voiceConfigHash, audioData, audioFormat })
    .onConflictDoNothing();
}

function buildLessonText(content: any, isNextGen: boolean): string {
  if (!content) return "";
  const parts: string[] = [];
  if (isNextGen) {
    if (content.researchContext) parts.push(content.researchContext);
    if (content.industryChallenge?.title) parts.push(`Industry Challenge: ${content.industryChallenge.title}. ${content.industryChallenge.description || ""}`);
    if (content.thoughtExercises?.length > 0) {
      parts.push(`Thought Exercise: ${content.thoughtExercises[0].prompt}`);
    }
  } else {
    if (content.concept) parts.push(content.concept);
    if (content.analogy) parts.push(`Think of it this way: ${content.analogy}`);
    if (content.example?.title && content.example?.content) {
      parts.push(`Example: ${content.example.title}. ${content.example.content}`);
    }
    if (content.keyTakeaways?.length > 0) {
      parts.push(`Key takeaways: ${content.keyTakeaways.join(". ")}`);
    }
  }
  return parts.join(" ").replace(/\n+/g, " ").trim();
}

async function callQwen3TTS(text: string, voicePresetId: string, referenceAudio?: string): Promise<Buffer | null> {
  // Wrap with a hard timeout so a slow Gradio connection never hangs the server
  const TIMEOUT_MS = 25000;
  const raceTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  const attempt = (async () => {
    try {
      const { Client } = await import("@gradio/client");
      // Connect anonymously — no auth token needed for public ZeroGPU spaces
      const client = await (Client as any).connect("Qwen/Qwen3-TTS");

      const voicePreset = getVoicePreset(voicePresetId);
      const promptText = voicePreset
        ? `[${voicePreset.style}] ${text}`
        : text;

      let referenceBlob: Blob | undefined;
      if (referenceAudio) {
        const audioBuffer = Buffer.from(referenceAudio, "base64");
        referenceBlob = new Blob([audioBuffer], { type: "audio/wav" });
      }

      const inputArgs: unknown[] = [promptText];
      if (referenceBlob) inputArgs.push(referenceBlob);

      const result = await client.predict("/synthesize", inputArgs) as { data: unknown[] };

      const audioOutput = result?.data?.[0] as { url?: string } | Blob | null | undefined;
      if (audioOutput) {
        if (typeof (audioOutput as { url?: string }).url === "string") {
          const audioRes = await fetch((audioOutput as { url: string }).url, { signal: AbortSignal.timeout(10000) });
          const arrayBuf = await audioRes.arrayBuffer();
          return Buffer.from(arrayBuf);
        }
        if (audioOutput instanceof Blob) {
          const arrayBuf = await audioOutput.arrayBuffer();
          return Buffer.from(arrayBuf);
        }
      }
      return null;
    } catch (err: any) {
      console.warn("[TTS] Qwen3-TTS failed:", err?.message || err);
      return null;
    }
  })();
  return Promise.race([attempt, raceTimeout]);
}

async function callHFInferenceTTS(text: string, hfToken: string): Promise<Buffer | null> {
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/mms-tts-eng",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: text }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      console.warn("[TTS] HF Inference TTS failed:", response.status, await response.text());
      return null;
    }

    const arrayBuf = await response.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch (err: any) {
    console.warn("[TTS] HF Inference TTS error:", err?.message || err);
    return null;
  }
}

export interface TTSGenerateOptions {
  unitId: number;
  content: any;
  isNextGen: boolean;
  voicePreset: string;
  referenceAudio?: string;
  hfToken?: string;
}

export interface TTSResult {
  audioData: string;
  audioFormat: string;
  fromCache: boolean;
  fallback: boolean;
}

export async function generateTTSAudio(opts: TTSGenerateOptions): Promise<TTSResult | null> {
  const { unitId, content, isNextGen, voicePreset, referenceAudio, hfToken } = opts;

  const refHash = referenceAudio ? hashBase64(referenceAudio) : undefined;
  const configHash = hashVoiceConfig(voicePreset, refHash);

  const cached = await getCachedAudio(unitId, configHash);
  if (cached) {
    return { ...cached, fromCache: true, fallback: false };
  }

  const text = buildLessonText(content, isNextGen);
  if (!text || text.length < 10) return null;

  const MAX_CHARS = 3000;
  const truncatedText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "..." : text;

  let audioBuffer: Buffer | null = null;
  let audioFormat = "wav";
  let fallback = false;

  if (voicePreset !== "browser") {
    audioBuffer = await callQwen3TTS(truncatedText, voicePreset, referenceAudio);

    if (!audioBuffer && hfToken) {
      audioBuffer = await callHFInferenceTTS(truncatedText, hfToken);
      audioFormat = "flac";
      fallback = true;
    }
  }

  if (!audioBuffer) {
    return null;
  }

  const audioData = audioBuffer.toString("base64");
  await saveCachedAudio(unitId, configHash, audioData, audioFormat).catch(console.error);

  return { audioData, audioFormat, fromCache: false, fallback };
}

export async function preGenerateTTSForUnit(
  unitId: number,
  content: any,
  isNextGen: boolean,
  voicePreset: string,
  referenceAudio?: string,
  hfToken?: string
): Promise<void> {
  if (!voicePreset || voicePreset === "browser") return;
  generateTTSAudio({ unitId, content, isNextGen, voicePreset, referenceAudio, hfToken })
    .catch(err => console.warn("[TTS] Background pre-generation failed:", err?.message || err));
}

