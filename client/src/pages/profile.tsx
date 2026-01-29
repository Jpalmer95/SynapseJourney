import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  User,
  BookOpen,
  Zap,
  Trophy,
  Calendar,
  Clock,
  TrendingUp,
  LogOut,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

interface UserStats {
  topicsExplored: number;
  topicsMastered: number;
  totalTimeSpent: number;
  currentStreak: number;
  longestStreak: number;
  savedCards: number;
}

interface RecentTopic {
  id: number;
  title: string;
  category: string;
  mastery: number;
  lastAccessed: string;
}

interface UserXpData {
  totalXp: number;
  level: number;
  xpToNextLevel: number;
  progress: number;
}

export function ProfilePage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ["/api/user/stats"],
  });

  const { data: recentTopics, isLoading: topicsLoading } = useQuery<RecentTopic[]>({
    queryKey: ["/api/user/recent-topics"],
  });

  const { data: userXp } = useQuery<UserXpData>({
    queryKey: ["/api/user/xp"],
  });

  const isLoading = authLoading || statsLoading;

  const defaultStats: UserStats = {
    topicsExplored: 12,
    topicsMastered: 4,
    totalTimeSpent: 1840,
    currentStreak: 7,
    longestStreak: 14,
    savedCards: 23,
  };

  const displayStats = stats || defaultStats;

  const defaultRecentTopics: RecentTopic[] = [
    { id: 1, title: "Machine Learning", category: "AI", mastery: 75, lastAccessed: "2 hours ago" },
    { id: 2, title: "Linear Algebra", category: "Math", mastery: 85, lastAccessed: "1 day ago" },
    { id: 3, title: "Neural Networks", category: "AI", mastery: 60, lastAccessed: "2 days ago" },
  ];

  const displayRecentTopics = recentTopics || defaultRecentTopics;

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <AppLayout mobileTitle="Profile">
      <div className="px-4 py-6 md:px-8 pb-24 md:pb-8 max-w-4xl mx-auto pt-16 md:pt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback className="text-2xl">
                      {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || <User className="h-10 w-10" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-2xl font-bold mb-1">
                      {user?.firstName && user?.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user?.email || "Learner"}
                    </h2>
                    <p className="text-muted-foreground mb-4">{user?.email}</p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Zap className="h-3 w-3" />
                        {displayStats.currentStreak} day streak
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Trophy className="h-3 w-3" />
                        {displayStats.topicsMastered} topics mastered
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => logout()} className="gap-2" data-testid="button-logout-profile">
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {userXp && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-6"
            >
              <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 border-4 border-primary">
                      <span className="text-3xl font-bold text-primary">{userXp.level}</span>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                        <Trophy className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">Level {userXp.level} Learner</h3>
                      </div>
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{userXp.totalXp} XP total</span>
                          <span className="text-muted-foreground">{userXp.xpToNextLevel} XP to level {userXp.level + 1}</span>
                        </div>
                        <Progress value={userXp.progress} className="h-2" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Keep learning to earn XP and level up! Spend time in modules to gain experience.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
          >
            <Card>
              <CardContent className="pt-6 text-center">
                <BookOpen className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-3xl font-bold">{displayStats.topicsExplored}</p>
                <p className="text-sm text-muted-foreground">Topics Explored</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Trophy className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">{displayStats.topicsMastered}</p>
                <p className="text-sm text-muted-foreground">Mastered</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Clock className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">{formatTime(displayStats.totalTimeSpent)}</p>
                <p className="text-sm text-muted-foreground">Time Spent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Calendar className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">{displayStats.longestStreak}</p>
                <p className="text-sm text-muted-foreground">Best Streak</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Recent Learning Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topicsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-md" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-1/3 mb-2" />
                          <Skeleton className="h-2 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : displayRecentTopics.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Start exploring to track your learning progress
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayRecentTopics.map((topic, index) => (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                        className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                        onClick={() => navigate(`/rabbit-hole?topic=${topic.id}`)}
                        data-testid={`recent-topic-${topic.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{topic.title}</span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {topic.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={topic.mastery} className="flex-1 h-1.5" />
                            <span className="text-xs text-muted-foreground shrink-0">
                              {topic.mastery}%
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {topic.lastAccessed}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
      </div>
    </AppLayout>
  );
}
