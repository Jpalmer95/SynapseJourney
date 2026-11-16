import { useState, useEffect, useMemo } from "react";
import {
  Compass,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LessonMarkdown } from "@/components/lesson-markdown";
import { cn } from "@/lib/utils";
import type { Topic } from "@shared/schema";

export interface PrerequisiteStep {
  step: number;
  title: string;
  level: "undergraduate" | "upper_undergrad" | "graduate" | "specialized";
  whyNeeded: string;
  keyConcepts: string[];
  recommendedTextbooks: {
    title: string;
    authorOrSource: string;
    url?: string;
    chapters?: string;
  }[];
  diagnosticQuestion: {
    question: string;
    selfCheckCriteria: string;
  };
  bridgeSummary: string;
}

type ReadinessLevel = "need_primer" | "rusty" | "solid";

interface PrerequisiteDiagnosticProps {
  topic: Topic;
  prerequisiteLadder?: PrerequisiteStep[];
  recommendedOER?: { name: string; url: string; reason: string }[];
  orderedUnits: {
    id: number;
    title: string;
    difficulty: string;
    outline?: string | null;
    globalStep: number;
  }[];
  depthMode: string;
  onSelectDepthMode: (mode: string) => void;
}

const LEVEL_LABELS: Record<PrerequisiteStep["level"], { label: string; color: string }> = {
  undergraduate: {
    label: "Undergrad Foundation",
    color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  },
  upper_undergrad: {
    label: "Upper-Level Undergrad",
    color: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
  },
  graduate: {
    label: "Graduate Core",
    color: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  },
  specialized: {
    label: "Specialized Frontier",
    color: "border-purple-500/40 text-purple-400 bg-purple-500/10",
  },
};

