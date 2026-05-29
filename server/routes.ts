import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { registerChatRoutes } from "./replit_integrations/chat";
import { generateCourseContent, type ProviderConfig } from "./ai-providers";
import { DEFAULT_CATEGORIES, DEFAULT_PATHWAYS, DEFAULT_TOPICS, DEFAULT_KNOWLEDGE_CARDS, DEFAULT_PATHWAY_TOPICS, DEFAULT_ACHIEVEMENTS, DEFAULT_TOPIC_CONNECTIONS } from "./seed-data";
import { SEED_LESSON_CONTENT } from "./seed-lesson-content";
import { insertOpenScienceIdeaSchema, insertOpenScienceCommentSchema } from "@shared/schema";

// Shared utilities (helpers, schemas, formatting)
export {
  contentHash,
  buildGrokipediaResource,
  injectGrokipediaResource,
  isAdminUser,
  formatTimeAgo,
  getDefaultLevels,
  saveCardSchema,
  progressSchema,
  roadmapLevelSchema,
  roadmapResponseSchema,
  chatMessageSchema,
} from "./routes/shared";

// Re-import shared utilities for local use
import {
  contentHash,
  buildGrokipediaResource,
  injectGrokipediaResource,
  isAdminUser as checkIsAdmin,
  formatTimeAgo,
  getDefaultLevels,
  saveCardSchema,
  progressSchema,
  roadmapLevelSchema,
  roadmapResponseSchema,
} from "./routes/shared";
const isAdminUser = checkIsAdmin;

// AI / TTS routes and generation helpers
import {
  registerAIRoutes,
  isUnitUnlocked,
  generateLessonOutline,
  batchPregenerateUnits,
  generateNextGenContent,
  generateLessonContent,
  predictivelyGenerateNextUnit,
  revalidateUnitLinks,
  preTTSForUnit,
  generateCustomTopicContent,
  generateBatchLessonContent,
  getTestCategories,
  getDefaultTimeLimit,
  generatePracticeTestQuestions,
} from "./routes/ai";

