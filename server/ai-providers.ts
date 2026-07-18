import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export interface AIProvider {
  name: string;
  chat(messages: { role: string; content: string }[], options?: ChatOptions): Promise<string>;
  isConfigured(): boolean;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export interface ProviderConfig {
  provider: "openai" | "huggingface" | "ollama" | "lmstudio" | "custom_openai" | "openrouter" | "gemini" | "xai" | "anthropic";
  huggingFaceToken?: string;
  ollamaUrl?: string;
  lmStudioUrl?: string;
  customOpenaiUrl?: string;
  customOpenaiKey?: string;
  openRouterKey?: string;
  preferredModel?: string;
  // BYOK: user's own keys for paid providers
  xaiKey?: string;
  anthropicKey?: string;
  geminiKey?: string;
}

// ── Grok (xAI) — primary course content engine ──────────────────────────────
// Override model at runtime (no redeploy needed) via XAI_COURSE_MODEL env var:
//   XAI_COURSE_MODEL=grok-4.20-reasoning
// Requires XAI_API_KEY to be set; falls back to Gemini if the key is absent
// or if xAI is unreachable.
const XAI_COURSE_MODEL = process.env.XAI_COURSE_MODEL || "grok-4.20-reasoning";

// ── Gemini — fallback engine when xAI is unavailable ────────────────────────
// Also used directly by infographic-generator.ts for image generation.
// Never change GEMINI_FALLBACK_MODEL to an experimental or preview model —
// it must always be a known-good stable model.
const GEMINI_FALLBACK_MODEL = "gemini-2.0-flash";

// Gemini model used when the Grok primary is unavailable.
// Override via GEMINI_COURSE_MODEL env var (e.g. GEMINI_COURSE_MODEL=gemini-2.5-pro).
const GEMINI_COURSE_MODEL = process.env.GEMINI_COURSE_MODEL || GEMINI_FALLBACK_MODEL;

// Determine primary engine for startup log
const _xaiConfigured = !!process.env.XAI_API_KEY;
console.log(
  `[AI] Course content model: ${_xaiConfigured ? `${XAI_COURSE_MODEL} via xAI` : `${GEMINI_COURSE_MODEL} via gemini (xAI key not set)`} ` +
  `(fallback: ${_xaiConfigured ? GEMINI_COURSE_MODEL : GEMINI_FALLBACK_MODEL})`
);

const DEFAULT_MODELS: Record<string, string> = {
  openai: GEMINI_COURSE_MODEL,
  gemini: GEMINI_COURSE_MODEL,
  huggingface: "meta-llama/Llama-3.3-70B-Instruct",
  ollama: "llama3.2",
  lmstudio: "local-model", // LM Studio serves whatever model is loaded; user overrides in Settings
  custom_openai: "default",
  openrouter: "anthropic/claude-3.5-sonnet",
};

class GeminiProvider implements AIProvider {
  name = "gemini";
  private client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      },
    });
  }

  isConfigured(): boolean {
    return !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  }

  async chat(messages: { role: string; content: string }[], options?: ChatOptions): Promise<string> {
    const modelName = options?.model || DEFAULT_MODELS.gemini;

    const chatContents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const config: Record<string, unknown> = {
      temperature: options?.temperature ?? 0.7,
    };
    if (options?.maxTokens) {
      config.maxOutputTokens = options.maxTokens;
    }
    if (options?.responseFormat === "json") {
      config.responseMimeType = "application/json";
    }

    try {
      const result = await this.client.models.generateContent({
        model: modelName,
        contents: chatContents,
        config,
      });
      return result.text || "";
    } catch (err: unknown) {
      // If the primary model is not found (deprecated/renamed), automatically
      // fall back to the known-good model rather than hard-failing.
      // Check structured fields first (SDK may expose status/code directly),
      // then fall back to message substring matching for resilience.
      const structuredNotFound =
        typeof err === "object" &&
        err !== null &&
        (
          (err as Record<string, unknown>).status === 404 ||
          (err as Record<string, unknown>).status === "NOT_FOUND" ||
          (err as Record<string, unknown>).code === 404 ||
          (err as Record<string, unknown>).code === "NOT_FOUND"
        );
      const messageNotFound =
        err instanceof Error &&
        (err.message.includes('"status":"NOT_FOUND"') ||
          err.message.includes('"code":404') ||
          err.message.includes("was not found"));
      const isNotFound = structuredNotFound || messageNotFound;

      if (isNotFound && modelName !== GEMINI_FALLBACK_MODEL) {
        console.warn(
          `[AI] Model "${modelName}" not found — falling back to "${GEMINI_FALLBACK_MODEL}". ` +
          `Set GEMINI_COURSE_MODEL env var to a valid model to resolve this.`
        );
        const fallbackResult = await this.client.models.generateContent({
          model: GEMINI_FALLBACK_MODEL,
          contents: chatContents,
          config,
        });
        return fallbackResult.text || "";
      }

      throw err;
    }
  }
}

