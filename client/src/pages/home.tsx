import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { RabbitHole } from "@/components/rabbit-hole";
import { AppLayout } from "@/components/app-layout";
import { MyCoursesStrip } from "@/components/my-courses-strip";
import { CourseCreator } from "@/components/course-creator";
import { HomeSearch } from "@/components/home-search";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Compass,
  Map as MapIcon,
  Telescope,
  Sparkles,
  Zap,
  BookOpen,
  GitBranch,
  AlertTriangle,
  ExternalLink,
  PlugZap,
  ArrowRight,
  Layers,
  Target,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Topic, Category, SotaBottleneck, KnowledgeResource } from "@shared/schema";

export function HomePage() {
  const { user } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const [resumeUnitId, setResumeUnitId] = useState<number | undefined>();

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: bottlenecks = [] } = useQuery<(SotaBottleneck & { topicTitle?: string })[]>({
    queryKey: ["/api/open-science/bottlenecks"],
  });

  const { data: resources = [] } = useQuery<(KnowledgeResource & { topicTitle?: string })[]>({
    queryKey: ["/api/resources"],
  });

  const { data: graphData } = useQuery<{
    nodes: { id: number; title: string; category?: string; color: string; mastery: number; status: string }[];
    links: { source: number; target: number; type: string }[];
  }>({
    queryKey: ["/api/knowledge-graph"],
    enabled: !!user,
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const handleDive = (topic: Topic, category?: Category, unitId?: number) => {
    setSelectedTopic(topic);
    setSelectedCategory(category || (topic.categoryId ? categoryMap.get(topic.categoryId) : undefined));
    setResumeUnitId(unitId);
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setSelectedCategory(undefined);
    setResumeUnitId(undefined);
  };

  const exploredNodes = (graphData?.nodes || []).filter((n) => n.status !== "unexplored" || n.mastery > 0);
  const masteredNodes = (graphData?.nodes || []).filter((n) => n.status === "mastered" || n.mastery >= 80);

  return (
    <AppLayout mobileTitle="Polymath Command Center">
      <AnimatePresence mode="wait">
        {selectedTopic ? (
          <RabbitHole
            key="rabbit-hole"
            topic={selectedTopic}
            category={selectedCategory}
            onBack={handleBack}
            resumeUnitId={resumeUnitId}
          />
        ) : (
          <div key="command-center" className="min-h-screen pb-24 md:pb-12 pt-16 md:pt-0">
            {/* Top Hybrid Search & Command Bar */}
            <div className="sticky top-16 md:top-0 z-30 px-4 md:px-8 py-3 bg-background/90 backdrop-blur border-b border-border/50">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 max-w-2xl">
                  <HomeSearch onDive={handleDive} />
                </div>
                <div className="flex items-center gap-2 shrink-0 pr-12 md:pr-20">
                  <Link href="/map">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                      <MapIcon className="h-3.5 w-3.5 text-primary" />
                      3D Web ({graphData?.nodes?.length || topics.length})
                    </Button>
                  </Link>
                  <Link href="/open-science">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                      <Telescope className="h-3.5 w-3.5 text-amber-500" />
                      SOTA Lab ({bottlenecks.length})
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 space-y-8">
              {/* Hero Banner: Polymath Command Center */}
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-cyan-500/5 p-5 md:p-7">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Polymath Learning & Open Science Engine
                      </Badge>
                      <Badge variant="secondary" className="text-xs gap-1">
                        <PlugZap className="h-3 w-3 text-cyan-400" />
                        BYOC + Agentic MCP Ready
                      </Badge>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                      Learn anything breadthwise, depthwise, or laser-focused JIT.
                    </h1>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Build adaptive courses tailored to an immediate repair/engineering goal or a multi-tier scientific mastery path. Every course feeds your 3D Knowledge Web, indexes open textbooks/papers, and surfaces unsolved SOTA bottlenecks.
                    </p>
                  </div>

                  {/* Quick Mode Indicators */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5 shrink-0">
                    <div className="p-3 rounded-xl border border-border/60 bg-card/60">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                        <Target className="h-3.5 w-3.5" />
                        JIT Goal Mode
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">3–5 surgical units to solve a problem today</p>
                    </div>
                    <div className="p-3 rounded-xl border border-border/60 bg-card/60">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                        <Layers className="h-3.5 w-3.5" />
                        Dynamic Depth
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">1-tier survey up to 4-tier + sub-topic trees</p>
                    </div>
                    <div className="p-3 rounded-xl border border-border/60 bg-card/60">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                        <GitBranch className="h-3.5 w-3.5" />
                        Concept Fusion
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Synthesize 2–3 fields into a new curriculum</p>
                    </div>
                    <div className="p-3 rounded-xl border border-border/60 bg-card/60">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <Telescope className="h-3.5 w-3.5" />
                        Feynman & Socratic
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">First-principles tutor & SOTA hypothesis lab</p>
                    </div>
                  </div>
                </div>

                {/* Active Continuum + Course Builder inside Command Center */}
                {user ? (
                  <div className="mt-6 pt-5 border-t border-border/50 space-y-4">
                    <MyCoursesStrip onOpen={(topic, category) => handleDive(topic, category)} />
                    <CourseCreator onStart={(topic, category) => handleDive(topic, category)} />
                  </div>
                ) : (
                  <div className="mt-5 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Sign in to track your 3D Knowledge Web, create custom JIT/Fusion courses with your own compute, or connect Hermes Agent via MCP.
                    </p>
                    <Link href="/auth">
                      <Button size="sm">Sign In / Create Account</Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* 3-Column Command Center Grid: 3D Knowledge Web Status + SOTA Frontier Bottlenecks + OER Commons */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Column 1: 3D Knowledge Constellation & Progress */}
                <Card className="border-primary/25 bg-card/50 flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-primary" />
                        3D Knowledge Constellation
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {exploredNodes.length} Active / {masteredNodes.length} Mastered
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Topics are projected onto 3 semantic PCA axes (Applied↔Theoretical, Natural↔Synthetic, Micro↔Macro).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {exploredNodes.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Your Active & Mastered Nodes:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {exploredNodes.slice(0, 8).map((n) => {
                            const t = topics.find((tp) => tp.id === n.id);
                            return (
                              <Badge
                                key={n.id}
                                variant="secondary"
                                className="cursor-pointer hover:bg-primary/20 text-xs py-1"
                                onClick={() => t && handleDive(t)}
                              >
                                <span
                                  className="w-2 h-2 rounded-full mr-1.5 inline-block"
                                  style={{ backgroundColor: n.color }}
                                />
                                {n.title} ({n.mastery}%)
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                        Start any course below to light up your personal 3D Knowledge Web and track cross-domain bridges.
                      </div>
                    )}
                  </CardContent>
                  <div className="p-4 pt-0">
                    <Link href="/map">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <Compass className="h-3.5 w-3.5" />
                        Launch Interactive 3D Map
                        <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                      </Button>
                    </Link>
                  </div>
                </Card>

                {/* Column 2: SOTA Frontier Bottlenecks */}
                <Card className="border-amber-500/25 bg-card/50 flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        SOTA Frontier Bottlenecks
                      </CardTitle>
                      <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-xs">
                        {bottlenecks.length} Unsolved
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Real scientific & engineering roadblocks extracted from frontier courses and curated research.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {bottlenecks.slice(0, 3).map((bn) => (
                      <div
                        key={bn.id}
                        className="p-2.5 rounded-lg border border-border/60 bg-background/60 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-amber-400 uppercase truncate">
                            {bn.domain}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">▲ {bn.upvotes}</span>
                        </div>
                        <p className="text-xs font-medium line-clamp-1">{bn.title}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{bn.whyItMatters}</p>
                      </div>
                    ))}
                  </CardContent>
                  <div className="p-4 pt-0">
                    <Link href="/open-science">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <Telescope className="h-3.5 w-3.5 text-amber-500" />
                        Explore Bottlenecks & Propose Hypothesis
                        <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                      </Button>
                    </Link>
                  </div>
                </Card>

                {/* Column 3: Open Educational Resource (OER) Commons */}
                <Card className="border-emerald-500/25 bg-card/50 flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-emerald-500" />
                        Open Resource Commons
                      </CardTitle>
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">
                        {resources.length} Indexed
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Verified textbooks, MIT OCW lectures, arXiv preprints, and interactive simulations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {resources.slice(0, 3).map((r) => (
                      <a
                        key={r.id}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2.5 rounded-lg border border-border/60 bg-background/60 hover:border-emerald-500/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-emerald-400 uppercase">
                            {r.providerName || r.resourceType}
                          </span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                        </div>
                        <p className="text-xs font-medium line-clamp-1 mt-0.5">{r.title}</p>
                      </a>
                    ))}
                  </CardContent>
                  <div className="p-4 pt-0">
                    <Link href="/open-science">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                        Search Full OER Library
                        <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              </div>

              {/* Multi-Domain Topic & Course Directory */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Knowledge Domains & Courses ({topics.length})
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Click any course to open its dynamic curriculum, Feynman/Socratic AI tutor, and NextGen SOTA roadblocks.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href="/pathways">
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                        <GitBranch className="h-3.5 w-3.5" />
                        Curated Pathways
                      </Button>
                    </Link>
                    <Link href="/explore">
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                        Full Catalog
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {topics.slice(0, 16).map((topic) => {
                    const cat = topic.categoryId ? categoryMap.get(topic.categoryId) : undefined;
                    return (
                      <Card
                        key={topic.id}
                        className="cursor-pointer hover:border-primary/50 transition-all bg-card/60 flex flex-col justify-between"
                        onClick={() => handleDive(topic, cat)}
                        data-testid={`card-home-topic-${topic.id}`}
                      >
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            {cat && (
                              <Badge variant="secondary" className="text-[10px]">
                                {cat.name}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {topic.difficulty}
                            </Badge>
                          </div>
                          <CardTitle className="text-base leading-snug line-clamp-1">{topic.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <p className="text-xs text-muted-foreground line-clamp-2">{topic.description}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
