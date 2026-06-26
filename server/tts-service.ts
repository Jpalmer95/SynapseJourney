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
 * Map Synapse engine/preset IDs to OpenAI built-in voice names (server fallback).
 * OpenAI voices: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer
 */
const OPENAI_VOICE_MAP: Record<string, "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"> = {
  // Current engine IDs
  kokoro: "alloy",
  qwen: "alloy",
  // Legacy sub-voice IDs kept for backward compatibility
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
 * Handles engine preset IDs (kokoro, qwen) and legacy sub-voice IDs via OPENAI_VOICE_MAP.
 * "browser" and "custom" bypass this and go through other providers.
 * Returns MP3 audio as a Buffer, or null on any failure.
 */
async function callOpenAITTS(text: string, voicePresetId: string): Promise<Buffer | null> {
  // Only handle engine/preset IDs present in the voice map — browser/custom go elsewhere
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
 * Qwen3-TTS mode options.
 * - custom_voice: preset speakers (Serena, Ryan, etc.) with optional style instructions
 * - voice_design: text-described custom voice (e.g. "calm female narrator with soft accent")
 * - voice_clone: clone a voice from a reference audio sample
 */
export interface QwenTTSOptions {
  mode: "custom_voice" | "voice_design" | "voice_clone";
  /** For custom_voice mode: speaker ID (Serena, Ryan, Aiden, etc.) */
  speaker?: string;
  /** For custom_voice mode: optional natural language style guidance */
  styleInstruction?: string;
  /** For voice_design mode: natural language voice description */
  voiceDescription?: string;
  /** For voice_clone mode: base64-encoded reference audio */
  referenceAudio?: string;
  /** For voice_clone mode: transcript of the reference audio */
  refText?: string;
  /** HF token for ZeroGPU access */
  hfToken?: string;
  /** Language for synthesis (default: "English") */
  language?: string;
  /** Model size for voice_clone and custom_voice (default: "1.7B") */
  modelSize?: string;
}

const QWEN_SPACE_HOST = "qwen-qwen3-tts.hf.space";
const GRADIO_API_PREFIX = "/gradio_api";

/**
 * Core Gradio REST helper: submit a prediction job and stream the SSE result.
 *
 * The Gradio 5.x REST protocol:
 *   1. POST /gradio_api/call/{api_name}  → { event_id }
 *   2. GET  /gradio_api/call/{api_name}/{event_id} → SSE stream with "event: complete" + "data: [...]"
 *
 * Returns the first file URL from the result data, or null on failure.
 */
async function gradioPredict(
  apiName: string,
  data: unknown[],
  hfToken?: string,
  submitTimeoutMs = 15_000,
  sseTimeoutMs = 60_000,
): Promise<string | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (hfToken) {
    headers["Authorization"] = `Bearer ${hfToken}`;
  }

  // Step 1: Submit prediction job
  const postRes = await fetch(`https://${QWEN_SPACE_HOST}${GRADIO_API_PREFIX}/call/${apiName}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(submitTimeoutMs),
  });

  if (!postRes.ok) {
    console.info(`[TTS] Qwen3-TTS /call/${apiName} returned ${postRes.status} — skipping`);
    return null;
  }

  const postBody = await postRes.json() as { event_id?: string };
  const eventId = postBody.event_id;
  if (!eventId) {
    console.info("[TTS] Qwen3-TTS: No event_id in response — skipping");
    return null;
  }

  // Step 2: Stream SSE result
  const sseRes = await fetch(`https://${QWEN_SPACE_HOST}${GRADIO_API_PREFIX}/call/${apiName}/${eventId}`, {
    headers: hfToken ? { Authorization: `Bearer ${hfToken}` } : undefined,
    signal: AbortSignal.timeout(sseTimeoutMs),
  });

  if (!sseRes.ok || !sseRes.body) {
    console.info(`[TTS] Qwen3-TTS SSE stream returned ${sseRes.status} — skipping`);
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
              // Gradio returns a FileData object with a `url` field
              if (typeof first?.url === "string") {
                audioUrl = first.url;
                break outer;
              }
              // Some Gradio versions return { path: "..." } without url
              if (typeof first?.path === "string") {
                audioUrl = `https://${QWEN_SPACE_HOST}${GRADIO_API_PREFIX}/file=${first.path}`;
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

  return audioUrl;
}

/**
 * Upload a file to the Gradio Space for use as a reference audio in voice cloning.
 * Returns the server file path that can be passed to the generate_voice_clone endpoint.
 */
async function gradioUploadFile(
  audioBase64: string,
  mimeType: string,
  hfToken?: string,
): Promise<string | null> {
  const headers: Record<string, string> = {};
  if (hfToken) {
    headers["Authorization"] = `Bearer ${hfToken}`;
  }

  // Convert base64 to a Buffer, then to a Blob for multipart upload
  const buffer = Buffer.from(audioBase64, "base64");
  const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : "audio";
  const filename = `ref_audio.${ext}`;
  const blob = new Blob([buffer], { type: mimeType || "audio/wav" });

  const formData = new FormData();
  formData.append("files", blob, filename);

  const uploadRes = await fetch(`https://${QWEN_SPACE_HOST}${GRADIO_API_PREFIX}/upload`, {
    method: "POST",
    headers,
    body: formData,
    signal: AbortSignal.timeout(15_000),
  });

  if (!uploadRes.ok) {
    console.info(`[TTS] Qwen3-TTS upload returned ${uploadRes.status} — skipping`);
    return null;
  }

  const uploadBody = await uploadRes.json() as unknown;
  // Gradio returns an array of file paths
  if (Array.isArray(uploadBody) && uploadBody.length > 0) {
    const first = uploadBody[0] as string | Record<string, unknown>;
    if (typeof first === "string") return first;
    if (typeof first === "object" && first !== null && typeof (first as Record<string, unknown>).path === "string") {
      return (first as Record<string, string>).path;
    }
  }
  return null;
}

/**
 * Fetch audio bytes from a Gradio file URL.
 */
async function fetchGradioAudio(url: string, hfToken?: string): Promise<Buffer | null> {
  const headers: Record<string, string> = {};
  if (hfToken) {
    headers["Authorization"] = `Bearer ${hfToken}`;
  }
  const audioRes = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!audioRes.ok) {
    console.info(`[TTS] Qwen3-TTS audio fetch returned ${audioRes.status}`);
    return null;
  }
  return Buffer.from(await audioRes.arrayBuffer());
}

/**
 * Call Qwen3-TTS with the appropriate endpoint based on the mode.
 *
 * Three modes:
 * - custom_voice:  generate_custom_voice (preset speakers + optional style instructions)
 * - voice_design: generate_voice_design (text-described voice, 1.7B only)
 * - voice_clone:   generate_voice_clone (reference audio cloning)
 *
 * Returns audio as a Buffer, or null on any failure.
 */
async function callQwen3TTS(text: string, opts: QwenTTSOptions): Promise<Buffer | null> {
  const hfToken = opts.hfToken;
  const language = opts.language || "English";

  try {
    let audioUrl: string | null = null;

    if (opts.mode === "voice_design") {
      // Voice Design mode — text-described voice (1.7B only)
      const desc = opts.voiceDescription || "A clear, natural-sounding narrator.";
      audioUrl = await gradioPredict(
        "generate_voice_design",
        [text, language, desc],
        hfToken,
      );
    } else if (opts.mode === "voice_clone") {
      // Voice Clone mode — requires reference audio + transcript
      if (!opts.referenceAudio) {
        console.info("[TTS] Qwen3-TTS voice_clone: no reference audio provided — skipping");
        return null;
      }
      if (!opts.refText) {
        console.info("[TTS] Qwen3-TTS voice_clone: no reference text provided — skipping");
        return null;
      }

      // Step 1: Upload the reference audio
      const uploadedPath = await gradioUploadFile(opts.referenceAudio, "audio/wav", hfToken);
      if (!uploadedPath) {
        console.info("[TTS] Qwen3-TTS voice_clone: upload failed — skipping");
        return null;
      }

      // Step 2: Call generate_voice_clone with the uploaded file path
      const modelSize = opts.modelSize || "1.7B";
      audioUrl = await gradioPredict(
        "generate_voice_clone",
        [
          uploadedPath,       // ref_audio (filepath from upload)
          opts.refText,       // ref_text (transcript of reference audio)
          text,               // target_text (text to synthesize)
          language,           // language
          false,              // use_xvector_only (false = better quality)
          modelSize,           // model_size ("0.6B" or "1.7B")
        ],
        hfToken,
        15_000,
        90_000, // voice clone may take longer
      );
    } else {
      // Custom Voice mode (default) — preset speakers
      const speaker = opts.speaker || "Ryan";
      const styleInstruction = opts.styleInstruction || null;
      const modelSize = opts.modelSize || "1.7B";
      audioUrl = await gradioPredict(
        "generate_custom_voice",
        [text, language, speaker, styleInstruction, modelSize],
        hfToken,
      );
    }

    if (!audioUrl) return null;

    // Fetch the generated audio file
    const audioBuffer = await fetchGradioAudio(audioUrl, hfToken);
    return audioBuffer;
  } catch (err: unknown) {
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
 * Last-resort server-side fallback using facebook/mms-tts-eng.
 */
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
      const errText = await response.text().catch(() => "");
      console.info(`[TTS] HF Inference (mms-tts-eng): ${response.status} — ${errText.slice(0, 100)}`);
      return null;
    }

    const arrayBuf = await response.arrayBuffer();
    if (arrayBuf.byteLength > 0) {
      return Buffer.from(arrayBuf);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.info(`[TTS] HF Inference (mms-tts-eng): ${message}`);
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
  /** Qwen3-TTS mode options (used when voicePreset is "qwen" or "custom") */
  qwenOptions?: QwenTTSOptions;
}

export interface TTSResult {
  audioData: string;
  audioFormat: string;
  fromCache: boolean;
  fallback: boolean;
}

export async function generateTTSAudio(opts: TTSGenerateOptions): Promise<TTSResult | null> {
  const { unitId, content, isNextGen, voicePreset, referenceAudio, hfToken, qwenOptions } = opts;

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
    // 1. Qwen3-TTS via Gradio REST API (for qwen/custom presets with HF token)
    if ((voicePreset === "qwen" || voicePreset === "custom") && hfToken) {
      const qwenOpts: QwenTTSOptions = qwenOptions || {
        mode: voicePreset === "custom" ? "voice_clone" : "custom_voice",
        referenceAudio,
        hfToken,
      };
      // Ensure hfToken is always set
      qwenOpts.hfToken = hfToken;
      audioBuffer = await callQwen3TTS(truncatedText, qwenOpts);
    }

    // 2. OpenAI TTS — server fallback (reliable, fast, high quality)
    if (!audioBuffer) {
      audioBuffer = await callOpenAITTS(truncatedText, voicePreset);
    }

    // 3. HF Inference API — last server-side fallback (uses server env token or user token)
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
  hfToken?: string,
  qwenOptions?: QwenTTSOptions,
): Promise<{ buffer: Buffer; format: string } | null> {
  if (!text || text.length < 3) return null;
  const MAX_CHARS = 3000;
  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "..." : text;

  let audioBuffer: Buffer | null = null;

  // 1. Qwen3-TTS via Gradio REST API (for qwen/custom presets with HF token)
  if ((voicePreset === "qwen" || voicePreset === "custom") && hfToken) {
    const qwenOpts: QwenTTSOptions = qwenOptions || {
      mode: voicePreset === "custom" ? "voice_clone" : "custom_voice",
      referenceAudio,
      hfToken,
    };
    qwenOpts.hfToken = hfToken;
    audioBuffer = await callQwen3TTS(truncated, qwenOpts);
  }

  // 2. OpenAI TTS — server fallback
  if (!audioBuffer) {
    audioBuffer = await callOpenAITTS(truncated, voicePreset);
  }

  // 3. HF Inference API — last server-side fallback
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
  hfToken?: string,
  qwenOptions?: QwenTTSOptions,
): Promise<void> {
  if (!voicePreset || voicePreset === "browser") return;
  generateTTSAudio({ unitId, content, isNextGen, voicePreset, referenceAudio, hfToken, qwenOptions })
    .catch((err: unknown) => console.warn("[TTS] Background pre-generation failed:", err instanceof Error ? err.message : String(err)));
}
