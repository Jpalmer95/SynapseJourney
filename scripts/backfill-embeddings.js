#!/usr/bin/env node
/**
 * Backfill embeddings for SynapseJourney content.
 * Uses the local Ollama embedding engine (nomic-embed-text) to populate the
 * pgvector columns on topics and lesson_units. Run AFTER applying migration
 * 0008_hybrid_rag_embeddings.sql.
 *
 * Usage:
 *   node scripts/backfill-embeddings.js            # topics + lessons
 *   node scripts/backfill-embeddings.js topics     # topics only
 *   node scripts/backfill-embeddings.js lessons    # lessons only
 */
import { storage } from "../server/storage";
import { backfillTopicEmbeddings, backfillLessonEmbeddings } from "../server/embeddings";

async function main() {
  const which = process.argv[2] || "all";
  if (which === "all" || which === "topics") {
    console.log("Backfilling topic embeddings...");
    const n = await backfillTopicEmbeddings(storage, (d, t) => {
      process.stdout.write(`\r  topics ${d}/${t}`);
    });
    console.log(`\n  done: ${n} topics embedded`);
  }
  if (which === "all" || which === "lessons") {
    console.log("Backfilling lesson embeddings...");
    const n = await backfillLessonEmbeddings(storage, (d, t) => {
      process.stdout.write(`\r  lessons ${d}/${t}`);
    });
    console.log(`\n  done: ${n} lessons embedded`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
