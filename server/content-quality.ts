/**
 * Content quality gates for SynapseJourney.
 *
 * Why this exists: the seeded corpus was generated from a keyword-substitution
 * template ("**activation functions** — This is the workhorse of practical Neural
 * Networks... The classic trap: vanishing gradients"), with Khan Academy search
 * URLs pasted in as "resources". That shipped 593 templated units and one quiz
 * stem repeated 285 times. Regenerating it once is not a fix; a gate is.
 *
 * Three consumers share this module:
 *   - route-level ingest validation (reject junk before it lands)
 *   - `scripts/audit-content.ts` (score the whole corpus, triage keep/refresh/delete)
 *   - the course page banner (surface "needs refresh" per unit)
 */
import { ARCHETYPES, type CourseArchetype } from "../shared/course-archetypes";

export type IssueSeverity = "error" | "warn";

export interface QualityIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  /** Which unit (title) or "course" for course-level issues. */
  scope: string;
}

export interface UnitQuality {
  score: number; // 0-100
  issues: QualityIssue[];
}

export interface CourseQuality {
  score: number; // 0-100
  grade: "ok" | "needs_refresh" | "unusable";
  issues: QualityIssue[];
  perUnit: { title: string; score: number; issueCount: number }[];
}

/** Phrases that only appear in the legacy generator output. */
export const TEMPLATE_MARKERS: string[] = [
  "this is where bugs hide",
  "the classic trap",
  "deceptively simple idea",
  "your gateway into",
  "this is the workhorse of practical",
  "watch out for:",
  "implementation pattern:",
  "at the implementation level",
  "bridges theory and practice",
  "in code reviews, this is where",
  "study tip:",
  "in this field, practitioners often fall into the trap",
  "is a perfect example of", // "...is a perfect example of X in action"
  "the bridge between abstract theory and running code",
  "find a real-world case where",
];

/** URL fragments that mark a placeholder rather than a real resource. */
export const JUNK_URL_FRAGMENTS: string[] = [
  "page_search_query",
  "khanacademy.org/search",
  "google.com/search",
  "wikipedia.org/wiki/Main_Page",
  "example.com",
  "youtube.com/results",
  "bingserach",
  "duckduckgo.com/?q=",
];

/** Hosts we accept as genuine study material. */
export const TRUSTED_RESOURCE_HOSTS: string[] = [
  "openstax.org",
  "ocw.mit.edu",
  "libretexts.org",
  "en.wikipedia.org",
  "feynmanlectures.caltech.edu",
  "arxiv.org",
  "youtube.com",
  "youtu.be",
  "nptel.ac.in",
  "ocw.tudelft.nl",
  "cs50.harvard.edu",
  "developer.mozilla.org",
  "docs.python.org",
  "postgresql.org",
];

