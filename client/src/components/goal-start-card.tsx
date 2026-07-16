import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Target, Loader2, Sparkles, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Topic, Category } from "@shared/schema";

interface GoalStartCardProps {
  onStart: (topic: Topic, category?: Category) => void;
}

export function GoalStartCard({ onStart }: GoalStartCardProps) {
  const [goal, setGoal] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (goalText: string) => {
      const res = await apiRequest("POST", "/api/learn/goal", { goalText });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/learn/continue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/goals"] });
      toast({
        title: "Goal path ready",
        description: `Built a practical path for: ${data.topic?.title || "your goal"}`,
      });
      if (data.topic) {
        onStart(data.topic, data.category);
      }
      setGoal("");
    },
    onError: (err: any) => {
      toast({
        title: "Could not build goal path",
        description: err?.message || "Try again with a clearer goal. If this persists, add an AI API key in Settings (BYOC).",
        variant: "destructive",
      });
    },
  });

  const examples = [
    "Pass a backend interview",
    "Ship a Gradio demo on Hugging Face",
    "Understand transformers enough to fine-tune",
  ];

  return (
    <Card className="mx-4 mb-3 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background" data-testid="goal-start-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/15">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Goal mode</h3>
            <p className="text-xs text-muted-foreground">
              Tell us what you need to accomplish — get a tight path, not a textbook.
            </p>
          </div>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (goal.trim().length < 5 || mutation.isPending) return;
            mutation.mutate(goal.trim());
          }}
        >
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Deploy my first Next.js app to production"
            className="h-9 text-sm"
            data-testid="input-learning-goal"
          />
          <Button type="submit" size="sm" className="h-9 shrink-0" disabled={mutation.isPending || goal.trim().length < 5}>
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Rocket className="h-3.5 w-3.5 mr-1" />
                Go
              </>
            )}
          </Button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setGoal(ex)}
              className="text-[11px] px-2 py-1 rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors inline-flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" />
              {ex}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
