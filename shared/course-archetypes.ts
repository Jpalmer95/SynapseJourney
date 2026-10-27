/**
 * Course archetypes — the canonical shape of each kind of course.
 *
 * One source of truth shared by the planner (how many units / tiers), the lesson
 * generator (how long each section should be), and the UI (what the learner
 * expects). The rule that keeps Synapse coherent: a course is only as good as the
 * match between its archetype and the learner's time horizon that day.
 *
 *   rapid_bootstrap  — "unblock me today" (3–5 lean units, no history)
 *   focused_skill    — one capability, practiced (6–10 units)
 *   foundation       — a real underlayment in a science/engineering field (18–28 units)
 *   deep_dive        — a niche inside a field, done properly (12–18 units)
 *   frontier_survey  — where a field is stuck right now (6–10 units, papers + bottlenecks)
 *   cross_domain     — synthesis of 2+ fields with one capstone build (8–14 units)
 */

export type CourseArchetype =
  | "rapid_bootstrap"
  | "focused_skill"
  | "foundation"
  | "deep_dive"
  | "frontier_survey"
  | "cross_domain";

export type PlannerIntent = "survey" | "standard" | "deep" | "speed_run" | "goal";
export type PlannerLength = "quick" | "standard" | "deep";
export type TechnicalLevel = "beginner" | "intermediate" | "advanced" | "expert";

export interface SectionBudget {
  /** Prose words per concept section (one "section" = one heading-level block). */
  wordsPerSection: [number, number];
  /** How many concept sections a unit's lesson should contain. */
  conceptSections: [number, number];
  /** Key takeaways per unit. */
  takeaways: number;
  /** External (preferably free/OER) resources per unit. */
  resources: [number, number];
  /** Worked example / derivation / runnable code block per unit. */
  requiresWorkedExample: boolean;
  /** Practice questions generated on demand (not stored inline). */
  quizQuestions: [number, number];
}

export interface ArchetypeSpec {
  id: CourseArchetype;
  label: string;
  /** One-line promise shown to the learner. */
  promise: string;
  /** When to pick it. */
  bestFor: string;
  learningIntent: PlannerIntent;
  courseLength: PlannerLength;
  units: [number, number];
  tiers: [number, number];
  /** Tier names the planner should prefer. */
  tierShape: string[];
  sectionBudget: SectionBudget;
  /** Wall-clock target per unit. */
  minutesPerUnit: [number, number];
  /** Anchor the course on real textbooks/courseware rather than model recall. */
  oerPolicy: string;
  /** Extra instruction injected into the planner prompt. */
  plannerNotes: string;
  /** Extra instruction injected into the lesson-content prompt. */
  sectionNotes: string;
  hasCapstone: boolean;
}

