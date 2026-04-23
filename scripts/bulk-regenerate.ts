#!/usr/bin/env tsx
/**
 * Admin Bulk Lesson Regeneration Script
 *
 * Regenerates AI lesson content for topics using the enhanced prompts
 * (theory_heavy, formula_heavy, code_heavy, visual_heavy classification).
 *
 * Usage:
 *   npx tsx scripts/bulk-regenerate.ts [options]
 *
 * Options:
 *   --dry-run              Show what would be regenerated without modifying DB
 *   --topic-id <id>        Regenerate only a specific topic (can be used multiple times)
 *   --category-id <id>     Regenerate all topics in a category
 *   --pathway-id <id>      Regenerate all topics in a pathway
 *   --concurrency <n>      Max parallel generations (default: 2)
 *   --batch-delay <ms>     Delay between batches in ms (default: 5000)
 *   --force                Delete existing units even if they have real content
 *   --skip-existing        Skip topics that already have lesson units
 *
 * Examples:
 *   npx tsx scripts/bulk-regenerate.ts --dry-run
 *   npx tsx scripts/bulk-regenerate.ts --topic-id 4 --topic-id 15
 *   npx tsx scripts/bulk-regenerate.ts --category-id 5 --force
 *   npx tsx scripts/bulk-regenerate.ts --pathway-id 1 --concurrency 1
 */

import { db } from "../server/db";
import { storage } from "../server/storage";
import { generateLessonOutline } from "../server/routes";
import { topics, lessonUnits, categories, pathways, pathwayTopics } from "../shared/schema";
import { eq, inArray, and } from "drizzle-orm";
import pLimit from "p-limit";

