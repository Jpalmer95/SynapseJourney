/**
 * Bring Your Own Subscription (BYOS) — OAuth Device-Code & PKCE Engine
 *
 * Allows learners to authenticate directly with AI subscriptions that expose
 * OAuth device-code or PKCE flows ( mirroring Hermes Agent's multi-provider auth):
 *   1. xai_oauth     — xAI Grok Subscription (SuperGrok / X Premium+) via auth.x.ai
 *   2. nous_oauth    — Nous Portal Subscription (Hermes / Nous Research) via portal.nousresearch.com
 *   3. openai_codex  — OpenAI ChatGPT Subscription (Plus / Pro / Team Codex) via auth.openai.com
 *   4. minimax_oauth — MiniMax Account Subscription via api.minimax.io
 *   5. openrouter    — OpenRouter 1-Click OAuth PKCE key exchange via openrouter.ai/auth
 *
 * Also documents provider policy boundaries (Anthropic Claude Pro/Max and Google
 * Gemini Advanced consumer plans prohibit third-party hosted web OAuth minting,
 * and instead bridge into SynapseJourney via Hermes Agent / Claude Code + Native MCP `/api/mcp`).
 *
 * Security invariants:
 * - All access_token and refresh_token values are AES-256-GCM encrypted at rest in
 *   `user_profiles.oauth_subscriptions`.
 * - Single-use rotating refresh tokens (xAI, OpenAI Codex, Nous, MiniMax) are refreshed
 *   under a per-(userId, provider) in-memory mutex and re-read from storage before POSTing
 *   so concurrent requests never replay a consumed refresh token.
 * - Token endpoints and inference base URLs are strictly validated against provider host allowlists.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";

export type OAuthSubscriptionProviderId =
  | "xai_oauth"
  | "nous_oauth"
  | "openai_codex"
  | "minimax_oauth";

export const OAUTH_SUBSCRIPTION_PROVIDER_IDS: readonly OAuthSubscriptionProviderId[] = [
  "xai_oauth",
  "nous_oauth",
  "openai_codex",
  "minimax_oauth",
] as const;

export function isOAuthSubscriptionProviderId(v: unknown): v is OAuthSubscriptionProviderId {
  return typeof v === "string" && (OAUTH_SUBSCRIPTION_PROVIDER_IDS as readonly string[]).includes(v);
}

export interface StoredOAuthSubscription {
  provider: OAuthSubscriptionProviderId;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  tokenPreview: string;
  tokenEndpoint?: string;
  portalBaseUrl?: string;
  inferenceBaseUrl?: string;
  accountLabel?: string | null;
  expiresAt?: string | null;
  lastRefresh: string;
  connectedAt: string;
  lastAuthError?: {
    code: string;
    message: string;
    reloginRequired: boolean;
    at: string;
  } | null;
}

export type StoredOAuthSubscriptionsMap = Partial<Record<OAuthSubscriptionProviderId, StoredOAuthSubscription>>;

export interface SanitizedOAuthSubscriptionStatus {
  connected: boolean;
  provider: OAuthSubscriptionProviderId;
  tokenPreview?: string;
  accountLabel?: string | null;
  expiresAt?: string | null;
  lastRefresh?: string | null;
  connectedAt?: string | null;
  hasRefreshToken?: boolean;
  reloginRequired?: boolean;
  errorMessage?: string | null;
}

export interface OAuthCatalogEntry {
  id: OAuthSubscriptionProviderId | "openrouter_pkce" | "claude_bridge" | "gemini_bridge";
  name: string;
  badge: string;
  subscriptionPlans: string;
  flow: "device_code" | "pkce_redirect" | "external_bridge";
  defaultModel: string;
  docsUrl: string;
  description: string;
  policyNote?: string;
}

// ── Constants (matching Hermes Agent auth_constants.py) ─────────────────────

export const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
export const FORM_JSON_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept: "application/json",
};

// 1. xAI Grok OAuth
export const XAI_OAUTH_ISSUER = "https://auth.x.ai";
export const XAI_OAUTH_DISCOVERY_URL = `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`;
export const XAI_OAUTH_DEVICE_CODE_URL = `${XAI_OAUTH_ISSUER}/oauth2/device/code`;
export const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access";
export const DEFAULT_XAI_OAUTH_BASE_URL = "https://api.x.ai/v1";
export const XAI_DEFAULT_MODEL = process.env.XAI_COURSE_MODEL || "grok-3-mini";

// 2. Nous Portal OAuth
export const DEFAULT_NOUS_PORTAL_URL = "https://portal.nousresearch.com";
export const DEFAULT_NOUS_INFERENCE_URL = "https://inference-api.nousresearch.com/v1";
export const DEFAULT_NOUS_WELCOME_URL = "https://welcome-api.nousresearch.com/v1";
export const DEFAULT_NOUS_CLIENT_ID = "hermes-cli";
export const DEFAULT_NOUS_SCOPE = "inference:invoke";
export const NOUS_DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash";
const ALLOWED_NOUS_INFERENCE_HOSTS = new Set([
  "inference-api.nousresearch.com",
  "welcome-api.nousresearch.com",
]);

// 3. OpenAI ChatGPT / Codex OAuth
export const CODEX_OAUTH_ISSUER = "https://auth.openai.com";
export const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const CODEX_OAUTH_TOKEN_URL = "https://auth.openai.com/oauth/token";
export const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
export const CODEX_DEFAULT_MODEL = "gpt-5.4";

// 4. MiniMax OAuth
export const MINIMAX_OAUTH_PORTAL_URL = "https://api.minimax.io";
export const MINIMAX_OAUTH_INFERENCE_URL = "https://api.minimax.io/anthropic";
export const MINIMAX_OAUTH_CLIENT_ID = "78257093-7e40-4613-99e0-527b14b39113";
export const MINIMAX_OAUTH_SCOPE = "group_id profile model.completion";
export const MINIMAX_OAUTH_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:user_code";
export const MINIMAX_DEFAULT_MODEL = "MiniMax-M2.5";

// 5. OpenRouter PKCE
export const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
export const OPENROUTER_AUTH_KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";

export const OAUTH_SUBSCRIPTION_CATALOG: readonly OAuthCatalogEntry[] = [
  {
    id: "xai_oauth",
    name: "xAI Grok Subscription",
    badge: "SuperGrok / X Premium+",
    subscriptionPlans: "SuperGrok or eligible X Premium+ subscription",
    flow: "device_code",
    defaultModel: XAI_DEFAULT_MODEL,
    docsUrl: "https://x.ai/grok",
    description:
      "Sign in with your xAI / Grok account via OAuth device code. Uses your subscription's API/CLI allowance with automatic token refresh.",
    policyNote:
      "Note: xAI gates OAuth API access to eligible SuperGrok tiers. If your tier returns HTTP 403, you can also paste an xAI API key.",
  },
  {
    id: "nous_oauth",
    name: "Nous Research Portal",
    badge: "Nous / Hermes Subscription",
    subscriptionPlans: "Nous Portal subscription or credit tier",
    flow: "device_code",
    defaultModel: NOUS_DEFAULT_MODEL,
    docsUrl: "https://portal.nousresearch.com",
    description:
      "Connect your Nous Portal account with a 1-click device code to run DeepSeek V4.1, Hermes, and frontier models included in your Nous plan.",
  },
  {
    id: "openai_codex",
    name: "OpenAI ChatGPT Subscription",
    badge: "ChatGPT Plus / Pro / Team",
    subscriptionPlans: "ChatGPT Plus, Pro, Team, or Enterprise (with Codex device login enabled)",
    flow: "device_code",
    defaultModel: CODEX_DEFAULT_MODEL,
    docsUrl: "https://chatgpt.com",
    description:
      "Sign in with your ChatGPT subscription via OpenAI's Codex device flow. Uses your included ChatGPT Codex allowance without separate API billing.",
    policyNote:
      "Requires device-code login enabled in your ChatGPT security settings. Respects your plan's rolling rate-limit window.",
  },
  {
    id: "minimax_oauth",
    name: "MiniMax Account (OAuth)",
    badge: "MiniMax Coding / Plan",
    subscriptionPlans: "MiniMax account / subscription plan (minimax.io)",
    flow: "device_code",
    defaultModel: MINIMAX_DEFAULT_MODEL,
    docsUrl: "https://www.minimax.io",
    description:
      "Authenticate with your MiniMax account via device code + PKCE to run MiniMax-M2.5 for course generation and AI tutoring.",
  },
  {
    id: "openrouter_pkce",
    name: "OpenRouter 1-Click Connect",
    badge: "OAuth PKCE",
    subscriptionPlans: "OpenRouter account (free or prepaid credits across 200+ models)",
    flow: "pkce_redirect",
    defaultModel: "anthropic/claude-3.5-sonnet",
    docsUrl: "https://openrouter.ai/docs/guides/overview/auth/oauth",
    description:
      "Authorize SynapseJourney in your browser via OpenRouter OAuth PKCE — automatically provisions and saves your key without manual copy-paste.",
  },
  {
    id: "claude_bridge",
    name: "Anthropic Claude Pro / Max",
    badge: "Via Local Agent / MCP",
    subscriptionPlans: "Claude Pro / Max (via Claude Code or Hermes Agent)",
    flow: "external_bridge",
    defaultModel: "claude-sonnet-4-20250514",
    docsUrl: "https://synapsejourney.org/agents",
    description:
      "Anthropic's OAuth policy prohibits third-party hosted web servers from minting consumer Claude Pro/Max tokens directly. Instead, connect Claude Code or Hermes Agent locally to SynapseJourney's Native MCP Server (/api/mcp) or PAT (/api/learn/ingest) to author courses on your subscription at $0 extra cost, or use an Anthropic API key.",
  },
  {
    id: "gemini_bridge",
    name: "Google Gemini (AI Studio Free Tier / Bridge)",
    badge: "Free Key or Hermes",
    subscriptionPlans: "Google AI Studio Free Tier or Hermes Agent",
    flow: "external_bridge",
    defaultModel: "gemini-2.5-flash",
    docsUrl: "https://aistudio.google.com/apikey",
    description:
      "Google One 'Gemini Advanced' consumer plans do not expose a third-party OAuth LLM endpoint, but Google AI Studio provides a generous free-tier Gemini API key in one click (no credit card required), or you can author courses via Hermes Agent.",
  },
] as const;

// ── AES-256-GCM Token Encryption & JWT Helpers ──────────────────────────────

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || "default-dev-key-change-in-production!32";
const IV_LENGTH = 16;

export function encryptOAuthSecret(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"));
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptOAuthSecret(encryptedStr: string | undefined | null): string {
  if (!encryptedStr || typeof encryptedStr !== "string") return "";
  try {
    const [ivHex, authTagHex, encrypted] = encryptedStr.split(":");
    if (!ivHex || !authTagHex || !encrypted) return "";
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let dec = decipher.update(encrypted, "hex", "utf8");
    dec += decipher.final("utf8");
    return dec;
  } catch {
    return "";
  }
}

export function maskTokenPreview(token: string | undefined | null, visible = 6): string {
  if (!token) return "";
  let s = String(token).trim();
  if (!s) return "";
  if (s.split(".").length >= 3) {
    s = s.split(".").pop() || s;
  }
  return s.length <= visible ? s : `…${s.slice(-visible)}`;
}

export function decodeJwtClaims(token: string | undefined | null): Record<string, any> {
  if (!token || typeof token !== "string") return {};
  const parts = token.split(".");
  if (parts.length !== 3) return {};
  try {
    const payloadB64 = parts[1] + "=".repeat((4 - (parts[1].length % 4)) % 4);
    const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function extractJwtExpiryIso(token: string | undefined | null, fallbackExpiresInSec?: number | null): string | null {
  const claims = decodeJwtClaims(token);
  if (typeof claims.exp === "number" && Number.isFinite(claims.exp)) {
    return new Date(claims.exp * 1000).toISOString();
  }
  if (typeof fallbackExpiresInSec === "number" && Number.isFinite(fallbackExpiresInSec) && fallbackExpiresInSec > 0) {
    return new Date(Date.now() + fallbackExpiresInSec * 1000).toISOString();
  }
  return null;
}

export function extractAccountLabel(token: string | undefined | null): string | null {
  const claims = decodeJwtClaims(token);
  if (typeof claims.email === "string" && claims.email.trim()) return claims.email.trim();
  if (typeof claims.preferred_username === "string" && claims.preferred_username.trim()) return claims.preferred_username.trim();
  const openaiProfile = claims["https://api.openai.com/profile"];
  if (openaiProfile && typeof openaiProfile.email === "string") return openaiProfile.email;
  const openaiAuth = claims["https://api.openai.com/auth"];
  if (openaiAuth && typeof openaiAuth.chatgpt_plan_type === "string") {
    return `ChatGPT (${openaiAuth.chatgpt_plan_type})`;
  }
  if (typeof claims.sub === "string" && claims.sub.trim()) {
    return claims.sub.length > 24 ? `${claims.sub.slice(0, 12)}…` : claims.sub;
  }
  return null;
}

export function isTokenExpiring(
  accessToken: string,
  expiresAtIso?: string | null,
  skewSeconds = 120,
): boolean {
  const claims = decodeJwtClaims(accessToken);
  const nowSec = Date.now() / 1000;
  if (typeof claims.exp === "number" && Number.isFinite(claims.exp)) {
    // Mirror Hermes xAI proactive skew: short-lived (<45m) tokens use 120s skew
    // so we don't refresh on every call; longer tokens use the requested skew.
    const remaining = claims.exp - nowSec;
    const effectiveSkew = remaining > 0 && remaining <= 45 * 60 ? Math.min(120, skewSeconds) : skewSeconds;
    return claims.exp <= nowSec + Math.max(0, effectiveSkew);
  }
  if (expiresAtIso) {
    const expMs = Date.parse(expiresAtIso);
    if (!Number.isNaN(expMs)) {
      return expMs <= Date.now() + Math.max(0, skewSeconds) * 1000;
    }
  }
  return false;
}

export function generatePkcePair(): { verifier: string; challenge: string; state: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

// ── Sanitized Status Helper (safe for client responses) ─────────────────────

export function sanitizeOAuthSubscriptionsMap(
  rawMap: unknown,
): Record<OAuthSubscriptionProviderId, SanitizedOAuthSubscriptionStatus> {
  const map = (rawMap && typeof rawMap === "object" ? rawMap : {}) as StoredOAuthSubscriptionsMap;
  const result = {} as Record<OAuthSubscriptionProviderId, SanitizedOAuthSubscriptionStatus>;

  for (const id of OAUTH_SUBSCRIPTION_PROVIDER_IDS) {
    const entry = map[id];
    const hasAccess = Boolean(entry?.encryptedAccessToken);
    const hasRefresh = Boolean(entry?.encryptedRefreshToken);
    const reloginRequired = Boolean(entry?.lastAuthError?.reloginRequired && !hasAccess);
    result[id] = {
      connected: hasAccess && !reloginRequired,
      provider: id,
      tokenPreview: entry?.tokenPreview || undefined,
      accountLabel: entry?.accountLabel || null,
      expiresAt: entry?.expiresAt || null,
      lastRefresh: entry?.lastRefresh || null,
      connectedAt: entry?.connectedAt || null,
      hasRefreshToken: hasRefresh,
      reloginRequired,
      errorMessage: entry?.lastAuthError?.message || null,
    };
  }
  return result;
}

export function hasUsableOAuthSubscription(
  rawMap: unknown,
  provider: OAuthSubscriptionProviderId,
): boolean {
  if (!rawMap || typeof rawMap !== "object") return false;
  const entry = (rawMap as StoredOAuthSubscriptionsMap)[provider];
  if (!entry || !entry.encryptedAccessToken) return false;
  if (entry.lastAuthError?.reloginRequired) return false;
  return true;
}

export function firstConnectedOAuthProvider(rawMap: unknown): OAuthSubscriptionProviderId | null {
  for (const id of OAUTH_SUBSCRIPTION_PROVIDER_IDS) {
    if (hasUsableOAuthSubscription(rawMap, id)) return id;
  }
  return null;
}

// ── Per-(userId, provider) Refresh Mutex ────────────────────────────────────

const refreshLocks = new Map<string, Promise<any>>();

async function withUserProviderLock<T>(
  userId: string,
  provider: OAuthSubscriptionProviderId,
  fn: () => Promise<T>,
): Promise<T> {
  const key = `${userId}:${provider}`;
  const prev = refreshLocks.get(key) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  refreshLocks.set(
    key,
    prev.then(() => gate, () => gate),
  );
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (refreshLocks.get(key) === gate) {
      refreshLocks.delete(key);
    }
  }
}

// ── Provider-Specific OIDC / Origin Validation ──────────────────────────────

function isXaiOriginHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "x.ai" || h.endsWith(".x.ai");
}

export function validateXaiEndpointUrl(urlStr: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid xAI ${field} URL: ${urlStr}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`Refusing non-HTTPS xAI ${field}: ${urlStr}`);
  }
  if (!isXaiOriginHost(parsed.hostname)) {
    throw new Error(`xAI ${field} host ${parsed.hostname} is not on the x.ai origin`);
  }
  return urlStr.replace(/\/+$/, "");
}

export function validateNousInferenceUrl(urlStr?: string | null): string {
  if (!urlStr || typeof urlStr !== "string") return DEFAULT_NOUS_INFERENCE_URL;
  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol === "https:" && ALLOWED_NOUS_INFERENCE_HOSTS.has(parsed.hostname.toLowerCase())) {
      return urlStr.trim().replace(/\/+$/, "");
    }
  } catch {
    // ignore and return default
  }
  return DEFAULT_NOUS_INFERENCE_URL;
}

export async function discoverXaiOAuthEndpoints(timeoutMs = 15_000): Promise<{
  authorizationEndpoint: string;
  tokenEndpoint: string;
}> {
  const resp = await fetch(XAI_OAUTH_DISCOVERY_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    throw new Error(`xAI OIDC discovery failed (HTTP ${resp.status})`);
  }
  const data = (await resp.json()) as Record<string, unknown>;
  const authEp = String(data.authorization_endpoint || "").trim();
  const tokenEp = String(data.token_endpoint || "").trim();
  if (!authEp || !tokenEp) {
    throw new Error("xAI OIDC discovery response missing authorization_endpoint or token_endpoint");
  }
  return {
    authorizationEndpoint: validateXaiEndpointUrl(authEp, "authorization_endpoint"),
    tokenEndpoint: validateXaiEndpointUrl(tokenEp, "token_endpoint"),
  };
}

// ── Pure Token Refresh Functions (per provider) ─────────────────────────────

export interface RefreshedTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null;
  tokenEndpoint?: string;
  inferenceBaseUrl?: string;
  accountLabel?: string | null;
}

export async function refreshXaiOAuthToken(
  refreshToken: string,
  cachedTokenEndpoint?: string,
): Promise<RefreshedTokenBundle> {
  const tokenEndpoint = cachedTokenEndpoint
    ? validateXaiEndpointUrl(cachedTokenEndpoint, "token_endpoint")
    : (await discoverXaiOAuthEndpoints()).tokenEndpoint;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: XAI_OAUTH_CLIENT_ID,
    refresh_token: refreshToken,
  });

  const resp = await fetch(tokenEndpoint, {
    method: "POST",
    headers: FORM_JSON_HEADERS,
    body: body.toString(),
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok) {
    const detail = (await resp.text().catch(() => "")).slice(0, 300);
    if (resp.status === 403) {
      const err: any = new Error(
        `xAI token refresh returned HTTP 403. Your xAI account may not be on a SuperGrok tier that includes OAuth API access. ` +
          `Switch to an xAI API Key (xai-...) in Settings or upgrade at https://x.ai/grok.` +
          (detail ? ` (${detail})` : ""),
      );
      err.code = "xai_oauth_tier_denied";
      err.reloginRequired = false;
      throw err;
    }
    const err: any = new Error(`xAI OAuth token refresh failed (HTTP ${resp.status})${detail ? `: ${detail}` : ""}`);
    err.code = "xai_refresh_failed";
    err.reloginRequired = resp.status === 400 || resp.status === 401;
    throw err;
  }

  const payload = (await resp.json()) as Record<string, any>;
  const newAccess = String(payload.access_token || "").trim();
  if (!newAccess) {
    throw new Error("xAI token refresh response missing access_token");
  }
  const newRefresh = String(payload.refresh_token || refreshToken).trim();
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : undefined;
  return {
    accessToken: newAccess,
    refreshToken: newRefresh,
    expiresAt: extractJwtExpiryIso(newAccess, expiresIn),
    tokenEndpoint,
    inferenceBaseUrl: DEFAULT_XAI_OAUTH_BASE_URL,
    accountLabel: extractAccountLabel(newAccess) || extractAccountLabel(payload.id_token),
  };
}

export async function refreshNousOAuthToken(
  refreshToken: string,
  portalBaseUrl = DEFAULT_NOUS_PORTAL_URL,
): Promise<RefreshedTokenBundle> {
  const cleanPortal = portalBaseUrl.replace(/\/+$/, "");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: DEFAULT_NOUS_CLIENT_ID,
    refresh_token: refreshToken,
  });

  const resp = await fetch(`${cleanPortal}/api/oauth/token`, {
    method: "POST",
    headers: FORM_JSON_HEADERS,
    body: body.toString(),
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok) {
    const detail = (await resp.text().catch(() => "")).slice(0, 300);
    const err: any = new Error(`Nous Portal token refresh failed (HTTP ${resp.status})${detail ? `: ${detail}` : ""}`);
    err.code = "nous_refresh_failed";
    err.reloginRequired = resp.status === 400 || resp.status === 401 || resp.status === 403;
    throw err;
  }

  const payload = (await resp.json()) as Record<string, any>;
  const newAccess = String(payload.access_token || "").trim();
  if (!newAccess) {
    throw new Error("Nous Portal token refresh response missing access_token");
  }
  const newRefresh = String(payload.refresh_token || refreshToken).trim();
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : undefined;
  return {
    accessToken: newAccess,
    refreshToken: newRefresh,
    expiresAt: extractJwtExpiryIso(newAccess, expiresIn),
    inferenceBaseUrl: validateNousInferenceUrl(payload.inference_base_url),
    accountLabel: extractAccountLabel(newAccess),
  };
}

export async function refreshCodexOAuthToken(refreshToken: string): Promise<RefreshedTokenBundle> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CODEX_OAUTH_CLIENT_ID,
    refresh_token: refreshToken,
  });

  const resp = await fetch(CODEX_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      ...FORM_JSON_HEADERS,
      "User-Agent": "codex_cli_rs/0.0.0 (SynapseJourney)",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(20_000),
  });

  if (resp.status === 429) {
    const err: any = new Error(
      "OpenAI ChatGPT / Codex rate limit reached (HTTP 429). Your credentials are still valid — wait for your rolling window to reset.",
    );
    err.code = "codex_rate_limited";
    err.reloginRequired = false;
    throw err;
  }

  if (!resp.ok) {
    const detail = (await resp.text().catch(() => "")).slice(0, 300);
    const err: any = new Error(`OpenAI Codex token refresh failed (HTTP ${resp.status})${detail ? `: ${detail}` : ""}`);
    err.code = "codex_refresh_failed";
    err.reloginRequired = resp.status === 400 || resp.status === 401 || resp.status === 403;
    throw err;
  }

  const payload = (await resp.json()) as Record<string, any>;
  const newAccess = String(payload.access_token || "").trim();
  if (!newAccess) {
    throw new Error("OpenAI Codex token refresh response missing access_token");
  }
  const newRefresh = String(payload.refresh_token || refreshToken).trim();
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : undefined;
  return {
    accessToken: newAccess,
    refreshToken: newRefresh,
    expiresAt: extractJwtExpiryIso(newAccess, expiresIn),
    inferenceBaseUrl: DEFAULT_CODEX_BASE_URL,
    accountLabel: extractAccountLabel(newAccess),
  };
}

function resolveMiniMaxExpiryIso(expiredInRaw: unknown): string {
  const raw = Number(expiredInRaw);
  const nowMs = Date.now();
  if (!Number.isFinite(raw) || raw <= 0) {
    return new Date(nowMs + 3600 * 1000).toISOString();
  }
  // MiniMax uses ms epoch when > nowMs/2, otherwise TTL seconds
  if (raw > nowMs / 2) {
    return new Date(raw).toISOString();
  }
  return new Date(nowMs + raw * 1000).toISOString();
}

export async function refreshMiniMaxOAuthToken(
  refreshToken: string,
  portalBaseUrl = MINIMAX_OAUTH_PORTAL_URL,
): Promise<RefreshedTokenBundle> {
  const cleanPortal = portalBaseUrl.replace(/\/+$/, "");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: MINIMAX_OAUTH_CLIENT_ID,
    refresh_token: refreshToken,
  });

  const resp = await fetch(`${cleanPortal}/oauth/token`, {
    method: "POST",
    headers: FORM_JSON_HEADERS,
    body: body.toString(),
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok) {
    const detail = (await resp.text().catch(() => "")).slice(0, 300);
    const lower = detail.toLowerCase();
    const err: any = new Error(`MiniMax OAuth token refresh failed (HTTP ${resp.status})${detail ? `: ${detail}` : ""}`);
    err.code = "minimax_refresh_failed";
    err.reloginRequired =
      resp.status === 400 ||
      resp.status === 401 ||
      lower.includes("invalid_grant") ||
      lower.includes("refresh_token_reused");
    throw err;
  }

  const payload = (await resp.json()) as Record<string, any>;
  if (payload.status && payload.status !== "success") {
    const err: any = new Error(`MiniMax OAuth refresh returned status=${payload.status}`);
    err.code = "minimax_refresh_failed";
    err.reloginRequired = true;
    throw err;
  }
  const newAccess = String(payload.access_token || "").trim();
  if (!newAccess) {
    throw new Error("MiniMax OAuth refresh response missing access_token");
  }
  const newRefresh = String(payload.refresh_token || refreshToken).trim();
  return {
    accessToken: newAccess,
    refreshToken: newRefresh,
    expiresAt: resolveMiniMaxExpiryIso(payload.expired_in),
    inferenceBaseUrl: MINIMAX_OAUTH_INFERENCE_URL,
    accountLabel: "MiniMax OAuth",
  };
}

// ── Persistence & Runtime Resolution ────────────────────────────────────────

export async function saveUserOAuthSubscription(
  userId: string,
  provider: OAuthSubscriptionProviderId,
  bundle: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string | null;
    tokenEndpoint?: string;
    portalBaseUrl?: string;
    inferenceBaseUrl?: string;
    accountLabel?: string | null;
  },
  opts: { setPreferred?: boolean } = { setPreferred: true },
): Promise<StoredOAuthSubscription> {
  const { storage } = await import("./storage");
  const profile = await storage.getUserProfile(userId);
  const currentMap: StoredOAuthSubscriptionsMap = {
    ...(((profile as any)?.oauthSubscriptions && typeof (profile as any).oauthSubscriptions === "object"
      ? (profile as any).oauthSubscriptions
      : {}) as StoredOAuthSubscriptionsMap),
  };

  const nowIso = new Date().toISOString();
  const prev = currentMap[provider];
  const entry: StoredOAuthSubscription = {
    provider,
    encryptedAccessToken: encryptOAuthSecret(bundle.accessToken),
    encryptedRefreshToken: bundle.refreshToken
      ? encryptOAuthSecret(bundle.refreshToken)
      : prev?.encryptedRefreshToken,
    tokenPreview: maskTokenPreview(bundle.accessToken),
    tokenEndpoint: bundle.tokenEndpoint || prev?.tokenEndpoint,
    portalBaseUrl: bundle.portalBaseUrl || prev?.portalBaseUrl,
    inferenceBaseUrl: bundle.inferenceBaseUrl || prev?.inferenceBaseUrl,
    accountLabel: bundle.accountLabel ?? prev?.accountLabel ?? extractAccountLabel(bundle.accessToken),
    expiresAt: bundle.expiresAt !== undefined ? bundle.expiresAt : prev?.expiresAt ?? null,
    lastRefresh: nowIso,
    connectedAt: prev?.connectedAt || nowIso,
    lastAuthError: null,
  };

  currentMap[provider] = entry;

  const profileUpdates: Record<string, any> = {
    oauthSubscriptions: currentMap,
  };
  if (opts.setPreferred) {
    profileUpdates.preferredAiProvider = provider;
  }

  await storage.createOrUpdateUserProfile(userId, profileUpdates as any);
  return entry;
}

export async function disconnectUserOAuthSubscription(
  userId: string,
  provider: OAuthSubscriptionProviderId,
): Promise<boolean> {
  const { storage } = await import("./storage");
  const profile = await storage.getUserProfile(userId);
  const currentMap: StoredOAuthSubscriptionsMap = {
    ...(((profile as any)?.oauthSubscriptions && typeof (profile as any).oauthSubscriptions === "object"
      ? (profile as any).oauthSubscriptions
      : {}) as StoredOAuthSubscriptionsMap),
  };

  const existed = Boolean(currentMap[provider]);
  delete currentMap[provider];

  const updates: Record<string, any> = {
    oauthSubscriptions: currentMap,
  };
  if (profile?.preferredAiProvider === provider) {
    const nextConnected = firstConnectedOAuthProvider(currentMap);
    updates.preferredAiProvider = nextConnected || "openai";
  }

  await storage.createOrUpdateUserProfile(userId, updates as any);
  return existed;
}

/**
 * Resolve a valid runtime access token for a user's OAuth subscription,
 * proactively refreshing and persisting rotated tokens when near expiry.
 */
