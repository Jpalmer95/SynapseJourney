/**
 * Phase 9 — Adaptive Learning routes
 * Continue continuum, goals, prefs, timeline, course plans
 */
import type { Express, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { generateLessonOutline } from "./ai";

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

      const { goalText, topicTitle, categoryId } = parsed.data;

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

      // Ensure units exist — generate goal-intent outline if empty
      let units = await storage.getLessonUnits(topic.id);
      if (units.length === 0) {
        units = await generateLessonOutline(topic.id, topic.title, description, {
          learningIntent: "goal",
          goalDescription: goalText,
          createdByUserId: userId,
        });
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
      });
    } catch (error) {
      console.error("Error creating learning goal:", error);
      res.status(500).json({ error: "Failed to create learning goal" });
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
}
