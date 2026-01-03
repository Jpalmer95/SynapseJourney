import { useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Heart, ArrowDown, ChevronRight, BookOpen, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KnowledgeCard as KnowledgeCardType, Topic, Category } from "@shared/schema";

interface KnowledgeCardProps {
  card: KnowledgeCardType;
  topic: Topic;
  category?: Category;
  onSwipe?: (direction: "up" | "down") => void;
  onDive?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
}

const cardVariants = {
  enter: { y: 300, opacity: 0, scale: 0.9 },
  center: { y: 0, opacity: 1, scale: 1 },
  exit: (direction: number) => ({
    y: direction < 0 ? -300 : 300,
    opacity: 0,
    scale: 0.9,
    rotate: direction < 0 ? -5 : 5,
  }),
};

const getCategoryGradient = (color: string) => {
  const gradients: Record<string, string> = {
    purple: "from-purple-600/20 via-violet-600/10 to-transparent",
    blue: "from-blue-600/20 via-cyan-600/10 to-transparent",
    green: "from-emerald-600/20 via-teal-600/10 to-transparent",
    orange: "from-orange-600/20 via-amber-600/10 to-transparent",
    pink: "from-pink-600/20 via-rose-600/10 to-transparent",
    red: "from-red-600/20 via-rose-600/10 to-transparent",
  };
  return gradients[color] || gradients.purple;
};

export function KnowledgeCard({
  card,
  topic,
  category,
  onSwipe,
  onDive,
  onSave,
  isSaved = false,
}: KnowledgeCardProps) {
  const [dragDirection, setDragDirection] = useState<number>(0);

  const handleDrag = (_: unknown, info: PanInfo) => {
    setDragDirection(info.offset.y);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 100;
    if (Math.abs(info.offset.y) > threshold) {
      onSwipe?.(info.offset.y < 0 ? "up" : "down");
    }
    setDragDirection(0);
  };

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      custom={dragDirection}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
      }}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-b",
          category ? getCategoryGradient(category.color) : "from-primary/10 via-primary/5 to-transparent"
        )}
      />
      
      <div className="relative flex flex-col h-full px-6 py-12 md:px-12 md:py-16">
        <div className="flex items-center gap-2 mb-6">
          {category && (
            <Badge variant="secondary" className="text-xs">
              {category.name}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs capitalize">
            {topic.difficulty}
          </Badge>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {card.title}
          </motion.h1>
          
          <motion.p
            className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {card.content}
          </motion.p>

          {card.tags && card.tags.length > 0 && (
            <motion.div
              className="flex flex-wrap gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {card.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-sm text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </motion.div>
          )}
        </div>

        <motion.div
          className="flex items-center justify-center gap-4 mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            variant="outline"
            size="lg"
            onClick={onSave}
            className={cn(
              "gap-2 backdrop-blur-md",
              isSaved && "text-red-500 border-red-500/50"
            )}
            data-testid="button-save-card"
          >
            <Heart className={cn("h-5 w-5", isSaved && "fill-current")} />
            {isSaved ? "Saved" : "Save"}
          </Button>
          
          <Button
            size="lg"
            onClick={onDive}
            className="gap-2"
            data-testid="button-dive"
          >
            <BookOpen className="h-5 w-5" />
            Dive Deep
            <ChevronRight className="h-4 w-4" />
          </Button>
        </motion.div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center text-muted-foreground/50">
          <ArrowDown className="h-5 w-5 animate-bounce" />
          <span className="text-xs mt-1">Swipe for next</span>
        </div>
      </div>
    </motion.div>
  );
}

export function CardSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col px-6 py-12 md:px-12 md:py-16">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
        <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
      </div>
      
      <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
        <div className="h-14 w-3/4 rounded-md bg-muted animate-pulse mb-6" />
        <div className="space-y-3">
          <div className="h-6 w-full rounded-md bg-muted animate-pulse" />
          <div className="h-6 w-5/6 rounded-md bg-muted animate-pulse" />
          <div className="h-6 w-4/6 rounded-md bg-muted animate-pulse" />
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-4 mt-8">
        <div className="h-12 w-28 rounded-md bg-muted animate-pulse" />
        <div className="h-12 w-36 rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  );
}
