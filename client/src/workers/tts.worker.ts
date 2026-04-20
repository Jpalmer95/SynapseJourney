/// <reference lib="webworker" />

import { KokoroTTS } from "kokoro-js";
import { env } from "@huggingface/transformers";

// Use the browser Cache API so model weights persist offline after first download.
env.useBrowserCache = true;

type GenerateOptions = NonNullable<Parameters<KokoroTTS["generate"]>[1]>;
type KokoroVoice = NonNullable<GenerateOptions["voice"]>;

export type KokoroEngine = "webgpu-fp32" | "wasm-q8";

// ── Typed message payloads ───────────────────────────────────────────────────
type ReadyPayload    = { id: number; type: "ready";    engine: KokoroEngine; loadMs: number; fromCache: boolean };
type AudioPayload    = { id: number; type: "audio";    samples: Float32Array; sampleRate: number };
type ErrorPayload    = { id: number; type: "error";    message: string };
// Progress payload has id=-1 (broadcast, not tied to a specific request).
type ProgressPayload = { id: -1;    type: "progress"; percent: number; phase: "download" | "compile"; file?: string };
type WorkerPayload   = ReadyPayload | AudioPayload | ErrorPayload | ProgressPayload;

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

// ── Connected ports registry (SharedWorker only) ──────────────────────────────
// All ports that have ever connected are tracked here so progress broadcasts
// reach every open tab simultaneously.
const connectedPorts = new Set<MessagePort>();

/** Broadcast a progress event to all connected ports (SharedWorker) or self (DedicatedWorker). */
function broadcast(payload: ProgressPayload) {
  if (connectedPorts.size > 0) {
    connectedPorts.forEach((port) => {
      try { port.postMessage(payload); } catch { connectedPorts.delete(port); /* prune closed port */ }
    });
  } else {
    // DedicatedWorker — post directly to the worker global scope.
    (self as DedicatedWorkerGlobalScope).postMessage(payload);
  }
}

async function checkFromCache(): Promise<boolean> {
  try {
    const cache = await caches.open("transformers-cache");
    const keys = await cache.keys();
    // Check for the fp32 ONNX artifact (primary engine). Falls back to q8 detection
    // so returning users with a WASM cache still get a cache-hit indication.
    return keys.some(
      (req) =>
        req.url.includes("Kokoro-82M-v1.0-ONNX") &&
        (req.url.includes("model_fp32") || req.url.includes("model_q8")),
    );
  } catch {
    return false;
  }
}

