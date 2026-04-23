/**
 * SynapseJourney — Populate All Lessons & Generate Seed Content
 * ───────────────────────────────────────────────────────────────
 * Reads all pre-planned syllabi and:
 *  1. Creates lesson_unit records in the database
 *  2. Generates rich default content for each unit from syllabus metadata
 *
 * This gives the platform a solid knowledge base even before AI regeneration.
 * Run: npx tsx scripts/populate-lessons-and-content.ts
 */

import { db, pool } from "../server/db";
import { lessonUnits, topics } from "@shared/schema";
import { eq } from "drizzle-orm";
import { SYLLABI } from "../server/syllabi";

// ── Content generators ───────────────────────────────────────────────────────

function generateConcept(title: string, objective: string, concepts: string[], contentType: string, tier: string): string {
  const hooks: Record<string, string[]> = {
    beginner: [
      `Imagine you're encountering ${title} for the very first time. `,
      `Let's explore ${title} through a simple, everyday lens. `,
      `Picture this: you're trying to understand ${title} without any prior knowledge. `,
    ],
    intermediate: [
      `Now that we know what ${title} is, let's understand how it actually works. `,
      `Building on the basics, we dive into the mechanisms behind ${title}. `,
      `Let's peel back the layers and see the inner workings of ${title}. `,
    ],
    advanced: [
      `At the frontier of ${title}, researchers grapple with nuanced questions that separate experts from practitioners. `,
      `Delving into the cutting edge of ${title}, we examine the subtleties that define mastery. `,
      `Advanced study of ${title} reveals competing frameworks and edge cases that challenge conventional understanding. `,
    ],
    next_gen: [
      `The future of ${title} is being written right now by open science communities and independent researchers. `,
      `What are the unanswered questions in ${title}? Let's explore the open problems. `,
      `How might ${title} evolve? We examine emerging paradigms and research directions. `,
    ],
  };

  const hook = hooks[tier]?.[Math.floor(Math.random() * hooks[tier].length)] || "";

  let concept = `${hook}${objective}\n\n`;

  if (contentType === "theory_heavy" || contentType === "formula_heavy") {
    concept += `Key theoretical foundations include: `;
    concept += concepts.map((c, i) => `${i + 1}) ${c}`).join("; ");
    concept += `.\n\nUnderstanding these principles allows you to reason systematically about ${title} rather than relying on memorization alone.`;
  } else if (contentType === "code_heavy") {
    concept += `Core techniques and patterns: `;
    concept += concepts.map((c, i) => `${i + 1}) ${c}`).join("; ");
    concept += `.\n\nPractical implementation builds intuition faster than theory alone.`;
  } else if (contentType === "visual_heavy") {
    concept += `Visual concepts to master: `;
    concept += concepts.map((c, i) => `${i + 1}) ${c}`).join("; ");
    concept += `.\n\nSketching these out by hand accelerates comprehension dramatically.`;
  } else {
    concept += `Essential ideas: `;
    concept += concepts.map((c, i) => `${i + 1}) ${c}`).join("; ");
    concept += `.\n\nConnecting these concepts to real-world scenarios deepens understanding.`;
  }

  return concept;
}

function generateAnalogy(title: string, contentType: string): string {
  const analogies: Record<string, string[]> = {
    theory_heavy: [
      `Think of ${title} like a city's infrastructure — invisible but governing everything that flows through it.`,
      `${title} is like learning a new language's grammar: rules that seem arbitrary at first, but create infinite expressive possibility.`,
    ],
    formula_heavy: [
      `Formulas in ${title} are like recipes: each variable is an ingredient, and the equation tells you how they combine to create something new.`,
      `Mathematical models in ${title} work like a GPS — they don't show you the territory, but they help you navigate it precisely.`,
    ],
    code_heavy: [
      `Writing code for ${title} is like building with LEGO — small, reusable pieces that combine into complex structures.`,
      `Programming ${title} concepts is like teaching a very literal-minded assistant: you must specify every step precisely.`,
    ],
    visual_heavy: [
      `Visual design in ${title} is like conducting an orchestra — every element has a role, and harmony emerges from careful arrangement.`,
      `Composing visuals for ${title} is like interior design: space, color, and flow guide how people experience information.`,
    ],
    concept_heavy: [
      `${title} is like a detective story: each concept is a clue, and understanding comes from seeing how they connect.`,
      `Learning ${title} is like assembling a jigsaw puzzle where the picture only becomes clear after many pieces are in place.`,
    ],
  };

  const list = analogies[contentType] || analogies.concept_heavy;
  return list[Math.floor(Math.random() * list.length)];
}

