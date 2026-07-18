import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Target, Loader2, Sparkles, Rocket, BookOpen, Compass, ChevronDown, ChevronUp, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Topic, Category } from "@shared/schema";

type Mode = "goal" | "custom" | "explore";
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
  { value: "standard", label: "Standard", units: "8–12 units", desc: "Solid working knowledge" },
  { value: "deep", label: "Deep", units: "16–24 units", desc: "Full mastery" },
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
    label: "Goal",
    placeholder: "e.g. Deploy my first Next.js app to production",
    hint: "Tell us what you need to accomplish — get a tight path, not a textbook. Technical goals also get an Agent Playbook you can paste into your AI agent.",
  },
  custom: {
    icon: BookOpen,
    label: "Custom course",
    placeholder: "e.g. Byzantine history, organic chemistry, jazz theory",
    hint: "Any subject, any niche — a full course built around exactly what you want to learn.",
  },
  explore: {
    icon: Compass,
    label: "Explore",
    placeholder: "",
    hint: "10 subjects hand-picked for you based on your goals and interests. Pick one to build a course.",
  },
};

export function CourseCreator({ onStart }: CourseCreatorProps) {
  const [mode, setMode] = useState<Mode>("goal");
  const [input, setInput] = useState("");
  const [length, setLength] = useState<CourseLength>("quick");
  const [level, setLevel] = useState<TechnicalLevel>("intermediate");
  const [suggestions, setSuggestions] = useState<ExploreSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

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
      });
      return res.json();
    },
    onSuccess: (data) => {
      invalidate();
      toast({ title: "Course ready", description: `Built: ${data.topic?.title || "your course"}` });
      if (data.topic) onStart(data.topic, data.category);
      setInput("");
    },
    onError: (err: any) => handleError(err, "Try a different subject."),
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

  const isPending = goalMutation.isPending || customMutation.isPending;
  const meta = MODE_META[mode];
  const ModeIcon = meta.icon;

  const submit = () => {
    const text = input.trim();
    if (mode === "goal" && text.length >= 5) goalMutation.mutate(text);
    else if (mode === "custom" && text.length >= 3) customMutation.mutate(text);
    else if (mode === "explore" && selectedSuggestion) customMutation.mutate(selectedSuggestion);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setInput("");
    setSelectedSuggestion(null);
    if (m === "explore" && suggestions.length === 0 && !exploreMutation.isPending) {
      exploreMutation.mutate();
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
            <h3 className="text-sm font-semibold leading-tight">Create a course</h3>
            <p className="text-xs text-muted-foreground truncate">
              Goal, custom subject, or explore something new
            </p>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>

        {expanded && (
          <>
            {/* Mode tabs */}
            <div className="grid grid-cols-3 gap-1.5">
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

            {/* Explore mode: suggestion grid */}
            {mode === "explore" ? (
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
            ) : (
              /* Goal / Custom input */
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isPending) submit();
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={meta.placeholder}
                  className="h-9 text-sm"
                  data-testid="input-course-creator"
                />
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
                  (mode === "explore" && !selectedSuggestion)
                }
                onClick={submit}
                data-testid="btn-course-generate"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