// Minimal subset of @huggingface/transformers ProgressInfo we actually use.
type HFProgressInfo = {
  status: "initiate" | "download" | "progress" | "done" | "ready" | string;
  file?: string;
  name?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

/**
 * Build a progress_callback for from_pretrained.
 *
 * The HF transformers library fires callbacks with:
 *   { status: "initiate" | "download" | "progress" | "done" | "ready", file?, progress? }
 *
 * Strategy: track the highest `progress` value seen across all files.
 * The ONNX model file (~82 MB) dominates, so this closely tracks real download progress.
 *
 * FIX: only transition to "compile" phase once ALL tracked files have reported "done".
 * Previously the phase flipped on the FIRST "done" (e.g. config.json), while the
 * large ONNX file was still downloading — causing the UI to show "Compiling…" for the
 * entire 2+ minute download on mobile.
 */
function makeProgressCallback() {
  // per-file max progress seen so far (0 = initiate seeded, 100 = done)
  const fileProgress = new Map<string, number>();
  // track files that are fully done so we know when ALL are done
  const fileDone = new Set<string>();

  return (info: HFProgressInfo) => {
    const { status } = info;
    const file = info.file ?? info.name ?? "";
    const pct  = typeof info.progress === "number" ? info.progress : null;

    if (status === "initiate" && file) {
      // A new file is starting — seed it at 0 so the bar shows "Downloading…" immediately.
      if (!fileProgress.has(file)) {
        fileProgress.set(file, 0);
        broadcast({ id: -1, type: "progress", percent: 0, phase: "download", file });
      }
    } else if (status === "progress" && pct !== null && file) {
      const prev = fileProgress.get(file) ?? 0;
      if (pct > prev) {
        fileProgress.set(file, pct);
        // Compute overall progress: average across all files we've seen.
        const values = Array.from(fileProgress.values());
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        // Keep it in [0, 99] during download — 100 is reserved for the compile/ready phase.
        const clamped = Math.min(avg, 99);
        broadcast({ id: -1, type: "progress", percent: clamped, phase: "download", file });
      }
    } else if (status === "done" && file) {
      fileProgress.set(file, 100);
      fileDone.add(file);

      // Only switch to "compile" phase when EVERY file we've seen is done.
      // This prevents the phase flipping on config.json while the 82MB ONNX
      // model is still downloading (the root cause of the "stuck compiling" bug).
      const allDone = fileProgress.size > 0 && fileDone.size === fileProgress.size;
      if (allDone) {
        broadcast({ id: -1, type: "progress", percent: 100, phase: "compile" });
      } else {
        // Recompute overall average (this file just hit 100) and keep download phase.
        const values = Array.from(fileProgress.values());
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        const clamped = Math.min(avg, 99);
        broadcast({ id: -1, type: "progress", percent: clamped, phase: "download", file });
      }
    }
  };
}

// Timeout (ms) after which a loadModel attempt is considered hung.
const LOAD_TIMEOUT_MS = 90_000; // 90 seconds

// Timeout-raced version of loadingPromise shared across all concurrent callers.
// Stored separately so that re-entrant calls during an in-progress load also get
// bounded wait semantics (not just the first initiating call).
let loadingWithTimeout: Promise<{ engine: KokoroEngine; loadMs: number; fromCache: boolean }> | null = null;

/**
 * Check if WebGPU is actually usable on this device.
 * Returns false if:
 * - WebGPU API not present
 * - requestAdapter() returns null (device GPU unavailable or under memory pressure)
 * - We are on a known-constrained device (Tesla infotainment, older mobile)
 */
async function detectWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    console.log("[TTS Worker] WebGPU API not present in this browser");
    return false;
  }

  // Check for known-constrained environments where WebGPU is likely broken
  const ua = (navigator.userAgent || "").toLowerCase();
  // Tesla browser identifies as a specific Chromium build
  if (ua.includes("tesla") || ua.includes("qtcarbrowser")) {
    console.log("[TTS Worker] Tesla browser detected — skipping WebGPU");
    return false;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.log("[TTS Worker] WebGPU requestAdapter() returned null — GPU unavailable");
      return false;
    }
    // Check available VRAM hint if exposed (not all browsers expose this)
    const limits = adapter.limits;
    if (limits && limits.maxBufferSize < 128 * 1024 * 1024) {
      console.log(`[TTS Worker] WebGPU maxBufferSize=${limits.maxBufferSize} too small for fp32 model — falling back`);
      return false;
    }
    console.log("[TTS Worker] WebGPU adapter available");
    return true;
  } catch (e) {
    console.log("[TTS Worker] WebGPU requestAdapter() threw:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Check if device memory is likely sufficient for the 82MB model.
 * Uses navigator.deviceMemory if available (Chrome/Edge), else heuristic by UA.
 */
function hasSufficientMemory(): boolean {
  // navigator.deviceMemory returns approximate RAM in GB (Chrome only)
  const mem = (navigator as any).deviceMemory;
  if (typeof mem === "number") {
    if (mem < 2) {
      console.log(`[TTS Worker] Device reports ${mem}GB RAM — insufficient for Kokoro model`);
      return false;
    }
    console.log(`[TTS Worker] Device reports ${mem}GB RAM — sufficient`);
    return true;
  }
  // Fallback: check UA for known low-memory devices
  const ua = (navigator.userAgent || "").toLowerCase();
  // Very old iPhones (SE 1st gen, 6/7) have 1-2GB
  if (ua.includes("iphone") && (ua.includes("os 12_") || ua.includes("os 13_") || ua.includes("os 14_"))) {
    console.log("[TTS Worker] Old iOS detected — assuming low memory");
    return false;
  }
  // Assume sufficient if we can't detect
  return true;
}

async function loadModel(): Promise<{ engine: KokoroEngine; loadMs: number; fromCache: boolean }> {
  if (isReady) return { engine: engineId, loadMs, fromCache };
  // Return the timeout-raced shared promise so ALL concurrent callers get the same
  // bounded 90 s deadline (not just the first one that started the load).
  if (loadingWithTimeout) return loadingWithTimeout;

  // Pre-check device capabilities before attempting load
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

    // ── WebGPU fp32 primary, WASM q8 fallback ────────────────────────────────
    // fp32 on WebGPU produces the best audio quality. WASM q8 catches devices
    // without WebGPU support or where GPU load fails.
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
        // Fall through to WASM
      }
    }

    // WASM fallback (also the primary path when WebGPU was unavailable)
    if (!kokoroTTS) {
      if (!memoryAvailable) {
        throw new Error("Insufficient memory for WASM TTS. Please use Browser TTS or Qwen Cloud instead.");
      }
      console.log("[TTS Worker] Loading WASM q8…");
      kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q8",
        device: "wasm",
        progress_callback: makeProgressCallback(),
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
  })().catch((err) => {
    // Reset so future init calls can retry after a recoverable failure.
    loadingPromise = null;
    throw err;
  });

  // ── Timeout race ────────────────────────────────────────────────────────────
  // If the WASM ONNX runtime hangs (e.g. stall on very low-memory mobile)
  // the UI would be stuck indefinitely. Race with a timeout so the hook receives
  // an error and can clear its loading state.
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
      // Clear the timeout timer on success to avoid late side-effects.
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
