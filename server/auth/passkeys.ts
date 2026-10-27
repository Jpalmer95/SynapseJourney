/**
 * Passkeys / WebAuthn (Face ID, Touch ID, Windows Hello, security keys).
 *
 * Self-hosted: no third-party credentials required. The relying party is derived
 * from APP_URL (or the request origin), overridable with WEBAUTHN_RP_ID /
 * WEBAUTHN_ORIGIN when running behind a proxy or on a preview domain.
 *
 * Flow:
 *   Register (signed in):  POST /api/auth/passkey/register/options → /verify
 *   Login  (anonymous):    POST /api/auth/passkey/login/options    → /verify
 */
import type { Express, RequestHandler } from "express";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { authStorage } from "../replit_integrations/auth/storage";

const RP_NAME = "Synapse";

function rpContext(req: any) {
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  const appOrigin = new URL(appUrl).origin;
  const appHost = new URL(appOrigin).hostname;

  let origin = appOrigin;
  const originHeader = typeof req.headers.origin === "string" ? req.headers.origin : "";
  if (originHeader) {
    try {
      const callerHost = new URL(originHeader).hostname;
      // Accept the caller's origin only when it is same-site with the configured app
      // (e.g. preview domains under the same registrable host).
      if (callerHost === appHost || callerHost.endsWith(`.${appHost}`) || appHost.endsWith(`.${callerHost}`)) {
        origin = originHeader;
      }
    } catch {
      /* malformed Origin header — keep appOrigin */
    }
  }
  if (process.env.WEBAUTHN_ORIGIN) origin = process.env.WEBAUTHN_ORIGIN;

  const rpID = process.env.WEBAUTHN_RP_ID || new URL(origin).hostname;
  return { rpID, origin };
}

function transportsToArray(transports: string | null): any[] {
  return transports ? transports.split(",").filter(Boolean) : [];
}

