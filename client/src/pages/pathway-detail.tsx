import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  ChevronRight,
  Lock,
  CheckCircle2,
  Atom,
  Wrench,
  Rocket,
  Code,
  Brain,
  Calculator,
  Beaker,
  Leaf,
  Music,
  GitBranch,
  FlaskConical,
  Zap,
  AudioWaveform,
  Lightbulb,
  Cog,
  Cpu,
  Boxes,
  Flower2,
  Dna,
  BrainCircuit,
  Globe2,
  Network,
  Layers,
  Target,
  Sparkles,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/app-layout";
import { Link } from "wouter";
import { SkillTree } from "@/components/skill-tree";
import { cn } from "@/lib/utils";
import type { Topic } from "@shared/schema";

interface PathwayTopic {
  topic: Topic;
  order: number;
  prerequisiteTopicIds?: number[] | null;
  impactScore?: number;
  impactTier?: string;
  estimatedHours?: number;
  phaseLabel?: string | null;
  whyItMatters?: string | null;
}

interface Pathway {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  difficulty: string;
  estimatedHours: number | null;
  trackType?: string;
  targetRole?: string | null;
  roadmapMeta?: {
    capstoneBottleneck?: string;
    priorBackground?: string | null;
  } | null;
  isActive: boolean;
}

interface PathwayDetail {
  pathway: Pathway;
  topics: PathwayTopic[];
}

interface PathwayTimelineNode {
  topicId: number;
  title: string;
  description: string;
  order: number;
  phaseLabel: string;
  impactTier: "foundation" | "core" | "high_impact" | "frontier";
  impactScore: number;
  isRequired: boolean;
  whyItMatters: string;
  prerequisiteTopicIds: number[];
  grossHours: number;
  priorMasteryPct: number;
  priorConceptsCount: number;
  hoursSaved: number;
  netHours: number;
  cumulativeHoursSequential: number;
  estimatedWeekSequential: number;
  unitCount: number;
  status: "mastered" | "in_progress" | "ready" | "locked";
}

interface PathwayTimelineReport {
  pathway: Pathway;
  dailyMinutes: number;
  paceMode: "fast_track" | "balanced" | "rigorous";
  paceMultiplier: number;
  grossTotalHours: number;
  priorSavedHours: number;
  netBaseHours: number;
  adjustedRemainingHours: number;
  estimatedDays: number;
  estimatedWeeks: number;
  projectedCompletionDate: string;
  nodesSequential: PathwayTimelineNode[];
  nodesHighImpactFirst: PathwayTimelineNode[];
}

