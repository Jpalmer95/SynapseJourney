import { useState, useRef, useCallback, useEffect } from "react";

interface TTSState {
  isLoading: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  error: string | null;
  progress: number;
}

interface UseTTSOptions {
  voice?: string;
  rate?: number;
}

export function useTTS(options: UseTTSOptions = {}) {
  const { voice = "af_bella", rate = 1.0 } = options;
  const [state, setState] = useState<TTSState>({
    isLoading: false,
    isSpeaking: false,
    isSupported: true,
    error: null,
    progress: 0,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chunksRef = useRef<string[]>([]);
  const currentChunkRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.speechSynthesis) {
      setState((prev) => ({ ...prev, isSupported: false }));
    }
    return () => {
      stop();
    };
  }, []);

  const splitIntoChunks = (text: string, maxLength: number = 200): string[] => {
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

  const speakChunk = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (cancelledRef.current) {
          reject(new Error("cancelled"));
          return;
        }
        
        if (!window.speechSynthesis) {
          reject(new Error("Speech synthesis not supported"));
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.volume = 1;

        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(
          (v) => v.lang.startsWith("en") && v.name.includes("Female")
        ) || voices.find((v) => v.lang.startsWith("en")) || voices[0];

        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        utterance.onend = () => {
          if (cancelledRef.current) {
            reject(new Error("cancelled"));
          } else {
            resolve();
          }
        };
        utterance.onerror = (event) => {
          if (event.error === "interrupted" || cancelledRef.current) {
            reject(new Error("cancelled"));
          } else {
            reject(new Error(event.error));
          }
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      });
    },
    [rate]
  );

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      cancelledRef.current = false;
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        window.speechSynthesis.cancel();

        chunksRef.current = splitIntoChunks(text);
        currentChunkRef.current = 0;

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isSpeaking: true,
          progress: 0,
        }));

        for (let i = 0; i < chunksRef.current.length; i++) {
          if (cancelledRef.current) {
            break;
          }
          
          currentChunkRef.current = i;
          const progress = Math.round(((i + 1) / chunksRef.current.length) * 100);
          setState((prev) => ({ ...prev, progress }));

          await speakChunk(chunksRef.current[i]);
        }

        if (!cancelledRef.current) {
          setState((prev) => ({ ...prev, isSpeaking: false, progress: 100 }));
        }
      } catch (error) {
        if (error instanceof Error && error.message === "cancelled") {
          return;
        }
        console.error("TTS error:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isSpeaking: false,
          error: error instanceof Error ? error.message : "TTS failed",
        }));
      }
    },
    [speakChunk]
  );

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState((prev) => ({ ...prev, isSpeaking: false, isLoading: false }));
  }, []);

  const pause = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    setState((prev) => ({ ...prev, isSpeaking: false }));
  }, []);

  const resume = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
    setState((prev) => ({ ...prev, isSpeaking: true }));
  }, []);

  return {
    ...state,
    speak,
    stop,
    pause,
    resume,
  };
}
