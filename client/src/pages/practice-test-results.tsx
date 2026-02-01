import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { 
  Trophy, ArrowLeft, Check, X, ChevronDown, ChevronUp, 
  Lightbulb, BookOpen, MessageCircle, Clock, Target, Send, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PracticeTest {
  id: number;
  testType: string;
  title: string;
  totalQuestions: number;
  timeLimit: number | null;
}

interface PracticeTestQuestion {
  id: number;
  questionIndex: number;
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface PracticeTestAttempt {
  id: number;
  testId: number;
  status: string;
  answers: Record<string, number>;
  score: number | null;
  categoryScores: Record<string, { correct: number; total: number }> | null;
  timeSpent: number;
  completedAt: string | null;
}

interface TestGapRecommendation {
  id: number;
  category: string;
  gapScore: number;
  suggestedTopicTitle: string;
  suggestedTopicDescription: string | null;
  customTopicId: number | null;
}

interface ResultsData {
  attempt: PracticeTestAttempt;
  test: PracticeTest;
  questions: PracticeTestQuestion[];
  recommendations: TestGapRecommendation[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function PracticeTestResultsPage() {
  const [, params] = useRoute("/practice-test/:testId/results/:attemptId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const testId = params?.testId ? parseInt(params.testId) : null;
  const attemptId = params?.attemptId ? parseInt(params.attemptId) : null;
  
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [chatQuestion, setChatQuestion] = useState<PracticeTestQuestion | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [userAnswerForChat, setUserAnswerForChat] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = useQuery<ResultsData>({
    queryKey: ["/api/practice-tests/attempts", attemptId, "results"],
    enabled: !!attemptId,
  });

  const chatMutation = useMutation({
    mutationFn: async (data: { 
      question: string; 
      userAnswer: string; 
      correctAnswer: string; 
      explanation: string; 
      userMessage: string;
      history: ChatMessage[];
    }) => {
      const response = await apiRequest("POST", "/api/practice-tests/chat", data);
      return response.json();
    },
    onSuccess: (data) => {
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  const openChatForQuestion = (question: PracticeTestQuestion, userAnswer: string) => {
    setChatQuestion(question);
    setUserAnswerForChat(userAnswer);
    setChatMessages([{
      role: "assistant",
      content: `I can help you understand this question better! You selected "${userAnswer}" but the correct answer was "${question.options[question.correctIndex]}". What would you like to know about this question?`
    }]);
    setChatInput("");
  };

  const handleSendMessage = () => {
    if (!chatInput.trim() || !chatQuestion || !userAnswerForChat) return;
    
    const userMessage = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setChatInput("");
    
    chatMutation.mutate({
      question: chatQuestion.question,
      userAnswer: userAnswerForChat,
      correctAnswer: chatQuestion.options[chatQuestion.correctIndex],
      explanation: chatQuestion.explanation,
      userMessage,
      history: chatMessages,
    });
  };

  const createJourneyMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      return apiRequest("POST", "/api/custom-topics", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/custom-topics"] });
      toast({
        title: "Journey Created!",
        description: "Your personalized learning journey is being generated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create learning journey.",
        variant: "destructive",
      });
    },
  });

  const toggleQuestion = (questionId: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-16 mb-4" />
          <Skeleton className="h-64 mb-4" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">Results Not Found</h2>
            <Button onClick={() => setLocation("/explore")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Explore
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { attempt, test, questions, recommendations } = results;
  const categoryScores = attempt.categoryScores || {};

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/explore")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Test Results</h1>
              <p className="text-sm text-muted-foreground">{test.title}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex items-center justify-center w-32 h-32 rounded-full bg-primary/10">
                  <div className="text-center">
                    <span className={`text-4xl font-bold ${getScoreColor(attempt.score || 0)}`}>
                      {attempt.score}%
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">Score</p>
                  </div>
                </div>
                
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <Trophy className={`h-6 w-6 ${getScoreColor(attempt.score || 0)}`} />
                    <h2 className="text-2xl font-bold">
                      {(attempt.score || 0) >= 80 ? "Excellent!" : (attempt.score || 0) >= 60 ? "Good Job!" : "Keep Practicing!"}
                    </h2>
                  </div>
                  <p className="text-muted-foreground">
                    You answered {Object.keys(attempt.answers).filter(k => 
                      attempt.answers[k] === questions.find(q => q.id.toString() === k)?.correctIndex
                    ).length} out of {questions.length} questions correctly.
                  </p>
                  <div className="flex items-center justify-center md:justify-start gap-4 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatTime(attempt.timeSpent)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-4 w-4" />
                      <span>{questions.length} questions</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Score by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(categoryScores).map(([category, scores]) => {
                  const percentage = scores.total > 0 ? Math.round((scores.correct / scores.total) * 100) : 0;
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{category}</span>
                        <span className={`text-sm font-medium ${getScoreColor(percentage)}`}>
                          {scores.correct}/{scores.total} ({percentage}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Recommended Learning Journeys</CardTitle>
                </div>
                <CardDescription>
                  Based on your results, we recommend focusing on these areas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{rec.category}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {rec.gapScore}% gap
                          </span>
                        </div>
                        <p className="font-medium mt-1">{rec.suggestedTopicTitle}</p>
                        {rec.suggestedTopicDescription && (
                          <p className="text-sm text-muted-foreground">
                            {rec.suggestedTopicDescription}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => createJourneyMutation.mutate({
                          title: rec.suggestedTopicTitle,
                          description: rec.suggestedTopicDescription || `Deep dive into ${rec.category}`,
                        })}
                        disabled={createJourneyMutation.isPending}
                        data-testid={`button-create-journey-${rec.id}`}
                      >
                        <BookOpen className="h-4 w-4 mr-1" />
                        Start Journey
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Question Review</CardTitle>
              <CardDescription>
                Review each question to understand what you got right and wrong.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {questions.map((question, index) => {
                  const userAnswer = attempt.answers[question.id.toString()];
                  const isCorrect = userAnswer === question.correctIndex;
                  const isExpanded = expandedQuestions.has(question.id);
                  
                  return (
                    <Collapsible key={question.id} open={isExpanded} onOpenChange={() => toggleQuestion(question.id)}>
                      <CollapsibleTrigger asChild>
                        <button
                          className="w-full text-left p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                          data-testid={`question-review-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isCorrect ? "bg-green-500/20" : "bg-red-500/20"
                            }`}>
                              {isCorrect ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <X className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">{question.category}</Badge>
                                <span className="text-xs text-muted-foreground">Q{index + 1}</span>
                              </div>
                              <p className="text-sm line-clamp-1">{question.question}</p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-2 border-x border-b rounded-b-lg">
                          <p className="text-sm mb-4">{question.question}</p>
                          <div className="space-y-2 mb-4">
                            {question.options.map((option, optIndex) => {
                              const isUserAnswer = userAnswer === optIndex;
                              const isCorrectAnswer = question.correctIndex === optIndex;
                              
                              let bgColor = "bg-muted/50";
                              if (isCorrectAnswer) bgColor = "bg-green-500/20";
                              else if (isUserAnswer && !isCorrectAnswer) bgColor = "bg-red-500/20";
                              
                              return (
                                <div
                                  key={optIndex}
                                  className={`p-3 rounded-lg ${bgColor}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">
                                      {String.fromCharCode(65 + optIndex)}.
                                    </span>
                                    <span className="text-sm">{option}</span>
                                    {isCorrectAnswer && (
                                      <Badge variant="secondary" className="ml-auto text-green-600">
                                        <Check className="h-3 w-3 mr-1" />
                                        Correct
                                      </Badge>
                                    )}
                                    {isUserAnswer && !isCorrectAnswer && (
                                      <Badge variant="secondary" className="ml-auto text-red-600">
                                        <X className="h-3 w-3 mr-1" />
                                        Your Answer
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="p-3 bg-primary/5 rounded-lg">
                            <p className="text-sm font-medium mb-1">Explanation</p>
                            <p className="text-sm text-muted-foreground">{question.explanation}</p>
                          </div>
                          {!isCorrect && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                const selectedOption = userAnswer !== undefined ? question.options[userAnswer] : "No answer";
                                openChatForQuestion(question, selectedOption);
                              }}
                              data-testid={`button-ask-ai-${index}`}
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              Ask AI About This Question
                            </Button>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="flex justify-center gap-4 py-6">
          <Button variant="outline" onClick={() => setLocation("/explore")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Explore
          </Button>
          <Link href={`/practice-test/${testId}`}>
            <Button>
              Retake Test
            </Button>
          </Link>
        </div>
      </main>

      <Dialog open={chatQuestion !== null} onOpenChange={(open) => !open && setChatQuestion(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Ask AI About This Question
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto max-h-[400px] space-y-4 py-4">
            {chatMessages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted p-3 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          
          <div className="flex items-center gap-2 pt-2 border-t">
            <Textarea
              placeholder="Ask a question about this topic..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              data-testid="input-chat-message"
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || chatMutation.isPending}
              data-testid="button-send-chat"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
