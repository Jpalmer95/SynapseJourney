/**
 * Phase 9 — Adaptive Learning routes
 * Continue continuum, goals, prefs, timeline, course plans
 */
import type { Express, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { generateLessonOutline } from "./ai";
import { providerConfigFromProfile } from "../ai-providers";

const depthModes = ["survey", "standard", "deep", "speed_run", "goal"] as const;
const tutorModes = ["direct", "socratic", "feynman"] as const;
const contentViews = ["full", "skim"] as const;

const globalPrefsSchema = z.object({
  defaultDepthMode: z.enum(["survey", "standard", "deep", "speed_run"]).optional(),
  preferredTutorMode: z.enum(tutorModes).optional(),
  defaultContentView: z.enum(contentViews).optional(),
});

const topicPrefsSchema = z.object({
  depthMode: z.enum(["survey", "standard", "deep", "speed_run"]).optional(),
  tutorMode: z.enum(tutorModes).optional(),
  contentView: z.enum(contentViews).optional(),
});

const goalSchema = z.object({
  goalText: z.string().min(5).max(500),
  topicTitle: z.string().min(2).max(120).optional(),
  categoryId: z.number().int().positive().optional(),
  courseLength: z.enum(["quick", "standard", "deep"]).optional(),
  technicalLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  /** Force the agent-context section on/off; defaults to the isTechnicalGoal heuristic */
  includeAgentContext: z.boolean().optional(),
});

export function registerLearnRoutes(app: Express) {
  // ── Continue learning continuum ───────────────────────────────────────────
  app.get("/api/learn/continue", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const limit = Math.min(parseInt(String(req.query.limit || "8"), 10) || 8, 20);
      const items = await storage.getContinueLearning(userId, limit);
      res.json(items);
    } catch (error) {
      console.error("Error fetching continue learning:", error);
      res.status(500).json({ error: "Failed to fetch continue learning" });
    }
  });

  // Library: goals + Hermes-authored + in-progress (no need to have opened a unit)
  app.get("/api/learn/my-courses", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const limit = Math.min(parseInt(String(req.query.limit || "40"), 10) || 40, 100);
      const items = await storage.getMyCourses(userId, limit);
      res.json(items);
    } catch (error) {
      console.error("Error fetching my courses:", error);
      res.status(500).json({ error: "Failed to fetch my courses" });
    }
  });

  // ── Global learning prefs (profile) ───────────────────────────────────────
  app.get("/api/learn/prefs", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      res.json({
        defaultDepthMode: profile?.defaultDepthMode || "standard",
        preferredTutorMode: profile?.preferredTutorMode || "direct",
        defaultContentView: profile?.defaultContentView || "full",
        allowTestOut: profile?.allowTestOut ?? false,
        technicalLevel: profile?.technicalLevel || "beginner",
      });
    } catch (error) {
      console.error("Error fetching learning prefs:", error);
      res.status(500).json({ error: "Failed to fetch learning prefs" });
    }
  });

  app.put("/api/learn/prefs", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = globalPrefsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid prefs", details: parsed.error.flatten() });
      }
      const profile = await storage.createOrUpdateUserProfile(userId, parsed.data);
      res.json({
        defaultDepthMode: profile.defaultDepthMode || "standard",
        preferredTutorMode: profile.preferredTutorMode || "direct",
        defaultContentView: profile.defaultContentView || "full",
      });
    } catch (error) {
      console.error("Error updating learning prefs:", error);
      res.status(500).json({ error: "Failed to update learning prefs" });
    }
  });

  // ── Per-topic prefs ───────────────────────────────────────────────────────
  app.get("/api/learn/topics/:topicId/prefs", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.topicId, 10);
      if (Number.isNaN(topicId)) return res.status(400).json({ error: "Invalid topicId" });

      const profile = await storage.getUserProfile(userId);
      const topicPrefs = await storage.getTopicLearningPrefs(userId, topicId);

      res.json({
        depthMode: topicPrefs?.depthMode || profile?.defaultDepthMode || "standard",
        tutorMode: topicPrefs?.tutorMode || profile?.preferredTutorMode || "direct",
        contentView: topicPrefs?.contentView || profile?.defaultContentView || "full",
        isTopicOverride: !!topicPrefs,
      });
    } catch (error) {
      console.error("Error fetching topic prefs:", error);
      res.status(500).json({ error: "Failed to fetch topic prefs" });
    }
  });

  app.put("/api/learn/topics/:topicId/prefs", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.topicId, 10);
      if (Number.isNaN(topicId)) return res.status(400).json({ error: "Invalid topicId" });

      const parsed = topicPrefsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid prefs", details: parsed.error.flatten() });
      }

      const topic = await storage.getTopicById(topicId);
      if (!topic) return res.status(404).json({ error: "Topic not found" });

      const prefs = await storage.upsertTopicLearningPrefs(userId, topicId, parsed.data);
      await storage.recordTimelineEvent({
        userId,
        topicId,
        eventType: "mode_changed",
        metadata: parsed.data,
      });
      res.json(prefs);
    } catch (error) {
      console.error("Error updating topic prefs:", error);
      res.status(500).json({ error: "Failed to update topic prefs" });
    }
  });

  // ── Course plan + OER ─────────────────────────────────────────────────────
  app.get("/api/topics/:topicId/course-plan", async (req: any, res: Response) => {
    try {
      const topicId = parseInt(req.params.topicId, 10);
      if (Number.isNaN(topicId)) return res.status(400).json({ error: "Invalid topicId" });
      const plan = await storage.getLatestCoursePlan(topicId);
      if (!plan) return res.status(404).json({ error: "No course plan found" });
      res.json(plan);
    } catch (error) {
      console.error("Error fetching course plan:", error);
      res.status(500).json({ error: "Failed to fetch course plan" });
    }
  });

  // ── Timeline ──────────────────────────────────────────────────────────────
  app.get("/api/learn/timeline", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);
      const events = await storage.getUserTimeline(userId, limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching timeline:", error);
      res.status(500).json({ error: "Failed to fetch timeline" });
    }
  });

  // ── Goals ─────────────────────────────────────────────────────────────────
  app.get("/api/learn/goals", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const goals = await storage.getUserLearningGoals(userId, status);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ error: "Failed to fetch goals" });
    }
  });

  app.post("/api/learn/goal", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = goalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid goal", details: parsed.error.flatten() });
      }

      const { goalText, topicTitle, categoryId, courseLength, technicalLevel, includeAgentContext } = parsed.data;

      // Derive a short topic title from the goal if not provided
      const title =
        topicTitle ||
        (goalText.length > 80 ? goalText.slice(0, 77) + "…" : goalText).replace(/^I want to /i, "").replace(/^Learn /i, "");

      const description = `Goal-oriented path: ${goalText}`;

      // Prefer an existing topic with similar title when possible
      let topic = (await storage.getTopics()).find(
        (t) => t.title.toLowerCase() === title.toLowerCase()
      );

      if (!topic) {
        topic = await storage.createTopic({
          title: title.charAt(0).toUpperCase() + title.slice(1),
          description,
          categoryId: categoryId || null,
          difficulty: "beginner",
        } as any);
      }

      // BYOC: learner's Settings keys first (xAI / Gemini / OpenRouter / HF / Ollama / LM Studio), then platform pool
      const profile = await storage.getUserProfile(userId);
      const userConfig = providerConfigFromProfile(profile);

      // Agent Playbook: on when explicitly requested, or when the goal looks technical
      const { isTechnicalGoal } = await import("../course-planner");
      const wantAgentContext = includeAgentContext ?? isTechnicalGoal(goalText);

      // Ensure units exist — generate goal-intent outline if empty
      let units = await storage.getLessonUnits(topic.id);
      if (units.length === 0) {
        try {
          units = await generateLessonOutline(topic.id, topic.title, description, {
            learningIntent: "goal",
            goalDescription: goalText,
            courseLength: courseLength || "quick", // goals default to tight paths
            technicalLevel: technicalLevel || (profile?.technicalLevel as any) || "intermediate",
            includeAgentContext: wantAgentContext,
            createdByUserId: userId,
            userConfig,
          });
        } catch (genErr: any) {
          const msg = genErr?.message || String(genErr);
          if (msg.includes("BYOC_REQUIRED")) {
            return res.status(402).json({
              error: "BYOC_REQUIRED",
              message:
                "Platform free AI is disabled. Add API keys in Settings, or author this goal with Hermes Agent and upload via Personal Access Token (Settings → Hermes token + skill synapse-journey).",
            });
          }
          throw genErr;
        }
      }

      const plan = await storage.getLatestCoursePlan(topic.id);
      const milestones = units.slice(0, 8).map((u) => ({
        title: u.title,
        unitId: u.id,
        done: false,
      }));

      const goal = await storage.createLearningGoal({
        userId,
        goalText,
        topicId: topic.id,
        status: "active",
        planJson: plan?.planJson || null,
        milestones,
      });

      await storage.recordTimelineEvent({
        userId,
        topicId: topic.id,
        eventType: "goal_set",
        metadata: { goalId: goal.id, goalText },
      });

      await storage.upsertTopicLearningPrefs(userId, topic.id, {
        depthMode: "speed_run",
        contentView: "skim",
        tutorMode: "direct",
      });

      res.status(201).json({
        goal,
        topic,
        units,
        coursePlan: plan || null,
        nextUnit: units[0] || null,
        compute: {
          byoc: !!profile && !!(profile.xaiKey || profile.geminiKey || profile.openRouterKey || profile.huggingFaceToken || profile.ollamaUrl),
          preferredProvider: profile?.preferredAiProvider || null,
        },
      });
    } catch (error: any) {
      console.error("Error creating learning goal:", error);
      res.status(500).json({
        error: "Failed to create learning goal",
        message: error?.message || String(error),
      });
    }
  });

  app.patch("/api/learn/goals/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

      const body = z.object({
        status: z.enum(["active", "completed", "abandoned"]).optional(),
        milestones: z.any().optional(),
      }).safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: "Invalid body" });

      const updates: any = { ...body.data };
      if (body.data.status === "completed") {
        updates.completedAt = new Date();
      }

      const updated = await storage.updateLearningGoal(id, userId, updates);
      if (!updated) return res.status(404).json({ error: "Goal not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ error: "Failed to update goal" });
    }
  });

  // ── Resume touch + section mark ───────────────────────────────────────────
  app.post("/api/learn/resume", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const schema = z.object({
        topicId: z.number().int().positive(),
        unitId: z.number().int().positive(),
        lastSection: z.string().max(64).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      }

      await storage.startLesson(userId, parsed.data.unitId);
      if (parsed.data.lastSection) {
        await storage.updateLessonSection(userId, parsed.data.unitId, parsed.data.lastSection);
      }
      await storage.recordTimelineEvent({
        userId,
        topicId: parsed.data.topicId,
        eventType: "resumed",
        metadata: { unitId: parsed.data.unitId, lastSection: parsed.data.lastSection },
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("Error recording resume:", error);
      res.status(500).json({ error: "Failed to record resume" });
    }
  });

  // ── Safe intent re-plan (never wipes progress) ────────────────────────────
  // Changes presentation + optionally APPENDs units for deep mode.
  // Never deletes lesson units or progress rows.
  app.post("/api/learn/topics/:topicId/replan", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.topicId, 10);
      if (Number.isNaN(topicId)) return res.status(400).json({ error: "Invalid topicId" });

      const body = z.object({
        learningIntent: z.enum(["survey", "standard", "deep", "speed_run", "goal"]),
        goalDescription: z.string().max(500).optional(),
        expandUnits: z.boolean().optional().default(true),
      }).safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ error: "Invalid body", details: body.error.flatten() });
      }

      const topic = await storage.getTopicById(topicId);
      if (!topic) return res.status(404).json({ error: "Topic not found" });

      const { learningIntent, goalDescription, expandUnits } = body.data;
      const { planCourseWithAI } = await import("../course-planner");

      const plan = await planCourseWithAI(
        topic.title,
        topic.description || goalDescription || `Learning ${topic.title}`,
        { learningIntent, goalDescription }
      );

      await storage.saveCoursePlan({
        topicId,
        learningIntent,
        goalDescription: goalDescription || null,
        planJson: plan as any,
        createdByUserId: userId,
        version: 1,
      });

      // Presentation prefs — never delete progress
      const contentView =
        learningIntent === "survey" || learningIntent === "speed_run" || learningIntent === "goal"
          ? "skim"
          : "full";

      const prefs = await storage.upsertTopicLearningPrefs(userId, topicId, {
        depthMode: learningIntent === "goal" ? "speed_run" : learningIntent,
        contentView,
      });

      let addedUnits: any[] = [];
      const existing = await storage.getLessonUnits(topicId);

      // Soft expand: only for deep/standard and only if expandUnits — append titles that don't exist yet
      if (expandUnits && (learningIntent === "deep" || learningIntent === "standard") && plan.units?.length) {
        const existingTitles = new Set(existing.map((u) => u.title.toLowerCase().trim()));
        const byDiffIndex: Record<string, number> = {};
        for (const u of existing) {
          byDiffIndex[u.difficulty] = Math.max(byDiffIndex[u.difficulty] ?? -1, u.unitIndex);
        }

        for (const pu of plan.units) {
          const key = pu.title.toLowerCase().trim();
          if (existingTitles.has(key)) continue;
          // skip if a very similar title exists (substring)
          const similar = Array.from(existingTitles).some(
            (t) => t.includes(key) || key.includes(t)
          );
          if (similar) continue;

          const nextIndex = (byDiffIndex[pu.difficulty] ?? -1) + 1;
          byDiffIndex[pu.difficulty] = nextIndex;
          const created = await storage.createLessonUnit({
            topicId,
            difficulty: pu.difficulty,
            contentType: plan.contentType,
            unitIndex: nextIndex,
            title: pu.title,
            outline: `${pu.outline}${pu.tierName ? ` [${pu.tierName}]` : ""} (added via ${learningIntent} replan)`,
          });
          addedUnits.push(created);
          existingTitles.add(key);
        }
      }

      // Presentation filter (client uses this to hide tiers without deleting)
      const presentation = {
        learningIntent,
        contentView,
        quizFirst: learningIntent === "speed_run" || learningIntent === "goal",
        // speed_run/survey: still show all units but prefer lower tiers first; never hide completed
        preferDifficulties:
          learningIntent === "speed_run" || learningIntent === "goal"
            ? ["beginner", "intermediate"]
            : learningIntent === "survey"
            ? ["beginner", "intermediate", "advanced"]
            : ["beginner", "intermediate", "advanced", "nextgen"],
        softCapUnits:
          learningIntent === "speed_run" ? 8 : learningIntent === "survey" ? 12 : null,
      };

      await storage.recordTimelineEvent({
        userId,
        topicId,
        eventType: "mode_changed",
        metadata: {
          learningIntent,
          replan: true,
          addedUnits: addedUnits.length,
          preservedProgress: true,
        },
      });

      const units = await storage.getLessonUnits(topicId);
      res.json({
        plan,
        prefs,
        presentation,
        units,
        addedUnitCount: addedUnits.length,
        preservedProgress: true,
        message:
          addedUnits.length > 0
            ? `Reshaped for ${learningIntent}: added ${addedUnits.length} new units. Your progress is intact.`
            : `Switched to ${learningIntent} mode. Your progress is intact — no units were removed.`,
      });
    } catch (error) {
      console.error("Error re-planning topic:", error);
      res.status(500).json({ error: "Failed to re-plan topic" });
    }
  });

  // ── Goal milestone toggle ─────────────────────────────────────────────────
  app.post("/api/learn/goals/:id/milestones/:index", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id, 10);
      const index = parseInt(req.params.index, 10);
      if (Number.isNaN(id) || Number.isNaN(index) || index < 0) {
        return res.status(400).json({ error: "Invalid id/index" });
      }
      const done = req.body?.done !== false;

      const goals = await storage.getUserLearningGoals(userId);
      const goal = goals.find((g) => g.id === id);
      if (!goal) return res.status(404).json({ error: "Goal not found" });

      const milestones = Array.isArray(goal.milestones) ? [...(goal.milestones as any[])] : [];
      if (!milestones[index]) return res.status(404).json({ error: "Milestone not found" });
      milestones[index] = { ...milestones[index], done };

      const allDone = milestones.length > 0 && milestones.every((m: any) => m.done);
      const updated = await storage.updateLearningGoal(id, userId, {
        milestones,
        ...(allDone ? { status: "completed", completedAt: new Date() } : {}),
      } as any);

      res.json({ goal: updated, allDone });
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  // Active goal for a topic
  app.get("/api/learn/topics/:topicId/goal", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.topicId, 10);
      if (Number.isNaN(topicId)) return res.status(400).json({ error: "Invalid topicId" });
      const goals = await storage.getUserLearningGoals(userId, "active");
      const goal = goals.find((g) => g.topicId === topicId) || null;
      res.json({ goal });
    } catch (error) {
      console.error("Error fetching topic goal:", error);
      res.status(500).json({ error: "Failed to fetch goal" });
    }
  });

  // Course posters CRUD helpers
  app.get("/api/learn/posters", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const posters = await storage.getUserCoursePosters(userId);
      res.json(posters);
    } catch (error) {
      console.error("Error listing posters:", error);
      res.status(500).json({ error: "Failed to list posters" });
    }
  });

  app.get("/api/learn/topics/:topicId/poster", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.topicId, 10);
      if (Number.isNaN(topicId)) return res.status(400).json({ error: "Invalid topicId" });
      const poster = await storage.getCoursePoster(userId, topicId);
      if (!poster) return res.status(404).json({ error: "No poster yet" });
      res.json(poster);
    } catch (error) {
      console.error("Error fetching poster:", error);
      res.status(500).json({ error: "Failed to fetch poster" });
    }
  });

  // ── Personal access tokens (Hermes BYOC bridge) ───────────────────────────
  app.get("/api/learn/tokens", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const tokens = await storage.listUserAccessTokens(userId);
      res.json(tokens.map((t) => ({
        id: t.id,
        name: t.name,
        tokenPrefix: t.tokenPrefix,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
      })));
    } catch (error) {
      console.error("Error listing tokens:", error);
      res.status(500).json({ error: "Failed to list tokens" });
    }
  });

  app.post("/api/learn/tokens", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const name = (req.body?.name || "Hermes").toString().slice(0, 64);
      const crypto = await import("crypto");
      const raw = `sj_${crypto.randomBytes(24).toString("base64url")}`;
      const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
      const tokenPrefix = raw.slice(0, 12);

      const row = await storage.createUserAccessToken({
        userId,
        name,
        tokenPrefix,
        tokenHash,
      });

      // Return full token ONCE
      res.status(201).json({
        id: row.id,
        name: row.name,
        token: raw,
        tokenPrefix,
        createdAt: row.createdAt,
        message: "Copy this token now — it will not be shown again. Use: Authorization: Bearer <token>",
      });
    } catch (error) {
      console.error("Error creating token:", error);
      res.status(500).json({ error: "Failed to create token" });
    }
  });

  app.delete("/api/learn/tokens/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
      const ok = await storage.revokeUserAccessToken(id, userId);
      if (!ok) return res.status(404).json({ error: "Token not found" });
      res.json({ ok: true });
    } catch (error) {
      console.error("Error revoking token:", error);
      res.status(500).json({ error: "Failed to revoke token" });
    }
  });

  /**
   * Hermes / external agent course ingest — NO server-side AI.
   * Author content with Hermes (your Grok/Gemini/etc subscription compute), then upload.
   */
  app.post("/api/learn/ingest", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const schema = z.object({
        goalText: z.string().min(3).max(1000).optional(),
        topic: z.object({
          title: z.string().min(2).max(200),
          description: z.string().max(2000).optional(),
          categoryId: z.number().int().positive().optional().nullable(),
          difficulty: z.enum(["beginner", "intermediate", "advanced", "nextgen"]).optional(),
        }),
        learningIntent: z.enum(["survey", "standard", "deep", "speed_run", "goal"]).optional(),
        plan: z.object({
          contentType: z.string().optional(),
          scope: z.string().optional(),
          rationale: z.string().optional(),
          recommendedOER: z.array(z.object({
            name: z.string(),
            url: z.string(),
            reason: z.string().optional(),
          })).optional(),
          units: z.array(z.object({
            title: z.string(),
            outline: z.string().optional(),
            difficulty: z.enum(["beginner", "intermediate", "advanced", "nextgen"]).optional(),
            tierName: z.string().optional(),
          })).optional(),
        }).optional(),
        units: z.array(z.object({
          title: z.string().min(1).max(200),
          difficulty: z.enum(["beginner", "intermediate", "advanced", "nextgen"]).default("beginner"),
          outline: z.string().max(4000).optional(),
          unitIndex: z.number().int().min(0).optional(),
          contentJson: z.any().optional(), // full lesson content if authored offline
        })).min(1).max(80),
        createGoal: z.boolean().optional().default(true),
        source: z.string().max(64).optional(), // e.g. "hermes"
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid ingest payload", details: parsed.error.flatten() });
      }

      const body = parsed.data;
      const title = body.topic.title;
      let topic = (await storage.getTopics()).find((t) => t.title.toLowerCase() === title.toLowerCase());
      if (!topic) {
        topic = await storage.createTopic({
          title,
          description: body.topic.description || body.goalText || `Hermes-authored course: ${title}`,
          categoryId: body.topic.categoryId || null,
          difficulty: body.topic.difficulty || "beginner",
        } as any);
      }

      // Create units (skip exact title matches already present)
      const existing = await storage.getLessonUnits(topic.id);
      const existingTitles = new Set(existing.map((u) => u.title.toLowerCase().trim()));
      const createdUnits: any[] = [];
      const byDiffIndex: Record<string, number> = {};
      for (const u of existing) {
        byDiffIndex[u.difficulty] = Math.max(byDiffIndex[u.difficulty] ?? -1, u.unitIndex);
      }

      for (let i = 0; i < body.units.length; i++) {
        const u = body.units[i];
        const key = u.title.toLowerCase().trim();
        if (existingTitles.has(key)) {
          const match = existing.find((e) => e.title.toLowerCase().trim() === key);
          if (match && u.contentJson && !match.contentJson) {
            await storage.updateLessonContent(match.id, u.contentJson);
          }
          continue;
        }
        const difficulty = u.difficulty || "beginner";
        const nextIndex = u.unitIndex ?? ((byDiffIndex[difficulty] ?? -1) + 1);
        byDiffIndex[difficulty] = nextIndex;
        const created = await storage.createLessonUnit({
          topicId: topic.id,
          difficulty,
          contentType: body.plan?.contentType || "standard",
          unitIndex: nextIndex,
          title: u.title,
          outline: u.outline || null,
        });
        if (u.contentJson) {
          await storage.updateLessonContent(created.id, u.contentJson);
        }
        createdUnits.push(created);
        existingTitles.add(key);
      }

      if (body.plan) {
        await storage.saveCoursePlan({
          topicId: topic.id,
          learningIntent: body.learningIntent || (body.goalText ? "goal" : "standard"),
          goalDescription: body.goalText || null,
          planJson: {
            ...body.plan,
            units: body.units.map((u) => ({
              title: u.title,
              outline: u.outline || "",
              difficulty: u.difficulty || "beginner",
            })),
            source: body.source || "ingest",
          } as any,
          createdByUserId: userId,
          version: 1,
        });
      }

      await storage.upsertTopicLearningPrefs(userId, topic.id, {
        depthMode: body.learningIntent === "goal" || body.goalText ? "speed_run" : (body.learningIntent || "standard"),
        contentView: body.goalText ? "skim" : "full",
      });

      let goal = null;
      const allUnits = await storage.getLessonUnits(topic.id);
      if (body.createGoal && body.goalText) {
        goal = await storage.createLearningGoal({
          userId,
          goalText: body.goalText,
          topicId: topic.id,
          status: "active",
          planJson: body.plan || null,
          milestones: allUnits.slice(0, 8).map((u) => ({ title: u.title, unitId: u.id, done: false })),
        });
        await storage.recordTimelineEvent({
          userId,
          topicId: topic.id,
          eventType: "goal_set",
          metadata: { goalId: goal.id, source: body.source || "ingest", hermes: true },
        });
      } else {
        await storage.recordTimelineEvent({
          userId,
          topicId: topic.id,
          eventType: "started",
          metadata: { source: body.source || "ingest", addedUnits: createdUnits.length },
        });
      }

      res.status(201).json({
        topic,
        unitsCreated: createdUnits.length,
        unitsTotal: allUnits.length,
        goal,
        message: "Ingested without platform AI — content authored externally (Hermes/BYOC).",
      });
    } catch (error: any) {
      console.error("Error ingesting course:", error);
      res.status(500).json({ error: "Failed to ingest course", message: error?.message || String(error) });
    }
  });

  // ── Custom course: any subject, chosen length + level ───────────────────
  const customCourseSchema = z.object({
    subject: z.string().min(3).max(200),
    courseLength: z.enum(["quick", "standard", "deep"]).default("standard"),
    technicalLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]).default("intermediate"),
    learningIntent: z.enum(["survey", "standard", "deep", "speed_run"]).default("standard"),
    categoryId: z.number().int().positive().optional(),
  });

  app.post("/api/learn/custom-course", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = customCourseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }
      const { subject, courseLength, technicalLevel, learningIntent, categoryId } = parsed.data;

      const profile = await storage.getUserProfile(userId);
      const userConfig = providerConfigFromProfile(profile);

      // Reuse an existing topic with the same title if present
      let topic = (await storage.getTopics()).find(
        (t) => t.title.toLowerCase() === subject.trim().toLowerCase()
      );
      if (!topic) {
        topic = await storage.createTopic({
          title: subject.trim(),
          description: `Custom course on ${subject.trim()} (${courseLength}, ${technicalLevel})`,
          categoryId: categoryId || null,
          difficulty: "beginner",
        } as any);
      }

      let units = await storage.getLessonUnits(topic.id);
      if (units.length === 0) {
        try {
          units = await generateLessonOutline(topic.id, topic.title, topic.description || "", {
            learningIntent,
            courseLength,
            technicalLevel,
            createdByUserId: userId,
            userConfig,
          });
        } catch (genErr: any) {
          const msg = genErr?.message || String(genErr);
          if (msg.includes("BYOC_REQUIRED")) {
            return res.status(402).json({
              error: "BYOC_REQUIRED",
              message:
                "Platform free AI is disabled. Add API keys in Settings, or author this course with Hermes Agent and upload via Personal Access Token.",
            });
          }
          throw genErr;
        }
      }

      await storage.upsertTopicLearningPrefs(userId, topic.id, {
        depthMode: learningIntent === "speed_run" ? "speed_run" : learningIntent,
        contentView: "full",
      });
      await storage.recordTimelineEvent({
        userId,
        topicId: topic.id,
        eventType: "started",
        metadata: { source: "custom-course", courseLength, technicalLevel },
      });

      const plan = await storage.getLatestCoursePlan(topic.id);
      res.status(201).json({ topic, units, coursePlan: plan || null, nextUnit: units[0] || null });
    } catch (error: any) {
      console.error("Error creating custom course:", error);
      res.status(500).json({ error: "Failed to create custom course", message: error?.message || String(error) });
    }
  });

  // ── Explore: 10 personalized subject suggestions ────────────────────────
  app.post("/api/learn/explore", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      const userConfig = providerConfigFromProfile(profile);

      // Gather context for personalization
      const goals = await storage.getUserLearningGoals(userId);
      const enabledCatIds = await storage.getEnabledCategories(userId).catch(() => [] as number[]);
      const allCats = await storage.getCategories().catch(() => [] as any[]);
      const goalTitles = goals.slice(0, 5).map((g: any) => g.goalText);
      const catNames = allCats
        .filter((c: any) => enabledCatIds.includes(c.id))
        .map((c: any) => c.name)
        .filter(Boolean)
        .slice(0, 10);
      const techLevel = profile?.technicalLevel || "intermediate";

      const prompt = `You are a learning curator for an AI-enhanced learning platform.

Learner context:
- Technical level: ${techLevel}
- Active goals: ${goalTitles.length > 0 ? goalTitles.join("; ") : "(none yet)"}
- Favorite categories: ${catNames.length > 0 ? catNames.join(", ") : "(no preference set — mix broadly)"}

Suggest exactly 10 subjects this learner is likely to find fascinating and useful RIGHT NOW.
Mix: 3 adjacent to their stated goals/categories, 3 cross-disciplinary bridges (connect two of their interests in an unexpected way), 2 practical skills with immediate payoff, 2 wild-card topics outside their bubble that genuinely expand perspective.
Calibrate to their technical level — not too basic, not overwhelming.

Respond with ONLY a JSON array of 10 objects:
[{"title": "Subject name (concise)", "hook": "One sentence: why this is worth their time", "category": "Broad area", "difficulty": "beginner|intermediate|advanced"}]`;

      let suggestions: { title: string; hook: string; category: string; difficulty: string }[] = [];
      try {
        const { generateByokOrPool } = await import("../ai-providers");
        const result = await generateByokOrPool(
          [{ role: "user", content: prompt }],
          userConfig,
          { responseFormat: "json", temperature: 0.9 }
        );
        const parsed = JSON.parse(result.content || "[]");
        if (Array.isArray(parsed)) {
          suggestions = parsed
            .filter((s: any) => s && typeof s.title === "string")
            .slice(0, 10)
            .map((s: any) => ({
              title: String(s.title).slice(0, 120),
              hook: String(s.hook || "").slice(0, 200),
              category: String(s.category || "General").slice(0, 60),
              difficulty: ["beginner", "intermediate", "advanced"].includes(s.difficulty) ? s.difficulty : "intermediate",
            }));
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes("BYOC_REQUIRED")) {
          return res.status(402).json({
            error: "BYOC_REQUIRED",
            message: "Add an AI key in Settings (or LM Studio URL) to get personalized subject suggestions.",
          });
        }
        console.warn("[Explore] AI suggestions failed, using fallback:", msg);
      }

      // Fallback when AI unavailable/failed: category-derived generic suggestions
      if (suggestions.length === 0) {
        const fallback = [
          { title: "How large language models actually work", hook: "Demystify the tools you use every day.", category: "AI", difficulty: "intermediate" },
          { title: "Systems thinking for complex problems", hook: "A mental toolkit that transfers to every field.", category: "Thinking", difficulty: "beginner" },
          { title: "The science of learning itself", hook: "Learn faster forever — spaced repetition, retrieval, interleaving.", category: "Meta-learning", difficulty: "beginner" },
          { title: "Personal knowledge management", hook: "Build a second brain that compounds.", category: "Productivity", difficulty: "beginner" },
          { title: "Statistics intuition", hook: "Spot bad arguments and make better bets.", category: "Math", difficulty: "intermediate" },
          { title: "Design fundamentals for non-designers", hook: "Make everything you ship look intentional.", category: "Design", difficulty: "beginner" },
          { title: "The economics of attention", hook: "Understand the market you're living in.", category: "Economics", difficulty: "intermediate" },
          { title: "Energy systems and the grid", hook: "The invisible infrastructure behind modern life.", category: "Engineering", difficulty: "intermediate" },
          { title: "Writing clearly", hook: "The highest-leverage professional skill.", category: "Communication", difficulty: "beginner" },
          { title: "Astrobiology: life in the universe", hook: "The biggest open question there is.", category: "Science", difficulty: "beginner" },
        ];
        suggestions = fallback;
      }

      res.json({ suggestions, personalized: catNames.length > 0 || goalTitles.length > 0 });
    } catch (error: any) {
      console.error("Error generating explore suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions", message: error?.message || String(error) });
    }
  });
}
