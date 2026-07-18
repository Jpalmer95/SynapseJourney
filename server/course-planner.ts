/**
 * Dynamic Course Planner — AI-first curriculum design
 *
 * Replaces the rigid 4-tier heuristic (classifyTopicByKeywords) with an
 * LLM-driven approach that determines the optimal curriculum shape, depth,
 * breadth, and structure for ANY subject.
 *
 * Key idea: instead of forcing every topic into beginner/intermediate/advanced/nextgen
 * with fixed unit counts, we let the AI decide:
 *   - How many tiers the course needs (1-5+)
 *   - What those tiers should be named (not always "beginner/advanced")
 *   - How many units per tier
 *   - Whether the course should be a single topic or broken into sub-topics
 *   - What content type is most appropriate
 *
 * Falls back to the legacy heuristic if the AI call fails or for pre-seeded topics
 * that already have syllabi defined.
 */

import { generateCourseContent, generateByokOrPool, type ProviderConfig } from "./ai-providers";
import { classifyTopicByKeywords } from "./routes/ai";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CoursePlanUnit {
  title: string;
  outline: string;
  tierIndex: number;
  tierName: string;
  /** Estimated difficulty 1-5 for backward compatibility with the difficulty field */
  difficulty: "beginner" | "intermediate" | "advanced" | "nextgen";
}

export interface CoursePlanSubTopic {
  title: string;
  description: string;
  units: CoursePlanUnit[];
}

export interface CoursePlan {
  scope: "micro" | "focused" | "standard" | "broad" | "interdisciplinary";
  /** How the AI assessed the topic's complexity */
  complexityAssessment: string;
  /** Recommended content type for generation prompts */
  contentType: "code_heavy" | "formula_heavy" | "visual_heavy" | "theory_heavy" | "balanced";
  /** Whether this topic should be broken into multiple sub-topics */
  hasSubTopics: boolean;
  /** The tier names the AI chose (e.g., ["Foundations", "Core Mechanics", "Advanced", "Frontier"]) */
  tiers: { name: string; description: string; unitCount: number }[];
  /** Total unit count across all tiers */
  totalUnits: number;
  /** The actual units (flat list, each tagged with its tier) */
  units: CoursePlanUnit[];
  /** Sub-topics if the course is large enough to warrant decomposition (hasSubTopics=true) */
  subTopics?: CoursePlanSubTopic[];
  /** Open educational resources the curriculum should be built around */
  recommendedOER: { name: string; url: string; reason: string }[];
  /** Present when the goal is technical — a copyable brief for the learner's AI agent */
  agentContext?: AgentContext;
}

export interface AgentContext {
  /** One-paragraph summary of what the agent should accomplish */
  objective: string;
  /** Markdown block the user can paste into their agent (Hermes, Claude Code, etc.) */
  copyableBrief: string;
  /** Concrete definition-of-done checks */
  successCriteria: string[];
  /** Skills/tools the agent should load or install */
  suggestedSkills: string[];
  /** Common failure modes and how to avoid them */
  pitfalls: string[];
}

// ── AI-Driven Planning ────────────────────────────────────────────────────

