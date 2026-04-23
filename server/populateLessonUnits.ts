import { storage } from "./storage";
import { generateLessonOutline } from "./routes";
import { SYLLABI } from "./syllabi";
import { SEED_LESSON_CONTENT } from "./seed-lesson-content";

export async function populateMissingLessonUnits(): Promise<void> {
  console.log("Checking for topics missing lesson units...");
  
  try {
    const topics = await storage.getTopics();
    let populatedCount = 0;
    
    for (const topic of topics) {
      const existingUnits = await storage.getLessonUnits(topic.id);
      
      if (existingUnits.length === 0) {
        console.log(`Creating lesson units for topic: ${topic.title} (ID: ${topic.id})...`);
        
        const plannedSyllabus = SYLLABI.find(s => s.topicId === topic.id);
        if (plannedSyllabus) {
          // Use pre-planned syllabus + seed content
          const seedUnits = SEED_LESSON_CONTENT[topic.id] || [];
          for (const u of plannedSyllabus.units) {
            const seed = seedUnits.find(
              s => s.unitIndex === u.position - 1 && s.difficulty === u.tier
            );
            await storage.createLessonUnit({
              topicId: topic.id,
              difficulty: u.tier,
              contentType: plannedSyllabus.contentType,
              unitIndex: u.position - 1,
              title: u.title,
              outline: `${u.objective} Key concepts: ${u.keyConcepts.join(", ")}`,
              contentJson: seed ? seed.contentJson : null,
            });
          }
          console.log(`  -> Created ${plannedSyllabus.units.length} units from syllabus + seed content.`);
        } else {
          // Fallback to AI generation
          await generateLessonOutline(topic.id, topic.title, topic.description);
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
