import type { Express, Request, Response } from "express";
import { storage } from "../storage";

export function registerTopicsRoutes(app: Express) {
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
}
