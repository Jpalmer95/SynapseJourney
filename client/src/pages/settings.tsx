import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Brain, Calculator, Code, Beaker, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav, SideNav } from "@/components/navigation";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface CategoryPreference {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  enabled: boolean;
}

const iconMap: Record<string, typeof Brain> = {
  Brain: Brain,
  Calculator: Calculator,
  Code: Code,
  Beaker: Beaker,
};

const colorMap: Record<string, string> = {
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
};

export default function SettingsPage() {
  const { data: preferences, isLoading } = useQuery<CategoryPreference[]>({
    queryKey: ["/api/user/preferences"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ categoryId, enabled }: { categoryId: number; enabled: boolean }) => {
      return apiRequest("POST", "/api/user/preferences", { categoryId, enabled });
    },
    onMutate: async ({ categoryId, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/user/preferences"] });
      const previous = queryClient.getQueryData<CategoryPreference[]>(["/api/user/preferences"]);
      
      queryClient.setQueryData<CategoryPreference[]>(["/api/user/preferences"], (old) =>
        old?.map((p) => (p.categoryId === categoryId ? { ...p, enabled } : p))
      );
      
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/user/preferences"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed/personalized"] });
    },
  });

  const enabledCount = preferences?.filter((p) => p.enabled).length || 0;

  return (
    <div className="min-h-screen bg-background">
      <BottomNav />
      <SideNav />
      
      <main className="pb-20 md:pb-8 md:pl-20">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-md bg-primary/10">
                <SettingsIcon className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
            </div>
            <p className="text-muted-foreground">
              Customize your learning experience by selecting the topics that interest you.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Learning Categories</CardTitle>
                    <CardDescription>
                      Toggle categories on/off to customize your feed
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" data-testid="badge-enabled-count">
                    {enabledCount} enabled
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-md" />
                          <Skeleton className="h-5 w-32" />
                        </div>
                        <Skeleton className="h-6 w-10" />
                      </div>
                    ))}
                  </>
                ) : (
                  preferences?.map((pref, index) => {
                    const Icon = iconMap[pref.categoryIcon] || Brain;
                    const bgColor = colorMap[pref.categoryColor] || "bg-gray-500";

                    return (
                      <motion.div
                        key={pref.categoryId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          pref.enabled
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-muted/30"
                        }`}
                        data-testid={`category-preference-${pref.categoryId}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${bgColor}`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">{pref.categoryName}</p>
                            <p className="text-sm text-muted-foreground">
                              {pref.enabled ? (
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <Check className="h-3 w-3" /> Showing in feed
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <X className="h-3 w-3" /> Hidden from feed
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={pref.enabled}
                          onCheckedChange={(enabled) => {
                            toggleMutation.mutate({ categoryId: pref.categoryId, enabled });
                          }}
                          disabled={toggleMutation.isPending}
                          data-testid={`switch-category-${pref.categoryId}`}
                        />
                      </motion.div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>About Your Feed</CardTitle>
                <CardDescription>
                  How category preferences work
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  When you disable a category, cards from that category won&apos;t appear in your personalized feed.
                </p>
                <p>
                  You can still access all topics through the Knowledge Map, even if their category is disabled.
                </p>
                <p>
                  As we expand to more subjects and industries, you&apos;ll have finer control over what appears in your learning journey.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
