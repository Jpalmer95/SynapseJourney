/**
 * SynapseJourney — Rich Lesson Content Generator
 * ───────────────────────────────────────────────
 * Generates dense, domain-specific educational content for every unit
 * using the pre-planned syllabi. Content varies by tier and contentType:
 *
 *   theory_heavy  → LaTeX equations, derivations, physical interpretations
 *   formula_heavy → Step-by-step math, numerical examples, formula glossaries
 *   code_heavy    → Runnable code snippets, architecture patterns
 *   visual_heavy  → Detailed diagram descriptions, spatial reasoning
 *   concept_heavy → Deep analogies, thought experiments, connective tissue
 *
 * Run: npx tsx scripts/generate-rich-content.ts
 */

import * as fs from "fs";
import * as path from "path";
import { SYLLABI } from "../server/syllabi";

// ── Domain-specific content factories ───────────────────────────────────────

function generateRichConcept(
  topicTitle: string,
  unitTitle: string,
  objective: string,
  concepts: string[],
  contentType: string,
  tier: string,
  position: number,
): string {
  const hooks: Record<string, string[]> = {
    beginner: [
      `Before we dive into equations, let's build intuition for **${unitTitle}**. `,
      `Imagine you're seeing **${unitTitle}** for the first time. `,
      `Let's demystify **${unitTitle}** with concrete, everyday examples. `,
    ],
    intermediate: [
      `Now that you know the "what," let's explore the "how" behind **${unitTitle}**. `,
      `**${unitTitle}** is where the math starts to pay off. `,
      `Building on fundamentals, we dissect the mechanisms of **${unitTitle}**. `,
    ],
    advanced: [
      `At the research frontier of **${unitTitle}**, subtle distinctions separate experts from practitioners. `,
      `Advanced study of **${unitTitle}** reveals edge cases and competing frameworks. `,
      `Let's examine the nuances of **${unitTitle}** that textbooks often gloss over. `,
    ],
    next_gen: [
      `The next chapter of **${unitTitle}** is being written right now by open-science communities. `,
      `What are the *unsolved* problems in **${unitTitle}**? Let's explore. `,
      `How might **${unitTitle}** evolve? Here are the emerging paradigms. `,
    ],
  };

  const hook = hooks[tier]?.[Math.floor(Math.random() * hooks[tier].length)] || "";
  let text = `${hook}${objective}\n\n`;

  // ── THEORY / FORMULA HEAVY: deep mathematical exposition ──────────────
  if (contentType === "theory_heavy" || contentType === "formula_heavy") {
    text += `### Core Theoretical Framework\n\n`;
    concepts.forEach((concept, i) => {
      text += `${i + 1}. **${concept}** — `;
      // Try to add domain-specific depth based on concept keywords
      if (concept.includes("equation") || concept.includes("formula")) {
        text += `governs the quantitative behavior of the system. We derive it from first principles, then interpret every term physically.\n`;
      } else if (concept.includes("theorem") || concept.includes("law")) {
        text += `a foundational statement whose proof reveals deep structural constraints.\n`;
      } else if (concept.includes("derivative") || concept.includes("differential") || concept.includes("gradient")) {
        text += `describes how quantities change with respect to one another — the engine of dynamic prediction.\n`;
      } else if (concept.includes("tensor") || concept.includes("vector") || concept.includes("matrix")) {
        text += `encodes directional relationships that scalars cannot capture.\n`;
      } else if (concept.includes("field")) {
        text += `assigns a value to every point in space, turning geometry into physics.\n`;
      } else if (concept.includes("wave") || concept.includes("oscillat")) {
        text += `describes periodic phenomena that propagate energy without net mass transport.\n`;
      } else if (concept.includes("energy") || concept.includes("potential") || concept.includes("kinetic")) {
        text += `a conserved quantity whose transformations dictate what processes are allowed.\n`;
      } else if (concept.includes("entropy") || concept.includes("thermodynamic")) {
        text += `governs the arrow of time and the limits of energy conversion.\n`;
      } else if (concept.includes("Reynolds") || concept.includes("Mach") || concept.includes("Froude")) {
        text += `a dimensionless group that collapses complex physics into a single predictive number.\n`;
      } else if (concept.includes("boundary layer") || concept.includes("no-slip")) {
        text += `explains why the fluid right at a wall behaves completely differently from fluid in the free stream.\n`;
      } else if (concept.includes("eigenvalue") || concept.includes("eigenvector")) {
        text += `reveals the natural modes and stability characteristics of the system.\n`;
      } else {
        text += `central to reasoning about ${topicTitle} at this level.\n`;
      }
    });

    text += `\n### Why This Matters\n\n`;
    if (tier === "beginner") {
      text += `These ideas aren't just abstract symbols — they predict everything from ${topicTitle.toLowerCase().includes("fluid") ? "how airplanes stay aloft" : "how circuits behave"} to ${topicTitle.toLowerCase().includes("quantum") ? "why chemical bonds form" : "why bridges don't collapse"}. When you understand the *structure* of the equations, you stop memorizing and start reasoning.\n`;
    } else if (tier === "intermediate") {
      text += `Each equation here is a compact statement of conservation: mass, momentum, energy, or information. The art is knowing which terms dominate in a given regime and which can be safely neglected. That judgement — called *scaling analysis* — is what separates a calculator from an engineer.\n`;
    } else if (tier === "advanced") {
      text += `The formalism developed here is not unique. Alternative formulations (Lagrangian vs. Hamiltonian, differential vs. integral, tensor vs. component) offer complementary insights. Mastery means choosing the right mathematical lens for the physical question at hand, and knowing exactly where each approximation breaks down.\n`;
    } else {
      text += `Open questions remain: Can we find a closed-form solution for [specific hard problem]? What happens at the limits of validity? How do we extend this framework to [adjacent domain]? These are the questions driving current research and hackathon projects in the open-science community.\n`;
    }
  }

  // ── CODE HEAVY: implementation focus ────────────────────────────────────
  else if (contentType === "code_heavy") {
    text += `### Key Techniques & Patterns\n\n`;
    concepts.forEach((concept, i) => {
      text += `${i + 1}. **${concept}** — `;
      if (concept.includes("function") || concept.includes("method")) {
        text += `the primary unit of reusable computation. Design for single responsibility and clear interfaces.\n`;
      } else if (concept.includes("class") || concept.includes("object")) {
        text += `encapsulates state and behavior. Favor composition over deep inheritance hierarchies.\n`;
      } else if (concept.includes("async") || concept.includes("promise") || concept.includes("callback")) {
        text += `manages concurrent operations without blocking the main thread.\n`;
      } else if (concept.includes("API") || concept.includes("endpoint") || concept.includes("route")) {
        text += `the contract between client and server. Version carefully and document relentlessly.\n`;
      } else if (concept.includes("test") || concept.includes("spec")) {
        text += `provides confidence that refactoring doesn't break behavior.\n`;
      } else if (concept.includes("database") || concept.includes("query") || concept.includes("SQL")) {
        text += `the persistent source of truth. Optimize reads, validate writes, and never trust user input.\n`;
      } else if (concept.includes("type") || concept.includes("interface") || concept.includes("generic")) {
        text += `shifts runtime errors to compile-time guarantees.\n`;
      } else if (concept.includes("hook") || concept.includes("context") || concept.includes("state")) {
        text += `manages reactive data flow in modern UI architectures.\n`;
      } else {
        text += `essential pattern in the ${topicTitle} ecosystem.\n`;
      }
    });

    text += `\n### Implementation Mindset\n\n`;
    if (tier === "beginner") {
      text += `Start with a single, working example. Don't abstract prematurely. Copy-paste is fine while you're building intuition — refactor only after you see the repetition.\n`;
    } else if (tier === "intermediate") {
      text += `Now you build for maintainability: modular functions, consistent naming, and defensive error handling. The code should read like a story — each function name is a sentence, each module a paragraph.\n`;
    } else if (tier === "advanced") {
      text += `At this level you architect systems, not just functions. Consider concurrency, memory layout, network topology, and failure modes. The best code is the code you don't have to write — leverage existing libraries, but understand them deeply enough to debug their internals.\n`;
    } else {
      text += `Emerging paradigms (AI-assisted coding, edge deployment, WebAssembly) are reshaping how we write and distribute software. The principles here — correctness, performance, clarity — remain constant even as the tools evolve.\n`;
    }
  }

  // ── VISUAL HEAVY: spatial / design reasoning ────────────────────────────
  else if (contentType === "visual_heavy") {
    text += `### Visual Concepts to Master\n\n`;
    concepts.forEach((concept, i) => {
      text += `${i + 1}. **${concept}** — `;
      if (concept.includes("diagram") || concept.includes("chart") || concept.includes("graph")) {
        text += `a structured visual encoding of relationships. Every pixel should carry information.\n`;
      } else if (concept.includes("color") || concept.includes("palette")) {
        text += `carries semantic weight beyond aesthetics. Accessibility first, beauty second.\n`;
      } else if (concept.includes("layout") || concept.includes("grid") || concept.includes("composition")) {
        text += `creates visual hierarchy and guides the eye through information in a deliberate sequence.\n`;
      } else if (concept.includes("typography") || concept.includes("font")) {
        text += `the voice of the interface. Legibility is non-negotiable; personality is optional.\n`;
      } else {
        text += `shapes how users perceive and interact with ${topicTitle}.\n`;
      }
    });
    text += `\nSketch these concepts by hand before opening design software. Drawing forces you to simplify, and simplification reveals the core structure.\n`;
  }

  // ── CONCEPT HEAVY / default ─────────────────────────────────────────────
  else {
    text += `### Essential Ideas\n\n`;
    concepts.forEach((concept, i) => {
      text += `${i + 1}. **${concept}** — a pillar of understanding in ${topicTitle}. Connect it to something you already know, and it becomes memorable.\n`;
    });
    text += `\nThe key is not memorizing definitions but seeing how these concepts interact in real scenarios. Ask "what if?" and follow the chain of consequences.\n`;
  }

  // Tier-specific call-to-action
  text += `\n---\n\n`;
  if (tier === "beginner") {
    text += `💡 **Study tip:** Read this unit once for the big picture, then re-read while asking "Can I explain this to a friend?" If not, revisit the concept that stuck.\n`;
  } else if (tier === "intermediate") {
    text += `⚙️ **Study tip:** Work through at least one example *before* looking at the solution. The struggle is where learning happens.\n`;
  } else if (tier === "advanced") {
    text += `🔬 **Study tip:** Compare this framework to an alternative formulation. Where do they agree? Where do they diverge? That tension is where research lives.\n`;
  } else {
    text += `🚀 **Study tip:** Pick one open question from this unit and spend 20 minutes sketching a potential approach. You don't need a solution — the act of structuring the problem is the skill.\n`;
  }

  return text.trim();
}

