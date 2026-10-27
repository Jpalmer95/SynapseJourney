#!/usr/bin/env tsx
/**
 * Delete lesson units that fail the unit-level quality gate.
 *
 * Used after a course refresh lands: the new units pass, the legacy templated ones
 * next to them do not. Deleting only error-severity units keeps anything merely
 * "warn" intact.
 *
 *   npm run purge:units                 # dry run
 *   npm run purge:units -- --apply
 *   npm run purge:units -- --apply --topic 16
 */
import "../server/env";
import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { scoreUnitContent } from "../server/content-quality";
import type { CourseArchetype } from "../shared/course-archetypes";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ONLY = (() => {
  const i = args.indexOf("--topic");
  return i >= 0 ? Number(args[i + 1]) : null;
})();

async function main() {
  const topics = await storage.getTopics();
  let totalBad = 0;
  const report: { topicId: number; title: string; bad: number; kept: number }[] = [];

  for (const t of topics) {
    if (ONLY && t.id !== ONLY) continue;
    const units = await storage.getLessonUnits(t.id);
    if (units.length === 0) continue;
    const plan = await storage.getLatestCoursePlan(t.id).catch(() => undefined);
    const archetype = ((plan?.planJson as any)?.archetype ?? "focused_skill") as CourseArchetype;

    const bad: number[] = [];
    for (const u of units) {
      const q = scoreUnitContent(u.contentJson, archetype);
      if (q.issues.some((i) => i.severity === "error")) bad.push(u.id);
    }
    if (bad.length === 0) continue;
    totalBad += bad.length;
    report.push({ topicId: t.id, title: t.title, bad: bad.length, kept: units.length - bad.length });

    if (APPLY) {
      for (const id of bad) {
        await db.execute(sql`DELETE FROM lesson_units WHERE id = ${id}`);
      }
    }
  }

  report.sort((a, b) => b.bad - a.bad);
  console.log(`\nunits failing the gate: ${totalBad} across ${report.length} topics ${APPLY ? "(deleted)" : "(dry run)"}`);
  for (const r of report.slice(0, 40)) {
    console.log(String(r.topicId).padStart(4), String(r.bad).padStart(4), "bad /", String(r.kept).padStart(3), "kept  ", r.title.slice(0, 55));
  }
  if (!APPLY) console.log("\nRe-run with --apply to delete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
