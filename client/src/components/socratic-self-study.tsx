import { useState, useMemo, useEffect } from "react";
import { HelpCircle, ChevronDown, ChevronUp, Sparkles, Eye, EyeOff, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LessonMarkdown } from "@/components/lesson-markdown";
import type { LessonContent } from "@shared/schema";

interface SocraticSelfStudyProps {
  unitId: number;
  unitTitle: string;
  lessonContent: LessonContent;
  defaultOpen?: boolean;
  onContinueWithAiSocratic: (prompt: string) => void;
}

interface SocraticPrompt {
  id: number;
  question: string;
  hint: string;
}

function buildOfflineSocraticPrompts(unitTitle: string, content: LessonContent): SocraticPrompt[] {
  const prompts: SocraticPrompt[] = [];

  // 1. First-principles orientation from analogy
  if (content.analogy) {
    prompts.push({
      id: 1,
      question: `Before checking any formula, what physical or logical tension makes "${unitTitle}" necessary — and where does the intuitive analogy break down?`,
      hint: content.analogy.slice(0, 320) + (content.analogy.length > 320 ? "…" : ""),
    });
  }

  // 2. Probing questions derived from key takeaways
  const takeaways = content.keyTakeaways || [];
  takeaways.slice(0, 2).forEach((kt, idx) => {
    const cleanLead = kt.replace(/\*\*([^*]+)\*\*/g, "$1").split(/[.:—]/)[0]?.trim() || unitTitle;
    prompts.push({
      id: prompts.length + 1,
      question:
        idx === 0
          ? `If someone challenged the claim about "${cleanLead.slice(0, 95)}", what first-principles argument or limiting case would prove it must hold?`
          : `What happens if you push the assumptions behind "${cleanLead.slice(0, 95)}" to an extreme (zero, infinity, or boundary failure)?`,
      hint: kt,
    });
  });

  // 3. Probing question from worked example
  if (content.example?.content) {
    prompts.push({
      id: prompts.length + 1,
      question: `In "${content.example.title || "the worked example"}", which single parameter dominates the behavior — and how would the outcome shift if you doubled it?`,
      hint: content.example.content.slice(0, 320) + (content.example.content.length > 320 ? "…" : ""),
    });
  }

  return prompts.slice(0, 4);
}

export function SocraticSelfStudy({
  unitId,
  unitTitle,
  lessonContent,
  defaultOpen = false,
  onContinueWithAiSocratic,
}: SocraticSelfStudyProps) {
  const storageKey = `synapse_socratic_unit_${unitId}`;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});
  const [reflections, setReflections] = useState<Record<number, string>>({});

  const prompts = useMemo(
    () => buildOfflineSocraticPrompts(unitTitle, lessonContent),
    [unitTitle, lessonContent],
  );

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen, unitId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setReflections(raw ? JSON.parse(raw) : {});
    } catch {
      setReflections({});
    }
    setRevealedHints({});
  }, [storageKey]);

  if (prompts.length === 0) return null;

  const updateReflection = (id: number, val: string) => {
    setReflections((prev) => {
      const next = { ...prev, [id]: val };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  return (
    <Card className="border-indigo-500/30 bg-indigo-500/5" data-testid="section-socratic-self-study">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <HelpCircle className="h-4 w-4 text-indigo-400 shrink-0" />
              <span>Socratic Self-Study Prompts</span>
              <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-400">
                Free · No AI Key Needed
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Practice the Socratic Method at your own pace: wrestle with each probing question first, jot down your reasoning, then reveal the guiding hint — or continue live with the AI Socratic Tutor.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen((v) => !v)}
            className="h-7 text-xs gap-1 shrink-0"
            data-testid="button-toggle-socratic-cards"
          >
            <span>{isOpen ? "Hide Prompts" : `Open ${prompts.length} Prompts`}</span>
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-3 pt-2">
          {prompts.map((p, idx) => {
            const shown = !!revealedHints[p.id];
            return (
              <div
                key={p.id}
                className="rounded-lg border border-border/70 bg-background/85 p-3 space-y-2"
                data-testid={`socratic-card-${p.id}`}
              >
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[11px] font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-sm font-medium text-foreground leading-snug">{p.question}</p>
                </div>
                <Textarea
                  value={reflections[p.id] || ""}
                  onChange={(e) => updateReflection(p.id, e.target.value)}
                  placeholder="Write your hypothesis or reasoning before peeking at the hint (auto-saved)..."
                  rows={2}
                  className="text-xs bg-background min-h-[60px]"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRevealedHints((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className="h-7 text-xs gap-1"
                  >
                    {shown ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{shown ? "Hide Guiding Anchor" : "Reveal Guiding Anchor"}</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-indigo-400 hover:text-indigo-300"
                    onClick={() => {
                      const ans = (reflections[p.id] || "").trim();
                      const draft = ans
                        ? `Guide me Socratically on "${unitTitle}". Question: ${p.question}\n\nMy current thinking: ${ans}\n\nChallenge my reasoning with one probing follow-up question rather than giving away the answer.`
                        : `Guide me Socratically on "${unitTitle}". Start by questioning me on: ${p.question}`;
                      onContinueWithAiSocratic(draft);
                    }}
                  >
                    <MessageCircle className="h-3 w-3" />
                    <span>Discuss with AI Socratic Tutor</span>
                  </Button>
                </div>
                {shown && (
                  <div className="rounded-md border border-indigo-500/30 bg-indigo-500/10 p-2.5 text-xs text-muted-foreground">
                    <div className="font-semibold text-indigo-300 mb-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Guiding Anchor from Lesson
                    </div>
                    <LessonMarkdown text={p.hint} className="space-y-1 text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