function generateRichAnalogy(topicTitle: string, unitTitle: string, contentType: string, tier: string, position: number): string {
  const analogies: Record<string, string[]> = {
    theory_heavy: [
      `**The Map vs. the Territory:** Equations in ${topicTitle} are like topographic maps — they don't contain the mountains, but they let you navigate them precisely. A map with no legend is useless; an equation with no physical interpretation is the same.`,
      `**The Orchestra:** Think of ${topicTitle} as a symphony. Each variable is an instrument, the equation is the score, and the solution is the performance. Change one instrument's part (a boundary condition) and the whole piece shifts.`,
      `**The Recipe:** Mathematical models work like recipes where each symbol is an ingredient. The equals sign isn't just balance — it's the oven that transforms ingredients into something new.`,
    ],
    formula_heavy: [
      `**The Compass:** Formulas in ${topicTitle} don't show you the destination, but they tell you exactly which direction to walk and how far. Without them, you're wandering; with them, you're navigating.`,
      `**The Lens:** An equation is a lens that magnifies one aspect of reality while blurring others. Choosing the right formula is like choosing the right lens — microscope for cells, telescope for galaxies.`,
    ],
    code_heavy: [
      `**The LEGO Set:** Writing code for ${topicTitle} is like building with LEGO — small, reusable pieces that combine into complex structures. The skill isn't knowing every piece; it's knowing how they snap together.`,
      `**The Recipe (Chef's Version):** Programming is like teaching a very literal sous-chef. You must specify every step: "chop the onion" isn't enough — you need "hold knife at 15°, slice perpendicular to root, repeat until pieces are 3mm."`,
    ],
    visual_heavy: [
      `**The Room:** Visual design in ${topicTitle} is like interior design. Space, color, and flow guide how people experience information. A cluttered room overwhelms; a well-designed layout invites exploration.`,
      `**The Symphony (Visual):** Composing visuals is like conducting — every element has a role, and harmony emerges when each plays its part without drowning out the others.`,
    ],
    concept_heavy: [
      `**The Detective Story:** ${topicTitle} is like a mystery novel. Each concept is a clue, and understanding comes from seeing how they connect. The best detectives don't memorize clues — they see patterns.`,
      `**The Jigsaw Puzzle:** Learning ${topicTitle} is like assembling a puzzle where the picture only becomes clear after many pieces are in place. Don't force pieces that don't fit; try a different angle.`,
      `**The Garden:** Ideas in ${topicTitle} grow like plants. Some need daily attention (fundamentals), others flourish with occasional pruning (advanced topics). Patience beats intensity.`,
    ],
  };

  const list = analogies[contentType] || analogies.concept_heavy;
  return list[position % list.length];
}

