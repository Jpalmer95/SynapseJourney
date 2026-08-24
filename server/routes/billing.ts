/**
 * Prepaid inference billing (Stripe).
 *
 * - GET  /api/billing/balance   → balance + recent ledger + package list + config
 * - POST /api/billing/checkout  → create a Stripe Checkout Session (server-side)
 * - POST /api/billing/webhook   → Stripe signature-verified, idempotent credit
 *
 * The webhook is the ONLY place a balance is credited. It verifies the Stripe
 * signature (never trusts the body) and is idempotent (keyed on the Stripe
 * event id stored on the ledger), so redeliveries can't double-credit.
 */
import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { PREPAID_MODEL, prepaidIsConfigured } from "../prepaid";
import { rateLimit } from "../rate-limit";

// Whitelisted credit packages (cents). The client may only request these.
const CREDIT_PACKAGES = [
  { id: "starter", label: "$5", amountCents: 500 },
  { id: "standard", label: "$10", amountCents: 1000 },
  { id: "plus", label: "$20", amountCents: 2000 },
];

// Hard sanity cap on any single credited amount (defense-in-depth: even a valid
// signature can't create a more-than-$500 credit from our $5/$10/$20 packages).
const MAX_SINGLE_CREDIT_CENTS = Math.max(...CREDIT_PACKAGES.map((p) => p.amountCents)) * 10;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.warn("[Billing] STRIPE_SECRET_KEY not set — billing endpoints disabled.");
    return null;
  }
  return new Stripe(key);
}

export function registerBillingRoutes(app: Express) {
  // ── Public billing config + balance (authenticated) ────────────────────────
  app.get("/api/billing/balance", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const balanceCents = await storage.getUserCreditBalance(userId);
      const ledger = await storage.getInferenceLedger(userId, 20);
      res.json({
        balanceCents,
        packages: CREDIT_PACKAGES,
        model: PREPAID_MODEL,
        prepaidEnabled: prepaidIsConfigured(),
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
        ledger,
      });
    } catch (error: any) {
      console.error("[Billing] balance error:", error);
      res.status(500).json({ error: "Failed to load billing" });
    }
  });

  // ── Create a Checkout Session (server-side; client redirects) ─────────────
  app.post("/api/billing/checkout", isAuthenticated, async (req: any, res: Response) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ error: "PAYMENTS_DISABLED", message: "Payments are not configured on this server." });
      }

      const userId: string = req.user.claims.sub;
      const packageId: string | undefined = req.body?.packageId;
      const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
      if (!pkg) {
        return res.status(400).json({ error: "Invalid credit package" });
      }

      // Rate-limit checkout creation (prevents spam sessions).
      const rl = rateLimit(`checkout:${userId}`, 6, 60_000);
      if (!rl.allowed) {
        return res.status(429).json({ error: "RATE_LIMITED", message: "Too many checkout attempts — slow down." });
      }

      // Never derive the redirect base from the request Origin (open-redirect
      // vector). Prefer an explicit APP_BASE_URL, else a fixed default.
      const base = (process.env.APP_BASE_URL || "https://synapsejourney.org").replace(/\/+$/, "");
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: pkg.amountCents,
              product_data: {
                name: "Synapse Journey — Prepaid Inference Credits",
                description: `${pkg.label} of course-generation / Q&A compute (pinned model: ${PREPAID_MODEL})`,
              },
            },
          },
        ],
        client_reference_id: userId,
        metadata: { userId, packageId: pkg.id, amountCents: String(pkg.amountCents) },
        success_url: `${base}/settings?billing=success`,
        cancel_url: `${base}/settings?billing=cancelled`,
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error("[Billing] checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session", message: error?.message || String(error) });
    }
  });

  // ── Stripe webhook (signature-verified, idempotent) ────────────────────────
  app.post("/api/billing/webhook", async (req: Request, res: Response) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !webhookSecret) {
      return res.status(503).json({ error: "Webhook not configured" });
    }

    const signature = req.headers["stripe-signature"];
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!signature || !rawBody) {
      return res.status(400).json({ error: "Missing stripe-signature or body" });
    }

    let event: Stripe.Event;
    try {
      // Signature verification — never trust the body.
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      console.warn(`[Billing] Webhook signature verification failed: ${err.message}`);
      return res.status(400).json({ error: `Signature verification failed` });
    }

    // Respond immediately; process asynchronously.
    res.json({ received: true });

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const amountTotal = session.amount_total; // already in cents

        // Require a genuinely-paid session (not a re-send of a cancelled/expired one).
        const paid = session.payment_status ?? "paid";
        if (paid !== "paid" && paid !== "no_payment_required") {
          console.warn(`[Billing] Ignoring session ${event.id} with payment_status=${paid}`);
          return;
        }

        if (!userId || amountTotal == null || !Number.isInteger(amountTotal) || amountTotal <= 0 || amountTotal > MAX_SINGLE_CREDIT_CENTS) {
          console.warn(`[Billing] checkout.session.completed rejected (bad userId/amount): ${event.id}`);
          return;
        }

        // Idempotent credit keyed on the Stripe event id (unique column on the ledger).
        const result = await storage.creditUserBalance(userId, amountTotal, {
          stripeEventId: event.id,
          source: "stripe",
          metadata: { packageId: session.metadata?.packageId || null },
        });

        console.log(
          `[Billing] Credited $${(amountTotal / 100).toFixed(2)} to ${userId} (event ${event.id})` +
            (result.alreadyProcessed ? " [duplicate ignored]" : ` — new balance $${(result.balanceCents / 100).toFixed(2)}`)
        );
      } else {
        // Ignore other event types.
        console.log(`[Billing] Unhandled event type: ${event.type}`);
      }
    } catch (err: any) {
      // Do not throw past the webhook ack — log and move on. Stripe will
      // redeliver if we return non-2xx, but we've already acked 200.
      console.error(`[Billing] Webhook processing error for ${event.id}:`, err);
    }
  });
}