export async function resolveOAuthRuntimeCredentials(
  userId: string | undefined,
  provider: OAuthSubscriptionProviderId,
  initialMap?: StoredOAuthSubscriptionsMap,
  opts: { forceRefresh?: boolean } = {},
): Promise<{
  accessToken: string;
  inferenceBaseUrl: string;
  accountLabel?: string | null;
}> {
  const getEntryFromMap = (m?: StoredOAuthSubscriptionsMap): StoredOAuthSubscription | undefined =>
    m ? m[provider] : undefined;

  let entry = getEntryFromMap(initialMap);
  if (!entry && userId) {
    const { storage } = await import("./storage");
    const profile = await storage.getUserProfile(userId);
    entry = getEntryFromMap((profile as any)?.oauthSubscriptions);
  }

  if (!entry || !entry.encryptedAccessToken) {
    throw new Error(`No ${provider} subscription connected. Sign in under Settings → Bring Your Own Subscription.`);
  }

  const accessToken = decryptOAuthSecret(entry.encryptedAccessToken);
  const refreshToken = decryptOAuthSecret(entry.encryptedRefreshToken);

  if (!accessToken) {
    throw new Error(`Stored ${provider} credentials could not be decrypted. Please reconnect in Settings.`);
  }

  const skewSec = provider === "xai_oauth" ? 3600 : 120;
  const needsRefresh = Boolean(opts.forceRefresh) || isTokenExpiring(accessToken, entry.expiresAt, skewSec);

  if (!needsRefresh || !refreshToken || !userId) {
    return {
      accessToken,
      inferenceBaseUrl:
        entry.inferenceBaseUrl ||
        (provider === "xai_oauth"
          ? DEFAULT_XAI_OAUTH_BASE_URL
          : provider === "nous_oauth"
            ? DEFAULT_NOUS_INFERENCE_URL
            : provider === "openai_codex"
              ? DEFAULT_CODEX_BASE_URL
              : MINIMAX_OAUTH_INFERENCE_URL),
      accountLabel: entry.accountLabel,
    };
  }

  return withUserProviderLock(userId, provider, async () => {
    const { storage } = await import("./storage");
    const freshProfile = await storage.getUserProfile(userId);
    const freshMap = ((freshProfile as any)?.oauthSubscriptions || {}) as StoredOAuthSubscriptionsMap;
    const freshEntry = freshMap[provider];

    if (freshEntry && freshEntry.lastRefresh !== entry!.lastRefresh) {
      const peerAccess = decryptOAuthSecret(freshEntry.encryptedAccessToken);
      if (peerAccess && !isTokenExpiring(peerAccess, freshEntry.expiresAt, 60)) {
        return {
          accessToken: peerAccess,
          inferenceBaseUrl: freshEntry.inferenceBaseUrl || entry!.inferenceBaseUrl || DEFAULT_XAI_OAUTH_BASE_URL,
          accountLabel: freshEntry.accountLabel,
        };
      }
    }

    const activeRefreshToken = decryptOAuthSecret(freshEntry?.encryptedRefreshToken) || refreshToken;
    try {
      let refreshed: RefreshedTokenBundle;
      if (provider === "xai_oauth") {
        refreshed = await refreshXaiOAuthToken(activeRefreshToken, freshEntry?.tokenEndpoint || entry?.tokenEndpoint);
      } else if (provider === "nous_oauth") {
        refreshed = await refreshNousOAuthToken(activeRefreshToken, freshEntry?.portalBaseUrl || entry?.portalBaseUrl);
      } else if (provider === "openai_codex") {
        refreshed = await refreshCodexOAuthToken(activeRefreshToken);
      } else {
        refreshed = await refreshMiniMaxOAuthToken(activeRefreshToken, freshEntry?.portalBaseUrl || entry?.portalBaseUrl);
      }

      const saved = await saveUserOAuthSubscription(
        userId,
        provider,
        {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: refreshed.expiresAt,
          tokenEndpoint: refreshed.tokenEndpoint,
          inferenceBaseUrl: refreshed.inferenceBaseUrl,
          accountLabel: refreshed.accountLabel,
        },
        { setPreferred: false },
      );

      return {
        accessToken: refreshed.accessToken,
        inferenceBaseUrl:
          saved.inferenceBaseUrl ||
          refreshed.inferenceBaseUrl ||
          DEFAULT_XAI_OAUTH_BASE_URL,
        accountLabel: saved.accountLabel,
      };
    } catch (err: any) {
      if (err?.reloginRequired && freshEntry) {
        freshMap[provider] = {
          ...freshEntry,
          encryptedAccessToken: "",
          encryptedRefreshToken: "",
          lastAuthError: {
            code: String(err.code || "refresh_failed"),
            message: String(err.message || "Session expired — please sign in again."),
            reloginRequired: true,
            at: new Date().toISOString(),
          },
        };
        await storage.createOrUpdateUserProfile(userId, { oauthSubscriptions: freshMap } as any);
      }
      throw err;
    }
  });
}

