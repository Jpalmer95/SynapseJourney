/**
 * Zero-Loss Prepaid Credits & OpenRouter Mode-Router Engine
 *
 * Guarantees for a solo builder:
 * 1. Reading & BYOC/BYOS remain 100% free forever — credits are strictly optional.
 * 2. Integer micro-dollar accounting (1_000_000 micros = $1.00 USD) with PostgreSQL
 *    `CHECK (balance_micros >= 0)` so balances can NEVER go negative.
 * 3. Atomic Reserve -> Upstream OpenRouter Call -> Settle Actual Cost -> Refund Unused.
 *    If OpenRouter fails or times out, 100% of the reservation is refunded automatically.
 * 4. Built-in safety markup (default 2.2x raw OpenRouter cost) covers Stripe 2.9% + $0.30
 *    processing fees + infrastructure + safe margin, with hard per-mode max_tokens caps
 *    and sliding-window per-user rate limits.
 * 5. Idempotent Stripe webhook signature verification (HMAC-SHA256 via crypto.timingSafeEqual,
 *    <= 300s timestamp tolerance, UNIQUE stripe_event_id deduplication).
 */

import { createHmac, timingSafeEqual } from "crypto";
import { sql } from "drizzle-orm";
import type { AIProvider, ChatOptions } from "./ai-providers";

async function getDb() {
  const { db } = await import("./db");
  return db;
}

export const MICROS_PER_USD = 1_000_000;

export type CreditInferenceMode =
  | "technical_course"
  | "general_course"
  | "tutor_direct"
  | "tutor_socratic"
  | "tutor_feynman"
  | "code_translate"
  | "quiz_distill";

export type CreditTierPreference = "economy" | "balanced" | "frontier";

export interface CreditPack {
  id: "starter_5" | "scholar_15" | "research_40";
  name: string;
  priceCents: number;
  creditMicros: number;
  badge?: string;
  tagline: string;
  estimates: string[];
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    id: "starter_5",
    name: "Starter Pack",
    priceCents: 500,
    creditMicros: 5 * MICROS_PER_USD,
    tagline: "Zero-setup prepaid credits · Never expires",
    estimates: [
      "~20–60 full custom STEM courses",
      "~800–2,500 Socratic / Feynman tutor turns",
      "~500+ MATLAB / Mathematica translations",
    ],
  },
  {
    id: "scholar_15",
    name: "Scholar Pack",
    priceCents: 1500,
    creditMicros: 15 * MICROS_PER_USD,
    badge: "Most Popular",
    tagline: "Built for deep multi-course study & research · Never expires",
    estimates: [
      "~60–180 full custom STEM courses",
      "~2,500–7,500 Socratic / Feynman tutor turns",
      "~1,500+ MATLAB / Mathematica translations",
    ],
  },
  {
    id: "research_40",
    name: "Research Pack",
    priceCents: 4000,
    creditMicros: 40 * MICROS_PER_USD,
    tagline: "Heavy frontier curriculum & Frontier-tier tutoring · Never expires",
    estimates: [
      "~160–500 full custom courses",
      "~6,500+ Frontier-tier tutor turns",
      "Ideal for faculty, labs & power learners",
    ],
  },
] as const;

