import { useQuery } from "@tanstack/react-query";
import { BookOpen, Target, Sparkles, Play, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Topic, Category, LearningGoal } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export interface MyCourseItem {
  topic: Topic;
  category?: Category;
  source: "goal" | "hermes" | "progress" | "prefs";
  goal?: LearningGoal;
  completedUnits: number;
  totalUnits: number;
  progressPercent: number;
  lastAccessedAt: string | Date | null;
  depthMode: string | null;
  status: string;
}

interface MyCoursesStripProps {
  onOpen: (topic: Topic, category?: Category) => void;
  className?: string;
  limit?: number;
}

const sourceLabel: Record<MyCourseItem["source"], string> = {
  hermes: "Hermes",
  goal: "Goal",
  progress: "In progress",
  prefs: "Yours",
};

export function MyCoursesStrip({ onOpen, className, limit = 8 }: MyCoursesStripProps) {
  const { data: items, isLoading } = useQuery<MyCourseItem[]>({
    queryKey: ["/api/learn/my-courses"],
    staleTime: 20_000,
  });

  const list = (items || []).slice(0, limit);

  if (isLoading) {
    return (
      <section className={cn("w-full px-4 pt-3 pb-1", className)} data-testid="my-courses-strip-loading">
        <div className="h-20 rounded-lg bg-muted/40 animate-pulse" />
      </section>
    );
  }

  if (list.length === 0) return null;

  return (
    <section className={cn("w-full px-4 pt-3 pb-1", className)} data-testid="my-courses-strip">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase inline-flex items-center gap-1.5">
          <Library className="h-3.5 w-3.5" />
          My courses & goals
        </h2>
        <Link href="/saved?tab=courses" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {list.map((item) => (
          <Card
            key={item.topic.id}
            className="min-w-[270px] max-w-[290px] snap-start border-border/60 bg-card/80 shrink-0"
            data-testid={`my-course-card-${item.topic.id}`}
          >
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm leading-snug line-clamp-2">{item.topic.title}</p>
                  {item.goal?.goalText && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                      {item.goal.goalText}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] shrink-0",
                    item.source === "hermes" && "border-violet-500/40 text-violet-300",
                    item.source === "goal" && "border-amber-500/40 text-amber-200",
                  )}
                >
                  {item.source === "hermes" ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Sparkles className="h-2.5 w-2.5" /> Hermes
                    </span>
                  ) : item.source === "goal" ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Target className="h-2.5 w-2.5" /> Goal
                    </span>
                  ) : (
                    sourceLabel[item.source]
                  )}
                </Badge>
              </div>
              <div className="space-y-1">
                <Progress value={item.progressPercent} className="h-1.5" />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {item.completedUnits}/{item.totalUnits} units
                  </span>
                  <span className="capitalize">{item.status}</span>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full h-8"
                onClick={() => onOpen(item.topic, item.category)}
                data-testid={`button-open-course-${item.topic.id}`}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                {item.progressPercent > 0 ? "Continue" : "Open course"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