// ── OpenAI Codex Responses API SSE Caller ───────────────────────────────────

export function buildCodexAccountHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "codex_cli_rs/0.0.0 (SynapseJourney)",
    originator: "codex_cli_rs",
  };
  const claims = decodeJwtClaims(accessToken);
  const authObj = claims["https://api.openai.com/auth"];
  if (authObj && typeof authObj === "object") {
    if (typeof authObj.chatgpt_account_id === "string" && authObj.chatgpt_account_id.trim()) {
      headers["ChatGPT-Account-ID"] = authObj.chatgpt_account_id.trim();
    }
    const residency = authObj.chatgpt_data_residency || authObj.chatgpt_compute_residency;
    if (typeof residency === "string" && residency.trim()) {
      headers["x-openai-internal-codex-residency"] = residency.trim();
    }
  }
  return headers;
}

export async function callCodexResponsesApi(
  accessToken: string,
  messages: { role: string; content: string }[],
  options?: { model?: string; responseFormat?: "text" | "json"; baseUrl?: string },
): Promise<string> {
  const baseUrl = (options?.baseUrl || DEFAULT_CODEX_BASE_URL).replace(/\/+$/, "");
  const model = options?.model || CODEX_DEFAULT_MODEL;

  const systemParts: string[] = [];
  const inputItems: Record<string, any>[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
    } else {
      const role = m.role === "assistant" ? "assistant" : "user";
      const partType = role === "assistant" ? "output_text" : "input_text";
      inputItems.push({
        type: "message",
        role,
        content: [{ type: partType, text: m.content }],
      });
    }
  }

  let instructions = systemParts.join("\n\n").trim() || "You are a helpful, rigorous educational AI assistant.";
  if (options?.responseFormat === "json") {
    instructions += "\n\nRespond ONLY with valid JSON.";
  }

  const bodyPayload: Record<string, any> = {
    model,
    instructions,
    input: inputItems.length > 0 ? inputItems : [{ type: "message", role: "user", content: [{ type: "input_text", text: "Hello" }] }],
    store: false,
    stream: true,
  };

  const resp = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...buildCodexAccountHeaders(accessToken),
    },
    body: JSON.stringify(bodyPayload),
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) {
    const errText = (await resp.text().catch(() => "")).slice(0, 400);
    throw new Error(`OpenAI Codex Responses API error (${resp.status}): ${errText}`);
  }

  const rawText = await resp.text();
  // If endpoint returned a direct JSON object instead of SSE
  if (rawText.trim().startsWith("{")) {
    try {
      const obj = JSON.parse(rawText);
      if (typeof obj.output_text === "string" && obj.output_text) return obj.output_text;
      const chunks: string[] = [];
      for (const item of obj.output || []) {
        if (item?.type === "message" && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (typeof part?.text === "string") chunks.push(part.text);
          }
        }
      }
      if (chunks.length > 0) return chunks.join("");
    } catch {
      // fall through to SSE parser
    }
  }

  // Parse SSE stream lines (`data: {...}`)
  const deltaChunks: string[] = [];
  let completedText = "";

  for (const line of rawText.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") continue;
    try {
      const evt = JSON.parse(dataStr);
      if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
        deltaChunks.push(evt.delta);
      } else if (evt.type === "response.output_text.done" && typeof evt.text === "string") {
        completedText = evt.text;
      } else if (evt.type === "response.output_item.done" && evt.item?.type === "message") {
        const parts = Array.isArray(evt.item.content) ? evt.item.content : [];
        const joined = parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("");
        if (joined) completedText = joined;
      }
    } catch {
      // ignore malformed SSE frame
    }
  }

  return deltaChunks.length > 0 ? deltaChunks.join("") : completedText;
}