// Topic discovery routes
import { registerTopicsRoutes } from "./routes/topics";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication first
  await setupAuth(app);
  registerAuthRoutes(app);
  registerChatRoutes(app);
  registerTopicsRoutes(app);
  registerAIRoutes(app);

  // Learning Roadmap
  app.get("/api/roadmap/:topicId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.topicId);
      
      if (isNaN(topicId) || topicId <= 0) {
        return res.status(400).json({ error: "Invalid topic ID" });
      }
      
      let roadmap = await storage.getRoadmap(userId, topicId);
      
      if (!roadmap) {
        // Generate roadmap using AI
        const topic = await storage.getTopicById(topicId);
        if (!topic) {
          return res.status(404).json({ error: "Topic not found" });
        }

        try {
          const content = await generateCourseContent(
            [
              {
                role: "system",
                content: `You are an expert educator. Generate a learning roadmap for the topic. Return a JSON object with a "levels" array containing exactly 5 levels. Each level must have:
- id: number (1-5)
- title: string (short title for the level)
- description: string (brief description of what's covered)
- difficulty: string (one of: "beginner", "intermediate", "advanced", "expert")
- completed: boolean (always false initially)
- content: string (detailed explanation of what the learner will understand at this level)

Make the progression natural from fundamentals to advanced concepts.`,
              },
              {
                role: "user",
                content: `Create a learning roadmap for: ${topic.title}\n\nDescription: ${topic.description}`,
              },
            ],
            { responseFormat: "json", maxTokens: 2048 }
          ) || '{"levels":[]}';
          
          // Parse and validate the AI response
          let parsedContent;
          try {
            parsedContent = JSON.parse(content);
          } catch {
            console.error("Failed to parse AI response as JSON");
            parsedContent = { levels: getDefaultLevels(topic.title) };
          }

          // Validate with Zod, use defaults on failure
          const validationResult = roadmapResponseSchema.safeParse(parsedContent);
          const levels = validationResult.success 
            ? validationResult.data.levels 
            : getDefaultLevels(topic.title);

          roadmap = await storage.createRoadmap({
            userId,
            topicId,
            levels: { levels },
          });
        } catch (aiError) {
          console.error("AI roadmap generation failed:", aiError);
          // Create default roadmap on AI failure
          roadmap = await storage.createRoadmap({
            userId,
            topicId,
            levels: { levels: getDefaultLevels(topic.title) },
          });
        }
      }

      res.json(roadmap);
    } catch (error) {
      console.error("Error fetching roadmap:", error);
      res.status(500).json({ error: "Failed to fetch roadmap" });
    }
  });

  // Saved Cards
  app.get("/api/saved", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const saved = await storage.getSavedCards(userId);
      res.json(saved);
    } catch (error) {
      console.error("Error fetching saved cards:", error);
      res.status(500).json({ error: "Failed to fetch saved cards" });
    }
  });

  app.post("/api/saved", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validationResult = saveCardSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: validationResult.error.flatten() 
        });
      }
      
      const { cardId } = validationResult.data;

      // Check if card exists
      const card = await storage.getCardById(cardId);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }

      // Check if already saved
      const alreadySaved = await storage.isCardSaved(userId, cardId);
      if (alreadySaved) {
        return res.status(409).json({ error: "Card already saved" });
      }

      const saved = await storage.saveCard(userId, cardId);
      res.status(201).json(saved);
    } catch (error) {
      console.error("Error saving card:", error);
      res.status(500).json({ error: "Failed to save card" });
    }
  });

  app.delete("/api/saved/:cardId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const cardId = parseInt(req.params.cardId);
      
      if (isNaN(cardId) || cardId <= 0) {
        return res.status(400).json({ error: "Invalid card ID" });
      }
      
      await storage.unsaveCard(userId, cardId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing saved card:", error);
      res.status(500).json({ error: "Failed to remove saved card" });
    }
  });

  // User Stats
  app.get("/api/user/stats", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      const savedCards = await storage.getSavedCards(userId);
      
      res.json({
        ...stats,
        currentStreak: 7, // TODO: Implement streak tracking
        longestStreak: 14,
        savedCards: savedCards.length,
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Failed to fetch user stats" });
    }
  });

  // Mastered Topics
  app.get("/api/user/mastered-topics", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const masteredTopics = await storage.getUserMasteredTopics(userId);
      res.json(masteredTopics);
    } catch (error) {
      console.error("Error fetching mastered topics:", error);
      res.status(500).json({ error: "Failed to fetch mastered topics" });
    }
  });

  // Recent Topics
  app.get("/api/user/recent-topics", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const progress = await storage.getUserProgress(userId);
      
      // Get topic details for each progress item
      const recentTopics = await Promise.all(
        progress.slice(0, 5).map(async (p) => {
          const topic = await storage.getTopicById(p.topicId);
          const category = topic?.categoryId ? await storage.getCategoryById(topic.categoryId) : undefined;
          return {
            id: p.topicId,
            title: topic?.title || "Unknown",
            category: category?.name || "General",
            mastery: p.mastery || 0,
            lastAccessed: p.lastAccessedAt ? formatTimeAgo(p.lastAccessedAt) : "Never",
          };
        })
      );
      
      res.json(recentTopics);
    } catch (error) {
      console.error("Error fetching recent topics:", error);
      res.status(500).json({ error: "Failed to fetch recent topics" });
    }
  });

  // Knowledge Graph
  app.get("/api/knowledge-graph", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const graph = await storage.getKnowledgeGraph(userId);
      res.json(graph);
    } catch (error) {
      console.error("Error fetching knowledge graph:", error);
      res.status(500).json({ error: "Failed to fetch knowledge graph" });
    }
  });

  // User Progress
  app.post("/api/progress", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validationResult = progressSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: validationResult.error.flatten() 
        });
      }

      const { topicId, status, mastery, timeSpent } = validationResult.data;

      // Verify topic exists
      const topic = await storage.getTopicById(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      const progress = await storage.upsertProgress({
        userId,
        topicId,
        status,
        mastery,
        timeSpent,
      });

      res.json(progress);
    } catch (error) {
      console.error("Error updating progress:", error);
      res.status(500).json({ error: "Failed to update progress" });
    }
  });

  // XP System
  app.get("/api/user/xp", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const xp = await storage.getUserXp(userId);
      
      if (!xp) {
        // Return default XP for new users
        res.json({ totalXp: 0, level: 1, xpToNextLevel: 100, progress: 0 });
        return;
      }

      // Calculate XP progress to next level
      const currentLevelXp = Math.pow((xp.level - 1), 2) * 100;
      const nextLevelXp = Math.pow(xp.level, 2) * 100;
      const xpInCurrentLevel = (xp.totalXp || 0) - currentLevelXp;
      const xpNeededForLevel = nextLevelXp - currentLevelXp;
      const progress = Math.min(100, (xpInCurrentLevel / xpNeededForLevel) * 100);

      res.json({
        totalXp: xp.totalXp,
        level: xp.level,
        xpToNextLevel: nextLevelXp - (xp.totalXp || 0),
        progress: Math.round(progress),
      });
    } catch (error) {
      console.error("Error fetching XP:", error);
      res.status(500).json({ error: "Failed to fetch XP" });
    }
  });

  app.post("/api/user/xp", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { topicId, amount } = req.body;

      if (!topicId || typeof amount !== "number" || amount < 0 || amount > 100) {
        return res.status(400).json({ error: "Invalid XP data" });
      }

      // Verify topic exists
      const topic = await storage.getTopicById(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      const progress = await storage.addTopicXp(userId, topicId, amount);
      const xp = await storage.getUserXp(userId);

      res.json({ progress, xp });
    } catch (error) {
      console.error("Error adding XP:", error);
      res.status(500).json({ error: "Failed to add XP" });
    }
  });

  // Category Preferences
  app.get("/api/user/preferences", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getCategoryPreferences(userId);
      const categories = await storage.getCategories();

      // Create a full list with defaults for categories without preferences
      const fullPreferences = categories.map((cat) => {
        const pref = preferences.find((p) => p.categoryId === cat.id);
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          categoryColor: cat.color,
          categoryIcon: cat.icon,
          enabled: pref?.enabled ?? true, // Default to enabled
        };
      });

      res.json(fullPreferences);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.post("/api/user/preferences", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { categoryId, enabled } = req.body;

      if (typeof categoryId !== "number" || typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Invalid preference data" });
      }

      // Verify category exists
      const category = await storage.getCategoryById(categoryId);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }

      const pref = await storage.setCategoryPreference(userId, categoryId, enabled);
      res.json(pref);
    } catch (error) {
      console.error("Error setting preference:", error);
      res.status(500).json({ error: "Failed to set preference" });
    }
  });

  // Filtered feed (respects user preferences)
  app.get("/api/feed/personalized", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user has a default custom feed
      const defaultFeed = await storage.getDefaultFeed(userId);
      
      let feedCards;
      if (defaultFeed && defaultFeed.topicIds.length > 0) {
        // Use custom feed topics
        feedCards = await storage.getFeedCardsByTopics(defaultFeed.topicIds, 20);
      } else {
        // Use category-filtered feed
        feedCards = await storage.getFeedCardsFiltered(userId, 20);
      }
      
      res.json(feedCards);
    } catch (error) {
      console.error("Error fetching personalized feed:", error);
      res.status(500).json({ error: "Failed to fetch personalized feed" });
    }
  });

  // Seed sample data endpoint (for development)
  app.post("/api/seed", async (req: Request, res: Response) => {
    try {
      // Check if data already exists
      const existingCategories = await storage.getCategories();
      if (existingCategories.length > 0) {
        return res.json({ message: "Data already seeded" });
      }

      // Create categories
      const ai = await storage.createCategory({ name: "Artificial Intelligence", color: "purple", icon: "Brain" });
      const math = await storage.createCategory({ name: "Mathematics", color: "blue", icon: "Calculator" });
      const cs = await storage.createCategory({ name: "Computer Science", color: "green", icon: "Code" });
      const science = await storage.createCategory({ name: "Science", color: "orange", icon: "Beaker" });

      // Create topics
      const topics = [
        { title: "Machine Learning", description: "Understanding how machines learn from data to make predictions and decisions.", categoryId: ai.id, difficulty: "intermediate" },
        { title: "Linear Algebra", description: "The mathematics of vectors, matrices, and linear transformations.", categoryId: math.id, difficulty: "beginner" },
        { title: "Data Structures", description: "Organizing and storing data efficiently for quick access and modification.", categoryId: cs.id, difficulty: "beginner" },
        { title: "Quantum Mechanics", description: "The bizarre world of subatomic particles and probability.", categoryId: science.id, difficulty: "advanced" },
        { title: "Calculus", description: "The study of continuous change and its applications.", categoryId: math.id, difficulty: "intermediate" },
        { title: "Graph Theory", description: "The mathematical study of relationships and connections.", categoryId: math.id, difficulty: "intermediate" },
        { title: "Algorithms", description: "Step-by-step procedures for solving computational problems.", categoryId: cs.id, difficulty: "intermediate" },
        { title: "Neural Networks", description: "Exploring the brain-inspired computing systems that power modern AI.", categoryId: ai.id, difficulty: "advanced" },
      ];

      const createdTopics = await Promise.all(topics.map((t) => storage.createTopic(t)));

      // Create knowledge cards
      const cards = [
        { topicId: createdTopics[0].id, title: "What is Machine Learning?", content: "Machine learning is a subset of artificial intelligence that enables computers to learn from experience without being explicitly programmed. Instead of writing rules, we feed data and let the algorithm discover patterns.", cardType: "text", tags: ["AI", "basics", "introduction"] },
        { topicId: createdTopics[0].id, title: "Types of Machine Learning", content: "There are three main types: Supervised learning (learning from labeled examples), Unsupervised learning (finding patterns in unlabeled data), and Reinforcement learning (learning through trial and error).", cardType: "text", tags: ["ML", "types", "overview"] },
        { topicId: createdTopics[7].id, title: "What are Neural Networks?", content: "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information using connections (synapses) that can be adjusted through learning.", cardType: "text", tags: ["neural", "AI", "deep-learning"] },
        { topicId: createdTopics[1].id, title: "Vectors and Scalars", content: "A scalar is just a single number. A vector is an ordered list of numbers. Think of a scalar as a point, and a vector as an arrow pointing in a specific direction with a specific length.", cardType: "text", tags: ["vectors", "basics", "math"] },
        { topicId: createdTopics[4].id, title: "The Derivative", content: "The derivative measures how a function changes as its input changes. It's the instantaneous rate of change, or the slope of the tangent line at any point on a curve.", cardType: "text", tags: ["calculus", "derivatives", "rates"] },
        { topicId: createdTopics[2].id, title: "Arrays vs Linked Lists", content: "Arrays store elements in contiguous memory locations for O(1) access but O(n) insertion. Linked lists use pointers for O(1) insertion but O(n) access. Choose based on your access patterns!", cardType: "text", tags: ["data-structures", "arrays", "comparison"] },
        { topicId: createdTopics[6].id, title: "Big O Notation", content: "Big O notation describes the worst-case complexity of an algorithm. O(1) is constant time, O(n) is linear, O(n squared) is quadratic. It helps us compare algorithm efficiency as inputs grow.", cardType: "text", tags: ["algorithms", "complexity", "efficiency"] },
        { topicId: createdTopics[3].id, title: "Wave-Particle Duality", content: "Light and matter exhibit both wave and particle properties. This isn't about them 'switching' between states - they're always both, and which property we observe depends on how we measure them.", cardType: "text", tags: ["quantum", "physics", "waves"] },
      ];

      await Promise.all(cards.map((c) => storage.createCard(c)));

      // Create connections between topics
      const connections = [
        { fromTopicId: createdTopics[0].id, toTopicId: createdTopics[7].id, connectionType: "leads-to", strength: 8 },
        { fromTopicId: createdTopics[0].id, toTopicId: createdTopics[1].id, connectionType: "requires", strength: 6 },
        { fromTopicId: createdTopics[7].id, toTopicId: createdTopics[4].id, connectionType: "requires", strength: 7 },
        { fromTopicId: createdTopics[1].id, toTopicId: createdTopics[4].id, connectionType: "related", strength: 8 },
        { fromTopicId: createdTopics[2].id, toTopicId: createdTopics[6].id, connectionType: "leads-to", strength: 9 },
        { fromTopicId: createdTopics[6].id, toTopicId: createdTopics[5].id, connectionType: "related", strength: 5 },
        { fromTopicId: createdTopics[1].id, toTopicId: createdTopics[5].id, connectionType: "related", strength: 7 },
      ];

      await Promise.all(connections.map((c) => storage.createConnection(c)));

      res.json({ message: "Sample data seeded successfully" });
    } catch (error) {
      console.error("Error seeding data:", error);
      res.status(500).json({ error: "Failed to seed data" });
    }
  });

  // ============================================
  // LESSON SYSTEM ENDPOINTS
  // ============================================

  // Validation schemas for lessons
  const lessonStartSchema = z.object({
    unitId: z.number().int().positive(),
  });

  const lessonCompleteSchema = z.object({
    unitId: z.number().int().positive(),
    quizScore: z.number().int().min(0).max(100).optional(),
  });

  // Get or generate lesson outline for a topic
  app.get("/api/lessons/:topicId/outline", isAuthenticated, async (req: any, res: Response) => {
    try {
      const topicId = parseInt(req.params.topicId);
      if (isNaN(topicId) || topicId <= 0) {
        return res.status(400).json({ error: "Invalid topic ID" });
      }

      const topic = await storage.getTopicById(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      // Check if we already have generated units for this topic
      let units = await storage.getLessonUnits(topicId);
      
      if (units.length === 0) {
        // Generate outline using AI
        units = await generateLessonOutline(topicId, topic.title, topic.description);
        // Fire background batch pre-generation for all new non-nextgen units
        batchPregenerateUnits(units, topic, req.user.claims.sub).catch(console.error);
      }

      // Get user's mastery status
      const mastery = await storage.getOrCreateTopicMastery(req.user.claims.sub, topicId);
      
      // Check if user is admin (bypass all locks)
      const isAdmin = await isAdminUser(req.user.claims.sub);
      
      // Get user's progress for each unit
      const unitsWithProgress = await Promise.all(units.map(async (unit) => {
        const progress = await storage.getLessonProgress(req.user.claims.sub, unit.id);
        return {
          ...unit,
          progress: progress || null,
          locked: !isUnitUnlocked(unit.difficulty, mastery, isAdmin),
        };
      }));

      res.json({
        topic,
        units: unitsWithProgress,
        mastery,
        isAdmin, // Include admin status so frontend can show unlocked tabs
      });
    } catch (error) {
      console.error("Error fetching lesson outline:", error);
      res.status(500).json({ error: "Failed to fetch lesson outline" });
    }
  });

  // Get or generate lesson content for a specific unit
  app.get("/api/lessons/unit/:unitId/content", isAuthenticated, async (req: any, res: Response) => {
    try {
      const unitId = parseInt(req.params.unitId);
      if (isNaN(unitId) || unitId <= 0) {
        return res.status(400).json({ error: "Invalid unit ID" });
      }

      const unit = await storage.getLessonUnit(unitId);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }

      const topic = await storage.getTopicById(unit.topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      // Check if user has unlocked this difficulty level (admin bypass all locks)
      const mastery = await storage.getOrCreateTopicMastery(req.user.claims.sub, unit.topicId);
      const isAdmin = await isAdminUser(req.user.claims.sub);
      if (!isUnitUnlocked(unit.difficulty, mastery, isAdmin)) {
        return res.status(403).json({ 
          error: "This lesson is locked",
          message: "Complete more lessons in the previous difficulty to unlock this level."
        });
      }

      const userId = req.user.claims.sub;
      const masteredTopics = await storage.getUserMasteredTopics(userId);
      const isNextGen = unit.difficulty === "nextgen";

      // Fetch category for hyper-specific resource links
      const category = topic.categoryId ? await storage.getCategoryById(topic.categoryId) : null;
      const categoryName = category?.name;

      let content = unit.contentJson;

      if (!content) {
        // Build sibling context so the AI knows which units exist in the same tier
        const allTopicUnits = await storage.getLessonUnits(unit.topicId);
        const tierUnits = allTopicUnits
          .filter(u => u.difficulty === unit.difficulty)
          .sort((a, b) => a.unitIndex - b.unitIndex);
        const unitPosInTier = tierUnits.findIndex(u => u.id === unit.id);
        const unitContext = {
          position: unitPosInTier + 1,
          total: tierUnits.length,
          siblingTitles: tierUnits.filter(u => u.id !== unit.id).map(u => u.title),
        };
        console.log(`[Lesson] Generating content for unit ${unitId} "${unit.title}" (${unit.difficulty} ${unitContext.position}/${unitContext.total})`);

        // Generate content using AI - use different generator for Next Gen
        const generatedContent = isNextGen 
          ? await generateNextGenContent(topic, unit, masteredTopics, categoryName)
          : await generateLessonContent(topic, unit, masteredTopics, categoryName, unitContext);
        
        // Only save real AI-generated content, NOT placeholder fallbacks
        const isPlaceholder = typeof generatedContent === "object" && generatedContent !== null &&
          "_isPlaceholder" in generatedContent && Boolean((generatedContent as Record<string, unknown>)._isPlaceholder);
        if (isPlaceholder) {
          console.log(`Content generation failed for unit ${unitId}, returning placeholder without saving`);
          return res.json({ unit, content: generatedContent, isNextGen, isTemporary: true });
        }
        
        const updatedUnit = await storage.updateLessonContent(unitId, generatedContent);
        content = generatedContent;
        console.log(`[Lesson] unit_id=${unitId} title="${unit.title}" content_hash=${contentHash(content)} (generated)`);

        // Predictive pre-generation: asynchronously generate next unit's content
        predictivelyGenerateNextUnit(unit, topic, masteredTopics, userId, categoryName).catch(console.error);

        // Inject Grokipedia link at response time (not persisted)
        const contentWithGrokipedia = injectGrokipediaResource(content, topic.title, isNextGen);
        return res.json({ unit: updatedUnit, content: contentWithGrokipedia, isNextGen });
      }

      // Content already exists — log cache hit and trigger predictive pre-gen in background
      console.log(`[Lesson] unit_id=${unitId} title="${unit.title}" content_hash=${contentHash(content)} (cached)`);
      predictivelyGenerateNextUnit(unit, topic, masteredTopics, userId, categoryName).catch(console.error);

      // Background link re-validation: check if content is stale (>30 days)
      if (unit.generatedAt) {
        const contentDate = new Date(unit.generatedAt);
        const daysSince = (Date.now() - contentDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 30) {
          revalidateUnitLinks(unitId, content).catch(console.error);
        }
      }

      // Also pre-generate TTS audio for this unit if user has a non-browser preset
      preTTSForUnit(userId, unitId, content, isNextGen).catch(console.error);

      // Inject Grokipedia link at response time (not persisted)
      const contentWithGrokipedia = injectGrokipediaResource(content, topic.title, isNextGen);
      return res.json({ unit, content: contentWithGrokipedia, isNextGen });
    } catch (error) {
      console.error("Error fetching lesson content:", error);
      res.status(500).json({ error: "Failed to fetch lesson content" });
    }
  });

  // Start a lesson (records progress and awards XP)
  app.post("/api/lessons/start", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = lessonStartSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { unitId } = parsed.data;
      const userId = req.user.claims.sub;

      const unit = await storage.getLessonUnit(unitId);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }

      // Check if this is a new start (first time starting this lesson)
      const existingProgress = await storage.getLessonProgress(userId, unitId);
      const isFirstStart = !existingProgress || existingProgress.status === "not_started";

      // Start the lesson
      const progress = await storage.startLesson(userId, unitId);

      // Award XP only on first start
      if (isFirstStart) {
        await storage.addXp(userId, 5);
      }

      // Predictive pre-generation: warm TTS cache for the current unit on lesson start, and
      // pre-generate next-unit content+TTS so it's ready before the user finishes this lesson.
      // Both are fire-and-forget (non-blocking).
      if (unit.contentJson) {
        const isNextGenUnit = unit.difficulty === "nextgen";
        preTTSForUnit(userId, unitId, unit.contentJson, isNextGenUnit).catch(console.error);
      }
      const startTopic = await storage.getTopicById(unit.topicId);
      if (startTopic) {
        const startMasteredTopics = await storage.getUserMasteredTopics(userId);
        const startCategory = startTopic.categoryId ? await storage.getCategoryById(startTopic.categoryId) : null;
        const startCategoryName = startCategory?.name;
        predictivelyGenerateNextUnit(unit, startTopic, startMasteredTopics, userId, startCategoryName).catch(console.error);
      }

      res.json({ progress, xpAwarded: isFirstStart ? 5 : 0 });
    } catch (error) {
      console.error("Error starting lesson:", error);
      res.status(500).json({ error: "Failed to start lesson" });
    }
  });

  // Complete a lesson (records completion and checks for tier unlocks)
  app.post("/api/lessons/complete", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = lessonCompleteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { unitId, quizScore } = parsed.data;
      const userId = req.user.claims.sub;

      const unit = await storage.getLessonUnit(unitId);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }

      // Complete the lesson
      const progress = await storage.completeLesson(userId, unitId, quizScore);

      // Award XP based on difficulty: beginner=1, intermediate=3, advanced=5, nextgen=10
      const baseXp = storage.getXpForDifficulty(unit.difficulty);
      // Bonus for passing quiz (70%+)
      const quizBonus = quizScore && quizScore >= 70 ? Math.ceil(baseXp * 0.5) : 0;
      const totalXp = baseXp + quizBonus;
      await storage.addXp(userId, totalXp);

      // Update user streak
      await storage.updateStreak(userId);

      // Check and unlock tiers
      const mastery = await storage.checkAndUnlockTiers(userId, unit.topicId);

      // Check for any new achievements
      const newAchievements = await storage.checkAndAwardAchievements(userId);

      // Generate infographic reward when completing advanced or nextgen level
      let infographicEarned = false;
      if (unit.difficulty === "advanced" || unit.difficulty === "nextgen") {
        const existing = await storage.getUserInfographicByTopic(userId, unit.topicId);
        if (!existing) {
          // Trigger infographic generation in the background
          const topic = await storage.getTopicById(unit.topicId);
          if (topic) {
            infographicEarned = true;
            import("./infographic-generator").then(({ generateAndStoreInfographic }) => {
              generateAndStoreInfographic(
                userId,
                unit.topicId,
                topic.title,
                topic.description,
                unit.difficulty,
                unit.contentJson
              ).catch(console.error);
            });
          }
        }
      }

      const keyEarnResult = await storage.checkAndAwardDailyKey(userId);

      res.json({ 
        progress, 
        xpAwarded: totalXp,
        mastery,
        newAchievements,
        infographicEarned,
        keyEarned: keyEarnResult.awarded,
        message: keyEarnResult.awarded
          ? "You earned an Unlock Key!"
          : mastery.intermediateUnlocked || mastery.advancedUnlocked 
            ? "New difficulty level unlocked!" 
            : undefined
      });
    } catch (error) {
      console.error("Error completing lesson:", error);
      res.status(500).json({ error: "Failed to complete lesson" });
    }
  });

  // Get topic mastery status
  app.get("/api/lessons/:topicId/mastery", isAuthenticated, async (req: any, res: Response) => {
    try {
      const topicId = parseInt(req.params.topicId);
      if (isNaN(topicId) || topicId <= 0) {
        return res.status(400).json({ error: "Invalid topic ID" });
      }

      const mastery = await storage.getOrCreateTopicMastery(req.user.claims.sub, topicId);
      res.json(mastery);
    } catch (error) {
      console.error("Error fetching mastery:", error);
      res.status(500).json({ error: "Failed to fetch mastery" });
    }
  });

  // ============ UNLOCK KEYS ROUTES ============

  app.get("/api/keys", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const keys = await storage.getUserKeys(userId);
      const earnProgress = await storage.getKeyEarnProgress(userId);
      const availableKeys = keys.totalKeys - keys.usedKeys;
      res.json({
        totalKeys: keys.totalKeys,
        usedKeys: keys.usedKeys,
        availableKeys,
        earnProgress,
      });
    } catch (error) {
      console.error("Error getting keys:", error);
      res.status(500).json({ error: "Failed to get keys" });
    }
  });

  app.post("/api/keys/use/:topicId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.topicId);
      if (isNaN(topicId)) {
        return res.status(400).json({ error: "Invalid topic ID" });
      }
      const result = await storage.useKeyOnTopic(userId, topicId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      const keys = await storage.getUserKeys(userId);
      res.json({ success: true, availableKeys: keys.totalKeys - keys.usedKeys });
    } catch (error) {
      console.error("Error using key:", error);
      res.status(500).json({ error: "Failed to use key" });
    }
  });

  app.post("/api/keys/check-earn", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.checkAndAwardDailyKey(userId);
      res.json(result);
    } catch (error) {
      console.error("Error checking daily key:", error);
      res.status(500).json({ error: "Failed to check daily key" });
    }
  });

  app.post("/api/keys/purchase", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { quantity } = req.body;
      if (!quantity || typeof quantity !== "number" || quantity < 1 || quantity > 100) {
        return res.status(400).json({ error: "Quantity must be between 1 and 100" });
      }
      const request = await storage.createKeyPurchaseRequest(userId, quantity);
      res.json(request);
    } catch (error) {
      console.error("Error creating purchase request:", error);
      res.status(500).json({ error: "Failed to create purchase request" });
    }
  });

  app.get("/api/keys/purchases", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const purchases = await storage.getUserPurchaseRequests(userId);
      res.json(purchases);
    } catch (error) {
      console.error("Error getting purchases:", error);
      res.status(500).json({ error: "Failed to get purchases" });
    }
  });

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

  // ============ IDEA CONTRIBUTIONS & NOVA COINS (Pioneer System) ============

  // Get ideas for a topic (public read)
  app.get("/api/topics/:topicId/ideas", isAuthenticated, async (req: any, res: Response) => {
    try {
      const topicId = parseInt(req.params.topicId);
      if (isNaN(topicId)) return res.status(400).json({ error: "Invalid topic ID" });
      const ideas = await storage.getIdeaContributionsByTopic(topicId);
      res.json(ideas);
    } catch (error) {
      console.error("Error getting ideas:", error);
      res.status(500).json({ error: "Failed to get ideas" });
    }
  });

  // Submit an idea (awards 1 Nova Coin)
  app.post("/api/topics/:topicId/ideas", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.topicId);
      if (isNaN(topicId)) return res.status(400).json({ error: "Invalid topic ID" });

      const { title, description, unitId } = req.body;
      if (!title || typeof title !== "string" || title.trim().length < 5) {
        return res.status(400).json({ error: "Title must be at least 5 characters" });
      }
      if (!description || typeof description !== "string" || description.trim().length < 20) {
        return res.status(400).json({ error: "Description must be at least 20 characters" });
      }

      const idea = await storage.createIdeaContribution(
        userId,
        topicId,
        unitId ? parseInt(unitId) : null,
        title.trim(),
        description.trim()
      );

      // Award a Nova Coin for the contribution
      const coins = await storage.awardNovaCoin(userId);

      res.json({ idea, novaCoins: coins, message: "Pioneer badge earned! Your idea has been timestamped and attributed to you." });
    } catch (error) {
      console.error("Error submitting idea:", error);
      res.status(500).json({ error: "Failed to submit idea" });
    }
  });

  // Get current user's Nova Coin balance
  app.get("/api/user/nova-coins", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const coins = await storage.getUserNovaCoins(userId);
      res.json(coins);
    } catch (error) {
      console.error("Error getting nova coins:", error);
      res.status(500).json({ error: "Failed to get nova coins" });
    }
  });

  // ============ SPACED REPETITION SYSTEM (SRS) ============

  // Get due flashcards for the user
  app.get("/api/user/flashcards/due", isAuthenticated, async (req: any, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const flashcards = await storage.getDueFlashcards(req.user.claims.sub, limit);
      res.json(flashcards);
    } catch (error) {
      console.error("Error getting due flashcards:", error);
      res.status(500).json({ error: "Failed to get due flashcards" });
    }
  });

  // Submit flashcard review
  app.post("/api/flashcards/:id/review", isAuthenticated, async (req: any, res: Response) => {
    try {
      const flashcardId = parseInt(req.params.id);
      const { quality } = req.body;
      
      if (isNaN(flashcardId) || quality === undefined || quality < 0 || quality > 5) {
        return res.status(400).json({ error: "Invalid request" });
      }

      const review = await storage.submitFlashcardReview(req.user.claims.sub, flashcardId, quality);
      res.json(review);
    } catch (error) {
      console.error("Error submitting flashcard review:", error);
      res.status(500).json({ error: "Failed to submit review" });
    }
  });

  // Generate flashcards from lesson content
  app.post("/api/lessons/:unitId/generate-flashcards", isAuthenticated, async (req: any, res: Response) => {
    try {
      const unitId = parseInt(req.params.unitId);
      if (isNaN(unitId)) return res.status(400).json({ error: "Invalid unit ID" });

      // Check if flashcards already exist
      const existing = await storage.getFlashcardsByUnit(unitId);
      if (existing.length > 0) {
        return res.json({ success: true, count: existing.length, flashcards: existing, message: "Flashcards already exist" });
      }

      const unit = await storage.getLessonUnit(unitId);
      if (!unit || !unit.contentJson) {
        return res.status(404).json({ error: "Lesson unit or content not found" });
      }

      const prompt = `You are an expert educator creating concise, effective spaced-repetition flashcards for the lesson "${unit.title}".
Review the following lesson content:
${JSON.stringify(unit.contentJson)}

Generate 5-8 high-quality flashcards testing the core concepts, mechanisms, and key takeaways.
Each flashcard should have a clear "front" (question/prompt) and a concise "back" (answer/explanation).
Return a JSON object in this exact format:
{
  "flashcards": [
    { "front": "Question here...", "back": "Answer here...", "cardType": "qna" }
  ]
}`;

      // Call AI provider
      const content = await generateCourseContent(
        [{ role: "user", content: prompt }],
        { responseFormat: "json", temperature: 0.5 }
      ) || '{"flashcards":[]}';
      
      const parsed = JSON.parse(content);
      const cards = parsed.flashcards || [];
      
      if (cards.length > 0) {
        const toInsert = cards.map((c: any) => ({
          topicId: unit.topicId,
          unitId: unit.id,
          front: c.front,
          back: c.back,
          cardType: c.cardType || "qna"
        }));
        
        const created = await storage.createFlashcards(toInsert);
        return res.json({ success: true, count: created.length, flashcards: created });
      }
      
      res.status(400).json({ error: "AI failed to generate flashcards" });
    } catch (error) {
      console.error("Error generating flashcards:", error);
      res.status(500).json({ error: "Failed to generate flashcards" });
    }
  });

  // ============ ADMIN ROUTES ============

  // Check if current user is an admin
  app.get("/api/admin/check", isAuthenticated, async (req: any, res: Response) => {
    try {
      const isAdmin = await isAdminUser(req.user.claims.sub);
      res.json({ isAdmin });
    } catch (error) {
      console.error("Error checking admin status:", error);
      res.status(500).json({ error: "Failed to check admin status" });
    }
  });

  // Regenerate lesson content (admin only) - clears existing content so it regenerates on next access
  app.post("/api/admin/lessons/:unitId/regenerate", isAuthenticated, async (req: any, res: Response) => {
    try {
      const unitId = parseInt(req.params.unitId);
      if (isNaN(unitId) || unitId <= 0) {
        return res.status(400).json({ error: "Invalid unit ID" });
      }

      // Check if user is admin
      const isAdmin = await isAdminUser(req.user.claims.sub);
      if (!isAdmin) {
        return res.status(403).json({ error: "Only administrators can regenerate lesson content" });
      }

      // Check if unit exists
      const unit = await storage.getLessonUnit(unitId);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }

      const topic = await storage.getTopicById(unit.topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      // Store original content for rollback if regeneration fails
      const originalContent = unit.contentJson;
      const hadContent = !!originalContent;
      
      console.log(`[Admin] Regenerating unit ${unitId}: "${unit.title}" - had content: ${hadContent}`);

      // Use empty mastered topics for neutral/general content (not user-specific)
      // This ensures regenerated content is suitable for all learners
      const masteredTopics: { topicId: number; topicTitle: string }[] = [];
      const isNextGen = unit.difficulty === "nextgen";
      const adminCategory = topic.categoryId ? await storage.getCategoryById(topic.categoryId) : null;
      const adminCategoryName = adminCategory?.name;
      
      console.log(`[Admin] Generating new content for unit ${unitId} (${unit.difficulty} level)...`);
      
      const content = isNextGen 
        ? await generateNextGenContent(topic, unit, masteredTopics, adminCategoryName)
        : await generateLessonContent(topic, unit, masteredTopics, adminCategoryName);
      
      // Check if content generation succeeded
      const isContentPlaceholder = typeof content === "object" && content !== null &&
        "_isPlaceholder" in content && Boolean((content as Record<string, unknown>)._isPlaceholder);
      if (isContentPlaceholder) {
        console.log(`[Admin] Content generation failed for unit ${unitId}, keeping original content`);
        // Don't clear content - keep original so users aren't left with empty lessons
        return res.json({ 
          success: false, 
          message: `AI generation failed for "${unit.title}". Original content preserved - please try again.`,
          unitId: unit.id,
          unitTitle: unit.title,
          error: "AI generation failed",
          retryable: true
        });
      }

      // Only clear and save after successful generation
      if (hadContent) {
        await storage.clearLessonUnitContent(unitId);
      }
      
      // Save the newly generated content
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

  // Batch generate all lesson content for a topic (admin only)
  // More cost-effective than generating per-unit - generates all beginner/intermediate/advanced content in one API call
  app.post("/api/admin/topics/:topicId/generate-batch", isAuthenticated, async (req: any, res: Response) => {
    try {
      const topicId = parseInt(req.params.topicId);
      if (isNaN(topicId) || topicId <= 0) {
        return res.status(400).json({ error: "Invalid topic ID" });
      }

      // Check if user is admin
      const isAdmin = await isAdminUser(req.user.claims.sub);
      if (!isAdmin) {
        return res.status(403).json({ error: "Only administrators can batch generate content" });
      }

      const topic = await storage.getTopicById(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      // Get all units for this topic
      let units = await storage.getLessonUnits(topicId);
      
      if (units.length === 0) {
        // Generate outline first if no units exist
        units = await generateLessonOutline(topicId, topic.title, topic.description);
      }

      // Filter to units that don't have content yet (or force regenerate if specified)
      const forceRegenerate = req.body?.forceRegenerate === true;
      const unitsToGenerate = forceRegenerate 
        ? units.filter(u => u.difficulty !== "nextgen") // nextgen uses different structure
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

      // Use batch content generation
      const contentMap = await generateBatchLessonContent(
        topic,
        unitsToGenerate.map(u => ({
          id: u.id,
          title: u.title,
          difficulty: u.difficulty,
          outline: u.outline
        })),
        [] // Empty mastered topics for neutral content
      );

      // Save generated content to database
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

  // ============ USER PROFILE ROUTES ============
  
  // Get user profile
  app.get("/api/user/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const profile = await storage.getUserProfile(req.user.claims.sub);
      res.json(profile || { userId: req.user.claims.sub });
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Update user profile
  app.post("/api/user/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { 
        ageRange, 
        technicalLevel, 
        priorExperience, 
        allowTestOut, 
        huggingFaceToken, 
        ollamaUrl,
        openRouterKey,
        preferredAiProvider,
        preferredModel
      } = req.body;
      const profile = await storage.createOrUpdateUserProfile(req.user.claims.sub, {
        ageRange,
        technicalLevel,
        priorExperience,
        allowTestOut,
        huggingFaceToken,
        ollamaUrl,
        openRouterKey,
        preferredAiProvider,
        preferredModel,
      });
      res.json(profile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // ============ PATHWAY ROUTES ============

  // Get all pathways
  app.get("/api/pathways", async (req: Request, res: Response) => {
    try {
      const allPathways = await storage.getPathways();
      res.json(allPathways);
    } catch (error) {
      console.error("Error fetching pathways:", error);
      res.status(500).json({ error: "Failed to fetch pathways" });
    }
  });

  // Get pathway details with topics
  app.get("/api/pathways/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid pathway ID" });
      }
      const pathway = await storage.getPathwayById(id);
      if (!pathway) {
        return res.status(404).json({ error: "Pathway not found" });
      }
      const topics = await storage.getPathwayTopics(id);
      res.json({ pathway, topics });
    } catch (error) {
      console.error("Error fetching pathway:", error);
      res.status(500).json({ error: "Failed to fetch pathway" });
    }
  });

  // Get user enrolled pathways
  app.get("/api/user/pathways", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userPathwaysList = await storage.getUserPathways(req.user.claims.sub);
      res.json(userPathwaysList);
    } catch (error) {
      console.error("Error fetching user pathways:", error);
      res.status(500).json({ error: "Failed to fetch user pathways" });
    }
  });

  // Auto-enroll user in all default content (pathways and categories)
  app.post("/api/user/auto-enroll", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`[API AutoEnroll] Starting auto-enrollment for user ${userId}`);
      
      let enrolledPathways = 0;
      let enabledCategories = 0;

      // Enroll in all pathways if none enrolled
      const existingPathways = await storage.getUserPathways(userId);
      console.log(`[API AutoEnroll] User ${userId} has ${existingPathways.length} existing pathways`);
      
      if (existingPathways.length === 0) {
        const allPathways = await storage.getPathways();
        console.log(`[API AutoEnroll] Enrolling user in ${allPathways.length} pathways`);
        
        for (const pathway of allPathways) {
          try {
            await storage.enrollInPathway(userId, pathway.id);
            enrolledPathways++;
          } catch (e) {
            console.error(`[API AutoEnroll] Failed to enroll in pathway ${pathway.id}:`, e);
          }
        }
      }

      // Enable all categories if no preferences
      const existingPrefs = await storage.getCategoryPreferences(userId);
      console.log(`[API AutoEnroll] User ${userId} has ${existingPrefs.length} existing preferences`);
      
      if (existingPrefs.length === 0) {
        const allCategories = await storage.getCategories();
        console.log(`[API AutoEnroll] Enabling ${allCategories.length} categories for user`);
        
        for (const category of allCategories) {
          try {
            await storage.setCategoryPreference(userId, category.id, true);
            enabledCategories++;
          } catch (e) {
            console.error(`[API AutoEnroll] Failed to enable category ${category.id}:`, e);
          }
        }
      }

      console.log(`[API AutoEnroll] Completed: ${enrolledPathways} pathways, ${enabledCategories} categories`);

      res.json({ 
        success: true, 
        enrolledPathways, 
        enabledCategories,
        message: enrolledPathways > 0 || enabledCategories > 0 
          ? "Successfully enrolled in default content" 
          : "Already enrolled in default content"
      });
    } catch (error) {
      console.error("[API AutoEnroll] Error auto-enrolling user:", error);
      res.status(500).json({ error: "Failed to auto-enroll user" });
    }
  });

  // Force reset all settings and re-enroll in default content
  app.post("/api/user/reset-defaults", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`[API ResetDefaults] Force resetting defaults for user ${userId}`);
      
      // Delete all existing category preferences
      const deletedPrefs = await storage.deleteAllCategoryPreferences(userId);
      console.log(`[API ResetDefaults] Deleted ${deletedPrefs} category preferences for user ${userId}`);
      
      // Re-enable all categories
      const allCategories = await storage.getCategories();
      let enabledCategories = 0;
      for (const category of allCategories) {
        try {
          await storage.setCategoryPreference(userId, category.id, true);
          enabledCategories++;
        } catch (e) {
          console.error(`[API ResetDefaults] Failed to enable category ${category.id}:`, e);
        }
      }
      
      // Enroll in all pathways (won't duplicate if already enrolled)
      const allPathways = await storage.getPathways();
      let enrolledPathways = 0;
      for (const pathway of allPathways) {
        try {
          await storage.enrollInPathway(userId, pathway.id);
          enrolledPathways++;
        } catch (e) {
          // Ignore duplicate enrollment errors
        }
      }
      
      console.log(`[API ResetDefaults] Completed: ${enabledCategories} categories enabled, ${enrolledPathways} pathways enrolled`);

      res.json({ 
        success: true, 
        enabledCategories,
        enrolledPathways,
        message: "Successfully reset to default settings"
      });
    } catch (error) {
      console.error("[API ResetDefaults] Error resetting defaults:", error);
      res.status(500).json({ error: "Failed to reset defaults" });
    }
  });

  // Seed default content if database is empty (admin endpoint)
  app.post("/api/admin/seed-defaults", async (req: Request, res: Response) => {
    try {
      console.log("[API SeedDefaults] Checking if seeding is needed...");
      
      // Check if categories exist
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
      } else {
        console.log(`[API SeedDefaults] Categories already exist (${existingCategories.length} found)`);
      }
      
      // Check if topics exist
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
      } else {
        console.log(`[API SeedDefaults] Topics already exist (${existingTopics.length} found)`);
      }
      
      // Check if knowledge cards exist
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
      } else {
        console.log(`[API SeedDefaults] Knowledge cards already exist (${existingCards.length} found)`);
      }
      
      // Check if pathways exist
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
      } else {
        console.log(`[API SeedDefaults] Pathways already exist (${existingPathways.length} found)`);
      }
      
      // Check if pathway topics exist - seed mappings if missing
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
        } else {
          console.log(`[API SeedDefaults] Pathway topics already exist (${existingPathwayTopics.length} found for pathway ${firstPathway.id})`);
        }
      }

      // Seed achievements if empty
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
      } else {
        console.log(`[API SeedDefaults] Achievements already exist (${existingAchievements.length} found)`);
      }

      // Seed topic connections if empty
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
      } else {
        console.log(`[API SeedDefaults] Topic connections already exist (${existingConnections.length} found)`);
      }

      const totalSeeded = categoriesSeeded + topicsSeeded + cardsSeeded + pathwaysSeeded + pathwayTopicsSeeded + achievementsSeeded + connectionsSeeded;
      console.log(`[API SeedDefaults] Completed seeding: ${categoriesSeeded} categories, ${topicsSeeded} topics, ${cardsSeeded} cards, ${pathwaysSeeded} pathways, ${achievementsSeeded} achievements, ${connectionsSeeded} connections`);

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

  // In-memory state for the bulk outline regeneration job (one job at a time)
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
    // Fetch topic list before setting isRunning, but mark running immediately after to avoid race window
    const allTopics = await storage.getTopics();
    const topics = allTopics; // All rows in the topics table (custom topics live in customTopics table, not here)

    // Update total now that we know the topic count (isRunning was already set by the POST handler)
    bulkRegenState.total = topics.length;

    console.log(`[BulkRegen] Starting bulk outline regeneration for ${topics.length} topics`);

    for (const topic of topics) {
      bulkRegenState.currentTopic = topic.title;
      try {
        console.log(`[BulkRegen] (${bulkRegenState.completed + 1}/${topics.length}) Deleting existing units for "${topic.title}"`);
        await storage.deleteLessonUnitsByTopicId(topic.id);

        console.log(`[BulkRegen] Generating new outline for "${topic.title}"`);
        const newUnits = await generateLessonOutline(topic.id, topic.title, topic.description);

        // Await batch pregen so this topic is fully complete before moving to next
        // This enforces sequential processing and accurate completion status
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

    // Mark done only after all outlines AND all pregen are complete
    bulkRegenState.isRunning = false;
    bulkRegenState.currentTopic = "";
    bulkRegenState.completedAt = new Date().toISOString();
    console.log(`[BulkRegen] Complete: ${topics.length} topics processed, ${bulkRegenState.errors.length} errors`);
  }

  // GET /api/admin/regeneration-status — returns current job state (admin only)
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

  // POST /api/admin/regenerate-all-outlines — triggers bulk regeneration job (admin only, 202 Accepted)
  app.post("/api/admin/regenerate-all-outlines", isAuthenticated, async (req: any, res: Response) => {
    try {
      const isAdmin = await isAdminUser(req.user.claims.sub);
      if (!isAdmin) return res.status(403).json({ error: "Only administrators can trigger bulk regeneration" });

      if (bulkRegenState.isRunning) {
        return res.status(409).json({ error: "A regeneration job is already running", state: bulkRegenState });
      }

      // Mark running immediately (before any await) to prevent concurrent POST race conditions
      bulkRegenState.isRunning = true;
      bulkRegenState.completed = 0;
      bulkRegenState.errors = [];
      bulkRegenState.startedAt = new Date().toISOString();
      bulkRegenState.completedAt = null;
      bulkRegenState.currentTopic = "";
      bulkRegenState.total = 0; // Will be updated inside the job once topics are fetched

      const userId = req.user.claims.sub;
      // Fire and forget — caller polls /api/admin/regeneration-status for progress
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

  // Admin endpoint to regenerate empty lesson content
  app.post("/api/admin/regenerate-empty-lessons", async (req: Request, res: Response) => {
    try {
      console.log("[Admin] Starting empty lesson content regeneration...");
      
      // Get all lesson units with empty content
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
      
      // Get all topics for context
      const topics = await storage.getTopics();
      const topicMap = new Map(topics.map(t => [t.id, t]));
      
      let regenerated = 0;
      let failed = 0;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      // Process in batches to avoid timeout
      const unitsToProcess = emptyUnits.slice(0, limit);
      
      for (const unit of unitsToProcess) {
        const topic = topicMap.get(unit.topicId);
        if (!topic) {
          console.log(`[Admin] Skipping unit ${unit.id} - topic ${unit.topicId} not found`);
          failed++;
          continue;
        }
        
        try {
          // ── Try seed content first (fast, deterministic) ─────────────────────
          const seedTopic = SEED_LESSON_CONTENT[unit.topicId];
          const seedUnit = seedTopic?.find(
            s => s.unitIndex === (unit as any).unitIndex && s.difficulty === unit.difficulty
          );
          
          if (seedUnit?.contentJson) {
            console.log(`[Admin] Seed content hit for: ${topic.title} - ${unit.title} (${unit.difficulty})`);
            await storage.updateLessonContent(unit.id, seedUnit.contentJson);
            regenerated++;
            continue;
          }
          
          // ── Fall back to AI generation ──────────────────────────────────────
          console.log(`[Admin] Generating content for: ${topic.title} - ${unit.title} (${unit.difficulty})`);
          
          const content = await generateLessonContent(
            { title: topic.title, description: topic.description },
            { title: unit.title, difficulty: unit.difficulty, outline: unit.outline },
            [] // No mastered topics for batch generation
          );
          
          // Only save if not placeholder
          if (!content._isPlaceholder) {
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

  // Enroll in pathway
  app.post("/api/pathways/:id/enroll", isAuthenticated, async (req: any, res: Response) => {
    try {
      const pathwayId = parseInt(req.params.id);
      if (isNaN(pathwayId) || pathwayId <= 0) {
        return res.status(400).json({ error: "Invalid pathway ID" });
      }
      const enrollment = await storage.enrollInPathway(req.user.claims.sub, pathwayId);
      res.json(enrollment);
    } catch (error) {
      console.error("Error enrolling in pathway:", error);
      res.status(500).json({ error: "Failed to enroll in pathway" });
    }
  });

  // Get user's custom pathways
  app.get("/api/user/custom-pathways", isAuthenticated, async (req: any, res: Response) => {
    try {
      const customPathways = await storage.getCustomPathways(req.user.claims.sub);
      res.json(customPathways);
    } catch (error) {
      console.error("Error fetching custom pathways:", error);
      res.status(500).json({ error: "Failed to fetch custom pathways" });
    }
  });

  // AI suggest topics for a custom pathway
  const suggestPathwaySchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().min(10).max(500),
    learningGoals: z.string().min(10).max(1000).optional(),
  });

  app.post("/api/pathways/suggest-topics", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = suggestPathwaySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.format() });
      }

      const { name, description, learningGoals } = parsed.data;

      // Get all available topics
      const allTopics = await storage.getTopics();
      const topicList = allTopics.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        difficulty: t.difficulty,
      }));

      const prompt = `You are an expert curriculum designer. A user wants to create a custom learning pathway.

Pathway Name: ${name}
Pathway Description: ${description}
${learningGoals ? `Learning Goals: ${learningGoals}` : ''}

Available Topics:
${JSON.stringify(topicList, null, 2)}

Analyze the available topics and suggest which ones should be included in this pathway. Consider:
1. Relevance to the pathway's goals
2. Logical learning order (foundations before advanced)
3. Prerequisites and dependencies between topics
4. A mix of required and optional topics

Return a JSON object with:
{
  "suggestedTopics": [
    { "topicId": number, "order": number, "isRequired": boolean, "reason": "brief explanation" }
  ],
  "estimatedHours": number (total study time),
  "difficulty": "beginner" | "intermediate" | "advanced" | "mixed",
  "icon": "Brain" | "Code" | "Calculator" | "Beaker" | "Atom" | "Book" | "Music" | "Wrench" | "Rocket" | "Leaf" | "Flask" | "Lightbulb",
  "color": "purple" | "blue" | "green" | "orange" | "pink" | "teal" | "indigo" | "lime" | "rose" | "gray"
}

Only suggest topics that are genuinely relevant. If few topics match, suggest those few rather than padding with irrelevant ones.`;

      const content = await generateCourseContent(
        [
          { role: "system", content: "You are an expert curriculum designer. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        { responseFormat: "json", maxTokens: 2048 }
      ) || '{}';
      let suggestions;
      try {
        suggestions = JSON.parse(content);
      } catch {
        return res.status(500).json({ error: "Failed to parse AI response" });
      }

      // Enrich suggestions with full topic details
      const enrichedTopics = (suggestions.suggestedTopics || []).map((s: any) => {
        const topic = allTopics.find(t => t.id === s.topicId);
        return {
          ...s,
          topic: topic || null,
        };
      }).filter((s: any) => s.topic !== null);

      // Validate and normalize AI response values
      const validDifficulties = ["beginner", "intermediate", "advanced", "mixed"];
      const validIcons = ["Brain", "Code", "Calculator", "Beaker", "Atom", "Book", "Music", "Wrench", "Rocket", "Leaf", "Flask", "Lightbulb"];
      const validColors = ["purple", "blue", "green", "orange", "pink", "teal", "indigo", "lime", "rose", "gray"];

      const estimatedHours = Math.min(1000, Math.max(1, Math.round(Number(suggestions.estimatedHours) || 30)));
      const difficulty = validDifficulties.includes(suggestions.difficulty) ? suggestions.difficulty : "mixed";
      const icon = validIcons.includes(suggestions.icon) ? suggestions.icon : "Book";
      const color = validColors.includes(suggestions.color) ? suggestions.color : "blue";

      res.json({
        suggestedTopics: enrichedTopics,
        estimatedHours,
        difficulty,
        icon,
        color,
      });
    } catch (error) {
      console.error("Error suggesting pathway topics:", error);
      res.status(500).json({ error: "Failed to suggest pathway topics" });
    }
  });

  // Create a custom pathway with topics
  const createCustomPathwaySchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().min(10).max(500),
    icon: z.string(),
    color: z.string(),
    difficulty: z.enum(["beginner", "intermediate", "advanced", "mixed"]),
    estimatedHours: z.number().int().min(1).max(1000),
    topics: z.array(z.object({
      topicId: z.number().int().positive(),
      order: z.number().int().min(0),
      isRequired: z.boolean(),
    })),
  });

  app.post("/api/pathways/create", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = createCustomPathwaySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.format() });
      }

      const { name, description, icon, color, difficulty, estimatedHours, topics } = parsed.data;
      const userId = req.user.claims.sub;

      // Create the pathway
      const pathway = await storage.createPathway({
        name,
        description,
        icon,
        color,
        difficulty,
        estimatedHours,
        isActive: true,
        createdByUserId: userId,
      });

      // Add topics to the pathway
      for (const t of topics) {
        await storage.addTopicToPathway(pathway.id, t.topicId, t.order, t.isRequired);
      }

      // Auto-enroll the user in their custom pathway
      await storage.enrollInPathway(userId, pathway.id);

      // Fetch the topics for the response
      const pathwayTopics = await storage.getPathwayTopics(pathway.id);

      res.json({
        pathway,
        topics: pathwayTopics,
      });
    } catch (error) {
      console.error("Error creating custom pathway:", error);
      res.status(500).json({ error: "Failed to create custom pathway" });
    }
  });

  // ============ ACHIEVEMENT ROUTES ============

  // Get all achievements
  app.get("/api/achievements", async (req: Request, res: Response) => {
    try {
      const allAchievements = await storage.getAchievements();
      res.json(allAchievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ error: "Failed to fetch achievements" });
    }
  });

  // Get user achievements
  app.get("/api/user/achievements", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userAchievementsList = await storage.getUserAchievements(req.user.claims.sub);
      res.json(userAchievementsList);
    } catch (error) {
      console.error("Error fetching user achievements:", error);
      res.status(500).json({ error: "Failed to fetch user achievements" });
    }
  });

  // Check and award achievements (called after various actions)
  app.post("/api/user/achievements/check", isAuthenticated, async (req: any, res: Response) => {
    try {
      const newAchievements = await storage.checkAndAwardAchievements(req.user.claims.sub);
      res.json({ newAchievements });
    } catch (error) {
      console.error("Error checking achievements:", error);
      res.status(500).json({ error: "Failed to check achievements" });
    }
  });

  // ============ CHALLENGE ROUTES ============

  // Get active challenges
  app.get("/api/challenges", async (req: Request, res: Response) => {
    try {
      const activeChallenges = await storage.getActiveChallenges();
      res.json(activeChallenges);
    } catch (error) {
      console.error("Error fetching challenges:", error);
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  // Get challenge details with leaderboard
  app.get("/api/challenges/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid challenge ID" });
      }
      const challenge = await storage.getChallengeById(id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      const leaderboard = await storage.getChallengeLeaderboard(id);
      res.json({ challenge, leaderboard });
    } catch (error) {
      console.error("Error fetching challenge:", error);
      res.status(500).json({ error: "Failed to fetch challenge" });
    }
  });

  // Join challenge
  app.post("/api/challenges/:id/join", isAuthenticated, async (req: any, res: Response) => {
    try {
      const challengeId = parseInt(req.params.id);
      if (isNaN(challengeId) || challengeId <= 0) {
        return res.status(400).json({ error: "Invalid challenge ID" });
      }
      const progress = await storage.joinChallenge(req.user.claims.sub, challengeId);
      res.json(progress);
    } catch (error) {
      console.error("Error joining challenge:", error);
      res.status(500).json({ error: "Failed to join challenge" });
    }
  });

  // ============ RESEARCH IDEAS ROUTES ============

  // Create research idea
  app.post("/api/research-ideas", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { title, description, relatedTopics } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: "Title and description are required" });
      }
      const idea = await storage.createResearchIdea({
        userId: req.user.claims.sub,
        title,
        description,
        relatedTopics,
      });
      
      // Check for Ideator achievement
      await storage.checkAndAwardAchievements(req.user.claims.sub);
      
      res.json(idea);
    } catch (error) {
      console.error("Error creating research idea:", error);
      res.status(500).json({ error: "Failed to create research idea" });
    }
  });

  // Get user research ideas
  app.get("/api/user/research-ideas", isAuthenticated, async (req: any, res: Response) => {
    try {
      const ideas = await storage.getUserResearchIdeas(req.user.claims.sub);
      res.json(ideas);
    } catch (error) {
      console.error("Error fetching research ideas:", error);
      res.status(500).json({ error: "Failed to fetch research ideas" });
    }
  });

  // Vote on research idea
  app.post("/api/research-ideas/:id/vote", isAuthenticated, async (req: any, res: Response) => {
    try {
      const ideaId = parseInt(req.params.id);
      if (isNaN(ideaId) || ideaId <= 0) {
        return res.status(400).json({ error: "Invalid idea ID" });
      }
      const idea = await storage.voteResearchIdea(ideaId);
      res.json(idea);
    } catch (error) {
      console.error("Error voting on idea:", error);
      res.status(500).json({ error: "Failed to vote on idea" });
    }
  });

  // ============ STREAK ROUTES ============

  // Get user streak
  app.get("/api/user/streak", isAuthenticated, async (req: any, res: Response) => {
    try {
      const streak = await storage.getUserStreak(req.user.claims.sub);
      res.json(streak || { currentStreak: 0, longestStreak: 0 });
    } catch (error) {
      console.error("Error fetching streak:", error);
      res.status(500).json({ error: "Failed to fetch streak" });
    }
  });

  // Update streak (called when completing a lesson)
  app.post("/api/user/streak/update", isAuthenticated, async (req: any, res: Response) => {
    try {
      const streak = await storage.updateStreak(req.user.claims.sub);
      
      // Check for streak achievements
      await storage.checkAndAwardAchievements(req.user.claims.sub);
      
      res.json(streak);
    } catch (error) {
      console.error("Error updating streak:", error);
      res.status(500).json({ error: "Failed to update streak" });
    }
  });

  // ============ CUSTOM FEEDS ROUTES ============

  // Get all custom feeds for user
  app.get("/api/custom-feeds", isAuthenticated, async (req: any, res: Response) => {
    try {
      const feeds = await storage.getCustomFeeds(req.user.claims.sub);
      res.json(feeds);
    } catch (error) {
      console.error("Error fetching custom feeds:", error);
      res.status(500).json({ error: "Failed to fetch custom feeds" });
    }
  });

  // Get a specific custom feed
  app.get("/api/custom-feeds/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ error: "Invalid feed ID" });
      }
      const feed = await storage.getCustomFeedById(feedId);
      if (!feed || feed.userId !== req.user.claims.sub) {
        return res.status(404).json({ error: "Feed not found" });
      }
      res.json(feed);
    } catch (error) {
      console.error("Error fetching custom feed:", error);
      res.status(500).json({ error: "Failed to fetch custom feed" });
    }
  });

  // Create a new custom feed
  app.post("/api/custom-feeds", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { name, topicIds, isDefault } = req.body;
      if (!name || !Array.isArray(topicIds) || topicIds.length === 0) {
        return res.status(400).json({ error: "Name and at least one topic are required" });
      }
      
      const feed = await storage.createCustomFeed({
        userId: req.user.claims.sub,
        name,
        topicIds,
        isDefault: isDefault || false,
      });
      
      // If this is set as default, update other feeds
      if (isDefault) {
        await storage.setDefaultFeed(req.user.claims.sub, feed.id);
      }
      
      res.json(feed);
    } catch (error) {
      console.error("Error creating custom feed:", error);
      res.status(500).json({ error: "Failed to create custom feed" });
    }
  });

  // Update a custom feed
  app.patch("/api/custom-feeds/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ error: "Invalid feed ID" });
      }
      
      const existingFeed = await storage.getCustomFeedById(feedId);
      if (!existingFeed || existingFeed.userId !== req.user.claims.sub) {
        return res.status(404).json({ error: "Feed not found" });
      }
      
      const { name, topicIds, isDefault } = req.body;
      const updates: any = {};
      if (name) updates.name = name;
      if (Array.isArray(topicIds)) updates.topicIds = topicIds;
      if (typeof isDefault === 'boolean') updates.isDefault = isDefault;
      
      const feed = await storage.updateCustomFeed(feedId, updates);
      
      // If setting as default, update other feeds
      if (isDefault) {
        await storage.setDefaultFeed(req.user.claims.sub, feedId);
      }
      
      res.json(feed);
    } catch (error) {
      console.error("Error updating custom feed:", error);
      res.status(500).json({ error: "Failed to update custom feed" });
    }
  });

  // Delete a custom feed
  app.delete("/api/custom-feeds/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ error: "Invalid feed ID" });
      }
      
      const existingFeed = await storage.getCustomFeedById(feedId);
      if (!existingFeed || existingFeed.userId !== req.user.claims.sub) {
        return res.status(404).json({ error: "Feed not found" });
      }
      
      await storage.deleteCustomFeed(feedId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting custom feed:", error);
      res.status(500).json({ error: "Failed to delete custom feed" });
    }
  });

  // Get user's default feed
  app.get("/api/custom-feeds/default", isAuthenticated, async (req: any, res: Response) => {
    try {
      const feed = await storage.getDefaultFeed(req.user.claims.sub);
      res.json(feed || null);
    } catch (error) {
      console.error("Error fetching default feed:", error);
      res.status(500).json({ error: "Failed to fetch default feed" });
    }
  });

  // Set default feed
  app.post("/api/custom-feeds/:id/set-default", isAuthenticated, async (req: any, res: Response) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ error: "Invalid feed ID" });
      }
      
      const existingFeed = await storage.getCustomFeedById(feedId);
      if (!existingFeed || existingFeed.userId !== req.user.claims.sub) {
        return res.status(404).json({ error: "Feed not found" });
      }
      
      await storage.setDefaultFeed(req.user.claims.sub, feedId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting default feed:", error);
      res.status(500).json({ error: "Failed to set default feed" });
    }
  });

  // Clear default feed (use all topics)
  app.post("/api/custom-feeds/clear-default", isAuthenticated, async (req: any, res: Response) => {
    try {
      await storage.setDefaultFeed(req.user.claims.sub, null);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing default feed:", error);
      res.status(500).json({ error: "Failed to clear default feed" });
    }
  });

  // Get feed cards for a custom feed
  app.get("/api/custom-feeds/:id/cards", isAuthenticated, async (req: any, res: Response) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ error: "Invalid feed ID" });
      }
      
      const feed = await storage.getCustomFeedById(feedId);
      if (!feed || feed.userId !== req.user.claims.sub) {
        return res.status(404).json({ error: "Feed not found" });
      }
      
      const limit = parseInt(req.query.limit as string) || 50;
      const cards = await storage.getFeedCardsByTopics(feed.topicIds, limit);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching feed cards:", error);
      res.status(500).json({ error: "Failed to fetch feed cards" });
    }
  });

  // ============ INFOGRAPHIC ROUTES ============

  // Get user's collected infographics
  app.get("/api/user/infographics", isAuthenticated, async (req: any, res: Response) => {
    try {
      const infographics = await storage.getUserInfographics(req.user.claims.sub);
      res.json(infographics);
    } catch (error) {
      console.error("Error fetching infographics:", error);
      res.status(500).json({ error: "Failed to fetch infographics" });
    }
  });

  // Get infographic count
  app.get("/api/user/infographics/count", isAuthenticated, async (req: any, res: Response) => {
    try {
      const count = await storage.countUserInfographics(req.user.claims.sub);
      res.json({ count });
    } catch (error) {
      console.error("Error counting infographics:", error);
      res.status(500).json({ error: "Failed to count infographics" });
    }
  });

  // Generate infographic for a topic (called on lesson completion)
  app.post("/api/infographics/generate", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { topicId, difficulty } = req.body;
      if (!topicId) {
        return res.status(400).json({ error: "Topic ID is required" });
      }

      const topic = await storage.getTopicById(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      // Get the latest lesson content for context
      const units = await storage.getLessonUnits(topicId);
      const lessonContent = units.find(u => u.difficulty === difficulty)?.contentJson;

      const { generateAndStoreInfographic } = await import("./infographic-generator");
      const result = await generateAndStoreInfographic(
        req.user.claims.sub,
        topicId,
        topic.title,
        topic.description,
        difficulty || "advanced",
        lessonContent
      );

      if (result.success) {
        res.json({ success: true, imageUrl: result.imageUrl });
      } else {
        res.status(500).json({ error: result.error || "Failed to generate infographic" });
      }
    } catch (error) {
      console.error("Error generating infographic:", error);
      res.status(500).json({ error: "Failed to generate infographic" });
    }
  });

  // ============ 3D REWARDS ROUTES ============

  // Get user's 3D rewards
  app.get("/api/user/3d-rewards", isAuthenticated, async (req: any, res: Response) => {
    try {
      const rewards = await storage.getUser3DRewards(req.user.claims.sub);
      res.json(rewards);
    } catch (error) {
      console.error("Error fetching 3D rewards:", error);
      res.status(500).json({ error: "Failed to fetch 3D rewards" });
    }
  });

  // Get pending 3D rewards count (for milestone display)
  app.get("/api/user/3d-rewards/progress", isAuthenticated, async (req: any, res: Response) => {
    try {
      const count = await storage.countUserInfographics(req.user.claims.sub);
      const rewards = await storage.getUser3DRewards(req.user.claims.sub);
      const nextMilestone = (rewards.length + 1) * 10;
      const progress = count % 10;
      
      res.json({
        infographicsCollected: count,
        rewardsEarned: rewards.length,
        nextMilestone,
        progressToNext: progress,
        percentToNext: Math.round((progress / 10) * 100)
      });
    } catch (error) {
      console.error("Error fetching 3D reward progress:", error);
      res.status(500).json({ error: "Failed to fetch 3D reward progress" });
    }
  });

  // ============ CUSTOM TOPIC ROUTES ============

  // Create custom topic request
  app.post("/api/custom-topics", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { title, description } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: "Title and description are required" });
      }
      
      const customTopic = await storage.createCustomTopic({
        userId: req.user.claims.sub,
        title,
        description,
      });
      
      // Start generating the topic in the background
      generateCustomTopicContent(customTopic.id, title, description, req.user.claims.sub).catch(console.error);
      
      res.json(customTopic);
    } catch (error) {
      console.error("Error creating custom topic:", error);
      res.status(500).json({ error: "Failed to create custom topic" });
    }
  });

  // Get user custom topics
  app.get("/api/user/custom-topics", isAuthenticated, async (req: any, res: Response) => {
    try {
      const topics = await storage.getUserCustomTopics(req.user.claims.sub);
      res.json(topics);
    } catch (error) {
      console.error("Error fetching custom topics:", error);
      res.status(500).json({ error: "Failed to fetch custom topics" });
    }
  });

  // Retry failed custom topic generation (owner only)
  app.post("/api/custom-topics/:id/retry", isAuthenticated, async (req: any, res: Response) => {
    try {
      const topicId = parseInt(req.params.id);
      if (isNaN(topicId) || topicId <= 0) {
        return res.status(400).json({ error: "Invalid topic ID" });
      }

      // Get the custom topic
      const customTopic = await storage.getCustomTopicById(topicId);
      if (!customTopic) {
        return res.status(404).json({ error: "Custom topic not found" });
      }

      // Check ownership - only the creator can retry
      if (customTopic.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "You can only retry your own custom topics" });
      }

      // Only allow retry for failed topics
      if (customTopic.status !== "failed") {
        return res.status(400).json({ error: "Only failed topics can be retried" });
      }

      // Reset status to pending and re-trigger generation
      await storage.updateCustomTopicStatus(topicId, "pending");
      
      // Start generating the topic in the background
      generateCustomTopicContent(topicId, customTopic.title, customTopic.description, req.user.claims.sub).catch(console.error);
      
      console.log(`[CustomTopic] Retry requested for topic ${topicId}: "${customTopic.title}" by user ${req.user.claims.sub}`);

      res.json({ 
        success: true, 
        message: `Retrying generation for "${customTopic.title}"`,
        topicId: customTopic.id
      });
    } catch (error) {
      console.error("Error retrying custom topic:", error);
      res.status(500).json({ error: "Failed to retry custom topic generation" });
    }
  });

  // ==================== PRACTICE TESTS ====================

  // AI chat for discussing practice test questions
  const practiceTestChatSchema = z.object({
    question: z.string().min(1),
    userAnswer: z.string(),
    correctAnswer: z.string(),
    explanation: z.string(),
    userMessage: z.string().min(1).max(2000),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })).optional().default([]),
  });

  app.post("/api/practice-tests/chat", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = practiceTestChatSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const { question, userAnswer, correctAnswer, explanation, userMessage, history } = parsed.data;
      const userId = req.user.claims.sub;
      
      // Get user's AI provider preference for chat (user pays via their API keys)
      const userProfile = await storage.getUserProfile(userId);
      const providerConfig: ProviderConfig = {
        provider: (userProfile?.preferredAiProvider as ProviderConfig["provider"]) || "gemini",
        huggingFaceToken: userProfile?.huggingFaceToken || undefined,
        ollamaUrl: userProfile?.ollamaUrl || undefined,
        openRouterKey: userProfile?.openRouterKey || undefined,
        preferredModel: userProfile?.preferredModel || undefined,
      };
      
      // Validate user has configured their own chat provider credentials
      const credentialCheck = validateUserChatCredentials(providerConfig);
      if (!credentialCheck.valid) {
        return res.status(402).json({ 
          error: "CHAT_PROVIDER_REQUIRED",
          message: "AI chat requires you to set up your own AI provider. Please configure your credentials in Settings.",
          missingCredential: credentialCheck.missingCredential,
          provider: credentialCheck.provider,
        });
      }
      
      const systemPrompt = `You are a helpful tutor helping a student understand a practice test question they got wrong.

Question: ${question}
User's Answer: ${userAnswer}
Correct Answer: ${correctAnswer}
Explanation: ${explanation}

Help the student understand why their answer was wrong and why the correct answer is right. Be encouraging and educational. If they ask follow-up questions, provide clear explanations.`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...(history || []),
        { role: "user" as const, content: userMessage }
      ];

      // Use user's selected provider for chat (not course content provider)
      const provider = getUserChatProvider(providerConfig);
      if (!provider) {
        return res.status(402).json({ 
          error: "CHAT_PROVIDER_REQUIRED",
          message: "AI chat requires you to set up your own AI provider.",
        });
      }
      const content = await provider.chat(
        messages.map(m => ({ role: m.role, content: m.content })),
        { maxTokens: 1024 }
      ) || "I couldn't generate a response. Please try again.";
      res.json({ response: content });
    } catch (error) {
      console.error("Error in practice test chat:", error);
      res.status(500).json({ error: "Failed to get AI response" });
    }
  });

  // Create practice test
  app.post("/api/practice-tests", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { testType, title, description, generateNew } = req.body;
      if (!testType || !title) {
        return res.status(400).json({ error: "Test type and title are required" });
      }
      
      const categories = getTestCategories(testType);
      
      // Check if we have enough questions in the bank (unless user wants new questions)
      const bankCount = generateNew ? 0 : await storage.getQuestionBankCount(testType);
      const minQuestionsNeeded = 5; // Use question bank if at least 5 questions available
      const useQuestionBank = bankCount >= minQuestionsNeeded && !generateNew;
      
      const practiceTest = await storage.createPracticeTest({
        userId: req.user.claims.sub,
        testType: testType.toUpperCase(),
        title,
        description: description || null,
        totalQuestions: 0,
        timeLimit: getDefaultTimeLimit(testType),
        categories,
        status: useQuestionBank ? "ready" : "generating",
      });
      
      if (useQuestionBank) {
        // Pull questions from the question bank
        const bankQuestions = await storage.getQuestionBankQuestions(testType, categories, minQuestionsNeeded);
        const questionsToInsert = bankQuestions.map((q, index) => ({
          testId: practiceTest.id,
          questionIndex: index,
          category: q.category,
          questionType: q.questionType || "multiple_choice",
          passage: q.passage || null,
          question: q.question,
          options: q.options as string[],
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          difficulty: q.difficulty || "medium",
        }));
        
        await storage.createPracticeTestQuestions(questionsToInsert);
        await storage.updatePracticeTestStatus(practiceTest.id, "ready", questionsToInsert.length);
        
        const updatedTest = await storage.getPracticeTest(practiceTest.id);
        res.json(updatedTest);
      } else {
        // Generate questions with AI in the background
        generatePracticeTestQuestions(practiceTest.id, testType, description).catch(console.error);
        res.json(practiceTest);
      }
    } catch (error) {
      console.error("Error creating practice test:", error);
      res.status(500).json({ error: "Failed to create practice test" });
    }
  });

  // Get user's practice tests
  app.get("/api/user/practice-tests", isAuthenticated, async (req: any, res: Response) => {
    try {
      const tests = await storage.getUserPracticeTests(req.user.claims.sub);
      res.json(tests);
    } catch (error) {
      console.error("Error fetching practice tests:", error);
      res.status(500).json({ error: "Failed to fetch practice tests" });
    }
  });

  // Get practice test by ID
  app.get("/api/practice-tests/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const testId = parseInt(req.params.id);
      if (isNaN(testId)) {
        return res.status(400).json({ error: "Invalid test ID" });
      }
      
      const test = await storage.getPracticeTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Practice test not found" });
      }
      
      // Only allow owner to view
      if (test.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      res.json(test);
    } catch (error) {
      console.error("Error fetching practice test:", error);
      res.status(500).json({ error: "Failed to fetch practice test" });
    }
  });

  // Get practice test questions
  app.get("/api/practice-tests/:id/questions", isAuthenticated, async (req: any, res: Response) => {
    try {
      const testId = parseInt(req.params.id);
      if (isNaN(testId)) {
        return res.status(400).json({ error: "Invalid test ID" });
      }
      
      const test = await storage.getPracticeTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Practice test not found" });
      }
      
      if (test.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const questions = await storage.getPracticeTestQuestions(testId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  // Start or resume a test attempt
  app.post("/api/practice-tests/:id/attempt", isAuthenticated, async (req: any, res: Response) => {
    try {
      const testId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const test = await storage.getPracticeTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Practice test not found" });
      }
      
      if (test.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      if (test.status !== "ready") {
        return res.status(400).json({ error: "Test is not ready yet" });
      }
      
      // Check for existing active attempt
      let attempt = await storage.getActiveAttempt(userId, testId);
      
      if (!attempt) {
        // Create new attempt
        attempt = await storage.createPracticeTestAttempt({
          userId,
          testId,
          status: "in_progress",
          answers: {},
          flaggedQuestions: [],
          timeSpent: 0,
        });
      }
      
      res.json(attempt);
    } catch (error) {
      console.error("Error starting attempt:", error);
      res.status(500).json({ error: "Failed to start test attempt" });
    }
  });

  // Update attempt answers (auto-save)
  app.patch("/api/practice-tests/attempts/:attemptId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      const { answers, flaggedQuestions, timeSpent } = req.body;
      
      const attempt = await storage.getPracticeTestAttempt(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      
      if (attempt.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      if (attempt.status !== "in_progress") {
        return res.status(400).json({ error: "Attempt already completed" });
      }
      
      // Update answers if provided
      if (answers !== undefined) {
        await storage.updateAttemptAnswers(attemptId, answers, flaggedQuestions);
      }
      
      // Update time if provided
      if (timeSpent !== undefined) {
        await storage.updateAttemptTime(attemptId, timeSpent);
      }
      
      const updated = await storage.getPracticeTestAttempt(attemptId);
      res.json(updated);
    } catch (error) {
      console.error("Error updating attempt:", error);
      res.status(500).json({ error: "Failed to update attempt" });
    }
  });

  // Submit test attempt for scoring
  app.post("/api/practice-tests/attempts/:attemptId/submit", isAuthenticated, async (req: any, res: Response) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      
      const attempt = await storage.getPracticeTestAttempt(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      
      if (attempt.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      if (attempt.status !== "in_progress") {
        return res.status(400).json({ error: "Attempt already submitted" });
      }
      
      // Get questions and calculate score
      const questions = await storage.getPracticeTestQuestions(attempt.testId);
      const answers = attempt.answers as Record<string, number>;
      
      let totalCorrect = 0;
      const categoryScores: Record<string, { correct: number; total: number }> = {};
      
      for (const question of questions) {
        const category = question.category;
        if (!categoryScores[category]) {
          categoryScores[category] = { correct: 0, total: 0 };
        }
        categoryScores[category].total++;
        
        const userAnswer = answers[question.id.toString()];
        if (userAnswer === question.correctIndex) {
          totalCorrect++;
          categoryScores[category].correct++;
        }
      }
      
      const score = questions.length > 0 ? Math.round((totalCorrect / questions.length) * 100) : 0;
      
      // Complete the attempt
      const completedAttempt = await storage.completeAttempt(attemptId, score, categoryScores);
      
      // Generate gap recommendations
      const gapRecommendations = [];
      for (const [category, scores] of Object.entries(categoryScores)) {
        const categoryScore = scores.total > 0 ? Math.round((scores.correct / scores.total) * 100) : 0;
        if (categoryScore < 70) {
          gapRecommendations.push({
            attemptId,
            category,
            gapScore: 100 - categoryScore,
            suggestedTopicTitle: `${category} Deep Dive`,
            suggestedTopicDescription: `Strengthen your understanding of ${category} concepts based on your practice test results.`,
          });
        }
      }
      
      if (gapRecommendations.length > 0) {
        await storage.createTestGapRecommendations(gapRecommendations);
      }
      
      res.json({
        attempt: completedAttempt,
        categoryScores,
        recommendations: gapRecommendations,
      });
    } catch (error) {
      console.error("Error submitting attempt:", error);
      res.status(500).json({ error: "Failed to submit attempt" });
    }
  });

  // Get attempt results
  app.get("/api/practice-tests/attempts/:attemptId/results", isAuthenticated, async (req: any, res: Response) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      
      const attempt = await storage.getPracticeTestAttempt(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      
      if (attempt.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const test = await storage.getPracticeTest(attempt.testId);
      const questions = await storage.getPracticeTestQuestions(attempt.testId);
      const recommendations = await storage.getTestGapRecommendations(attemptId);
      
      res.json({
        attempt,
        test,
        questions,
        recommendations,
      });
    } catch (error) {
      console.error("Error fetching results:", error);
      res.status(500).json({ error: "Failed to fetch results" });
    }
  });

  // Get user's completed test attempts
  app.get("/api/user/practice-test-attempts", isAuthenticated, async (req: any, res: Response) => {
    try {
      const attempts = await storage.getUserPracticeTestAttempts(req.user.claims.sub);
      res.json(attempts);
    } catch (error) {
      console.error("Error fetching attempts:", error);
      res.status(500).json({ error: "Failed to fetch attempts" });
    }
  });

  // ==========================================
  // OPEN SCIENCE: IDEAS & DISCUSSIONS
  // ==========================================
  
  app.get("/api/open-science", async (_req: Request, res: Response) => {
    try {
      const ideas = await storage.getOpenScienceIdeas();
      res.json(ideas);
    } catch (e) {
      console.error("Error fetching open science ideas", e);
      res.status(500).json({ error: "Failed to fetch ideas" });
    }
  });

  app.post("/api/open-science", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = insertOpenScienceIdeaSchema.parse({
        ...req.body,
        userId: req.user.claims.sub,
        authorName: req.user.claims.username || "Anonymous Researcher",
      });
      const created = await storage.createOpenScienceIdea(parsed);
      res.json(created);
    } catch (e) {
      console.error("Error creating open science idea", e);
      res.status(400).json({ error: "Failed to create idea" });
    }
  });

  app.post("/api/open-science/:id/upvote", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.upvoteOpenScienceIdea(id);
      res.json(updated);
    } catch (e) {
      console.error("Error upvoting open science idea", e);
      res.status(500).json({ error: "Failed to upvote" });
    }
  });

  app.get("/api/open-science/:id/comments", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const comments = await storage.getOpenScienceComments(id);
      res.json(comments);
    } catch (e) {
      console.error("Error fetching comments", e);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/open-science/:id/comments", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = insertOpenScienceCommentSchema.parse({
        ideaId: parseInt(req.params.id),
        userId: req.user.claims.sub,
        authorName: req.user.claims.username || "Anonymous Researcher",
        content: req.body.content,
      });
      const created = await storage.createOpenScienceComment(parsed);
      res.json(created);
    } catch (e) {
      console.error("Error creating open science comment", e);
      res.status(400).json({ error: "Failed to create comment" });
    }
  });

  // Auto-seed pathway topics on startup if missing
  try {
    const pathways = await storage.getPathways();
    if (pathways.length > 0) {
      const firstPathwayTopics = await storage.getPathwayTopics(pathways[0].id);
      if (firstPathwayTopics.length === 0) {
        console.log("[Startup] No pathway topics found, auto-seeding pathway-topic mappings...");
        let seeded = 0;
        for (const pt of DEFAULT_PATHWAY_TOPICS) {
          try {
            await storage.addTopicToPathway(pt.pathwayId, pt.topicId, pt.order, pt.isRequired);
            seeded++;
          } catch (e) {
            // Ignore duplicates or invalid references
          }
        }
        console.log(`[Startup] Auto-seeded ${seeded} pathway-topic mappings`);
      }
    }
  } catch (e) {
    console.error("[Startup] Error auto-seeding pathway topics:", e);
  }

  return httpServer;