const iconMap: Record<string, typeof Brain> = {
  Atom,
  Wrench,
  Rocket,
  Code,
  Brain,
  Calculator,
  Beaker,
  Leaf,
  Music,
  GitBranch,
  Flask: FlaskConical,
  Zap,
  AudioWaveform,
  Lightbulb,
  Cog,
  Cpu,
  Boxes,
  Flower2,
  Dna,
  BrainCircuit,
  Globe2,
  Network,
  Lock,
  Layers,
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

const impactTierStyles: Record<string, { label: string; className: string }> = {
  foundation: {
    label: "Foundation Underlayment",
    className: "border-blue-500/40 text-blue-400 bg-blue-500/10",
  },
  core: {
    label: "Core Pillar",
    className: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
  },
  high_impact: {
    label: "Highest-Impact (80/20)",
    className: "border-amber-500/50 text-amber-400 bg-amber-500/15",
  },
  frontier: {
    label: "Frontier & SOTA",
    className: "border-purple-500/50 text-purple-400 bg-purple-500/15",
  },
};

export default function PathwayDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const pathwayId = params.id;

  const [dailyMinutes, setDailyMinutes] = useState<number>(60);
  const [paceMode, setPaceMode] = useState<"fast_track" | "balanced" | "rigorous">("balanced");
  const [viewMode, setViewMode] = useState<"sequential" | "impact" | "tree">("sequential");

  const { data, isLoading, error } = useQuery<PathwayDetail>({
    queryKey: [`/api/pathways/${pathwayId}`],
    enabled: !!pathwayId,
  });

  const { data: timeline } = useQuery<PathwayTimelineReport>({
    queryKey: [`/api/pathways/${pathwayId}/timeline`, dailyMinutes, paceMode],
    queryFn: async () => {
      const res = await fetch(
        `/api/pathways/${pathwayId}/timeline?dailyMinutes=${dailyMinutes}&paceMode=${paceMode}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load timeline");
      return res.json();
    },
    enabled: !!pathwayId,
  });

  const { data: mastered = [] } = useQuery<{ topicId: number; topicTitle: string }[]>({
    queryKey: ["/api/user/mastered-topics"],
  });

  const masteredTopicIds = useMemo(() => {
    const s = new Set(mastered.map((m) => m.topicId));
    for (const n of timeline?.nodesSequential || []) {
      if (n.priorMasteryPct >= 80 || n.status === "mastered") s.add(n.topicId);
    }
    return s;
  }, [mastered, timeline]);

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
        <div className="p-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-24 w-full mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
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

  // Group sequential nodes by phaseLabel
  const phasesSequential = (() => {
    const nodes = timeline?.nodesSequential || [];
    const groups: { phase: string; items: PathwayTimelineNode[] }[] = [];
    for (const n of nodes) {
      const last = groups[groups.length - 1];
      if (!last || last.phase !== n.phaseLabel) {
        groups.push({ phase: n.phaseLabel, items: [n] });
      } else {
        last.items.push(n);
      }
    }
    return groups;
  })();

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/pathways">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pathways
            </Button>
          </Link>

          <Card className="overflow-hidden">
            <div className={`h-2 ${bgColor}`} />
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className={`p-3 sm:p-4 rounded-md ${bgColor} shrink-0`}>
                  <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h1 className="text-xl sm:text-2xl font-bold break-words" data-testid="text-pathway-title">
                      {pathway.name}
                    </h1>
                    {pathway.trackType && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {pathway.trackType.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm sm:text-base mb-3 break-words" data-testid="text-pathway-description">
                    {pathway.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={difficultyColors[pathway.difficulty] || difficultyColors.mixed} data-testid="badge-difficulty">
                      {pathway.difficulty}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {timeline ? `${timeline.grossTotalHours}h total` : `${pathway.estimatedHours || 40}h`}
                    </Badge>
                    <Badge variant="secondary">{sortedTopics.length} building blocks</Badge>
                  </div>
                </div>
              </div>

              {pathway.roadmapMeta?.capstoneBottleneck && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
                  <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    Frontier Capstone & SOTA Target
                  </span>
                  <p className="text-muted-foreground">{pathway.roadmapMeta.capstoneBottleneck}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Interactive Timeline, Pacing & Prior-Knowledge Simulator */}
        {timeline && (
          <Card className="border-primary/25 bg-card/60" data-testid="section-pathway-timeline-simulator">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Personalized Timeline & Prior-Knowledge Simulator
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Adjust your daily commitment and learning speed — hours already covered in your 3D Knowledge Web (via JIT, Linear, or Agent sessions) are automatically discounted.
                  </p>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-background/70">
                  <button
                    type="button"
                    onClick={() => setViewMode("sequential")}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-md transition-colors",
                      viewMode === "sequential"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    data-testid="toggle-pathway-sequential"
                  >
                    Sequential Phases
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("impact")}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-md transition-colors",
                      viewMode === "impact"
                        ? "bg-amber-500 text-black font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    data-testid="toggle-pathway-impact"
                  >
                    Highest-Impact First (80/20)
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("tree")}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-md transition-colors",
                      viewMode === "tree"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    data-testid="toggle-pathway-tree"
                  >
                    DAG Skill Tree
                  </button>
                </div>
              </div>

              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Curriculum Volume</p>
                  <p className="text-lg font-bold mt-0.5">{timeline.grossTotalHours} hrs</p>
                  <p className="text-[11px] text-muted-foreground">{timeline.nodesSequential.length} building-block courses</p>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-400">Prior Knowledge Discount</p>
                  <p className="text-lg font-bold text-emerald-400 mt-0.5">-{timeline.priorSavedHours} hrs</p>
                  <p className="text-[11px] text-muted-foreground">Credited from 3D Map & Ledger</p>
                </div>
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-cyan-400">Adjusted Remaining</p>
                  <p className="text-lg font-bold text-cyan-400 mt-0.5">{timeline.adjustedRemainingHours} hrs</p>
                  <p className="text-[11px] text-muted-foreground">At {timeline.paceMultiplier}x pace multiplier</p>
                </div>
                <div className="rounded-lg border border-primary/40 bg-primary/10 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-primary">Projected Proficiency</p>
                  <p className="text-lg font-bold mt-0.5" data-testid="text-estimated-weeks">
                    ~{timeline.estimatedWeeks} weeks ({timeline.estimatedDays}d)
                  </p>
                  <p className="text-[11px] text-muted-foreground">Target: {timeline.projectedCompletionDate}</p>
                </div>
              </div>

              {/* Controls: Daily Minutes + Pace Mode */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mr-1">
                    Daily Study Time:
                  </span>
                  {[
                    { mins: 30, label: "30m/day" },
                    { mins: 45, label: "45m/day" },
                    { mins: 60, label: "1h/day" },
                    { mins: 90, label: "1.5h/day" },
                    { mins: 120, label: "2h/day" },
                    { mins: 180, label: "3h/day (Sprint)" },
                  ].map((opt) => (
                    <button
                      key={opt.mins}
                      type="button"
                      onClick={() => setDailyMinutes(opt.mins)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full border transition-colors",
                        dailyMinutes === opt.mins
                          ? "border-primary bg-primary text-primary-foreground font-medium"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                      data-testid={`sim-daily-${opt.mins}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mr-1">
                    Learning Speed:
                  </span>
                  {(
                    [
                      { id: "fast_track", label: "Fast-Track (1.35x)" },
                      { id: "balanced", label: "Balanced (1.0x)" },
                      { id: "rigorous", label: "Rigorous Depth (0.75x)" },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPaceMode(p.id)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full border transition-colors",
                        paceMode === p.id
                          ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-400 font-medium"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                      data-testid={`sim-pace-${p.id}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Building Blocks Display */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          {sortedTopics.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No topics have been added to this pathway yet.
              </CardContent>
            </Card>
          ) : viewMode === "tree" ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Prerequisite DAG Skill Tree
              </h2>
              <SkillTree
                topics={sortedTopics}
                masteredTopicIds={masteredTopicIds}
                onTopicClick={handleTopicClick}
              />
            </div>
          ) : viewMode === "impact" && timeline ? (
            /* Highest-Impact First (80/20 Pareto Ranking) */
            <div className="space-y-3" data-testid="pathway-view-impact">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-400" />
                  Highest-Impact Building Blocks First (80/20 Pareto Order)
                </h2>
                <span className="text-xs text-muted-foreground">
                  Ranked by direct leverage for {pathway.name}
                </span>
              </div>
              {timeline.nodesHighImpactFirst.map((node, index) => {
                const tierMeta = impactTierStyles[node.impactTier] || impactTierStyles.core;
                return (
                  <Card
                    key={node.topicId}
                    className={cn(
                      "cursor-pointer hover-elevate transition-all",
                      node.status === "mastered" && "border-emerald-500/40 bg-emerald-500/5",
                    )}
                    onClick={() => handleTopicClick(node.topicId)}
                    data-testid={`impact-node-${node.topicId}`}
                  >
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs">
                            #{index + 1} · Impact {node.impactScore}/100
                          </Badge>
                          <Badge variant="outline" className={cn("text-xs", tierMeta.className)}>
                            {tierMeta.label}
                          </Badge>
                          <Badge variant="secondary" className="text-[11px]">
                            {node.phaseLabel}
                          </Badge>
                          {node.priorMasteryPct > 0 && (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">
                              {node.priorMasteryPct}% Prior Mastery (-{node.hoursSaved}h)
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-base font-semibold">{node.title}</h3>
                        <p className="text-xs text-muted-foreground">{node.description}</p>
                        {node.whyItMatters && (
                          <p className="text-xs text-foreground/90 bg-muted/40 rounded px-2.5 py-1.5 border border-border/50">
                            <strong className="text-primary">Why it matters:</strong> {node.whyItMatters}
                          </p>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-end justify-between gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-semibold block">
                            {node.netHours}h remaining{" "}
                            {node.hoursSaved > 0 && (
                              <span className="text-muted-foreground line-through text-[11px]">
                                ({node.grossHours}h)
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {node.unitCount} linear lessons
                          </span>
                        </div>
                        <Button size="sm" className="h-8 text-xs">
                          Open Course
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Sequential Building Blocks (Phase 1 Foundations -> Phase 4 Frontier SOTA) */
            <div className="space-y-6" data-testid="pathway-view-sequential">
              {phasesSequential.map((group, gIdx) => (
                <div key={group.phase} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <Badge variant="outline" className="border-primary/40 text-primary">
                        Stage {gIdx + 1}
                      </Badge>
                      {group.phase}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {group.items.reduce((s, x) => s + x.netHours, 0).toFixed(1)}h net study
                    </span>
                  </div>

                  <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-primary/25">
                    {group.items.map((node) => {
                      const tierMeta = impactTierStyles[node.impactTier] || impactTierStyles.core;
                      return (
                        <Card
                          key={node.topicId}
                          className={cn(
                            "cursor-pointer hover-elevate transition-all",
                            node.status === "mastered" && "border-emerald-500/40 bg-emerald-500/5",
                          )}
                          onClick={() => handleTopicClick(node.topicId)}
                          data-testid={`seq-node-${node.topicId}`}
                        >
                          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs font-semibold">
                                  Block {node.order} · Week {node.estimatedWeekSequential}
                                </Badge>
                                <Badge variant="outline" className={cn("text-xs", tierMeta.className)}>
                                  {tierMeta.label} · Impact {node.impactScore}/100
                                </Badge>
                                {node.priorMasteryPct > 0 && (
                                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    {node.priorMasteryPct}% Covered (-{node.hoursSaved}h)
                                  </Badge>
                                )}
                              </div>
                              <h4 className="text-base font-semibold">{node.title}</h4>
                              <p className="text-xs text-muted-foreground">{node.description}</p>
                              {node.whyItMatters && (
                                <p className="text-xs text-foreground/90 bg-muted/40 rounded px-2.5 py-1.5 border border-border/50">
                                  <strong className="text-primary">Why it matters:</strong> {node.whyItMatters}
                                </p>
                              )}
                            </div>

                            <div className="flex sm:flex-col items-end justify-between gap-2 shrink-0">
                              <div className="text-right">
                                <span className="text-xs font-semibold block">
                                  {node.netHours}h net{" "}
                                  {node.hoursSaved > 0 && (
                                    <span className="text-muted-foreground line-through text-[11px]">
                                      ({node.grossHours}h)
                                    </span>
                                  )}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  Cumulative: ~{node.cumulativeHoursSequential}h · {node.unitCount} units
                                </span>
                              </div>
                              <Button size="sm" variant="outline" className="h-8 text-xs">
                                {node.priorMasteryPct > 0 ? "Resume / Review" : "Start Block"}
                                <ChevronRight className="h-3.5 w-3.5 ml-1" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