// ── In-Browser Device-Code Login Sessions (Poller Engine) ───────────────────

export interface OAuthLoginSession {
  sessionId: string;
  userId: string;
  provider: OAuthSubscriptionProviderId;
  flow: "device_code";
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  expiresAt: number;
  pollInterval: number;
  status: "pending" | "approved" | "denied" | "expired" | "error" | "cancelled";
  errorMessage?: string | null;
  accountLabel?: string | null;
  tokenPreview?: string | null;
  cancelled?: boolean;
  createdAt: number;
}

const activeSessions = new Map<string, OAuthLoginSession>();
const SESSION_TTL_MS = 15 * 60 * 1000;

function gcSessions(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [sid, sess] of Array.from(activeSessions.entries())) {
    if (sess.createdAt < cutoff) {
      sess.cancelled = true;
      activeSessions.delete(sid);
    }
  }
}

function sleepTick(ms: number, isCancelled: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + ms;
    const step = () => {
      if (isCancelled()) return resolve(true);
      const left = deadline - Date.now();
      if (left <= 0) return resolve(false);
      setTimeout(step, Math.min(250, left));
    };
    step();
  });
}

export function getOAuthLoginSession(sessionId: string, userId: string): OAuthLoginSession | null {
  gcSessions();
  const sess = activeSessions.get(sessionId);
  if (!sess || sess.userId !== userId) return null;
  return sess;
}

