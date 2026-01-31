import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { storage } from "../../storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

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
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
  
  // Auto-enroll user in all default content
  await autoEnrollUserInDefaults(claims["sub"]);
}

async function autoEnrollUserInDefaults(userId: string) {
  console.log(`[AutoEnroll] Starting auto-enrollment for user ${userId}`);
  
  try {
    // Check if user already has pathway enrollments
    const existingPathways = await storage.getUserPathways(userId);
    console.log(`[AutoEnroll] User ${userId} has ${existingPathways.length} existing pathways`);
    
    // If no pathways enrolled, enroll in all available pathways
    if (existingPathways.length === 0) {
      const allPathways = await storage.getPathways();
      console.log(`[AutoEnroll] Found ${allPathways.length} pathways to enroll user in`);
      
      for (const pathway of allPathways) {
        try {
          await storage.enrollInPathway(userId, pathway.id);
          console.log(`[AutoEnroll] Enrolled user ${userId} in pathway ${pathway.id} (${pathway.name})`);
        } catch (pathwayError) {
          console.error(`[AutoEnroll] Failed to enroll in pathway ${pathway.id}:`, pathwayError);
        }
      }
      console.log(`[AutoEnroll] Completed pathway enrollment for user ${userId}`);
    }
    
    // Check if user has any category preferences
    const existingPrefs = await storage.getCategoryPreferences(userId);
    console.log(`[AutoEnroll] User ${userId} has ${existingPrefs.length} existing category preferences`);
    
    // If no preferences, explicitly enable all categories
    if (existingPrefs.length === 0) {
      const allCategories = await storage.getCategories();
      console.log(`[AutoEnroll] Found ${allCategories.length} categories to enable for user`);
      
      for (const category of allCategories) {
        try {
          await storage.setCategoryPreference(userId, category.id, true);
          console.log(`[AutoEnroll] Enabled category ${category.id} (${category.name}) for user ${userId}`);
        } catch (categoryError) {
          console.error(`[AutoEnroll] Failed to enable category ${category.id}:`, categoryError);
        }
      }
      console.log(`[AutoEnroll] Completed category preference setup for user ${userId}`);
    }
    
    console.log(`[AutoEnroll] Auto-enrollment complete for user ${userId}`);
  } catch (error) {
    console.error(`[AutoEnroll] Critical error auto-enrolling user ${userId}:`, error);
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
