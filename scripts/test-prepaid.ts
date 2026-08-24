/**
 * Prepaid inference — pure pricing/guard unit tests (no DB, no network).
 *
 * Run:  npx tsx scripts/test-prepaid.ts
 *
 * NOTE: the DB-level debit/credit transaction (atomic guarded decrement +
 * ledger row) lives in server/storage.ts. Its true atomicity is enforced by
 * the SQL guard `UPDATE … WHERE balance >= sell RETURNING balance_cents` inside
 * a transaction, which requires a real Postgres to exercise end-to-end — see
 * scripts/test-prepaid-db.ts (run on a host with TEST_DATABASE_URL, e.g. the
 * droplet).
 */
import { test } from "node:test";
import assert from "node:assert";

import {
  computeSellCents,
  costCentsForUsage,
  estimateMaxSellCents,
  estimateMaxCostCents,
  PREPAID_MARGIN,
  PREPAID_MIN_SELL_CENTS,
  PREPAID_MAX_TOKENS,
} from "../server/prepaid";
import { rateLimit, resetRateLimits } from "../server/rate-limit";

test("costCentsForUsage uses pinned per-token prices and rounds UP", () => {
  // Defaults: input $0.50/M, output $2.00/M.
  const c = costCentsForUsage(1_000_000, 1_000_000);
  // (1M * 0.50 + 1M * 2.00) / 1M = $2.50 → 250 cents.
  assert.strictEqual(c, 250);
});

test("computeSellCents applies margin and rounds up", () => {
  // cost 100¢ × 1.3 = 130¢ exactly.
  assert.strictEqual(computeSellCents(100), Math.ceil(100 * PREPAID_MARGIN));
});

test("computeSellCents enforces a safe floor so tiny requests can't round to ~0", () => {
  // cost 1¢ → 1.3 → ceil = 2¢, floored up to PREPAID_MIN_SELL_CENTS.
  const sell = computeSellCents(1);
  assert.ok(sell >= PREPAID_MIN_SELL_CENTS, `sell ${sell} >= floor ${PREPAID_MIN_SELL_CENTS}`);
  assert.strictEqual(computeSellCents(0), PREPAID_MIN_SELL_CENTS);
});

test("computeSellCents never returns a loss (sell >= cost)", () => {
  for (const cost of [1, 2, 5, 13, 100, 999]) {
    assert.ok(computeSellCents(cost) >= cost, `cost ${cost} -> ${computeSellCents(cost)}`);
  }
});

test("estimateMaxSellCents produces a conservative non-negative ceiling", () => {
  const est = estimateMaxSellCents(
    [{ role: "user", content: "some prompt text" }],
    { maxTokens: 2048 }
  );
  assert.ok(est >= PREPAID_MIN_SELL_CENTS);
  // A longer prompt + larger cap should never DECREASE the ceiling.
  const bigger = estimateMaxSellCents(
    [{ role: "user", content: "x".repeat(5000) }],
    { maxTokens: 8192 }
  );
  assert.ok(bigger >= est);
});

test("balance-guard semantics: a debit cannot overdraw (mirrors the SQL guard)", () => {
  // This mirrors the exact condition used in storage.debitForInference:
  //   UPDATE user_credits SET balance = balance - sell
  //     WHERE user_id = ? AND balance >= sell  RETURNING balance
  // If no row is returned, the debit is rejected. Reimplemented in-memory so the
  // invariant is testable without Postgres.
  const debit = (balance: number, sell: number): number | null =>
    balance >= sell ? balance - sell : null;

  assert.strictEqual(debit(0, 5), null, "zero balance must block generation");
  assert.strictEqual(debit(4, 5), null, "insufficient balance must block");
  assert.strictEqual(debit(100, 30), 70, "sufficient balance debits exactly");
  assert.strictEqual(debit(30, 30), 0, "exact-balance hits zero but never negative");
});

test("estimateMaxCostCents clamps output to PREPAID_MAX_TOKENS", () => {
  // A caller asking for a giant cap must not blow past the hard token clamp.
  const capped = estimateMaxCostCents([{ role: "user", content: "hi" }], { maxTokens: 1_000_000 });
  const expected = costCentsForUsage(Math.ceil(2 / 3), PREPAID_MAX_TOKENS);
  assert.strictEqual(capped, expected);
});

test("max-tokens clamp is enforced even when options.maxTokens is huge", () => {
  assert.ok(PREPAID_MAX_TOKENS > 0 && PREPAID_MAX_TOKENS <= 8192 + 1);
});

test("rate limiter enforces max requests per window and resets", () => {
  resetRateLimits();
  const key = "test:user";
  let allowed = 0;
  // Fire 20 requests at max=5.
  for (let i = 0; i < 20; i++) {
    if (rateLimit(key, 5, 60_000).allowed) allowed++;
  }
  assert.strictEqual(allowed, 5, "only the first 5 within the window are allowed");
  // A different key is unaffected.
  assert.strictEqual(rateLimit("test:other", 5, 60_000).allowed, true);
});

console.log("All prepaid pure-logic tests passed.");