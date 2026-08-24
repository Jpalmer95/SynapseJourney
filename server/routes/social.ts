// server/routes/social.ts — Open Science, Community & Social Routes
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { insertOpenScienceIdeaSchema, insertOpenScienceCommentSchema } from "@shared/schema";
import { embed } from "../embeddings";

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

  // ── Forum / community semantic search ──────────────────────────────────
  // Ranks open-science ideas by semantic similarity (via local Ollama
  // embeddings) blended with keyword overlap. Public, no auth.
  app.get("/api/open-science/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 8;
      if (!query || query.length < 2) {
        return res.json({ ideas: [], mode: "none" });
      }
      const ideas = await storage.getOpenScienceIdeas();
      const q = query.toLowerCase();
      const qvec = await embed(query);
      const scored = ideas.map((idea: any) => {
        const hay = `${idea.title} ${idea.content} ${idea.authorName || ""}`.toLowerCase();
        let kw = 0;
        for (const token of q.split(/\s+/)) {
          if (hay.includes(token)) kw += 1;
        }
        kw /= Math.max(1, q.split(/\s+/).length);
        return { idea, kw, sem: 0 };
      });
      if (qvec) {
        // cosine similarity against embedded idea text (computed inline)
        for (const s of scored) {
          const text = `${s.idea.title} ${s.idea.content}`.slice(0, 2000);
          const iv = await embed(text);
          if (iv) {
            const dot = qvec.reduce((a, v, i) => a + v * (iv[i] || 0), 0);
            const mag = Math.sqrt(qvec.reduce((a, v) => a + v * v, 0)) *
                        Math.sqrt(iv.reduce((a, v) => a + v * v, 0));
            s.sem = mag ? dot / mag : 0;
          }
        }
      }
      const ranked = scored
        .map((s) => ({ ...s.idea, score: qvec ? 0.6 * s.sem + 0.4 * s.kw : s.kw }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, limit);
      res.json({ ideas: ranked, mode: qvec ? "hybrid" : "keyword" });
    } catch (e) {
      console.error("Error searching open science", e);
      res.status(500).json({ error: "Failed to search ideas" });
    }
  });
}