export function getCreditPackById(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

export interface ModeModelSpec {
  mode: CreditInferenceMode;
  label: string;
  primaryModel: string;
  fallbackModel: string;
  maxTokensCap: number;
  /** Conservative worst-case raw USD per 1M input tokens (used for pre-call reserve & fallback pricing) */
  estInputUsdPer1M: number;
  /** Conservative worst-case raw USD per 1M output tokens */
  estOutputUsdPer1M: number;
  description: string;
}

export function getCreditsMarkupMultiplier(): number {
  const raw = Number(process.env.CREDITS_MARKUP_MULTIPLIER || "2.2");
  if (!Number.isFinite(raw) || raw < 1.35) return 2.2; // hard floor: never below 1.35x so Stripe + variance never cause loss
  return Math.min(raw, 5.0);
}

/**
 * Resolve the preselected OpenRouter model + token caps for each platform mode.
 * All slugs are env-overridable without redeploying!
 */
export function resolveModeModelSpec(
  mode: CreditInferenceMode,
  tier: CreditTierPreference = "balanced",
): ModeModelSpec {
  const techPrimary = process.env.OPENROUTER_MODEL_TECHNICAL_COURSE || "google/gemini-4-neon";
  const techFallback = process.env.OPENROUTER_MODEL_TECHNICAL_FALLBACK || "google/gemini-2.5-pro";
  const generalPrimary = process.env.OPENROUTER_MODEL_GENERAL_COURSE || "google/gemini-2.5-flash";
  const generalFallback = process.env.OPENROUTER_MODEL_GENERAL_FALLBACK || "deepseek/deepseek-chat-v3-0324";
  const tutorEconomy = process.env.OPENROUTER_MODEL_TUTOR_ECONOMY || "google/gemini-2.5-flash-lite";
  const tutorBalanced = process.env.OPENROUTER_MODEL_TUTOR || "google/gemini-2.5-flash";
  const tutorFrontier = process.env.OPENROUTER_MODEL_TUTOR_FRONTIER || "anthropic/claude-sonnet-4";
  const codePrimary = process.env.OPENROUTER_MODEL_CODE_TRANSLATE || "google/gemini-2.5-flash";
  const codeFallback = process.env.OPENROUTER_MODEL_CODE_FALLBACK || "anthropic/claude-sonnet-4";
  const quizPrimary = process.env.OPENROUTER_MODEL_QUIZ_DISTILL || "google/gemini-2.5-flash-lite";

  switch (mode) {
    case "technical_course":
      return {
        mode,
        label: "Technical / STEM Course Authoring",
        primaryModel: techPrimary,
        fallbackModel: techFallback,
        maxTokensCap: 8192,
        estInputUsdPer1M: 2.5,
        estOutputUsdPer1M: 12.0,
        description: "Frontier math, physics, LaTeX derivations, and scientific code accuracy (Gemini Neon default).",
      };
    case "general_course":
      return {
        mode,
        label: "General & Survey Course Authoring",
        primaryModel: tier === "frontier" ? techPrimary : generalPrimary,
        fallbackModel: generalFallback,
        maxTokensCap: 6144,
        estInputUsdPer1M: 0.5,
        estOutputUsdPer1M: 2.5,
        description: "Fast, structured curriculum synthesis with verified open resources.",
      };
    case "code_translate":
      return {
        mode,
        label: "Scientific Code Translation (Python ↔ MATLAB / Mathematica)",
        primaryModel: tier === "frontier" ? tutorFrontier : codePrimary,
        fallbackModel: codeFallback,
        maxTokensCap: 3200,
        estInputUsdPer1M: tier === "frontier" ? 3.0 : 0.5,
        estOutputUsdPer1M: tier === "frontier" ? 15.0 : 2.5,
        description: "Idiomatic scientific code conversion preserving units, boundary conditions, and plotting.",
      };
    case "quiz_distill":
      return {
        mode,
        label: "Quizzes & 3D Map Distillation",
        primaryModel: quizPrimary,
        fallbackModel: generalPrimary,
        maxTokensCap: 1600,
        estInputUsdPer1M: 0.25,
        estOutputUsdPer1M: 1.0,
        description: "Ultra-low-cost active recall generation and knowledge ledger extraction.",
      };
    case "tutor_socratic":
    case "tutor_feynman":
    case "tutor_direct":
    default: {
      const model =
        tier === "economy" ? tutorEconomy : tier === "frontier" ? tutorFrontier : tutorBalanced;
      const inRate = tier === "economy" ? 0.25 : tier === "frontier" ? 3.5 : 0.6;
      const outRate = tier === "economy" ? 1.0 : tier === "frontier" ? 15.0 : 2.8;
      return {
        mode,
        label:
          mode === "tutor_socratic"
            ? "Socratic Guided Tutoring"
            : mode === "tutor_feynman"
            ? "Feynman Teach-Back Student"
            : "Direct Q&A Tutor",
        primaryModel: model,
        fallbackModel: tutorBalanced,
        maxTokensCap: 1400,
        estInputUsdPer1M: inRate,
        estOutputUsdPer1M: outRate,
        description: "Low-latency interactive tutoring with Socratic questioning or Feynman gap detection.",
      };
    }
  }
}

export function getPublicModeRoutingTable(tier: CreditTierPreference = "balanced") {
  const modes: CreditInferenceMode[] = [
    "technical_course",
    "general_course",
    "tutor_socratic",
    "tutor_feynman",
    "code_translate",
    "quiz_distill",
  ];
  const markup = getCreditsMarkupMultiplier();
  return modes.map((m) => {
    const spec = resolveModeModelSpec(m, tier);
    return {
      mode: spec.mode,
      label: spec.label,
      model: spec.primaryModel,
      fallbackModel: spec.fallbackModel,
      maxTokensCap: spec.maxTokensCap,
      description: spec.description,
      estTypicalCallUsd: Number(
        (
          ((1200 / 1_000_000) * spec.estInputUsdPer1M +
            (Math.min(1000, spec.maxTokensCap * 0.4) / 1_000_000) * spec.estOutputUsdPer1M) *
          markup
        ).toFixed(4),
      ),
    };
  });
}

export function isCreditsInferenceConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_CREDITS_API_KEY?.trim());
}

