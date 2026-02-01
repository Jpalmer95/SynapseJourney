import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, Flag, ChevronLeft, ChevronRight, Check, X, 
  Pause, Play, AlertCircle, Loader2, ArrowLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PracticeTest {
  id: number;
  userId: string;
  testType: string;
  title: string;
  description: string | null;
  totalQuestions: number;
  timeLimit: number | null;
  categories: string[] | null;
  status: string;
}

interface PracticeTestQuestion {
  id: number;
  testId: number;
  questionIndex: number;
  category: string;
  questionType: string;
  passage: string | null;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
}

interface PracticeTestAttempt {
  id: number;
  userId: string;
  testId: number;
  status: string;
  answers: Record<string, number>;
  flaggedQuestions: number[] | null;
  score: number | null;
  timeSpent: number;
  startedAt: string;
  completedAt: string | null;
}

export default function PracticeTestPage() {
  const [, params] = useRoute("/practice-test/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const testId = params?.id ? parseInt(params.id) : null;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<number[]>([]);
  const [timeSpent, setTimeSpent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [showNavigator, setShowNavigator] = useState(false);

  const answersRef = useRef(answers);
  const flaggedQuestionsRef = useRef(flaggedQuestions);
  const timeSpentRef = useRef(timeSpent);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { flaggedQuestionsRef.current = flaggedQuestions; }, [flaggedQuestions]);
  useEffect(() => { timeSpentRef.current = timeSpent; }, [timeSpent]);

  const { data: test, isLoading: testLoading } = useQuery<PracticeTest>({
    queryKey: ["/api/practice-tests", testId],
    enabled: !!testId,
  });

  const { data: questions, isLoading: questionsLoading } = useQuery<PracticeTestQuestion[]>({
    queryKey: ["/api/practice-tests", testId, "questions"],
    enabled: !!testId && test?.status === "ready",
  });

  const startAttemptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/practice-tests/${testId}/attempt`);
      return response.json();
    },
    onSuccess: (data: PracticeTestAttempt) => {
      setAttemptId(data.id);
      if (data.answers && Object.keys(data.answers).length > 0) {
        setAnswers(data.answers);
      }
      if (data.flaggedQuestions) {
        setFlaggedQuestions(data.flaggedQuestions);
      }
      if (data.timeSpent) {
        setTimeSpent(data.timeSpent);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start test. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveAnswersMutation = useMutation({
    mutationFn: async (data: { answers: Record<string, number>; flaggedQuestions: number[]; timeSpent: number }) => {
      await apiRequest("PATCH", `/api/practice-tests/attempts/${attemptId}`, data);
    },
  });

  const submitTestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/practice-tests/attempts/${attemptId}/submit`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/practice-tests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/practice-test-attempts"] });
      setLocation(`/practice-test/${testId}/results/${attemptId}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit test. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (test?.status === "ready" && !attemptId) {
      startAttemptMutation.mutate();
    }
  }, [test?.status]);

  useEffect(() => {
    if (isPaused || !attemptId) return;

    const interval = setInterval(() => {
      setTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, attemptId]);

  useEffect(() => {
    if (!attemptId || isPaused) return;

    const interval = setInterval(() => {
      saveAnswersMutation.mutate({ 
        answers: answersRef.current, 
        flaggedQuestions: flaggedQuestionsRef.current, 
        timeSpent: timeSpentRef.current 
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [attemptId, isPaused]);

  const currentQuestion = questions?.[currentQuestionIndex];

  useEffect(() => {
    if (currentQuestion) {
      const existingAnswer = answers[currentQuestion.id.toString()];
      setSelectedAnswer(existingAnswer !== undefined ? existingAnswer : null);
    }
  }, [currentQuestionIndex, currentQuestion, answers]);

  const handleSelectAnswer = useCallback((optionIndex: number) => {
    if (!currentQuestion) return;
    setSelectedAnswer(optionIndex);
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id.toString()]: optionIndex,
    }));
  }, [currentQuestion]);

  const handleToggleFlag = useCallback(() => {
    if (!currentQuestion) return;
    setFlaggedQuestions((prev) => {
      if (prev.includes(currentQuestion.id)) {
        return prev.filter((id) => id !== currentQuestion.id);
      }
      return [...prev, currentQuestion.id];
    });
  }, [currentQuestion]);

  const handleNext = useCallback(() => {
    if (questions && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [currentQuestionIndex, questions]);

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  }, [currentQuestionIndex]);

  const handleGoToQuestion = useCallback((index: number) => {
    setCurrentQuestionIndex(index);
    setShowNavigator(false);
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(answers).length;
  const progress = questions ? (answeredCount / questions.length) * 100 : 0;

  if (testLoading || questionsLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-16 mb-4" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Test Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This practice test doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => setLocation("/explore")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Explore
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (test.status !== "ready") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold mb-2">Generating Questions</h2>
            <p className="text-muted-foreground mb-4">
              Your {test.testType} practice test is being generated. This may take a minute.
            </p>
            <Button variant="outline" onClick={() => setLocation("/explore")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Explore
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Questions</h2>
            <p className="text-muted-foreground mb-4">
              This test doesn't have any questions yet.
            </p>
            <Button onClick={() => setLocation("/explore")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Explore
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isQuestionFlagged = currentQuestion ? flaggedQuestions.includes(currentQuestion.id) : false;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono">
                {test.testType}
              </Badge>
              <span className="text-sm text-muted-foreground hidden sm:block">
                {test.title}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className="font-mono">{formatTime(timeSpent)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsPaused(!isPaused)}
                  data-testid="button-pause-timer"
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
              </div>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowSubmitDialog(true)}
                data-testid="button-submit-test"
              >
                Submit Test
              </Button>
            </div>
          </div>
          
          <div className="mt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span>{answeredCount} of {questions.length} answered</span>
              {flaggedQuestions.length > 0 && (
                <span className="text-yellow-600">• {flaggedQuestions.length} flagged</span>
              )}
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{currentQuestion?.category}</Badge>
                    <span className="text-sm text-muted-foreground">
                      Question {currentQuestionIndex + 1} of {questions.length}
                    </span>
                  </div>
                  <Button
                    variant={isQuestionFlagged ? "default" : "outline"}
                    size="sm"
                    onClick={handleToggleFlag}
                    className={isQuestionFlagged ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                    data-testid="button-flag-question"
                  >
                    <Flag className="h-4 w-4 mr-1" />
                    {isQuestionFlagged ? "Flagged" : "Flag"}
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent>
                {currentQuestion?.passage && (
                  <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm italic">{currentQuestion.passage}</p>
                  </div>
                )}
                
                <p className="text-lg mb-6">{currentQuestion?.question}</p>
                
                <div className="space-y-3">
                  {currentQuestion?.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleSelectAnswer(index)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        selectedAnswer === index
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                      data-testid={`option-${index}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedAnswer === index
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground"
                        }`}>
                          {selectedAnswer === index ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <span className="text-xs">{String.fromCharCode(65 + index)}</span>
                          )}
                        </div>
                        <span>{option}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            data-testid="button-previous"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowNavigator(!showNavigator)}
            data-testid="button-navigator"
          >
            {currentQuestionIndex + 1} / {questions.length}
          </Button>
          
          <Button
            onClick={handleNext}
            disabled={currentQuestionIndex === questions.length - 1}
            data-testid="button-next"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <AnimatePresence>
          {showNavigator && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-medium mb-3">Question Navigator</p>
                  <div className="flex flex-wrap gap-2">
                    {questions.map((q, index) => {
                      const isAnswered = answers[q.id.toString()] !== undefined;
                      const isFlagged = flaggedQuestions.includes(q.id);
                      const isCurrent = index === currentQuestionIndex;
                      
                      return (
                        <button
                          key={q.id}
                          onClick={() => handleGoToQuestion(index)}
                          className={`w-10 h-10 rounded-md text-sm font-medium transition-all ${
                            isCurrent
                              ? "bg-primary text-primary-foreground"
                              : isAnswered
                              ? "bg-green-500/20 text-green-700 dark:text-green-400"
                              : "bg-muted hover:bg-muted/80"
                          } ${isFlagged ? "ring-2 ring-yellow-500" : ""}`}
                          data-testid={`nav-question-${index}`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-green-500/20" />
                      <span>Answered</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-muted ring-2 ring-yellow-500" />
                      <span>Flagged</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-primary" />
                      <span>Current</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Test?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} of {questions.length} questions.
              {questions.length - answeredCount > 0 && (
                <span className="block mt-2 text-yellow-600">
                  Warning: {questions.length - answeredCount} questions are unanswered.
                </span>
              )}
              {flaggedQuestions.length > 0 && (
                <span className="block mt-1 text-yellow-600">
                  You have {flaggedQuestions.length} flagged questions for review.
                </span>
              )}
              <span className="block mt-2">
                This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-submit">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => submitTestMutation.mutate()}
              disabled={submitTestMutation.isPending}
              data-testid="button-confirm-submit"
            >
              {submitTestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Test"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
