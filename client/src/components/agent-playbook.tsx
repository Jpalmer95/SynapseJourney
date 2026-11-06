import { useState } from "react";
import { Copy, Check, Bot, Target, Wrench, AlertTriangle, Flag, Volume2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LessonMarkdown } from "@/components/lesson-markdown";
import { useTTS, type TTSSection } from "@/hooks/use-tts";
import { cn } from "@/lib/utils";

export interface PlaybookSection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  agentBrief?: string;
}

export interface AgentPlaybookContent {
  sections: PlaybookSection[];
}

const SECTION_ICONS: Record<string, typeof Bot> = {
  "Why this section exists": Bot,
  Objective: Target,
  "Definition of done": Flag,
  "Skills / tools your agent should load": Wrench,
  "Watch out for": AlertTriangle,
};

export function AgentPlaybookView({
  content,
  allSections,
  sectionIndexMap,
}: {
  content: AgentPlaybookContent;
  unitTitle?: string;
  allSections?: TTSSection[];
  sectionIndexMap?: Record<string, number>;
}) {
  const [copied, setCopied] = useState(false);
  const { currentSectionIndex, isSpeaking, speakSections, speak } = useTTS();

  const briefSection = content.sections.find((s) => s.agentBrief);

  const copyBrief = async () => {
    if (!briefSection?.agentBrief) return;
    try {
      await navigator.clipboard.writeText(briefSection.agentBrief);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = briefSection.agentBrief;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full" data-testid="agent-playbook">
      {content.sections.map((section, i) => {
        const Icon = SECTION_ICONS[section.heading] || Bot;
        const isBrief = !!section.agentBrief;
        const label = section.heading || `Section ${i + 1}`;
        const sectIdx = sectionIndexMap?.[label] ?? -1;
        const isActive = isSpeaking && sectIdx >= 0 && currentSectionIndex === sectIdx;

        const sectionSpokenText = [
          section.heading,
          ...(section.paragraphs || []),
          ...(section.list || []),
          section.agentBrief || "",
        ]
          .filter(Boolean)
          .join(". ");

        return (
          <section
            key={i}
            className={cn(
              "min-w-0 w-full transition-all",
              isActive && "border-l-2 border-primary pl-3 -ml-3"
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`h-5 w-5 shrink-0 ${isBrief ? "text-violet-400" : "text-primary"}`} />
              <h2 className="text-xl font-semibold flex-1">{section.heading}</h2>
              <button
                type="button"
                onClick={() => {
                  if (allSections && allSections.length > 0 && sectIdx >= 0) {
                    speakSections(allSections, sectIdx);
                  } else {
                    speak(sectionSpokenText);
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title="Listen to this section"
                data-testid={`button-tts-playbook-section-${i}`}
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>{isActive ? "Playing" : "Listen"}</span>
              </button>
              {isBrief && (
                <Button
                  size="sm"
                  variant={copied ? "default" : "outline"}
                  onClick={copyBrief}
                  className="shrink-0"
                  data-testid="button-copy-agent-brief"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy brief
                    </>
                  )}
                </Button>
              )}
            </div>

            {section.paragraphs && section.paragraphs.length > 0 && (
              <Card className="border-border/60 bg-card/40 mb-3">
                <CardContent className="p-4 sm:p-5 space-y-3">
                  {section.paragraphs.map((p, j) => (
                    <LessonMarkdown
                      key={j}
                      text={p}
                      className="text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]"
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {section.list && section.list.length > 0 && (
              <Card className="border-border/60 bg-card/60 mb-3">
                <CardContent className="p-4">
                  <ul className="space-y-2">
                    {section.list.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <LessonMarkdown
                          text={item}
                          className="text-muted-foreground break-words [overflow-wrap:anywhere]"
                        />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {isBrief && (
              <Card className="border-violet-500/30 bg-violet-500/5">
                <CardContent className="p-4">
                  <pre className="whitespace-pre-wrap break-words text-sm font-mono text-foreground/90 leading-relaxed">
                    {section.agentBrief}
                  </pre>
                </CardContent>
              </Card>
            )}
          </section>
        );
      })}
    </div>
  );
}
