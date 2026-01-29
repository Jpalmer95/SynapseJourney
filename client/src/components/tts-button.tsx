import { useState } from "react";
import { Volume2, VolumeX, Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTTS } from "@/hooks/use-tts";
import { cn } from "@/lib/utils";

interface TTSButtonProps {
  text: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

export function TTSButton({
  text,
  className,
  variant = "outline",
  size = "sm",
  showLabel = false,
}: TTSButtonProps) {
  const { isLoading, isSpeaking, isSupported, speak, stop, pause, resume } = useTTS();
  const [isPaused, setIsPaused] = useState(false);

  if (!isSupported) {
    return null;
  }

  const handleClick = () => {
    if (isLoading) return;

    if (isSpeaking) {
      if (isPaused) {
        resume();
        setIsPaused(false);
      } else {
        pause();
        setIsPaused(true);
      }
    } else {
      setIsPaused(false);
      speak(text);
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    stop();
    setIsPaused(false);
  };

  const getIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (isSpeaking) {
      return isPaused ? (
        <Play className="h-4 w-4" />
      ) : (
        <Pause className="h-4 w-4" />
      );
    }
    return <Volume2 className="h-4 w-4" />;
  };

  const getTooltip = () => {
    if (isLoading) return "Loading...";
    if (isSpeaking) return isPaused ? "Resume" : "Pause";
    return "Read aloud";
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={handleClick}
            disabled={isLoading}
            className={cn(
              isSpeaking && !isPaused && "bg-primary/10 border-primary/30"
            )}
            data-testid="button-tts"
          >
            {getIcon()}
            {showLabel && (
              <span className="ml-2">
                {isLoading
                  ? "Loading..."
                  : isSpeaking
                  ? isPaused
                    ? "Resume"
                    : "Pause"
                  : "Listen"}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{getTooltip()}</TooltipContent>
      </Tooltip>

      {isSpeaking && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleStop}
              className="h-8 w-8"
              data-testid="button-tts-stop"
            >
              <VolumeX className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
