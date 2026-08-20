// server/embeddings.ts — Local embedding + hybrid search for SynapseJourney
//
// Wires Synapse's dormant pgvector columns to a LOCAL, private embedding engine
// (Ollama + nomic-embed-text, 768-dim). This is the "bring AI to data anywhere"
// pattern (Cloudera-style): embeddings computed at the edge, in your own
// infrastructure, never shipped to a third party. Fits Synapse's BYOC / no
// platform-paid-AI ethos.
//
// Env:
//   OLLAMA_URL   default http://127.0.0.1:11434
//   EMBED_MODEL  default nomic-embed-text (768-dim)
//   EMBED_DIM    default 768
//
// Requires a matching migration that resizes the embedding columns to EMBED_DIM
// (see migrations/0008_hybrid_rag_embeddings.sql).
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
