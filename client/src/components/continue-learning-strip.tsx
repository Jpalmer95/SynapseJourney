import { useQuery } from "@tanstack/react-query";
import { Play, BookOpen, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Topic, Category, LessonUnit } from "@shared/schema";
import { cn } from "@/lib/utils";

export interface ContinueItem {
  topic: Topic;
  category?: Category;
  lastUnitId: number | null;
  nextUnit: LessonUnit | null;
  completedUnits: number;
  totalUnits: number;
  progressPercent: number;
  lastAccessedAt: string | Date | null;
  depthMode: string | null;
}

interface ContinueLearningStripProps {
  onContinue: (topic: Topic, category?: Category, unitId?: number) => void;
  className?: string;
}

export function ContinueLearningStrip({ onContinue, className }: ContinueLearningStripProps) {
  const { data: items, isLoading } = useQuery<ContinueItem[]>({
    queryKey: ["/api/learn/continue"],
    staleTime: 30_000,
  });

  if (isLoading || !items || items.length === 0) return null;

  return (
    <section className={cn("w-full px-4 pt-3 pb-1", className)} data-testid="continue-learning-strip">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Continue learning
        </h2>
        <span className="text-xs text-muted-foreground">{items.length} in progress</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin">
        {items.map((item) => (
          <Card
            key={item.topic.id}
            className="min-w-[260px] max-w-[280px] snap-start border-border/60 bg-card/80 backdrop-blur shrink-0"
          >
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.topic.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.nextUnit?.title || "Resume course"}
                  </p>
                </div>
                {item.depthMode && (
                  <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                    {item.depthMode.replace("_", " ")}
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <Progress value={item.progressPercent} className="h-1.5" />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {item.completedUnits}/{item.totalUnits}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="h-3 w-3" />
                    {item.progressPercent}%
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full h-8"
                onClick={() =>
                  onContinue(item.topic, item.category, item.nextUnit?.id ?? item.lastUnitId ?? undefined)
                }
                data-testid={`button-continue-topic-${item.topic.id}`}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Resume
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
