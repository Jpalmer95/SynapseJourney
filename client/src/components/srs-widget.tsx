import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BrainCircuit, Play, Check, X, Frown, Meh, Smile } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export function SrsWidget() {
  const { toast } = useToast();
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const { data: dueCards = [], isLoading } = useQuery({
    queryKey: ["/api/user/flashcards/due"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ flashcardId, quality }: { flashcardId: number; quality: number }) => {
      await apiRequest("POST", `/api/flashcards/${flashcardId}/review`, { quality });
    },
    onSuccess: () => {
      if (currentCardIndex < dueCards.length - 1) {
        setShowAnswer(false);
        setCurrentCardIndex(prev => prev + 1);
      } else {
        toast({
          title: "Daily Review Complete! 🎉",
          description: "You've caught up on all your spaced repetition reviews.",
        });
        setIsReviewOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/user/flashcards/due"] });
      }
    },
  });

  if (isLoading || dueCards.length === 0) return null;

  const currentFlashcard = dueCards[currentCardIndex]?.flashcard;
  const currentTopicTitle = dueCards[currentCardIndex]?.topicTitle;

  const handleQualitySelect = (quality: number) => {
    if (!currentFlashcard) return;
    reviewMutation.mutate({ flashcardId: currentFlashcard.id, quality });
  };

  return (
    <>
      <Card className="mb-4 border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Daily Review</p>
              <p className="text-xs text-muted-foreground">{dueCards.length} flashcards ready for spaced repetition</p>
            </div>
          </div>
          <Button size="sm" onClick={() => { setIsReviewOpen(true); setCurrentCardIndex(0); setShowAnswer(false); }}>
            <Play className="h-4 w-4 mr-2" /> Start
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{currentTopicTitle}</span>
              <span className="text-primary">{currentCardIndex + 1} / {dueCards.length}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-[200px] flex flex-col items-center justify-center text-center p-6 bg-muted/30 rounded-lg">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentFlashcard?.id + (showAnswer ? "-back" : "-front")}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full flex-1 flex items-center justify-center flex-col"
              >
                {!showAnswer ? (
                  <p className="text-lg font-medium">{currentFlashcard?.front}</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">{currentFlashcard?.front}</p>
                    <div className="w-full h-px bg-border mb-4" />
                    <p className="text-lg">{currentFlashcard?.back}</p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <DialogFooter className="sm:justify-center">
            {!showAnswer ? (
              <Button className="w-full" onClick={() => setShowAnswer(true)}>Show Answer</Button>
            ) : (
              <div className="grid grid-cols-4 gap-2 w-full">
                <Button variant="outline" className="text-red-500 bg-red-500/10 hover:bg-red-500/20" onClick={() => handleQualitySelect(0)} disabled={reviewMutation.isPending}>
                  <X className="h-4 w-4 mr-1" /> Blackout
                </Button>
                <Button variant="outline" className="text-orange-500 bg-orange-500/10 hover:bg-orange-500/20" onClick={() => handleQualitySelect(2)} disabled={reviewMutation.isPending}>
                  <Frown className="h-4 w-4 mr-1" /> Hard
                </Button>
                <Button variant="outline" className="text-blue-500 bg-blue-500/10 hover:bg-blue-500/20" onClick={() => handleQualitySelect(4)} disabled={reviewMutation.isPending}>
                  <Meh className="h-4 w-4 mr-1" /> Good
                </Button>
                <Button variant="outline" className="text-green-500 bg-green-500/10 hover:bg-green-500/20" onClick={() => handleQualitySelect(5)} disabled={reviewMutation.isPending}>
                  <Smile className="h-4 w-4 mr-1" /> Perfect
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
