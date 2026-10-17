// server/embeddings.ts — Local embedding + hybrid search + 3D Knowledge Flywheel
//
// Wires Synapse's pgvector columns to a LOCAL, private embedding engine
// (Ollama + nomic-embed-text, 768-dim) AND automatically indexes newly
// created/ingested topics, lesson units, OER resources, and SOTA bottlenecks
// into the vector commons and 3D semantic PCA coordinate space.
import type { storage as StorageType } from "./storage";

const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";
const EMBED_DIM = parseInt(process.env.EMBED_DIM || "768", 10);

let cache: Record<string, number[]> = {};

/** Embed a string with Ollama. Returns null if Ollama is unreachable. */
export async function embed(text: string): Promise<number[] | null> {
  const key = text.slice(0, 500);
  if (cache[key]) return cache[key];
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.warn(`[embeddings] Ollama ${response.status}: ${await response.text()}`);
      return null;
    }
    const data = await response.json();
    const vec: number[] = data.embedding;
    if (!vec || vec.length !== EMBED_DIM) {
      console.warn(`[embeddings] expected ${EMBED_DIM} dims, got ${vec?.length}`);
      return null;
    }
    if (Object.keys(cache).length > 500) cache = {};
    cache[key] = vec;
    return vec;
  } catch (e) {
    console.warn("[embeddings] Ollama unreachable (is it running?):", (e as Error).message);
    return null;
  }
}

export const EMBEDDING_DIM = EMBED_DIM;

// ── Semantic 3D Coordinate Estimator ────────────────────────────────────────
// Axis 0 (X): Applied (+) ↔ Theoretical (-)
// Axis 1 (Y): Natural (+) ↔ Synthetic (-)
// Axis 2 (Z): Micro (+) ↔ Macro (-)
export function computeHeuristicSemanticCoords(
  topicId: number,
  title: string,
  description: string
): { x: number; y: number; z: number } {
  const text = `${title} ${description}`.toLowerCase();

  const scorePole = (posWords: string[], negWords: string[], seedShift: number) => {
    let pos = 0;
    let neg = 0;
    for (const w of posWords) if (text.includes(w)) pos += 1;
    for (const w of negWords) if (text.includes(w)) neg += 1;
    const raw = (pos - neg) / Math.max(1, pos + neg + 1.5);
    // Add tiny deterministic jitter from topicId so nodes don't stack on the exact same pixel
    const jitter = (((topicId * seedShift) % 100) / 100 - 0.5) * 0.18;
    return Math.max(-0.95, Math.min(0.95, raw + jitter));
  };

  // X: Applied (+) vs Theoretical (-)
  const x = scorePole(
    ["deploy", "build", "app", "repair", "tool", "guide", "tutorial", "workflow", "engineering", "practical", "code", "api", "design", "project", "fix", "setup"],
    ["theory", "theorem", "proof", "quantum", "abstract", "philosophy", "relativity", "axiom", "formal", "cosmology", "foundations", "topology", "epistemology"],
    37
  );

  // Y: Natural (+) vs Synthetic (-)
  const y = scorePole(
    ["biology", "physics", "chemistry", "ecology", "planet", "cell", "gene", "brain", "fluid", "ocean", "climate", "organic", "evolution", "atom", "molecule", "astronomy"],
    ["software", "computer", "python", "react", "typescript", "database", "algorithm", "network", "protocol", "compiler", "docker", "linux", "crypto", "ui", "synthetic"],
    73
  );

  // Z: Micro (+) vs Macro (-)
  const z = scorePole(
    ["quantum", "subatomic", "molecular", "cellular", "nano", "particle", "bit", "transistor", "synapse", "protein", "amino", "photon", "electron", "function"],
    ["cosmic", "planetary", "global", "economy", "society", "history", "civilization", "ecosystem", "macro", "architecture", "distributed", "grid", "infrastructure", "industry"],
    109
  );

  return { x, y, z };
}

/** Infer OER provider name from URL */
function inferProviderName(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("ocw.mit.edu")) return "MIT OpenCourseWare";
  if (u.includes("arxiv.org")) return "arXiv";
  if (u.includes("openstax.org")) return "OpenStax";
  if (u.includes("khanacademy.org")) return "Khan Academy";
  if (u.includes("libretexts.org")) return "LibreTexts";
  if (u.includes("wikiversity.org") || u.includes("wikipedia.org")) return "Wikimedia";
  if (u.includes("grokipedia.com")) return "Grokipedia";
  if (u.includes("freecodecamp.org")) return "freeCodeCamp";
  if (u.includes("gutenberg.org")) return "Project Gutenberg";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("github.com")) return "GitHub";
  return "Open Web";
}