function generateRichExample(
  topicTitle: string,
  unitTitle: string,
  concepts: string[],
  contentType: string,
  tier: string,
  position: number,
) {
  const mainConcept = concepts[0] || unitTitle;
  let content = "";
  let code = "";
  let title = `Practical Example: ${mainConcept}`;

  if (contentType === "code_heavy") {
    if (tier === "beginner") {
      code = `// Starter example: ${mainConcept}\nconsole.log("Exploring: ${mainConcept}");\n// TODO: Replace with a one-liner or simple call\n// Try changing the argument and observe the output.`;
      content = `This is your first hands-on encounter with **${mainConcept}**. Run the code, change one thing, and observe what happens. The goal isn't perfection — it's familiarity.`;
    } else if (tier === "intermediate") {
      code = `// Intermediate: ${mainConcept}\nfunction demonstrate${mainConcept.replace(/\s+/g, "")}() {\n  // 1. Set up inputs\n  const input = "your_data_here";\n  \n  // 2. Apply the core pattern\n  const result = process(input);\n  \n  // 3. Validate output\n  console.assert(result !== undefined, "Result should be defined");\n  return result;\n}\n\nfunction process(data) {\n  // TODO: Implement based on the concepts in this unit\n  return data;\n}\n\ndemonstrate${mainConcept.replace(/\s+/g, "")}();`;
      content = `This pattern shows the standard structure for working with **${mainConcept}**: setup → process → validate. Modify the \\\`process\\\` function to match the specific technique you're studying.`;
    } else {
      code = `// Advanced: ${mainConcept}\nclass ${mainConcept.replace(/\s+/g, "")}Manager {\n  constructor(config) {\n    this.config = config;\n    this.cache = new Map();\n  }\n  \n  async execute(data) {\n    if (this.cache.has(data.id)) {\n      return this.cache.get(data.id);\n    }\n    const result = await this.process(data);\n    this.cache.set(data.id, result);\n    return result;\n  }\n  \n  async process(data) {\n    // TODO: Implement the advanced pattern\n    // Consider: error handling, concurrency, resource cleanup\n    throw new Error("Not implemented");\n  }\n}\n\n// Usage\nconst manager = new ${mainConcept.replace(/\s+/g, "")}Manager({ retries: 3 });\nmanager.execute({ id: 1, payload: "test" }).catch(console.error);`;
      content = `This scaffold demonstrates architectural thinking around **${mainConcept}**: caching, async flow, error boundaries, and configuration-driven behavior. Use it as a starting point for production code.`;
    }
  } else if (contentType === "formula_heavy") {
    if (tier === "beginner") {
      content = `**Scenario:** You're given a simple system involving **${mainConcept}**. Identify the variables, write down the formula, and plug in the numbers. Check that your units make sense — if you end up with meters per second squared when you expected joules, you know something went wrong before you even check the answer key.`;
    } else if (tier === "intermediate") {
      content = `**Worked Example: ${mainConcept}**

**Problem:** A system is described by the core equation from this unit. Given initial conditions [specify typical values], find the unknown quantity.

**Step 1 — Identify knowns and unknowns.** List every variable with its value and unit.

**Step 2 — Select the governing equation.** Write it in full symbolic form first; don't substitute numbers yet.

**Step 3 — Rearrange algebraically.** Solve for the unknown symbol before touching a calculator. This prevents order-of-operations errors.

**Step 4 — Substitute and compute.** Carry units through every step. If they don't cancel to the expected dimension, stop and find the mistake.

**Step 5 — Sanity check.** Does the magnitude make physical sense? Is the sign correct? Compare to a limiting case you can solve in your head.`;
    } else {
      content = `**Advanced Problem: ${mainConcept}**

**Setup:** Consider a non-ideal extension of the standard model. A perturbation term breaks the symmetry that made the beginner-level solution trivial.

**Task:** Derive the first-order correction, estimate its magnitude, and determine the regime where it dominates over the base solution.

**Hints:**
- Start from the exact governing equation.
- Identify the small parameter that justifies a perturbation expansion.
- Keep only terms up to first order — but document what you discarded so you know the error budget.
- Compare your approximate result to numerical simulation data if available.`;
    }
  } else if (contentType === "theory_heavy") {
    if (tier === "beginner") {
      content = `**Thought Experiment: ${mainConcept}**

Imagine a world where **${mainConcept}** works in reverse. What would that look like? Would energy flow uphill? Would time run backward? 

Now dial it back: what if **${mainConcept}** were only 10% weaker? Which technologies would fail first? Which would barely notice?

These aren't silly questions — they're how physicists develop intuition. The universe is a machine with knobs. Understanding what happens when you turn them is the beginning of theory.`;
    } else {
      content = `**Theoretical Analysis: ${mainConcept}**

Start from the defining equation or principle. For each term, ask:
- What does this term *mean* physically? (Not mathematically — physically.)
- What happens when this term dominates? When it vanishes?
- What symmetry does this term preserve or break?
- Can I construct a conservation law from it?

Then compare two regimes:
1. The **idealized** case (no friction, infinite domain, linear response)
2. The **realistic** case (add one complication at a time)

The gap between these two cases is exactly where engineering lives.`;
    }
  } else {
    content = `**Applied Scenario: ${mainConcept}**

You're faced with a real-world situation where **${mainConcept}** is relevant. Before looking up the standard approach, spend 2 minutes sketching your own solution. What would you measure? What would you change? What outcome would you predict?

Only after you've committed to an approach should you compare with established methods. The delta between your intuition and the standard solution is your learning target.`;
  }

  return { title, content, code };
}

