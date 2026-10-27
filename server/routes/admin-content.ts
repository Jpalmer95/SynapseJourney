/**
 * Admin content governance: audit, publish/unpublish, section-level quality.
 *
 * The audit is the "future courses" half of the gate: any course that lands from an
 * agent or the in-app generator can be rescored on demand, and the report names the
 * exact unit and issue so it can be fixed rather than wholesale regenerated.
 */
import type { Express, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdminEmail } from "../auth/localAuth";
import { scoreCourse, scoreUnitContent } from "../content-quality";
import type { CourseArchetype } from "../../shared/course-archetypes";

function requireAdmin(req: any, res: Response): boolean {
  if (!isAdminEmail(req.user?.claims?.email)) {
    res.status(403).json({ error: "Admin only" });
    return false;
  }
  return true;
}

export function registerAdminContentRoutes(app: Express) {
  app.get("/api/admin/content/report", isAuthenticated, async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const topics = await storage.getTopics();
    const rows = [];
    for (const t of topics) {
      const units = await storage.getLessonUnits(t.id);
      const plan = await storage.getLatestCoursePlan(t.id).catch(() => undefined);
      const archetype = ((plan?.planJson as any)?.archetype ?? "focused_skill") as CourseArchetype;
      const quality = scoreCourse(
        units.map((u) => ({ title: u.title, contentJson: u.contentJson })),
        archetype,
      );
      rows.push({
        id: t.id,
        title: t.title,
        published: t.published,
        reviewed: t.reviewed,
        units: units.length,
        archetype,
        score: quality.score,
        grade: quality.grade,
        issues: quality.issues.slice(0, 12),
      });
    }
    rows.sort((a, b) => a.score - b.score);
    res.json({ total: rows.length, rows });
  });

  app.post("/api/admin/content/audit", isAuthenticated, async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const topics = await storage.getTopics();
    let scored = 0;
    const summary = { ok: 0, needs_refresh: 0, unusable: 0 };
    for (const t of topics) {
      const units = await storage.getLessonUnits(t.id);
      const plan = await storage.getLatestCoursePlan(t.id).catch(() => undefined);
      const archetype = ((plan?.planJson as any)?.archetype ?? "focused_skill") as CourseArchetype;
      const quality = scoreCourse(
        units.map((u) => ({ title: u.title, contentJson: u.contentJson })),
        archetype,
      );
      await storage.updateTopicQuality(t.id, quality.score, quality);
      summary[quality.grade] += 1;
      scored += 1;
    }
    res.json({ scored, summary });
  });

  app.post("/api/admin/content/publish", isAuthenticated, async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const topicId = Number(req.body?.topicId);
    const published = Boolean(req.body?.published);
    if (!topicId) return res.status(400).json({ error: "topicId required" });

    // Refuse to publish something the gate would not accept.
    const units = await storage.getLessonUnits(topicId);
    const plan = await storage.getLatestCoursePlan(topicId).catch(() => undefined);
    const archetype = ((plan?.planJson as any)?.archetype ?? "focused_skill") as CourseArchetype;
    const quality = scoreCourse(
      units.map((u) => ({ title: u.title, contentJson: u.contentJson })),
      archetype,
    );
    if (published && quality.grade !== "ok") {
      return res.status(422).json({ error: "Course does not pass the quality gate", quality });
    }
    await storage.setTopicGovernance(topicId, { published, reviewed: published ? true : undefined });
    await storage.updateTopicQuality(topicId, quality.score, quality);
    res.json({ ok: true, topicId, published, score: quality.score, grade: quality.grade });
  });

  // Section-level view: which unit needs work, and why.
  app.get("/api/admin/content/topic/:topicId/units", isAuthenticated, async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const topicId = Number(req.params.topicId);
    if (!topicId) return res.status(400).json({ error: "bad topicId" });
    const units = await storage.getLessonUnits(topicId);
    const plan = await storage.getLatestCoursePlan(topicId).catch(() => undefined);
    const archetype = ((plan?.planJson as any)?.archetype ?? "focused_skill") as CourseArchetype;
    res.json({
      topicId,
      archetype,
      units: units.map((u) => ({
        unitId: u.id,
        title: u.title,
        difficulty: u.difficulty,
        hasContent: Boolean(u.contentJson),
        quality: scoreUnitContent(u.contentJson, archetype),
      })),
    });
  });
}
