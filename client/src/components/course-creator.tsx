import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Target, Loader2, Sparkles, Rocket, BookOpen, Compass, ChevronDown, ChevronUp, Wand2, Combine, X, MessageSquare, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AiChat } from "@/components/ai-chat";
import type { Topic, Category } from "@shared/schema";
import type { MyCourseItem } from "@/components/my-courses-strip";

type Mode = "goal" | "custom" | "agentic" | "fuse" | "explore";
type CourseLength = "quick" | "standard" | "deep";
type TechnicalLevel = "beginner" | "intermediate" | "advanced" | "expert";

interface CourseCreatorProps {
  onStart: (topic: Topic, category?: Category) => void;
}

interface ExploreSuggestion {
  title: string;
  hook: string;
  category: string;
  difficulty: string;
}

const LENGTH_OPTIONS: { value: CourseLength; label: string; units: string; desc: string }[] = [
  { value: "quick", label: "Quick", units: "3–5 units", desc: "Get it done today" },
  { value: "standard", label: "Standard", units: "8–12 units", desc: "Intro + sequential progression" },
  { value: "deep", label: "Deep", units: "16–24 units", desc: "Full foundation & mastery" },
];

const LEVEL_OPTIONS: { value: TechnicalLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
];

const MODE_META: Record<Mode, { icon: typeof Target; label: string; placeholder: string; hint: string }> = {
  goal: {
    icon: Target,
    label: "1. JIT Laser Focus",
    placeholder: "e.g. Fix J2 orbital drift in TLE propagation, or Deploy Next.js 16 on Coolify",
    hint: "Mode 1 — Laser-focused JIT path (3–5 surgical units) to solve a concrete challenge today. Concepts learned automatically credit canonical courses on your 3D Map.",
  },
  custom: {
    icon: BookOpen,
    label: "2. Linear Course",
    placeholder: "e.g. Orbital Mechanics, Organic Chemistry, Distributed Databases",
    hint: "Mode 2 — Generalized Linear Course: starts with a clear Intro Course primer, then sequentially more advanced lessons with inline Breadth ↔ Depth navigation and prior-progress recognition.",
  },
  agentic: {
    icon: MessageSquare,
    label: "3. Agentic Open-Ended",
    placeholder: "What are you exploring or talking through today? (e.g. Lagrangian mechanics intuition)",
    hint: "Mode 3 — Open-ended conversational learning (in-app AI Tutor or Hermes MCP). Scattered learnings are distilled and saved into your 3D Knowledge Web so future courses account for what you already know.",
  },
  fuse: {
    icon: Combine,
    label: "Fuse Domains",
    placeholder: "Add a subject (e.g. Topology)…",
    hint: "Pick 2+ courses or add free-text subjects — get one course that weaves them together with cross-domain insights, frontier research, and a capstone project.",
  },
  explore: {
    icon: Compass,
    label: "Explore",
    placeholder: "",
    hint: "10 subjects hand-picked for you based on your goals and 3D map. Pick one to build a linear course.",
  },
};

