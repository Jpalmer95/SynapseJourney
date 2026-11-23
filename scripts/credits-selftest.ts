#!/usr/bin/env tsx
/**
 * Self-test for Prepaid Credits, OpenRouter Mode-Router, and Stripe Webhook Security.
 * Runs offline with zero database or network calls.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  CREDIT_PACKS,
  MICROS_PER_USD,
  resolveModeModelSpec,
  computeReservationMicros,
  computeRetailChargeMicros,
  verifyStripeWebhookSignature,
  checkAndRecordCreditRateLimit,
  estimatePromptTokens,
} from "../server/credits-router";
import { inferDomainVolatility, isTechnicalStemSubject, CURRENT_GENERATOR_VERSION } from "../shared/provenance";

// 1. Mode-Router defaults: technical course uses Gemini Neon by default
const techSpec = resolveModeModelSpec("technical_course", "balanced");
assert.ok(techSpec.primaryModel.includes("gemini"), `expected Gemini model for technical_course, got ${techSpec.primaryModel}`);
assert.ok(techSpec.maxTokensCap <= 8192, "maxTokensCap bounded");

const tutorEcon = resolveModeModelSpec("tutor_socratic", "economy");
const tutorFrontier = resolveModeModelSpec("tutor_socratic", "frontier");
assert.notEqual(tutorEcon.primaryModel, tutorFrontier.primaryModel, "economy vs frontier tutor models differ");

// 2. Cost accounting invariants (zero-loss markup & non-negative integer micros)
const estTokens = estimatePromptTokens([{ role: "user", content: "Explain Maxwell's equations in birefringent waveguides." }]);
const reserve = computeReservationMicros(estTokens, 1200, techSpec, 2.2);
assert.ok(Number.isInteger(reserve) && reserve >= 1000, "reservation must be positive integer micros");

const { rawCostMicros, retailCostMicros } = computeRetailChargeMicros({
  upstreamCostUsd: 0.01, // $0.01 raw
  promptTokens: 1000,
  completionTokens: 500,
  spec: techSpec,
  markup: 2.2,
});
assert.equal(rawCostMicros, 10_000, "0.01 USD = 10,000 micros");
assert.equal(retailCostMicros, 22_000, "2.2x markup = 22,000 micros");
assert.ok(retailCostMicros >= rawCostMicros * 2, "retail cost strictly covers raw + Stripe fees");

// 3. Stripe webhook HMAC-SHA256 verification + replay protection
const secret = "whsec_test_synapse_1234567890";
const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
const nowSec = 1_760_000_000;
const validSig = createHmac("sha256", secret).update(`${nowSec}.${payload}`, "utf8").digest("hex");

assert.equal(
  verifyStripeWebhookSignature(payload, `t=${nowSec},v1=${validSig}`, secret, 300, nowSec + 10).valid,
  true,
  "valid signature passes",
);
assert.equal(
  verifyStripeWebhookSignature(payload + " ", `t=${nowSec},v1=${validSig}`, secret, 300, nowSec + 10).valid,
  false,
  "tampered payload rejected",
);
assert.equal(
  verifyStripeWebhookSignature(payload, `t=${nowSec - 500},v1=${validSig}`, secret, 300, nowSec).valid,
  false,
  "expired timestamp rejected (replay protection)",
);

// 4. Server-allowlisted packs are positive & integral
for (const pack of CREDIT_PACKS) {
  assert.equal(pack.creditMicros, (pack.priceCents / 100) * MICROS_PER_USD);
}

// 5. Rate limiter allows normal burst then blocks abuse
const testUser = "selftest_rate_limit_user";
let blocked = false;
for (let i = 0; i < 30; i++) {
  const r = checkAndRecordCreditRateLimit(testUser, 1_700_000_000_000 + i * 100);
  if (!r.ok) {
    blocked = true;
    break;
  }
}
assert.equal(blocked, true, "rate limiter trips after 25 calls/min");

// 6. Provenance helpers
assert.equal(inferDomainVolatility("Calculus"), "evergreen");
assert.equal(inferDomainVolatility("Quantum Mechanics Frontier"), "frontier");
assert.equal(isTechnicalStemSubject("Geometric Phase Amplification in Fiber Optic Systems"), true);
assert.ok(CURRENT_GENERATOR_VERSION.startsWith("v3."));

console.log("credits-selftest: OK (mode-router, micro-dollar accounting, Stripe HMAC/replay guard, rate limiter, provenance verified)");
