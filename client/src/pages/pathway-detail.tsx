import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { 
  ArrowLeft, BookOpen, Clock, ChevronRight, Lock, CheckCircle2,
  Atom, Wrench, Rocket, Code, Brain, Calculator, Beaker, Leaf, Music, GitBranch, FlaskConical,
  Zap, AudioWaveform, Lightbulb, Cog, Cpu, Boxes, Flower2, Dna, BrainCircuit, Globe2, Network, Layers
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/app-layout";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { SkillTree } from "@/components/skill-tree";

interface Topic {
  id: number;
  name: string;
  description: string;
  difficulty: string;
  categoryId: number;
}

interface PathwayTopic {
  topic: Topic;
  order: number;
  prerequisiteTopicIds?: number[] | null;
}

interface Pathway {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  difficulty: string;
  estimatedHours: number | null;
  isActive: boolean;
}

interface PathwayDetail {
  pathway: Pathway;
  topics: PathwayTopic[];
}

const iconMap: Record<string, typeof Brain> = {
  Atom, Wrench, Rocket, Code, Brain, Calculator, Beaker, Leaf, Music, GitBranch,
  Flask: FlaskConical, Zap, AudioWaveform, Lightbulb, Cog, Cpu, Boxes, Flower2, Dna,
  BrainCircuit, Globe2, Network, Lock, Layers,
};

const colorMap: Record<string, string> = {
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  teal: "bg-teal-500",
  lime: "bg-lime-500",
  rose: "bg-rose-500",
  gray: "bg-gray-500",
  yellow: "bg-yellow-500",
  cyan: "bg-cyan-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  slate: "bg-slate-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  fuchsia: "bg-fuchsia-500",
  red: "bg-red-500",
  neutral: "bg-neutral-500",
  zinc: "bg-zinc-500",
  stone: "bg-stone-500",
};

const difficultyColors: Record<string, string> = {
  beginner: "text-green-600 bg-green-100 dark:bg-green-900/30",
  intermediate: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
  advanced: "text-red-600 bg-red-100 dark:bg-red-900/30",
  mixed: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
};

export default function PathwayDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const pathwayId = params.id;

  const { data, isLoading, error } = useQuery<PathwayDetail>({
    queryKey: [`/api/pathways/${pathwayId}`],
    enabled: !!pathwayId,
  });

  const { data: mastered = [] } = useQuery<{topicId: number; topicTitle: string}[]>({
    queryKey: ["/api/user/mastered-topics"],
  });

  const masteredTopicIds = new Set(mastered.map(m => m.topicId));

  const handleTopicClick = (topicId: number) => {
    setLocation(`/rabbit-hole?topic=${topicId}`);
  };

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
          <h2 className="text-xl font-semibold mb-2">Pathway not found</h2>
          <p className="text-muted-foreground mb-4">This pathway may not exist or has been removed.</p>
          <Link href="/pathways">
            <Button variant="outline" data-testid="button-back-to-pathways">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pathways
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (isLoading || !data) {
    return (
      <AppLayout>
        <div className="p-6 max-w-3xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-20 w-full mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  const { pathway, topics } = data;
  const Icon = iconMap[pathway.icon] || Brain;
  const bgColor = colorMap[pathway.color] || "bg-gray-500";
  const sortedTopics = [...topics].sort((a, b) => a.order - b.order);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Link href="/pathways">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pathways
            </Button>
          </Link>

          <Card className="overflow-hidden">
            <div className={`h-2 ${bgColor}`} />
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 sm:p-4 rounded-md ${bgColor} shrink-0`}>
                  <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold mb-2 break-words" data-testid="text-pathway-title">
                    {pathway.name}
                  </h1>
                  <p className="text-muted-foreground text-sm sm:text-base mb-4 break-words" data-testid="text-pathway-description">
                    {pathway.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={difficultyColors[pathway.difficulty] || difficultyColors.mixed} data-testid="badge-difficulty">
                      {pathway.difficulty}
                    </Badge>
                    {pathway.estimatedHours && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {pathway.estimatedHours}h
                      </Badge>
                    )}
                    <Badge variant="secondary">
                      {sortedTopics.length} topics
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Topics in this Pathway
          </h2>

          {sortedTopics.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No topics have been added to this pathway yet.
              </CardContent>
            </Card>
          ) : (
            <SkillTree 
              topics={sortedTopics} 
              masteredTopicIds={masteredTopicIds} 
              onTopicClick={handleTopicClick} 
            />
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
