/**
 * Machine-readable discovery for agents.
 *
 * An agent that has never heard of SynapseJourney should be able to GET
 * /.well-known/synapse.json and know: where the MCP server is, how to authenticate,
 * what the course archetypes are, where the public skill lives, and what is in the
 * catalogue right now. Without this, every integrator needs a human to explain it.
 */
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { ARCHETYPES, ARCHETYPE_IDS } from "../../shared/course-archetypes";

const BASE = (process.env.APP_URL || "https://synapsejourney.org").replace(/\/$/, "");

export function registerWellKnownRoutes(app: Express) {
  app.get("/.well-known/synapse.json", async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    let publishedTopics = 0;
    let publishedUnits = 0;
    try {
      const topics = await storage.getVisibleTopics(null);
      publishedTopics = topics.length;
      // Hitting every topic for a count is fine at this size; guard with a cap anyway.
      for (const t of topics.slice(0, 200)) {
        publishedUnits += (await storage.getLessonUnits(t.id)).length;
      }
    } catch {
      /* discovery must never fail because of a counting query */
    }

    res.json({
      name: "SynapseJourney",
      description:
        "Rapid-bootstrap and deep-foundation learning platform. Curated courses, a 3D knowledge map, and an open-science bottleneck registry. Agent-native: authored with your own model compute, uploaded through MCP.",
      homepage: BASE,
      version: "1.0.0",
      auth: {
        type: "bearer",
        header: "Authorization",
        format: "Bearer sj_<personal_access_token>",
        obtain: `${BASE}/settings`,
        notes: "Self-hosted mode uses personal access tokens. No OAuth provider is required.",
      },
      mcp: {
        url: `${BASE}/api/mcp`,
        transport: "streamable-http",
        protocols: ["2025-03-26", "2024-11-05"],
        capabilities: { tools: {} },
        tools: [
          "synapse.list_courses",
          "synapse.search_knowledge",
          "synapse.get_course",
          "synapse.ingest_course",
          "synapse.list_sota_bottlenecks",
          "synapse.propose_sota_bottleneck",
          "synapse.submit_hypothesis",
          "synapse.get_3d_map",
        ],
      },
      rest: {
        topics: `${BASE}/api/topics`,
        coursePlan: `${BASE}/api/topics/{topicId}/course-plan`,
        unitContent: `${BASE}/api/lessons/unit/{unitId}/content`,
        ingest: `${BASE}/api/learn/ingest`,
        myCourses: `${BASE}/api/learn/my-courses`,
        bottlenecks: `${BASE}/api/open-science/bottlenecks`,
        hypotheses: `${BASE}/api/open-science`,
        providers: `${BASE}/api/auth/providers`,
      },
      skill: {
        name: "synapse-learn",
        repo: "https://github.com/Jpalmer95/synapse-learn",
        install: "hermes skill install-Jpalmer95/synapse-learn",
        purpose: "Teach an agent the PAT + MCP + archetype contract so a learner can be taught unit by unit.",
      },
      archetypes: ARCHETYPE_IDS.map((id) => ({
        id,
        label: ARCHETYPES[id].label,
        promise: ARCHETYPES[id].promise,
        units: ARCHETYPES[id].units,
        wordsPerSection: ARCHETYPES[id].sectionBudget.wordsPerSection,
      })),
      contentPolicy: {
        qualityGate: true,
        blocks: [
          "template prose markers",
          "quiz questions repeated across units",
          "placeholder/search-page resource URLs",
          "prose outside the archetype word band",
        ],
        publish: "New agent-authored courses are private to their author until reviewed; published courses are the shared commons.",
        dedupe: "A new course whose normalised title matches a published course is rejected — extend the existing course with topicId instead.",
        license: "Course text CC BY-SA 4.0; platform code Apache-2.0.",
      },
      corpus: { publishedTopics, publishedUnits },
    });
  });
}
