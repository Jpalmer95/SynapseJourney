import { storage } from "./storage";

const DEFAULT_UNITS = [
  { difficulty: "beginner", unitIndex: 0, title: "The Big Picture: Why This Matters", outline: "Start with a captivating story and real-world relevance — discover why this topic changes everything" },
  { difficulty: "beginner", unitIndex: 1, title: "Core Concepts Made Simple", outline: "Learn the essential ideas in plain language with memorable analogies and examples" },
  { difficulty: "beginner", unitIndex: 2, title: "Seeing It In Action", outline: "Explore real-world examples and how this shows up in daily life" },
  { difficulty: "intermediate", unitIndex: 0, title: "How It Actually Works", outline: "Dive into the mechanisms, frameworks, and underlying principles" },
  { difficulty: "intermediate", unitIndex: 1, title: "Technical Deep Dive", outline: "Build a rigorous mental model with mathematical intuition and formal frameworks" },
  { difficulty: "intermediate", unitIndex: 2, title: "Case Studies & Applications", outline: "Examine real case studies from industry and research — how experts apply this knowledge" },
  { difficulty: "advanced", unitIndex: 0, title: "State of the Art", outline: "Explore the current research frontier — what experts know, what is debated, and recent breakthroughs" },
  { difficulty: "advanced", unitIndex: 1, title: "Cutting-Edge Methods & Trade-offs", outline: "Study the most sophisticated techniques, their limitations, and the trade-offs practitioners navigate" },
  { difficulty: "advanced", unitIndex: 2, title: "Open Problems & Expert Debates", outline: "Engage with the active controversies, unsolved problems, and competing paradigms in the field today" },
  { difficulty: "nextgen", unitIndex: 0, title: "The Frontier: What We Don't Yet Know", outline: "Explore the genuine unknowns — the open roadblocks that the brightest minds are still working to solve" },
  { difficulty: "nextgen", unitIndex: 1, title: "Where Research Is Heading", outline: "Discover emerging trends, paradigm shifts, and the theoretical directions that could reshape the field" },
  { difficulty: "nextgen", unitIndex: 2, title: "Your Turn: Contribute an Idea", outline: "Synthesize what you know across domains and propose an original theoretical direction or novel idea" },
];

export async function populateMissingLessonUnits(): Promise<void> {
  console.log("Checking for topics missing lesson units...");
  
  try {
    const topics = await storage.getTopics();
    let populatedCount = 0;
    
    for (const topic of topics) {
      const existingUnits = await storage.getLessonUnits(topic.id);
      
      if (existingUnits.length === 0) {
        console.log(`Creating lesson units for topic: ${topic.title} (ID: ${topic.id})`);
        
        for (const unit of DEFAULT_UNITS) {
          await storage.createLessonUnit({
            topicId: topic.id,
            difficulty: unit.difficulty,
            unitIndex: unit.unitIndex,
            title: unit.title,
            outline: `${unit.outline} — ${topic.title}`,
          });
        }
        
        populatedCount++;
      }
    }
    
    if (populatedCount > 0) {
      console.log(`Created lesson units for ${populatedCount} topics.`);
    } else {
      console.log("All topics already have lesson units.");
    }
  } catch (error) {
    console.error("Error populating missing lesson units:", error);
  }
}

/**
 * Check for lesson units with placeholder content and regenerate them.
 * Placeholder content has _isPlaceholder: true in the contentJson field.
 * This ensures production database has real content, not placeholders.
 */
export async function regeneratePlaceholderContent(): Promise<void> {
  console.log("Checking for placeholder content in lesson units...");
  
  try {
    const allUnits = await storage.getAllLessonUnitsWithContent();
    let regeneratedCount = 0;
    
    for (const unit of allUnits) {
      const contentJson = unit.contentJson as Record<string, unknown> | null;
      if (contentJson && contentJson._isPlaceholder === true) {
        console.log(`Found placeholder content in unit ${unit.id}: "${unit.title}"`);
        await storage.clearLessonUnitContent(unit.id);
        regeneratedCount++;
      }
    }
    
    if (regeneratedCount > 0) {
      console.log(`Cleared ${regeneratedCount} placeholder lesson units for regeneration.`);
    } else {
      console.log("No placeholder content found in lesson units.");
    }
  } catch (error) {
    console.error("Error checking placeholder content:", error);
  }
}
