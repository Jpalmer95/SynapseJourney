import { useState, useRef, useEffect } from "react";
import { Volume2, Loader2, Pause, Play, Settings2, Check, Mic, Square, Zap, Cloud, ChevronDown, ExternalLink, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { useTTS, type TTSSection } from "@/hooks/use-tts";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AI_VOICE_PRESETS, getVoiceTier } from "@/lib/tts-constants";

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
    rate,
    speak,
    speakSections,
    stop,
    pause,
    resume,
    setRate,
    serverVoicePreset,
    setServerVoicePreset,
    currentSectionIndex,
    totalSections,
    hfToken,
    setHFToken,
    clearHFToken,
    hfWarming,
    kokoroLoading,
    kokoroReady,
  } = useTTS();

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warmDismissRef = useRef<(() => void) | null>(null);
  const warmShownRef = useRef(false);

  const activeTier = getVoiceTier(serverVoicePreset);

  // Group AI presets by voiceTier
  const standardPresets = AI_VOICE_PRESETS.filter(p => p.voiceTier === "local");
  const cloudPresets = AI_VOICE_PRESETS.filter(p => p.voiceTier === "cloud");

  // Custom (voice-clone) is the cloud-tier "preset" alongside any cloud AI presets
  const customIsCloud = getVoiceTier("custom") === "cloud";

  // Cold-start toast: fires after 3 s when loading a cloud voice.
  // Gated by !hfWarming to avoid duplicating the hook's 503 toast.
  // Explicitly dismissed when audio starts (isSpeaking) or loading ends.
  useEffect(() => {
    if (isLoading && activeTier === "cloud" && !hfWarming && !warmShownRef.current) {
      warmTimerRef.current = setTimeout(() => {
        if (!warmShownRef.current) {
          warmShownRef.current = true;
          const { dismiss } = toast({
            title: "Warming up cloud engine…",
            description: "This may take up to 20 s on first use.",
            duration: 22000,
          });
          warmDismissRef.current = dismiss;
        }
      }, 3000);
    }

    // Dismiss toast when audio starts playing or loading finishes
    if (!isLoading || isSpeaking) {
      if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
      if (warmDismissRef.current) { warmDismissRef.current(); warmDismissRef.current = null; }
      warmShownRef.current = false;
    }

    return () => {
      if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
    };
  }, [isLoading, isSpeaking, activeTier, hfWarming, toast]);

  const { data: cacheStatus } = useQuery<{ cached: boolean }>({
    queryKey: unitId ? [`/api/tts/cache-status/${unitId}`] : ["no-unit"],
    enabled: !!unitId && serverVoicePreset !== "browser",
    staleTime: 30000,
    retry: false,
  });

  const isInSectionMode = !!(sections && sections.length > 0 && totalSections > 0 &&
    ((isSpeaking || isPaused || isLoading) || !!ttsError));
  const currentLabel = isInSectionMode && currentSectionIndex >= 0 ? sections[currentSectionIndex]?.label : null;

  const handleClick = () => {
    if (isLoading) return;
    if (isPaused) { resume(); return; }
    if (isSpeaking) { pause(); return; }
    if (sections && sections.length > 0) {
      speakSections(sections, 0);
    } else {
      speak(text, unitId);
    }
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

  const handleSaveToken = () => {
    const trimmed = tokenInput.trim();
    if (trimmed) {
      setHFToken(trimmed);
      setTokenInput("");
      setShowTokenInput(false);
    }
  };

  const getIcon = () => {
    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (isSpeaking) return isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />;
    return <Volume2 className="h-4 w-4" />;
  };

  const getTooltipText = () => {
    if (isLoading) return "Generating audio…";
    if (isSpeaking) return isPaused ? "Resume" : "Pause";
    if (activeTier === "local") return "Read aloud · Kokoro local";
    if (activeTier === "cloud") return "Read aloud · Qwen cloud";
    return "Read aloud · Server";
  };

  // Renders a ⚡ Offline or ☁ Pro badge with full text
  const getTierBadge = (tier: ReturnType<typeof getVoiceTier>, small = false) => {
    const cls = small ? "text-[10px] px-1 py-0 h-4" : "text-[10px] px-1.5 py-0.5 h-5";
    if (tier === "local") {
      return (
        <Badge className={cn(cls, "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-0 font-medium gap-0.5")}>
          <Zap className="h-2.5 w-2.5" />Offline
        </Badge>
      );
    }
    if (tier === "cloud") {
      return (
        <Badge className={cn(cls, "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0 font-medium gap-0.5")}>
          <Cloud className="h-2.5 w-2.5" />Pro
        </Badge>
      );
    }
    return null;
  };

  const isCached = cacheStatus?.cached === true;

  // Preset card component (shared between Standard and Cloud sections)
  const PresetCard = ({ presetId, name, description, gender, color, tier }: {
    presetId: string;
    name: string;
    description: string;
    gender: string;
    color: string;
    tier: ReturnType<typeof getVoiceTier>;
  }) => {
    const isActive = serverVoicePreset === presetId;
    return (
      <button
        onClick={() => handlePresetSelect(presetId)}
        className={cn(
          "relative flex flex-col items-start rounded-lg border p-2.5 text-left text-xs transition-colors hover:bg-muted/60",
          isActive ? "border-primary bg-primary/5" : "border-border"
        )}
        data-testid={`button-voice-preset-${presetId}`}
      >
        <div className="flex items-center justify-between w-full mb-0.5">
          <span className={cn("font-semibold text-sm", color)}>{name}</span>
          <div className="flex items-center gap-1">
            {getTierBadge(tier, true)}
            {isActive && <Check className="h-3 w-3 text-primary shrink-0" />}
          </div>
        </div>
        <span className="text-muted-foreground leading-tight">{description}</span>
        <span className="text-muted-foreground/60 capitalize mt-0.5">{gender}</span>
      </button>
    );
  };

  const SettingsPopover = (
    <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(serverVoicePreset !== "browser" && "text-violet-500 dark:text-violet-400")}
              data-testid="button-tts-settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Voice settings</TooltipContent>
      </Tooltip>

      <PopoverContent className="w-80 p-0" align="start">
        {/* Header */}
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Voice Settings</h4>
            {getTierBadge(activeTier)}
          </div>
          {kokoroLoading && (
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />Loading Kokoro model…
            </p>
          )}
          {!kokoroLoading && activeTier === "local" && !kokoroReady && (
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5 text-emerald-500" />Model loads on first Listen
            </p>
          )}
          {kokoroReady && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <Check className="h-2.5 w-2.5" />Kokoro ready · instant playback
            </p>
          )}
        </div>

        <div className="overflow-y-auto max-h-[70vh]">
          {/* ── Standard Voices (voiceTier: "local") ── */}
          <div className="p-3 pb-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-semibold text-foreground">Standard</span>
              <span className="text-[10px] text-muted-foreground">· offline, free</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {standardPresets.map(preset => (
                <PresetCard
                  key={preset.id}
                  presetId={preset.id}
                  name={preset.name}
                  description={preset.description}
                  gender={preset.gender}
                  color={preset.color}
                  tier={preset.voiceTier}
                />
              ))}
            </div>
            {unitId && isCached && activeTier === "local" && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1.5">
                <Check className="h-3 w-3" /> Audio ready for instant playback
              </p>
            )}
          </div>

          {/* ── Cloud Voices (voiceTier: "cloud") ── */}
          <div className="p-3 pt-1 border-t">
            <div className="flex items-center gap-1.5 mb-2">
              <Cloud className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-foreground">Cloud</span>
              <span className="text-[10px] text-muted-foreground">· Qwen ZeroGPU, voice cloning</span>
            </div>

            {/* Cloud-tier AI presets (future-proofed: currently none in tts-constants) */}
            {cloudPresets.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {cloudPresets.map(preset => (
                  <PresetCard
                    key={preset.id}
                    presetId={preset.id}
                    name={preset.name}
                    description={preset.description}
                    gender={preset.gender}
                    color={preset.color}
                    tier={preset.voiceTier}
                  />
                ))}
              </div>
            )}

            {/* Custom voice cloning — shown as a first-class selectable cloud preset */}
            {customIsCloud && (
              <button
                onClick={() => handlePresetSelect("custom")}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg border p-2.5 text-left text-xs transition-colors hover:bg-muted/60 mb-2",
                  serverVoicePreset === "custom" ? "border-primary bg-primary/5" : "border-border"
                )}
                data-testid="button-voice-preset-custom"
              >
                <Mic className="h-4 w-4 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">Custom</span>
                    {getTierBadge("cloud", true)}
                  </div>
                  <span className="text-muted-foreground leading-tight">Your voice clone</span>
                </div>
                {serverVoicePreset === "custom" && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            )}

            {/* Voice sample upload dropzone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:bg-muted/40 transition-colors",
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
                <div className="flex flex-col items-center gap-1">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Uploading…</p>
                </div>
              ) : uploadStatus === "success" ? (
                <div className="flex flex-col items-center gap-1">
                  <Check className="h-4 w-4 text-green-500" />
                  <p className="text-xs text-green-600 dark:text-green-400">Voice uploaded — custom voice active!</p>
                </div>
              ) : uploadStatus === "error" ? (
                <div className="flex flex-col items-center gap-1">
                  <Square className="h-4 w-4 text-red-500" />
                  <p className="text-xs text-red-500">Upload failed. Audio must be ≤30 s (max 2MB).</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Mic className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Upload voice sample to clone</p>
                  <p className="text-xs text-muted-foreground/60">WAV, MP3, M4A · Max 2MB · ≤30 s</p>
                </div>
              )}
            </div>

            {/* HF Token management */}
            <div className="mt-2.5 space-y-1.5">
              {hfToken ? (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">HF token saved</span>
                  </div>
                  <button
                    onClick={clearHFToken}
                    className="text-emerald-600/60 hover:text-red-500 transition-colors"
                    data-testid="button-clear-hf-token"
                    title="Remove token"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : showTokenInput ? (
                <div className="space-y-1.5">
                  <Input
                    placeholder="hf_…"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSaveToken()}
                    className="h-7 text-xs font-mono"
                    data-testid="input-hf-token"
                  />
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      className="h-6 text-xs flex-1"
                      onClick={handleSaveToken}
                      disabled={!tokenInput.trim()}
                      data-testid="button-save-hf-token"
                    >
                      Save token
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => { setShowTokenInput(false); setTokenInput(""); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowTokenInput(true)}
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors py-1 flex items-center gap-1.5"
                  data-testid="button-add-hf-token"
                >
                  <Cloud className="h-3 w-3 shrink-0" />
                  <span>Add HF token to enable cloud voices</span>
                </button>
              )}
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-hf-tokens"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                Get a token at huggingface.co
              </a>
            </div>
          </div>

          {/* ── Speed ── */}
          <div className="p-3 pt-2 border-t space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="speed" className="text-xs font-medium">Speed</Label>
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

          {/* ── Advanced (Browser TTS) ── */}
          <div className="border-t">
            <button
              onClick={() => setAdvancedOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-advanced-toggle"
            >
              <span>Advanced</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", advancedOpen && "rotate-180")} />
            </button>
            {advancedOpen && (
              <div className="px-3 pb-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Use your device's built-in speech engine as a fallback. Voice quality depends on your OS.
                </p>
                <button
                  onClick={() => handlePresetSelect("browser")}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-muted/60",
                    serverVoicePreset === "browser" ? "border-primary bg-primary/5" : "border-border"
                  )}
                  data-testid="button-voice-preset-browser"
                >
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">Browser TTS</div>
                    <div className="text-xs text-muted-foreground">Device speech engine</div>
                  </div>
                  {serverVoicePreset === "browser" && <Check className="h-4 w-4 text-primary" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  // Section-mode audio bar
  if (isInSectionMode) {
    return (
      <div className={cn("w-full rounded-xl border bg-muted/30 p-3 space-y-2.5", className)}>
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
            ) : (
              <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
            )}
            <span className="text-xs font-medium text-foreground truncate">
              {isLoading
                ? (hfWarming ? "Warming up cloud engine…" : "Generating audio…")
                : currentLabel ?? "Listening…"}
            </span>
            {getTierBadge(activeTier, true)}
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

  // Default mode
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
              <span className="ml-2 flex items-center gap-1.5">
                {isLoading ? "Generating…" : isSpeaking ? (isPaused ? "Resume" : "Pause") : "Listen"}
                {!isLoading && !isSpeaking && getTierBadge(activeTier, true)}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {getTooltipText()}
              {isCached && !isSpeaking && activeTier === "local" && (
                <Badge variant="secondary" className="text-xs px-1 py-0 h-4">cached</Badge>
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
