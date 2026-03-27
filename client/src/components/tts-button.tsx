import { useState, useRef } from "react";
import { Volume2, Loader2, Pause, Play, Settings2, Check, Mic, Cpu, Square } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTTS, type TTSSection } from "@/hooks/use-tts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AI_VOICE_PRESETS } from "@/lib/tts-constants";

interface TTSButtonProps {
  text: string;
  unitId?: number;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
  sections?: TTSSection[];
}

export function TTSButton({
  text,
  unitId,
  className,
  variant = "outline",
  size = "sm",
  showLabel = false,
  sections,
}: TTSButtonProps) {
  const {
    isLoading,
    isSpeaking,
    isPaused,
    error: ttsError,
    usingServerTTS,
    rate,
    speak,
    stop,
    pause,
    resume,
    setRate,
    serverVoicePreset,
    setServerVoicePreset,
    currentSectionIndex,
    totalSections,
  } = useTTS();

  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: cacheStatus } = useQuery<{ cached: boolean }>({
    queryKey: unitId ? [`/api/tts/cache-status/${unitId}`] : ["no-unit"],
    enabled: !!unitId && serverVoicePreset !== "browser",
    staleTime: 30000,
    retry: false,
  });

  // Section mode: audio bar is visible when section playback is active (loading, playing, or paused)
  // totalSections > 0 only when speakSections() started from rabbit-hole.tsx; plain speak() leaves it 0.
  const isInSectionMode = sections && sections.length > 0 && (isSpeaking || isPaused || isLoading) && totalSections > 0;
  const currentLabel = isInSectionMode && currentSectionIndex >= 0 ? sections[currentSectionIndex]?.label : null;

  const handleClick = () => {
    if (isLoading) return;
    // Paused state: resume current stream (don't restart)
    if (isPaused) { resume(); return; }
    // Playing state: pause current stream
    if (isSpeaking) { pause(); return; }
    // Idle state: start playback using the full-text cached path
    speak(text, unitId);
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    stop();
  };

  const handlePresetSelect = async (presetId: string) => {
    await setServerVoicePreset(presetId);
    if (unitId) {
      queryClient.invalidateQueries({ queryKey: [`/api/tts/cache-status/${unitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tts/settings"] });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setUploadStatus("error"); return; }
    setUploading(true);
    setUploadStatus("idle");
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const res = await fetch("/api/tts/voice-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ audioBase64: base64, mimeType: file.type }),
          });
          if (res.ok) {
            setUploadStatus("success");
            await setServerVoicePreset("custom");
            queryClient.invalidateQueries({ queryKey: ["/api/tts/settings"] });
          } else {
            setUploadStatus("error");
          }
        } catch {
          setUploadStatus("error");
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => { setUploadStatus("error"); setUploading(false); };
      reader.readAsDataURL(file);
    } catch {
      setUploadStatus("error");
      setUploading(false);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const getIcon = () => {
    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (isSpeaking) return isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />;
    return <Volume2 className="h-4 w-4" />;
  };

  const getTooltip = () => {
    if (isLoading) return "Generating audio...";
    if (isSpeaking) return isPaused ? "Resume" : "Pause";
    return "Read aloud";
  };

  const isCached = cacheStatus?.cached === true;
  const isAIPreset = serverVoicePreset !== "browser";

  const SettingsPopover = (
    <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(isAIPreset && "text-violet-500 dark:text-violet-400")}
              data-testid="button-tts-settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Voice settings</TooltipContent>
      </Tooltip>

      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Voice Settings</h4>
            {serverVoicePreset !== "browser" && (
              <Badge className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-0">
                <Cpu className="h-3 w-3 mr-1" /> AI Voice
              </Badge>
            )}
          </div>

          <Tabs defaultValue="presets">
            <TabsList className="w-full h-8 text-xs">
              <TabsTrigger value="presets" className="flex-1 text-xs">AI Voices</TabsTrigger>
              <TabsTrigger value="browser" className="flex-1 text-xs">Browser</TabsTrigger>
              <TabsTrigger value="clone" className="flex-1 text-xs">Clone</TabsTrigger>
            </TabsList>

            <TabsContent value="presets" className="mt-2 space-y-1.5">
              <p className="text-xs text-muted-foreground mb-2">
                High-quality AI voices generated server-side. Works on all devices including Tesla browsers.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {AI_VOICE_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                    className={cn(
                      "relative flex flex-col items-start rounded-lg border p-2.5 text-left text-xs transition-colors hover:bg-muted/60",
                      serverVoicePreset === preset.id ? "border-primary bg-primary/5" : "border-border"
                    )}
                    data-testid={`button-voice-preset-${preset.id}`}
                  >
                    <div className="flex items-center justify-between w-full mb-0.5">
                      <span className={cn("font-semibold text-sm", preset.color)}>{preset.name}</span>
                      {serverVoicePreset === preset.id && <Check className="h-3 w-3 text-primary" />}
                    </div>
                    <span className="text-muted-foreground leading-tight">{preset.description}</span>
                    <span className="text-muted-foreground/60 capitalize mt-0.5">{preset.gender}</span>
                  </button>
                ))}
              </div>
              {unitId && isCached && isAIPreset && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                  <Check className="h-3 w-3" /> Audio ready for instant playback
                </p>
              )}
            </TabsContent>

            <TabsContent value="browser" className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                Uses your device's built-in text-to-speech engine. Voice quality depends on your operating system.
              </p>
              <button
                onClick={() => handlePresetSelect("browser")}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/60",
                  serverVoicePreset === "browser" ? "border-primary bg-primary/5" : "border-border"
                )}
                data-testid="button-voice-preset-browser"
              >
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">Browser TTS</div>
                  <div className="text-xs text-muted-foreground">Uses device speech engine</div>
                </div>
                {serverVoicePreset === "browser" && <Check className="h-4 w-4 text-primary" />}
              </button>
            </TabsContent>

            <TabsContent value="clone" className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                Upload a voice sample (up to 30 seconds) to clone it. Supported formats: WAV, MP3, M4A. Max 2MB.
              </p>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors",
                  uploadStatus === "success" && "border-green-500/50 bg-green-50/50 dark:bg-green-900/10",
                  uploadStatus === "error" && "border-red-500/50 bg-red-50/50 dark:bg-red-900/10"
                )}
                onClick={() => fileRef.current?.click()}
                data-testid="dropzone-voice-upload"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-voice-file"
                />
                {uploading ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Uploading...</p>
                  </div>
                ) : uploadStatus === "success" ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <Check className="h-5 w-5 text-green-500" />
                    <p className="text-xs text-green-600 dark:text-green-400">Voice uploaded — custom voice active!</p>
                  </div>
                ) : uploadStatus === "error" ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <Square className="h-5 w-5 text-red-500" />
                    <p className="text-xs text-red-500">Upload failed. Audio must be ≤30 seconds (max 2MB).</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <Mic className="h-5 w-5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Click to upload voice sample</p>
                    <p className="text-xs text-muted-foreground/60">WAV, MP3, M4A · Max 2MB · ≤30 sec</p>
                  </div>
                )}
              </div>
              {serverVoicePreset === "custom" && (
                <p className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Custom voice active
                </p>
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="speed" className="text-xs font-medium">Playback Speed</Label>
              <span className="text-xs text-muted-foreground">{rate.toFixed(1)}x</span>
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
              <span>0.5x</span><span>1x</span><span>2x</span><span>3x</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  // Section-mode audio bar: replaces the play/stop/settings row when sections are active
  if (isInSectionMode) {
    return (
      <div className={cn("w-full rounded-xl border bg-muted/30 p-3 space-y-2.5", className)}>
        {/* Section progress dots */}
        <div className="flex items-center gap-1.5">
          {sections!.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                i < currentSectionIndex
                  ? "bg-primary"
                  : i === currentSectionIndex
                  ? "bg-primary/70 animate-pulse"
                  : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
        {/* Section label + controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
            ) : (
              <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
            )}
            <span className="text-xs font-medium text-foreground truncate">
              {isLoading ? "Generating audio…" : currentLabel ?? "Listening…"}
            </span>
            {usingServerTTS && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 shrink-0">
                AI
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleClick}
                  data-testid="button-tts-pause-resume"
                >
                  {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isPaused ? "Resume" : "Pause"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleStop}
                  data-testid="button-tts-stop"
                >
                  <Square className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop</TooltipContent>
            </Tooltip>
            {SettingsPopover}
          </div>
        </div>
        {ttsError && (
          <p className="text-xs text-red-400">{ttsError}</p>
        )}
      </div>
    );
  }

  // Default mode (no active section playback)
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
                {isLoading ? "Generating..." : isSpeaking ? (isPaused ? "Resume" : "Pause") : "Listen"}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {getTooltip()}
              {isAIPreset && isCached && !isSpeaking && (
                <Badge variant="secondary" className="text-xs px-1 py-0 h-4">cached</Badge>
              )}
              {usingServerTTS && (
                <Badge variant="secondary" className="text-xs px-1 py-0 h-4 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">AI</Badge>
              )}
            </div>
            {ttsError && (
              <p className="text-xs text-red-400 max-w-[200px]">{ttsError}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {isSpeaking && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleStop} data-testid="button-tts-stop">
              <Square className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop</TooltipContent>
        </Tooltip>
      )}

      {SettingsPopover}
    </div>
  );
}