export function words(text: string | null | undefined): number {
  if (!text) return 0;
  return (text.match(/[A-Za-z0-9']+/g) || []).length;
}

export function normalizeTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function hostAllowed(host: string): boolean {
  return TRUSTED_RESOURCE_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

function sectionHeadings(markdown: string): string[] {
  return (markdown.match(/^##\s+.+$/gm) || []).map((h) => h.replace(/^##\s+/, "").trim());
}

/** Score a single unit's contentJson. */
export function scoreUnitContent(contentJson: any, archetype: CourseArchetype = "focused_skill"): UnitQuality {
  const issues: QualityIssue[] = [];
  const spec = ARCHETYPES[archetype] ?? ARCHETYPES.focused_skill;
  const budget = spec.sectionBudget;
  const scope = "unit";

  if (!contentJson || typeof contentJson !== "object") {
    return { score: 0, issues: [{ code: "no_content", severity: "error", message: "Unit has no contentJson", scope }] };
  }

  const concept: string = contentJson.concept || contentJson.content || "";
  const blob = JSON.stringify(contentJson).toLowerCase();

  const foundMarkers = TEMPLATE_MARKERS.filter((m) => blob.includes(m));
  if (foundMarkers.length) {
    issues.push({
      code: "template_prose",
      severity: "error",
      message: `Template prose detected: ${foundMarkers.slice(0, 3).map((m) => `"${m}"`).join(", ")}`,
      scope,
    });
  }

  const headings = sectionHeadings(concept);
  if (headings.length < budget.conceptSections[0]) {
    issues.push({
      code: "too_few_sections",
      severity: headings.length === 0 ? "error" : "warn",
      message: `${headings.length} concept section(s); ${archetype} expects ${budget.conceptSections[0]}–${budget.conceptSections[1]}`,
      scope,
    });
  }

  const cw = words(concept);
  const [minW, maxW] = budget.wordsPerSection;
  const target = [minW * Math.max(1, headings.length), maxW * Math.max(1, headings.length)];
  if (cw === 0) {
    issues.push({ code: "empty_concept", severity: "error", message: "Concept body is empty", scope });
  } else if (cw < target[0] * 0.6) {
    issues.push({
      code: "thin_prose",
      severity: "error",
      message: `Concept is ${cw} words; ${archetype} should carry ~${target[0]}–${target[1]}`,
      scope,
    });
  } else if (cw > target[1] * 1.6) {
    issues.push({
      code: "bloated_prose",
      severity: "warn",
      message: `Concept is ${cw} words, well above the ${archetype} band (~${target[0]}–${target[1]})`,
      scope,
    });
  }

  const takeaways: any[] = Array.isArray(contentJson.keyTakeaways) ? contentJson.keyTakeaways : [];
  if (takeaways.length < Math.min(3, budget.takeaways)) {
    issues.push({
      code: "few_takeaways",
      severity: "error",
      message: `${takeaways.length} key takeaways; expected ${budget.takeaways}`,
      scope,
    });
  }

  const quiz: any[] = Array.isArray(contentJson.quiz) ? contentJson.quiz : [];
  if (quiz.length < 3) {
    issues.push({ code: "few_quiz", severity: "error", message: `${quiz.length} quiz items; need at least 3`, scope });
  }
  const stems = new Set<string>();
  quiz.forEach((q, i) => {
    const question = (q?.question || "").toLowerCase().trim();
    const opts: string[] = Array.isArray(q?.options) ? q.options : [];
    if (opts.length < 2) {
      issues.push({ code: "quiz_bad_options", severity: "error", message: `Quiz ${i + 1} has ${opts.length} options`, scope });
    }
    if (new Set(opts).size !== opts.length) {
      issues.push({ code: "quiz_duplicate_options", severity: "error", message: `Quiz ${i + 1} repeats an option`, scope });
    }
    if (typeof q?.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex >= Math.max(1, opts.length)) {
      issues.push({ code: "quiz_bad_index", severity: "error", message: `Quiz ${i + 1} has an invalid correctIndex`, scope });
    }
    if (words(q?.explanation) < 6) {
      issues.push({ code: "quiz_no_explanation", severity: "warn", message: `Quiz ${i + 1} has no real explanation`, scope });
    }
    const key = question.slice(0, 70);
    if (key && stems.has(key)) {
      issues.push({ code: "quiz_duplicate_stem", severity: "error", message: `Quiz ${i + 1} duplicates an earlier question`, scope });
    }
    stems.add(key);
  });

  const resources: any[] = Array.isArray(contentJson.externalResources) ? contentJson.externalResources : [];
  const [minR, maxR] = budget.resources;
  if (resources.length < Math.min(2, minR)) {
    issues.push({ code: "few_resources", severity: "error", message: `${resources.length} resources; expected ${minR}–${maxR}`, scope });
  }
  const seenUrls = new Set<string>();
  for (const r of resources) {
    const url = String(r?.url || "");
    if (!url) {
      issues.push({ code: "resource_no_url", severity: "error", message: "Resource without a URL", scope });
      continue;
    }
    if (!/^https?:\/\//i.test(url)) {
      issues.push({ code: "resource_not_absolute", severity: "error", message: `Resource is not an absolute URL: ${url}`, scope });
      continue;
    }
    if (JUNK_URL_FRAGMENTS.some((f) => url.toLowerCase().includes(f))) {
      issues.push({ code: "resource_placeholder", severity: "error", message: `Placeholder resource link: ${url}`, scope });
    }
    const host = hostOf(url);
    if (host && !hostAllowed(host)) {
      issues.push({ code: "resource_untrusted_host", severity: "warn", message: `Unrecognised resource host: ${host}`, scope });
    }
    if (seenUrls.has(url)) {
      issues.push({ code: "resource_duplicate", severity: "warn", message: `Repeated resource URL: ${url}`, scope });
    }
    seenUrls.add(url);
  }

  const example = contentJson.example;
  if (budget.requiresWorkedExample) {
    const exWords = words(example?.content) + words(example?.code);
    if (exWords < 20) {
      issues.push({ code: "no_worked_example", severity: "warn", message: "No worked example / code block", scope });
    }
  }

  if (words(contentJson.analogy) < 8) {
    issues.push({ code: "no_analogy", severity: "warn", message: "No analogy", scope });
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.filter((i) => i.severity === "warn").length;
  const score = Math.max(0, Math.min(100, 100 - errors * 22 - warns * 5));
  return { score, issues };
}

/** Score a whole course (topic) from its units. */
export function scoreCourse(units: { title: string; contentJson?: any }[], archetype: CourseArchetype = "focused_skill"): CourseQuality {
  const spec = ARCHETYPES[archetype] ?? ARCHETYPES.focused_skill;
  const budget = spec.sectionBudget;
  const issues: QualityIssue[] = [];
  const scope = "course";

  const [minU, maxU] = spec.units;
  if (units.length < minU) {
    issues.push({
      code: "few_units",
      severity: units.length <= Math.max(2, Math.floor(minU / 2)) ? "error" : "warn",
      message: `${units.length} units; ${archetype} expects ${minU}–${maxU}`,
      scope,
    });
  }
  if (units.length > maxU) {
    issues.push({ code: "many_units", severity: "warn", message: `${units.length} units exceeds ${archetype} max ${maxU}`, scope });
  }

  const perUnit: { title: string; score: number; issueCount: number }[] = [];
  const globalStems = new Map<string, number>();
  const urlCounts = new Map<string, number>();
  let sum = 0;

  for (const u of units) {
    const q = scoreUnitContent(u.contentJson, archetype);
    perUnit.push({ title: u.title, score: q.score, issueCount: q.issues.length });
    sum += q.score;
    issues.push(
      ...q.issues.map((i) => ({
        ...i,
        scope: u.title ? `${u.title}` : i.scope,
      })),
    );
    const quiz: any[] = Array.isArray(u.contentJson?.quiz) ? u.contentJson.quiz : [];
    for (const item of quiz) {
      const key = String(item?.question || "").toLowerCase().trim().slice(0, 70);
      if (key) globalStems.set(key, (globalStems.get(key) || 0) + 1);
    }
    const res: any[] = Array.isArray(u.contentJson?.externalResources) ? u.contentJson.externalResources : [];
    for (const r of res) urlCounts.set(String(r?.url || ""), (urlCounts.get(String(r?.url || "")) || 0) + 1);
  }

  if (units.length > 0) {
    // A quiz stem repeated across units is the classic filler signature.
    let repeated = 0;
    globalStems.forEach((n) => { if (n > 1) repeated += n - 1; });
    if (repeated > Math.max(1, Math.floor(units.length * 0.5))) {
      issues.push({
        code: "quiz_repetition",
        severity: "error",
        message: `${repeated} quiz questions are repeated across units — filler signature`,
        scope,
      });
    }
    // The same URL pasted into every unit is not a curated resource set.
    let totalUrlSlots = 0;
    let reused = 0;
    urlCounts.forEach((n) => { totalUrlSlots += n; if (n > 3) reused += n; });
    if (totalUrlSlots > 0 && reused / totalUrlSlots > 0.5) {
      issues.push({
        code: "resource_repetition",
        severity: "warn",
        message: `${reused}/${totalUrlSlots} resource slots reuse the same few URLs`,
        scope,
      });
    }
  }

  const unitIssues = issues.filter((i) => i.scope !== "course");
  const hasAnyContent = units.some((u) => u.contentJson);
  const score = units.length ? Math.round(sum / units.length) : 0;
  const errors = issues.filter((i) => i.severity === "error").length;

  // grade: unusable = nothing to teach or almost every unit flagged;
  // needs_refresh = some units are junk; ok = good enough to publish.
  let grade: CourseQuality["grade"] = "ok";
  if (!hasAnyContent || units.length === 0) grade = "unusable";
  else if (errors >= Math.max(1, Math.floor(units.length * 0.5)) || score < 45) grade = "unusable";
  else if (unitIssues.some((i) => i.severity === "error") || score < 80) grade = "needs_refresh";

  return { score, grade, issues, perUnit };
}

/** Error-severity issues only — what the ingest route blocks on. */
export function blockingIssues(quality: CourseQuality): QualityIssue[] {
  return quality.issues.filter((i) => i.severity === "error");
}

/** Tokens that mark a re-packaging of the same subject rather than a new one. */
const VARIANT_STOPWORDS = new Set([
  "2024","2025","2026","2027","edition","ed","part","vol","volume","i","ii","iii","iv","v",
  "advanced","basic","basics","introduction","intro","fundamentals","fundamental","essentials",
  "essential","course","crash","quick","fast","deep","dive","full","complete","masterclass",
  "tutorial","guide","101","bootcamp","refresher","primer","the","a","an","of","and","for","to",
]);

export function titleTokens(title: string): string[] {
  return normalizeTitle(title)
    .split("-")
    .filter((t) => t && !VARIANT_STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}

/** 0..1 similarity over distinctive tokens; 1 means the same subject re-titled. */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(titleTokens(a));
  const tb = new Set(titleTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach((t) => { if (tb.has(t)) shared += 1; });
  let union = 0;
  const seen = new Set<string>();
  ta.forEach((t) => { seen.add(t); });
  tb.forEach((t) => { seen.add(t); });
  union = seen.size;
  const jaccard = shared / union;
  // One title's distinctive tokens contained in the other's means the same subject.
  const containment = shared / Math.min(ta.size, tb.size);
  return Math.max(jaccard, containment >= 1 ? 0.95 : containment * 0.8);
}

/**
 * Find an existing course that already covers this subject.
 * Blocks "Calculus" vs "Calculus (2026 edition)" vs "Calculus I — the essentials".
 */
export function findDuplicateTitle(
  candidate: string,
  existing: { id: number; title: string }[],
  threshold = 0.6,
): { id: number; title: string; score: number } | null {
  let best: { id: number; title: string; score: number } | null = null;
  for (const t of existing) {
    const score = titleSimilarity(candidate, t.title);
    if (score >= threshold && (!best || score > best.score)) {
      best = { id: t.id, title: t.title, score };
    }
  }
  return best;
}
