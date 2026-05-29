// server/routes/admin.ts — Admin-only routes (content regeneration, seeding, bulk jobs)
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import {
  isAdminUser,
  generateLessonOutline,
  batchPregenerateUnits,
  generateNextGenContent,
  generateLessonContent,
  generateBatchLessonContent,
} from "./ai";
import { SEED_LESSON_CONTENT } from "../seed-lesson-content";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PATHWAYS,
  DEFAULT_TOPICS,
  DEFAULT_KNOWLEDGE_CARDS,
  DEFAULT_PATHWAY_TOPICS,
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_TOPIC_CONNECTIONS,
} from "../seed-data";

// ── In-memory state for the bulk outline regeneration job (one job at a time) ──

const bulkRegenState: {
  isRunning: boolean;
  completed: number;
  total: number;
  currentTopic: string;
  errors: string[];
  startedAt: string | null;
  completedAt: string | null;
} = {
  isRunning: false,
  completed: 0,
  total: 0,
  currentTopic: "",
  errors: [],
  startedAt: null,
  completedAt: null,
};

// Background job: regenerate all outlines sequentially (outline + pregen per topic)
async function runBulkOutlineRegeneration(triggeredByUserId: string): Promise<void> {
  const allTopics = await storage.getTopics();
  const topics = allTopics;

  bulkRegenState.total = topics.length;
  console.log(`[BulkRegen] Starting bulk outline regeneration for ${topics.length} topics`);

  for (const topic of topics) {
    bulkRegenState.currentTopic = topic.title;
    try {
      console.log(`[BulkRegen] (${bulkRegenState.completed + 1}/${topics.length}) Deleting existing units for "${topic.title}"`);
      await storage.deleteLessonUnitsByTopicId(topic.id);

      console.log(`[BulkRegen] Generating new outline for "${topic.title}"`);
      const newUnits = await generateLessonOutline(topic.id, topic.title, topic.description);

      console.log(`[BulkRegen] "${topic.title}": ${newUnits.length} units created — starting batch pre-generation`);
      await batchPregenerateUnits(newUnits, { title: topic.title, description: topic.description }, triggeredByUserId);
      console.log(`[BulkRegen] "${topic.title}": batch pre-generation complete`);

      bulkRegenState.completed++;
    } catch (err) {
      const msg = `Failed "${topic.title}": ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[BulkRegen] ${msg}`);
      bulkRegenState.errors.push(msg);
      bulkRegenState.completed++;
    }
  }

  bulkRegenState.isRunning = false;
  bulkRegenState.currentTopic = "";
  bulkRegenState.completedAt = new Date().toISOString();
  console.log(`[BulkRegen] Complete: ${topics.length} topics processed, ${bulkRegenState.errors.length} errors`);
}