class OpenAIProvider implements AIProvider {
  name = "openai";
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }

  isConfigured(): boolean {
    return !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  }

  async chat(messages: { role: string; content: string }[], options?: ChatOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: options?.model || DEFAULT_MODELS.openai,
      messages: messages as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      response_format: options?.responseFormat === "json" ? { type: "json_object" } : undefined,
    });

    return response.choices[0]?.message?.content || "";
  }
}

class HuggingFaceProvider implements AIProvider {
  name = "huggingface";
  private token: string;
  private model: string;

  constructor(token: string, model?: string) {
    this.token = token;
    this.model = model || DEFAULT_MODELS.huggingface;
  }

  isConfigured(): boolean {
    return !!this.token;
  }

  async chat(messages: { role: string; content: string }[], options?: ChatOptions): Promise<string> {
    const model = options?.model || this.model;
    const url = `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: options?.maxTokens || 2048,
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
}

class OllamaProvider implements AIProvider {
  name = "ollama";
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model || DEFAULT_MODELS.ollama;
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  async chat(messages: { role: string; content: string }[], options?: ChatOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options?.model || this.model,
        messages: messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.message?.content || "";
  }
}

class OpenRouterProvider implements AIProvider {
  name = "openrouter";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || DEFAULT_MODELS.openrouter;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async chat(messages: { role: string; content: string }[], options?: ChatOptions): Promise<string> {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.REPLIT_DEPLOYMENT_URL || "https://synapse.replit.app",
        "X-Title": "Synapse Learning Platform",
      },
      body: JSON.stringify({
        model: options?.model || this.model,
        messages: messages,
        temperature: options?.temperature ?? 0.7,
        // Cap default spend: OpenRouter defaults max_tokens to 65536 when omitted,
        // which exceeds many users' key credit caps (402 "requires more credits").
        max_tokens: options?.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
}

// ── OpenAI-compatible local servers: LM Studio, llama.cpp, vLLM, text-gen-webui ─
// All expose POST {baseUrl}/chat/completions with the OpenAI schema. LM Studio's
// default is http://localhost:1234/v1; llama.cpp server uses http://localhost:8080/v1.
// Local servers usually ignore the api key — any non-empty string works.
class OpenAICompatibleProvider implements AIProvider {
  name: string;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(name: string, baseUrl: string, apiKey: string, model?: string) {
    this.name = name;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey || "local";
    this.model = model || "local-model";
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  async chat(messages: { role: string; content: string }[], options?: ChatOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options?.model || this.model,
        messages: messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens || 4096,
        stream: false,
      }),
      // Local servers can be slow on first token while the model loads
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API error: ${response.status} - ${error.slice(0, 300)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
}

// ── GrokProvider — uses xAI's OpenAI-compatible API ─────────────────────────
class GrokProvider implements AIProvider {
  name = "grok";
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });
    this.model = XAI_COURSE_MODEL;
  }

  isConfigured(): boolean {
    return !!process.env.XAI_API_KEY;
  }

  async chat(messages: { role: string; content: string }[], options?: ChatOptions): Promise<string> {
    const model = options?.model || this.model;
    const response = await this.client.chat.completions.create({
      model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      response_format: options?.responseFormat === "json" ? { type: "json_object" } : undefined,
    });
    return response.choices[0]?.message?.content || "";
  }
}

const defaultOpenAIProvider = new OpenAIProvider();
const defaultGeminiProvider = new GeminiProvider();
const defaultGrokProvider = new GrokProvider();

export function getAIProvider(config: ProviderConfig): AIProvider {
  switch (config.provider) {
    case "gemini":
      return defaultGeminiProvider;

    case "huggingface":
      if (!config.huggingFaceToken) {
        console.warn("HuggingFace token not configured, falling back to Gemini");
        return defaultGeminiProvider;
      }
      return new HuggingFaceProvider(config.huggingFaceToken, config.preferredModel);

    case "ollama":
      if (!config.ollamaUrl) {
        console.warn("Ollama URL not configured, falling back to Gemini");
        return defaultGeminiProvider;
      }
      return new OllamaProvider(config.ollamaUrl, config.preferredModel);

    case "lmstudio":
      if (!config.lmStudioUrl) {
        console.warn("LM Studio URL not configured, falling back to Gemini");
        return defaultGeminiProvider;
      }
      return new OpenAICompatibleProvider("lmstudio", config.lmStudioUrl, "lm-studio", config.preferredModel);

    case "custom_openai":
      if (!config.customOpenaiUrl) {
        console.warn("Custom OpenAI-compatible URL not configured, falling back to Gemini");
        return defaultGeminiProvider;
      }
      return new OpenAICompatibleProvider("custom_openai", config.customOpenaiUrl, config.customOpenaiKey || "local", config.preferredModel);

    case "openrouter":
      if (!config.openRouterKey) {
        console.warn("OpenRouter key not configured, falling back to Gemini");
        return defaultGeminiProvider;
      }
      return new OpenRouterProvider(config.openRouterKey, config.preferredModel);

    case "openai":
    default:
      return defaultGeminiProvider;
  }
}

export function getDefaultProvider(): AIProvider {
  return defaultGeminiProvider;
}

/**
 * TWO-TIER AI ARCHITECTURE:
 *
 * 1. COURSE CONTENT (xAI Grok primary, Gemini fallback — platform pays)
 *    - Lesson units, roadmaps, practice tests, custom topics
 *    - Uses: getCourseContentProvider() or generateCourseContent()
 *    - Shared across all users, generated once and cached in database
 *    - Primary: GrokProvider (XAI_API_KEY required)
 *        Model: XAI_COURSE_MODEL env var (default: grok-4.20-reasoning)
 *    - Fallback: GeminiProvider — used automatically when XAI_API_KEY is absent
 *        or when xAI returns any error. Logs a warning so failures are never silent.
 *        Model: GEMINI_COURSE_MODEL env var (default: gemini-2.0-flash)
 *    - Note: infographic-generator.ts uses Gemini directly for IMAGE generation
 *        (raw PNG bytes via responseModalities). That path is separate and unchanged.
 *
 * 2. USER CHAT/Q&A (User's choice — user pays via their own API keys)
 *    - Interactive tutoring, follow-up questions, exploration
 *    - Uses: getUserChatProvider() with user's provider config
 *    - Personal to each user, unlimited if they use their own keys
 */

/**
 * Get the provider for generating shared course content.
 * Returns GrokProvider when XAI_API_KEY is set; falls back to GeminiProvider.
 * User preferences are always ignored for course content.
 */
export function getCourseContentProvider(): AIProvider {
  return defaultGrokProvider.isConfigured() ? defaultGrokProvider : defaultGeminiProvider;
}

/**
 * Generate course content. Uses Grok (xAI) as the primary engine when
 * XAI_API_KEY is set, automatically falling back to Gemini on any error.
 * Generated content is shared across all users and cached in the database.
 */
export async function generateCourseContent(
  messages: { role: string; content: string }[],
  options?: ChatOptions
): Promise<string> {
  if (!defaultGrokProvider.isConfigured()) {
    return defaultGeminiProvider.chat(messages, options);
  }

  try {
    return await defaultGrokProvider.chat(messages, options);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[AI] Grok request failed (${errMsg.slice(0, 120)}) — falling back to Gemini. ` +
      `Check XAI_API_KEY or set XAI_COURSE_MODEL to a valid model.`
    );
    return defaultGeminiProvider.chat(messages, options);
  }
}

