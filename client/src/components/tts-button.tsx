import { useState } from "react";
import { Volume2, VolumeX, Loader2, Pause, Play, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
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
  const {
    isLoading,
    isSpeaking,
    isSupported,
    availableVoices,
    rate,
    selectedVoiceName,
    speak,
    stop,
    pause,
    resume,
    setRate,
    setSelectedVoice,
  } = useTTS();
  const [isPaused, setIsPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const englishVoices = availableVoices.filter((v) => v.lang.startsWith("en"));
  const otherVoices = availableVoices.filter((v) => !v.lang.startsWith("en"));

  const formatVoiceName = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.replace(/Microsoft |Google |Apple /, "");
    const lang = voice.lang.split("-")[1] || voice.lang;
    return `${name} (${lang})`;
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
              data-testid="button-tts-stop"
            >
              <VolumeX className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop</TooltipContent>
        </Tooltip>
      )}

      <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="button-tts-settings"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Voice settings</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="speed" className="text-sm font-medium">
                  Speed
                </Label>
                <span className="text-sm text-muted-foreground">{rate.toFixed(1)}x</span>
              </div>
              <Slider
                id="speed"
                min={0.5}
                max={3}
                step={0.1}
                value={[rate]}
                onValueChange={([value]) => setRate(value)}
                className="w-full"
                data-testid="slider-tts-speed"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.5x</span>
                <span>1x</span>
                <span>2x</span>
                <span>3x</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice" className="text-sm font-medium">
                Voice
              </Label>
              <Select
                value={selectedVoiceName || ""}
                onValueChange={setSelectedVoice}
              >
                <SelectTrigger id="voice" data-testid="select-tts-voice">
                  <SelectValue placeholder="Select a voice" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {englishVoices.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>English Voices</SelectLabel>
                      {englishVoices.map((voice) => (
                        <SelectItem key={voice.name} value={voice.name}>
                          {formatVoiceName(voice)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {otherVoices.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Other Languages</SelectLabel>
                      {otherVoices.map((voice) => (
                        <SelectItem key={voice.name} value={voice.name}>
                          {formatVoiceName(voice)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Available voices depend on your browser and device.
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
