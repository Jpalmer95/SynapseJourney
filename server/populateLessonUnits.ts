import { storage } from "./storage";

const DEFAULT_UNITS = [
  { difficulty: "beginner", unitIndex: 0, title: "Introduction & Basics", outline: "Get started with the fundamentals" },
  { difficulty: "beginner", unitIndex: 1, title: "Core Vocabulary", outline: "Learn the essential terms and concepts" },
  { difficulty: "beginner", unitIndex: 2, title: "Simple Examples", outline: "See the concepts in action with easy examples" },
  { difficulty: "intermediate", unitIndex: 0, title: "Deeper Mechanisms", outline: "Understand how things work under the hood" },
  { difficulty: "intermediate", unitIndex: 1, title: "Practical Applications", outline: "Apply your knowledge to real scenarios" },
  { difficulty: "intermediate", unitIndex: 2, title: "Common Patterns", outline: "Recognize recurring themes and approaches" },
  { difficulty: "advanced", unitIndex: 0, title: "Edge Cases", outline: "Explore unusual situations and exceptions" },
  { difficulty: "advanced", unitIndex: 1, title: "Current Research", outline: "Discover what experts are working on today" },
  { difficulty: "advanced", unitIndex: 2, title: "Expert Applications", outline: "See how professionals use these concepts" },
  { difficulty: "nextgen", unitIndex: 0, title: "Open Research Questions", outline: "Explore unsolved problems and cutting-edge questions" },
  { difficulty: "nextgen", unitIndex: 1, title: "Industry Frontiers", outline: "Discover active challenges and emerging opportunities" },
  { difficulty: "nextgen", unitIndex: 2, title: "Creative Synthesis", outline: "Combine ideas from different domains for breakthrough insights" },
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
            outline: `${unit.outline} - ${topic.title}`,
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
    // Get all lesson units with content
    const allUnits = await storage.getAllLessonUnitsWithContent();
    let regeneratedCount = 0;
    
    for (const unit of allUnits) {
      // Check if contentJson has placeholder marker
      const contentJson = unit.contentJson as Record<string, unknown> | null;
      if (contentJson && contentJson._isPlaceholder === true) {
        console.log(`Found placeholder content in unit ${unit.id}: "${unit.title}"`);
        
        // Clear the placeholder content so it will be regenerated on next access
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
