import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Target, Sparkles, Play, Library, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("synapse-courses-collapsed") === "true");
  const { data: items, isLoading } = useQuery<MyCourseItem[]>({
    queryKey: ["/api/learn/my-courses"],
    staleTime: 20_000,
  });
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (topicId: number) => {
      await apiRequest("DELETE", `/api/learn/my-courses/${topicId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learn/my-courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/continue"] });
      toast({ title: "Course removed" });
    },
    onError: (err: any) => {
      toast({ title: "Could not remove course", description: err?.message, variant: "destructive" });
    },
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
    <section className={cn("w-full px-4 pt-2 pb-1", className)} data-testid="my-courses-strip">
      <div className="flex items-center justify-between mb-1">
        <button
          type="button"
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            localStorage.setItem("synapse-courses-collapsed", String(next));
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground transition-colors"
          aria-expanded={!collapsed}
          data-testid="button-toggle-courses"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", collapsed && "-rotate-90")} />
          <Library className="h-3.5 w-3.5" />
          My courses & goals
          {items && items.length > 0 && (
            <span className="normal-case text-[11px] font-normal text-muted-foreground/70">
              ({items.length})
            </span>
          )}
        </button>
        <Link href="/saved?tab=courses" className="text-xs text-primary hover:underline shrink-0">
          View all
        </Link>
      </div>
      {!collapsed && (
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {list.map((item) => (
          <Card
            key={item.topic.id}
            className="group min-w-[270px] max-w-[290px] snap-start border-border/60 bg-card/80 shrink-0 relative"
            data-testid={`my-course-card-${item.topic.id}`}
          >
            <button
              type="button"
              aria-label="Remove course"
              className="absolute top-2 right-2 z-10 p-1 rounded-md text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Remove "${item.topic.title}" and your progress on it?`)) {
                  deleteMutation.mutate(item.topic.id);
                }
              }}
              data-testid={`button-delete-course-${item.topic.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
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
      )}
    </section>
  );
}
