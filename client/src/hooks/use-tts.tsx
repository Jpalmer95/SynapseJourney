import { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { KOKORO_VOICES, KOKORO_DEFAULT_VOICE, QWEN_DEFAULT_VOICE, QWEN_VOICES, getVoiceTier } from "@/lib/tts-constants";
import type { QwenMode } from "@/lib/tts-constants";
import { useToast } from "@/hooks/use-toast";

// localStorage keys used by the TTS engine
const KOKORO_VOICE_KEY = "kokoro_voice";
const QWEN_VOICE_KEY = "qwen_voice";
const QWEN_MODE_KEY = "qwen_mode";
const QWEN_STYLE_KEY = "qwen_style_instruction";
const QWEN_VOICE_DESC_KEY = "qwen_voice_description";
const QWEN_REF_TEXT_KEY = "qwen_ref_text";

export interface VoicePreset {
  id: string;
  name: string;
  description: string;
  gender: "female" | "male" | "neutral";
  style: string;
}

export interface TTSSection {
  label: string;
  text: string;
}

interface TTSState {
  isLoading: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  error: string | null;
  progress: number;
  availableVoices: SpeechSynthesisVoice[];
  usingServerTTS: boolean;
  currentSectionIndex: number;
  totalSections: number;
}

interface UseTTSReturn extends TTSState {
  speak: (text: string, unitId?: number) => Promise<void>;
  speakSections: (sections: TTSSection[], startIndex?: number) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  setRate: (rate: number) => void;
  setSelectedVoice: (voiceName: string) => void;
  rate: number;
  selectedVoiceName: string | null;
  serverVoicePreset: string;
  setServerVoicePreset: (preset: string) => Promise<void>;
  isAudioCached: (unitId: number) => Promise<boolean>;
  kokoroReady: boolean;
  kokoroLoading: boolean;
  kokoroDownloadPercent: number | null;
  kokoroDownloadPhase: "download" | "compile" | null;
  kokoroLoadError: string | null;
  kokoroDeviceWarning: string | null; // Proactive warning for constrained devices
  kokoroEngine: "webgpu-fp32" | "wasm-q8" | null;
  kokoroLoadMs: number | null;
  kokoroFromCache: boolean | null;
  kokoroIncompatible: boolean;
  kokoroVoice: string;
  setKokoroVoice: (voiceId: string) => void;
  qwenVoice: string;
  setQwenVoice: (voiceId: string) => void;
  qwenMode: QwenMode;
  setQwenMode: (mode: QwenMode) => void;
  qwenStyleInstruction: string;
  setQwenStyleInstruction: (text: string) => void;
  qwenVoiceDescription: string;
  setQwenVoiceDescription: (text: string) => void;
  refText: string;
  setRefText: (text: string) => void;
}

const BROWSER_SPEECH_SUPPORTED = typeof window !== "undefined" && "speechSynthesis" in window;

/** Wait up to 2s for browser voices to populate (Chrome/Android loads asynchronously). */
async function waitForBrowserVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!BROWSER_SPEECH_SUPPORTED) return [];
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (voices.length > 0) return voices;
  return new Promise((resolve) => {
    const handler = () => {
      const v = synth.getVoices();
      synth.removeEventListener("voiceschanged", handler);
      resolve(v);
    };
    synth.addEventListener("voiceschanged", handler);
    // Fallback: resolve with whatever we have after 2s
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", handler);
      resolve(synth.getVoices());
    }, 2000);
  });
}

// Thrown when the server says Qwen TTS needs an HF token (HTTP 428).
// Distinct from a generic failure so the UI can tell the user exactly what to do.
class HfTokenRequiredError extends Error {
  constructor(public serverMessage: string) {
    super("HF_TOKEN_REQUIRED");
    this.name = "HfTokenRequiredError";
  }
}

async function throwIfHfTokenRequired(res: Response): Promise<void> {
  if (res.status !== 428) return;
  let message = "Qwen Cloud TTS needs a Hugging Face token. Add one in Settings.";
  try {
    const data = await res.clone().json();
    if (data?.message) message = data.message;
  } catch { /* keep default */ }
  throw new HfTokenRequiredError(message);
}

async function fetchServerTTSAudio(unitId: number, voiceConfig?: object): Promise<{ audioData: string; audioFormat: string; playbackSpeed: number } | null> {
  try {
    const body: Record<string, unknown> = { unitId };
    if (voiceConfig) body.voiceConfig = voiceConfig;
    const res = await fetch("/api/tts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    await throwIfHfTokenRequired(res);
    if (res.status === 403 || res.status === 401) return null;
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.audioData) return null;
    return { audioData: data.audioData, audioFormat: data.audioFormat || "wav", playbackSpeed: data.playbackSpeed || 1.0 };
  } catch (err) {
    if (err instanceof HfTokenRequiredError) throw err;
    return null;
  }
}

async function fetchServerTTSIntro(unitId: number, voiceConfig?: object): Promise<{ audioData: string; audioFormat: string; playbackSpeed: number; restText: string | null } | null> {
  try {
    const body: Record<string, unknown> = { unitId, firstParagraphOnly: true };
    if (voiceConfig) body.voiceConfig = voiceConfig;
    const res = await fetch("/api/tts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    await throwIfHfTokenRequired(res);
    if (res.status === 403 || res.status === 401) return null;
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.audioData) return null;
    return {
      audioData: data.audioData,
      audioFormat: data.audioFormat || "wav",
      playbackSpeed: data.playbackSpeed || 1.0,
      restText: data.restText || null,
    };
  } catch (err) {
    if (err instanceof HfTokenRequiredError) throw err;
    return null;
  }
}

async function fetchServerTTSText(text: string, voiceConfig?: object): Promise<{ audioData: string; audioFormat: string; playbackSpeed: number } | null> {
  try {
    const body: Record<string, unknown> = { text };
    if (voiceConfig) body.voiceConfig = voiceConfig;
    const res = await fetch("/api/tts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    await throwIfHfTokenRequired(res);
    if (res.status === 403 || res.status === 401) return null;
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.audioData) return null;
    return { audioData: data.audioData, audioFormat: data.audioFormat || "wav", playbackSpeed: data.playbackSpeed || 1.0 };
  } catch (err) {
    if (err instanceof HfTokenRequiredError) throw err;
    return null;
  }
}

function base64ToBlob(base64: string, format: string): Blob {
  const mimeMap: Record<string, string> = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    flac: "audio/flac",
    ogg: "audio/ogg",
  };
  const mime = mimeMap[format] || "audio/wav";
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

const TTSContext = createContext<UseTTSReturn | null>(null);