/**
 * Check if user has valid chat credentials configured.
 * Returns null if credentials are missing, provider config if valid.
 */
export function validateUserChatCredentials(config: ProviderConfig): { valid: boolean; missingCredential?: string; provider?: string } {
  switch (config.provider) {
    case "huggingface":
      if (!config.huggingFaceToken) {
        return { valid: false, missingCredential: "Hugging Face Access Token", provider: "huggingface" };
      }
      return { valid: true, provider: "huggingface" };

    case "ollama":
      if (!config.ollamaUrl) {
        return { valid: false, missingCredential: "Ollama Server URL", provider: "ollama" };
      }
      return { valid: true, provider: "ollama" };

    case "lmstudio":
      if (!config.lmStudioUrl) {
        return { valid: false, missingCredential: "LM Studio Server URL", provider: "lmstudio" };
      }
      return { valid: true, provider: "lmstudio" };

    case "custom_openai":
      if (!config.customOpenaiUrl) {
        return { valid: false, missingCredential: "OpenAI-compatible endpoint URL", provider: "custom_openai" };
      }
      return { valid: true, provider: "custom_openai" };

    case "openrouter":
      if (!config.openRouterKey) {
        return { valid: false, missingCredential: "OpenRouter API Key", provider: "openrouter" };
      }
      return { valid: true, provider: "openrouter" };

    case "gemini":
    case "openai":
    default:
      // User selected Gemini/default but hasn't configured their own provider
      // This is NOT allowed for chat - they must use their own credentials
      return { valid: false, missingCredential: "AI provider credentials", provider: "none" };
  }
}

