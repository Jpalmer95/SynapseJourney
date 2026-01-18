import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Lock, Zap, Flame, Star, Crown, Book, Sparkles, Sunrise, Moon, RefreshCw, Palette, GraduationCap, Brain, Lightbulb, Compass, Target, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav, SideNav } from "@/components/navigation";
import { format } from "date-fns";

interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement: { type: string; value: number };
  xpReward: number;
  isSecret: boolean;
  rarity: string;
}

interface UserAchievement {
  achievement: Achievement;
  earnedAt: string;
}

const iconMap: Record<string, typeof Trophy> = {
  Zap: Zap,
  Flame: Flame,
  Star: Star,
  Trophy: Trophy,
  Book: Book,
  BookOpen: BookOpen,
  Sparkles: Sparkles,
  Sunrise: Sunrise,
  Moon: Moon,
  RefreshCw: RefreshCw,
  Palette: Palette,
  GraduationCap: GraduationCap,
  Brain: Brain,
  Lightbulb: Lightbulb,
  Compass: Compass,
  Target: Target,
  Crown: Crown,
};

const rarityColors: Record<string, string> = {
  common: "border-gray-300 bg-gray-50 dark:bg-gray-900/30",
  uncommon: "border-green-400 bg-green-50 dark:bg-green-900/30",
  rare: "border-blue-400 bg-blue-50 dark:bg-blue-900/30",
  epic: "border-purple-400 bg-purple-50 dark:bg-purple-900/30",
  legendary: "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30",
};

const rarityBadgeColors: Record<string, string> = {
  common: "bg-gray-200 text-gray-700",
  uncommon: "bg-green-200 text-green-700",
  rare: "bg-blue-200 text-blue-700",
  epic: "bg-purple-200 text-purple-700",
  legendary: "bg-yellow-200 text-yellow-700",
};

const categoryLabels: Record<string, string> = {
  milestone: "Milestones",
  streak: "Streaks",
  rare: "Easter Eggs",
  mastery: "Mastery",
  research: "Research",
};

export default function AchievementsPage() {
  const { data: allAchievements, isLoading: achievementsLoading } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements"],
  });

  const { data: userAchievements, isLoading: userLoading } = useQuery<UserAchievement[]>({
    queryKey: ["/api/user/achievements"],
  });

  const { data: userXp } = useQuery<{ totalXp: number; level: number }>({
    queryKey: ["/api/user/xp"],
  });

  const { data: streak } = useQuery<{ currentStreak: number; longestStreak: number }>({
    queryKey: ["/api/user/streak"],
  });

  const earnedIds = new Set(userAchievements?.map(ua => ua.achievement.id) || []);
  
  // Group achievements by category
  const groupedAchievements = allAchievements?.reduce((acc, achievement) => {
    // Hide secret achievements that aren't earned
    if (achievement.isSecret && !earnedIds.has(achievement.id)) {
      return acc;
    }
    const category = achievement.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(achievement);
    return acc;
  }, {} as Record<string, Achievement[]>) || {};

  const earnedCount = userAchievements?.length || 0;
  const totalCount = allAchievements?.filter(a => !a.isSecret).length || 0;

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
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Achievements</h1>
            </div>
            <p className="text-muted-foreground">
              Track your learning milestones and unlock special achievements.
            </p>
          </motion.div>

          {/* Stats Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-8"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card data-testid="card-stat-earned">
                <CardContent className="p-4 text-center">
                  <Trophy className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                  <p className="text-2xl font-bold" data-testid="text-earned-count">{earnedCount}</p>
                  <p className="text-xs text-muted-foreground">Earned</p>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-xp">
                <CardContent className="p-4 text-center">
                  <Star className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold" data-testid="text-total-xp">{userXp?.totalXp || 0}</p>
                  <p className="text-xs text-muted-foreground">Total XP</p>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-streak">
                <CardContent className="p-4 text-center">
                  <Flame className="h-6 w-6 mx-auto mb-2 text-orange-500" />
                  <p className="text-2xl font-bold" data-testid="text-current-streak">{streak?.currentStreak || 0}</p>
                  <p className="text-xs text-muted-foreground">Day Streak</p>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-best-streak">
                <CardContent className="p-4 text-center">
                  <Crown className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold" data-testid="text-best-streak">{streak?.longestStreak || 0}</p>
                  <p className="text-xs text-muted-foreground">Best Streak</p>
                </CardContent>
              </Card>
            </div>
          </motion.div>

          {/* Progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Achievement Progress</span>
                  <span className="text-sm text-muted-foreground">{earnedCount} / {totalCount}</span>
                </div>
                <Progress value={(earnedCount / Math.max(totalCount, 1)) * 100} className="h-2" />
              </CardContent>
            </Card>
          </motion.div>

          {/* Achievement Categories */}
          {achievementsLoading || userLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[1, 2, 3, 4].map((j) => (
                        <Skeleton key={j} className="h-24" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAchievements).map(([category, achievements], catIndex) => (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + catIndex * 0.05 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{categoryLabels[category] || category}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {achievements.map((achievement, index) => {
                          const isEarned = earnedIds.has(achievement.id);
                          const userAch = userAchievements?.find(ua => ua.achievement.id === achievement.id);
                          const Icon = iconMap[achievement.icon] || Trophy;
                          const rarityColor = rarityColors[achievement.rarity] || rarityColors.common;
                          const badgeColor = rarityBadgeColors[achievement.rarity] || rarityBadgeColors.common;

                          return (
                            <motion.div
                              key={achievement.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.03 }}
                              className={`relative p-4 rounded-lg border-2 transition-all ${
                                isEarned
                                  ? rarityColor
                                  : "border-border bg-muted/30 opacity-60"
                              }`}
                              data-testid={`achievement-${achievement.id}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-md ${isEarned ? "bg-primary/20" : "bg-muted"}`}>
                                  {isEarned ? (
                                    <Icon className="h-5 w-5 text-primary" />
                                  ) : (
                                    <Lock className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h4 className="font-medium text-sm">{achievement.name}</h4>
                                    <Badge className={`text-xs ${badgeColor}`} variant="secondary">
                                      {achievement.rarity}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    {achievement.description}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-primary font-medium">+{achievement.xpReward} XP</span>
                                    {isEarned && userAch && (
                                      <span className="text-muted-foreground">
                                        Earned {format(new Date(userAch.earnedAt), "MMM d, yyyy")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