export function cancelOAuthLoginSession(sessionId: string, userId: string): boolean {
  const sess = activeSessions.get(sessionId);
  if (!sess || sess.userId !== userId) return false;
  sess.cancelled = true;
  sess.status = "cancelled";
  activeSessions.delete(sessionId);
  return true;
}

export async function startOAuthDeviceFlow(
  userId: string,
  provider: OAuthSubscriptionProviderId,
): Promise<OAuthLoginSession> {
  gcSessions();

  if (provider === "xai_oauth") {
    const discovery = await discoverXaiOAuthEndpoints();
    const body = new URLSearchParams({
      client_id: XAI_OAUTH_CLIENT_ID,
      scope: XAI_OAUTH_SCOPE,
    });
    const resp = await fetch(XAI_OAUTH_DEVICE_CODE_URL, {
      method: "POST",
      headers: FORM_JSON_HEADERS,
      body: body.toString(),
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      const detail = (await resp.text().catch(() => "")).slice(0, 300);
      throw new Error(`xAI device-code request failed (HTTP ${resp.status})${detail ? `: ${detail}` : ""}`);
    }
    const data = (await resp.json()) as Record<string, any>;
    const deviceCode = String(data.device_code || "").trim();
    const userCode = String(data.user_code || "").trim();
    const verificationUrl = String(data.verification_uri_complete || data.verification_uri || "").trim();
    const expiresIn = Math.max(60, Number(data.expires_in) || 600);
    const pollInterval = Math.max(2, Number(data.interval) || 5);
    if (!deviceCode || !userCode || !verificationUrl) {
      throw new Error("xAI device-code response missing required fields");
    }

    const session = registerSession(userId, provider, userCode, verificationUrl, expiresIn, pollInterval);
    void pollStandardDeviceToken(session, {
      tokenEndpoint: discovery.tokenEndpoint,
      clientId: XAI_OAUTH_CLIENT_ID,
      deviceCode,
      onSuccess: async (payload) => {
        const accessToken = String(payload.access_token || "").trim();
        const refreshToken = String(payload.refresh_token || "").trim();
        const saved = await saveUserOAuthSubscription(userId, "xai_oauth", {
          accessToken,
          refreshToken,
          expiresAt: extractJwtExpiryIso(accessToken, payload.expires_in),
          tokenEndpoint: discovery.tokenEndpoint,
          inferenceBaseUrl: DEFAULT_XAI_OAUTH_BASE_URL,
          accountLabel: extractAccountLabel(accessToken) || extractAccountLabel(payload.id_token),
        });
        session.accountLabel = saved.accountLabel;
        session.tokenPreview = saved.tokenPreview;
      },
    });
    return session;
  }

  if (provider === "nous_oauth") {
    const portalBaseUrl = (process.env.NOUS_PORTAL_BASE_URL || DEFAULT_NOUS_PORTAL_URL).replace(/\/+$/, "");
    const body = new URLSearchParams({
      client_id: DEFAULT_NOUS_CLIENT_ID,
      scope: DEFAULT_NOUS_SCOPE,
    });
    const resp = await fetch(`${portalBaseUrl}/api/oauth/device/code`, {
      method: "POST",
      headers: FORM_JSON_HEADERS,
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) {
      const detail = (await resp.text().catch(() => "")).slice(0, 300);
      throw new Error(`Nous Portal device-code request failed (HTTP ${resp.status})${detail ? `: ${detail}` : ""}`);
    }
    const data = (await resp.json()) as Record<string, any>;
    const deviceCode = String(data.device_code || "").trim();
    const userCode = String(data.user_code || "").trim();
    const verificationUrl = String(data.verification_uri_complete || data.verification_uri || "").trim();
    const expiresIn = Math.max(60, Number(data.expires_in) || 600);
    const pollInterval = Math.max(2, Number(data.interval) || 5);
    if (!deviceCode || !userCode || !verificationUrl) {
      throw new Error("Nous Portal device-code response missing required fields");
    }

    const session = registerSession(userId, provider, userCode, verificationUrl, expiresIn, pollInterval);
    void pollStandardDeviceToken(session, {
      tokenEndpoint: `${portalBaseUrl}/api/oauth/token`,
      clientId: DEFAULT_NOUS_CLIENT_ID,
      deviceCode,
      onSuccess: async (payload) => {
        const accessToken = String(payload.access_token || "").trim();
        const refreshToken = String(payload.refresh_token || "").trim();
        const saved = await saveUserOAuthSubscription(userId, "nous_oauth", {
          accessToken,
          refreshToken,
          expiresAt: extractJwtExpiryIso(accessToken, payload.expires_in),
          portalBaseUrl,
          inferenceBaseUrl: validateNousInferenceUrl(payload.inference_base_url),
          accountLabel: extractAccountLabel(accessToken),
        });
        session.accountLabel = saved.accountLabel;
        session.tokenPreview = saved.tokenPreview;
      },
    });
    return session;
  }

  if (provider === "openai_codex") {
    const resp = await fetch(`${CODEX_OAUTH_ISSUER}/api/accounts/deviceauth/usercode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "codex_cli_rs/0.0.0 (SynapseJourney)",
      },
      body: JSON.stringify({ client_id: CODEX_OAUTH_CLIENT_ID }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) {
      const detail = (await resp.text().catch(() => "")).slice(0, 300);
      throw new Error(
        `OpenAI Codex device-code request failed (HTTP ${resp.status}). Ensure device-code authorization is enabled in your OpenAI account settings.` +
          (detail ? ` (${detail})` : ""),
      );
    }
    const data = (await resp.json()) as Record<string, any>;
    const userCode = String(data.user_code || "").trim();
    const deviceAuthId = String(data.device_auth_id || "").trim();
    const pollInterval = Math.max(3, Number(data.interval) || 5);
    const expiresIn = 900;
    const verificationUrl = `${CODEX_OAUTH_ISSUER}/codex/device`;
    if (!userCode || !deviceAuthId) {
      throw new Error("OpenAI Codex device-code response missing user_code or device_auth_id");
    }

    const session = registerSession(userId, provider, userCode, verificationUrl, expiresIn, pollInterval);
    void pollCodexDeviceSession(session, deviceAuthId);
    return session;
  }

  if (provider === "minimax_oauth") {
    const { verifier, challenge, state } = generatePkcePair();
    const body = new URLSearchParams({
      response_type: "code",
      client_id: MINIMAX_OAUTH_CLIENT_ID,
      scope: MINIMAX_OAUTH_SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });
    const resp = await fetch(`${MINIMAX_OAUTH_PORTAL_URL}/oauth/code`, {
      method: "POST",
      headers: {
        ...FORM_JSON_HEADERS,
        "x-request-id": randomUUID(),
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) {
      const detail = (await resp.text().catch(() => "")).slice(0, 300);
      throw new Error(`MiniMax OAuth device-code request failed (HTTP ${resp.status})${detail ? `: ${detail}` : ""}`);
    }
    const data = (await resp.json()) as Record<string, any>;
    if (data.state && data.state !== state) {
      throw new Error("MiniMax OAuth state mismatch");
    }
    const userCode = String(data.user_code || "").trim();
    const verificationUrl = String(data.verification_uri || "").trim();
    const expiredInRaw = Number(data.expired_in) || 600;
    const expiresAtMs = expiredInRaw > Date.now() / 2 ? expiredInRaw : Date.now() + expiredInRaw * 1000;
    const expiresIn = Math.max(60, Math.round((expiresAtMs - Date.now()) / 1000));
    const pollInterval = Math.max(2, Math.round((Number(data.interval) || 2000) / 1000));
    if (!userCode || !verificationUrl) {
      throw new Error("MiniMax OAuth response missing user_code or verification_uri");
    }

    const session = registerSession(userId, provider, userCode, verificationUrl, expiresIn, pollInterval);
    void pollMiniMaxDeviceSession(session, verifier);
    return session;
  }

  throw new Error(`Unsupported OAuth device-code provider: ${provider}`);
}

function registerSession(
  userId: string,
  provider: OAuthSubscriptionProviderId,
  userCode: string,
  verificationUrl: string,
  expiresIn: number,
  pollInterval: number,
): OAuthLoginSession {
  const sessionId = randomBytes(16).toString("base64url");
  const now = Date.now();
  const session: OAuthLoginSession = {
    sessionId,
    userId,
    provider,
    flow: "device_code",
    userCode,
    verificationUrl,
    expiresIn,
    expiresAt: now + expiresIn * 1000,
    pollInterval,
    status: "pending",
    createdAt: now,
  };
  activeSessions.set(sessionId, session);
  return session;
}

async function pollStandardDeviceToken(
  session: OAuthLoginSession,
  opts: {
    tokenEndpoint: string;
    clientId: string;
    deviceCode: string;
    onSuccess: (payload: Record<string, any>) => Promise<void>;
  },
): Promise<void> {
  let intervalSec = session.pollInterval;
  try {
    while (Date.now() < session.expiresAt) {
      const cancelled = await sleepTick(intervalSec * 1000, () => Boolean(session.cancelled));
      if (cancelled || session.cancelled) {
        session.status = "cancelled";
        return;
      }

      const body = new URLSearchParams({
        grant_type: DEVICE_CODE_GRANT_TYPE,
        client_id: opts.clientId,
        device_code: opts.deviceCode,
      });

      let resp: Response;
      try {
        resp = await fetch(opts.tokenEndpoint, {
          method: "POST",
          headers: FORM_JSON_HEADERS,
          body: body.toString(),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        continue; // transient network blip
      }

      if (resp.status === 200) {
        const payload = (await resp.json()) as Record<string, any>;
        if (session.cancelled) {
          session.status = "cancelled";
          return;
        }
        await opts.onSuccess(payload);
        session.status = "approved";
        return;
      }

      let errPayload: Record<string, any> = {};
      try {
        errPayload = (await resp.json()) as Record<string, any>;
      } catch {
        if (resp.status === 408 || resp.status === 429 || resp.status >= 500) {
          intervalSec = Math.min(intervalSec + 2, 30);
          continue;
        }
        session.status = "error";
        session.errorMessage = `Token endpoint returned HTTP ${resp.status}`;
        return;
      }

      const errCode = String(errPayload.error || "");
      if (errCode === "authorization_pending") {
        continue;
      }
      if (errCode === "slow_down") {
        intervalSec = Math.min(intervalSec + 2, 30);
        continue;
      }
      if (errCode === "access_denied") {
        session.status = "denied";
        session.errorMessage = "Authorization was declined in the browser.";
        return;
      }
      if (errCode === "expired_token") {
        session.status = "expired";
        session.errorMessage = "Device code expired before approval.";
        return;
      }

      session.status = "error";
      session.errorMessage = String(errPayload.error_description || errPayload.error || `HTTP ${resp.status}`);
      return;
    }

    if (!session.cancelled && session.status === "pending") {
      session.status = "expired";
      session.errorMessage = "Device code expired before approval.";
    }
  } catch (err: any) {
    if (!session.cancelled) {
      session.status = "error";
      session.errorMessage = err?.message || String(err);
    }
  }
}

async function pollCodexDeviceSession(session: OAuthLoginSession, deviceAuthId: string): Promise<void> {
  try {
    while (Date.now() < session.expiresAt) {
      const cancelled = await sleepTick(session.pollInterval * 1000, () => Boolean(session.cancelled));
      if (cancelled || session.cancelled) {
        session.status = "cancelled";
        return;
      }

      let pollResp: Response;
      try {
        pollResp = await fetch(`${CODEX_OAUTH_ISSUER}/api/accounts/deviceauth/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "codex_cli_rs/0.0.0 (SynapseJourney)",
          },
          body: JSON.stringify({
            device_auth_id: deviceAuthId,
            user_code: session.userCode,
          }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        continue;
      }

      if (pollResp.status === 403 || pollResp.status === 404) {
        continue; // still waiting for user approval
      }

      if (pollResp.status !== 200) {
        session.status = "error";
        session.errorMessage = `OpenAI device-auth poll returned HTTP ${pollResp.status}`;
        return;
      }

      const codeData = (await pollResp.json()) as Record<string, any>;
      const authorizationCode = String(codeData.authorization_code || "").trim();
      const codeVerifier = String(codeData.code_verifier || "").trim();
      if (!authorizationCode || !codeVerifier) {
        session.status = "error";
        session.errorMessage = "OpenAI device-auth response missing authorization_code or code_verifier";
        return;
      }

      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code: authorizationCode,
        redirect_uri: `${CODEX_OAUTH_ISSUER}/deviceauth/callback`,
        client_id: CODEX_OAUTH_CLIENT_ID,
        code_verifier: codeVerifier,
      });

      const tokenResp = await fetch(CODEX_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: {
          ...FORM_JSON_HEADERS,
          "User-Agent": "codex_cli_rs/0.0.0 (SynapseJourney)",
        },
        body: tokenBody.toString(),
        signal: AbortSignal.timeout(15_000),
      });

      if (!tokenResp.ok) {
        const detail = (await tokenResp.text().catch(() => "")).slice(0, 300);
        session.status = "error";
        session.errorMessage = `OpenAI token exchange failed (HTTP ${tokenResp.status})${detail ? `: ${detail}` : ""}`;
        return;
      }

      const tokens = (await tokenResp.json()) as Record<string, any>;
      const accessToken = String(tokens.access_token || "").trim();
      const refreshToken = String(tokens.refresh_token || "").trim();
      if (!accessToken) {
        session.status = "error";
        session.errorMessage = "OpenAI token exchange did not return an access_token";
        return;
      }

      if (session.cancelled) {
        session.status = "cancelled";
        return;
      }

      const saved = await saveUserOAuthSubscription(session.userId, "openai_codex", {
        accessToken,
        refreshToken,
        expiresAt: extractJwtExpiryIso(accessToken, tokens.expires_in),
        inferenceBaseUrl: DEFAULT_CODEX_BASE_URL,
        accountLabel: extractAccountLabel(accessToken),
      });
      session.accountLabel = saved.accountLabel;
      session.tokenPreview = saved.tokenPreview;
      session.status = "approved";
      return;
    }

    if (!session.cancelled && session.status === "pending") {
      session.status = "expired";
      session.errorMessage = "Device code expired before approval.";
    }
  } catch (err: any) {
    if (!session.cancelled) {
      session.status = "error";
      session.errorMessage = err?.message || String(err);
    }
  }
}