export function isStripeCheckoutConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_WEBHOOK_SECRET?.trim() &&
      isCreditsInferenceConfigured(),
  );
}

// ── Sliding-window per-user rate limiter (abuse / infinite-loop circuit breaker) ──
const userCallTimestamps = new Map<string, number[]>();
const MAX_CALLS_PER_MINUTE = 25;
const MAX_CALLS_PER_HOUR = 150;

export function checkAndRecordCreditRateLimit(userId: string, nowMs = Date.now()): { ok: boolean; retryAfterSec?: number } {
  const existing = userCallTimestamps.get(userId) || [];
  const oneHourAgo = nowMs - 3_600_000;
  const recent = existing.filter((t) => t > oneHourAgo);

  const oneMinAgo = nowMs - 60_000;
  const lastMin = recent.filter((t) => t > oneMinAgo);

  if (lastMin.length >= MAX_CALLS_PER_MINUTE) {
    const oldestInMin = lastMin[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldestInMin + 60_000 - nowMs) / 1000));
    userCallTimestamps.set(userId, recent);
    return { ok: false, retryAfterSec };
  }
  if (recent.length >= MAX_CALLS_PER_HOUR) {
    const oldestInHr = recent[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldestInHr + 3_600_000 - nowMs) / 1000));
    userCallTimestamps.set(userId, recent);
    return { ok: false, retryAfterSec };
  }

  recent.push(nowMs);
  userCallTimestamps.set(userId, recent);
  return { ok: true };
}

// ── Cost Math Helpers (pure, unit-tested) ──────────────────────────────────

export function estimatePromptTokens(messages: { role: string; content: string }[]): number {
  const chars = messages.reduce((sum, m) => sum + (m.content?.length || 0) + 16, 0);
  return Math.max(32, Math.ceil(chars / 3.4)); // slightly conservative vs 4 chars/token
}

export function computeReservationMicros(
  promptTokens: number,
  maxOutputTokens: number,
  spec: ModeModelSpec,
  markup = getCreditsMarkupMultiplier(),
): number {
  const rawInputUsd = (promptTokens / 1_000_000) * spec.estInputUsdPer1M;
  const rawOutputUsd = (maxOutputTokens / 1_000_000) * spec.estOutputUsdPer1M;
  const rawMicros = Math.ceil((rawInputUsd + rawOutputUsd) * MICROS_PER_USD);
  // Minimum reserve of $0.001 (1,000 micros) to cover rounding & tiny calls
  return Math.max(1_000, Math.ceil(rawMicros * markup));
}

