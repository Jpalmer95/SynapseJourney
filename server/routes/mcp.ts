// server/routes/mcp.ts — Native Model Context Protocol (MCP) Server for Personal Agents
//
// Exposes SynapseJourney over HTTP JSON-RPC 2.0 (`/api/mcp`) so Hermes Agent,
// Claude Desktop/Code, Cursor, or any MCP-compatible personal agent can:
//  - Search topics, lessons, SOTA bottlenecks, and OER resources (`synapse.search_knowledge`)
//  - Inspect courses & dynamic plans (`synapse.get_course`)
//  - Ingest agent-authored courses + units with zero platform compute (`synapse.ingest_course`)
//  - List or propose SOTA bottlenecks (`synapse.list_sota_bottlenecks`, `synapse.propose_sota_bottleneck`)
//  - Submit structured Open Science hypotheses (`synapse.submit_hypothesis`)
//  - Inspect the user's 3D Knowledge Map (`synapse.get_3d_map`)
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { embed, indexTopicToFlywheel, indexUnitToFlywheel } from "../embeddings";
import { randomUUID } from "node:crypto";
import { scoreCourse, blockingIssues } from "../content-quality";
import { normalizeTitle, findDuplicateTitle } from "../content-quality";

export const MCP_TOOLS = [
  {
    name: "synapse.search_knowledge",
    description:
      "Hybrid vector + keyword search across SynapseJourney topics, lessons, SOTA bottlenecks, and Open Educational Resources (OER).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (topic, skill, bottleneck, or concept)" },
        limit: { type: "number", description: "Max results per collection (default 8)" },
      },
      required: ["query"],
    },
  },
  {
    name: "synapse.get_course",
    description:
      "Fetch a course topic, its dynamic curriculum plan, lesson units, SOTA bottlenecks, and linked OER resources.",
    inputSchema: {
      type: "object",
      properties: {
        topicId: { type: "number", description: "Numeric topic ID" },
      },
      required: ["topicId"],
    },
  },
  {
    name: "synapse.ingest_course",
    description:
      "Upload a course (or append units to an existing topic) authored using the agent's own LLM compute. Zero platform AI cost.",
    inputSchema: {
      type: "object",
      properties: {
        topicId: { type: "number", description: "Optional existing topic ID to append to" },
        topic: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            categoryName: { type: "string" },
            difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
          },
        },
        learningIntent: {
          type: "string",
          enum: ["survey", "standard", "deep", "speed_run", "goal"],
        },
        goalText: { type: "string" },
        units: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced", "nextgen"] },
              outline: { type: "string" },
              contentJson: { type: "object" },
            },
            required: ["title", "difficulty"],
          },
        },
      },
      required: ["units"],
    },
  },
  {
    name: "synapse.list_sota_bottlenecks",
    description:
      "List unsolved SOTA bottlenecks and frontier challenges across industries and scientific fields.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Optional domain filter" },
        topicId: { type: "number", description: "Optional topic ID filter" },
        limit: { type: "number", description: "Max items (default 20)" },
      },
    },
  },
  {
    name: "synapse.propose_sota_bottleneck",
    description:
      "Register a new SOTA bottleneck or frontier challenge discovered during research or learning.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        whyItMatters: { type: "string" },
        currentApproaches: { type: "array", items: { type: "string" } },
        openQuestions: { type: "array", items: { type: "string" } },
        topicId: { type: "number" },
      },
      required: ["domain", "title", "description", "whyItMatters"],
    },
  },
  {
    name: "synapse.submit_hypothesis",
    description:
      "Submit a structured, falsifiable Open Science hypothesis (optionally linked to a SOTA bottleneck and cross-domain topics).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "Core mechanism & rationale" },
        hypothesis: { type: "string", description: "Testable prediction" },
        methodology: { type: "string", description: "Minimal viable experiment / simulation" },
        falsifiability: { type: "string", description: "What outcome would disprove this?" },
        bottleneckId: { type: "number" },
        topicId: { type: "number" },
        crossDomainTopicIds: { type: "array", items: { type: "number" } },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "synapse.list_courses",
    description:
      "List the published course catalogue (id, title, category, units, quality) plus any private/JIT courses owned by the caller.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category filter" },
        limit: { type: "number", description: "Max items (default 60)" },
      },
    },
  },
  {
    name: "synapse.get_3d_map",
    description:
      "Retrieve the learner's 3D Knowledge Graph nodes (with PCA semantic coordinates, mastery %, and connections).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "synapse.log_learning",
    description:
      "Log open-ended conversational learnings, JIT debugging insights, or mastered concepts from an agent session into the user's Unified Knowledge Ledger & 3D Knowledge Web. Automatically reconciles against canonical courses and units so prior progress is tracked.",
    inputSchema: {
      type: "object",
      properties: {
        concepts: {
          type: "array",
          description: "Atomic concepts or skills the user learned or demonstrated understanding of",
          items: {
            type: "object",
            properties: {
              conceptTitle: { type: "string", description: "Specific concept or skill title" },
              summary: { type: "string", description: "1-3 sentence summary of what was learned" },
              depthLevel: {
                type: "string",
                enum: ["intro", "core", "advanced", "frontier"],
              },
              topicTitle: { type: "string", description: "Canonical parent subject/topic name" },
              topicId: { type: "number", description: "Optional explicit Synapse topicId" },
              confidence: { type: "number", description: "Mastery confidence 10-100 (default 85)" },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["conceptTitle", "summary"],
          },
        },
        stream: {
          type: "string",
          enum: ["mcp_agent", "jit", "linear", "agent_chat"],
          description: "Learning stream source (defaults to mcp_agent)",
        },
        createMapNodeIfMissing: {
          type: "boolean",
          description: "Create a personal 3D Map node if no existing topic matches (default true)",
        },
      },
      required: ["concepts"],
    },
  },
  {
    name: "synapse.get_prior_knowledge",
    description:
      "Retrieve the learner's prior & scattered knowledge ledger for a topic or subject query across all learning streams (JIT goals, linear courses, in-app agent chats, and external MCP sessions). Call before teaching or authoring a course so you build on what they already know.",
    inputSchema: {
      type: "object",
      properties: {
        topicId: { type: "number", description: "Optional numeric topicId" },
        query: { type: "string", description: "Optional subject or concept query" },
      },
    },
  },
  {
    name: "synapse.architect_pathway",
    description:
      "Architect a complete Role, Industry, or Classical Mastery Roadmap (e.g. 'Frontier XR Chip Engineer') broken into 4 sequential phases and Pareto impact scores (1-100), reusing canonical catalog courses for foundations and creating specialized building-block courses with prerequisite DAG edges and a personalized timeline.",
    inputSchema: {
      type: "object",
      properties: {
        targetGoal: {
          type: "string",
          description: "Target role, frontier industry, or classical discipline (e.g. 'Frontier XR Chip Engineer')",
        },
        trackType: {
          type: "string",
          enum: ["role_career", "industry_frontier", "classical_science", "alt_degree_mba"],
          description: "Roadmap orientation (role_career, industry_frontier, classical_science, or alt_degree_mba)",
        },
        priorBackground: {
          type: "string",
          description: "Optional summary of what the learner already knows",
        },
        dailyMinutes: {
          type: "number",
          description: "Daily study commitment in minutes for timeline projection (default 60)",
        },
      },
      required: ["targetGoal"],
    },
  },
  {
    name: "synapse.get_pathway_timeline",
    description:
      "Compute a personalized learning timeline and impact-ordered building blocks for any pathway, discounting hours for the learner's prior & scattered knowledge ledger.",
    inputSchema: {
      type: "object",
      properties: {
        pathwayId: { type: "number", description: "Numeric pathwayId" },
        dailyMinutes: { type: "number", description: "Daily study minutes (15-480, default 60)" },
        paceMode: {
          type: "string",
          enum: ["fast_track", "balanced", "rigorous"],
          description: "Learning speed multiplier (default balanced)",
        },
      },
      required: ["pathwayId"],
    },
  },
  {
    name: "synapse.calibrate_placement",
    description:
      "Calibrate a learner's diagnostic placement across building blocks in a pathway (0-100% mastery per topic), logging diagnostic entries to the Unified Knowledge Ledger and recalculating the discounted timeline.",
    inputSchema: {
      type: "object",
      properties: {
        pathwayId: { type: "number", description: "Numeric pathwayId" },
        calibratedBlocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topicId: { type: "number" },
              masteryPct: { type: "number", description: "0-100 competency level" },
              note: { type: "string" },
            },
            required: ["topicId", "masteryPct"],
          },
        },
        dailyMinutes: { type: "number" },
      },
      required: ["pathwayId", "calibratedBlocks"],
    },
  },
  {
    name: "synapse.get_knowledge_chemistry",
    description:
      "Compute the learner's cross-functional Knowledge Chemistry profile across STEM, Hardware, AI, Math, and Business/Economics/Venture — including rare domain intersections and collaboration superpower.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export function registerMcpRoutes(app: Express) {
  // Streamable-HTTP transport notes (2025-03-26 spec):
  //   POST  JSON-RPC in, JSON or SSE out, session id in `Mcp-Session-Id`
  //   GET   optional server->client stream; we do not push, so 405 is spec-legal
  //   DELETE terminate the session
  // Machine-readable discovery lives at /.well-known/synapse.json.
  app.get("/api/mcp", (_req: Request, res: Response) => {
    res.setHeader("Allow", "POST, DELETE");
    res.status(405).json({ error: "Use POST for JSON-RPC. Streamable HTTP GET streams are not offered." });
  });

  app.delete("/api/mcp", (req: Request, res: Response) => {
    res.status(200).json({ ok: true, terminated: Boolean(req.headers["mcp-session-id"]) });
  });

  // Authenticated JSON-RPC 2.0 MCP endpoint (Bearer `sj_...` PAT or session cookie)
  app.post("/api/mcp", isAuthenticated, async (req: any, res: Response) => {
    const { jsonrpc = "2.0", id = null, method, params = {} } = req.body || {};
    const userId = req.user?.claims?.sub;

    const wantsSse = String(req.headers.accept || "").includes("text/event-stream");
    const sessionId = String(req.headers["mcp-session-id"] || "") || (method === "initialize" ? randomUUID() : "");
    if (sessionId) res.setHeader("Mcp-Session-Id", sessionId);
    res.setHeader("MCP-Protocol-Version", "2025-03-26");

    const emit = (payload: any) => {
      if (!wantsSse) return res.json(payload);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
      res.end();
    };
    const sendResult = (result: any) => emit({ jsonrpc, id, result });
    const sendError = (code: number, message: string, data?: any) =>
      emit({ jsonrpc, id, error: { code, message, ...(data ? { data } : {}) } });

    try {
      if (method === "notifications/initialized" || method === "notifications/cancelled") {
        return res.status(202).end();
      }

      if (method === "ping") {
        return sendResult({});
      }

      if (method === "initialize") {
        return sendResult({
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "synapse-journey-mcp", version: "2.0.0" },
        });
      }

      if (method === "tools/list") {
        return sendResult({ tools: MCP_TOOLS });
      }

      if (method === "tools/call") {
        const toolName = params?.name;
        const args = params?.arguments || {};

        if (toolName === "synapse.search_knowledge") {
          const query = String(args.query || "").trim();
          const limit = Math.min(25, Number(args.limit) || 8);
          if (!query) return sendError(-32602, "query is required");

          const vec = await embed(query);
          const visibleIds = new Set((await storage.getVisibleTopics(userId)).map((t) => t.id));
          const topics = (
            vec ? await storage.searchTopicsVectors(vec, limit, 0.45) : await storage.searchTopicsTrgm(query, limit)
          ).filter((t) => visibleIds.has(t.id));
          // Prose fallback so search still works without an embedding backend.
          const units = await storage.searchUnitsByText(query, limit);
          const bottlenecks = await storage.getSotaBottlenecks({ limit });
          const matchedBottlenecks = bottlenecks.filter((b) =>
            `${b.title} ${b.description} ${b.domain}`.toLowerCase().includes(query.toLowerCase())
          );
          const resources = await storage.getKnowledgeResources({ query, limit });

          return sendResult({
            content: [
              {
                type: "text",
                text: JSON.stringify({ topics, units, bottlenecks: matchedBottlenecks, resources }, null, 2),
              },
            ],
          });
        }

        if (toolName === "synapse.get_course") {
          const topicId = Number(args.topicId);
          const topic = await storage.getTopicById(topicId);
          if (!topic) return sendError(-32602, `Topic ${topicId} not found`);
          const units = await storage.getLessonUnits(topicId);
          const plan = await storage.getLatestCoursePlan(topicId);
          const bottlenecks = await storage.getSotaBottlenecks({ topicId, limit: 15 });
          const resources = await storage.getKnowledgeResources({ topicId, limit: 20 });
          const { getPriorKnowledgeForTopic } = await import("../knowledge-ledger");
          const priorKnowledge = userId
            ? await getPriorKnowledgeForTopic(storage, userId, { topicId })
            : null;
          return sendResult({
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { topic, coursePlan: plan, units, bottlenecks, resources, priorKnowledge },
                  null,
                  2,
                ),
              },
            ],
          });
        }

        if (toolName === "synapse.ingest_course") {
          let topic = args.topicId ? await storage.getTopicById(Number(args.topicId)) : undefined;
          if (!topic) {
            if (!args.topic?.title) return sendError(-32602, "Provide topicId or topic.title");
            const dup = findDuplicateTitle(
              String(args.topic.title),
              (await storage.getVisibleTopics(null)).map((t) => ({ id: t.id, title: t.title })),
            );
            if (dup) {
              return sendError(-32602, "A published course already covers this subject; extend it with topicId", {
                existingTopicId: dup.id,
                existingTitle: dup.title,
                similarity: Number(dup.score.toFixed(2)),
              });
            }
            const allTopics = await storage.getTopics();
            const existing = allTopics.find(
              (t) => t.title.toLowerCase() === String(args.topic.title).trim().toLowerCase()
            );
            if (existing) {
              topic = existing;
            } else {
              const cats = await storage.getCategories();
              const cat =
                cats.find((c) => c.name.toLowerCase() === String(args.topic.categoryName || "").toLowerCase()) ||
                cats[0];
              topic = await storage.createTopic({
                title: String(args.topic.title).trim(),
                description: args.topic.description || `Agent-authored course on ${args.topic.title}`,
                categoryId: cat?.id ?? null,
                difficulty: args.topic.difficulty || "beginner",
              });
            }
          }

          const gate = scoreCourse(
            (args.units || []).map((u: any) => ({ title: u.title, contentJson: u.contentJson })),
            "focused_skill",
          );
          const blocked = blockingIssues(gate);
          if (blocked.length > 0) {
            return sendError(-32602, "Content quality gate failed", gate as any);
          }

          const existingUnits = await storage.getLessonUnits(topic.id);
          const nextOrderByDiff: Record<string, number> = {
            beginner: 1,
            intermediate: 1,
            advanced: 1,
            nextgen: 1,
          };
          for (const u of existingUnits) {
            nextOrderByDiff[u.difficulty] = Math.max(nextOrderByDiff[u.difficulty] || 1, (u.unitIndex || 0) + 1);
          }

          const createdUnits = [];
          for (const u of args.units || []) {
            const diff = u.difficulty || "beginner";
            const unitIndex = nextOrderByDiff[diff] || 1;
            nextOrderByDiff[diff] = unitIndex + 1;
            const created = await storage.createLessonUnit({
              topicId: topic.id,
              title: u.title,
              difficulty: diff,
              unitIndex,
              outline: u.outline || u.title,
            });
            if (u.contentJson) {
              await storage.updateLessonContent(created.id, u.contentJson);
              indexUnitToFlywheel(storage, created.id, topic.id, u.contentJson, userId).catch(() => {});
            }
            createdUnits.push(created);
          }

          await storage.updateTopicQuality(topic.id, gate.score, gate, {
            reviewed: false,
            kind: args.topicId ? "addon" : "jit",
          });
          if (!args.topicId) {
            await storage.setTopicGovernance(topic.id, { ownerUserId: userId, published: false });
          }
          await storage.upsertProgress({ userId, topicId: topic.id, status: "learning", mastery: 0 });
          indexTopicToFlywheel(storage, topic.id).catch(() => {});

          return sendResult({
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    topic,
                    unitsCreated: createdUnits.length,
                    courseUrl: `/rabbit-hole?topic=${topic.id}`,
                  },
                  null,
                  2
                ),
              },
            ],
          });
        }

        if (toolName === "synapse.list_courses") {
          const limit = Math.min(200, Number(args.limit) || 60);
          const all = await storage.getVisibleTopics(userId);
          const cats = await storage.getCategories();
          const catName = new Map(cats.map((c) => [c.id, c.name]));
          const wanted = args.category ? String(args.category).toLowerCase() : null;
          const rows = [];
          for (const t of all) {
            const name = t.categoryId ? catName.get(t.categoryId) ?? null : null;
            if (wanted && (!name || name.toLowerCase() !== wanted)) continue;
            const units = await storage.getLessonUnits(t.id);
            rows.push({
              topicId: t.id,
              title: t.title,
              category: name,
              units: units.length,
              archetype: ((await storage.getLatestCoursePlan(t.id))?.planJson as any)?.archetype ?? null,
              qualityScore: t.qualityScore,
              published: t.published,
              courseUrl: `/rabbit-hole?topic=${t.id}`,
            });
            if (rows.length >= limit) break;
          }
          return sendResult({ content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] });
        }

        if (toolName === "synapse.list_sota_bottlenecks") {
          const list = await storage.getSotaBottlenecks({
            domain: args.domain,
            topicId: args.topicId ? Number(args.topicId) : undefined,
            limit: Number(args.limit) || 20,
          });
          return sendResult({
            content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
          });
        }

        if (toolName === "synapse.propose_sota_bottleneck") {
          const created = await storage.upsertSotaBottleneck({
            domain: String(args.domain || "STEM"),
            title: String(args.title),
            description: String(args.description),
            whyItMatters: String(args.whyItMatters),
            currentApproaches: Array.isArray(args.currentApproaches) ? args.currentApproaches : [],
            openQuestions: Array.isArray(args.openQuestions) ? args.openQuestions : [],
            topicId: args.topicId ? Number(args.topicId) : null,
            source: "agent_mcp",
            createdByUserId: userId,
          });
          return sendResult({
            content: [{ type: "text", text: JSON.stringify(created, null, 2) }],
          });
        }

        if (toolName === "synapse.submit_hypothesis") {
          const created = await storage.createOpenScienceIdea({
            userId,
            authorName: req.user?.claims?.username || "Agent Researcher",
            title: String(args.title),
            content: String(args.content),
            hypothesis: args.hypothesis ? String(args.hypothesis) : null,
            methodology: args.methodology ? String(args.methodology) : null,
            falsifiability: args.falsifiability ? String(args.falsifiability) : null,
            bottleneckId: args.bottleneckId ? Number(args.bottleneckId) : null,
            topicId: args.topicId ? Number(args.topicId) : null,
            crossDomainTopicIds: Array.isArray(args.crossDomainTopicIds) ? args.crossDomainTopicIds : [],
            status: "hypothesis",
          });
          return sendResult({
            content: [{ type: "text", text: JSON.stringify(created, null, 2) }],
          });
        }

        if (toolName === "synapse.get_3d_map") {
          const graph = await storage.getKnowledgeGraph(userId);
          return sendResult({
            content: [{ type: "text", text: JSON.stringify(graph, null, 2) }],
          });
        }

        if (toolName === "synapse.log_learning") {
          const rawConcepts = Array.isArray(args.concepts) ? args.concepts : [];
          if (rawConcepts.length === 0) {
            return sendError(-32602, "concepts array with at least 1 entry is required");
          }
          const stream = ["mcp_agent", "jit", "linear", "agent_chat"].includes(args.stream)
            ? args.stream
            : "mcp_agent";
          const createMapNodeIfMissing = args.createMapNodeIfMissing !== false;
          const { logAndReconcileKnowledge } = await import("../knowledge-ledger");
          const result = await logAndReconcileKnowledge(
            storage,
            userId,
            rawConcepts.slice(0, 25).map((c: any) => ({
              conceptTitle: String(c.conceptTitle || "").trim(),
              summary: String(c.summary || c.conceptTitle || "").trim(),
              stream,
              depthLevel: ["intro", "core", "advanced", "frontier"].includes(c.depthLevel)
                ? c.depthLevel
                : "core",
              confidence: Number(c.confidence) || 85,
              topicId: c.topicId ? Number(c.topicId) : null,
              topicTitle: c.topicTitle ? String(c.topicTitle) : null,
              tags: Array.isArray(c.tags) ? c.tags.map((t: any) => String(t)) : [],
              createMapNodeIfMissing,
            })),
          );
          const xpAwarded = result.entries.length * 15;
          if (xpAwarded > 0) {
            await storage.addXp(userId, xpAwarded).catch(() => {});
          }
          await storage.recordTimelineEvent({
            userId,
            topicId: result.touchedTopics[0]?.topicId ?? null,
            eventType: "agent_learned",
            metadata: {
              stream,
              conceptsLogged: result.entries.map((e) => e.conceptTitle),
              touchedTopics: result.touchedTopics,
              matchedUnitsCount: result.matchedUnitsCount,
            },
          });
          return sendResult({
            content: [
              {
                type: "text",
                text: JSON.stringify({ ...result, xpAwarded }, null, 2),
              },
            ],
          });
        }

        if (toolName === "synapse.get_prior_knowledge") {
          const { getPriorKnowledgeForTopic } = await import("../knowledge-ledger");
          const report = await getPriorKnowledgeForTopic(storage, userId, {
            topicId: args.topicId ? Number(args.topicId) : undefined,
            query: args.query ? String(args.query) : undefined,
          });
          return sendResult({
            content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
          });
        }

        if (toolName === "synapse.architect_pathway") {
          const targetGoal = String(args.targetGoal || "").trim();
          if (!targetGoal) return sendError(-32602, "targetGoal is required");
          const trackType = [
            "role_career",
            "industry_frontier",
            "classical_science",
            "alt_degree_mba",
          ].includes(args.trackType)
            ? args.trackType
            : "role_career";
          const { architectMasteryRoadmap } = await import("../pathway-architect");
          const result = await architectMasteryRoadmap(storage, userId, {
            targetGoal,
            trackType,
            priorBackground: args.priorBackground ? String(args.priorBackground) : undefined,
            dailyMinutes: Number(args.dailyMinutes) || 60,
          });
          return sendResult({
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    ...result,
                    pathwayUrl: `/pathway/${result.pathway.id}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          });
        }

        if (toolName === "synapse.get_pathway_timeline") {
          const pathwayId = Number(args.pathwayId);
          if (!pathwayId) return sendError(-32602, "pathwayId is required");
          const paceMode =
            args.paceMode === "fast_track" || args.paceMode === "rigorous" ? args.paceMode : "balanced";
          const { computePathwayTimeline } = await import("../pathway-architect");
          const report = await computePathwayTimeline(storage, userId, pathwayId, {
            dailyMinutes: Number(args.dailyMinutes) || 60,
            paceMode,
          });
          return sendResult({
            content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
          });
        }

        if (toolName === "synapse.calibrate_placement") {
          const pathwayId = Number(args.pathwayId);
          const calibratedBlocks = Array.isArray(args.calibratedBlocks) ? args.calibratedBlocks : [];
          if (!pathwayId || calibratedBlocks.length === 0) {
            return sendError(-32602, "pathwayId and calibratedBlocks are required");
          }
          const { calibratePathwayPlacement } = await import("../pathway-architect");
          const result = await calibratePathwayPlacement(storage, userId, pathwayId, {
            calibratedBlocks: calibratedBlocks.map((b: any) => ({
              topicId: Number(b.topicId),
              masteryPct: Number(b.masteryPct) || 0,
              note: b.note ? String(b.note) : undefined,
            })),
            dailyMinutes: Number(args.dailyMinutes) || 60,
          });
          return sendResult({
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          });
        }

        if (toolName === "synapse.get_knowledge_chemistry") {
          const { computeKnowledgeChemistry, getPortfolioArtifacts } = await import("../pathway-architect");
          const chemistry = await computeKnowledgeChemistry(storage, userId);
          const artifacts = await getPortfolioArtifacts(userId);
          return sendResult({
            content: [{ type: "text", text: JSON.stringify({ chemistry, artifacts }, null, 2) }],
          });
        }

        return sendError(-32601, `Unknown tool: ${toolName}`);
      }

      return sendError(-32601, `Unsupported MCP method: ${method}`);
    } catch (err: any) {
      console.error("[MCP] Error handling request:", err);
      return sendError(-32603, err?.message || "Internal MCP error");
    }
  });
}
