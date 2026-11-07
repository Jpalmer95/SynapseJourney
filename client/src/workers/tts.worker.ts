/// <reference lib="webworker" />

import { KokoroTTS } from "kokoro-js";

// Allow all 54 Kokoro-82M voice packs (kokoro-js 1.2.1's built-in VOICES freeze map
// only lists the 28 English voices even though all 54 .bin packs exist on Hugging Face).
try {
  (KokoroTTS.prototype as unknown as { _validate_voice?: (v: string) => string })._validate_voice =
    function (voice: string) {
      return typeof voice === "string" && voice.length > 0 ? voice.charAt(0) : "a";
    };
} catch {
  // ignore if prototype is sealed
}

type GenerateOptions = NonNullable<Parameters<KokoroTTS["generate"]>[1]>;
type KokoroVoice = NonNullable<GenerateOptions["voice"]>;

export type KokoroEngine = "webgpu-fp32" | "wasm-q8";

// ── Typed message payloads ───────────────────────────────────────────────────
type ReadyPayload    = { id: number; type: "ready";    engine: KokoroEngine; loadMs: number; fromCache: boolean };
type AudioPayload    = { id: number; type: "audio";    samples: Float32Array; sampleRate: number; engine?: KokoroEngine };
type ErrorPayload    = { id: number; type: "error";    message: string };
// Progress payload has id=-1 (broadcast, not tied to a specific request).
type ProgressPayload = { id: -1;    type: "progress"; percent: number; phase: "download" | "compile"; file?: string };
type WorkerPayload   = ReadyPayload | AudioPayload | ErrorPayload | ProgressPayload;

// Both MessagePort and DedicatedWorkerGlobalScope expose postMessage with this signature.
type Responder = {
  postMessage(data: WorkerPayload): void;
  postMessage(data: WorkerPayload, transfer: Transferable[]): void;
};

// ── Shared model state ────────────────────────────────────────────────────────
let kokoroTTS: KokoroTTS | null = null;
let engineId: KokoroEngine = "webgpu-fp32";
let loadMs = 0;
let fromCache = false;
let loadingPromise: Promise<{ engine: KokoroEngine; loadMs: number; fromCache: boolean }> | null = null;
let isReady = false;
let webgpuGenCount = 0;
let slowWebgpuCount = 0;

// ── Connected ports registry (SharedWorker fallback support) ──────────────────
const connectedPorts = new Set<MessagePort>();

/** Broadcast a progress event to all connected ports (SharedWorker) or self (DedicatedWorker). */
function broadcast(payload: ProgressPayload) {
  if (connectedPorts.size > 0) {
    connectedPorts.forEach((port) => {
      try { port.postMessage(payload); } catch { connectedPorts.delete(port); }
    });
  } else {
    (self as DedicatedWorkerGlobalScope).postMessage(payload);
  }
}

/**
 * Trim excessive leading and trailing vocoder silence (~300-450ms added by StyleTTS2/ISTFTNet
 * on each generate() pass) while preserving a natural ~20ms attack and ~75ms decay tail.
 * This eliminates the artificial dead air gap between consecutive synthesized chunks.
 */
function trimSilence(raw: Float32Array, sampleRate: number): Float32Array {
  const len = raw.length;
  if (len === 0) return new Float32Array(0);

  const threshold = 0.003;
  const leadPad = Math.floor(sampleRate * 0.02);  // 20ms natural attack
  const tailPad = Math.floor(sampleRate * 0.075); // 75ms natural release

  let start = 0;
  while (start < len && Math.abs(raw[start]) < threshold) {
    start++;
  }
  if (start >= len) {
    // Entire buffer is silence
    return new Float32Array(raw);
  }

  let end = len - 1;
  while (end > start && Math.abs(raw[end]) < threshold) {
    end--;
  }

  const trimmedStart = Math.max(0, start - leadPad);
  const trimmedEnd = Math.min(len, end + 1 + tailPad);

  // Always return a fresh standalone Float32Array so transferring its ArrayBuffer
  // is zero-copy and never detaches a shared WASM/ONNX buffer.
  return raw.slice(trimmedStart, trimmedEnd);
}