export function computeRetailChargeMicros(params: {
  upstreamCostUsd?: number | null;
  promptTokens: number;
  completionTokens: number;
  spec: ModeModelSpec;
  markup?: number;
}): { rawCostMicros: number; retailCostMicros: number } {
  const markup = params.markup ?? getCreditsMarkupMultiplier();
  let rawCostMicros: number;
  if (typeof params.upstreamCostUsd === "number" && Number.isFinite(params.upstreamCostUsd) && params.upstreamCostUsd > 0) {
    rawCostMicros = Math.ceil(params.upstreamCostUsd * MICROS_PER_USD);
  } else {
    const rawUsd =
      (params.promptTokens / 1_000_000) * params.spec.estInputUsdPer1M +
      (params.completionTokens / 1_000_000) * params.spec.estOutputUsdPer1M;
    rawCostMicros = Math.max(50, Math.ceil(rawUsd * MICROS_PER_USD));
  }
  const retailCostMicros = Math.max(100, Math.ceil(rawCostMicros * markup)); // min $0.0001 per completed call
  return { rawCostMicros, retailCostMicros };
}

// ── Balance Queries & Atomic Ledger Operations ─────────────────────────────

export interface UserCreditSummary {
  balanceMicros: number;
  balanceUsd: number;
  reservedMicros: number;
  lifetimePurchasedMicros: number;
  lifetimeSpentMicros: number;
  creditTierPreference: CreditTierPreference;
}

export async function getUserCreditSummary(userId: string): Promise<UserCreditSummary> {
  const db = await getDb();
  const res: any = await db.execute(sql`
    SELECT balance_micros, reserved_micros, lifetime_purchased_micros, lifetime_spent_micros, credit_tier_preference
    FROM user_credit_balances
    WHERE user_id = ${userId}
  `);
  const row = (res.rows ?? res)[0];
  if (!row) {
    return {
      balanceMicros: 0,
      balanceUsd: 0,
      reservedMicros: 0,
      lifetimePurchasedMicros: 0,
      lifetimeSpentMicros: 0,
      creditTierPreference: "balanced",
    };
  }
  const balanceMicros = Number(row.balance_micros || 0);
  const tierRaw = String(row.credit_tier_preference || "balanced");
  const creditTierPreference: CreditTierPreference =
    tierRaw === "economy" || tierRaw === "frontier" ? tierRaw : "balanced";
  return {
    balanceMicros,
    balanceUsd: Number((balanceMicros / MICROS_PER_USD).toFixed(4)),
    reservedMicros: Number(row.reserved_micros || 0),
    lifetimePurchasedMicros: Number(row.lifetime_purchased_micros || 0),
    lifetimeSpentMicros: Number(row.lifetime_spent_micros || 0),
    creditTierPreference,
  };
}

export async function setUserCreditTierPreference(
  userId: string,
  tier: CreditTierPreference,
): Promise<UserCreditSummary> {
  const db = await getDb();
  await db.execute(sql`
    INSERT INTO user_credit_balances (user_id, balance_micros, reserved_micros, lifetime_purchased_micros, lifetime_spent_micros, credit_tier_preference, updated_at)
    VALUES (${userId}, 0, 0, 0, 0, ${tier}, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE
      SET credit_tier_preference = ${tier},
          updated_at = CURRENT_TIMESTAMP
  `);
  return getUserCreditSummary(userId);
}

export async function getUserCreditTransactions(userId: string, limit = 30) {
  const db = await getDb();
  const clamped = Math.max(1, Math.min(100, limit));
  const res: any = await db.execute(sql`
    SELECT id, kind, amount_micros, balance_after_micros, mode, model_used,
           prompt_tokens, completion_tokens, raw_cost_micros, markup_multiplier,
           description, created_at
    FROM credit_transactions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC
    LIMIT ${clamped}
  `);
  const rows = res.rows ?? res ?? [];
  return rows.map((r: any) => ({
    id: Number(r.id),
    kind: String(r.kind),
    amountMicros: Number(r.amount_micros),
    amountUsd: Number((Number(r.amount_micros) / MICROS_PER_USD).toFixed(5)),
    balanceAfterMicros: Number(r.balance_after_micros),
    balanceAfterUsd: Number((Number(r.balance_after_micros) / MICROS_PER_USD).toFixed(4)),
    mode: r.mode || null,
    modelUsed: r.model_used || null,
    promptTokens: r.prompt_tokens != null ? Number(r.prompt_tokens) : null,
    completionTokens: r.completion_tokens != null ? Number(r.completion_tokens) : null,
    description: r.description || null,
    createdAt: r.created_at,
  }));
}