const PLANNER_PROMPT = `You are an expert curriculum architect. Your job is to design the OPTIMAL course structure for a given topic — not to force it into a fixed template.

TOPIC: "{topicTitle}"
DESCRIPTION: "{topicDescription}"
LEARNING INTENT: "{learningIntent}"
GOAL (if any): "{goalDescription}"
TARGET COURSE LENGTH: "{targetLength}" ({targetUnitRange} units — respect this unless the topic genuinely cannot fit)
LEARNER TECHNICAL LEVEL: "{technicalLevel}"
INCLUDE AGENT CONTEXT: "{includeAgentContext}"

Your task: Analyze this topic and design the ideal curriculum shape for this LEARNING INTENT. Consider:

1. SCOPE ANALYSIS — How broad or narrow is this topic?
   - "micro" (e.g., "How to solve a Rubik's Cube", "Using the Requests library") → 2-6 units total, 1-2 tiers
   - "focused" (e.g., "Benefits of Open Source", "Git Workflow") → 6-12 units, 2-3 tiers
   - "standard" (e.g., "Graph Theory", "Music Theory") → 12-20 units, 3-4 tiers
   - "broad" (e.g., "Calculus", "Organic Chemistry") → 16-28 units, 4 tiers, possibly with sub-topics
   - "interdisciplinary" (e.g., "Quantum Mechanics", "Machine Learning") → 20-30+ units, 4-5 tiers, likely needs sub-topic decomposition

2. INTENT MODIFIERS (CRITICAL — override scope defaults when they conflict):
   - survey: prioritize BREADTH over depth. Fewer units (cap ~8-12 even for broad topics), wide conceptual map, light practice. Tier names like "Map of the Field", "Core Ideas", "Where to Go Next".
   - standard: balanced path — optimal for most learners.
   - deep: prioritize DEPTH. More units, sub-topic decomposition when useful, rigorous foundations before applications.
   - speed_run: minimal viable path (3-8 units max). Only high-leverage concepts + check understanding. No filler history units.
   - goal: reverse-engineer from the GOAL above. Sequence only what is needed to accomplish that outcome. Practical, checkpoint-driven unit titles. Drop pure theory that does not serve the goal unless required for safety/correctness.

3. TIER DESIGN — Choose the RIGHT tier structure:
   - A micro topic might only need "Fundamentals" and "Practice" (2 tiers)
   - A broad topic might need "Foundations → Core Mechanics → Advanced Applications → Frontier" (4 tiers)
   - An interdisciplinary topic might need 5 tiers or sub-topic decomposition
   - Tier NAMES should be descriptive and topic-appropriate, not generic "Beginner/Intermediate/Advanced"

4. UNIT COUNT — How many units per tier? This should reflect the actual depth needed for the INTENT:
   - Don't pad with filler units
   - Don't compress a topic that genuinely needs depth (unless intent is survey/speed_run)
   - Think about what a learner actually needs to master this subject (or achieve the goal)

5. SUB-TOPIC DECOMPOSITION — For broad/interdisciplinary topics under deep/standard, should this be broken into sub-topics?
   - E.g., "Physics" → ["Classical Mechanics", "Thermodynamics", "Electromagnetism", "Quantum Mechanics"]
   - Each sub-topic gets its own mini-curriculum
   - Prefer NOT to decompose for survey/speed_run/goal intents

6. OPEN EDUCATIONAL RESOURCES — Recommend 3-5 FREE OER sources the curriculum should be built around:
   - MIT OpenCourseWare (ocw.mit.edu)
   - Khan Academy (khanacademy.org)
   - OpenStax (openstax.org)
   - LibreTexts (libretexts.org)
   - Wikiversity (en.wikiversity.org)
   - arXiv (arxiv.org)
   - freeCodeCamp, Project Gutenberg, specific free YouTube series (CrashCourse, MIT OCW, 3Blue1Brown)
   - Prefer concrete course/page URLs when possible, not just homepage links

Respond with ONLY a JSON object in this exact format:
{
  "scope": "micro|focused|standard|broad|interdisciplinary",
  "complexityAssessment": "1-2 sentence explanation of why this structure was chosen for the intent",
  "contentType": "code_heavy|formula_heavy|visual_heavy|theory_heavy|balanced",
  "hasSubTopics": true|false,
  "tiers": [
    { "name": "Descriptive Tier Name", "description": "What this tier covers", "unitCount": N }
  ],
  "units": [
    { "title": "Specific Unit Title", "outline": "What this unit covers", "tierName": "Tier Name from tiers array above" }
  ],
  "subTopics": [
    { "title": "Sub-Topic Title", "description": "What this sub-topic covers", "units": [...] }
  ],
  "recommendedOER": [
    { "name": "Resource name", "url": "https://...", "reason": "Why this is ideal for this course" }
  ],
  "agentContext": {
    "objective": "One-paragraph statement of what the learner's AI agent should accomplish",
    "copyableBrief": "A self-contained markdown instruction block the learner can paste into their agent (Hermes Agent, Claude Code, Codex, etc.). Include: the goal, constraints, tech stack, exact deliverable, success checks, and 2-4 suggested tools/skills to load. Write it as a direct imperative prompt addressed to the agent.",
    "successCriteria": ["Concrete check 1", "Concrete check 2"],
    "suggestedSkills": ["skill-or-tool-1", "skill-or-tool-2"],
    "pitfalls": ["Common failure mode + how to avoid it"]
  }
}

CRITICAL RULES:
- Total units should match the sum of tier unitCounts.
- TARGET COURSE LENGTH is a hard requirement: quick=3-5 total units, standard=8-12, deep=16-24. Adjust tier counts so the total lands inside that range.
- Every unit must have a UNIQUE title covering DISTINCT material.
- Tier names in units must match tier names in the tiers array.
- Calibrate difficulty to LEARNER TECHNICAL LEVEL: beginner=assume no background, define every term; intermediate=assume core concepts, move fast; advanced=assume working knowledge, focus on nuance/edge cases; expert=frontier depth only, no intro material.
- For micro topics (2-6 units), don't over-engineer — 1-2 tiers is fine.
- For broad/interdisciplinary topics with hasSubTopics=true, provide 2-5 sub-topics each with their own units.
- Unit outlines should be 1-2 sentences describing exactly what material that unit covers.
- Think like a brilliant professor designing a real university course — what does a student ACTUALLY need?
- ONLY include "agentContext" when INCLUDE AGENT CONTEXT is "yes". Omit the key entirely otherwise. The copyableBrief must be immediately usable — no placeholders like {stack}; fill in real values inferred from the goal.
- DO NOT include quiz questions in units. Quizzes are generated on-demand when the learner requests them.`;

