import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { KnowledgeCard, CardSkeleton } from "@/components/knowledge-card";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { KnowledgeCard as CardType, Topic, Category } from "@shared/schema";

interface FeedCard {
  card: CardType;
  topic: Topic;
  category?: Category;
}

interface NebulaFeedProps {
  onDive: (topic: Topic) => void;
}

export function NebulaFeed({ onDive }: NebulaFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedCards, setSavedCards] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const { data: feedData, isLoading, error } = useQuery<FeedCard[]>({
    queryKey: ["/api/feed"],
  });

  const saveMutation = useMutation({
    mutationFn: async (cardId: number) => {
      if (savedCards.has(cardId)) {
        await apiRequest("DELETE", `/api/saved/${cardId}`);
        return { cardId, saved: false };
      } else {
        await apiRequest("POST", "/api/saved", { cardId });
        return { cardId, saved: true };
      }
    },
    onSuccess: ({ cardId, saved }) => {
      setSavedCards((prev) => {
        const next = new Set(prev);
        if (saved) {
          next.add(cardId);
        } else {
          next.delete(cardId);
        }
        return next;
      });
      toast({
        title: saved ? "Card saved!" : "Card removed",
        description: saved ? "Find it in your saved collection" : "Removed from saved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/saved"] });
    },
  });

  const handleSwipe = useCallback(
    (direction: "up" | "down") => {
      if (!feedData) return;
      if (direction === "up" && currentIndex < feedData.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (direction === "down" && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    },
    [currentIndex, feedData]
  );

  const handleSave = useCallback(() => {
    if (!feedData || !feedData[currentIndex]) return;
    saveMutation.mutate(feedData[currentIndex].card.id);
  }, [feedData, currentIndex, saveMutation]);

  const handleDive = useCallback(() => {
    if (!feedData || !feedData[currentIndex]) return;
    onDive(feedData[currentIndex].topic);
  }, [feedData, currentIndex, onDive]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        handleSwipe("up");
      } else if (e.key === "ArrowDown") {
        handleSwipe("down");
      } else if (e.key === "Enter") {
        handleDive();
      } else if (e.key === "s" || e.key === "S") {
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSwipe, handleDive, handleSave]);

  if (isLoading) {
    return (
      <div className="h-screen w-full relative overflow-hidden">
        <CardSkeleton />
      </div>
    );
  }

  if (error || !feedData || feedData.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-6xl mb-6"
          >
            <span className="text-primary">Synapse</span>
          </motion.div>
          <h2 className="text-2xl font-semibold mb-2">Welcome to Synapse</h2>
          <p className="text-muted-foreground max-w-md">
            Your personalized learning journey awaits. Knowledge cards will appear here as we build your feed.
          </p>
        </div>
      </div>
    );
  }

  const currentCard = feedData[currentIndex];

  return (
    <div className="h-screen w-full relative overflow-hidden">
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1">
          {feedData.map((_, index) => (
            <div
              key={index}
              className={`h-1 w-6 rounded-full transition-colors ${
                index === currentIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground ml-2">
          {currentIndex + 1} / {feedData.length}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <KnowledgeCard
          key={currentCard.card.id}
          card={currentCard.card}
          topic={currentCard.topic}
          category={currentCard.category}
          onSwipe={handleSwipe}
          onDive={handleDive}
          onSave={handleSave}
          isSaved={savedCards.has(currentCard.card.id)}
        />
      </AnimatePresence>
    </div>
  );
}
