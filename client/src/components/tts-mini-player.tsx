import { Pause, Play, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useTTS } from "@/hooks/use-tts";
import { cn } from "@/lib/utils";

/**
 * Sticky mini-player — sits above bottom nav while TTS is active.
 * Works app-wide because TTSProvider wraps the whole authenticated shell.
 */
export function TTSMiniPlayer() {
  const {
    isSpeaking,
    isPaused,
    isLoading,
    progress,
    currentSectionIndex,
    totalSections,
    rate,
    setRate,
    pause,
    resume,
    stop,
  } = useTTS();

  const visible = isSpeaking || isPaused || isLoading;
  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-[60]",
        "w-[min(560px,calc(100vw-1.5rem))] rounded-xl border border-border/80",
        "bg-background/95 backdrop-blur-md shadow-lg px-3 py-2"
      )}
      data-testid="tts-mini-player"
    >
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">
            {isLoading ? "Preparing audio…" : isPaused ? "Paused" : "Listening"}
            {totalSections > 0 && currentSectionIndex >= 0
              ? ` · section ${currentSectionIndex + 1}/${totalSections}`
              : ""}
          </p>
          <div className="h-1 mt-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.max(2, progress)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => (isPaused ? resume() : pause())}
            disabled={isLoading}
            data-testid="button-mini-tts-pause"
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => stop()}
            data-testid="button-mini-tts-stop"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1.5 px-0.5">
        <span className="text-[10px] text-muted-foreground w-8">{rate.toFixed(1)}x</span>
        <Slider
          value={[rate]}
          min={0.75}
          max={2}
          step={0.05}
          onValueChange={([v]) => setRate(v)}
          className="flex-1"
          data-testid="slider-mini-tts-rate"
        />
      </div>
    </div>
  );
}
