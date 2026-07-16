import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BookMarked,
  Trash2,
  ExternalLink,
  Search,
  Library,
  Target,
  Sparkles,
  Play,
  BookOpen,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useState } from "react";
import type { KnowledgeCard, Topic, Category } from "@shared/schema";
import type { MyCourseItem } from "@/components/my-courses-strip";
import { cn } from "@/lib/utils";

interface SavedItem {
  id: number;
  card: KnowledgeCard;
  topic: Topic;
  category?: Category;
  savedAt: string;
}

type Tab = "courses" | "cards";

export function SavedPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialTab = (params.get("tab") === "cards" ? "cards" : "courses") as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);
  const { toast } = useToast();

  const { data: savedItems, isLoading: cardsLoading } = useQuery<SavedItem[]>({
    queryKey: ["/api/saved"],
  });

  const { data: myCourses, isLoading: coursesLoading } = useQuery<MyCourseItem[]>({
    queryKey: ["/api/learn/my-courses"],
  });

  const removeMutation = useMutation({
    mutationFn: async (cardId: number) => {
      await apiRequest("DELETE", `/api/saved/${cardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved"] });
      toast({
        title: "Removed",
        description: "Card removed from saved collection",
      });
    },
  });

  const filteredCards = savedItems?.filter(
    (item) =>
      item.card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.card.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.topic.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredCourses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return myCourses || [];
    return (myCourses || []).filter(
      (c) =>
        c.topic.title.toLowerCase().includes(q) ||
        (c.goal?.goalText || "").toLowerCase().includes(q) ||
        (c.topic.description || "").toLowerCase().includes(q),
    );
  }, [myCourses, searchQuery]);

  const setTabAndUrl = (next: Tab) => {
    setTab(next);
    navigate(next === "courses" ? "/saved?tab=courses" : "/saved?tab=cards", { replace: true } as any);
  };

  return (
    <AppLayout showMobileHeader={false}>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border pt-16 md:pt-0">
        <div className="flex items-center gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <BookMarked className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Library</h1>
          </div>
        </div>

        <div className="px-4 md:px-8 flex gap-2 pb-3">
          <Button
            size="sm"
            variant={tab === "courses" ? "default" : "outline"}
            onClick={() => setTabAndUrl("courses")}
            data-testid="tab-courses"
          >
            <Library className="h-3.5 w-3.5 mr-1.5" />
            My courses & goals
            {myCourses && myCourses.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px]">
                {myCourses.length}
              </Badge>
            )}
          </Button>
          <Button
            size="sm"
            variant={tab === "cards" ? "default" : "outline"}
            onClick={() => setTabAndUrl("cards")}
            data-testid="tab-cards"
          >
            <BookMarked className="h-3.5 w-3.5 mr-1.5" />
            Saved cards
          </Button>
        </div>

        <div className="px-4 pb-4 md:px-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tab === "courses" ? "Search your courses and goals..." : "Search saved cards..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-saved"
            />
          </div>
        </div>
      </header>

      <div className="px-4 py-6 md:px-8 pb-24 md:pb-8">
        {tab === "courses" ? (
          coursesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="p-4 rounded-full bg-muted mb-4">
                <Library className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {searchQuery ? "No matching courses" : "No courses yet"}
              </h2>
              <p className="text-muted-foreground max-w-md">
                {searchQuery
                  ? "Try a different search"
                  : "Start a Goal on Home, or have Hermes upload a course — it will show up here so you can reopen and track progress anytime."}
              </p>
              <Button className="mt-4" onClick={() => navigate("/")}>
                Go to Home
              </Button>
            </motion.div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.map((item, index) => (
                <motion.div
                  key={item.topic.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Card
                    className="group h-full flex flex-col hover-elevate"
                    data-testid={`library-course-${item.topic.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg leading-tight">{item.topic.title}</CardTitle>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] shrink-0 capitalize",
                            item.source === "hermes" && "border-violet-500/40 text-violet-300",
                            item.source === "goal" && "border-amber-500/40 text-amber-200",
                          )}
                        >
                          {item.source === "hermes" ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Sparkles className="h-2.5 w-2.5" /> Hermes
                            </span>
                          ) : item.source === "goal" ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Target className="h-2.5 w-2.5" /> Goal
                            </span>
                          ) : (
                            item.source
                          )}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-3">
                      {item.goal?.goalText && (
                        <p className="text-sm text-muted-foreground line-clamp-3">{item.goal.goalText}</p>
                      )}
                      {!item.goal?.goalText && item.topic.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3">{item.topic.description}</p>
                      )}
                      <div className="space-y-1 mt-auto">
                        <Progress value={item.progressPercent} className="h-1.5" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            {item.completedUnits}/{item.totalUnits} units
                          </span>
                          <span className="capitalize">{item.status}</span>
                        </div>
                      </div>
                      <Button
                        className="w-full gap-1.5"
                        onClick={() => navigate(`/rabbit-hole?topic=${item.topic.id}`)}
                        data-testid={`button-open-library-course-${item.topic.id}`}
                      >
                        <Play className="h-4 w-4" />
                        {item.progressPercent > 0 ? "Continue" : "Open course"}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )
        ) : cardsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !filteredCards || filteredCards.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="p-4 rounded-full bg-muted mb-4">
              <BookMarked className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {searchQuery ? "No matching cards" : "No saved cards yet"}
            </h2>
            <p className="text-muted-foreground max-w-sm">
              {searchQuery
                ? "Try adjusting your search terms"
                : "Start exploring and save cards that spark your curiosity"}
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCards.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="group h-full flex flex-col hover-elevate">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {item.category && (
                            <Badge variant="secondary" className="text-xs">
                              {item.category.name}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg leading-tight">{item.card.title}</CardTitle>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-remove-saved-${item.card.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove "{item.card.title}" from your saved cards. This action
                              cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeMutation.mutate(item.card.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                      {item.card.content}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">From: {item.topic.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => navigate(`/rabbit-hole?topic=${item.topic.id}`)}
                        data-testid={`button-explore-${item.card.id}`}
                      >
                        Explore
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
