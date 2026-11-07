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
export type EnginePreference = "auto" | "webgpu-fp32" | "wasm-q8";

// ── Typed message payloads ───────────────────────────────────────────────────
type ReadyPayload    = { id: number; type: "ready";    engine: KokoroEngine; loadMs: number; fromCache: boolean };
type AudioPayload    = { id: number; type: "audio";    samples: Float32Array; sampleRate: number; engine?: KokoroEngine };
type ErrorPayload    = { id: number; type: "error";    message: string };
// Progress payload has id=-1 (broadcast, not tied to a specific request).
type ProgressPayload = { id: -1;    type: "progress"; percent: number; phase: "download" | "compile"; file?: string };
// Diagnostic payload has id=-1 (broadcast) and describes an engine change / dropped bad audio.
type NoticePayload   = { id: -1;    type: "notice";   kind: "engine-switch" | "bad-audio"; message: string; engine?: KokoroEngine };
type WorkerPayload   = ReadyPayload | AudioPayload | ErrorPayload | ProgressPayload | NoticePayload;

// Both MessagePort and DedicatedWorkerGlobalScope expose postMessage with this signature.
type Responder = {
  postMessage(data: WorkerPayload): void;
  postMessage(data: WorkerPayload, transfer: Transferable[]): void;
};

// ── Shared model state ────────────────────────────────────────────────────────
let kokoroTTS: KokoroTTS | null = null;
let engineId: KokoroEngine = "webgpu-fp32";
let enginePreference: EnginePreference = "auto";
let loadMs = 0;
let fromCache = false;
let loadingPromise: Promise<{ engine: KokoroEngine; loadMs: number; fromCache: boolean }> | null = null;
let isReady = false;
let webgpuGenCount = 0;
let slowWebgpuCount = 0;
// Set when we've decided an engine is unusable; applied before the next synthesis.
let pendingEngineSwitch: KokoroEngine | null = null;

// ── Connected ports registry (SharedWorker fallback support) ──────────────────
const connectedPorts = new Set<MessagePort>();

function broadcastToPorts(payload: WorkerPayload) {
  if (connectedPorts.size > 0) {
    connectedPorts.forEach((port) => {
      try { port.postMessage(payload); } catch { connectedPorts.delete(port); }
    });
  } else {
    (self as DedicatedWorkerGlobalScope).postMessage(payload);
  }
}

/** Broadcast a progress event to all connected ports (SharedWorker) or self (DedicatedWorker). */
function broadcast(payload: ProgressPayload) {
  broadcastToPorts(payload);
}