export const ARCHETYPES: Record<CourseArchetype, ArchetypeSpec> = {
  rapid_bootstrap: {
    id: "rapid_bootstrap",
    label: "Rapid bootstrap",
    promise: "Get unstuck today — only what the task needs.",
    bestFor: "A concrete project, fix, deploy, or decision with a deadline of hours.",
    learningIntent: "speed_run",
    courseLength: "quick",
    units: [3, 5],
    tiers: [1, 2],
    tierShape: ["Do this", "Verify it works"],
    sectionBudget: {
      wordsPerSection: [140, 240],
      conceptSections: [1, 2],
      takeaways: 3,
      resources: [2, 3],
      requiresWorkedExample: true,
      quizQuestions: [3, 5],
    },
    minutesPerUnit: [7, 12],
    oerPolicy:
      "Official docs and one canonical reference per unit. No textbooks, no history, no theory that does not change the next command.",
    plannerNotes:
      "Sequence is a dependency chain, not a syllabus: each unit must be executable immediately after the previous one. " +
      "Unit titles read like actions ('Wire the auth callback'), not academic topics. Every unit ends with a verifiable check.",
    sectionNotes:
      "Write as an operator briefing: what to do, why in one sentence, the exact commands/config, and the check that proves it worked. " +
      "Zero background sections. If a concept is needed, define it in a single sentence inline.",
    hasCapstone: false,
  },

  focused_skill: {
    id: "focused_skill",
    label: "Focused skill",
    promise: "One capability, actually usable.",
    bestFor: "A single tool, technique, or method you want to be productive with this week.",
    learningIntent: "standard",
    courseLength: "quick",
    units: [6, 10],
    tiers: [2, 3],
    tierShape: ["Mechanics", "Practice", "Edge cases"],
    sectionBudget: {
      wordsPerSection: [200, 320],
      conceptSections: [2, 2],
      takeaways: 4,
      resources: [3, 4],
      requiresWorkedExample: true,
      quizQuestions: [4, 6],
    },
    minutesPerUnit: [15, 25],
    oerPolicy: "Docs plus one course-quality tutorial series and one reference manual.",
    plannerNotes:
      "Alternate concept and drill: every conceptual unit is followed by a unit where the learner produces something. " +
      "Include one unit on failure modes and debugging.",
    sectionNotes:
      "Explain the mechanism, then show it in use, then show what breaks. Prefer a short worked example over a long essay.",
    hasCapstone: false,
  },

  foundation: {
    id: "foundation",
    label: "Foundational underlayment",
    promise: "The real underlayment — textbooks, derivations, problem sets.",
    bestFor: "Physics, orbital mechanics, electrical engineering, chemistry, math — a field you intend to actually know.",
    learningIntent: "deep",
    courseLength: "deep",
    units: [18, 28],
    tiers: [4, 5],
    tierShape: ["Foundations", "Core mechanics", "Applied methods", "Advanced", "Frontier"],
    sectionBudget: {
      wordsPerSection: [420, 650],
      conceptSections: [2, 3],
      takeaways: 5,
      resources: [4, 6],
      requiresWorkedExample: true,
      quizQuestions: [5, 8],
    },
    minutesPerUnit: [35, 50],
    oerPolicy:
      "Anchor every unit to a real, named source: OpenStax or LibreTexts chapter, MIT OCW lecture notes, a Feynman Lectures volume, " +
      "a standard textbook (cite title/author/chapter), and one full lecture video. Never rely on model recall alone for a derivation.",
    plannerNotes:
      "Build in true prerequisite order — no unit may assume a concept that has not already been taught in this course. " +
      "Foundations tier must be 5+ units and must establish notation and units of measure before any application. " +
      "Reserve the last tier for open problems and cross-field connections.",
    sectionNotes:
      "Teach like a good textbook chapter, not a summary: define symbols and units, state assumptions, derive or justify the relation, " +
      "then do one fully worked numerical example with units carried through. Flag where a real textbook chapter continues the treatment.",
    hasCapstone: true,
  },

  deep_dive: {
    id: "deep_dive",
    label: "Depth-first dive",
    promise: "One niche, done properly.",
    bestFor: "A subfield or technique you already have background in and want to reach working depth.",
    learningIntent: "deep",
    courseLength: "standard",
    units: [12, 18],
    tiers: [3, 4],
    tierShape: ["Framing", "Mechanism", "Current practice", "Limits"],
    sectionBudget: {
      wordsPerSection: [350, 520],
      conceptSections: [2, 3],
      takeaways: 5,
      resources: [4, 5],
      requiresWorkedExample: true,
      quizQuestions: [4, 7],
    },
    minutesPerUnit: [30, 40],
    oerPolicy:
      "Survey papers and primary sources take priority: one review paper, one landmark paper, plus lecture notes and a textbook chapter.",
    plannerNotes:
      "Assume working knowledge of the parent field; do not re-teach the basics. Spend the budget on mechanism, current practice, and limits.",
    sectionNotes:
      "Cite specific papers with year and venue. Distinguish consensus from contested claims. Show one derivation or benchmark table.",
    hasCapstone: true,
  },

  frontier_survey: {
    id: "frontier_survey",
    label: "Frontier survey",
    promise: "Where this field is actually stuck right now.",
    bestFor: "Cross-industry problem hunting, research orientation, forming hypotheses.",
    learningIntent: "survey",
    courseLength: "standard",
    units: [6, 10],
    tiers: [2, 3],
    tierShape: ["State of the art", "Open bottlenecks", "Attack surface"],
    sectionBudget: {
      wordsPerSection: [260, 380],
      conceptSections: [2, 2],
      takeaways: 4,
      resources: [4, 6],
      requiresWorkedExample: false,
      quizQuestions: [3, 5],
    },
    minutesPerUnit: [20, 30],
    oerPolicy: "Recent arXiv preprints, review articles, benchmark leaderboards, and standards documents.",
    plannerNotes:
      "Every unit must name at least one concrete unsolved bottleneck and who is working on it. " +
      "End the course with a unit on how to turn an observation into a falsifiable hypothesis.",
    sectionNotes:
      "Be explicit about dates and evidence quality. Separate 'established', 'contested', and 'unknown'.",
    hasCapstone: false,
  },

  cross_domain: {
    id: "cross_domain",
    label: "Cross-domain synthesis",
    promise: "Two fields fused into something neither could build alone.",
    bestFor: "Applying your background in field A to a bottleneck in field B.",
    learningIntent: "standard",
    courseLength: "standard",
    units: [8, 14],
    tiers: [3, 4],
    tierShape: ["Shared foundations", "Translation", "Synthesis", "Capstone"],
    sectionBudget: {
      wordsPerSection: [320, 480],
      conceptSections: [2, 3],
      takeaways: 5,
      resources: [3, 5],
      requiresWorkedExample: true,
      quizQuestions: [4, 6],
    },
    minutesPerUnit: [30, 40],
    oerPolicy: "At least one anchor source per domain, plus one source that already bridges them.",
    plannerNotes:
      "Every unit must pull from at least two domains. The final unit is a buildable capstone with milestones, not a summary.",
    sectionNotes:
      "Make the connection explicit in every section: which idea comes from A, which constraint from B, and why the combination is new.",
    hasCapstone: true,
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as CourseArchetype[];

export function isCourseArchetype(value: unknown): value is CourseArchetype {
  return typeof value === "string" && value in ARCHETYPES;
}

/**
 * Pick the archetype a request implies when the caller did not name one.
 * Goal/speed-run → bootstrap; deep → foundation; everything else → focused skill.
 */
export function inferArchetype(input: {
  archetype?: unknown;
  learningIntent?: string;
  courseLength?: string;
  goalDescription?: string;
}): CourseArchetype {
  if (isCourseArchetype(input.archetype)) return input.archetype;
  const intent = input.learningIntent;
  if (intent === "speed_run" || intent === "goal") return "rapid_bootstrap";
  if (intent === "deep") return input.courseLength === "standard" ? "deep_dive" : "foundation";
  if (intent === "survey") return "frontier_survey";
  return "focused_skill";
}

/** Planner-prompt block describing the target shape. */
export function archetypePlannerBlock(a: CourseArchetype, unitsRange: [number, number]): string {
  const spec = ARCHETYPES[a];
  const b = spec.sectionBudget;
  return `COURSE ARCHETYPE: ${spec.label} — ${spec.promise}
Target shape: ${unitsRange[0]}–${unitsRange[1]} units across ${spec.tiers[0]}–${spec.tiers[1]} tiers.
Tier names to prefer: ${spec.tierShape.join(" → ")}.
${spec.plannerNotes}
Open educational resources: ${spec.oerPolicy}
Section budget the lesson generator will honour: ${b.wordsPerSection[0]}–${b.wordsPerSection[1]} words per section, ${b.conceptSections[0]}–${b.conceptSections[1]} concept sections per unit, ${b.takeaways} takeaways, ${b.resources[0]}–${b.resources[1]} external resources.`;
}

/** Lesson-prompt block enforcing the section budget. Overrides generic paragraph counts. */
export function archetypeSectionBlock(a: CourseArchetype): string {
  const spec = ARCHETYPES[a];
  const b = spec.sectionBudget;
  return `SECTION BUDGET — ${spec.label} (overrides the generic paragraph count above):
- concept: ${b.conceptSections[0]}–${b.conceptSections[1]} sections, ${b.wordsPerSection[0]}–${b.wordsPerSection[1]} words each. Use "## " headings when there is more than one section.
- keyTakeaways: exactly ${b.takeaways}, each a full claim (not a topic label).
- example: ${b.requiresWorkedExample ? "required — a complete worked example with numbers/units or runnable code, not a sketch." : "optional; include only if it clarifies."}
- externalResources: ${b.resources[0]}–${b.resources[1]}, each hyper-specific to this unit. ${spec.oerPolicy}
- Tone: ${spec.sectionNotes}`;
}
