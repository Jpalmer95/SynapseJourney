import { createHash } from "crypto";
import { db } from "./db";
import { ttsAudioCache } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import OpenAI from "openai";

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

/**
 * Detect audio format from buffer magic bytes.
 * Avoids hardcoding "wav" when provider may return flac/mp3/ogg.
 */
export function detectAudioFormat(buffer: Buffer): string {
  if (buffer.length < 4) return "wav";
  // RIFF…WAVE = WAV
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "wav";
  // fLaC = FLAC
  if (buffer[0] === 0x66 && buffer[1] === 0x4C && buffer[2] === 0x61 && buffer[3] === 0x43) return "flac";
  // OggS = OGG
  if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) return "ogg";
  // ID3 or 0xFF 0xFB/0xF3/0xF2 = MP3
  if ((buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
      (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)) return "mp3";
  return "wav";
}

/**
 * Attempt to read WAV duration in seconds from its header.
 * Returns null for non-WAV or malformed files.
 */
export function getWavDurationSeconds(buffer: Buffer): number | null {
  if (buffer.length < 44) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buffer.toString("ascii", 8, 12) !== "WAVE") return null;
  const byteRate = buffer.readUInt32LE(28);
  if (!byteRate) return null;
  // Scan for 'data' chunk (may not be at fixed offset in all encoders)
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === "data") {
      return chunkSize / byteRate;
    }
    offset += 8 + chunkSize;
    if (chunkSize === 0 || chunkSize > buffer.length) break;
  }
  return null;
}

/**
 * Get audio duration in seconds for any supported format using music-metadata.
 * Returns null when format is unrecognised or metadata cannot be parsed.
 * Falls back to WAV header parser for WAV files (faster, no library needed).
 */
export async function getAudioDurationSeconds(buffer: Buffer): Promise<number | null> {
  // WAV: use fast header parser
  const wavDuration = getWavDurationSeconds(buffer);
  if (wavDuration !== null) return wavDuration;
  // MP3, FLAC, OGG, M4A, etc: use music-metadata
  try {
    const mm = await import("music-metadata");
    const meta = await mm.parseBuffer(buffer);
    const duration = meta.format.duration;
    return typeof duration === "number" && isFinite(duration) ? duration : null;
  } catch {
    return null;
  }
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

/**
 * Build the "rest" portion of lesson text (full text minus the intro section).
 * Used with buildIntroText to segment first-listen fast play with no overlap or gap.
 */
export function buildRestText(content: any, isNextGen: boolean): string {
  const fullText = buildLessonText(content, isNextGen);
  const introText = buildIntroText(content, isNextGen);
  if (!introText || !fullText.startsWith(introText)) {
    // If intro is truncated mid-text, find the nearest sentence boundary
    const idx = fullText.indexOf(introText.slice(-20));
    if (idx < 0) return fullText; // fallback: return everything
    const afterIntro = fullText.slice(idx + 20).trimStart();
    // Skip to next sentence start
    const sentStart = afterIntro.search(/[A-Z]/);
    return sentStart >= 0 ? afterIntro.slice(sentStart) : afterIntro;
  }
  return fullText.slice(introText.length).trimStart();
}

/**
 * Extract only the intro (first 1–2 sections) of lesson content for fast TTS generation.
 * Returns a string of ≤ 800 chars: just enough to start audio within 2–5s.
 */
export function buildIntroText(content: any, isNextGen: boolean): string {
  if (!content) return "";
  const MAX = 800;
  let intro = "";
  if (isNextGen) {
    intro = content.researchContext || "";
  } else {
    const parts: string[] = [];
    if (content.concept) parts.push(content.concept);
    if (content.analogy) parts.push(`Think of it this way: ${content.analogy}`);
    intro = parts.join(" ");
  }
  intro = intro.replace(/\n+/g, " ").trim();
  if (intro.length <= MAX) return intro;
  // Truncate at a sentence boundary near MAX
  const cutSearch = intro.slice(MAX - 200, MAX + 100).search(/[.!?]\s/);
  if (cutSearch >= 0) return intro.slice(0, MAX - 200 + cutSearch + 1).trim();
  return intro.slice(0, MAX).trim();
}

/**
 * Map Synapse voice preset IDs to OpenAI built-in voice names.
 * OpenAI voices: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer
 */
const OPENAI_VOICE_MAP: Record<string, "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"> = {
  kokoro: "alloy",
  qwen: "alloy",
  aria: "shimmer",
  nova: "nova",
  lyra: "fable",
  echo: "echo",
  sage: "onyx",
  orion: "alloy",
};

/**
 * Call OpenAI TTS API (/audio/speech).
 * Uses Replit's AI integration env vars first (AI_INTEGRATIONS_OPENAI_API_KEY +
 * AI_INTEGRATIONS_OPENAI_BASE_URL), falling back to the standard OPENAI_API_KEY.
 * Only handles the 6 named AI presets — not "browser" or "custom".
 * Returns MP3 audio as a Buffer, or null on any failure.
 */
async function callOpenAITTS(text: string, voicePresetId: string): Promise<Buffer | null> {
  // Only handle the six named AI voice presets — custom/browser go to other providers
  if (!OPENAI_VOICE_MAP[voicePresetId]) return null;

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.info("[TTS] OpenAI TTS: no API key configured — skipping");
    return null;
  }
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;
  try {
    const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    const voice = OPENAI_VOICE_MAP[voicePresetId];
    const MAX_CHARS = 4096;
    const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: truncated,
      response_format: "mp3",
    });
    return Buffer.from(await response.arrayBuffer());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.info("[TTS] OpenAI TTS:", message, "— falling back");
    return null;
  }
}

