import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  MessageCircle,
  CheckCircle,
  Circle,
  Lock,
  ChevronRight,
  Sparkles,
  BookOpen,
  Lightbulb,
  Zap,
  Brain,
  Trophy,
  Loader2,
  ArrowRight,
  X,
  Check,
  Rocket,
  FlaskConical,
  Compass,
  TrendingUp,
  Puzzle,
  ExternalLink,
  Heart,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AiChat } from "@/components/ai-chat";
import { TTSButton } from "@/components/tts-button";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Topic, Category, LessonContent, NextGenContent } from "@shared/schema";

interface LessonUnit {
  id: number;
  topicId: number;
  difficulty: string;
  unitIndex: number;
  title: string;
  outline?: string | null;
  contentJson?: LessonContent | null;
  progress?: {
    status: string;
    quizScore?: number | null;
  } | null;
  locked?: boolean;
}

interface TopicMastery {
  beginnerUnlocked: boolean;
  intermediateUnlocked: boolean;
  advancedUnlocked: boolean;
  nextgenUnlocked: boolean;
  beginnerCompleted: number;
  intermediateCompleted: number;
  advancedCompleted: number;
  nextgenCompleted: number;
}

interface LessonOutlineResponse {
  topic: Topic;
  units: LessonUnit[];
  mastery: TopicMastery;
  isAdmin?: boolean; // Admin status for bypass unlock requirements
}

interface RabbitHoleProps {
  topic: Topic;
  category?: Category;
  onBack: () => void;
}

const difficultyColors: Record<string, string> = {
  beginner: "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10",
  intermediate: "border-yellow-500/50 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10",
  advanced: "border-orange-500/50 text-orange-600 dark:text-orange-400 bg-orange-500/10",
  nextgen: "border-purple-500/50 text-purple-600 dark:text-purple-400 bg-purple-500/10",
};

const difficultyIcons: Record<string, any> = {
  beginner: Lightbulb,
  intermediate: BookOpen,
  advanced: Brain,
  nextgen: Sparkles,
};

