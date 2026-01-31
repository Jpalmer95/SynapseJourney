import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { KnowledgeCard, CardSkeleton } from "@/components/knowledge-card";
import { Onboarding } from "@/components/onboarding";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
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
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    return localStorage.getItem("synapse-onboarding-complete") === "true";
  });
  const [isAutoEnrolling, setIsAutoEnrolling] = useState(false);
  const autoEnrollAttempted = useRef(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Use personalized feed for logged-in users, public feed for guests
  const feedEndpoint = user ? "/api/feed/personalized" : "/api/feed";
  
  const { data: feedData, isLoading, error, refetch } = useQuery<FeedCard[]>({
    queryKey: [feedEndpoint],
  });

  // Reset currentIndex when feed data changes to prevent out-of-bounds access
  useEffect(() => {
    if (feedData && currentIndex >= feedData.length) {
      setCurrentIndex(Math.max(0, feedData.length - 1));
    }
  }, [feedData, currentIndex]);

  // Track retry attempts
  const retryCount = useRef(0);
  const maxRetries = 3;

  // Auto-enroll user in default content if feed is empty
  const autoEnrollMutation = useMutation({
    mutationFn: async () => {
      console.log("[NebulaFeed] Calling auto-enroll API...");
      const res = await apiRequest("POST", "/api/user/auto-enroll");
      return res.json();
    },
    onSuccess: (data) => {
      console.log("[NebulaFeed] Auto-enroll success:", data);
      // Always invalidate and refetch, even if counts are 0 (might mean already enrolled)
      queryClient.invalidateQueries({ queryKey: ["/api/feed/personalized"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/pathways"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      refetch();
      setIsAutoEnrolling(false);
    },
    onError: (error) => {
      console.error("[NebulaFeed] Auto-enroll failed:", error);
      retryCount.current += 1;
      
      if (retryCount.current < maxRetries) {
        // Retry after a short delay
        console.log(`[NebulaFeed] Retrying auto-enroll (attempt ${retryCount.current + 1}/${maxRetries})...`);
        setTimeout(() => {
          autoEnrollMutation.mutate();
        }, 1000 * retryCount.current); // Exponential backoff
      } else {
        setIsAutoEnrolling(false);
        toast({
          title: "Setup incomplete",
          description: "We couldn't set up your default content. Try using 'Reset to Defaults' in Settings.",
          variant: "destructive",
        });
      }
    },
  });

  // Auto-enroll when feed is empty and user is logged in (regardless of onboarding status)
  useEffect(() => {
    if (
      user &&
      !isLoading &&
      (!feedData || feedData.length === 0) &&
      !autoEnrollAttempted.current &&
      !autoEnrollMutation.isPending
    ) {
      console.log("[NebulaFeed] Feed empty, triggering auto-enroll for user");
      autoEnrollAttempted.current = true;
      retryCount.current = 0;
      setIsAutoEnrolling(true);
      autoEnrollMutation.mutate();
    }
  }, [user, isLoading, feedData, autoEnrollMutation]);

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

  const handleOnboardingComplete = () => {
    localStorage.setItem("synapse-onboarding-complete", "true");
    setOnboardingComplete(true);
    refetch();
  };

  // Check if we should trigger auto-enrollment (empty feed for logged-in user)
  const shouldAutoEnroll = user && !isLoading && (!feedData || feedData.length === 0) && !autoEnrollAttempted.current;

  if (error || !feedData || feedData.length === 0) {
    if (user && !onboardingComplete) {
      return <Onboarding onComplete={handleOnboardingComplete} />;
    }
    
    // Show loading state while auto-enrolling or about to auto-enroll
    if (isAutoEnrolling || autoEnrollMutation.isPending || shouldAutoEnroll) {
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
            <div className="flex items-center justify-center gap-2 mb-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <h2 className="text-2xl font-semibold">Setting up your feed...</h2>
            </div>
            <p className="text-muted-foreground max-w-md">
              We're enrolling you in our curated learning pathways. This will only take a moment.
            </p>
          </div>
        </div>
      );
    }
    
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

  // Guard against undefined currentCard (can happen during data transitions)
  if (!currentCard || !currentCard.card || !currentCard.topic) {
    return (
      <div className="h-screen w-full relative overflow-hidden">
        <CardSkeleton />
      </div>
    );
  }

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
