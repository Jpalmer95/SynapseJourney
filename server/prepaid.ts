/**
 * Prepaid inference lane — the optional paid fallback for users who have no
 * BYOK key and no local Ollama. BYOK stays the default; this is a convenience.
 *
 * Hard invariant: the platform NEVER fronts someone else's compute.
 * Guaranteed by construction — the lane is prepaid credits, not metered billing:
 *   1. The user buys a prepaid balance (Stripe).
 *   2. Each generation debits that balance at a fixed sell price.
 *   3. The sell price = pinned-model cost-per-token × margin, rounded UP to a
 *      safe floor — so the operator can never lose money on a single request.
 *   4. Balance = 0 → generation stops. There is no code path that draws on
 *      operator funds; the only account that can be overdrawn is the user's own.
 *
 * The key cost-safety lever is the SINGLE PINNED MODEL: users cannot pick an
 * arbitrary model (that is the surprise-cost vector). One premium fallback is
 * allowed later.
 */
import type { ChatOptions } from "./ai-providers";

// ── Config (env-overridable; do NOT hardcode secrets) ───────────────────────
export const PREPAID_MODEL = process.env.PREPAID_MODEL || "deepseek/deepseek-chat";

// Margin constant — defined in ONE place (here). Sell price = cost × margin.
export const PREPAID_MARGIN = (() => {
  const raw = parseFloat(process.env.PREPAID_MARGIN || "1.3");
  return Number.isFinite(raw) && raw >= 1.0 ? raw : 1.3;
})();

