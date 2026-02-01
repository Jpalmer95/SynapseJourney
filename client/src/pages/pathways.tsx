import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Compass, Clock, ChevronRight, Check, Plus, Atom, Wrench, Rocket, Code, Brain, Calculator, Beaker, Leaf, Music, GitBranch, FlaskConical,
  Zap, AudioWaveform, Lightbulb, Cog, Cpu, Boxes, Flower2, Dna, BrainCircuit, Globe2, Network, Lock, Layers, Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/app-layout";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { CreateCustomPathwayDialog } from "@/components/create-custom-pathway";

interface Pathway {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  difficulty: string;
  estimatedHours: number | null;
  isActive: boolean;
  createdByUserId: string | null;
}

interface UserPathway {
  pathway: Pathway;
  enrollment: {
    status: string;
    progress: number;
    startedAt: string;
  };
}

const iconMap: Record<string, typeof Brain> = {
  Atom: Atom,
  Wrench: Wrench,
  Rocket: Rocket,
  Code: Code,
  Brain: Brain,
  Calculator: Calculator,
  Beaker: Beaker,
  Leaf: Leaf,
  Music: Music,
  GitBranch: GitBranch,
  Flask: FlaskConical,
  Zap: Zap,
  AudioWaveform: AudioWaveform,
  Lightbulb: Lightbulb,
  Cog: Cog,
  Cpu: Cpu,
  Boxes: Boxes,
  Flower2: Flower2,
  Dna: Dna,
  BrainCircuit: BrainCircuit,
  Globe2: Globe2,
  Network: Network,
  Lock: Lock,
  Layers: Layers,
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

export default function PathwaysPage() {
  const { toast } = useToast();

  const { data: pathways, isLoading: pathwaysLoading } = useQuery<Pathway[]>({
    queryKey: ["/api/pathways"],
  });

  const { data: userPathways, isLoading: userPathwaysLoading } = useQuery<UserPathway[]>({
    queryKey: ["/api/user/pathways"],
  });

  const enrollMutation = useMutation({
    mutationFn: async (pathwayId: number) => {
      return apiRequest("POST", `/api/pathways/${pathwayId}/enroll`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/pathways"] });
      toast({
        title: "Enrolled!",
        description: "You've started a new learning pathway.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to enroll. Please try again.",
        variant: "destructive",
      });
    },
  });

  const enrolledIds = new Set(userPathways?.map(up => up.pathway.id) || []);

  return (
    <AppLayout mobileTitle="Pathways">
      <div className="max-w-4xl mx-auto px-4 py-8 pt-16 md:pt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Compass className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold">Learning Pathways</h1>
              </div>
              <CreateCustomPathwayDialog />
            </div>
            <p className="text-muted-foreground">
              Curated learning journeys to help you master entire fields. Each pathway contains recommended topics that build upon each other.
            </p>
          </motion.div>

          {/* Your Enrolled Pathways */}
          {userPathways && userPathways.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-8"
            >
              <h2 className="text-lg font-semibold mb-4">Your Pathways</h2>
              <div className="grid gap-4">
                {userPathways.map((up, index) => {
                  const Icon = iconMap[up.pathway.icon] || Brain;
                  const bgColor = colorMap[up.pathway.color] || "bg-gray-500";

                  return (
                    <motion.div
                      key={up.pathway.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link href={`/pathway/${up.pathway.id}`}>
                        <Card className="hover-elevate cursor-pointer" data-testid={`card-enrolled-pathway-${up.pathway.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-md ${bgColor}`}>
                                <Icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1 gap-2">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-medium" data-testid={`text-pathway-name-${up.pathway.id}`}>{up.pathway.name}</h3>
                                    {up.pathway.createdByUserId && (
                                      <Badge variant="outline" className="text-xs" data-testid={`badge-custom-${up.pathway.id}`}>
                                        <Sparkles className="h-3 w-3 mr-1" />
                                        Custom
                                      </Badge>
                                    )}
                                  </div>
                                  <Badge variant="secondary" data-testid={`badge-progress-${up.pathway.id}`}>{up.enrollment.progress}%</Badge>
                                </div>
                                <Progress value={up.enrollment.progress} className="h-2" />
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Available Pathways */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-lg font-semibold mb-4">
              {userPathways && userPathways.length > 0 ? "Explore More Pathways" : "Available Pathways"}
            </h2>
            
            {pathwaysLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-12 w-12 rounded-md" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pathways?.filter(p => !enrolledIds.has(p.id)).map((pathway, index) => {
                  const Icon = iconMap[pathway.icon] || Brain;
                  const bgColor = colorMap[pathway.color] || "bg-gray-500";
                  const diffColor = difficultyColors[pathway.difficulty] || difficultyColors.mixed;

                  return (
                    <motion.div
                      key={pathway.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="h-full" data-testid={`card-pathway-${pathway.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-md ${bgColor} shrink-0`}>
                              <Icon className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold" data-testid={`text-pathway-title-${pathway.id}`}>{pathway.name}</h3>
                                {pathway.createdByUserId && (
                                  <Badge variant="outline" className="text-xs">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    Custom
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2" data-testid={`text-pathway-desc-${pathway.id}`}>
                                {pathway.description}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mb-4">
                                <Badge className={diffColor} variant="secondary" data-testid={`badge-difficulty-${pathway.id}`}>
                                  {pathway.difficulty}
                                </Badge>
                                {pathway.estimatedHours && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-hours-${pathway.id}`}>
                                    <Clock className="h-3 w-3" />
                                    ~{pathway.estimatedHours}h
                                  </span>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => enrollMutation.mutate(pathway.id)}
                                disabled={enrollMutation.isPending}
                                data-testid={`btn-enroll-${pathway.id}`}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Start Pathway
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
      </div>
    </AppLayout>
  );
}
