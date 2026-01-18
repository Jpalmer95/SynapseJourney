import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerChatRoutes } from "./replit_integrations/chat";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Validation schemas
const saveCardSchema = z.object({
  cardId: z.number().int().positive(),
});

const progressSchema = z.object({
  topicId: z.number().int().positive(),
  status: z.enum(["discovered", "learning", "mastered"]).optional().default("discovered"),
  mastery: z.number().int().min(0).max(100).optional().default(0),
  timeSpent: z.number().int().min(0).optional().default(0),
});

const chatMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  topicId: z.number().int().positive().optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
});

// Roadmap level schema for AI response validation
const roadmapLevelSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  difficulty: z.string(),
  completed: z.boolean(),
  content: z.string().optional(),
});

const roadmapResponseSchema = z.object({
  levels: z.array(roadmapLevelSchema),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication first
  await setupAuth(app);
  registerAuthRoutes(app);
  registerChatRoutes(app);

  // Feed endpoint - public for now to show content to non-logged users
  app.get("/api/feed", async (req: Request, res: Response) => {
    try {
      const feedCards = await storage.getFeedCards(20);
      res.json(feedCards);
    } catch (error) {
      console.error("Error fetching feed:", error);
      res.status(500).json({ error: "Failed to fetch feed" });
    }
  });

  // Categories
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Topics
  app.get("/api/topics", async (req: Request, res: Response) => {
    try {
      const topics = await storage.getTopics();
      res.json(topics);
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ error: "Failed to fetch topics" });
    }
  });

  app.get("/api/topics/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid topic ID" });
      }
      const topic = await storage.getTopicById(id);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      res.json(topic);
    } catch (error) {
      console.error("Error fetching topic:", error);
      res.status(500).json({ error: "Failed to fetch topic" });
    }
  });

  // Cards for a topic
  app.get("/api/topics/:id/cards", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid topic ID" });
      }
      const cards = await storage.getCardsByTopic(id);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching cards:", error);
      res.status(500).json({ error: "Failed to fetch cards" });
    }
  });

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
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
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
            response_format: { type: "json_object" },
            max_completion_tokens: 2048,
          });

          const content = response.choices[0]?.message?.content || '{"levels":[]}';
          
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

  // AI Chat endpoint
  app.post("/api/ai/chat", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validationResult = chatMessageSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: validationResult.error.flatten() 
        });
      }

      const { message, topicId, history } = validationResult.data;

      // Get topic context if provided
      let topicContext = "";
      if (topicId) {
        const topic = await storage.getTopicById(topicId);
        if (topic) {
          topicContext = `The user is currently learning about: ${topic.title}. Description: ${topic.description}. `;
        }
      }

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const systemPrompt = `You are a Socratic AI learning companion called Synapse. Your role is to:
1. Guide learners through concepts using questions, not just answers
2. Be encouraging and supportive
3. Explain complex terms simply when asked
4. Connect ideas across different fields
5. Suggest practical applications and projects
6. Use analogies to make concepts accessible

${topicContext}

Be conversational, warm, and genuinely curious about helping the learner understand. If they seem stuck, offer gentle hints. If they're doing well, challenge them with deeper questions.`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: message },
      ];

      try {
        const stream = await openai.chat.completions.create({
          model: "gpt-4o",
          messages,
          stream: true,
          max_completion_tokens: 1024,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (aiError) {
        console.error("AI chat error:", aiError);
        res.write(`data: ${JSON.stringify({ error: "AI service temporarily unavailable. Please try again." })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Error in AI chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to process message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process message" });
      }
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
      const feedCards = await storage.getFeedCardsFiltered(userId, 20);
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
      }

      // Get user's mastery status
      const mastery = await storage.getOrCreateTopicMastery(req.user.claims.sub, topicId);
      
      // Get user's progress for each unit
      const unitsWithProgress = await Promise.all(units.map(async (unit) => {
        const progress = await storage.getLessonProgress(req.user.claims.sub, unit.id);
        return {
          ...unit,
          progress: progress || null,
          locked: !isUnitUnlocked(unit.difficulty, mastery),
        };
      }));

      res.json({
        topic,
        units: unitsWithProgress,
        mastery,
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

      // Check if user has unlocked this difficulty level
      const mastery = await storage.getOrCreateTopicMastery(req.user.claims.sub, unit.topicId);
      if (!isUnitUnlocked(unit.difficulty, mastery)) {
        return res.status(403).json({ 
          error: "This lesson is locked",
          message: "Complete more lessons in the previous difficulty to unlock this level."
        });
      }

      // If content already exists, return it
      if (unit.contentJson) {
        return res.json({ unit, content: unit.contentJson, isNextGen: unit.difficulty === "nextgen" });
      }

      // Generate content using AI - use different generator for Next Gen
      const masteredTopics = await storage.getUserMasteredTopics(req.user.claims.sub);
      const isNextGen = unit.difficulty === "nextgen";
      const content = isNextGen 
        ? await generateNextGenContent(topic, unit, masteredTopics)
        : await generateLessonContent(topic, unit, masteredTopics);
      
      // Save the generated content
      const updatedUnit = await storage.updateLessonContent(unitId, content);

      res.json({ unit: updatedUnit, content, isNextGen });
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

      res.json({ 
        progress, 
        xpAwarded: totalXp,
        mastery,
        newAchievements,
        message: mastery.intermediateUnlocked || mastery.advancedUnlocked 
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
      const { ageRange, technicalLevel, priorExperience, allowTestOut, huggingFaceToken, preferredAiProvider } = req.body;
      const profile = await storage.createOrUpdateUserProfile(req.user.claims.sub, {
        ageRange,
        technicalLevel,
        priorExperience,
        allowTestOut,
        huggingFaceToken,
        preferredAiProvider,
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
      generateCustomTopicContent(customTopic.id, title, description).catch(console.error);
      
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

  // Search topics (for custom topic creation)
  app.get("/api/topics/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      const allTopics = await storage.getTopics();
      const filtered = allTopics.filter(t => 
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.description.toLowerCase().includes(query.toLowerCase())
      );
      res.json(filtered.slice(0, 10));
    } catch (error) {
      console.error("Error searching topics:", error);
      res.status(500).json({ error: "Failed to search topics" });
    }
  });

  return httpServer;
}

// Generate custom topic content using AI
async function generateCustomTopicContent(customTopicId: number, title: string, description: string) {
  try {
    await storage.updateCustomTopicStatus(customTopicId, "generating");
    
    // Generate a category for this topic
    const categoryPrompt = `Given the learning topic "${title}" (${description}), suggest the best category name, color (purple, blue, green, orange, pink, or teal), and icon (Brain, Code, Calculator, Beaker, Atom, Book, Music, Wrench, Rocket, Leaf, Flask, or Lightbulb) for this topic. Return JSON: { "name": "Category Name", "color": "blue", "icon": "Code" }`;
    
    const categoryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: categoryPrompt }],
      response_format: { type: "json_object" },
    });
    
    const categoryData = JSON.parse(categoryResponse.choices[0].message.content || "{}");
    
    // Create or find category
    let category;
    try {
      category = await storage.createCategory({
        name: categoryData.name || title,
        color: categoryData.color || "blue",
        icon: categoryData.icon || "Book",
      });
    } catch (e) {
      // Category might already exist
      const categories = await storage.getCategories();
      category = categories.find(c => c.name === categoryData.name) || categories[0];
    }
    
    // Create the topic
    const topic = await storage.createTopic({
      title,
      description,
      categoryId: category.id,
      difficulty: "beginner",
    });
    
    // Generate lesson outline
    const units = await generateLessonOutline(topic.id, title, description);
    
    // Create lesson units
    for (const unit of units) {
      await storage.createLessonUnit({
        topicId: topic.id,
        difficulty: unit.difficulty,
        unitIndex: unit.unitIndex,
        title: unit.title,
        outline: unit.outline,
      });
    }
    
    // Update custom topic status
    await storage.updateCustomTopicStatus(customTopicId, "ready", topic.id, category.id);
    
  } catch (error) {
    console.error("Error generating custom topic:", error);
    await storage.updateCustomTopicStatus(customTopicId, "failed");
  }
}

// Helper function to check if a difficulty level is unlocked
function isUnitUnlocked(difficulty: string, mastery: { beginnerUnlocked: boolean; intermediateUnlocked: boolean; advancedUnlocked: boolean; nextgenUnlocked?: boolean }): boolean {
  switch (difficulty) {
    case "beginner": return mastery.beginnerUnlocked;
    case "intermediate": return mastery.intermediateUnlocked;
    case "advanced": return mastery.advancedUnlocked;
    case "nextgen": return mastery.nextgenUnlocked ?? false;
    default: return mastery.beginnerUnlocked;
  }
}

// Generate lesson outline using AI
async function generateLessonOutline(topicId: number, topicTitle: string, topicDescription: string): Promise<any[]> {
  const prompt = `You are an expert curriculum designer. Create a structured learning outline for the topic "${topicTitle}".

Topic Description: ${topicDescription}

Create a course outline with units across FOUR difficulty levels. Each level should have 3-4 units that progressively build understanding.

Respond with a JSON object in this exact format:
{
  "units": [
    {"difficulty": "beginner", "unitIndex": 0, "title": "Unit Title", "outline": "Brief 1-2 sentence description of what this unit covers"},
    {"difficulty": "beginner", "unitIndex": 1, "title": "Unit Title", "outline": "Brief description"},
    {"difficulty": "intermediate", "unitIndex": 0, "title": "Unit Title", "outline": "Brief description"},
    {"difficulty": "advanced", "unitIndex": 0, "title": "Unit Title", "outline": "Brief description"},
    {"difficulty": "nextgen", "unitIndex": 0, "title": "Unit Title", "outline": "Brief description"}
  ]
}

Guidelines:
- Beginner units should use simple language and everyday analogies
- Intermediate units should explore mechanisms and relationships  
- Advanced units should cover edge cases, research, and expert applications
- Next Gen (nextgen) units should focus on CUTTING-EDGE RESEARCH QUESTIONS, active industry challenges, unsolved problems, and creative frontier exploration. These encourage learners to think like researchers and contribute new ideas.
- Each unit title should be concise (3-6 words)
- Outlines should be specific to the content covered`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(content);
    
    if (!parsed.units || !Array.isArray(parsed.units)) {
      throw new Error("Invalid AI response format");
    }

    // Save units to database
    const { storage } = await import("./storage");
    const createdUnits = await Promise.all(
      parsed.units.map((u: any) => storage.createLessonUnit({
        topicId,
        difficulty: u.difficulty,
        unitIndex: u.unitIndex,
        title: u.title,
        outline: u.outline,
      }))
    );

    return createdUnits;
  } catch (error) {
    console.error("Error generating lesson outline:", error);
    // Return default outline on failure
    return getDefaultLessonUnits(topicId, topicTitle);
  }
}

// Generate lesson content using AI
async function generateLessonContent(
  topic: { title: string; description: string },
  unit: { title: string; difficulty: string; outline?: string | null },
  masteredTopics: { topicId: number; topicTitle: string }[]
): Promise<any> {
  const crossTopicContext = masteredTopics.length > 0
    ? `The learner has already mastered these topics: ${masteredTopics.map(t => t.topicTitle).join(", ")}. When relevant, draw connections to these concepts they already understand.`
    : "";

  const prompt = `You are a Socratic learning tutor. Create engaging lesson content for:

Topic: ${topic.title}
Unit: ${unit.title}
Difficulty Level: ${unit.difficulty}
Unit Description: ${unit.outline || ""}

${crossTopicContext}

Create comprehensive lesson content in this JSON format:
{
  "concept": "Clear explanation of the main concept (2-3 paragraphs, engaging and accessible)",
  "analogy": "A creative real-world analogy that makes the concept intuitive",
  "example": {
    "title": "Example title",
    "content": "Detailed worked example with step-by-step explanation",
    "code": "Optional: code snippet if relevant to the topic"
  },
  "quiz": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct and others are not"
    }
  ],
  "crossLinks": [
    {
      "topicId": 1,
      "topicTitle": "Related Topic",
      "connection": "How this concept connects to the related topic"
    }
  ]
}

Guidelines for ${unit.difficulty} level:
${unit.difficulty === "beginner" 
  ? "- Use simple language, no jargon\n- Rely on everyday analogies\n- Focus on 'what' rather than 'how'\n- Create basic comprehension quiz questions"
  : unit.difficulty === "intermediate"
  ? "- Explain mechanisms and relationships\n- Include practical applications\n- Connect to related concepts\n- Create application-based quiz questions"
  : unit.difficulty === "advanced"
  ? "- Explore edge cases and nuances\n- Reference current research or debates\n- Challenge assumptions\n- Create analytical quiz questions"
  : "- This is NEXT GEN content - focus on frontier research and creative challenges\n- Present open-ended thought exercises instead of traditional quizzes\n- Encourage creative synthesis of ideas\n- Reference active research questions in the field"}

Include 3 quiz questions.
${masteredTopics.length > 0 ? "Include 1-2 cross-links to mastered topics if relevant." : "Leave crossLinks as an empty array."}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error("Error generating lesson content:", error);
    // Return default content on failure
    return {
      concept: `This lesson covers ${unit.title} in ${topic.title}. Content is being generated...`,
      analogy: "Think of this concept like a familiar everyday process.",
      example: {
        title: "Example",
        content: "A detailed example will be provided here.",
      },
      quiz: [
        {
          question: `What is the main focus of ${unit.title}?`,
          options: ["Understanding basics", "Advanced theory", "History", "None of the above"],
          correctIndex: 0,
          explanation: "This unit focuses on building foundational understanding."
        }
      ],
      crossLinks: []
    };
  }
}

// Default lesson units when AI fails
async function getDefaultLessonUnits(topicId: number, topicTitle: string) {
  const { storage } = await import("./storage");
  const defaultUnits = [
    { difficulty: "beginner", unitIndex: 0, title: "Introduction & Basics", outline: `Get started with the fundamentals of ${topicTitle}` },
    { difficulty: "beginner", unitIndex: 1, title: "Core Vocabulary", outline: "Learn the essential terms and concepts" },
    { difficulty: "beginner", unitIndex: 2, title: "Simple Examples", outline: "See the concepts in action with easy examples" },
    { difficulty: "intermediate", unitIndex: 0, title: "Deeper Mechanisms", outline: "Understand how things work under the hood" },
    { difficulty: "intermediate", unitIndex: 1, title: "Practical Applications", outline: "Apply your knowledge to real scenarios" },
    { difficulty: "intermediate", unitIndex: 2, title: "Common Patterns", outline: "Recognize recurring themes and approaches" },
    { difficulty: "advanced", unitIndex: 0, title: "Edge Cases", outline: "Explore unusual situations and exceptions" },
    { difficulty: "advanced", unitIndex: 1, title: "Current Research", outline: "Discover what experts are working on today" },
    { difficulty: "advanced", unitIndex: 2, title: "Expert Applications", outline: "See how professionals use these concepts" },
    { difficulty: "nextgen", unitIndex: 0, title: "Open Research Questions", outline: "Explore unsolved problems and cutting-edge questions in the field" },
    { difficulty: "nextgen", unitIndex: 1, title: "Industry Frontiers", outline: "Discover active challenges and emerging opportunities" },
    { difficulty: "nextgen", unitIndex: 2, title: "Creative Synthesis", outline: "Combine ideas from different domains for breakthrough insights" },
  ];

  return Promise.all(defaultUnits.map(u => storage.createLessonUnit({ topicId, ...u })));
}

// Generate Next Gen content using AI (frontier research and creative challenges)
async function generateNextGenContent(
  topic: { title: string; description: string },
  unit: { title: string; outline?: string | null },
  masteredTopics: { topicId: number; topicTitle: string }[]
): Promise<any> {
  const crossTopicContext = masteredTopics.length > 0
    ? `The learner has mastered these topics and can draw connections: ${masteredTopics.map(t => t.topicTitle).join(", ")}.`
    : "";

  const prompt = `You are a research mentor helping advanced learners engage with cutting-edge questions in "${topic.title}".

Unit: ${unit.title}
Unit Focus: ${unit.outline || "Frontier exploration and creative thinking"}

${crossTopicContext}

Create content that sparks curiosity and encourages creative thinking about active research and industry challenges.

Respond with JSON in this format:
{
  "researchContext": "2-3 paragraphs explaining the current state of research/industry in this area, what we know, and what remains unknown or debated",
  "industryChallenge": {
    "title": "A specific challenge or problem being actively worked on",
    "description": "Detailed explanation of why this is challenging",
    "currentApproaches": ["Approach 1 being tried", "Approach 2", "Approach 3"],
    "openQuestions": ["Unanswered question 1", "Question 2", "Question 3"]
  },
  "thoughtExercises": [
    {
      "prompt": "An open-ended question that encourages creative thinking",
      "hints": ["Hint to get started", "Another angle to consider"],
      "explorationPaths": ["One direction to explore", "Another possibility"]
    }
  ],
  "emergingTrends": [
    {
      "trend": "A significant emerging trend in this field",
      "implications": "What this could mean for the future",
      "potentialBreakthroughs": "Possible breakthrough outcomes"
    }
  ],
  "creativeSynthesis": {
    "challenge": "A creative challenge that asks learners to combine concepts in novel ways",
    "relatedConcepts": ["Concept from this topic", "Related idea"],
    "suggestedConnections": ["Cross-domain connection to explore", "Unexpected application area"]
  },
  "resources": [
    {
      "title": "Resource title",
      "type": "paper/blog/tool/community",
      "description": "Brief description of the resource"
    }
  ]
}

Guidelines:
- Focus on REAL current research questions and industry challenges
- Include 2-3 thought exercises that encourage original thinking
- Include 2-3 emerging trends relevant to this topic
- The creative synthesis should encourage cross-pollination of ideas
- Make resources diverse: academic papers, industry blogs, tools, and communities
- This is about exploration and creativity, not right/wrong answers`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8, // Higher creativity for frontier content
    });

    const content = response.choices[0].message.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error("Error generating Next Gen content:", error);
    return {
      researchContext: `This explores the cutting edge of ${topic.title}. Researchers and industry leaders are actively working on new frontiers in this space.`,
      industryChallenge: {
        title: `Current Frontiers in ${topic.title}`,
        description: "Explore the most challenging open problems in this field.",
        currentApproaches: ["Traditional methods", "Emerging technologies", "Hybrid approaches"],
        openQuestions: ["What are the limits of current approaches?", "How can we improve efficiency?", "What new paradigms might emerge?"]
      },
      thoughtExercises: [
        {
          prompt: `If you could redesign ${topic.title} from scratch, what would you change?`,
          hints: ["Consider current limitations", "Think about user needs"],
          explorationPaths: ["Start with first principles", "Look at analogies from other fields"]
        }
      ],
      emergingTrends: [
        {
          trend: "Emerging approaches in this space",
          implications: "Could transform how we think about this topic",
          potentialBreakthroughs: "New capabilities and applications"
        }
      ],
      creativeSynthesis: {
        challenge: `Combine your knowledge of ${topic.title} with another field you're interested in to propose a novel application.`,
        relatedConcepts: [topic.title, "Cross-domain thinking"],
        suggestedConnections: ["Biology and technology", "Art and science", "Local and global perspectives"]
      },
      resources: []
    };
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function getDefaultLevels(topicTitle: string) {
  return [
    {
      id: 1,
      title: "The Basics",
      description: "Understand the fundamental concepts",
      difficulty: "beginner",
      completed: false,
      content: `Start with a simple explanation of ${topicTitle} that anyone can understand. This level introduces core vocabulary and basic principles.`,
    },
    {
      id: 2,
      title: "Core Concepts",
      description: "Dive deeper into the main ideas",
      difficulty: "intermediate",
      completed: false,
      content: `Now we explore the underlying mechanisms and relationships between concepts in ${topicTitle}.`,
    },
    {
      id: 3,
      title: "Real-World Applications",
      description: "See how it applies in practice",
      difficulty: "intermediate",
      completed: false,
      content: `Discover how ${topicTitle} manifests in everyday scenarios and professional contexts.`,
    },
    {
      id: 4,
      title: "Advanced Topics",
      description: "Master the complexities",
      difficulty: "advanced",
      completed: false,
      content: `Challenge yourself with nuanced aspects and edge cases of ${topicTitle} that require deeper understanding.`,
    },
    {
      id: 5,
      title: "Expert Insights",
      description: "Explore cutting-edge developments",
      difficulty: "expert",
      completed: false,
      content: `Connect with the latest research and innovations in ${topicTitle}.`,
    },
  ];
}
