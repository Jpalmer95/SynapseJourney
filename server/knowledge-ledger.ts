/**
 * Unified Knowledge Ledger & Cross-Stream Reconciliation Engine
 *
 * Bridges the 3 core learning modes of SynapseJourney into one persistent
 * 3D map and prior-knowledge memory:
 *   1. Laser-focused JIT Goal courses (`stream = 'jit'`)
 *   2. Generalized Linear Mastery courses (`stream = 'linear'`)
 *   3. Agentic Open-Ended Conversations (`stream = 'agent_chat' | 'mcp_agent'`)
 *
 * Whenever a learner progresses in ANY stream, atomic concept entries are
 * recorded in `user_knowledge_ledger`, matched against canonical `topics` and
 * `lesson_units`, and synced into `user_progress` + `topic_coordinates` so
 * prior or scattered progress is always recognized when the user touches that
 * subject again.
 */

import {
  userKnowledgeLedger,
  topics,
  lessonUnits,
  lessonProgress,
  userProgress,
  type UserKnowledgeLedgerEntry,
  type Topic,
  type LessonUnit,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { IStorage } from "./storage";

export type LearningStream = "jit" | "linear" | "agent_chat" | "mcp_agent";
export type ConceptDepthLevel = "intro" | "core" | "advanced" | "frontier";

export interface LedgerLogInput {
  conceptTitle: string;
  summary: string;
  stream: LearningStream;
  depthLevel?: ConceptDepthLevel;
  confidence?: number;
  topicId?: number | null;
  topicTitle?: string | null;
  sourceTopicId?: number | null;
  matchedUnitId?: number | null;
  tags?: string[];
  createMapNodeIfMissing?: boolean;
}

export interface UnitPriorCoverage {
  unitId: number;
  unitTitle: string;
  difficulty: string;
  completedDirectly: boolean;
  priorCovered: boolean;
  coveringEntries: {
    id: number;
    conceptTitle: string;
    stream: string;
    confidence: number;
    summary: string;
    createdAt: Date;
  }[];
}

export interface TopicPriorKnowledgeReport {
  topicId: number | null;
  topicTitle: string | null;
  ledgerEntries: UserKnowledgeLedgerEntry[];
  unitCoverage: UnitPriorCoverage[];
  recommendedStartUnitId: number | null;
  priorCoveredUnitCount: number;
  completedUnitCount: number;
  totalUnits: number;
  effectiveMasteryPct: number;
  streamBreakdown: Record<string, number>;
  promptContextBlock: string;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "up", "about", "into", "over", "after", "under",
  "introduction", "intro", "basics", "fundamental", "fundamentals", "overview",
  "course", "lesson", "unit", "module", "guide", "tutorial", "how", "what",
  "why", "using", "understanding", "core", "advanced", "intermediate",
  "beginner", "deep", "dive", "part", "tier", "stage",
]);

export function normalizeConcept(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .join("-")
    .slice(0, 120);
}

export function extractTokens(raw: string): Set<string> {
  const words = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Compute token overlap between a concept query and a target topic/unit description.
 * Combines Jaccard + containment so a specific JIT concept ("J2 orbital perturbation")
 * matches a broader unit ("Perturbations, J2 oblateness, and station-keeping").
 */
export function computeConceptOverlap(conceptText: string, targetText: string): number {
  const a = extractTokens(conceptText);
  const b = extractTokens(targetText);
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of Array.from(a)) {
    if (b.has(token)) {
      intersection += 1;
    } else {
      // Prefix stem match for words >= 5 chars (e.g., "perturb" in "perturbation" / "perturbations")
      if (token.length >= 5) {
        const stem = token.slice(0, 5);
        for (const bt of Array.from(b)) {
          if (bt.length >= 5 && bt.startsWith(stem)) {
            intersection += 0.8;
            break;
          }
        }
      }
    }
  }

  const containmentA = intersection / a.size;
  const containmentB = intersection / b.size;
  const union = a.size + b.size - intersection;
  const jaccard = union > 0 ? intersection / union : 0;
  const baseScore = Math.max(jaccard * 1.4, containmentA * 0.75 + containmentB * 0.25);
  // Multi-keyword specificity boost: sharing 2-3+ distinct domain tokens across longer descriptions is a strong match
  const multiTokenBoost = intersection >= 2.5 ? 0.15 : intersection >= 1.8 ? 0.08 : 0;

  return Math.min(1, baseScore + multiTokenBoost);
}