/**
 * Get the provider for user chat/Q&A.
 * REQUIRES user's own credentials - does NOT fall back to platform Gemini.
 * Returns null if user hasn't configured valid credentials.
 */
export function getUserChatProvider(config: ProviderConfig): AIProvider | null {
  const validation = validateUserChatCredentials(config);
  
  if (!validation.valid) {
    return null;
  }

  switch (config.provider) {
    case "huggingface":
      return new HuggingFaceProvider(config.huggingFaceToken!, config.preferredModel);

    case "ollama":
      return new OllamaProvider(config.ollamaUrl!, config.preferredModel);

    case "lmstudio":
      return new OpenAICompatibleProvider("lmstudio", config.lmStudioUrl!, "lm-studio", config.preferredModel);

    case "custom_openai":
      return new OpenAICompatibleProvider("custom_openai", config.customOpenaiUrl!, config.customOpenaiKey || "local", config.preferredModel);

    case "openrouter":
      return new OpenRouterProvider(config.openRouterKey!, config.preferredModel);

    default:
      return null;
  }
}

// ── BYOK (Bring Your Own Key) Provider Factory ──────────────────────────────
// Phase 1.3: User's keys pay for content generation, not the platform.
// Priority: user's BYOK key → community pool (capped) → reject with 402.

