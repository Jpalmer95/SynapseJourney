import { useCallback, useRef, useEffect } from "react";

// Singleton Audio Context matching standard browser autoplay rules
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
};

export function useSFX() {
  // Pre-warm context slightly on hook mount
  useEffect(() => {
    const handleInteraction = () => getAudioContext();
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const playClick = useCallback((type: "light" | "deep" = "light") => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(type === "light" ? 600 : 300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(type === "light" ? 900 : 100, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, []);

  const playWhoosh = useCallback((direction: "up" | "down" = "up") => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(direction === "up" ? 100 : 800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(direction === "up" ? 800 : 100, ctx.currentTime + 0.2);

    filter.type = "lowpass";
    filter.frequency.value = 1000;

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }, []);

  const playMastery = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Major triad arpeggio
    const frequencies = [440.00, 554.37, 659.25, 880.00]; // A4, C#5, E5, A5
    
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      const start = ctx.currentTime + (i * 0.1);
      
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(start);
      osc.stop(start + 0.6);
    });
  }, []);

  return { playClick, playWhoosh, playMastery };
}