function generateExample(title: string, concepts: string[], contentType: string, tier: string) {
  const mainConcept = concepts[0] || title;

  let content = "";
  let code = "";

  if (contentType === "code_heavy" && tier !== "beginner") {
    code = `// Example: Working with ${mainConcept}\n\nfunction demo() {\n  // TODO: Implement based on specific context\n  console.log("Explore ${mainConcept} in practice");\n}\n\ndemo();`;
    content = `This code demonstrates a basic pattern involving ${mainConcept}. As you study the surrounding concepts, return to this snippet and modify it to test your understanding.`;
  } else if (contentType === "formula_heavy" && tier !== "beginner") {
    content = `Consider a scenario involving ${mainConcept}. If we define the key variables and apply the core formula, we can derive a concrete result. Work through the algebra step-by-step, checking units at each stage.`;
  } else {
    content = `Imagine you're applying ${mainConcept} to a real situation. What would you measure? What would you change? What outcome would you expect? Walk through this scenario mentally before checking standard solutions.`;
  }

  return { title: `Practical Example: ${mainConcept}`, content, code };
}

function generateQuiz(title: string, concepts: string[], tier: string) {
  const questions: any[] = [];

  // Question 1: basic recall or application
  const c1 = concepts[0] || title;
  questions.push({
    question: `Which of the following best describes ${c1}?`,
    options: [
      `It is a foundational concept central to ${title}.`,
      `It is an unrelated side topic occasionally mentioned in ${title}.`,
      `It only applies to advanced practitioners of ${title}.`,
      `It was disproven in recent research on ${title}.`,
    ],
    correctIndex: 0,
    explanation: `${c1} is indeed central to ${title}. The other options represent common misconceptions: it is not tangential, not exclusively advanced, and remains well-established.`,
  });

  // Question 2: application
  const c2 = concepts[1] || concepts[0] || title;
  questions.push({
    question: `When working with ${c2}, what is the most important consideration?`,
    options: [
      `Understanding its context and limitations within ${title}.`,
      `Memorizing every possible variant without deeper understanding.`,
      `Avoiding it entirely in favor of simpler approximations.`,
      `Assuming it works identically across all domains.`,
    ],
    correctIndex: 0,
    explanation: `Context and limitations matter most. Blind memorization, avoidance, or universal assumptions lead to errors in application.`,
  });

  // Question 3: synthesis or "why"
  questions.push({
    question: `Why does understanding ${title} matter beyond academic interest?`,
    options: [
      `It provides practical tools and mental models for solving real problems.`,
      `It is purely theoretical with no practical relevance.`,
      `It only matters for passing exams.`,
      `It is obsolete due to modern automation.`,
    ],
    correctIndex: 0,
    explanation: `${title} offers actionable frameworks and mental models. Dismissing it as purely theoretical, exam-only, or obsolete misses its transformative practical value.`,
  });

  return questions;
}