/**
 * Reconcile a user's `user_progress` mastery % on a topic by combining:
 *   1. Explicitly completed units (`lesson_progress.status = 'completed'`)
 *   2. Units covered via prior JIT / Agent / Linear ledger entries (`matchedUnitId`)
 *   3. Unmatched scattered concept entries logged against this topic
 */
export async function reconcileTopicMasteryFromLedger(
  storage: IStorage,
  userId: string,
  topicId: number,
): Promise<{ masteryPct: number; status: string }> {
  const { db } = await import("./db");
  const allUnits = await storage.getLessonUnits(topicId);
  const ledgerRows = await db
    .select()
    .from(userKnowledgeLedger)
    .where(and(eq(userKnowledgeLedger.userId, userId), eq(userKnowledgeLedger.topicId, topicId)));

  const coveredUnitIds = new Set<number>();
  for (const row of ledgerRows) {
    if (row.matchedUnitId && (row.confidence ?? 80) >= 65) {
      coveredUnitIds.add(row.matchedUnitId);
    }
  }

  let completedUnits = 0;
  let priorCoveredOnlyUnits = 0;
  for (const u of allUnits) {
    const lp = await storage.getLessonProgress(userId, u.id);
    if (lp?.status === "completed") {
      completedUnits++;
    } else if (coveredUnitIds.has(u.id)) {
      priorCoveredOnlyUnits++;
    }
  }

  // Unmatched scattered concepts still contribute partial mastery on the 3D map
  const unmatchedConcepts = ledgerRows.filter((r) => !r.matchedUnitId).length;

  let masteryPct = 0;
  if (allUnits.length > 0) {
    const unitEffective = completedUnits + priorCoveredOnlyUnits * 0.85;
    const basePct = Math.round((unitEffective / allUnits.length) * 100);
    const scatteredBonus = Math.min(25, unmatchedConcepts * 6);
    masteryPct = Math.min(100, basePct + (completedUnits < allUnits.length ? scatteredBonus : 0));
  } else if (ledgerRows.length > 0) {
    // Topic with no formal units yet (e.g. an open-ended agent knowledge node)
    masteryPct = Math.min(95, ledgerRows.length * 18);
  }

  const existingProg = await storage.getProgressForTopic(userId, topicId);
  const prevMastery = existingProg?.mastery ?? 0;
  const finalMastery = Math.max(prevMastery, masteryPct);
  const status = finalMastery >= 80 ? "mastered" : finalMastery > 0 || ledgerRows.length > 0 ? "learning" : "discovered";

  await storage.upsertProgress({
    userId,
    topicId,
    mastery: finalMastery,
    status,
    lastUnitId: existingProg?.lastUnitId ?? null,
  });

  return { masteryPct: finalMastery, status };
}

/**
 * Record one or more learned concepts from ANY stream (JIT, Linear, Agent Chat, MCP Agent),
 * automatically reconcile them against canonical courses & units, and update the 3D Map.
 */
