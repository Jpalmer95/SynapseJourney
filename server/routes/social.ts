// server/routes/social.ts — Open Science, SOTA Bottlenecks, Hypotheses & OER Commons Routes
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import {
  insertOpenScienceIdeaSchema,
  insertOpenScienceCommentSchema,
  insertSotaBottleneckSchema,
  insertKnowledgeResourceSchema,
} from "@shared/schema";
import { embed } from "../embeddings";
import { generateByokOrPool, providerConfigFromProfile } from "../ai-providers";

let seededCommons = false;

const INITIAL_SOTA_BOTTLENECKS = [
  {
    domain: "Artificial Intelligence & ML",
    title: "Continual Learning Without Catastrophic Forgetting in Foundation Models",
    description:
      "Current transformer architectures degrade on previously mastered tasks when fine-tuned sequentially on new distributions without expensive full-replay buffers.",
    whyItMatters:
      "Solving continual plasticity-stability tradeoffs unlocks lifelong personal agents and adaptive scientific models that learn online from sparse real-world feedback.",
    currentApproaches: [
      "Low-Rank Adaptation (LoRA) modular routing & expert merging",
      "Elastic Weight Consolidation (EWC) & Fisher information regularization",
      "Episodic memory replay with synthetic generative distillation",
    ],
    openQuestions: [
      "Can biological synaptic consolidation rules (dual-timescale fast/slow weights) scale to billion-parameter attention blocks?",
      "What is the minimal geometric subspace constraint that preserves zero-shot reasoning while absorbing novel domain facts?",
    ],
    difficulty: "frontier",
    status: "open",
    source: "curated",
  },
  {
    domain: "Energy & Materials Science",
    title: "Dendrite Suppression & Interfacial Impedance in Solid-State Lithium-Metal Anodes",
    description:
      "High-current density cycling in solid-state electrolytes triggers lithium filament propagation along grain boundaries, causing short-circuits and capacity fade.",
    whyItMatters:
      "Unlocking stable >500 Wh/kg solid-state cells at room temperature transforms grid storage, electric aviation, and robotics.",
    currentApproaches: [
      "Lithiophilic alloy interlayers (Ag-C, In, Mg) for homogeneous nucleation",
      "Single-crystal or amorphous sulfide/halide solid electrolytes",
      "Stack-pressure modulation and acoustic/electrochemical pulse healing",
    ],
    openQuestions: [
      "How do local electro-chemo-mechanical stress tensor gradients at triple-phase junctions initiate crack-tip lithium plating?",
      "Can self-healing polymer-ceramic composite interphases dynamically relax stress at >5 mA/cm²?",
    ],
    difficulty: "frontier",
    status: "active_research",
    source: "curated",
  },
  {
    domain: "Computational Biology & Medicine",
    title: "Out-of-Distribution Multi-Conformation Protein & RNA Allosteric Binding Prediction",
    description:
      "While static fold prediction has matured, predicting cryptic allosteric pockets, intrinsically disordered ensemble shifts, and non-canonical RNA-ligand kinetics remains unreliable.",
    whyItMatters:
      "Enables rational design of selective therapeutics for 'undruggable' transcription factors and rapid antiviral response.",
    currentApproaches: [
      "Flow-matching & diffusion over coarse-grained molecular dynamics ensembles",
      "Enhanced sampling (metadynamics, replica exchange) coupled with neural force fields",
      "Cryo-EM continuous heterogeneity reconstruction",
    ],
    openQuestions: [
      "How can thermodynamic free-energy landscapes be learned directly from sparse experimental observables without millisecond MD rollouts?",
      "What cross-domain analogies from statistical physics of glasses apply to disordered protein phase separation?",
    ],
    difficulty: "frontier",
    status: "open",
    source: "curated",
  },
  {
    domain: "Quantum Physics & Computing",
    title: "Low-Overhead Fault-Tolerant Quantum LDPC Code Decoding in Real Time",
    description:
      "Surface codes require ~1,000 physical qubits per logical qubit; high-rate Quantum LDPC codes reduce overhead 10x but require non-local connectivity and ultra-fast syndrome decoding within coherence windows.",
    whyItMatters:
      "Bridges the gap between noisy intermediate-scale devices (NISQ) and practical fault-tolerant quantum simulation of catalysts and materials.",
    currentApproaches: [
      "Bivariate bicycle (BB) codes on neutral-atom reconfigurable arrays",
      "Belief propagation with ordered statistics decoding (BP-OSD) in FPGA hardware",
      "Floquet and dynamical codes with mid-circuit erasure conversion",
    ],
    openQuestions: [
      "Can linear-time local neural-cellular-automata decoders match BP-OSD logical error thresholds under realistic circuit-level noise?",
      "How do we co-design neutral-atom shuttling schedules with qLDPC stabilizer check schedules?",
    ],
    difficulty: "frontier",
    status: "active_research",
    source: "curated",
  },
  {
    domain: "Systems & Distributed Computing",
    title: "Verifiable Privacy-Preserving Decentralized Compute over Heterogeneous Edge GPUs",
    description:
      "Verifying that untrusted edge nodes executed an exact LLM inference or training gradient step honestly without 100x cryptographic overhead (ZK-ML) or floating-point non-determinism.",
    whyItMatters:
      "Allows open-science communities and BYOC learners to pool idle consumer GPUs into a trustless global supercomputer.",
    currentApproaches: [
      "Optimistic fraud proofs with deterministic IEEE-754 kernel enforcement",
      "Probabilistic spot-checking of intermediate activation commitments",
      "Trusted Execution Environments (TEEs) with remote attestation",
    ],
    openQuestions: [
      "Can locality-sensitive hashing of intermediate layer activations detect lazy/quantized model substitution with <1% compute overhead?",
    ],
    difficulty: "advanced",
    status: "open",
    source: "curated",
  },
];