export async function hasUsableCreditBalance(userId?: string | null, minMicros = 1_500): Promise<boolean> {
  if (!userId || !isCreditsInferenceConfigured()) return false;
  try {
    const summary = await getUserCreditSummary(userId);
    return summary.balanceMicros >= minMicros;
  } catch {
    return false;
  }
}

/**
 * Atomically grant credits (from a verified Stripe webhook or admin grant).
 * Strictly idempotent when stripeEventId / stripeSessionId is provided.
 */
export async function grantUserCredits(params: {
  userId: string;
  amountMicros: number;
  kind: "purchase" | "admin_grant" | "refund";
  stripeEventId?: string | null;
  stripeSessionId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<{ applied: boolean; balanceMicros: number }> {
  if (!Number.isInteger(params.amountMicros) || params.amountMicros <= 0) {
    throw new Error("Credit grant amountMicros must be a positive integer");
  }

  const db = await getDb();
  return db.transaction(async (tx) => {
    // Check idempotency inside transaction
    if (params.stripeEventId) {
      const dup: any = await tx.execute(sql`
        SELECT id FROM credit_transactions WHERE stripe_event_id = ${params.stripeEventId} LIMIT 1
      `);
      if ((dup.rows ?? dup).length > 0) {
        const cur: any = await tx.execute(sql`
          SELECT balance_micros FROM user_credit_balances WHERE user_id = ${params.userId}
        `);
        return { applied: false, balanceMicros: Number((cur.rows ?? cur)[0]?.balance_micros || 0) };
      }
    }
    if (params.stripeSessionId) {
      const dup: any = await tx.execute(sql`
        SELECT id FROM credit_transactions WHERE stripe_session_id = ${params.stripeSessionId} LIMIT 1
      `);
      if ((dup.rows ?? dup).length > 0) {
        const cur: any = await tx.execute(sql`
          SELECT balance_micros FROM user_credit_balances WHERE user_id = ${params.userId}
        `);
        return { applied: false, balanceMicros: Number((cur.rows ?? cur)[0]?.balance_micros || 0) };
      }
    }

    const purchasedDelta = params.kind === "purchase" ? params.amountMicros : 0;
    const upserted: any = await tx.execute(sql`
      INSERT INTO user_credit_balances (user_id, balance_micros, reserved_micros, lifetime_purchased_micros, lifetime_spent_micros, updated_at)
      VALUES (${params.userId}, ${params.amountMicros}, 0, ${purchasedDelta}, 0, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE
        SET balance_micros = user_credit_balances.balance_micros + ${params.amountMicros},
            lifetime_purchased_micros = user_credit_balances.lifetime_purchased_micros + ${purchasedDelta},
            updated_at = CURRENT_TIMESTAMP
      RETURNING balance_micros
    `);
    const newBalance = Number((upserted.rows ?? upserted)[0]?.balance_micros || 0);

    await tx.execute(sql`
      INSERT INTO credit_transactions (
        user_id, kind, amount_micros, balance_after_micros, mode,
        stripe_event_id, stripe_session_id, description, metadata
      ) VALUES (
        ${params.userId},
        ${params.kind},
        ${params.amountMicros},
        ${newBalance},
        ${params.kind === "purchase" ? "stripe_pack" : "admin"},
        ${params.stripeEventId || null},
        ${params.stripeSessionId || null},
        ${params.description},
        ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb
      )
    `);

    return { applied: true, balanceMicros: newBalance };
  });
}

// ── Atomic Reserve / Settle / Release Helpers ──────────────────────────────

async function reserveCreditsAtomic(userId: string, reserveMicros: number): Promise<boolean> {
  const db = await getDb();
  const res: any = await db.execute(sql`
    UPDATE user_credit_balances
    SET balance_micros = balance_micros - ${reserveMicros},
        reserved_micros = reserved_micros + ${reserveMicros},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
      AND balance_micros >= ${reserveMicros}
    RETURNING balance_micros
  `);
  return (res.rows ?? res).length > 0;
}

async function releaseReservationAtomic(userId: string, reserveMicros: number): Promise<void> {
  const db = await getDb();
  await db.execute(sql`
    UPDATE user_credit_balances
    SET balance_micros = balance_micros + ${reserveMicros},
        reserved_micros = GREATEST(0, reserved_micros - ${reserveMicros}),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
  `);
}

async function settleReservationAtomic(params: {
  userId: string;
  reserveMicros: number;
  actualRetailMicros: number;
  rawCostMicros: number;
  markup: number;
  mode: CreditInferenceMode;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  description: string;
}): Promise<{ chargedMicros: number; balanceAfterMicros: number }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const curRes: any = await tx.execute(sql`
      SELECT balance_micros, reserved_micros FROM user_credit_balances WHERE user_id = ${params.userId} FOR UPDATE
    `);
    const row = (curRes.rows ?? curRes)[0];
    const currentAvail = Number(row?.balance_micros || 0);

    // If actual cost <= reserved, refund the unused difference; if actual cost > reserved,
    // take any extra only up to available balance (never negative).
    let chargedMicros = params.actualRetailMicros;
    let balanceDelta = params.reserveMicros - params.actualRetailMicros;
    if (balanceDelta < 0) {
      const extraNeeded = -balanceDelta;
      const extraTaken = Math.min(extraNeeded, currentAvail);
      chargedMicros = params.reserveMicros + extraTaken;
      balanceDelta = -extraTaken;
    }

    const updated: any = await tx.execute(sql`
      UPDATE user_credit_balances
      SET balance_micros = balance_micros + ${balanceDelta},
          reserved_micros = GREATEST(0, reserved_micros - ${params.reserveMicros}),
          lifetime_spent_micros = lifetime_spent_micros + ${chargedMicros},
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${params.userId}
      RETURNING balance_micros
    `);
    const balanceAfterMicros = Number((updated.rows ?? updated)[0]?.balance_micros || 0);

    await tx.execute(sql`
      INSERT INTO credit_transactions (
        user_id, kind, amount_micros, balance_after_micros, mode, model_used,
        prompt_tokens, completion_tokens, raw_cost_micros, markup_multiplier, description
      ) VALUES (
        ${params.userId},
        'usage',
        ${-chargedMicros},
        ${balanceAfterMicros},
        ${params.mode},
        ${params.modelUsed},
        ${params.promptTokens},
        ${params.completionTokens},
        ${params.rawCostMicros},
        ${params.markup},
        ${params.description}
      )
    `);

    return { chargedMicros, balanceAfterMicros };
  });
}