/**
 * Use AI to plan the optimal curriculum structure for a topic.
 * Falls back to legacy heuristic on failure.
 */
export type LearningIntent = "survey" | "standard" | "deep" | "speed_run" | "goal";
export type CourseLength = "quick" | "standard" | "deep";
export type TechnicalLevel = "beginner" | "intermediate" | "advanced" | "expert";

export const COURSE_LENGTH_RANGES: Record<CourseLength, { min: number; max: number }> = {
  quick: { min: 3, max: 5 },
  standard: { min: 8, max: 12 },
  deep: { min: 16, max: 24 },
};

/** Strip markdown code fences (```json ... ```) that many models wrap around JSON output. */
function stripCodeFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return m[1].trim();
  return text.trim();
}

// ── Fusion Planning ────────────────────────────────────────────────────────

const FUSION_PROMPT = `You are a polymath curriculum designer specializing in CROSS-DOMAIN synthesis.

The learner wants to FUSE these subjects into ONE unified course:
{inputs}

TARGET COURSE LENGTH: "{targetLength}" ({targetUnitRange} units)
LEARNER TECHNICAL LEVEL: "{technicalLevel}"

Your job: design a course that genuinely fuses these domains — not a "week 1: A, week 2: B" shuffle, but a course where each unit REINFORCES the others. The capstone is a single project that only makes sense because all domains are present.

Think like this example: fusing "Fluid Dynamics + Godot + Topology" → a course that builds a submarine/flight sim in Godot with real fluid physics, plus topology-based terrain/seabed mapping. Every unit pulls from at least two domains.

Requirements:
1. CROSS-LINKS — For each domain pair, find the non-obvious connection (shared math, shared algorithms, shared mental models).
2. INNOVATIVE RESEARCH ANGLES — Surface 2-3 active research/frontier questions that sit at the INTERSECTION of these domains.
3. ONE CAPSTONE PROJECT — a concrete build that uses ALL domains. Describe it precisely enough that an agent could start building it.
4. PROGRESSION — units should alternate emphasis but keep threads alive: domain A concept → applied through domain B → formalized with domain C.

Respond with ONLY a JSON object:
{
  "fusedTitle": "Course title that names the synthesis (not just the parts)",
  "rationale": "2-3 sentences: why these domains fuse beautifully and what the learner walks away able to build",
  "capstoneProject": {
    "title": "Project name",
    "description": "What it is, what it does, why it needs every domain",
    "domains": ["domain1", "domain2"],
    "milestones": ["milestone 1", "milestone 2", "milestone 3"]
  },
  "crossLinks": [
    { "domains": ["A", "B"], "insight": "The non-obvious connection" }
  ],
  "researchAngles": [
    { "title": "Frontier question", "whyInteresting": "Why this intersection is hot", "url": "https://... (paper/resource if known)" }
  ],
  "contentType": "code_heavy|formula_heavy|visual_heavy|theory_heavy|balanced",
  "tiers": [ { "name": "Tier name", "description": "...", "unitCount": N } ],
  "units": [
    { "title": "Unit title", "outline": "What it covers + which domains it pulls from", "tierName": "Tier name" }
  ],
  "recommendedOER": [ { "name": "...", "url": "https://...", "reason": "..." } ]
}

CRITICAL RULES:
- Total units within {targetUnitRange}.
- EVERY unit outline must reference at least 2 of the fused domains.
- Capstone milestones must be buildable in order.
- DO NOT include quiz questions.`;


