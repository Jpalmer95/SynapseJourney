import { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { KOKORO_DEFAULT_VOICE, QWEN_DEFAULT_VOICE, QWEN_VOICES, getVoiceTier } from "@/lib/tts-constants";
import { useToast } from "@/hooks/use-toast";

// localStorage keys used by the TTS engine
const HF_TOKEN_KEY = "hf_token";
const HF_SPACE_URL_KEY = "hf_space_url";
const KOKORO_VOICE_KEY = "kokoro_voice";
const QWEN_VOICE_KEY = "qwen_voice";
// Default HF model ID used when no custom space URL is configured
const HF_DEFAULT_MODEL = "Qwen/Qwen3-TTS";

function getHFEndpoint(): string {
  try {
    const custom = localStorage.getItem(HF_SPACE_URL_KEY);
    if (custom) return custom.replace(/\/$/, "");
  } catch { /* ignore */ }
  return `https://api-inference.huggingface.co/models/${HF_DEFAULT_MODEL}`;
}

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
  hfToken: string | null;
  setHFToken: (token: string) => void;
  clearHFToken: () => void;
  kokoroReady: boolean;
  kokoroLoading: boolean;
  hfWarming: boolean;
  kokoroVoice: string;
  setKokoroVoice: (voiceId: string) => void;
  qwenVoice: string;
  setQwenVoice: (voiceId: string) => void;
}

const BROWSER_SPEECH_SUPPORTED = typeof window !== "undefined" && "speechSynthesis" in window;

async function fetchServerTTSAudio(unitId: number): Promise<{ audioData: string; audioFormat: string; playbackSpeed: number } | null> {
  try {
    const res = await fetch("/api/tts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ unitId }),
    });
    if (res.status === 403 || res.status === 401) return null;
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.audioData) return null;
    return { audioData: data.audioData, audioFormat: data.audioFormat || "wav", playbackSpeed: data.playbackSpeed || 1.0 };
  } catch {
    return null;
  }
}

async function fetchServerTTSIntro(unitId: number): Promise<{ audioData: string; audioFormat: string; playbackSpeed: number; restText: string | null } | null> {
  try {
    const res = await fetch("/api/tts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ unitId, firstParagraphOnly: true }),
    });
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
  } catch {
    return null;
  }
}