const INITIAL_OER_RESOURCES = [
  {
    title: "MIT OpenCourseWare — Complete STEM Lecture & Problem Set Archive",
    url: "https://ocw.mit.edu/",
    resourceType: "course",
    description: "Free lecture notes, exams, and videos from over 2,500 MIT courses across Physics, CS, Mathematics, Biology, and Engineering.",
    providerName: "MIT OpenCourseWare",
    isFreeOer: true,
  },
  {
    title: "arXiv.org — Open-Access Preprints in Physics, Mathematics, CS, and Quantitative Biology",
    url: "https://arxiv.org/",
    resourceType: "paper",
    description: "Primary frontier research repository for SOTA preprints across quantitative sciences.",
    providerName: "arXiv",
    isFreeOer: true,
  },
  {
    title: "OpenStax — Peer-Reviewed Open Textbooks",
    url: "https://openstax.org/subjects",
    resourceType: "textbook",
    description: "100% free, peer-reviewed college and AP textbooks in Physics, Chemistry, Calculus, Statistics, Biology, and Economics.",
    providerName: "OpenStax",
    isFreeOer: true,
  },
  {
    title: "LibreTexts — Collaborative Open-Access STEM Textbook Library",
    url: "https://libretexts.org/",
    resourceType: "textbook",
    description: "Living open-access textbooks and interactive simulations across 15 STEM & humanities disciplines.",
    providerName: "LibreTexts",
    isFreeOer: true,
  },
];

async function ensureCommonsSeeded() {
  if (seededCommons) return;
  seededCommons = true;
  try {
    const existingBottlenecks = await storage.getSotaBottlenecks({ limit: 5 });
    if (existingBottlenecks.length === 0) {
      for (const b of INITIAL_SOTA_BOTTLENECKS) {
        await storage.upsertSotaBottleneck(b);
      }
    }
    const existingResources = await storage.getKnowledgeResources({ limit: 5 });
    if (existingResources.length === 0) {
      for (const r of INITIAL_OER_RESOURCES) {
        await storage.upsertKnowledgeResource(r);
      }
    }
  } catch (err) {
    console.warn("[OpenScience] Initial commons seed skipped:", (err as Error).message);
  }
}

