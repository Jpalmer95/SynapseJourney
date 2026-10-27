/**
 * Google Sign-In (OAuth 2.0 authorization-code flow, server-side).
 *
 * Activates automatically when both env vars are present:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 * Optional: GOOGLE_REDIRECT_URI (defaults to $APP_URL/api/auth/google/callback),
 *           APP_URL (defaults to the request origin).
 *
 * Accounts are matched by verified email: an existing password account with the
 * same email is linked to the Google identity instead of duplicated.
 */
import type { Express } from "express";
import crypto from "crypto";
import { authStorage } from "../replit_integrations/auth/storage";

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function baseUrl(req: any): string {
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  return appUrl.replace(/\/+$/, "");
}

function redirectUri(req: any): string {
  return process.env.GOOGLE_REDIRECT_URI || `${baseUrl(req)}/api/auth/google/callback`;
}

function decodeIdToken(idToken: string): any {
  const [, payload] = idToken.split(".");
  if (!payload) return null;
  const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json);
}

export function registerGoogleRoutes(app: Express) {
  app.get("/api/auth/google/start", (req: any, res: any) => {
    if (!isGoogleConfigured()) {
      return res.status(503).json({ message: "Google sign-in is not configured on this deployment." });
    }
    const state = crypto.randomBytes(24).toString("hex");
    (req.session as any).googleState = state;
    (req.session as any).googleReturnTo = typeof req.query.return_to === "string" ? req.query.return_to : "/";

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    url.searchParams.set("redirect_uri", redirectUri(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");

    req.session.save(() => res.redirect(url.toString()));
  });

  app.get("/api/auth/google/callback", async (req: any, res: any) => {
    const fail = (reason: string) => {
      console.error(`[google] sign-in failed: ${reason}`);
      return res.redirect(`/?auth_error=${encodeURIComponent(reason)}`);
    };

    if (!isGoogleConfigured()) return fail("google_not_configured");

    const { code, state, error } = req.query as Record<string, string | undefined>;
    if (error) return fail(error);
    if (!code) return fail("missing_code");
    if (!state || state !== (req.session as any).googleState) return fail("state_mismatch");

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri(req),
          grant_type: "authorization_code",
        }),
      });
      const tokenBody: any = await tokenRes.json();
      if (!tokenRes.ok || !tokenBody.id_token) {
        return fail(tokenBody?.error || `token_exchange_${tokenRes.status}`);
      }

      const claims = decodeIdToken(tokenBody.id_token);
      if (!claims?.sub) return fail("missing_subject");
      if (claims.aud !== process.env.GOOGLE_CLIENT_ID) return fail("audience_mismatch");
      if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) {
        return fail("issuer_mismatch");
      }
      if (!claims.email) return fail("missing_email");
      if (claims.email_verified === false || claims.email_verified === "false") {
        return fail("email_not_verified");
      }

      const email = String(claims.email).toLowerCase();
      const provider = "google";
      let userId = await authStorage.findUserIdByIdentity(provider, claims.sub);

      if (!userId) {
        const existing = await authStorage.getUserByEmail(email);
        if (existing) {
          userId = existing.id;
        } else {
          const user = await authStorage.createUserFromOAuth({
            email,
            firstName: claims.given_name || null,
            lastName: claims.family_name || null,
            profileImageUrl: claims.picture || null,
          });
          userId = user.id;
        }
        await authStorage.linkIdentity(userId, provider, claims.sub);
      }

      const returnTo = (req.session as any).googleReturnTo || "/";
      delete (req.session as any).googleState;
      delete (req.session as any).googleReturnTo;

      req.session.regenerate((regenErr: any) => {
        if (regenErr) return fail("session_error");
        (req.session as any).userId = userId;
        req.session.save(() => {
          console.log(`[google] signed in ${email}`);
          res.redirect(returnTo.startsWith("/") ? returnTo : "/");
        });
      });
    } catch (err: any) {
      return fail(err?.message || "google_callback_error");
    }
  });
}