// ── OpenRouter Credit-Backed AIProvider ────────────────────────────────────

export interface CreditInferenceResult {
  content: string;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  chargedMicros: number;
  balanceAfterMicros: number;
}

async function callOpenRouterPlatform(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  options: { temperature?: number; maxTokens: number; responseFormat?: "text" | "json" },
): Promise<{ content: string; modelUsed: string; promptTokens: number; completionTokens: number; upstreamCostUsd: number | null }> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
    usage: { include: true },
  };
  if (options.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://synapsejourney.org",
      "X-Title": "SynapseJourney Prepaid Credits",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) {
    const errText = (await resp.text().catch(() => "")).slice(0, 400);
    const err: any = new Error(`OpenRouter error (${resp.status}): ${errText}`);
    err.status = resp.status;
    throw err;
  }

  const data: any = await resp.json();
  const content = String(data?.choices?.[0]?.message?.content || "");
  const usage = data?.usage || {};
  const promptTokens = Number(usage.prompt_tokens || estimatePromptTokens(messages));
  const completionTokens = Number(usage.completion_tokens || Math.ceil(content.length / 4));
  const upstreamCostUsd =
    typeof usage.cost === "number" && Number.isFinite(usage.cost) ? usage.cost : null;
  const modelUsed = String(data?.model || model);

  return { content, modelUsed, promptTokens, completionTokens, upstreamCostUsd };
}