async function pollMiniMaxDeviceSession(session: OAuthLoginSession, codeVerifier: string): Promise<void> {
  try {
    while (Date.now() < session.expiresAt) {
      const cancelled = await sleepTick(session.pollInterval * 1000, () => Boolean(session.cancelled));
      if (cancelled || session.cancelled) {
        session.status = "cancelled";
        return;
      }

      const body = new URLSearchParams({
        grant_type: MINIMAX_OAUTH_GRANT_TYPE,
        client_id: MINIMAX_OAUTH_CLIENT_ID,
        user_code: session.userCode,
        code_verifier: codeVerifier,
      });

      let resp: Response;
      try {
        resp = await fetch(`${MINIMAX_OAUTH_PORTAL_URL}/oauth/token`, {
          method: "POST",
          headers: FORM_JSON_HEADERS,
          body: body.toString(),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        continue;
      }

      if (!resp.ok) {
        const detail = (await resp.text().catch(() => "")).slice(0, 300);
        session.status = "error";
        session.errorMessage = `MiniMax OAuth error (HTTP ${resp.status})${detail ? `: ${detail}` : ""}`;
        return;
      }

      const payload = (await resp.json().catch(() => ({}))) as Record<string, any>;
      if (payload.status === "error") {
        session.status = "denied";
        session.errorMessage = "MiniMax OAuth authorization was declined or failed.";
        return;
      }
      if (payload.status === "success") {
        const accessToken = String(payload.access_token || "").trim();
        const refreshToken = String(payload.refresh_token || "").trim();
        if (!accessToken) {
          session.status = "error";
          session.errorMessage = "MiniMax OAuth response missing access_token";
          return;
        }
        if (session.cancelled) {
          session.status = "cancelled";
          return;
        }
        const saved = await saveUserOAuthSubscription(session.userId, "minimax_oauth", {
          accessToken,
          refreshToken,
          expiresAt: resolveMiniMaxExpiryIso(payload.expired_in),
          portalBaseUrl: MINIMAX_OAUTH_PORTAL_URL,
          inferenceBaseUrl: MINIMAX_OAUTH_INFERENCE_URL,
          accountLabel: "MiniMax OAuth",
        });
        session.accountLabel = saved.accountLabel;
        session.tokenPreview = saved.tokenPreview;
        session.status = "approved";
        return;
      }
      // "pending" -> keep polling
    }

    if (!session.cancelled && session.status === "pending") {
      session.status = "expired";
      session.errorMessage = "Device code expired before approval.";
    }
  } catch (err: any) {
    if (!session.cancelled) {
      session.status = "error";
      session.errorMessage = err?.message || String(err);
    }
  }
}

// ── OpenRouter PKCE Exchange ────────────────────────────────────────────────

const openRouterPkceVerifiers = new Map<string, { userId: string; verifier: string; createdAt: number }>();

export function createOpenRouterPkceSession(userId: string, callbackUrl: string): { authUrl: string; state: string } {
  const { verifier, challenge, state } = generatePkcePair();
  openRouterPkceVerifiers.set(state, { userId, verifier, createdAt: Date.now() });
  const url = new URL(OPENROUTER_AUTH_URL);
  const cbWithState = new URL(callbackUrl);
  cbWithState.searchParams.set("state", state);
  url.searchParams.set("callback_url", cbWithState.toString());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { authUrl: url.toString(), state };
}

export async function exchangeOpenRouterPkceCode(
  userId: string,
  code: string,
  state: string,
): Promise<string> {
  const record = openRouterPkceVerifiers.get(state);
  if (!record || record.userId !== userId) {
    throw new Error("OpenRouter PKCE session expired or state mismatch. Please start the sign-in again.");
  }
  openRouterPkceVerifiers.delete(state);

  const resp = await fetch(OPENROUTER_AUTH_KEYS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      code: code.trim(),
      code_verifier: record.verifier,
      code_challenge_method: "S256",
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok) {
    const detail = (await resp.text().catch(() => "")).slice(0, 300);
    throw new Error(`OpenRouter code exchange failed (HTTP ${resp.status})${detail ? `: ${detail}` : ""}`);
  }

  const data = (await resp.json()) as Record<string, any>;
  const key = String(data.key || "").trim();
  if (!key) {
    throw new Error("OpenRouter code exchange response did not include an API key");
  }

  const { storage } = await import("./storage");
  await storage.createOrUpdateUserProfile(userId, {
    openRouterKey: key,
    preferredAiProvider: "openrouter",
  });
  return key;
}