export function CourseCreator({ onStart }: CourseCreatorProps) {
  const [mode, setMode] = useState<Mode>("goal");
  const [input, setInput] = useState("");
  const [interestFocus, setInterestFocus] = useState("");
  const [agentSummaryNote, setAgentSummaryNote] = useState("");
  const [showOpenAgentStudio, setShowOpenAgentStudio] = useState(false);
  const [length, setLength] = useState<CourseLength>("quick");
  const [level, setLevel] = useState<TechnicalLevel>("intermediate");
  const [suggestions, setSuggestions] = useState<ExploreSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Fusion mode state
  const [fuseTopicIds, setFuseTopicIds] = useState<number[]>([]);
  const [fuseFreeTexts, setFuseFreeTexts] = useState<string[]>([]);
  const [fuseInput, setFuseInput] = useState("");
  const { toast } = useToast();

  // Needed for fusion topic picker (only fetched when fuse tab opens)
  const { data: myCourses } = useQuery<MyCourseItem[]>({
    queryKey: ["/api/learn/my-courses"],
    staleTime: 30_000,
    enabled: expanded && mode === "fuse",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/learn/continue"] });
    queryClient.invalidateQueries({ queryKey: ["/api/learn/goals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/learn/my-courses"] });
  };

  const handleError = (err: any, fallback: string) => {
    const msg = err?.message || fallback;
    if (msg.includes("BYOC_REQUIRED")) {
      toast({
        title: "Add your own AI key first",
        description: "Synapse is BYOC: add a key in Settings (xAI, Gemini, OpenRouter, Hugging Face, Ollama, LM Studio) — or ask Hermes Agent to author it for you.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Could not build course", description: msg, variant: "destructive" });
    }
  };

  const goalMutation = useMutation({
    mutationFn: async (goalText: string) => {
      const res = await apiRequest("POST", "/api/learn/goal", {
        goalText,
        courseLength: length,
        technicalLevel: level,
      });
      return res.json();
    },
    onSuccess: (data) => {
      invalidate();
      toast({ title: "Goal path ready", description: `Built a practical path for: ${data.topic?.title || "your goal"}` });
      if (data.topic) onStart(data.topic, data.category);
      setInput("");
    },
    onError: (err: any) => handleError(err, "Try again with a clearer goal."),
  });

  const customMutation = useMutation({
    mutationFn: async (subject: string) => {
      const res = await apiRequest("POST", "/api/learn/custom-course", {
        subject,
        courseLength: length,
        technicalLevel: level,
        interestFocus: interestFocus.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      invalidate();
      toast({ title: "Linear course ready", description: `Built: ${data.topic?.title || "your course"}` });
      if (data.topic) onStart(data.topic, data.category);
      setInput("");
      setInterestFocus("");
    },
    onError: (err: any) => handleError(err, "Try a different subject."),
  });

  const quickLedgerMutation = useMutation({
    mutationFn: async () => {
      const conceptTitle = input.trim();
      const summary = agentSummaryNote.trim() || `Explored and learned ${conceptTitle} via open-ended agentic study.`;
      const res = await apiRequest("POST", "/api/learn/ledger", {
        concepts: [
          {
            conceptTitle,
            summary,
            stream: "agent_chat",
            depthLevel: level === "beginner" ? "intro" : level === "advanced" || level === "expert" ? "advanced" : "core",
            confidence: 85,
            topicTitle: interestFocus.trim() || conceptTitle,
            createMapNodeIfMissing: true,
          },
        ],
      });
      return res.json();
    },
    onSuccess: (data) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-graph"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/prior-knowledge"] });
      const touched = (data.touchedTopics || []).map((t: any) => `${t.title} (${t.masteryPct}%)`).join(", ");
      toast({
        title: "Logged to 3D Knowledge Web!",
        description: `+${data.xpAwarded || 15} XP · Reconciled with ${touched || "your knowledge ledger"}. Future courses will recognize this progress.`,
      });
      setInput("");
      setAgentSummaryNote("");
    },
    onError: (err: any) => handleError(err, "Could not log concept."),
  });

  const exploreMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/learn/explore", {});
      return res.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      if ((data.suggestions || []).length === 0) {
        toast({ title: "No suggestions", description: "Try again in a moment." });
      }
    },
    onError: (err: any) => handleError(err, "Could not load suggestions."),
  });

  const fuseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/learn/fuse", {
        topicIds: fuseTopicIds,
        freeTexts: fuseFreeTexts,
        courseLength: length,
        technicalLevel: level,
      });
      return res.json();
    },
    onSuccess: (data) => {
      invalidate();
      const cap = data.fusion?.capstoneProject?.title;
      toast({
        title: "Fusion course ready",
        description: cap ? `Capstone: ${cap}` : `Fused: ${data.topic?.title}`,
      });
      if (data.topic) onStart(data.topic, data.category);
      setFuseTopicIds([]);
      setFuseFreeTexts([]);
      setFuseInput("");
    },
    onError: (err: any) => handleError(err, "Try different inputs."),
  });

  const isPending = goalMutation.isPending || customMutation.isPending || fuseMutation.isPending || quickLedgerMutation.isPending;
  const meta = MODE_META[mode];
  const ModeIcon = meta.icon;

  const submit = () => {
    const text = input.trim();
    if (mode === "goal" && text.length >= 5) goalMutation.mutate(text);
    else if (mode === "custom" && text.length >= 3) customMutation.mutate(text);
    else if (mode === "agentic" && text.length >= 2) setShowOpenAgentStudio(true);
    else if (mode === "explore" && selectedSuggestion) customMutation.mutate(selectedSuggestion);
    else if (mode === "fuse" && fuseTopicIds.length + fuseFreeTexts.length >= 2) fuseMutation.mutate();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setInput("");
    setSelectedSuggestion(null);
    if (m === "custom" && length === "quick") {
      setLength("standard");
    } else if (m === "goal") {
      setLength("quick");
    }
    if (m === "explore" && suggestions.length === 0 && !exploreMutation.isPending) {
      exploreMutation.mutate();
    }
  };

  const addFuseFreeText = () => {
    const t = fuseInput.trim();
    if (t.length >= 2 && !fuseFreeTexts.includes(t) && fuseTopicIds.length + fuseFreeTexts.length < 6) {
      setFuseFreeTexts([...fuseFreeTexts, t]);
      setFuseInput("");
    }
  };

  return (
    <Card className="mx-4 mb-3 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background" data-testid="course-creator">
      <CardContent className="p-3 space-y-2.5">
        {/* Compact header row — always visible, click to expand */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center gap-2 text-left"
          data-testid="course-creator-toggle"
        >
          <div className="p-1.5 rounded-md bg-primary/15 shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-tight">Launch Learning Mode (JIT · Linear · Agentic · Fuse)</h3>
            <p className="text-xs text-muted-foreground truncate">
              1. Laser JIT Goal · 2. Linear Intro→Advanced Course · 3. Agentic Open-Ended (synced to 3D Map)
            </p>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>

        {expanded && (
          <>
            {/* Mode tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {(Object.keys(MODE_META) as Mode[]).map((m) => {
                const Icon = MODE_META[m].icon;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                      mode === m
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/30"
                    }`}
                    data-testid={`mode-tab-${m}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {MODE_META[m].label}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">{meta.hint}</p>

            {/* Fuse mode: pick 2+ courses and/or free-text subjects */}
            {mode === "fuse" ? (
              <div className="space-y-2">
                {/* Selected chips */}
                {(fuseTopicIds.length > 0 || fuseFreeTexts.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {fuseTopicIds.map((id) => {
                      const t = (myCourses || []).find((c) => c.topic.id === id)?.topic.title || `#${id}`;
                      return (
                        <span key={`t-${id}`} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px]">
                          {t}
                          <button type="button" onClick={() => setFuseTopicIds(fuseTopicIds.filter((x) => x !== id))} aria-label="remove">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                    {fuseFreeTexts.map((t) => (
                      <span key={`f-${t}`} className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[11px]">
                        {t}
                        <button type="button" onClick={() => setFuseFreeTexts(fuseFreeTexts.filter((x) => x !== t))} aria-label="remove">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {/* Your courses picker */}
                {(myCourses || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(myCourses || [])
                      .filter((c) => !fuseTopicIds.includes(c.topic.id))
                      .slice(0, 10)
                      .map((c) => (
                        <button
                          key={c.topic.id}
                          type="button"
                          onClick={() => setFuseTopicIds([...fuseTopicIds, c.topic.id])}
                          className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                          data-testid={`fuse-pick-${c.topic.id}`}
                        >
                          + {c.topic.title.length > 34 ? c.topic.title.slice(0, 31) + "…" : c.topic.title}
                        </button>
                      ))}
                  </div>
                )}
                {/* Free-text adder */}
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addFuseFreeText();
                  }}
                >
                  <Input
                    value={fuseInput}
                    onChange={(e) => setFuseInput(e.target.value)}
                    placeholder={meta.placeholder}
                    className="h-9 text-sm"
                    data-testid="input-fuse-subject"
                  />
                  <Button type="submit" variant="outline" size="sm" className="h-9 shrink-0" disabled={fuseInput.trim().length < 2}>
                    Add
                  </Button>
                </form>
                <p className="text-[11px] text-muted-foreground">
                  {fuseTopicIds.length + fuseFreeTexts.length < 2
                    ? `Add ${2 - (fuseTopicIds.length + fuseFreeTexts.length)} more to fuse (max 6 total)`
                    : `${fuseTopicIds.length + fuseFreeTexts.length} selected — ready to fuse`}
                </p>
              </div>
            ) : mode === "explore" ? (
              <div className="space-y-2">
                {exploreMutation.isPending ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 justify-center">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Curating 10 subjects for you…
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                    {suggestions.map((s) => (
                      <button
                        key={s.title}
                        type="button"
                        onClick={() => setSelectedSuggestion(selectedSuggestion === s.title ? null : s.title)}
                        className={`text-left rounded-md border p-2 transition-colors ${
                          selectedSuggestion === s.title
                            ? "border-primary/60 bg-primary/10"
                            : "border-border/60 hover:border-primary/30 bg-card/50"
                        }`}
                        data-testid={`suggestion-${s.title.slice(0, 24)}`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-medium leading-snug">{s.title}</span>
                          <Badge variant="outline" className="text-[9px] shrink-0">{s.category}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{s.hook}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => exploreMutation.mutate()} className="w-full" data-testid="btn-load-suggestions">
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                    Load 10 suggestions
                  </Button>
                )}
              </div>
            ) : mode === "agentic" ? (
              /* Mode 3: Agentic Conversation-Based Open-Ended Learning */
              <div className="space-y-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={meta.placeholder}
                    className="h-9 text-sm bg-background"
                    data-testid="input-agentic-concept"
                  />
                  <Input
                    value={interestFocus}
                    onChange={(e) => setInterestFocus(e.target.value)}
                    placeholder="Parent topic on 3D Map (optional, e.g. Classical Mechanics)"
                    className="h-9 text-sm bg-background"
                    data-testid="input-agentic-parent-topic"
                  />
                </div>
                <Input
                  value={agentSummaryNote}
                  onChange={(e) => setAgentSummaryNote(e.target.value)}
                  placeholder="Optional takeaway or note to log directly (or leave blank to chat live with AI Tutor)…"
                  className="h-9 text-sm bg-background"
                  data-testid="input-agentic-summary"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    External agent? Connect Hermes or Claude to <code className="text-foreground">/api/mcp</code> and call <code className="text-emerald-400">synapse.log_learning</code>.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                      disabled={quickLedgerMutation.isPending || input.trim().length < 2}
                      onClick={() => quickLedgerMutation.mutate()}
                      data-testid="btn-agentic-quick-log"
                    >
                      {quickLedgerMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5 mr-1" />
                      )}
                      Log Directly to 3D Map
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setShowOpenAgentStudio(true)}
                      data-testid="btn-open-agentic-studio"
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" />
                      Open Live Agentic Tutor
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Goal (Mode 1) / Linear Custom Course (Mode 2) input */
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isPending) submit();
                }}
              >
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={meta.placeholder}
                    className="h-9 text-sm flex-1"
                    data-testid="input-course-creator"
                  />
                  {mode === "custom" && (
                    <Input
                      value={interestFocus}
                      onChange={(e) => setInterestFocus(e.target.value)}
                      placeholder="Specific interest / breadth-depth lens (optional, e.g. Audio DSP in Rust)"
                      className="h-9 text-sm sm:w-72"
                      data-testid="input-course-interest-focus"
                    />
                  )}
                </div>
              </form>
            )}

            {/* Length + level selectors */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Length</span>
                <div className="flex gap-1">
                  {LENGTH_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setLength(o.value)}
                      title={`${o.units} — ${o.desc}`}
                      className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                        length === o.value
                          ? "border-primary/60 bg-primary/15 text-foreground"
                          : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`length-${o.value}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Level</span>
                <div className="flex gap-1">
                  {LEVEL_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setLevel(o.value)}
                      className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                        level === o.value
                          ? "border-primary/60 bg-primary/15 text-foreground"
                          : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`level-${o.value}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1" />
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0"
                disabled={
                  isPending ||
                  (mode === "goal" && input.trim().length < 5) ||
                  (mode === "custom" && input.trim().length < 3) ||
                  (mode === "agentic" && input.trim().length < 2) ||
                  (mode === "explore" && !selectedSuggestion) ||
                  (mode === "fuse" && fuseTopicIds.length + fuseFreeTexts.length < 2)
                }
                onClick={submit}
                data-testid="btn-course-generate"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "fuse" ? (
                  <>
                    <Combine className="h-3.5 w-3.5 mr-1" />
                    Fuse
                  </>
                ) : mode === "agentic" ? (
                  <>
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    Start Session
                  </>
                ) : (
                  <>
                    <Rocket className="h-3.5 w-3.5 mr-1" />
                    Generate
                  </>
                )}
              </Button>
            </div>

            {/* Example chips for goal mode */}
            {mode === "goal" && (
              <div className="flex flex-wrap gap-1.5">
                {["Pass a backend interview", "Ship a Gradio demo on Hugging Face", "Understand transformers enough to fine-tune"].map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setInput(ex)}
                    className="text-[11px] px-2 py-1 rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors inline-flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    {ex}
                  </button>
                ))}
              </div>
            )}
            {/* Example fusion ideas */}
            {mode === "fuse" && fuseTopicIds.length + fuseFreeTexts.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-muted-foreground self-center">Try:</span>
                {["Fluid Dynamics + Godot + Topology", "Music theory + Signal processing", "Economics + Machine learning"].map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setFuseFreeTexts(ex.split(" + ").map((s) => s.trim()))}
                    className="text-[11px] px-2 py-1 rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors inline-flex items-center gap-1"
                  >
                    <Combine className="h-3 w-3" />
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {showOpenAgentStudio && (
          <AiChat
            subjectHint={input.trim() || interestFocus.trim() || undefined}
            onClose={() => setShowOpenAgentStudio(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}