/**
 * Heuristic: does this goal/topic describe a technical, agent-delegable task?
 * Used to decide whether to ask the planner for an Agent Playbook section.
 */
export function isTechnicalGoal(text: string): boolean {
  const t = text.toLowerCase();
  const keywords = [
    "deploy", "ship", "build", "code", "app", "api", "server", "website", "web app",
    "next.js", "nextjs", "react", "vue", "svelte", "node", "python", "rust", "go ",
    "typescript", "javascript", "sql", "database", "docker", "kubernetes", "ci/cd",
    "github", "git ", "ml", "ai ", "llm", "fine-tune", "model", "gradio", "hugging face",
    "pipeline", "automation", "script", "cli", "plugin", "extension", "bot",
    "vps", "cloud", "aws", "gcp", "azure", "vercel", "nginx", "linux",
  ];
  return keywords.some((k) => t.includes(k));
}

export async function planCourseWithAI(
  topicTitle: string,
  topicDescription: string,
  options?: {
    learningIntent?: LearningIntent;
    goalDescription?: string;
    courseLength?: CourseLength;
    technicalLevel?: TechnicalLevel;
    includeAgentContext?: boolean;
    /** BYOC: use learner's keys first, then platform pool */
    userConfig?: ProviderConfig;
  }
): Promise<CoursePlan> {
  const learningIntent = options?.learningIntent || "standard";
  const goalDescription = options?.goalDescription || "";
  const courseLength: CourseLength = options?.courseLength || "standard";
  const technicalLevel: TechnicalLevel = options?.technicalLevel || "intermediate";
  const includeAgentContext = options?.includeAgentContext === true;
  const range = COURSE_LENGTH_RANGES[courseLength];

  const prompt = PLANNER_PROMPT
    .replace("{topicTitle}", topicTitle)
    .replace("{topicDescription}", topicDescription || `Learning about ${topicTitle}`)
    .replace("{learningIntent}", learningIntent)
    .replace("{goalDescription}", goalDescription || "(none — general mastery of the topic)")
    .replace("{targetLength}", courseLength)
    .replace("{targetUnitRange}", `${range.min}–${range.max}`)
    .replace("{technicalLevel}", technicalLevel)
    .replace("{includeAgentContext}", includeAgentContext ? "yes" : "no");

  try {
    let content: string;
    // Always BYOC-or-fail for dynamic plans — never silent platform spend
    if (options?.userConfig) {
      const result = await generateByokOrPool(
        [{ role: "user", content: prompt }],
        options.userConfig,
        { responseFormat: "json", temperature: 0.7, maxTokens: 2048 }
      );
      content = result.content || "{}";
      console.log(`[CoursePlanner] plan via ${result.source}/${result.provider} for "${topicTitle}"`);
    } else {
      // No user config → heuristic only (no platform AI)
      console.warn(`[CoursePlanner] No userConfig for "${topicTitle}" — using heuristic (BYOC-only mode)`);
      return legacyHeuristicPlan(topicTitle, topicDescription, learningIntent);
    }

    const parsed = JSON.parse(stripCodeFences(content));

    // Validate the response has the required fields
    if (!parsed.tiers || !Array.isArray(parsed.tiers) || parsed.tiers.length === 0) {
      throw new Error("Invalid plan: missing tiers");
    }
    if (!parsed.units || !Array.isArray(parsed.units) || parsed.units.length === 0) {
      throw new Error("Invalid plan: missing units");
    }

    // Build a tier-name → tier-index map for tagging units
    const tierMap = new Map<string, { index: number; unitCount: number }>();
    parsed.tiers.forEach((t: any, i: number) => {
      tierMap.set(t.name, { index: i, unitCount: t.unitCount });
    });

    // Map tier names to legacy difficulty levels for DB compatibility
    // (beginner/intermediate/advanced/nextgen — used by mastery unlock system)
    const tierCount = parsed.tiers.length;
    const tierToDifficulty = (tierIndex: number): CoursePlanUnit["difficulty"] => {
      if (tierCount <= 2) return tierIndex === 0 ? "beginner" : "intermediate";
      if (tierCount === 3) {
        return tierIndex === 0 ? "beginner" : tierIndex === 1 ? "intermediate" : "advanced";
      }
      // 4+ tiers: map proportionally
      if (tierIndex === 0) return "beginner";
      if (tierIndex === tierCount - 1) return "nextgen";
      if (tierIndex === tierCount - 2) return "advanced";
      return "intermediate";
    };

    // Tag each unit with tierIndex and map to legacy difficulty
    let units: CoursePlanUnit[] = parsed.units.map((u: any) => {
      const tierInfo = tierMap.get(u.tierName);
      const tierIndex = tierInfo?.index ?? 0;
      return {
        title: u.title,
        outline: u.outline,
        tierIndex,
        tierName: u.tierName,
        difficulty: tierToDifficulty(tierIndex),
      };
    });

    // Enforce the requested course length: trim overflow units from the end of
    // the last tiers (preserves foundations; the planner was told the range but
    // may still overshoot).
    if (units.length > range.max) {
      console.log(`[CoursePlan] Trimming ${units.length} → ${range.max} units to fit "${courseLength}" length`);
      units = units.slice(0, range.max);
    }

    const totalUnits = units.length;

    // Validate sub-topics if present
    let subTopics: CoursePlanSubTopic[] | undefined;
    if (parsed.subTopics && Array.isArray(parsed.subTopics)) {
      subTopics = parsed.subTopics.map((st: any) => ({
        title: st.title,
        description: st.description,
        units: (st.units || []).map((u: any) => {
          const stTierInfo = tierMap.get(u.tierName);
          const stTierIndex = stTierInfo?.index ?? 0;
          return {
            title: u.title,
            outline: u.outline,
            tierIndex: stTierIndex,
            tierName: u.tierName,
            difficulty: tierToDifficulty(stTierIndex),
          };
        }),
      }));
    }

    const plan: CoursePlan = {
      scope: parsed.scope || "standard",
      complexityAssessment: parsed.complexityAssessment || "AI curriculum plan",
      contentType: parsed.contentType || "balanced",
      hasSubTopics: parsed.hasSubTopics || false,
      tiers: parsed.tiers.map((t: any, i: number) => ({
        name: t.name,
        description: t.description,
        unitCount: t.unitCount,
      })),
      totalUnits,
      units,
      subTopics,
      recommendedOER: (parsed.recommendedOER || []).map((o: any) => ({
        name: o.name,
        url: o.url,
        reason: o.reason,
      })),
    };

    // Agent Playbook — only when requested AND the AI returned one
    if (includeAgentContext && parsed.agentContext && typeof parsed.agentContext === "object") {
      const ac = parsed.agentContext;
      plan.agentContext = {
        objective: typeof ac.objective === "string" ? ac.objective : "",
        copyableBrief: typeof ac.copyableBrief === "string" ? ac.copyableBrief : "",
        successCriteria: Array.isArray(ac.successCriteria) ? ac.successCriteria.filter((x: any) => typeof x === "string") : [],
        suggestedSkills: Array.isArray(ac.suggestedSkills) ? ac.suggestedSkills.filter((x: any) => typeof x === "string") : [],
        pitfalls: Array.isArray(ac.pitfalls) ? ac.pitfalls.filter((x: any) => typeof x === "string") : [],
      };
    }

    console.log(
      `[CoursePlan] AI planned "${topicTitle}" intent=${learningIntent}: scope=${plan.scope}, ` +
      `${plan.tiers.length} tiers, ${totalUnits} units, ` +
      `contentType=${plan.contentType}, hasSubTopics=${plan.hasSubTopics}`
    );

    return plan;
  } catch (error) {
    console.warn(`[CoursePlan] AI planning failed for "${topicTitle}", falling back to heuristic:`, error);
    return legacyHeuristicPlan(topicTitle, topicDescription, learningIntent);
  }
}