export function registerAdminRoutes(app: Express) {
  // ============ ADMIN KEY PURCHASE REQUESTS ============

  app.get("/api/admin/keys/pending", isAuthenticated, async (req: any, res: Response) => {
    try {
      const isAdmin = await isAdminUser(req.user.claims.sub);
      if (!isAdmin) return res.status(403).json({ error: "Forbidden" });
      const pending = await storage.getPendingPurchaseRequests();
      res.json(pending);
    } catch (error) {
      console.error("Error getting pending purchases:", error);
      res.status(500).json({ error: "Failed to get pending purchases" });
    }
  });

  app.post("/api/admin/keys/resolve/:requestId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const isAdmin = await isAdminUser(req.user.claims.sub);
      if (!isAdmin) return res.status(403).json({ error: "Forbidden" });
      const requestId = parseInt(req.params.requestId);
      if (isNaN(requestId)) return res.status(400).json({ error: "Invalid request ID" });
      const { approved, adminNote } = req.body;
      if (typeof approved !== "boolean") return res.status(400).json({ error: "approved must be boolean" });
      const result = await storage.resolveKeyPurchaseRequest(requestId, approved, adminNote);
      res.json(result);
    } catch (error) {
      console.error("Error resolving purchase:", error);
      res.status(500).json({ error: "Failed to resolve purchase" });
    }
  });

  // ============ ADMIN CONTENT CHECK ============

  app.get("/api/admin/check", isAuthenticated, async (req: any, res: Response) => {
    try {
      const isAdmin = await isAdminUser(req.user.claims.sub);
      res.json({ isAdmin });
    } catch (error) {
      console.error("Error checking admin status:", error);
      res.status(500).json({ error: "Failed to check admin status" });
    }
  });

  // ============ ADMIN LESSON REGENERATION ============

  app.post("/api/admin/lessons/:unitId/regenerate", isAuthenticated, async (req: any, res: Response) => {
    try {
      const unitId = parseInt(req.params.unitId);
      if (isNaN(unitId) || unitId <= 0) {
        return res.status(400).json({ error: "Invalid unit ID" });
      }

      const isAdmin = await isAdminUser(req.user.claims.sub);
      if (!isAdmin) {
        return res.status(403).json({ error: "Only administrators can regenerate lesson content" });
      }

      const unit = await storage.getLessonUnit(unitId);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }

      const topic = await storage.getTopicById(unit.topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      const hadContent = !!unit.contentJson;
      console.log(`[Admin] Regenerating unit ${unitId}: "${unit.title}" - had content: ${hadContent}`);

      const masteredTopics: { topicId: number; topicTitle: string }[] = [];
      const isNextGen = unit.difficulty === "nextgen";
      const adminCategory = topic.categoryId ? await storage.getCategoryById(topic.categoryId) : null;
      const adminCategoryName = adminCategory?.name;

      console.log(`[Admin] Generating new content for unit ${unitId} (${unit.difficulty} level)...`);

      const content = isNextGen
        ? await generateNextGenContent(topic, unit, masteredTopics, adminCategoryName)
        : await generateLessonContent(topic, unit, masteredTopics, adminCategoryName);

      const isContentPlaceholder = typeof content === "object" && content !== null &&
        "_isPlaceholder" in content && Boolean((content as Record<string, unknown>)._isPlaceholder);
      if (isContentPlaceholder) {
        console.log(`[Admin] Content generation failed for unit ${unitId}, keeping original content`);
        return res.json({
          success: false,
          message: `AI generation failed for "${unit.title}". Original content preserved - please try again.`,
          unitId: unit.id,
          unitTitle: unit.title,
          error: "AI generation failed",
          retryable: true
        });
      }

      if (hadContent) {
        await storage.clearLessonUnitContent(unitId);
      }

      const updatedUnit = await storage.updateLessonContent(unitId, content);
      console.log(`[Admin] Successfully regenerated content for unit ${unitId}: "${unit.title}"`);

      res.json({
        success: true,
        message: `Content regenerated for "${unit.title}".`,
        unitId: updatedUnit.id,
        unitTitle: updatedUnit.title
      });
    } catch (error) {
      console.error("Error regenerating lesson content:", error);
      res.status(500).json({ error: "Failed to regenerate lesson content" });
    }
  });

  // ============ ADMIN BATCH GENERATION ============

  app.post("/api/admin/topics/:topicId/generate-batch", isAuthenticated, async (req: any, res: Response) => {
    try {
      const topicId = parseInt(req.params.topicId);
      if (isNaN(topicId) || topicId <= 0) {
        return res.status(400).json({ error: "Invalid topic ID" });
      }

      const isAdmin = await isAdminUser(req.user.claims.sub);
      if (!isAdmin) {
        return res.status(403).json({ error: "Only administrators can batch generate content" });
      }

      const topic = await storage.getTopicById(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      let units = await storage.getLessonUnits(topicId);

      if (units.length === 0) {
        units = await generateLessonOutline(topicId, topic.title, topic.description);
      }

      const forceRegenerate = req.body?.forceRegenerate === true;
      const unitsToGenerate = forceRegenerate
        ? units.filter(u => u.difficulty !== "nextgen")
        : units.filter(u => !u.contentJson && u.difficulty !== "nextgen");

      if (unitsToGenerate.length === 0) {
        return res.json({
          success: true,
          message: "All units already have content generated",
          generated: 0,
          total: units.length
        });
      }

      console.log(`[Admin] Batch generating content for ${unitsToGenerate.length} units of topic "${topic.title}"`);

      const contentMap = await generateBatchLessonContent(
        topic,
        unitsToGenerate.map(u => ({
          id: u.id,
          title: u.title,
          difficulty: u.difficulty,
          outline: u.outline
        })),
        []
      );

      let savedCount = 0;
      const entries = Array.from(contentMap.entries());
      for (const [unitId, content] of entries) {
        if (content && !content._isPlaceholder) {
          await storage.updateLessonContent(unitId, content);
          savedCount++;
        }
      }

      console.log(`[Admin] Successfully batch generated content for ${savedCount}/${unitsToGenerate.length} units`);

      res.json({
        success: true,
        message: `Batch generated content for ${savedCount} units`,
        generated: savedCount,
        total: units.length,
        attempted: unitsToGenerate.length
      });
    } catch (error) {
      console.error("Error batch generating lesson content:", error);
      res.status(500).json({ error: "Failed to batch generate lesson content" });
    }
  });

  // ============ ADMIN SEED DEFAULTS ============

  app.post("/api/admin/seed-defaults", async (_req: Request, res: Response) => {
    try {
      console.log("[API SeedDefaults] Checking if seeding is needed...");

      const existingCategories = await storage.getCategories();
      let categoriesSeeded = 0;
      let topicsSeeded = 0;
      let cardsSeeded = 0;
      let pathwaysSeeded = 0;

      if (existingCategories.length === 0) {
        console.log("[API SeedDefaults] No categories found, seeding default categories...");
        for (const cat of DEFAULT_CATEGORIES) {
          try {
            await storage.createCategory({ name: cat.name, color: cat.color, icon: cat.icon });
            categoriesSeeded++;
          } catch (e) {
            console.error(`[API SeedDefaults] Failed to create category ${cat.name}:`, e);
          }
        }
        console.log(`[API SeedDefaults] Seeded ${categoriesSeeded} categories`);
      }

      const existingTopics = await storage.getTopics();
      if (existingTopics.length === 0) {
        console.log("[API SeedDefaults] No topics found, seeding default topics...");
        for (const topic of DEFAULT_TOPICS) {
          try {
            await storage.createTopic({ title: topic.title, description: topic.description, categoryId: topic.categoryId, difficulty: topic.difficulty });
            topicsSeeded++;
          } catch (e) {
            console.error(`[API SeedDefaults] Failed to create topic ${topic.title}:`, e);
          }
        }
        console.log(`[API SeedDefaults] Seeded ${topicsSeeded} topics`);
      }

      const existingCards = await storage.getAllCards();
      if (existingCards.length === 0) {
        console.log("[API SeedDefaults] No knowledge cards found, seeding default cards...");
        for (const card of DEFAULT_KNOWLEDGE_CARDS) {
          try {
            await storage.createCard({ topicId: card.topicId, title: card.title, content: card.content, cardType: card.cardType, tags: card.tags, order: card.order });
            cardsSeeded++;
          } catch (e) {
            console.error(`[API SeedDefaults] Failed to create card ${card.title}:`, e);
          }
        }
        console.log(`[API SeedDefaults] Seeded ${cardsSeeded} knowledge cards`);
      }

      const existingPathways = await storage.getPathways();
      if (existingPathways.length === 0) {
        console.log("[API SeedDefaults] No pathways found, seeding default pathways...");
        for (const pw of DEFAULT_PATHWAYS) {
          try {
            await storage.createPathway({ name: pw.name, description: pw.description, icon: pw.icon, color: pw.color, difficulty: pw.difficulty, estimatedHours: pw.estimatedHours, isActive: pw.isActive });
            pathwaysSeeded++;
          } catch (e) {
            console.error(`[API SeedDefaults] Failed to create pathway ${pw.name}:`, e);
          }
        }
        console.log(`[API SeedDefaults] Seeded ${pathwaysSeeded} pathways`);
      }

      let pathwayTopicsSeeded = 0;
      const firstPathway = (await storage.getPathways())[0];
      if (firstPathway) {
        const existingPathwayTopics = await storage.getPathwayTopics(firstPathway.id);
        if (existingPathwayTopics.length === 0) {
          console.log("[API SeedDefaults] No pathway topics found, seeding pathway-topic mappings...");
          for (const pt of DEFAULT_PATHWAY_TOPICS) {
            try {
              await storage.addTopicToPathway(pt.pathwayId, pt.topicId, pt.order, pt.isRequired);
              pathwayTopicsSeeded++;
            } catch (e) {
              console.error(`[API SeedDefaults] Failed to add topic ${pt.topicId} to pathway ${pt.pathwayId}:`, e);
            }
          }
          console.log(`[API SeedDefaults] Seeded ${pathwayTopicsSeeded} pathway-topic mappings`);
        }
      }

      let achievementsSeeded = 0;
      const existingAchievements = await storage.getAchievements();
      if (existingAchievements.length === 0) {
        console.log("[API SeedDefaults] No achievements found, seeding default achievements...");
        for (const ach of DEFAULT_ACHIEVEMENTS) {
          try {
            await storage.createAchievement({
              name: ach.name,
              description: ach.description,
              icon: ach.icon,
              category: ach.category,
              requirement: ach.requirement,
              xpReward: ach.xpReward,
              isSecret: ach.isSecret,
              rarity: ach.rarity,
            });
            achievementsSeeded++;
          } catch (e) {
            console.error(`[API SeedDefaults] Failed to create achievement ${ach.name}:`, e);
          }
        }
        console.log(`[API SeedDefaults] Seeded ${achievementsSeeded} achievements`);
      }

      let connectionsSeeded = 0;
      const existingConnections = await storage.getAllTopicConnections();
      if (existingConnections.length === 0) {
        console.log("[API SeedDefaults] No topic connections found, seeding default connections...");
        for (const conn of DEFAULT_TOPIC_CONNECTIONS) {
          try {
            await storage.createConnection({
              fromTopicId: conn.fromTopicId,
              toTopicId: conn.toTopicId,
              connectionType: conn.connectionType,
              strength: conn.strength,
            });
            connectionsSeeded++;
          } catch (e) {
            console.error(`[API SeedDefaults] Failed to create connection ${conn.fromTopicId}->${conn.toTopicId}:`, e);
          }
        }
        console.log(`[API SeedDefaults] Seeded ${connectionsSeeded} topic connections`);
      }

      const totalSeeded = categoriesSeeded + topicsSeeded + cardsSeeded + pathwaysSeeded + pathwayTopicsSeeded + achievementsSeeded + connectionsSeeded;

      res.json({
        success: true,
        seeded: {
          categories: categoriesSeeded,
          topics: topicsSeeded,
          knowledgeCards: cardsSeeded,
          pathways: pathwaysSeeded,
          achievements: achievementsSeeded,
          topicConnections: connectionsSeeded,
        },
        message: totalSeeded > 0 ? "Default content seeded successfully" : "Database already has content, no seeding needed"
      });
    } catch (error) {
      console.error("[API SeedDefaults] Error seeding defaults:", error);
      res.status(500).json({ error: "Failed to seed default content" });
    }
  });

  // ============ BULK OUTLINE REGENERATION ============

  app.get("/api/admin/regeneration-status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const isAdmin = await isAdminUser(req.user.claims.sub);
      if (!isAdmin) return res.status(403).json({ error: "Admin only" });
      res.json(bulkRegenState);
    } catch (error) {
      console.error("Error fetching regeneration status:", error);
      res.status(500).json({ error: "Failed to fetch status" });
    }
  });

  app.post("/api/admin/regenerate-all-outlines", isAuthenticated, async (req: any, res: Response) => {
    try {
      const isAdmin = await isAdminUser(req.user.claims.sub);
      if (!isAdmin) return res.status(403).json({ error: "Only administrators can trigger bulk regeneration" });

      if (bulkRegenState.isRunning) {
        return res.status(409).json({ error: "A regeneration job is already running", state: bulkRegenState });
      }

      bulkRegenState.isRunning = true;
      bulkRegenState.completed = 0;
      bulkRegenState.errors = [];
      bulkRegenState.startedAt = new Date().toISOString();
      bulkRegenState.completedAt = null;
      bulkRegenState.currentTopic = "";
      bulkRegenState.total = 0;

      const userId = req.user.claims.sub;
      runBulkOutlineRegeneration(userId).catch((err) => {
        console.error("[BulkRegen] Unhandled error in runBulkOutlineRegeneration:", err);
        bulkRegenState.isRunning = false;
        bulkRegenState.errors.push(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
        bulkRegenState.completedAt = new Date().toISOString();
      });

      res.status(202).json({ message: "Bulk outline regeneration started", state: bulkRegenState });
    } catch (error) {
      console.error("Error triggering bulk regeneration:", error);
      res.status(500).json({ error: "Failed to start bulk regeneration" });
    }
  });

  // ============ ADMIN REGENERATE EMPTY LESSONS ============

  app.post("/api/admin/regenerate-empty-lessons", async (req: Request, res: Response) => {
    try {
      console.log("[Admin] Starting empty lesson content regeneration...");

      const allUnits = await storage.getAllLessonUnitsWithContent();
      const emptyUnits = allUnits.filter(unit =>
        !unit.contentJson ||
        unit.contentJson === null ||
        (typeof unit.contentJson === 'object' && Object.keys(unit.contentJson as object).length === 0)
      );

      console.log(`[Admin] Found ${emptyUnits.length} empty lesson units out of ${allUnits.length} total`);

      if (emptyUnits.length === 0) {
        return res.json({
          success: true,
          message: "No empty lesson units found",
          regenerated: 0,
          total: allUnits.length
        });
      }

      const topics = await storage.getTopics();
      const topicMap = new Map(topics.map(t => [t.id, t]));

      let regenerated = 0;
      let failed = 0;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const unitsToProcess = emptyUnits.slice(0, limit);

      for (const unit of unitsToProcess) {
        const topic = topicMap.get(unit.topicId);
        if (!topic) {
          console.log(`[Admin] Skipping unit ${unit.id} - topic ${unit.topicId} not found`);
          failed++;
          continue;
        }

        try {
          // Try seed content first (fast, deterministic)
          const seedTopic = SEED_LESSON_CONTENT[unit.topicId];
          const seedUnit = seedTopic?.find(
            (s: any) => s.unitIndex === (unit as any).unitIndex && s.difficulty === unit.difficulty
          );

          if (seedUnit?.contentJson) {
            console.log(`[Admin] Seed content hit for: ${topic.title} - ${unit.title} (${unit.difficulty})`);
            await storage.updateLessonContent(unit.id, seedUnit.contentJson);
            regenerated++;
            continue;
          }

          // Fall back to AI generation
          console.log(`[Admin] Generating content for: ${topic.title} - ${unit.title} (${unit.difficulty})`);

          const content = await generateLessonContent(
            { title: topic.title, description: topic.description },
            { title: unit.title, difficulty: unit.difficulty, outline: unit.outline },
            []
          );

          if (!(content as any)._isPlaceholder) {
            await storage.updateLessonContent(unit.id, content);
            regenerated++;
            console.log(`[Admin] Successfully generated content for unit ${unit.id}`);
          } else {
            console.log(`[Admin] Got placeholder content for unit ${unit.id}, skipping save`);
            failed++;
          }
        } catch (error) {
          console.error(`[Admin] Failed to generate content for unit ${unit.id}:`, error);
          failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[Admin] Regeneration complete: ${regenerated} success, ${failed} failed, ${emptyUnits.length - limit} remaining`);

      res.json({
        success: true,
        message: `Regenerated ${regenerated} lesson units`,
        regenerated,
        failed,
        remaining: Math.max(0, emptyUnits.length - limit),
        total: allUnits.length
      });
    } catch (error) {
      console.error("[Admin] Error regenerating empty lessons:", error);
      res.status(500).json({ error: "Failed to regenerate lesson content" });
    }
  });
}
