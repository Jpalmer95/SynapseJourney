import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  ArrowRight,
  CheckCircle,
  Rocket,
  Brain,
  Code,
  FlaskConical,
  Calculator,
  Lightbulb,
  Zap,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Category, Topic } from "@shared/schema";

interface OnboardingProps {
  onComplete: () => void;
  onDive: (topic: Topic) => void;
}

const iconMap: Record<string, any> = {
  Brain: Brain,
  Calculator: Calculator,
  Code: Code,
  Beaker: FlaskConical,
  Lightbulb: Lightbulb,
  Zap: Zap,
  Rocket: Rocket,
  GraduationCap: GraduationCap,
};

const defaultSTEMCategories = [
  { name: "Artificial Intelligence", icon: "Brain", color: "purple" },
  { name: "Computer Science", icon: "Code", color: "green" },
  { name: "Mathematics", icon: "Calculator", color: "blue" },
  { name: "Science", icon: "Beaker", color: "orange" },
];

export function Onboarding({ onComplete, onDive }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  const { data: categories, isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: topics, isLoading: loadingTopics } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  const preferenceMutation = useMutation({
    mutationFn: async ({ categoryId, enabled }: { categoryId: number; enabled: boolean }) => {
      const res = await apiRequest("POST", "/api/user/preferences", { categoryId, enabled });
      return res.json();
    },
  });

  const handleCategoryToggle = (categoryId: number) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleNext = async () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (selectedCategories.length > 0 && categories) {
        await Promise.all(
          categories.map((cat) =>
            preferenceMutation.mutateAsync({
              categoryId: cat.id,
              enabled: selectedCategories.includes(cat.id),
            })
          )
        );
      }
      setStep(3);
    } else if (step === 3) {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed/personalized"] });
      onComplete();
    }
  };

  const handleSkip = async () => {
    if (categories && categories.length > 0) {
      try {
        await Promise.all(
          categories.map((cat) =>
            preferenceMutation.mutateAsync({
              categoryId: cat.id,
              enabled: true,
            })
          )
        );
      } catch (error) {
        console.error("Failed to set default preferences:", error);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    queryClient.invalidateQueries({ queryKey: ["/api/feed/personalized"] });
    onComplete();
  };

  const getIcon = (iconName: string) => {
    return iconMap[iconName] || Brain;
  };

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  if (loadingCategories || loadingTopics) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Curated starter topics: prefer ones matching the user's chosen interests,
  // else fall back to the first few topics. Tapping one dives straight into a
  // lesson (the roadmap A "take one lesson" step).
  const recommendedTopics = (() => {
    if (!topics) return [];
    const preferred = topics.filter(
      (t) =>
        selectedCategories.length === 0 ||
        (t.categoryId != null && selectedCategories.includes(t.categoryId))
    );
    return (preferred.length > 0 ? preferred : topics).slice(0, 8);
  })();

  return (
    <div className="min-h-screen w-full bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-16">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="secondary" className="text-xs">
              Step {step} of {totalSteps}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
              data-testid="button-skip-onboarding"
            >
              Skip for now
            </Button>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold">Welcome to Synapse</h1>
                <p className="text-lg text-muted-foreground max-w-md mx-auto">
                  Your personalized journey through knowledge awaits. Let's customize your learning experience.
                </p>
              </div>

              <div className="space-y-4">
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <GraduationCap className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Learn at your pace</h3>
                      <p className="text-sm text-muted-foreground">
                        Dive deep into topics that interest you with AI-powered lessons tailored to your level.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Earn XP and level up</h3>
                      <p className="text-sm text-muted-foreground">
                        Track your progress, earn achievements, and watch your knowledge grow.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Brain className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Connect ideas</h3>
                      <p className="text-sm text-muted-foreground">
                        Discover how different topics relate and build a web of interconnected knowledge.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handleNext}
                  className="min-w-[200px]"
                  data-testid="button-get-started"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold">What interests you?</h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Select the topics you'd like to explore. You can always change these later in settings.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(categories && categories.length > 0 ? categories : defaultSTEMCategories.map((c, i) => ({ ...c, id: i + 1 }))).map((category) => {
                  const isSelected = selectedCategories.includes(category.id);
                  const Icon = getIcon(category.icon);

                  return (
                    <Card
                      key={category.id}
                      className={cn(
                        "cursor-pointer transition-all hover-elevate",
                        isSelected && "border-primary bg-primary/10"
                      )}
                      onClick={() => handleCategoryToggle(category.id)}
                      data-testid={`category-${category.id}`}
                    >
                      <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center gap-3">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center",
                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}
                        >
                          {isSelected ? (
                            <CheckCircle className="h-6 w-6" />
                          ) : (
                            <Icon className="h-6 w-6" />
                          )}
                        </div>
                        <span className="font-medium text-sm sm:text-base">{category.name}</span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  data-testid="button-back"
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={handleNext}
                  disabled={selectedCategories.length === 0}
                  className="min-w-[150px]"
                  data-testid="button-continue"
                >
                  Continue
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold">Pick your first topic</h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Tap a topic to jump straight into your first lesson and earn your first badge. Or skip and browse your feed.
                </p>
              </div>

              <div className="space-y-3">
                {recommendedTopics.length > 0 ? (
                  recommendedTopics.map((topic) => (
                    <Card
                      key={topic.id}
                      className="cursor-pointer transition-all hover-elevate"
                      onClick={() => {
                        onDive(topic);
                        onComplete();
                      }}
                      data-testid={`onboarding-topic-${topic.id}`}
                    >
                      <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                        <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Sparkles className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{topic.title}</h3>
                            <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                              {topic.difficulty}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {topic.description}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-6 text-center">
                      <Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold mb-2">No topics loaded yet</h3>
                      <p className="text-sm text-muted-foreground">
                        Skip ahead and discover topics from your personalized feed.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  data-testid="button-back-step3"
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={handleNext}
                  className="min-w-[150px]"
                  data-testid="button-skip-to-feed"
                >
                  Skip — browse my feed
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
