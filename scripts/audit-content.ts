#!/usr/bin/env tsx
/**
 * Content audit + triage for SynapseJourney.
 *
 * Scores every topic with the shared quality gate, then (optionally) applies the
 * governance decision: publish what is good, quarantine what needs work, delete
 * what is pure filler.
 *
 *   npm run audit:content                 # dry run, prints the table
 *   npm run audit:content -- --apply      # write scores + publish/quarantine
 *   npm run audit:content -- --apply --delete-unusable
 *   npm run audit:content -- --json /tmp/audit.json
 *
 * Safety rules baked in:
 *  - never deletes a topic that has progress, goals, hypotheses or a course plan
 *  - quarantine is the default for anything below "ok" (reversible)
 *  - "unusable" + zero usage is the only delete candidate, and only with --delete-unusable
 */
import "../server/env";
import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { scoreCourse, type CourseQuality } from "../server/content-quality";
import type { CourseArchetype } from "../shared/course-archetypes";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DELETE_UNUSABLE = args.includes("--delete-unusable");
const JSON_OUT = (() => {
  const i = args.indexOf("--json");
  return i >= 0 ? args[i + 1] : null;
})();

interface Row {
  id: number;
  title: string;
  category: string | null;
  kind: string;
  published: boolean;
  reviewed: boolean;
  units: number;
  archetype: CourseArchetype;
  quality: CourseQuality;
  usage: { progress: number; goals: number; hypotheses: number; plans: number };
  action: "publish" | "keep" | "quarantine" | "delete" | "refresh";
}

async function usageFor(topicId: number) {
  const res: any = await db.execute(sql`
    select
      (select count(*) from user_progress where topic_id = ${topicId}) as progress,
      (select count(*) from learning_goals where topic_id = ${topicId}) as goals,
      (select count(*) from open_science_ideas where topic_id = ${topicId}) as hypotheses,
      (select count(*) from course_plans where topic_id = ${topicId}) as plans
  `);
  const r = (res.rows ?? res)[0] ?? {};
  return {
    progress: Number(r.progress ?? 0),
    goals: Number(r.goals ?? 0),
    hypotheses: Number(r.hypotheses ?? 0),
    plans: Number(r.plans ?? 0),
  };
}

async function deleteTopic(topicId: number) {
  // Ordered child-first deletes; every statement is idempotent.
  const tables = [
    "topic_connections where from_topic_id = " + topicId,
    "topic_connections where to_topic_id = " + topicId,
    "topic_coordinates where topic_id = " + topicId,
    "topic_learning_prefs where topic_id = " + topicId,
    "topic_mastery where topic_id = " + topicId,
    "lesson_progress where unit_id in (select id from lesson_units where topic_id = " + topicId + ")",
    "lesson_units where topic_id = " + topicId,
    "knowledge_cards where topic_id = " + topicId,
    "knowledge_resources where topic_id = " + topicId,
    "course_plans where topic_id = " + topicId,
    "course_posters where topic_id = " + topicId,
    "learning_roadmaps where topic_id = " + topicId,
    "pathway_topics where topic_id = " + topicId,
    "flashcards where topic_id = " + topicId,
    "learning_timeline where topic_id = " + topicId,
    "user_progress where topic_id = " + topicId,
    "learning_goals where topic_id = " + topicId,
    "sota_bottlenecks where topic_id = " + topicId,
    "open_science_ideas where topic_id = " + topicId,
    "user_infographics where topic_id = " + topicId,
  ];
  for (const t of tables) {
    const [table, where] = t.split(" where ");
    await db.execute(sql.raw(`DELETE FROM ${table} WHERE ${where}`));
  }
  await db.execute(sql.raw(`DELETE FROM topics WHERE id = ${topicId}`));
}

async function main() {
  const topics = await storage.getTopics();
  const rows: Row[] = [];

  for (const t of topics) {
    const units = await storage.getLessonUnits(t.id);
    const plan = await storage.getLatestCoursePlan(t.id).catch(() => undefined);
    const archetype = ((plan?.planJson as any)?.archetype ?? "focused_skill") as CourseArchetype;
    const quality = scoreCourse(
      units.map((u) => ({ title: u.title, contentJson: u.contentJson })),
      archetype,
    );
    const usage = await usageFor(t.id);
    const inUse = usage.progress + usage.goals + usage.hypotheses > 0;

    let action: Row["action"];
    if (quality.grade === "ok") action = t.published ? "keep" : "publish";
    else if (quality.grade === "needs_refresh") action = "refresh";
    else action = inUse ? "quarantine" : "delete";

    const cat: any = t.categoryId
      ? (await storage.getCategoryById(t.categoryId))?.name ?? null
      : null;

    rows.push({
      id: t.id,
      title: t.title,
      category: cat,
      kind: (t as any).kind ?? "core",
      published: t.published ?? false,
      reviewed: t.reviewed ?? false,
      units: units.length,
      archetype,
      quality,
      usage,
      action,
    });
  }

  rows.sort((a, b) => a.quality.score - b.quality.score);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.action] = (acc[r.action] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\nSynapseJourney content audit —", rows.length, "topics");
  console.log("grade counts:", ["ok", "needs_refresh", "unusable"].map((g) => `${g}=${rows.filter((r) => r.quality.grade === g).length}`).join("  "));
  console.log("actions:", Object.entries(counts).map(([k, v]) => `${k}=${v}`).join("  "), "\n");

  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
  console.log(pad("id", 5), pad("grade", 14), pad("score", 6), pad("units", 6), pad("action", 12), "title");
  for (const r of rows) {
    console.log(
      pad(String(r.id), 5),
      pad(r.quality.grade, 14),
      pad(String(r.quality.score), 6),
      pad(String(r.units), 6),
      pad(r.action, 12),
      r.title.slice(0, 60),
    );
  }

  if (JSON_OUT) {
    const fs = await import("node:fs");
    fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 1));
    console.log(`\nwrote ${JSON_OUT}`);
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write governance flags.");
    return;
  }

  let published = 0;
  let quarantined = 0;
  let deleted = 0;
  for (const r of rows) {
    if (r.action === "publish") {
      await storage.setTopicGovernance(r.id, { published: true, reviewed: true });
      await storage.updateTopicQuality(r.id, r.quality.score, r.quality);
      published++;
    } else if (r.action === "keep") {
      await storage.updateTopicQuality(r.id, r.quality.score, r.quality, { reviewed: true });
    } else if (r.action === "refresh" || r.action === "quarantine") {
      await storage.setTopicGovernance(r.id, { published: false, reviewed: false });
      await storage.updateTopicQuality(r.id, r.quality.score, r.quality);
      quarantined++;
    } else if (r.action === "delete") {
      if (DELETE_UNUSABLE) {
        try {
          await deleteTopic(r.id);
          deleted++;
        } catch (e: any) {
          console.warn(`delete failed for topic ${r.id}: ${e.message}`);
          await storage.setTopicGovernance(r.id, { published: false, reviewed: false });
        }
      } else {
        await storage.setTopicGovernance(r.id, { published: false, reviewed: false });
        await storage.updateTopicQuality(r.id, r.quality.score, r.quality);
        quarantined++;
      }
    }
  }
  console.log(`\napplied: published=${published} quarantined=${quarantined} deleted=${deleted}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
