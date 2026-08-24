# Session Prompt — Prepaid Inference (Stripe + Credit Flow)

You are working on **SynapseJourney**, an open-source, agent-native learning platform.

## Repo & environment
- Repo: `/home/jonathan/dev/synapse` (already cloned). Branch `main`.
- Live: https://synapsejourney.org · Deploy: `ssh root@167.99.125.127`, app at `/var/www/SynapseJourney`,
  served by PM2 process `synapsejourney` (NOT Docker). Postgres on the droplet host (`localhost:5432`,
  db `synapsejourney`, user `sjuser`).
- Load the `synapse-platform` skill FIRST — it has the Express+Drizzle+pgvector patterns, the
  "Synapse Sprint Pattern" (schema → migration → IStorage → impl → routes → register → tsc), and
  critical pitfalls (relative imports `../`, snake_case vs camelCase, `sjuser` GRANTs in migrations,
  BYOC-only generation, OpenRouter max_tokens 402 gotcha, AI JSON-fence stripping).

## Read these before writing code
1. `SYNAPSE-MASTER-REVAMP.md` — section **"The Optional Paid Inference Lane (BYOK-first, prepaid only)"**
   is the authoritative design. Implement to match it.
2. `server/ai-providers.ts` — `generateByokOrPool()` (lines ~726), `ProviderConfig`, `OpenRouterProvider`,
   `providerConfigFromProfile()`. This is where the new `"prepaid"` source plugs in.
3. `server/storage.ts` — `novaCoins` table (a simple coin counter, lines ~2134), `communityPoolUsage`.

## The task — build the prepaid inference lane, correctly and cost-safely
Goal: let a user with NO API key and NO local Ollama optionally buy prepaid compute credits and
spend them on course generation / Q&A, at a price that **guarantees the operator never loses money**.

### Hard requirements (non-negotiable)
1. **Prepaid only, never metered.** A user buys a credit balance up front. Generations debit that
   balance. Balance = 0 → generation stops. There must be **no code path** where a user's request
   can draw on operator funds. This is the core invariant.
2. **Single pinned model** — users do NOT choose arbitrary models. Default `deepseek/deepseek-chat`
   (OpenRouter). One premium fallback allowed later (`anthropic/claude-3.5-haiku`). No arbitrary-model UI.
3. **Sell-price = cost-per-token × margin, rounded up to a safe floor.** Margin constant defined in ONE
   place (config/env), default ~1.3×. Operator is assumed to hold prepaid OpenRouter credit.
4. **Atomic debits + full logging.** Every debit records model, tokens, cost, and balance_after for
   reconciliation. Use a DB transaction.
5. **Coexists with BYOK.** Resolution order: user's own key (BYOK, $0 to them) → prepaid balance →
   (never a free platform pool — that stays disabled).

### Scope
- Schema + migration: add a real credit balance (e.g. `user_credits` table or `credit_balance_cents`
  on `user_profiles`/`nova_coins`) + a `credit_ledger` (or `inference_charges`) table for the audit log.
  Follow the migration convention (forward + rollback, `GRANT ... TO sjuser`).
- IStorage methods for balance read/credit/debit (atomic).
- `generateByokOrPool` (or a sibling `generatePrepaid`) that resolves prepaid as a source.
- Stripe: add `stripe` (server) + `@stripe/stripe-js` (client). Server-side Checkout Session creation,
  a webhook endpoint that verifies the signature (`stripe.webhooks.constructEvent`), idempotent
  (process by event id), credits the balance on `checkout.session.completed`.
- Settings/UI: minimal "Buy credits" flow + visible balance. Keep it simple and dark-UI-consistent.
- Env vars (document, do NOT hardcode): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `OPENROUTER_API_KEY`, `PREPAID_MODEL`, `PREPAID_MARGIN`.

### Success criteria (all must pass before you call it done)
- [ ] `tsc --noEmit` clean; `npm run build` passes.
- [ ] A unit/integration test proves: balance 0 → generation blocked; debit is atomic; ledger row written.
- [ ] Webhook handler rejects a bad signature (don't just trust the body).
- [ ] `generateByokOrPool` still works unchanged for BYOK users (no regression).
- [ ] README/SYNAPSE-MASTER-REVAMP.md cost-safety checklist items updated to [x] as you complete them.

## Do NOT
- Do not touch the BYOK-first default or re-enable a free platform pool.
- Do not let users pick arbitrary models or enter a raw "pay per token" price.
- Do not deploy to prod until the user has reviewed the pricing/model choice. Build + typecheck +
  test locally, open a PR, and STOP — do not `pm2 restart` without explicit go-ahead.
- Do not commit secrets (use env vars; give nano/sed commands for the droplet if needed).

Deliver: a PR on a `feature/prepaid-inference` branch, with the schema/migration/storage/provider/
stripe/UI changes, tests, and a short summary of what's done + what remains blocked on the user's
Stripe/OpenRouter keys.