async function fetchServerTTSText(text: string): Promise<{ audioData: string; audioFormat: string; playbackSpeed: number } | null> {
  try {
    const res = await fetch("/api/tts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text }),
    });
    if (res.status === 403 || res.status === 401) return null;
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.audioData) return null;
    return { audioData: data.audioData, audioFormat: data.audioFormat || "wav", playbackSpeed: data.playbackSpeed || 1.0 };
  } catch {
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
  const [serverVoicePreset, setServerVoicePresetState] = useState<string>("kokoro");

  const [kokoroVoice, setKokoroVoiceState] = useState<string>(() => {
    try { return localStorage.getItem(KOKORO_VOICE_KEY) || KOKORO_DEFAULT_VOICE; } catch { return KOKORO_DEFAULT_VOICE; }
  });
  const [qwenVoice, setQwenVoiceState] = useState<string>(() => {
    try { return localStorage.getItem(QWEN_VOICE_KEY) || QWEN_DEFAULT_VOICE; } catch { return QWEN_DEFAULT_VOICE; }
  });

  const [hfToken, setHFTokenState] = useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(HF_TOKEN_KEY) : null
  );
  const [kokoroReady, setKokoroReady] = useState(false);
  const [kokoroLoading, setKokoroLoading] = useState(false);
  const [hfWarming, setHfWarming] = useState(false);
  const hfToastShownRef = useRef(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chunksRef = useRef<string[]>([]);
  const currentChunkRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);
  const rateRef = useRef(rate);
  const voiceRef = useRef<string | null>(selectedVoiceName);
  const audioUnlockedRef = useRef<boolean>(false);
  const hfTokenRef = useRef<string | null>(hfToken);
  const kokoroVoiceRef = useRef<string>(kokoroVoice);
  const qwenVoiceRef = useRef<string>(qwenVoice);

  // Kokoro worker refs
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, { resolve: (v: Blob | undefined) => void; reject: (e: Error) => void }>>(new Map());
  const msgIdRef = useRef(0);
  const workerReadyRef = useRef(false);
  const workerReadyPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { voiceRef.current = selectedVoiceName; }, [selectedVoiceName]);
  useEffect(() => { hfTokenRef.current = hfToken; }, [hfToken]);
  useEffect(() => { kokoroVoiceRef.current = kokoroVoice; }, [kokoroVoice]);
  useEffect(() => { qwenVoiceRef.current = qwenVoice; }, [qwenVoice]);

  const { data: ttsSettings } = useQuery<{ voicePreset: string; hasReferenceAudio: boolean; playbackSpeed: number }>({
    queryKey: ["/api/tts/settings"],
    staleTime: 60000,
    retry: false,
  });

  useEffect(() => {
    if (ttsSettings) {
      setServerVoicePresetState(ttsSettings.voicePreset || "kokoro");
      if (ttsSettings.playbackSpeed) {
        setRateState(ttsSettings.playbackSpeed);
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

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      const ACtx = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      if (ACtx) {
        const ctx = new ACtx();
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
        ctx.close().catch(() => {});
        audioUnlockedRef.current = true;
      }
    } catch {
      // ignore — audio unlock is best-effort
    }
  }, []);

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

  // ── Kokoro local worker ──────────────────────────────────────────────────

  const getWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;

    const w = new Worker(new URL("../workers/tts.worker.ts", import.meta.url), { type: "module" });

    w.onmessage = ({ data }: MessageEvent) => {
      const { id, type, samples, sampleRate, message } = data as {
        id: number;
        type: "ready" | "audio" | "error";
        samples?: Float32Array;
        sampleRate?: number;
        message?: string;
      };
      const p = pendingRef.current.get(id);
      if (!p) return;
      pendingRef.current.delete(id);

      if (type === "ready") {
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

    w.onerror = () => {
      Array.from(pendingRef.current.values()).forEach(p => p.reject(new Error("Worker crashed")));
      pendingRef.current.clear();
      workerReadyRef.current = false;
      workerReadyPromiseRef.current = null;
      setKokoroReady(false);
      setKokoroLoading(false);
    };

    workerRef.current = w;
    return w;
  }, []);

  const ensureKokoroInit = useCallback(async (): Promise<void> => {
    if (workerReadyRef.current) return;
    if (workerReadyPromiseRef.current) return workerReadyPromiseRef.current;

    setKokoroLoading(true);
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

  // ── Blob audio player ─────────────────────────────────────────────────────

  const playBlobAudio = useCallback(async (blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (cancelledRef.current) { reject(new Error("cancelled")); return; }

      let blobUrl: string | null = URL.createObjectURL(blob);
      const audio = new Audio(blobUrl);
      audio.playbackRate = Math.max(0.5, Math.min(4, rateRef.current));
      audioRef.current = audio;

      const cleanup = () => {
        if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
      };

      audio.onended = () => { audioRef.current = null; cleanup(); resolve(); };
      audio.onerror = () => { audioRef.current = null; cleanup(); reject(new Error("audio_error")); };
      audio.onpause = () => {
        if (cancelledRef.current) { cleanup(); reject(new Error("cancelled")); }
      };
      audio.play().catch((err) => { cleanup(); reject(err); });
    });
  }, []);

  // ── HF cloud TTS (ZeroGPU Space / Inference API) ─────────────────────────
  // Handles cold-start 503 retries and optional reference audio for voice cloning.

  const fetchQwenCloudTTS = useCallback(async (
    text: string,
    voiceDescription: string | undefined,
    token: string,
    referenceAudioBase64?: string,
  ): Promise<Blob | null> => {
    const endpoint = getHFEndpoint();
    const parameters: Record<string, unknown> = {};

    if (referenceAudioBase64) {
      parameters.reference_audio = referenceAudioBase64;
    } else if (voiceDescription) {
      parameters.voice_description = voiceDescription;
    }

    const body: Record<string, unknown> = { inputs: text };
    if (Object.keys(parameters).length > 0) {
      body.parameters = parameters;
    }

    // Retry on 503 (ZeroGPU space warming up). Maximum 12 retries, up to 60 s total.
    const MAX_RETRIES = 12;
    let retries = 0;

    while (retries <= MAX_RETRIES) {
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } catch {
        setHfWarming(false);
        hfToastShownRef.current = false;
        return null;
      }

      if (res.ok) {
        setHfWarming(false);
        hfToastShownRef.current = false;
        const blob = await res.blob();
        if (!blob || blob.size === 0) return null;
        return blob;
      }

      if (res.status === 503) {
        // Show the "Warming up engine…" toast exactly once per request sequence.
        if (!hfToastShownRef.current) {
          hfToastShownRef.current = true;
          setHfWarming(true);
          toast({
            title: "Warming up engine…",
            description: "The cloud TTS engine is starting up. This usually takes 15–20 seconds.",
            duration: 20000,
          });
        }
        retries++;
        if (retries > MAX_RETRIES) break;
        // Back off based on estimated_time header if present, else 5 s.
        let waitMs = 5000;
        try {
          const errJson = await res.json() as { estimated_time?: number };
          if (typeof errJson.estimated_time === "number") {
            waitMs = Math.min(errJson.estimated_time * 1000, 30000);
          }
        } catch { /* ignore parse errors */ }
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      // Non-503 error — bail immediately.
      setHfWarming(false);
      hfToastShownRef.current = false;
      return null;
    }

    setHfWarming(false);
    hfToastShownRef.current = false;
    return null;
  }, [toast, setHfWarming]);

  // ── HF token management ───────────────────────────────────────────────────

  const setHFToken = useCallback((token: string) => {
    setHFTokenState(token);
    hfTokenRef.current = token;
    try { localStorage.setItem(HF_TOKEN_KEY, token); } catch { /* ignore */ }
  }, []);

  const clearHFToken = useCallback(() => {
    setHFTokenState(null);
    hfTokenRef.current = null;
    try { localStorage.removeItem(HF_TOKEN_KEY); } catch { /* ignore */ }
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

    const currentPreset = serverVoicePreset;
    const voiceTier = getVoiceTier(currentPreset);
    // Auto-use server TTS when: non-browser preset, speechSynthesis is absent,
    // OR the browser has no voices (e.g. Tesla browser where speechSynthesis exists
    // but the OS TTS engine is unavailable/returns zero voices).
    const noVoicesAvailable = BROWSER_SPEECH_SUPPORTED &&
      window.speechSynthesis.getVoices().length === 0;
    const shouldTryServer = currentPreset !== "browser" || !BROWSER_SPEECH_SUPPORTED || noVoicesAvailable;

    try {
      // ── Tier 1: Local Kokoro (offline-capable, free) ────────────────────────
      if (voiceTier === "local") {
        // Primary path: Kokoro local worker using the saved kokoro sub-voice
        let kokoroDone = false;
        try {
          const blob = await kokoroSpeak(text, kokoroVoiceRef.current);
          if (cancelledRef.current) return;
          setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: false }));
          await playBlobAudio(blob);
          if (!cancelledRef.current) setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
          kokoroDone = true;
          return;
        } catch (kokoroErr) {
          if (kokoroErr instanceof Error && kokoroErr.message === "cancelled") return;
          console.warn("[TTS] Kokoro local failed:", kokoroErr);
        }

        // Fallback: if Kokoro failed and user has HF token, try Qwen cloud before server
        if (!kokoroDone && hfTokenRef.current) {
          try {
            const fallbackDesc = QWEN_VOICES.find(v => v.id === qwenVoiceRef.current)?.voiceDescription;
            const blob = await fetchQwenCloudTTS(text, fallbackDesc, hfTokenRef.current);
            if (blob && !cancelledRef.current) {
              setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: false }));
              await playBlobAudio(blob);
              if (!cancelledRef.current) setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
              return;
            }
          } catch (hfErr) {
            if (hfErr instanceof Error && hfErr.message === "cancelled") return;
            console.warn("[TTS] HF cloud fallback after Kokoro failure:", hfErr);
          }
        }
        // Fall through to server
      }

      // ── Tier 2: HF cloud TTS (qwen / custom presets) ─────────────────────
      if (voiceTier === "cloud") {
        if (!hfTokenRef.current) {
          // Inform user that a HF token would enable direct cloud synthesis.
          setState(prev => ({
            ...prev,
            error: "Add a Hugging Face token in Settings to enable cloud voice synthesis.",
          }));
          // Still fall through to server path so audio plays.
        } else {
          try {
            // For custom (voice cloning): fetch stored reference audio from server
            let referenceAudio: string | undefined;
            if (currentPreset === "custom") {
              try {
                const refRes = await fetch("/api/tts/reference-audio", { credentials: "include" });
                if (refRes.ok) {
                  const refData = await refRes.json() as { audioBase64: string };
                  referenceAudio = refData.audioBase64;
                }
              } catch { /* ignore — proceed without reference audio */ }
            }

            // For qwen: look up the voice description from the saved qwen sub-voice
            const voiceDesc = currentPreset === "qwen"
              ? QWEN_VOICES.find(v => v.id === qwenVoiceRef.current)?.voiceDescription
              : undefined;

            const blob = await fetchQwenCloudTTS(text, voiceDesc, hfTokenRef.current, referenceAudio);
            if (blob && !cancelledRef.current) {
              setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: false }));
              await playBlobAudio(blob);
              if (!cancelledRef.current) setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
              return;
            }
          } catch (cloudErr) {
            if (cloudErr instanceof Error && cloudErr.message === "cancelled") return;
            console.warn("[TTS] HF cloud TTS failed, falling back to server:", cloudErr);
          }
        }
      }

      // ── Tier 3: Server OpenAI (existing logic) ───────────────────────────
      if (shouldTryServer) {
        if (unitId) {
          let isCached = false;
          try {
            const statusRes = await fetch(`/api/tts/cache-status/${unitId}`, { credentials: "include" });
            if (statusRes.ok) {
              const statusData = await statusRes.json() as { cached: boolean };
              isCached = statusData.cached === true;
            }
          } catch { /* ignore — treat as uncached */ }

          if (isCached) {
            const serverResult = await fetchServerTTSAudio(unitId);
            if (serverResult && !cancelledRef.current) {
              setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
              try {
                await playServerAudio(serverResult.audioData, serverResult.audioFormat, serverResult.playbackSpeed || rate);
                if (!cancelledRef.current) setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
                return;
              } catch (audioErr: unknown) {
                if (audioErr instanceof Error && audioErr.message === "cancelled") return;
              }
            }
          } else {
            const introResult = await fetchServerTTSIntro(unitId);

            if (introResult && !cancelledRef.current) {
              const { restText } = introResult;
              const restPromise = restText ? fetchServerTTSText(restText) : Promise.resolve(null);
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
                  queryClient.invalidateQueries({ queryKey: [`/api/tts/cache-status/${unitId}`] });
                }
                return;
              } catch (audioErr: unknown) {
                if (audioErr instanceof Error && audioErr.message === "cancelled") return;
              }
            } else if (!introResult) {
              const serverResult = await fetchServerTTSAudio(unitId);
              if (serverResult && !cancelledRef.current) {
                setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
                try {
                  await playServerAudio(serverResult.audioData, serverResult.audioFormat, serverResult.playbackSpeed || rate);
                  if (!cancelledRef.current) setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
                  return;
                } catch (audioErr: unknown) {
                  if (audioErr instanceof Error && audioErr.message === "cancelled") return;
                }
              }
            }
          }
        } else {
          const serverResult = await fetchServerTTSText(text);
          if (serverResult && !cancelledRef.current) {
            setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
            try {
              await playServerAudio(serverResult.audioData, serverResult.audioFormat, serverResult.playbackSpeed || rate);
              if (!cancelledRef.current) setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
              return;
            } catch (audioErr: unknown) {
              if (audioErr instanceof Error && audioErr.message === "cancelled") return;
            }
          }
        }
      }

      if (!BROWSER_SPEECH_SUPPORTED) {
        setState(prev => ({ ...prev, isLoading: false, isSpeaking: false, isPaused: false, error: "Audio unavailable. Choose an AI voice preset in settings to enable audio on this device.", isSupported: true }));
        return;
      }

      if (BROWSER_SPEECH_SUPPORTED) window.speechSynthesis.cancel();
      chunksRef.current = splitIntoChunks(text);
      currentChunkRef.current = 0;
      setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0 }));

      for (let i = 0; i < chunksRef.current.length; i++) {
        if (cancelledRef.current) break;
        currentChunkRef.current = i;
        setState(prev => ({ ...prev, progress: Math.round(((i + 1) / chunksRef.current.length) * 100) }));
        await speakChunk(chunksRef.current[i]);
      }
      if (!cancelledRef.current) {
        setState(prev => ({ ...prev, isSpeaking: false, progress: 100 }));
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "cancelled") return;
      // Browser TTS failure codes that warrant a server TTS retry.
      // "synthesis-failed" is the Tesla Chromium async onerror code;
      // "speech_synthesis_error" is the synchronous throw path.
      const BROWSER_TTS_FAILURES = new Set([
        "speech_synthesis_error", "synthesis-failed", "synthesis-unavailable",
        "audio-hardware", "network",
      ]);
      if (!shouldTryServer && error instanceof Error && BROWSER_TTS_FAILURES.has(error.message)) {
        try {
          const fallback = unitId ? await fetchServerTTSAudio(unitId) : await fetchServerTTSText(text);
          if (fallback && !cancelledRef.current) {
            setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
            await playServerAudio(fallback.audioData, fallback.audioFormat, fallback.playbackSpeed || rate);
            if (!cancelledRef.current) setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
            return;
          }
        } catch { /* server TTS also failed — fall through to error state */ }
      }
      console.error("TTS error:", error);
      setState(prev => ({ ...prev, isLoading: false, isSpeaking: false, isPaused: false, usingServerTTS: false, error: error instanceof Error ? error.message : "TTS failed" }));
    }
  }, [serverVoicePreset, rate, speakChunk, playServerAudio, unlockAudio, kokoroSpeak, playBlobAudio, fetchQwenCloudTTS]);

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

    const currentPreset = serverVoicePreset;
    const voiceTier = getVoiceTier(currentPreset);
    const noVoicesAvailable = BROWSER_SPEECH_SUPPORTED &&
      window.speechSynthesis.getVoices().length === 0;
    const shouldTryServer = currentPreset !== "browser" || !BROWSER_SPEECH_SUPPORTED || noVoicesAvailable;

    try {
      setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0 }));

      // For cloud voice cloning, fetch the stored reference audio once before iterating.
      let cloudReferenceAudio: string | undefined;
      if (voiceTier === "cloud" && currentPreset === "custom" && hfTokenRef.current) {
        try {
          const refRes = await fetch("/api/tts/reference-audio", { credentials: "include" });
          if (refRes.ok) {
            const refData = await refRes.json() as { audioBase64: string };
            cloudReferenceAudio = refData.audioBase64;
          }
        } catch { /* ignore — will fall back to server */ }
      }

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
        if (voiceTier === "local") {
          // Primary: Kokoro local worker using the saved kokoro sub-voice
          let kokoroDone = false;
          try {
            const blob = await kokoroSpeak(sectionText, kokoroVoiceRef.current);
            if (cancelledRef.current) break;
            setState(prev => ({ ...prev, usingServerTTS: false }));
            await playBlobAudio(blob);
            kokoroDone = true;
          } catch (kokoroErr) {
            if (kokoroErr instanceof Error && kokoroErr.message === "cancelled") return;
            console.warn("[TTS sections] Kokoro failed for section", i, ":", kokoroErr);
          }
          if (kokoroDone) continue;

          // Fallback: Qwen cloud (if Kokoro failed and user has HF token)
          if (hfTokenRef.current) {
            try {
              const fallbackDesc = QWEN_VOICES.find(v => v.id === qwenVoiceRef.current)?.voiceDescription;
              const blob = await fetchQwenCloudTTS(sectionText, fallbackDesc, hfTokenRef.current);
              if (blob && !cancelledRef.current) {
                setState(prev => ({ ...prev, usingServerTTS: false }));
                await playBlobAudio(blob);
                continue;
              }
            } catch (hfErr) {
              if (hfErr instanceof Error && hfErr.message === "cancelled") return;
              console.warn("[TTS sections] HF cloud fallback failed for section", i, ":", hfErr);
            }
          }
          // Fall through to server
        }

        // ── Tier 2: HF Cloud (qwen / custom presets) ──────────────────────
        if (voiceTier === "cloud") {
          if (!hfTokenRef.current) {
            // Inform the user once (on the first section) that a HF token is required.
            if (i === start) {
              setState(prev => ({
                ...prev,
                error: "Add a Hugging Face token in Settings to enable cloud voice synthesis.",
              }));
            }
            // Fall through to server for all sections.
          } else {
            try {
              const voiceDesc = currentPreset === "qwen"
                ? QWEN_VOICES.find(v => v.id === qwenVoiceRef.current)?.voiceDescription
                : undefined;
              const blob = await fetchQwenCloudTTS(sectionText, voiceDesc, hfTokenRef.current, cloudReferenceAudio);
              if (blob && !cancelledRef.current) {
                setState(prev => ({ ...prev, usingServerTTS: false }));
                await playBlobAudio(blob);
                continue;
              }
            } catch (cloudErr) {
              if (cloudErr instanceof Error && cloudErr.message === "cancelled") return;
              console.warn("[TTS sections] HF cloud failed for section", i, ":", cloudErr);
            }
          }
          // Fall through to server
        }

        // ── Tier 3: Server OpenAI (existing logic) ────────────────────────
        if (shouldTryServer) {
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
              // Server audio failed for this section — try browser TTS as fallback
              if (BROWSER_SPEECH_SUPPORTED) {
                setState(prev => ({ ...prev, usingServerTTS: false }));
                const chunks = splitIntoChunks(sectionText);
                for (const chunk of chunks) {
                  if (cancelledRef.current) break;
                  await speakChunk(chunk);
                }
              } else {
                // No fallback available — surface error; keep totalSections > 0
                // so the section bar stays visible with the error message until
                // the user explicitly stops or retries.
                setState(prev => ({
                  ...prev, isLoading: false, isSpeaking: false, isPaused: false,
                  usingServerTTS: false, error: "Audio unavailable. Choose an AI voice preset in settings.",
                }));
                return;
              }
            }
          } else if (!cancelledRef.current) {
            // Server returned nothing — browser fallback
            if (BROWSER_SPEECH_SUPPORTED) {
              setState(prev => ({ ...prev, usingServerTTS: false }));
              const chunks = splitIntoChunks(sectionText);
              for (const chunk of chunks) {
                if (cancelledRef.current) break;
                await speakChunk(chunk);
              }
            } else {
              // No audio available at all — surface error; keep totalSections > 0
              // so the section bar stays visible until user stops or retries.
              setState(prev => ({
                ...prev, isLoading: false, isSpeaking: false, isPaused: false,
                usingServerTTS: false, error: "Audio unavailable. Choose an AI voice preset in settings.",
              }));
              return;
            }
          }
        } else {
          // Browser TTS path
          setState(prev => ({ ...prev, usingServerTTS: false }));
          if (i === start) {
            try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
          }
          const chunks = splitIntoChunks(sectionText);
          for (const chunk of chunks) {
            if (cancelledRef.current) break;
            await speakChunk(chunk);
          }
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
  }, [serverVoicePreset, rate, speakChunk, playServerAudio, unlockAudio, kokoroSpeak, playBlobAudio, fetchQwenCloudTTS]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (BROWSER_SPEECH_SUPPORTED) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
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
    if (audioRef.current) audioRef.current.pause();
    else if (BROWSER_SPEECH_SUPPORTED) { try { window.speechSynthesis.pause(); } catch { /* ignore */ } }
    setState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) audioRef.current.play().catch(console.error);
    else if (BROWSER_SPEECH_SUPPORTED) { try { window.speechSynthesis.resume(); } catch { /* ignore */ } }
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
    setServerVoicePresetState(preset);
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
    hfToken,
    setHFToken,
    clearHFToken,
    kokoroReady,
    kokoroLoading,
    hfWarming,
    kokoroVoice,
    setKokoroVoice,
    qwenVoice,
    setQwenVoice,
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
