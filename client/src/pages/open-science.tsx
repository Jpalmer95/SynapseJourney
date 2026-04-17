import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Telescope, ArrowUp, MessageSquare, Plus, User, Link as LinkIcon, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import type { OpenScienceIdea, Topic, OpenScienceComment } from "@shared/schema";

export function OpenSciencePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("none");

  const [newComment, setNewComment] = useState("");

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  const { data: ideas = [], isLoading } = useQuery<(OpenScienceIdea & { topic?: Topic })[]>({
    queryKey: ["/api/open-science"],
  });

  const { data: comments = [] } = useQuery<OpenScienceComment[]>({
    queryKey: ["/api/open-science", selectedIdeaId, "comments"],
    enabled: !!selectedIdeaId,
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string; topicId?: number }) => {
      const res = await fetch("/api/open-science", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to submit idea");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/open-science"] });
      setIsSubmitOpen(false);
      setNewTitle("");
      setNewContent("");
      setSelectedTopicId("none");
      toast({ title: "Theory Submitted", description: "Your idea has been added to the global feed!" });
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/open-science/${id}/upvote`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to upvote");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/open-science"] });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    submitMutation.mutate({
      title: newTitle,
      content: newContent,
      topicId: selectedTopicId !== "none" ? parseInt(selectedTopicId) : undefined,
    });
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedIdeaId) return;
    commentMutation.mutate({ id: selectedIdeaId, content: newComment });
  };

  return (
    <AppLayout mobileTitle="Open Science">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Telescope className="h-8 w-8 text-primary" />
              Open Science Hub
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl">
              A global, crowdsourced pool of theories, research proposals, and learning epiphanies. 
              Submit your ideas for humanity to explore, discuss, and build upon.
            </p>
          </div>
          
          <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-white border border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <Plus className="h-5 w-5" />
                Submit Concept
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-border bg-[#0f172a]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Propose Research Idea
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Brief, descriptive title..." 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Link to a Topic (Optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific topic (General)</SelectItem>
                      {topics.map(t => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Textarea 
                    placeholder="Describe your theory, hypothesis, or insight in detail..." 
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    rows={6}
                    required
                    className="resize-none"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? "Submitting..." : "Publish to Hub"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : ideas.length === 0 ? (
          <Card className="p-12 text-center border-dashed bg-card/50">
            <Telescope className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-medium mb-2">No Theories Yet</h3>
            <p className="text-muted-foreground mb-4">Be the first to propose a concept to the global community.</p>
            <Button variant="outline" onClick={() => setIsSubmitOpen(true)}>Initialize Discussion</Button>
          </Card>
        ) : (
          <div className="grid gap-6">
            {ideas.map((idea) => (
              <Card key={idea.id} className="bg-card/40 backdrop-blur border-border/50 hover:bg-card/60 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <CardTitle className="text-xl leading-tight mb-2">
                        {idea.title}
                      </CardTitle>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1 text-primary">
                          <User className="h-4 w-4" />
                          {idea.authorName}
                        </span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true })}</span>
                        {idea.topic && (
                          <>
                            <span>•</span>
                            <Badge variant="secondary" className="flex items-center gap-1 font-normal hover:bg-secondary/80">
                              <LinkIcon className="h-3 w-3" />
                              <Link href={`/rabbit-hole?topic=${idea.topic.id}`}>
                                {idea.topic.title}
                              </Link>
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/90 whitespace-pre-wrap">{idea.content}</p>
                </CardContent>
                <CardFooter className="pt-2 border-t border-border/30 mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2 hover:bg-primary/20 hover:text-primary transition-colors"
                      onClick={() => upvoteMutation.mutate(idea.id)}
                      disabled={upvoteMutation.isPending}
                    >
                      <ArrowUp className="h-4 w-4" />
                      {idea.upvotes}
                    </Button>
                    <Dialog open={selectedIdeaId === idea.id} onOpenChange={(open) => setSelectedIdeaId(open ? idea.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                          <MessageSquare className="h-4 w-4" />
                          Discuss
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col bg-[#0f172a] border-border">
                        <DialogHeader>
                          <DialogTitle>Discussion: {idea.title}</DialogTitle>
                        </DialogHeader>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 min-h-[300px]">
                          {comments.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground italic">
                              No peer reviews or discussions yet.
                            </div>
                          ) : (
                            comments.map(c => (
                              <div key={c.id} className="bg-card/50 p-3 rounded-lg border border-border/50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-semibold text-primary">{c.authorName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                                  </span>
                                </div>
                                <p className="text-sm text-foreground/90">{c.content}</p>
                              </div>
                            ))
                          )}
                        </div>

                        <form onSubmit={handleComment} className="pt-4 border-t border-border/50 flex gap-2">
                          <Input 
                            placeholder="Add your thoughts or research..." 
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
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