class ByokGrokProvider implements AIProvider {
  name = "grok-byok";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1",
    });
    this.model = model || XAI_COURSE_MODEL;
  }

  isConfigured(): boolean { return true; }

  async chat(messages: { role: string; content: string }[], options?: ChatOptions): Promise<string> {
    const model = options?.model || this.model;
    const response = await this.client.chat.completions.create({
      model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      response_format: options?.responseFormat === "json" ? { type: "json_object" } : undefined,
    });
    return response.choices[0]?.message?.content || "";
  }
}

class ByokGeminiProvider implements AIProvider {
  name = "gemini-byok";
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  isConfigured(): boolean { return true; }

  async chat(messages: { role: string; content: string }[], options?: ChatOptions): Promise<string> {
    const modelName = options?.model || DEFAULT_MODELS.gemini;
    const chatContents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const config: Record<string, unknown> = {
      temperature: options?.temperature ?? 0.7,
    };
    if (options?.maxTokens) config.maxOutputTokens = options.maxTokens;
    if (options?.responseFormat === "json") config.responseMimeType = "application/json";

    const result = await this.client.models.generateContent({
      model: modelName,
      contents: chatContents,
      config,
    });
    return result.text || "";
  }
}

/**
 * Check if user has any BYOK credentials configured (from profile or api_keys table).
 */
export function validateByokCredentials(config: ProviderConfig): { valid: boolean; missingCredential?: string; provider?: string } {
  // Check user's key for the selected provider, or find any available key
  if (config.xaiKey) return { valid: true, provider: "xai" };
  if (config.geminiKey) return { valid: true, provider: "gemini" };
  if (config.openRouterKey) return { valid: true, provider: "openrouter" };
  if (config.anthropicKey) return { valid: true, provider: "anthropic" };
  if (config.huggingFaceToken) return { valid: true, provider: "huggingface" };
  if (config.ollamaUrl) return { valid: true, provider: "ollama" };
  if (config.lmStudioUrl) return { valid: true, provider: "lmstudio" };
  if (config.customOpenaiUrl) return { valid: true, provider: "custom_openai" };

  return {
    valid: false,
    missingCredential: "API key for any provider (xAI, Gemini, OpenRouter, Anthropic, HuggingFace, Ollama, LM Studio, or an OpenAI-compatible endpoint)",
    provider: "none",
  };
}

/**
 * Get a BYOK provider for content generation.
 * Uses user's own key, never falls back to platform keys.
 * Returns null if user has no valid BYOK credentials.
 */
export function getByokProvider(config: ProviderConfig): AIProvider | null {
  // Honor the user's selected provider first when its credential exists —
  // silently picking a different provider ignores their choice (and their
  // preferredModel, which is provider-specific).
  switch (config.provider) {
    case "huggingface":
      if (config.huggingFaceToken) return new HuggingFaceProvider(config.huggingFaceToken, config.preferredModel);
      break;
    case "ollama":
      if (config.ollamaUrl) return new OllamaProvider(config.ollamaUrl, config.preferredModel);
      break;
    case "lmstudio":
      if (config.lmStudioUrl) return new OpenAICompatibleProvider("lmstudio", config.lmStudioUrl, "lm-studio", config.preferredModel);
      break;
    case "custom_openai":
      if (config.customOpenaiUrl) return new OpenAICompatibleProvider("custom_openai", config.customOpenaiUrl, config.customOpenaiKey || "local", config.preferredModel);
      break;
    case "openrouter":
      if (config.openRouterKey) return new OpenRouterProvider(config.openRouterKey, config.preferredModel);
      break;
    case "xai":
      if (config.xaiKey) return new ByokGrokProvider(config.xaiKey, config.preferredModel);
      break;
    case "gemini":
      if (config.geminiKey) return new ByokGeminiProvider(config.geminiKey);
      break;
    case "anthropic":
      break; // falls through to priority scan (no native client yet)
  }

  // Fallback priority scan: xAI → Gemini → OpenRouter → Anthropic → HuggingFace → Ollama → LM Studio → custom
  if (config.xaiKey) {
    return new ByokGrokProvider(config.xaiKey, config.preferredModel);
  }
  if (config.geminiKey) {
    return new ByokGeminiProvider(config.geminiKey);
  }
  if (config.openRouterKey) {
    return new OpenRouterProvider(config.openRouterKey, config.preferredModel);
  }
  if (config.anthropicKey) {
    // Anthropic uses OpenAI-compatible endpoint for now
    return new OpenAIProvider(); // TODO: implement native Anthropic client
  }
  if (config.huggingFaceToken) {
    return new HuggingFaceProvider(config.huggingFaceToken, config.preferredModel);
  }
  if (config.ollamaUrl) {
    return new OllamaProvider(config.ollamaUrl, config.preferredModel);
  }
  if (config.lmStudioUrl) {
    return new OpenAICompatibleProvider("lmstudio", config.lmStudioUrl, "lm-studio", config.preferredModel);
  }
  if (config.customOpenaiUrl) {
    return new OpenAICompatibleProvider("custom_openai", config.customOpenaiUrl, config.customOpenaiKey || "local", config.preferredModel);
  }
  return null;
}

