import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated, optionalAuth } from "../replit_integrations/auth";
import { isAdminEmail } from "../auth/localAuth";
import {
  CREDIT_PACKS,
  MICROS_PER_USD,
  getCreditPackById,
  getPublicModeRoutingTable,
  getUserCreditSummary,
  getUserCreditTransactions,
  setUserCreditTierPreference,
  grantUserCredits,
  createStripeCreditCheckoutSession,
  verifyStripeWebhookSignature,
  isCreditsInferenceConfigured,
  isStripeCheckoutConfigured,
  getCreditsMarkupMultiplier,
} from "../credits-router";

function resolveSafeOrigin(req: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.get("host") || "synapsejourney.org";
  return `${proto}://${host}`;
}

export function registerCreditsRoutes(app: Express) {
  // Wallet status, transparent routing table, and credit packs
  app.get("/api/credits/status", optionalAuth, async (req: any, res: Response) => {
    try {
      const userId: string | undefined = req.user?.claims?.sub;
      const balance = userId ? await getUserCreditSummary(userId) : null;
      const transactions = userId ? await getUserCreditTransactions(userId, 25) : [];
      const tier = balance?.creditTierPreference || "balanced";

      res.json({
        creditsInferenceConfigured: isCreditsInferenceConfigured(),
        stripeConfigured: isStripeCheckoutConfigured(),
        markupMultiplier: getCreditsMarkupMultiplier(),
        packs: CREDIT_PACKS.map((p) => ({
          ...p,
          priceUsd: p.priceCents / 100,
        })),
        modeRouting: getPublicModeRoutingTable(tier),
        balance,
        transactions,
      });
    } catch (err) {
      console.error("[Credits] Error loading status:", err);
      res.status(500).json({ error: "Failed to load credit wallet status" });
    }
  });

  // Update learner's credit routing tier preference (economy | balanced | frontier)
  app.put("/api/credits/tier", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = z
        .object({ tier: z.enum(["economy", "balanced", "frontier"]) })
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid tier preference" });
      }
      const updated = await setUserCreditTierPreference(userId, parsed.data.tier);
      res.json({
        balance: updated,
        modeRouting: getPublicModeRoutingTable(updated.creditTierPreference),
      });
    } catch (err) {
      console.error("[Credits] Error updating tier preference:", err);
      res.status(500).json({ error: "Failed to update tier preference" });
    }
  });

  // Create a Stripe Checkout session for a server-allowlisted prepaid pack
  app.post("/api/credits/checkout", isAuthenticated, async (req: any, res: Response) => {
    try {
      if (!isStripeCheckoutConfigured()) {
        return res.status(503).json({
          error: "STRIPE_NOT_CONFIGURED",
          message:
            "Prepaid credit checkout is not activated on this server yet. You can still use all courses for free or connect your own AI key / subscription in Settings.",
        });
      }

      const parsed = z.object({ packId: z.string().min(1).max(64) }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid packId" });
      }
      const pack = getCreditPackById(parsed.data.packId);
      if (!pack) {
        return res.status(400).json({ error: "Unknown credit pack" });
      }

      const userId = req.user.claims.sub;
      const userEmail = req.user.claims.email || null;
      const origin = resolveSafeOrigin(req);

      const session = await createStripeCreditCheckoutSession({
        userId,
        userEmail,
        pack,
        successUrl: `${origin}/settings?credits_purchase=success&pack=${encodeURIComponent(pack.id)}`,
        cancelUrl: `${origin}/settings?credits_purchase=cancelled`,
      });

      res.json({
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
      });
    } catch (err: any) {
      console.error("[Credits] Checkout creation error:", err);
      res.status(500).json({ error: err?.message || "Failed to start checkout" });
    }
  });

  // Stripe Webhook — strictly verifies HMAC-SHA256 against req.rawBody & grants credits idempotently
  app.post("/api/credits/webhook", async (req: Request, res: Response) => {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
      if (!webhookSecret) {
        return res.status(503).json({ error: "Webhook secret not configured" });
      }

      const rawBody = req.rawBody as Buffer | string | undefined;
      if (!rawBody) {
        return res.status(400).json({ error: "Missing raw request body" });
      }

      const sigHeader = req.headers["stripe-signature"] as string | undefined;
      const verification = verifyStripeWebhookSignature(rawBody, sigHeader, webhookSecret);
      if (!verification.valid) {
        console.warn("[Credits Webhook] Rejected invalid signature:", verification.reason);
        return res.status(400).json({ error: "Invalid signature" });
      }

      const event = typeof req.body === "object" && req.body ? (req.body as any) : JSON.parse(rawBody.toString());
      if (event?.type === "checkout.session.completed") {
        const session = event.data?.object;
        if (session?.payment_status !== "paid") {
          return res.json({ received: true, skipped: "unpaid" });
        }

        const userId = String(session.metadata?.userId || session.client_reference_id || "").trim();
        const packId = String(session.metadata?.packId || "").trim();
        const pack = getCreditPackById(packId);
        // Never trust arbitrary client amounts — verify against allowlisted pack & amount_total
        const creditMicros = pack
          ? pack.creditMicros
          : Number(session.amount_total || 0) * 10_000; // cents * 10,000 = micros

        if (!userId || !Number.isInteger(creditMicros) || creditMicros <= 0) {
          console.error("[Credits Webhook] Missing userId or invalid creditMicros:", { userId, packId, creditMicros });
          return res.status(400).json({ error: "Invalid session metadata" });
        }

        const result = await grantUserCredits({
          userId,
          amountMicros: creditMicros,
          kind: "purchase",
          stripeEventId: String(event.id),
          stripeSessionId: String(session.id),
          description: pack
            ? `Purchased ${pack.name} ($${(pack.priceCents / 100).toFixed(2)})`
            : `Purchased $${(creditMicros / MICROS_PER_USD).toFixed(2)} prepaid credits`,
          metadata: {
            packId: pack?.id || "custom",
            amountTotalCents: session.amount_total,
            currency: session.currency,
          },
        });

        console.log(
          `[Credits Webhook] Event ${event.id} for user=${userId}: applied=${result.applied}, balance=$${(result.balanceMicros / MICROS_PER_USD).toFixed(4)}`,
        );
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("[Credits Webhook] Processing error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Admin-only credit grant (useful for professor/faculty demo grants or manual refunds)
  app.post("/api/credits/admin/grant", isAuthenticated, async (req: any, res: Response) => {
    try {
      if (!isAdminEmail(req.user?.claims?.email)) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const parsed = z
        .object({
          targetUserId: z.string().min(1),
          amountUsd: z.number().positive().max(250),
          note: z.string().min(2).max(200).default("Admin demo/scholarship credit grant"),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid grant payload", details: parsed.error.flatten() });
      }

      const amountMicros = Math.round(parsed.data.amountUsd * MICROS_PER_USD);
      const granted = await grantUserCredits({
        userId: parsed.data.targetUserId,
        amountMicros,
        kind: "admin_grant",
        description: parsed.data.note,
        metadata: { grantedBy: req.user.claims.email },
      });

      res.json({
        ok: true,
        balanceMicros: granted.balanceMicros,
        balanceUsd: Number((granted.balanceMicros / MICROS_PER_USD).toFixed(4)),
      });
    } catch (err: any) {
      console.error("[Credits] Admin grant error:", err);
      res.status(500).json({ error: err?.message || "Failed to grant credits" });
    }
  });
}