// ── Legacy Heuristic Fallback ──────────────────────────────────────────────

/**
 * Fallback: build a CoursePlan from the legacy keyword-based heuristic.
 * Used when AI planning fails or for topics that already have pre-planned syllabi.
 */
export function legacyHeuristicPlan(
  topicTitle: string,
  topicDescription: string,
  learningIntent: LearningIntent = "standard"
): CoursePlan {
  const profile = classifyTopicByKeywords(topicTitle, topicDescription);
  let tiers = { ...profile.unitsPerTier };

  // Intent-based scaling of heuristic counts
  if (learningIntent === "survey" || learningIntent === "speed_run") {
    tiers = {
      beginner: Math.min(tiers.beginner, learningIntent === "speed_run" ? 2 : 3),
      intermediate: Math.min(tiers.intermediate, learningIntent === "speed_run" ? 2 : 3),
      advanced: learningIntent === "speed_run" ? 1 : Math.min(tiers.advanced, 2),
      nextgen: learningIntent === "speed_run" ? 0 : Math.min(tiers.nextgen, 1),
    };
  } else if (learningIntent === "deep") {
    tiers = {
      beginner: tiers.beginner + 1,
      intermediate: tiers.intermediate + 1,
      advanced: tiers.advanced + 1,
      nextgen: Math.max(tiers.nextgen, 3),
    };
  } else if (learningIntent === "goal") {
    tiers = {
      beginner: Math.min(tiers.beginner, 3),
      intermediate: Math.min(tiers.intermediate, 3),
      advanced: Math.min(tiers.advanced, 2),
      nextgen: 0,
    };
  }

  const tierDefs = [
    { name: "Foundations", description: "Core concepts and intuition", unitCount: tiers.beginner },
    { name: "Core Mechanics", description: "How things work in depth", unitCount: tiers.intermediate },
    { name: "Advanced Applications", description: "Expert-level analysis and edge cases", unitCount: tiers.advanced },
    { name: "Frontier", description: "Open problems and emerging directions", unitCount: tiers.nextgen },
  ].filter(t => t.unitCount > 0);

  const difficultyMap: CoursePlanUnit["difficulty"][] = ["beginner", "intermediate", "advanced", "nextgen"];

  // Generate placeholder unit titles for the heuristic plan
  const units: CoursePlanUnit[] = [];
  tierDefs.forEach((tier, tierIdx) => {
    for (let i = 0; i < tier.unitCount; i++) {
      units.push({
        title: i === 0 ? `${tier.name} I` : `${tier.name} ${i + 1}`,
        outline: `${tier.description} — Part ${i + 1}`,
        tierIndex: tierIdx,
        tierName: tier.name,
        difficulty: difficultyMap[tierIdx] || "beginner",
      });
    }
  });

  return {
    scope: profile.category === "narrow_tool" ? "micro" : profile.category === "focused" ? "focused" : profile.category === "deep_science" ? "interdisciplinary" : profile.category === "broad" ? "broad" : "standard",
    complexityAssessment: `Heuristic classification: ${profile.category} (${profile.contentType}), intent=${learningIntent}`,
    contentType: profile.contentType,
    hasSubTopics: false,
    tiers: tierDefs,
    totalUnits: units.length,
    units,
    recommendedOER: [],
  };
}

