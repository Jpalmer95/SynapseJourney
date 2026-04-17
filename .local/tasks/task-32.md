---
title: Switch Kokoro back to WebGPU fp32 primary, WASM q8 fallback
---
# Switch Kokoro back to WebGPU fp32 primary, WASM q8 fallback

  ## What
  In client/src/workers/tts.worker.ts, the current code (from commit 6349d11)
  loads WASM q8 as the only engine. The user wants WebGPU fp32 as primary
  with WASM q8 as the catch fallback - matching the original April 4 approach.

  ## Change (worker only, no other files)

  Current loading block:
    kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: "wasm",
      progress_callback: makeProgressCallback(),
    });
    engineId = "wasm-q8";

  Replace with try/catch so WebGPU fp32 is tried first and WASM q8 catches failures:
    try {
      kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "fp32",
        device: "webgpu",
        progress_callback: makeProgressCallback(),
      });
      engineId = "webgpu-fp32";
    } catch {
      kokoroTTS = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q8",
        device: "wasm",
        progress_callback: makeProgressCallback(),
      });
      engineId = "wasm-q8";
    }

  Also update the engineId default (line 30) from "wasm-q8" to "webgpu-fp32".
  Remove the WASM-only comment block above the loading section.

  ## Scope
  Only client/src/workers/tts.worker.ts. Do NOT touch use-tts.tsx or tts-button.tsx.