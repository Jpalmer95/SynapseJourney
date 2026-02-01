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

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gemini-3-pro-preview", // Switched default for Replit OpenAI wrapper
  gemini: "gemini-3-pro-preview",
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
    const model = this.client.getGenerativeModel({ 
      model: modelName
    });

    const generationConfig = {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens,
      responseMimeType: options?.responseFormat === "json" ? "application/json" : "text/plain",
    };

    const chatHistory = messages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;
    const result = await model.generateContent({
      contents: [...chatHistory, { role: "user", parts: [{ text: lastMessage }] }],
      generationConfig
    });

    return result.response.text();
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

export { DEFAULT_MODELS };