export function registerSocialRoutes(app: Express) {
  // ==========================================
  // SOTA BOTTLENECK REGISTRY
  // ==========================================

  app.get("/api/open-science/bottlenecks", async (req: Request, res: Response) => {
    try {
      await ensureCommonsSeeded();
      const topicId = req.query.topicId ? parseInt(String(req.query.topicId), 10) : undefined;
      const domain = req.query.domain ? String(req.query.domain) : undefined;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const bottlenecks = await storage.getSotaBottlenecks({
        topicId: Number.isNaN(topicId as number) ? undefined : topicId,
        domain,
        limit,
      });
      res.json(bottlenecks);
    } catch (e) {
      console.error("Error fetching SOTA bottlenecks:", e);
      res.status(500).json({ error: "Failed to fetch SOTA bottlenecks" });
    }
  });

  app.post("/api/open-science/bottlenecks", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertSotaBottleneckSchema.parse({
        ...req.body,
        source: req.body.source || "community",
        createdByUserId: userId,
      });
      const created = await storage.upsertSotaBottleneck(parsed);
      res.status(201).json(created);
    } catch (e) {
      console.error("Error creating SOTA bottleneck:", e);
      res.status(400).json({ error: "Failed to create SOTA bottleneck" });
    }
  });

  app.post("/api/open-science/bottlenecks/:id/upvote", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const updated = await storage.upvoteSotaBottleneck(id);
      res.json(updated);
    } catch (e) {
      console.error("Error upvoting bottleneck:", e);
      res.status(500).json({ error: "Failed to upvote bottleneck" });
    }
  });

  // ==========================================
  // OPEN SCIENCE: IDEAS, HYPOTHESES & PEER REVIEW
  // ==========================================

  app.get("/api/open-science", async (_req: Request, res: Response) => {
    try {
      await ensureCommonsSeeded();
      const ideas = await storage.getOpenScienceIdeas();
      res.json(ideas);
    } catch (e) {
      console.error("Error fetching open science ideas", e);
      res.status(500).json({ error: "Failed to fetch ideas" });
    }
  });

  app.post("/api/open-science", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertOpenScienceIdeaSchema.parse({
        ...req.body,
        userId,
        authorName: req.user.claims.username || req.user.claims.first_name || "Polymath Researcher",
        status: req.body.hypothesis ? "hypothesis" : "proposed",
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

  /**
   * POST /api/open-science/:id/review
   * Runs a constructive Socratic & First-Principles Peer Review on a hypothesis
   * using the user's BYOC AI key (zero platform spend).
   */
  app.post("/api/open-science/:id/review", isAuthenticated, async (req: any, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const userId = req.user.claims.sub;
      const idea = await storage.getOpenScienceIdeaById(id);
      if (!idea) return res.status(404).json({ error: "Hypothesis not found" });

      const profile = await storage.getUserProfile(userId);
      const userConfig = providerConfigFromProfile(profile);

      const prompt = `You are a constructive, rigorous Open Science Peer Reviewer and Polymath Strategist.
Evaluate the following learner-submitted hypothesis / research proposal:

Title: ${idea.title}
Core Thesis / Description: ${idea.content}
Formal Hypothesis: ${idea.hypothesis || "(Not explicitly separated — infer from thesis)"}
Proposed Methodology / Experiment: ${idea.methodology || "(Not specified)"}
Falsifiability Criteria: ${idea.falsifiability || "(Not specified)"}

Provide a structured peer review in valid JSON with this exact shape:
{
  "noveltySummary": "1-2 sentences evaluating what is fresh or cross-functional about this angle",
  "strengths": ["strength 1", "strength 2"],
  "blindSpots": ["physical, mathematical, or engineering constraint to watch out for 1", "blind spot 2"],
  "falsificationTest": "A concrete, low-cost 1-2 week minimal viable experiment or simulation to test/falsify the core claim",
  "crossDomainBridges": ["Specific concept from another field that could strengthen this hypothesis"],
  "readinessScore": 78
}
Return ONLY valid JSON.`;

      let rawReview: string;
      try {
        const aiResult = await generateByokOrPool(
          [
            {
              role: "system",
              content: "You are a constructive, rigorous Open Science Peer Reviewer. Always respond with valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
          userConfig
        );
        rawReview = aiResult.content;
      } catch (err: any) {
        if (err?.message?.includes("BYOC_REQUIRED")) {
          return res.status(402).json({
            error: "BYOC_REQUIRED",
            message: "Connect your own AI key in Settings to run AI Peer Review on hypotheses.",
          });
        }
        throw err;
      }

      const cleaned = rawReview.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const reviewJson = JSON.parse(cleaned);
      const updated = await storage.updateOpenScienceIdea(id, {
        aiReviewJson: reviewJson,
        status: "under_test",
      } as any);

      res.json({ idea: updated, review: reviewJson });
    } catch (e: any) {
      console.error("Error running AI peer review:", e);
      res.status(500).json({ error: e?.message || "Failed to generate peer review" });
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
        const hay = `${idea.title} ${idea.content} ${idea.hypothesis || ""} ${idea.authorName || ""}`.toLowerCase();
        let kw = 0;
        for (const token of q.split(/\s+/)) {
          if (hay.includes(token)) kw += 1;
        }
        kw /= Math.max(1, q.split(/\s+/).length);
        return { idea, kw, sem: 0 };
      });
      if (qvec) {
        for (const s of scored) {
          const text = `${s.idea.title} ${s.idea.content} ${s.idea.hypothesis || ""}`.slice(0, 2000);
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

  // ==========================================
  // KNOWLEDGE RESOURCES (OER) COMMONS
  // ==========================================

  app.get("/api/resources", async (req: Request, res: Response) => {
    try {
      await ensureCommonsSeeded();
      const topicId = req.query.topicId ? parseInt(String(req.query.topicId), 10) : undefined;
      const resourceType = req.query.type ? String(req.query.type) : undefined;
      const query = req.query.q ? String(req.query.q) : undefined;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 60;
      const resources = await storage.getKnowledgeResources({
        topicId: Number.isNaN(topicId as number) ? undefined : topicId,
        resourceType,
        query,
        limit,
      });
      res.json(resources);
    } catch (e) {
      console.error("Error fetching knowledge resources:", e);
      res.status(500).json({ error: "Failed to fetch resources" });
    }
  });

  app.post("/api/resources", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = insertKnowledgeResourceSchema.parse({
        ...req.body,
        isFreeOer: req.body.isFreeOer ?? true,
      });
      const created = await storage.upsertKnowledgeResource(parsed);
      res.status(201).json(created);
    } catch (e) {
      console.error("Error adding knowledge resource:", e);
      res.status(400).json({ error: "Failed to add knowledge resource" });
    }
  });
}
