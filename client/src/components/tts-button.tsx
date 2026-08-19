import { useState, useRef, useEffect } from "react";
import { Volume2, Loader2, Pause, Play, Settings2, Check, Mic, Square, Zap, Cloud, ChevronDown, X, AlertTriangle } from "lucide-react";
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTTS, type TTSSection } from "@/hooks/use-tts";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { KOKORO_VOICES, QWEN_VOICES, getVoiceTier } from "@/lib/tts-constants";
import type { QwenMode } from "@/lib/tts-constants";

interface TTSButtonProps {
  text: string;
  unitId?: number;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
  sections?: TTSSection[];
}

/** Encode an AudioBuffer as a 16-bit PCM WAV Blob (server expects WAV/MP3/OGG). */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numCh = Math.min(2, buffer.numberOfChannels);
  const sr = buffer.sampleRate;
  const length = buffer.length * numCh;
  const view = new DataView(new ArrayBuffer(44 + length * 2));
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, length * 2, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}

/** Decode a MediaRecorder blob (webm/opus etc.) and re-encode as WAV File. */
async function blobToWavFile(blob: Blob): Promise<File> {
  const arrayBuffer = await blob.arrayBuffer();
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return new File([audioBufferToWavBlob(audioBuffer)], "recording.wav", { type: "audio/wav" });
  } finally {
    void ctx.close();
  }
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
    kokoroLoading,
    kokoroDownloadPercent,
    kokoroDownloadPhase,
    kokoroLoadError,
    kokoroDeviceWarning,
    kokoroReady,
    kokoroEngine,
    kokoroLoadMs,
    kokoroFromCache,
    kokoroIncompatible,
    kokoroVoice,
    setKokoroVoice,
    qwenVoice,
    setQwenVoice,
    qwenMode,
    setQwenMode,
    qwenStyleInstruction,
    setQwenStyleInstruction,
    qwenVoiceDescription,
    setQwenVoiceDescription,
    refText,
    setRefText,
  } = useTTS();

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [activeQwenTab, setActiveQwenTab] = useState<QwenMode>(qwenMode);
  const fileRef = useRef<HTMLInputElement>(null);
  const kokoroWarmShownRef = useRef(false);

  useEffect(() => {
    setActiveQwenTab(qwenMode);
  }, [qwenMode]);

  const activeTier = getVoiceTier(serverVoicePreset);

  const handleQwenTabChange = (tabValue: string) => {
    const mode = tabValue as QwenMode;
    setActiveQwenTab(mode);
    setQwenMode(mode);
  };

  // Kokoro first-load toast: fires once when the Kokoro model starts downloading (only if Kokoro engine is active).
  useEffect(() => {
    if (kokoroLoading && serverVoicePreset === "kokoro" && !kokoroWarmShownRef.current) {
      kokoroWarmShownRef.current = true;
      toast({
        title: "Downloading Kokoro model…",
        description: "First-time download (~90 MB). This only happens once — future use is instant.",
        duration: 30000,
      });
    }
    if (!kokoroLoading) {
      kokoroWarmShownRef.current = false;
    }
  }, [kokoroLoading, serverVoicePreset, toast]);

  const { data: cacheStatus } = useQuery<{ cached: boolean }>({
    queryKey: unitId ? [`/api/tts/cache-status/${unitId}`] : ["no-unit"],
    enabled: !!unitId && serverVoicePreset !== "browser",
    staleTime: 30000,
    retry: false,
  });

  const isInSectionMode = !!(sections && sections.length > 0 && totalSections > 0 &&
    ((isSpeaking || isPaused || isLoading) || !!ttsError));
  const currentLabel = isInSectionMode && currentSectionIndex >= 0 ? sections[currentSectionIndex]?.label : null;

  // Derived Kokoro progress helpers — use explicit phase from worker instead of inferring from percent.
  const isKokoroDownloading = kokoroLoading && kokoroDownloadPhase === "download";
  const kokoroProgressLabel = isKokoroDownloading ? "Downloading model…" : "Compiling model…";
  const kokoroProgressPct   = isKokoroDownloading && kokoroDownloadPercent !== null ? kokoroDownloadPercent : null;

  /** Compact horizontal progress bar shown during Kokoro first-load. */
  const KokoroProgressBar = kokoroLoading ? (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" />
          {kokoroProgressLabel}
        </span>
        {kokoroProgressPct !== null && (
          <span className="font-mono">{kokoroProgressPct}%</span>
        )}
      </div>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        {kokoroProgressPct !== null ? (
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${kokoroProgressPct}%` }}
          />
        ) : (
          <div className="h-full w-full bg-emerald-500/40 animate-pulse rounded-full" />
        )}
      </div>
    </div>
  ) : null;

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

  const handleEngineSelect = async (engineId: string) => {
    await setServerVoicePreset(engineId);
    if (unitId) {
      queryClient.invalidateQueries({ queryKey: [`/api/tts/cache-status/${unitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tts/settings"] });
    }
  };

  const uploadVoiceFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { setUploadStatus("error"); return; }
    setUploading(true);
    setUploadStatus("idle");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/tts/voice-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ audioBase64: base64, mimeType: file.type }),
      });
      if (res.ok) {
        setUploadStatus("success");
        setSelectedFile(null);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        try {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          const file = await blobToWavFile(blob);
          setSelectedFile(file);
          setUploadStatus("idle");
        } catch {
          setUploadStatus("error");
          toast({ title: "Recording failed", description: "Could not process the recording. Please try again." });
        } finally {
          setIsRecording(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch {
      toast({ title: "Microphone unavailable", description: "Please allow microphone access to record a voice sample." });
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  // Release the mic if the popover is closed mid-recording.
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const getIcon = () => {
    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (isSpeaking) return isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />;
    return <Volume2 className="h-4 w-4" />;
  };

  const getTooltipText = () => {
    if (isLoading && kokoroLoading && serverVoicePreset === "kokoro") {
      return isKokoroDownloading
        ? `Downloading Kokoro model… ${kokoroProgressPct !== null ? kokoroProgressPct + "%" : ""}`
        : "Compiling Kokoro model…";
    }
    if (isLoading) return "Generating audio…";
    if (isSpeaking) return isPaused ? "Resume" : "Pause";
    if (kokoroIncompatible) return "Kokoro unavailable on this device · using Browser TTS";
    if (serverVoicePreset === "kokoro") {
      if (kokoroLoading) {
        return isKokoroDownloading
          ? `Downloading Kokoro model… ${kokoroProgressPct !== null ? kokoroProgressPct + "%" : ""}`
          : "Compiling Kokoro model…";
      }
      if (kokoroLoadError && !kokoroReady) return `Kokoro error — tap Listen to retry`;
      if (!kokoroReady) return "Read aloud · Kokoro (model loads on first Listen)";
      return "Read aloud · Kokoro ready · instant playback";
    }
    if (serverVoicePreset === "qwen" || serverVoicePreset === "custom") return "Read aloud · Qwen TTS";
    return "Read aloud · Browser";
  };

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

  // Build a human-readable engine diagnostic string shown under the Kokoro row when ready.
  const kokoroDiagnostic = (() => {
    if (!kokoroReady || !kokoroEngine) return null;
    const engineLabel = kokoroEngine === "webgpu-fp32" ? "WebGPU · fp32" : "WASM · q8";
    const sourceLabel = kokoroFromCache ? "cached" : kokoroLoadMs !== null ? `${(kokoroLoadMs / 1000).toFixed(1)}s` : null;
    return sourceLabel ? `${engineLabel} · ${sourceLabel}` : engineLabel;
  })();

  // ── Engine row component ────────────────────────────────────────────────────
  const EngineRow = ({ engineId, label, sublabel, icon, badge, active, disabled }: {
    engineId: string;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
    active: boolean;
    disabled?: boolean;
  }) => (
    <button
      onClick={disabled ? undefined : () => handleEngineSelect(engineId)}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors",
        disabled
          ? "opacity-40 cursor-not-allowed border-border"
          : active
            ? "border-primary bg-primary/5 hover:bg-muted/60"
            : "border-border hover:bg-muted/60"
      )}
      data-testid={`button-engine-${engineId}`}
    >
      <div className="shrink-0 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm">{label}</span>
          {badge}
        </div>
        <span className="text-muted-foreground leading-tight">{sublabel}</span>
      </div>
      {active && !disabled && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
    </button>
  );

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
          {KokoroProgressBar && (
            <div className="mt-1.5">{KokoroProgressBar}</div>
          )}
          {!kokoroLoading && serverVoicePreset === "kokoro" && kokoroLoadError && (
            <p className="text-[10px] text-red-500 dark:text-red-400 mt-1 flex items-start gap-1" data-testid="status-kokoro-error">
              <X className="h-2.5 w-2.5 shrink-0 mt-0.5" />{kokoroLoadError}
            </p>
          )}
          {!kokoroLoading && serverVoicePreset === "kokoro" && !kokoroLoadError && kokoroDeviceWarning && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1" data-testid="status-kokoro-device-warning">
              <X className="h-2.5 w-2.5 shrink-0 mt-0.5" />{kokoroDeviceWarning}
            </p>
          )}
          {kokoroIncompatible && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1" data-testid="status-kokoro-incompatible">
              <AlertTriangle className="h-2.5 w-2.5 shrink-0 mt-0.5" />Kokoro is not supported on this device. Using Browser TTS instead.
            </p>
          )}
          {!kokoroLoading && serverVoicePreset === "kokoro" && !kokoroReady && !kokoroLoadError && !kokoroIncompatible && (
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5 text-emerald-500" />Model loads on first Listen
            </p>
          )}
          {kokoroReady && serverVoicePreset === "kokoro" && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <Check className="h-2.5 w-2.5" />{kokoroDiagnostic ?? "Kokoro ready · instant playback"}
            </p>
          )}
        </div>

        <div className="overflow-y-auto max-h-[70vh]">
          <div className="p-3 space-y-2">

            {/* ── Kokoro Engine Row ── */}
            <EngineRow
              engineId="kokoro"
              label="Kokoro"
              sublabel={kokoroIncompatible ? "Not supported on this device" : (kokoroReady && kokoroDiagnostic ? kokoroDiagnostic : "Local · offline, no token needed")}
              icon={<Zap className="h-4 w-4 text-emerald-500" />}
              badge={getTierBadge("local", true)}
              active={serverVoicePreset === "kokoro"}
              disabled={kokoroIncompatible}
            />

            {/* Kokoro voice sub-grid */}
            {serverVoicePreset === "kokoro" && (
              <div className="ml-3 pl-3 border-l border-border">
                <p className="text-[10px] text-muted-foreground mb-1.5">Choose voice</p>
                <div className="grid grid-cols-3 gap-1">
                  {KOKORO_VOICES.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setKokoroVoice(v.id)}
                      className={cn(
                        "flex flex-col items-start rounded-md border px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60",
                        kokoroVoice === v.id ? "border-primary bg-primary/5" : "border-border"
                      )}
                      data-testid={`button-kokoro-voice-${v.id}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium text-xs">{v.name}</span>
                        {kokoroVoice === v.id && <Check className="h-2.5 w-2.5 text-primary shrink-0" />}
                      </div>
                      <span className="text-muted-foreground/70 text-[10px] leading-tight capitalize">{v.gender}</span>
                      <span className="text-muted-foreground/50 text-[10px] leading-tight">{v.style}</span>
                    </button>
                  ))}
                </div>
                {unitId && isCached && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1.5">
                    <Check className="h-3 w-3" /> Audio ready for instant playback
                  </p>
                )}
              </div>
            )}

            {/* ── Browser TTS Engine Row ── */}
            <EngineRow
              engineId="browser"
              label="Browser TTS"
              sublabel="Device speech engine · no AI"
              icon={<Volume2 className="h-4 w-4 text-muted-foreground" />}
              active={serverVoicePreset === "browser"}
            />

            {/* ── Qwen Cloud Engine Row ── */}
            <EngineRow
              engineId="qwen"
              label="Qwen TTS"
              sublabel="AI voice synthesis via server"
              icon={<Cloud className="h-4 w-4 text-blue-500" />}
              badge={getTierBadge("cloud", true)}
              active={serverVoicePreset === "qwen" || serverVoicePreset === "custom"}
            />

            {/* Qwen sub-section */}
            {(serverVoicePreset === "qwen" || serverVoicePreset === "custom") && (
              <div className="ml-3 pl-3 border-l border-border space-y-3">
                <Tabs value={activeQwenTab} onValueChange={handleQwenTabChange}>
                  <TabsList className="grid w-full grid-cols-3 h-7">
                    <TabsTrigger value="custom_voice" className="text-[10px] py-0 px-1">Speakers</TabsTrigger>
                    <TabsTrigger value="voice_design" className="text-[10px] py-0 px-1">Design</TabsTrigger>
                    <TabsTrigger value="voice_clone" className="text-[10px] py-0 px-1">Clone</TabsTrigger>
                  </TabsList>

                  {/* Preset Speakers tab */}
                  <TabsContent value="custom_voice" className="space-y-2">
                    <p className="text-[10px] text-muted-foreground">Select a preset voice character</p>
                    <div className="grid grid-cols-2 gap-1">
                      {QWEN_VOICES.map(v => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setQwenVoice(v.id);
                            if (serverVoicePreset === "custom") handleEngineSelect("qwen");
                          }}
                          className={cn(
                            "flex flex-col items-start rounded-md border px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60",
                            qwenVoice === v.id && serverVoicePreset !== "custom" ? "border-primary bg-primary/5" : "border-border"
                          )}
                          data-testid={`button-qwen-voice-${v.id}`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className={cn("font-medium text-xs", v.color)}>{v.name}</span>
                            {qwenVoice === v.id && serverVoicePreset !== "custom" && (
                              <Check className="h-2.5 w-2.5 text-primary shrink-0" />
                            )}
                          </div>
                          <span className="text-muted-foreground/70 text-[10px] leading-tight capitalize">{v.gender}</span>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Style instruction (optional)</Label>
                      <textarea
                        value={qwenStyleInstruction}
                        onChange={e => setQwenStyleInstruction(e.target.value)}
                        placeholder="e.g. 'Speak warmly, with a gentle storyteller's cadence'"
                        maxLength={500}
                        rows={2}
                        className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                        data-testid="textarea-qwen-style-instruction"
                      />
                      {qwenStyleInstruction && (
                        <p className="text-[10px] text-blue-500 dark:text-blue-400">
                          Custom style active
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  {/* Voice Design tab */}
                  <TabsContent value="voice_design" className="space-y-2">
                    <p className="text-[10px] text-muted-foreground">Describe the voice you want</p>
                    <div className="space-y-1">
                      <textarea
                        value={qwenVoiceDescription}
                        onChange={e => setQwenVoiceDescription(e.target.value)}
                        placeholder="e.g. 'calm female narrator with a soft American accent'"
                        maxLength={500}
                        rows={3}
                        className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                        data-testid="textarea-qwen-voice-design"
                      />
                    </div>
                    {qwenVoiceDescription && (
                      <p className="text-[10px] text-blue-500 dark:text-blue-400">
                        Voice design active — overrides preset speakers
                      </p>
                    )}
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!qwenVoiceDescription?.trim()}
                      onClick={() =>
                        toast({
                          title: "Voice description applied",
                          description: "This voice will be used the next time you press Listen.",
                        })
                      }
                      data-testid="button-voice-design-apply"
                    >
                      Apply voice description
                    </Button>
                  </TabsContent>

                  {/* Voice Clone tab */}
                  <TabsContent value="voice_clone" className="space-y-2">
                    <p className="text-[10px] text-muted-foreground">Upload a short voice sample to clone</p>

                    {/* Voice sample upload dropzone */}
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-lg p-2.5 text-center cursor-pointer hover:bg-muted/40 transition-colors",
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
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setSelectedFile(f);
                          if (f) setUploadStatus("idle");
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                        data-testid="input-voice-file"
                      />
                      {uploading ? (
                        <div className="flex items-center justify-center gap-1">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Uploading…</p>
                        </div>
                      ) : uploadStatus === "success" ? (
                        <div className="flex items-center justify-center gap-1">
                          <Check className="h-3.5 w-3.5 text-green-500" />
                          <p className="text-xs text-green-600 dark:text-green-400">Voice uploaded!</p>
                        </div>
                      ) : uploadStatus === "error" ? (
                        <div className="flex items-center justify-center gap-1">
                          <Square className="h-3.5 w-3.5 text-red-500" />
                          <p className="text-xs text-red-500">Upload failed. Max 2MB, ≤30 s.</p>
                        </div>
                      ) : selectedFile ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <Check className="h-3.5 w-3.5 text-blue-500" />
                          <p className="text-xs font-medium truncate max-w-full">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground/60">Ready — click "Upload &amp; use this voice" below</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Upload voice sample to clone</p>
                          <p className="text-xs text-muted-foreground/60">WAV · MP3 · M4A · Max 2MB</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={isRecording ? stopRecording : startRecording}
                        data-testid="button-voice-record"
                      >
                        {isRecording ? (
                          <><Square className="h-3.5 w-3.5 text-red-500" /> Stop recording</>
                        ) : (
                          <><Mic className="h-3.5 w-3.5" /> Record voice sample</>
                        )}
                      </Button>
                      {isRecording && <span className="text-xs text-red-500 animate-pulse">Recording…</span>}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Reference transcript (optional)</Label>
                      <textarea
                        value={refText}
                        onChange={e => setRefText(e.target.value)}
                        placeholder="Transcript of the uploaded audio sample…"
                        maxLength={1000}
                        rows={2}
                        className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                        data-testid="textarea-qwen-ref-text"
                      />
                    </div>

                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!selectedFile || uploading}
                      onClick={() => selectedFile && uploadVoiceFile(selectedFile)}
                      data-testid="button-voice-upload"
                    >
                      {uploading ? "Uploading…" : "Upload & use this voice"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            )}

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

          {/* ── Advanced ── */}
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
              <div className="px-3 pb-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Kokoro: local WebGPU/WASM model, runs entirely in your browser. Qwen: AI voice synthesis via server. Server fallback (OpenAI) is the silent fallback for all engines.
                </p>
              </div>
            )}
          </div>
        </div>

          {/* ── pagevoice companion call-out ── */}
          <div className="border-t px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Want a full-page reading overlay with per-paragraph navigation and custom voice cloning? Try the{" "}
              <a
                href="https://github.com/Jpalmer95/pagevoice"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
              >
                pagevoice
              </a>{" "}
              Brave extension — free &amp; open source.
            </p>
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
                ? (kokoroLoading
                    ? (isKokoroDownloading
                        ? `Downloading Kokoro… ${kokoroProgressPct !== null ? kokoroProgressPct + "%" : ""}`
                        : "Compiling Kokoro model…")
                    : "Generating audio…")
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
  const kokoroStatusLine = serverVoicePreset === "kokoro" && !isSpeaking && (
    KokoroProgressBar ? (
      <div data-testid="status-kokoro-loading">{KokoroProgressBar}</div>
    ) : kokoroLoadError && !kokoroReady ? (
      <p className="text-[10px] text-red-500 dark:text-red-400 flex items-start gap-1 max-w-[200px]" data-testid="status-kokoro-error-inline">
        <X className="h-2.5 w-2.5 shrink-0 mt-0.5" />{kokoroLoadError}
      </p>
    ) : !kokoroReady ? (
      <p className="text-[10px] text-muted-foreground flex items-center gap-1" data-testid="status-kokoro-idle">
        <Zap className="h-2.5 w-2.5 text-emerald-500 shrink-0" />Loads on first Listen
      </p>
    ) : (
      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1" data-testid="status-kokoro-ready">
        <Check className="h-2.5 w-2.5 shrink-0" />{kokoroDiagnostic ?? "Kokoro ready"}
      </p>
    )
  );

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex items-center gap-1">
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
                  {isLoading
                    ? (kokoroLoading
                        ? (isKokoroDownloading
                            ? `Downloading… ${kokoroProgressPct !== null ? kokoroProgressPct + "%" : ""}`
                            : "Compiling…")
                        : "Generating…")
                    : isSpeaking ? (isPaused ? "Resume" : "Pause") : "Listen"}
                  {!isLoading && !isSpeaking && getTierBadge(activeTier, true)}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex flex-col gap-1 min-w-[150px]">
              <div className="flex items-center gap-1.5">
                {getTooltipText()}
                {isCached && !isSpeaking && activeTier === "local" && (
                  <Badge variant="secondary" className="text-xs px-1 py-0 h-4">cached</Badge>
                )}
              </div>
              {KokoroProgressBar && (
                <div className="mt-0.5">{KokoroProgressBar}</div>
              )}
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
      {kokoroStatusLine}
    </div>
  );
}
