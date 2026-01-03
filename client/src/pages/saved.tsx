import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BookMarked, Trash2, ExternalLink, Search } from "lucide-react";
import { BottomNav, SideNav } from "@/components/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { KnowledgeCard, Topic, Category } from "@shared/schema";

interface SavedItem {
  id: number;
  card: KnowledgeCard;
  topic: Topic;
  category?: Category;
  savedAt: string;
}

export function SavedPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: savedItems, isLoading } = useQuery<SavedItem[]>({
    queryKey: ["/api/saved"],
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

  const filteredItems = savedItems?.filter((item) =>
    item.card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.card.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.topic.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <SideNav />

      <div className="md:pl-16">
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-8">
            <div className="flex items-center gap-3">
              <BookMarked className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Saved</h1>
            </div>
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
          </div>
          <div className="px-4 pb-4 md:px-8">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search saved cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-saved"
              />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 md:px-8 pb-24 md:pb-8">
          {isLoading ? (
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
          ) : !filteredItems || filteredItems.length === 0 ? (
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
              {filteredItems.map((item, index) => (
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
                          <CardTitle className="text-lg leading-tight">
                            {item.card.title}
                          </CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeMutation.mutate(item.card.id)}
                          data-testid={`button-remove-saved-${item.card.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                        {item.card.content}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          From: {item.topic.title}
                        </span>
                        <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-explore-${item.card.id}`}>
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
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
