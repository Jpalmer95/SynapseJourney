import { Trophy, Sparkles, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CoursePosterData {
  title?: string;
  summary?: string;
  keyTakeaways?: string[];
  sections?: { tier?: string; title?: string; content?: string }[];
  visualStyle?: string;
  colorScheme?: string;
  celebrationMessage?: string;
  stats?: { unitsCompleted?: number; unitsTotal?: number; tiersCompleted?: number };
}

const schemeClasses: Record<string, string> = {
  "charcoal-rust": "from-zinc-900 via-zinc-800 to-orange-950 border-orange-700/40",
  ocean: "from-slate-900 via-cyan-950 to-blue-950 border-cyan-600/40",
  forest: "from-emerald-950 via-green-950 to-lime-950 border-emerald-600/40",
  sunset: "from-rose-950 via-orange-950 to-amber-950 border-rose-500/40",
  aurora: "from-indigo-950 via-purple-950 to-teal-950 border-violet-500/40",
};

interface CoursePosterProps {
  poster: CoursePosterData;
  topicTitle?: string;
  className?: string;
}

export function CoursePoster({ poster, topicTitle, className }: CoursePosterProps) {
  const scheme = poster.colorScheme || "charcoal-rust";
  const bg = schemeClasses[scheme] || schemeClasses["charcoal-rust"];

  return (
    <Card
      className={cn("overflow-hidden border-2 bg-gradient-to-br text-foreground", bg, className)}
      data-testid="course-completion-poster"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-amber-400">
          <Trophy className="h-5 w-5" />
          <span className="text-xs uppercase tracking-widest font-semibold">Course complete</span>
        </div>
        <CardTitle className="text-2xl md:text-3xl mt-1">
          {poster.title || topicTitle || "Your learning poster"}
        </CardTitle>
        {poster.celebrationMessage && (
          <p className="text-sm text-amber-100/90 mt-1 flex items-start gap-2">
            <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
            {poster.celebrationMessage}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {poster.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{poster.summary}</p>
        )}

        {poster.stats && (
          <div className="flex flex-wrap gap-2">
            {poster.stats.unitsCompleted != null && (
              <Badge variant="secondary">{poster.stats.unitsCompleted} units</Badge>
            )}
            {poster.stats.tiersCompleted != null && (
              <Badge variant="outline">{poster.stats.tiersCompleted} tiers</Badge>
            )}
            {poster.visualStyle && (
              <Badge variant="outline" className="capitalize">{poster.visualStyle}</Badge>
            )}
          </div>
        )}

        {poster.keyTakeaways && poster.keyTakeaways.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Key takeaways</h3>
            <ul className="space-y-1.5">
              {poster.keyTakeaways.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {poster.sections && poster.sections.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {poster.sections.map((s, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  {s.title || s.tier || `Section ${i + 1}`}
                </p>
                <p className="text-sm">{s.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