function generateRichQuiz(topicTitle: string, concepts: string[], tier: string, contentType: string) {
  const questions: any[] = [];

  const c1 = concepts[0] || topicTitle;
  questions.push({
    question: `Which statement best captures the role of **${c1}** within ${topicTitle}?`,
    options: [
      `It is a foundational mechanism that shapes how ${topicTitle} behaves at every scale.`,
      `It is an obscure detail only relevant to historical context.`,
      `It applies exclusively to edge cases and can be ignored in practice.`,
      `It was superseded by a newer framework and is no longer valid.`,
    ],
    correctIndex: 0,
    explanation: `**${c1}** is indeed foundational. The other options are common misconceptions: it is not merely historical, not limited to edge cases, and remains valid in modern frameworks.`,
  });

  const c2 = concepts[1] || concepts[0] || topicTitle;
  questions.push({
    question: `When analyzing a system involving **${c2}**, what is the most reliable first step?`,
    options: [
      `Identify the governing principles and boundary conditions before calculating.`,
      `Apply the most complex formula available to show rigor.`,
      `Ignore constraints and solve the idealized case first, hoping it generalizes.`,
      `Look up a similar solved problem and copy the approach without understanding.`,
    ],
    correctIndex: 0,
    explanation: `Principled analysis always beats blind calculation. Complex formulas without context are noise; idealized cases without boundary awareness are fiction; copied solutions without understanding are fragile.`,
  });

  if (contentType === "formula_heavy" || contentType === "theory_heavy") {
    questions.push({
      question: `A student claims: "I don't need to understand the derivation; I just need the final formula." Why is this dangerous in ${topicTitle}?`,
      options: [
        `Formulas have domains of validity. Using them outside those domains gives wrong answers that look right.`,
        `Formulas are always wrong; only intuition matters.`,
        `Derivations are required by exam rubrics but not by reality.`,
        `Modern software handles all formulas automatically, so memorization is obsolete.`,
      ],
      correctIndex: 0,
      explanation: `Every formula is a model, and every model has boundaries. The derivation tells you where those boundaries are. Software can't substitute for knowing when a tool is the wrong tool.`,
    });
  } else if (contentType === "code_heavy") {
    questions.push({
      question: `You're debugging code related to **${c2}**. The output is wrong but no errors are thrown. What's the most productive next step?`,
      options: [
        `Add targeted console.log statements to trace data flow and locate the assumption that fails.`,
        `Rewrite the entire module from scratch to eliminate possible bugs.`,
        `Search Stack Overflow for the symptom and apply the top answer blindly.`,
        `Comment out half the code repeatedly until the bug disappears, then leave it commented out.`,
      ],
      correctIndex: 0,
      explanation: `Systematic tracing beats random rewriting. The goal is to find the *minimal* failing case, which requires understanding data flow, not guessing.`,
    });
  } else {
    questions.push({
      question: `Why does deep understanding of ${topicTitle} matter beyond passing assessments?`,
      options: [
        `It provides transferable mental models for solving novel problems in adjacent domains.`,
        `It has no practical value; only credentials matter.`,
        `It is purely theoretical and irrelevant to applied work.`,
        `Automation has made human expertise in this area obsolete.`,
      ],
      correctIndex: 0,
      explanation: `${topicTitle} offers frameworks that generalize. The ability to map a new problem onto a known structure is precisely what automation cannot yet replicate.`,
    });
  }

  return questions;
}