/**
 * Check if a topic already has a pre-planned syllabus (legacy seed content).
 * If so, skip AI planning and use the existing syllabus.
 */
// Late-bound import to avoid circular dependency
let _syllabiMap: Map<number, unknown> | null = null;

export async function checkHasSyllabus(topicId: number): Promise<boolean> {
  if (_syllabiMap === null) {
    try {
      const mod = await import("./syllabi");
      _syllabiMap = (mod as any).SYLLABI_MAP ?? new Map();
    } catch {
      _syllabiMap = new Map();
    }
  }
  const map = _syllabiMap;
  return map ? map.has(topicId) : false;
}

// ── Fusion course planner ──────────────────────────────────────────────────

export interface FusionPlan {
  fusedTitle: string;
  rationale: string;
  capstoneProject: {
    title: string;
    description: string;
    domains: string[];
    milestones: string[];
  };
  crossLinks: { domains: string[]; insight: string }[];
  researchAngles: { title: string; whyInteresting: string; url?: string }[];
  contentType: CoursePlan["contentType"];
  tiers: { name: string; description: string; unitCount: number }[];
  units: CoursePlanUnit[];
  recommendedOER: { name: string; url: string; reason: string }[];
}

/**
 * Design a cross-domain fusion course from 2+ named inputs (existing topics
 * and/or free-text subjects). BYOC-only: requires the learner's keys.
 */
