import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export interface VoicePreset {
  id: string;
  name: string;
  description: string;
  gender: "female" | "male" | "neutral";
  style: string;
}

interface TTSState {
  isLoading: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  error: string | null;
  progress: number;
  availableVoices: SpeechSynthesisVoice[];
  usingServerTTS: boolean;
}

interface UseTTSReturn extends TTSState {
  speak: (text: string, unitId?: number) => Promise<void>;
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

// Server TTS for arbitrary text (no unit — e.g. vocabulary cards, tooltips, Tesla with no browser TTS)
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

function base64ToAudioUrl(base64: string, format: string): string {
  const mimeMap: Record<string, string> = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    flac: "audio/flac",
    ogg: "audio/ogg",
  };
  const mime = mimeMap[format] || "audio/wav";
  return `data:${mime};base64,${base64}`;
}

export function useTTS(): UseTTSReturn {
  const [state, setState] = useState<TTSState>({
    isLoading: false,
    isSpeaking: false,
    isSupported: true,
    error: null,
    progress: 0,
    availableVoices: [],
    usingServerTTS: false,
  });

  const [rate, setRateState] = useState(1.0);
  const [selectedVoiceName, setSelectedVoiceState] = useState<string | null>(null);
  const [serverVoicePreset, setServerVoicePresetState] = useState<string>("browser");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chunksRef = useRef<string[]>([]);
  const currentChunkRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);
  const rateRef = useRef(rate);
  const voiceRef = useRef<string | null>(selectedVoiceName);

  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { voiceRef.current = selectedVoiceName; }, [selectedVoiceName]);

  const { data: ttsSettings } = useQuery<{ voicePreset: string; referenceAudio: string | null; playbackSpeed: number }>({
    queryKey: ["/api/tts/settings"],
    staleTime: 60000,
    retry: false,
  });

  useEffect(() => {
    if (ttsSettings) {
      setServerVoicePresetState(ttsSettings.voicePreset || "browser");
      if (ttsSettings.playbackSpeed) {
        setRateState(ttsSettings.playbackSpeed);
      }
    }
  }, [ttsSettings]);

  // isSupported is always true — server TTS works even without browser speechSynthesis (e.g. Tesla)
  // The button is always shown; error state is surfaced when both server and browser fail.
  useEffect(() => {
    if (!BROWSER_SPEECH_SUPPORTED) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
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

      const voices = window.speechSynthesis.getVoices();
      let selectedVoice = voiceRef.current ? voices.find(v => v.name === voiceRef.current) : undefined;
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("samantha"))
          || voices.find(v => v.lang.startsWith("en")) || voices[0];
      }
      if (selectedVoice) utterance.voice = selectedVoice;

      utterance.onend = () => cancelledRef.current ? reject(new Error("cancelled")) : resolve();
      utterance.onerror = (e) => {
        if (e.error === "interrupted" || cancelledRef.current) reject(new Error("cancelled"));
        else reject(new Error(e.error));
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const playServerAudio = useCallback(async (audioData: string, audioFormat: string, speed: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (cancelledRef.current) { reject(new Error("cancelled")); return; }

      const audioUrl = base64ToAudioUrl(audioData, audioFormat);
      const audio = new Audio(audioUrl);
      audio.playbackRate = Math.max(0.5, Math.min(4, speed));
      audioRef.current = audio;

      audio.onended = () => {
        audioRef.current = null;
        resolve();
      };
      audio.onerror = () => {
        audioRef.current = null;
        reject(new Error("audio_error"));
      };
      audio.onpause = () => {
        if (cancelledRef.current) reject(new Error("cancelled"));
      };

      audio.play().catch(reject);
    });
  }, []);

  const speak = useCallback(async (text: string, unitId?: number) => {
    if (!text.trim()) return;

    cancelledRef.current = false;
    setState(prev => ({ ...prev, isLoading: true, error: null, usingServerTTS: false }));

    const currentPreset = serverVoicePreset;

    try {
      if (currentPreset !== "browser") {
        // Try server-side TTS for all presets — works on Tesla (no browser speechSynthesis needed)
        const serverResult = unitId
          ? await fetchServerTTSAudio(unitId)
          : await fetchServerTTSText(text);

        if (serverResult && !cancelledRef.current) {
          setState(prev => ({ ...prev, isLoading: false, isSpeaking: true, progress: 0, usingServerTTS: true }));
          try {
            await playServerAudio(serverResult.audioData, serverResult.audioFormat, serverResult.playbackSpeed || rate);
            if (!cancelledRef.current) {
              setState(prev => ({ ...prev, isSpeaking: false, progress: 100, usingServerTTS: false }));
            }
            return;
          } catch (audioErr: any) {
            if (audioErr?.message === "cancelled") return;
            // Server audio playback failed — fall through to browser TTS
          }
        }
      }

      if (!BROWSER_SPEECH_SUPPORTED) {
        // Both server TTS and browser TTS have failed (e.g. Tesla browser without AI preset)
        setState(prev => ({ ...prev, isLoading: false, error: "Audio unavailable. Choose an AI voice preset in settings to enable audio on this device.", isSupported: true }));
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
    } catch (error: any) {
      if (error?.message === "cancelled") return;
      console.error("TTS error:", error);
      setState(prev => ({ ...prev, isLoading: false, isSpeaking: false, usingServerTTS: false, error: error instanceof Error ? error.message : "TTS failed" }));
    }
  }, [serverVoicePreset, rate, speakChunk, playServerAudio]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (BROWSER_SPEECH_SUPPORTED) window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState(prev => ({ ...prev, isSpeaking: false, isLoading: false, usingServerTTS: false }));
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    else if (BROWSER_SPEECH_SUPPORTED) window.speechSynthesis.pause();
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) audioRef.current.play().catch(console.error);
    else if (BROWSER_SPEECH_SUPPORTED) window.speechSynthesis.resume();
    setState(prev => ({ ...prev, isSpeaking: true }));
  }, []);

  const persistSpeedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setRate = useCallback((newRate: number) => {
    const clamped = Math.max(0.5, Math.min(3, newRate));
    setRateState(clamped);
    if (audioRef.current) audioRef.current.playbackRate = clamped;
    // Persist speed to server (debounced 600ms so slider drag doesn't spam API)
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
  };
}