/**
 * Generate content using ONLY the learner's BYOC keys.
 * No platform free-pool fallback (prevents compute abuse).
 *
 * For Hermes-authored content, use POST /api/learn/ingest instead —
 * generation happens in Hermes; Synapse only stores the result.
 */
export async function generateByokOrPool(
  messages: { role: string; content: string }[],
  config: ProviderConfig,
  options?: ChatOptions
): Promise<{ content: string; source: "byok" | "pool"; provider: string }> {
  const byokCheck = validateByokCredentials(config);
  if (!byokCheck.valid) {
    throw new Error(
      "BYOC_REQUIRED: Add your own AI key in Settings (xAI, Gemini, OpenRouter, Hugging Face, Ollama), " +
        "or use Hermes Agent to author the course and upload it via a personal access token. " +
        "Platform free compute is disabled."
    );
  }

  const provider = getByokProvider(config);
  if (!provider) {
    throw new Error(
      "BYOC_REQUIRED: No usable provider client for your configured keys. Check Settings → AI Provider."
    );
  }

  try {
    const content = await provider.chat(messages, options);
    return { content, source: "byok", provider: provider.name };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Your BYOC provider (${provider.name}) failed: ${msg}. ` +
        `Fix the key/model, or author the course in Hermes and upload it.`
    );
  }
}

/**
 * Build ProviderConfig from a user_profiles row (BYOC).
 */
export function providerConfigFromProfile(profile: {
  preferredAiProvider?: string | null;
  preferredModel?: string | null;
  huggingFaceToken?: string | null;
  ollamaUrl?: string | null;
  lmStudioUrl?: string | null;
  customOpenaiUrl?: string | null;
  customOpenaiKey?: string | null;
  openRouterKey?: string | null;
  xaiKey?: string | null;
  anthropicKey?: string | null;
  geminiKey?: string | null;
} | null | undefined): ProviderConfig {
  return {
    provider: (profile?.preferredAiProvider as ProviderConfig["provider"]) || "openai",
    preferredModel: profile?.preferredModel || undefined,
    huggingFaceToken: profile?.huggingFaceToken || undefined,
    ollamaUrl: profile?.ollamaUrl || undefined,
    lmStudioUrl: profile?.lmStudioUrl || undefined,
    customOpenaiUrl: profile?.customOpenaiUrl || undefined,
    customOpenaiKey: profile?.customOpenaiKey || undefined,
    openRouterKey: profile?.openRouterKey || undefined,
    xaiKey: profile?.xaiKey || undefined,
    anthropicKey: profile?.anthropicKey || undefined,
    geminiKey: profile?.geminiKey || undefined,
  };
}

export { DEFAULT_MODELS };
