// server/routes/social.ts — Open Science, Community & Social Routes
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { insertOpenScienceIdeaSchema, insertOpenScienceCommentSchema } from "@shared/schema";

export function registerSocialRoutes(app: Express) {
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
}