/**
 * Index a newly created or updated topic into the Vector + 3D Knowledge Flywheel:
 * 1. Embeds topic title + description if Ollama is reachable.
 * 2. Computes 3D coordinates (interpolating from nearest vector neighbors if available,
 *    or semantic pole scoring) and saves to `topic_coordinates`.
 * 3. Creates `topic_connections` edges to its 2 nearest neighbors so it connects in the 3D web.
 * 4. Indexes any `recommendedOER` from its course plan into `knowledge_resources`.
 */
export async function indexTopicToFlywheel(
  st: typeof StorageType,
  topicId: number,
  options?: { recommendedOER?: { name: string; url: string; reason?: string }[] }
): Promise<void> {
  try {
    const topic = await st.getTopicById(topicId);
    if (!topic) return;

    const text = `${topic.title}. ${topic.description || ""}`.slice(0, 2000);
    const vec = await embed(text);
    if (vec) {
      await st.updateTopicEmbedding(topic.id, vec);
    }

    // Determine 3D coordinates
    let coords = computeHeuristicSemanticCoords(topic.id, topic.title, topic.description || "");
    if (vec) {
      // Find nearest existing topics with embeddings and blend their coordinates
      const nearest = await st.searchTopicsVectors(vec, 5, 0.6).catch(() => []);
      const otherIds = nearest.filter((n) => n.id !== topic.id).map((n) => n.id);
      if (otherIds.length > 0) {
        const rel = await st.getTopicRelations(otherIds);
        const validCoords = otherIds.map((id) => rel.coords[id]).filter(Boolean);
        if (validCoords.length > 0) {
          const avgX = validCoords.reduce((s, c) => s + c.x, 0) / validCoords.length;
          const avgY = validCoords.reduce((s, c) => s + c.y, 0) / validCoords.length;
          const avgZ = validCoords.reduce((s, c) => s + c.z, 0) / validCoords.length;
          coords = {
            x: Math.max(-0.98, Math.min(0.98, 0.6 * avgX + 0.4 * coords.x)),
            y: Math.max(-0.98, Math.min(0.98, 0.6 * avgY + 0.4 * coords.y)),
            z: Math.max(-0.98, Math.min(0.98, 0.6 * avgZ + 0.4 * coords.z)),
          };
        }
      }
    }

    await st.upsertTopicCoordinate({
      topicId: topic.id,
      x: coords.x,
      y: coords.y,
      z: coords.z,
    });

    // Connect topic to its 2 nearest neighbors in 3D space if it has no connections yet
    const existingConns = await st.getConnectionsFromTopic(topic.id);
    if (existingConns.length === 0) {
      const rel = await st.getTopicRelations([topic.id]);
      const neighbors = rel.neighbors[topic.id] || [];
      for (const n of neighbors.slice(0, 2)) {
        if (n.id && n.id !== topic.id) {
          await st.createConnection({
            fromTopicId: topic.id,
            toTopicId: n.id,
            connectionType: "related",
            strength: 6,
          }).catch(() => {});
        }
      }
    }

    // Index course-level recommended OER into knowledge_resources
    if (options?.recommendedOER && Array.isArray(options.recommendedOER)) {
      for (const oer of options.recommendedOER) {
        if (!oer?.url || !oer?.name) continue;
        await st.upsertKnowledgeResource({
          topicId: topic.id,
          unitId: null,
          title: oer.name.slice(0, 200),
          url: oer.url.slice(0, 500),
          resourceType: "course",
          description: (oer.reason || `Recommended open resource for ${topic.title}`).slice(0, 1000),
          providerName: inferProviderName(oer.url),
          isFreeOer: true,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn(`[Flywheel] indexTopicToFlywheel(${topicId}) error:`, (err as Error).message);
  }
}

/**
 * Index a lesson unit's content into the Vector + Resource + SOTA Bottleneck Flywheel:
 * 1. Embeds the unit text if Ollama is reachable.
 * 2. Extracts `externalResources` / `resources` into `knowledge_resources`.
 * 3. Extracts `openRoadblocks` and `industryChallenge` from NextGen/Frontier units into `sota_bottlenecks`.
 */
export async function indexUnitToFlywheel(
  st: typeof StorageType,
  unitId: number,
  topicId: number,
  contentJson: any,
  userId?: string
): Promise<void> {
  try {
    const unit = await st.getLessonUnit(unitId);
    const topic = await st.getTopicById(topicId);
    if (!unit || !topic) return;

    const category = topic.categoryId ? await st.getCategoryById(topic.categoryId) : undefined;
    const domain = category?.name || "STEM";

    // 1. Embed unit
    const conceptText = typeof contentJson?.concept === "string"
      ? contentJson.concept
      : typeof contentJson?.researchContext === "string"
      ? contentJson.researchContext
      : unit.outline || "";
    const embedText = `${topic.title} — ${unit.title}. ${conceptText}`.slice(0, 2000);
    const vec = await embed(embedText);
    if (vec) {
      await st.updateLessonEmbedding(unitId, vec);
    }

    if (!contentJson || typeof contentJson !== "object") return;

    // 2. Extract externalResources & NextGen resources into knowledge_resources
    const rawResources: any[] = [
      ...(Array.isArray(contentJson.externalResources) ? contentJson.externalResources : []),
      ...(Array.isArray(contentJson.resources) ? contentJson.resources : []),
    ];

    for (const r of rawResources) {
      if (!r?.url || !r?.title || typeof r.url !== "string" || !r.url.startsWith("http")) continue;
      await st.upsertKnowledgeResource({
        topicId,
        unitId,
        title: String(r.title).slice(0, 250),
        url: String(r.url).slice(0, 500),
        resourceType: String(r.type || "course").slice(0, 40),
        description: String(r.description || `Resource from ${unit.title}`).slice(0, 1000),
        providerName: inferProviderName(r.url),
        isFreeOer: true,
      }).catch(() => {});
    }

    // 3. Extract openRoadblocks & industryChallenge into sota_bottlenecks
    if (Array.isArray(contentJson.openRoadblocks)) {
      for (const rb of contentJson.openRoadblocks) {
        if (!rb?.title || !rb?.description) continue;
        await st.upsertSotaBottleneck({
          topicId,
          unitId,
          domain,
          title: String(rb.title).slice(0, 250),
          description: String(rb.description).slice(0, 2000),
          whyItMatters: String(rb.whyItMatters || `Critical frontier bottleneck in ${topic.title}`).slice(0, 1000),
          currentApproaches: Array.isArray(contentJson.industryChallenge?.currentApproaches)
            ? contentJson.industryChallenge.currentApproaches
            : [],
          openQuestions: Array.isArray(contentJson.industryChallenge?.openQuestions)
            ? contentJson.industryChallenge.openQuestions
            : [],
          difficulty: "frontier",
          status: "open",
          source: "nextgen_extracted",
          createdByUserId: userId || null,
        }).catch(() => {});
      }
    }

    if (contentJson.industryChallenge?.title && contentJson.industryChallenge?.description) {
      const ic = contentJson.industryChallenge;
      if (ic.title !== "Content Unavailable") {
        await st.upsertSotaBottleneck({
          topicId,
          unitId,
          domain,
          title: String(ic.title).slice(0, 250),
          description: String(ic.description).slice(0, 2000),
          whyItMatters: `Active industry & research challenge in ${topic.title}`,
          currentApproaches: Array.isArray(ic.currentApproaches) ? ic.currentApproaches : [],
          openQuestions: Array.isArray(ic.openQuestions) ? ic.openQuestions : [],
          difficulty: "advanced",
          status: "active_research",
          source: "nextgen_extracted",
          createdByUserId: userId || null,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn(`[Flywheel] indexUnitToFlywheel(${unitId}) error:`, (err as Error).message);
  }
}

/** Backfill embeddings for all topics that don't have one yet. Returns count updated. */
export async function backfillTopicEmbeddings(
  st: typeof StorageType,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const topics = await st.getTopics();
  let updated = 0;
  const pending = topics.filter((t: any) => !t.embedding);
  for (let i = 0; i < pending.length; i++) {
    const t = pending[i] as any;
    const text = `${t.title}. ${t.description || ""}`.slice(0, 2000);
    const vec = await embed(text);
    if (vec) {
      await st.updateTopicEmbedding(t.id, vec);
      updated++;
    }
    onProgress?.(i + 1, pending.length);
  }
  return updated;
}

/** Backfill embeddings for all lesson units without one. Returns count updated. */
export async function backfillLessonEmbeddings(
  st: typeof StorageType,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const units = await st.getAllLessonUnits();
  let updated = 0;
  const pending = units.filter((u: any) => !u.embedding);
  for (let i = 0; i < pending.length; i++) {
    const u = pending[i] as any;
    const text = `${u.title}. ${u.outline || ""}`.slice(0, 2000);
    const vec = await embed(text);
    if (vec) {
      await st.updateLessonEmbedding(u.id, vec);
      updated++;
    }
    onProgress?.(i + 1, pending.length);
  }
  return updated;
}
