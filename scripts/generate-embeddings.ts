#!/usr/bin/env tsx
/**
 * Embedding Generation Script — Populates vector columns for topics + lesson units.
 * Run: npx tsx scripts/generate-embeddings.ts
 * Requires: OPENAI_API_KEY or GEMINI_API_KEY env var
 * Uses OpenAI text-embedding-3-small ($0.02/1M tokens) or Gemini fallback.
 */
import "dotenv/config";
import OpenAI from "openai";
import { db } from "../server/db";
import { topics, lessonUnits } from "../shared/schema";
import { sql } from "drizzle-orm";

const BATCH = 50;

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const c = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const r = await c.embeddings.create({ model: "text-embedding-3-small", input: texts, dimensions: 1536 });
  return r.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

async function embedGemini(texts: string[]): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY;
  const out: number[][] = [];
  for (const t of texts) {
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";
    const url = endpoint + "?key=" + key;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { parts: [{ text: t }] } }),
    });
    if (!r.ok) throw new Error("Gemini embedding error: " + r.status);
    const d = await r.json();
    out.push(d.embedding.values);
    await new Promise(res => setTimeout(res, 250));
  }
  return out;
}

const embed = process.env.OPENAI_API_KEY ? embedOpenAI : embedGemini;
const provName = process.env.OPENAI_API_KEY ? "OpenAI" : "Gemini";

async function main() {
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error("Set OPENAI_API_KEY or GEMINI_API_KEY"); process.exit(1);
  }
  console.log("Provider: " + provName + "\n");

  // Topics
  const allT = await db.select({ id: topics.id, title: topics.title, description: topics.description, embedding: topics.embedding }).from(topics);
  const needT = allT.filter(t => !t.embedding);
  console.log("Topics: " + allT.length + " total, " + needT.length + " need embeddings");
  for (let i = 0; i < needT.length; i += BATCH) {
    const batch = needT.slice(i, i + BATCH);
    const embs = await embed(batch.map(t => t.title + ": " + t.description));
    for (let j = 0; j < batch.length; j++) {
      const vec = "[" + embs[j].join(",") + "]";
      await db.execute(sql`UPDATE topics SET embedding = ${vec}::vector WHERE id = ${batch[j].id}`);
    }
    console.log("  ok " + Math.min(i + BATCH, needT.length) + "/" + needT.length);
  }

  // Units
  const allU = await db.select({ id: lessonUnits.id, title: lessonUnits.title, outline: lessonUnits.outline, difficulty: lessonUnits.difficulty, embedding: lessonUnits.embedding }).from(lessonUnits);
  const needU = allU.filter(u => !u.embedding);
  console.log("\nUnits: " + allU.length + " total, " + needU.length + " need embeddings");
  for (let i = 0; i < needU.length; i += BATCH) {
    const batch = needU.slice(i, i + BATCH);
    const embs = await embed(batch.map(u => u.title + " (" + u.difficulty + "): " + (u.outline || "No outline")));
    for (let j = 0; j < batch.length; j++) {
      const vec = "[" + embs[j].join(",") + "]";
      await db.execute(sql`UPDATE lesson_units SET embedding = ${vec}::vector WHERE id = ${batch[j].id}`);
    }
    console.log("  ok " + Math.min(i + BATCH, needU.length) + "/" + needU.length);
    if (i + BATCH < needU.length) await new Promise(r => setTimeout(r, 1000));
  }
  console.log("\nDone. All embeddings populated.");
}

main().catch(e => { console.error(e); process.exit(1); });
