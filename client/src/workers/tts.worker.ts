/// <reference lib="webworker" />

import { KokoroTTS } from "kokoro-js";
import { env } from "@huggingface/transformers";

// Use the browser Cache API so model weights persist offline after first download.
// useBrowserCache maps to the browser-native Cache API (available in workers).
env.useBrowserCache = true;

let kokoroTTS: KokoroTTS | null = null;

type GenerateOptions = NonNullable<Parameters<KokoroTTS["generate"]>[1]>;
type KokoroVoice = NonNullable<GenerateOptions["voice"]>;

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
        try {
          // WebGPU path: fp32 is required for correct audio output (q8 produces garbled/alien speech on WebGPU)
          kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
            dtype: "fp32",
            device: "webgpu",
          });
        } catch {
          // WASM fallback: q8 is fine here and keeps the download smaller
          kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
            dtype: "q8",
            device: "wasm",
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
