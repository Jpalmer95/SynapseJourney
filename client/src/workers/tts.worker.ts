/// <reference lib="webworker" />

import { KokoroTTS } from "kokoro-js";
import { env } from "@huggingface/transformers";

// Use the browser Cache API so model weights persist offline after first download.
env.useBrowserCache = true;

type GenerateOptions = NonNullable<Parameters<KokoroTTS["generate"]>[1]>;
type KokoroVoice = NonNullable<GenerateOptions["voice"]>;

export type KokoroEngine = "webgpu-fp32" | "wasm-q8";

// ── Typed message payloads ───────────────────────────────────────────────────
type ReadyPayload   = { id: number; type: "ready";  engine: KokoroEngine; loadMs: number; fromCache: boolean };
type AudioPayload   = { id: number; type: "audio";  samples: Float32Array; sampleRate: number };
type ErrorPayload   = { id: number; type: "error";  message: string };
type WorkerPayload  = ReadyPayload | AudioPayload | ErrorPayload;

// Both MessagePort and DedicatedWorkerGlobalScope expose postMessage with this signature.
type Responder = {
  postMessage(data: WorkerPayload): void;
  postMessage(data: WorkerPayload, transfer: Transferable[]): void;
};

// ── Shared model state (module scope — one instance shared across all ports) ──
let kokoroTTS: KokoroTTS | null = null;
let engineId: KokoroEngine = "webgpu-fp32";
let loadMs = 0;
let fromCache = false;
let loadingPromise: Promise<{ engine: KokoroEngine; loadMs: number; fromCache: boolean }> | null = null;
let isReady = false;

async function checkFromCache(): Promise<boolean> {
  try {
    const cache = await caches.open("transformers-cache");
    const keys = await cache.keys();
    // Check for the primary ONNX model artifact — specific enough to avoid false positives.
    return keys.some(
      (req) => req.url.includes("Kokoro-82M-v1.0-ONNX") && req.url.includes("/onnx/model_"),
    );
  } catch {
    return false;
  }
}

async function loadModel(): Promise<{ engine: KokoroEngine; loadMs: number; fromCache: boolean }> {
  if (isReady) return { engine: engineId, loadMs, fromCache };
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const cachedBefore = await checkFromCache();
    console.log(`[TTS Worker] Starting load · cache=${cachedBefore ? "hit (instant)" : "miss (downloading)"}`);

    const t0 = performance.now();

    try {
      console.log("[TTS Worker] Trying WebGPU fp32…");
      kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "fp32",
        device: "webgpu",
      });
      engineId = "webgpu-fp32";
      console.log("[TTS Worker] ✓ WebGPU fp32 loaded");
    } catch (webgpuErr) {
      console.warn(
        "[TTS Worker] WebGPU fp32 failed:",
        webgpuErr instanceof Error ? webgpuErr.message : String(webgpuErr),
      );
      console.log("[TTS Worker] Falling back to WASM q8…");
      kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q8",
        device: "wasm",
      });
      engineId = "wasm-q8";
      console.log("[TTS Worker] ✓ WASM q8 loaded");
    }

    loadMs = Math.round(performance.now() - t0);
    fromCache = cachedBefore;
    isReady = true;

    const loadSecs = (loadMs / 1000).toFixed(1);
    console.log(
      `[TTS Worker] Ready · engine=${engineId} · source=${fromCache ? "cache" : "download"} · ${loadSecs}s`,
    );

    return { engine: engineId, loadMs, fromCache };
  })();

  return loadingPromise;
}

async function handleMessage(
  respond: Responder,
  id: number,
  type: string,
  text?: string,
  voice?: string,
) {
  if (type === "init") {
    try {
      const result = await loadModel();
      respond.postMessage({
        id,
        type: "ready",
        engine: result.engine,
        loadMs: result.loadMs,
        fromCache: result.fromCache,
      });
    } catch (err) {
      respond.postMessage({
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
      const samples: Float32Array = (output as unknown as { audio: Float32Array }).audio;
      const sampleRate: number = (output as unknown as { sampling_rate: number }).sampling_rate;
      // Transfer the underlying ArrayBuffer zero-copy to the receiving thread.
      respond.postMessage({ id, type: "audio", samples, sampleRate }, [samples.buffer]);
    } catch (err) {
      respond.postMessage({
        id,
        type: "error",
        message: err instanceof Error ? err.message : "TTS generation failed",
      });
    }
  }
}

// ── Route to SharedWorker or DedicatedWorker based on context ────────────
// Use instanceof for reliable detection: "SharedWorkerGlobalScope" in globalThis can
// be true in some environments even when running as a DedicatedWorker.
const isSharedWorker =
  typeof SharedWorkerGlobalScope !== "undefined" && self instanceof SharedWorkerGlobalScope;

if (isSharedWorker) {
  // SharedWorker mode: all tabs share this single worker and its model instance.
  (self as unknown as SharedWorkerGlobalScope).onconnect = (e: MessageEvent) => {
    const port = e.ports[0];
    port.onmessage = ({ data }: MessageEvent) => {
      const { id, type, text, voice } = data as {
        id: number;
        type: string;
        text?: string;
        voice?: string;
      };
      handleMessage(port, id, type, text, voice);
    };
    port.start();
  };
} else {
  // DedicatedWorker fallback (used when SharedWorker is not supported).
  (self as DedicatedWorkerGlobalScope).onmessage = ({ data }: MessageEvent) => {
    const { id, type, text, voice } = data as {
      id: number;
      type: string;
      text?: string;
      voice?: string;
    };
    handleMessage(self as DedicatedWorkerGlobalScope, id, type, text, voice);
  };
}
