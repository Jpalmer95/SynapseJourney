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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AiChat } from "@/components/ai-chat";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Topic, Category } from "@shared/schema";

interface RoadmapLevel {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  completed: boolean;
  content?: string;
}

interface RabbitHoleProps {
  topic: Topic;
  category?: Category;
  onBack: () => void;
}

const levelIcons = [Lightbulb, BookOpen, Brain, Zap, Sparkles];

export function RabbitHole({ topic, category, onBack }: RabbitHoleProps) {
  const [showChat, setShowChat] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const [activeLevel, setActiveLevel] = useState<number | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const { toast } = useToast();

  const { data: roadmap, isLoading } = useQuery<{ levels: { levels: RoadmapLevel[] } | RoadmapLevel[] }>({
    queryKey: ["/api/roadmap", topic.id],
  });

  const { data: userXp } = useQuery<{ totalXp: number; level: number; progress: number }>({
    queryKey: ["/api/user/xp"],
  });

  const addXpMutation = useMutation({
    mutationFn: async ({ topicId, amount }: { topicId: number; amount: number }) => {
      return apiRequest("POST", "/api/user/xp", { topicId, amount });
    },
    onSuccess: (_, variables) => {
      setXpEarned((prev) => prev + variables.amount);
      queryClient.invalidateQueries({ queryKey: ["/api/user/xp"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
    },
  });

  const handleStartLevel = (levelId: number) => {
    if (activeLevel === levelId) return;
    
    setActiveLevel(levelId);
    addXpMutation.mutate({ topicId: topic.id, amount: 5 });
    toast({
      title: "+5 XP",
      description: `Started learning ${levels.find((l) => l.id === levelId)?.title}`,
    });
  };

  // Handle both nested {levels: {levels: [...]}} and flat {levels: [...]} structures
  const extractLevels = (): RoadmapLevel[] => {
    if (!roadmap?.levels) return [];
    // Check if levels is nested (API returns {levels: {levels: [...]}})
    if (Array.isArray(roadmap.levels)) {
      return roadmap.levels;
    }
    if (roadmap.levels && typeof roadmap.levels === 'object' && 'levels' in roadmap.levels) {
      return (roadmap.levels as { levels: RoadmapLevel[] }).levels || [];
    }
    return [];
  };

  const levels: RoadmapLevel[] = extractLevels().length > 0 ? extractLevels() : [
    {
      id: 1,
      title: "The Basics",
      description: "Understand the fundamental concepts",
      difficulty: "beginner",
      completed: false,
      content: "Start with a simple explanation that anyone can understand. This level introduces core vocabulary and basic principles.",
    },
    {
      id: 2,
      title: "Core Concepts",
      description: "Dive deeper into the main ideas",
      difficulty: "intermediate",
      completed: false,
      content: "Now we explore the underlying mechanisms and relationships between concepts.",
    },
    {
      id: 3,
      title: "Real-World Applications",
      description: "See how it applies in practice",
      difficulty: "intermediate",
      completed: false,
      content: "Discover how these concepts manifest in everyday scenarios and professional contexts.",
    },
    {
      id: 4,
      title: "Advanced Topics",
      description: "Master the complexities",
      difficulty: "advanced",
      completed: false,
      content: "Challenge yourself with nuanced aspects and edge cases that require deeper understanding.",
    },
    {
      id: 5,
      title: "Expert Insights",
      description: "Explore cutting-edge developments",
      difficulty: "expert",
      completed: false,
      content: "Connect with the latest research and innovations in this field.",
    },
  ];

  const completedCount = levels.filter((l) => l.completed).length;
  const progress = (completedCount / levels.length) * 100;

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
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {completedCount}/{levels.length}
              </span>
              <Progress value={progress} className="w-24 h-2" />
            </div>
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

      <div className="flex flex-col lg:flex-row">
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{topic.title}</h2>
              <p className="text-lg text-muted-foreground">{topic.description}</p>
            </motion.div>

            <div className="md:hidden mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground">
                  Progress: {completedCount}/{levels.length} levels
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Learning Path
              </h3>

              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

                {levels.map((level, index) => {
                  const LevelIcon = levelIcons[index % levelIcons.length];
                  const isExpanded = expandedLevel === level.id;
                  const isLocked = index > 0 && !levels[index - 1].completed;

                  return (
                    <motion.div
                      key={level.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative pl-14 pb-6"
                    >
                      <div
                        className={cn(
                          "absolute left-4 w-5 h-5 rounded-full flex items-center justify-center z-10",
                          level.completed
                            ? "bg-primary text-primary-foreground"
                            : isLocked
                            ? "bg-muted text-muted-foreground"
                            : "bg-background border-2 border-primary"
                        )}
                      >
                        {level.completed ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : isLocked ? (
                          <Lock className="h-3 w-3" />
                        ) : (
                          <Circle className="h-3 w-3 text-primary" />
                        )}
                      </div>

                      <Card
                        className={cn(
                          "cursor-pointer transition-all",
                          isLocked && "opacity-60",
                          isExpanded && "ring-2 ring-primary"
                        )}
                        onClick={() => !isLocked && setExpandedLevel(isExpanded ? null : level.id)}
                        data-testid={`level-${level.id}`}
                      >
                        <CardHeader className="py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-md bg-muted">
                                <LevelIcon className="h-4 w-4" />
                              </div>
                              <div>
                                <CardTitle className="text-base">
                                  Level {index + 1}: {level.title}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {level.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs capitalize",
                                  level.difficulty === "beginner" && "border-green-500/50 text-green-600 dark:text-green-400",
                                  level.difficulty === "intermediate" && "border-yellow-500/50 text-yellow-600 dark:text-yellow-400",
                                  level.difficulty === "advanced" && "border-orange-500/50 text-orange-600 dark:text-orange-400",
                                  level.difficulty === "expert" && "border-red-500/50 text-red-600 dark:text-red-400"
                                )}
                              >
                                {level.difficulty}
                              </Badge>
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform",
                                  isExpanded && "rotate-90"
                                )}
                              />
                            </div>
                          </div>
                        </CardHeader>

                        <AnimatePresence>
                          {isExpanded && level.content && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <CardContent className="pt-0 pb-4">
                                <p className="text-muted-foreground leading-relaxed">
                                  {level.content}
                                </p>
                                <div className="flex items-center gap-2 mt-4">
                                  <Button 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartLevel(level.id);
                                    }}
                                    disabled={activeLevel === level.id}
                                    data-testid={`button-start-level-${level.id}`}
                                  >
                                    {activeLevel === level.id ? (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        In Progress
                                      </>
                                    ) : (
                                      "Start Learning"
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowChat(true);
                                    }}
                                    data-testid={`button-ask-ai-level-${level.id}`}
                                  >
                                    <MessageCircle className="h-4 w-4 mr-1" />
                                    Ask AI
                                  </Button>
                                  <Badge variant="secondary" className="text-xs">
                                    +5 XP
                                  </Badge>
                                </div>
                              </CardContent>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        <aside className="hidden xl:block w-80 border-l border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Related Topics</h3>
          <div className="space-y-2">
            <Card className="hover-elevate cursor-pointer">
              <CardContent className="p-4">
                <p className="font-medium">Graph Theory</p>
                <p className="text-sm text-muted-foreground">Mathematics</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate cursor-pointer">
              <CardContent className="p-4">
                <p className="font-medium">Neural Networks</p>
                <p className="text-sm text-muted-foreground">Computer Science</p>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {showChat && (
          <AiChat
            topic={topic}
            onClose={() => setShowChat(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
