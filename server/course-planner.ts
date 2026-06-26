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

import { generateCourseContent } from "./ai-providers";

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
}

// ── AI-Driven Planning ────────────────────────────────────────────────────

const PLANNER_PROMPT = `You are an expert curriculum architect. Your job is to design the OPTIMAL course structure for a given topic — not to force it into a fixed template.

TOPIC: "{topicTitle}"
DESCRIPTION: "{topicDescription}"

Your task: Analyze this topic and design the ideal curriculum shape. Consider:

1. SCOPE ANALYSIS — How broad or narrow is this topic?
   - "micro" (e.g., "How to solve a Rubik's Cube", "Using the Requests library") → 2-6 units total, 1-2 tiers
   - "focused" (e.g., "Benefits of Open Source", "Git Workflow") → 6-12 units, 2-3 tiers
   - "standard" (e.g., "Graph Theory", "Music Theory") → 12-20 units, 3-4 tiers
   - "broad" (e.g., "Calculus", "Organic Chemistry") → 16-28 units, 4 tiers, possibly with sub-topics
   - "interdisciplinary" (e.g., "Quantum Mechanics", "Machine Learning") → 20-30+ units, 4-5 tiers, likely needs sub-topic decomposition

2. TIER DESIGN — Choose the RIGHT tier structure:
   - A micro topic might only need "Fundamentals" and "Practice" (2 tiers)
   - A broad topic might need "Foundations → Core Mechanics → Advanced Applications → Frontier" (4 tiers)
   - An interdisciplinary topic might need 5 tiers or sub-topic decomposition
   - Tier NAMES should be descriptive and topic-appropriate, not generic "Beginner/Intermediate/Advanced"

3. UNIT COUNT — How many units per tier? This should reflect the actual depth needed:
   - Don't pad with filler units
   - Don't compress a topic that genuinely needs depth
   - Think about what a learner actually needs to master this subject

4. SUB-TOPIC DECOMPOSITION — For broad/interdisciplinary topics, should this be broken into sub-topics?
   - E.g., "Physics" → ["Classical Mechanics", "Thermodynamics", "Electromagnetism", "Quantum Mechanics"]
   - Each sub-topic gets its own mini-curriculum

5. OPEN EDUCATIONAL RESOURCES — Recommend 3-5 OER sources the curriculum should be built around:
   - MIT OpenCourseWare (ocw.mit.edu)
   - Khan Academy (khanacademy.org)
   - OpenStax (openstax.org)
   - LibreTexts (libretexts.org)
   - Wikiversity (en.wikiversity.org)
   - arXiv (arxiv.org)
   - YouTube educational channels (CrashCourse, MIT OCW, Stanford)
   - Other topic-specific OER

Respond with ONLY a JSON object in this exact format:
{
  "scope": "micro|focused|standard|broad|interdisciplinary",
  "complexityAssessment": "1-2 sentence explanation of why this structure was chosen",
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
  ]
}

CRITICAL RULES:
- Total units should match the sum of tier unitCounts.
- Every unit must have a UNIQUE title covering DISTINCT material.
- Tier names in units must match tier names in the tiers array.
- For micro topics (2-6 units), don't over-engineer — 1-2 tiers is fine.
- For broad/interdisciplinary topics with hasSubTopics=true, provide 2-5 sub-topics each with their own units.
- Unit outlines should be 1-2 sentences describing exactly what material that unit covers.
- Think like a brilliant professor designing a real university course — what does a student ACTUALLY need to learn this subject?
- DO NOT include quiz questions in units. Quizzes are generated on-demand when the learner requests them.`;

/**
 * Use AI to plan the optimal curriculum structure for a topic.
 * Falls back to legacy heuristic on failure.
 */
export async function planCourseWithAI(
  topicTitle: string,
  topicDescription: string
): Promise<CoursePlan> {
  const prompt = PLANNER_PROMPT
    .replace("{topicTitle}", topicTitle)
    .replace("{topicDescription}", topicDescription || `Learning about ${topicTitle}`);

  try {
    const content = await generateCourseContent(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", temperature: 0.7 }
    ) || "{}";

    const parsed = JSON.parse(content);

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
    const units: CoursePlanUnit[] = parsed.units.map((u: any) => {
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

    console.log(
      `[CoursePlan] AI planned "${topicTitle}": scope=${plan.scope}, ` +
      `${plan.tiers.length} tiers, ${totalUnits} units, ` +
      `contentType=${plan.contentType}, hasSubTopics=${plan.hasSubTopics}`
    );

    return plan;
  } catch (error) {
    console.warn(`[CoursePlan] AI planning failed for "${topicTitle}", falling back to heuristic:`, error);
    return legacyHeuristicPlan(topicTitle, topicDescription);
  }
}

// ── Legacy Heuristic Fallback ──────────────────────────────────────────────

import { classifyTopicByKeywords } from "./routes/ai";

/**
 * Fallback: build a CoursePlan from the legacy keyword-based heuristic.
 * Used when AI planning fails or for topics that already have pre-planned syllabi.
 */
export function legacyHeuristicPlan(topicTitle: string, topicDescription: string): CoursePlan {
  const profile = classifyTopicByKeywords(topicTitle, topicDescription);
  const tiers = profile.unitsPerTier;

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
    complexityAssessment: `Heuristic classification: ${profile.category} (${profile.contentType})`,
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