async function checkFromCache(): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    const cache = await caches.open("transformers-cache");
    const keys = await cache.keys();
    return keys.some(
      (req) =>
        req.url.includes("Kokoro-82M-v1.0-ONNX") &&
        req.url.includes(".onnx"),
    );
  } catch {
    return false;
  }
}

type HFProgressInfo = {
  status: "initiate" | "download" | "progress" | "done" | "ready" | string;
  file?: string;
  name?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

function makeProgressCallback() {
  const fileProgress = new Map<string, number>();
  const fileDone = new Set<string>();

  return (info: HFProgressInfo) => {
    const { status } = info;
    const file = info.file ?? info.name ?? "";
    const pct  = typeof info.progress === "number" ? info.progress : null;

    if (status === "initiate" && file) {
      if (!fileProgress.has(file)) {
        fileProgress.set(file, 0);
        broadcast({ id: -1, type: "progress", percent: 0, phase: "download", file });
      }
    } else if (status === "progress" && pct !== null && file) {
      const prev = fileProgress.get(file) ?? 0;
      if (pct > prev) {
        fileProgress.set(file, pct);
        const values = Array.from(fileProgress.values());
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        const clamped = Math.min(avg, 99);
        broadcast({ id: -1, type: "progress", percent: clamped, phase: "download", file });
      }
    } else if (status === "done" && file) {
      fileProgress.set(file, 100);
      fileDone.add(file);

      const allDone = fileProgress.size > 0 && fileDone.size === fileProgress.size;
      if (allDone) {
        broadcast({ id: -1, type: "progress", percent: 100, phase: "compile" });
      } else {
        const values = Array.from(fileProgress.values());
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        const clamped = Math.min(avg, 99);
        broadcast({ id: -1, type: "progress", percent: clamped, phase: "download", file });
      }
    }
  };
}

// Allow up to 3 minutes for first-time download + shader compilation.
const LOAD_TIMEOUT_MS = 180_000;

let loadingWithTimeout: Promise<{ engine: KokoroEngine; loadMs: number; fromCache: boolean }> | null = null;

async function detectWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    console.log("[TTS Worker] WebGPU API not present in this browser");
    return false;
  }

  const ua = (navigator.userAgent || "").toLowerCase();
  if (ua.includes("tesla") || ua.includes("qtcarbrowser")) {
    console.log("[TTS Worker] Tesla browser detected — skipping WebGPU");
    return false;
  }

  try {
    // Request high-performance discrete GPU (e.g. RTX 4070 Ti) rather than integrated/software
    const adapter = await (navigator as any).gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) {
      console.log("[TTS Worker] WebGPU requestAdapter() returned null — GPU unavailable");
      return false;
    }

    // Reject software/CPU fallback adapters (llvmpipe, lavapipe, swiftshader) so we don't
    // run a 325 MB fp32 model on CPU emulation instead of quantized WASM q8.
    const isFallback = Boolean(adapter.isFallbackAdapter || adapter.info?.isFallbackAdapter);
    const infoStr = [
      adapter.info?.vendor,
      adapter.info?.architecture,
      adapter.info?.device,
      adapter.info?.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (
      isFallback ||
      infoStr.includes("llvmpipe") ||
      infoStr.includes("lavapipe") ||
      infoStr.includes("swiftshader") ||
      infoStr.includes("software")
    ) {
      console.log(`[TTS Worker] WebGPU adapter is software fallback (${infoStr || "fallback"}) — preferring WASM q8`);
      return false;
    }

    const limits = adapter.limits;
    if (limits && limits.maxBufferSize < 128 * 1024 * 1024) {
      console.log(`[TTS Worker] WebGPU maxBufferSize=${limits.maxBufferSize} too small for fp32 model — falling back`);
      return false;
    }
    console.log(`[TTS Worker] WebGPU hardware adapter available (${infoStr || "gpu"})`);
    return true;
  } catch (e) {
    console.log("[TTS Worker] WebGPU requestAdapter() threw:", e instanceof Error ? e.message : e);
    return false;
  }
}

