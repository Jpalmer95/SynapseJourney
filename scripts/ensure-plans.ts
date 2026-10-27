#!/usr/bin/env tsx
/**
 * Guarantee every topic has a course plan with a declared archetype.
 *
 * Why: `archetype` lives in `course_plans.plan_json`, and the lesson generator reads it to
 * decide section length. A course ingested without a `plan` block has no archetype, so the
 * budget silently falls back to generic prose — the exact drift the archetype contract exists
 * to prevent. This backfills a plan from the units that are already there.
 *
 *   npm run ensure:plans          # dry run
 *   npm run ensure:plans -- --apply
 */
import "../server/env";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import type { CourseArchetype } from "../shared/course-archetypes";

const APPLY = process.argv.includes("--apply");

function inferFromUnits(count: number): CourseArchetype {
  if (count <= 5) return "rapid_bootstrap";
  if (count <= 10) return "focused_skill";
  if (count <= 18) return "deep_dive";
  return "foundation";
}

async function main() {
  const topics = await storage.getTopics();
  let created = 0;
  let patched = 0;
  const report: string[] = [];

  for (const t of topics) {
    const units = await storage.getLessonUnits(t.id);
    if (units.length === 0) continue;
    const plan = await storage.getLatestCoursePlan(t.id).catch(() => undefined);
    const planJson = (plan?.planJson ?? {}) as any;

    if (plan && planJson.archetype) continue;

    const archetype = inferFromUnits(units.length);
    const payload = {
      ...planJson,
      archetype,
      contentType: planJson.contentType ?? "standard",
      scope: planJson.scope ?? "focused",
      rationale:
        planJson.rationale ??
        "Backfilled during content governance rollout: shape derived from the units already present.",
      units: units.map((u) => ({
        title: u.title,
        outline: u.outline ?? "",
        difficulty: u.difficulty,
      })),
      source: planJson.source ?? "backfill",
    };

    report.push(`${t.id} ${plan ? "patched" : "created"} archetype=${archetype} units=${units.length}  ${t.title}`);
    if (plan) patched++;
    else created++;

    if (APPLY) {
      await storage.saveCoursePlan({
        topicId: t.id,
        learningIntent: (plan as any)?.learningIntent ?? "standard",
        goalDescription: (plan as any)?.goalDescription ?? null,
        planJson: payload,
        createdByUserId: (plan as any)?.createdByUserId ?? null,
        version: ((plan as any)?.version ?? 1) + 1,
      } as any);
    }
  }

  console.log(`\nplans missing archetype: created=${created} patched=${patched}${APPLY ? " (applied)" : " (dry run)"}`);
  report.slice(0, 40).forEach((r) => console.log(" ", r));
  if (!APPLY) console.log("\nRe-run with --apply.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