export function registerPasskeyRoutes(app: Express, isAuthenticated: RequestHandler) {
  // ── Registration (must already be signed in) ────────────────────────────
  app.post("/api/auth/passkey/register/options", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const existing = await authStorage.listPasskeys(userId);
      const { rpID } = rpContext(req);

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userID: Buffer.from(userId),
        userName: user.email || userId,
        userDisplayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Synapse learner",
        attestationType: "none",
        excludeCredentials: existing.map((c) => ({
          id: c.credentialId,
          transports: transportsToArray(c.transports),
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

      (req.session as any).webauthnChallenge = {
        challenge: options.challenge,
        type: "registration",
        userId,
      };
      req.session.save(() => res.json(options));
    } catch (err: any) {
      console.error("[passkey] register options failed:", err);
      res.status(500).json({ message: err?.message || "Could not start passkey registration" });
    }
  });

  app.post("/api/auth/passkey/register/verify", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.claims.sub;
      const pending = (req.session as any).webauthnChallenge;
      delete (req.session as any).webauthnChallenge;
      if (!pending || pending.type !== "registration" || pending.userId !== userId) {
        return res.status(400).json({ message: "Registration challenge expired. Try again." });
      }

      const { rpID, origin } = rpContext(req);
      const verification = await verifyRegistrationResponse({
        response: req.body?.response,
        expectedChallenge: pending.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ message: "Passkey verification failed" });
      }

      const { credential } = verification.registrationInfo;
      const label =
        typeof req.body?.deviceLabel === "string" && req.body.deviceLabel.trim()
          ? req.body.deviceLabel.trim().slice(0, 60)
          : guessDeviceLabel(req.headers["user-agent"] as string | undefined);

      const saved = await authStorage.createPasskey({
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter ?? 0,
        transports: credential.transports?.length ? credential.transports.join(",") : null,
        deviceLabel: label,
      });

      console.log(`[passkey] registered credential ${saved.id} for user ${userId}`);
      res.json({ id: saved.id, deviceLabel: saved.deviceLabel });
    } catch (err: any) {
      console.error("[passkey] register verify failed:", err);
      res.status(400).json({ message: err?.message || "Passkey registration failed" });
    }
  });

  // ── Authentication (anonymous) ──────────────────────────────────────────
  app.post("/api/auth/passkey/login/options", async (req: any, res: any) => {
    try {
      const { rpID } = rpContext(req);
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

      let allowCredentials: any[] | undefined;
      let userId: string | undefined;

      if (email) {
        const user = await authStorage.getUserByEmail(email);
        if (user) {
          const creds = await authStorage.listPasskeys(user.id);
          if (creds.length > 0) {
            userId = user.id;
            allowCredentials = creds.map((c) => ({
              id: c.credentialId,
              transports: transportsToArray(c.transports),
            }));
          }
        }
      }

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials,
        userVerification: "preferred",
      });

      (req.session as any).webauthnChallenge = {
        challenge: options.challenge,
        type: "authentication",
        userId: userId || null,
      };
      req.session.save(() => res.json(options));
    } catch (err: any) {
      console.error("[passkey] login options failed:", err);
      res.status(500).json({ message: err?.message || "Could not start passkey sign-in" });
    }
  });

  app.post("/api/auth/passkey/login/verify", async (req: any, res: any) => {
    try {
      const pending = (req.session as any).webauthnChallenge;
      delete (req.session as any).webauthnChallenge;
      if (!pending || pending.type !== "authentication") {
        return res.status(400).json({ message: "Sign-in challenge expired. Try again." });
      }

      const credentialId = req.body?.response?.id;
      if (!credentialId) return res.status(400).json({ message: "Missing credential id" });

      const stored = await authStorage.findPasskeyByCredentialId(String(credentialId));
      if (!stored) return res.status(400).json({ message: "Unknown passkey for this site" });
      if (pending.userId && pending.userId !== stored.userId) {
        return res.status(400).json({ message: "Passkey does not belong to this account" });
      }

      const { rpID, origin } = rpContext(req);
      const verification = await verifyAuthenticationResponse({
        response: req.body.response,
        expectedChallenge: pending.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: stored.credentialId,
          publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
          counter: stored.counter,
          transports: transportsToArray(stored.transports),
        },
        requireUserVerification: false,
      });

      if (!verification.verified) {
        return res.status(401).json({ message: "Passkey sign-in failed" });
      }

      await authStorage.updatePasskeyUsage(stored.id, verification.authenticationInfo.newCounter);

      const user = await authStorage.getUser(stored.userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      req.session.regenerate((regenErr: any) => {
        if (regenErr) return res.status(500).json({ message: "Session error" });
        (req.session as any).userId = user.id;
        req.session.save(() =>
          res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName }),
        );
      });
    } catch (err: any) {
      console.error("[passkey] login verify failed:", err);
      res.status(400).json({ message: err?.message || "Passkey sign-in failed" });
    }
  });

  // ── Management ─────────────────────────────────────────────────────────
  app.get("/api/auth/passkeys", isAuthenticated, async (req: any, res: any) => {
    const creds = await authStorage.listPasskeys(req.user.claims.sub);
    res.json(
      creds.map((c) => ({
        id: c.id,
        deviceLabel: c.deviceLabel,
        createdAt: c.createdAt,
        lastUsedAt: c.lastUsedAt,
      })),
    );
  });

  app.delete("/api/auth/passkeys/:id", isAuthenticated, async (req: any, res: any) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    await authStorage.deletePasskey(req.user.claims.sub, id);
    res.json({ ok: true });
  });
}

function guessDeviceLabel(ua?: string): string {
  if (!ua) return "Passkey";
  if (/iPhone|iPad|iOS/i.test(ua)) return "Apple device";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Android/i.test(ua)) return "Android device";
  if (/Windows/i.test(ua)) return "Windows device";
  if (/Linux/i.test(ua)) return "Linux device";
  return "Passkey";
}
