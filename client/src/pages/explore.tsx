import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, Loader2, ChevronRight, Plus, BookOpen, Compass, Clock, CheckCircle, AlertCircle, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav, SideNav } from "@/components/navigation";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface Topic {
  id: number;
  title: string;
  description: string;
  categoryId: number;
  difficulty: string;
}

interface CustomTopic {
  id: number;
  userId: string;
  title: string;
  description: string;
  status: string;
  generatedTopicId: number | null;
  createdAt: string;
}

const TOPICS_PER_PAGE = 10;

export default function ExplorePage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: topics, isLoading: topicsLoading } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  const { data: customTopics, isLoading: customLoading } = useQuery<CustomTopic[]>({
    queryKey: ["/api/user/custom-topics"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      return apiRequest("POST", "/api/custom-topics", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/custom-topics"] });
      setShowCreateForm(false);
      setNewTopicTitle("");
      setNewTopicDescription("");
      toast({
        title: "Journey Started!",
        description: "We're generating your personalized learning journey. This may take a minute.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create topic. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredTopics = topics?.filter(topic =>
    topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleCreate = () => {
    if (!newTopicTitle.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a topic title.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      title: newTopicTitle,
      description: newTopicDescription || `Learn about ${newTopicTitle}`,
    });
  };

  const statusIcons: Record<string, typeof Loader2> = {
    pending: Clock,
    generating: Loader2,
    ready: CheckCircle,
    failed: AlertCircle,
  };

  const statusColors: Record<string, string> = {
    pending: "text-yellow-500",
    generating: "text-blue-500",
    ready: "text-green-500",
    failed: "text-red-500",
  };

  return (
    <div className="min-h-screen bg-background">
      <BottomNav />
      <SideNav />
      
      <main className="pb-20 md:pb-8 md:pl-20">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-md bg-primary/10">
                <Compass className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Explore Topics</h1>
            </div>
            <p className="text-muted-foreground">
              Search existing topics or create a custom learning journey on any subject.
            </p>
          </motion.div>

          {/* Search and Create */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-8"
          >
            <Card>
              <CardContent className="p-6">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search for any topic... (e.g., music theory, quantum physics, networking)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-topics"
                  />
                </div>
                
                {searchQuery && filteredTopics.length === 0 && !topicsLoading && (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-4">
                      No existing topics match "{searchQuery}"
                    </p>
                    <Button onClick={() => {
                      setNewTopicTitle(searchQuery);
                      setShowCreateForm(true);
                    }} data-testid="btn-create-from-search">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Create Custom Journey for "{searchQuery}"
                    </Button>
                  </div>
                )}

                {!showCreateForm && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowCreateForm(true)}
                    data-testid="btn-show-create-form"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Custom Learning Journey
                  </Button>
                )}

                <AnimatePresence>
                  {showCreateForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 space-y-4"
                    >
                      <div>
                        <label className="text-sm font-medium mb-1 block">Topic Title</label>
                        <Input
                          placeholder="e.g., Music Theory, Electrical Engineering, Open Source Contributing"
                          value={newTopicTitle}
                          onChange={(e) => setNewTopicTitle(e.target.value)}
                          data-testid="input-new-topic-title"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Description (optional)</label>
                        <Textarea
                          placeholder="What would you like to learn? Any specific focus areas?"
                          value={newTopicDescription}
                          onChange={(e) => setNewTopicDescription(e.target.value)}
                          rows={3}
                          data-testid="input-new-topic-description"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleCreate}
                          disabled={createMutation.isPending}
                          data-testid="btn-create-topic"
                        >
                          {createMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Generate Learning Journey
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowCreateForm(false)}
                          data-testid="btn-cancel-create"
                        >
                          Cancel
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Custom Topics */}
          {customTopics && customTopics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <h2 className="text-lg font-semibold mb-4">Your Custom Journeys</h2>
              <div className="grid gap-4">
                {customTopics.map((ct, index) => {
                  const StatusIcon = statusIcons[ct.status] || Clock;
                  const statusColor = statusColors[ct.status] || "text-gray-500";

                  return (
                    <motion.div
                      key={ct.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {ct.status === "ready" && ct.generatedTopicId ? (
                        <Link href={`/rabbit-hole?topic=${ct.generatedTopicId}`}>
                          <Card className="hover-elevate cursor-pointer">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                <div className="p-3 rounded-md bg-primary/10">
                                  <BookOpen className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-medium">{ct.title}</h3>
                                  <p className="text-sm text-muted-foreground line-clamp-1">{ct.description}</p>
                                </div>
                                <Badge variant="secondary" className="text-green-600">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Ready
                                </Badge>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ) : (
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <div className="p-3 rounded-md bg-muted">
                                <StatusIcon className={`h-5 w-5 ${statusColor} ${ct.status === "generating" ? "animate-spin" : ""}`} />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-medium">{ct.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {ct.status === "generating" && "Generating your personalized lessons..."}
                                  {ct.status === "pending" && "Waiting to start generation..."}
                                  {ct.status === "failed" && "Generation failed. Please try again."}
                                </p>
                              </div>
                              <Badge variant="secondary" className={statusColor}>
                                {ct.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Search Results / All Topics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h2 className="text-lg font-semibold mb-4">
              {searchQuery ? `Results for "${searchQuery}"` : "All Topics"}
            </h2>
            
            {topicsLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <>
                {(() => {
                  const displayTopics = searchQuery 
                    ? filteredTopics 
                    : filteredTopics.slice((currentPage - 1) * TOPICS_PER_PAGE, currentPage * TOPICS_PER_PAGE);
                  const totalPages = Math.ceil(filteredTopics.length / TOPICS_PER_PAGE);

                  return (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        {displayTopics.map((topic, index) => (
                          <motion.div
                            key={topic.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <Link href={`/rabbit-hole?topic=${topic.id}`}>
                              <Card className="hover-elevate cursor-pointer h-full">
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-md bg-primary/10 shrink-0">
                                      <BookOpen className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-medium mb-1">{topic.title}</h3>
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {topic.description}
                                      </p>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                                  </div>
                                </CardContent>
                              </Card>
                            </Link>
                          </motion.div>
                        ))}
                      </div>

                      {/* Pagination controls */}
                      {!searchQuery && totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-6">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            data-testid="btn-prev-page"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            data-testid="btn-next-page"
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}

                      {/* Topic count info */}
                      <p className="text-center text-sm text-muted-foreground mt-4">
                        {searchQuery 
                          ? `Found ${filteredTopics.length} topic${filteredTopics.length !== 1 ? 's' : ''}`
                          : `Showing ${(currentPage - 1) * TOPICS_PER_PAGE + 1}-${Math.min(currentPage * TOPICS_PER_PAGE, filteredTopics.length)} of ${filteredTopics.length} topics`
                        }
                      </p>
                    </>
                  );
                })()}
              </>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