export async function logAndReconcileKnowledge(
  storage: IStorage,
  userId: string,
  items: LedgerLogInput[],
): Promise<{
  entries: UserKnowledgeLedgerEntry[];
  touchedTopics: { topicId: number; title: string; masteryPct: number; status: string }[];
  matchedUnitsCount: number;
}> {
  const { db } = await import("./db");
  const { indexTopicToFlywheel } = await import("./embeddings");
  const visibleTopics = await storage.getVisibleTopics(userId);
  const publishedTopics = visibleTopics.filter((t) => t.published);

  // Preload units for published topics so cross-stream matching is fast
  const unitsByTopic = new Map<number, LessonUnit[]>();
  for (const t of publishedTopics) {
    const u = await storage.getLessonUnits(t.id);
    unitsByTopic.set(t.id, u);
  }

  const createdOrUpdated: UserKnowledgeLedgerEntry[] = [];
  const touchedTopicIds = new Set<number>();
  let matchedUnitsCount = 0;

  for (const raw of items) {
    const conceptTitle = String(raw.conceptTitle || "").trim();
    if (!conceptTitle) continue;
    const summary = String(raw.summary || conceptTitle).trim();
    const norm = normalizeConcept(conceptTitle) || conceptTitle.toLowerCase().slice(0, 60);
    const searchBlob = `${conceptTitle} ${summary} ${(raw.tags || []).join(" ")} ${raw.topicTitle || ""}`;

    let primaryTopicId: number | null = raw.topicId ?? null;
    let sourceTopicId: number | null = raw.sourceTopicId ?? null;
    let matchedUnitId: number | null = raw.matchedUnitId ?? null;

    // 1. If a topicId was passed, check if it's a private JIT course.
    //    If so, also look for a canonical published parent topic so JIT progress
    //    transfers to the main linear course on that subject!
    let explicitTopic: Topic | undefined;
    if (primaryTopicId) {
      explicitTopic = await storage.getTopicById(primaryTopicId);
      if (explicitTopic) {
        touchedTopicIds.add(explicitTopic.id);
      }
    } else if (raw.topicTitle) {
      const wanted = raw.topicTitle.trim().toLowerCase();
      explicitTopic = visibleTopics.find((t) => t.title.toLowerCase() === wanted);
      if (explicitTopic) {
        primaryTopicId = explicitTopic.id;
        touchedTopicIds.add(explicitTopic.id);
      }
    }

    // 2. Find best matching canonical published topic & unit if needed
    let bestCanonicalTopic: Topic | undefined;
    let bestCanonicalTopicScore = 0;
    let bestUnit: LessonUnit | undefined;
    let bestUnitScore = 0;

    for (const pt of publishedTopics) {
      const topicScore = computeConceptOverlap(
        `${raw.topicTitle || ""} ${conceptTitle} ${(raw.tags || []).join(" ")}`,
        `${pt.title} ${pt.description}`,
      );
      if (topicScore > bestCanonicalTopicScore) {
        bestCanonicalTopicScore = topicScore;
        bestCanonicalTopic = pt;
      }

      const pUnits = unitsByTopic.get(pt.id) || [];
      for (const u of pUnits) {
        const uScore = computeConceptOverlap(searchBlob, `${pt.title} ${u.title} ${u.outline || ""}`);
        if (uScore > bestUnitScore) {
          bestUnitScore = uScore;
          bestUnit = u;
        }
      }
    }

    // If the explicit topic is a private JIT course and we found a strong canonical parent topic/unit:
    if (explicitTopic && !explicitTopic.published) {
      sourceTopicId = explicitTopic.id;
      if (bestUnit && bestUnitScore >= 0.38) {
        primaryTopicId = bestUnit.topicId;
        if (!matchedUnitId) matchedUnitId = bestUnit.id;
        touchedTopicIds.add(bestUnit.topicId);
        // Connect the JIT topic node to the canonical topic on the 3D map
        storage
          .createConnection({
            fromTopicId: explicitTopic.id,
            toTopicId: bestUnit.topicId,
            connectionType: "jit_segment",
            strength: 7,
          })
          .catch(() => {});
      } else if (bestCanonicalTopic && bestCanonicalTopicScore >= 0.35) {
        primaryTopicId = bestCanonicalTopic.id;
        touchedTopicIds.add(bestCanonicalTopic.id);
        storage
          .createConnection({
            fromTopicId: explicitTopic.id,
            toTopicId: bestCanonicalTopic.id,
            connectionType: "jit_segment",
            strength: 6,
          })
          .catch(() => {});
      }
    } else if (!primaryTopicId) {
      // Open-ended agent learning with no explicit topicId
      if (bestUnit && bestUnitScore >= 0.38) {
        primaryTopicId = bestUnit.topicId;
        matchedUnitId = bestUnit.id;
        touchedTopicIds.add(bestUnit.topicId);
      } else if (bestCanonicalTopic && bestCanonicalTopicScore >= 0.32) {
        primaryTopicId = bestCanonicalTopic.id;
        touchedTopicIds.add(bestCanonicalTopic.id);
      } else if (raw.createMapNodeIfMissing !== false) {
        // Create a personal knowledge node on the 3D map so scattered learnings outside
        // the existing catalog still appear in the learner's 3D Knowledge Web!
        const nodeTitle = (raw.topicTitle || conceptTitle).trim().slice(0, 100);
        const existingPersonal = visibleTopics.find(
          (t) => t.title.toLowerCase() === nodeTitle.toLowerCase(),
        );
        if (existingPersonal) {
          primaryTopicId = existingPersonal.id;
          touchedTopicIds.add(existingPersonal.id);
        } else {
          const cats = await storage.getCategories();
          const createdNode = await storage.createTopic({
            title: nodeTitle,
            description: summary,
            categoryId: cats[0]?.id ?? null,
            difficulty: "intermediate",
            kind: "agent",
            published: false,
            ownerUserId: userId,
          } as any);
          visibleTopics.push(createdNode);
          primaryTopicId = createdNode.id;
          touchedTopicIds.add(createdNode.id);
          indexTopicToFlywheel(storage as any, createdNode.id).catch(() => {});
        }
      }
    }

    // 3. If primaryTopicId is set and matchedUnitId is not yet resolved, check units inside primaryTopicId
    if (primaryTopicId && !matchedUnitId) {
      const candidateUnits = unitsByTopic.get(primaryTopicId) || (await storage.getLessonUnits(primaryTopicId));
      let localBest: LessonUnit | undefined;
      let localScore = 0;
      for (const u of candidateUnits) {
        const s = computeConceptOverlap(searchBlob, `${u.title} ${u.outline || ""}`);
        if (s > localScore) {
          localScore = s;
          localBest = u;
        }
      }
      if (localBest && localScore >= 0.36) {
        matchedUnitId = localBest.id;
      }
    }

    if (matchedUnitId) matchedUnitsCount++;

    // 4. Upsert into user_knowledge_ledger
    const existingRows = await db
      .select()
      .from(userKnowledgeLedger)
      .where(
        and(
          eq(userKnowledgeLedger.userId, userId),
          eq(userKnowledgeLedger.normalizedConcept, norm),
        ),
      );

    const sameTopicRow = existingRows.find((r) => r.topicId === primaryTopicId) || existingRows[0];
    const confidence = Math.min(100, Math.max(10, raw.confidence ?? 85));
    const depthLevel = raw.depthLevel || "core";

    if (sameTopicRow) {
      const mergedTags = Array.from(new Set([...(sameTopicRow.tags || []), ...(raw.tags || [])]));
      const [updated] = await db
        .update(userKnowledgeLedger)
        .set({
          topicId: primaryTopicId ?? sameTopicRow.topicId,
          sourceTopicId: sourceTopicId ?? sameTopicRow.sourceTopicId,
          matchedUnitId: matchedUnitId ?? sameTopicRow.matchedUnitId,
          summary: summary.length >= sameTopicRow.summary.length ? summary : sameTopicRow.summary,
          stream: raw.stream,
          depthLevel,
          confidence: Math.max(sameTopicRow.confidence, confidence),
          tags: mergedTags,
          updatedAt: new Date(),
        })
        .where(eq(userKnowledgeLedger.id, sameTopicRow.id))
        .returning();
      createdOrUpdated.push(updated);
    } else {
      const [inserted] = await db
        .insert(userKnowledgeLedger)
        .values({
          userId,
          topicId: primaryTopicId,
          sourceTopicId,
          matchedUnitId,
          conceptTitle,
          normalizedConcept: norm,
          summary,
          stream: raw.stream,
          depthLevel,
          confidence,
          tags: raw.tags || [],
        })
        .returning();
      createdOrUpdated.push(inserted);
    }
  }

  // 5. Reconcile mastery on all touched topics (both JIT source topics and canonical parent topics)
  const touchedTopics: { topicId: number; title: string; masteryPct: number; status: string }[] = [];
  for (const tid of Array.from(touchedTopicIds)) {
    const t = await storage.getTopicById(tid);
    if (!t) continue;
    const { masteryPct, status } = await reconcileTopicMasteryFromLedger(storage, userId, tid);
    touchedTopics.push({ topicId: tid, title: t.title, masteryPct, status });
  }

  return {
    entries: createdOrUpdated,
    touchedTopics,
    matchedUnitsCount,
  };
}