function notice(kind: NoticePayload["kind"], message: string, engine?: KokoroEngine) {
  console.warn(`[TTS Worker] ${message}`);
  broadcastToPorts({ id: -1, type: "notice", kind, message, engine: engine ?? engineId });
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

// ── Output health validation ────────────────────────────────────────────────
// onnxruntime-web's WebGPU backend reuses/caches bind groups per input shape. With Kokoro's
// dynamic sequence length the *second* inference at a new shape silently re-binds stale
// buffers, and the model returns enormous/Discarded values that reach the listener as loud
// static hiss. The first utterance always sounds perfect, which is exactly what makes this
// bug so confusing. Every synthesized buffer is therefore checked before it is played, and a
// bad buffer switches the worker to the deterministic WASM q8 path and re-synthesizes.
export type AudioHealth = {
  ok: boolean;
  reason?: string;
  peak: number;
  rms: number;
  zcr: number;
  nonFinite: number;
  maxJump: number;
  durationSec: number;
};

function checkAudioHealth(samples: Float32Array, sampleRate = 24000): AudioHealth {
  const n = samples.length;
  let nonFinite = 0;
  let peak = 0;
  let sumSq = 0;
  let crossings = 0;
  let maxJump = 0;
  let prev = 0;

  for (let i = 0; i < n; i++) {
    const v = samples[i];
    if (!Number.isFinite(v)) { nonFinite++; continue; }
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
    sumSq += v * v;
    if (i > 0) {
      if ((v >= 0) !== (prev >= 0)) crossings++;
      const d = v - prev;
      const ad = d < 0 ? -d : d;
      if (ad > maxJump) maxJump = ad;
    }
    prev = v;
  }

  const rms = Math.sqrt(sumSq / Math.max(1, n));
  const zcr = crossings / Math.max(1, n);
  const durationSec = n / sampleRate;

  const health: AudioHealth = { ok: true, peak, rms, zcr, nonFinite, maxJump, durationSec };

  if (n === 0) { health.ok = false; health.reason = "empty buffer"; return health; }
  if (nonFinite > 0) { health.ok = false; health.reason = `${nonFinite} non-finite samples`; return health; }
  // Real speech stays inside [-1, 1]; anything above a few units is diverged model output.
  if (peak > 4) { health.ok = false; health.reason = `peak ${peak.toFixed(1)} out of range`; return health; }
  // A near-silent buffer means the vocoder produced nothing; treat as failure so we retry.
  if (durationSec > 0.4 && rms < 0.0008) { health.ok = false; health.reason = `near-silent (rms ${rms.toExponential(1)})`; return health; }
  // White-noise hiss sits near 0.5 zero-crossing rate; speech is ~0.05-0.20.
  if (zcr > 0.35) { health.ok = false; health.reason = `noise-like (zcr ${zcr.toFixed(2)})`; return health; }
  // Sample-to-sample discontinuities above full scale mean corrupt memory, not speech.
  if (maxJump > 3) { health.ok = false; health.reason = `discontinuity ${maxJump.toFixed(1)}`; return health; }

  return health;
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

/** Free the current model's GPU/heap resources before swapping engines. */
async function disposeModel() {
  const model = kokoroTTS as unknown as { dispose?: () => Promise<void> | void; model?: { dispose?: () => Promise<void> | void } } | null;
  kokoroTTS = null;
  isReady = false;
  try {
    if (model?.model?.dispose) await model.model.dispose();
    else if (model?.dispose) await model.dispose();
  } catch (e) {
    console.log("[TTS Worker] model dispose() failed (ignored):", e instanceof Error ? e.message : e);
  }
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

async function loadEngine(device: KokoroEngine): Promise<KokoroTTS> {
  if (device === "wasm-q8") return loadWasmFallback();

  console.log("[TTS Worker] Loading WebGPU fp32…");
  const model = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
    dtype: "fp32",
    device: "webgpu",
    progress_callback: makeProgressCallback(),
  });
  engineId = "webgpu-fp32";
  kokoroTTS = model;
  isReady = true;
  console.log("[TTS Worker] ✓ WebGPU fp32 loaded");
  return model;
}

/**
 * Probe the engine and validate the audio.
 * WebGPU needs a *production-length* probe: onnxruntime-web's WebGPU EP corrupts any
 * inference at a long input shape (and poisons the device afterwards), while short probes
 * pass. Probing with a real ~430-char block rejects that backend before a listener ever
 * hears hiss. WASM q8 is deterministic, so it only gets a cheap sanity probe.
 */
const SELF_TEST_SHORT = "Testing the voice engine.";
const SELF_TEST_LONG =
  "Regularization is a bet against memorization. Dropout, weight decay, and early stopping all say the same thing in different accents: do not trust a model that fits the training set perfectly, because the training set is not the world.";

async function runEngineSelfTest(engine: KokoroEngine = engineId): Promise<{ ok: boolean; reason?: string }> {
  if (!kokoroTTS) return { ok: false, reason: "model not loaded" };
  const probes = engine === "webgpu-fp32" ? [SELF_TEST_SHORT, SELF_TEST_LONG] : [SELF_TEST_SHORT];
  for (let i = 0; i < probes.length; i++) {
    const out = await kokoroTTS.generate(probes[i], { voice: "af_bella" as KokoroVoice });
    const samples: Float32Array = (out as { audio: Float32Array }).audio;
    const sampleRate: number = (out as { sampling_rate: number }).sampling_rate || 24000;
    const health = checkAudioHealth(samples, sampleRate);
    if (!health.ok) {
      console.warn(`[TTS Worker] self-test probe ${i + 1} failed: ${health.reason}`);
      return { ok: false, reason: health.reason };
    }
  }
  return { ok: true };
}

/** Switch engines because the current one produced corrupt audio. */
async function switchEngine(target: KokoroEngine, reason: string): Promise<void> {
  if (engineId === target && isReady) return;
  notice("engine-switch", `Switching TTS engine to ${target} (${reason})`, target);
  await disposeModel();
  await loadEngine(target);
  const health = await runEngineSelfTest(target);
  if (!health.ok) {
    throw new Error(`TTS engine ${target} failed its self-test: ${health.reason}`);
  }
  pendingEngineSwitch = null;
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

    const wantWebgpu =
      enginePreference !== "wasm-q8" && webgpuAvailable;

    if (wantWebgpu) {
      try {
        await loadEngine("webgpu-fp32");
        const health = await runEngineSelfTest("webgpu-fp32");
        if (!health.ok) {
          console.log(`[TTS Worker] WebGPU output failed self-test (${health.reason}) — using WASM q8`);
          await disposeModel();
        }
      } catch (e) {
        console.log("[TTS Worker] WebGPU load failed — falling back to WASM q8:", e instanceof Error ? e.message : e);
        await disposeModel().catch(() => {});
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

// ── Serialized synthesis queue ──────────────────────────────────────────────
// ONNX Runtime sessions are not re-entrant. The prefetcher synthesizes the next blocks while
// the playhead asks for the current one, so two `generate()` calls used to land on the same
// session at once and corrupt it. Everything now runs through one queue.
let queueTail: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queueTail.then(job, job);
  queueTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Synthesize one block, validating output and repairing the engine when it degrades. */
async function synthesize(
  text: string,
  voice: string,
): Promise<{ samples: Float32Array; sampleRate: number; engine: KokoroEngine }> {
  const MAX_ATTEMPTS = 3;
  let lastReason = "unknown";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (pendingEngineSwitch) {
      const target = pendingEngineSwitch;
      pendingEngineSwitch = null;
      await switchEngine(target, "previously detected slow or corrupt output");
    }
    if (!kokoroTTS) {
      await loadModel();
    }
    if (!kokoroTTS) throw new Error("Kokoro not initialized");

    const tGen0 = performance.now();
    let output: unknown;
    try {
      output = await kokoroTTS.generate(text, { voice: voice as KokoroVoice });
    } catch (genErr) {
      if (engineId === "webgpu-fp32") {
        console.warn("[TTS Worker] WebGPU generate() threw, switching to WASM q8:", genErr);
        await switchEngine("wasm-q8", "WebGPU inference error");
        continue;
      }
      throw genErr;
    }
    const genMs = performance.now() - tGen0;

    const rawSamples: Float32Array = (output as { audio: Float32Array }).audio;
    const sampleRate: number = (output as { sampling_rate: number }).sampling_rate || 24000;
    const audioDurationMs = (rawSamples.length / sampleRate) * 1000;

    const health = checkAudioHealth(rawSamples, sampleRate);
    if (!health.ok) {
      lastReason = health.reason ?? "invalid audio";
      console.warn(
        `[TTS Worker] Rejected ${engineId} output (attempt ${attempt + 1}/${MAX_ATTEMPTS}): ${lastReason}`,
      );
      notice("bad-audio", `Discarded corrupted ${engineId} audio: ${lastReason}`);
      if (engineId === "webgpu-fp32") {
        await switchEngine("wasm-q8", `corrupt output (${lastReason})`);
        continue;
      }
      // WASM is deterministic; one retry, then give up so the client can fall back.
      continue;
    }

    // If WebGPU is consistently slower than real-time after initial shader compilation
    // (e.g. driver/Wayland CPU<->GPU LSTM copy bottleneck), switch to quantized WASM q8
    // starting with the NEXT block (switching mid-generation would race this call).
    if (engineId === "webgpu-fp32" && audioDurationMs > 1500) {
      webgpuGenCount++;
      if (webgpuGenCount > 1 && genMs > audioDurationMs * 1.15 && genMs > 3000) {
        slowWebgpuCount++;
        console.warn(
          `[TTS Worker] WebGPU synthesis slower than real-time (${Math.round(genMs)}ms for ${Math.round(audioDurationMs)}ms audio, count=${slowWebgpuCount})`,
        );
        if (slowWebgpuCount >= 2 && !pendingEngineSwitch) {
          console.log("[TTS Worker] Queuing switch from slow WebGPU fp32 to WASM q8…");
          pendingEngineSwitch = "wasm-q8";
        }
      } else if (genMs < audioDurationMs * 0.8) {
        slowWebgpuCount = 0;
      }
    }

    // Trim excessive leading/trailing vocoder silence so consecutive blocks play gaplessly
    const samples = trimSilence(rawSamples, sampleRate);
    return { samples, sampleRate, engine: engineId };
  }

  throw new Error(`Kokoro produced unusable audio after ${MAX_ATTEMPTS} attempts (${lastReason})`);
}

async function handleMessage(
  respond: Responder,
  id: number,
  type: string,
  text?: string,
  voice?: string,
  preference?: EnginePreference,
) {
  if (type === "init") {
    if (preference) enginePreference = preference;
    try {
      const result = await enqueue(() => loadModel());
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
      const cleanInput = (text ?? "").trim();
      if (!cleanInput) {
        const silent = new Float32Array(240);
        respond.postMessage({ id, type: "audio", samples: silent, sampleRate: 24000, engine: engineId }, [silent.buffer]);
        return;
      }

      const selectedVoice = voice || "af_bella";
      const { samples, sampleRate } = await enqueue(() => synthesize(cleanInput, selectedVoice));
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
  broadcastToPorts({ id: -1, type: "error", message: msg });
});

self.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  const reason = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "Unhandled promise rejection in worker");
  const msg = `Worker unhandled rejection: ${reason}`;
  broadcastToPorts({ id: -1, type: "error", message: msg });
});

if (isSharedWorker) {
  (self as unknown as SharedWorkerGlobalScope).onconnect = (e: MessageEvent) => {
    const port = e.ports[0];
    connectedPorts.add(port);
    port.onmessage = ({ data }: MessageEvent) => {
      const { id, type, text, voice, preference } = data as {
        id: number;
        type: string;
        text?: string;
        voice?: string;
        preference?: EnginePreference;
      };
      handleMessage(port, id, type, text, voice, preference);
    };
    port.start();
  };
} else {
  (self as DedicatedWorkerGlobalScope).onmessage = ({ data }: MessageEvent) => {
    const { id, type, text, voice, preference } = data as {
      id: number;
      type: string;
      text?: string;
      voice?: string;
      preference?: EnginePreference;
    };
    handleMessage(self as DedicatedWorkerGlobalScope, id, type, text, voice, preference);
  };
}