/**
 * Call Qwen3-TTS via the Gradio 5.x HTTP REST API (no WebSocket, pure fetch).
 * The Gradio REST protocol:
 *   1. POST /call/{api_name} → { event_id }
 *   2. GET  /call/{api_name}/{event_id} → SSE stream with "event: complete" + "data: [...]"
 * All errors and timeouts are caught locally; no process-level listeners are used.
 */
async function callQwen3TTS(text: string, voicePresetId: string, referenceAudio?: string): Promise<Buffer | null> {
  const spaceHost = process.env.QWEN_TTS_SPACE_HOST || "qwen-qwen3-tts.hf.space";
  const apiName = process.env.QWEN_TTS_API_NAME || "synthesize";

  try {
    // Apply voice style as a text prefix (Qwen3-TTS supports style prompts)
    const preset = getVoicePreset(voicePresetId);
    const styledText = preset ? `[${preset.style}] ${text}` : text;

    // Build request payload — include reference audio blob if custom voice clone
    const requestPayload: Record<string, unknown> = { data: [styledText] };
    if (referenceAudio) {
      // Pass base64-encoded reference audio as the second argument
      requestPayload.data = [styledText, { data: referenceAudio, mime_type: "audio/wav" }];
    }

    // Step 1: Submit prediction job and get event_id
    const postRes = await fetch(`https://${spaceHost}/call/${apiName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(10000),
    });

    if (!postRes.ok) {
      console.info(`[TTS] Qwen3-TTS: /call/${apiName} returned ${postRes.status} — skipping`);
      return null;
    }

    const postBody = await postRes.json() as { event_id?: string };
    const eventId = postBody.event_id;
    if (!eventId) {
      console.info("[TTS] Qwen3-TTS: No event_id in response — skipping");
      return null;
    }

    // Step 2: Stream SSE result (timeout: 45s to allow for slow TTS generation)
    const sseRes = await fetch(`https://${spaceHost}/call/${apiName}/${eventId}`, {
      signal: AbortSignal.timeout(45000),
    });

    if (!sseRes.ok || !sseRes.body) {
      console.info(`[TTS] Qwen3-TTS: SSE stream returned ${sseRes.status} — skipping`);
      return null;
    }

    const reader = sseRes.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";
    let audioUrl: string | null = null;
    let currentEvent = "";

    try {
      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent === "complete") {
            try {
              const parsed = JSON.parse(line.slice(6)) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                const first = parsed[0] as Record<string, unknown>;
                if (typeof first?.url === "string") {
                  audioUrl = first.url;
                  break outer;
                }
              }
            } catch {
              // malformed JSON line — skip
            }
          } else if (line.startsWith("data: ") && currentEvent === "error") {
            console.info("[TTS] Qwen3-TTS: Space returned an error event — skipping");
            break outer;
          }
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }

    if (!audioUrl) return null;

    // Step 3: Fetch the generated audio file (may be hosted on the Space itself)
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(15000) });
    if (!audioRes.ok) {
      console.info(`[TTS] Qwen3-TTS: Audio fetch returned ${audioRes.status}`);
      return null;
    }

    return Buffer.from(await audioRes.arrayBuffer());
  } catch (err: unknown) {
    // AbortError = timeout; TypeError = network error — both handled gracefully
    const name = err instanceof Error ? err.name : undefined;
    const message = err instanceof Error ? err.message : String(err);
    if (name === "AbortError" || name === "TimeoutError") {
      console.info("[TTS] Qwen3-TTS: Request timed out — falling back");
    } else {
      console.info("[TTS] Qwen3-TTS:", message, "— falling back");
    }
    return null;
  }
}

