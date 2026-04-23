/**
 * SynapseJourney — Bulk Populate All Lesson Units with Content
 * ─────────────────────────────────────────────────────────────
 * One-shot script to populate the entire lesson_units table:
 *   1. Deletes existing lesson units for all 70 topics
 *   2. Creates fresh units from pre-planned syllabi
 *   3. Populates contentJson from seed-lesson-content.ts
 *
 * Requires DATABASE_URL environment variable.
 * Run: DATABASE_URL=postgresql://... npx tsx scripts/bulk-populate.ts
 */

import { storage } from "../server/storage";
import { SYLLABI } from "../server/syllabi";
import { SEED_LESSON_CONTENT } from "../server/seed-lesson-content";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SynapseJourney — Bulk Lesson Population");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const topics = await storage.getTopics();
  console.log(`Found ${topics.length} topics in database.`);

  const stats = {
    topicsCleared: 0,
    unitsCreated: 0,
    contentUpdated: 0,
    errors: 0,
  };

  for (const topic of topics) {
    const syllabus = SYLLABI.find((s) => s.topicId === topic.id);
    if (!syllabus) {
      console.log(`  [Topic ${topic.id}] "${topic.title}" — no syllabus found, skipping.`);
      continue;
    }

    const seedUnits = SEED_LESSON_CONTENT[topic.id];
    if (!seedUnits || seedUnits.length === 0) {
      console.log(`  [Topic ${topic.id}] "${topic.title}" — no seed content found, skipping.`);
      continue;
    }

    try {
      // 1. Delete existing units (and dependent rows are handled by storage)
      await storage.deleteLessonUnitsByTopicId(topic.id);
      stats.topicsCleared++;

      // 2. Create units from syllabus + seed content
      for (let i = 0; i < syllabus.units.length; i++) {
        const u = syllabus.units[i];
        const seed = seedUnits.find(
          (s) => s.unitIndex === u.position - 1 && s.difficulty === u.tier
        );

        const unit = await storage.createLessonUnit({
          topicId: topic.id,
          difficulty: u.tier,
          contentType: syllabus.contentType,
          unitIndex: u.position - 1,
          title: u.title,
          outline: `${u.objective} Key concepts: ${u.keyConcepts.join(", ")}`,
          contentJson: seed ? seed.contentJson : null,
        });

        stats.unitsCreated++;
        if (seed) stats.contentUpdated++;

        process.stdout.write(seed ? "+" : "·");
      }

      console.log(`  [Topic ${topic.id}] "${topic.title}" — ${syllabus.units.length} units created.`);
      await sleep(50); // tiny breath between topics
    } catch (err) {
      console.error(`\n  ✗ Error on topic ${topic.id}:`, err);
      stats.errors++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Done!");
  console.log(`  Topics cleared: ${stats.topicsCleared}`);
  console.log(`  Units created:  ${stats.unitsCreated}`);
  console.log(`  Content filled: ${stats.contentUpdated}`);
  console.log(`  Errors:         ${stats.errors}`);
  console.log("═══════════════════════════════════════════════════════════════");

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
