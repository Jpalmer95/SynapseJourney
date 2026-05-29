// server/routes/shared.ts — Shared utilities used across route modules
import { createHash } from "crypto";
import { z } from "zod";
import { authStorage } from "../replit_integrations/auth/storage";

// ── Shared Helper Functions ──────────────────────────────────

// Compute a short SHA-256 hash of lesson content for traceability logging
export function contentHash(content: unknown): string {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 12);
}

// Build a Grokipedia resource object for a given topic title
export function buildGrokipediaResource(topicTitle: string) {
  const slug = topicTitle.replace(/ /g, "_");
  return {
    title: `${topicTitle} — Grokipedia`,
    url: `https://grokipedia.com/page/${slug}`,
    type: "encyclopedia",
    description: `Comprehensive encyclopedic reference for ${topicTitle} — covers key concepts, history, related topics, and links to deeper subtopics.`,
  };
}

// Inject a Grokipedia link into lesson content at response time (does NOT modify stored content).
// For regular lessons: appends to externalResources. For Next Gen: appends to resources.
export function injectGrokipediaResource(content: unknown, topicTitle: string, isNextGen: boolean): unknown {
  if (typeof content !== "object" || content === null) return content;
  const grokipedia = buildGrokipediaResource(topicTitle);

  if (isNextGen) {
    const c = content as Record<string, unknown>;
    const resources = Array.isArray(c.resources) ? c.resources : [];
    const alreadyPresent = resources.some((r: unknown) => typeof r === "object" && r !== null && (r as Record<string, unknown>).url?.toString().includes("grokipedia.com"));
    if (alreadyPresent) return content;
    return { ...c, resources: [...resources, grokipedia] };
  } else {
    const c = content as Record<string, unknown>;
    const externalResources = Array.isArray(c.externalResources) ? c.externalResources : [];
    const alreadyPresent = externalResources.some((r: unknown) => typeof r === "object" && r !== null && (r as Record<string, unknown>).url?.toString().includes("grokipedia.com"));
    if (alreadyPresent) return content;
    return { ...c, externalResources: [...externalResources, grokipedia] };
  }
}

// ── Admin Helpers ────────────────────────────────────────────

// Admin emails - users who can regenerate lesson content
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "jpkorstad@gmail.com").split(",").map(e => e.trim().toLowerCase());

// Helper function to check if user is admin by their email
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await authStorage.getUser(userId);
  if (!user?.email) return false;
  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}

// ── Formatting Helpers ───────────────────────────────────────

export function formatTimeAgo(date: Date): string {
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

export function getDefaultLevels(topicTitle: string) {
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

// ── Validation Schemas ───────────────────────────────────────

export const saveCardSchema = z.object({
  cardId: z.number().int().positive(),
});

export const progressSchema = z.object({
  topicId: z.number().int().positive(),
  status: z.enum(["discovered", "learning", "mastered"]).optional().default("discovered"),
  mastery: z.number().int().min(0).max(100).optional().default(0),
  timeSpent: z.number().int().min(0).optional().default(0),
});

export const roadmapLevelSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  difficulty: z.string(),
  completed: z.boolean(),
  content: z.string().optional(),
});

export const roadmapResponseSchema = z.object({
  levels: z.array(roadmapLevelSchema),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  topicId: z.number().int().positive().optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
  socraticMode: z.boolean().optional().default(false),
  feynmanMode: z.boolean().optional().default(false),
  feynmanGraded: z.boolean().optional().default(false),
  synthesisQuest: z.string().optional(),
});