export async function planFusionCourse(
  inputNames: string[],
  options: {
    courseLength?: CourseLength;
    technicalLevel?: TechnicalLevel;
    userConfig: ProviderConfig;
  }
): Promise<FusionPlan> {
  const courseLength = options.courseLength || "standard";
  const technicalLevel = options.technicalLevel || "intermediate";
  const range = COURSE_LENGTH_RANGES[courseLength];

  const inputs = inputNames.map((n, i) => `${i + 1}. ${n}`).join("\n");
  const prompt = FUSION_PROMPT
    .replace("{inputs}", inputs)
    .replace("{targetLength}", courseLength)
    .replace("{targetUnitRange}", `${range.min}–${range.max}`)
    .replace("{technicalLevel}", technicalLevel);

  const { generateByokOrPool } = await import("./ai-providers");
  const result = await generateByokOrPool(
    [{ role: "user", content: prompt }],
    options.userConfig,
    { responseFormat: "json", temperature: 0.8, maxTokens: 4096 }
  );

  const parsed = JSON.parse(stripCodeFences(result.content || "{}"));
  if (!parsed.units || !Array.isArray(parsed.units) || parsed.units.length === 0) {
    throw new Error("Fusion planner returned no units");
  }

  // Map tier names to legacy difficulty (same mapping as planCourseWithAI)
  const tierCount = (parsed.tiers || []).length;
  const tierToDifficulty = (tierIndex: number): CoursePlanUnit["difficulty"] => {
    if (tierCount <= 2) return tierIndex === 0 ? "beginner" : "intermediate";
    if (tierCount === 3) return tierIndex === 0 ? "beginner" : tierIndex === 1 ? "intermediate" : "advanced";
    if (tierIndex === 0) return "beginner";
    if (tierIndex === tierCount - 1) return "nextgen";
    if (tierIndex === tierCount - 2) return "advanced";
    return "intermediate";
  };
  const tierMap = new Map<string, number>();
  (parsed.tiers || []).forEach((t: any, i: number) => tierMap.set(t.name, i));

  let units: CoursePlanUnit[] = parsed.units.map((u: any) => {
    const tierIndex = tierMap.get(u.tierName) ?? 0;
    return {
      title: u.title,
      outline: u.outline,
      tierIndex,
      tierName: u.tierName,
      difficulty: tierToDifficulty(tierIndex),
    };
  });
  if (units.length > range.max) units = units.slice(0, range.max);

  return {
    fusedTitle: parsed.fusedTitle || inputNames.join(" × "),
    rationale: parsed.rationale || "",
    capstoneProject: {
      title: parsed.capstoneProject?.title || "Capstone project",
      description: parsed.capstoneProject?.description || "",
      domains: Array.isArray(parsed.capstoneProject?.domains) ? parsed.capstoneProject.domains : inputNames,
      milestones: Array.isArray(parsed.capstoneProject?.milestones) ? parsed.capstoneProject.milestones : [],
    },
    crossLinks: Array.isArray(parsed.crossLinks) ? parsed.crossLinks : [],
    researchAngles: Array.isArray(parsed.researchAngles) ? parsed.researchAngles : [],
    contentType: parsed.contentType || "balanced",
    tiers: (parsed.tiers || []).map((t: any) => ({ name: t.name, description: t.description, unitCount: t.unitCount })),
    units,
    recommendedOER: Array.isArray(parsed.recommendedOER) ? parsed.recommendedOER : [],
  };
}
