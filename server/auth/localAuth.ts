import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "../replit_integrations/auth/storage";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "../storage";
import { sendPasswordResetEmail } from "../email";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
      sameSite: "lax",
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Populate req.user from session OR Bearer PAT (sj_...)
  app.use(async (req: any, _res, next) => {
    if (req.session?.userId) {
      req.user = { claims: { sub: req.session.userId }, authMethod: "session" };
      return next();
    }

    const header = req.headers.authorization as string | undefined;
    if (header?.startsWith("Bearer ")) {
      const token = header.slice(7).trim();
      if (token.startsWith("sj_")) {
        try {
          const hash = crypto.createHash("sha256").update(token).digest("hex");
          const row = await storage.findUserAccessTokenByHash(hash);
          if (row) {
            req.user = { claims: { sub: row.userId }, authMethod: "pat", tokenId: row.id };
            storage.touchUserAccessToken(row.id).catch(() => {});
          }
        } catch {
          // isAuthenticated will 401 if unresolved
        }
      }
    }
    next();
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await authStorage.createLocalUser({
        email,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
      });

      (req.session as any).userId = user.id;
      req.session.save(() => {
        res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
      });
    } catch (error: any) {
      console.error("[Auth] Register error:", error);
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      const user = await authStorage.getUserByEmail(email);
      if (!user?.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      (req.session as any).userId = user.id;
      req.session.save(() => {
        res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
      });
    } catch (error: any) {
      console.error("[Auth] Login error:", error);
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });

  // Forgot password: generate a reset token and email a link (1h expiry).
  // Always returns the same generic message to avoid account enumeration.
  app.post("/api/auth/forgot-password", async (req: any, res: any) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }
    try {
      const user = await authStorage.getUserByEmail(email);
      if (user?.passwordHash) {
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        // Invalidate any previous outstanding tokens for this user (single active link).
        await authStorage.clearPasswordResetTokensForUser(user.id);
        await authStorage.createPasswordResetToken(user.id, tokenHash, expiresAt);
        const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
        const resetUrl = `${baseUrl}/reset-password?token=${token}`;
        // user.email may be null on some legacy rows; email is the normalized submitted address.
        await sendPasswordResetEmail(email, resetUrl);
      }
    } catch (error) {
      console.error("[Auth] forgot-password error:", error);
    }
    return res.json({
      message: "If an account exists for that email, a password reset link has been sent.",
    });
  });

  // Reset password using a token from the emailed link.
  app.post("/api/auth/reset-password", async (req: any, res: any) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!token) {
      return res.status(400).json({ message: "Reset token required" });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    try {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const record = await authStorage.findPasswordResetTokenByHash(tokenHash);
      if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
        return res
          .status(400)
          .json({ message: "This reset link is invalid or has expired. Please request a new one." });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      await authStorage.updatePasswordHash(record.userId, passwordHash);
      await authStorage.markPasswordResetTokenUsed(record.id);
      await authStorage.clearPasswordResetTokensForUser(record.userId);
      return res.json({ message: "Password reset successful. You can now log in." });
    } catch (error) {
      console.error("[Auth] reset-password error:", error);
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session?.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/logout", (req, res) => {
    req.session?.destroy(() => {
      res.redirect("/");
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  if (req.user?.claims?.sub || req.session?.userId) {
    if (!req.user && req.session?.userId) {
      req.user = { claims: { sub: req.session.userId }, authMethod: "session" };
    }
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

export const optionalAuth: RequestHandler = async (req: any, _res, next) => {
  if (req.session?.userId && !req.user) {
    req.user = { claims: { sub: req.session.userId }, authMethod: "session" };
  }
  return next();
};
