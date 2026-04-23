/**
 * SynapseJourney — Load Pre-Generated Seed Content into Database
 * ──────────────────────────────────────────────────────────────
 * Reads server/seed-lesson-content.ts and bulk-inserts into lesson_units.
 * Safe to run multiple times: updates existing units, creates missing ones.
 *
 * Requires DATABASE_URL environment variable.
 * Run: DATABASE_URL=postgresql://... npx tsx scripts/load-seed-content.ts
 */

import { db, pool } from "../server/db";
import { lessonUnits } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { SEED_LESSON_CONTENT } from "../server/seed-lesson-content";

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SynapseJourney — Load Seed Lesson Content");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const topicIds = Object.keys(SEED_LESSON_CONTENT).map(Number);

  for (const topicId of topicIds) {
    const units = SEED_LESSON_CONTENT[topicId];
    if (!units || units.length === 0) continue;

    console.log(`[Topic ${topicId}] ${units.length} units`);

    for (const unit of units) {
      try {
        const existing = await db
          .select()
          .from(lessonUnits)
          .where(
            and(
              eq(lessonUnits.topicId, unit.topicId),
              eq(lessonUnits.difficulty, unit.difficulty),
              eq(lessonUnits.unitIndex, unit.unitIndex)
            )
          );

        if (existing.length > 0) {
          await db
            .update(lessonUnits)
            .set({
              title: unit.title,
              outline: unit.outline,
              contentType: unit.contentType,
              contentJson: unit.contentJson,
            })
            .where(eq(lessonUnits.id, existing[0].id));
          stats.updated++;
          process.stdout.write("↻");
        } else {
          await db.insert(lessonUnits).values({
            topicId: unit.topicId,
            difficulty: unit.difficulty,
            contentType: unit.contentType,
            unitIndex: unit.unitIndex,
            title: unit.title,
            outline: unit.outline,
            contentJson: unit.contentJson,
          });
          stats.created++;
          process.stdout.write("+");
        }
      } catch (err) {
        console.error(`\n  ✗ Error on "${unit.title}":`, err);
        stats.errors++;
      }
    }
    console.log("");
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Done!");
  console.log(`  Created: ${stats.created}  |  Updated: ${stats.updated}  |  Errors: ${stats.errors}`);
  console.log("═══════════════════════════════════════════════════════════════");

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