function hasSufficientMemory(): boolean {
  const mem = (navigator as any).deviceMemory;
  if (typeof mem === "number") {
    if (mem < 2) {
      console.log(`[TTS Worker] Device reports ${mem}GB RAM — insufficient for Kokoro model`);
      return false;
    }
    return true;
  }
  const ua = (navigator.userAgent || "").toLowerCase();
  if (ua.includes("iphone") && (ua.includes("os 12_") || ua.includes("os 13_") || ua.includes("os 14_"))) {
    return false;
  }
  return true;
}

async function loadWasmFallback(): Promise<KokoroTTS> {
  console.log("[TTS Worker] Loading WASM q8…");
  const model = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
    dtype: "q8",
    device: "wasm",
    progress_callback: makeProgressCallback(),
  });
  engineId = "wasm-q8";
  kokoroTTS = model;
  isReady = true;
  console.log("[TTS Worker] ✓ WASM q8 loaded");
  return model;
}

async function loadModel(): Promise<{ engine: KokoroEngine; loadMs: number; fromCache: boolean }> {
  if (isReady && kokoroTTS) return { engine: engineId, loadMs, fromCache };
  if (loadingWithTimeout) return loadingWithTimeout;

  const webgpuAvailable = await detectWebGPU();
  const memoryAvailable = hasSufficientMemory();

  if (!webgpuAvailable && !memoryAvailable) {
    const err = new Error("This device lacks WebGPU and has insufficient memory for local TTS. Please use Browser TTS or Qwen Cloud instead.");
    console.error("[TTS Worker]", err.message);
    throw err;
  }

  loadingPromise = (async () => {
    const cachedBefore = await checkFromCache();
    console.log(`[TTS Worker] Starting load · cache=${cachedBefore ? "hit (instant)" : "miss (downloading)"}`);

    const t0 = performance.now();

    if (webgpuAvailable) {
      try {
        console.log("[TTS Worker] Loading WebGPU fp32…");
        kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
          dtype: "fp32",
          device: "webgpu",
          progress_callback: makeProgressCallback(),
        });
        engineId = "webgpu-fp32";
        console.log("[TTS Worker] ✓ WebGPU fp32 loaded");
      } catch (e) {
        console.log("[TTS Worker] WebGPU load failed — falling back to WASM q8:", e instanceof Error ? e.message : e);
        kokoroTTS = null;
      }
    }

    if (!kokoroTTS) {
      if (!memoryAvailable) {
        throw new Error("Insufficient memory for WASM TTS. Please use Browser TTS or Qwen Cloud instead.");
      }
      await loadWasmFallback();
    }

    loadMs = Math.round(performance.now() - t0);
    fromCache = cachedBefore;
    isReady = true;

    const loadSecs = (loadMs / 1000).toFixed(1);
    console.log(
      `[TTS Worker] Ready · engine=${engineId} · source=${fromCache ? "cache" : "download"} · ${loadSecs}s`,
    );

    return { engine: engineId, loadMs, fromCache };
  })().catch((err) => {
    loadingPromise = null;
    throw err;
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      loadingPromise = null;
      loadingWithTimeout = null;
      reject(new Error("Kokoro model load timed out — please refresh and try again"));
    }, LOAD_TIMEOUT_MS);
  });

  loadingWithTimeout = Promise.race([loadingPromise, timeoutPromise]).then(
    (result) => {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      loadingWithTimeout = null;
      return result;
    },
    (err) => {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      loadingWithTimeout = null;
      throw err;
    },
  );

  return loadingWithTimeout;
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
      if (!kokoroTTS) {
        await loadModel();
      }
      if (!kokoroTTS) throw new Error("Kokoro not initialized");

      const cleanInput = (text ?? "").trim();
      if (!cleanInput) {
        const silent = new Float32Array(240);
        respond.postMessage({ id, type: "audio", samples: silent, sampleRate: 24000, engine: engineId }, [silent.buffer]);
        return;
      }

      const selectedVoice = (voice || "af_bella") as KokoroVoice;
      const tGen0 = performance.now();
      let output: unknown;
      try {
        output = await kokoroTTS.generate(cleanInput, { voice: selectedVoice });
      } catch (genErr) {
        // If WebGPU inference failed at runtime (e.g. shader compilation or buffer limit),
        // transparently fall back to WASM q8 and retry this utterance.
        if (engineId === "webgpu-fp32") {
          console.warn("[TTS Worker] WebGPU generate() failed, falling back to WASM q8:", genErr);
          await loadWasmFallback();
          output = await kokoroTTS!.generate(cleanInput, { voice: selectedVoice });
        } else {
          throw genErr;
        }
      }
      const genMs = performance.now() - tGen0;

      const rawSamples: Float32Array = (output as { audio: Float32Array }).audio;
      const sampleRate: number = (output as { sampling_rate: number }).sampling_rate || 24000;
      const audioDurationMs = (rawSamples.length / sampleRate) * 1000;

      // If WebGPU is consistently slower than real-time after initial shader compilation
      // (e.g. driver/Wayland CPU<->GPU LSTM copy bottleneck), switch to quantized WASM q8.
      if (engineId === "webgpu-fp32" && audioDurationMs > 1500) {
        webgpuGenCount++;
        if (webgpuGenCount > 1 && genMs > audioDurationMs * 1.15 && genMs > 3000) {
          slowWebgpuCount++;
          console.warn(
            `[TTS Worker] WebGPU synthesis slower than real-time (${Math.round(genMs)}ms for ${Math.round(audioDurationMs)}ms audio, count=${slowWebgpuCount})`,
          );
          if (slowWebgpuCount >= 2) {
            console.log("[TTS Worker] Switching from slow WebGPU fp32 to faster WASM q8 for subsequent blocks…");
            loadWasmFallback().catch(() => {});
          }
        } else if (genMs < audioDurationMs * 0.8) {
          slowWebgpuCount = 0;
        }
      }

      // Trim excessive leading/trailing vocoder silence so consecutive blocks play gaplessly
      const samples = trimSilence(rawSamples, sampleRate);
      respond.postMessage({ id, type: "audio", samples, sampleRate, engine: engineId }, [samples.buffer]);
    } catch (err) {
      respond.postMessage({
        id,
        type: "error",
        message: err instanceof Error ? err.message : "TTS generation failed",
      });
    }
  }
}

