import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Telescope,
  ArrowUp,
  MessageSquare,
  Plus,
  User,
  Link as LinkIcon,
  Sparkles,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  FlaskConical,
  CheckCircle2,
  Search,
  Brain,
  Loader2,
  Compass,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import type { OpenScienceIdea, Topic, OpenScienceComment, SotaBottleneck, KnowledgeResource } from "@shared/schema";

export function OpenSciencePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("bottlenecks");
  const [domainFilter, setDomainFilter] = useState("all");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all");
  const [resourceSearch, setResourceSearch] = useState("");
  const [ideaSearch, setIdeaSearch] = useState("");

  // Modals
  const [isSubmitIdeaOpen, setIsSubmitIdeaOpen] = useState(false);
  const [isSubmitBottleneckOpen, setIsSubmitBottleneckOpen] = useState(false);
  const [isSubmitResourceOpen, setIsSubmitResourceOpen] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);

  // Hypothesis form state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newHypothesis, setNewHypothesis] = useState("");
  const [newMethodology, setNewMethodology] = useState("");
  const [newFalsifiability, setNewFalsifiability] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("none");
  const [selectedBottleneckId, setSelectedBottleneckId] = useState<string>("none");

  // Bottleneck form state
  const [bnDomain, setBnDomain] = useState("Artificial Intelligence & ML");
  const [bnTitle, setBnTitle] = useState("");
  const [bnDescription, setBnDescription] = useState("");
  const [bnWhyItMatters, setBnWhyItMatters] = useState("");
  const [bnApproaches, setBnApproaches] = useState("");
  const [bnQuestions, setBnQuestions] = useState("");

  // OER Resource form state
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resType, setResType] = useState("course");
  const [resDescription, setResDescription] = useState("");

  const [newComment, setNewComment] = useState("");

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  const { data: bottlenecks = [], isLoading: loadingBottlenecks } = useQuery<(SotaBottleneck & { topicTitle?: string })[]>({
    queryKey: ["/api/open-science/bottlenecks"],
  });

  const { data: ideas = [], isLoading: loadingIdeas } = useQuery<(OpenScienceIdea & { topic?: Topic; bottleneck?: SotaBottleneck })[]>({
    queryKey: ["/api/open-science"],
  });

  const { data: resources = [], isLoading: loadingResources } = useQuery<(KnowledgeResource & { topicTitle?: string })[]>({
    queryKey: ["/api/resources"],
  });

  const { data: comments = [] } = useQuery<OpenScienceComment[]>({
    queryKey: ["/api/open-science", selectedIdeaId, "comments"],
    enabled: !!selectedIdeaId,
  });

  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const b of bottlenecks) {
      if (b.domain) set.add(b.domain);
    }
    return ["all", ...Array.from(set)];
  }, [bottlenecks]);

  const filteredBottlenecks = useMemo(() => {
    return bottlenecks.filter((b) => domainFilter === "all" || b.domain === domainFilter);
  }, [bottlenecks, domainFilter]);

  const filteredIdeas = useMemo(() => {
    const q = ideaSearch.trim().toLowerCase();
    if (!q) return ideas;
    return ideas.filter((i) =>
      `${i.title} ${i.content} ${i.hypothesis || ""} ${i.methodology || ""} ${i.authorName || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [ideas, ideaSearch]);

  const filteredResources = useMemo(() => {
    const q = resourceSearch.trim().toLowerCase();
    return resources.filter((r) => {
      if (resourceTypeFilter !== "all" && r.resourceType !== resourceTypeFilter) return false;
      if (q) {
        const hay = `${r.title} ${r.description} ${r.providerName || ""} ${r.topicTitle || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [resources, resourceTypeFilter, resourceSearch]);

  // Mutations
  const submitIdeaMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/open-science", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to submit hypothesis");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/open-science"] });
      setIsSubmitIdeaOpen(false);
      setNewTitle("");
      setNewContent("");
      setNewHypothesis("");
      setNewMethodology("");
      setNewFalsifiability("");
      setSelectedTopicId("none");
      setSelectedBottleneckId("none");
      setActiveTab("hypotheses");
      toast({
        title: "Hypothesis Published",
        description: "Your structured hypothesis is live in the Open Science Lab.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  const submitBottleneckMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/open-science/bottlenecks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to register SOTA bottleneck");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/open-science/bottlenecks"] });
      setIsSubmitBottleneckOpen(false);
      setBnTitle("");
      setBnDescription("");
      setBnWhyItMatters("");
      setBnApproaches("");
      setBnQuestions("");
      toast({ title: "SOTA Bottleneck Registered", description: "Added to the frontier challenge registry." });
    },
    onError: (err: any) => {
      toast({ title: "Could not register bottleneck", description: err.message, variant: "destructive" });
    },
  });

  const submitResourceMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add resource");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      setIsSubmitResourceOpen(false);
      setResTitle("");
      setResUrl("");
      setResDescription("");
      toast({ title: "Resource Indexed", description: "Added to the Open Educational Resource Commons." });
    },
    onError: (err: any) => {
      toast({ title: "Could not add resource", description: err.message, variant: "destructive" });
    },
  });

  const upvoteIdeaMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/open-science/${id}/upvote`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to upvote");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/open-science"] }),
  });

  const upvoteBottleneckMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/open-science/bottlenecks/${id}/upvote`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to upvote");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/open-science/bottlenecks"] }),
  });

  const aiReviewMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/open-science/${id}/review`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Peer review failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/open-science"] });
      toast({
        title: "AI Peer Review Complete",
        description: "First-principles critique and falsification test attached.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "BYOC Compute Needed for Peer Review",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (payload: { id: number; content: string }) => {
      const res = await fetch(`/api/open-science/${payload.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: payload.content }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/open-science", selectedIdeaId, "comments"] });
      setNewComment("");
    },
  });

  const handleLaunchHypothesisFromBottleneck = (bn: SotaBottleneck) => {
    setSelectedBottleneckId(String(bn.id));
    if (bn.topicId) setSelectedTopicId(String(bn.topicId));
    setNewTitle(`Hypothesis for: ${bn.title}`);
    setNewContent(`Targeting SOTA Bottleneck: ${bn.title}\n\nProposed cross-functional mechanism:\n`);
    setIsSubmitIdeaOpen(true);
  };

  const handleIdeaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    submitIdeaMutation.mutate({
      title: newTitle.trim(),
      content: newContent.trim(),
      hypothesis: newHypothesis.trim() || null,
      methodology: newMethodology.trim() || null,
      falsifiability: newFalsifiability.trim() || null,
      topicId: selectedTopicId !== "none" ? parseInt(selectedTopicId, 10) : null,
      bottleneckId: selectedBottleneckId !== "none" ? parseInt(selectedBottleneckId, 10) : null,
    });
  };

  const handleBottleneckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bnTitle.trim() || !bnDescription.trim() || !bnWhyItMatters.trim()) return;
    submitBottleneckMutation.mutate({
      domain: bnDomain,
      title: bnTitle.trim(),
      description: bnDescription.trim(),
      whyItMatters: bnWhyItMatters.trim(),
      currentApproaches: bnApproaches
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      openQuestions: bnQuestions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      difficulty: "frontier",
      status: "open",
    });
  };

  const handleResourceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim()) return;
    submitResourceMutation.mutate({
      title: resTitle.trim(),
      url: resUrl.trim(),
      resourceType: resType,
      description: resDescription.trim() || `Open educational resource: ${resTitle.trim()}`,
      isFreeOer: true,
    });
  };

  return (
    <AppLayout mobileTitle="Open Science & SOTA">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary mb-1">
              <FlaskConical className="h-3.5 w-3.5" />
              Polymath Frontier & Commons
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Telescope className="h-8 w-8 text-primary" />
              Open Science, SOTA Bottlenecks & OER Commons
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
              Track real unsolved SOTA bottlenecks across industries, formulate falsifiable cross-domain hypotheses, run BYOC AI peer review, and explore the growing Open Educational Resource library.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={isSubmitBottleneckOpen} onOpenChange={setIsSubmitBottleneckOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Add SOTA Bottleneck
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[540px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Register Unsolved SOTA Bottleneck
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleBottleneckSubmit} className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs">Domain / Industry</Label>
                    <Input value={bnDomain} onChange={(e) => setBnDomain(e.target.value)} required />
                  </div>
                  <div>
                    <Label className="text-xs">Bottleneck Title</Label>
                    <Input
                      placeholder="e.g., Sub-millisecond Quantum LDPC Decoding Under Circuit Noise"
                      value={bnTitle}
                      onChange={(e) => setBnTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Technical Description of the Roadblock</Label>
                    <Textarea
                      rows={3}
                      placeholder="Why do current methods hit a wall here?"
                      value={bnDescription}
                      onChange={(e) => setBnDescription(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Why Solving This Matters</Label>
                    <Input
                      placeholder="What unlocks if this bottleneck is solved?"
                      value={bnWhyItMatters}
                      onChange={(e) => setBnWhyItMatters(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Current SOTA Approaches (one per line, optional)</Label>
                    <Textarea
                      rows={2}
                      placeholder="Approach 1&#10;Approach 2"
                      value={bnApproaches}
                      onChange={(e) => setBnApproaches(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Key Open Questions (one per line, optional)</Label>
                    <Textarea
                      rows={2}
                      placeholder="Question 1?&#10;Question 2?"
                      value={bnQuestions}
                      onChange={(e) => setBnQuestions(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitBottleneckMutation.isPending}>
                    {submitBottleneckMutation.isPending ? "Registering..." : "Publish SOTA Bottleneck"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isSubmitIdeaOpen} onOpenChange={setIsSubmitIdeaOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Propose Hypothesis
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Formulate Open Science Hypothesis
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleIdeaSubmit} className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs">Hypothesis / Proposal Title</Label>
                    <Input
                      placeholder="Concise, descriptive title..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Target SOTA Bottleneck (Optional)</Label>
                      <Select value={selectedBottleneckId} onValueChange={setSelectedBottleneckId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Link to SOTA bottleneck" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">General / Unlinked</SelectItem>
                          {bottlenecks.map((b) => (
                            <SelectItem key={b.id} value={String(b.id)}>
                              {b.title.slice(0, 55)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Primary Course / Topic (Optional)</Label>
                      <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Link to topic" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Cross-Disciplinary</SelectItem>
                          {topics.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Core Mechanism & Cross-Domain Rationale</Label>
                    <Textarea
                      rows={4}
                      placeholder="Explain your insight, mechanism, or cross-domain analogy..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Testable Prediction (Formal Hypothesis)</Label>
                    <Input
                      placeholder="If we apply X to Y, then metric Z will improve by..."
                      value={newHypothesis}
                      onChange={(e) => setNewHypothesis(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Minimal Viable Experiment / Simulation</Label>
                    <Textarea
                      rows={2}
                      placeholder="How can this be tested in 1-2 weeks using code, open datasets, or bench experiments?"
                      value={newMethodology}
                      onChange={(e) => setNewMethodology(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Falsifiability Criteria (What disproves this?)</Label>
                    <Input
                      placeholder="This hypothesis is falsified if..."
                      value={newFalsifiability}
                      onChange={(e) => setNewFalsifiability(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitIdeaMutation.isPending}>
                    {submitIdeaMutation.isPending ? "Publishing..." : "Publish Hypothesis to Lab"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bottlenecks" className="gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>SOTA Bottlenecks ({bottlenecks.length})</span>
            </TabsTrigger>
            <TabsTrigger value="hypotheses" className="gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              <span>Hypotheses & Lab ({ideas.length})</span>
            </TabsTrigger>
            <TabsTrigger value="commons" className="gap-2">
              <BookOpen className="h-4 w-4 text-emerald-500" />
              <span>OER Resource Commons ({resources.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SOTA BOTTLENECKS */}
          <TabsContent value="bottlenecks" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {domains.map((dom) => (
                <Button
                  key={dom}
                  size="sm"
                  variant={domainFilter === dom ? "default" : "outline"}
                  className="h-7 text-xs capitalize"
                  onClick={() => setDomainFilter(dom)}
                >
                  {dom === "all" ? "All Domains" : dom}
                </Button>
              ))}
            </div>

            {loadingBottlenecks ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : filteredBottlenecks.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <p className="text-muted-foreground">No SOTA bottlenecks match this filter yet.</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredBottlenecks.map((bn) => {
                  const approaches = Array.isArray(bn.currentApproaches) ? (bn.currentApproaches as string[]) : [];
                  const questions = Array.isArray(bn.openQuestions) ? (bn.openQuestions as string[]) : [];
                  return (
                    <Card key={bn.id} className="border-amber-500/25 bg-card/60 flex flex-col justify-between">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-xs">
                            {bn.domain}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            {bn.source === "nextgen_extracted" && (
                              <Badge variant="secondary" className="text-[10px]">Course Extracted</Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] uppercase">{bn.status}</Badge>
                          </div>
                        </div>
                        <CardTitle className="text-lg leading-snug">{bn.title}</CardTitle>
                        {bn.topicId && bn.topicTitle && (
                          <Link href={`/rabbit-hole?topic=${bn.topicId}`}>
                            <span className="text-xs text-primary hover:underline inline-flex items-center gap-1 cursor-pointer mt-1">
                              <Compass className="h-3 w-3" />
                              Course: {bn.topicTitle}
                            </span>
                          </Link>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <p className="text-muted-foreground">{bn.description}</p>
                        <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs">
                          <strong className="text-amber-400">Why solving this matters: </strong>
                          <span className="text-foreground/90">{bn.whyItMatters}</span>
                        </div>
                        {approaches.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Current SOTA Approaches:</p>
                            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                              {approaches.slice(0, 3).map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {questions.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-primary mb-1">Open Frontier Questions:</p>
                            <ul className="list-disc list-inside text-xs text-foreground/85 space-y-0.5">
                              {questions.slice(0, 2).map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 h-8"
                          onClick={() => upvoteBottleneckMutation.mutate(bn.id)}
                        >
                          <ArrowUp className="h-4 w-4" />
                          {bn.upvotes}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => handleLaunchHypothesisFromBottleneck(bn)}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Formulate Hypothesis
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: HYPOTHESES & PEER REVIEW LAB */}
          <TabsContent value="hypotheses" className="space-y-4">
            <div className="flex items-center gap-2 max-w-md">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search hypotheses, mechanisms, or authors..."
                value={ideaSearch}
                onChange={(e) => setIdeaSearch(e.target.value)}
                className="h-9"
              />
            </div>

            {loadingIdeas ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : filteredIdeas.length === 0 ? (
              <Card className="p-12 text-center border-dashed bg-card/50">
                <Telescope className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">No Hypotheses Matched</h3>
                <p className="text-muted-foreground mb-4">
                  Pick a SOTA bottleneck or propose a cross-domain hypothesis to start testing ideas.
                </p>
                <Button variant="outline" onClick={() => setIsSubmitIdeaOpen(true)}>
                  Propose Hypothesis
                </Button>
              </Card>
            ) : (
              <div className="grid gap-5">
                {filteredIdeas.map((idea) => {
                  const review = idea.aiReviewJson as any;
                  return (
                    <Card key={idea.id} className="bg-card/50 border-border/60">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-4 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <Badge variant="outline" className="text-xs uppercase">
                                {idea.status || "proposed"}
                              </Badge>
                              {idea.bottleneck && (
                                <Badge variant="secondary" className="text-xs">
                                  Targets: {idea.bottleneck.title.slice(0, 48)}
                                </Badge>
                              )}
                              {idea.topic && (
                                <Link href={`/rabbit-hole?topic=${idea.topic.id}`}>
                                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-primary/10">
                                    <LinkIcon className="h-3 w-3 mr-1" />
                                    {idea.topic.title}
                                  </Badge>
                                </Link>
                              )}
                            </div>
                            <CardTitle className="text-xl leading-tight">{idea.title}</CardTitle>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1 text-primary font-medium">
                                <User className="h-3.5 w-3.5" />
                                {idea.authorName}
                              </span>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true })}</span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 text-xs"
                            disabled={aiReviewMutation.isPending}
                            onClick={() => aiReviewMutation.mutate(idea.id)}
                          >
                            {aiReviewMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Brain className="h-3.5 w-3.5 text-primary" />
                            )}
                            {review ? "Re-run BYOC Peer Review" : "Run BYOC Peer Review"}
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3 text-sm">
                        <p className="text-foreground/90 whitespace-pre-wrap">{idea.content}</p>

                        {(idea.hypothesis || idea.methodology || idea.falsifiability) && (
                          <div className="grid gap-2 sm:grid-cols-3 pt-2">
                            {idea.hypothesis && (
                              <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20 text-xs">
                                <p className="font-semibold text-primary mb-1">Testable Prediction</p>
                                <p className="text-muted-foreground">{idea.hypothesis}</p>
                              </div>
                            )}
                            {idea.methodology && (
                              <div className="p-2.5 rounded-md bg-cyan-500/5 border border-cyan-500/20 text-xs">
                                <p className="font-semibold text-cyan-400 mb-1">Methodology / Experiment</p>
                                <p className="text-muted-foreground">{idea.methodology}</p>
                              </div>
                            )}
                            {idea.falsifiability && (
                              <div className="p-2.5 rounded-md bg-amber-500/5 border border-amber-500/20 text-xs">
                                <p className="font-semibold text-amber-400 mb-1">Falsification Criteria</p>
                                <p className="text-muted-foreground">{idea.falsifiability}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {review && (
                          <div className="mt-3 p-3.5 rounded-lg bg-emerald-500/5 border border-emerald-500/25 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4" />
                                First-Principles AI Peer Review
                              </span>
                              {typeof review.readinessScore === "number" && (
                                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                                  Readiness: {review.readinessScore}/100
                                </Badge>
                              )}
                            </div>
                            {review.noveltySummary && <p className="text-foreground/90">{review.noveltySummary}</p>}
                            {review.falsificationTest && (
                              <p className="text-muted-foreground">
                                <strong className="text-foreground">Recommended 2-Week Test:</strong> {review.falsificationTest}
                              </p>
                            )}
                            {Array.isArray(review.blindSpots) && review.blindSpots.length > 0 && (
                              <p className="text-muted-foreground">
                                <strong className="text-amber-400">Key Constraints / Blind Spots:</strong>{" "}
                                {review.blindSpots.join(" · ")}
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="pt-2 border-t border-border/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => upvoteIdeaMutation.mutate(idea.id)}
                          >
                            <ArrowUp className="h-4 w-4" />
                            {idea.upvotes}
                          </Button>
                          <Dialog
                            open={selectedIdeaId === idea.id}
                            onOpenChange={(open) => setSelectedIdeaId(open ? idea.id : null)}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                                <MessageSquare className="h-4 w-4" />
                                Discuss
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
                              <DialogHeader>
                                <DialogTitle>Peer Discussion: {idea.title}</DialogTitle>
                              </DialogHeader>
                              <div className="flex-1 overflow-y-auto pr-2 space-y-3 py-4 min-h-[260px]">
                                {comments.length === 0 ? (
                                  <div className="text-center py-8 text-muted-foreground italic text-sm">
                                    No comments yet. Add a critique, dataset link, or experimental result.
                                  </div>
                                ) : (
                                  comments.map((c) => (
                                    <div key={c.id} className="bg-card/60 p-3 rounded-lg border border-border/50">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-primary">{c.authorName}</span>
                                        <span className="text-[11px] text-muted-foreground">
                                          {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                                        </span>
                                      </div>
                                      <p className="text-sm text-foreground/90">{c.content}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (!newComment.trim() || !selectedIdeaId) return;
                                  commentMutation.mutate({ id: selectedIdeaId, content: newComment });
                                }}
                                className="pt-3 border-t border-border/50 flex gap-2"
                              >
                                <Input
                                  placeholder="Add your peer review or experimental notes..."
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  required
                                />
                                <Button type="submit" disabled={commentMutation.isPending}>
                                  Post
                                </Button>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: OER RESOURCE COMMONS */}
          <TabsContent value="commons" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Input
                    placeholder="Search MIT OCW, arXiv, OpenStax, textbooks, lectures..."
                    value={resourceSearch}
                    onChange={(e) => setResourceSearch(e.target.value)}
                    className="h-9"
                  />
                </div>
                {["all", "course", "paper", "textbook", "video"].map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={resourceTypeFilter === t ? "default" : "outline"}
                    className="h-8 text-xs capitalize"
                    onClick={() => setResourceTypeFilter(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>

              <Dialog open={isSubmitResourceOpen} onOpenChange={setIsSubmitResourceOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Add OER Resource
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle>Contribute to Open Educational Resource Commons</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleResourceSubmit} className="space-y-3 pt-2">
                    <div>
                      <Label className="text-xs">Title</Label>
                      <Input
                        placeholder="e.g., MIT 18.06 Linear Algebra (Gilbert Strang)"
                        value={resTitle}
                        onChange={(e) => setResTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">URL</Label>
                      <Input
                        type="url"
                        placeholder="https://ocw.mit.edu/..."
                        value={resUrl}
                        onChange={(e) => setResUrl(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select value={resType} onValueChange={setResType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="course">Course / Lecture Series</SelectItem>
                          <SelectItem value="textbook">Open Textbook</SelectItem>
                          <SelectItem value="paper">Research Paper / arXiv</SelectItem>
                          <SelectItem value="video">Video / Simulation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Why it's valuable</Label>
                      <Textarea
                        rows={2}
                        value={resDescription}
                        onChange={(e) => setResDescription(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={submitResourceMutation.isPending}>
                      Add Resource
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {loadingResources ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredResources.map((r) => (
                  <Card key={r.id} className="hover:border-emerald-500/40 transition-colors">
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {r.resourceType}
                          </Badge>
                          {r.providerName && (
                            <Badge variant="secondary" className="text-[10px]">
                              {r.providerName}
                            </Badge>
                          )}
                          {r.topicTitle && (
                            <span className="text-[11px] text-muted-foreground truncate">• {r.topicTitle}</span>
                          )}
                        </div>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-sm hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                        >
                          <span className="truncate">{r.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                        <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