export function RabbitHole({ topic, category, onBack }: RabbitHoleProps) {
  const [showChat, setShowChat] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<LessonUnit | null>(null);
  const [activeTab, setActiveTab] = useState("beginner");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const { toast } = useToast();

  // Fetch saved cards to check if this topic's card is saved
  const { data: savedTopics = [] } = useQuery<{ card: { id: number; topicId: number } }[]>({
    queryKey: ["/api/saved"],
  });

  // Find the card for this topic (if it exists)
  const { data: topicCards = [] } = useQuery<{ id: number }[]>({
    queryKey: ["/api/topics", topic.id, "cards"],
  });

  const mainCardId = topicCards[0]?.id;
  const isSaved = savedTopics.some(s => s.card.topicId === topic.id);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!mainCardId) return;
      if (isSaved) {
        const savedItem = savedTopics.find(s => s.card.topicId === topic.id);
        if (savedItem) {
          await apiRequest("DELETE", `/api/saved/${savedItem.card.id}`);
        }
      } else {
        await apiRequest("POST", "/api/saved", { cardId: mainCardId });
      }
    },
    onSuccess: () => {
      toast({
        title: isSaved ? "Topic removed" : "Topic saved!",
        description: isSaved ? "Removed from your collection" : "Find it in your saved collection",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/saved"] });
    },
  });

  // Fetch lesson outline
  const { data: lessonData, isLoading } = useQuery<LessonOutlineResponse>({
    queryKey: ["/api/lessons", topic.id, "outline"],
  });

  // Fetch lesson content when a unit is selected
  const { data: unitContent, isLoading: isLoadingContent } = useQuery<{
    unit: LessonUnit;
    content: LessonContent | NextGenContent;
    isNextGen?: boolean;
  }>({
    queryKey: ["/api/lessons/unit", selectedUnit?.id, "content"],
    enabled: !!selectedUnit && !selectedUnit.locked,
  });

  // Fetch user XP
  const { data: userXp } = useQuery<{ totalXp: number; level: number; progress: number }>({
    queryKey: ["/api/user/xp"],
  });

  // Use admin status from lesson data (already fetched with outline)
  const isAdmin = lessonData?.isAdmin ?? false;

  // Regenerate lesson content mutation (admin only)
  const regenerateMutation = useMutation({
    mutationFn: async (unitId: number) => {
      const res = await apiRequest("POST", `/api/admin/lessons/${unitId}/regenerate`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Content Regenerated",
          description: data.message || "The lesson content has been refreshed.",
        });
        // Invalidate the lesson content cache to show the new content
        queryClient.invalidateQueries({ queryKey: ["/api/lessons/unit", selectedUnit?.id, "content"] });
        // Reset quiz state for fresh content
        setQuizAnswers({});
        setQuizSubmitted(false);
      } else {
        // AI generation failed - original content preserved, can retry
        toast({
          title: "Regeneration Failed",
          description: data.retryable 
            ? "AI generation failed. Original content is preserved - click Regenerate to try again."
            : (data.message || "AI content generation failed."),
          variant: "destructive",
        });
        // Don't close lesson - admin can retry from current view
      }
    },
    onError: (error: any) => {
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate lesson content.",
        variant: "destructive",
      });
    },
  });

  // Batch generate all lesson content for topic (admin only)
  const batchGenerateMutation = useMutation({
    mutationFn: async ({ topicId, forceRegenerate = false }: { topicId: number; forceRegenerate?: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/topics/${topicId}/generate-batch`, { forceRegenerate });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Batch Generation Complete",
          description: data.message || `Generated content for ${data.generated} units`,
        });
        // Invalidate lesson data to refresh the content
        queryClient.invalidateQueries({ queryKey: ["/api/lessons", topic.id, "outline"] });
      } else {
        toast({
          title: "Batch Generation Failed",
          description: data.message || "Failed to generate content",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Batch generation error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to batch generate lesson content",
        variant: "destructive",
      });
    },
  });

  // Start lesson mutation
  const startLessonMutation = useMutation({
    mutationFn: async (unitId: number) => {
      const res = await apiRequest("POST", "/api/lessons/start", { unitId });
      return res.json();
    },
    onSuccess: (data: { progress: any; xpAwarded: number }) => {
      if (data.xpAwarded > 0) {
        setXpEarned((prev) => prev + data.xpAwarded);
        toast({
          title: `+${data.xpAwarded} XP`,
          description: "Started a new lesson!",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/lessons", topic.id, "outline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/xp"] });
    },
  });

  // Complete lesson mutation
  const completeLessonMutation = useMutation({
    mutationFn: async ({ unitId, quizScore }: { unitId: number; quizScore?: number }) => {
      const res = await apiRequest("POST", "/api/lessons/complete", { unitId, quizScore });
      return res.json();
    },
    onSuccess: (data: { progress: any; xpAwarded: number; mastery: any; message?: string }) => {
      setXpEarned((prev) => prev + data.xpAwarded);
      toast({
        title: `+${data.xpAwarded} XP`,
        description: data.message || "Lesson completed!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/lessons", topic.id, "outline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/xp"] });
      
      // Close content view and reset quiz state
      setSelectedUnit(null);
      setQuizAnswers({});
      setQuizSubmitted(false);
    },
  });

  const handleStartUnit = (unit: LessonUnit) => {
    if (unit.locked) {
      toast({
        title: "Lesson Locked",
        description: "Complete more lessons in the previous difficulty to unlock this level.",
        variant: "destructive",
      });
      return;
    }
    setSelectedUnit(unit);
    startLessonMutation.mutate(unit.id);
  };

  const handleSubmitQuiz = () => {
    const content = unitContent?.content;
    if (!content || !('quiz' in content) || !content.quiz) return;
    
    const quiz = content.quiz as LessonContent['quiz'];
    let correct = 0;
    quiz.forEach((q: LessonContent['quiz'][0], i: number) => {
      if (quizAnswers[i] === q.correctIndex) correct++;
    });
    
    const score = Math.round((correct / quiz.length) * 100);
    setQuizSubmitted(true);
    
    if (selectedUnit) {
      completeLessonMutation.mutate({ unitId: selectedUnit.id, quizScore: score });
    }
  };

  // Group units by difficulty
  const unitsByDifficulty = lessonData?.units.reduce((acc, unit) => {
    if (!acc[unit.difficulty]) acc[unit.difficulty] = [];
    acc[unit.difficulty].push(unit);
    return acc;
  }, {} as Record<string, LessonUnit[]>) || {};

  const mastery = lessonData?.mastery;
  
  const getProgressForDifficulty = (difficulty: string) => {
    const units = unitsByDifficulty[difficulty] || [];
    const completed = units.filter(u => u.progress?.status === "completed").length;
    return { completed, total: units.length, percentage: units.length > 0 ? (completed / units.length) * 100 : 0 };
  };

  const isTabLocked = (difficulty: string) => {
    // Admin bypass - all tabs unlocked
    if (isAdmin) return false;
    
    if (!mastery) return difficulty !== "beginner";
    switch (difficulty) {
      case "beginner": return !mastery.beginnerUnlocked;
      case "intermediate": return !mastery.intermediateUnlocked;
      case "advanced": return !mastery.advancedUnlocked;
      case "nextgen": return !mastery.nextgenUnlocked;
      default: return true;
    }
  };

  // Render content viewer
  if (selectedUnit && !selectedUnit.locked) {
    const content = unitContent?.content;
    const isNextGen = unitContent?.isNextGen || selectedUnit.difficulty === "nextgen";
    
    // Type guard for lesson vs nextgen content
    const lessonContent = !isNextGen ? (content as LessonContent) : null;
    const nextGenContent = isNextGen ? (content as NextGenContent) : null;
    
    return (
      <motion.div
        className="min-h-screen bg-background overflow-x-hidden max-w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border overflow-x-hidden">
          <div className="flex items-center gap-2 sm:gap-4 px-4 py-3 md:px-8 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedUnit(null);
                setQuizAnswers({});
                setQuizSubmitted(false);
              }}
              data-testid="button-back-to-outline"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <Badge 
                variant="outline" 
                className={cn("text-xs capitalize mb-1", difficultyColors[selectedUnit.difficulty as keyof typeof difficultyColors])}
              >
                {selectedUnit.difficulty}
              </Badge>
              <h1 className="text-lg font-semibold truncate">{selectedUnit.title}</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate()}
              className={cn("gap-1 sm:gap-2 shrink-0", isSaved && "text-red-500 border-red-500/50")}
              disabled={!mainCardId || saveMutation.isPending}
              data-testid="button-save-topic-lesson"
            >
              <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
              <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
            </Button>
            {isAdmin && selectedUnit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenerateMutation.mutate(selectedUnit.id)}
                className="gap-1 sm:gap-2 text-orange-600 border-orange-500/50 shrink-0"
                disabled={regenerateMutation.isPending}
                data-testid="button-regenerate-lesson"
              >
                <RefreshCw className={cn("h-4 w-4", regenerateMutation.isPending && "animate-spin")} />
                <span className="hidden sm:inline">Regenerate</span>
              </Button>
            )}
            {userXp && (
              <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 shrink-0">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Lvl {userXp.level}</span>
                {xpEarned > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    +{xpEarned} XP
                  </Badge>
                )}
              </div>
            )}
          </div>
        </header>

        <ScrollArea className="h-[calc(100vh-64px)] w-full overflow-x-hidden">
          <main className="max-w-3xl mx-auto px-4 py-8 md:px-8 overflow-x-hidden w-full">
            {isLoadingContent ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">
                  {isNextGen ? "Generating frontier research content..." : "Generating lesson content..."}
                </span>
              </div>
            ) : nextGenContent ? (
              /* Next Gen Content - Frontier Research View */
              <div className="space-y-8">
                {/* Header Badge */}
                <div className="flex items-center justify-center gap-4">
                  <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30 text-sm px-4 py-1">
                    <Rocket className="h-4 w-4 mr-2" />
                    Next Gen Analysis
                  </Badge>
                  <TTSButton
                    text={`${selectedUnit.title}. Research Context: ${nextGenContent.researchContext}. ${nextGenContent.industryChallenge ? `Industry Challenge: ${nextGenContent.industryChallenge.title}. ${nextGenContent.industryChallenge.description}` : ''}`}
                    showLabel
                    variant="outline"
                    size="sm"
                  />
                </div>

                {/* Research Context */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <FlaskConical className="h-5 w-5 text-purple-500" />
                    <h2 className="text-xl font-semibold">Research Context</h2>
                  </div>
                  <Card className="border-purple-500/20 overflow-hidden">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {nextGenContent.researchContext}
                      </p>
                    </CardContent>
                  </Card>
                </section>

                {/* Industry Challenge */}
                {nextGenContent.industryChallenge && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Rocket className="h-5 w-5 text-orange-500" />
                      <h2 className="text-xl font-semibold">Industry Challenge</h2>
                    </div>
                    <Card className="border-orange-500/20 bg-orange-500/5 overflow-hidden">
                      <CardContent className="p-4 sm:p-6 space-y-4">
                        <h3 className="font-semibold text-lg break-words [overflow-wrap:anywhere]">{nextGenContent.industryChallenge.title}</h3>
                        <p className="text-muted-foreground break-words [overflow-wrap:anywhere]">{nextGenContent.industryChallenge.description}</p>
                        
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-orange-600 dark:text-orange-400">Current Approaches:</h4>
                          <ul className="list-disc list-inside text-muted-foreground space-y-1">
                            {nextGenContent.industryChallenge.currentApproaches.map((approach: string, i: number) => (
                              <li key={i} className="break-words [overflow-wrap:anywhere]">{approach}</li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-orange-600 dark:text-orange-400">Open Questions:</h4>
                          <ul className="list-disc list-inside text-muted-foreground space-y-1">
                            {nextGenContent.industryChallenge.openQuestions.map((question: string, i: number) => (
                              <li key={i} className="italic break-words [overflow-wrap:anywhere]">{question}</li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Thought Exercises */}
                {nextGenContent.thoughtExercises && nextGenContent.thoughtExercises.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Compass className="h-5 w-5 text-blue-500" />
                      <h2 className="text-xl font-semibold">Thought Exercises</h2>
                    </div>
                    <div className="space-y-4">
                      {nextGenContent.thoughtExercises.map((exercise: any, i: number) => (
                        <Card key={i} className="border-blue-500/20 bg-blue-500/5 overflow-hidden">
                          <CardContent className="p-4 sm:p-6 space-y-4">
                            <p className="font-medium text-lg break-words [overflow-wrap:anywhere]">{exercise.prompt}</p>
                            
                            {exercise.hints && exercise.hints.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400">Hints to get started:</h4>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                  {exercise.hints.map((hint: string, j: number) => (
                                    <li key={j} className="break-words [overflow-wrap:anywhere]">{hint}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {exercise.explorationPaths && exercise.explorationPaths.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400">Exploration paths:</h4>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                  {exercise.explorationPaths.map((path: string, j: number) => (
                                    <li key={j} className="break-words [overflow-wrap:anywhere]">{path}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Emerging Trends */}
                {nextGenContent.emergingTrends && nextGenContent.emergingTrends.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      <h2 className="text-xl font-semibold">Emerging Trends</h2>
                    </div>
                    <div className="space-y-4">
                      {nextGenContent.emergingTrends.map((trend: any, i: number) => (
                        <Card key={i} className="border-green-500/20 bg-green-500/5 overflow-hidden">
                          <CardContent className="p-4 sm:p-6 space-y-3">
                            <h3 className="font-semibold break-words [overflow-wrap:anywhere]">{trend.trend}</h3>
                            <p className="text-muted-foreground text-sm break-words [overflow-wrap:anywhere]"><span className="font-medium">Implications:</span> {trend.implications}</p>
                            <p className="text-muted-foreground text-sm break-words [overflow-wrap:anywhere]"><span className="font-medium">Potential Breakthroughs:</span> {trend.potentialBreakthroughs}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Creative Synthesis */}
                {nextGenContent.creativeSynthesis && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Puzzle className="h-5 w-5 text-purple-500" />
                      <h2 className="text-xl font-semibold">Creative Synthesis Challenge</h2>
                    </div>
                    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-pink-500/10 overflow-hidden">
                      <CardContent className="p-4 sm:p-6 space-y-4">
                        <p className="font-medium text-lg break-words [overflow-wrap:anywhere]">{nextGenContent.creativeSynthesis.challenge}</p>
                        
                        {nextGenContent.creativeSynthesis.relatedConcepts && (
                          <div className="flex flex-wrap gap-2">
                            {nextGenContent.creativeSynthesis.relatedConcepts.map((concept: string, i: number) => (
                              <Badge key={i} variant="secondary">{concept}</Badge>
                            ))}
                          </div>
                        )}
                        
                        {nextGenContent.creativeSynthesis.suggestedConnections && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-purple-600 dark:text-purple-400">Suggested connections to explore:</h4>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                              {nextGenContent.creativeSynthesis.suggestedConnections.map((conn: string, i: number) => (
                                <li key={i} className="break-words [overflow-wrap:anywhere]">{conn}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Resources */}
                {nextGenContent.resources && nextGenContent.resources.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <ExternalLink className="h-5 w-5 text-muted-foreground" />
                      <h2 className="text-xl font-semibold">Further Resources</h2>
                    </div>
                    <div className="space-y-2">
                      {nextGenContent.resources.map((resource: any, i: number) => (
                        <Card key={i}>
                          <CardContent className="p-4 flex items-start gap-3">
                            <Badge variant="outline" className="text-xs shrink-0">{resource.type}</Badge>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium break-words [overflow-wrap:anywhere]">{resource.title}</p>
                              <p className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">{resource.description}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Mark Complete Button for Next Gen */}
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => selectedUnit && completeLessonMutation.mutate({ unitId: selectedUnit.id })}
                    disabled={completeLessonMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                    data-testid="button-complete-nextgen"
                  >
                    {completeLessonMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Mark as Explored
                  </Button>
                </div>

                {/* AI Chat Button */}
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowChat(true)}
                    data-testid="button-ask-ai-nextgen"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Discuss ideas with AI Tutor
                  </Button>
                </div>
              </div>
            ) : lessonContent ? (
              /* Standard Lesson Content View */
              <div className="space-y-8">
                {/* Listen Button - for driving or accessibility */}
                <div className="flex justify-center">
                  <TTSButton
                    text={`${selectedUnit.title}. ${lessonContent.concept}. Think of it like this: ${lessonContent.analogy}. ${lessonContent.example.title}. ${lessonContent.example.content}`}
                    showLabel
                    variant="outline"
                    size="default"
                  />
                </div>

                {/* Concept Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">Concept</h2>
                  </div>
                  <Card className="overflow-hidden">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {lessonContent.concept}
                      </p>
                    </CardContent>
                  </Card>
                </section>

                {/* Analogy Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    <h2 className="text-xl font-semibold">Think of it like...</h2>
                  </div>
                  <Card className="border-yellow-500/20 bg-yellow-500/5 overflow-hidden">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
                        {lessonContent.analogy}
                      </p>
                    </CardContent>
                  </Card>
                </section>

                {/* Example Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    <h2 className="text-xl font-semibold">{lessonContent.example.title}</h2>
                  </div>
                  <Card className="border-blue-500/20 bg-blue-500/5 overflow-hidden">
                    <CardContent className="p-4 sm:p-6 space-y-4">
                      <p className="text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
                        {lessonContent.example.content}
                      </p>
                      {lessonContent.example.code && (
                        <pre className="bg-muted p-3 sm:p-4 rounded-md overflow-x-auto text-xs sm:text-sm font-mono max-w-full">
                          {lessonContent.example.code}
                        </pre>
                      )}
                    </CardContent>
                  </Card>
                </section>

                {/* Cross-links Section */}
                {lessonContent.crossLinks && lessonContent.crossLinks.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-5 w-5 text-purple-500" />
                      <h2 className="text-xl font-semibold">Connections to What You Know</h2>
                    </div>
                    <div className="space-y-3">
                      {lessonContent.crossLinks.map((link, i) => (
                        <Card key={i} className="border-purple-500/20 bg-purple-500/5 overflow-hidden">
                          <CardContent className="p-3 sm:p-4">
                            <p className="font-medium text-purple-600 dark:text-purple-400 break-words">{link.topicTitle}</p>
                            <p className="text-sm text-muted-foreground mt-1 break-words">{link.connection}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Quiz Section */}
                {lessonContent.quiz && lessonContent.quiz.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Brain className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold">Check Your Understanding</h2>
                    </div>
                    <Card className="overflow-hidden">
                      <CardContent className="p-4 sm:p-6 space-y-6">
                        {lessonContent.quiz.map((q, qIndex) => (
                          <div key={qIndex} className="space-y-3">
                            <p className="font-medium break-words [overflow-wrap:anywhere]">
                              {qIndex + 1}. {q.question}
                            </p>
                            <RadioGroup
                              value={quizAnswers[qIndex]?.toString()}
                              onValueChange={(val) => setQuizAnswers(prev => ({ ...prev, [qIndex]: parseInt(val) }))}
                              disabled={quizSubmitted}
                            >
                              {q.options.map((option, oIndex) => (
                                <div 
                                  key={oIndex} 
                                  className={cn(
                                    "flex items-start space-x-3 p-3 rounded-md border transition-colors",
                                    quizSubmitted && oIndex === q.correctIndex && "bg-green-500/10 border-green-500/50",
                                    quizSubmitted && quizAnswers[qIndex] === oIndex && oIndex !== q.correctIndex && "bg-red-500/10 border-red-500/50",
                                    !quizSubmitted && "hover:bg-muted"
                                  )}
                                >
                                  <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}-o${oIndex}`} className="mt-0.5 shrink-0" />
                                  <Label htmlFor={`q${qIndex}-o${oIndex}`} className="flex-1 cursor-pointer break-words [overflow-wrap:anywhere] min-w-0">
                                    {option}
                                  </Label>
                                  {quizSubmitted && oIndex === q.correctIndex && (
                                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                                  )}
                                  {quizSubmitted && quizAnswers[qIndex] === oIndex && oIndex !== q.correctIndex && (
                                    <X className="h-4 w-4 text-red-500 shrink-0" />
                                  )}
                                </div>
                              ))}
                            </RadioGroup>
                            {quizSubmitted && (
                              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md break-words [overflow-wrap:anywhere]">
                                {q.explanation}
                              </p>
                            )}
                          </div>
                        ))}
                        
                        {!quizSubmitted && (
                          <Button 
                            onClick={handleSubmitQuiz}
                            disabled={Object.keys(quizAnswers).length < lessonContent.quiz.length}
                            className="w-full"
                            data-testid="button-submit-quiz"
                          >
                            Submit Answers
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* AI Chat Button */}
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowChat(true)}
                    data-testid="button-ask-ai"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Have questions? Ask the AI Tutor
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                Unable to load content. Please try again.
              </div>
            )}
          </main>
        </ScrollArea>

        <AnimatePresence>
          {showChat && <AiChat topic={topic} onClose={() => setShowChat(false)} />}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Render main outline view
  return (
    <motion.div
      className="min-h-screen bg-background"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-4 px-4 py-3 md:px-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {category && (
                <Badge variant="secondary" className="text-xs">
                  {category.name}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveMutation.mutate()}
                className={cn("h-7 gap-1.5 px-2", isSaved && "text-red-500 border-red-500/50")}
                disabled={!mainCardId || saveMutation.isPending}
                data-testid="button-save-topic-header"
              >
                <Heart className={cn("h-3.5 w-3.5", isSaved && "fill-current")} />
                <span className="text-xs">{isSaved ? "Saved" : "Save"}</span>
              </Button>
            </div>
            <h1 className="text-lg font-semibold truncate">{topic.title}</h1>
          </div>

          <div className="flex items-center gap-3">
            {userXp && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Lvl {userXp.level}</span>
                {xpEarned > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    +{xpEarned} XP
                  </Badge>
                )}
              </div>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowChat(true)}
              data-testid="button-open-ai-chat"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{topic.title}</h2>
            <p className="text-lg text-muted-foreground">{topic.description}</p>
            
            {/* Admin batch generation controls */}
            {isAdmin && (
              <div className="mt-4 flex flex-wrap items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">Admin:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => batchGenerateMutation.mutate({ topicId: topic.id })}
                  disabled={batchGenerateMutation.isPending}
                  className="gap-2 text-orange-600 border-orange-500/50"
                  data-testid="button-batch-generate"
                >
                  <Zap className={cn("h-4 w-4", batchGenerateMutation.isPending && "animate-pulse")} />
                  {batchGenerateMutation.isPending ? "Generating..." : "Batch Generate All Content"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => batchGenerateMutation.mutate({ topicId: topic.id, forceRegenerate: true })}
                  disabled={batchGenerateMutation.isPending}
                  className="gap-2 text-red-600 border-red-500/50"
                  data-testid="button-batch-regenerate"
                >
                  <RefreshCw className={cn("h-4 w-4", batchGenerateMutation.isPending && "animate-spin")} />
                  Force Regenerate All
                </Button>
              </div>
            )}
          </motion.div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading course outline...</span>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                {["beginner", "intermediate", "advanced", "nextgen"].map((diff) => {
                  const Icon = difficultyIcons[diff];
                  const locked = isTabLocked(diff);
                  const progress = getProgressForDifficulty(diff);
                  
                  return (
                    <TabsTrigger
                      key={diff}
                      value={diff}
                      disabled={locked}
                      className={cn("relative capitalize", locked && "opacity-50")}
                      data-testid={`tab-${diff}`}
                    >
                      <div className="flex items-center gap-2">
                        {locked ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">{diff === "nextgen" ? "Next Gen" : diff}</span>
                      </div>
                      {!locked && progress.total > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {progress.completed}/{progress.total}
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {["beginner", "intermediate", "advanced", "nextgen"].map((diff) => {
                const units = unitsByDifficulty[diff] || [];
                const progress = getProgressForDifficulty(diff);
                
                return (
                  <TabsContent key={diff} value={diff} className="space-y-4">
                    {progress.total > 0 && (
                      <div className="flex items-center gap-3 mb-6">
                        <Progress value={progress.percentage} className="flex-1 h-2" />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {progress.completed} of {progress.total} complete
                        </span>
                      </div>
                    )}
                    
                    {units.length === 0 ? (
                      <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
                          No lessons available yet. Check back soon!
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {units.map((unit, index) => {
                          const isCompleted = unit.progress?.status === "completed";
                          const isInProgress = unit.progress?.status === "in_progress";
                          
                          return (
                            <motion.div
                              key={unit.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                            >
                              <Card
                                className={cn(
                                  "cursor-pointer transition-all hover-elevate",
                                  unit.locked && "opacity-60 cursor-not-allowed",
                                  isCompleted && "border-green-500/30 bg-green-500/5"
                                )}
                                onClick={() => handleStartUnit(unit)}
                                data-testid={`unit-${unit.id}`}
                              >
                                <CardContent className="p-4 flex items-center gap-4">
                                  <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                    isCompleted ? "bg-green-500 text-white" :
                                    unit.locked ? "bg-muted text-muted-foreground" :
                                    "bg-primary/10 text-primary border border-primary/20"
                                  )}>
                                    {isCompleted ? (
                                      <CheckCircle className="h-5 w-5" />
                                    ) : unit.locked ? (
                                      <Lock className="h-4 w-4" />
                                    ) : (
                                      <span className="font-semibold">{index + 1}</span>
                                    )}
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-medium truncate">{unit.title}</h3>
                                    {unit.outline && (
                                      <p className="text-sm text-muted-foreground truncate">
                                        {unit.outline}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 shrink-0">
                                    {isInProgress && (
                                      <Badge variant="secondary" className="text-xs">
                                        In Progress
                                      </Badge>
                                    )}
                                    {isCompleted && unit.progress?.quizScore !== null && unit.progress?.quizScore !== undefined && (
                                      <Badge variant="outline" className="text-xs">
                                        {unit.progress.quizScore}%
                                      </Badge>
                                    )}
                                    {!unit.locked && (
                                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Unlock hint for locked tabs */}
                    {isTabLocked(diff) && diff !== "beginner" && (
                      <Card className={cn("border-dashed", diff === "nextgen" && "border-purple-500/30")}>
                        <CardContent className="p-6 text-center">
                          <Lock className={cn("h-8 w-8 mx-auto mb-3", diff === "nextgen" ? "text-purple-500" : "text-muted-foreground")} />
                          <p className="font-medium mb-1">
                            {diff === "nextgen" ? "Next Gen Analysis Locked" : "Level Locked"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {diff === "nextgen" 
                              ? "Complete 70% of Advanced lessons to unlock cutting-edge research challenges."
                              : `Complete 70% of ${diff === "intermediate" ? "Beginner" : diff === "advanced" ? "Intermediate" : "previous"} lessons to unlock.`}
                          </p>
                          {diff === "nextgen" && (
                            <p className="text-xs text-purple-500 mt-2">
                              Explore frontier research, industry challenges, and creative thinking.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showChat && <AiChat topic={topic} onClose={() => setShowChat(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