// ── CLI Argument Parsing ────────────────────────────────────────────────────
function parseArgs(): {
  dryRun: boolean;
  topicIds: number[];
  categoryIds: number[];
  pathwayIds: number[];
  concurrency: number;
  batchDelay: number;
  force: boolean;
  skipExisting: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    dryRun: false,
    topicIds: [] as number[],
    categoryIds: [] as number[],
    pathwayIds: [] as number[],
    concurrency: 2,
    batchDelay: 5000,
    force: false,
    skipExisting: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--dry-run":
        result.dryRun = true;
        break;
      case "--topic-id":
        result.topicIds.push(Number(args[++i]));
        break;
      case "--category-id":
        result.categoryIds.push(Number(args[++i]));
        break;
      case "--pathway-id":
        result.pathwayIds.push(Number(args[++i]));
        break;
      case "--concurrency":
        result.concurrency = Number(args[++i]);
        break;
      case "--batch-delay":
        result.batchDelay = Number(args[++i]);
        break;
      case "--force":
        result.force = true;
        break;
      case "--skip-existing":
        result.skipExisting = true;
        break;
      default:
        console.warn(`Unknown argument: ${arg}`);
    }
  }

  return result;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const config = parseArgs();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SynapseJourney — Bulk Lesson Regeneration");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Dry run:        ${config.dryRun}`);
  console.log(`  Topic IDs:      ${config.topicIds.length > 0 ? config.topicIds.join(", ") : "(all)"}`);
  console.log(`  Category IDs:   ${config.categoryIds.length > 0 ? config.categoryIds.join(", ") : "(all)"}`);
  console.log(`  Pathway IDs:    ${config.pathwayIds.length > 0 ? config.pathwayIds.join(", ") : "(all)"}`);
  console.log(`  Concurrency:    ${config.concurrency}`);
  console.log(`  Batch delay:    ${config.batchDelay}ms`);
  console.log(`  Force:          ${config.force}`);
  console.log(`  Skip existing:  ${config.skipExisting}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Validate env
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL must be set");
    process.exit(1);
  }

  // Fetch target topics
  let targetTopics = await db.select().from(topics);

  // Apply filters
  if (config.topicIds.length > 0) {
    targetTopics = targetTopics.filter((t) => config.topicIds.includes(t.id));
  }

  if (config.categoryIds.length > 0) {
    targetTopics = targetTopics.filter((t) =>
      t.categoryId ? config.categoryIds.includes(t.categoryId) : false
    );
  }

  if (config.pathwayIds.length > 0) {
    const pathwayTopicRows = await db
      .select({ topicId: pathwayTopics.topicId })
      .from(pathwayTopics)
      .where(inArray(pathwayTopics.pathwayId, config.pathwayIds));
    const allowedTopicIds = new Set(pathwayTopicRows.map((r) => r.topicId));
    targetTopics = targetTopics.filter((t) => allowedTopicIds.has(t.id));
  }

  if (targetTopics.length === 0) {
    console.log("No topics match the given filters.");
    process.exit(0);
  }

  console.log(`Found ${targetTopics.length} topic(s) to process.\n`);

  // Check which topics have existing units
  const topicsWithUnits = new Set<number>();
  if (config.skipExisting || !config.force) {
    for (const topic of targetTopics) {
      const existing = await storage.getLessonUnits(topic.id);
      if (existing.length > 0) {
        topicsWithUnits.add(topic.id);
      }
    }
  }

  // Filter out skipped topics
  const topicsToProcess = targetTopics.filter((t) => {
    if (config.skipExisting && topicsWithUnits.has(t.id)) {
      console.log(`  [SKIP] ${t.title} (ID: ${t.id}) — already has lesson units`);
      return false;
    }
    return true;
  });

  if (topicsToProcess.length === 0) {
    console.log("\nNo topics left to process after filtering.");
    process.exit(0);
  }

  console.log(`\nWill process ${topicsToProcess.length} topic(s).\n`);

  if (config.dryRun) {
    for (const topic of topicsToProcess) {
      const hasUnits = topicsWithUnits.has(topic.id);
      console.log(`  [DRY-RUN] ${topic.title} (ID: ${topic.id})${hasUnits ? " — would delete existing units" : ""}`);
    }
    console.log("\nDry run complete. No changes made.");
    process.exit(0);
  }

  // Setup concurrency limiter
  const limit = pLimit(config.concurrency);
  let completed = 0;
  let failed = 0;
  const errors: { topicId: number; title: string; error: string }[] = [];

  const startTime = Date.now();

  // Process topics with controlled concurrency
  const promises = topicsToProcess.map((topic, index) =>
    limit(async () => {
      // Optional staggered delay to avoid rate limits
      if (index > 0 && config.batchDelay > 0) {
        await new Promise((r) => setTimeout(r, config.batchDelay));
      }

      console.log(`  [${index + 1}/${topicsToProcess.length}] Regenerating: ${topic.title} (ID: ${topic.id})`);

      try {
        // Delete existing units if force mode or if units exist
        if (config.force || topicsWithUnits.has(topic.id)) {
          await storage.deleteLessonUnitsByTopicId(topic.id);
          console.log(`           → Deleted existing units for topic ${topic.id}`);
        }

        // Generate new outline and content
        const units = await generateLessonOutline(topic.id, topic.title, topic.description);

        console.log(`           → Created ${units.length} unit(s) for ${topic.title}`);
        completed++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`           → FAILED: ${msg.slice(0, 200)}`);
        failed++;
        errors.push({ topicId: topic.id, title: topic.title, error: msg });
      }
    })
  );

  await Promise.all(promises);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Regeneration Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Total topics:   ${topicsToProcess.length}`);
  console.log(`  Succeeded:      ${completed}`);
  console.log(`  Failed:         ${failed}`);
  console.log(`  Elapsed time:   ${elapsed}s`);
  console.log("═══════════════════════════════════════════════════════════════");

  if (errors.length > 0) {
    console.log("\n  Errors:");
    for (const e of errors) {
      console.log(`    • ${e.title} (ID: ${e.topicId}): ${e.error.slice(0, 150)}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
