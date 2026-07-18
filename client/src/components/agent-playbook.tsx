import { useState } from "react";
import { Copy, Check, Bot, Target, Wrench, AlertTriangle, Flag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PlaybookSection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  agentBrief?: string;
}

interface AgentPlaybookContent {
  sections: PlaybookSection[];
}

const SECTION_ICONS: Record<string, typeof Bot> = {
  "Why this section exists": Bot,
  Objective: Target,
  "Definition of done": Flag,
  "Skills / tools your agent should load": Wrench,
  "Watch out for": AlertTriangle,
};

export function AgentPlaybookView({ content }: { content: AgentPlaybookContent; unitTitle?: string }) {
  const [copied, setCopied] = useState(false);

  const briefSection = content.sections.find((s) => s.agentBrief);

  const copyBrief = async () => {
    if (!briefSection?.agentBrief) return;
    try {
      await navigator.clipboard.writeText(briefSection.agentBrief);
    } catch {
      // Clipboard API fallback (older browsers / insecure contexts)
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
        return (
          <section key={i} className="min-w-0 w-full">
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`h-5 w-5 shrink-0 ${isBrief ? "text-violet-400" : "text-primary"}`} />
              <h2 className="text-xl font-semibold flex-1">{section.heading}</h2>
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

            {section.paragraphs?.map((p, j) => (
              <p key={j} className="text-muted-foreground leading-relaxed mb-3 break-words">
                {p}
              </p>
            ))}

            {section.list && (
              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <ul className="space-y-2">
                    {section.list.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground break-words">{item}</span>
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
