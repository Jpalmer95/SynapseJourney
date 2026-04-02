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
  provider: "openai" | "huggingface" | "ollama" | "openrouter" | "gemini";
  huggingFaceToken?: string;
  ollamaUrl?: string;
  openRouterKey?: string;
  preferredModel?: string;
}

// The known-good fallback model — used when the primary model returns a 404.
// Never change this to an experimental or preview model.
const GEMINI_FALLBACK_MODEL = "gemini-2.0-flash";

// The primary Gemini model for course content generation.
// Override at runtime (no redeploy needed) via the GEMINI_COURSE_MODEL env var:
//   GEMINI_COURSE_MODEL=gemini-2.5-pro
// Falls back to gemini-2.0-flash if the env var is not set.
const GEMINI_COURSE_MODEL = process.env.GEMINI_COURSE_MODEL || GEMINI_FALLBACK_MODEL;

console.log(`[AI] Course content model: ${GEMINI_COURSE_MODEL} (fallback: ${GEMINI_FALLBACK_MODEL})`);

const DEFAULT_MODELS: Record<string, string> = {
  openai: GEMINI_COURSE_MODEL,
  gemini: GEMINI_COURSE_MODEL,
  huggingface: "meta-llama/Llama-3.3-70B-Instruct",
  ollama: "llama3.2",
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
        max_tokens: options?.maxTokens,
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

const defaultOpenAIProvider = new OpenAIProvider();
const defaultGeminiProvider = new GeminiProvider();

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
 * 1. COURSE CONTENT (Gemini - platform pays)
 *    - Lesson units, roadmaps, practice tests, custom topics
 *    - Uses: getCourseContentProvider() or generateCourseContent()
 *    - Shared across all users, generated once and cached in database
 *    - Model: GEMINI_COURSE_MODEL env var (default: gemini-2.0-flash)
 *      Override without a redeploy: set GEMINI_COURSE_MODEL to any valid model ID.
 *      If the model returns a 404, GeminiProvider automatically falls back to
 *      gemini-2.0-flash and logs a warning so the issue is never silent.
 *
 * 2. USER CHAT/Q&A (User's choice - user pays via their API keys)
 *    - Interactive tutoring, follow-up questions, exploration
 *    - Uses: getUserChatProvider() with user's provider config
 *    - Personal to each user, unlimited if they use their own keys
 */

/**
 * Get the provider for generating shared course content.
 * ALWAYS returns the platform Gemini provider — user preferences are ignored.
 * Use this for: lesson units, roadmaps, practice tests, topic content.
 */
export function getCourseContentProvider(): AIProvider {
  return defaultGeminiProvider;
}

/**
 * Generate course content via Gemini.
 * This is a convenience wrapper that ensures course content is always
 * generated with consistent quality using the platform's AI credits.
 * The active model is controlled by GEMINI_COURSE_MODEL (default: gemini-2.0-flash).
 */
export async function generateCourseContent(
  messages: { role: string; content: string }[],
  options?: ChatOptions
): Promise<string> {
  return defaultGeminiProvider.chat(messages, options);
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

    case "openrouter":
      return new OpenRouterProvider(config.openRouterKey!, config.preferredModel);

    default:
      return null;
  }
}

export { DEFAULT_MODELS };