const isSharedWorker =
  typeof SharedWorkerGlobalScope !== "undefined" && self instanceof SharedWorkerGlobalScope;

self.addEventListener("error", (e: ErrorEvent) => {
  const msg = `Worker error: ${e.message} at ${e.filename}:${e.lineno}`;
  if (connectedPorts.size > 0) {
    connectedPorts.forEach((port) => {
      try { port.postMessage({ id: -1, type: "error", message: msg }); }
      catch { connectedPorts.delete(port); }
    });
  } else {
    try { (self as DedicatedWorkerGlobalScope).postMessage({ id: -1, type: "error", message: msg }); }
    catch { /* ignore */ }
  }
});

self.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  const reason = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "Unhandled promise rejection in worker");
  const msg = `Worker unhandled rejection: ${reason}`;
  if (connectedPorts.size > 0) {
    connectedPorts.forEach((port) => {
      try { port.postMessage({ id: -1, type: "error", message: msg }); }
      catch { connectedPorts.delete(port); }
    });
  } else {
    try { (self as DedicatedWorkerGlobalScope).postMessage({ id: -1, type: "error", message: msg }); }
    catch { /* ignore */ }
  }
});

if (isSharedWorker) {
  (self as unknown as SharedWorkerGlobalScope).onconnect = (e: MessageEvent) => {
    const port = e.ports[0];
    connectedPorts.add(port);
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