/**
 * Call HF Inference API for TTS.
 * Uses the provided token (may be server-side HF_API_TOKEN or user's personal token).
 * First attempts Qwen3-TTS on the Inference API; falls back to facebook/mms-tts-eng.
 */
async function callHFInferenceTTS(text: string, hfToken: string): Promise<Buffer | null> {
  // Attempt Qwen3-TTS via HF Inference API (available for paid inference)
  const models = ["Qwen/Qwen3-TTS", "facebook/mms-tts-eng"];
  for (const model of models) {
    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
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
        const errText = await response.text().catch(() => "");
        console.info(`[TTS] HF Inference (${model}): ${response.status} — ${errText.slice(0, 100)}`);
        continue;
      }

      const arrayBuf = await response.arrayBuffer();
      if (arrayBuf.byteLength > 0) {
        return Buffer.from(arrayBuf);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.info(`[TTS] HF Inference (${model}): ${message}`);
    }
  }
  return null;
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
  let fallback = false;

  if (voicePreset !== "browser") {
    // 1. OpenAI TTS — primary server provider (reliable, fast, high quality)
    audioBuffer = await callOpenAITTS(truncatedText, voicePreset);

    // 2. HF Inference API — last server-side fallback (uses server env token or user token)
    if (!audioBuffer) {
      const effectiveToken = process.env.HF_API_TOKEN || hfToken;
      if (effectiveToken) {
        audioBuffer = await callHFInferenceTTS(truncatedText, effectiveToken);
        if (audioBuffer) fallback = true;
      }
    }
  }

  if (!audioBuffer) {
    return null;
  }

  const audioFormat = detectAudioFormat(audioBuffer);
  const audioData = audioBuffer.toString("base64");
  await saveCachedAudio(unitId, configHash, audioData, audioFormat).catch(console.error);

  return { audioData, audioFormat, fromCache: false, fallback };
}

/**
 * Generate TTS audio for arbitrary text without DB caching.
 * Used for free-form text requests where there is no stable unit-based cache key.
 * Returns the buffer AND its detected audio format (never hardcodes "wav").
 */
export async function callTTSDirect(
  text: string,
  voicePreset: string,
  referenceAudio?: string,
  hfToken?: string
): Promise<{ buffer: Buffer; format: string } | null> {
  if (!text || text.length < 3) return null;
  const MAX_CHARS = 3000;
  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "..." : text;

  // 1. OpenAI TTS — primary server provider
  let audioBuffer: Buffer | null = await callOpenAITTS(truncated, voicePreset);

  // 2. HF Inference API — last server-side fallback
  if (!audioBuffer) {
    const effectiveToken = process.env.HF_API_TOKEN || hfToken;
    if (effectiveToken) {
      audioBuffer = await callHFInferenceTTS(truncated, effectiveToken);
    }
  }

  if (!audioBuffer) return null;
  return { buffer: audioBuffer, format: detectAudioFormat(audioBuffer) };
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