function useTTSImpl(): UseTTSReturn {
  const { toast } = useToast();

  const [state, setState] = useState<TTSState>({
    isLoading: false,
    isSpeaking: false,
    isPaused: false,
    isSupported: true,
    error: null,
    progress: 0,
    availableVoices: [],
    usingServerTTS: false,
    currentSectionIndex: -1,
    totalSections: 0,
  });

  const [rate, setRateState] = useState(1.0);
  const [selectedVoiceName, setSelectedVoiceState] = useState<string | null>(null);
  const [serverVoicePreset, setServerVoicePresetState] = useState<string>("browser");

  const [kokoroVoice, setKokoroVoiceState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(KOKORO_VOICE_KEY);
      const valid = KOKORO_VOICES.some(v => v.id === stored);
      return valid ? stored! : KOKORO_DEFAULT_VOICE;
    } catch { return KOKORO_DEFAULT_VOICE; }
  });
  const [qwenVoice, setQwenVoiceState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(QWEN_VOICE_KEY);
      const valid = QWEN_VOICES.some(v => v.id === stored);
      return valid ? stored! : QWEN_DEFAULT_VOICE;
    } catch { return QWEN_DEFAULT_VOICE; }
  });
  const [qwenMode, setQwenModeState] = useState<QwenMode>(() => {
    try {
      const stored = localStorage.getItem(QWEN_MODE_KEY);
      if (stored === "custom_voice" || stored === "voice_design" || stored === "voice_clone") return stored;
    } catch { /* ignore */ }
    return "custom_voice";
  });
  const [qwenStyleInstruction, setQwenStyleInstructionState] = useState<string>(() => {
    try { return localStorage.getItem(QWEN_STYLE_KEY) || ""; } catch { return ""; }
  });
  const [qwenVoiceDescription, setQwenVoiceDescriptionState] = useState<string>(() => {
    try { return localStorage.getItem(QWEN_VOICE_DESC_KEY) || ""; } catch { return ""; }
  });
  const [refText, setRefTextState] = useState<string>(() => {
    try { return localStorage.getItem(QWEN_REF_TEXT_KEY) || ""; } catch { return ""; }
  });

  const [kokoroReady, setKokoroReady] = useState(false);
  const [kokoroLoading, setKokoroLoading] = useState(false);
  const [kokoroDownloadPercent, setKokoroDownloadPercent] = useState<number | null>(null);
  const [kokoroDownloadPhase, setKokoroDownloadPhase] = useState<"download" | "compile" | null>(null);
  const [kokoroEngine, setKokoroEngine] = useState<"webgpu-fp32" | "wasm-q8" | null>(null);
  const [kokoroLoadMs, setKokoroLoadMs] = useState<number | null>(null);
  const [kokoroFromCache, setKokoroFromCache] = useState<boolean | null>(null);
  // Surfaced to UI when the Kokoro model fails to load (e.g. timeout, OOM).
  const [kokoroLoadError, setKokoroLoadError] = useState<string | null>(null);
  // Proactive device capability warning (checked at hook init)
  const [kokoroDeviceWarning] = useState<string | null>(() => {
    if (typeof navigator === "undefined") return null;
    const ua = (navigator.userAgent || "").toLowerCase();
    // Tesla browser
    if (ua.includes("tesla") || ua.includes("qtcarbrowser")) {
      return "Tesla browser: local TTS may not work. Use Browser TTS or Qwen Cloud.";
    }
    // Low memory devices
    const mem = (navigator as any).deviceMemory;
    if (typeof mem === "number" && mem < 2) {
      return `Device has ~${mem}GB RAM. Local TTS may fail. Use Browser TTS or Qwen Cloud.`;
    }
    // No WebGPU + old iOS
    if (typeof (navigator as any).gpu === "undefined") {
      if (ua.includes("iphone") && (ua.includes("os 12_") || ua.includes("os 13_") || ua.includes("os 14_"))) {
        return "Older iOS detected — local TTS may not work. Use Browser TTS or Qwen Cloud.";
      }
    }
    return null;
  });
  // If true, Kokoro is known incompatible (proactive or reactive detection).
  // The speak/speakSections paths will skip the local tier entirely.
  const [kokoroIncompatible, setKokoroIncompatible] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return false;
    const ua = (navigator.userAgent || "").toLowerCase();
    if (ua.includes("tesla") || ua.includes("qtcarbrowser")) return true;
    const mem = (navigator as any).deviceMemory;
    if (typeof mem === "number" && mem < 2) return true;
    if (typeof (navigator as any).gpu === "undefined") {
      if (ua.includes("iphone") && (ua.includes("os 12_") || ua.includes("os 13_") || ua.includes("os 14_"))) {
        return true;
      }
    }
    return false;
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Persistent AudioContext singleton. Pre-unlocked during the user gesture so
  // Web Audio API playback works on iOS even after a long async WASM synthesis.
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Track the currently-playing AudioBufferSourceNode so it can be cancelled.
  const audioSrcNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chunksRef = useRef<string[]>([]);
  const currentChunkRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);
  const rateRef = useRef(rate);
  const voiceRef = useRef<string | null>(selectedVoiceName);
  const audioUnlockedRef = useRef<boolean>(false);
  const kokoroVoiceRef = useRef<string>(kokoroVoice);
  const qwenVoiceRef = useRef<string>(qwenVoice);
  const qwenModeRef = useRef<QwenMode>(qwenMode);
  const qwenStyleInstructionRef = useRef<string>(qwenStyleInstruction);
  const qwenVoiceDescriptionRef = useRef<string>(qwenVoiceDescription);
  const refTextRef = useRef<string>(refText);
  const kokoroIncompatibleRef = useRef<boolean>(kokoroIncompatible);
  const autoSwitchedToBrowserRef = useRef<boolean>(false);
  // serverVoicePreset ref: updated synchronously in setServerVoicePreset so speak/speakSections
  // always read the current engine even when called immediately after switching.
  const serverVoicePresetRef = useRef<string>("browser");

  // Kokoro worker bridge (SharedWorker or regular Worker — same postMessage interface)
  type WorkerBridge = { postMessage: (data: unknown) => void };
  const workerRef = useRef<WorkerBridge | null>(null);
  const pendingRef = useRef<Map<number, { resolve: (v: Blob | undefined) => void; reject: (e: Error) => void }>>(new Map());
  const msgIdRef = useRef(0);
  const workerReadyRef = useRef(false);
  const workerReadyPromiseRef = useRef<Promise<void> | null>(null);
  const workerRetryCount = useRef(0);

  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { voiceRef.current = selectedVoiceName; }, [selectedVoiceName]);
  useEffect(() => { kokoroVoiceRef.current = kokoroVoice; }, [kokoroVoice]);
  useEffect(() => { qwenVoiceRef.current = qwenVoice; }, [qwenVoice]);
  useEffect(() => { qwenModeRef.current = qwenMode; }, [qwenMode]);
  useEffect(() => { qwenStyleInstructionRef.current = qwenStyleInstruction; }, [qwenStyleInstruction]);
  useEffect(() => { qwenVoiceDescriptionRef.current = qwenVoiceDescription; }, [qwenVoiceDescription]);
  useEffect(() => { refTextRef.current = refText; }, [refText]);
  useEffect(() => { kokoroIncompatibleRef.current = kokoroIncompatible; }, [kokoroIncompatible]);

  // Prefer instant Browser TTS on first visit; only auto-upgrade to Kokoro once the model is ready
  // and the user has not explicitly chosen another engine.
  useEffect(() => {
    if (kokoroReady && serverVoicePreset === "browser") {
      const userPinned = (() => {
        try {
          return localStorage.getItem("tts_engine_pinned") === "1";
        } catch {
          return false;
        }
      })();
      // Soft upgrade path disabled by default to avoid clunky first-play stalls.
      // Users opt into Kokoro via the settings popover.
      if (userPinned) return;
    }
  }, [kokoroReady, serverVoicePreset]);

  // Auto-switch to Browser TTS when Kokoro is detected incompatible and user still has it selected.
  useEffect(() => {
    if (kokoroIncompatible && serverVoicePreset === "kokoro" && !autoSwitchedToBrowserRef.current) {
      autoSwitchedToBrowserRef.current = true;
      serverVoicePresetRef.current = "browser";
      setServerVoicePresetState("browser");
      toast({
        title: "Switched to Browser TTS",
        description: "Your device doesn't support local AI voice synthesis. Using your device's built-in speech engine instead.",
        duration: 6000,
      });
    }
  }, [kokoroIncompatible, serverVoicePreset, toast]);

  const { data: ttsSettings } = useQuery<{
    voicePreset: string;
    hasReferenceAudio: boolean;
    playbackSpeed: number;
    qwenMode?: QwenMode;
    qwenStyleInstruction?: string;
    qwenVoiceDescription?: string;
    refText?: string;
  }>({
    queryKey: ["/api/tts/settings"],
    staleTime: 60000,
    retry: false,
  });

  useEffect(() => {
    if (ttsSettings) {
      const raw = ttsSettings.voicePreset || "browser";
      // Migrate legacy preset IDs from pre-v10 to the new engine model
      const LEGACY_QWEN = new Set(["aria", "nova", "echo", "onyx", "fable", "shimmer", "lyra", "sage", "orion"]);
      const normalized = LEGACY_QWEN.has(raw) ? "qwen" : raw;
      // Keep the ref in sync so speak/speakSections immediately see the loaded preset
      serverVoicePresetRef.current = normalized;
      setServerVoicePresetState(normalized);
      // If a legacy Qwen preset ID directly maps to a QWEN_VOICES entry, seed qwen_voice
      // so the user's prior character choice is preserved (only if not already set)
      const QWEN_VOICE_IDS = new Set(["aria", "nova", "lyra", "echo", "sage", "orion"]);
      if (normalized !== raw && QWEN_VOICE_IDS.has(raw)) {
        try {
          const stored = localStorage.getItem(QWEN_VOICE_KEY);
          if (!stored) {
            localStorage.setItem(QWEN_VOICE_KEY, raw);
            setQwenVoiceState(raw);
            qwenVoiceRef.current = raw;
          }
        } catch { /* ignore */ }
      }
      // Persist migration back to server so preset stays consistent
      if (normalized !== raw) {
        fetch("/api/tts/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ voicePreset: normalized }),
        }).catch(() => { /* ignore — non-critical */ });
      }
      if (ttsSettings.playbackSpeed) {
        setRateState(ttsSettings.playbackSpeed);
      }
      if (ttsSettings.qwenMode) {
        setQwenModeState(ttsSettings.qwenMode);
        qwenModeRef.current = ttsSettings.qwenMode;
        try { localStorage.setItem(QWEN_MODE_KEY, ttsSettings.qwenMode); } catch { /* ignore */ }
      }
      if (ttsSettings.qwenStyleInstruction !== undefined) {
        const v = ttsSettings.qwenStyleInstruction ?? "";
        setQwenStyleInstructionState(v);
        qwenStyleInstructionRef.current = v;
        try { if (v) localStorage.setItem(QWEN_STYLE_KEY, v); else localStorage.removeItem(QWEN_STYLE_KEY); } catch { /* ignore */ }
      }
      if (ttsSettings.qwenVoiceDescription !== undefined) {
        const v = ttsSettings.qwenVoiceDescription ?? "";
        setQwenVoiceDescriptionState(v);
        qwenVoiceDescriptionRef.current = v;
        try { if (v) localStorage.setItem(QWEN_VOICE_DESC_KEY, v); else localStorage.removeItem(QWEN_VOICE_DESC_KEY); } catch { /* ignore */ }
      }
      if (ttsSettings.refText !== undefined) {
        const v = ttsSettings.refText ?? "";
        setRefTextState(v);
        refTextRef.current = v;
        try { if (v) localStorage.setItem(QWEN_REF_TEXT_KEY, v); else localStorage.removeItem(QWEN_REF_TEXT_KEY); } catch { /* ignore */ }
      }
    }
  }, [ttsSettings]);

  useEffect(() => {
    if (!BROWSER_SPEECH_SUPPORTED) return;

    const loadVoices = () => {
      try {
        const voices = Array.from(window.speechSynthesis.getVoices());
        if (voices.length > 0) {
          setState(prev => ({ ...prev, availableVoices: voices }));
          if (!selectedVoiceName) {
            const preferred = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("samantha"))
              || voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("karen"))
              || voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("victoria"))
              || voices.find(v => v.lang.startsWith("en")) || voices[0];
            if (preferred) setSelectedVoiceState(preferred.name);
          }
        }
      } catch {
        // iOS WebKit may throw during voice list initialization — ignore and continue
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const splitIntoChunks = (text: string, maxLength = 200): string[] => {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    const chunks: string[] = [];
    let currentChunk = "";
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  };

  const speakChunk = useCallback((text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (cancelledRef.current) { reject(new Error("cancelled")); return; }
      if (!BROWSER_SPEECH_SUPPORTED) { reject(new Error("not_supported")); return; }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rateRef.current;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = Array.from(window.speechSynthesis.getVoices());
      let selectedVoice = voiceRef.current ? voices.find(v => v.name === voiceRef.current) : undefined;
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("samantha"))
          || voices.find(v => v.lang.startsWith("en")) || voices[0];
      }
      // iOS WebKit throws Object.getPrototypeOf(voice) if the voice object is stale/detached.
      try {
        if (selectedVoice) utterance.voice = selectedVoice;
      } catch {
        // ignore — proceed with default voice
      }

      utterance.onend = () => cancelledRef.current ? reject(new Error("cancelled")) : resolve();
      utterance.onerror = (e) => {
        if (e.error === "interrupted" || cancelledRef.current) reject(new Error("cancelled"));
        else reject(new Error(e.error));
      };
      utteranceRef.current = utterance;
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        reject(new Error("speech_synthesis_error"));
        return;
      }
    });
  }, []);

  const playServerAudio = useCallback(async (audioData: string, audioFormat: string, speed: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (cancelledRef.current) { reject(new Error("cancelled")); return; }

      let blobUrl: string | null = null;
      try {
        const blob = base64ToBlob(audioData, audioFormat);
        blobUrl = URL.createObjectURL(blob);
      } catch {
        reject(new Error("audio_decode_error"));
        return;
      }

      const audio = new Audio(blobUrl);
      audio.playbackRate = Math.max(0.5, Math.min(4, speed));
      audioRef.current = audio;

      const cleanup = () => {
        if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
      };

      audio.onended = () => {
        audioRef.current = null;
        cleanup();
        resolve();
      };
      audio.onerror = () => {
        audioRef.current = null;
        cleanup();
        reject(new Error("audio_error"));
      };
      audio.onpause = () => {
        if (cancelledRef.current) {
          cleanup();
          reject(new Error("cancelled"));
        }
      };

      audio.play().catch((err) => {
        cleanup();
        reject(err);
      });
    });
  }, []);

  // Returns (or lazily creates) the persistent AudioContext singleton.
  // Must be called during or before a user gesture to ensure iOS allows playback.
  const getAudioCtx = useCallback((): AudioContext | null => {
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      return audioCtxRef.current;
    }
    try {
      const ACtx = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      if (!ACtx) return null;
      audioCtxRef.current = new ACtx();
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const unlockAudio = useCallback(() => {
    // Resume (or create) the persistent AudioContext within the user gesture.
    // Unlike the old approach of creating+closing a temporary context, keeping
    // the context alive means Web Audio API playback works even after a long
    // async WASM synthesis delay — the iOS permission persists with the context.
    try {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      if (!audioUnlockedRef.current) {
        // Play a silent 1-sample buffer to satisfy iOS autoplay policy.
        if (ctx) {
          const src = ctx.createBufferSource();
          src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
          src.connect(ctx.destination);
          src.start(0);
        }
        audioUnlockedRef.current = true;
      }
    } catch {
      // ignore — audio unlock is best-effort
    }
  }, [getAudioCtx]);

  // ── Float32Array → WAV Blob converter (runs on main thread) ─────────────

  function float32ToWav(samples: Float32Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buf = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buf);

    const writeStr = (o: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
    };

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([buf], { type: "audio/wav" });
  }

  // ── Kokoro worker bridge (SharedWorker preferred, DedicatedWorker fallback) ──

  const getWorker = useCallback((): WorkerBridge => {
    if (workerRef.current) return workerRef.current;

    const workerUrl = new URL("../workers/tts.worker.ts", import.meta.url);

    const onMessage = ({ data }: MessageEvent) => {
      const { id, type, samples, sampleRate, message, engine, loadMs: lms, fromCache: fc, percent } = data as {
        id: number;
        type: "ready" | "audio" | "error" | "progress";
        samples?: Float32Array;
        sampleRate?: number;
        message?: string;
        engine?: "webgpu-fp32" | "wasm-q8";
        loadMs?: number;
        fromCache?: boolean;
        percent?: number;
      };

      // Progress broadcasts (id === -1) are not tied to any pending request.
      if (type === "progress") {
        if (percent !== undefined) setKokoroDownloadPercent(percent);
        if ((data as { phase?: string }).phase) {
          setKokoroDownloadPhase((data as { phase: "download" | "compile" }).phase);
        }
        // Passive tabs (not the initiating tab) may receive progress broadcasts
        // before they call ensureKokoroInit. Set loading=true so the progress UI
        // renders immediately on those tabs too.
        if (!workerReadyRef.current) {
          setKokoroLoading(true);
        }
        return;
      }

      const p = pendingRef.current.get(id);
      if (!p) return;
      pendingRef.current.delete(id);

      if (type === "ready") {
        if (engine) setKokoroEngine(engine);
        if (lms !== undefined) setKokoroLoadMs(lms);
        if (fc !== undefined) setKokoroFromCache(fc);
        // Clear download progress and any prior load error now that the model is ready.
        setKokoroDownloadPercent(null);
        setKokoroDownloadPhase(null);
        setKokoroLoadError(null);
        p.resolve(undefined);
      } else if (type === "audio") {
        if (samples && sampleRate) {
          // Convert the raw Float32Array from the worker to a WAV Blob on the main thread.
          const blob = float32ToWav(samples, sampleRate);
          p.resolve(blob);
        } else {
          p.reject(new Error("Worker returned audio with no samples"));
        }
      } else if (type === "error") {
        p.reject(new Error(message || "Worker error"));
      }
    };

    const createDedicatedWorker = (): WorkerBridge => {
      const w = new Worker(workerUrl, { type: "module" });
      w.onmessage = onMessage;
      w.onerror = onError;
      return { postMessage: (data: unknown) => w.postMessage(data) };
    };

    const onError = (event: ErrorEvent) => {
      console.error(`[TTS] Worker error: ${event.message} at ${event.filename}:${event.lineno}`);
      Array.from(pendingRef.current.values()).forEach(p => p.reject(new Error(`Worker error: ${event.message}`)));
      pendingRef.current.clear();
      workerReadyRef.current = false;
      workerReadyPromiseRef.current = null;
      setKokoroReady(false);
      setKokoroLoading(false);
      setKokoroDownloadPercent(null);
      setKokoroDownloadPhase(null);

      if (workerRetryCount.current < 1) {
        workerRetryCount.current++;
        console.log("[TTS] Retrying with DedicatedWorker…");
        try {
          workerRef.current = createDedicatedWorker();
        } catch (e) {
          console.error("[TTS] DedicatedWorker retry failed:", e);
          setKokoroLoadError("Kokoro worker crashed — please refresh the page.");
        }
        return;
      }

      setKokoroLoadError("Kokoro worker crashed — please refresh the page.");
    };

    let bridge: WorkerBridge | null = null;

    if (typeof SharedWorker !== "undefined") {
      try {
        // SharedWorker: one model instance shared across all open tabs.
        // Wrapped in try/catch because some browsers declare SharedWorker but
        // do not support module workers, throwing on construction.
        const sw = new SharedWorker(workerUrl, { type: "module" });
        let gotMessage = false;

        sw.port.onmessage = (e) => { gotMessage = true; onMessage(e); };
        sw.onerror = (e) => { gotMessage = true; onError(e); };
        sw.port.start();

        bridge = { postMessage: (data: unknown) => sw.port.postMessage(data) };

        // Connection timeout: if the port doesn't connect within 3 seconds, fall back to DedicatedWorker.
        setTimeout(() => {
          if (!gotMessage && workerRef.current === bridge) {
            console.debug("[TTS] SharedWorker connection timeout, falling back to DedicatedWorker");
            try { sw.port.close(); } catch { /* ignore */ }
            workerRef.current = null;
          }
        }, 3000);
      } catch (swErr) {
        console.debug("[TTS] SharedWorker unavailable, falling back to Worker:", swErr);
      }
    }

    if (!bridge) {
      bridge = createDedicatedWorker();
    }

    workerRef.current = bridge;
    return bridge;
  }, []);

  // Early Kokoro worker connection: when the selected preset is Kokoro and the
  // worker hasn't been created yet, eagerly connect it so the SharedWorker
  // registers this tab and can broadcast progress events to it even before
  // the user presses Listen.
  useEffect(() => {
    if (serverVoicePreset === "kokoro" && !workerRef.current && !kokoroReady) {
      getWorker();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverVoicePreset, kokoroReady]);

  const ensureKokoroInit = useCallback(async (): Promise<void> => {
    if (workerReadyRef.current) return;
    if (workerReadyPromiseRef.current) return workerReadyPromiseRef.current;

    setKokoroLoading(true);
    // Clear any previous load error so the UI returns to the progress bar state.
    setKokoroLoadError(null);
    workerReadyPromiseRef.current = new Promise<void>((resolve, reject) => {
      const id = ++msgIdRef.current;
      pendingRef.current.set(id, {
        resolve: () => {
          workerReadyRef.current = true;
          setKokoroReady(true);
          setKokoroLoading(false);
          resolve();
        },
        reject: (err) => {
          workerReadyPromiseRef.current = null;
          setKokoroLoading(false);
          setKokoroDownloadPercent(null);
          setKokoroDownloadPhase(null);
          const msg = err instanceof Error ? err.message : "Kokoro failed to load";
          // Mark incompatible for known capability errors so we skip Kokoro on future attempts
          if (msg.includes("lacks WebGPU") || msg.includes("insufficient memory")) {
            setKokoroIncompatible(true);
          }
          // Surface the error so the TTS button can display it.
          setKokoroLoadError(msg);
          reject(err);
        },
      });
      getWorker().postMessage({ id, type: "init" });
    });

    return workerReadyPromiseRef.current;
  }, [getWorker]);

  const kokoroSpeak = useCallback(async (text: string, voice: string): Promise<Blob> => {
    await ensureKokoroInit();
    return new Promise<Blob>((resolve, reject) => {
      const id = ++msgIdRef.current;
      pendingRef.current.set(id, {
        resolve: (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("No audio returned from worker"));
        },
        reject,
      });
      getWorker().postMessage({ id, type: "speak", text, voice });
    });
  }, [ensureKokoroInit, getWorker]);

  // ── Sentence splitter for Kokoro chunking ─────────────────────────────────
  // Splits text at sentence boundaries so each chunk is synthesised and played
  // independently. Users hear audio within seconds rather than waiting for an
  // entire paragraph to be processed by the WASM runtime.
  function splitIntoSentences(text: string): string[] {
    // Split at sentence-ending punctuation followed by whitespace or end of string.
    // Keeps the delimiter with the preceding sentence.
    const raw = text
      .replace(/([.!?;])\s+/g, "$1\n")
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Merge very short fragments (< 20 chars) with the following sentence to
    // avoid generating near-silent audio blobs for things like "Dr." or "e.g.".
    const merged: string[] = [];
    for (const s of raw) {
      if (merged.length > 0 && merged[merged.length - 1].length < 20) {
        merged[merged.length - 1] += " " + s;
      } else {
        merged.push(s);
      }
    }
    return merged.length > 0 ? merged : [text];
  }

  // Wraps kokoroSpeak with a per-chunk synthesis timeout. Uses a generous 90s
  // because the first call also performs the one-time model download + compile.
  const KOKORO_SYNTH_TIMEOUT_MS = 90_000;
  const kokoroSpeakWithTimeout = useCallback(async (text: string, voice: string): Promise<Blob> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error("Kokoro synthesis timed out"));
      }, KOKORO_SYNTH_TIMEOUT_MS);
    });
    try {
      const blob = await Promise.race([kokoroSpeak(text, voice), timeoutPromise]);
      return blob;
    } finally {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    }
  }, [kokoroSpeak]);

  // ── Blob audio player (Web Audio API) ────────────────────────────────────
  // Uses the persistent AudioContext so playback works on iOS even after long
  // async WASM synthesis (the gesture unlock persists with the context lifetime).

  const playBlobAudio = useCallback(async (blob: Blob): Promise<void> => {
    if (cancelledRef.current) throw new Error("cancelled");

    const ctx = getAudioCtx();
    if (!ctx) {
      // Web Audio API unavailable — fall back to HTMLAudioElement
      return new Promise((resolve, reject) => {
        if (cancelledRef.current) { reject(new Error("cancelled")); return; }
        let blobUrl: string | null = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        audio.playbackRate = Math.max(0.5, Math.min(4, rateRef.current));
        audioRef.current = audio;
        const cleanup = () => { if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; } };
        audio.onended = () => { audioRef.current = null; cleanup(); resolve(); };
        audio.onerror = () => { audioRef.current = null; cleanup(); reject(new Error("audio_error")); };
        audio.onpause = () => { if (cancelledRef.current) { cleanup(); reject(new Error("cancelled")); } };
        audio.play().catch((err) => { cleanup(); reject(err); });
      });
    }

    // Resume context if suspended (e.g. browser auto-suspends after inactivity).
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const arrayBuffer = await blob.arrayBuffer();
    if (cancelledRef.current) throw new Error("cancelled");

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    if (cancelledRef.current) throw new Error("cancelled");

    return new Promise<void>((resolve, reject) => {
      if (cancelledRef.current) { reject(new Error("cancelled")); return; }

      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      // Apply playback speed via detune (cents) or playbackRate.
      src.playbackRate.value = Math.max(0.5, Math.min(4, rateRef.current));
      src.connect(ctx.destination);
      audioSrcNodeRef.current = src;

      src.onended = () => {
        audioSrcNodeRef.current = null;
        if (cancelledRef.current) reject(new Error("cancelled"));
        else resolve();
      };

      src.start(0);
    });
  }, [getAudioCtx]);

  // Helper to build the voiceConfig object sent to the server for Qwen TTS.
  // Only include fields that have real values — sending null for unset optionals
  // trips server-side schema validation.
  const getVoiceConfig = useCallback(() => {
    const cfg: Record<string, unknown> = {
      speaker: qwenVoiceRef.current,
      qwenMode: qwenModeRef.current,
    };
    const style = qwenStyleInstructionRef.current?.trim();
    const desc = qwenVoiceDescriptionRef.current?.trim();
    const refText = refTextRef.current?.trim();
    if (style) cfg.qwenStyleInstruction = style;
    if (desc) cfg.qwenVoiceDescription = desc;
    if (refText) cfg.refText = refText;
    return cfg;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  const speak = useCallback(async (text: string, unitId?: number) => {
    if (!text.trim()) return;

    // Unlock iOS audio context synchronously within user gesture before any await
    unlockAudio();

    cancelledRef.current = false;
    setState(prev => ({
      ...prev,
      isLoading: true,
      isPaused: false,
      error: null,
      usingServerTTS: false,
      currentSectionIndex: -1,
      totalSections: 0,
    }));

    const currentPreset = serverVoicePresetRef.current;
    const voiceTier = getVoiceTier(currentPreset);
    // Wait for browser voices to load (fixes Chrome/Android async voice population)
    const browserVoices = await waitForBrowserVoices();
    const noVoicesAvailable = browserVoices.length === 0;
    // Server TTS is the ultimate fallback; browser TTS is preferred when Kokoro/cloud fail.
    const shouldTryServer = currentPreset !== "browser" || !BROWSER_SPEECH_SUPPORTED || noVoicesAvailable;

    /** Helper: speak via Browser TTS */
    const speakViaBrowser = async (txt: string) => {
      if (!BROWSER_SPEECH_SUPPORTED || noVoicesAvailable) return false;
      if (BROWSER_SPEECH_SUPPORTED) window.speechSynthesis.cancel();
      chunksRef.current = splitIntoChunks(txt);
      currentChunkRef.current = 0;
      setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: false }));
      for (let i = 0; i < chunksRef.current.length; i++) {
        if (cancelledRef.current) break;
        currentChunkRef.current = i;
        setState(prev => ({ ...prev, progress: Math.round(((i + 1) / chunksRef.current.length) * 100) }));
        await speakChunk(chunksRef.current[i]);
      }
      if (!cancelledRef.current) {
        setState(prev => ({ ...prev, isSpeaking: false, progress: 100 }));
      }
      return true;
    };

    /** Helper: try server TTS */
    const speakViaServer = async (txt: string, uid?: number, vcfg?: object): Promise<boolean> => {
      if (uid) {
        let isCached = false;
        try {
          const statusRes = await fetch(`/api/tts/cache-status/${uid}`, { credentials: "include" });
          if (statusRes.ok) {
            const statusData = await statusRes.json() as { cached: boolean };
            isCached = statusData.cached === true;
          }
        } catch { /* ignore — treat as uncached */ }

        if (isCached) {
          const serverResult = await fetchServerTTSAudio(uid, vcfg);
          if (serverResult && !cancelledRef.current) {
            setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
            try {
              await playServerAudio(serverResult.audioData, serverResult.audioFormat, serverResult.playbackSpeed || rate);
              if (!cancelledRef.current) setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
              return true;
            } catch (audioErr: unknown) {
              if (audioErr instanceof Error && audioErr.message === "cancelled") throw audioErr;
            }
          }
        } else {
          const introResult = await fetchServerTTSIntro(uid, vcfg);

          if (introResult && !cancelledRef.current) {
            const { restText } = introResult;
            const restPromise = restText ? fetchServerTTSText(restText, vcfg) : Promise.resolve(null);
            setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
            try {
              await playServerAudio(introResult.audioData, introResult.audioFormat, introResult.playbackSpeed || rate);
              if (!cancelledRef.current && restText) {
                const restResult = await restPromise;
                if (restResult && !cancelledRef.current) {
                  await playServerAudio(restResult.audioData, restResult.audioFormat, restResult.playbackSpeed || rate);
                }
              }
              if (!cancelledRef.current) {
                setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
                queryClient.invalidateQueries({ queryKey: [`/api/tts/cache-status/${uid}`] });
              }
              return true;
            } catch (audioErr: unknown) {
              if (audioErr instanceof Error && audioErr.message === "cancelled") throw audioErr;
            }
          } else if (!introResult) {
            const serverResult = await fetchServerTTSAudio(uid, vcfg);
            if (serverResult && !cancelledRef.current) {
              setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
              try {
                await playServerAudio(serverResult.audioData, serverResult.audioFormat, serverResult.playbackSpeed || rate);
                if (!cancelledRef.current) setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
                return true;
              } catch (audioErr: unknown) {
                if (audioErr instanceof Error && audioErr.message === "cancelled") throw audioErr;
              }
            }
          }
        }
      } else {
        const serverResult = await fetchServerTTSText(txt, vcfg);
        if (serverResult && !cancelledRef.current) {
          setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
          try {
            await playServerAudio(serverResult.audioData, serverResult.audioFormat, serverResult.playbackSpeed || rate);
            if (!cancelledRef.current) setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
            return true;
          } catch (audioErr: unknown) {
            if (audioErr instanceof Error && audioErr.message === "cancelled") throw audioErr;
          }
        }
      }
      return false;
    };

    try {
      // ── Tier 1: Local Kokoro (offline-capable, free) ────────────────────────
      // Load on-demand here (kokoroSpeak → ensureKokoroInit) rather than gating
      // behind `kokoroReady`. The ready-gate deadlocked first-time use — the model
      // never initialized, so it always fell through to browser TTS (which fails
      // on devices with no system speech voices).
      if (voiceTier === "local" && !kokoroIncompatibleRef.current) {
        let kokoroDone = false;
        try {
          const sentences = splitIntoSentences(text);
          setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: false }));

          let nextBlobPromise: Promise<Blob> | null = null;
          if (sentences.length > 0) {
            nextBlobPromise = kokoroSpeakWithTimeout(sentences[0], kokoroVoiceRef.current);
          }

          for (let si = 0; si < sentences.length; si++) {
            if (cancelledRef.current) break;
            const blob = await nextBlobPromise;
            if (si + 1 < sentences.length && !cancelledRef.current) {
              nextBlobPromise = kokoroSpeakWithTimeout(sentences[si + 1], kokoroVoiceRef.current);
            }
            if (!blob || cancelledRef.current) break;
            await playBlobAudio(blob);
          }
          if (!cancelledRef.current) setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
          kokoroDone = true;
          return;
        } catch (kokoroErr) {
          if (kokoroErr instanceof Error && kokoroErr.message === "cancelled") return;
          console.warn("[TTS] Kokoro local failed:", kokoroErr);
        }

        // Fallback: fall through to browser TTS (free and instant)
      }

      // ── Tier 2: Server Qwen TTS (qwen / custom presets) ────────────────────
      if (voiceTier === "cloud") {
        try {
          const vcfg = getVoiceConfig();
          if (await speakViaServer(text, unitId, vcfg)) return;
        } catch (cloudErr) {
          if (cloudErr instanceof Error && cloudErr.message === "cancelled") return;
          if (cloudErr instanceof HfTokenRequiredError) {
            toast({
              title: "Hugging Face token required",
              description: cloudErr.serverMessage,
            });
          } else {
            console.warn("[TTS] Server Qwen TTS failed, falling back to browser:", cloudErr);
          }
        }
        // Fall through to browser TTS
      }

      // ── Tier 3: Browser TTS (free, instant, works on nearly every device) ──
      if (await speakViaBrowser(text)) return;

      // ── Tier 4: Server fallback (last resort) ─────────────────────────────
      if (shouldTryServer) {
        if (await speakViaServer(text, unitId)) return;
      }

      // Nothing worked
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSpeaking: false,
        isPaused: false,
        error: noVoicesAvailable
          ? "No device voices found. Select an AI voice preset (Settings → Voice) to enable audio."
          : "Audio unavailable. Choose an AI voice preset in settings to enable audio on this device.",
        isSupported: true,
      }));
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "cancelled") return;
      // Browser TTS failure codes that warrant a server TTS retry.
      const BROWSER_TTS_FAILURES = new Set([
        "speech_synthesis_error", "synthesis-failed", "synthesis-unavailable",
        "audio-hardware", "network",
      ]);
      if (error instanceof Error && BROWSER_TTS_FAILURES.has(error.message)) {
        try {
          if (await speakViaServer(text, unitId)) return;
        } catch { /* server TTS also failed — fall through to error state */ }
      }
      console.error("TTS error:", error);
      setState(prev => ({ ...prev, isLoading: false, isSpeaking: false, isPaused: false, usingServerTTS: false, error: error instanceof Error ? error.message : "TTS failed" }));
    }
  }, [serverVoicePreset, rate, speakChunk, playServerAudio, unlockAudio, kokoroSpeakWithTimeout, playBlobAudio, getVoiceConfig, kokoroReady]);

  // Section-aware speaking: speaks sections sequentially starting from startIndex.
  // Pre-fetches the next section's audio while the current section plays to minimize gaps.
  const speakSections = useCallback(async (sections: TTSSection[], startIndex = 0) => {
    if (sections.length === 0) return;

    // Unlock iOS audio context synchronously within user gesture before any await
    unlockAudio();

    // Cancel any currently running playback before starting new section sequence
    cancelledRef.current = true;
    if (BROWSER_SPEECH_SUPPORTED) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (audioSrcNodeRef.current) {
      try { audioSrcNodeRef.current.stop(); } catch { /* ignore */ }
      audioSrcNodeRef.current = null;
    }
    // Yield one tick so pending promise rejections from old playback settle
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    cancelledRef.current = false;
    const start = Math.max(0, Math.min(startIndex, sections.length - 1));

    setState(prev => ({
      ...prev,
      isLoading: true,
      isPaused: false,
      error: null,
      usingServerTTS: false,
      currentSectionIndex: start,
      totalSections: sections.length,
    }));

    const currentPreset = serverVoicePresetRef.current;
    const voiceTier = getVoiceTier(currentPreset);
    const browserVoices = await waitForBrowserVoices();
    const noVoicesAvailable = browserVoices.length === 0;
    const shouldTryServer = currentPreset !== "browser" || !BROWSER_SPEECH_SUPPORTED || noVoicesAvailable;

    /** Helper: speak one section via Browser TTS */
    const speakSectionViaBrowser = async (txt: string, isFirst: boolean) => {
      if (!BROWSER_SPEECH_SUPPORTED || noVoicesAvailable) return false;
      setState(prev => ({ ...prev, usingServerTTS: false }));
      if (isFirst) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
      const chunks = splitIntoChunks(txt);
      for (const chunk of chunks) {
        if (cancelledRef.current) break;
        await speakChunk(chunk);
      }
      return true;
    };

    try {
      setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0 }));

      // Pre-fetch next section's audio while the current one plays (server path only).
      let nextFetch: Promise<{ audioData: string; audioFormat: string; playbackSpeed: number } | null> | null = null;

      for (let i = start; i < sections.length; i++) {
        if (cancelledRef.current) break;

        setState(prev => ({
          ...prev,
          currentSectionIndex: i,
          progress: Math.round((i / sections.length) * 100),
        }));

        const sectionText = sections[i].text;

        // ── Tier 1: Local Kokoro (offline-capable) ───────────────────────────
        if (voiceTier === "local" && !kokoroIncompatibleRef.current) {
          let kokoroDone = false;
          try {
            const sentences = splitIntoSentences(sectionText);
            setState(prev => ({ ...prev, usingServerTTS: false }));

            let nextBlobPromise: Promise<Blob> | null = null;
            if (sentences.length > 0) {
              nextBlobPromise = kokoroSpeakWithTimeout(sentences[0], kokoroVoiceRef.current);
            }

            for (let si = 0; si < sentences.length; si++) {
              if (cancelledRef.current) break;
              const blob = await nextBlobPromise;
              if (si + 1 < sentences.length && !cancelledRef.current) {
                nextBlobPromise = kokoroSpeakWithTimeout(sentences[si + 1], kokoroVoiceRef.current);
              }
              if (!blob || cancelledRef.current) break;
              await playBlobAudio(blob);
            }
            kokoroDone = !cancelledRef.current;
          } catch (kokoroErr) {
            if (kokoroErr instanceof Error && kokoroErr.message === "cancelled") return;
            console.warn("[TTS sections] Kokoro failed for section", i, ":", kokoroErr);
          }
          if (kokoroDone) continue;

          // Fall through to browser TTS
        }

        // ── Tier 2: Server Qwen TTS (cloud presets) ───────────────────────
        if (voiceTier === "cloud") {
          try {
            const vcfg = getVoiceConfig();
            let result: { audioData: string; audioFormat: string; playbackSpeed: number } | null;

            if (nextFetch !== null) {
              result = await nextFetch;
              nextFetch = null;
            } else {
              result = await fetchServerTTSText(sectionText, vcfg);
            }

            // Pre-fetch next section while playing this one
            if (i + 1 < sections.length && !cancelledRef.current) {
              nextFetch = fetchServerTTSText(sections[i + 1].text, vcfg);
            }

            if (result && !cancelledRef.current) {
              setState(prev => ({ ...prev, usingServerTTS: true }));
              try {
                await playServerAudio(result.audioData, result.audioFormat, result.playbackSpeed || rate);
                continue;
              } catch (audioErr: unknown) {
                if (audioErr instanceof Error && audioErr.message === "cancelled") return;
                // Server audio failed — nothing left to try
                setState(prev => ({
                  ...prev, isLoading: false, isSpeaking: false, isPaused: false,
                  usingServerTTS: false,
                  error: "Audio unavailable. Choose an AI voice preset in settings.",
                }));
                return;
              }
            }
          } catch (cloudErr) {
            if (cloudErr instanceof Error && cloudErr.message === "cancelled") return;
            if (cloudErr instanceof HfTokenRequiredError) {
              toast({
                title: "Hugging Face token required",
                description: cloudErr.serverMessage,
              });
            } else {
              console.warn("[TTS sections] Server Qwen failed for section", i, ":", cloudErr);
            }
          }
          // Fall through to browser TTS
        }

        // ── Tier 3: Browser TTS (free, instant) ───────────────────────────
        if (await speakSectionViaBrowser(sectionText, i === start)) continue;

        // ── Tier 4: Server fallback (last resort) ───────────────────────────
        if (shouldTryServer && voiceTier !== "cloud") {
          let result: { audioData: string; audioFormat: string; playbackSpeed: number } | null;

          if (nextFetch !== null) {
            result = await nextFetch;
            nextFetch = null;
          } else {
            result = await fetchServerTTSText(sectionText);
          }

          // Pre-fetch next section while playing this one
          if (i + 1 < sections.length && !cancelledRef.current) {
            nextFetch = fetchServerTTSText(sections[i + 1].text);
          }

          if (result && !cancelledRef.current) {
            setState(prev => ({ ...prev, usingServerTTS: true }));
            try {
              await playServerAudio(result.audioData, result.audioFormat, result.playbackSpeed || rate);
            } catch (audioErr: unknown) {
              if (audioErr instanceof Error && audioErr.message === "cancelled") return;
              // Server audio failed — nothing left to try
              setState(prev => ({
                ...prev, isLoading: false, isSpeaking: false, isPaused: false,
                usingServerTTS: false,
                error: "Audio unavailable. Choose an AI voice preset in settings.",
              }));
              return;
            }
          } else if (!cancelledRef.current) {
            setState(prev => ({
              ...prev, isLoading: false, isSpeaking: false, isPaused: false,
              usingServerTTS: false,
              error: noVoicesAvailable
                ? "No device voices found. Select an AI voice preset (Settings → Voice) to enable audio."
                : "Audio unavailable. Choose an AI voice preset in settings.",
            }));
            return;
          }
        } else {
          setState(prev => ({
            ...prev, isLoading: false, isSpeaking: false, isPaused: false,
            usingServerTTS: false,
            error: "Audio unavailable. Choose an AI voice preset in settings.",
          }));
          return;
        }
      }

      if (!cancelledRef.current) {
        setState(prev => ({
          ...prev,
          isSpeaking: false,
          progress: 100,
          usingServerTTS: false,
          currentSectionIndex: -1,
          totalSections: 0,
        }));
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "cancelled") return;
      console.error("TTS sections error:", error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSpeaking: false,
        isPaused: false,
        usingServerTTS: false,
        error: error instanceof Error ? error.message : "TTS failed",
        currentSectionIndex: -1,
        totalSections: 0,
      }));
    }
  }, [serverVoicePreset, rate, speakChunk, playServerAudio, unlockAudio, kokoroSpeakWithTimeout, playBlobAudio, getVoiceConfig, kokoroReady]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (BROWSER_SPEECH_SUPPORTED) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // Stop any in-progress Web Audio API playback.
    if (audioSrcNodeRef.current) {
      try { audioSrcNodeRef.current.stop(); } catch { /* ignore — already stopped */ }
      audioSrcNodeRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isSpeaking: false,
      isPaused: false,
      isLoading: false,
      usingServerTTS: false,
      currentSectionIndex: -1,
      totalSections: 0,
    }));
  }, []);

  // pause: suspend playback without cancelling the session.
  // isSpeaking stays true so the async loop continues to wait on the audio element.
  // isPaused flag is set true so UI knows we're in a paused-but-active state.
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    } else if (audioCtxRef.current && audioCtxRef.current.state === "running") {
      // Suspend the Web Audio context — pauses AudioBufferSourceNode playback.
      audioCtxRef.current.suspend().catch(() => {});
    } else if (BROWSER_SPEECH_SUPPORTED) {
      try { window.speechSynthesis.pause(); } catch { /* ignore */ }
    }
    setState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(console.error);
    } else if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      // Resume the Web Audio context to continue AudioBufferSourceNode playback.
      audioCtxRef.current.resume().catch(console.error);
    } else if (BROWSER_SPEECH_SUPPORTED) {
      try { window.speechSynthesis.resume(); } catch { /* ignore */ }
    }
    setState(prev => ({ ...prev, isPaused: false }));
  }, []);

  const persistSpeedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setRate = useCallback((newRate: number) => {
    const clamped = Math.max(0.5, Math.min(3, newRate));
    setRateState(clamped);
    if (audioRef.current) audioRef.current.playbackRate = clamped;
    if (persistSpeedTimerRef.current) clearTimeout(persistSpeedTimerRef.current);
    persistSpeedTimerRef.current = setTimeout(() => {
      fetch("/api/tts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ playbackSpeed: clamped }),
      }).catch(e => console.warn("Failed to persist TTS speed:", e));
    }, 600);
  }, []);

  const setSelectedVoice = useCallback((voiceName: string) => {
    setSelectedVoiceState(voiceName);
  }, []);

  const setServerVoicePreset = useCallback(async (preset: string) => {
    // Update ref synchronously so speak/speakSections immediately see the new engine
    // even if called before the React re-render completes.
    serverVoicePresetRef.current = preset;
    setServerVoicePresetState(preset);
    try {
      localStorage.setItem("tts_engine_pinned", "1");
    } catch { /* ignore */ }
    try {
      await fetch("/api/tts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ voicePreset: preset, playbackSpeed: rate }),
      });
    } catch (e) {
      console.warn("Failed to save TTS preset:", e);
    }
  }, [rate]);

  const isAudioCached = useCallback(async (unitId: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/tts/cache-status/${unitId}`, { credentials: "include" });
      const data = await res.json();
      return data.cached === true;
    } catch {
      return false;
    }
  }, []);

  const setKokoroVoice = useCallback((voiceId: string) => {
    setKokoroVoiceState(voiceId);
    kokoroVoiceRef.current = voiceId;
    try { localStorage.setItem(KOKORO_VOICE_KEY, voiceId); } catch { /* ignore */ }
  }, []);

  const setQwenVoice = useCallback((voiceId: string) => {
    setQwenVoiceState(voiceId);
    qwenVoiceRef.current = voiceId;
    try { localStorage.setItem(QWEN_VOICE_KEY, voiceId); } catch { /* ignore */ }
  }, []);

  const setQwenMode = useCallback((mode: QwenMode) => {
    setQwenModeState(mode);
    qwenModeRef.current = mode;
    try { localStorage.setItem(QWEN_MODE_KEY, mode); } catch { /* ignore */ }
    fetch("/api/tts/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ qwenMode: mode }),
    }).catch(() => {});
  }, []);

  const setQwenStyleInstruction = useCallback((text: string) => {
    const trimmed = text.slice(0, 500);
    setQwenStyleInstructionState(trimmed);
    qwenStyleInstructionRef.current = trimmed;
    try { if (trimmed) localStorage.setItem(QWEN_STYLE_KEY, trimmed); else localStorage.removeItem(QWEN_STYLE_KEY); } catch { /* ignore */ }
    fetch("/api/tts/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ qwenStyleInstruction: trimmed }),
    }).catch(() => {});
  }, []);

  const setQwenVoiceDescription = useCallback((text: string) => {
    const trimmed = text.slice(0, 500);
    setQwenVoiceDescriptionState(trimmed);
    qwenVoiceDescriptionRef.current = trimmed;
    try { if (trimmed) localStorage.setItem(QWEN_VOICE_DESC_KEY, trimmed); else localStorage.removeItem(QWEN_VOICE_DESC_KEY); } catch { /* ignore */ }
    fetch("/api/tts/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ qwenVoiceDescription: trimmed }),
    }).catch(() => {});
  }, []);

  const setRefText = useCallback((text: string) => {
    const trimmed = text.slice(0, 1000);
    setRefTextState(trimmed);
    refTextRef.current = trimmed;
    try { if (trimmed) localStorage.setItem(QWEN_REF_TEXT_KEY, trimmed); else localStorage.removeItem(QWEN_REF_TEXT_KEY); } catch { /* ignore */ }
    fetch("/api/tts/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refText: trimmed }),
    }).catch(() => {});
  }, []);

  return {
    ...state,
    speak,
    speakSections,
    stop,
    pause,
    resume,
    setRate,
    setSelectedVoice,
    rate,
    selectedVoiceName,
    serverVoicePreset,
    setServerVoicePreset,
    isAudioCached,
    kokoroReady,
    kokoroLoading,
    kokoroDownloadPercent,
    kokoroDownloadPhase,
    kokoroLoadError,
    kokoroDeviceWarning,
    kokoroEngine,
    kokoroLoadMs,
    kokoroFromCache,
    kokoroIncompatible,
    kokoroVoice,
    setKokoroVoice,
    qwenVoice,
    setQwenVoice,
    qwenMode,
    setQwenMode,
    qwenStyleInstruction,
    setQwenStyleInstruction,
    qwenVoiceDescription,
    setQwenVoiceDescription,
    refText,
    setRefText,
  };
}

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const tts = useTTSImpl();
  return <TTSContext.Provider value={tts}>{children}</TTSContext.Provider>;
}

export function useTTS(): UseTTSReturn {
  const ctx = useContext(TTSContext);
  if (!ctx) throw new Error("useTTS must be used within TTSProvider");
  return ctx;
}
