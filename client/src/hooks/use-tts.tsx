import { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  KOKORO_VOICES,
  KOKORO_DEFAULT_VOICE,
  QWEN_DEFAULT_VOICE,
  QWEN_VOICES,
  getVoiceTier,
  cleanTextForTTS,
} from "@/lib/tts-constants";
import type { QwenMode } from "@/lib/tts-constants";
import { useToast } from "@/hooks/use-toast";

// localStorage keys used by the TTS engine
const PRESET_STORAGE_KEY = "tts_voice_preset";
const SPEED_STORAGE_KEY = "tts_playback_speed";
const BROWSER_VOICE_KEY = "tts_browser_voice";
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
  currentSectionLabel: string | null;
}

interface UseTTSReturn extends TTSState {
  speak: (text: string, unitId?: number) => Promise<void>;
  speakSections: (sections: TTSSection[], startIndex?: number) => Promise<void>;
  jumpToSection: (index: number) => void;
  nextSection: () => void;
  prevSection: () => void;
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
  kokoroDeviceWarning: string | null;
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

/**
 * Wait briefly (default 300ms) for browser voices to populate without losing
 * transient user-gesture activation on Safari/mobile Chrome.
 */
async function waitForBrowserVoices(timeoutMs = 300): Promise<SpeechSynthesisVoice[]> {
  if (!BROWSER_SPEECH_SUPPORTED) return [];
  try {
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    if (voices.length > 0) return voices;
    return await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        synth.removeEventListener("voiceschanged", handler);
        try {
          resolve(synth.getVoices());
        } catch {
          resolve([]);
        }
      };
      const handler = () => finish();
      synth.addEventListener("voiceschanged", handler);
      setTimeout(finish, timeoutMs);
    });
  } catch {
    return [];
  }
}

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
    currentSectionLabel: null,
  });

  const [rate, setRateState] = useState<number>(() => {
    try {
      const stored = parseFloat(localStorage.getItem(SPEED_STORAGE_KEY) || "");
      if (!isNaN(stored) && stored >= 0.5 && stored <= 3) return stored;
    } catch { /* ignore */ }
    return 1.0;
  });

  const [selectedVoiceName, setSelectedVoiceState] = useState<string | null>(() => {
    try { return localStorage.getItem(BROWSER_VOICE_KEY) || null; } catch { return null; }
  });

  const [serverVoicePreset, setServerVoicePresetState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(PRESET_STORAGE_KEY);
      if (stored === "kokoro" || stored === "browser" || stored === "qwen" || stored === "custom") {
        return stored;
      }
    } catch { /* ignore */ }
    return "kokoro";
  });

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
  const [kokoroLoadError, setKokoroLoadError] = useState<string | null>(null);

  const [kokoroDeviceWarning] = useState<string | null>(() => {
    if (typeof navigator === "undefined") return null;
    const ua = (navigator.userAgent || "").toLowerCase();
    if (ua.includes("tesla") || ua.includes("qtcarbrowser")) {
      return "Tesla browser: local TTS may not work. Use Browser TTS or Qwen Cloud.";
    }
    const mem = (navigator as any).deviceMemory;
    if (typeof mem === "number" && mem < 2) {
      return `Device has ~${mem}GB RAM. Local TTS may fail. Use Browser TTS or Qwen Cloud.`;
    }
    if (typeof (navigator as any).gpu === "undefined") {
      if (ua.includes("iphone") && (ua.includes("os 12_") || ua.includes("os 13_") || ua.includes("os 14_"))) {
        return "Older iOS detected — local TTS may not work. Use Browser TTS or Qwen Cloud.";
      }
    }
    return null;
  });

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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSrcNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chunksRef = useRef<string[]>([]);
  const currentChunkRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);
  const runIdRef = useRef<number>(0);
  const activeSectionsRef = useRef<TTSSection[]>([]);
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
  const browserFallbackNotifiedRef = useRef<boolean>(false);
  const serverVoicePresetRef = useRef<string>(serverVoicePreset);

  // Kokoro DedicatedWorker bridge
  type WorkerBridge = { postMessage: (data: unknown) => void; terminate?: () => void };
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
      const LEGACY_QWEN = new Set(["aria", "nova", "echo", "onyx", "fable", "shimmer", "lyra", "sage", "orion"]);
      const normalized = LEGACY_QWEN.has(raw) ? "qwen" : raw;
      serverVoicePresetRef.current = normalized;
      setServerVoicePresetState(normalized);
      try { localStorage.setItem(PRESET_STORAGE_KEY, normalized); } catch { /* ignore */ }

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
      if (normalized !== raw) {
        fetch("/api/tts/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ voicePreset: normalized }),
        }).catch(() => {});
      }
      if (ttsSettings.playbackSpeed) {
        setRateState(ttsSettings.playbackSpeed);
        rateRef.current = ttsSettings.playbackSpeed;
        try { localStorage.setItem(SPEED_STORAGE_KEY, String(ttsSettings.playbackSpeed)); } catch { /* ignore */ }
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
          if (!voiceRef.current || !voices.some(v => v.name === voiceRef.current)) {
            const preferred =
              voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("natural")) ||
              voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("google")) ||
              voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("samantha")) ||
              voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("karen")) ||
              voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("victoria")) ||
              voices.find(v => v.lang.startsWith("en") && v.default) ||
              voices.find(v => v.lang.startsWith("en")) ||
              voices[0];
            if (preferred) {
              setSelectedVoiceState(preferred.name);
              voiceRef.current = preferred.name;
            }
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

  const splitIntoChunks = (rawText: string, maxLength = 220): string[] => {
    const text = cleanTextForTTS(rawText);
    if (!text) return [];
    const sentences = text.match(/[^.!?;]+[.!?;]+|[^.!?;]+$/g) || [text];
    const chunks: string[] = [];
    let currentChunk = "";
    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;
      if (sentence.length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        // Further split overly long clauses on commas/clauses
        const clauses = sentence.split(/(?<=[,:—])\s+/);
        let clauseBuf = "";
        for (const cl of clauses) {
          if (clauseBuf.length + cl.length + 1 <= maxLength) {
            clauseBuf = clauseBuf ? `${clauseBuf} ${cl}` : cl;
          } else {
            if (clauseBuf) chunks.push(clauseBuf.trim());
            clauseBuf = cl;
          }
        }
        if (clauseBuf) chunks.push(clauseBuf.trim());
        continue;
      }
      if (currentChunk.length + sentence.length + 1 <= maxLength) {
        currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks.filter(c => c.length > 0);
  };

  /**
   * Prepare browser speechSynthesis before starting a fresh utterance sequence.
   * Avoids Chromium's synchronous cancel()+speak() race condition where cancel()
   * flushes the newly-queued utterance or leaves speechSynthesis stuck in paused state.
   */
  const resetBrowserSpeech = useCallback(async () => {
    if (!BROWSER_SPEECH_SUPPORTED) return;
    try {
      const synth = window.speechSynthesis;
      if (synth.speaking || synth.pending || synth.paused) {
        synth.cancel();
        await new Promise<void>(resolve => setTimeout(resolve, 60));
      }
      if (synth.paused) {
        synth.resume();
      }
    } catch {
      // ignore
    }
  }, []);

  const speakChunk = useCallback((text: string, myRunId: number, allowRetry = true): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (cancelledRef.current || runIdRef.current !== myRunId) {
        reject(new Error("cancelled"));
        return;
      }
      if (!BROWSER_SPEECH_SUPPORTED) {
        reject(new Error("not_supported"));
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        resolve();
        return;
      }

      const synth = window.speechSynthesis;
      if (synth.paused) {
        try { synth.resume(); } catch { /* ignore */ }
      }

      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.rate = Math.max(0.5, Math.min(3, rateRef.current));
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.lang = "en-US";

      try {
        const voices = Array.from(synth.getVoices());
        let selectedVoice = voiceRef.current ? voices.find(v => v.name === voiceRef.current) : undefined;
        if (!selectedVoice && voices.length > 0) {
          selectedVoice =
            voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("natural")) ||
            voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("google")) ||
            voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("samantha")) ||
            voices.find(v => v.lang.startsWith("en") && v.default) ||
            voices.find(v => v.lang.startsWith("en")) ||
            voices[0];
        }
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          if (selectedVoice.lang) utterance.lang = selectedVoice.lang;
        }
      } catch {
        // Proceed with browser default voice
      }

      let started = false;
      let settled = false;
      let startWatchdog: ReturnType<typeof setTimeout> | null = null;
      let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

      const cleanupTimers = () => {
        if (startWatchdog) { clearTimeout(startWatchdog); startWatchdog = null; }
        if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
      };

      // Watchdog: on Linux/headless browsers without a functioning speech-dispatcher,
      // speechSynthesis.speak() can silently queue forever without firing onstart/onend/onerror.
      startWatchdog = setTimeout(() => {
        if (settled || started) return;
        if (synth.speaking) {
          started = true;
          return;
        }
        settled = true;
        cleanupTimers();
        try { synth.cancel(); } catch { /* ignore */ }
        reject(new Error("synthesis-unavailable"));
      }, 3000);

      utterance.onstart = () => {
        started = true;
        if (startWatchdog) { clearTimeout(startWatchdog); startWatchdog = null; }
        // Desktop Chrome workaround: utterances >14s can freeze unless nudged.
        keepAliveTimer = setInterval(() => {
          try {
            if (synth.speaking && !synth.paused) {
              synth.pause();
              synth.resume();
            }
          } catch { /* ignore */ }
        }, 10000);
      };

      utterance.onend = () => {
        if (settled) return;
        settled = true;
        cleanupTimers();
        if (cancelledRef.current || runIdRef.current !== myRunId) {
          reject(new Error("cancelled"));
        } else {
          resolve();
        }
      };

      utterance.onerror = (e) => {
        if (settled) return;
        settled = true;
        cleanupTimers();
        if (cancelledRef.current || runIdRef.current !== myRunId) {
          reject(new Error("cancelled"));
          return;
        }
        // If Chromium fired "interrupted" or "canceled" from a prior cancel() race,
        // retry once after a short delay before declaring failure.
        if ((e.error === "interrupted" || e.error === "canceled") && allowRetry) {
          setTimeout(() => {
            speakChunk(trimmed, myRunId, false).then(resolve, reject);
          }, 80);
          return;
        }
        reject(new Error(e.error || "speech_synthesis_error"));
      };

      utteranceRef.current = utterance;
      try {
        synth.speak(utterance);
      } catch {
        settled = true;
        cleanupTimers();
        reject(new Error("speech_synthesis_error"));
      }
    });
  }, []);

  const playServerAudio = useCallback(async (audioData: string, audioFormat: string, speed: number, myRunId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (cancelledRef.current || runIdRef.current !== myRunId) {
        reject(new Error("cancelled"));
        return;
      }

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
        if (cancelledRef.current || runIdRef.current !== myRunId) {
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
    try {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      if (!audioUnlockedRef.current) {
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

  // ── Kokoro DedicatedWorker bridge ─────────────────────────────────────────
  // IMPORTANT: `new Worker(new URL("../workers/tts.worker.ts", import.meta.url), { type: "module" })`
  // MUST be written inline so Vite's static analyzer compiles `tts.worker.ts` and its
  // npm dependencies (`kokoro-js`, `@huggingface/transformers`) into a JS worker bundle
  // rather than copying the raw TypeScript source file into `/assets/*.ts`.

  const getWorker = useCallback((): WorkerBridge => {
    if (workerRef.current) return workerRef.current;

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

      if (type === "progress") {
        if (percent !== undefined) setKokoroDownloadPercent(percent);
        if ((data as { phase?: string }).phase) {
          setKokoroDownloadPhase((data as { phase: "download" | "compile" }).phase);
        }
        if (!workerReadyRef.current) {
          setKokoroLoading(true);
        }
        return;
      }

      if (type === "error" && id === -1) {
        console.error("[TTS] Unhandled worker error:", message);
        return;
      }

      const p = pendingRef.current.get(id);
      if (!p) return;
      pendingRef.current.delete(id);

      if (type === "ready") {
        if (engine) setKokoroEngine(engine);
        if (lms !== undefined) setKokoroLoadMs(lms);
        if (fc !== undefined) setKokoroFromCache(fc);
        setKokoroDownloadPercent(null);
        setKokoroDownloadPhase(null);
        setKokoroLoadError(null);
        p.resolve(undefined);
      } else if (type === "audio") {
        if (engine) setKokoroEngine(engine);
        if (samples && sampleRate) {
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
      const w = new Worker(new URL("../workers/tts.worker.ts", import.meta.url), {
        type: "module",
      });
      w.onmessage = onMessage;
      w.onerror = onError;
      return {
        postMessage: (data: unknown) => w.postMessage(data),
        terminate: () => w.terminate(),
      };
    };

    const onError = (event: ErrorEvent) => {
      const detail = event.message || "Worker script failed to load";
      console.error(`[TTS] Worker error: ${detail} at ${event.filename}:${event.lineno}`);
      Array.from(pendingRef.current.values()).forEach(p => p.reject(new Error(`Worker error: ${detail}`)));
      pendingRef.current.clear();
      workerReadyRef.current = false;
      workerReadyPromiseRef.current = null;
      workerRef.current = null;
      setKokoroReady(false);
      setKokoroLoading(false);
      setKokoroDownloadPercent(null);
      setKokoroDownloadPhase(null);

      if (workerRetryCount.current < 1) {
        workerRetryCount.current++;
        console.log("[TTS] Retrying with fresh DedicatedWorker…");
        try {
          workerRef.current = createDedicatedWorker();
        } catch (e) {
          console.error("[TTS] DedicatedWorker retry failed:", e);
          setKokoroLoadError("Kokoro worker failed to initialize — try Browser TTS or Qwen Cloud.");
        }
        return;
      }

      setKokoroLoadError("Kokoro worker failed to initialize — try Browser TTS or Qwen Cloud.");
    };

    const bridge = createDedicatedWorker();
    workerRef.current = bridge;
    return bridge;
  }, []);

  const ensureKokoroInit = useCallback(async (): Promise<void> => {
    if (workerReadyRef.current) return;
    if (workerReadyPromiseRef.current) return workerReadyPromiseRef.current;

    setKokoroLoading(true);
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
          if (msg.includes("lacks WebGPU") || msg.includes("insufficient memory")) {
            setKokoroIncompatible(true);
          }
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

  function splitIntoSentences(rawText: string): string[] {
    const text = cleanTextForTTS(rawText);
    if (!text) return [];
    const raw = text
      .replace(/([.!?;])\s+/g, "$1\n")
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const merged: string[] = [];
    for (const s of raw) {
      if (merged.length > 0 && merged[merged.length - 1].length < 25) {
        merged[merged.length - 1] += " " + s;
      } else if (s.length > 350) {
        // Split very long sentences at clause boundaries so Kokoro synthesizes quickly
        const parts = s.split(/(?<=[,:—])\s+/);
        let acc = "";
        for (const p of parts) {
          if (acc.length + p.length + 1 <= 280) {
            acc = acc ? `${acc} ${p}` : p;
          } else {
            if (acc) merged.push(acc);
            acc = p;
          }
        }
        if (acc) merged.push(acc);
      } else {
        merged.push(s);
      }
    }
    return merged.length > 0 ? merged : [text];
  }

  const KOKORO_SYNTH_TIMEOUT_MS = 180_000;
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

  const playBlobAudio = useCallback(async (blob: Blob, myRunId: number): Promise<void> => {
    if (cancelledRef.current || runIdRef.current !== myRunId) throw new Error("cancelled");

    const ctx = getAudioCtx();
    if (!ctx) {
      return new Promise((resolve, reject) => {
        if (cancelledRef.current || runIdRef.current !== myRunId) { reject(new Error("cancelled")); return; }
        let blobUrl: string | null = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        audio.playbackRate = Math.max(0.5, Math.min(4, rateRef.current));
        audioRef.current = audio;
        const cleanup = () => { if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; } };
        audio.onended = () => { audioRef.current = null; cleanup(); resolve(); };
        audio.onerror = () => { audioRef.current = null; cleanup(); reject(new Error("audio_error")); };
        audio.onpause = () => {
          if (cancelledRef.current || runIdRef.current !== myRunId) {
            cleanup();
            reject(new Error("cancelled"));
          }
        };
        audio.play().catch((err) => { cleanup(); reject(err); });
      });
    }

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const arrayBuffer = await blob.arrayBuffer();
    if (cancelledRef.current || runIdRef.current !== myRunId) throw new Error("cancelled");

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    if (cancelledRef.current || runIdRef.current !== myRunId) throw new Error("cancelled");

    return new Promise<void>((resolve, reject) => {
      if (cancelledRef.current || runIdRef.current !== myRunId) { reject(new Error("cancelled")); return; }

      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.playbackRate.value = Math.max(0.5, Math.min(4, rateRef.current));
      src.connect(ctx.destination);
      audioSrcNodeRef.current = src;

      src.onended = () => {
        audioSrcNodeRef.current = null;
        if (cancelledRef.current || runIdRef.current !== myRunId) reject(new Error("cancelled"));
        else resolve();
      };

      src.start(0);
    });
  }, [getAudioCtx]);

  const getVoiceConfig = useCallback((overridePreset?: string) => {
    const cfg: Record<string, unknown> = {
      speaker: qwenVoiceRef.current,
      qwenMode: qwenModeRef.current,
    };
    if (overridePreset) {
      cfg.preset = overridePreset;
    }
    const style = qwenStyleInstructionRef.current?.trim();
    const desc = qwenVoiceDescriptionRef.current?.trim();
    const refText = refTextRef.current?.trim();
    if (style) cfg.qwenStyleInstruction = style;
    if (desc) cfg.qwenVoiceDescription = desc;
    if (refText) cfg.refText = refText;
    return cfg;
  }, []);

  /** Stop any currently active audio element, Web Audio buffer, or SpeechSynthesis utterance. */
  const cancelActivePlayback = useCallback(() => {
    cancelledRef.current = true;
    if (BROWSER_SPEECH_SUPPORTED) {
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending || window.speechSynthesis.paused) {
          window.speechSynthesis.cancel();
        }
      } catch { /* ignore */ }
    }
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* ignore */ }
      audioRef.current = null;
    }
    if (audioSrcNodeRef.current) {
      try { audioSrcNodeRef.current.stop(); } catch { /* ignore */ }
      audioSrcNodeRef.current = null;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  const speak = useCallback(async (rawText: string, unitId?: number) => {
    const text = cleanTextForTTS(rawText);
    if (!text) return;

    unlockAudio();
    cancelActivePlayback();
    const myRunId = ++runIdRef.current;
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (runIdRef.current !== myRunId) return;

    cancelledRef.current = false;
    activeSectionsRef.current = [];
    setState(prev => ({
      ...prev,
      isLoading: true,
      isSpeaking: false,
      isPaused: false,
      error: null,
      usingServerTTS: false,
      currentSectionIndex: -1,
      totalSections: 0,
      currentSectionLabel: null,
    }));

    const currentPreset = serverVoicePresetRef.current;
    const voiceTier = getVoiceTier(currentPreset);

    /** Helper: speak via local Kokoro (WebGPU / WASM) */
    const speakViaKokoro = async (txt: string): Promise<boolean> => {
      if (kokoroIncompatibleRef.current) return false;
      try {
        const sentences = splitIntoSentences(txt);
        if (sentences.length === 0) return false;

        let nextBlobPromise: Promise<Blob> | null = kokoroSpeakWithTimeout(sentences[0], kokoroVoiceRef.current);

        for (let si = 0; si < sentences.length; si++) {
          if (cancelledRef.current || runIdRef.current !== myRunId) return true;
          const blob = await nextBlobPromise;
          if (si + 1 < sentences.length && !cancelledRef.current && runIdRef.current === myRunId) {
            nextBlobPromise = kokoroSpeakWithTimeout(sentences[si + 1], kokoroVoiceRef.current);
          }
          if (!blob || cancelledRef.current || runIdRef.current !== myRunId) return true;
          setState(prev => ({
            ...prev,
            isLoading: false,
            isSpeaking: true,
            usingServerTTS: false,
            progress: Math.round(((si + 1) / sentences.length) * 100),
          }));
          await playBlobAudio(blob, myRunId);
        }
        if (!cancelledRef.current && runIdRef.current === myRunId) {
          setState(prev => ({ ...prev, isLoading: false, isSpeaking: false, progress: 100, usingServerTTS: false }));
        }
        return true;
      } catch (kokoroErr) {
        if (kokoroErr instanceof Error && kokoroErr.message === "cancelled") return true;
        console.warn("[TTS] Kokoro local failed:", kokoroErr);
        return false;
      }
    };

    /** Helper: speak via Browser TTS */
    const speakViaBrowser = async (txt: string): Promise<boolean> => {
      if (!BROWSER_SPEECH_SUPPORTED) return false;
      await waitForBrowserVoices(300);
      if (cancelledRef.current || runIdRef.current !== myRunId) return true;
      await resetBrowserSpeech();
      const chunks = splitIntoChunks(txt);
      if (chunks.length === 0) return false;
      chunksRef.current = chunks;
      currentChunkRef.current = 0;
      setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: false }));
      try {
        for (let i = 0; i < chunks.length; i++) {
          if (cancelledRef.current || runIdRef.current !== myRunId) return true;
          currentChunkRef.current = i;
          setState(prev => ({ ...prev, progress: Math.round(((i + 1) / chunks.length) * 100) }));
          await speakChunk(chunks[i], myRunId);
        }
        if (!cancelledRef.current && runIdRef.current === myRunId) {
          setState(prev => ({ ...prev, isLoading: false, isSpeaking: false, progress: 100 }));
        }
        return true;
      } catch (browserErr) {
        if (browserErr instanceof Error && browserErr.message === "cancelled") return true;
        console.warn("[TTS] Browser speech failed:", browserErr);
        return false;
      }
    };

    /** Helper: try server TTS (Qwen / OpenAI fallback) */
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
          if (serverResult && !cancelledRef.current && runIdRef.current === myRunId) {
            setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
            try {
              await playServerAudio(serverResult.audioData, serverResult.audioFormat, serverResult.playbackSpeed || rateRef.current, myRunId);
              if (!cancelledRef.current && runIdRef.current === myRunId) {
                setState(prev => ({ ...prev, isLoading: false, isSpeaking: false, progress: 100, usingServerTTS: false }));
              }
              return true;
            } catch (audioErr: unknown) {
              if (audioErr instanceof Error && audioErr.message === "cancelled") return true;
            }
          }
        } else {
          const introResult = await fetchServerTTSIntro(uid, vcfg);
          if (introResult && !cancelledRef.current && runIdRef.current === myRunId) {
            const { restText } = introResult;
            const cleanedRest = restText ? cleanTextForTTS(restText) : null;
            const restPromise = cleanedRest ? fetchServerTTSText(cleanedRest, vcfg) : Promise.resolve(null);
            setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 25, usingServerTTS: true }));
            try {
              await playServerAudio(introResult.audioData, introResult.audioFormat, introResult.playbackSpeed || rateRef.current, myRunId);
              if (!cancelledRef.current && runIdRef.current === myRunId && cleanedRest) {
                setState(prev => ({ ...prev, progress: 65 }));
                const restResult = await restPromise;
                if (restResult && !cancelledRef.current && runIdRef.current === myRunId) {
                  await playServerAudio(restResult.audioData, restResult.audioFormat, restResult.playbackSpeed || rateRef.current, myRunId);
                }
              }
              if (!cancelledRef.current && runIdRef.current === myRunId) {
                setState(prev => ({ ...prev, isLoading: false, isSpeaking: false, progress: 100, usingServerTTS: false }));
                queryClient.invalidateQueries({ queryKey: [`/api/tts/cache-status/${uid}`] });
              }
              return true;
            } catch (audioErr: unknown) {
              if (audioErr instanceof Error && audioErr.message === "cancelled") return true;
            }
          } else if (!introResult) {
            const serverResult = await fetchServerTTSAudio(uid, vcfg);
            if (serverResult && !cancelledRef.current && runIdRef.current === myRunId) {
              setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
              try {
                await playServerAudio(serverResult.audioData, serverResult.audioFormat, serverResult.playbackSpeed || rateRef.current, myRunId);
                if (!cancelledRef.current && runIdRef.current === myRunId) {
                  setState(prev => ({ ...prev, isLoading: false, isSpeaking: false, progress: 100, usingServerTTS: false }));
                }
                return true;
              } catch (audioErr: unknown) {
                if (audioErr instanceof Error && audioErr.message === "cancelled") return true;
              }
            }
          }
        }
      } else {
        const serverResult = await fetchServerTTSText(txt, vcfg);
        if (serverResult && !cancelledRef.current && runIdRef.current === myRunId) {
          setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
          try {
            await playServerAudio(serverResult.audioData, serverResult.audioFormat, serverResult.playbackSpeed || rateRef.current, myRunId);
            if (!cancelledRef.current && runIdRef.current === myRunId) {
              setState(prev => ({ ...prev, isLoading: false, isSpeaking: false, progress: 100, usingServerTTS: false }));
            }
            return true;
          } catch (audioErr: unknown) {
            if (audioErr instanceof Error && audioErr.message === "cancelled") return true;
          }
        }
      }
      return false;
    };

    try {
      // 1. Local Kokoro selected
      if (voiceTier === "local") {
        if (await speakViaKokoro(text)) return;
        if (await speakViaBrowser(text)) return;
        if (await speakViaServer(text, unitId, getVoiceConfig("qwen"))) return;
      }
      // 2. Cloud Qwen selected
      else if (voiceTier === "cloud") {
        try {
          if (await speakViaServer(text, unitId, getVoiceConfig())) return;
        } catch (cloudErr) {
          if (cloudErr instanceof HfTokenRequiredError) {
            toast({
              title: "Hugging Face token required",
              description: cloudErr.serverMessage,
            });
          } else {
            console.warn("[TTS] Server Qwen TTS failed, falling back:", cloudErr);
          }
        }
        if (await speakViaKokoro(text)) return;
        if (await speakViaBrowser(text)) return;
      }
      // 3. Browser TTS selected
      else {
        if (await speakViaBrowser(text)) return;
        // Browser speech unavailable or failed on this OS/browser — fall back to Kokoro or Qwen
        if (!browserFallbackNotifiedRef.current) {
          browserFallbackNotifiedRef.current = true;
          toast({
            title: "Using AI voice fallback",
            description: "Your browser's native speech engine is unavailable on this device — using AI voice synthesis instead.",
          });
        }
        if (await speakViaKokoro(text)) return;
        try {
          if (await speakViaServer(text, unitId, getVoiceConfig("qwen"))) return;
        } catch { /* ignore */ }
      }

      if (cancelledRef.current || runIdRef.current !== myRunId) return;
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSpeaking: false,
        isPaused: false,
        error: "Audio unavailable. Try selecting Kokoro (Offline) or Qwen TTS in Voice Settings.",
        isSupported: true,
      }));
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "cancelled") return;
      console.error("TTS error:", error);
      if (runIdRef.current === myRunId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isSpeaking: false,
          isPaused: false,
          usingServerTTS: false,
          error: error instanceof Error ? error.message : "TTS failed",
        }));
      }
    }
  }, [unlockAudio, cancelActivePlayback, kokoroSpeakWithTimeout, playBlobAudio, resetBrowserSpeech, speakChunk, playServerAudio, getVoiceConfig, toast]);

  // Section-aware speaking: speaks sections sequentially starting from startIndex.
  const speakSections = useCallback(async (sections: TTSSection[], startIndex = 0) => {
    if (sections.length === 0) return;

    unlockAudio();
    cancelActivePlayback();
    const myRunId = ++runIdRef.current;
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (runIdRef.current !== myRunId) return;

    cancelledRef.current = false;
    activeSectionsRef.current = sections;
    const start = Math.max(0, Math.min(startIndex, sections.length - 1));

    setState(prev => ({
      ...prev,
      isLoading: true,
      isSpeaking: false,
      isPaused: false,
      error: null,
      usingServerTTS: false,
      currentSectionIndex: start,
      totalSections: sections.length,
      currentSectionLabel: sections[start]?.label ?? null,
    }));

    const currentPreset = serverVoicePresetRef.current;
    const voiceTier = getVoiceTier(currentPreset);

    /** Helper: speak one section via Kokoro */
    const speakSectionViaKokoro = async (txt: string, sectionIdx: number): Promise<boolean> => {
      if (kokoroIncompatibleRef.current) return false;
      try {
        const sentences = splitIntoSentences(txt);
        if (sentences.length === 0) return true;

        let nextBlobPromise: Promise<Blob> | null = kokoroSpeakWithTimeout(sentences[0], kokoroVoiceRef.current);

        for (let si = 0; si < sentences.length; si++) {
          if (cancelledRef.current || runIdRef.current !== myRunId) return true;
          const blob = await nextBlobPromise;
          if (si + 1 < sentences.length && !cancelledRef.current && runIdRef.current === myRunId) {
            nextBlobPromise = kokoroSpeakWithTimeout(sentences[si + 1], kokoroVoiceRef.current);
          }
          if (!blob || cancelledRef.current || runIdRef.current !== myRunId) return true;
          const sectionProgress = Math.round(((sectionIdx + (si + 1) / sentences.length) / sections.length) * 100);
          setState(prev => ({
            ...prev,
            isLoading: false,
            isSpeaking: true,
            usingServerTTS: false,
            progress: sectionProgress,
          }));
          await playBlobAudio(blob, myRunId);
        }
        return true;
      } catch (kokoroErr) {
        if (kokoroErr instanceof Error && kokoroErr.message === "cancelled") return true;
        console.warn("[TTS sections] Kokoro failed for section", sectionIdx, ":", kokoroErr);
        return false;
      }
    };

    /** Helper: speak one section via Browser TTS */
    const speakSectionViaBrowser = async (txt: string, isFirst: boolean, sectionIdx: number): Promise<boolean> => {
      if (!BROWSER_SPEECH_SUPPORTED) return false;
      if (isFirst) {
        await waitForBrowserVoices(300);
        if (cancelledRef.current || runIdRef.current !== myRunId) return true;
        await resetBrowserSpeech();
      }
      const chunks = splitIntoChunks(txt);
      if (chunks.length === 0) return true;
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSpeaking: true,
        usingServerTTS: false,
      }));
      try {
        for (let ci = 0; ci < chunks.length; ci++) {
          if (cancelledRef.current || runIdRef.current !== myRunId) return true;
          const sectionProgress = Math.round(((sectionIdx + (ci + 1) / chunks.length) / sections.length) * 100);
          setState(prev => ({ ...prev, progress: sectionProgress }));
          await speakChunk(chunks[ci], myRunId);
        }
        return true;
      } catch (browserErr) {
        if (browserErr instanceof Error && browserErr.message === "cancelled") return true;
        console.warn("[TTS sections] Browser speech failed for section", sectionIdx, ":", browserErr);
        return false;
      }
    };

    try {
      let nextFetch: Promise<{ audioData: string; audioFormat: string; playbackSpeed: number } | null> | null = null;

      for (let i = start; i < sections.length; i++) {
        if (cancelledRef.current || runIdRef.current !== myRunId) break;

        setState(prev => ({
          ...prev,
          currentSectionIndex: i,
          currentSectionLabel: sections[i]?.label ?? null,
          progress: Math.round((i / sections.length) * 100),
        }));

        const sectionText = cleanTextForTTS(sections[i].text);
        if (!sectionText) continue;

        // ── Tier 1: Local Kokoro ─────────────────────────────────────────────
        if (voiceTier === "local") {
          if (await speakSectionViaKokoro(sectionText, i)) continue;
          if (await speakSectionViaBrowser(sectionText, i === start, i)) continue;
        }

        // ── Tier 2: Server Qwen TTS ──────────────────────────────────────────
        if (voiceTier === "cloud") {
          let cloudHandled = false;
          try {
            const vcfg = getVoiceConfig();
            let result: { audioData: string; audioFormat: string; playbackSpeed: number } | null;

            if (nextFetch !== null) {
              result = await nextFetch;
              nextFetch = null;
            } else {
              result = await fetchServerTTSText(sectionText, vcfg);
            }

            if (i + 1 < sections.length && !cancelledRef.current && runIdRef.current === myRunId) {
              const nextClean = cleanTextForTTS(sections[i + 1].text);
              if (nextClean) nextFetch = fetchServerTTSText(nextClean, vcfg);
            }

            if (result && !cancelledRef.current && runIdRef.current === myRunId) {
              setState(prev => ({
                ...prev,
                isLoading: false,
                isSpeaking: true,
                usingServerTTS: true,
                progress: Math.round(((i + 0.5) / sections.length) * 100),
              }));
              await playServerAudio(result.audioData, result.audioFormat, result.playbackSpeed || rateRef.current, myRunId);
              cloudHandled = true;
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
          if (cloudHandled) continue;
          if (await speakSectionViaKokoro(sectionText, i)) continue;
          if (await speakSectionViaBrowser(sectionText, i === start, i)) continue;
        }

        // ── Tier 3: Browser TTS ──────────────────────────────────────────────
        if (voiceTier === "server") {
          if (await speakSectionViaBrowser(sectionText, i === start, i)) continue;
          if (!browserFallbackNotifiedRef.current) {
            browserFallbackNotifiedRef.current = true;
            toast({
              title: "Using AI voice fallback",
              description: "Your browser's native speech engine is unavailable on this device — using AI voice synthesis instead.",
            });
          }
          if (await speakSectionViaKokoro(sectionText, i)) continue;
        }

        // ── Tier 4: Server Qwen fallback (last resort) ───────────────────────
        if (!cancelledRef.current && runIdRef.current === myRunId) {
          try {
            const fallbackCfg = getVoiceConfig("qwen");
            const result = await fetchServerTTSText(sectionText, fallbackCfg);
            if (result && !cancelledRef.current && runIdRef.current === myRunId) {
              setState(prev => ({
                ...prev,
                isLoading: false,
                isSpeaking: true,
                usingServerTTS: true,
              }));
              await playServerAudio(result.audioData, result.audioFormat, result.playbackSpeed || rateRef.current, myRunId);
              continue;
            }
          } catch (fallbackErr) {
            if (fallbackErr instanceof Error && fallbackErr.message === "cancelled") return;
          }
        }

        // Nothing worked for this section
        if (!cancelledRef.current && runIdRef.current === myRunId) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            isSpeaking: false,
            isPaused: false,
            usingServerTTS: false,
            error: "Audio unavailable. Try selecting Kokoro (Offline) or Qwen TTS in Voice Settings.",
          }));
          return;
        }
      }

      if (!cancelledRef.current && runIdRef.current === myRunId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isSpeaking: false,
          progress: 100,
          usingServerTTS: false,
          currentSectionIndex: -1,
          totalSections: 0,
          currentSectionLabel: null,
        }));
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "cancelled") return;
      console.error("TTS sections error:", error);
      if (runIdRef.current === myRunId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isSpeaking: false,
          isPaused: false,
          usingServerTTS: false,
          error: error instanceof Error ? error.message : "TTS failed",
          currentSectionIndex: -1,
          totalSections: 0,
          currentSectionLabel: null,
        }));
      }
    }
  }, [unlockAudio, cancelActivePlayback, kokoroSpeakWithTimeout, playBlobAudio, resetBrowserSpeech, speakChunk, playServerAudio, getVoiceConfig, toast]);

  const jumpToSection = useCallback((index: number) => {
    const sects = activeSectionsRef.current;
    if (!sects || sects.length === 0) return;
    const clamped = Math.max(0, Math.min(index, sects.length - 1));
    void speakSections(sects, clamped);
  }, [speakSections]);

  const nextSection = useCallback(() => {
    const sects = activeSectionsRef.current;
    if (!sects || sects.length === 0) return;
    const nextIdx = state.currentSectionIndex + 1;
    if (nextIdx < sects.length) {
      void speakSections(sects, nextIdx);
    }
  }, [speakSections, state.currentSectionIndex]);

  const prevSection = useCallback(() => {
    const sects = activeSectionsRef.current;
    if (!sects || sects.length === 0) return;
    const prevIdx = Math.max(0, state.currentSectionIndex - 1);
    void speakSections(sects, prevIdx);
  }, [speakSections, state.currentSectionIndex]);

  const stop = useCallback(() => {
    runIdRef.current++;
    cancelActivePlayback();
    setState(prev => ({
      ...prev,
      isSpeaking: false,
      isPaused: false,
      isLoading: false,
      usingServerTTS: false,
      currentSectionIndex: -1,
      totalSections: 0,
      currentSectionLabel: null,
    }));
  }, [cancelActivePlayback]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    } else if (audioCtxRef.current && audioCtxRef.current.state === "running") {
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
    rateRef.current = clamped;
    try { localStorage.setItem(SPEED_STORAGE_KEY, String(clamped)); } catch { /* ignore */ }
    if (audioRef.current) audioRef.current.playbackRate = clamped;
    if (audioSrcNodeRef.current) {
      try { audioSrcNodeRef.current.playbackRate.value = clamped; } catch { /* ignore */ }
    }
    if (persistSpeedTimerRef.current) clearTimeout(persistSpeedTimerRef.current);
    persistSpeedTimerRef.current = setTimeout(() => {
      fetch("/api/tts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ playbackSpeed: clamped }),
      }).catch(() => {});
    }, 600);
  }, []);

  const setSelectedVoice = useCallback((voiceName: string) => {
    setSelectedVoiceState(voiceName);
    voiceRef.current = voiceName;
    try { localStorage.setItem(BROWSER_VOICE_KEY, voiceName); } catch { /* ignore */ }
  }, []);

  const setServerVoicePreset = useCallback(async (preset: string) => {
    serverVoicePresetRef.current = preset;
    setServerVoicePresetState(preset);
    setState(prev => ({ ...prev, error: null }));
    try {
      localStorage.setItem("tts_engine_pinned", "1");
      localStorage.setItem(PRESET_STORAGE_KEY, preset);
    } catch { /* ignore */ }
    try {
      await fetch("/api/tts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ voicePreset: preset, playbackSpeed: rateRef.current }),
      });
    } catch (e) {
      console.warn("Failed to save TTS preset:", e);
    }
  }, []);

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
    jumpToSection,
    nextSection,
    prevSection,
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