/**
 * Inspect everything a learner ALREADY knows about a topic or subject query across
 * JIT courses, Linear courses, in-app Agent chats, and external MCP sessions.
 */
export async function getPriorKnowledgeForTopic(
  storage: IStorage,
  userId: string,
  opts: { topicId?: number; query?: string },
): Promise<TopicPriorKnowledgeReport> {
  const { db } = await import("./db");
  let topic: Topic | undefined;
  if (opts.topicId) {
    topic = await storage.getTopicById(opts.topicId);
  } else if (opts.query) {
    const visible = await storage.getVisibleTopics(userId);
    const qLower = opts.query.trim().toLowerCase();
    topic =
      visible.find((t) => t.title.toLowerCase() === qLower) ||
      visible.find((t) => computeConceptOverlap(opts.query!, `${t.title} ${t.description}`) >= 0.4);
  }

  const allUserLedger = await db
    .select()
    .from(userKnowledgeLedger)
    .where(eq(userKnowledgeLedger.userId, userId))
    .orderBy(desc(userKnowledgeLedger.updatedAt));

  const targetText = topic
    ? `${topic.title} ${topic.description} ${opts.query || ""}`
    : String(opts.query || "");

  const units = topic ? await storage.getLessonUnits(topic.id) : [];
  const unitTextBlob = units.map((u) => `${u.title} ${u.outline || ""}`).join(" ");

  // Filter ledger entries that belong to this topic OR semantically overlap with its units/subject
  const relevantLedger = allUserLedger.filter((entry) => {
    if (topic && (entry.topicId === topic.id || entry.sourceTopicId === topic.id)) return true;
    if (targetText.trim()) {
      const entryBlob = `${entry.conceptTitle} ${entry.summary} ${(entry.tags || []).join(" ")}`;
      const score = computeConceptOverlap(entryBlob, `${targetText} ${unitTextBlob}`);
      return score >= 0.32;
    }
    return !opts.topicId && !opts.query;
  });

  // Map unit-by-unit coverage
  const unitCoverage: UnitPriorCoverage[] = [];
  let completedUnitCount = 0;
  let priorCoveredUnitCount = 0;
  let recommendedStartUnitId: number | null = null;

  for (const u of units) {
    const lp = await storage.getLessonProgress(userId, u.id);
    const completedDirectly = lp?.status === "completed";

    const covering = relevantLedger.filter((entry) => {
      if (entry.matchedUnitId === u.id) return true;
      const entryBlob = `${entry.conceptTitle} ${entry.summary} ${(entry.tags || []).join(" ")}`;
      return computeConceptOverlap(entryBlob, `${u.title} ${u.outline || ""}`) >= 0.38;
    });

    const priorCovered = !completedDirectly && covering.length > 0;
    if (completedDirectly) completedUnitCount++;
    else if (priorCovered) priorCoveredUnitCount++;
    else if (recommendedStartUnitId === null) {
      recommendedStartUnitId = u.id;
    }

    unitCoverage.push({
      unitId: u.id,
      unitTitle: u.title,
      difficulty: u.difficulty,
      completedDirectly,
      priorCovered,
      coveringEntries: covering.map((c) => ({
        id: c.id,
        conceptTitle: c.conceptTitle,
        stream: c.stream,
        confidence: c.confidence,
        summary: c.summary,
        createdAt: c.createdAt,
      })),
    });
  }

  const streamBreakdown: Record<string, number> = {
    jit: 0,
    linear: 0,
    agent_chat: 0,
    mcp_agent: 0,
  };
  for (const e of relevantLedger) {
    streamBreakdown[e.stream] = (streamBreakdown[e.stream] || 0) + 1;
  }

  const effectiveMasteryPct =
    units.length > 0
      ? Math.min(
          100,
          Math.round(((completedUnitCount + priorCoveredUnitCount * 0.85) / units.length) * 100),
        )
      : Math.min(95, relevantLedger.length * 18);

  const summaryLines = relevantLedger.slice(0, 12).map(
    (e) => `- [${e.stream.toUpperCase()} · ${e.depthLevel}] ${e.conceptTitle}: ${e.summary}`,
  );

  const promptContextBlock =
    summaryLines.length > 0
      ? `LEARNER PRIOR & SCATTERED KNOWLEDGE LEDGER (already learned across JIT goals, linear courses, or agent conversations — DO NOT re-teach from scratch; build on or reference this prior foundation):\n${summaryLines.join("\n")}`
      : "";

  return {
    topicId: topic?.id ?? null,
    topicTitle: topic?.title ?? null,
    ledgerEntries: relevantLedger,
    unitCoverage,
    recommendedStartUnitId,
    priorCoveredUnitCount,
    completedUnitCount,
    totalUnits: units.length,
    effectiveMasteryPct,
    streamBreakdown,
    promptContextBlock,
  };
}