export function PrerequisiteDiagnostic({
  topic,
  prerequisiteLadder,
  recommendedOER,
  orderedUnits,
  depthMode,
  onSelectDepthMode,
}: PrerequisiteDiagnosticProps) {
  const storageKey = `synapse_prereq_diag_${topic.id}`;
  const [isOpen, setIsOpen] = useState<boolean>(
    topic.difficulty === "advanced" || topic.difficulty === "nextgen" || Boolean(prerequisiteLadder?.length),
  );
  const [ratings, setRatings] = useState<Record<number, ReadinessLevel>>({});
  const [expandedPrimers, setExpandedPrimers] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setRatings(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  const setStepRating = (step: number, level: ReadinessLevel) => {
    setRatings((prev) => {
      const next = { ...prev, [step]: level };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    if (level === "need_primer" || level === "rusty") {
      setExpandedPrimers((prev) => ({ ...prev, [step]: true }));
    }
  };

  const togglePrimer = (step: number) => {
    setExpandedPrimers((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  // Use authored prerequisiteLadder if present, otherwise synthesize a helpful 3-step ladder
  const steps: PrerequisiteStep[] = useMemo(() => {
    if (prerequisiteLadder && prerequisiteLadder.length > 0) {
      return prerequisiteLadder;
    }
    const beginnerUnits = orderedUnits.filter((u) => u.difficulty === "beginner");
    const intermediateUnits = orderedUnits.filter((u) => u.difficulty === "intermediate");
    const oers = recommendedOER || [];
    return [
      {
        step: 1,
        title: `Core Vocabulary & First-Principles Mental Model`,
        level: "undergraduate",
        whyNeeded: `Establishes the foundational definitions, physical or mathematical intuition, and notation assumed by ${topic.title}.`,
        keyConcepts: beginnerUnits.slice(0, 3).map((u) => u.title),
        recommendedTextbooks: oers.slice(0, 2).map((o) => ({
          title: o.name,
          authorOrSource: o.reason || "Open Educational Resource",
          url: o.url,
        })),
        diagnosticQuestion: {
          question: `Can you state the core governing principle of ${beginnerUnits[0]?.title || topic.title} in plain language without looking at notes?`,
          selfCheckCriteria: `You should be able to define the primary variables, state what physical or logical problem they solve, and give one concrete analogy.`,
        },
        bridgeSummary:
          beginnerUnits[0]?.outline?.replace(/\s*\[[^\]]+\]\s*$/, "") ||
          topic.description ||
          `Start with Stage 1 (Intro Course) in Survey mode to build the intuitive mental model before tackling formal derivations.`,
      },
      ...(intermediateUnits.length > 0
        ? [
            {
              step: 2,
              title: `Mathematical & Analytical Machinery`,
              level: "upper_undergrad" as const,
              whyNeeded: `Connects the introductory intuition to quantitative problem-solving and system mechanics.`,
              keyConcepts: intermediateUnits.slice(0, 3).map((u) => u.title),
              recommendedTextbooks: oers.slice(2, 5).map((o) => ({
                title: o.name,
                authorOrSource: o.reason || "Primary Reference",
                url: o.url,
              })),
              diagnosticQuestion: {
                question: `Are you comfortable setting up and solving the governing equations for ${intermediateUnits[0]?.title || topic.title}?`,
                selfCheckCriteria: `If the equations or terminology in Stage 2 feel unfamiliar, start in Survey mode (Intuition & Analogies First) and use the Feynman Blank Sheet in each lesson to unpack one term at a time.`,
              },
              bridgeSummary:
                intermediateUnits[0]?.outline?.replace(/\s*\[[^\]]+\]\s*$/, "") ||
                `Work through Stage 1 units with Full View enabled, pausing on each worked example before advancing to Stage 2.`,
            },
          ]
        : []),
    ];
  }, [prerequisiteLadder, orderedUnits, recommendedOER, topic.title, topic.description]);

  const ratedCount = Object.keys(ratings).length;
  const needPrimerCount = Object.values(ratings).filter((r) => r === "need_primer").length;
  const rustyCount = Object.values(ratings).filter((r) => r === "rusty").length;
  const solidCount = Object.values(ratings).filter((r) => r === "solid").length;

  return (
    <Card className="border-indigo-500/30 bg-indigo-500/5" data-testid="section-prerequisite-diagnostic">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-400 shrink-0" />
              <span>Self-Diagnostic &amp; Recommended Reading Order</span>
              <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-300">
                {steps.length} Foundation Steps
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Advanced topics build on years of undergraduate and graduate foundations. Diagnose your current exposure below to get a tailored reading order and inline bridge primers before starting Lesson 1.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen((v) => !v)}
            className="h-8 text-xs gap-1 shrink-0"
            data-testid="button-toggle-prereq-diagnostic"
          >
            <span>{isOpen ? "Hide Diagnostic" : "Open Self-Diagnostic & Reading List"}</span>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-3">
            {steps.map((step) => {
              const currentRating = ratings[step.step];
              const primerOpen = !!expandedPrimers[step.step];
              const levelMeta = LEVEL_LABELS[step.level] || LEVEL_LABELS.undergraduate;

              return (
                <div
                  key={step.step}
                  className="rounded-lg border border-border/80 bg-background/85 p-3.5 sm:p-4 space-y-3"
                  data-testid={`prereq-step-${step.step}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
                          {step.step}
                        </span>
                        <h4 className="font-semibold text-sm sm:text-base">{step.title}</h4>
                        <Badge variant="outline" className={cn("text-[10px]", levelMeta.color)}>
                          {levelMeta.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{step.whyNeeded}</p>
                    </div>

                    {/* Self-Diagnostic Rating Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
                        My level:
                      </span>
                      <button
                        type="button"
                        onClick={() => setStepRating(step.step, "need_primer")}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-md border transition-colors",
                          currentRating === "need_primer"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-medium"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                        data-testid={`prereq-rate-primer-${step.step}`}
                      >
                        Need Primer
                      </button>
                      <button
                        type="button"
                        onClick={() => setStepRating(step.step, "rusty")}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-md border transition-colors",
                          currentRating === "rusty"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-medium"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                        data-testid={`prereq-rate-rusty-${step.step}`}
                      >
                        Rusty
                      </button>
                      <button
                        type="button"
                        onClick={() => setStepRating(step.step, "solid")}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-md border transition-colors",
                          currentRating === "solid"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-medium"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                        data-testid={`prereq-rate-solid-${step.step}`}
                      >
                        Solid
                      </button>
                    </div>
                  </div>

                  {/* Key Concepts */}
                  {step.keyConcepts && step.keyConcepts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {step.keyConcepts.map((concept, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[11px] font-normal">
                          {concept}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Recommended Textbooks / Reading Order */}
                  {step.recommendedTextbooks && step.recommendedTextbooks.length > 0 && (
                    <div className="rounded-md bg-muted/40 border border-border/60 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        Recommended Reading (Step {step.step} in Order)
                      </div>
                      <ul className="space-y-1.5">
                        {step.recommendedTextbooks.map((book, bIdx) => (
                          <li key={bIdx} className="text-xs flex flex-wrap items-baseline justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-foreground">{book.title}</span>
                              {book.authorOrSource && (
                                <span className="text-muted-foreground"> — {book.authorOrSource}</span>
                              )}
                              {book.chapters && (
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  {book.chapters}
                                </Badge>
                              )}
                            </div>
                            {book.url && (
                              <a
                                href={book.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
                              >
                                <span>Open Reference</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Self-Check Question & Toggleable Bridge Primer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
                    <p className="text-xs text-muted-foreground flex-1 min-w-[220px]">
                      <strong className="text-foreground">Self-Check:</strong> {step.diagnosticQuestion.question}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePrimer(step.step)}
                      className="h-7 text-xs gap-1 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                      data-testid={`button-prereq-primer-${step.step}`}
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>{primerOpen ? "Hide Bridge Primer" : "Read Bridge Primer & Answer"}</span>
                    </Button>
                  </div>

                  {primerOpen && (
                    <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 space-y-2 text-xs">
                      <div className="font-semibold text-indigo-300">
                        First-Principles Bridge Primer — {step.title}
                      </div>
                      <LessonMarkdown
                        text={step.bridgeSummary}
                        className="text-muted-foreground space-y-2 break-words"
                      />
                      <div className="pt-2 border-t border-indigo-500/20 text-muted-foreground">
                        <strong className="text-foreground">Self-Check Key:</strong>{" "}
                        <LessonMarkdown text={step.diagnosticQuestion.selfCheckCriteria} inline />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tailored Pathway Recommendation Banner */}
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                <Compass className="h-4 w-4" />
                {ratedCount === 0
                  ? "Tailored Learning Pathway: Rate your familiarity on the steps above"
                  : needPrimerCount > 0
                  ? `Tailored Pathway (${needPrimerCount} foundation${needPrimerCount > 1 ? "s" : ""} marked 'Need Primer')`
                  : rustyCount > 0
                  ? `Tailored Pathway (${rustyCount} foundation${rustyCount > 1 ? "s" : ""} marked 'Rusty')`
                  : `Tailored Pathway (All ${solidCount} foundations marked 'Solid')`}
              </div>
              <p className="text-xs text-muted-foreground">
                {ratedCount === 0
                  ? "Click 'Need Primer', 'Rusty', or 'Solid' on each prerequisite block to unlock your recommended study order and depth setting."
                  : needPrimerCount > 0
                  ? "Recommended approach: Read the expanded Bridge Primers and Step 1–2 textbook chapters above first, then study this course in Survey Mode (which places plain-English analogies and intuition above the formal derivations) and use the Feynman Blank Sheet inside each lesson to unpack new terms slowly."
                  : rustyCount > 0
                  ? "Recommended approach: Review the Self-Check keys above, use Standard Mode for full step-by-step concepts and worked examples, and pause at the Feynman Blank Sheet in each lesson to write out the key ideas in your own words."
                  : "You have strong prerequisite preparation. Dive straight into Stage 1 in Deep Mode for full mathematical derivations and frontier literature."}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {needPrimerCount > 0 && depthMode !== "survey" && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onSelectDepthMode("survey")}
                  className="text-xs h-8"
                  data-testid="button-prereq-switch-survey"
                >
                  Switch to Survey (Intuition First)
                </Button>
              )}
              {needPrimerCount === 0 && rustyCount > 0 && depthMode !== "standard" && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onSelectDepthMode("standard")}
                  className="text-xs h-8"
                >
                  Switch to Standard Mode
                </Button>
              )}
              {ratedCount > 0 && needPrimerCount === 0 && rustyCount === 0 && depthMode !== "deep" && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onSelectDepthMode("deep")}
                  className="text-xs h-8"
                >
                  Switch to Deep Mode
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
