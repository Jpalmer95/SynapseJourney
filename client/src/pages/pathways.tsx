import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Compass, Clock, ChevronRight, Check, Plus, Atom, Wrench, Rocket, Code, Brain, Calculator, Beaker, Leaf, Music, GitBranch, FlaskConical,
  Zap, AudioWaveform, Lightbulb, Cog, Cpu, Boxes, Flower2, Dna, BrainCircuit, Globe2, Network, Lock, Layers, Sparkles, Target, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/app-layout";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
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
  const [, setLocation] = useLocation();
  const [targetGoal, setTargetGoal] = useState("");
  const [trackType, setTrackType] = useState<"role_career" | "industry_frontier" | "classical_science" | "alt_degree_mba">("role_career");
  const [priorBackground, setPriorBackground] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(60);

  const { data: pathways, isLoading: pathwaysLoading } = useQuery<Pathway[]>({
    queryKey: ["/api/pathways"],
  });

  const { data: userPathways, isLoading: userPathwaysLoading } = useQuery<UserPathway[]>({
    queryKey: ["/api/user/pathways"],
  });

  const { data: chemistry } = useQuery<{
    signatureTitle: string;
    collaborationSuperpower: string;
    totalActiveTopics: number;
    totalLedgerConcepts: number;
    domainComposition: {
      domain: string;
      topicCount: number;
      avgMasteryPct: number;
      weightPct: number;
      sampleTopics: string[];
    }[];
    rareIntersections: {
      bridge: string;
      whyItCompounds: string;
    }[];
  }>({
    queryKey: ["/api/learn/knowledge-chemistry"],
    retry: false,
  });

  const architectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pathways/architect", {
        targetGoal: targetGoal.trim(),
        trackType,
        priorBackground: priorBackground.trim() || undefined,
        dailyMinutes,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pathways"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/pathways"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-graph"] });
      toast({
        title: "Mastery Roadmap Architected!",
        description: `Built "${data.pathway?.name}" (${data.reusedTopicsCount} foundation courses + ${data.createdTopicsCount} specialized building blocks).`,
      });
      if (data.pathway?.id) {
        setLocation(`/pathway/${data.pathway.id}`);
      }
    },
    onError: (err: any) => {
      toast({
        title: "Could not architect roadmap",
        description: err?.message || "Please sign in and try again.",
        variant: "destructive",
      });
    },
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
              Curated learning journeys to help you master entire fields, target engineering roles, or classical sciences — broken into sequential building blocks, Pareto impact scores, and a live completion timeline.
            </p>
          </motion.div>

          {/* Role, Industry & Classical Mastery Roadmap Architect */}
          <Card
            className="mb-8 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-cyan-500/5"
            data-testid="card-roadmap-architect"
          >
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                    <Target className="h-3 w-3 mr-1" />
                    Role, Industry & Classical Science Architect
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    Prior-Knowledge Discount + Timeline Simulator
                  </Badge>
                </div>
                <h2 className="text-lg font-bold">
                  Curate a building-block roadmap & timeline for any role, industry, or discipline
                </h2>
                <p className="text-xs text-muted-foreground">
                  Combines foundational hard-science/math courses from the catalog with specialized building-block courses, ranks each by impact (80/20 Pareto vs Sequential), and calculates your timeline based on your daily study pace and existing 3D Map progress.
                </p>
              </div>

              {/* Track Type Selector */}
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: "role_career", label: "Target Role / Career", desc: "e.g. Frontier XR Chip Engineer" },
                    { id: "industry_frontier", label: "Frontier Industry", desc: "e.g. Spatial Computing & Photonics" },
                    { id: "classical_science", label: "Classical Hard Science", desc: "e.g. Theoretical Physics & Electrodynamics" },
                    { id: "alt_degree_mba", label: "Alt-MBA & Cross-Functional", desc: "M7/Sloan-grade Economics, Finance, Strategy & Venture" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    title={t.desc}
                    onClick={() => setTrackType(t.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      trackType === t.id
                        ? "border-primary bg-primary text-primary-foreground font-medium"
                        : "border-border/70 text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`track-type-${t.id}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Input
                  value={targetGoal}
                  onChange={(e) => setTargetGoal(e.target.value)}
                  placeholder="e.g. Frontier XR Chip Engineer, Alt-MBA: Technical Founder & Venture Strategy, Classical Electrodynamics…"
                  className="h-9 text-sm bg-background"
                  data-testid="input-architect-target-goal"
                />
                <Input
                  value={priorBackground}
                  onChange={(e) => setPriorBackground(e.target.value)}
                  placeholder="Optional prior background (e.g. Undergrad calculus + basic Python)"
                  className="h-9 text-sm bg-background"
                  data-testid="input-architect-prior-bg"
                />
              </div>

              {/* Preset examples + Daily pace + Submit */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Try:</span>
                  {[
                    { label: "Frontier XR Chip Engineer", track: "role_career" as const },
                    { label: "Alt-MBA: Technical Founder & Venture Strategy", track: "alt_degree_mba" as const },
                    { label: "Autonomous Robotics Control Architect", track: "role_career" as const },
                    { label: "Classical Hard Sciences: Physics & Electrodynamics", track: "classical_science" as const },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setTargetGoal(preset.label);
                        setTrackType(preset.track);
                      }}
                      className="text-[11px] px-2.5 py-0.5 rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      data-testid={`preset-${preset.label.slice(0, 18).toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {[30, 60, 90, 120].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDailyMinutes(mins)}
                        className={`text-[11px] px-2 py-0.5 rounded-md border ${
                          dailyMinutes === mins
                            ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-400"
                            : "border-border/60 text-muted-foreground"
                        }`}
                        data-testid={`chip-daily-mins-${mins}`}
                      >
                        {mins}m/d
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    disabled={architectMutation.isPending || targetGoal.trim().length < 3}
                    onClick={() => architectMutation.mutate()}
                    data-testid="button-architect-roadmap"
                  >
                    {architectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4 mr-1.5" />
                    )}
                    Architect Roadmap & Timeline
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cross-Functional "Knowledge Chemistry" Signature */}
          {chemistry && chemistry.domainComposition.length > 0 && (
            <Card
              className="mb-8 border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-purple-500/5"
              data-testid="card-knowledge-chemistry"
            >
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-xs">
                        <FlaskConical className="h-3 w-3 mr-1" />
                        Your Cross-Functional Knowledge Chemistry
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {chemistry.totalActiveTopics} active topics · {chemistry.totalLedgerConcepts} ledger concepts
                      </span>
                    </div>
                    <h3 className="text-base font-bold mt-1">{chemistry.signatureTitle}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{chemistry.collaborationSuperpower}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {chemistry.domainComposition.map((d) => (
                    <div
                      key={d.domain}
                      className="rounded-md border border-border/70 bg-background/80 px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-semibold text-foreground">{d.domain}</span>{" "}
                      <span className="text-amber-400 font-mono">{d.weightPct}%</span>{" "}
                      <span className="text-muted-foreground text-[11px]">({d.avgMasteryPct}% avg mastery)</span>
                    </div>
                  ))}
                </div>

                {chemistry.rareIntersections.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-2">
                    {chemistry.rareIntersections.map((r, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-[11px]"
                        title={r.whyItCompounds}
                      >
                        Compound Bridge: {r.bridge}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => enrollMutation.mutate(pathway.id)}
                                  disabled={enrollMutation.isPending}
                                  data-testid={`btn-enroll-${pathway.id}`}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Start Pathway
                                </Button>
                                <Link href={`/pathway/${pathway.id}`}>
                                  <Button size="sm" variant="outline" data-testid={`btn-view-timeline-${pathway.id}`}>
                                    View Timeline & Blocks
                                  </Button>
                                </Link>
                              </div>
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
