import { useState, useCallback, useMemo } from "react";
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
  Key,
  ShoppingCart,
  Gift,
  Copy,
  Coffee,
  Wallet,
  Star,
  Send,
  Users,
  ChevronDown,
  ChevronUp,
  Video,
  GraduationCap,
  FileText,
  Globe,
  Wrench,
  AlertTriangle,
  Coins,
  Play,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { useTTS, type TTSSection } from "@/hooks/use-tts";
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
  keyUnlocked?: boolean;
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

const DOGE_WALLET = "DQqGoxU66iTj6tHdSMRU61r3Rxhv6e9T8w";

function DogeWalletCopy() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(DOGE_WALLET);
      setCopied(true);
      toast({ title: "Copied!", description: "Wallet address copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy the address manually", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wallet className="h-3.5 w-3.5 shrink-0" />
        <span>Or send directly to DOGE wallet:</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="text-xs flex-1 truncate select-all p-2 rounded-md bg-muted border">{DOGE_WALLET}</code>
        <Button
          variant="outline"
          size="icon"
          onClick={copyAddress}
          data-testid="modal-copy-wallet-address"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function AdminPurchaseApprovals() {
  const { toast } = useToast();
  const { data: pending = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/keys/pending"],
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ requestId, approved }: { requestId: number; approved: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/keys/resolve/${requestId}`, { approved });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({ title: variables.approved ? "Purchase Approved" : "Purchase Rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/keys/pending"] });
    },
  });

  if (pending.length === 0) return null;

  return (
    <div className="border-t pt-4 space-y-2">
      <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Pending Purchase Requests ({pending.length})</p>
      {pending.map((req: any) => (
        <div key={req.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{req.username || "User"}</p>
            <p className="text-xs text-muted-foreground">{req.quantity} keys ({req.dogeAmount} DOGE)</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolveMutation.mutate({ requestId: req.id, approved: true })}
              disabled={resolveMutation.isPending}
              className="gap-1 text-green-600 border-green-500/50"
              data-testid={`button-approve-${req.id}`}
            >
              <Check className="h-3 w-3" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolveMutation.mutate({ requestId: req.id, approved: false })}
              disabled={resolveMutation.isPending}
              className="gap-1 text-red-600 border-red-500/50"
              data-testid={`button-reject-${req.id}`}
            >
              <X className="h-3 w-3" />
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RabbitHole({ topic, category, onBack }: RabbitHoleProps) {
  const [showChat, setShowChat] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<LessonUnit | null>(null);
  const [activeTab, setActiveTab] = useState("beginner");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [showResources, setShowResources] = useState(false);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [showIdeaForm, setShowIdeaForm] = useState(false);
  const [justSubmittedIdea, setJustSubmittedIdea] = useState(false);
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

  // Fetch user's unlock keys
  const { data: keysData } = useQuery<{
    totalKeys: number;
    usedKeys: number;
    availableKeys: number;
    earnProgress: {
      topicsCompletedToday: number;
      topicsNeeded: number;
      alreadyEarnedToday: boolean;
      qualifyingTopics: number[];
    };
  }>({
    queryKey: ["/api/keys"],
  });

  const useKeyMutation = useMutation({
    mutationFn: async (topicId: number) => {
      const res = await apiRequest("POST", `/api/keys/use/${topicId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Topic Unlocked!", description: "All difficulty levels are now available." });
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lessons", topic.id, "outline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lessons/unit"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to unlock", description: err.message || "Could not use key", variant: "destructive" });
    },
  });

  const [showBuyKeys, setShowBuyKeys] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState(1);

  const purchaseMutation = useMutation({
    mutationFn: async (quantity: number) => {
      const res = await apiRequest("POST", "/api/keys/purchase", { quantity });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Purchase Request Submitted", description: "Your request is pending admin approval. Send your Dogecoin payment and we'll approve it shortly." });
      setShowBuyKeys(false);
      setBuyQuantity(1);
      queryClient.invalidateQueries({ queryKey: ["/api/keys/purchases"] });
    },
    onError: (err: any) => {
      toast({ title: "Purchase Failed", description: err.message || "Could not submit purchase", variant: "destructive" });
    },
  });

  // Fetch ideas for this topic (used in NextGen Idea Board)
  const { data: topicIdeas = [] } = useQuery<{
    id: number;
    userId: string;
    username?: string;
    title: string;
    description: string;
    submittedAt: string;
  }[]>({
    queryKey: ["/api/topics", topic.id, "ideas"],
  });

  // Fetch user's Nova Coins balance
  const { data: novaCoinsData } = useQuery<{
    id: number;
    userId: string;
    totalCoins: number;
    updatedAt: string;
  } | null>({
    queryKey: ["/api/user/nova-coins"],
  });

  // Submit idea mutation
  const submitIdeaMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/topics/${topic.id}/ideas`, {
        title: ideaTitle,
        description: ideaDescription,
        unitId: selectedUnit?.id,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Pioneer Idea Submitted!",
        description: `You earned 1 Nova Coin! Your idea has been timestamped and attributed to you.`,
      });
      setIdeaTitle("");
      setIdeaDescription("");
      setShowIdeaForm(false);
      setJustSubmittedIdea(true);
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topic.id, "ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/nova-coins"] });
    },
    onError: (err: any) => {
      toast({ title: "Submission Failed", description: err.message || "Could not submit idea", variant: "destructive" });
    },
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
    if (isAdmin) return false;
    if (mastery?.keyUnlocked) return false;
    
    if (!mastery) return difficulty !== "beginner";
    switch (difficulty) {
      case "beginner": return !mastery.beginnerUnlocked;
      case "intermediate": return !mastery.intermediateUnlocked;
      case "advanced": return !mastery.advancedUnlocked;
      case "nextgen": return !mastery.nextgenUnlocked;
      default: return true;
    }
  };

  // TTS section-level state shared with TTSButton via context
  const { currentSectionIndex, speakSections } = useTTS();

  // Build ordered sections from lesson content for section-by-section listening
  const lessonSections = useMemo((): TTSSection[] => {
    const content = unitContent?.content;
    if (!content || unitContent?.isNextGen) return [];
    const lc = content as LessonContent;
    const sects: TTSSection[] = [];
    if (lc.keyTakeaways?.length) {
      sects.push({ label: "Key Takeaways", text: lc.keyTakeaways.join(". ") });
    }
    if (lc.concept) sects.push({ label: "Concept", text: lc.concept });
    if (lc.analogy) sects.push({ label: "Analogy", text: lc.analogy });
    if (lc.example?.content) {
      sects.push({ label: lc.example.title || "Example", text: lc.example.content });
    }
    return sects;
  }, [unitContent]);

  // Map section labels to indices for quick highlight lookup
  const sectionIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    lessonSections.forEach((s, i) => { map[s.label] = i; });
    return map;
  }, [lessonSections]);

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
          <main className="max-w-3xl mx-auto px-4 py-8 md:px-8 overflow-hidden w-full box-border">
            {isLoadingContent ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">
                  {isNextGen ? "Generating frontier research content..." : "Generating lesson content..."}
                </span>
              </div>
            ) : nextGenContent ? (
              /* Next Gen Content - Frontier Research View */
              <div className="space-y-8 w-full min-w-0 max-w-full">
                {/* Header Badge */}
                <div className="flex items-center justify-center gap-4">
                  <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30 text-sm px-4 py-1">
                    <Rocket className="h-4 w-4 mr-2" />
                    Next Gen Analysis
                  </Badge>
                  <TTSButton
                    text={`${selectedUnit.title}. Research Context: ${nextGenContent.researchContext}. ${nextGenContent.industryChallenge ? `Industry Challenge: ${nextGenContent.industryChallenge.title}. ${nextGenContent.industryChallenge.description}` : ''}`}
                    unitId={selectedUnit.id}
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

                {/* Open Roadblocks */}
                {(nextGenContent as any).openRoadblocks && (nextGenContent as any).openRoadblocks.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <h2 className="text-xl font-semibold">Open Roadblocks</h2>
                      <Badge variant="destructive" className="text-xs">Unsolved</Badge>
                    </div>
                    <div className="space-y-4">
                      {(nextGenContent as any).openRoadblocks.map((roadblock: any, i: number) => (
                        <Card key={i} className="border-red-500/20 bg-red-500/5 overflow-hidden" data-testid={`card-roadblock-${i}`}>
                          <CardContent className="p-4 sm:p-6 space-y-3">
                            <h3 className="font-semibold break-words [overflow-wrap:anywhere] text-red-700 dark:text-red-400">{roadblock.title}</h3>
                            <p className="text-muted-foreground text-sm break-words [overflow-wrap:anywhere]">{roadblock.description}</p>
                            {roadblock.whyItMatters && (
                              <div className="bg-red-500/10 rounded-md p-3">
                                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Why solving this matters:</p>
                                <p className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">{roadblock.whyItMatters}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Resources (with links) */}
                {nextGenContent.resources && nextGenContent.resources.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <ExternalLink className="h-5 w-5 text-emerald-500" />
                      <h2 className="text-xl font-semibold">Research Resources</h2>
                    </div>
                    <div className="space-y-2">
                      {nextGenContent.resources.map((resource: any, i: number) => (
                        <Card key={i} className="hover:border-emerald-500/50 transition-colors" data-testid={`card-nextgen-resource-${i}`}>
                          <CardContent className="p-4 flex items-start gap-3">
                            <Badge variant="outline" className="text-xs shrink-0">{resource.type}</Badge>
                            <div className="min-w-0 flex-1">
                              {resource.url ? (
                                <a href={resource.url} target="_blank" rel="noopener noreferrer"
                                  className="font-medium break-words [overflow-wrap:anywhere] hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1">
                                  {resource.title}
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              ) : (
                                <p className="font-medium break-words [overflow-wrap:anywhere]">{resource.title}</p>
                              )}
                              <p className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">{resource.description}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Community Forums */}
                {(nextGenContent as any).communityForums && (nextGenContent as any).communityForums.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="h-5 w-5 text-blue-500" />
                      <h2 className="text-xl font-semibold">Community & Discussions</h2>
                    </div>
                    <div className="space-y-2">
                      {(nextGenContent as any).communityForums.map((forum: any, i: number) => (
                        <Card key={i} className="border-blue-500/20 bg-blue-500/5 hover:border-blue-500/50 transition-colors" data-testid={`card-forum-${i}`}>
                          <CardContent className="p-4 flex items-start gap-3">
                            <Users className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              {forum.url ? (
                                <a href={forum.url} target="_blank" rel="noopener noreferrer"
                                  className="font-medium break-words [overflow-wrap:anywhere] hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1">
                                  {forum.name}
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              ) : (
                                <p className="font-medium break-words [overflow-wrap:anywhere]">{forum.name}</p>
                              )}
                              <p className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">{forum.description}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Pioneer Idea Board */}
                <section className="min-w-0 w-full" data-testid="section-idea-board">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="h-5 w-5 text-amber-500 shrink-0" />
                    <h2 className="text-xl font-semibold">Pioneer Idea Board</h2>
                    <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs border-amber-500/30">Nova Coins</Badge>
                  </div>

                  {/* Nova Coin Balance */}
                  {novaCoinsData !== undefined && (
                    <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Coins className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="text-sm font-medium">Your Nova Coins: <span className="text-amber-600 dark:text-amber-400 font-bold">{novaCoinsData?.totalCoins ?? 0}</span></span>
                      <span className="text-xs text-muted-foreground ml-auto">(valueless — for attribution only)</span>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    Submit an original research idea or theoretical direction. Each submission is timestamped and permanently attributed to you. You earn 1 Nova Coin per idea — they have no monetary value, but represent your Pioneer status in this community of knowledge builders.
                  </p>

                  {/* Submitted Ideas */}
                  {topicIdeas.length > 0 && (
                    <div className="space-y-3 mb-4">
                      <p className="text-sm font-medium text-muted-foreground">{topicIdeas.length} community idea{topicIdeas.length !== 1 ? "s" : ""} submitted for this topic:</p>
                      {topicIdeas.map((idea) => (
                        <Card key={idea.id} className="border-amber-500/20 bg-amber-500/5" data-testid={`card-idea-${idea.id}`}>
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm break-words [overflow-wrap:anywhere]">{idea.title}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">Pioneer</Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">{idea.description}</p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span className="font-medium" data-testid={`text-idea-author-${idea.id}`}>
                                  {idea.username || "Anonymous Pioneer"}
                                </span>
                                <span>·</span>
                                <span>{new Date(idea.submittedAt).toLocaleDateString()}</span>
                              </span>
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Coins className="h-3 w-3" />
                                <span>+1 Nova Coin</span>
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Submit Idea Form */}
                  {justSubmittedIdea ? (
                    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-yellow-500/10">
                      <CardContent className="p-6 text-center space-y-2">
                        <Sparkles className="h-8 w-8 text-amber-500 mx-auto" />
                        <p className="font-semibold text-amber-700 dark:text-amber-400">Pioneer Attribution Recorded!</p>
                        <p className="text-sm text-muted-foreground">Your idea has been timestamped and attributed to you. You earned 1 Nova Coin.</p>
                        <Button variant="outline" size="sm" onClick={() => setJustSubmittedIdea(false)} data-testid="button-submit-another">
                          Submit Another Idea
                        </Button>
                      </CardContent>
                    </Card>
                  ) : showIdeaForm ? (
                    <Card className="border-amber-500/20">
                      <CardContent className="p-4 sm:p-6 space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Idea Title</label>
                          <Input
                            placeholder="A concise title for your research idea..."
                            value={ideaTitle}
                            onChange={(e) => setIdeaTitle(e.target.value)}
                            data-testid="input-idea-title"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Description</label>
                          <Textarea
                            placeholder="Describe your original idea, theoretical direction, or novel research approach in detail..."
                            value={ideaDescription}
                            onChange={(e) => setIdeaDescription(e.target.value)}
                            rows={5}
                            data-testid="textarea-idea-description"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => submitIdeaMutation.mutate()}
                            disabled={submitIdeaMutation.isPending || ideaTitle.trim().length < 5 || ideaDescription.trim().length < 20}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                            data-testid="button-submit-idea"
                          >
                            {submitIdeaMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Submit & Claim Attribution
                          </Button>
                          <Button variant="outline" onClick={() => setShowIdeaForm(false)} data-testid="button-cancel-idea">
                            Cancel
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Nova Coins are valueless — they exist only to record your Pioneer attribution.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Button
                      className="w-full border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                      variant="outline"
                      onClick={() => setShowIdeaForm(true)}
                      data-testid="button-show-idea-form"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Submit a Pioneer Idea (+1 Nova Coin)
                    </Button>
                  )}
                </section>

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
              <div className="space-y-8 w-full min-w-0 max-w-full">
                {/* Listen Button / Audio Player */}
                <div className="flex justify-center">
                  <TTSButton
                    text={`${selectedUnit.title}. ${lessonContent.concept}. Think of it like this: ${lessonContent.analogy}. ${lessonContent.example.title}. ${lessonContent.example.content}`}
                    unitId={selectedUnit.id}
                    showLabel
                    variant="outline"
                    size="default"
                    sections={lessonSections}
                    className={lessonSections.length > 0 ? "w-full" : undefined}
                  />
                </div>

                {/* Key Takeaways Section */}
                {lessonContent.keyTakeaways && lessonContent.keyTakeaways.length > 0 && (() => {
                  const ktIdx = sectionIndexMap["Key Takeaways"] ?? -1;
                  const ktActive = ktIdx >= 0 && currentSectionIndex === ktIdx;
                  return (
                  <section
                    className={cn("min-w-0 w-full group transition-all", ktActive && "border-l-2 border-primary pl-3 -ml-3")}
                    data-testid="section-key-takeaways"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="h-5 w-5 text-amber-500 shrink-0" />
                      <h2 className="text-xl font-semibold flex-1">Key Takeaways</h2>
                      {lessonSections.length > 0 && ktIdx >= 0 && (
                        <button
                          onClick={() => speakSections(lessonSections, ktIdx)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Listen from here"
                          data-testid="button-tts-section-takeaways"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <Card className="border-amber-500/20 bg-amber-500/5 overflow-hidden w-full">
                      <CardContent className="p-4 sm:p-5 overflow-hidden">
                        <ul className="space-y-2">
                          {lessonContent.keyTakeaways.map((takeaway: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm" data-testid={`text-takeaway-${i}`}>
                              <Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                              <span className="text-muted-foreground break-words [overflow-wrap:anywhere]">{takeaway}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </section>
                  );
                })()}

                {/* Concept Section */}
                {(() => {
                  const cIdx = sectionIndexMap["Concept"] ?? -1;
                  const cActive = cIdx >= 0 && currentSectionIndex === cIdx;
                  return (
                  <section className={cn("min-w-0 w-full group transition-all", cActive && "border-l-2 border-primary pl-3 -ml-3")}>
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="h-5 w-5 text-primary shrink-0" />
                      <h2 className="text-xl font-semibold flex-1">Concept</h2>
                      {lessonSections.length > 0 && cIdx >= 0 && (
                        <button
                          onClick={() => speakSections(lessonSections, cIdx)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Listen from here"
                          data-testid="button-tts-section-concept"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <Card className="overflow-hidden w-full">
                      <CardContent className="p-4 sm:p-6 overflow-hidden">
                        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]">
                          {lessonContent.concept}
                        </p>
                      </CardContent>
                    </Card>
                  </section>
                  );
                })()}

                {/* Analogy Section */}
                {(() => {
                  const aIdx = sectionIndexMap["Analogy"] ?? -1;
                  const aActive = aIdx >= 0 && currentSectionIndex === aIdx;
                  return (
                  <section className={cn("min-w-0 w-full group transition-all", aActive && "border-l-2 border-primary pl-3 -ml-3")}>
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="h-5 w-5 text-yellow-500 shrink-0" />
                      <h2 className="text-xl font-semibold flex-1">Think of it like...</h2>
                      {lessonSections.length > 0 && aIdx >= 0 && (
                        <button
                          onClick={() => speakSections(lessonSections, aIdx)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Listen from here"
                          data-testid="button-tts-section-analogy"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <Card className="border-yellow-500/20 bg-yellow-500/5 overflow-hidden w-full">
                      <CardContent className="p-4 sm:p-6 overflow-hidden">
                        <p className="text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word]">
                          {lessonContent.analogy}
                        </p>
                      </CardContent>
                    </Card>
                  </section>
                  );
                })()}

                {/* Example Section */}
                {(() => {
                  const exLabel = lessonContent.example.title || "Example";
                  const exIdx = sectionIndexMap[exLabel] ?? -1;
                  const exActive = exIdx >= 0 && currentSectionIndex === exIdx;
                  return (
                  <section className={cn("min-w-0 w-full group transition-all", exActive && "border-l-2 border-primary pl-3 -ml-3")}>
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="h-5 w-5 text-blue-500 shrink-0" />
                      <h2 className="text-xl font-semibold break-words [overflow-wrap:anywhere] flex-1">{lessonContent.example.title}</h2>
                      {lessonSections.length > 0 && exIdx >= 0 && (
                        <button
                          onClick={() => speakSections(lessonSections, exIdx)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                          title="Listen from here"
                          data-testid="button-tts-section-example"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <Card className="border-blue-500/20 bg-blue-500/5 overflow-hidden w-full">
                      <CardContent className="p-4 sm:p-6 space-y-4 overflow-hidden">
                        <p className="text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word]">
                          {lessonContent.example.content}
                        </p>
                        {lessonContent.example.code && (
                          <div className="overflow-x-auto max-w-full">
                            <pre className="bg-muted p-3 sm:p-4 rounded-md text-xs sm:text-sm font-mono min-w-0">
                              {lessonContent.example.code}
                            </pre>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </section>
                  );
                })()}

                {/* Cross-links Section */}
                {lessonContent.crossLinks && lessonContent.crossLinks.length > 0 && (
                  <section className="min-w-0 w-full">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-5 w-5 text-purple-500 shrink-0" />
                      <h2 className="text-xl font-semibold">Connections to What You Know</h2>
                    </div>
                    <div className="space-y-3">
                      {lessonContent.crossLinks.map((link, i) => (
                        <Card key={i} className="border-purple-500/20 bg-purple-500/5 overflow-hidden w-full">
                          <CardContent className="p-3 sm:p-4 overflow-hidden">
                            <p className="font-medium text-purple-600 dark:text-purple-400 break-words [overflow-wrap:anywhere] [word-break:break-word]">{link.topicTitle}</p>
                            <p className="text-sm text-muted-foreground mt-1 break-words [overflow-wrap:anywhere] [word-break:break-word]">{link.connection}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Quiz Section */}
                {lessonContent.quiz && lessonContent.quiz.length > 0 && (
                  <section className="min-w-0 w-full">
                    <div className="flex items-center gap-2 mb-4">
                      <Brain className="h-5 w-5 text-primary shrink-0" />
                      <h2 className="text-xl font-semibold">Check Your Understanding</h2>
                    </div>
                    <Card className="overflow-hidden w-full">
                      <CardContent className="p-4 sm:p-6 space-y-6 overflow-hidden">
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

                {/* Go Deeper: External Resources */}
                {lessonContent.externalResources && lessonContent.externalResources.length > 0 && (
                  <section className="min-w-0 w-full" data-testid="section-external-resources">
                    <button
                      className="flex items-center gap-2 mb-3 w-full text-left group"
                      onClick={() => setShowResources(r => !r)}
                      data-testid="button-toggle-resources"
                    >
                      <ExternalLink className="h-5 w-5 text-emerald-500 shrink-0" />
                      <h2 className="text-xl font-semibold flex-1">Go Deeper</h2>
                      <Badge variant="secondary" className="text-xs">{lessonContent.externalResources.length} resources</Badge>
                      {showResources
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      }
                    </button>
                    <AnimatePresence>
                      {showResources && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3">
                            {lessonContent.externalResources.map((resource: any, i: number) => {
                              const typeIcon = resource.type === "video"
                                ? <Video className="h-4 w-4 shrink-0 text-red-500" />
                                : resource.type === "course"
                                ? <GraduationCap className="h-4 w-4 shrink-0 text-blue-500" />
                                : resource.type === "paper"
                                ? <FileText className="h-4 w-4 shrink-0 text-purple-500" />
                                : resource.type === "forum"
                                ? <Users className="h-4 w-4 shrink-0 text-orange-500" />
                                : resource.type === "tool"
                                ? <Wrench className="h-4 w-4 shrink-0 text-gray-500" />
                                : <Globe className="h-4 w-4 shrink-0 text-emerald-500" />;
                              return (
                                <Card key={i} className="border-emerald-500/20 bg-emerald-500/5 overflow-hidden w-full hover:border-emerald-500/50 transition-colors" data-testid={`card-resource-${i}`}>
                                  <CardContent className="p-4 overflow-hidden">
                                    <a
                                      href={resource.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-start gap-3 group"
                                    >
                                      <div className="mt-0.5">{typeIcon}</div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors break-words [overflow-wrap:anywhere]">
                                            {resource.title}
                                          </span>
                                          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 break-words [overflow-wrap:anywhere]">
                                          {resource.description}
                                        </p>
                                      </div>
                                    </a>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
            {keysData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBuyKeys(true)}
                className="gap-1.5"
                data-testid="button-keys-balance"
              >
                <Key className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">{keysData.availableKeys}</span>
              </Button>
            )}
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

            {/* Daily Key Earn Progress */}
            {keysData && !keysData.earnProgress.alreadyEarnedToday && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Daily Key Progress</span>
                </div>
                <div className="flex items-center gap-3">
                  <Progress 
                    value={(keysData.earnProgress.topicsCompletedToday / keysData.earnProgress.topicsNeeded) * 100} 
                    className="flex-1 h-2" 
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {keysData.earnProgress.topicsCompletedToday}/{keysData.earnProgress.topicsNeeded} topics mastered
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Complete beginner, intermediate, and advanced for {keysData.earnProgress.topicsNeeded} topics to earn a free key today
                </p>
              </div>
            )}
            {keysData?.earnProgress.alreadyEarnedToday && (
              <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Daily key earned! Come back tomorrow for another.</span>
                </div>
              </div>
            )}
            
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
                          {keysData && keysData.availableKeys > 0 && (
                            <div className="mt-4 pt-4 border-t border-dashed">
                              <p className="text-sm text-muted-foreground mb-3">Or skip the requirements:</p>
                              <Button
                                size="sm"
                                onClick={() => useKeyMutation.mutate(topic.id)}
                                disabled={useKeyMutation.isPending}
                                className="gap-2"
                                data-testid="button-use-key"
                              >
                                {useKeyMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Key className="h-4 w-4" />
                                )}
                                Unlock All Levels ({keysData.availableKeys} {keysData.availableKeys === 1 ? "key" : "keys"} remaining)
                              </Button>
                            </div>
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

      {/* Buy Keys Modal */}
      <AnimatePresence>
        {showBuyKeys && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowBuyKeys(false)}
          >
            <motion.div
              className="w-full max-w-md"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-amber-500" />
                    Unlock Keys
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setShowBuyKeys(false)} data-testid="button-close-buy-keys">
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <span className="text-sm font-medium">Your Keys</span>
                    <Badge variant="secondary" className="text-base gap-1">
                      <Key className="h-3.5 w-3.5 text-amber-500" />
                      {keysData?.availableKeys ?? 0} available
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">How to get keys:</p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <Gift className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span>3 free keys when you join</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Trophy className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                        <span>Earn 1 key/day by completing beginner + intermediate + advanced on 3 topics</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <ShoppingCart className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <span>Buy keys with Dogecoin (1 DOGE = 1 key)</span>
                      </div>
                    </div>
                  </div>

                  {/* Admin: Pending Purchase Approvals */}
                  {isAdmin && <AdminPurchaseApprovals />}

                  <div className="border-t pt-4 space-y-3">
                    <p className="text-sm font-medium">Buy Keys with Dogecoin</p>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-muted-foreground shrink-0">Quantity:</label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setBuyQuantity(q => Math.max(1, q - 1))}
                          disabled={buyQuantity <= 1}
                          data-testid="button-decrease-quantity"
                        >
                          <span className="text-lg leading-none">-</span>
                        </Button>
                        <span className="w-10 text-center text-lg font-medium" data-testid="text-buy-quantity">{buyQuantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setBuyQuantity(q => Math.min(100, q + 1))}
                          disabled={buyQuantity >= 100}
                          data-testid="button-increase-quantity"
                        >
                          <span className="text-lg leading-none">+</span>
                        </Button>
                      </div>
                      <span className="text-sm text-muted-foreground">= {buyQuantity} DOGE</span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        1. Send {buyQuantity} DOGE to the payment link below
                      </p>
                      <p className="text-xs text-muted-foreground">
                        2. Submit your purchase request
                      </p>
                      <p className="text-xs text-muted-foreground">
                        3. Keys will be added after admin confirmation
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Payment Options:</p>
                      <Button variant="outline" asChild className="w-full gap-2" size="sm">
                        <a
                          href="https://mydoge.com/JonK"
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="link-doge-payment"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Pay via MyDoge at mydoge.com/JonK
                        </a>
                      </Button>

                      <DogeWalletCopy />

                      <Button variant="outline" asChild className="w-full gap-2" size="sm">
                        <a
                          href="https://buymeacoffee.com/jkorstad"
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="link-bmac-payment"
                        >
                          <Coffee className="h-4 w-4" />
                          Pay via Buy Me a Coffee
                        </a>
                      </Button>
                    </div>

                    <Button
                      className="w-full gap-2"
                      onClick={() => purchaseMutation.mutate(buyQuantity)}
                      disabled={purchaseMutation.isPending}
                      data-testid="button-submit-purchase"
                    >
                      {purchaseMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Key className="h-4 w-4" />
                      )}
                      Submit Purchase Request ({buyQuantity} {buyQuantity === 1 ? "key" : "keys"})
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChat && <AiChat topic={topic} onClose={() => setShowChat(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
