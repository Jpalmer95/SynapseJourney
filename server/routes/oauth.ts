/**
 * server/routes/oauth.ts — Bring Your Own Subscription (BYOS) OAuth Routes
 *
 * Exposes device-code & PKCE endpoints for connecting personal AI subscriptions
 * (xAI Grok, Nous Portal, OpenAI ChatGPT Codex, MiniMax OAuth, OpenRouter PKCE)
 * directly in Settings.
 */

import type { Express, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import {
  OAUTH_SUBSCRIPTION_CATALOG,
  isOAuthSubscriptionProviderId,
  sanitizeOAuthSubscriptionsMap,
  startOAuthDeviceFlow,
  getOAuthLoginSession,
  cancelOAuthLoginSession,
  disconnectUserOAuthSubscription,
  createOpenRouterPkceSession,
  exchangeOpenRouterPkceCode,
} from "../oauth-subscriptions";

export function registerOAuthRoutes(app: Express) {
  // List all BYOS subscription providers, policy metadata, and current user connection status
  app.get("/api/oauth/providers", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      const statuses = sanitizeOAuthSubscriptionsMap((profile as any)?.oauthSubscriptions);

      res.json({
        catalog: OAUTH_SUBSCRIPTION_CATALOG,
        statuses,
        openRouterConnected: Boolean(profile?.openRouterKey),
        preferredAiProvider: profile?.preferredAiProvider || "openai",
      });
    } catch (error: any) {
      console.error("[OAuth] Error listing providers:", error);
      res.status(500).json({ error: "Failed to load OAuth subscription providers" });
    }
  });

  // Start an OAuth 2.0 Device Code flow for xai_oauth, nous_oauth, openai_codex, or minimax_oauth
  app.post("/api/oauth/:provider/start", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { provider } = req.params;

      if (!isOAuthSubscriptionProviderId(provider)) {
        return res.status(400).json({
          error: `Unsupported device-code provider: ${provider}`,
        });
      }

      const session = await startOAuthDeviceFlow(userId, provider);
      res.json({
        sessionId: session.sessionId,
        provider: session.provider,
        flow: session.flow,
        userCode: session.userCode,
        verificationUrl: session.verificationUrl,
        expiresIn: session.expiresIn,
        pollInterval: session.pollInterval,
      });
    } catch (error: any) {
      console.error(`[OAuth] Failed to start device flow for ${req.params.provider}:`, error);
      res.status(502).json({
        error: "OAUTH_START_FAILED",
        message: error?.message || "Failed to start OAuth device authorization flow.",
      });
    }
  });

  // Poll a pending OAuth device-code session (supports optional ?wait=seconds long-poll up to 15s)
  app.get("/api/oauth/:provider/poll/:sessionId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { provider, sessionId } = req.params;
      const waitSec = Math.min(Math.max(Number(req.query.wait) || 0, 0), 15);

      const sess = getOAuthLoginSession(sessionId, userId);
      if (!sess) {
        return res.status(404).json({ error: "OAuth login session not found or expired" });
      }
      if (sess.provider !== provider) {
        return res.status(400).json({ error: "Provider mismatch for OAuth session" });
      }

      if (waitSec > 0 && sess.status === "pending") {
        const deadline = Date.now() + waitSec * 1000;
        while (sess.status === "pending" && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }

      res.json({
        sessionId: sess.sessionId,
        provider: sess.provider,
        status: sess.status,
        errorMessage: sess.errorMessage || null,
        expiresAt: new Date(sess.expiresAt).toISOString(),
        accountLabel: sess.accountLabel || null,
        tokenPreview: sess.tokenPreview || null,
      });
    } catch (error: any) {
      console.error("[OAuth] Poll error:", error);
      res.status(500).json({ error: "Failed to poll OAuth session" });
    }
  });

  // Cancel a pending OAuth device-code session
  app.delete("/api/oauth/sessions/:sessionId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      const ok = cancelOAuthLoginSession(sessionId, userId);
      res.json({ ok, sessionId });
    } catch (error: any) {
      console.error("[OAuth] Cancel error:", error);
      res.status(500).json({ error: "Failed to cancel OAuth session" });
    }
  });

  // Start OpenRouter 1-click OAuth PKCE redirect flow
  app.post("/api/oauth/openrouter_pkce/start", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "synapsejourney.org";
      const callbackUrl = `${proto}://${host}/api/oauth/openrouter_pkce/callback`;
      const { authUrl, state } = createOpenRouterPkceSession(userId, callbackUrl);
      res.json({ authUrl, state });
    } catch (error: any) {
      console.error("[OAuth] OpenRouter PKCE start failed:", error);
      res.status(500).json({ error: error?.message || "Failed to start OpenRouter OAuth" });
    }
  });

  // Callback for OpenRouter 1-click OAuth PKCE redirect
  app.get("/api/oauth/openrouter_pkce/callback", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const code = String(req.query.code || "").trim();
      const state = String(req.query.state || "").trim();
      if (!code || !state) {
        return res.redirect("/settings?oauth_error=missing_code");
      }
      await exchangeOpenRouterPkceCode(userId, code, state);
      res.redirect("/settings?oauth_connected=openrouter");
    } catch (error: any) {
      console.error("[OAuth] OpenRouter PKCE callback failed:", error);
      const msg = encodeURIComponent(error?.message || "OpenRouter OAuth failed");
      res.redirect(`/settings?oauth_error=${msg}`);
    }
  });

  // Disconnect a stored OAuth subscription
  app.delete("/api/oauth/:provider", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { provider } = req.params;
      if (!isOAuthSubscriptionProviderId(provider)) {
        return res.status(400).json({ error: `Unknown OAuth subscription provider: ${provider}` });
      }
      const removed = await disconnectUserOAuthSubscription(userId, provider);
      res.json({ ok: true, provider, removed });
    } catch (error: any) {
      console.error("[OAuth] Disconnect error:", error);
      res.status(500).json({ error: "Failed to disconnect OAuth subscription" });
    }
  });
}
