import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Sparkles, Clock, Loader2, Check, X, GripVertical, Brain, Code, Calculator, Beaker, Atom, Book, Music, Wrench, Rocket, Leaf, FlaskConical, Lightbulb } from "lucide-react";

interface Topic {
  id: number;
  title: string;
  description: string;
  difficulty: string;
}

interface SuggestedTopic {
  topicId: number;
  order: number;
  isRequired: boolean;
  reason: string;
  topic: Topic;
}

interface AISuggestions {
  suggestedTopics: SuggestedTopic[];
  estimatedHours: number;
  difficulty: string;
  icon: string;
  color: string;
}

const iconMap: Record<string, typeof Brain> = {
  Brain, Code, Calculator, Beaker, Atom, Book, Music, Wrench, Rocket, Leaf, Flask: FlaskConical, Lightbulb,
};

const colorMap: Record<string, string> = {
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  lime: "bg-lime-500",
  rose: "bg-rose-500",
  gray: "bg-gray-500",
};

export function CreateCustomPathwayDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "suggestions" | "review">("form");
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [learningGoals, setLearningGoals] = useState("");
  
  const [suggestions, setSuggestions] = useState<AISuggestions | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Map<number, { order: number; isRequired: boolean }>>(new Map());

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pathways/suggest-topics", {
        name,
        description,
        learningGoals: learningGoals || undefined,
      });
      return res.json();
    },
    onSuccess: (data: AISuggestions) => {
      setSuggestions(data);
      const topicsMap = new Map<number, { order: number; isRequired: boolean }>();
      data.suggestedTopics.forEach((st) => {
        topicsMap.set(st.topicId, { order: st.order, isRequired: st.isRequired });
      });
      setSelectedTopics(topicsMap);
      setStep("suggestions");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to get AI suggestions. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!suggestions) return;
      const topics = Array.from(selectedTopics.entries()).map(([topicId, data]) => ({
        topicId,
        order: data.order,
        isRequired: data.isRequired,
      }));

      const res = await apiRequest("POST", "/api/pathways/create", {
        name,
        description,
        icon: suggestions.icon,
        color: suggestions.color,
        difficulty: suggestions.difficulty,
        estimatedHours: suggestions.estimatedHours,
        topics,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pathways"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/pathways"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/custom-pathways"] });
      toast({
        title: "Pathway Created!",
        description: "Your custom learning pathway is ready.",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create pathway. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setOpen(false);
    setStep("form");
    setName("");
    setDescription("");
    setLearningGoals("");
    setSuggestions(null);
    setSelectedTopics(new Map());
  };

  const toggleTopic = (topicId: number, topic: SuggestedTopic) => {
    const newSelected = new Map(selectedTopics);
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId);
    } else {
      newSelected.set(topicId, { order: topic.order, isRequired: topic.isRequired });
    }
    setSelectedTopics(newSelected);
  };

  const toggleRequired = (topicId: number) => {
    const current = selectedTopics.get(topicId);
    if (current) {
      const newSelected = new Map(selectedTopics);
      newSelected.set(topicId, { ...current, isRequired: !current.isRequired });
      setSelectedTopics(newSelected);
    }
  };

  const isFormValid = name.trim().length > 0 && description.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="btn-create-custom-pathway">
          <Sparkles className="h-4 w-4 mr-2" />
          Create Custom Pathway
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "form" && "Create Your Custom Pathway"}
            {step === "suggestions" && "AI Suggested Topics"}
            {step === "review" && "Review Your Pathway"}
          </DialogTitle>
          <DialogDescription>
            {step === "form" && "Describe what you want to learn and AI will suggest topics for your personalized pathway."}
            {step === "suggestions" && "Select the topics you want to include in your pathway."}
            {step === "review" && "Finalize your custom learning pathway."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pathway-name">Pathway Name</Label>
              <Input
                id="pathway-name"
                placeholder="e.g., Web Development Fundamentals"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-pathway-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pathway-description">Description</Label>
              <Textarea
                id="pathway-description"
                placeholder="Describe what this pathway is about..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                data-testid="input-pathway-description"
              />
              <p className="text-xs text-muted-foreground">Minimum 10 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="learning-goals">Learning Goals (Optional)</Label>
              <Textarea
                id="learning-goals"
                placeholder="What do you want to achieve with this pathway?"
                value={learningGoals}
                onChange={(e) => setLearningGoals(e.target.value)}
                rows={2}
                data-testid="input-learning-goals"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose} data-testid="btn-cancel">
                Cancel
              </Button>
              <Button
                onClick={() => suggestMutation.mutate()}
                disabled={!isFormValid || suggestMutation.isPending}
                data-testid="btn-get-suggestions"
              >
                {suggestMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Get AI Suggestions
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "suggestions" && suggestions && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-md">
              {suggestions.icon && iconMap[suggestions.icon] && (
                <div className={`p-2 rounded-md ${colorMap[suggestions.color] || "bg-blue-500"}`}>
                  {(() => {
                    const Icon = iconMap[suggestions.icon] || Brain;
                    return <Icon className="h-5 w-5 text-white" />;
                  })()}
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-medium">{name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">{suggestions.difficulty}</Badge>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    ~{suggestions.estimatedHours}h
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Suggested Topics ({suggestions.suggestedTopics.length})</Label>
              <p className="text-xs text-muted-foreground">
                Select the topics you want to include. Toggle "Required" to mark essential topics.
              </p>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {suggestions.suggestedTopics.map((st) => (
                <div
                  key={st.topicId}
                  className={`p-3 rounded-md border transition-colors ${
                    selectedTopics.has(st.topicId) 
                      ? "border-primary bg-primary/5" 
                      : "border-border bg-muted/30"
                  }`}
                  data-testid={`suggested-topic-${st.topicId}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedTopics.has(st.topicId)}
                      onCheckedChange={() => toggleTopic(st.topicId, st)}
                      data-testid={`checkbox-topic-${st.topicId}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{st.topic.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {st.topic.difficulty}
                        </Badge>
                        {selectedTopics.has(st.topicId) && (
                          <Button
                            variant={selectedTopics.get(st.topicId)?.isRequired ? "default" : "outline"}
                            size="sm"
                            className="h-5 text-xs px-2"
                            onClick={() => toggleRequired(st.topicId)}
                            data-testid={`btn-required-${st.topicId}`}
                          >
                            {selectedTopics.get(st.topicId)?.isRequired ? "Required" : "Optional"}
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{st.topic.description}</p>
                      <p className="text-xs text-primary/80 mt-1">{st.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {suggestions.suggestedTopics.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No matching topics found. Try adjusting your pathway description.</p>
              </div>
            )}

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("form")} data-testid="btn-back">
                Back
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={selectedTopics.size === 0 || createMutation.isPending}
                data-testid="btn-create-pathway"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Pathway ({selectedTopics.size} topics)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