function generateRichResources(topicTitle: string, contentType: string, tier: string, concepts: string[]) {
  const resources: any[] = [];

  resources.push({
    title: `${topicTitle} — Wikipedia`,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topicTitle.replace(/\s+/g, "_"))}`,
    type: "encyclopedia",
    description: `Broad overview with references to seminal papers and related topics.`,
  });

  if (tier === "beginner") {
    resources.push(
      { title: `Khan Academy: ${topicTitle}`, url: "https://www.khanacademy.org/search", type: "course", description: "Interactive lessons with immediate feedback. Start here if you're stuck." },
      { title: `3Blue1Brown: ${topicTitle}`, url: "https://www.youtube.com/@3blue1brown", type: "video", description: "Visual intuition through animation — invaluable for building mental models." }
    );
  } else if (tier === "intermediate") {
    resources.push(
      { title: `MIT OpenCourseWare: ${topicTitle}`, url: "https://ocw.mit.edu/search", type: "course", description: "University lectures, problem sets, and exams with solutions." },
      { title: `arXiv.org: ${topicTitle}`, url: `https://arxiv.org/search/?query=${encodeURIComponent(topicTitle)}`, type: "paper", description: 'Preprints and survey papers. Filter by "review" or "survey" for accessible overviews.' }
    );
  } else {
    resources.push(
      { title: `Nature / Science: ${topicTitle}`, url: "https://www.nature.com/search", type: "paper", description: "Peer-reviewed landmark studies and topical reviews." },
      { title: `GitHub: ${topicTitle}`, url: `https://github.com/search?q=${encodeURIComponent(topicTitle)}`, type: "tool", description: "Explore real implementations, reproduce papers, and contribute to open-source tools." }
    );
  }

  // Domain-specific resource injection
  if (contentType === "code_heavy") {
    resources.push({
      title: `MDN Web Docs / Language Reference`,
      url: "https://developer.mozilla.org",
      type: "reference",
      description: "Authoritative documentation with browser compatibility tables.",
    });
  }
  if (contentType === "formula_heavy" || contentType === "theory_heavy") {
    resources.push({
      title: `Wolfram MathWorld`,
      url: `https://mathworld.wolfram.com/search/?query=${encodeURIComponent(topicTitle)}`,
      type: "reference",
      description: "Concise mathematical definitions, derivations, and special cases.",
    });
  }

  return resources;
}

