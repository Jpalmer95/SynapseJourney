import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { registerChatRoutes } from "./replit_integrations/chat";
import OpenAI from "openai";
import { z } from "zod";

// Admin emails - users who can regenerate lesson content
const ADMIN_EMAILS = ["jpkorstad@gmail.com"];

// Helper function to check if user is admin by their email
async function isAdminUser(userId: string): Promise<boolean> {
  const user = await authStorage.getUser(userId);
  if (!user?.email) return false;
  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}
import { 
  getUserChatProvider,
  validateUserChatCredentials,
  generateCourseContent,
  type ProviderConfig 
} from "./ai-providers";
import { DEFAULT_CATEGORIES, DEFAULT_PATHWAYS, DEFAULT_TOPICS, DEFAULT_KNOWLEDGE_CARDS, DEFAULT_PATHWAY_TOPICS } from "./seed-data";

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

      // Get user's preferred AI provider
      const userProfile = await storage.getUserProfile(userId);
      const providerConfig: ProviderConfig = {
        provider: (userProfile?.preferredAiProvider as "openai" | "huggingface" | "ollama" | "openrouter") || "openai",
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
        // Get user's chat provider (requires their own credentials)
        // This check should never trigger since we validate above, but keeping as safety net
        const provider = getUserChatProvider(providerConfig);
        if (!provider) {
          res.write(`data: ${JSON.stringify({ error: "CHAT_PROVIDER_REQUIRED", message: "AI chat requires you to set up your own AI provider." })}\n\n`);
          res.end();
          return;
        }
        const response = await provider.chat(
          messages.map(m => ({ role: m.role, content: m.content })),
          { maxTokens: 1024 }
        );
        
        // Send the full response at once (streaming not supported by Gemini AI Integrations)
        res.write(`data: ${JSON.stringify({ content: response })}\n\n`);

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
        // Generate content using AI - use different generator for Next Gen
        const generatedContent = isNextGen 
          ? await generateNextGenContent(topic, unit, masteredTopics)
          : await generateLessonContent(topic, unit, masteredTopics, categoryName);
        
        // Only save real AI-generated content, NOT placeholder fallbacks
        if ((generatedContent as any)._isPlaceholder) {
          console.log(`Content generation failed for unit ${unitId}, returning placeholder without saving`);
          return res.json({ unit, content: generatedContent, isNextGen, isTemporary: true });
        }
        
        const updatedUnit = await storage.updateLessonContent(unitId, generatedContent);
        content = generatedContent;

        // Predictive pre-generation: asynchronously generate next unit's content
        predictivelyGenerateNextUnit(unit, topic, masteredTopics, userId, categoryName).catch(console.error);

        return res.json({ unit: updatedUnit, content, isNextGen });
      }

      // Content already exists — still trigger predictive pre-gen in background
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

      return res.json({ unit, content, isNextGen });
    } catch (error) {
      console.error("Error fetching lesson content:", error);
      res.status(500).json({ error: "Failed to fetch lesson content" });
    }
  });

  // ============================================
  // TTS ENDPOINTS
  // ============================================

  app.get("/api/tts/settings", isAuthenticated, async (req: any, res: Response) => {
    try {
      const settings = await storage.getTtsSettings(req.user.claims.sub);
      res.json(settings);
    } catch (err) {
      console.error("TTS settings fetch error:", err);
      res.status(500).json({ error: "Failed to fetch TTS settings" });
    }
  });

  app.put("/api/tts/settings", isAuthenticated, async (req: any, res: Response) => {
    try {
      const schema = z.object({
        voicePreset: z.string().min(1),
        playbackSpeed: z.number().min(0.5).max(3).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid settings" });
      const { voicePreset, playbackSpeed } = parsed.data;
      await storage.saveTtsSettings(req.user.claims.sub, voicePreset, undefined, playbackSpeed);
      res.json({ ok: true });
    } catch (err) {
      console.error("TTS settings save error:", err);
      res.status(500).json({ error: "Failed to save TTS settings" });
    }
  });

  app.post("/api/tts/voice-upload", isAuthenticated, async (req: any, res: Response) => {
    try {
      const schema = z.object({
        audioBase64: z.string().min(1),
        mimeType: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid audio data" });

      const { audioBase64 } = parsed.data;
      const sizeBytes = Buffer.from(audioBase64, "base64").length;
      if (sizeBytes > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Reference audio must be under 5MB" });
      }

      await storage.saveTtsSettings(req.user.claims.sub, "custom", audioBase64);
      res.json({ ok: true, message: "Voice reference uploaded successfully" });
    } catch (err) {
      console.error("TTS voice upload error:", err);
      res.status(500).json({ error: "Failed to upload voice reference" });
    }
  });

  app.post("/api/tts/generate", isAuthenticated, async (req: any, res: Response) => {
    try {
      const schema = z.object({
        unitId: z.number().int().positive(),
        forceRegenerate: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

      const { unitId, forceRegenerate } = parsed.data;
      const userId = req.user.claims.sub;

      const unit = await storage.getLessonUnit(unitId);
      if (!unit?.contentJson) {
        return res.status(404).json({ error: "Lesson content not found. Load the lesson first." });
      }

      const ttsSettings = await storage.getTtsSettings(userId);
      const { voicePreset, referenceAudio, playbackSpeed } = ttsSettings;

      if (voicePreset === "browser") {
        return res.json({ fallback: true, message: "Browser TTS is selected" });
      }

      const { hashVoiceConfig, hashBase64 } = await import("./tts-service");
      const refHash = referenceAudio ? hashBase64(referenceAudio) : undefined;
      const configHash = hashVoiceConfig(voicePreset, refHash);

      if (!forceRegenerate) {
        const cached = await storage.getTtsAudioCache(unitId, configHash);
        if (cached) {
          return res.json({ 
            audioData: cached.audioData, 
            audioFormat: cached.audioFormat,
            fromCache: true,
            fallback: false,
            playbackSpeed,
          });
        }
      }

      const userProfile = await storage.getUserProfile(userId);
      const { generateTTSAudio } = await import("./tts-service");
      const result = await generateTTSAudio({
        unitId,
        content: unit.contentJson,
        isNextGen: unit.difficulty === "nextgen",
        voicePreset,
        referenceAudio: referenceAudio || undefined,
        hfToken: userProfile?.huggingFaceToken || undefined,
      });

      if (!result) {
        return res.json({ fallback: true, message: "TTS generation failed — browser fallback" });
      }

      await storage.saveTtsAudioCache(unitId, configHash, result.audioData, result.audioFormat);

      res.json({ ...result, playbackSpeed });
    } catch (err) {
      console.error("TTS generate error:", err);
      res.status(500).json({ fallback: true, error: "TTS service unavailable" });
    }
  });

  app.get("/api/tts/presets", (_req, res) => {
    import("./tts-service").then(({ VOICE_PRESETS }) => res.json(VOICE_PRESETS));
  });

  app.get("/api/tts/cache-status/:unitId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const unitId = parseInt(req.params.unitId);
      if (isNaN(unitId)) return res.status(400).json({ error: "Invalid unit ID" });
      const ttsSettings = await storage.getTtsSettings(req.user.claims.sub);
      const { hashVoiceConfig, hashBase64 } = await import("./tts-service");
      const refHash = ttsSettings.referenceAudio ? hashBase64(ttsSettings.referenceAudio) : undefined;
      const configHash = hashVoiceConfig(ttsSettings.voicePreset, refHash);
      const cached = await storage.getTtsAudioCache(unitId, configHash);
      res.json({ cached: !!cached, voicePreset: ttsSettings.voicePreset });
    } catch (err) {
      res.json({ cached: false });
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
      
      console.log(`[Admin] Generating new content for unit ${unitId} (${unit.difficulty} level)...`);
      
      const content = isNextGen 
        ? await generateNextGenContent(topic, unit, masteredTopics)
        : await generateLessonContent(topic, unit, masteredTopics);
      
      // Check if content generation succeeded
      if (content._isPlaceholder) {
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
      
      const totalSeeded = categoriesSeeded + topicsSeeded + cardsSeeded + pathwaysSeeded + pathwayTopicsSeeded;
      console.log(`[API SeedDefaults] Completed seeding: ${categoriesSeeded} categories, ${topicsSeeded} topics, ${cardsSeeded} cards, ${pathwaysSeeded} pathways`);
      
      res.json({
        success: true,
        seeded: {
          categories: categoriesSeeded,
          topics: topicsSeeded,
          knowledgeCards: cardsSeeded,
          pathways: pathwaysSeeded,
        },
        message: totalSeeded > 0 ? "Default content seeded successfully" : "Database already has content, no seeding needed"
      });
    } catch (error) {
      console.error("[API SeedDefaults] Error seeding defaults:", error);
      res.status(500).json({ error: "Failed to seed default content" });
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
      generateCustomTopicContent(topicId, customTopic.title, customTopic.description).catch(console.error);
      
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
}

// ============================================
// PREDICTIVE PRE-GENERATION HELPERS
// ============================================

const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced", "nextgen"];

async function predictivelyGenerateNextUnit(
  currentUnit: { topicId: number; difficulty: string; unitIndex: number },
  topic: { title: string; description: string },
  masteredTopics: { topicId: number; topicTitle: string }[],
  userId: string,
  categoryName?: string
): Promise<void> {
  try {
    const allUnits = await storage.getLessonUnits(currentUnit.topicId);
    const diffUnits = allUnits
      .filter(u => u.difficulty === currentUnit.difficulty)
      .sort((a, b) => a.unitIndex - b.unitIndex);

    let nextUnit: typeof allUnits[0] | undefined;

    // Try next unit in same difficulty
    const nextInDiff = diffUnits.find(u => u.unitIndex === currentUnit.unitIndex + 1);
    if (nextInDiff) {
      nextUnit = nextInDiff;
    } else {
      // Try first unit of next difficulty
      const currentDiffIdx = DIFFICULTY_ORDER.indexOf(currentUnit.difficulty);
      if (currentDiffIdx >= 0 && currentDiffIdx < DIFFICULTY_ORDER.length - 1) {
        const nextDiff = DIFFICULTY_ORDER[currentDiffIdx + 1];
        const nextDiffUnits = allUnits
          .filter(u => u.difficulty === nextDiff)
          .sort((a, b) => a.unitIndex - b.unitIndex);
        nextUnit = nextDiffUnits[0];
      }
    }

    if (!nextUnit || nextUnit.contentJson) return;

    console.log(`[Predictive] Pre-generating content for unit ${nextUnit.id} (${nextUnit.difficulty} #${nextUnit.unitIndex})`);
    const isNextGen = nextUnit.difficulty === "nextgen";
    const content = isNextGen
      ? await generateNextGenContent(topic, nextUnit, masteredTopics)
      : await generateLessonContent(topic, nextUnit, masteredTopics, categoryName);

    if (!(content as any)._isPlaceholder) {
      await storage.updateLessonContent(nextUnit.id, content);
      console.log(`[Predictive] Saved content for unit ${nextUnit.id}`);
      // Also pre-generate TTS for the next unit
      await preTTSForUnit(userId, nextUnit.id, content, isNextGen);
    }
  } catch (err) {
    console.warn("[Predictive] Pre-generation error:", (err as any)?.message || err);
  }
}

async function revalidateUnitLinks(unitId: number, content: any): Promise<void> {
  try {
    const { revalidateStoredContent } = await import("./link-validator");
    const { content: updatedContent, changed } = await revalidateStoredContent(content);
    if (changed) {
      await storage.updateLessonContent(unitId, updatedContent);
      console.log(`[LinkValidator] Updated stale links for unit ${unitId}`);
    }
  } catch (err) {
    console.warn("[LinkValidator] Revalidation error:", (err as any)?.message || err);
  }
}

async function preTTSForUnit(userId: string, unitId: number, content: any, isNextGen: boolean): Promise<void> {
  try {
    const ttsSettings = await storage.getTtsSettings(userId);
    if (!ttsSettings.voicePreset || ttsSettings.voicePreset === "browser") return;

    const { hashVoiceConfig, hashBase64, generateTTSAudio } = await import("./tts-service");
    const refHash = ttsSettings.referenceAudio ? hashBase64(ttsSettings.referenceAudio) : undefined;
    const configHash = hashVoiceConfig(ttsSettings.voicePreset, refHash);

    const existing = await storage.getTtsAudioCache(unitId, configHash);
    if (existing) return;

    const userProfile = await storage.getUserProfile(userId);
    const result = await generateTTSAudio({
      unitId,
      content,
      isNextGen,
      voicePreset: ttsSettings.voicePreset,
      referenceAudio: ttsSettings.referenceAudio || undefined,
      hfToken: userProfile?.huggingFaceToken || undefined,
    });

    if (result) {
      await storage.saveTtsAudioCache(unitId, configHash, result.audioData, result.audioFormat);
      console.log(`[PreTTS] Cached TTS audio for unit ${unitId}`);
    }
  } catch (err) {
    console.warn("[PreTTS] Pre-generation error:", (err as any)?.message || err);
  }
}

// Generate custom topic content using AI
async function generateCustomTopicContent(customTopicId: number, title: string, description: string) {
  try {
    await storage.updateCustomTopicStatus(customTopicId, "generating");
    
    // Generate a category for this topic
    const categoryPrompt = `Given the learning topic "${title}" (${description}), suggest the best category name, color (purple, blue, green, orange, pink, or teal), and icon (Brain, Code, Calculator, Beaker, Atom, Book, Music, Wrench, Rocket, Leaf, Flask, or Lightbulb) for this topic. Return JSON: { "name": "Category Name", "color": "blue", "icon": "Code" }`;
    
    const categoryContent = await generateCourseContent(
      [{ role: "user", content: categoryPrompt }],
      { responseFormat: "json" }
    ) || "{}";
    
    const categoryData = JSON.parse(categoryContent);
    
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
// If isAdmin is true, all levels are unlocked (admin bypass)
function isUnitUnlocked(
  difficulty: string, 
  mastery: { beginnerUnlocked: boolean; intermediateUnlocked: boolean; advancedUnlocked: boolean; nextgenUnlocked?: boolean; keyUnlocked?: boolean },
  isAdmin: boolean = false
): boolean {
  if (isAdmin) return true;
  if (mastery.keyUnlocked) return true;
  
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
    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.7 }
    ) || "{}";

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

// Generate ALL lesson content for a topic in a single batch API call
// This is more cost-effective than generating content per-unit
async function generateBatchLessonContent(
  topic: { title: string; description: string },
  units: { id: number; title: string; difficulty: string; outline?: string | null }[],
  masteredTopics: { topicId: number; topicTitle: string }[]
): Promise<Map<number, any>> {
  const crossTopicContext = masteredTopics.length > 0
    ? `The learner has already mastered these topics: ${masteredTopics.map(t => t.topicTitle).join(", ")}. When relevant, draw connections to these concepts they already understand.`
    : "";

  // Group units by difficulty for the prompt
  const beginnerUnits = units.filter(u => u.difficulty === "beginner");
  const intermediateUnits = units.filter(u => u.difficulty === "intermediate");
  const advancedUnits = units.filter(u => u.difficulty === "advanced");
  // Note: nextgen units use a different content structure and are generated separately

  const unitsList = [...beginnerUnits, ...intermediateUnits, ...advancedUnits];
  
  if (unitsList.length === 0) {
    return new Map();
  }

  const unitsDescription = unitsList.map((u, i) => 
    `${i + 1}. [${u.difficulty.toUpperCase()}] "${u.title}" - ${u.outline || "No description"}`
  ).join("\n");

  const prompt = `You are an expert curriculum designer creating a deep, engaging learning journey for "${topic.title}".

Topic Description: ${topic.description}

${crossTopicContext}

Create content for these ${unitsList.length} units, ensuring a cohesive and progressively deeper learning journey:
${unitsDescription}

Respond with a JSON object where each key is the unit index (0, 1, 2...) and each value is the lesson content.

CRITICAL: Each unit MUST include "keyTakeaways" (3-5 bullet points) and "externalResources" (2-5 real, specific links). See requirements below.

JSON format:
{
  "0": {
    "concept": "Engaging explanation (2-3 paragraphs with a story hook, real-world relevance, and clear 'why this matters')",
    "keyTakeaways": ["Key point 1", "Key point 2", "Key point 3"],
    "analogy": "Creative, memorable real-world analogy that makes the concept click",
    "example": {
      "title": "Example title",
      "content": "Detailed worked example with concrete details",
      "code": "Optional code snippet if relevant"
    },
    "quiz": [
      {
        "question": "Question text",
        "options": ["A", "B", "C", "D"],
        "correctIndex": 0,
        "explanation": "Why this answer is correct and why others are not"
      }
    ],
    "crossLinks": [],
    "externalResources": [
      {
        "title": "Resource title",
        "url": "https://actual-url.com",
        "type": "video|course|paper|book|forum|tool",
        "description": "What this resource offers and why it's worth exploring"
      }
    ]
  },
  "1": { ... },
  ...
}

TIER-SPECIFIC REQUIREMENTS:

BEGINNER units MUST:
- Open with a captivating real-world story or surprising fact that hooks curiosity
- Use zero jargon - explain everything with everyday language and analogies
- Focus on "what is it?" and "why does this matter to my life?"
- Show the human story behind the discovery or invention
- externalResources: 2-3 beginner-friendly resources (Khan Academy, Crash Course YouTube, TED Talks, introductory books)
- Quiz questions test basic recall and "why does this matter?"

INTERMEDIATE units MUST:
- Explain the mechanisms: "how does it actually work under the hood?"
- Include mathematical, technical, or conceptual frameworks where appropriate
- Use real case studies and practical worked examples
- Connect to adjacent concepts and build a mental model
- externalResources: 3-4 free online courses or textbooks (MIT OpenCourseWare at ocw.mit.edu, Stanford Online at online.stanford.edu, Coursera free audits, specific open textbook chapters, arXiv survey papers)
- Quiz questions test application and mechanism understanding

ADVANCED units MUST:
- Describe the current state of the field: what do experts know now, what is still debated?
- Reference specific landmark papers, recent breakthroughs, or key researchers by name
- Cover edge cases, failure modes, and nuances practitioners must know
- Discuss active debates or competing paradigms in the field
- externalResources: 3-5 research-grade resources (specific arXiv papers with links, journal articles, conference proceedings like NeurIPS/CVPR/Nature/Science, expert lecture series, professional community resources)
- Quiz questions are analytical and require synthesis of multiple concepts

Each unit should have exactly 3 quiz questions. Beginner→Intermediate→Advanced should feel like a genuine progression in depth. The externalResources URLs must be real, working URLs (ocw.mit.edu, arxiv.org, khanacademy.org, youtube.com, etc).`;

  try {
    console.log(`[BatchContent] Generating batch content for ${unitsList.length} units of topic "${topic.title}"`);
    
    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.7 }
    ) || "{}";

    const parsed = JSON.parse(content);
    const resultMap = new Map<number, any>();
    
    // Map the response back to unit IDs
    unitsList.forEach((unit, index) => {
      const unitContent = parsed[String(index)];
      if (unitContent && !unitContent._isPlaceholder) {
        resultMap.set(unit.id, unitContent);
      }
    });
    
    console.log(`[BatchContent] Successfully generated content for ${resultMap.size}/${unitsList.length} units`);
    return resultMap;
  } catch (error) {
    console.error("[BatchContent] Error generating batch lesson content:", error);
    return new Map(); // Return empty map on failure - individual unit generation will be used as fallback
  }
}

// Generate lesson content using AI
async function generateLessonContent(
  topic: { title: string; description: string },
  unit: { title: string; difficulty: string; outline?: string | null },
  masteredTopics: { topicId: number; topicTitle: string }[],
  categoryName?: string
): Promise<any> {
  const crossTopicContext = masteredTopics.length > 0
    ? `The learner has already mastered these topics: ${masteredTopics.map(t => t.topicTitle).join(", ")}. When relevant, draw connections to these concepts they already understand.`
    : "";

  const topicContext = categoryName
    ? `Topic Domain: ${categoryName} → "${topic.title}"`
    : `Topic: "${topic.title}"`;

  const difficultyGuidelines = unit.difficulty === "beginner"
    ? `BEGINNER TIER REQUIREMENTS:
- Open with a captivating real-world story, surprising fact, or historical moment that immediately hooks curiosity
- Use zero jargon — if a technical word is unavoidable, define it immediately with a simple everyday equivalent
- Focus on "what is it?" and "why does this matter to my life right now?"
- Show the human story: who discovered or built this, what problem were they solving, what changed in the world as a result?
- The concept should feel like reading an engaging magazine article, not a textbook
- Quiz questions test basic recognition, "why does this matter?", and connecting to everyday experience
- externalResources: 2-3 highly accessible resources that a complete beginner would love:
  * Khan Academy videos/articles (khanacademy.org)
  * CrashCourse YouTube videos (youtube.com/@crashcourse)
  * TED or TEDx Talks (ted.com)
  * Popular science books or articles
  * Introductory Wikipedia pages for jumping off`
    : unit.difficulty === "intermediate"
    ? `INTERMEDIATE TIER REQUIREMENTS:
- Now explain HOW it works, not just what it is — dive into the underlying mechanisms and frameworks
- Include mathematical intuition or technical frameworks where appropriate, explained step-by-step
- Use at least one detailed real-world case study or practical worked example from industry or research
- Build a mental model: connect this to adjacent concepts and show how it fits into a bigger picture
- The concept should feel like a solid college lecture — rigorous but still accessible
- Quiz questions test mechanism understanding and ability to apply concepts to new scenarios
- externalResources: 3-4 free courses or textbooks that provide substantial depth:
  * MIT OpenCourseWare (ocw.mit.edu) — cite specific course pages
  * Stanford Online (online.stanford.edu) or Stanford Engineering Everywhere
  * Coursera free audit courses from top universities
  * Specific open textbook chapters (OpenStax, LibreTexts, etc.)
  * arXiv survey papers (arxiv.org) that provide comprehensive overviews
  * YouTube lecture series from university professors`
    : unit.difficulty === "advanced"
    ? `ADVANCED TIER REQUIREMENTS:
- Describe the CURRENT STATE OF THE ART: what do leading researchers know right now, what is still actively debated?
- Reference specific landmark papers or breakthroughs (mention authors, publication years, and venues like Nature/Science/NeurIPS/CVPR)
- Cover edge cases, failure modes, limitations, and nuances that practitioners MUST know to avoid mistakes
- Discuss competing paradigms or schools of thought within the field
- Include at least one recent development from 2022-2025 that changed or challenged prior understanding
- The concept should feel like reading a graduate-level review or expert practitioner's guide
- Quiz questions are analytical: require synthesizing multiple concepts, critiquing approaches, or reasoning about tradeoffs
- externalResources: 3-5 research-grade resources:
  * Specific arXiv papers with direct links (e.g., https://arxiv.org/abs/XXXX.XXXXX)
  * Nature, Science, or top-tier journal articles
  * Conference proceedings pages (neurips.cc, cvpr papers, etc.)
  * Expert lecture series (e.g., Lex Fridman podcast episodes with relevant researchers)
  * Professional/academic community resources and forums`
    : `NEXT GEN TIER REQUIREMENTS:
- This is a frontier exploration — present the field as an active, unfinished adventure
- Focus on what is NOT yet known and why it matters
- Reference real, active research questions being pursued by labs right now
- Quiz questions should be open-ended thought exercises that don't have single correct answers
- externalResources: 3-4 research frontier resources:
  * Active arXiv categories or recent preprints
  * Open source research community forums
  * Relevant Discord servers or academic Slack communities
  * Preprint servers and working papers`;

  const resourceSpecificityInstruction = `
CRITICAL RESOURCE SPECIFICITY RULES:
- Every URL must be hyper-specific to "${topic.title}"${categoryName ? ` within the domain of ${categoryName}` : ""}.
- DO NOT link to generic homepages (e.g. khanacademy.org, youtube.com alone) — link to specific pages, videos, or articles.
- For YouTube: include the full /watch?v=... URL to a specific video about THIS topic.
- For OCW/Coursera: link to a specific course or module page about THIS topic.
- For arXiv: link to a specific paper (https://arxiv.org/abs/XXXX.XXXXX) directly related to THIS topic.
- Prefer resources from professional/academic sources in the ${categoryName || "relevant"} domain.
- Verify that the URL path describes the content clearly — avoid placeholder or example URLs.`;

  const prompt = `You are an expert curriculum designer creating a deep, engaging lesson for:

${topicContext}
Unit: ${unit.title}
Difficulty Level: ${unit.difficulty.toUpperCase()}
Unit Description: ${unit.outline || ""}

${crossTopicContext}

${difficultyGuidelines}

${resourceSpecificityInstruction}

Create the lesson content in this JSON format:
{
  "concept": "Engaging, in-depth explanation (2-3 substantial paragraphs appropriate for this difficulty tier)",
  "keyTakeaways": ["Key insight 1", "Key insight 2", "Key insight 3", "Key insight 4"],
  "analogy": "A creative, memorable real-world analogy that makes this concept click",
  "example": {
    "title": "Example title",
    "content": "Detailed worked example appropriate to the difficulty level",
    "code": "Optional code snippet if relevant"
  },
  "quiz": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Thorough explanation of why this is correct and why the others are not"
    }
  ],
  "crossLinks": [
    {
      "topicId": 1,
      "topicTitle": "Related Topic",
      "connection": "How this concept connects to the related topic"
    }
  ],
  "externalResources": [
    {
      "title": "Specific resource title",
      "url": "https://real-working-url.com/specific-path",
      "type": "video|course|paper|book|forum|tool",
      "description": "What this resource covers and why it's the best next step for this difficulty level"
    }
  ]
}

Include exactly 3 quiz questions appropriate for the difficulty level.
${masteredTopics.length > 0 ? "Include 1-2 cross-links to mastered topics if relevant." : "Leave crossLinks as an empty array."}
The externalResources URLs must be real, specific, and working (ocw.mit.edu, arxiv.org, khanacademy.org, youtube.com, etc). Do not invent URLs.`;

  try {
    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.7 }
    ) || "{}";

    const parsed = JSON.parse(content);

    // Validate and clean up external resource URLs
    if (parsed.externalResources?.length) {
      const { validateAndRefreshResources } = await import("./link-validator");
      parsed.externalResources = await validateAndRefreshResources(
        parsed.externalResources,
        topic.title,
        categoryName || "general",
        unit.difficulty,
        async (count) => {
          const retryPrompt = `The following URLs for the lesson "${unit.title}" on topic "${topic.title}" (${categoryName || "general"}, ${unit.difficulty} level) failed validation. Generate ${count} alternative external resource links that are real, live, and specific to this exact topic and difficulty level. Return JSON array only:
[{"title":"...","url":"https://...","type":"video|course|paper|book","description":"..."}]`;
          try {
            const alt = await generateCourseContent(
              [{ role: "user", content: retryPrompt }],
              { responseFormat: "json", temperature: 0.5 }
            ) || "[]";
            const altParsed = JSON.parse(alt);
            return Array.isArray(altParsed) ? altParsed : (altParsed.externalResources || []);
          } catch {
            return [];
          }
        }
      );
    }

    return parsed;
  } catch (error) {
    console.error("Error generating lesson content:", error);
    // Return placeholder content with marker - DO NOT save this to DB
    return {
      _isPlaceholder: true,
      concept: `We're having trouble generating content for "${unit.title}" right now. Please try again in a moment.`,
      analogy: "Content generation is temporarily unavailable.",
      example: {
        title: "Content Unavailable",
        content: "Please refresh the page to try generating this lesson again.",
      },
      quiz: [],
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

  const prompt = `You are a research mentor and frontier scientist helping advanced learners engage with the bleeding edge of "${topic.title}".

Unit: ${unit.title}
Unit Focus: ${unit.outline || "Frontier exploration and creative thinking"}

${crossTopicContext}

This is a NEXT GEN unit — the final frontier of learning. The learner has already mastered beginner, intermediate, and advanced content. Now they step into the unknown alongside working researchers. Write as if briefing a smart, curious person at the start of a PhD program.

Respond with JSON in this EXACT format:
{
  "researchContext": "3 rich paragraphs: (1) Current state of the field — what we know confidently and what the frontier looks like right now as of 2024-2025. (2) The journey here — what key breakthroughs got us to this point and who made them. (3) The horizon — what is the field reaching for and why is it hard?",
  "openRoadblocks": [
    {
      "title": "Specific unsolved problem or bottleneck",
      "description": "Detailed explanation of what this challenge actually is and why current approaches fail",
      "whyItMatters": "What becomes possible if this roadblock is solved — what does it unlock for humanity?"
    }
  ],
  "industryChallenge": {
    "title": "A specific real challenge actively being worked on in industry or academia RIGHT NOW",
    "description": "Detailed explanation of why this is hard — technical and conceptual obstacles",
    "currentApproaches": ["Specific approach being tried by specific labs or companies", "Another real approach", "A third methodology"],
    "openQuestions": ["A specific unanswered question that active researchers are pursuing", "Another genuine open question", "A fundamental question that may require new frameworks to answer"]
  },
  "thoughtExercises": [
    {
      "prompt": "An open-ended thought experiment or design challenge that has no known right answer",
      "hints": ["A specific hint that points toward a productive angle", "A counterintuitive consideration"],
      "explorationPaths": ["A concrete direction to explore further", "A cross-disciplinary connection worth investigating"]
    }
  ],
  "emergingTrends": [
    {
      "trend": "A specific emerging development in this field from 2023-2025",
      "implications": "What this trend changes about how we think about the field",
      "potentialBreakthroughs": "What breakthrough this trend could lead to in 5-10 years"
    }
  ],
  "creativeSynthesis": {
    "challenge": "A creative challenge that asks learners to combine this topic with unexpected domains to propose a novel approach or application",
    "relatedConcepts": ["Concept from this topic", "Unexpected domain or field that might connect"],
    "suggestedConnections": ["A specific cross-domain insight worth exploring", "An analogy from a completely different field that might yield new ideas"]
  },
  "communityForums": [
    {
      "name": "Community or forum name",
      "url": "https://real-url.com",
      "description": "What kind of discussion and who participates"
    }
  ],
  "resources": [
    {
      "title": "Specific resource title",
      "url": "https://real-arxiv-or-journal-url.com",
      "type": "paper|preprint|community|tool|lecture|forum",
      "description": "What this resource contains and why it is essential for anyone serious about this frontier"
    }
  ]
}

Requirements:
- openRoadblocks: Include 2-3 REAL specific unsolved problems (not vague, e.g. "the alignment problem in large language models" not just "AI safety")
- thoughtExercises: Include 2-3 open-ended challenges that genuinely have no known answers yet
- emergingTrends: Include 2-3 specific trends from 2023-2025, named and concrete
- communityForums: Include 2-3 REAL communities (e.g., arXiv cs.LG, LessWrong, r/MachineLearning, relevant Discord servers, academic mailing lists)
- resources: Include 3-5 REAL resources with working URLs — arXiv preprints, Nature/Science papers, conference papers, expert YouTube lectures
- This is about the thrill of the unknown — write with the excitement of someone at the frontier, not the detachment of a textbook
- End with an implicit invitation: "This is where YOU could contribute something new"`;


  try {
    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.8 }
    ) || "{}";

    return JSON.parse(content);
  } catch (error) {
    console.error("Error generating Next Gen content:", error);
    // Return placeholder content with marker - DO NOT save this to DB
    return {
      _isPlaceholder: true,
      researchContext: `We're having trouble generating Next Gen content for "${topic.title}" right now. Please try again in a moment.`,
      industryChallenge: {
        title: "Content Unavailable",
        description: "Please refresh the page to try generating this content again.",
        currentApproaches: [],
        openQuestions: []
      },
      thoughtExercises: [],
      emergingTrends: [],
      creativeSynthesis: {
        challenge: "Content generation is temporarily unavailable.",
        relatedConcepts: [],
        suggestedConnections: []
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

// ==================== PRACTICE TEST HELPERS ====================

function getDefaultTimeLimit(testType: string): number | null {
  const timeLimits: Record<string, number> = {
    MCAT: 90,
    GRE: 60,
    SAT: 65,
    LSAT: 75,
    GMAT: 62,
    ACT: 60,
    IQ: 45,
    BAR: 90,
  };
  return timeLimits[testType.toUpperCase()] || 60;
}

function getTestCategories(testType: string): string[] {
  // Only include categories that can be assessed via multiple-choice questions
  // Essay/writing categories are excluded since we only support MCQ format
  const categories: Record<string, string[]> = {
    MCAT: ["Biology", "Chemistry", "Physics", "Psychology", "Critical Analysis"],
    GRE: ["Verbal Reasoning", "Quantitative Reasoning", "Reading Comprehension"],
    SAT: ["Reading", "Writing and Language", "Math (No Calculator)", "Math (Calculator)"],
    LSAT: ["Logical Reasoning", "Analytical Reasoning", "Reading Comprehension"],
    GMAT: ["Quantitative", "Verbal", "Integrated Reasoning", "Data Sufficiency"],
    ACT: ["English", "Math", "Reading", "Science"],
    IQ: ["Pattern Recognition", "Logical Reasoning", "Spatial Reasoning", "Verbal Ability", "Numerical Ability"],
    BAR: ["Constitutional Law", "Contracts", "Criminal Law", "Evidence", "Torts", "Civil Procedure"],
  };
  return categories[testType.toUpperCase()] || ["General Knowledge"];
}

async function generatePracticeTestQuestions(testId: number, testType: string, focusAreas?: string) {
  try {
    const categories = getTestCategories(testType);
    const questionsPerCategory = 5;
    const totalQuestions = categories.length * questionsPerCategory;

    const prompt = `You are an expert test prep instructor. Generate ${totalQuestions} practice questions for a ${testType.toUpperCase()} exam.

${focusAreas ? `Focus areas requested: ${focusAreas}` : ""}

Categories to cover: ${categories.join(", ")}

Generate ${questionsPerCategory} questions per category. Each question should be challenging but fair, similar to actual ${testType.toUpperCase()} exam questions.

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "category": "Category Name",
      "questionType": "multiple_choice",
      "passage": null,
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Detailed explanation of why this answer is correct",
      "difficulty": "medium"
    }
  ]
}

Guidelines:
- ALL questions MUST be multiple-choice format with exactly 4 options
- EVERY question MUST have a valid correctIndex (0, 1, 2, or 3) indicating the correct answer
- Questions should be ${testType.toUpperCase()}-appropriate in difficulty and style
- Include a mix of easy, medium, and hard questions
- For passage-based questions, include a relevant passage in the "passage" field
- Explanations should be educational and thorough
- Options should be plausible but only one clearly correct
- Distribute questions evenly across categories
- Do NOT generate essay questions or any format without a definitive correct answer`;

    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.7 }
    ) || "{}";

    const parsed = JSON.parse(content);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid AI response format");
    }

    // Validate and save questions to database
    const questionsToInsert = parsed.questions
      .filter((q: any) => {
        // Validate required fields for multiple choice
        const hasValidCorrectIndex = typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3;
        const hasValidOptions = Array.isArray(q.options) && q.options.length === 4;
        const hasQuestion = typeof q.question === 'string' && q.question.trim().length > 0;
        return hasValidCorrectIndex && hasValidOptions && hasQuestion;
      })
      .map((q: any, index: number) => ({
        testId,
        questionIndex: index,
        category: q.category || categories[0],
        questionType: "multiple_choice",
        passage: q.passage || null,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || "No explanation provided.",
        difficulty: q.difficulty || "medium",
      }));
    
    if (questionsToInsert.length === 0) {
      throw new Error("No valid questions generated");
    }

    await storage.createPracticeTestQuestions(questionsToInsert);
    await storage.updatePracticeTestStatus(testId, "ready", questionsToInsert.length);

  } catch (error) {
    console.error("Error generating practice test questions:", error);
    await storage.updatePracticeTestStatus(testId, "failed");
  }
}
