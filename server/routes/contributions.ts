// server/routes/contributions.ts — Content versioning, reviews, BYOK keys, freshness
import type { Express, Request, Response } from "express";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdminUser } from "./shared";

// ── Key Encryption (AES-256-GCM) ──────────────────────────────────────────
// API keys are encrypted at rest. The encryption key comes from env var.
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || "default-dev-key-change-in-production!32"; // Must be 32 bytes for AES-256
const IV_LENGTH = 16;

function encrypt(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"));
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(encryptedStr: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedStr.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ── Validation Schemas ────────────────────────────────────────────────────
const submitVersionSchema = z.object({
  unitId: z.number().int().positive(),
  contentJson: z.any(),
  changeSummary: z.string().min(1).max(500).optional(),
  modelUsed: z.string().optional(),
});

const submitReviewSchema = z.object({
  versionId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5).optional(),
  feedback: z.string().max(2000).optional(),
  approved: z.boolean(),
});

const saveApiKeySchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini", "xai", "openrouter", "huggingface"]),
  apiKey: z.string().min(5).max(200),
  keyLabel: z.string().max(100).optional(),
});

export function registerContributionsRoutes(app: Express) {
  // ── Semantic Search (public — no auth required) ─────────────────────────
  app.get("/api/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const threshold = parseFloat(req.query.threshold as string) || 0.3;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!query || query.length < 2) {
        return res.json({ topics: [], lessons: [] });
      }

      // Use trigram search for now (vector search needs embedding generation)
      // In production, you'd call an embedding API here first
      const [topics, textMatches] = await Promise.all([
        storage.searchTopicsTrgm(query, limit),
        // Fallback: basic text filter for lessons
        (async () => {
          const allTopics = await storage.getTopics();
          const matching = allTopics.filter(t =>
            t.title.toLowerCase().includes(query.toLowerCase()) ||
            t.description.toLowerCase().includes(query.toLowerCase())
          );
          return matching.slice(0, limit);
        })()
      ]);

      // Merge and deduplicate results
      const seen = new Set<number>();
      const merged = [...topics];
      for (const t of textMatches) {
        if (!seen.has(t.id)) {
          merged.push(t);
          seen.add(t.id);
        }
      }
      // Set seen for topics too
      topics.forEach(t => seen.add(t.id));

      res.json({ topics: merged.slice(0, limit), lessons: [] });
    } catch (error) {
      console.error("Error searching:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // ── Content Versioning (auth required) ───────────────────────────────────
  // Submit an improvement to a lesson unit
  app.post("/api/contributions/submit", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const validation = submitVersionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.flatten() });
      }

      const { unitId, contentJson, changeSummary, modelUsed } = validation.data;

      // Verify unit exists
      const unit = await storage.getLessonUnit(unitId);
      if (!unit) {
        return res.status(404).json({ error: "Lesson unit not found" });
      }

      // Get next version number
      const existing = await storage.getContentVersionsForUnit(unitId);
      const versionNumber = existing.length > 0
        ? Math.max(...existing.map(v => v.versionNumber)) + 1
        : 2; // version 1 is the original content

      // Auto-approve for admin users (Verified tier)
      const isAdmin = await isAdminUser(userId);
      const status = isAdmin ? "active" : "pending_review";

      const version = await storage.createContentVersion({
        unitId,
        versionNumber,
        authorId: userId,
        authorType: "human",
        contentJson,
        changeSummary: changeSummary || "Content improvement",
        modelUsed: modelUsed || null,
        status,
      });

      // If admin auto-approved, apply the content immediately
      if (status === "active") {
        await storage.approveContentVersion(version.id);
      }

      res.status(201).json({
        version,
        autoApproved: isAdmin,
        message: isAdmin
          ? "Content updated immediately (admin auto-approval)"
          : "Submitted for review. Needs 2 approvals before going live.",
      });
    } catch (error) {
      console.error("Error submitting version:", error);
      res.status(500).json({ error: "Failed to submit content" });
    }
  });

  // Get version history for a unit (public read)
  app.get("/api/contributions/history/:unitId", async (req: Request, res: Response) => {
    try {
      const unitId = parseInt(req.params.unitId);
      if (isNaN(unitId)) return res.status(400).json({ error: "Invalid unit ID" });

      const versions = await storage.getContentVersionsForUnit(unitId);
      // Return only approved/active versions to public, hide pending
      const publicVersions = versions.filter(v => v.status === "active" || v.status === "approved");
      res.json(publicVersions);
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ error: "Failed to fetch version history" });
    }
  });

  // Get pending contributions (admin/reviewers only)
  app.get("/api/contributions/pending", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const isAdmin = await isAdminUser(userId);
      if (!isAdmin) {
        return res.status(403).json({ error: "Only admins can view pending contributions" });
      }
      const pending = await storage.getPendingContentVersions();
      res.json(pending);
    } catch (error) {
      console.error("Error fetching pending:", error);
      res.status(500).json({ error: "Failed to fetch pending contributions" });
    }
  });

  // Get my contributions
  app.get("/api/contributions/mine", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const versions = await storage.getUserContentVersions(userId);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching contributions:", error);
      res.status(500).json({ error: "Failed to fetch contributions" });
    }
  });

  // ── Pool Status & BYOK Status ───────────────────────────────────────────
  // Get community pool status (public for transparency)
  app.get("/api/pool/status", async (req: Request, res: Response) => {
    try {
      const usage = await storage.getPoolUsageToday();
      const available = await storage.isPoolAvailable();
      const maxUnitsPerDay = parseInt(process.env.POOL_MAX_UNITS_PER_DAY || '10', 10);
      const dailyBudgetCents = parseInt(process.env.POOL_DAILY_BUDGET || '50', 10) * 100;
      res.json({
        available,
        unitsGeneratedToday: usage.unitsGenerated,
        maxUnitsPerDay,
        budgetRemainingCents: usage.remainingBudgetCents,
        dailyBudgetCents,
        message: available ? "Community pool is available" : "Pool exhausted until tomorrow. Connect your own API key in Settings.",
      });
    } catch (error) {
      console.error("Error fetching pool status:", error);
      res.status(500).json({ error: "Failed to fetch pool status" });
    }
  });

  // Get BYOK status for current user (auth required)
  app.get("/api/byok/status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const keys = await storage.getUserApiKeys(userId);
      const profile = await storage.getUserProfile(userId);
      const activeKeys = keys.filter(k => k.isActive).map(k => k.provider);
      res.json({
        hasByok: activeKeys.length > 0 || !!(profile?.xaiKey || profile?.anthropicKey || profile?.geminiKey || profile?.openRouterKey || profile?.huggingFaceToken || profile?.ollamaUrl),
        activeProviders: activeKeys,
        profileProviders: [
          profile?.xaiKey && "xai",
          profile?.anthropicKey && "anthropic",
          profile?.geminiKey && "gemini",
          profile?.openRouterKey && "openrouter",
          profile?.huggingFaceToken && "huggingface",
          profile?.ollamaUrl && "ollama",
        ].filter(Boolean),
      });
    } catch (error) {
      console.error("Error fetching BYOK status:", error);
      res.status(500).json({ error: "Failed to fetch BYOK status" });
    }
  });

  // ── Content Reviews (auth required) ──────────────────────────────────────
  app.post("/api/contributions/review", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const validation = submitReviewSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.flatten() });
      }

      const { versionId, rating, feedback, approved } = validation.data;

      // Verify version exists
      const version = await storage.getContentVersionById(versionId);
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }

      // Can't review own content
      if (version.authorId === userId) {
        return res.status(400).json({ error: "Cannot review your own contribution" });
      }

      const review = await storage.createContentReview({
        versionId,
        reviewerId: userId,
        reviewerType: "human",
        rating: rating ?? null,
        feedback: feedback ?? null,
        approved,
      });

      // Check if we've reached approval threshold (2 for new contributors)
      const approvalCount = await storage.countApprovalsForVersion(versionId);
      let autoActivated = false;
      if (approved && approvalCount >= 2 && version.status === "pending_review") {
        await storage.approveContentVersion(versionId);
        autoActivated = true;
      }

      res.status(201).json({
        review,
        approvalCount,
        autoActivated,
        message: autoActivated
          ? "Version approved and activated!"
          : `Review submitted. ${2 - approvalCount} more approval(s) needed.`,
      });
    } catch (error) {
      console.error("Error submitting review:", error);
      res.status(500).json({ error: "Failed to submit review" });
    }
  });

  // Get reviews for a version
  app.get("/api/contributions/reviews/:versionId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const versionId = parseInt(req.params.versionId);
      if (isNaN(versionId)) return res.status(400).json({ error: "Invalid version ID" });
      const reviews = await storage.getReviewsForVersion(versionId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // ── BYOK API Keys (auth required) ────────────────────────────────────────
  // List user's API keys (redacted)
  app.get("/api/byok/keys", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const keys = await storage.getUserApiKeys(userId);
      res.json(keys);
    } catch (error) {
      console.error("Error fetching keys:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  // Save/update an API key
  app.post("/api/byok/keys", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const validation = saveApiKeySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.flatten() });
      }

      const { provider, apiKey, keyLabel } = validation.data;

      // Encrypt the key before storing
      const encrypted = encrypt(apiKey);
      const saved = await storage.saveUserApiKey(userId, provider, encrypted, keyLabel);

      res.status(201).json({
        id: saved.id,
        provider: saved.provider,
        keyLabel: saved.keyLabel,
        message: `${provider} API key saved securely. You can now generate content using your own key.`,
      });
    } catch (error) {
      console.error("Error saving key:", error);
      res.status(500).json({ error: "Failed to save API key" });
    }
  });

  // Delete (deactivate) an API key
  app.delete("/api/byok/keys/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const keyId = parseInt(req.params.id);
      if (isNaN(keyId)) return res.status(400).json({ error: "Invalid key ID" });

      await storage.deactivateUserApiKey(keyId, userId);
      res.json({ message: "API key deactivated" });
    } catch (error) {
      console.error("Error deactivating key:", error);
      res.status(500).json({ error: "Failed to deactivate key" });
    }
  });

  // ── Knowledge Freshness ──────────────────────────────────────────────────
  // Get freshness badge for a unit (public read)
  app.get("/api/units/:unitId/freshness", async (req: Request, res: Response) => {
    try {
      const unitId = parseInt(req.params.unitId);
      if (isNaN(unitId)) return res.status(400).json({ error: "Invalid unit ID" });

      const badge = await storage.getUnitFreshnessBadge(unitId);
      res.json(badge);
    } catch (error) {
      console.error("Error fetching freshness:", error);
      res.status(500).json({ error: "Failed to fetch freshness status" });
    }
  });

  // Verify a unit (auth required — marks as "verified today")
  app.post("/api/units/:unitId/verify", isAuthenticated, async (req: any, res: Response) => {
    try {
      const unitId = parseInt(req.params.unitId);
      if (isNaN(unitId)) return res.status(400).json({ error: "Invalid unit ID" });

      const updated = await storage.verifyUnitFreshness(unitId);
      res.json({ message: "Unit verified", unit: updated });
    } catch (error) {
      console.error("Error verifying unit:", error);
      res.status(500).json({ error: "Failed to verify unit" });
    }
  });
}