export async function executeCreditBackedChat(params: {
  userId: string;
  mode: CreditInferenceMode;
  messages: { role: string; content: string }[];
  options?: ChatOptions;
  description?: string;
}): Promise<CreditInferenceResult> {
  const apiKey = process.env.OPENROUTER_CREDITS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("CREDITS_NOT_CONFIGURED: Platform prepaid credit inference is not enabled yet.");
  }

  const rl = checkAndRecordCreditRateLimit(params.userId);
  if (!rl.ok) {
    throw new Error(`CREDITS_RATE_LIMITED: Too many requests. Please retry in ${rl.retryAfterSec}s.`);
  }

  const summary = await getUserCreditSummary(params.userId);
  const spec = resolveModeModelSpec(params.mode, summary.creditTierPreference);
  const markup = getCreditsMarkupMultiplier();
  const cappedMaxTokens = Math.min(params.options?.maxTokens || spec.maxTokensCap, spec.maxTokensCap);
  const estPromptTok = estimatePromptTokens(params.messages);
  const reserveMicros = computeReservationMicros(estPromptTok, cappedMaxTokens, spec, markup);

  const reserved = await reserveCreditsAtomic(params.userId, reserveMicros);
  if (!reserved) {
    throw new Error(
      `INSUFFICIENT_CREDITS: Need at least $${(reserveMicros / MICROS_PER_USD).toFixed(4)} in prepaid credits (balance: $${(summary.balanceMicros / MICROS_PER_USD).toFixed(4)}). Top up in Settings or connect your own free/BYOC key.`,
    );
  }

  let result: {
    content: string;
    modelUsed: string;
    promptTokens: number;
    completionTokens: number;
    upstreamCostUsd: number | null;
  };
  try {
    try {
      result = await callOpenRouterPlatform(apiKey, spec.primaryModel, params.messages, {
        temperature: params.options?.temperature,
        maxTokens: cappedMaxTokens,
        responseFormat: params.options?.responseFormat,
      });
    } catch (primaryErr: any) {
      // Automatic fallback if primary slug is unavailable/404/503 on OpenRouter
      const status = primaryErr?.status;
      if (
        spec.fallbackModel &&
        spec.fallbackModel !== spec.primaryModel &&
        (status === 404 || status === 502 || status === 503 || status === 429)
      ) {
        console.warn(
          `[Credits Router] Primary model ${spec.primaryModel} returned HTTP ${status}; falling back to ${spec.fallbackModel}`,
        );
        result = await callOpenRouterPlatform(apiKey, spec.fallbackModel, params.messages, {
          temperature: params.options?.temperature,
          maxTokens: cappedMaxTokens,
          responseFormat: params.options?.responseFormat,
        });
      } else {
        throw primaryErr;
      }
    }
  } catch (err) {
    // Upstream failure -> 100% refund of reserved credits
    await releaseReservationAtomic(params.userId, reserveMicros).catch((re) =>
      console.error("[Credits Router] Failed to release reservation:", re),
    );
    throw err;
  }

  const { rawCostMicros, retailCostMicros } = computeRetailChargeMicros({
    upstreamCostUsd: result.upstreamCostUsd,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    spec,
    markup,
  });

  const settled = await settleReservationAtomic({
    userId: params.userId,
    reserveMicros,
    actualRetailMicros: retailCostMicros,
    rawCostMicros,
    markup,
    mode: params.mode,
    modelUsed: result.modelUsed,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    description: params.description || spec.label,
  });

  return {
    content: result.content,
    modelUsed: result.modelUsed,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    chargedMicros: settled.chargedMicros,
    balanceAfterMicros: settled.balanceAfterMicros,
  };
}

