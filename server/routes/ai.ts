import type { Express, Response } from "express";
import { createHash } from "crypto";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { authStorage } from "../replit_integrations/auth/storage";
import { z } from "zod";
import {
  getUserChatProvider,
  validateUserChatCredentials,
  generateCourseContent,
  type ProviderConfig
} from "../ai-providers";
import { SYLLABI_MAP } from "../syllabi";
import { SEED_LESSON_CONTENT } from "../seed-lesson-content";

// Compute a short SHA-256 hash of lesson content for traceability logging
export function contentHash(content: unknown): string {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 12);
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "jpkorstad@gmail.com").split(",").map(e => e.trim().toLowerCase());

// Helper function to check if user is admin by their email
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await authStorage.getUser(userId);
  if (!user?.email) return false;
  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}

const chatMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  topicId: z.number().int().positive().optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
  socraticMode: z.boolean().optional().default(false),
  feynmanMode: z.boolean().optional().default(false),
  feynmanGraded: z.boolean().optional().default(false),
  synthesisQuest: z.string().optional(),
});

export function registerAIRoutes(app: Express) {
// AI Chat endpoint
app.post("/api/ai/chat", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    
    // Validate request body
    const validationResult = chatMessageSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid request body", 
        details: validationResult.error.flatten() 
      });
    }

    const { message, topicId, history, socraticMode, feynmanMode, feynmanGraded, synthesisQuest } = validationResult.data;

    // Get user's preferred AI provider
    const userProfile = await storage.getUserProfile(userId);
    const providerConfig: ProviderConfig = {
      provider: (userProfile?.preferredAiProvider as "openai" | "huggingface" | "ollama" | "openrouter") || "openai",
      huggingFaceToken: userProfile?.huggingFaceToken || undefined,
      ollamaUrl: userProfile?.ollamaUrl || undefined,
      openRouterKey: userProfile?.openRouterKey || undefined,
      preferredModel: userProfile?.preferredModel || undefined,
    };

    // Validate user has configured their own chat provider credentials
    const credentialCheck = validateUserChatCredentials(providerConfig);
    if (!credentialCheck.valid) {
      return res.status(402).json({ 
        error: "CHAT_PROVIDER_REQUIRED",
        message: "AI chat requires you to set up your own AI provider. Please configure your credentials in Settings.",
        missingCredential: credentialCheck.missingCredential,
        provider: credentialCheck.provider,
      });
    }

    // Get topic context if provided
    let topicContext = "";
    if (topicId) {
      const topic = await storage.getTopicById(topicId);
      if (topic) {
        topicContext = `The user is currently learning about: ${topic.title}. Description: ${topic.description}. `;
      }
    }

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let systemPrompt = `You are an AI learning companion called Synapse. Your role is to:
1. Provide accurate, clear, and encouraging educational support
2. Explain complex terms simply when asked
3. Connect ideas across different fields
4. Suggest practical applications and projects

${topicContext}

Be conversational, warm, and genuinely curious about helping the learner understand.`;

    if (synthesisQuest) {
      systemPrompt = `You are a Grandmaster AI named Synapse conducting a "Synthesis Quest".
1. Your goal is to strictly test the user's ability to combine and synthesize the following disparate, mastered topics they have learned: ${synthesisQuest}.
2. Give them an incredibly creative, multidisciplinary, open-ended scenario or problem that requires deep concepts from ALL of these topics simultaneously.
3. Critically evaluate their proposed solution for logical consistency and accurate application of knowledge.
4. Do NOT give them the answer. Make them work for it.`;
    } else if (socraticMode) {
      systemPrompt = `You are an ancient philosophical Socratic AI guide called Synapse. Your absolute strictly enforced rule is:
1. NEVER GIVE DIRECT ANSWERS TO QUESTIONS.
2. Only respond with probing, logic-inducing questions that guide the user to the answer themselves.
3. If the user is stuck, give a tiny hint wrapped in another question.
4. Encourage critical thinking at all costs.
${topicContext}`;
    } else if (feynmanMode) {
      if (feynmanGraded) {
        systemPrompt = `You are an incredibly critical, strict AI Professor evaluating the user's explanation of a concept using the Feynman Technique. 
1. The user will attempt to teach you a concept to prove they have mastered it. 
2. Actively search for flaws, hidden assumptions, or gaps in their logic.
3. Be brutally honest, critical, and strict. If they use jargon without explaining it, immediately call them out.
4. Provide a harsh letter grade at the end of their explanation and refuse to accept it until it is completely flawless and understandable.
${topicContext}`;
      } else {
        systemPrompt = `You are a highly curious, slightly confused beginner acting as the user's student. 
1. The user is using the Feynman Technique to try and teach you a concept.
2. Play completely dumb. Constantly ask "But *why* does that happen?" and beg for simple analogies.
3. If their explanation is too complex, tell them you don't understand those big words.
4. Naturally lead them through innocent curiosity to realize their own knowledge gaps.
${topicContext}`;
      }
    }

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    try {
      // Get user's chat provider (requires their own credentials)
      // This check should never trigger since we validate above, but keeping as safety net
      const provider = getUserChatProvider(providerConfig);
      if (!provider) {
        res.write(`data: ${JSON.stringify({ error: "CHAT_PROVIDER_REQUIRED", message: "AI chat requires you to set up your own AI provider." })}\n\n`);
        res.end();
        return;
      }
      const response = await provider.chat(
        messages.map(m => ({ role: m.role, content: m.content })),
        { maxTokens: 1024 }
      );
      
      // Send the full response at once (streaming not supported by Gemini AI Integrations)
      res.write(`data: ${JSON.stringify({ content: response })}\n\n`);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (aiError) {
      console.error("AI chat error:", aiError);
      res.write(`data: ${JSON.stringify({ error: "AI service temporarily unavailable. Please try again." })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error("Error in AI chat:", error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: "Failed to process message" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Failed to process message" });
    }
  }
});

// TTS ENDPOINTS
// ============================================

app.get("/api/tts/settings", isAuthenticated, async (req: any, res: Response) => {
  try {
    const settings = await storage.getTtsSettings(req.user.claims.sub);
    // Never send raw base64 reference audio to the client — it's only needed server-side for TTS generation.
    // Return hasReferenceAudio so the UI knows whether a clone voice is configured.
    res.json({
      voicePreset: settings.voicePreset,
      playbackSpeed: settings.playbackSpeed,
      hasReferenceAudio: !!settings.referenceAudio,
      qwenMode: settings.qwenMode,
      qwenStyleInstruction: settings.qwenStyleInstruction,
      qwenVoiceDescription: settings.qwenVoiceDescription,
      refText: settings.refText,
    });
  } catch (err) {
    console.error("TTS settings fetch error:", err);
    res.status(500).json({ error: "Failed to fetch TTS settings" });
  }
});

// Returns the stored reference audio for the authenticated user so the client can
// forward it directly to an HF cloud TTS Space for voice cloning.
app.get("/api/tts/reference-audio", isAuthenticated, async (req: any, res: Response) => {
  try {
    const settings = await storage.getTtsSettings(req.user.claims.sub);
    if (!settings.referenceAudio) {
      return res.status(404).json({ error: "No reference audio stored" });
    }
    res.json({ audioBase64: settings.referenceAudio });
  } catch (err) {
    console.error("TTS reference audio fetch error:", err);
    res.status(500).json({ error: "Failed to fetch reference audio" });
  }
});

app.put("/api/tts/settings", isAuthenticated, async (req: any, res: Response) => {
  try {
    const VALID_PRESETS = ["kokoro", "browser", "qwen", "custom"] as const;
    const VALID_QWEN_MODES = ["custom_voice", "voice_design", "voice_clone"] as const;
    const schema = z.object({
      voicePreset: z.enum(VALID_PRESETS).optional(),
      playbackSpeed: z.number().min(0.5).max(3).optional(),
      qwenMode: z.enum(VALID_QWEN_MODES).optional(),
      qwenStyleInstruction: z.string().max(500).nullable().optional(),
      qwenVoiceDescription: z.string().max(500).nullable().optional(),
      refText: z.string().max(1000).nullable().optional(),
    }).refine(d => d.voicePreset || d.playbackSpeed !== undefined || d.qwenMode || d.qwenStyleInstruction !== undefined || d.qwenVoiceDescription !== undefined || d.refText !== undefined, { message: "At least one setting must be provided" });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid settings", details: parsed.error.issues });
    const { voicePreset, playbackSpeed, qwenMode, qwenStyleInstruction, qwenVoiceDescription, refText } = parsed.data;
    // Fetch current settings to fill in any unspecified fields (partial update)
    const current = await storage.getTtsSettings(req.user.claims.sub);
    await storage.saveTtsSettings(
      req.user.claims.sub,
      voicePreset || current.voicePreset,
      undefined,
      playbackSpeed ?? current.playbackSpeed,
      {
        qwenMode: qwenMode || current.qwenMode,
        qwenStyleInstruction: qwenStyleInstruction !== undefined ? qwenStyleInstruction : current.qwenStyleInstruction,
        qwenVoiceDescription: qwenVoiceDescription !== undefined ? qwenVoiceDescription : current.qwenVoiceDescription,
        refText: refText !== undefined ? refText : current.refText,
      },
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("TTS settings save error:", err);
    res.status(500).json({ error: "Failed to save TTS settings" });
  }
});

app.post("/api/tts/voice-upload", isAuthenticated, async (req: any, res: Response) => {
  try {
    const schema = z.object({
      audioBase64: z.string().min(1),
      mimeType: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid audio data" });

    const { audioBase64 } = parsed.data;
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const sizeBytes = audioBuffer.length;
    // 2MB max ~= 30s of voice-quality mono audio (16kHz 16-bit WAV ≈ 960KB/30s; 128kbps MP3 ≈ 480KB/30s)
    if (sizeBytes > 2 * 1024 * 1024) {
      return res.status(400).json({ error: "Reference audio must be 30 seconds or less (max 2MB). Please trim your recording." });
    }

    const { hashBase64, getAudioDurationSeconds } = await import("../tts-service");

    // Validate duration for all audio formats (WAV via header, others via music-metadata)
    // Reject if duration cannot be determined (unknown/unsupported format) to enforce the 30s limit strictly
    const duration = await getAudioDurationSeconds(audioBuffer);
    if (duration === null) {
      return res.status(400).json({ error: "Could not determine audio duration. Please use WAV, MP3, or OGG format (max 30 seconds)." });
    }
    if (duration > 30) {
      return res.status(400).json({ error: `Reference audio is ${Math.round(duration)}s — must be 30 seconds or less. Please trim your recording.` });
    }
    await storage.saveTtsSettings(req.user.claims.sub, "custom", audioBase64);
    res.json({ ok: true, hasReferenceAudio: true, message: "Voice reference uploaded successfully" });
  } catch (err) {
    console.error("TTS voice upload error:", err);
    res.status(500).json({ error: "Failed to upload voice reference" });
  }
});

app.post("/api/tts/generate", isAuthenticated, async (req: any, res: Response) => {
  try {
    // Accept either a unitId (lesson-based) or free-form text + voiceConfig
    const VALID_PRESETS = ["kokoro", "browser", "qwen", "custom"] as const;
    const schema = z.object({
      unitId: z.number().int().positive().optional(),
      text: z.string().min(1).max(5000).optional(),
      voiceConfig: z.object({
        preset: z.enum(VALID_PRESETS).optional(),
        referenceAudio: z.string().optional(),
        playbackSpeed: z.number().min(0.5).max(3).optional(),
        speaker: z.string().optional(), // Qwen3-TTS preset speaker (e.g. "Ryan", "Serena")
        qwenMode: z.enum(["custom_voice", "voice_design", "voice_clone"]).optional(),
        qwenStyleInstruction: z.string().max(500).optional(),
        qwenVoiceDescription: z.string().max(500).optional(),
        refText: z.string().max(1000).optional(),
      }).optional(),
      forceRegenerate: z.boolean().optional(),
      firstParagraphOnly: z.boolean().optional(),
    }).refine(d => d.unitId || d.text, { message: "Either unitId or text is required" });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });

    const { unitId, text: freeText, voiceConfig, forceRegenerate } = parsed.data;
    const userId = req.user.claims.sub;

    let contentForTTS: unknown;
    let unitIdForCache: number | undefined;
    let isNextGenUnit = false;

    // Always validate unitId first (before checking voice preset) — prevents IDOR and gives correct 404/403
    if (unitId) {
      const unit = await storage.getLessonUnit(unitId);
      if (!unit?.contentJson) {
        return res.status(404).json({ error: "Lesson content not found. Load the lesson first." });
      }
      // Authorization: verify the user has access to this unit (same as lesson content endpoint)
      const mastery = await storage.getOrCreateTopicMastery(userId, unit.topicId);
      const isAdmin = await isAdminUser(userId);
      if (!isUnitUnlocked(unit.difficulty, mastery, isAdmin)) {
        return res.status(403).json({ error: "This lesson is locked" });
      }
      contentForTTS = unit.contentJson;
      unitIdForCache = unitId;
      isNextGenUnit = unit.difficulty === "nextgen";
    }

    // Load TTS settings (user's saved preferences, overridable by voiceConfig)
    const ttsSettings = await storage.getTtsSettings(userId);
    const voicePreset = voiceConfig?.preset || ttsSettings.voicePreset;
    // Only apply stored reference audio when preset is "custom"; other presets must not use it
    const referenceAudio = (voicePreset === "custom")
      ? (voiceConfig?.referenceAudio || ttsSettings.referenceAudio || undefined)
      : (voiceConfig?.referenceAudio || undefined);
    const playbackSpeed = voiceConfig?.playbackSpeed || ttsSettings.playbackSpeed;

    if (voicePreset === "browser") {
      return res.json({ fallback: true, message: "Browser TTS is selected" });
    }

    const { hashVoiceConfig, hashBase64, generateTTSAudio, callTTSDirect, buildIntroText, buildRestText } = await import("../tts-service");
    const refHash = referenceAudio ? hashBase64(referenceAudio) : undefined;
    const configHash = hashVoiceConfig(voicePreset, refHash);

    // Build Qwen3-TTS mode options from stored settings + client overrides
    const userProfile = await storage.getUserProfile(userId);
    const hfToken = userProfile?.huggingFaceToken || undefined;
    const qwenMode = (voiceConfig?.qwenMode || ttsSettings.qwenMode) as "custom_voice" | "voice_design" | "voice_clone";
    const buildQwenOptions = (): import("../tts-service").QwenTTSOptions => ({
      mode: qwenMode,
      speaker: voiceConfig?.speaker || undefined, // client-selected preset speaker (e.g. "Ryan")
      styleInstruction: voiceConfig?.qwenStyleInstruction || ttsSettings.qwenStyleInstruction || undefined,
      voiceDescription: voiceConfig?.qwenVoiceDescription || ttsSettings.qwenVoiceDescription || undefined,
      referenceAudio: referenceAudio,
      refText: voiceConfig?.refText || ttsSettings.refText || undefined,
      hfToken,
      language: "English",
      modelSize: "1.7B",
    });

    // Intro-only fast path: generate just the opening section for immediate play,
    // then kick off background full-audio caching so subsequent listens are instant.
    if (parsed.data.firstParagraphOnly && unitIdForCache && contentForTTS) {
      const introText = buildIntroText(contentForTTS, isNextGenUnit);
      if (!introText || introText.length < 10) {
        return res.status(503).json({ error: "Intro text unavailable", fallbackToBrowser: true });
      }
      const introResult = await callTTSDirect(introText, voicePreset, referenceAudio, hfToken, buildQwenOptions());
      if (!introResult) {
        return res.status(503).json({ error: "TTS generation failed", fallbackToBrowser: true });
      }
      // Non-blocking: cache the full audio in the background so the next listen is instant
      generateTTSAudio({
        unitId: unitIdForCache,
        content: contentForTTS,
        isNextGen: isNextGenUnit,
        voicePreset,
        referenceAudio,
        hfToken,
        qwenOptions: buildQwenOptions(),
      }).catch((err: unknown) => {
        console.warn("[TTS] Background full-audio caching failed:", err instanceof Error ? err.message : String(err));
      });
      const restText = buildRestText(contentForTTS, isNextGenUnit);
      return res.json({
        audioData: introResult.buffer.toString("base64"),
        audioFormat: introResult.format,
        fromCache: false,
        fallback: false,
        firstParagraphOnly: true,
        restText: restText || null,
        playbackSpeed,
      });
    }

    // Free-text requests: generate without caching (no stable key; different texts would collide at unitId=0)
    if (freeText && !unitIdForCache) {
      const directResult = await callTTSDirect(freeText, voicePreset, referenceAudio, hfToken, buildQwenOptions());
      if (!directResult) {
        return res.status(503).json({ error: "TTS generation failed", fallbackToBrowser: true });
      }
      return res.json({
        audioData: directResult.buffer.toString("base64"),
        audioFormat: directResult.format,
        fromCache: false,
        fallback: false,
        playbackSpeed,
      });
    }

    // Unit-based requests: use cache
    if (unitIdForCache && !forceRegenerate) {
      const cached = await storage.getTtsAudioCache(unitIdForCache, configHash);
      if (cached) {
        return res.json({ audioData: cached.audioData, audioFormat: cached.audioFormat, fromCache: true, playbackSpeed });
      }
    }

    const result = await generateTTSAudio({
      unitId: unitIdForCache!,
      content: contentForTTS,
      isNextGen: isNextGenUnit,
      voicePreset,
      referenceAudio,
      hfToken,
      qwenOptions: buildQwenOptions(),
    });

    if (!result) {
      // No audio data available — client should fall back to browser TTS
      return res.status(503).json({ error: "TTS generation failed", fallbackToBrowser: true });
    }

    res.json({ ...result, playbackSpeed });
  } catch (err) {
    console.error("TTS generate error:", err);
    res.status(500).json({ fallbackToBrowser: true, error: "TTS service unavailable" });
  }
});

app.get("/api/tts/presets", (_req, res) => {
  // Returns engine definitions for the 3-engine model
  res.json([
    { id: "kokoro", name: "Kokoro", description: "Local WebGPU/WASM model — offline, no token needed", tier: "local" },
    { id: "browser", name: "Browser TTS", description: "Device speech engine — quality depends on your OS", tier: "server" },
    { id: "qwen", name: "Qwen Cloud", description: "Hugging Face ZeroGPU — 3 modes: preset speakers, voice design, voice clone. Requires HF token", tier: "cloud" },
    { id: "custom", name: "Custom Voice", description: "Clone your own voice with a reference audio sample (Qwen3-TTS voice_clone mode)", tier: "cloud" },
  ]);
});

app.get("/api/tts/cache-status/:unitId", isAuthenticated, async (req: any, res: Response) => {
  try {
    const unitId = parseInt(req.params.unitId);
    if (isNaN(unitId)) return res.status(400).json({ error: "Invalid unit ID" });

    const userId = req.user.claims.sub;

    // Authorization: same unlock check as /api/tts/generate to prevent information leakage
    const unit = await storage.getLessonUnit(unitId);
    if (!unit) return res.status(404).json({ error: "Unit not found" });
    const mastery = await storage.getOrCreateTopicMastery(userId, unit.topicId);
    const isAdmin = await isAdminUser(userId);
    if (!isUnitUnlocked(unit.difficulty, mastery, isAdmin)) {
      return res.status(403).json({ error: "This lesson is locked" });
    }

    const ttsSettings = await storage.getTtsSettings(userId);
    const { hashVoiceConfig, hashBase64 } = await import("../tts-service");
    // Only include referenceAudio in the hash when preset is "custom" — matches /api/tts/generate behavior
    const isCustomPreset = ttsSettings.voicePreset === "custom";
    const refHash = (isCustomPreset && ttsSettings.referenceAudio) ? hashBase64(ttsSettings.referenceAudio) : undefined;
    const configHash = hashVoiceConfig(ttsSettings.voicePreset, refHash);
    const cached = await storage.getTtsAudioCache(unitId, configHash);
    res.json({ cached: !!cached, voicePreset: ttsSettings.voicePreset });
  } catch (err) {
    res.json({ cached: false });
  }
});
}

// PREDICTIVE PRE-GENERATION HELPERS
// ============================================

const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced", "nextgen"];

export async function predictivelyGenerateNextUnit(
  currentUnit: { id?: number; topicId: number; difficulty: string; unitIndex: number },
  topic: { title: string; description: string },
  masteredTopics: { topicId: number; topicTitle: string }[],
  userId: string,
  categoryName?: string
): Promise<void> {
  try {
    const allUnits = await storage.getLessonUnits(currentUnit.topicId);
    const diffUnits = allUnits
      .filter(u => u.difficulty === currentUnit.difficulty)
      .sort((a, b) => a.unitIndex - b.unitIndex);

    let nextUnit: typeof allUnits[0] | undefined;

    // Try next unit by unitIndex (normal case)
    const nextInDiff = diffUnits.find(u => u.unitIndex === currentUnit.unitIndex + 1);
    if (nextInDiff) {
      nextUnit = nextInDiff;
    } else {
      // Fallback: find the unit after the current one by array position (handles duplicate unitIndex values)
      const currentPosInDiff = currentUnit.id
        ? diffUnits.findIndex(u => u.id === currentUnit.id)
        : diffUnits.findIndex(u => u.unitIndex === currentUnit.unitIndex);
      if (currentPosInDiff >= 0 && currentPosInDiff + 1 < diffUnits.length) {
        nextUnit = diffUnits[currentPosInDiff + 1];
      } else {
        // Try first unit of next difficulty
        const currentDiffIdx = DIFFICULTY_ORDER.indexOf(currentUnit.difficulty);
        if (currentDiffIdx >= 0 && currentDiffIdx < DIFFICULTY_ORDER.length - 1) {
          const nextDiff = DIFFICULTY_ORDER[currentDiffIdx + 1];
          const nextDiffUnits = allUnits
            .filter(u => u.difficulty === nextDiff)
            .sort((a, b) => a.unitIndex - b.unitIndex);
          nextUnit = nextDiffUnits[0];
        }
      }
    }

    if (!nextUnit) return;

    const isNextGen = nextUnit.difficulty === "nextgen";

    // Build sibling context for the next unit
    const nextTierUnits = allUnits
      .filter(u => u.difficulty === nextUnit!.difficulty)
      .sort((a, b) => a.unitIndex - b.unitIndex);
    const nextPosInTier = nextTierUnits.findIndex(u => u.id === nextUnit!.id);
    const nextUnitContext = {
      position: nextPosInTier + 1,
      total: nextTierUnits.length,
      siblingTitles: nextTierUnits.filter(u => u.id !== nextUnit!.id).map(u => u.title),
    };

    // If content already exists, still attempt TTS pre-caching (don't return early)
    let content = nextUnit.contentJson;

    if (!content) {
      console.log(`[Predictive] Pre-generating content for unit ${nextUnit.id} "${nextUnit.title}" (${nextUnit.difficulty} ${nextUnitContext.position}/${nextUnitContext.total})`);
      const generated = isNextGen
        ? await generateNextGenContent(topic, nextUnit, masteredTopics, categoryName)
        : await generateLessonContent(topic, nextUnit, masteredTopics, categoryName, nextUnitContext);

      const isPlaceholder = typeof generated === "object" && generated !== null &&
        "_isPlaceholder" in generated && Boolean((generated as Record<string, unknown>)._isPlaceholder);
      if (!isPlaceholder) {
        console.log(`[Lesson] unit_id=${nextUnit.id} title="${nextUnit.title}" content_hash=${contentHash(generated)} (predictive-generated)`);
        await storage.updateLessonContent(nextUnit.id, generated);
        console.log(`[Predictive] Saved content for unit ${nextUnit.id}`);
        content = generated;
      }
    }

    // Always attempt TTS pre-caching whenever we have content (covers both new and existing content)
    if (content) {
      await preTTSForUnit(userId, nextUnit.id, content, isNextGen);
    }
  } catch (err: unknown) {
    console.warn("[Predictive] Pre-generation error:", err instanceof Error ? err.message : String(err));
  }
}

export async function revalidateUnitLinks(unitId: number, content: unknown): Promise<void> {
  try {
    const { revalidateStoredContent } = await import("../link-validator");
    const { content: updatedContent, changed } = await revalidateStoredContent(content);
    if (changed) {
      await storage.updateLessonContent(unitId, updatedContent as import("@shared/schema").LessonContent | import("@shared/schema").NextGenContent);
      console.log(`[LinkValidator] Updated stale links for unit ${unitId}`);
    }
  } catch (err: unknown) {
    console.warn("[LinkValidator] Revalidation error:", err instanceof Error ? err.message : String(err));
  }
}

export async function preTTSForUnit(userId: string, unitId: number, content: unknown, isNextGen: boolean): Promise<void> {
  try {
    const ttsSettings = await storage.getTtsSettings(userId);
    if (!ttsSettings.voicePreset || ttsSettings.voicePreset === "browser") return;

    const { hashVoiceConfig, hashBase64, generateTTSAudio } = await import("../tts-service");
    // Only include referenceAudio in hash when preset is "custom" — must match /api/tts/generate and /api/tts/cache-status
    const isCustomPreset = ttsSettings.voicePreset === "custom";
    const referenceAudio = isCustomPreset ? (ttsSettings.referenceAudio || undefined) : undefined;
    const refHash = referenceAudio ? hashBase64(referenceAudio) : undefined;
    const configHash = hashVoiceConfig(ttsSettings.voicePreset, refHash);

    const existing = await storage.getTtsAudioCache(unitId, configHash);
    if (existing) return;

    const userProfile = await storage.getUserProfile(userId);
    const result = await generateTTSAudio({
      unitId,
      content,
      isNextGen,
      voicePreset: ttsSettings.voicePreset,
      referenceAudio,
      hfToken: userProfile?.huggingFaceToken || undefined,
    });

    if (result) {
      console.log(`[PreTTS] Cached TTS audio for unit ${unitId}`);
    }
    // Note: generateTTSAudio() already writes to cache internally — no double-save needed here
  } catch (err: unknown) {
    console.warn("[PreTTS] Pre-generation error:", err instanceof Error ? err.message : String(err));
  }
}

// Generate custom topic content using AI
export async function generateCustomTopicContent(customTopicId: number, title: string, description: string, userId?: string) {
  try {
    await storage.updateCustomTopicStatus(customTopicId, "generating");
    
    // Generate a category for this topic
    const categoryPrompt = `Given the learning topic "${title}" (${description}), suggest the best category name, color (purple, blue, green, orange, pink, or teal), and icon (Brain, Code, Calculator, Beaker, Atom, Book, Music, Wrench, Rocket, Leaf, Flask, or Lightbulb) for this topic. Return JSON: { "name": "Category Name", "color": "blue", "icon": "Code" }`;
    
    const categoryContent = await generateCourseContent(
      [{ role: "user", content: categoryPrompt }],
      { responseFormat: "json" }
    ) || "{}";
    
    const categoryData = JSON.parse(categoryContent);
    
    // Create or find category
    let category;
    try {
      category = await storage.createCategory({
        name: categoryData.name || title,
        color: categoryData.color || "blue",
        icon: categoryData.icon || "Book",
      });
    } catch (e) {
      // Category might already exist
      const categories = await storage.getCategories();
      category = categories.find(c => c.name === categoryData.name) || categories[0];
    }
    
    // Create the topic
    const topic = await storage.createTopic({
      title,
      description,
      categoryId: category.id,
      difficulty: "beginner",
    });
    
    // Generate lesson outline (also saves units to DB internally)
    const units = await generateLessonOutline(topic.id, title, description);

    // Mark topic as ready before batch pre-generation so frontend can show the outline
    await storage.updateCustomTopicStatus(customTopicId, "ready", topic.id, category.id);

    // Fire background batch pre-generation for all non-nextgen units
    if (userId) {
      batchPregenerateUnits(units, { title, description }, userId).catch(console.error);
    }
    
  } catch (error) {
    console.error("Error generating custom topic:", error);
    await storage.updateCustomTopicStatus(customTopicId, "failed");
  }
}

// Helper function to check if a difficulty level is unlocked
// If isAdmin is true, all levels are unlocked (admin bypass)
export function isUnitUnlocked(
  difficulty: string, 
  mastery: { beginnerUnlocked: boolean; intermediateUnlocked: boolean; advancedUnlocked: boolean; nextgenUnlocked?: boolean; keyUnlocked?: boolean },
  isAdmin: boolean = false
): boolean {
  if (isAdmin) return true;
  if (mastery.keyUnlocked) return true;
  
  switch (difficulty) {
    case "beginner": return mastery.beginnerUnlocked;
    case "intermediate": return mastery.intermediateUnlocked;
    case "advanced": return mastery.advancedUnlocked;
    case "nextgen": return mastery.nextgenUnlocked ?? false;
    default: return mastery.beginnerUnlocked;
  }
}

// Background batch pre-generation helper — called fire-and-forget after outline creation.
// Generates lesson content for all non-nextgen units that don't yet have content.
export async function batchPregenerateUnits(
  units: { id: number; topicId?: number; title: string; difficulty: string; outline?: string | null; contentJson?: unknown }[],
  topic: { title: string; description: string },
  userId: string
): Promise<void> {
  try {
    const unitsToGenerate = units.filter(u => u.difficulty !== "nextgen" && !u.contentJson);
    if (unitsToGenerate.length === 0) {
      console.log(`[BatchPregen] All units for "${topic.title}" already have content — skipping`);
      return;
    }

    console.log(`[BatchPregen] Starting pre-generation for ${unitsToGenerate.length} non-nextgen units of "${topic.title}"`);

    const contentMap = new Map<number, any>();

    // ── Try seed content first (fast, offline, deterministic) ───────────────
    for (const unit of unitsToGenerate) {
      const topicId = unit.topicId;
      if (topicId && SEED_LESSON_CONTENT[topicId]) {
        const seed = SEED_LESSON_CONTENT[topicId].find(
          s => s.unitIndex === (unit as any).unitIndex && s.difficulty === unit.difficulty
        );
        if (seed?.contentJson) {
          contentMap.set(unit.id, seed.contentJson);
          console.log(`[BatchPregen] unit_id=${unit.id} — seed content hit`);
        }
      }
    }

    // ── Fall back to AI for any units without seed content ──────────────────
    const aiUnits = unitsToGenerate.filter(u => !contentMap.has(u.id));
    if (aiUnits.length > 0) {
      console.log(`[BatchPregen] ${aiUnits.length} units need AI generation for "${topic.title}"`);
      const masteredTopics = await storage.getUserMasteredTopics(userId);
      const aiContentMap = await generateBatchLessonContent(topic, aiUnits, masteredTopics);
      for (const [unitId, content] of Array.from(aiContentMap.entries())) {
        contentMap.set(unitId, content);
      }
    }

    let savedCount = 0;
    for (const [unitId, content] of Array.from(contentMap.entries())) {
      try {
        // Re-fetch to avoid overwriting content saved by a concurrent on-demand request
        const latestUnit = await storage.getLessonUnit(unitId);
        if (latestUnit && !latestUnit.contentJson) {
          await storage.updateLessonContent(unitId, content);
          console.log(`[BatchPregen] unit_id=${unitId} content_hash=${contentHash(content)} (saved)`);
          savedCount++;
        } else {
          console.log(`[BatchPregen] unit_id=${unitId} already has content — skipping save`);
        }
      } catch (err) {
        console.warn(`[BatchPregen] Failed to save content for unit ${unitId}:`, err instanceof Error ? err.message : String(err));
      }
    }

    console.log(`[BatchPregen] Completed: ${savedCount}/${unitsToGenerate.length} units saved for "${topic.title}"`);

    // ── TTS Pre-generation: pre-cache audio for all server voice presets ─────
    // This ensures constrained devices (Tesla, old iPhone) that can't run Kokoro
    // have cached server audio available immediately when they select Browser TTS or Qwen.
    // Run in background — don't block the response.
    const serverVoicePresets = ["qwen"]; // OpenAI-mapped presets available server-side
    const { preGenerateTTSForUnit } = await import("../tts-service");
    for (const [unitId, content] of Array.from(contentMap.entries())) {
      for (const voicePreset of serverVoicePresets) {
        preGenerateTTSForUnit(unitId, content, false, voicePreset)
          .catch((err: unknown) => console.debug(`[BatchPregen] TTS pregen failed for unit ${unitId} voice ${voicePreset}:`, err instanceof Error ? err.message : String(err)));
      }
    }
    console.log(`[BatchPregen] TTS pre-generation started for ${contentMap.size} units × ${serverVoicePresets.length} voices`);
  } catch (err) {
    console.warn(`[BatchPregen] Error during batch pre-generation for "${topic.title}":`, err instanceof Error ? err.message : String(err));
  }
}

// Generate lesson outline using AI
/**
 * Classify a topic into a depth profile to determine optimal lesson distribution.
 * Deep science topics get more units per tier; narrow tool topics get fewer.
 */
interface TopicDepthProfile {
  category: "narrow_tool" | "focused" | "standard" | "broad" | "deep_science";
  unitsPerTier: { beginner: number; intermediate: number; advanced: number; nextgen: number };
  contentType: "code_heavy" | "formula_heavy" | "visual_heavy" | "theory_heavy" | "balanced";
}

export function classifyTopicByKeywords(title: string, description: string): TopicDepthProfile {
  const text = `${title} ${description}`.toLowerCase();

  // ── Explicit overrides for known platform topics (guarantees consistency) ──
  const normalizedTitle = title.toLowerCase().trim();
  const explicitOverrides = new Map<string, TopicDepthProfile>([
    ["machine learning", { category: "deep_science", unitsPerTier: { beginner: 5, intermediate: 6, advanced: 6, nextgen: 5 }, contentType: "theory_heavy" }],
    ["linear algebra", { category: "broad", unitsPerTier: { beginner: 4, intermediate: 5, advanced: 5, nextgen: 4 }, contentType: "formula_heavy" }],
    ["data structures", { category: "broad", unitsPerTier: { beginner: 4, intermediate: 4, advanced: 4, nextgen: 3 }, contentType: "code_heavy" }],
    ["quantum mechanics", { category: "deep_science", unitsPerTier: { beginner: 5, intermediate: 6, advanced: 6, nextgen: 5 }, contentType: "theory_heavy" }],
    ["calculus", { category: "broad", unitsPerTier: { beginner: 4, intermediate: 5, advanced: 5, nextgen: 4 }, contentType: "formula_heavy" }],
    ["graph theory", { category: "broad", unitsPerTier: { beginner: 4, intermediate: 4, advanced: 4, nextgen: 3 }, contentType: "formula_heavy" }],
    ["algorithms", { category: "broad", unitsPerTier: { beginner: 4, intermediate: 4, advanced: 4, nextgen: 3 }, contentType: "code_heavy" }],
    ["neural networks", { category: "deep_science", unitsPerTier: { beginner: 5, intermediate: 6, advanced: 6, nextgen: 5 }, contentType: "theory_heavy" }],
    ["hugging face", { category: "narrow_tool", unitsPerTier: { beginner: 2, intermediate: 2, advanced: 2, nextgen: 2 }, contentType: "code_heavy" }],
    ["gradio", { category: "narrow_tool", unitsPerTier: { beginner: 2, intermediate: 2, advanced: 2, nextgen: 2 }, contentType: "code_heavy" }],
    ["benefits of open source", { category: "focused", unitsPerTier: { beginner: 3, intermediate: 3, advanced: 3, nextgen: 3 }, contentType: "balanced" }],
    ["classical mechanics", { category: "broad", unitsPerTier: { beginner: 4, intermediate: 5, advanced: 5, nextgen: 4 }, contentType: "formula_heavy" }],
    ["orbital mechanics", { category: "broad", unitsPerTier: { beginner: 4, intermediate: 5, advanced: 5, nextgen: 4 }, contentType: "formula_heavy" }],
    ["optics & light", { category: "broad", unitsPerTier: { beginner: 4, intermediate: 4, advanced: 4, nextgen: 3 }, contentType: "theory_heavy" }],
    ["fluid dynamics", { category: "deep_science", unitsPerTier: { beginner: 5, intermediate: 6, advanced: 6, nextgen: 5 }, contentType: "theory_heavy" }],
    ["electromagnetism", { category: "deep_science", unitsPerTier: { beginner: 5, intermediate: 6, advanced: 6, nextgen: 5 }, contentType: "theory_heavy" }],
    ["waves & frequencies", { category: "broad", unitsPerTier: { beginner: 4, intermediate: 4, advanced: 4, nextgen: 3 }, contentType: "formula_heavy" }],
    ["general chemistry", { category: "broad", unitsPerTier: { beginner: 4, intermediate: 4, advanced: 4, nextgen: 3 }, contentType: "formula_heavy" }],
    ["organic chemistry", { category: "deep_science", unitsPerTier: { beginner: 5, intermediate: 6, advanced: 6, nextgen: 5 }, contentType: "theory_heavy" }],
    ["music theory", { category: "broad", unitsPerTier: { beginner: 4, intermediate: 4, advanced: 4, nextgen: 3 }, contentType: "balanced" }],
  ]);
  if (explicitOverrides.has(normalizedTitle)) {
    return explicitOverrides.get(normalizedTitle)!;
  }

  // ── Heuristic classification for unknown / custom topics ──

  // Deep science / broad interdisciplinary — 5-6 per tier
  const deepScienceTerms = [
    "quantum", "relativity", "thermodynamics", "electrodynamics", "field theory",
    "particle physics", "astrophysic", "cosmolog", "general relativity", "string theory",
    "machine learning", "deep learning", "neural network", "fluid dynamics", "turbulence",
    "biochemistry", "molecular biology", "organic chemistry", "inorganic chemistry",
    "number theory", "topology", "abstract algebra", "differential geometry",
    "compiler", "operating system", "distributed system", "cryptography",
    "neuroscience", "materials science", "genomics", "proteomics",
  ];

  // Broad topics — 4-5 per tier
  const broadTerms = [
    "physics", "mathematics", "computer science", "engineering", "chemistry",
    "biology", "calculus", "linear algebra", "algorithms", "data structures",
    "electromagnetism", "optics", "waves", "classical mechanics", "music theory",
    "genetics", "ecology", "economics", "psychology", "philosophy",
    "mechatronics", "embedded systems", "iot", "cyber-physical",
  ];

  // Focused topics — 3 per tier (domain-specific but not tool-narrow)
  const focusedTerms = [
    "open source", "contributing", "community", "ethics", "history of",
    "philosophy of", "design pattern", "workflow", "methodology",
  ];

  // Narrow tool-focused — 2 per tier
  const narrowTerms = [
    "how to use", "introduction to", "getting started with", "tutorial",
    "guide to", "using ", "installing", "setting up", "demo", "app",
  ];

  // Content-type indicators
  const codeTerms = ["python", "javascript", "typescript", "react", "node", "api", "programming", "coding", "software", "algorithm", "data structure", "gradio", "hugging face", "git", "library", "framework"];
  const formulaTerms = ["calculus", "algebra", "equation", "derivative", "integral", "theorem", "proof", "quantum", "thermodynamics", "electrodynamics", "mechanics", "wave function", "differential", "navier-stokes", "maxwell", "schrodinger", "eigenvalue", "tensor"];
  const theoryTerms = ["fluid dynamic", "quantum", "relativity", "field theory", "thermodynamic", "electromagnetic", "optics", "wave-particle", "entropy", "hamiltonian", "lagrangian", "gauge theory", "renormalization"];
  const visualTerms = ["geometry", "topology", "graph", "network", "visualization", "diagram", "cymatics", "standing wave", "interference pattern"];

  const isDeep = deepScienceTerms.some(t => text.includes(t));
  const isBroad = broadTerms.some(t => text.includes(t));
  const isFocused = focusedTerms.some(t => text.includes(t));
  const isNarrow = narrowTerms.some(t => text.includes(t));

  const isCodeHeavy = codeTerms.some(t => text.includes(t));
  const isFormulaHeavy = formulaTerms.some(t => text.includes(t));
  const isTheoryHeavy = theoryTerms.some(t => text.includes(t));
  const isVisualHeavy = visualTerms.some(t => text.includes(t));

  let contentType: TopicDepthProfile["contentType"] = "balanced";
  if (isTheoryHeavy && isFormulaHeavy) contentType = "theory_heavy";
  else if (isTheoryHeavy) contentType = "theory_heavy";
  else if (isFormulaHeavy && !isCodeHeavy) contentType = "formula_heavy";
  else if (isCodeHeavy && !isFormulaHeavy) contentType = "code_heavy";
  else if (isCodeHeavy && isFormulaHeavy) contentType = "formula_heavy"; // math+code = prioritize formulas
  else if (isVisualHeavy) contentType = "visual_heavy";

  if (isDeep) {
    return {
      category: "deep_science",
      unitsPerTier: { beginner: 5, intermediate: 6, advanced: 6, nextgen: 5 },
      contentType,
    };
  } else if (isBroad) {
    return {
      category: "broad",
      unitsPerTier: { beginner: 4, intermediate: 4, advanced: 4, nextgen: 3 },
      contentType,
    };
  } else if (isFocused) {
    return {
      category: "focused",
      unitsPerTier: { beginner: 3, intermediate: 3, advanced: 3, nextgen: 3 },
      contentType,
    };
  } else if (isNarrow) {
    return {
      category: "narrow_tool",
      unitsPerTier: { beginner: 2, intermediate: 2, advanced: 2, nextgen: 2 },
      contentType,
    };
  } else {
    return {
      category: "standard",
      unitsPerTier: { beginner: 3, intermediate: 3, advanced: 3, nextgen: 3 },
      contentType,
    };
  }
}

export async function generateLessonOutline(topicId: number, topicTitle: string, topicDescription: string): Promise<any[]> {
  // ── Use pre-planned syllabus if available ───────────────────────────────────
  const plannedSyllabus = SYLLABI_MAP.get(topicId);
  if (plannedSyllabus) {
    console.log(`[Outline] Using pre-planned syllabus for "${topicTitle}" (${plannedSyllabus.units.length} units, ${plannedSyllabus.contentType})`);
    const { storage } = await import("../storage");
    const createdUnits = await Promise.all(
      plannedSyllabus.units.map((u, idx) => storage.createLessonUnit({
        topicId,
        difficulty: u.tier,
        contentType: plannedSyllabus.contentType,
        unitIndex: u.position - 1,
        title: u.title,
        outline: `${u.objective} Key concepts: ${u.keyConcepts.join(", ")}`,
      }))
    );
    console.log(`[Outline] Created ${createdUnits.length} units from pre-planned syllabus for "${topicTitle}"`);
    return createdUnits;
  }

  const profile = classifyTopicByKeywords(topicTitle, topicDescription);
  const tierInfo = profile.unitsPerTier;

  const contentTypeGuidance = profile.contentType === "code_heavy"
    ? `This is a CODE-HEAVY topic. Include runnable code examples in most units. Beginner units should show simple one-liners; intermediate should show functions/classes; advanced should show architecture patterns.`
    : profile.contentType === "formula_heavy"
    ? `This is a FORMULA-HEAVY topic. Include mathematical notation and derivations. Beginner units should use intuition-first explanations; intermediate should introduce equations with plain-English glosses and worked numerical examples; advanced should use formal mathematical arguments.`
    : profile.contentType === "theory_heavy"
    ? `This is a THEORY-HEAVY topic. Every unit must define technical terms precisely on first use, include key equations with LaTeX and plain-English variable explanations, provide intuitive derivations step-by-step, and connect abstract theory to observable phenomena. Beginner: analogy-first, then introduce the minimal equation; Intermediate: full derivations with physical interpretation at each step; Advanced: compare competing theoretical frameworks and discuss their regimes of validity.`
    : profile.contentType === "visual_heavy"
    ? `This is a VISUAL-HEAVY topic. Describe diagrams, graphs, and spatial relationships in detail. Include Mermaid.js diagrams where helpful. Beginner: concrete visual analogies; Intermediate: structured diagrams with labeled components; Advanced: complex visual proofs or multi-scale visualizations.`
    : `This is a CONCEPT-HEAVY topic. Focus on clear explanations, analogies, and thought experiments. Code and formulas are optional — use them only when they genuinely clarify the concept.`;

  const prompt = `You are an expert curriculum designer. Create a structured learning outline for the topic "${topicTitle}".

Topic Description: ${topicDescription}

Topic Classification: ${profile.category} (${profile.contentType})
${contentTypeGuidance}

Create a course outline with units across FOUR difficulty levels. The target unit counts for THIS specific topic are:
- Beginner: ${tierInfo.beginner} units
- Intermediate: ${tierInfo.intermediate} units
- Advanced: ${tierInfo.advanced} units
- Next Gen: ${tierInfo.nextgen} units

Every unit must have a UNIQUE title covering DISTINCT material — no two units in the same tier may overlap in content.

Respond with a JSON object in this exact format (replace with real content for "${topicTitle}"):
{
  "units": [
    {"difficulty": "beginner", "unitIndex": 0, "title": "...", "outline": "..."},
    {"difficulty": "beginner", "unitIndex": 1, "title": "...", "outline": "..."},
    ...
    {"difficulty": "intermediate", "unitIndex": 0, "title": "...", "outline": "..."},
    ...
    {"difficulty": "advanced", "unitIndex": 0, "title": "...", "outline": "..."},
    ...
    {"difficulty": "nextgen", "unitIndex": 0, "title": "...", "outline": "..."},
    ...
  ]
}

CRITICAL RULES:
- Produce EXACTLY ${tierInfo.beginner} beginner, ${tierInfo.intermediate} intermediate, ${tierInfo.advanced} advanced, and ${tierInfo.nextgen} nextgen units (${tierInfo.beginner + tierInfo.intermediate + tierInfo.advanced + tierInfo.nextgen} total).
- Every unit title must be UNIQUE and cover a DIFFERENT aspect of "${topicTitle}" — no overlapping content within a tier.
- unitIndex MUST be sequential starting from 0 within each difficulty (0, 1, 2, ...).
- Titles must be specific to "${topicTitle}", not generic placeholders.
- Outlines must describe exactly what that specific unit covers (1-2 sentences).
- Beginner: everyday language, no jargon, spark curiosity. Focus on "what is it?" and "why does this matter?"
- Intermediate: mechanisms, frameworks, how things work under the hood.
- Advanced: current research, edge cases, expert-level nuances, competing paradigms.
- Next Gen: unsolved problems, active research questions, frontier exploration, cross-domain connections.`;

  try {
    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.7 }
    ) || "{}";

    const parsed = JSON.parse(content);
    
    if (!parsed.units || !Array.isArray(parsed.units)) {
      throw new Error("Invalid AI response format");
    }

    // Normalize unitIndex values and enforce per-tier counts matching the topic profile.
    const DIFFICULTIES = ["beginner", "intermediate", "advanced", "nextgen"];
    const tierTargets: Record<string, number> = {
      beginner: tierInfo.beginner,
      intermediate: tierInfo.intermediate,
      advanced: tierInfo.advanced,
      nextgen: tierInfo.nextgen,
    };
    // Generic fallback per difficulty when the AI returns wrong count
    const tierDefaults: Record<string, any[]> = {
      beginner: Array.from({ length: tierInfo.beginner }, (_, i) => ({
        difficulty: "beginner", title: i === 0 ? "Introduction & Basics" : i === 1 ? "Core Concepts" : `Foundations Part ${i}`,
        outline: i === 0 ? `Get started with the fundamentals of ${topicTitle}` : "Learn the essential terms and ideas",
      })),
      intermediate: Array.from({ length: tierInfo.intermediate }, (_, i) => ({
        difficulty: "intermediate", title: i === 0 ? "Deeper Mechanisms" : i === 1 ? "Practical Applications" : `Advanced Patterns Part ${i}`,
        outline: i === 0 ? "Understand how things work under the hood" : "Apply your knowledge to real scenarios",
      })),
      advanced: Array.from({ length: tierInfo.advanced }, (_, i) => ({
        difficulty: "advanced", title: i === 0 ? "Edge Cases" : i === 1 ? "Current Research" : `Expert Topics Part ${i}`,
        outline: i === 0 ? "Explore unusual situations and exceptions" : "Discover what experts are working on today",
      })),
      nextgen: Array.from({ length: tierInfo.nextgen }, (_, i) => ({
        difficulty: "nextgen", title: i === 0 ? "Open Research Questions" : i === 1 ? "Industry Frontiers" : `Frontier Exploration Part ${i}`,
        outline: i === 0 ? "Explore unsolved problems and cutting-edge questions" : "Discover active challenges and emerging opportunities",
      })),
    };

    const unitsByDiff: Record<string, any[]> = {};
    for (const u of parsed.units) {
      if (!unitsByDiff[u.difficulty]) unitsByDiff[u.difficulty] = [];
      unitsByDiff[u.difficulty].push(u);
    }
    const normalizedUnits: any[] = [];
    for (const diff of DIFFICULTIES) {
      let diffUnits = unitsByDiff[diff] || [];
      const target = tierTargets[diff];
      if (diffUnits.length !== target) {
        const originalCount = diffUnits.length;
        diffUnits = tierDefaults[diff] || tierDefaults["beginner"];
        console.warn(`[Outline] Tier "${diff}" had ${originalCount} units (expected ${target}); defaulted to ${diffUnits.length} units`);
      }
      // Re-assign sequential unitIndex regardless of what the AI returned
      diffUnits.forEach((u, i) => {
        normalizedUnits.push({ ...u, difficulty: diff, unitIndex: i });
      });
    }
    console.log(`[Outline] Topic "${topicTitle}" (${profile.category}/${profile.contentType}): ` +
      DIFFICULTIES.map(d => `${d}=${normalizedUnits.filter(u => u.difficulty === d).length}`).join(", ") +
      ` (${normalizedUnits.length} total)`);

    // Save units to database
    const { storage } = await import("../storage");
    const createdUnits = await Promise.all(
      normalizedUnits.map((u: any) => storage.createLessonUnit({
        topicId,
        difficulty: u.difficulty,
        contentType: profile.contentType,
        unitIndex: u.unitIndex,
        title: u.title,
        outline: u.outline,
      }))
    );

    console.log(`[Outline] Created ${createdUnits.length} units for topic "${topicTitle}"`);
    return createdUnits;
  } catch (error) {
    console.error("Error generating lesson outline:", error);
    // Return default outline on failure
    return getDefaultLessonUnits(topicId, topicTitle);
  }
}

// Generate ALL lesson content for a topic in a single batch API call
// This is more cost-effective than generating content per-unit
export async function generateBatchLessonContent(
  topic: { title: string; description: string },
  units: { id: number; title: string; difficulty: string; outline?: string | null }[],
  masteredTopics: { topicId: number; topicTitle: string }[]
): Promise<Map<number, any>> {
  const profile = classifyTopicByKeywords(topic.title, topic.description);
  const crossTopicContext = masteredTopics.length > 0
    ? `The learner has already mastered these topics: ${masteredTopics.map(t => t.topicTitle).join(", ")}. When relevant, draw connections to these concepts they already understand.`
    : "";

  // Group units by difficulty for the prompt
  const beginnerUnits = units.filter(u => u.difficulty === "beginner");
  const intermediateUnits = units.filter(u => u.difficulty === "intermediate");
  const advancedUnits = units.filter(u => u.difficulty === "advanced");
  // Note: nextgen units use a different content structure and are generated separately

  const unitsList = [...beginnerUnits, ...intermediateUnits, ...advancedUnits];
  
  if (unitsList.length === 0) {
    return new Map();
  }

  // Build per-tier position labels so the AI knows each unit's position within its difficulty tier
  const tierPositionCounters: Record<string, number> = {};
  const tierTotals: Record<string, number> = {
    beginner: beginnerUnits.length,
    intermediate: intermediateUnits.length,
    advanced: advancedUnits.length,
  };
  const unitsDescription = unitsList.map((u, i) => {
    if (!tierPositionCounters[u.difficulty]) tierPositionCounters[u.difficulty] = 0;
    tierPositionCounters[u.difficulty]++;
    const pos = tierPositionCounters[u.difficulty];
    const total = tierTotals[u.difficulty];
    const siblings = unitsList
      .filter(s => s.difficulty === u.difficulty && s.id !== u.id)
      .map(s => `"${s.title}"`).join(", ");
    const siblingNote = siblings ? ` | Other ${u.difficulty} units: ${siblings}` : "";
    return `${i + 1}. [${u.difficulty.toUpperCase()} Unit ${pos}/${total}] "${u.title}" - ${u.outline || "No description"}${siblingNote}`;
  }).join("\n");

  const precisionRules = `
PRECISION AND ANTI-FILLER RULES (apply to ALL tiers):
- Every sentence must convey new information. No filler phrases like "It is important to note that...", "In today's rapidly evolving landscape...", "As we all know...", "Needless to say...", or "It goes without saying..."
- concept section: 2-3 tight paragraphs maximum. Each paragraph must end with a fact, implication, or question — never a summary restating what was just said.
- If you cannot add new information, stop writing.
- Write like a brilliant friend explaining something at a coffee shop — clear, direct, enthusiastic but not rambling.
- Use active voice. Prefer short sentences for key points. Longer sentences only when the idea demands it.`;

  const contentTypeRules = profile.contentType === "code_heavy"
    ? `\nCONTENT TYPE: CODE-HEAVY
- Include runnable code examples in most units. Beginner: simple one-liners with comments. Intermediate: functions/classes with test cases. Advanced: architecture patterns with trade-off analysis.
- Code must have inline comments explaining non-obvious lines.
- Include at least one "try modifying this" challenge in each example section.
- externalResources should prioritize interactive coding platforms and runnable notebooks.`
    : profile.contentType === "formula_heavy"
    ? `\nCONTENT TYPE: FORMULA-HEAVY
- Include actual equations rendered in LaTeX: $$E = mc^2$$
- Each equation must be accompanied by "what each variable means in plain English" immediately after.
- Include at least one worked numerical example per intermediate+ unit.
- Derivation steps must be explained intuitively, not just algebraically.
- externalResources should prioritize MIT OCW problem sets and textbook chapters with exercises.`
    : profile.contentType === "theory_heavy"
    ? `\nCONTENT TYPE: THEORY-HEAVY
- Define every technical term precisely on first use; never assume prior jargon knowledge.
- Include key equations in LaTeX with explicit plain-English variable explanations.
- Provide intuitive derivations step-by-step, connecting each step to observable phenomena.
- For intermediate+: include at least one worked numerical example and one conceptual "what if" scenario.
- For advanced: compare competing theoretical frameworks, discuss regimes of validity, and cite landmark papers.
- externalResources should prioritize lecture notes, foundational textbooks, and peer-reviewed survey papers.`
    : profile.contentType === "visual_heavy"
    ? `\nCONTENT TYPE: VISUAL-HEAVY
- Describe diagrams, graphs, and spatial relationships in vivid detail so a learner could sketch them.
- Include a Mermaid.js diagram string in most units (flowchart, graph, or sequence).
- Beginner: concrete visual analogies; Intermediate: structured diagrams with labeled components; Advanced: complex visual proofs or multi-scale visualizations.
- externalResources should prioritize interactive simulations, visual explainer videos, and diagram-rich references.`
    : `\nCONTENT TYPE: CONCEPT-HEAVY
- Focus on clear explanations, analogies, and thought experiments.
- Code and formulas are optional — use them only when they genuinely clarify the concept.
- Include visual descriptions of what a diagram would show (for future rendering).
- externalResources should prioritize video explanations and interactive visualizations.`;

  const prompt = `You are an expert curriculum designer creating a deep, engaging learning journey for "${topic.title}".

Topic Description: ${topic.description}

Topic Classification: ${profile.category} (${profile.contentType})${contentTypeRules}

${crossTopicContext}

Create content for these ${unitsList.length} units. Each unit MUST cover DIFFERENT material — do not duplicate concepts across units in the same tier. The unit position (e.g., "Unit 2/3") and the list of sibling unit titles tell you what the other lessons cover so you can write DISTINCT content for each:
${unitsDescription}
${precisionRules}

Respond with a JSON object where each key is the unit index (0, 1, 2...) and each value is the lesson content.

CRITICAL: Each unit MUST include "keyTakeaways" (3-5 bullet points) and "externalResources" (2-5 real, specific links). See requirements below.

OPEN EDUCATIONAL RESOURCES (OER) PRIORITY:
When recommending external resources, PRIORITIZE openly licensed, free educational materials:
- MIT OpenCourseWare (ocw.mit.edu) — free university courses with full materials
- Khan Academy (khanacademy.org) — free K-12+ lessons with exercises
- OpenStax (openstax.org) — free peer-reviewed textbooks
- LibreTexts (libretexts.org) — free collaborative textbook library
- Wikiversity (en.wikiversity.org) — community-created learning resources
- arXiv (arxiv.org) — free preprint papers for STEM
- YouTube educational channels (CrashCourse, MIT OCW, Stanford, 3Blue1Brown)
- Project Gutenberg (gutenberg.org) — free public domain books
- freeCodeCamp (freecodecamp.org) — free coding curriculum
Only use paid resources (Coursera, Udemy, journals) when no free OER equivalent exists for the topic.
Every URL must be hyper-specific (link to the actual course/article, not a homepage).

NOTE: Grokipedia (grokipedia.com) is a high-quality encyclopedia — you may include relevant Grokipedia page links (e.g., https://grokipedia.com/page/${topic.title.replace(/ /g, "_")}) if they add value alongside other resources.

JSON format:
{
  "0": {
    "concept": "Engaging explanation (2-3 paragraphs with a story hook, real-world relevance, and clear 'why this matters')",
    "keyTakeaways": ["Key point 1", "Key point 2", "Key point 3"],
    "mermaidDiagram": "Optional. A raw Mermaid.js graph string (no markdown ticks) illustrating the concept",
    "analogy": "Creative, memorable real-world analogy that makes the concept click",
    "example": {
      "title": "Example title",
      "content": "Detailed worked example with concrete details",
      "code": "Optional code snippet if relevant"
    },
    "quiz": [],
    "crossLinks": [],
    "externalResources": [
      {
        "title": "Resource title",
        "url": "https://actual-url.com",
        "type": "video|course|paper|book|forum|tool|encyclopedia",
        "description": "What this resource offers and why it's worth exploring"
      }
    ]
  },
  "1": { ... },
  ...
}

TIER-SPECIFIC REQUIREMENTS:

BEGINNER units MUST:
- Open with a captivating real-world story or surprising fact that hooks curiosity
- Use zero jargon - explain everything with everyday language and analogies
- Focus on "what is it?" and "why does this matter to my life?"
- Show the human story behind the discovery or invention
- externalResources: 2-3 beginner-friendly resources (Khan Academy, Crash Course YouTube, TED Talks, introductory books)

INTERMEDIATE units MUST:
- Explain the mechanisms: "how does it actually work under the hood?"
- Include mathematical, technical, or conceptual frameworks where appropriate
- Use real case studies and practical worked examples
- Connect to adjacent concepts and build a mental model
- externalResources: 3-4 free online courses or textbooks (MIT OpenCourseWare at ocw.mit.edu, Stanford Online at online.stanford.edu, Coursera free audits, specific open textbook chapters, arXiv survey papers)

ADVANCED units MUST:
- Describe the current state of the field: what do experts know now, what is still debated?
- Reference specific landmark papers, recent breakthroughs, or key researchers by name
- Cover edge cases, failure modes, and nuances practitioners must know
- Discuss active debates or competing paradigms in the field
- externalResources: 3-5 research-grade resources (specific arXiv papers with links, journal articles, conference proceedings like NeurIPS/CVPR/Nature/Science, expert lecture series, professional community resources)

IMPORTANT: Do NOT generate quiz questions. Quizzes are generated on-demand when the learner requests them. Leave the "quiz" array empty in every unit.

The externalResources URLs must be real, working URLs (ocw.mit.edu, arxiv.org, khanacademy.org, youtube.com, etc).`;

  try {
    console.log(`[BatchContent] Generating batch content for ${unitsList.length} units of topic "${topic.title}"`);
    
    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.7 }
    ) || "{}";

    const parsed = JSON.parse(content);
    const resultMap = new Map<number, any>();
    
    // Map the response back to unit IDs
    unitsList.forEach((unit, index) => {
      const unitContent = parsed[String(index)];
      if (unitContent && !unitContent._isPlaceholder) {
        resultMap.set(unit.id, unitContent);
      }
    });
    
    console.log(`[BatchContent] Successfully generated content for ${resultMap.size}/${unitsList.length} units`);
    return resultMap;
  } catch (error) {
    console.error("[BatchContent] Error generating batch lesson content:", error);
    return new Map(); // Return empty map on failure - individual unit generation will be used as fallback
  }
}

// Generate lesson content using AI
export async function generateLessonContent(
  topic: { title: string; description: string },
  unit: { title: string; difficulty: string; outline?: string | null },
  masteredTopics: { topicId: number; topicTitle: string }[],
  categoryName?: string,
  unitContext?: { position: number; total: number; siblingTitles: string[] }
): Promise<any> {
  const crossTopicContext = masteredTopics.length > 0
    ? `The learner has already mastered these topics: ${masteredTopics.map(t => t.topicTitle).join(", ")}. When relevant, draw connections to these concepts they already understand.`
    : "";

  const topicContext = categoryName
    ? `Topic Domain: ${categoryName} → "${topic.title}"`
    : `Topic: "${topic.title}"`;

  const difficultyGuidelines = unit.difficulty === "beginner"
    ? `BEGINNER TIER REQUIREMENTS:
- Open with a captivating real-world story, surprising fact, or historical moment that immediately hooks curiosity
- Use zero jargon — if a technical word is unavoidable, define it immediately with a simple everyday equivalent
- Focus on "what is it?" and "why does this matter to my life right now?"
- Show the human story: who discovered or built this, what problem were they solving, what changed in the world as a result?
- The concept should feel like reading an engaging magazine article, not a textbook
- externalResources: 2-3 highly accessible resources that a complete beginner would love:
  * Khan Academy videos/articles (khanacademy.org)
  * CrashCourse YouTube videos (youtube.com/@crashcourse)
  * TED or TEDx Talks (ted.com)
  * Popular science books or articles
  * Introductory Wikipedia pages for jumping off`
    : unit.difficulty === "intermediate"
    ? `INTERMEDIATE TIER REQUIREMENTS:
- Now explain HOW it works, not just what it is — dive into the underlying mechanisms and frameworks
- Include mathematical intuition or technical frameworks where appropriate, explained step-by-step
- Use at least one detailed real-world case study or practical worked example from industry or research
- Build a mental model: connect this to adjacent concepts and show how it fits into a bigger picture
- The concept should feel like a solid college lecture — rigorous but still accessible
- externalResources: 3-4 free courses or textbooks that provide substantial depth:
  * MIT OpenCourseWare (ocw.mit.edu) — cite specific course pages
  * Stanford Online (online.stanford.edu) or Stanford Engineering Everywhere
  * Coursera free audit courses from top universities
  * Specific open textbook chapters (OpenStax, LibreTexts, etc.)
  * arXiv survey papers (arxiv.org) that provide comprehensive overviews
  * YouTube lecture series from university professors`
    : unit.difficulty === "advanced"
    ? `ADVANCED TIER REQUIREMENTS:
- Describe the CURRENT STATE OF THE ART: what do leading researchers know right now, what is still actively debated?
- Reference specific landmark papers or breakthroughs (mention authors, publication years, and venues like Nature/Science/NeurIPS/CVPR)
- Cover edge cases, failure modes, limitations, and nuances that practitioners MUST know to avoid mistakes
- Discuss competing paradigms or schools of thought within the field
- Include at least one recent development from 2022-2025 that changed or challenged prior understanding
- The concept should feel like reading a graduate-level review or expert practitioner's guide
- externalResources: 3-5 research-grade resources:
  * Specific arXiv papers with direct links (e.g., https://arxiv.org/abs/XXXX.XXXXX)
  * Nature, Science, or top-tier journal articles
  * Conference proceedings pages (neurips.cc, cvpr papers, etc.)
  * Expert lecture series (e.g., Lex Fridman podcast episodes with relevant researchers)
  * Professional/academic community resources and forums`
    : `NEXT GEN TIER REQUIREMENTS:
- This is a frontier exploration — present the field as an active, unfinished adventure
- Focus on what is NOT yet known and why it matters
- Reference real, active research questions being pursued by labs right now
- externalResources: 3-4 research frontier resources:
  * Active arXiv categories or recent preprints
  * Open source research community forums
  * Relevant Discord servers or academic Slack communities
  * Preprint servers and working papers`;

  const resourceSpecificityInstruction = `
CRITICAL RESOURCE SPECIFICITY RULES:
- Every URL must be hyper-specific to "${topic.title}"${categoryName ? ` within the domain of ${categoryName}` : ""}.
- DO NOT link to generic homepages (e.g. khanacademy.org, youtube.com alone) — link to specific pages, videos, or articles.
- For YouTube: ALWAYS try to include a full /watch?v=... URL to a specific, highly relevant video about this topic.
- For OCW/Coursera/KhanAcademy: link to a specific course, module, or lesson page about THIS topic.
- For arXiv: link to a specific paper (https://arxiv.org/abs/XXXX.XXXXX).
- ALWAYS include a topic link to a relevant Grokipedia page (e.g., https://grokipedia.com/page/${topic.title.replace(/ /g, "_")}) as it is incredibly useful.
- Prefer resources from professional/academic sources in the ${categoryName || "relevant"} domain.
- Verify that the URL path describes the content clearly — avoid placeholder or example URLs.

OPEN EDUCATIONAL RESOURCES (OER) PRIORITY:
- PRIORITIZE openly licensed, free educational materials over paid resources
- Preferred OER sources: MIT OpenCourseWare (ocw.mit.edu), Khan Academy (khanacademy.org), OpenStax (openstax.org), LibreTexts (libretexts.org), Wikiversity (en.wikiversity.org), arXiv (arxiv.org), freeCodeCamp (freecodecamp.org), Project Gutenberg (gutenberg.org)
- Only use paid resources (Coursera, Udemy, paid journals) when no free OER equivalent exists
- Each resource should be the BEST free resource for this specific topic and difficulty level`;

  const positionContext = unitContext
    ? `Unit Position: ${unitContext.position} of ${unitContext.total} in the ${unit.difficulty.toUpperCase()} tier\n` +
      (unitContext.siblingTitles.length > 0
        ? `Other ${unit.difficulty} units in this course: ${unitContext.siblingTitles.map(t => `"${t}"`).join(", ")} — your content MUST cover DIFFERENT material and NOT duplicate these topics.\n`
        : "")
    : "";

  const precisionRules = `\nPRECISION AND ANTI-FILLER RULES:
- Every sentence must convey new information. No filler: "It is important to note that...", "In today's rapidly evolving landscape...", "As we all know...", "Needless to say..."
- concept: 2-3 tight paragraphs maximum. Each paragraph ends with a fact, implication, or question — never a summary restating what was just said.
- Write like a brilliant friend at a coffee shop — clear, direct, enthusiastic but not rambling.
- Use active voice. Prefer short sentences for key points.
- If you cannot add new information, stop writing.`;

  const contentTypedHint = categoryName
    ? (() => {
        const catText = `${categoryName} ${unit.title} ${unit.outline || ""}`.toLowerCase();
        const codeTerms = ["python", "javascript", "typescript", "react", "programming", "code", "api", "algorithm", "gradio"];
        const formulaTerms = ["calculus", "algebra", "equation", "derivative", "integral", "theorem", "quantum", "thermodynamics", "mechanics", "wave"];
        const isCode = codeTerms.some(t => catText.includes(t));
        const isFormula = formulaTerms.some(t => catText.includes(t));
        if (isCode && !isFormula) return "\nHINT: This unit is code-heavy. Include runnable code examples with inline comments.\n";
        if (isFormula) return "\nHINT: This unit is formula-heavy. Include equations with plain-English glosses and worked numerical examples.\n";
        return "";
      })()
    : "";

  const prompt = `You are an expert curriculum designer creating a deep, engaging lesson for:

${topicContext}
Unit: ${unit.title}
Difficulty Level: ${unit.difficulty.toUpperCase()}
Unit Description: ${unit.outline || ""}
${positionContext}
${crossTopicContext}

${difficultyGuidelines}

${resourceSpecificityInstruction}
${precisionRules}${contentTypedHint}

Create the lesson content in this JSON format:
{
  "concept": "Engaging, in-depth explanation (2-3 substantial paragraphs appropriate for this difficulty tier)",
  "keyTakeaways": ["Key insight 1", "Key insight 2", "Key insight 3", "Key insight 4"],
  "mermaidDiagram": "Optional. A raw Mermaid.js graph string (e.g. flowchart, map, graph) illustrating the concept. Do NOT include markdown backticks.",
  "analogy": "A creative, memorable real-world analogy that makes this concept click",
  "example": {
    "title": "Example title",
    "content": "Detailed worked example appropriate to the difficulty level",
    "code": "Optional code snippet if relevant"
  },
  "quiz": [],
  "crossLinks": [
    {
      "topicId": 1,
      "topicTitle": "Related Topic",
      "connection": "How this concept connects to the related topic"
    }
  ],
  "externalResources": [
    {
      "title": "Specific resource title",
      "url": "https://real-working-url.com/specific-path",
      "type": "video|course|paper|book|forum|tool|encyclopedia",
      "description": "What this resource covers and why it's the best next step for this difficulty level"
    }
  ]
}

IMPORTANT: Do NOT generate quiz questions. Quizzes are generated on-demand when the learner requests them. Leave the "quiz" array empty.
${masteredTopics.length > 0 ? "Include 1-2 cross-links to mastered topics if relevant." : "Leave crossLinks as an empty array."}
The externalResources URLs must be real, specific, and working (ocw.mit.edu, arxiv.org, khanacademy.org, youtube.com, grokipedia.com, etc). Do not invent URLs.`;

  try {
    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.7 }
    ) || "{}";

    const parsed = JSON.parse(content);

    // Validate and clean up external resource URLs
    if (parsed.externalResources?.length) {
      const { validateAndRefreshResources } = await import("../link-validator");
      parsed.externalResources = await validateAndRefreshResources(
        parsed.externalResources,
        topic.title,
        categoryName || "general",
        unit.difficulty,
        async (count: number) => {
          const retryPrompt = `The following URLs for the lesson "${unit.title}" on topic "${topic.title}" (${categoryName || "general"}, ${unit.difficulty} level) failed validation. Generate ${count} alternative external resource links that are real, live, and specific to this exact topic and difficulty level. Return JSON array only:
[{"title":"...","url":"https://...","type":"video|course|paper|book|forum|tool|encyclopedia","description":"..."}]`;
          try {
            const alt = await generateCourseContent(
              [{ role: "user", content: retryPrompt }],
              { responseFormat: "json", temperature: 0.5 }
            ) || "[]";
            const altParsed = JSON.parse(alt);
            return Array.isArray(altParsed) ? altParsed : (altParsed.externalResources || []);
          } catch {
            return [];
          }
        }
      );
    }

    return parsed;
  } catch (error) {
    console.error("Error generating lesson content:", error);
    // Return placeholder content with marker - DO NOT save this to DB
    return {
      _isPlaceholder: true,
      concept: `We're having trouble generating content for "${unit.title}" right now. Please try again in a moment.`,
      analogy: "Content generation is temporarily unavailable.",
      example: {
        title: "Content Unavailable",
        content: "Please refresh the page to try generating this lesson again.",
      },
      quiz: [],
      crossLinks: []
    };
  }
}

// ── On-Demand Quiz Generation ──────────────────────────────────────────────
// Quizzes are NOT pre-generated with lesson content. They are generated
// on-demand when a learner requests them, using the learner's own API key (BYOK).
// This saves ~30% token cost on every lesson generation and lets quizzes be
// tailored to the learner's current mastery level and the specific content they just read.

export async function generateOnDemandQuiz(
  topic: { title: string; description: string },
  unit: { title: string; difficulty: string; outline?: string | null },
  lessonContent: unknown,
  questionCount: number = 3
): Promise<any> {
  const contentStr = typeof lessonContent === "string"
    ? lessonContent
    : JSON.stringify(lessonContent);

  const difficultyGuidance = unit.difficulty === "beginner"
    ? "Quiz questions test basic recognition, 'why does this matter?', and connecting to everyday experience. Use simple language."
    : unit.difficulty === "intermediate"
    ? "Quiz questions test mechanism understanding and ability to apply concepts to new scenarios. Include at least one application question."
    : unit.difficulty === "advanced"
    ? "Quiz questions are analytical: require synthesizing multiple concepts, critiquing approaches, or reasoning about tradeoffs. Include at least one comparison question."
    : "Quiz questions are open-ended thought exercises that may not have single correct answers — test creative thinking and frontier reasoning.";

  const prompt = `You are an expert quiz designer. Generate ${questionCount} quiz questions for a learner who just finished studying a lesson.

TOPIC: "${topic.title}"
UNIT: "${unit.title}"
DIFFICULTY: ${unit.difficulty.toUpperCase()}

LESSON CONTENT (the learner just read this):
${contentStr.substring(0, 4000)}

${difficultyGuidance}

Respond with ONLY a JSON array of quiz questions:
[
  {
    "question": "Clear, specific question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Why the correct answer is right AND why each distractor is wrong (what misconception each represents)"
  }
]

CRITICAL QUIZ RULES:
- Every wrong answer (distractor) must be PLAUSIBLE — representing a common misconception or reasonable-but-incorrect interpretation
- Do NOT include obviously wrong or joke answers
- Include at least one "why does this matter?" or "what if?" question
- For intermediate+: one question should require applying the concept to a NEW scenario not mentioned in the lesson
- For advanced: one question should require comparing two approaches and identifying tradeoffs
- Each explanation must explain WHY the distractors are wrong (what misconception they represent), not just why the correct answer is right
- Questions should test understanding of THIS specific lesson's content, not generic knowledge`;

  try {
    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.7 }
    ) || "[]";

    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Invalid quiz response: expected non-empty array");
    }

    // Validate each question has required fields
    for (const q of parsed) {
      if (!q.question || !Array.isArray(q.options) || q.options.length < 2 ||
          typeof q.correctIndex !== "number" || !q.explanation) {
        throw new Error("Invalid quiz question structure");
      }
    }

    return parsed;
  } catch (error) {
    console.error("[OnDemandQuiz] Error generating quiz:", error);
    return [];
  }
}

// Default lesson units when AI fails
export async function getDefaultLessonUnits(topicId: number, topicTitle: string) {
  const { storage } = await import("../storage");
  const defaultUnits = [
    { difficulty: "beginner", unitIndex: 0, title: "Introduction & Basics", outline: `Get started with the fundamentals of ${topicTitle}` },
    { difficulty: "beginner", unitIndex: 1, title: "Core Vocabulary", outline: "Learn the essential terms and concepts" },
    { difficulty: "beginner", unitIndex: 2, title: "Simple Examples", outline: "See the concepts in action with easy examples" },
    { difficulty: "intermediate", unitIndex: 0, title: "Deeper Mechanisms", outline: "Understand how things work under the hood" },
    { difficulty: "intermediate", unitIndex: 1, title: "Practical Applications", outline: "Apply your knowledge to real scenarios" },
    { difficulty: "intermediate", unitIndex: 2, title: "Common Patterns", outline: "Recognize recurring themes and approaches" },
    { difficulty: "advanced", unitIndex: 0, title: "Edge Cases", outline: "Explore unusual situations and exceptions" },
    { difficulty: "advanced", unitIndex: 1, title: "Current Research", outline: "Discover what experts are working on today" },
    { difficulty: "advanced", unitIndex: 2, title: "Expert Applications", outline: "See how professionals use these concepts" },
    { difficulty: "nextgen", unitIndex: 0, title: "Open Research Questions", outline: "Explore unsolved problems and cutting-edge questions in the field" },
    { difficulty: "nextgen", unitIndex: 1, title: "Industry Frontiers", outline: "Discover active challenges and emerging opportunities" },
    { difficulty: "nextgen", unitIndex: 2, title: "Creative Synthesis", outline: "Combine ideas from different domains for breakthrough insights" },
  ];

  return Promise.all(defaultUnits.map(u => storage.createLessonUnit({ topicId, ...u })));
}

// Generate Next Gen content using AI (frontier research and creative challenges)
export async function generateNextGenContent(
  topic: { title: string; description: string },
  unit: { title: string; outline?: string | null },
  masteredTopics: { topicId: number; topicTitle: string }[],
  categoryName?: string
): Promise<unknown> {
  const crossTopicContext = masteredTopics.length > 0
    ? `The learner has mastered these topics and can draw connections: ${masteredTopics.map(t => t.topicTitle).join(", ")}.`
    : "";

  const domainContext = categoryName
    ? `Domain: ${categoryName} → "${topic.title}"`
    : `Topic: "${topic.title}"`;

  const resourceSpecificity = `
CRITICAL RESOURCE SPECIFICITY RULES:
- All URLs must be hyper-specific to "${topic.title}"${categoryName ? ` within ${categoryName}` : ""}.
- For arXiv: link to a specific preprint (https://arxiv.org/abs/XXXX.XXXXX) — not the arXiv homepage.
- For journals: link to a specific paper DOI or journal page — not a journal homepage.
- For communities: include the actual URL (subreddit, Discord invite, mailing list archive, etc.).
- For YouTube: include the full /watch?v=... URL to a specific expert lecture on this frontier topic.
- You may include a Grokipedia page (https://grokipedia.com/page/${topic.title.replace(/ /g, "_")} or a more specific sub-page) as an additional reference.
- DO NOT use placeholder URLs or link to generic homepages.`;

  const prompt = `You are a research mentor and frontier scientist helping advanced learners engage with the bleeding edge of "${topic.title}".

${domainContext}
Unit: ${unit.title}
Unit Focus: ${unit.outline || "Frontier exploration and creative thinking"}

${crossTopicContext}

This is a NEXT GEN unit — the final frontier of learning. The learner has already mastered beginner, intermediate, and advanced content. Now they step into the unknown alongside working researchers. Write as if briefing a smart, curious person at the start of a PhD program.

PRECISION RULES: No filler phrases. Every sentence must name a specific researcher, paper, institution, approach, or result. Write with the excitement of someone at the frontier — concise, specific, intellectually thrilling.

${resourceSpecificity}

Respond with JSON in this EXACT format:
{
  "researchContext": "3 rich paragraphs: (1) Current state of the field — what we know confidently and what the frontier looks like right now as of 2024-2025. (2) The journey here — what key breakthroughs got us to this point and who made them. (3) The horizon — what is the field reaching for and why is it hard?",
  "openRoadblocks": [
    {
      "title": "Specific unsolved problem or bottleneck",
      "description": "Detailed explanation of what this challenge actually is and why current approaches fail",
      "whyItMatters": "What becomes possible if this roadblock is solved — what does it unlock for humanity?"
    }
  ],
  "industryChallenge": {
    "title": "A specific real challenge actively being worked on in industry or academia RIGHT NOW",
    "description": "Detailed explanation of why this is hard — technical and conceptual obstacles",
    "currentApproaches": ["Specific approach being tried by specific labs or companies", "Another real approach", "A third methodology"],
    "openQuestions": ["A specific unanswered question that active researchers are pursuing", "Another genuine open question", "A fundamental question that may require new frameworks to answer"]
  },
  "thoughtExercises": [
    {
      "prompt": "An open-ended thought experiment or design challenge that has no known right answer",
      "hints": ["A specific hint that points toward a productive angle", "A counterintuitive consideration"],
      "explorationPaths": ["A concrete direction to explore further", "A cross-disciplinary connection worth investigating"]
    }
  ],
  "emergingTrends": [
    {
      "trend": "A specific emerging development in this field from 2023-2025",
      "implications": "What this trend changes about how we think about the field",
      "potentialBreakthroughs": "What breakthrough this trend could lead to in 5-10 years"
    }
  ],
  "creativeSynthesis": {
    "challenge": "A creative challenge that asks learners to combine this topic with unexpected domains to propose a novel approach or application",
    "relatedConcepts": ["Concept from this topic", "Unexpected domain or field that might connect"],
    "suggestedConnections": ["A specific cross-domain insight worth exploring", "An analogy from a completely different field that might yield new ideas"]
  },
  "crossDomainInsights": [
    {
      "distantDomain": "A seemingly UNRELATED field (e.g., Biology, Music, Economics — NOT an adjacent field)",
      "insight": "The specific shared principle, mathematical structure, or emergent behavior that connects this distant domain to the current topic. Show the concrete connection, not vague similarity.",
      "abstraction": "The abstract principle that makes this connection true (e.g., 'distributed optimization without central control', 'wave interference patterns', 'topology of constrained spaces')",
      "example": "A specific example from each domain that demonstrates the shared structure"
    }
  ],
  "pitchFramework": {
    "title": "A compelling one-sentence title for a hypothetical open-science pitch based on this unit",
    "problemStatement": "1 paragraph: What is the specific gap or anomaly you are addressing? Cite a real paper or dataset that exposes this gap.",
    "proposedApproach": "1 paragraph: What is your novel angle? It can be high-risk, but it must be testable. Reference a method from another field you are borrowing.",
    "expectedImpact": "1 paragraph: If it works, what changes? Who benefits? Be concrete, not grandiose.",
    "nextStep": "The smallest viable experiment or analysis that could falsify or support the idea within 2 weeks"
  },
  "experimentDesign": {
    "title": "Title for a minimal viable experiment",
    "hypothesis": "A falsifiable hypothesis in one sentence",
    "method": "Step-by-step methodology using only freely available tools, datasets, or simulators",
    "successCriteria": "What result would confirm the hypothesis? What result would falsify it?",
    "tools": ["Specific open-source tool or dataset", "Another accessible resource"]
  },
  "communityForums": [
    {
      "name": "Community or forum name",
      "url": "https://real-url.com",
      "description": "What kind of discussion and who participates"
    }
  ],
  "resources": [
    {
      "title": "Specific resource title",
      "url": "https://real-arxiv-or-journal-url.com",
      "type": "paper|preprint|community|tool|lecture|forum",
      "description": "What this resource contains and why it is essential for anyone serious about this frontier"
    }
  ]
}

Requirements:
- openRoadblocks: Include 2-3 REAL specific unsolved problems (not vague, e.g. "the alignment problem in large language models" not just "AI safety")
- thoughtExercises: Include 2-3 open-ended challenges that genuinely have no known answers yet
- emergingTrends: Include 2-3 specific trends from 2023-2025, named and concrete
- crossDomainInsights: Include 1-2 connections to DISTANT domains (NOT adjacent fields). The best insights find the same mathematical structure or optimization principle in completely unrelated systems.
- pitchFramework: Write this as if the learner is preparing to post on OpenReview, LessWrong, or a relevant subreddit. Make it feel achievable, not intimidating.
- experimentDesign: Keep it minimal — something a motivated learner could start tonight with free tools. Do not require expensive hardware or proprietary data.
- communityForums: Include 2-3 REAL communities (e.g., arXiv cs.LG, LessWrong, r/MachineLearning, relevant Discord servers, academic mailing lists)
- resources: Include 3-5 REAL resources with working URLs — arXiv preprints, Nature/Science papers, conference papers, expert YouTube lectures
- This is about the thrill of the unknown — write with the excitement of someone at the frontier, not the detachment of a textbook
- End with an implicit invitation: "This is where YOU could contribute something new"`;


  try {
    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.8 }
    ) || "{}";

    const parsed = JSON.parse(content) as Record<string, unknown>;

    // Validate and filter resources + communityForums for dead links
    const { validateResources } = await import("../link-validator");
    type RawLinkItem = import("../link-validator").RawLinkItem;
    const isLinkArray = (v: unknown): v is RawLinkItem[] =>
      Array.isArray(v) && v.length > 0 && typeof (v[0] as Record<string, unknown>)?.url === "string";

    if (isLinkArray(parsed.resources)) {
      const validated = await validateResources(parsed.resources);
      if (validated.length < parsed.resources.length) {
        console.log(`[LinkValidator] NextGen: removed ${parsed.resources.length - validated.length} dead resources for "${topic.title}"`);
        parsed.resources = validated;
      }
    }
    if (isLinkArray(parsed.communityForums)) {
      const validated = await validateResources(parsed.communityForums);
      if (validated.length < parsed.communityForums.length) {
        console.log(`[LinkValidator] NextGen: removed ${parsed.communityForums.length - validated.length} dead forums for "${topic.title}"`);
        parsed.communityForums = validated;
      }
    }

    return parsed;
  } catch (error) {
    console.error("Error generating Next Gen content:", error);
    // Return placeholder content with marker - DO NOT save this to DB
    return {
      _isPlaceholder: true,
      researchContext: `We're having trouble generating Next Gen content for "${topic.title}" right now. Please try again in a moment.`,
      industryChallenge: {
        title: "Content Unavailable",
        description: "Please refresh the page to try generating this content again.",
        currentApproaches: [],
        openQuestions: []
      },
      thoughtExercises: [],
      emergingTrends: [],
      creativeSynthesis: {
        challenge: "Content generation is temporarily unavailable.",
        relatedConcepts: [],
        suggestedConnections: []
      },
      crossDomainInsights: [],
      pitchFramework: {
        title: "Content Unavailable",
        problemStatement: "Please refresh to generate Next Gen content.",
        proposedApproach: "",
        expectedImpact: "",
        nextStep: ""
      },
      experimentDesign: {
        title: "Content Unavailable",
        hypothesis: "",
        method: "",
        successCriteria: "",
        tools: []
      },
      communityForums: [],
      resources: []
    };
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function getDefaultLevels(topicTitle: string) {
  return [
    {
      id: 1,
      title: "The Basics",
      description: "Understand the fundamental concepts",
      difficulty: "beginner",
      completed: false,
      content: `Start with a simple explanation of ${topicTitle} that anyone can understand. This level introduces core vocabulary and basic principles.`,
    },
    {
      id: 2,
      title: "Core Concepts",
      description: "Dive deeper into the main ideas",
      difficulty: "intermediate",
      completed: false,
      content: `Now we explore the underlying mechanisms and relationships between concepts in ${topicTitle}.`,
    },
    {
      id: 3,
      title: "Real-World Applications",
      description: "See how it applies in practice",
      difficulty: "intermediate",
      completed: false,
      content: `Discover how ${topicTitle} manifests in everyday scenarios and professional contexts.`,
    },
    {
      id: 4,
      title: "Advanced Topics",
      description: "Master the complexities",
      difficulty: "advanced",
      completed: false,
      content: `Challenge yourself with nuanced aspects and edge cases of ${topicTitle} that require deeper understanding.`,
    },
    {
      id: 5,
      title: "Expert Insights",
      description: "Explore cutting-edge developments",
      difficulty: "expert",
      completed: false,
      content: `Connect with the latest research and innovations in ${topicTitle}.`,
    },
  ];
}

// ==================== PRACTICE TEST HELPERS ====================

export function getDefaultTimeLimit(testType: string): number | null {
  const timeLimits: Record<string, number> = {
    MCAT: 90,
    GRE: 60,
    SAT: 65,
    LSAT: 75,
    GMAT: 62,
    ACT: 60,
    IQ: 45,
    BAR: 90,
  };
  return timeLimits[testType.toUpperCase()] || 60;
}

export function getTestCategories(testType: string): string[] {
  // Only include categories that can be assessed via multiple-choice questions
  // Essay/writing categories are excluded since we only support MCQ format
  const categories: Record<string, string[]> = {
    MCAT: ["Biology", "Chemistry", "Physics", "Psychology", "Critical Analysis"],
    GRE: ["Verbal Reasoning", "Quantitative Reasoning", "Reading Comprehension"],
    SAT: ["Reading", "Writing and Language", "Math (No Calculator)", "Math (Calculator)"],
    LSAT: ["Logical Reasoning", "Analytical Reasoning", "Reading Comprehension"],
    GMAT: ["Quantitative", "Verbal", "Integrated Reasoning", "Data Sufficiency"],
    ACT: ["English", "Math", "Reading", "Science"],
    IQ: ["Pattern Recognition", "Logical Reasoning", "Spatial Reasoning", "Verbal Ability", "Numerical Ability"],
    BAR: ["Constitutional Law", "Contracts", "Criminal Law", "Evidence", "Torts", "Civil Procedure"],
  };
  return categories[testType.toUpperCase()] || ["General Knowledge"];
}

export async function generatePracticeTestQuestions(testId: number, testType: string, focusAreas?: string) {
  try {
    const categories = getTestCategories(testType);
    const questionsPerCategory = 5;
    const totalQuestions = categories.length * questionsPerCategory;

    const prompt = `You are an expert test prep instructor. Generate ${totalQuestions} practice questions for a ${testType.toUpperCase()} exam.

${focusAreas ? `Focus areas requested: ${focusAreas}` : ""}

Categories to cover: ${categories.join(", ")}

Generate ${questionsPerCategory} questions per category. Each question should be challenging but fair, similar to actual ${testType.toUpperCase()} exam questions.

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "category": "Category Name",
      "questionType": "multiple_choice",
      "passage": null,
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Detailed explanation of why this answer is correct",
      "difficulty": "medium"
    }
  ]
}

Guidelines:
- ALL questions MUST be multiple-choice format with exactly 4 options
- EVERY question MUST have a valid correctIndex (0, 1, 2, or 3) indicating the correct answer
- Questions should be ${testType.toUpperCase()}-appropriate in difficulty and style
- Include a mix of easy, medium, and hard questions
- For passage-based questions, include a relevant passage in the "passage" field
- Explanations should be educational and thorough
- Options should be plausible but only one clearly correct
- Distribute questions evenly across categories
- Do NOT generate essay questions or any format without a definitive correct answer`;

    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.7 }
    ) || "{}";

    const parsed = JSON.parse(content);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid AI response format");
    }

    // Validate and save questions to database
    const questionsToInsert = parsed.questions
      .filter((q: any) => {
        // Validate required fields for multiple choice
        const hasValidCorrectIndex = typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3;
        const hasValidOptions = Array.isArray(q.options) && q.options.length === 4;
        const hasQuestion = typeof q.question === 'string' && q.question.trim().length > 0;
        return hasValidCorrectIndex && hasValidOptions && hasQuestion;
      })
      .map((q: any, index: number) => ({
        testId,
        questionIndex: index,
        category: q.category || categories[0],
        questionType: "multiple_choice",
        passage: q.passage || null,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || "No explanation provided.",
        difficulty: q.difficulty || "medium",
      }));
    
    if (questionsToInsert.length === 0) {
      throw new Error("No valid questions generated");
    }

    await storage.createPracticeTestQuestions(questionsToInsert);
    await storage.updatePracticeTestStatus(testId, "ready", questionsToInsert.length);

  } catch (error) {
    console.error("Error generating practice test questions:", error);
    await storage.updatePracticeTestStatus(testId, "failed");
  }
}
