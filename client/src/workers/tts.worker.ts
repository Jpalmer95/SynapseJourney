/// <reference lib="webworker" />

import { KokoroTTS } from "kokoro-js";
import { env } from "@huggingface/transformers";

// Use the browser Cache API so model weights persist offline after first download.
// useBrowserCache maps to the browser-native Cache API (available in workers).
env.useBrowserCache = true;

let kokoroTTS: KokoroTTS | null = null;

type GenerateOptions = NonNullable<Parameters<KokoroTTS["generate"]>[1]>;
type KokoroVoice = NonNullable<GenerateOptions["voice"]>;

// ── Progress reporting ───────────────────────────────────────────────────────
// Minimal subset of @huggingface/transformers ProgressInfo we actually use.
type HFProgressInfo = {
  status: "initiate" | "download" | "progress" | "done" | "ready" | string;
  file?: string;
  name?: string;
  progress?: number;
};

/**
 * Build a progress_callback for from_pretrained.
 *
 * Tracks per-file download progress and emits { id: -1, type: "progress",
 * percent, phase } broadcasts via self.postMessage. id=-1 is a sentinel that
 * the main thread uses to distinguish progress events from request responses.
 *
 * Strategy: track the highest `progress` value seen across all files.
 * The ONNX model file (~82 MB) dominates, so this closely tracks real download
 * progress. After all files are done we emit a "compile" phase while the model
 * initialises on the GPU/WASM runtime.
 */
function makeProgressCallback(phase: { current: "download" | "compile" }) {
  const fileProgress = new Map<string, number>();

  return (info: HFProgressInfo) => {
    const { status } = info;
    const file = info.file ?? info.name ?? "";
    const pct = typeof (info as { progress?: number }).progress === "number"
      ? (info as { progress: number }).progress
      : null;

    if (status === "initiate" && file) {
      if (!fileProgress.has(file)) {
        fileProgress.set(file, 0);
        (self as DedicatedWorkerGlobalScope).postMessage({
          id: -1, type: "progress", percent: 0, phase: "download", file,
        });
      }
    } else if (status === "progress" && pct !== null) {
      const prev = fileProgress.get(file) ?? 0;
      if (pct > prev) {
        fileProgress.set(file, pct);
        const values = Array.from(fileProgress.values());
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        const clamped = Math.min(avg, 99);
        (self as DedicatedWorkerGlobalScope).postMessage({
          id: -1, type: "progress", percent: clamped, phase: "download", file,
        });
      }
    } else if (status === "done" && file) {
      fileProgress.set(file, 100);
      phase.current = "compile";
      (self as DedicatedWorkerGlobalScope).postMessage({
        id: -1, type: "progress", percent: 100, phase: "compile",
      });
    }
  };
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, text, voice } = e.data as {
    id: number;
    type: "init" | "speak";
    text?: string;
    voice?: string;
  };

  if (type === "init") {
    try {
      if (!kokoroTTS) {
        const phase: { current: "download" | "compile" } = { current: "download" };
        try {
          // WebGPU path: fp32 is required for correct audio output (q8 produces garbled/alien speech on WebGPU)
          kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
            dtype: "fp32",
            device: "webgpu",
            progress_callback: makeProgressCallback(phase),
          });
        } catch {
          // WASM fallback: q8 is fine here and keeps the download smaller
          phase.current = "download";
          kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
            dtype: "q8",
            device: "wasm",
            progress_callback: makeProgressCallback(phase),
          });
        }
      }
      self.postMessage({ id, type: "ready" });
    } catch (err) {
      self.postMessage({
        id,
        type: "error",
        message: err instanceof Error ? err.message : "Failed to initialize Kokoro TTS",
      });
    }
    return;
  }

  if (type === "speak") {
    try {
      if (!kokoroTTS) throw new Error("Kokoro not initialized");
      const selectedVoice = (voice || "af_bella") as KokoroVoice;
      const output = await kokoroTTS.generate(text ?? "", { voice: selectedVoice });
      // Reply with the raw Float32Array samples + sampleRate.
      // The hook converts this to WAV/Blob on the main thread.
      const samples: Float32Array = (output as unknown as { audio: Float32Array }).audio;
      const sampleRate: number = (output as unknown as { sampling_rate: number }).sampling_rate;
      // Transfer the underlying ArrayBuffer so the main thread receives it zero-copy.
      self.postMessage({ id, type: "audio", samples, sampleRate }, [samples.buffer]);
    } catch (err) {
      self.postMessage({
        id,
        type: "error",
        message: err instanceof Error ? err.message : "TTS generation failed",
      });
    }
  }
};
