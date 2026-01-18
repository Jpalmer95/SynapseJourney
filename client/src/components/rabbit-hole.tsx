import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Topic, Category, LessonContent } from "@shared/schema";

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
  beginnerCompleted: number;
  intermediateCompleted: number;
  advancedCompleted: number;
}

interface LessonOutlineResponse {
  topic: Topic;
  units: LessonUnit[];
  mastery: TopicMastery;
}

interface RabbitHoleProps {
  topic: Topic;
  category?: Category;
  onBack: () => void;
}

const difficultyColors = {
  beginner: "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10",
  intermediate: "border-yellow-500/50 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10",
  advanced: "border-orange-500/50 text-orange-600 dark:text-orange-400 bg-orange-500/10",
};

const difficultyIcons = {
  beginner: Lightbulb,
  intermediate: BookOpen,
  advanced: Brain,
};

export function RabbitHole({ topic, category, onBack }: RabbitHoleProps) {
  const [showChat, setShowChat] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<LessonUnit | null>(null);
  const [activeTab, setActiveTab] = useState("beginner");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const { toast } = useToast();

  // Fetch lesson outline
  const { data: lessonData, isLoading } = useQuery<LessonOutlineResponse>({
    queryKey: ["/api/lessons", topic.id, "outline"],
  });

  // Fetch lesson content when a unit is selected
  const { data: unitContent, isLoading: isLoadingContent } = useQuery<{
    unit: LessonUnit;
    content: LessonContent;
  }>({
    queryKey: ["/api/lessons/unit", selectedUnit?.id, "content"],
    enabled: !!selectedUnit && !selectedUnit.locked,
  });

  // Fetch user XP
  const { data: userXp } = useQuery<{ totalXp: number; level: number; progress: number }>({
    queryKey: ["/api/user/xp"],
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
    if (!unitContent?.content.quiz) return;
    
    const quiz = unitContent.content.quiz;
    let correct = 0;
    quiz.forEach((q, i) => {
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
    if (!mastery) return difficulty !== "beginner";
    switch (difficulty) {
      case "beginner": return !mastery.beginnerUnlocked;
      case "intermediate": return !mastery.intermediateUnlocked;
      case "advanced": return !mastery.advancedUnlocked;
      default: return true;
    }
  };

  // Render content viewer
  if (selectedUnit && !selectedUnit.locked) {
    const content = unitContent?.content;
    
    return (
      <motion.div
        className="min-h-screen bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="flex items-center gap-4 px-4 py-3 md:px-8">
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
            {userXp && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
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

        <ScrollArea className="h-[calc(100vh-64px)]">
          <main className="max-w-3xl mx-auto px-4 py-8 md:px-8">
            {isLoadingContent ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Generating lesson content...</span>
              </div>
            ) : content ? (
              <div className="space-y-8">
                {/* Concept Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">Concept</h2>
                  </div>
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {content.concept}
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
                  <Card className="border-yellow-500/20 bg-yellow-500/5">
                    <CardContent className="p-6">
                      <p className="text-muted-foreground leading-relaxed">
                        {content.analogy}
                      </p>
                    </CardContent>
                  </Card>
                </section>

                {/* Example Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    <h2 className="text-xl font-semibold">{content.example.title}</h2>
                  </div>
                  <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardContent className="p-6 space-y-4">
                      <p className="text-muted-foreground leading-relaxed">
                        {content.example.content}
                      </p>
                      {content.example.code && (
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono">
                          {content.example.code}
                        </pre>
                      )}
                    </CardContent>
                  </Card>
                </section>

                {/* Cross-links Section */}
                {content.crossLinks && content.crossLinks.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-5 w-5 text-purple-500" />
                      <h2 className="text-xl font-semibold">Connections to What You Know</h2>
                    </div>
                    <div className="space-y-3">
                      {content.crossLinks.map((link, i) => (
                        <Card key={i} className="border-purple-500/20 bg-purple-500/5">
                          <CardContent className="p-4">
                            <p className="font-medium text-purple-600 dark:text-purple-400">{link.topicTitle}</p>
                            <p className="text-sm text-muted-foreground mt-1">{link.connection}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Quiz Section */}
                {content.quiz && content.quiz.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Brain className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold">Check Your Understanding</h2>
                    </div>
                    <Card>
                      <CardContent className="p-6 space-y-6">
                        {content.quiz.map((q, qIndex) => (
                          <div key={qIndex} className="space-y-3">
                            <p className="font-medium">
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
                                    "flex items-center space-x-3 p-3 rounded-md border transition-colors",
                                    quizSubmitted && oIndex === q.correctIndex && "bg-green-500/10 border-green-500/50",
                                    quizSubmitted && quizAnswers[qIndex] === oIndex && oIndex !== q.correctIndex && "bg-red-500/10 border-red-500/50",
                                    !quizSubmitted && "hover:bg-muted"
                                  )}
                                >
                                  <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}-o${oIndex}`} />
                                  <Label htmlFor={`q${qIndex}-o${oIndex}`} className="flex-1 cursor-pointer">
                                    {option}
                                  </Label>
                                  {quizSubmitted && oIndex === q.correctIndex && (
                                    <Check className="h-4 w-4 text-green-500" />
                                  )}
                                  {quizSubmitted && quizAnswers[qIndex] === oIndex && oIndex !== q.correctIndex && (
                                    <X className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                              ))}
                            </RadioGroup>
                            {quizSubmitted && (
                              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                                {q.explanation}
                              </p>
                            )}
                          </div>
                        ))}
                        
                        {!quizSubmitted && (
                          <Button 
                            onClick={handleSubmitQuiz}
                            disabled={Object.keys(quizAnswers).length < content.quiz.length}
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
          </motion.div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading course outline...</span>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                {["beginner", "intermediate", "advanced"].map((diff) => {
                  const Icon = difficultyIcons[diff as keyof typeof difficultyIcons];
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
                        <span className="hidden sm:inline">{diff}</span>
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

              {["beginner", "intermediate", "advanced"].map((diff) => {
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
                      <Card className="border-dashed">
                        <CardContent className="p-6 text-center">
                          <Lock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                          <p className="font-medium mb-1">Level Locked</p>
                          <p className="text-sm text-muted-foreground">
                            Complete 70% of {diff === "intermediate" ? "Beginner" : "Intermediate"} lessons to unlock.
                          </p>
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