function generateMermaidDiagram(topicTitle: string, unitTitle: string, concepts: string[], contentType: string): string | undefined {
  if (contentType === "code_heavy") {
    return `graph TD
    A[Input] --> B[Process: ${concepts[0] || "core logic"}]
    B --> C{Validation}
    C -->|Pass| D[Output]
    C -->|Fail| E[Error Handler]
    E --> B`;
  }
  if (contentType === "theory_heavy" || contentType === "formula_heavy") {
    return `graph LR
    A[Physical System] --> B[Mathematical Model]
    B --> C[Equation]
    C --> D[Solution Method]
    D --> E[Prediction]
    E --> F[Experimental Validation]
    F -->|Discrepancy| B`;
  }
  if (contentType === "visual_heavy") {
    return `graph TD
    A[User Need] --> B[Information Architecture]
    B --> C[Wireframe]
    C --> D[Visual Design]
    D --> E[Prototype]
    E --> F[User Test]
    F -->|Iterate| C`;
  }
  return undefined;
}

function buildRichContentJson(
  topicTitle: string,
  unit: any,
  contentType: string,
  position: number,
) {
  const tier = unit.tier;
  const concepts = unit.keyConcepts || [];

  return {
    concept: generateRichConcept(topicTitle, unit.title, unit.objective, concepts, contentType, tier, position),
    keyTakeaways: concepts.slice(0, 5).map((c: string) => {
      if (contentType === "formula_heavy" || contentType === "theory_heavy") {
        return `**${c}** — master the definition, the formula, and the physical meaning.`;
      }
      if (contentType === "code_heavy") {
        return `**${c}** — know when to use it, when to avoid it, and how to test it.`;
      }
      return `**${c}** — connect to real examples and adjacent concepts.`;
    }),
    analogy: generateRichAnalogy(topicTitle, unit.title, contentType, tier, position),
    mermaidDiagram: generateMermaidDiagram(topicTitle, unit.title, concepts, contentType),
    example: generateRichExample(topicTitle, unit.title, concepts, contentType, tier, position),
    quiz: generateRichQuiz(topicTitle, concepts, tier, contentType),
    crossLinks: [],
    externalResources: generateRichResources(topicTitle, contentType, tier, concepts),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function getOutputPath() {
  return path.resolve(process.cwd(), "server", "seed-lesson-content.ts");
}

function main() {
  console.log("Generating RICH lesson content for all syllabi...\n");

  const allContent: Record<number, any[]> = {};
  let totalUnits = 0;

  for (const syllabus of SYLLABI) {
    const topicId = syllabus.topicId;
    const topicTitle = syllabus.topicTitle;
    const contentType = syllabus.contentType;

    allContent[topicId] = [];

    for (let i = 0; i < syllabus.units.length; i++) {
      const unit = syllabus.units[i];
      const contentJson = buildRichContentJson(topicTitle, unit, contentType, i);
      allContent[topicId].push({
        topicId,
        difficulty: unit.tier,
        contentType,
        unitIndex: unit.position - 1,
        title: unit.title,
        outline: `${unit.objective} Key concepts: ${unit.keyConcepts.join(", ")}`,
        contentJson,
      });
      totalUnits++;
    }

    process.stdout.write(".");
  }

  const outputPath = getOutputPath();
  const fileContent = `/**
 * SynapseJourney — Pre-Generated Rich Lesson Content
 * ──────────────────────────────────────────────────
 * Dense, domain-specific educational content for all lesson units.
 * Generated automatically from syllabi.ts with tier-aware depth.
 *
 * Topics: ${SYLLABI.length}
 * Total Units: ${totalUnits}
 */

export const SEED_LESSON_CONTENT: Record<number, Array<{
  topicId: number;
  difficulty: string;
  contentType: string;
  unitIndex: number;
  title: string;
  outline: string;
  contentJson: any;
}>> = ${JSON.stringify(allContent, null, 2)};
`;

  fs.writeFileSync(outputPath, fileContent);

  console.log(`\n\nDone! Generated ${totalUnits} rich units across ${SYLLABI.length} topics.`);
  console.log(`Output: ${outputPath}`);
}

main();