// Minimum sell price per generation, in cents (floor so tiny requests can't
// round down to ~0 and hide real cost).
export const PREPAID_MIN_SELL_CENTS = (() => {
  const raw = parseInt(process.env.PREPAID_MIN_SELL_CENTS || "5", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
})();

// ── Hardening limits ─────────────────────────────────────────────────────────
// Hard ceiling on a single balance (defense-in-depth against a config bug or a
// mis-processed credit creating an absurd balance). Legit flows credit $5–$20
// at a time, so a $200 ceiling is generous.
export const PREPAID_MAX_BALANCE_CENTS = (() => {
  const raw = parseInt(process.env.PREPAID_MAX_BALANCE_CENTS || "20000", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 20000;
})();

// Operator-side daily spend ceiling (in cents of OPERATOR cost, independent of
// user balances). Once the prepaid lane has spent this much today serving
// generations, further paid generations are refused until tomorrow. This is the
// server-side backstop for the master-plan item "operator spend ceiling".
export const PREPAID_DAILY_SPEND_LIMIT_CENTS = (() => {
  const raw = parseInt(process.env.PREPAID_DAILY_SPEND_LIMIT_CENTS || "5000", 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 5000;
})();

// Per-user generation rate limit (requests / minute) — bounds a tight loop.
export const PREPAID_RATE_LIMIT_PER_MIN = (() => {
  const raw = parseInt(process.env.PREPAID_RATE_LIMIT_PER_MIN || "10", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
})();

// Global generation rate limit (requests / minute) across ALL users — protects
// the shared OpenRouter key from aggregate flooding.
export const PREPAID_GLOBAL_RATE_LIMIT_PER_MIN = (() => {
  const raw = parseInt(process.env.PREPAID_GLOBAL_RATE_LIMIT_PER_MIN || "100", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 100;
})();

// Hard clamp on output tokens per paid request, regardless of what any caller
// passes (prevents a buggy caller from requesting a 64k-token completion).
export const PREPAID_MAX_TOKENS = (() => {
  const raw = parseInt(process.env.PREPAID_MAX_TOKENS || "8192", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 8192;
})();

// Operator cost-per-token (USD per 1M tokens) for the pinned model.
// DEFAULTS ARE INTENTIONALLY CONSERVATIVE (upper-bound). Tune DOWN after you
// verify current OpenRouter pricing — never tune below the published price,
// or the margin guarantee breaks.
const PREPAID_INPUT_USD_PER_1M = (() => {
  const raw = parseFloat(process.env.PREPAID_INPUT_USD_PER_1M || "0.5");
  return Number.isFinite(raw) && raw > 0 ? raw : 0.5;
})();
const PREPAID_OUTPUT_USD_PER_1M = (() => {
  const raw = parseFloat(process.env.PREPAID_OUTPUT_USD_PER_1M || "2.0");
  return Number.isFinite(raw) && raw > 0 ? raw : 2.0;
})();

export function prepaidIsConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/**
 * Operator cost (in cents) for a usage tuple, using the pinned per-token
 * prices, rounded UP to the nearest cent.
 */
export function costCentsForUsage(promptTokens: number, completionTokens: number): number {
  const usd =
    (promptTokens * PREPAID_INPUT_USD_PER_1M + completionTokens * PREPAID_OUTPUT_USD_PER_1M) / 1_000_000;
  return Math.ceil(usd * 100);
}

/**
 * Sell price (in cents) the user is charged: cost × margin, rounded up, then
 * floored at PREPAID_MIN_SELL_CENTS.
 */
export function computeSellCents(costCents: number): number {
  return Math.max(PREPAID_MIN_SELL_CENTS, Math.ceil(costCents * PREPAID_MARGIN));
}

/**
 * Conservative upper-bound COST estimate (in cents, operator cost) for a
 * request — the pre-margin cost of the worst case. Over-estimates on purpose.
 */
export function estimateMaxCostCents(
  messages: { role: string; content: string }[],
  options?: ChatOptions
): number {
  const promptChars = messages.reduce((n, m) => n + (m.content?.length || 0), 0);
  // ~3 chars/token is a conservative upper bound (English averages ~4).
  const promptTokens = Math.ceil(promptChars / 3);
  const outputTokens = Math.min(options?.maxTokens || 4096, PREPAID_MAX_TOKENS);
  return costCentsForUsage(promptTokens, outputTokens);
}

/**
 * Conservative upper-bound SELL estimate (in cents) for a request, used to
 * pre-authorize BEFORE generation so a near-empty balance can't trigger a
 * paid call the user can't cover. Over-estimates on purpose.
 */
export function estimateMaxSellCents(
  messages: { role: string; content: string }[],
  options?: ChatOptions
): number {
  return computeSellCents(estimateMaxCostCents(messages, options));
}

export interface PrepaidGenerationResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCents: number;
}

/**
 * Run one generation on the pinned model through the platform's OpenRouter
 * key (operator-funded), and report exact usage so the caller can debit the
 * user's balance. This is the ONLY code path that spends operator funds, and
 * it is gated by a pre-authorization balance check in the orchestrator.
 */
export async function generatePrepaid(
  messages: { role: string; content: string }[],
  options?: ChatOptions
): Promise<PrepaidGenerationResult> {
  if (!prepaidIsConfigured()) {
    throw new Error("PREPAID_UNAVAILABLE: prepaid inference is not configured on this server.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.REPLIT_DEPLOYMENT_URL || "https://synapsejourney.org",
      "X-Title": "Synapse Journey — Prepaid Inference",
    },
    body: JSON.stringify({
      model: PREPAID_MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      // Always pass an explicit cap — OpenRouter defaults to 65536 otherwise
      // (the 402 gotcha), which would blow past any sane per-request spend.
      // Also hard-clamped to PREPAID_MAX_TOKENS as defense-in-depth.
      max_tokens: Math.min(options?.maxTokens ?? 4096, PREPAID_MAX_TOKENS),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Prepaid OpenRouter error: ${response.status} - ${error.slice(0, 400)}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content || "";
  const usage = data.usage || {};
  const promptTokens = Number(usage.prompt_tokens) || 0;
  const completionTokens = Number(usage.completion_tokens) || 0;
  const totalTokens = Number(usage.total_tokens) || promptTokens + completionTokens;

  return {
    content,
    model: PREPAID_MODEL,
    promptTokens,
    completionTokens,
    totalTokens,
    costCents: costCentsForUsage(promptTokens, completionTokens),
  };
}