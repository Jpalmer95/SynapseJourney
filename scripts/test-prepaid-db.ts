/**
 * Prepaid inference — DB integration test for the atomic debit/credit invariant.
 *
 * Requires a Postgres connection string in TEST_DATABASE_URL pointing at a
 * scratch database (NOT production). Skips cleanly when unset.
 *
 * Run (e.g. on the droplet, where Postgres lives):
 *   TEST_DATABASE_URL=postgres://...  npx tsx scripts/test-prepaid-db.ts
 *
 * Verifies against a temporary table (mirrors user_credits + inference_charges):
 *   1. crediting a purchase upserts the balance and writes a ledger row,
 *   2. an idempotent (duplicate event id) credit is NOT double-applied,
 *   3. a guarded debit cannot overdraw (balance 0 or insufficient → rejected),
 *   4. a successful debit writes a ledger row with the correct balance_after.
 *
 * The SQL here is a copy of the guards used in server/storage.ts
 * (debitForInference / creditUserBalance) so the invariant is exercised
 * against a real engine without touching app data.
 */
import { test, before, after } from "node:test";
import assert from "node:assert";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;

const pool = url
  ? new pg.Pool({ connectionString: url })
  : null;

before(async function () {
  if (!pool) return this.skip?.("TEST_DATABASE_URL not set — skipping DB integration test");
  const client = await pool.connect();
  try {
    await client.query("DROP TABLE IF EXISTS _t_charges, _t_credits");
    await client.query(
      `CREATE TABLE _t_credits (
         user_id text PRIMARY KEY,
         balance_cents integer NOT NULL DEFAULT 0
       )`
    );
    await client.query(
      `CREATE TABLE _t_charges (
         id serial PRIMARY KEY,
         user_id text NOT NULL,
         kind text NOT NULL,
         amount_cents integer NOT NULL,
         balance_after_cents integer NOT NULL,
         stripe_event_id text UNIQUE
       )`
    );
  } finally {
    client.release();
  }
});

after(async function () {
  if (pool) {
    await pool.query("DROP TABLE IF EXISTS _t_charges, _t_credits");
    await pool.end();
  }
});

async function credit(userId: string, amountCents: number, eventId?: string) {
  const client = await pool!.connect();
  try {
    await client.query("BEGIN");
    // idempotency check
    if (eventId) {
      const { rows } = await client.query(
        "SELECT id FROM _t_charges WHERE stripe_event_id = $1",
        [eventId]
      );
      if (rows.length > 0) {
        const { rows: bal } = await client.query(
          "SELECT balance_cents FROM _t_credits WHERE user_id = $1",
          [userId]
        );
        await client.query("COMMIT");
        return { balanceCents: bal[0]?.balance_cents ?? 0, alreadyProcessed: true };
      }
    }
    await client.query(
      `INSERT INTO _t_credits (user_id, balance_cents) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET balance_cents = _t_credits.balance_cents + $2`,
      [userId, amountCents]
    );
    const { rows: bal } = await client.query(
      "SELECT balance_cents FROM _t_credits WHERE user_id = $1",
      [userId]
    );
    await client.query(
      "INSERT INTO _t_charges (user_id, kind, amount_cents, balance_after_cents, stripe_event_id) VALUES ($1,$2,$3,$4,$5)",
      [userId, "credit", amountCents, bal[0].balance_cents, eventId ?? null]
    );
    await client.query("COMMIT");
    return { balanceCents: bal[0].balance_cents };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function debit(userId: string, sellCents: number) {
  const client = await pool!.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE _t_credits SET balance_cents = balance_cents - $2
       WHERE user_id = $1 AND balance_cents >= $2
       RETURNING balance_cents`,
      [userId, sellCents]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return null; // blocked
    }
    await client.query(
      "INSERT INTO _t_charges (user_id, kind, amount_cents, balance_after_cents) VALUES ($1,'debit',$2,$3)",
      [userId, sellCents, rows[0].balance_cents]
    );
    await client.query("COMMIT");
    return rows[0].balance_cents as number;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

test("credit upserts balance + writes ledger row", async () => {
  if (!pool) return;
  const r = await credit("user-a", 1000);
  assert.strictEqual(r.balanceCents, 1000);
  const r2 = await credit("user-a", 500);
  assert.strictEqual(r2.balanceCents, 1500);
});

test("duplicate stripe event id is not double-credited", async () => {
  if (!pool) return;
  await credit("user-b", 1000, "evt_123");
  const dup = await credit("user-b", 1000, "evt_123");
  assert.strictEqual(dup.alreadyProcessed, true);
  assert.strictEqual(dup.balanceCents, 1000);
});

test("guarded debit blocks zero/insufficient balance (no overdraft)", async () => {
  if (!pool) return;
  // fresh user with 0 balance
  assert.strictEqual(await debit("user-c", 5), null);
  await credit("user-c", 4);
  assert.strictEqual(await debit("user-c", 5), null, "4 < 5 must block");
});

test("successful debit is exact and writes ledger with correct balance_after", async () => {
  if (!pool) return;
  await credit("user-d", 1000);
  const after = await debit("user-d", 300);
  assert.strictEqual(after, 700);
  const { rows } = await pool!.query(
    "SELECT kind, amount_cents, balance_after_cents FROM _t_charges WHERE user_id = 'user-d' AND kind = 'debit'"
  );
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].amount_cents, 300);
  assert.strictEqual(rows[0].balance_after_cents, 700);
});

console.log("DB integration tests done.");