/**
 * AIProvider adapter backed by Prepaid Credits so existing routes (chat, code translation,
 * course generation) can invoke it transparently with full provenance reporting.
 */
export class PrepaidCreditsProvider implements AIProvider {
  name = "synapse_credits";
  lastModelUsed: string | null = null;
  lastChargedMicros: number = 0;

  constructor(
    private userId: string,
    private mode: CreditInferenceMode,
    private description?: string,
  ) {}

  isConfigured(): boolean {
    return isCreditsInferenceConfigured();
  }

  async chat(messages: { role: string; content: string }[], options?: ChatOptions): Promise<string> {
    const res = await executeCreditBackedChat({
      userId: this.userId,
      mode: this.mode,
      messages,
      options,
      description: this.description,
    });
    this.lastModelUsed = res.modelUsed;
    this.lastChargedMicros = res.chargedMicros;
    return res.content;
  }
}

// ── Stripe Webhook Signature Verification (zero external SDK dependency) ───

export function verifyStripeWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  webhookSecret: string,
  toleranceSeconds = 300,
  nowSec = Math.floor(Date.now() / 1000),
): { valid: boolean; reason?: string } {
  if (!signatureHeader || !webhookSecret) {
    return { valid: false, reason: "Missing signature header or webhook secret" };
  }

  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestampStr = "";
  const v1Sigs: string[] = [];
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    const k = p.slice(0, eq);
    const v = p.slice(eq + 1);
    if (k === "t") timestampStr = v;
    if (k === "v1") v1Sigs.push(v);
  }

  const ts = Number(timestampStr);
  if (!Number.isFinite(ts) || v1Sigs.length === 0) {
    return { valid: false, reason: "Malformed stripe-signature header" };
  }
  if (Math.abs(nowSec - ts) > toleranceSeconds) {
    return { valid: false, reason: "Stripe webhook timestamp outside replay tolerance" };
  }

  const payloadStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;
  const signedPayload = `${timestampStr}.${payloadStr}`;
  const expectedHex = createHmac("sha256", webhookSecret).update(signedPayload, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  for (const sigHex of v1Sigs) {
    if (!/^[0-9a-fA-F]{64}$/.test(sigHex)) continue;
    const candidateBuf = Buffer.from(sigHex, "hex");
    if (candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf)) {
      return { valid: true };
    }
  }
  return { valid: false, reason: "Signature mismatch" };
}

/**
 * Create a Stripe Checkout Session via Stripe's HTTPS API (server-side price allowlist only).
 */
export async function createStripeCreditCheckoutSession(params: {
  userId: string;
  userEmail?: string | null;
  pack: CreditPack;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Stripe checkout is not configured on this server yet.");
  }

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", params.successUrl);
  form.set("cancel_url", params.cancelUrl);
  form.set("client_reference_id", params.userId);
  if (params.userEmail) {
    form.set("customer_email", params.userEmail);
  }
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(params.pack.priceCents));
  form.set("line_items[0][price_data][product_data][name]", `SynapseJourney Prepaid Credits — ${params.pack.name}`);
  form.set(
    "line_items[0][price_data][product_data][description]",
    `$${(params.pack.priceCents / 100).toFixed(2)} non-expiring prepaid AI credits (course generation, Socratic/Feynman tutor, code translation).`,
  );
  form.set("metadata[userId]", params.userId);
  form.set("metadata[packId]", params.pack.id);
  form.set("metadata[creditMicros]", String(params.pack.creditMicros));

  const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok) {
    const errText = (await resp.text().catch(() => "")).slice(0, 300);
    throw new Error(`Stripe Checkout creation failed (HTTP ${resp.status}): ${errText}`);
  }

  const session: any = await resp.json();
  if (!session?.id || !session?.url) {
    throw new Error("Stripe returned an incomplete checkout session.");
  }
  return { sessionId: String(session.id), checkoutUrl: String(session.url) };
}
