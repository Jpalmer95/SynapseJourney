import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  User,
  BookOpen,
  Zap,
  Trophy,
  Calendar,
  Clock,
  TrendingUp,
  LogOut,
  Coins,
  Star,
  Map as MapIcon,
  Settings,
  BookMarked,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CoursePoster } from "@/components/course-poster";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";

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

  const { data: novaCoinsData } = useQuery<{
    id: number;
    userId: string;
    totalCoins: number;
    updatedAt: string;
  } | null>({
    queryKey: ["/api/user/nova-coins"],
  });

  const { data: timeline = [] } = useQuery<
    {
      id: number;
      topicId: number | null;
      topicTitle?: string;
      eventType: string;
      metadata: any;
      createdAt: string;
    }[]
  >({
    queryKey: ["/api/learn/timeline"],
  });

  const { data: posters = [] } = useQuery<
    {
      id: number;
      topicId: number;
      topicTitle?: string;
      posterJson: any;
      createdAt: string;
    }[]
  >({
    queryKey: ["/api/learn/posters"],
  });

  const defaultStats: UserStats = {
    topicsExplored: 0,
    topicsMastered: 0,
    totalTimeSpent: 0,
    currentStreak: 0,
    longestStreak: 0,
    savedCards: 0,
  };

  const displayStats = stats || defaultStats;
  const displayRecentTopics = recentTopics || [];

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <AppLayout mobileTitle="Learning Journey">
      <div className="px-4 py-6 md:px-8 pb-24 md:pb-12 max-w-5xl mx-auto pt-16 md:pt-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-2xl">
                    {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || <User className="h-10 w-10" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-2xl font-bold mb-1">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email || "Polymath Learner"}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-3">{user?.email}</p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Zap className="h-3 w-3 text-amber-500" />
                      {displayStats.currentStreak} day streak
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Trophy className="h-3 w-3 text-emerald-500" />
                      {displayStats.topicsMastered} topics mastered
                    </Badge>
                    <Link href="/map">
                      <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-primary/10">
                        <MapIcon className="h-3 w-3 text-primary" />
                        Open 3D Knowledge Web
                      </Badge>
                    </Link>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/saved">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <BookMarked className="h-4 w-4" />
                      Saved Library
                    </Button>
                  </Link>
                  <Link href="/achievements">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Trophy className="h-4 w-4" />
                      Trophies
                    </Button>
                  </Link>
                  <Link href="/settings">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Settings className="h-4 w-4" />
                      BYOC & MCP
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => logout()} className="gap-1.5" data-testid="button-logout-profile">
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {userXp && (
          <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 border-4 border-primary">
                  <span className="text-2xl font-bold text-primary">{userXp.level}</span>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Level {userXp.level} Polymath</h3>
                  </div>
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{userXp.totalXp} XP total</span>
                      <span className="text-muted-foreground">
                        {userXp.xpToNextLevel} XP to level {userXp.level + 1}
                      </span>
                    </div>
                    <Progress value={userXp.progress} className="h-2" />
                  </div>
                </div>
                <div
                  className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 min-w-[100px]"
                  data-testid="section-nova-coins"
                >
                  <Coins className="h-5 w-5 text-amber-500" />
                  <span className="text-xl font-bold text-amber-400" data-testid="text-nova-coin-balance">
                    {novaCoinsData?.totalCoins ?? 0}
                  </span>
                  <span className="text-[11px] text-muted-foreground text-center">Nova Coins</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <BookOpen className="h-7 w-7 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{displayStats.topicsExplored}</p>
              <p className="text-xs text-muted-foreground">Topics Explored</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Trophy className="h-7 w-7 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{displayStats.topicsMastered}</p>
              <p className="text-xs text-muted-foreground">Mastered</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Clock className="h-7 w-7 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{formatTime(displayStats.totalTimeSpent)}</p>
              <p className="text-xs text-muted-foreground">Time Invested</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Calendar className="h-7 w-7 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{displayStats.longestStreak}</p>
              <p className="text-xs text-muted-foreground">Best Streak</p>
            </CardContent>
          </Card>
        </div>

        {/* Two-column Activity & Chronological Timeline */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Active & Recent Topics
              </CardTitle>
              <CardDescription className="text-xs">
                Click any topic to jump directly back into your course units.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topicsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-md" />
                  ))}
                </div>
              ) : displayRecentTopics.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Start any course from the Command Center to track your mastery here.
                </div>
              ) : (
                <div className="space-y-3">
                  {displayRecentTopics.map((topic) => (
                    <div
                      key={topic.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => navigate(`/rabbit-hole?topic=${topic.id}`)}
                      data-testid={`recent-topic-${topic.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{topic.title}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {topic.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={topic.mastery} className="flex-1 h-1.5" />
                          <span className="text-xs text-muted-foreground shrink-0">{topic.mastery}%</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{topic.lastAccessed}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chronological Learning Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Chronological Learning Log
              </CardTitle>
              <CardDescription className="text-xs">
                Account-level audit trail of courses started, units completed, and mastery milestones.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Your timeline events will appear here as you progress through lessons and goals.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {timeline.slice(0, 20).map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-lg border border-border/50 bg-background/50 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {ev.eventType.replace(/_/g, " ")}
                          </Badge>
                          {ev.topicId && (
                            <Link href={`/rabbit-hole?topic=${ev.topicId}`}>
                              <span className="font-medium text-primary hover:underline cursor-pointer">
                                {ev.topicTitle || `Topic #${ev.topicId}`}
                              </span>
                            </Link>
                          )}
                        </div>
                        {ev.metadata?.unitTitle && (
                          <p className="text-muted-foreground">Unit: {ev.metadata.unitTitle}</p>
                        )}
                        {ev.metadata?.goalText && (
                          <p className="text-muted-foreground">Goal: {ev.metadata.goalText}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Earned Course Posters */}
        {posters.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-purple-400" />
                Earned Course Completion Posters ({posters.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {posters.map((p) => (
                <CoursePoster
                  key={p.id}
                  poster={p.posterJson}
                  topicTitle={p.topicTitle || `Topic #${p.topicId}`}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
