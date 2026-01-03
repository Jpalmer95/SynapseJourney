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

  return httpServer;
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