function generateResources(title: string, contentType: string, tier: string) {
  const resources: any[] = [];

  resources.push({
    title: `${title} — Grokipedia`,
    url: `https://grokipedia.com/page/${title.replace(/\s+/g, "_")}`,
    type: "encyclopedia",
    description: `Comprehensive encyclopedic reference covering key concepts, history, and related topics.`,
  });

  if (tier === "beginner") {
    resources.push(
      {
        title: `Khan Academy: ${title}`,
        url: "https://www.khanacademy.org",
        type: "course",
        description: "Free, interactive lessons with practice exercises at your own pace.",
      },
      {
        title: `CrashCourse: ${title} on YouTube`,
        url: "https://www.youtube.com/@crashcourse",
        type: "video",
        description: "Engaging, fast-paced video introductions by expert educators.",
      }
    );
  } else if (tier === "intermediate") {
    resources.push(
      {
        title: `MIT OpenCourseWare: ${title}`,
        url: "https://ocw.mit.edu",
        type: "course",
        description: "University-level lectures, notes, and problem sets freely available.",
      },
      {
        title: `arXiv Papers on ${title}`,
        url: "https://arxiv.org",
        type: "paper",
        description: "Preprint repository for cutting-edge research and survey papers.",
      }
    );
  } else {
    resources.push(
      {
        title: `Nature / Science Journals: ${title}`,
        url: "https://www.nature.com",
        type: "paper",
        description: "Peer-reviewed landmark studies and review articles.",
      },
      {
        title: `Open Source Projects Related to ${title}`,
        url: "https://github.com/search",
        type: "tool",
        description: "Explore real implementations, contribute, and learn from production code.",
      }
    );
  }

  return resources;
}

function buildContentJson(unit: any, topicTitle: string, contentType: string) {
  const tier = unit.tier;
  const concepts = unit.keyConcepts || [];

  return {
    concept: generateConcept(unit.title, unit.objective, concepts, contentType, tier),
    keyTakeaways: concepts.slice(0, 5).map((c: string) => `${c}: foundational to understanding ${unit.title}`),
    analogy: generateAnalogy(unit.title, contentType),
    example: generateExample(unit.title, concepts, contentType, tier),
    quiz: generateQuiz(unit.title, concepts, tier),
    crossLinks: [],
    externalResources: generateResources(topicTitle, contentType, tier),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SynapseJourney — Populate Lessons & Generate Seed Content");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };

  for (const syllabus of SYLLABI) {
    const topicId = syllabus.topicId;
    const topicTitle = syllabus.topicTitle;
    const contentType = syllabus.contentType;

    console.log(`\n[Topic ${topicId}] ${topicTitle} (${syllabus.units.length} units, ${contentType})`);

    // Check if topic exists in DB
    const [topic] = await db.select().from(topics).where(eq(topics.id, topicId));
    if (!topic) {
      console.warn(`  ⚠️ Topic ${topicId} not found in database — skipping`);
      stats.errors++;
      continue;
    }

    for (const unit of syllabus.units) {
      const difficulty = unit.tier;
      const unitIndex = unit.position - 1;

      try {
        // Check if unit already exists
        const existing = await db
          .select()
          .from(lessonUnits)
          .where(eq(lessonUnits.topicId, topicId))
          .where(eq(lessonUnits.difficulty, difficulty))
          .where(eq(lessonUnits.unitIndex, unitIndex));

        const contentJson = buildContentJson(unit, topicTitle, contentType);

        if (existing.length > 0) {
          // Update existing unit with content
          await db
            .update(lessonUnits)
            .set({
              title: unit.title,
              outline: `${unit.objective} Key concepts: ${unit.keyConcepts.join(", ")}`,
              contentType,
              contentJson,
            })
            .where(eq(lessonUnits.id, existing[0].id));
          stats.updated++;
          process.stdout.write("↻");
        } else {
          // Create new unit
          await db.insert(lessonUnits).values({
            topicId,
            difficulty,
            contentType,
            unitIndex,
            title: unit.title,
            outline: `${unit.objective} Key concepts: ${unit.keyConcepts.join(", ")}`,
            contentJson,
          });
          stats.created++;
          process.stdout.write("+");
        }
      } catch (err) {
        console.error(`\n  ✗ Error on unit "${unit.title}":`, err);
        stats.errors++;
      }
    }
  }

  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  Done!");
  console.log(`  Created: ${stats.created}  |  Updated: ${stats.updated}  |  Skipped: ${stats.skipped}  |  Errors: ${stats.errors}`);
  console.log("═══════════════════════════════════════════════════════════════");

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
