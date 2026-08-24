/**
 * Inference source resolution: BYOK → prepaid → (never a free platform pool).
 *
 * This is the single choke point for user-paid generation. It keeps BYOK
 * exactly as before (user's key = $0 to the platform), and only when the user
 * has NO usable key does it fall back to their prepaid credit balance.
 *
 * Hard invariant: a request can never draw on operator funds. Prepaid
 * generation is pre-authorized (balance check against a conservative ceiling
 * estimate), run, and then atomically debited with a full audit-log row.
 */
import { generateByokOrPool, type ProviderConfig, type ChatOptions } from "./ai-providers";
import {
  generatePrepaid,
  computeSellCents,
  estimateMaxSellCents,
  estimateMaxCostCents,
  prepaidIsConfigured,
  PREPAID_DAILY_SPEND_LIMIT_CENTS,
  PREPAID_RATE_LIMIT_PER_MIN,
  PREPAID_GLOBAL_RATE_LIMIT_PER_MIN,
} from "./prepaid";
import { rateLimit } from "./rate-limit";

export interface GeneratedContent {
  content: string;
  source: "byok" | "prepaid";
  provider: string;
  model?: string;
  costCents?: number;    // operator cost (prepaid only)
  sellCents?: number;    // user charge (prepaid only)
  balanceCents?: number; // balance after debit (prepaid only)
}

export async function generateByokOrPrepaid(
  userId: string,
  messages: { role: string; content: string }[],
  config: ProviderConfig,
  options?: ChatOptions,
  sourceLabel?: string
): Promise<GeneratedContent> {
  // 1) BYOK first — identical behavior to before (no regression).
  try {
    const result = await generateByokOrPool(messages, config, options);
    return { content: result.content, source: "byok", provider: result.provider };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Only fall through to prepaid when the failure is "no usable key".
    // A real provider error (bad key, 400, etc.) is NOT a reason to silently
    // spend the user's prepaid balance.
    if (!msg.includes("BYOC_REQUIRED")) {
      throw err;
    }
  }

  // 2) Prepaid fallback — gated, pre-authorized, rate-limited, atomically debited.
  const { storage } = await import("./storage");

  if (!prepaidIsConfigured()) {
    throw new Error(
      "BYOC_REQUIRED: Add your own AI key in Settings, or use Hermes Agent to author and upload. " +
        "Prepaid credits are not enabled on this server yet."
    );
  }

  // Rate limit a single user's paid generation loop (bounds a tight loop).
  const userRl = rateLimit(`prepaid:${userId}`, PREPAID_RATE_LIMIT_PER_MIN, 60_000);
  if (!userRl.allowed) {
    throw new Error(
      `RATE_LIMITED: too many paid generations in a row. Try again in ~${userRl.retryAfterSec}s.`
    );
  }
  // Global ceiling protects the shared OpenRouter key from aggregate flooding.
  const globalRl = rateLimit(`prepaid:global`, PREPAID_GLOBAL_RATE_LIMIT_PER_MIN, 60_000);
  if (!globalRl.allowed) {
    throw new Error("RATE_LIMITED: prepaid inference is temporarily busy. Try again shortly.");
  }

  // Operator-side daily spend ceiling (independent of user balances). Backstop
  // so even a coordinated drainer can't push operator cost past a fixed cap.
  // Estimate-aware: blocks a generation whose projected cost would breach it.
  if (PREPAID_DAILY_SPEND_LIMIT_CENTS > 0) {
    const spentToday = await storage.getPrepaidDailyOperatorCost();
    const projected = spentToday + estimateMaxCostCents(messages, options);
    if (projected >= PREPAID_DAILY_SPEND_LIMIT_CENTS) {
      throw new Error(
        "PREPAID_CAPACITY: prepaid inference has reached its daily capacity. " +
          "Add your own AI key, or try again tomorrow."
      );
    }
  }

  const estimateSell = estimateMaxSellCents(messages, options);
  const balance = await storage.getUserCreditBalance(userId);

  if (balance < estimateSell) {
    const need = (estimateSell / 100).toFixed(2);
    const have = (balance / 100).toFixed(2);
    throw new Error(
      `INSUFFICIENT_CREDITS: this generation needs up to $${need} in prepaid credits, ` +
        `but your balance is $${have}. Buy credits in Settings to continue.`
    );
  }

  let gen;
  try {
    gen = await generatePrepaid(messages, options);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Generation failed before a debit was recorded — user is not charged.
    throw new Error(`Prepaid generation failed (no credits charged): ${msg}`);
  }

  const sellCents = computeSellCents(gen.costCents);
  let debit;
  try {
    debit = await storage.debitForInference(userId, {
      amountCents: sellCents,
      costCents: gen.costCents,
      model: gen.model,
      promptTokens: gen.promptTokens,
      completionTokens: gen.completionTokens,
      totalTokens: gen.totalTokens,
      source: sourceLabel || "generation",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Debit failed (e.g. concurrent spend drained the balance) — do NOT return
    // the generated content; the user would get free-paid content on a race.
    throw new Error(`Prepaid debit failed: ${msg}`);
  }

  return {
    content: gen.content,
    source: "prepaid",
    provider: gen.model,
    model: gen.model,
    costCents: gen.costCents,
    sellCents,
    balanceCents: debit.balanceCents,
  };
}